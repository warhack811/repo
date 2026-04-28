import type { ApprovalRequest, RenderBlock, ToolCallInput, ToolResult } from '@runa/types';

import {
	type ApprovalStore,
	type PendingApprovalToolCall,
	approvalPersistenceScopeFromAuthContext,
} from '../persistence/approval-store.js';
import { ingestToolResult } from '../runtime/ingest-tool-result.js';
import { resolveApproval } from '../runtime/resolve-approval.js';
import { resumeApprovedToolCall } from '../runtime/resume-approved-tool-call.js';
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
import { resumeApprovedAutoContinue } from './run-execution.js';
import { getDefaultToolRegistryAsync, getPolicyWiring } from './runtime-dependencies.js';
import {
	type WebSocketConnection,
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

	if (approvalDecision.request.kind === 'auto_continue') {
		if (resolvedApprovalResult.status === 'approved') {
			const resumed = await resumeApprovedAutoContinue(socket, pendingApprovalEntry, options);

			if (!resumed) {
				throw new Error(
					`Pending auto-continue context missing: ${pendingApprovalEntry.approval_request.approval_id}`,
				);
			}
		} else {
			return;
		}
	}

	if (
		resolvedApprovalResult.status === 'approved' &&
		approvalDecision.request.kind !== 'auto_continue' &&
		approvedReplayToolResult !== undefined &&
		pendingApprovalEntry.auto_continue_context !== undefined &&
		pendingApprovalEntry.approval_request.tool_name?.startsWith('desktop.') === true
	) {
		const resumed = await resumeApprovedAutoContinue(socket, pendingApprovalEntry, options, {
			initial_tool_result: approvedReplayToolResult,
			initial_turn_count: pendingApprovalEntry.auto_continue_context.turn_count,
		});

		if (!resumed) {
			throw new Error(
				`Pending desktop continuation context missing: ${pendingApprovalEntry.approval_request.approval_id}`,
			);
		}
	}
}
