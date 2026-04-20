import type {
	AnyRuntimeEvent,
	ApprovalBlock,
	RenderBlock,
	RuntimeState,
	ToolName,
	ToolResultBlock,
	TraceDebugBlock,
} from '@runa/types';

import {
	type ModelUsageSummary,
	readModelUsageEventMetadata,
} from '../runtime/model-usage-accounting.js';

const MAX_NOTE_COUNT = 4;
const MAX_NOTE_LENGTH = 160;
const MAX_TOOL_CHAIN_NAMES = 4;
const TRACE_DEBUG_BLOCK_TITLE = 'Trace / Debug';

interface MapTraceDebugInput {
	readonly blocks?: readonly RenderBlock[];
	readonly created_at: string;
	readonly events?: readonly AnyRuntimeEvent[];
	readonly run_id?: string;
	readonly run_state: RuntimeState;
	readonly trace_id?: string;
}

interface ApprovalSignal {
	readonly action_kind?: ApprovalBlock['payload']['action_kind'];
	readonly note?: string;
	readonly status: ApprovalBlock['payload']['status'];
	readonly summary: string;
	readonly tool_name?: ToolName;
}

interface TraceDebugSignals {
	readonly approval?: ApprovalSignal;
	readonly failure_message?: string;
	readonly has_codebase_search_inspection: boolean;
	readonly has_diff_inspection: boolean;
	readonly has_diff_truncation: boolean;
	readonly has_search_inspection: boolean;
	readonly has_search_truncation: boolean;
	readonly has_tool_failure: boolean;
	readonly has_web_search_inspection: boolean;
	readonly has_workspace_inspection: boolean;
	readonly model_usage?: ModelUsageSummary;
	readonly tool_sequence: readonly ToolName[];
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

	return normalizedValue.length > MAX_NOTE_LENGTH
		? `${normalizedValue.slice(0, MAX_NOTE_LENGTH - 3)}...`
		: normalizedValue;
}

function shortenIdentifier(value: string): string {
	const normalizedValue = normalizeText(value);

	if (normalizedValue.length <= 20) {
		return normalizedValue;
	}

	return `${normalizedValue.slice(0, 8)}...${normalizedValue.slice(-6)}`;
}

function getToolDisplayName(toolName: ToolName): string {
	switch (toolName) {
		case 'edit.patch':
			return 'Patch edit';
		case 'file.list':
			return 'File listing';
		case 'file.read':
			return 'File read';
		case 'file.write':
			return 'File write';
		case 'git.diff':
			return 'Git diff';
		case 'git.status':
			return 'Git status';
		case 'search.codebase':
			return 'Codebase search';
		case 'search.grep':
			return 'Grep search';
		case 'web.search':
			return 'Web search';
		case 'shell.exec':
			return 'Shell command';
		default:
			return toolName.replace(/\./gu, ' ');
	}
}

function getToolSentenceLabel(toolName: ToolName): string {
	return getToolDisplayName(toolName).toLowerCase();
}

function formatApproximateTokenCount(tokenCount: number): string {
	return `~${tokenCount} tok`;
}

function formatContextLayerUsage(
	layer: NonNullable<ModelUsageSummary['request']['compiled_context']>['layers'][number],
): string {
	return `${layer.name} ${formatApproximateTokenCount(layer.token_count)}`;
}

function mergeApprovalSignal(
	existingApproval: ApprovalSignal | undefined,
	update: Readonly<Partial<ApprovalSignal> & Pick<ApprovalSignal, 'status'>>,
): ApprovalSignal {
	return {
		action_kind: update.action_kind ?? existingApproval?.action_kind,
		note: update.note ?? existingApproval?.note,
		status: update.status,
		summary: update.summary ?? existingApproval?.summary ?? `Approval ${update.status}.`,
		tool_name: update.tool_name ?? existingApproval?.tool_name,
	};
}

function pushToolSequenceEntry(
	toolSequence: ToolName[],
	seenCallIds: Set<string>,
	toolName: ToolName,
	callId?: string,
): void {
	if (callId) {
		if (seenCallIds.has(callId)) {
			return;
		}

		seenCallIds.add(callId);
	}

	toolSequence.push(toolName);
}

function getApprovalSignalFromBlock(block: ApprovalBlock): ApprovalSignal {
	return {
		action_kind: block.payload.action_kind,
		note: normalizeOptionalText(block.payload.note),
		status: block.payload.status,
		summary: normalizeText(block.payload.summary),
		tool_name: block.payload.tool_name,
	};
}

function getFailureMessageFromToolBlock(block: ToolResultBlock): string | undefined {
	return block.payload.status === 'error'
		? normalizeOptionalText(block.payload.summary)
		: undefined;
}

function collectTraceDebugSignals(input: MapTraceDebugInput): TraceDebugSignals {
	const toolSequence: ToolName[] = [];
	const seenCallIds = new Set<string>();
	let approval: ApprovalSignal | undefined;
	let failureMessage: string | undefined;
	let hasCodebaseSearchInspection = false;
	let hasDiffInspection = false;
	let hasDiffTruncation = false;
	let hasSearchInspection = false;
	let hasSearchTruncation = false;
	let hasToolFailure = false;
	let hasWebSearchInspection = false;
	let hasWorkspaceInspection = false;
	let modelUsage: ModelUsageSummary | undefined;

	for (const event of input.events ?? []) {
		switch (event.event_type) {
			case 'tool.call.started':
				hasCodebaseSearchInspection ||= event.payload.tool_name === 'search.codebase';
				hasWebSearchInspection ||= event.payload.tool_name === 'web.search';
				pushToolSequenceEntry(
					toolSequence,
					seenCallIds,
					event.payload.tool_name,
					event.payload.call_id,
				);
				break;
			case 'tool.call.completed':
				hasCodebaseSearchInspection ||= event.payload.tool_name === 'search.codebase';
				hasWebSearchInspection ||= event.payload.tool_name === 'web.search';
				pushToolSequenceEntry(
					toolSequence,
					seenCallIds,
					event.payload.tool_name,
					event.payload.call_id,
				);
				hasToolFailure ||= event.payload.result_status === 'error';
				break;
			case 'tool.call.failed':
				hasCodebaseSearchInspection ||= event.payload.tool_name === 'search.codebase';
				hasWebSearchInspection ||= event.payload.tool_name === 'web.search';
				pushToolSequenceEntry(
					toolSequence,
					seenCallIds,
					event.payload.tool_name,
					event.payload.call_id,
				);
				hasToolFailure = true;
				failureMessage ??= normalizeOptionalText(event.payload.error_message);
				break;
			case 'approval.requested':
				approval = mergeApprovalSignal(approval, {
					action_kind: event.payload.action_kind,
					status: 'pending',
					summary: normalizeText(event.payload.summary),
					tool_name: event.payload.tool_name,
				});
				break;
			case 'approval.resolved':
				approval = mergeApprovalSignal(approval, {
					note: normalizeOptionalText(event.payload.note),
					status: event.payload.decision,
					summary: `Approval ${event.payload.decision}.`,
				});
				break;
			case 'run.failed':
				failureMessage ??= normalizeOptionalText(event.payload.error_message);
				break;
			case 'model.completed':
				modelUsage ??= readModelUsageEventMetadata(event.metadata);
				break;
			default:
				break;
		}
	}

	for (const block of input.blocks ?? []) {
		if (block.type === 'tool_result') {
			hasCodebaseSearchInspection ||= block.payload.tool_name === 'search.codebase';
			hasWebSearchInspection ||= block.payload.tool_name === 'web.search';
			pushToolSequenceEntry(
				toolSequence,
				seenCallIds,
				block.payload.tool_name,
				block.payload.call_id,
			);
			hasToolFailure ||= block.payload.status === 'error';
			failureMessage ??= getFailureMessageFromToolBlock(block);
			continue;
		}

		if (block.type === 'approval_block') {
			approval = mergeApprovalSignal(approval, getApprovalSignalFromBlock(block));
			continue;
		}

		if (block.type === 'diff_block') {
			hasDiffInspection = true;
			hasDiffTruncation ||= block.payload.is_truncated === true;
			continue;
		}

		if (block.type === 'search_result_block') {
			hasCodebaseSearchInspection = true;
			hasSearchInspection = true;
			hasSearchTruncation ||= block.payload.is_truncated;
			continue;
		}

		if (block.type === 'web_search_result_block') {
			hasSearchInspection = true;
			hasSearchTruncation ||= block.payload.is_truncated;
			hasWebSearchInspection = true;
			continue;
		}

		if (block.type === 'workspace_inspection_block') {
			hasWorkspaceInspection = true;
		}
	}

	return {
		approval,
		has_codebase_search_inspection: hasCodebaseSearchInspection,
		failure_message: failureMessage,
		has_diff_inspection: hasDiffInspection,
		has_diff_truncation: hasDiffTruncation,
		has_search_inspection: hasSearchInspection,
		has_search_truncation: hasSearchTruncation,
		has_tool_failure: hasToolFailure,
		has_web_search_inspection: hasWebSearchInspection,
		has_workspace_inspection: hasWorkspaceInspection,
		model_usage: modelUsage,
		tool_sequence: toolSequence,
	};
}

function buildTraceLabel(
	runId: string | undefined,
	traceId: string | undefined,
): string | undefined {
	if (runId && traceId) {
		return `run ${shortenIdentifier(runId)} / trace ${shortenIdentifier(traceId)}`;
	}

	if (runId) {
		return `run ${shortenIdentifier(runId)}`;
	}

	if (traceId) {
		return `trace ${shortenIdentifier(traceId)}`;
	}

	return undefined;
}

function getApprovalActionLabel(approval: ApprovalSignal | undefined): string | undefined {
	if (!approval) {
		return undefined;
	}

	switch (approval.action_kind) {
		case 'file_write':
			return 'file write';
		case 'shell_execution':
			return 'shell execution';
		case 'tool_execution':
			return approval.tool_name ? getToolSentenceLabel(approval.tool_name) : 'tool execution';
		default:
			return approval.tool_name ? getToolSentenceLabel(approval.tool_name) : undefined;
	}
}

function buildInspectionSummary(signals: TraceDebugSignals): string | undefined {
	const hasCodebaseSearch = signals.has_codebase_search_inspection;
	const hasWebSearch = signals.has_web_search_inspection;

	if (signals.has_search_inspection && signals.has_diff_inspection) {
		if (hasCodebaseSearch && hasWebSearch) {
			return 'codebase search, public web search, and diff inspection';
		}

		if (hasWebSearch) {
			return 'public web search and diff inspection';
		}

		return 'codebase search and diff inspection';
	}

	if (signals.has_search_inspection) {
		if (hasCodebaseSearch && hasWebSearch) {
			return 'codebase search and public web search';
		}

		if (hasWebSearch) {
			return 'public web search';
		}

		return 'codebase search';
	}

	if (signals.has_diff_inspection) {
		return 'diff inspection';
	}

	return undefined;
}

function collapseToolSequence(
	toolSequence: readonly ToolName[],
): readonly Readonly<{ count: number; tool_name: ToolName }>[] {
	const collapsedSequence: Array<{ count: number; tool_name: ToolName }> = [];

	for (const toolName of toolSequence) {
		const previousEntry = collapsedSequence[collapsedSequence.length - 1];

		if (previousEntry?.tool_name === toolName) {
			previousEntry.count += 1;
			continue;
		}

		collapsedSequence.push({
			count: 1,
			tool_name: toolName,
		});
	}

	return collapsedSequence;
}

function buildToolChainSummary(toolSequence: readonly ToolName[]): string | undefined {
	if (toolSequence.length === 0) {
		return undefined;
	}

	const collapsedSequence = collapseToolSequence(toolSequence);
	const visibleEntries = collapsedSequence.slice(0, MAX_TOOL_CHAIN_NAMES);
	const remainingToolCount = collapsedSequence.length - visibleEntries.length;
	const suffix = remainingToolCount > 0 ? ` +${remainingToolCount} more` : '';
	const sequenceLabel = visibleEntries
		.map((entry) => {
			const toolLabel = getToolDisplayName(entry.tool_name);
			return entry.count > 1 ? `${toolLabel} x${entry.count}` : toolLabel;
		})
		.join(' -> ');

	return `Tool chain: ${sequenceLabel}${suffix}.`;
}

function buildApprovalSummary(
	approval: ApprovalSignal | undefined,
	hasReplayExecuted: boolean,
): string | undefined {
	if (!approval) {
		return undefined;
	}

	const approvalActionLabel = getApprovalActionLabel(approval);

	switch (approval.status) {
		case 'pending':
			return approvalActionLabel
				? `Approval gate active before ${approvalActionLabel}.`
				: 'Approval gate active.';
		case 'approved':
			if (approvalActionLabel) {
				return hasReplayExecuted
					? `Approval granted; replay executed for ${approvalActionLabel}.`
					: `Approval granted for ${approvalActionLabel}.`;
			}

			return hasReplayExecuted ? 'Approval granted; replay executed.' : 'Approval granted.';
		case 'rejected':
			return approvalActionLabel
				? `Approval rejected for ${approvalActionLabel}.`
				: 'Approval rejected.';
		default:
			return approvalActionLabel
				? `Approval ${approval.status} for ${approvalActionLabel}.`
				: `Approval ${approval.status}.`;
	}
}

function buildTraceSummary(
	input: Readonly<{
		readonly run_state: RuntimeState;
		readonly signals: TraceDebugSignals;
	}>,
): string {
	const hasToolActivity = input.signals.tool_sequence.length > 0;
	const hasApprovedApproval = input.signals.approval?.status === 'approved';
	const hasRejectedApproval = input.signals.approval?.status === 'rejected';
	const approvalActionLabel = getApprovalActionLabel(input.signals.approval);
	const inspectionSummary = buildInspectionSummary(input.signals);
	const latestToolName = input.signals.tool_sequence[input.signals.tool_sequence.length - 1];

	switch (input.run_state) {
		case 'WAITING_APPROVAL':
			return approvalActionLabel
				? `Run paused at approval gate before ${approvalActionLabel}.`
				: 'Run paused at approval gate.';
		case 'FAILED':
			if (hasRejectedApproval) {
				return 'Run stopped after approval rejection.';
			}

			return hasApprovedApproval && (hasToolActivity || input.signals.has_tool_failure)
				? 'Run failed during tool execution after approval.'
				: hasToolActivity || input.signals.has_tool_failure
					? 'Run failed during tool execution.'
					: 'Run failed.';
		case 'COMPLETED':
			if (!hasToolActivity) {
				return 'Run completed without tool use.';
			}

			if (hasApprovedApproval) {
				return 'Run completed after approval replay and tool execution.';
			}

			if (inspectionSummary) {
				return `Run completed after ${inspectionSummary}.`;
			}

			return 'Run completed after tool execution.';
		case 'TOOL_RESULT_INGESTING':
			if (hasApprovedApproval) {
				return approvalActionLabel
					? `Run replayed ${approvalActionLabel} after approval.`
					: 'Run replayed tool execution after approval.';
			}

			return hasToolActivity
				? 'Run is ingesting tool output after tool execution.'
				: 'Run is ingesting tool output.';
		case 'MODEL_THINKING':
			if (hasApprovedApproval && hasToolActivity) {
				return 'Run returned to model thinking after approval replay.';
			}

			if (hasToolActivity || inspectionSummary) {
				return inspectionSummary
					? `Run returned to model thinking after ${inspectionSummary}.`
					: 'Run returned to model thinking after tool execution.';
			}

			return 'Run is in model thinking.';
		case 'TOOL_EXECUTING':
			return latestToolName
				? `Run is executing ${getToolSentenceLabel(latestToolName)}.`
				: 'Run is executing a tool.';
		case 'INIT':
			return 'Run is initializing.';
		default: {
			const exhaustiveState: never = input.run_state;
			return exhaustiveState;
		}
	}
}

function pushUniqueNote(notes: string[], value: string | undefined): void {
	if (!value || notes.includes(value) || notes.length >= MAX_NOTE_COUNT) {
		return;
	}

	notes.push(value);
}

function buildInspectionDebugNote(signals: TraceDebugSignals): string | undefined {
	if (signals.has_search_inspection && signals.has_diff_inspection) {
		if (signals.has_codebase_search_inspection && signals.has_web_search_inspection) {
			return 'Codebase search, public web search, and diff inspection informed this run.';
		}

		if (signals.has_web_search_inspection) {
			return 'Public web search and diff inspection informed this run.';
		}

		return 'Codebase search and diff inspection informed this run.';
	}

	if (signals.has_search_inspection) {
		if (signals.has_codebase_search_inspection && signals.has_web_search_inspection) {
			return 'Codebase search and public web search informed this run.';
		}

		if (signals.has_web_search_inspection) {
			return 'Public web search informed this run.';
		}

		return 'Codebase search informed this run.';
	}

	if (signals.has_diff_inspection) {
		return 'Diff inspection informed this run.';
	}

	return undefined;
}

function buildWorkspaceContextNote(
	input: Readonly<{
		readonly run_state: RuntimeState;
		readonly signals: TraceDebugSignals;
	}>,
): string | undefined {
	if (!input.signals.has_workspace_inspection) {
		return undefined;
	}

	const inspectionSummary = buildInspectionSummary(input.signals);

	if (!inspectionSummary || input.run_state === 'COMPLETED') {
		return 'Workspace context prepared.';
	}

	return `Workspace context prepared before ${inspectionSummary}.`;
}

function buildContextAccountingNote(modelUsage: ModelUsageSummary | undefined): string | undefined {
	const compiledContextUsage = modelUsage?.request.compiled_context;

	if (!compiledContextUsage || compiledContextUsage.layer_count === 0) {
		return undefined;
	}

	return `Context accounting: ${formatApproximateTokenCount(compiledContextUsage.total.token_count)} across ${compiledContextUsage.layer_count} layers (${compiledContextUsage.layers
		.map((layer) => formatContextLayerUsage(layer))
		.join(', ')}).`;
}

function buildModelUsageNote(modelUsage: ModelUsageSummary | undefined): string | undefined {
	if (!modelUsage) {
		return undefined;
	}

	const requestSummary = `request ${formatApproximateTokenCount(modelUsage.request.total.token_count)}`;

	if (modelUsage.response.measurement === 'provider') {
		const responseComponents =
			modelUsage.response.input_tokens !== undefined &&
			modelUsage.response.output_tokens !== undefined
				? ` (in ${modelUsage.response.input_tokens} / out ${modelUsage.response.output_tokens} tok)`
				: '';

		return `Model usage: ${requestSummary}; provider response ${modelUsage.response.token_count} tok${responseComponents}.`;
	}

	return `Model usage: ${requestSummary}; response ${formatApproximateTokenCount(modelUsage.response.token_count)}.`;
}

function buildDebugNotes(
	input: Readonly<{
		readonly run_state: RuntimeState;
		readonly signals: TraceDebugSignals;
	}>,
): readonly string[] | undefined {
	const notes: string[] = [];
	const shouldEmitInspectionNote =
		!input.signals.has_workspace_inspection &&
		(input.signals.has_search_inspection || input.signals.has_diff_inspection) &&
		(input.run_state !== 'COMPLETED' ||
			input.signals.approval?.status === 'approved' ||
			input.signals.has_tool_failure);

	pushUniqueNote(notes, buildWorkspaceContextNote(input));
	pushUniqueNote(
		notes,
		shouldEmitInspectionNote ? buildInspectionDebugNote(input.signals) : undefined,
	);
	pushUniqueNote(notes, buildContextAccountingNote(input.signals.model_usage));
	pushUniqueNote(notes, buildModelUsageNote(input.signals.model_usage));

	return notes.length > 0 ? notes : undefined;
}

function buildTruncationWarning(signals: TraceDebugSignals): string | undefined {
	if (signals.has_search_truncation && signals.has_diff_truncation) {
		return 'Search results and diff preview were truncated.';
	}

	if (signals.has_search_truncation) {
		return 'Search results were truncated.';
	}

	if (signals.has_diff_truncation) {
		return 'Diff preview was truncated.';
	}

	return undefined;
}

function buildWarningNotes(
	input: Readonly<{
		readonly run_state: RuntimeState;
		readonly signals: TraceDebugSignals;
	}>,
): readonly string[] | undefined {
	const notes: string[] = [];
	const approvalActionLabel = getApprovalActionLabel(input.signals.approval);

	if (input.run_state === 'WAITING_APPROVAL') {
		pushUniqueNote(
			notes,
			approvalActionLabel
				? `Pending approval is blocking ${approvalActionLabel}.`
				: 'Pending approval is blocking the run.',
		);
	}

	if (input.signals.approval?.status === 'rejected') {
		pushUniqueNote(notes, 'Approval was rejected; the requested action was not replayed.');
		pushUniqueNote(notes, normalizeOptionalText(input.signals.approval.note));
	}

	if (input.signals.has_tool_failure) {
		pushUniqueNote(
			notes,
			input.signals.failure_message
				? `Tool failure: ${input.signals.failure_message}`
				: 'Tool failure interrupted the run.',
		);
	}

	pushUniqueNote(notes, buildTruncationWarning(input.signals));

	return notes.length > 0 ? notes : undefined;
}

export function mapTraceDebugToBlock(input: MapTraceDebugInput): TraceDebugBlock | undefined {
	const signals = collectTraceDebugSignals(input);
	const hasReplayExecuted =
		signals.approval?.status === 'approved' && signals.tool_sequence.length > 0;
	const hasSignals =
		signals.tool_sequence.length > 0 ||
		signals.approval !== undefined ||
		signals.failure_message !== undefined ||
		signals.has_diff_inspection ||
		signals.has_diff_truncation ||
		signals.has_search_inspection ||
		signals.has_search_truncation ||
		signals.has_workspace_inspection ||
		(input.events?.length ?? 0) > 0;

	if (!hasSignals) {
		return undefined;
	}

	const idSuffix = input.run_id ?? input.created_at;

	return {
		created_at: input.created_at,
		id: `trace_debug_block:${idSuffix}`,
		payload: {
			approval_summary: buildApprovalSummary(signals.approval, hasReplayExecuted),
			debug_notes: buildDebugNotes({
				run_state: input.run_state,
				signals,
			}),
			run_state: input.run_state,
			summary: buildTraceSummary({
				run_state: input.run_state,
				signals,
			}),
			title: TRACE_DEBUG_BLOCK_TITLE,
			tool_chain_summary: buildToolChainSummary(signals.tool_sequence),
			trace_label: buildTraceLabel(input.run_id, input.trace_id),
			warning_notes: buildWarningNotes({
				run_state: input.run_state,
				signals,
			}),
		},
		schema_version: 1,
		type: 'trace_debug_block',
	};
}
