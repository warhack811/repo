import type {
	AnyRuntimeEvent,
	DiffBlock,
	InspectionDetailBlock,
	InspectionDetailItem,
	InspectionDetailLevel,
	InspectionTargetKind,
	RenderBlock,
	RunTimelineBlock,
	SearchResultBlock,
	TraceDebugBlock,
	WorkspaceInspectionBlock,
} from '@runa/types';

import type { WorkspaceLayer } from '../context/compose-workspace-context.js';
import { readModelUsageEventMetadata } from '../runtime/model-usage-accounting.js';

const DEFAULT_DETAIL_LEVEL: InspectionDetailLevel = 'standard';
const INSPECTION_DETAIL_TITLE_SUFFIX = 'Details';
const MAX_DETAIL_ITEM_VALUE_LENGTH = 180;
const MAX_MATCH_ITEMS_EXPANDED = 4;
const MAX_MATCH_ITEMS_STANDARD = 2;
const MAX_NOTE_ITEMS_EXPANDED = 3;
const MAX_NOTE_ITEMS_STANDARD = 2;
const MAX_PATH_ITEMS_EXPANDED = 5;
const MAX_PATH_ITEMS_STANDARD = 3;
const MAX_SCRIPT_ITEMS_STANDARD = 4;
const MAX_TIMELINE_EXTRA_ITEMS_EXPANDED = 2;
const MAX_TIMELINE_TOOL_ITEMS_EXPANDED = 4;
const MAX_TIMELINE_TOOL_ITEMS_STANDARD = 3;

interface MapInspectionDetailInput {
	readonly blocks: readonly RenderBlock[];
	readonly created_at: string;
	readonly detail_level?: InspectionDetailLevel;
	readonly events?: readonly AnyRuntimeEvent[];
	readonly run_id: string;
	readonly target_id?: string;
	readonly target_kind: InspectionTargetKind;
	readonly trace_id?: string;
	readonly workspace_layer?: WorkspaceLayer;
}

type TargetBlock =
	| DiffBlock
	| RunTimelineBlock
	| SearchResultBlock
	| TraceDebugBlock
	| WorkspaceInspectionBlock;

type TimelinePayloadItem = RunTimelineBlock['payload']['items'][number];

interface DiffPreviewStats {
	readonly addition_count: number;
	readonly deletion_count: number;
	readonly preview_line_count: number;
}

function normalizeText(value: string): string {
	return value.replace(/\s+/gu, ' ').trim();
}

function normalizeOptionalText(value: string | undefined): string | undefined {
	if (!value) {
		return undefined;
	}

	const normalizedValue = normalizeText(value);

	if (normalizedValue.length === 0) {
		return undefined;
	}

	return normalizedValue.length > MAX_DETAIL_ITEM_VALUE_LENGTH
		? `${normalizedValue.slice(0, MAX_DETAIL_ITEM_VALUE_LENGTH - 3)}...`
		: normalizedValue;
}

function shortenIdentifier(value: string): string {
	const normalizedValue = normalizeText(value);

	if (normalizedValue.length <= 20) {
		return normalizedValue;
	}

	return `${normalizedValue.slice(0, 8)}...${normalizedValue.slice(-6)}`;
}

function trimTrailingPeriod(value: string): string {
	return value.endsWith('.') ? value.slice(0, -1) : value;
}

function appendUniqueValue(values: string[], value: string | undefined): void {
	if (!value || values.includes(value)) {
		return;
	}

	values.push(value);
}

function createDetailItem(
	label: string,
	value: string | undefined,
): InspectionDetailItem | undefined {
	const normalizedValue = normalizeOptionalText(value);

	if (!normalizedValue) {
		return undefined;
	}

	return {
		label,
		value: normalizedValue,
	};
}

function createJoinedDetailItem(
	label: string,
	values: readonly string[] | undefined,
	maxVisibleValues: number,
): InspectionDetailItem | undefined {
	if (!values || values.length === 0) {
		return undefined;
	}

	const visibleValues = Array.from(
		new Set(values.map((value) => normalizeText(value)).filter((value) => value.length > 0)),
	);

	if (visibleValues.length === 0) {
		return undefined;
	}

	const limitedValues = visibleValues.slice(0, maxVisibleValues);
	const hiddenCount = visibleValues.length - limitedValues.length;
	const suffix = hiddenCount > 0 ? ` +${hiddenCount} more` : '';

	return createDetailItem(label, `${limitedValues.join(', ')}${suffix}`);
}

function pushDetailItem(
	items: InspectionDetailItem[],
	item: InspectionDetailItem | undefined,
): void {
	if (!item) {
		return;
	}

	if (
		items.some(
			(existingItem) => existingItem.label === item.label && existingItem.value === item.value,
		)
	) {
		return;
	}

	items.push(item);
}

function getRequestedDetailLevel(value: InspectionDetailLevel | undefined): InspectionDetailLevel {
	return value ?? DEFAULT_DETAIL_LEVEL;
}

function buildRunContextValue(input: MapInspectionDetailInput): string {
	const runLabel = `run ${shortenIdentifier(input.run_id)}`;

	return input.trace_id ? `${runLabel} / trace ${shortenIdentifier(input.trace_id)}` : runLabel;
}

function isBlockOfType<TType extends RenderBlock['type']>(
	block: RenderBlock,
	blockType: TType,
): block is Extract<RenderBlock, { type: TType }> {
	return block.type === blockType;
}

function findLatestBlockByType<TType extends RenderBlock['type']>(
	blocks: readonly RenderBlock[],
	blockType: TType,
	targetId?: string,
): Extract<RenderBlock, { type: TType }> | undefined {
	if (targetId) {
		const matchingBlock = blocks.find(
			(block) => block.id === targetId && isBlockOfType(block, blockType),
		);

		return matchingBlock as Extract<RenderBlock, { type: TType }> | undefined;
	}

	for (let index = blocks.length - 1; index >= 0; index -= 1) {
		const block = blocks[index];

		if (block && isBlockOfType(block, blockType)) {
			return block as Extract<RenderBlock, { type: TType }>;
		}
	}

	return undefined;
}

function findTargetBlock(input: MapInspectionDetailInput): TargetBlock | undefined {
	switch (input.target_kind) {
		case 'workspace':
			return findLatestBlockByType(input.blocks, 'workspace_inspection_block', input.target_id);
		case 'timeline':
			return findLatestBlockByType(input.blocks, 'run_timeline_block', input.target_id);
		case 'trace_debug':
			return findLatestBlockByType(input.blocks, 'trace_debug_block', input.target_id);
		case 'search_result':
			return findLatestBlockByType(input.blocks, 'search_result_block', input.target_id);
		case 'diff':
			return findLatestBlockByType(input.blocks, 'diff_block', input.target_id);
		default: {
			const exhaustiveTargetKind: never = input.target_kind;
			return exhaustiveTargetKind;
		}
	}
}

function buildWorkspaceItems(
	input: MapInspectionDetailInput,
	block: WorkspaceInspectionBlock | undefined,
	detailLevel: InspectionDetailLevel,
): readonly InspectionDetailItem[] {
	const items: InspectionDetailItem[] = [];
	const workspaceLayer = input.workspace_layer;
	const maxVisibleValues =
		detailLevel === 'expanded' ? MAX_PATH_ITEMS_EXPANDED : MAX_PATH_ITEMS_STANDARD;

	pushDetailItem(
		items,
		createDetailItem(
			'Project name',
			block?.payload.project_name ?? workspaceLayer?.content.project_name,
		),
	);
	pushDetailItem(
		items,
		createJoinedDetailItem(
			'Project type',
			block?.payload.project_type_hints ?? workspaceLayer?.content.project_type_hints,
			maxVisibleValues,
		),
	);
	pushDetailItem(
		items,
		createJoinedDetailItem(
			'Top-level signals',
			block?.payload.top_level_signals ?? workspaceLayer?.content.top_level_signals,
			maxVisibleValues,
		),
	);
	pushDetailItem(
		items,
		createJoinedDetailItem(
			'Key scripts',
			workspaceLayer?.content.scripts,
			detailLevel === 'expanded' ? MAX_PATH_ITEMS_EXPANDED : MAX_SCRIPT_ITEMS_STANDARD,
		),
	);
	pushDetailItem(items, createDetailItem('Latest search', block?.payload.last_search_summary));

	if (detailLevel === 'expanded') {
		pushDetailItem(
			items,
			createJoinedDetailItem(
				'Dependency hints',
				workspaceLayer?.content.dependency_hints,
				MAX_PATH_ITEMS_EXPANDED,
			),
		);
		pushDetailItem(
			items,
			createJoinedDetailItem(
				'Workspace notes',
				block?.payload.inspection_notes,
				MAX_NOTE_ITEMS_EXPANDED,
			),
		);
	}

	return items;
}

function shouldShowTimelineState(state: string | undefined): boolean {
	return (
		state === 'approved' ||
		state === 'error' ||
		state === 'failed' ||
		state === 'pending' ||
		state === 'rejected'
	);
}

function isSignificantTimelineItem(item: TimelinePayloadItem): boolean {
	return item.kind !== 'model_thinking';
}

function isTimelineToolItem(item: TimelinePayloadItem): boolean {
	return (
		item.kind === 'tool_completed' || item.kind === 'tool_failed' || item.kind === 'tool_requested'
	);
}

function isTimelineApprovalItem(item: TimelinePayloadItem): boolean {
	return item.kind === 'approval_requested' || item.kind === 'approval_resolved';
}

function createTimelineItemReference(item: TimelinePayloadItem): string {
	return [item.kind, item.call_id ?? '', item.label, item.state ?? '', item.tool_name ?? ''].join(
		':',
	);
}

function collapseValues(values: readonly string[]): readonly string[] {
	const collapsedValues: string[] = [];

	for (const value of values) {
		const normalizedValue = normalizeText(value);

		if (normalizedValue.length === 0) {
			continue;
		}

		if (collapsedValues[collapsedValues.length - 1] === normalizedValue) {
			continue;
		}

		collapsedValues.push(normalizedValue);
	}

	return collapsedValues;
}

function formatTimelineItemValue(item: TimelinePayloadItem): string {
	const values: string[] = [normalizeText(item.label)];
	const normalizedDetail = normalizeOptionalText(item.detail);

	appendUniqueValue(values, normalizedDetail);

	if (shouldShowTimelineState(item.state)) {
		appendUniqueValue(values, `state: ${item.state}`);
	}

	return values.join(' - ');
}

function buildTimelineToolActivityValue(
	items: readonly TimelinePayloadItem[],
	detailLevel: InspectionDetailLevel,
): string | undefined {
	const maxVisibleItems =
		detailLevel === 'expanded'
			? MAX_TIMELINE_TOOL_ITEMS_EXPANDED
			: MAX_TIMELINE_TOOL_ITEMS_STANDARD;
	const collapsedLabels = collapseValues(
		items.filter((item) => isTimelineToolItem(item)).map((item) => item.label),
	);

	if (collapsedLabels.length === 0) {
		return undefined;
	}

	const visibleLabels = collapsedLabels.slice(0, maxVisibleItems);
	const hiddenCount = collapsedLabels.length - visibleLabels.length;
	const suffix = hiddenCount > 0 ? ` +${hiddenCount} more` : '';

	return `${visibleLabels.join(' -> ')}${suffix}`;
}

function findLatestTimelineItem(
	items: readonly TimelinePayloadItem[],
	predicate: (item: TimelinePayloadItem) => boolean,
): TimelinePayloadItem | undefined {
	for (let index = items.length - 1; index >= 0; index -= 1) {
		const item = items[index];

		if (item && predicate(item)) {
			return item;
		}
	}

	return undefined;
}

function buildTimelineItems(
	block: RunTimelineBlock,
	detailLevel: InspectionDetailLevel,
): readonly InspectionDetailItem[] {
	const items: InspectionDetailItem[] = [];
	const significantItems = block.payload.items.filter((item) => isSignificantTimelineItem(item));
	const consumedReferences = new Set<string>();
	const outcomeItem = significantItems[significantItems.length - 1];
	const latestStepItem =
		significantItems.length > 1 ? significantItems[significantItems.length - 2] : undefined;
	const approvalItem = findLatestTimelineItem(significantItems, (item) =>
		isTimelineApprovalItem(item),
	);
	const modelHandoffItem = findLatestTimelineItem(
		significantItems,
		(item) => item.kind === 'model_completed',
	);
	const runOpeningItem = significantItems[0];

	if (outcomeItem) {
		consumedReferences.add(createTimelineItemReference(outcomeItem));
		pushDetailItem(items, createDetailItem('Outcome', formatTimelineItemValue(outcomeItem)));
	}

	if (latestStepItem) {
		const latestStepReference = createTimelineItemReference(latestStepItem);

		if (!consumedReferences.has(latestStepReference)) {
			consumedReferences.add(latestStepReference);
			pushDetailItem(
				items,
				createDetailItem('Latest step', formatTimelineItemValue(latestStepItem)),
			);
		}
	}

	pushDetailItem(
		items,
		createDetailItem(
			'Tool activity',
			buildTimelineToolActivityValue(significantItems, detailLevel),
		),
	);

	if (approvalItem) {
		const approvalReference = createTimelineItemReference(approvalItem);

		if (!consumedReferences.has(approvalReference)) {
			consumedReferences.add(approvalReference);
			pushDetailItem(
				items,
				createDetailItem('Approval gate', formatTimelineItemValue(approvalItem)),
			);
		}
	}

	if (detailLevel === 'expanded') {
		if (modelHandoffItem) {
			const modelHandoffReference = createTimelineItemReference(modelHandoffItem);

			if (!consumedReferences.has(modelHandoffReference)) {
				consumedReferences.add(modelHandoffReference);
				pushDetailItem(
					items,
					createDetailItem('Model handoff', formatTimelineItemValue(modelHandoffItem)),
				);
			}
		}

		if (runOpeningItem) {
			const runOpeningReference = createTimelineItemReference(runOpeningItem);

			if (!consumedReferences.has(runOpeningReference)) {
				consumedReferences.add(runOpeningReference);
				pushDetailItem(
					items,
					createDetailItem('Run opening', formatTimelineItemValue(runOpeningItem)),
				);
			}
		}
	}

	const fallbackItems = [...significantItems]
		.reverse()
		.filter((item) => !consumedReferences.has(createTimelineItemReference(item)));
	const fallbackLimit =
		detailLevel === 'expanded' ? MAX_TIMELINE_EXTRA_ITEMS_EXPANDED : Math.max(0, 3 - items.length);

	for (const [index, item] of fallbackItems.slice(0, fallbackLimit).entries()) {
		pushDetailItem(
			items,
			createDetailItem(`Recent step ${index + 1}`, formatTimelineItemValue(item)),
		);
	}

	return items;
}

function buildTraceDebugItems(
	block: TraceDebugBlock,
	detailLevel: InspectionDetailLevel,
	events: readonly AnyRuntimeEvent[] | undefined,
): readonly InspectionDetailItem[] {
	const items: InspectionDetailItem[] = [];
	const noteLimit = detailLevel === 'expanded' ? MAX_NOTE_ITEMS_EXPANDED : MAX_NOTE_ITEMS_STANDARD;
	const toolPathValue = normalizeOptionalText(block.payload.tool_chain_summary)
		?.replace(/^Tool chain:\s*/u, '')
		.trim();
	const latestModelCompletedEvent = [...(events ?? [])]
		.reverse()
		.find((event) => event.event_type === 'model.completed');
	const parsedModelUsage = readModelUsageEventMetadata(latestModelCompletedEvent?.metadata);

	pushDetailItem(items, createDetailItem('Execution state', block.payload.run_state));
	pushDetailItem(
		items,
		createDetailItem('Tool path', toolPathValue ? trimTrailingPeriod(toolPathValue) : undefined),
	);
	pushDetailItem(items, createDetailItem('Approval signal', block.payload.approval_summary));
	pushDetailItem(
		items,
		createJoinedDetailItem('Warning signals', block.payload.warning_notes, noteLimit),
	);
	pushDetailItem(
		items,
		createJoinedDetailItem('Debug signals', block.payload.debug_notes, noteLimit),
	);
	pushDetailItem(
		items,
		createDetailItem(
			'Context accounting',
			parsedModelUsage?.request.compiled_context
				? `${parsedModelUsage.request.compiled_context.total.char_count} chars / ~${parsedModelUsage.request.compiled_context.total.token_count} tok across ${parsedModelUsage.request.compiled_context.layer_count} layers`
				: undefined,
		),
	);
	pushDetailItem(
		items,
		createDetailItem(
			'Request usage',
			parsedModelUsage
				? [
						`${parsedModelUsage.request.total.char_count} chars / ~${parsedModelUsage.request.total.token_count} tok total`,
						`messages ~${parsedModelUsage.request.messages.token_count} tok`,
						parsedModelUsage.request.compiled_context
							? `context ~${parsedModelUsage.request.compiled_context.total.token_count} tok`
							: undefined,
						parsedModelUsage.request.available_tools
							? `tools ~${parsedModelUsage.request.available_tools.token_count} tok`
							: undefined,
					]
						.filter((part): part is string => part !== undefined)
						.join('; ')
				: undefined,
		),
	);
	pushDetailItem(
		items,
		createDetailItem(
			'Response usage',
			parsedModelUsage
				? parsedModelUsage.response.measurement === 'provider'
					? [
							`${parsedModelUsage.response.char_count} chars / provider ${parsedModelUsage.response.token_count} tok`,
							parsedModelUsage.response.input_tokens !== undefined
								? `in ${parsedModelUsage.response.input_tokens}`
								: undefined,
							parsedModelUsage.response.output_tokens !== undefined
								? `out ${parsedModelUsage.response.output_tokens}`
								: undefined,
						]
							.filter((part): part is string => part !== undefined)
							.join('; ')
					: `${parsedModelUsage.response.char_count} chars / ~${parsedModelUsage.response.token_count} tok`
				: undefined,
		),
	);

	if (detailLevel === 'expanded') {
		pushDetailItem(items, createDetailItem('Trace label', block.payload.trace_label));
		pushDetailItem(
			items,
			createDetailItem(
				'Context layers',
				parsedModelUsage?.request.compiled_context?.layers
					.map((layer) => `${layer.name}: ${layer.char_count} chars / ~${layer.token_count} tok`)
					.join(', '),
			),
		);
	}

	return items;
}

function buildSearchResultWindowValue(block: SearchResultBlock): string {
	const visibleMatchCount = block.payload.matches.length;
	const totalMatches = block.payload.total_matches;

	if (totalMatches !== undefined) {
		if (block.payload.is_truncated && totalMatches > visibleMatchCount) {
			return `showing ${visibleMatchCount} of ${totalMatches} matches; truncated`;
		}

		return `${totalMatches} matches visible`;
	}

	return block.payload.is_truncated
		? `${visibleMatchCount} visible matches; truncated`
		: `${visibleMatchCount} visible matches`;
}

function buildSearchResultItems(
	block: SearchResultBlock,
	detailLevel: InspectionDetailLevel,
): readonly InspectionDetailItem[] {
	const items: InspectionDetailItem[] = [];
	const matchLimit =
		detailLevel === 'expanded' ? MAX_MATCH_ITEMS_EXPANDED : MAX_MATCH_ITEMS_STANDARD;

	pushDetailItem(items, createDetailItem('Query', block.payload.query));
	pushDetailItem(items, createDetailItem('Search root', block.payload.searched_root));
	pushDetailItem(items, createDetailItem('Result window', buildSearchResultWindowValue(block)));

	for (const [index, match] of block.payload.matches.slice(0, matchLimit).entries()) {
		pushDetailItem(
			items,
			createDetailItem(
				`Sample ${index + 1}`,
				`${match.path}:${match.line_number} - ${match.line_text}`,
			),
		);
	}

	return items;
}

function collectDiffPreviewStats(diffText: string): DiffPreviewStats {
	let additionCount = 0;
	let deletionCount = 0;
	let previewLineCount = 0;

	for (const line of diffText.split(/\r?\n/gu)) {
		if (line.trim().length === 0) {
			continue;
		}

		previewLineCount += 1;

		if (
			line.startsWith('+++') ||
			line.startsWith('---') ||
			line.startsWith('@@') ||
			line.startsWith('diff ') ||
			line.startsWith('index ')
		) {
			continue;
		}

		if (line.startsWith('+')) {
			additionCount += 1;
			continue;
		}

		if (line.startsWith('-')) {
			deletionCount += 1;
		}
	}

	return {
		addition_count: additionCount,
		deletion_count: deletionCount,
		preview_line_count: previewLineCount,
	};
}

function buildDiffFootprintValue(stats: DiffPreviewStats): string {
	if (stats.addition_count === 0 && stats.deletion_count === 0) {
		return `${stats.preview_line_count} preview lines with no visible line changes`;
	}

	if (stats.addition_count > 0 && stats.deletion_count > 0) {
		return `${stats.addition_count} additions and ${stats.deletion_count} deletions in ${stats.preview_line_count} preview lines`;
	}

	if (stats.addition_count > 0) {
		return `${stats.addition_count} additions in ${stats.preview_line_count} preview lines`;
	}

	return `${stats.deletion_count} deletions in ${stats.preview_line_count} preview lines`;
}

function buildDiffPreviewStatusValue(
	stats: DiffPreviewStats,
	isTruncated: boolean | undefined,
): string {
	return isTruncated
		? `truncated after ${stats.preview_line_count} preview lines`
		: `${stats.preview_line_count} preview lines shown`;
}

function buildDiffItems(
	block: DiffBlock,
	detailLevel: InspectionDetailLevel,
): readonly InspectionDetailItem[] {
	const items: InspectionDetailItem[] = [];
	const changedPaths = block.payload.changed_paths ?? [];
	const previewStats = collectDiffPreviewStats(block.payload.diff_text);
	const normalizedPath = normalizeOptionalText(block.payload.path);
	const hasFocusPath = normalizedPath !== undefined;

	pushDetailItem(items, createDetailItem('Focus path', normalizedPath));

	if (detailLevel === 'expanded') {
		pushDetailItem(items, createDetailItem('Changed path count', String(changedPaths.length)));
	}

	pushDetailItem(
		items,
		createJoinedDetailItem(
			'Changed paths',
			hasFocusPath
				? changedPaths.filter((path) => normalizeText(path) !== normalizedPath)
				: changedPaths,
			detailLevel === 'expanded' ? MAX_PATH_ITEMS_EXPANDED : MAX_PATH_ITEMS_STANDARD,
		),
	);
	pushDetailItem(items, createDetailItem('Diff footprint', buildDiffFootprintValue(previewStats)));
	pushDetailItem(
		items,
		createDetailItem(
			'Preview status',
			buildDiffPreviewStatusValue(previewStats, block.payload.is_truncated),
		),
	);

	return items;
}

function buildTargetItems(
	input: MapInspectionDetailInput,
	targetBlock: TargetBlock | undefined,
): readonly InspectionDetailItem[] {
	const detailLevel = getRequestedDetailLevel(input.detail_level);
	const items: InspectionDetailItem[] = [];

	if (input.target_kind !== 'workspace') {
		pushDetailItem(items, createDetailItem('Run context', buildRunContextValue(input)));
	}

	switch (input.target_kind) {
		case 'workspace':
			return buildWorkspaceItems(
				input,
				targetBlock?.type === 'workspace_inspection_block' ? targetBlock : undefined,
				detailLevel,
			);
		case 'timeline':
			return targetBlock?.type === 'run_timeline_block'
				? [...items, ...buildTimelineItems(targetBlock, detailLevel)]
				: items;
		case 'trace_debug':
			return targetBlock?.type === 'trace_debug_block'
				? [...items, ...buildTraceDebugItems(targetBlock, detailLevel, input.events)]
				: items;
		case 'search_result':
			return targetBlock?.type === 'search_result_block'
				? [...items, ...buildSearchResultItems(targetBlock, detailLevel)]
				: items;
		case 'diff':
			return targetBlock?.type === 'diff_block'
				? [...items, ...buildDiffItems(targetBlock, detailLevel)]
				: items;
		default: {
			const exhaustiveTargetKind: never = input.target_kind;
			return exhaustiveTargetKind;
		}
	}
}

function buildBlockTitle(
	input: MapInspectionDetailInput,
	targetBlock: TargetBlock | undefined,
): string {
	if (targetBlock?.type === 'workspace_inspection_block') {
		return `${targetBlock.payload.title} ${INSPECTION_DETAIL_TITLE_SUFFIX}`;
	}

	if (targetBlock?.type === 'run_timeline_block') {
		return `${targetBlock.payload.title} ${INSPECTION_DETAIL_TITLE_SUFFIX}`;
	}

	if (targetBlock?.type === 'trace_debug_block') {
		return `${targetBlock.payload.title} ${INSPECTION_DETAIL_TITLE_SUFFIX}`;
	}

	if (targetBlock?.type === 'search_result_block') {
		return `${targetBlock.payload.title} ${INSPECTION_DETAIL_TITLE_SUFFIX}`;
	}

	if (targetBlock?.type === 'diff_block') {
		return `${targetBlock.payload.title ?? 'Diff'} ${INSPECTION_DETAIL_TITLE_SUFFIX}`;
	}

	if (input.target_kind === 'workspace' && input.workspace_layer) {
		return `${input.workspace_layer.content.title} ${INSPECTION_DETAIL_TITLE_SUFFIX}`;
	}

	return `${input.target_kind.replace(/_/gu, ' ')} ${INSPECTION_DETAIL_TITLE_SUFFIX}`;
}

function buildBlockSummary(input: MapInspectionDetailInput): string {
	const detailLevel = getRequestedDetailLevel(input.detail_level);

	switch (input.target_kind) {
		case 'workspace':
			return detailLevel === 'expanded'
				? 'Expanded workspace detail with project signals, scripts, and dependency hints.'
				: 'Focused workspace detail with project signals, scripts, and latest search context.';
		case 'timeline':
			return detailLevel === 'expanded'
				? 'Expanded timeline detail with outcome, tool activity, approval, and lifecycle cues.'
				: 'Focused timeline detail with outcome, latest step, and tool activity.';
		case 'trace_debug':
			return detailLevel === 'expanded'
				? 'Expanded trace / debug detail with execution state, approval, trace label, and signal notes.'
				: 'Focused trace / debug detail with execution state, tool path, and operational signals.';
		case 'search_result':
			return detailLevel === 'expanded'
				? 'Expanded search detail with result window and up to four sample matches.'
				: 'Focused search detail with result window and key sample matches.';
		case 'diff':
			return detailLevel === 'expanded'
				? 'Expanded diff detail with path scope, preview footprint, and truncation status.'
				: 'Focused diff detail with changed paths and preview footprint.';
		default: {
			const exhaustiveTargetKind: never = input.target_kind;
			return exhaustiveTargetKind;
		}
	}
}

export function mapInspectionDetailToBlock(
	input: MapInspectionDetailInput,
): InspectionDetailBlock | undefined {
	const targetBlock = findTargetBlock(input);

	if (input.target_kind === 'workspace' && input.target_id && !targetBlock) {
		return undefined;
	}

	if (input.target_kind !== 'workspace' && !targetBlock) {
		return undefined;
	}

	const detailItems = buildTargetItems(input, targetBlock);

	if (detailItems.length === 0) {
		return undefined;
	}

	const targetId = input.target_id ?? targetBlock?.id ?? 'latest';

	return {
		created_at: input.created_at,
		id: `inspection_detail_block:${input.run_id}:${input.target_kind}:${targetId}`,
		payload: {
			detail_items: detailItems,
			summary: buildBlockSummary(input),
			target_kind: input.target_kind,
			title: buildBlockTitle(input, targetBlock),
		},
		schema_version: 1,
		type: 'inspection_detail_block',
	};
}
