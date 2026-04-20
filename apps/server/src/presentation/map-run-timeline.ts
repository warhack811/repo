import type {
	AnyRuntimeEvent,
	ApprovalBlock,
	RenderBlock,
	RunTimelineBlock,
	RunTimelineBlockItem,
	ToolName,
	ToolResultBlock,
} from '@runa/types';

const MAX_TIMELINE_DETAIL_LENGTH = 160;
const MAX_TIMELINE_ITEMS = 10;
const RUN_TIMELINE_BLOCK_TITLE = 'Run Timeline';

interface MapRunTimelineInput {
	readonly blocks?: readonly RenderBlock[];
	readonly created_at: string;
	readonly events: readonly AnyRuntimeEvent[];
	readonly run_id?: string;
}

interface TimelineBlockCorrelations {
	readonly diff_summary?: string;
	readonly search_summary?: string;
}

interface TimelineItemCandidate {
	readonly item: RunTimelineBlockItem;
	readonly key: string;
}

type TimelineToolItem = RunTimelineBlockItem & {
	readonly kind: 'tool_completed' | 'tool_failed' | 'tool_requested';
};

type FailedTimelineToolItem = RunTimelineBlockItem & {
	readonly kind: 'tool_failed';
};

function getCandidateQuality(candidate: TimelineItemCandidate): number {
	return (
		(candidate.item.tool_name ? 4 : 0) +
		(candidate.item.call_id ? 2 : 0) +
		(candidate.item.detail ? Math.min(candidate.item.detail.length, 120) : 0)
	);
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

	return normalizedValue.length > MAX_TIMELINE_DETAIL_LENGTH
		? `${normalizedValue.slice(0, MAX_TIMELINE_DETAIL_LENGTH - 3)}...`
		: normalizedValue;
}

function createCandidate(
	key: string,
	item: RunTimelineBlockItem,
): TimelineItemCandidate | undefined {
	return item.label.length > 0 ? { item, key } : undefined;
}

function isTimelineToolItem(item: RunTimelineBlockItem | undefined): item is TimelineToolItem {
	return (
		item?.kind === 'tool_completed' ||
		item?.kind === 'tool_failed' ||
		item?.kind === 'tool_requested'
	);
}

function isFailedTimelineToolItem(item: RunTimelineBlockItem): item is FailedTimelineToolItem {
	return item.kind === 'tool_failed';
}

function buildTimelineBlockCorrelations(
	blocks: readonly RenderBlock[] | undefined,
): TimelineBlockCorrelations {
	let diffSummary: string | undefined;
	let searchSummary: string | undefined;

	for (const block of blocks ?? []) {
		if (block.type === 'diff_block') {
			diffSummary = normalizeOptionalText(block.payload.summary);
			continue;
		}

		if (block.type === 'search_result_block' || block.type === 'web_search_result_block') {
			searchSummary = normalizeOptionalText(block.payload.summary);
		}
	}

	return {
		diff_summary: diffSummary,
		search_summary: searchSummary,
	};
}

function getToolTimelineCopy(toolName: ToolName): Readonly<{
	readonly completed_label: string;
	readonly failed_label: string;
	readonly requested_label: string;
}> {
	switch (toolName) {
		case 'edit.patch':
			return {
				completed_label: 'Prepared patch changes',
				failed_label: 'Patch update failed',
				requested_label: 'Requested patch update',
			};
		case 'file.list':
			return {
				completed_label: 'Listed workspace files',
				failed_label: 'File listing failed',
				requested_label: 'Requested file listing',
			};
		case 'file.read':
			return {
				completed_label: 'Read file contents',
				failed_label: 'File read failed',
				requested_label: 'Requested file read',
			};
		case 'file.write':
			return {
				completed_label: 'Wrote file changes',
				failed_label: 'File write failed',
				requested_label: 'Requested file write',
			};
		case 'git.diff':
			return {
				completed_label: 'Inspected the git diff',
				failed_label: 'Git diff inspection failed',
				requested_label: 'Requested git diff',
			};
		case 'git.status':
			return {
				completed_label: 'Checked git status',
				failed_label: 'Git status check failed',
				requested_label: 'Requested git status',
			};
		case 'search.codebase':
			return {
				completed_label: 'Searched the codebase',
				failed_label: 'Codebase search failed',
				requested_label: 'Requested codebase search',
			};
		case 'search.grep':
			return {
				completed_label: 'Searched files with grep',
				failed_label: 'Grep search failed',
				requested_label: 'Requested grep search',
			};
		case 'web.search':
			return {
				completed_label: 'Searched the public web',
				failed_label: 'Public web search failed',
				requested_label: 'Requested public web search',
			};
		case 'shell.exec':
			return {
				completed_label: 'Ran shell command',
				failed_label: 'Shell command failed',
				requested_label: 'Requested shell command',
			};
		default:
			return {
				completed_label: `Completed tool ${toolName}`,
				failed_label: `Tool failed: ${toolName}`,
				requested_label: `Requested tool ${toolName}`,
			};
	}
}

function getCorrelatedToolDetail(
	toolName: ToolName,
	correlations: TimelineBlockCorrelations,
	fallbackDetail?: string,
): string | undefined {
	if (
		(toolName === 'search.codebase' || toolName === 'web.search') &&
		correlations.search_summary
	) {
		return correlations.search_summary;
	}

	if (toolName === 'git.diff' && correlations.diff_summary) {
		return correlations.diff_summary;
	}

	return normalizeOptionalText(fallbackDetail);
}

function createToolTimelineCandidate(
	input: Readonly<{
		call_id: string;
		correlations: TimelineBlockCorrelations;
		detail?: string;
		kind: 'tool_completed' | 'tool_failed' | 'tool_requested';
		state: string;
		tool_name: ToolName;
	}>,
): TimelineItemCandidate | undefined {
	const timelineCopy = getToolTimelineCopy(input.tool_name);
	const label =
		input.kind === 'tool_requested'
			? timelineCopy.requested_label
			: input.kind === 'tool_completed'
				? timelineCopy.completed_label
				: timelineCopy.failed_label;

	return createCandidate(`${input.kind}:${input.call_id}`, {
		call_id: input.call_id,
		detail: getCorrelatedToolDetail(input.tool_name, input.correlations, input.detail),
		kind: input.kind,
		label,
		state: input.state,
		tool_name: input.tool_name,
	});
}

function buildApprovalLabel(status: string, toolName?: ToolName): string {
	if (!toolName) {
		return status === 'pending' ? 'Approval requested' : `Approval ${status}`;
	}

	return status === 'pending'
		? `Approval requested for ${toolName}`
		: `Approval ${status} for ${toolName}`;
}

function getToolSummaryPhrase(toolName: ToolName): string {
	switch (toolName) {
		case 'edit.patch':
			return 'patch update';
		case 'file.list':
			return 'file listing';
		case 'file.read':
			return 'file read';
		case 'file.write':
			return 'file write';
		case 'git.diff':
			return 'git diff inspection';
		case 'git.status':
			return 'git status check';
		case 'search.codebase':
			return 'codebase search';
		case 'search.grep':
			return 'grep search';
		case 'web.search':
			return 'public web search';
		case 'shell.exec':
			return 'shell command';
		default:
			return toolName.replace(/\./gu, ' ');
	}
}

function getToolFailureSummaryPhrase(toolName: ToolName): string {
	switch (toolName) {
		case 'git.diff':
			return 'git diff';
		default:
			return getToolSummaryPhrase(toolName);
	}
}

function getSearchInspectionPhrase(
	items: readonly RunTimelineBlockItem[],
	blocks?: readonly RenderBlock[],
): string {
	const hasCodebaseSearch =
		items.some((item) => item.kind === 'tool_completed' && item.tool_name === 'search.codebase') ||
		(blocks ?? []).some((block) => block.type === 'search_result_block');
	const hasWebSearch =
		items.some((item) => item.kind === 'tool_completed' && item.tool_name === 'web.search') ||
		(blocks ?? []).some((block) => block.type === 'web_search_result_block');

	if (hasCodebaseSearch && hasWebSearch) {
		return 'codebase search and public web search';
	}

	if (hasWebSearch) {
		return 'public web search';
	}

	return 'codebase search';
}

function getApprovalSummaryPhrase(
	status: 'approved' | 'pending' | 'rejected',
	toolName?: ToolName,
): string {
	const actionPhrase = toolName ? getToolSummaryPhrase(toolName) : 'approval';

	switch (status) {
		case 'pending':
			return toolName ? `approval wait for ${actionPhrase}` : 'approval wait';
		case 'approved':
			return toolName ? `approval resolution for ${actionPhrase}` : 'approval resolution';
		case 'rejected':
			return toolName ? `approval rejection for ${actionPhrase}` : 'approval rejection';
	}
}

function getLatestToolItem(items: readonly RunTimelineBlockItem[]): TimelineToolItem | undefined {
	for (let index = items.length - 1; index >= 0; index -= 1) {
		const item = items[index];

		if (isTimelineToolItem(item)) {
			return item;
		}
	}

	return undefined;
}

function getApprovalToolName(
	items: readonly RunTimelineBlockItem[],
	status: 'approved' | 'pending' | 'rejected',
): ToolName | undefined {
	for (let index = items.length - 1; index >= 0; index -= 1) {
		const item = items[index];

		if (
			item?.kind === 'approval_requested' &&
			status === 'pending' &&
			typeof item.tool_name === 'string'
		) {
			return item.tool_name;
		}

		if (
			item?.kind === 'approval_resolved' &&
			item.state === status &&
			typeof item.tool_name === 'string'
		) {
			return item.tool_name;
		}
	}

	return undefined;
}

function mapRuntimeEventToTimelineCandidate(
	event: AnyRuntimeEvent,
	correlations: TimelineBlockCorrelations,
): TimelineItemCandidate | undefined {
	switch (event.event_type) {
		case 'run.started':
			return createCandidate('run_started', {
				kind: 'run_started',
				label: 'Run started',
			});
		case 'state.entered':
			return event.payload.state === 'MODEL_THINKING'
				? createCandidate('model_thinking', {
						kind: 'model_thinking',
						label: 'Model is thinking',
						state: 'active',
					})
				: undefined;
		case 'model.completed':
			return createCandidate('model_completed', {
				detail: normalizeOptionalText(`${event.payload.provider} / ${event.payload.model}`),
				kind: 'model_completed',
				label: 'Model planned the next step',
				state: 'completed',
			});
		case 'tool.call.started':
			return createToolTimelineCandidate({
				call_id: event.payload.call_id,
				correlations,
				kind: 'tool_requested',
				state: 'requested',
				tool_name: event.payload.tool_name,
			});
		case 'tool.call.completed':
			return createToolTimelineCandidate({
				call_id: event.payload.call_id,
				correlations,
				kind: event.payload.result_status === 'success' ? 'tool_completed' : 'tool_failed',
				state: event.payload.result_status,
				tool_name: event.payload.tool_name,
			});
		case 'tool.call.failed':
			return createToolTimelineCandidate({
				call_id: event.payload.call_id,
				correlations,
				detail: event.payload.error_message,
				kind: 'tool_failed',
				state: 'error',
				tool_name: event.payload.tool_name,
			});
		case 'approval.requested':
			return createCandidate(`approval_requested:${event.payload.approval_id}`, {
				call_id: event.payload.call_id,
				detail: normalizeOptionalText(event.payload.summary),
				kind: 'approval_requested',
				label: buildApprovalLabel('pending', event.payload.tool_name),
				state: 'pending',
				tool_name: event.payload.tool_name,
			});
		case 'approval.resolved':
			return createCandidate(`approval_resolved:${event.payload.approval_id}`, {
				detail: normalizeOptionalText(event.payload.note),
				kind: 'approval_resolved',
				label: buildApprovalLabel(event.payload.decision),
				state: event.payload.decision,
			});
		case 'run.completed':
			return createCandidate('assistant_completed', {
				kind: 'assistant_completed',
				label: 'Assistant finished the turn',
				state: 'completed',
			});
		case 'run.failed':
			return createCandidate('run_failed', {
				detail: normalizeOptionalText(event.payload.error_message),
				kind: 'run_failed',
				label: 'Run failed',
				state: 'failed',
			});
		default:
			return undefined;
	}
}

function mapToolResultBlockToTimelineCandidate(
	block: ToolResultBlock,
	correlations: TimelineBlockCorrelations,
): TimelineItemCandidate | undefined {
	return createToolTimelineCandidate({
		call_id: block.payload.call_id,
		correlations,
		detail: block.payload.summary,
		kind: block.payload.status === 'success' ? 'tool_completed' : 'tool_failed',
		state: block.payload.status,
		tool_name: block.payload.tool_name,
	});
}

function mapApprovalBlockToTimelineCandidate(
	block: ApprovalBlock,
): TimelineItemCandidate | undefined {
	if (block.payload.status === 'pending') {
		return createCandidate(`approval_requested:${block.payload.approval_id}`, {
			call_id: block.payload.call_id,
			detail: normalizeOptionalText(block.payload.summary),
			kind: 'approval_requested',
			label: buildApprovalLabel('pending', block.payload.tool_name),
			state: 'pending',
			tool_name: block.payload.tool_name,
		});
	}

	return createCandidate(`approval_resolved:${block.payload.approval_id}`, {
		call_id: block.payload.call_id,
		detail: normalizeOptionalText(block.payload.note ?? block.payload.summary),
		kind: 'approval_resolved',
		label: buildApprovalLabel(block.payload.status, block.payload.tool_name),
		state: block.payload.status,
		tool_name: block.payload.tool_name,
	});
}

function collectTimelineCandidates(input: MapRunTimelineInput): readonly TimelineItemCandidate[] {
	const correlations = buildTimelineBlockCorrelations(input.blocks);
	const candidates: TimelineItemCandidate[] = [];
	const candidateIndexesByKey = new Map<string, number>();

	function upsertCandidate(candidate: TimelineItemCandidate | undefined): void {
		if (!candidate) {
			return;
		}

		const existingIndex = candidateIndexesByKey.get(candidate.key);

		if (existingIndex === undefined) {
			candidateIndexesByKey.set(candidate.key, candidates.length);
			candidates.push(candidate);
			return;
		}

		const existingCandidate = candidates[existingIndex];

		if (!existingCandidate) {
			candidateIndexesByKey.set(candidate.key, candidates.length);
			candidates.push(candidate);
			return;
		}

		if (getCandidateQuality(candidate) > getCandidateQuality(existingCandidate)) {
			candidates[existingIndex] = candidate;
		}
	}

	for (const event of input.events) {
		upsertCandidate(mapRuntimeEventToTimelineCandidate(event, correlations));
	}

	for (const block of input.blocks ?? []) {
		let candidate: TimelineItemCandidate | undefined;

		if (block.type === 'tool_result') {
			candidate = mapToolResultBlockToTimelineCandidate(block, correlations);
		} else if (block.type === 'approval_block') {
			candidate = mapApprovalBlockToTimelineCandidate(block);
		}

		upsertCandidate(candidate);
	}

	return candidates;
}

function dropRedundantToolRequestedCandidates(
	candidates: readonly TimelineItemCandidate[],
): readonly TimelineItemCandidate[] {
	const terminalToolCallIds = new Set(
		candidates
			.filter(
				(candidate) =>
					(candidate.item.kind === 'tool_completed' || candidate.item.kind === 'tool_failed') &&
					typeof candidate.item.call_id === 'string',
			)
			.map((candidate) => candidate.item.call_id as string),
	);

	return candidates.filter(
		(candidate) =>
			!(
				candidate.item.kind === 'tool_requested' &&
				candidate.item.call_id &&
				terminalToolCallIds.has(candidate.item.call_id)
			),
	);
}

function dropRedundantModelCompletedCandidates(
	candidates: readonly TimelineItemCandidate[],
): readonly TimelineItemCandidate[] {
	return candidates.filter((candidate, index, allCandidates) => {
		if (candidate.item.kind !== 'model_completed') {
			return true;
		}

		for (let nextIndex = index + 1; nextIndex < allCandidates.length; nextIndex += 1) {
			const nextCandidate = allCandidates[nextIndex];

			if (!nextCandidate || nextCandidate.item.kind === 'model_thinking') {
				continue;
			}

			return nextCandidate.item.kind !== 'assistant_completed';
		}

		return true;
	});
}

function dropLowSignalThinkingCandidates(
	candidates: readonly TimelineItemCandidate[],
): readonly TimelineItemCandidate[] {
	const hasHigherSignalItems = candidates.some(
		(candidate) =>
			candidate.item.kind === 'approval_requested' ||
			candidate.item.kind === 'approval_resolved' ||
			candidate.item.kind === 'assistant_completed' ||
			candidate.item.kind === 'run_failed' ||
			candidate.item.kind === 'tool_completed' ||
			candidate.item.kind === 'tool_failed',
	);

	if (!hasHigherSignalItems || candidates.length <= 3) {
		return candidates;
	}

	return candidates.filter((candidate) => candidate.item.kind !== 'model_thinking');
}

function collapseTimelineCandidates(
	candidates: readonly TimelineItemCandidate[],
): readonly TimelineItemCandidate[] {
	return dropRedundantModelCompletedCandidates(
		dropLowSignalThinkingCandidates(dropRedundantToolRequestedCandidates(candidates)),
	);
}

function selectVisibleCandidates(
	candidates: readonly TimelineItemCandidate[],
): readonly TimelineItemCandidate[] {
	if (candidates.length <= MAX_TIMELINE_ITEMS) {
		return candidates;
	}

	if (candidates[0]?.item.kind === 'run_started') {
		return [candidates[0], ...candidates.slice(-(MAX_TIMELINE_ITEMS - 1))];
	}

	return candidates.slice(-MAX_TIMELINE_ITEMS);
}

function hasPendingApproval(candidates: readonly TimelineItemCandidate[]): boolean {
	const requestedApprovalIds = new Set<string>();
	const resolvedApprovalIds = new Set<string>();

	for (const candidate of candidates) {
		if (candidate.key.startsWith('approval_requested:')) {
			requestedApprovalIds.add(candidate.key.slice('approval_requested:'.length));
		} else if (candidate.key.startsWith('approval_resolved:')) {
			resolvedApprovalIds.add(candidate.key.slice('approval_resolved:'.length));
		}
	}

	return [...requestedApprovalIds].some((approvalId) => !resolvedApprovalIds.has(approvalId));
}

function buildTimelineSummary(
	input: Readonly<{
		blocks?: readonly RenderBlock[];
		candidates: readonly TimelineItemCandidate[];
		visible_item_count: number;
	}>,
): string {
	const items = input.candidates.map((candidate) => candidate.item);
	const hasAssistantCompleted = items.some((item) => item.kind === 'assistant_completed');
	const hasRunFailed = items.some((item) => item.kind === 'run_failed');
	const hasToolActivity = items.some(
		(item) =>
			item.kind === 'tool_completed' ||
			item.kind === 'tool_failed' ||
			item.kind === 'tool_requested',
	);
	const hasToolFailure = items.some((item) => item.kind === 'tool_failed');
	const hasApprovedApproval = items.some(
		(item) => item.kind === 'approval_resolved' && item.state === 'approved',
	);
	const hasRejectedApproval = items.some(
		(item) => item.kind === 'approval_resolved' && item.state === 'rejected',
	);
	const pendingApprovalToolName = getApprovalToolName(items, 'pending');
	const approvedApprovalToolName = getApprovalToolName(items, 'approved');
	const rejectedApprovalToolName = getApprovalToolName(items, 'rejected');
	const hasSearchInspection =
		(input.blocks ?? []).some(
			(block) => block.type === 'search_result_block' || block.type === 'web_search_result_block',
		) ||
		items.some(
			(item) =>
				item.kind === 'tool_completed' &&
				(item.tool_name === 'search.codebase' || item.tool_name === 'web.search'),
		);
	const hasDiffInspection =
		(input.blocks ?? []).some((block) => block.type === 'diff_block') ||
		items.some((item) => item.kind === 'tool_completed' && item.tool_name === 'git.diff');
	const latestToolItem = getLatestToolItem(items);
	const latestToolPhrase = latestToolItem?.tool_name
		? getToolSummaryPhrase(latestToolItem.tool_name)
		: undefined;
	const searchInspectionPhrase = getSearchInspectionPhrase(items, input.blocks);
	const latestFailedToolItem = items
		.slice()
		.reverse()
		.find((item): item is FailedTimelineToolItem => isFailedTimelineToolItem(item));
	const latestFailedToolPhrase = latestFailedToolItem?.tool_name
		? getToolFailureSummaryPhrase(latestFailedToolItem.tool_name)
		: undefined;
	const genericToolSummary =
		latestToolPhrase && items.filter((item) => item.kind.startsWith('tool_')).length > 1
			? 'tool activity'
			: latestToolPhrase;

	let summary: string;

	if (hasRunFailed) {
		summary = hasRejectedApproval
			? `Timeline shows ${getApprovalSummaryPhrase('rejected', rejectedApprovalToolName)} before run failure.`
			: latestFailedToolPhrase
				? `Timeline shows ${latestFailedToolPhrase} failure before run failure.`
				: hasToolFailure
					? 'Timeline shows tool failure before run failure.'
					: 'Timeline shows run failure.';
	} else if (hasAssistantCompleted) {
		summary =
			hasSearchInspection && hasDiffInspection
				? `Timeline shows ${searchInspectionPhrase}, git diff inspection, then assistant completion.`
				: hasApprovedApproval
					? hasToolActivity
						? latestToolPhrase
							? `Timeline shows ${getApprovalSummaryPhrase('approved', approvedApprovalToolName)}, then ${latestToolPhrase}, then assistant completion.`
							: 'Timeline shows approval and tool activity before assistant completion.'
						: `Timeline shows ${getApprovalSummaryPhrase('approved', approvedApprovalToolName)}, then assistant completion.`
					: hasSearchInspection
						? `Timeline shows ${searchInspectionPhrase} before assistant completion.`
						: hasDiffInspection
							? 'Timeline shows git diff inspection before assistant completion.'
							: genericToolSummary
								? `Timeline shows ${genericToolSummary} before assistant completion.`
								: 'Timeline shows a direct assistant completion.';
	} else if (hasPendingApproval(input.candidates)) {
		summary =
			hasSearchInspection && hasDiffInspection
				? `Timeline shows ${searchInspectionPhrase}, git diff inspection, then ${getApprovalSummaryPhrase('pending', pendingApprovalToolName)}.`
				: genericToolSummary
					? `Timeline shows ${genericToolSummary}, then ${getApprovalSummaryPhrase('pending', pendingApprovalToolName)}.`
					: `Timeline shows ${getApprovalSummaryPhrase('pending', pendingApprovalToolName)}.`;
	} else if (hasRejectedApproval) {
		summary = `Timeline shows ${getApprovalSummaryPhrase('rejected', rejectedApprovalToolName)}.`;
	} else if (hasApprovedApproval && hasToolActivity) {
		summary =
			hasSearchInspection && hasDiffInspection
				? `Timeline shows ${searchInspectionPhrase}, git diff inspection, and ${getApprovalSummaryPhrase('approved', approvedApprovalToolName)}.`
				: genericToolSummary
					? `Timeline shows ${genericToolSummary} and ${getApprovalSummaryPhrase('approved', approvedApprovalToolName)}.`
					: `Timeline shows ${getApprovalSummaryPhrase('approved', approvedApprovalToolName)}.`;
	} else if (hasApprovedApproval) {
		summary = `Timeline shows ${getApprovalSummaryPhrase('approved', approvedApprovalToolName)}.`;
	} else if (hasSearchInspection && hasDiffInspection) {
		summary = `Timeline shows ${searchInspectionPhrase} and git diff inspection.`;
	} else if (hasSearchInspection) {
		summary = `Timeline shows ${searchInspectionPhrase}.`;
	} else if (hasDiffInspection) {
		summary = 'Timeline shows git diff inspection.';
	} else if (genericToolSummary) {
		summary = `Timeline shows ${genericToolSummary}.`;
	} else {
		summary = 'Timeline shows early run setup.';
	}

	return input.candidates.length > input.visible_item_count
		? `${summary} Showing ${input.visible_item_count} of ${input.candidates.length} steps.`
		: summary;
}

export function mapRunTimelineToBlock(input: MapRunTimelineInput): RunTimelineBlock | undefined {
	const collapsedCandidates = collapseTimelineCandidates(collectTimelineCandidates(input));

	if (collapsedCandidates.length === 0) {
		return undefined;
	}

	const visibleCandidates = selectVisibleCandidates(collapsedCandidates);
	const idSuffix = input.run_id ?? input.created_at;

	return {
		created_at: input.created_at,
		id: `run_timeline_block:${idSuffix}`,
		payload: {
			items: visibleCandidates.map((candidate) => candidate.item),
			summary: buildTimelineSummary({
				blocks: input.blocks,
				candidates: collapsedCandidates,
				visible_item_count: visibleCandidates.length,
			}),
			title: RUN_TIMELINE_BLOCK_TITLE,
		},
		schema_version: 1,
		type: 'run_timeline_block',
	};
}
