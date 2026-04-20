import type {
	AnyRuntimeEvent,
	ApprovalRequest,
	InspectionRequestPayload,
	RenderBlock,
	RuntimeEvent,
	RuntimeState,
	ToolResult,
} from '@runa/types';

import type { WorkspaceLayer } from '../context/compose-workspace-context.js';
import type {
	ApprovalPersistenceScope,
	ApprovalStore,
	PendingApprovalContinuationContext,
	PendingApprovalToolCall,
} from '../persistence/approval-store.js';
import { hardenSearchRoutingPresentationBlocks } from '../presentation/harden-search-routing-notes.js';
import {
	mapApprovalRequestToBlock,
	mapApprovalResolutionToBlock,
} from '../presentation/map-approval-result.js';
import { mapToolResultToCodeBlock } from '../presentation/map-code-result.js';
import { mapToolResultToDiffBlock } from '../presentation/map-diff-result.js';
import { mapInspectionDetailToBlock } from '../presentation/map-inspection-detail.js';
import { mapRunTimelineToBlock } from '../presentation/map-run-timeline.js';
import { mapRuntimeEventsToRenderBlocks } from '../presentation/map-runtime-events.js';
import { mapToolResultToSearchResultBlock } from '../presentation/map-search-result.js';
import { mapToolResultToBlock } from '../presentation/map-tool-result.js';
import { mapTraceDebugToBlock } from '../presentation/map-trace-debug.js';
import { mapToolResultToWebSearchResultBlock } from '../presentation/map-web-search-result.js';
import { mapWorkspaceInspectionToBlock } from '../presentation/map-workspace-inspection.js';
import type { IngestedToolResult } from '../runtime/ingest-tool-result.js';
import type { RequestApprovalResult } from '../runtime/request-approval.js';
import type { ResolveApprovalResult } from '../runtime/resolve-approval.js';
import type { RunRequestPayload } from './messages.js';
import type { WebSocketConnection } from './transport.js';

export type ApprovalRequestPresentationResult =
	| RequestApprovalResult
	| Readonly<{
			readonly approval_event: {
				readonly sequence_no?: number;
			};
			readonly approval_request: ApprovalRequest;
			readonly status: 'approval_required';
	  }>;

type RequestApprovalPresentationInput = Readonly<{
	continuation_context?: PendingApprovalContinuationContext;
	kind: 'request_result';
	pending_tool_call?: PendingApprovalToolCall;
	result: ApprovalRequestPresentationResult;
}>;

type ResolveApprovalPresentationInput = Readonly<{
	approval_request: ApprovalRequest;
	kind: 'resolution_result';
	pending_tool_call?: PendingApprovalToolCall;
	result: ResolveApprovalResult;
}>;

export type ApprovalPresentationInput =
	| RequestApprovalPresentationInput
	| ResolveApprovalPresentationInput;

export type ToolResultPresentationInput = Readonly<{
	call_id: string;
	created_at: string;
	result: IngestedToolResult | Parameters<typeof mapToolResultToBlock>[0]['result'];
	tool_arguments?: unknown;
	tool_name: Parameters<typeof mapToolResultToBlock>[0]['tool_name'];
}>;

export interface PresentationCompatibleRunResult {
	readonly approval_request?: ApprovalRequest;
	readonly assistant_text?: string;
	readonly events: readonly AnyRuntimeEvent[];
	readonly final_state: RuntimeState;
	readonly pending_tool_call?: PendingApprovalToolCall;
	readonly runtime_events: readonly RuntimeEvent[];
	readonly status: 'approval_required' | 'completed' | 'failed';
	readonly tool_arguments?: unknown;
	readonly tool_result?: ToolResult;
	readonly turn_count?: number;
	readonly workspace_layer?: WorkspaceLayer;
}

export interface StoredInspectionContext {
	readonly blocks: readonly RenderBlock[];
	readonly events: readonly AnyRuntimeEvent[];
	readonly run_id: string;
	readonly trace_id: string;
	readonly workspace_layer?: WorkspaceLayer;
}

export interface RuntimePresentationHooks {
	readonly getAdditionalPresentationBlocks?: (
		input: Readonly<{
			readonly payload: RunRequestPayload;
			readonly result: PresentationCompatibleRunResult;
		}>,
	) => Promise<readonly RenderBlock[]> | readonly RenderBlock[];
	readonly getApprovalPresentationInputs?: (
		input: Readonly<{
			readonly payload: RunRequestPayload;
			readonly result: PresentationCompatibleRunResult;
		}>,
	) => Promise<readonly ApprovalPresentationInput[]> | readonly ApprovalPresentationInput[];
	readonly getToolResultPresentationInputs?: (
		input: Readonly<{
			readonly payload: RunRequestPayload;
			readonly result: PresentationCompatibleRunResult;
		}>,
	) => Promise<readonly ToolResultPresentationInput[]> | readonly ToolResultPresentationInput[];
}

const MAX_STORED_INSPECTION_RUNS_PER_SOCKET = 6;

const inspectionContextsBySocket = new WeakMap<
	WebSocketConnection,
	Map<string, StoredInspectionContext>
>();

export function createPresentationBlockList(
	events: readonly RuntimeEvent[],
	additionalBlocks: readonly RenderBlock[] = [],
): readonly RenderBlock[] {
	return [...mapRuntimeEventsToRenderBlocks(events), ...additionalBlocks];
}

export function mergeInspectionEvents(
	existingEvents: readonly AnyRuntimeEvent[],
	nextEvents: readonly AnyRuntimeEvent[],
): readonly AnyRuntimeEvent[] {
	if (nextEvents.length === 0) {
		return [...existingEvents];
	}

	const mergedEvents = [...existingEvents];
	const seenEventIds = new Set(existingEvents.map((event) => event.event_id));

	for (const event of nextEvents) {
		if (seenEventIds.has(event.event_id)) {
			continue;
		}

		seenEventIds.add(event.event_id);
		mergedEvents.push(event);
	}

	return mergedEvents;
}

function getInspectionContextStore(
	socket: WebSocketConnection,
): Map<string, StoredInspectionContext> {
	const existingStore = inspectionContextsBySocket.get(socket);

	if (existingStore) {
		return existingStore;
	}

	const nextStore = new Map<string, StoredInspectionContext>();
	inspectionContextsBySocket.set(socket, nextStore);
	return nextStore;
}

export function mergeRenderBlocks(
	existingBlocks: readonly RenderBlock[],
	nextBlocks: readonly RenderBlock[],
): readonly RenderBlock[] {
	if (existingBlocks.length === 0) {
		return [...nextBlocks];
	}

	const mergedBlocks = [...existingBlocks];
	const existingIndexesById = new Map(
		existingBlocks.map((block, index) => [block.id, index] as const),
	);

	for (const block of nextBlocks) {
		const existingIndex = existingIndexesById.get(block.id);

		if (existingIndex === undefined) {
			existingIndexesById.set(block.id, mergedBlocks.length);
			mergedBlocks.push(block);
			continue;
		}

		mergedBlocks[existingIndex] = block;
	}

	return mergedBlocks;
}

export function rememberInspectionContext(
	socket: WebSocketConnection,
	context: StoredInspectionContext,
): void {
	const inspectionContextStore = getInspectionContextStore(socket);

	if (inspectionContextStore.has(context.run_id)) {
		inspectionContextStore.delete(context.run_id);
	}

	inspectionContextStore.set(context.run_id, context);

	while (inspectionContextStore.size > MAX_STORED_INSPECTION_RUNS_PER_SOCKET) {
		const oldestRunId = inspectionContextStore.keys().next().value;

		if (oldestRunId === undefined) {
			return;
		}

		inspectionContextStore.delete(oldestRunId);
	}
}

export function getStoredInspectionContext(
	socket: WebSocketConnection,
	runId: string,
): StoredInspectionContext | undefined {
	return getInspectionContextStore(socket).get(runId);
}

export function createToolResultPresentationBlocks(
	inputs: readonly ToolResultPresentationInput[],
): readonly RenderBlock[] {
	return inputs.flatMap((input) => {
		const toolResultBlock = mapToolResultToBlock(input);
		const codeBlock = mapToolResultToCodeBlock(input);
		const diffBlock = input.tool_name === 'git.diff' ? mapToolResultToDiffBlock(input) : undefined;
		const searchResultBlock =
			input.tool_name === 'search.codebase' ? mapToolResultToSearchResultBlock(input) : undefined;
		const webSearchResultBlock =
			input.tool_name === 'web.search' ? mapToolResultToWebSearchResultBlock(input) : undefined;
		const blocks: RenderBlock[] = [toolResultBlock];

		if (codeBlock) {
			blocks.push(codeBlock);
		}

		if (diffBlock) {
			blocks.push(diffBlock);
		}

		if (searchResultBlock) {
			blocks.push(searchResultBlock);
		}

		if (webSearchResultBlock) {
			blocks.push(webSearchResultBlock);
		}

		return blocks;
	});
}

export function createAutomaticTurnPresentationBlocks(
	input: Readonly<{
		readonly approval_request?: ApprovalRequest;
		readonly created_at: string;
		readonly pending_tool_call?: PendingApprovalToolCall;
		readonly tool_arguments?: unknown;
		readonly tool_result?: ToolResult;
		readonly working_directory: string;
	}>,
): readonly RenderBlock[] {
	const automaticBlocks: RenderBlock[] = [];

	if (input.tool_result !== undefined) {
		automaticBlocks.push(
			...createToolResultPresentationBlocks([
				{
					call_id: input.tool_result.call_id,
					created_at: input.created_at,
					result: input.tool_result,
					tool_arguments: input.tool_arguments,
					tool_name: input.tool_result.tool_name,
				},
			]),
		);
	}

	if (input.approval_request !== undefined) {
		automaticBlocks.push(
			...createApprovalPresentationBlocks([
				{
					kind: 'request_result',
					pending_tool_call: input.pending_tool_call ?? {
						tool_input: {},
						working_directory: input.working_directory,
					},
					result: {
						approval_event: {},
						approval_request: input.approval_request,
						status: 'approval_required',
					},
				},
			]),
		);
	}

	return hardenSearchRoutingPresentationBlocks(automaticBlocks);
}

function findLastSearchSummary(blocks: readonly RenderBlock[]): string | undefined {
	for (let index = blocks.length - 1; index >= 0; index -= 1) {
		const block = blocks[index];

		if (block?.type === 'search_result_block' || block?.type === 'web_search_result_block') {
			return block.payload.summary;
		}
	}

	return undefined;
}

function createWorkspaceInspectionPresentationBlocks(
	input: Readonly<{
		readonly blocks: readonly RenderBlock[];
		readonly result: PresentationCompatibleRunResult;
		readonly run_id: string;
	}>,
): readonly RenderBlock[] {
	if (!input.result.workspace_layer) {
		return [];
	}

	return [
		mapWorkspaceInspectionToBlock({
			created_at:
				input.result.events[input.result.events.length - 1]?.timestamp ?? new Date().toISOString(),
			last_search_summary: findLastSearchSummary(input.blocks),
			run_id: input.run_id,
			workspace_layer: input.result.workspace_layer,
		}),
	];
}

function createRunTimelinePresentationBlocks(
	input: Readonly<{
		readonly blocks: readonly RenderBlock[];
		readonly result: PresentationCompatibleRunResult;
		readonly run_id: string;
	}>,
): readonly RenderBlock[] {
	const timelineBlock = mapRunTimelineToBlock({
		blocks: input.blocks,
		created_at:
			input.result.events[input.result.events.length - 1]?.timestamp ?? new Date().toISOString(),
		events: input.result.events,
		run_id: input.run_id,
	});

	return timelineBlock ? [timelineBlock] : [];
}

export function createTraceDebugPresentationBlocks(
	input: Readonly<{
		readonly blocks: readonly RenderBlock[];
		readonly events: readonly AnyRuntimeEvent[];
		readonly final_state: RuntimeState;
		readonly run_id: string;
		readonly trace_id: string;
	}>,
): readonly RenderBlock[] {
	const traceDebugBlock = mapTraceDebugToBlock({
		blocks: input.blocks,
		created_at: input.events[input.events.length - 1]?.timestamp ?? new Date().toISOString(),
		events: input.events,
		run_id: input.run_id,
		run_state: input.final_state,
		trace_id: input.trace_id,
	});

	return traceDebugBlock ? [traceDebugBlock] : [];
}

export function createInspectionDetailPresentationBlocks(
	input: Readonly<{
		readonly context: StoredInspectionContext;
		readonly payload: InspectionRequestPayload;
	}>,
): readonly RenderBlock[] {
	const detailBlock = mapInspectionDetailToBlock({
		blocks: input.context.blocks,
		created_at: new Date().toISOString(),
		detail_level: input.payload.detail_level,
		events: input.context.events,
		run_id: input.payload.run_id,
		target_id: input.payload.target_id,
		target_kind: input.payload.target_kind,
		trace_id: input.context.trace_id,
		workspace_layer: input.context.workspace_layer,
	});

	return detailBlock ? [detailBlock] : [];
}

export function createApprovalPresentationBlocks(
	inputs: readonly ApprovalPresentationInput[],
): readonly RenderBlock[] {
	return inputs.flatMap((input) => {
		if (input.kind === 'request_result') {
			return input.result.status === 'approval_required'
				? [mapApprovalRequestToBlock(input.result.approval_request)]
				: [];
		}

		return input.result.status === 'approved' || input.result.status === 'rejected'
			? [
					mapApprovalResolutionToBlock({
						approval_request: input.approval_request,
						approval_resolution: input.result.approval_resolution,
					}),
				]
			: [];
	});
}

export async function persistApprovalPresentationInputs(
	store: ApprovalStore,
	inputs: readonly ApprovalPresentationInput[],
	scope?: ApprovalPersistenceScope,
): Promise<void> {
	for (const input of inputs) {
		if (input.kind === 'request_result') {
			if (input.result.status === 'approval_required') {
				await store.persistApprovalRequest({
					approval_request: input.result.approval_request,
					auto_continue_context: input.continuation_context,
					next_sequence_no: (input.result.approval_event.sequence_no ?? 0) + 1,
					pending_tool_call: input.pending_tool_call,
					scope,
				});
			}

			continue;
		}

		if (input.result.status === 'approved' || input.result.status === 'rejected') {
			await store.persistApprovalResolution({
				approval_request: input.approval_request,
				approval_resolution: input.result.approval_resolution,
				pending_tool_call: input.kind === 'resolution_result' ? input.pending_tool_call : undefined,
				scope,
			});
		}
	}
}

function createAutomaticToolResultPresentationInputs(
	result: PresentationCompatibleRunResult,
): readonly ToolResultPresentationInput[] {
	if (result.tool_result === undefined) {
		return [];
	}

	return [
		{
			call_id: result.tool_result.call_id,
			created_at: result.events[result.events.length - 1]?.timestamp ?? new Date().toISOString(),
			result: result.tool_result,
			tool_arguments: result.tool_arguments,
			tool_name: result.tool_result.tool_name,
		},
	];
}

export function createAutomaticApprovalPresentationInputs(
	result: PresentationCompatibleRunResult,
	workingDirectory: string,
	payload: RunRequestPayload,
): readonly ApprovalPresentationInput[] {
	if (result.status !== 'approval_required' || result.approval_request === undefined) {
		return [];
	}

	const continuationContext =
		result.approval_request.target?.label === 'agent.auto_continue' &&
		result.tool_result !== undefined &&
		typeof result.turn_count === 'number'
			? {
					payload,
					tool_result: result.tool_result,
					turn_count: result.turn_count,
					working_directory: workingDirectory,
				}
			: undefined;

	return [
		{
			continuation_context: continuationContext,
			kind: 'request_result',
			pending_tool_call: result.pending_tool_call ?? {
				tool_input: {},
				working_directory: workingDirectory,
			},
			result: {
				approval_event: {},
				approval_request: result.approval_request,
				status: 'approval_required',
			},
		},
	];
}

export async function createAdditionalPresentationBlocks(
	input: Readonly<{
		readonly approvalStore: ApprovalStore;
		readonly automaticApprovalPresentationInputs: readonly ApprovalPresentationInput[];
		readonly approvalPersistenceScope?: ApprovalPersistenceScope;
		readonly hooks: RuntimePresentationHooks;
		readonly payload: RunRequestPayload;
		readonly result: PresentationCompatibleRunResult;
	}>,
): Promise<readonly RenderBlock[]> {
	const automaticToolResultPresentationInputs = createAutomaticToolResultPresentationInputs(
		input.result,
	);
	const hookedToolResultPresentationInputs =
		(await input.hooks.getToolResultPresentationInputs?.({
			payload: input.payload,
			result: input.result,
		})) ?? [];
	const mappedToolResultBlocks = createToolResultPresentationBlocks([
		...automaticToolResultPresentationInputs,
		...hookedToolResultPresentationInputs,
	]);
	const hookedApprovalPresentationInputs =
		(await input.hooks.getApprovalPresentationInputs?.({
			payload: input.payload,
			result: input.result,
		})) ?? [];

	await persistApprovalPresentationInputs(
		input.approvalStore,
		hookedApprovalPresentationInputs,
		input.approvalPersistenceScope,
	);

	const mappedApprovalBlocks = createApprovalPresentationBlocks([
		...input.automaticApprovalPresentationInputs,
		...hookedApprovalPresentationInputs,
	]);
	const additionalBlocks =
		(await input.hooks.getAdditionalPresentationBlocks?.({
			payload: input.payload,
			result: input.result,
		})) ?? [];
	const blocksBeforeInspection = hardenSearchRoutingPresentationBlocks([
		...mappedToolResultBlocks,
		...mappedApprovalBlocks,
		...additionalBlocks,
	]);
	const workspaceInspectionBlocks = createWorkspaceInspectionPresentationBlocks({
		blocks: blocksBeforeInspection,
		result: input.result,
		run_id: input.payload.run_id,
	});
	const blocksBeforeTimeline = [...blocksBeforeInspection, ...workspaceInspectionBlocks];
	const runTimelineBlocks = createRunTimelinePresentationBlocks({
		blocks: blocksBeforeTimeline,
		result: input.result,
		run_id: input.payload.run_id,
	});
	const traceDebugBlocks = createTraceDebugPresentationBlocks({
		blocks: [...blocksBeforeTimeline, ...runTimelineBlocks],
		events: input.result.events,
		final_state: input.result.final_state,
		run_id: input.payload.run_id,
		trace_id: input.payload.trace_id,
	});

	return [...blocksBeforeTimeline, ...runTimelineBlocks, ...traceDebugBlocks];
}

export function shouldUseAssistantResponsePresentationFastPath(
	payload: RunRequestPayload,
	result: PresentationCompatibleRunResult,
): boolean {
	return (
		payload.include_presentation_blocks === true &&
		result.status === 'completed' &&
		result.final_state === 'COMPLETED' &&
		result.assistant_text !== undefined &&
		result.tool_result === undefined &&
		result.approval_request === undefined
	);
}
