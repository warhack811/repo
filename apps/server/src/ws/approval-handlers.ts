import type {
	ApprovalRequest,
	RenderBlock,
	RuntimeEvent,
	ToolCallInput,
	ToolResult,
} from '@runa/types';

import {
	type ApprovalStore,
	type PendingApprovalEntry,
	type PendingApprovalToolCall,
	approvalPersistenceScopeFromAuthContext,
} from '../persistence/approval-store.js';
import { persistRuntimeEvents } from '../persistence/event-store.js';
import { persistRunState } from '../persistence/run-store.js';
import { ingestToolResult } from '../runtime/ingest-tool-result.js';
import { resolveApproval } from '../runtime/resolve-approval.js';
import { resumeApprovedToolCall } from '../runtime/resume-approved-tool-call.js';
import { buildRunFailedEvent } from '../runtime/runtime-events.js';
import { defaultDesktopAgentBridgeRegistry } from './desktop-agent-bridge.js';
import type { RuntimeWebSocketHandlerOptions } from './orchestration-types.js';
import {
	createApprovalPresentationBlocks,
	createToolResultPresentationBlocks,
	createTraceDebugPresentationBlocks,
	getStoredInspectionContext,
	mergeInspectionEvents,
	mergeRenderBlocks,
	rememberInspectionContext,
} from './presentation.js';
import { finalizeLiveRunResult, resumeApprovedAutoContinue } from './run-execution.js';
import { getDefaultToolRegistryAsync, getPolicyWiring } from './runtime-dependencies.js';
import {
	type WebSocketConnection,
	createFinishedMessage,
	createRuntimeEventMessage,
	createStandalonePresentationBlocksMessage,
	sendServerMessage,
} from './transport.js';

function toReplayToolInput(
	approvalRequest: ApprovalRequest,
	pendingToolCall: PendingApprovalToolCall,
): ToolCallInput {
	if (!approvalRequest.call_id || !approvalRequest.tool_name) {
		throw new Error(
			'Pending approval replay requires approval_request.call_id and approval_request.tool_name.',
		);
	}

	return {
		arguments: pendingToolCall.tool_input,
		call_id: approvalRequest.call_id,
		tool_name: approvalRequest.tool_name,
	};
}

function createApprovalRejectedErrorMessage(
	input: Readonly<{
		readonly note?: string;
		readonly tool_name?: string;
	}>,
): string {
	const targetLabel = input.tool_name ? ` for ${input.tool_name}` : '';
	const note = input.note?.trim();

	return note && note.length > 0
		? `Approval rejected${targetLabel}: ${note}`
		: `Approval rejected${targetLabel}.`;
}

async function finalizeRejectedApprovalRun(
	socket: WebSocketConnection,
	pendingApprovalEntry: PendingApprovalEntry,
	resolvedApprovalResult: Extract<
		ReturnType<typeof resolveApproval>,
		{ readonly status: 'rejected' }
	>,
	options: RuntimeWebSocketHandlerOptions & {
		readonly approvalStore: ApprovalStore;
	},
): Promise<void> {
	const errorMessage = createApprovalRejectedErrorMessage({
		note: resolvedApprovalResult.approval_resolution.decision.note,
		tool_name: pendingApprovalEntry.approval_request.tool_name,
	});
	const runFailedEvent = buildRunFailedEvent(
		{
			error_code: 'APPROVAL_REJECTED',
			error_message: errorMessage,
			final_state: 'FAILED',
			retryable: false,
		},
		{
			actor: {
				type: 'user',
			},
			run_id: pendingApprovalEntry.approval_request.run_id,
			sequence_no: pendingApprovalEntry.next_sequence_no + 1,
			source: {
				kind: 'websocket',
			},
			state_after: 'FAILED',
			state_before: 'WAITING_APPROVAL',
			trace_id: pendingApprovalEntry.approval_request.trace_id,
		},
	);
	const runtimeEvents: readonly RuntimeEvent[] = [runFailedEvent];

	sendServerMessage(
		socket,
		createRuntimeEventMessage(
			{
				run_id: pendingApprovalEntry.approval_request.run_id,
				trace_id: pendingApprovalEntry.approval_request.trace_id,
			},
			runFailedEvent,
		),
	);

	if (pendingApprovalEntry.auto_continue_context !== undefined) {
		await finalizeLiveRunResult(
			socket,
			pendingApprovalEntry.auto_continue_context.payload,
			{
				approval_request: pendingApprovalEntry.approval_request,
				error_code: 'APPROVAL_REJECTED',
				error_message: errorMessage,
				events: [resolvedApprovalResult.approval_event, runFailedEvent],
				final_state: 'FAILED',
				pending_tool_call: pendingApprovalEntry.pending_tool_call,
				runtime_events: runtimeEvents,
				status: 'failed',
				tool_result_history: pendingApprovalEntry.auto_continue_context.tool_result_history,
				turn_count: pendingApprovalEntry.auto_continue_context.turn_count,
			},
			options,
			{
				conversation_id: pendingApprovalEntry.auto_continue_context.payload.conversation_id,
				persist_live_memory_write: false,
				working_directory: pendingApprovalEntry.auto_continue_context.working_directory,
			},
		);
		return;
	}

	const persistEvents = options.persistEvents ?? persistRuntimeEvents;
	const persistRunStateRecord = options.persistRunState ?? persistRunState;

	await persistEvents(runtimeEvents);
	await persistRunStateRecord({
		current_state: 'FAILED',
		last_error_code: 'APPROVAL_REJECTED',
		recorded_at: runFailedEvent.timestamp,
		run_id: pendingApprovalEntry.approval_request.run_id,
		trace_id: pendingApprovalEntry.approval_request.trace_id,
	});

	const finishedMessage = createFinishedMessage(
		{
			run_id: pendingApprovalEntry.approval_request.run_id,
			trace_id: pendingApprovalEntry.approval_request.trace_id,
		},
		{
			error_message: errorMessage,
			final_state: 'FAILED',
			status: 'failed',
		},
	);

	if (finishedMessage) {
		sendServerMessage(socket, finishedMessage);
	}
}

export async function handleApprovalResolveMessage(
	socket: WebSocketConnection,
	payload: Readonly<{
		readonly approval_id: string;
		readonly decision: 'approved' | 'rejected';
		readonly note?: string;
	}>,
	options: RuntimeWebSocketHandlerOptions & {
		readonly approvalStore: ApprovalStore;
	},
): Promise<void> {
	const pendingApprovalEntry = await options.approvalStore.getPendingApprovalById(
		payload.approval_id,
	);

	if (!pendingApprovalEntry) {
		throw new Error(`Pending approval not found: ${payload.approval_id}`);
	}

	const resolvedApprovalResult = resolveApproval({
		approval_request: pendingApprovalEntry.approval_request,
		current_state: 'WAITING_APPROVAL',
		decision: payload.decision,
		event_context: {
			actor: {
				type: 'user',
			},
			sequence_no: pendingApprovalEntry.next_sequence_no,
			source: {
				kind: 'websocket',
			},
		},
		note: payload.note,
		run_id: pendingApprovalEntry.approval_request.run_id,
		trace_id: pendingApprovalEntry.approval_request.trace_id,
	});

	if (resolvedApprovalResult.status === 'failed') {
		throw new Error(resolvedApprovalResult.failure.message);
	}

	const policyWiring = getPolicyWiring(options);
	const resolvedToolRegistry = options.toolRegistry ?? (await getDefaultToolRegistryAsync());
	const toolDefinition =
		pendingApprovalEntry.approval_request.tool_name === undefined
			? undefined
			: resolvedToolRegistry.get(pendingApprovalEntry.approval_request.tool_name);
	const approvalDecision = policyWiring.resolveApprovalDecision(socket, {
		pending_approval: pendingApprovalEntry,
		tool_definition: toolDefinition,
	});

	await policyWiring.recordOutcome(socket, {
		decision: approvalDecision,
		outcome:
			resolvedApprovalResult.status === 'approved' ? 'approval_approved' : 'approval_rejected',
	});

	await options.approvalStore.persistApprovalResolution({
		approval_request: pendingApprovalEntry.approval_request,
		approval_resolution: resolvedApprovalResult.approval_resolution,
		auto_continue_context: pendingApprovalEntry.auto_continue_context,
		next_sequence_no: pendingApprovalEntry.next_sequence_no + 1,
		pending_tool_call: pendingApprovalEntry.pending_tool_call,
		scope: approvalPersistenceScopeFromAuthContext(options.auth_context),
	});

	const blocks: RenderBlock[] = [
		...createApprovalPresentationBlocks([
			{
				approval_request: pendingApprovalEntry.approval_request,
				kind: 'resolution_result',
				pending_tool_call: pendingApprovalEntry.pending_tool_call,
				result: resolvedApprovalResult,
			},
		]),
	];
	let approvedReplayToolResult: ToolResult | undefined;

	if (
		resolvedApprovalResult.status === 'approved' &&
		approvalDecision.request.kind !== 'auto_continue'
	) {
		if (!pendingApprovalEntry.pending_tool_call) {
			throw new Error(
				`Pending approval replay context missing: ${pendingApprovalEntry.approval_request.approval_id}`,
			);
		}

		const replayToolInput = toReplayToolInput(
			pendingApprovalEntry.approval_request,
			pendingApprovalEntry.pending_tool_call,
		);
		const replayResult = await resumeApprovedToolCall({
			approval_request: pendingApprovalEntry.approval_request,
			approval_resolution: resolvedApprovalResult.approval_resolution,
			call_id: replayToolInput.call_id,
			current_state: resolvedApprovalResult.final_state,
			execution_context: {
				desktop_bridge: (
					options.desktopAgentBridgeRegistry ?? defaultDesktopAgentBridgeRegistry
				).createInvoker(
					options.auth_context,
					pendingApprovalEntry.pending_tool_call?.desktop_target_connection_id,
				),
				run_id: pendingApprovalEntry.approval_request.run_id,
				trace_id: pendingApprovalEntry.approval_request.trace_id,
				working_directory: pendingApprovalEntry.pending_tool_call.working_directory,
			},
			registry: resolvedToolRegistry,
			run_id: pendingApprovalEntry.approval_request.run_id,
			tool_input: replayToolInput,
			tool_name: replayToolInput.tool_name,
			trace_id: pendingApprovalEntry.approval_request.trace_id,
		});

		if (replayResult.status === 'failed') {
			throw new Error(replayResult.failure.message);
		}

		if (replayResult.status === 'completed') {
			const ingestedReplayResult = ingestToolResult({
				call_id: replayResult.call_id,
				current_state: replayResult.final_state,
				run_id: pendingApprovalEntry.approval_request.run_id,
				tool_name: replayResult.tool_name,
				tool_result: replayResult.tool_result,
				trace_id: pendingApprovalEntry.approval_request.trace_id,
			});

			if (ingestedReplayResult.status === 'failed') {
				throw new Error(ingestedReplayResult.failure.message);
			}

			approvedReplayToolResult = ingestedReplayResult.tool_result;
			blocks.push(
				...createToolResultPresentationBlocks([
					{
						call_id: ingestedReplayResult.call_id,
						created_at:
							replayResult.events[1]?.timestamp ??
							replayResult.events[0]?.timestamp ??
							resolvedApprovalResult.approval_resolution.decision.resolved_at,
						result: ingestedReplayResult.ingested_result,
						tool_arguments: replayToolInput.arguments,
						tool_name: ingestedReplayResult.tool_name,
					},
				]),
			);
		}
	}

	const standaloneTraceDebugBlocks = createTraceDebugPresentationBlocks({
		blocks,
		events: [resolvedApprovalResult.approval_event],
		final_state:
			resolvedApprovalResult.status === 'rejected'
				? 'FAILED'
				: blocks.some((block) => block.type === 'tool_result')
					? 'TOOL_RESULT_INGESTING'
					: resolvedApprovalResult.final_state,
		run_id: pendingApprovalEntry.approval_request.run_id,
		trace_id: pendingApprovalEntry.approval_request.trace_id,
	});
	const standaloneBlocks = [...blocks, ...standaloneTraceDebugBlocks];
	const existingInspectionContext = getStoredInspectionContext(
		socket,
		pendingApprovalEntry.approval_request.run_id,
	);

	rememberInspectionContext(socket, {
		blocks: mergeRenderBlocks(existingInspectionContext?.blocks ?? [], standaloneBlocks),
		events: mergeInspectionEvents(existingInspectionContext?.events ?? [], [
			resolvedApprovalResult.approval_event,
		]),
		run_id: pendingApprovalEntry.approval_request.run_id,
		trace_id: pendingApprovalEntry.approval_request.trace_id,
		workspace_layer: existingInspectionContext?.workspace_layer,
	});

	sendServerMessage(
		socket,
		createStandalonePresentationBlocksMessage({
			blocks: standaloneBlocks,
			run_id: pendingApprovalEntry.approval_request.run_id,
			trace_id: pendingApprovalEntry.approval_request.trace_id,
		}),
	);

	if (resolvedApprovalResult.status === 'rejected') {
		await finalizeRejectedApprovalRun(
			socket,
			pendingApprovalEntry,
			resolvedApprovalResult,
			options,
		);
		return;
	}

	if (approvalDecision.request.kind === 'auto_continue') {
		const resumed = await resumeApprovedAutoContinue(socket, pendingApprovalEntry, options);

		if (!resumed) {
			throw new Error(
				`Pending auto-continue context missing: ${pendingApprovalEntry.approval_request.approval_id}`,
			);
		}

		return;
	}

	if (
		approvedReplayToolResult !== undefined &&
		pendingApprovalEntry.auto_continue_context !== undefined
	) {
		const resumed = await resumeApprovedAutoContinue(socket, pendingApprovalEntry, options, {
			initial_tool_result: approvedReplayToolResult,
			initial_turn_count: pendingApprovalEntry.auto_continue_context.turn_count,
		});

		if (!resumed) {
			throw new Error(
				`Pending tool replay continuation context missing: ${pendingApprovalEntry.approval_request.approval_id}`,
			);
		}
	}
}
