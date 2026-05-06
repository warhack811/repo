import type {
	AnyRuntimeEvent,
	ApprovalTarget,
	GatewayProvider,
	ModelMessage,
	ModelRequest,
	ModelResponse,
	ModelToolCallCandidate,
	ProviderCapabilities,
	RenderBlock,
	RuntimeEvent,
	RuntimeState,
	RuntimeTerminationCode,
	SupportedLocale,
	ToolDefinition,
	ToolErrorCode,
	ToolResult,
	ToolRuntimeEvent,
	TurnProgressEvent,
} from '@runa/types';
import { unwrapRedacted } from '@runa/types';

import type { WorkspaceLayer } from '../context/compose-workspace-context.js';
import { GatewayUnsupportedOperationError } from '../gateway/errors.js';
import { createModelGateway } from '../gateway/factory.js';
import { resolveModelRoute } from '../gateway/model-router.js';
import { createSearchMemoryTool } from '../memory/search-memory-tool.js';
import {
	type ApprovalStore,
	type PendingApprovalEntry,
	approvalPersistenceScopeFromAuthContext,
} from '../persistence/approval-store.js';
import {
	appendConversationMessage,
	appendConversationRunBlocks,
	conversationScopeFromAuthContext,
	ensureConversation,
	hasConversationStoreConfiguration,
} from '../persistence/conversation-store.js';
import { persistRuntimeEvents } from '../persistence/event-store.js';
import { defaultMemoryStore } from '../persistence/memory-store.js';
import { persistReasoningTrace } from '../persistence/reasoning-store.js';
import { persistRunState } from '../persistence/run-store.js';
import {
	type RequireApprovalPermissionDecision,
	normalizeApprovalMode,
} from '../policy/permission-engine.js';
import { requireUsageRateLimit } from '../policy/usage-quota.js';
import { adaptModelResponseToTurnOutcome } from '../runtime/adapt-model-response-to-turn-outcome.js';
import type { AgentLoopSnapshot } from '../runtime/agent-loop.js';
import { createAutoContinuePolicyGate } from '../runtime/auto-continue-policy.js';
import { bindAvailableTools } from '../runtime/bind-available-tools.js';
import {
	type ToolCallOutcome,
	continueAssistantResponseFastPath,
} from '../runtime/continue-model-turn.js';
import { ingestToolResult } from '../runtime/ingest-tool-result.js';
import { classifyNarration } from '../runtime/narration/classify.js';
import { buildNarrationEmissionEvents } from '../runtime/narration/emission.js';
import {
	createNarrationGuardrailRejectionLogFields,
	createNarrationRuntimeEventLogFields,
	createNarrationSuppressionLogFields,
} from '../runtime/narration/observability.js';
import { orchestrateMemoryWrite } from '../runtime/orchestrate-memory-write.js';
import { defaultProviderHealthStore } from '../runtime/provider-health.js';
import { requestApproval } from '../runtime/request-approval.js';
import { runAgentLoop } from '../runtime/run-agent-loop.js';
import type {
	RunModelTurnFailureResult,
	RunModelTurnInput,
	RunModelTurnResult,
} from '../runtime/run-model-turn.js';
import { runToolStep } from '../runtime/run-tool-step.js';
import {
	buildNarrationCompletedEvent,
	buildNarrationStartedEvent,
	buildNarrationTokenEvent,
	buildNarrationToolOutcomeLinkedEvent,
	buildRunFailedEvent,
	buildRunStartedEvent,
	buildStateEnteredEvent,
} from '../runtime/runtime-events.js';
import { runSequentialSubAgentDelegation } from '../runtime/sequential-sub-agent.js';
import { recordToolCallRepairTerminalFailure } from '../runtime/tool-call-repair-metrics.js';
import { isToolCallRepairableError } from '../runtime/tool-call-repair-recovery.js';
import type { RepairStrategy } from '../runtime/tool-call-repair-recovery.js';
import type {
	ScheduledToolCandidate,
	ToolEffectClass,
	ToolResourceKey,
} from '../runtime/tool-scheduler.js';
import {
	classifyToolEffectClass,
	classifyToolResourceKey,
	planToolExecutionBatches,
} from '../runtime/tool-scheduler.js';
import { createDesktopVerifyStateTool } from '../tools/desktop-verify-state.js';
import { createDesktopVisionAnalyzeTool } from '../tools/desktop-vision-analyze.js';
import { ToolRegistry } from '../tools/registry.js';
import { createLogger, startLogSpan } from '../utils/logger.js';
import {
	broadcastConversationRunAccepted,
	broadcastConversationRunFinished,
} from './conversation-collaboration.js';
import {
	type DesktopAgentBridgeRegistry,
	defaultDesktopAgentBridgeRegistry,
} from './desktop-agent-bridge.js';
import {
	buildLiveModelRequest,
	buildLiveWorkspaceLayer,
	canPersistLiveMemory,
	extractUserTurn,
	getLiveMemoryScopeId,
	getLiveUserPreferenceScopeId,
	getLiveWorkingDirectory,
	logLiveMemoryWriteFailure,
	resolveRunRequestLocale,
} from './live-request.js';
import type { RunRequestPayload } from './messages.js';
import type {
	MemoryOrchestrationStore,
	RunToolWebSocketResult,
	RuntimeWebSocketHandlerOptions,
} from './orchestration-types.js';
import type { WebSocketPolicyWiring } from './policy-wiring.js';
import {
	createAdditionalPresentationBlocks,
	createAutomaticApprovalPresentationInputs,
	createAutomaticTurnPresentationBlocks,
	createPresentationBlockList,
	getStoredInspectionContext,
	mergeInspectionEvents,
	mergeRenderBlocks,
	persistApprovalPresentationInputs,
	rememberInspectionContext,
} from './presentation.js';
import { getDefaultToolRegistryAsync, getPolicyWiring } from './runtime-dependencies.js';
import {
	type WebSocketConnection,
	createAcceptedMessage,
	createFinishedMessage,
	createNarrationCompletedMessage,
	createNarrationDeltaMessage,
	createPresentationBlocksMessage,
	createRuntimeEventMessage,
	createTextDeltaDiscardMessage,
	createTextDeltaMessage,
	sendServerMessage,
} from './transport.js';

const runExecutionLogger = createLogger({
	context: {
		component: 'ws.run_execution',
	},
});

function isRuntimeEventEnvelope(event: AnyRuntimeEvent): event is RuntimeEvent {
	return (
		event.event_type === 'model.completed' ||
		event.event_type === 'narration.completed' ||
		event.event_type === 'narration.started' ||
		event.event_type === 'narration.superseded' ||
		event.event_type === 'narration.token' ||
		event.event_type === 'narration.tool_outcome_linked' ||
		event.event_type === 'run.completed' ||
		event.event_type === 'run.failed' ||
		event.event_type === 'run.started' ||
		event.event_type === 'state.entered'
	);
}

type LoopRuntimeProgressEvent = Extract<
	RuntimeEvent,
	{ readonly event_type: 'model.completed' | 'run.completed' | 'run.failed' | 'state.entered' }
>;

function isRuntimeEvent(event: TurnProgressEvent): event is LoopRuntimeProgressEvent {
	return isRuntimeEventEnvelope(event);
}

function resolveRuntimeSessionId(
	payload: Pick<RunRequestPayload, 'conversation_id' | 'run_id'>,
	authContext?: RuntimeWebSocketHandlerOptions['auth_context'],
): string {
	const principal = authContext?.principal;
	const principalSessionId =
		principal !== undefined && 'session_id' in principal ? principal.session_id : undefined;

	return (
		authContext?.session?.session_id ??
		principalSessionId ??
		payload.conversation_id ??
		payload.run_id
	);
}

function inferRepairStrategiesTried(retryCount: number): readonly RepairStrategy[] {
	const productionStrategies: readonly RepairStrategy[] = [
		'strict_reinforce',
		'tool_subset',
		'force_no_tools',
	];

	return productionStrategies.slice(
		0,
		Math.max(1, Math.min(retryCount, productionStrategies.length)),
	);
}

function createLoopTurnStartedEvents(
	payload: RunRequestPayload,
	turnIndex: number,
	previousRuntimeState: RuntimeState,
): readonly RuntimeEvent[] {
	const baseSequence = (turnIndex - 1) * 10 + 1;

	if (turnIndex === 1) {
		return [
			buildRunStartedEvent(
				{
					entry_state: 'INIT',
					trigger: 'user_message',
				},
				{
					actor: {
						type: 'user',
					},
					run_id: payload.run_id,
					sequence_no: baseSequence,
					source: {
						kind: 'websocket',
					},
					trace_id: payload.trace_id,
				},
			),
			buildStateEnteredEvent(
				{
					previous_state: 'INIT',
					reason: 'run-request-accepted',
					state: 'MODEL_THINKING',
				},
				{
					actor: {
						type: 'user',
					},
					run_id: payload.run_id,
					sequence_no: baseSequence + 1,
					source: {
						kind: 'websocket',
					},
					state_after: 'MODEL_THINKING',
					state_before: 'INIT',
					trace_id: payload.trace_id,
				},
			),
		];
	}

	return [
		buildStateEnteredEvent(
			{
				previous_state: previousRuntimeState,
				reason: 'follow-up-turn-started',
				state: 'MODEL_THINKING',
			},
			{
				actor: {
					type: 'system',
				},
				run_id: payload.run_id,
				sequence_no: baseSequence,
				source: {
					kind: 'runtime',
				},
				state_after: 'MODEL_THINKING',
				state_before: previousRuntimeState,
				trace_id: payload.trace_id,
			},
		),
	];
}

function toLoopRunStatus(snapshot: AgentLoopSnapshot): RunToolWebSocketResult['status'] {
	if (
		snapshot.current_runtime_state === 'WAITING_APPROVAL' ||
		snapshot.approval_request !== undefined
	) {
		return 'approval_required';
	}

	if (snapshot.current_runtime_state === 'FAILED' || snapshot.current_loop_state === 'FAILED') {
		return 'failed';
	}

	return 'completed';
}

function toLoopFinalRuntimeState(snapshot: AgentLoopSnapshot): RuntimeState {
	if (snapshot.current_loop_state === 'FAILED') {
		return 'FAILED';
	}

	if (snapshot.current_loop_state === 'COMPLETED') {
		return 'COMPLETED';
	}

	if (snapshot.current_runtime_state !== undefined) {
		return snapshot.current_runtime_state;
	}

	return 'COMPLETED';
}

function isErrorToolResult(
	toolResult: ToolResult | undefined,
): toolResult is Extract<ToolResult, { readonly status: 'error' }> {
	return toolResult?.status === 'error';
}

function hasRuntimeEventType(
	events: readonly RuntimeEvent[],
	eventType: RuntimeEvent['event_type'],
): boolean {
	return events.some((event) => event.event_type === eventType);
}

function isDesktopToolName(
	toolName: string,
): toolName is Extract<ToolDefinition['name'], `desktop.${string}`> {
	return toolName.startsWith('desktop.');
}

function formatDesktopTargetLabel(input: {
	readonly agent_id: string;
	readonly machine_label?: string;
}): string {
	const machineLabel = input.machine_label?.trim();

	if (machineLabel && machineLabel.length > 0) {
		return machineLabel;
	}

	return `Cihaz ${input.agent_id.slice(0, 8)}`;
}

function resolveDesktopApprovalTarget(
	input: Readonly<{
		readonly auth_context?: RuntimeWebSocketHandlerOptions['auth_context'];
		readonly call_id: string;
		readonly desktopAgentBridgeRegistry?: DesktopAgentBridgeRegistry;
		readonly target_connection_id?: string;
		readonly tool_name: ToolDefinition['name'];
	}>,
): ApprovalTarget | undefined {
	if (
		!isDesktopToolName(input.tool_name) ||
		typeof input.target_connection_id !== 'string' ||
		input.target_connection_id.trim().length === 0 ||
		input.auth_context?.principal.kind !== 'authenticated'
	) {
		return undefined;
	}

	const bridgeRegistry = input.desktopAgentBridgeRegistry ?? defaultDesktopAgentBridgeRegistry;
	const matchingSnapshot = bridgeRegistry
		.listPresenceSnapshotsForUserId(input.auth_context.principal.user_id)
		.find((snapshot) => snapshot.connection_id === input.target_connection_id);

	if (!matchingSnapshot) {
		return undefined;
	}

	return {
		call_id: input.call_id,
		kind: 'tool_call',
		label: formatDesktopTargetLabel(matchingSnapshot),
		tool_name: input.tool_name,
	};
}

function withPendingDesktopTargetConnectionId(
	pendingToolCall: RunToolWebSocketResult['pending_tool_call'],
	payload: Pick<RunRequestPayload, 'desktop_target_connection_id'>,
): RunToolWebSocketResult['pending_tool_call'] {
	const desktopTargetConnectionId = payload.desktop_target_connection_id?.trim();

	if (!pendingToolCall || !desktopTargetConnectionId) {
		return pendingToolCall;
	}

	return {
		...pendingToolCall,
		desktop_target_connection_id: desktopTargetConnectionId,
	};
}

function getNextRuntimeSequenceNo(events: readonly RuntimeEvent[]): number {
	const lastEvent = events[events.length - 1];

	return (lastEvent?.sequence_no ?? 0) + 1;
}

function sendNarrationServerMessageForRuntimeEvent(
	socket: WebSocketConnection,
	payload: Pick<RunRequestPayload, 'run_id' | 'trace_id'>,
	event: RuntimeEvent,
): void {
	if (event.event_type === 'narration.token') {
		sendServerMessage(socket, createNarrationDeltaMessage(payload, event));
		return;
	}

	if (event.event_type === 'narration.completed') {
		sendServerMessage(socket, createNarrationCompletedMessage(payload, event));
	}
}

function formatStopReasonMessage(stopReason: AgentLoopSnapshot['stop_reason']): string | undefined {
	if (stopReason === undefined) {
		return undefined;
	}

	switch (stopReason.kind) {
		case 'repeated_tool_call':
			return `Run terminated: tool '${stopReason.tool_name ?? 'unknown'}' was called ${stopReason.consecutive_count} times with identical arguments.`;
		case 'max_turns_reached':
			return `Run terminated: reached max_turns limit (${stopReason.max_turns}).`;
		case 'token_budget_reached':
			return `Run terminated: ${stopReason.limit_kind} budget reached (${stopReason.observed_usage}/${stopReason.configured_limit}).`;
		case 'stagnation':
			return `Run terminated: only ${stopReason.unique_tool_signatures} unique tool calls in last ${stopReason.window_size} turns.`;
		case 'tool_failure':
			return `Run terminated: tool '${stopReason.tool_name ?? 'unknown'}' failed (${stopReason.error_code ?? 'UNKNOWN'}).`;
		case 'failed':
			return stopReason.error_message ?? 'Run terminated: failed.';
		case 'cancelled':
			return `Run terminated: cancelled${stopReason.actor ? ` by ${stopReason.actor}` : ''}.`;
		case 'completed':
			return 'Run terminated: completed.';
		case 'model_stop':
			return `Run terminated: model stopped with finish_reason '${stopReason.finish_reason}'.`;
		default:
			return 'Run terminated: unknown stop reason.';
	}
}

export function resolveRuntimeTerminationCode(
	stopReason: AgentLoopSnapshot['stop_reason'],
): RuntimeTerminationCode | undefined {
	if (stopReason === undefined) {
		return undefined;
	}

	switch (stopReason.kind) {
		case 'cancelled':
		case 'completed':
		case 'model_stop':
			return undefined;
		case 'failed':
			return 'FAILED';
		case 'max_turns_reached':
			return 'MAX_TURNS_REACHED';
		case 'repeated_tool_call':
			return 'REPEATED_TOOL_CALL';
		case 'stagnation':
			return 'STAGNATION';
		case 'token_budget_reached':
			return 'TOKEN_BUDGET_REACHED';
		case 'tool_failure':
			return 'TOOL_FAILURE';
		default:
			return undefined;
	}
}

export function buildTerminalFailureMessage(snapshot: AgentLoopSnapshot): string {
	if (snapshot.failure?.error_message) {
		return snapshot.failure.error_message;
	}

	const stopReasonMessage = formatStopReasonMessage(snapshot.stop_reason);

	if (stopReasonMessage !== undefined) {
		return stopReasonMessage;
	}

	if (isErrorToolResult(snapshot.tool_result)) {
		return `Tool ${snapshot.tool_result.tool_name} failed${snapshot.tool_result.error_code ? ` (${snapshot.tool_result.error_code})` : ''}.`;
	}

	return 'The run stopped with a terminal failure state.';
}

function appendTerminalRuntimeEventsIfNeeded(
	appendAndSendRuntimeEvent: (event: RuntimeEvent) => void,
	payload: RunRequestPayload,
	runtimeEvents: readonly RuntimeEvent[],
	snapshot: AgentLoopSnapshot,
): void {
	if (
		snapshot.current_loop_state !== 'FAILED' ||
		hasRuntimeEventType(runtimeEvents, 'run.failed')
	) {
		return;
	}

	const previousState = snapshot.current_runtime_state ?? 'MODEL_THINKING';

	appendAndSendRuntimeEvent(
		buildRunFailedEvent(
			{
				error_code:
					snapshot.failure?.error_code ??
					resolveRuntimeTerminationCode(snapshot.stop_reason) ??
					(isErrorToolResult(snapshot.tool_result)
						? snapshot.tool_result.error_code
						: 'RUN_TERMINATED'),
				error_message: buildTerminalFailureMessage(snapshot),
				final_state: 'FAILED',
				retryable:
					snapshot.failure?.retryable ??
					(isErrorToolResult(snapshot.tool_result) ? snapshot.tool_result.retryable : false) ??
					false,
			},
			{
				actor: {
					type: 'system',
				},
				run_id: payload.run_id,
				sequence_no: getNextRuntimeSequenceNo(runtimeEvents),
				source: {
					kind: 'runtime',
				},
				state_after: 'FAILED',
				state_before: previousState,
				trace_id: payload.trace_id,
			},
		),
	);
}

function cloneToolDefinitionWithApprovalRequired(toolDefinition: ToolDefinition): ToolDefinition {
	return {
		...toolDefinition,
		metadata: {
			...toolDefinition.metadata,
			requires_approval: true,
		},
	};
}

function resolveToolDefinitionForApprovalRequest(
	toolDefinition: ToolDefinition,
	decision: RequireApprovalPermissionDecision,
): ToolDefinition {
	if (
		decision.approval_requirement.source === 'capability' &&
		toolDefinition.metadata.requires_approval
	) {
		return toolDefinition;
	}

	return cloneToolDefinitionWithApprovalRequired(toolDefinition);
}

interface FinalizeLiveRunResultOptions {
	readonly conversation_id?: string;
	readonly persist_live_memory_write: boolean;
	readonly retained_presentation_blocks?: readonly RenderBlock[];
	readonly working_directory: string;
}

interface ExecuteLiveRunOptions {
	readonly approvalStore: ApprovalStore;
	readonly auth_context?: RuntimeWebSocketHandlerOptions['auth_context'];
	readonly create_storage_download_url?: RuntimeWebSocketHandlerOptions['create_storage_download_url'];
	readonly desktopAgentBridgeRegistry?: DesktopAgentBridgeRegistry;
	readonly initial_runtime_state?: RuntimeState;
	readonly initial_tool_result?: ToolResult;
	readonly initial_tool_results?: readonly ToolResult[];
	readonly initial_turn_count?: number;
	readonly memoryStore?: MemoryOrchestrationStore;
	readonly policy_wiring?: WebSocketPolicyWiring;
	readonly registry: ToolRegistry;
	readonly storage_service?: RuntimeWebSocketHandlerOptions['storage_service'];
	readonly workingDirectory: string;
	readonly workspace_layer?: WorkspaceLayer;
}

function createRuntimeToolRegistry(
	baseRegistry: ToolRegistry,
	options: Readonly<{
		readonly enableDesktopVisionTools: boolean;
		readonly memoryStore?: MemoryOrchestrationStore;
		readonly modelGateway: Pick<ReturnType<typeof createModelGateway>, 'generate'>;
		readonly resolveToolResult: (callId: string) => ToolResult | undefined;
	}>,
): ToolRegistry {
	const runtimeRegistry = new ToolRegistry();
	runtimeRegistry.registerMany(
		baseRegistry
			.list()
			.map((entry) => entry.tool)
			.filter(
				(tool) => tool.name !== 'desktop.vision_analyze' && tool.name !== 'desktop.verify_state',
			),
	);

	if (canPersistLiveMemory(options.memoryStore) && !runtimeRegistry.has('search.memory')) {
		runtimeRegistry.register(
			createSearchMemoryTool({
				memory_store: options.memoryStore ?? defaultMemoryStore,
			}),
		);
	}

	if (options.enableDesktopVisionTools) {
		runtimeRegistry.register(
			createDesktopVisionAnalyzeTool({
				model_gateway: options.modelGateway,
				resolve_tool_result: options.resolveToolResult,
			}),
		);
		runtimeRegistry.register(
			createDesktopVerifyStateTool({
				model_gateway: options.modelGateway,
				resolve_tool_result: options.resolveToolResult,
			}),
		);
	}

	return runtimeRegistry;
}

export function supportsDesktopVisionProvider(provider: GatewayProvider): boolean {
	return provider !== 'deepseek' && provider !== 'sambanova';
}

function createRunModelTurnFailureResult(
	input: Readonly<{
		readonly current_state: RuntimeState;
		readonly error_message: string;
		readonly model_response?: ModelResponse;
		readonly model_turn_outcome?: Exclude<
			RunModelTurnResult['model_turn_outcome'],
			undefined | { readonly kind: 'assistant_response' }
		>;
		readonly resolved_model_request?: ModelRequest;
		readonly tool_result?: ToolResult;
		readonly tool_results?: readonly ToolResult[];
	}>,
): RunModelTurnFailureResult {
	const failureToolOutcome =
		input.model_turn_outcome?.kind === 'tool_calls'
			? input.model_turn_outcome.tool_calls[0]
			: input.model_turn_outcome;

	return {
		continuation_result: {
			call_id: failureToolOutcome?.call_id,
			events: [],
			failure: {
				code: 'TOOL_DISPATCH_FAILED',
				message: input.error_message,
			},
			final_state: 'FAILED',
			outcome_kind: input.model_turn_outcome?.kind ?? 'tool_call',
			state_transitions: [
				{
					from: input.current_state,
					to: 'FAILED',
				},
			],
			status: 'failed',
			tool_name: failureToolOutcome?.tool_name,
		},
		failure: {
			code: 'TURN_CONTINUATION_FAILED',
			message: input.error_message,
		},
		final_state: 'FAILED',
		model_response: input.model_response,
		model_turn_outcome: input.model_turn_outcome,
		resolved_model_request: input.resolved_model_request,
		status: 'failed',
		tool_result: input.tool_result,
		tool_results: input.tool_results,
	};
}

type OrderedToolCallCandidate = NonNullable<ModelResponse['tool_call_candidate']>;
type ToolPermissionDecision = Awaited<
	ReturnType<WebSocketPolicyWiring['evaluateToolPermission']>
>['decision'];

interface PreparedToolExecutionCandidate extends ScheduledToolCandidate<OrderedToolCallCandidate> {
	readonly permission_decision: ToolPermissionDecision;
	readonly tool_definition: ToolDefinition;
}

interface PreparedToolExecutionPlan {
	readonly blocked_failure?:
		| {
				readonly candidate: OrderedToolCallCandidate;
				readonly error_message: string;
		  }
		| undefined;
	readonly prepared_candidates: readonly PreparedToolExecutionCandidate[];
}

interface ExecutedToolCandidateResult {
	readonly candidate: OrderedToolCallCandidate;
	readonly events: readonly ToolRuntimeEvent[];
	readonly tool_result: ToolResult;
}

function getOrderedToolCallCandidates(
	modelResponse: ModelResponse,
): readonly OrderedToolCallCandidate[] {
	if (
		modelResponse.tool_call_candidates !== undefined &&
		modelResponse.tool_call_candidates.length > 0
	) {
		return modelResponse.tool_call_candidates;
	}

	return modelResponse.tool_call_candidate === undefined ? [] : [modelResponse.tool_call_candidate];
}

function toToolCallOutcome(candidate: OrderedToolCallCandidate): ToolCallOutcome {
	return {
		call_id: candidate.call_id,
		kind: 'tool_call',
		tool_input: candidate.tool_input,
		tool_name: candidate.tool_name,
	};
}

interface BufferedStreamingTextDelta {
	readonly content_part_index?: number;
	readonly resolved_content_part_index: number;
	readonly text_delta: string;
}

function getStreamingTurnIntent(modelResponse: ModelResponse): 'continuing' | 'done' {
	return getOrderedToolCallCandidates(modelResponse).length > 0 ? 'continuing' : 'done';
}

function shouldUseStreamingForModelRequest(
	modelRequest: ModelRequest,
	requestedProvider: RunRequestPayload['provider'] | undefined,
	capabilities: ProviderCapabilities | undefined,
): boolean {
	if (requestedProvider === undefined) {
		return true;
	}

	const route = resolveModelRoute({
		request: modelRequest,
		requested_provider: requestedProvider,
	});

	if (route.streaming_eligible) {
		return true;
	}

	return (
		capabilities?.streaming_supported === true &&
		capabilities.narration_strategy === 'temporal_stream'
	);
}

function emitBufferedTextDeltas(
	socket: WebSocketConnection,
	payload: Pick<RunRequestPayload, 'run_id' | 'trace_id'>,
	deltas: readonly BufferedStreamingTextDelta[],
): void {
	for (const delta of deltas) {
		sendServerMessage(
			socket,
			createTextDeltaMessage(payload, delta.text_delta, delta.content_part_index),
		);
	}
}

function emitNarrationFromBufferedText(
	socket: WebSocketConnection,
	payload: Pick<RunRequestPayload, 'run_id' | 'trace_id'>,
	input: Readonly<{
		buffered_text_deltas: readonly BufferedStreamingTextDelta[];
		capabilities: ProviderCapabilities;
		get_next_sequence_no: () => number;
		locale: 'en' | 'tr';
		model_response: ModelResponse;
		on_runtime_event?: (event: RuntimeEvent) => void;
		run_id: string;
		trace_id: string;
		turn_index: number;
	}>,
): void {
	const orderedContent = input.model_response.message.ordered_content ?? [];
	const classifierOutput = classifyNarration({
		narration_strategy: input.capabilities.narration_strategy,
		ordered_content: orderedContent,
		ordering_origin: orderedContent[0]?.ordering_origin ?? 'synthetic_non_streaming',
		turn_intent: getStreamingTurnIntent(input.model_response),
	});

	if (classifierOutput.emission_decision !== 'emit') {
		emitBufferedTextDeltas(socket, payload, input.buffered_text_deltas);
		return;
	}

	const narrationPartIndexes = new Set<number>();

	for (const candidate of classifierOutput.narrations) {
		const contentPartIndex = candidate.content_part_index ?? candidate.sequence_no - 1;
		narrationPartIndexes.add(contentPartIndex);

		const deltas = input.buffered_text_deltas.filter(
			(delta) => delta.resolved_content_part_index === contentPartIndex,
		);
		const tokenDeltas =
			deltas.length > 0
				? deltas
				: [
						{
							content_part_index: contentPartIndex,
							resolved_content_part_index: contentPartIndex,
							text_delta: candidate.text,
						},
					];
		const narrationId = `${input.run_id}:turn:${input.turn_index}:narration:${candidate.sequence_no}`;
		const startedSequenceNo = input.get_next_sequence_no();
		const startedEvent = buildNarrationStartedEvent(
			{
				linked_tool_call_id: candidate.linked_tool_call_id,
				locale: input.locale,
				narration_id: narrationId,
				sequence_no: startedSequenceNo,
				turn_index: input.turn_index,
			},
			{
				run_id: input.run_id,
				sequence_no: startedSequenceNo,
				trace_id: input.trace_id,
			},
		);
		input.on_runtime_event?.(startedEvent);

		for (const delta of tokenDeltas) {
			const tokenSequenceNo = input.get_next_sequence_no();
			const tokenEvent = buildNarrationTokenEvent(
				{
					linked_tool_call_id: candidate.linked_tool_call_id,
					locale: input.locale,
					narration_id: narrationId,
					sequence_no: tokenSequenceNo,
					text_delta: delta.text_delta,
					turn_index: input.turn_index,
				},
				{
					run_id: input.run_id,
					sequence_no: tokenSequenceNo,
					trace_id: input.trace_id,
				},
			);
			input.on_runtime_event?.(tokenEvent);
			sendServerMessage(socket, createNarrationDeltaMessage(payload, tokenEvent));
		}

		const completedSequenceNo = input.get_next_sequence_no();
		const completedEvent = buildNarrationCompletedEvent(
			{
				full_text: tokenDeltas.map((delta) => delta.text_delta).join(''),
				linked_tool_call_id: candidate.linked_tool_call_id,
				locale: input.locale,
				narration_id: narrationId,
				sequence_no: completedSequenceNo,
				turn_index: input.turn_index,
			},
			{
				run_id: input.run_id,
				sequence_no: completedSequenceNo,
				trace_id: input.trace_id,
			},
		);
		input.on_runtime_event?.(completedEvent);
		sendServerMessage(socket, createNarrationCompletedMessage(payload, completedEvent));
	}

	emitBufferedTextDeltas(
		socket,
		payload,
		input.buffered_text_deltas.filter(
			(delta) => !narrationPartIndexes.has(delta.resolved_content_part_index),
		),
	);
}

function mapRunToolFailureCodeToToolErrorCode(
	failureCode:
		| 'APPROVAL_REQUEST_FAILED'
		| 'INVALID_CURRENT_STATE'
		| 'PERSISTENCE_FAILED'
		| 'TOOL_EXECUTION_FAILED'
		| 'TOOL_INPUT_MISMATCH'
		| 'TOOL_NOT_FOUND',
): ToolErrorCode {
	switch (failureCode) {
		case 'TOOL_INPUT_MISMATCH':
			return 'INVALID_INPUT';
		case 'TOOL_NOT_FOUND':
			return 'NOT_FOUND';
		default:
			return 'EXECUTION_FAILED';
	}
}

function createSyntheticToolErrorResult(
	candidate: OrderedToolCallCandidate,
	errorCode: ToolErrorCode,
	errorMessage: string,
	retryable = false,
): Extract<ToolResult, { readonly status: 'error' }> {
	return {
		call_id: candidate.call_id,
		error_code: errorCode,
		error_message: errorMessage,
		retryable,
		status: 'error',
		tool_name: candidate.tool_name,
	};
}

async function prepareToolExecutionPlan(
	socket: WebSocketConnection,
	candidates: readonly OrderedToolCallCandidate[],
	registry: ToolRegistry,
	policyWiring: WebSocketPolicyWiring,
): Promise<PreparedToolExecutionPlan> {
	const preparedCandidates: PreparedToolExecutionCandidate[] = [];

	for (const candidate of candidates) {
		const toolDefinition = registry.get(candidate.tool_name);

		if (!toolDefinition) {
			return {
				blocked_failure: {
					candidate,
					error_message: `Tool not found in registry: ${candidate.tool_name}`,
				},
				prepared_candidates: preparedCandidates,
			};
		}

		const permissionEvaluation = await policyWiring.evaluateToolPermission(socket, {
			call_id: candidate.call_id,
			tool_definition: toolDefinition,
		});
		const preparedCandidate: PreparedToolExecutionCandidate = {
			candidate,
			effect_class: classifyToolEffectClass(toolDefinition),
			permission_decision: permissionEvaluation.decision,
			requires_approval: permissionEvaluation.decision.decision === 'require_approval',
			resource_key: classifyToolResourceKey(toolDefinition),
			tool_definition: toolDefinition,
		};

		if (permissionEvaluation.decision.decision === 'deny') {
			return {
				blocked_failure: {
					candidate,
					error_message: `Permission denied for ${candidate.tool_name}.`,
				},
				prepared_candidates: preparedCandidates,
			};
		}

		if (permissionEvaluation.decision.decision === 'pause') {
			return {
				blocked_failure: {
					candidate,
					error_message:
						'Session is paused after consecutive permission denials; approval is required before continuing.',
				},
				prepared_candidates: preparedCandidates,
			};
		}

		preparedCandidates.push(preparedCandidate);

		if (preparedCandidate.requires_approval) {
			break;
		}
	}

	return {
		prepared_candidates: preparedCandidates,
	};
}

async function executePreparedToolCandidate(
	turnLogger: ReturnType<typeof createLogger>,
	socket: WebSocketConnection,
	input: RunModelTurnInput,
	policyWiring: WebSocketPolicyWiring,
	preparedCandidate: PreparedToolExecutionCandidate,
	sequenceStart: number,
): Promise<ExecutedToolCandidateResult> {
	await policyWiring.recordOutcome(socket, {
		decision: preparedCandidate.permission_decision,
		outcome: 'allowed',
	});

	const toolSpan = startLogSpan(turnLogger, 'tool.execute', {
		call_id: preparedCandidate.candidate.call_id,
		tool_name: preparedCandidate.candidate.tool_name,
	});

	const toolStepResult = await runToolStep({
		bypass_approval_gate: true,
		current_state: input.current_state,
		event_context: {
			sequence_start: sequenceStart,
		},
		execution_context: input.execution_context,
		registry: input.registry,
		run_id: input.run_id,
		tool_input: {
			arguments: preparedCandidate.candidate.tool_input,
			call_id: preparedCandidate.candidate.call_id,
			tool_name: preparedCandidate.candidate.tool_name,
		},
		tool_name: preparedCandidate.candidate.tool_name,
		trace_id: input.trace_id,
	});

	if (toolStepResult.status === 'completed') {
		toolSpan.end({
			call_id: toolStepResult.tool_result.call_id,
			tool_result_status: toolStepResult.tool_result.status,
			tool_name: toolStepResult.tool_name,
		});

		return {
			candidate: preparedCandidate.candidate,
			events: toolStepResult.events,
			tool_result: toolStepResult.tool_result,
		};
	}

	if (toolStepResult.status === 'failed') {
		toolSpan.fail(new Error(toolStepResult.failure.message), {
			tool_name: preparedCandidate.candidate.tool_name,
		});

		return {
			candidate: preparedCandidate.candidate,
			events: toolStepResult.events,
			tool_result: createSyntheticToolErrorResult(
				preparedCandidate.candidate,
				mapRunToolFailureCodeToToolErrorCode(toolStepResult.failure.code),
				toolStepResult.failure.message,
			),
		};
	}

	toolSpan.fail(new Error('Policy allow path unexpectedly requested approval again.'), {
		tool_name: preparedCandidate.candidate.tool_name,
	});

	return {
		candidate: preparedCandidate.candidate,
		events: toolStepResult.events,
		tool_result: createSyntheticToolErrorResult(
			preparedCandidate.candidate,
			'EXECUTION_FAILED',
			'Policy allow path unexpectedly requested approval again.',
		),
	};
}

const ORDERED_TOOL_RESULTS_HEADER = 'Ordered tool results (full content in run context):';
const ORDERED_TOOL_RESULTS_BLOCK_PATTERN =
	/\n\nOrdered tool results(?: \(full content in run context\))?:\n[\s\S]*$/u;

function getToolResultMetric(toolResult: ToolResult): string | undefined {
	if (toolResult.status === 'error') {
		return undefined;
	}

	const output = toolResult.output;

	if (output === null || typeof output !== 'object') {
		return undefined;
	}

	if ('size_bytes' in output && typeof output.size_bytes === 'number') {
		return `${output.size_bytes} bytes`;
	}

	if ('exit_code' in output && typeof output.exit_code === 'number') {
		return `exit ${output.exit_code}`;
	}

	return undefined;
}

export function createOrderedToolResultContinuationText(
	originalUserTurn: string,
	toolResults: readonly ToolResult[],
): string {
	const renderedResults = toolResults.map((toolResult, index) => {
		if (toolResult.status === 'success') {
			const metric = getToolResultMetric(toolResult);

			return `[${index + 1}] ${toolResult.tool_name}#${toolResult.call_id} (succeeded${metric ? `, ${metric}` : ''})`;
		}

		return `[${index + 1}] ${toolResult.tool_name}#${toolResult.call_id} (failed: ${toolResult.error_code})`;
	});

	const cleanedUserTurn = originalUserTurn.replace(ORDERED_TOOL_RESULTS_BLOCK_PATTERN, '');

	return `${cleanedUserTurn}\n\n${ORDERED_TOOL_RESULTS_HEADER}\n${renderedResults.join('\n')}`;
}

export function replaceFinalUserMessage(
	messages: readonly ModelMessage[],
	toolResults: readonly ToolResult[],
): readonly ModelMessage[] {
	if (toolResults.length <= 1) {
		return messages;
	}

	const lastMessage = messages[messages.length - 1];

	if (lastMessage?.role !== 'user') {
		return [
			...messages,
			{
				content: createOrderedToolResultContinuationText('', toolResults),
				role: 'user',
			},
		];
	}

	return [
		...messages.slice(0, -1),
		{
			...lastMessage,
			content: createOrderedToolResultContinuationText(lastMessage.content, toolResults),
		},
	];
}

export async function generateModelResponseWithStreaming(
	socket: WebSocketConnection,
	payload: Pick<RunRequestPayload, 'run_id' | 'trace_id'>,
	modelGateway: Pick<ReturnType<typeof createModelGateway>, 'generate' | 'stream'>,
	modelRequest: ModelRequest,
	requestedProvider?: RunRequestPayload['provider'],
	options?: {
		capabilities?: ProviderCapabilities;
		getNextSequenceNo?: () => number;
		locale?: 'en' | 'tr';
		onRuntimeEvent?: (event: RuntimeEvent) => void;
		runId: string;
		traceId: string;
		turnIndex: number;
	},
): Promise<ModelResponse> {
	let streamedResponse: ModelResponse | undefined;
	let streamedTextLength = 0;
	const bufferedTextDeltas: BufferedStreamingTextDelta[] = [];

	const narrationStrategyKind = options?.capabilities?.narration_strategy ?? 'unsupported';
	const enableNarration = narrationStrategyKind !== 'unsupported';

	const getSequenceNo = options?.getNextSequenceNo ?? (() => 1);

	if (!shouldUseStreamingForModelRequest(modelRequest, requestedProvider, options?.capabilities)) {
		return modelGateway.generate(modelRequest);
	}

	try {
		for await (const chunk of modelGateway.stream(modelRequest)) {
			if (chunk.type === 'text.delta') {
				if (chunk.text_delta.length === 0) {
					continue;
				}

				streamedTextLength += chunk.text_delta.length;

				if (!enableNarration || options?.capabilities === undefined) {
					sendServerMessage(
						socket,
						createTextDeltaMessage(payload, chunk.text_delta, chunk.content_part_index),
					);
					continue;
				}

				bufferedTextDeltas.push({
					content_part_index: chunk.content_part_index,
					resolved_content_part_index: chunk.content_part_index ?? 0,
					text_delta: chunk.text_delta,
				});
				continue;
			}

			if (chunk.type === 'response.completed') {
				streamedResponse = chunk.response;

				if (enableNarration && options?.capabilities !== undefined) {
					emitNarrationFromBufferedText(socket, payload, {
						buffered_text_deltas: bufferedTextDeltas,
						capabilities: options.capabilities,
						get_next_sequence_no: getSequenceNo,
						locale: options.locale ?? 'tr',
						model_response: streamedResponse,
						on_runtime_event: options.onRuntimeEvent,
						run_id: options.runId ?? payload.run_id,
						trace_id: options.traceId ?? payload.trace_id,
						turn_index: options.turnIndex ?? 1,
					});
				}

				return streamedResponse;
			}
		}
	} catch (error: unknown) {
		if (error instanceof GatewayUnsupportedOperationError) {
			return modelGateway.generate(modelRequest);
		}

		if (isToolCallRepairableError(error)) {
			if (streamedTextLength > 0) {
				sendServerMessage(socket, createTextDeltaDiscardMessage(payload));
			}

			return modelGateway.generate(modelRequest);
		}

		throw error;
	}

	return modelGateway.generate(modelRequest);
}

async function persistInternalReasoningIfPresent(
	input: RunModelTurnInput,
	modelResponse: ModelResponse,
): Promise<void> {
	const internalReasoning = modelResponse.message.internal_reasoning;

	if (internalReasoning === undefined) {
		return;
	}

	const reasoningContent = unwrapRedacted(internalReasoning);

	if (reasoningContent.trim().length === 0) {
		return;
	}

	await persistReasoningTrace({
		model: modelResponse.model,
		provider: modelResponse.provider,
		reasoning_content: reasoningContent,
		run_id: input.run_id,
		trace_id: input.trace_id,
		turn_index: input.turn_index ?? 1,
	});
}

function resolveRunModelRequest(input: RunModelTurnInput):
	| {
			readonly model_request: ModelRequest;
			readonly status: 'completed';
	  }
	| {
			readonly error_message: string;
			readonly status: 'failed';
	  } {
	if (input.model_request.available_tools !== undefined) {
		return {
			model_request: input.model_request,
			status: 'completed',
		};
	}

	const bindingResult = bindAvailableTools({
		registry: input.registry,
		tool_names: input.tool_names,
	});

	if (bindingResult.status === 'failed') {
		return {
			error_message: bindingResult.failure.message,
			status: 'failed',
		};
	}

	if (bindingResult.available_tools.length === 0) {
		return {
			model_request: input.model_request,
			status: 'completed',
		};
	}

	return {
		model_request: {
			...input.model_request,
			available_tools: bindingResult.available_tools,
		},
		status: 'completed',
	};
}

async function runPolicyAwareModelTurn(
	socket: WebSocketConnection,
	input: RunModelTurnInput,
	policyWiring: WebSocketPolicyWiring,
	options: Readonly<{
		readonly auth_context?: RuntimeWebSocketHandlerOptions['auth_context'];
		readonly desktopAgentBridgeRegistry?: DesktopAgentBridgeRegistry;
		readonly desktop_target_connection_id?: string;
		readonly get_next_runtime_sequence_no?: () => number;
		readonly locale?: SupportedLocale;
		readonly on_runtime_event?: (event: RuntimeEvent) => void;
		readonly requested_provider?: RunRequestPayload['provider'];
		readonly session_id?: string;
	}> = {},
): Promise<RunModelTurnResult> {
	const turnLogger = runExecutionLogger.child({
		model: input.model_request.model,
		run_id: input.run_id,
		trace_id: input.trace_id,
	});

	if (input.current_state !== 'MODEL_THINKING') {
		return createRunModelTurnFailureResult({
			current_state: input.current_state,
			error_message: `runModelTurn expects MODEL_THINKING but received ${input.current_state}`,
			resolved_model_request: input.model_request,
		});
	}

	const modelRequestResult = resolveRunModelRequest(input);

	if (modelRequestResult.status === 'failed') {
		return createRunModelTurnFailureResult({
			current_state: input.current_state,
			error_message: modelRequestResult.error_message,
			resolved_model_request: input.model_request,
		});
	}

	const resolvedModelRequest = modelRequestResult.model_request;
	let finalResolvedModelRequest = resolvedModelRequest;
	let modelResponse: ModelResponse;

	const gatewaySpan = startLogSpan(turnLogger, 'gateway.generate', {
		model: resolvedModelRequest.model,
	});

	try {
		modelResponse = await generateModelResponseWithStreaming(
			socket,
			{
				run_id: input.run_id,
				trace_id: input.trace_id,
			},
			input.model_gateway,
			resolvedModelRequest,
			options.requested_provider,
			{
				capabilities: input.model_gateway.capabilities,
				getNextSequenceNo: options.get_next_runtime_sequence_no,
				locale: options.locale ?? 'tr',
				onRuntimeEvent: options.on_runtime_event,
				runId: input.run_id,
				traceId: input.trace_id,
				turnIndex: input.turn_index ?? 1,
			},
		);
		gatewaySpan.end({
			finish_reason: modelResponse.finish_reason,
			response_model: modelResponse.model,
		});
	} catch (error: unknown) {
		if (input.tool_call_repair_recovery !== undefined && isToolCallRepairableError(error)) {
			const recoveryResult = await input.tool_call_repair_recovery.recover({
				error,
				model_request: resolvedModelRequest,
				retry_executor(request) {
					return generateModelResponseWithStreaming(
						socket,
						{
							run_id: input.run_id,
							trace_id: input.trace_id,
						},
						input.model_gateway,
						request,
						options.requested_provider,
						{
							capabilities: input.model_gateway.capabilities,
							getNextSequenceNo: options.get_next_runtime_sequence_no,
							locale: options.locale ?? 'tr',
							onRuntimeEvent: options.on_runtime_event,
							runId: input.run_id,
							traceId: input.trace_id,
							turnIndex: input.turn_index ?? 1,
						},
					);
				},
			});

			if (recoveryResult.status === 'recovered') {
				modelResponse = recoveryResult.model_response;
				finalResolvedModelRequest = recoveryResult.model_request;
				gatewaySpan.end({
					finish_reason: modelResponse.finish_reason,
					recovery: 'tool_call_repair',
					response_model: modelResponse.model,
				});
			} else {
				if (
					recoveryResult.status === 'unrecoverable' &&
					options.requested_provider !== undefined &&
					options.session_id !== undefined &&
					(recoveryResult.reason === 'retry_budget_exhausted' ||
						recoveryResult.reason === 'retry_still_unparseable')
				) {
					const terminalRoute = resolveModelRoute({
						request: resolvedModelRequest,
						requested_provider: options.requested_provider,
					});
					recordToolCallRepairTerminalFailure({
						intent: terminalRoute.intent,
						provider: options.requested_provider,
						strategies_tried: inferRepairStrategiesTried(recoveryResult.retry_count),
					});
					defaultProviderHealthStore.recordFailure({
						provider: options.requested_provider,
						reason:
							recoveryResult.reason === 'retry_still_unparseable'
								? 'retry_still_unparseable'
								: 'unparseable_tool_input',
						session_id: options.session_id,
					});
				}

				gatewaySpan.fail(
					recoveryResult.status === 'unrecoverable' ? (recoveryResult.cause ?? error) : error,
					{
						model: resolvedModelRequest.model,
						recovery: 'tool_call_repair',
						recovery_status: recoveryResult.status,
					},
				);
				const recoveryMessage =
					recoveryResult.status === 'unrecoverable'
						? ` after tool call repair recovery: ${recoveryResult.reason}`
						: '';
				const errorMessage =
					error instanceof Error ? error.message : 'Unknown model generate failure.';

				return {
					failure: {
						code: 'MODEL_GENERATE_FAILED',
						message: `Model generate failed${recoveryMessage}: ${errorMessage}`,
					},
					final_state: 'FAILED',
					resolved_model_request: resolvedModelRequest,
					status: 'failed',
				};
			}
		} else {
			gatewaySpan.fail(error, {
				model: resolvedModelRequest.model,
			});
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown model generate failure.';

			return {
				failure: {
					code: 'MODEL_GENERATE_FAILED',
					message: `Model generate failed: ${errorMessage}`,
				},
				final_state: 'FAILED',
				resolved_model_request: resolvedModelRequest,
				status: 'failed',
			};
		}
	}

	await persistInternalReasoningIfPresent(input, modelResponse);

	const orderedToolCallCandidates = getOrderedToolCallCandidates(modelResponse);
	const narrationEmission = buildNarrationEmissionEvents({
		base_runtime_sequence_no: options.get_next_runtime_sequence_no?.() ?? 1,
		capabilities: input.model_gateway.capabilities,
		model_response: modelResponse,
		recent_tool_results: [],
		run_id: input.run_id,
		trace_id: input.trace_id,
		locale: options.locale ?? 'tr',
		turn_index: input.turn_index ?? 1,
		turn_intent: orderedToolCallCandidates.length > 0 ? 'continuing' : 'done',
	});

	if (narrationEmission.high_fallthrough_count >= 2) {
		turnLogger.error('fallthrough.high.repeated', {
			count: narrationEmission.high_fallthrough_count,
			model: modelResponse.model,
			provider: modelResponse.provider,
		});

		return {
			failure: {
				code: 'MODEL_RESPONSE_ADAPTATION_FAILED',
				message: 'Model unstable after repeated high-confidence fallthrough; retry suggested.',
			},
			final_state: 'FAILED',
			model_response: modelResponse,
			resolved_model_request: finalResolvedModelRequest,
			status: 'failed',
		};
	}

	if (narrationEmission.emission_decision === 'skip_unsupported') {
		turnLogger.info(
			'narration.provider_unsupported',
			createNarrationSuppressionLogFields({
				capabilities: input.model_gateway.capabilities,
				decision: narrationEmission.emission_decision,
				model: modelResponse.model,
				provider: modelResponse.provider,
			}),
		);
	}

	if (narrationEmission.emission_decision === 'skip_synthetic') {
		turnLogger.info(
			'narration.synthetic_ordering_suppressed',
			createNarrationSuppressionLogFields({
				capabilities: input.model_gateway.capabilities,
				decision: narrationEmission.emission_decision,
				model: modelResponse.model,
				provider: modelResponse.provider,
			}),
		);
	}

	for (const rejection of narrationEmission.rejections) {
		turnLogger.info(
			'narration.guardrail.rejected',
			createNarrationGuardrailRejectionLogFields(rejection),
		);
	}

	for (const event of narrationEmission.events) {
		const narrationLogFields = createNarrationRuntimeEventLogFields(event);

		if (narrationLogFields) {
			turnLogger.info(event.event_type, narrationLogFields);
		}

		options.on_runtime_event?.(event);
		sendNarrationServerMessageForRuntimeEvent(
			socket,
			{
				run_id: input.run_id,
				trace_id: input.trace_id,
			},
			event,
		);
	}

	const emitNarrationToolOutcomeLinks = (toolResults: readonly ToolResult[]): void => {
		for (const linkedNarration of narrationEmission.linked_narrations) {
			const toolResult = toolResults.find(
				(result) => result.call_id === linkedNarration.tool_call_id,
			);

			if (!toolResult) {
				continue;
			}

			const outcomeEvent = buildNarrationToolOutcomeLinkedEvent(
				{
					locale: options.locale ?? 'tr',
					linked_tool_call_id: linkedNarration.tool_call_id,
					narration_id: linkedNarration.narration_id,
					outcome: toolResult.status === 'success' ? 'success' : 'failure',
					sequence_no: linkedNarration.sequence_no,
					tool_call_id: linkedNarration.tool_call_id,
					turn_index: input.turn_index ?? 1,
				},
				{
					run_id: input.run_id,
					sequence_no: options.get_next_runtime_sequence_no?.() ?? 1,
					trace_id: input.trace_id,
				},
			);
			turnLogger.info(
				'narration.tool_outcome_linked',
				createNarrationRuntimeEventLogFields(outcomeEvent) ?? {},
			);
			options.on_runtime_event?.(outcomeEvent);
		}
	};

	const adaptedOutcomeResult = adaptModelResponseToTurnOutcome({
		model_response: modelResponse,
	});

	if (adaptedOutcomeResult.status === 'failed') {
		return {
			failure: {
				code: 'MODEL_RESPONSE_ADAPTATION_FAILED',
				message: adaptedOutcomeResult.failure.message,
			},
			final_state: 'FAILED',
			model_response: modelResponse,
			resolved_model_request: finalResolvedModelRequest,
			status: 'failed',
		};
	}

	if (adaptedOutcomeResult.outcome.kind === 'assistant_response') {
		const continuationResult = continueAssistantResponseFastPath(
			{
				current_state: input.current_state,
			},
			adaptedOutcomeResult.outcome,
		);

		return {
			assistant_text: continuationResult.assistant_text,
			continuation_result: continuationResult,
			final_state: continuationResult.final_state,
			model_response: modelResponse,
			model_turn_outcome: adaptedOutcomeResult.outcome,
			resolved_model_request: finalResolvedModelRequest,
			status: 'completed',
		};
	}

	const primaryToolCallOutcome =
		adaptedOutcomeResult.outcome.kind === 'tool_calls'
			? adaptedOutcomeResult.outcome.tool_calls[0]
			: adaptedOutcomeResult.outcome;

	if (!primaryToolCallOutcome) {
		return createRunModelTurnFailureResult({
			current_state: input.current_state,
			error_message: 'Model returned tool calls, but no primary tool call outcome was available.',
			model_response: modelResponse,
			resolved_model_request: finalResolvedModelRequest,
		});
	}

	if (orderedToolCallCandidates.length <= 1) {
		const toolDefinition = input.registry.get(primaryToolCallOutcome.tool_name);

		if (!toolDefinition) {
			return createRunModelTurnFailureResult({
				current_state: input.current_state,
				error_message: `Tool not found in registry: ${primaryToolCallOutcome.tool_name}`,
				model_response: modelResponse,
				model_turn_outcome: primaryToolCallOutcome,
				resolved_model_request: finalResolvedModelRequest,
			});
		}

		const permissionEvaluation = await policyWiring.evaluateToolPermission(socket, {
			call_id: primaryToolCallOutcome.call_id,
			tool_definition: toolDefinition,
		});

		switch (permissionEvaluation.decision.decision) {
			case 'allow': {
				turnLogger.info('tool.permission.allowed', {
					call_id: primaryToolCallOutcome.call_id,
					tool_name: primaryToolCallOutcome.tool_name,
				});
				const executedCandidate = await executePreparedToolCandidate(
					turnLogger,
					socket,
					input,
					policyWiring,
					{
						candidate: orderedToolCallCandidates[0] ?? {
							call_id: primaryToolCallOutcome.call_id,
							tool_input: primaryToolCallOutcome.tool_input,
							tool_name: primaryToolCallOutcome.tool_name,
						},
						effect_class: classifyToolEffectClass(toolDefinition),
						permission_decision: permissionEvaluation.decision,
						requires_approval: false,
						resource_key: classifyToolResourceKey(toolDefinition),
						tool_definition: toolDefinition,
					},
					101,
				);
				emitNarrationToolOutcomeLinks([executedCandidate.tool_result]);
				const ingestionResult = ingestToolResult({
					call_id: executedCandidate.tool_result.call_id,
					current_state: 'TOOL_RESULT_INGESTING',
					run_id: input.run_id,
					tool_name: executedCandidate.tool_result.tool_name,
					tool_result: executedCandidate.tool_result,
					trace_id: input.trace_id,
				});

				if (ingestionResult.status === 'failed') {
					return createRunModelTurnFailureResult({
						current_state: input.current_state,
						error_message: ingestionResult.failure.message,
						model_response: modelResponse,
						model_turn_outcome: primaryToolCallOutcome,
						resolved_model_request: finalResolvedModelRequest,
						tool_result: executedCandidate.tool_result,
						tool_results: [executedCandidate.tool_result],
					});
				}

				return {
					continuation_result: {
						call_id: ingestionResult.call_id,
						events: executedCandidate.events,
						final_state: ingestionResult.final_state,
						ingested_result: ingestionResult.ingested_result,
						outcome_kind: 'tool_call',
						state_transitions: [
							{ from: input.current_state, to: 'TOOL_EXECUTING' },
							{ from: 'TOOL_EXECUTING', to: 'TOOL_RESULT_INGESTING' },
						],
						status: 'completed',
						suggested_next_state: ingestionResult.suggested_next_state,
						tool_name: ingestionResult.tool_name,
						tool_result: ingestionResult.tool_result,
					},
					final_state: ingestionResult.final_state,
					ingested_result: ingestionResult.ingested_result,
					model_response: modelResponse,
					model_turn_outcome: primaryToolCallOutcome,
					resolved_model_request: finalResolvedModelRequest,
					status: 'completed',
					suggested_next_state: ingestionResult.suggested_next_state,
					tool_result: ingestionResult.tool_result,
				};
			}
			case 'require_approval': {
				turnLogger.info('tool.permission.approval_required', {
					call_id: primaryToolCallOutcome.call_id,
					tool_name: primaryToolCallOutcome.tool_name,
				});
				const approvalResult = requestApproval({
					call_id: primaryToolCallOutcome.call_id,
					current_state: input.current_state,
					requires_reason: permissionEvaluation.decision.approval_requirement.requires_reason,
					run_id: input.run_id,
					target: resolveDesktopApprovalTarget({
						auth_context: options.auth_context,
						call_id: primaryToolCallOutcome.call_id,
						desktopAgentBridgeRegistry: options.desktopAgentBridgeRegistry,
						target_connection_id: options.desktop_target_connection_id,
						tool_name: primaryToolCallOutcome.tool_name,
					}),
					tool_definition: resolveToolDefinitionForApprovalRequest(
						toolDefinition,
						permissionEvaluation.decision,
					),
					trace_id: input.trace_id,
				});

				if (approvalResult.status !== 'approval_required') {
					return createRunModelTurnFailureResult({
						current_state: input.current_state,
						error_message:
							approvalResult.status === 'failed'
								? approvalResult.failure.message
								: 'Policy approval path did not produce an approval request.',
						model_response: modelResponse,
						model_turn_outcome: primaryToolCallOutcome,
						resolved_model_request: finalResolvedModelRequest,
					});
				}

				policyWiring.rememberApprovalDecision(
					socket,
					approvalResult.approval_request.approval_id,
					permissionEvaluation.decision,
				);

				return {
					approval_event: approvalResult.approval_event,
					approval_request: approvalResult.approval_request,
					continuation_result: {
						approval_event: approvalResult.approval_event,
						approval_request: approvalResult.approval_request,
						call_id: primaryToolCallOutcome.call_id,
						events: [],
						final_state: approvalResult.final_state,
						outcome_kind: 'tool_call',
						state_transitions: approvalResult.state_transitions,
						status: 'approval_required',
						tool_name: primaryToolCallOutcome.tool_name,
					},
					final_state: approvalResult.final_state,
					model_response: modelResponse,
					model_turn_outcome: primaryToolCallOutcome,
					resolved_model_request: finalResolvedModelRequest,
					status: 'approval_required',
				};
			}
			case 'deny': {
				turnLogger.warn('tool.permission.denied', {
					call_id: primaryToolCallOutcome.call_id,
					tool_name: primaryToolCallOutcome.tool_name,
				});
				const outcomeResult = await policyWiring.recordOutcome(socket, {
					decision: permissionEvaluation.decision,
					outcome: 'denied',
				});
				const denialMessage =
					outcomeResult.pause_transition === 'entered'
						? `Permission denied for ${primaryToolCallOutcome.tool_name}; session paused after consecutive denials.`
						: `Permission denied for ${primaryToolCallOutcome.tool_name}.`;

				return createRunModelTurnFailureResult({
					current_state: input.current_state,
					error_message: denialMessage,
					model_response: modelResponse,
					model_turn_outcome: primaryToolCallOutcome,
					resolved_model_request: finalResolvedModelRequest,
				});
			}
			case 'pause':
				turnLogger.warn('tool.permission.paused', {
					call_id: primaryToolCallOutcome.call_id,
					tool_name: primaryToolCallOutcome.tool_name,
				});
				return createRunModelTurnFailureResult({
					current_state: input.current_state,
					error_message:
						'Session is paused after consecutive permission denials; approval is required before continuing.',
					model_response: modelResponse,
					model_turn_outcome: primaryToolCallOutcome,
					resolved_model_request: finalResolvedModelRequest,
				});
		}
	}

	const preparedPlan = await prepareToolExecutionPlan(
		socket,
		orderedToolCallCandidates,
		input.registry,
		policyWiring,
	);
	const scheduledPlan = planToolExecutionBatches(preparedPlan.prepared_candidates);
	const preparedCandidatesByCallId = new Map(
		preparedPlan.prepared_candidates.map((candidate) => [candidate.candidate.call_id, candidate]),
	);
	const fallbackParallelFailureCandidate =
		orderedToolCallCandidates.at(-1) ?? orderedToolCallCandidates[0];

	if (!fallbackParallelFailureCandidate) {
		return createRunModelTurnFailureResult({
			current_state: input.current_state,
			error_message: 'Model returned a parallel tool schedule without candidates.',
			model_response: modelResponse,
			model_turn_outcome: primaryToolCallOutcome,
			resolved_model_request: resolvedModelRequest,
		});
	}

	const executedCandidates: ExecutedToolCandidateResult[] = [];
	const executedEvents: ToolRuntimeEvent[] = [];

	for (const [batchIndex, batch] of scheduledPlan.batches.entries()) {
		if (batch.execution_mode === 'parallel') {
			const preparedBatchCandidates = batch.candidates.map((candidate) =>
				preparedCandidatesByCallId.get(candidate.candidate.call_id),
			);

			if (preparedBatchCandidates.some((candidate) => candidate === undefined)) {
				const missingCandidate = batch.candidates.find(
					(candidate) => preparedCandidatesByCallId.get(candidate.candidate.call_id) === undefined,
				);

				return createRunModelTurnFailureResult({
					current_state: input.current_state,
					error_message: `Prepared tool candidate missing for ${missingCandidate?.candidate.tool_name ?? 'unknown'}/${missingCandidate?.candidate.call_id ?? 'unknown'}.`,
					model_response: modelResponse,
					model_turn_outcome:
						missingCandidate === undefined
							? primaryToolCallOutcome
							: toToolCallOutcome(missingCandidate.candidate),
					resolved_model_request: finalResolvedModelRequest,
					tool_result: executedCandidates.at(-1)?.tool_result,
					tool_results: executedCandidates.map(
						(executedCandidate) => executedCandidate.tool_result,
					),
				});
			}

			const safePreparedBatchCandidates = preparedBatchCandidates.filter(
				(candidate): candidate is PreparedToolExecutionCandidate => candidate !== undefined,
			);

			const settledResults = await Promise.allSettled(
				safePreparedBatchCandidates.map((candidate, candidateIndex) =>
					executePreparedToolCandidate(
						turnLogger,
						socket,
						input,
						policyWiring,
						candidate,
						100 + batchIndex * 100 + candidateIndex * 10,
					),
				),
			);

			for (const settledResult of settledResults) {
				if (settledResult.status === 'rejected') {
					return createRunModelTurnFailureResult({
						current_state: input.current_state,
						error_message:
							settledResult.reason instanceof Error
								? settledResult.reason.message
								: 'Parallel tool execution failed unexpectedly.',
						model_response: modelResponse,
						model_turn_outcome: toToolCallOutcome(fallbackParallelFailureCandidate),
						resolved_model_request: finalResolvedModelRequest,
						tool_result: executedCandidates.at(-1)?.tool_result,
						tool_results: executedCandidates.map((candidate) => candidate.tool_result),
					});
				}

				executedCandidates.push(settledResult.value);
				executedEvents.push(...settledResult.value.events);
			}
			continue;
		}

		for (const [candidateIndex, candidate] of batch.candidates.entries()) {
			try {
				const preparedCandidate = preparedCandidatesByCallId.get(candidate.candidate.call_id);

				if (!preparedCandidate) {
					return createRunModelTurnFailureResult({
						current_state: input.current_state,
						error_message: `Prepared tool candidate missing for ${candidate.candidate.tool_name}/${candidate.candidate.call_id}.`,
						model_response: modelResponse,
						model_turn_outcome: toToolCallOutcome(candidate.candidate),
						resolved_model_request: finalResolvedModelRequest,
						tool_result: executedCandidates.at(-1)?.tool_result,
						tool_results: executedCandidates.map(
							(executedCandidate) => executedCandidate.tool_result,
						),
					});
				}

				const executedCandidate = await executePreparedToolCandidate(
					turnLogger,
					socket,
					input,
					policyWiring,
					preparedCandidate,
					100 + batchIndex * 100 + candidateIndex * 10,
				);
				executedCandidates.push(executedCandidate);
				executedEvents.push(...executedCandidate.events);
			} catch (error: unknown) {
				return createRunModelTurnFailureResult({
					current_state: input.current_state,
					error_message:
						error instanceof Error
							? error.message
							: 'Sequential tool execution failed unexpectedly.',
					model_response: modelResponse,
					model_turn_outcome: toToolCallOutcome(candidate.candidate),
					resolved_model_request: finalResolvedModelRequest,
					tool_result: executedCandidates.at(-1)?.tool_result,
					tool_results: executedCandidates.map(
						(executedCandidate) => executedCandidate.tool_result,
					),
				});
			}
		}
	}

	const orderedExecutedCandidates = executedCandidates
		.slice()
		.sort(
			(left, right) =>
				orderedToolCallCandidates.findIndex(
					(candidate) => candidate.call_id === left.candidate.call_id,
				) -
				orderedToolCallCandidates.findIndex(
					(candidate) => candidate.call_id === right.candidate.call_id,
				),
		);
	const orderedToolResults = orderedExecutedCandidates.map(
		(executedCandidate) => executedCandidate.tool_result,
	);
	emitNarrationToolOutcomeLinks(orderedToolResults);
	const lastExecutedToolResult = orderedToolResults.at(-1);
	const blockedApprovalCandidate =
		scheduledPlan.blocked_candidate === undefined
			? undefined
			: preparedCandidatesByCallId.get(scheduledPlan.blocked_candidate.candidate.call_id);

	if (blockedApprovalCandidate) {
		turnLogger.info('tool.permission.approval_required.batch', {
			call_id: blockedApprovalCandidate.candidate.call_id,
			tool_name: blockedApprovalCandidate.candidate.tool_name,
		});
		const approvalDecision = blockedApprovalCandidate.permission_decision;

		if (approvalDecision.decision !== 'require_approval') {
			return createRunModelTurnFailureResult({
				current_state: input.current_state,
				error_message: 'Tool scheduler blocked on a non-approval decision unexpectedly.',
				model_response: modelResponse,
				model_turn_outcome: toToolCallOutcome(blockedApprovalCandidate.candidate),
				resolved_model_request: finalResolvedModelRequest,
				tool_result: lastExecutedToolResult,
				tool_results: orderedToolResults,
			});
		}

		const approvalResult = requestApproval({
			call_id: blockedApprovalCandidate.candidate.call_id,
			current_state: input.current_state,
			requires_reason: approvalDecision.approval_requirement.requires_reason,
			run_id: input.run_id,
			target: resolveDesktopApprovalTarget({
				auth_context: options.auth_context,
				call_id: blockedApprovalCandidate.candidate.call_id,
				desktopAgentBridgeRegistry: options.desktopAgentBridgeRegistry,
				target_connection_id: options.desktop_target_connection_id,
				tool_name: blockedApprovalCandidate.candidate.tool_name,
			}),
			tool_definition: resolveToolDefinitionForApprovalRequest(
				blockedApprovalCandidate.tool_definition,
				approvalDecision,
			),
			trace_id: input.trace_id,
		});

		if (approvalResult.status !== 'approval_required') {
			return createRunModelTurnFailureResult({
				current_state: input.current_state,
				error_message:
					approvalResult.status === 'failed'
						? approvalResult.failure.message
						: 'Policy approval path did not produce an approval request.',
				model_response: modelResponse,
				model_turn_outcome: toToolCallOutcome(blockedApprovalCandidate.candidate),
				resolved_model_request: finalResolvedModelRequest,
				tool_result: lastExecutedToolResult,
				tool_results: orderedToolResults,
			});
		}

		policyWiring.rememberApprovalDecision(
			socket,
			approvalResult.approval_request.approval_id,
			approvalDecision,
		);

		return {
			approval_event: approvalResult.approval_event,
			approval_request: approvalResult.approval_request,
			continuation_result: {
				approval_event: approvalResult.approval_event,
				approval_request: approvalResult.approval_request,
				call_id: blockedApprovalCandidate.candidate.call_id,
				events: executedEvents,
				final_state: approvalResult.final_state,
				outcome_kind: 'tool_call',
				state_transitions: approvalResult.state_transitions,
				status: 'approval_required',
				tool_name: blockedApprovalCandidate.candidate.tool_name,
			},
			final_state: approvalResult.final_state,
			model_response: modelResponse,
			model_turn_outcome: toToolCallOutcome(blockedApprovalCandidate.candidate),
			resolved_model_request: finalResolvedModelRequest,
			status: 'approval_required',
			tool_result: lastExecutedToolResult,
			tool_results: orderedToolResults,
		};
	}

	if (preparedPlan.blocked_failure) {
		const deniedCandidate = preparedPlan.blocked_failure.candidate;
		const deniedToolDefinition = input.registry.get(deniedCandidate.tool_name);

		if (deniedToolDefinition) {
			const permissionEvaluation = await policyWiring.evaluateToolPermission(socket, {
				call_id: deniedCandidate.call_id,
				tool_definition: deniedToolDefinition,
			});

			if (permissionEvaluation.decision.decision === 'deny') {
				const outcomeResult = await policyWiring.recordOutcome(socket, {
					decision: permissionEvaluation.decision,
					outcome: 'denied',
				});
				const denialMessage =
					outcomeResult.pause_transition === 'entered'
						? `Permission denied for ${deniedCandidate.tool_name}; session paused after consecutive denials.`
						: preparedPlan.blocked_failure.error_message;

				return createRunModelTurnFailureResult({
					current_state: input.current_state,
					error_message: denialMessage,
					model_response: modelResponse,
					model_turn_outcome: toToolCallOutcome(deniedCandidate),
					resolved_model_request: finalResolvedModelRequest,
					tool_result: lastExecutedToolResult,
					tool_results: orderedToolResults,
				});
			}
		}

		return createRunModelTurnFailureResult({
			current_state: input.current_state,
			error_message: preparedPlan.blocked_failure.error_message,
			model_response: modelResponse,
			model_turn_outcome: toToolCallOutcome(deniedCandidate),
			resolved_model_request: finalResolvedModelRequest,
			tool_result: lastExecutedToolResult,
			tool_results: orderedToolResults,
		});
	}

	if (!lastExecutedToolResult) {
		return createRunModelTurnFailureResult({
			current_state: input.current_state,
			error_message: 'Model returned tool calls, but no executable tool candidate was scheduled.',
			model_response: modelResponse,
			model_turn_outcome: primaryToolCallOutcome,
			resolved_model_request: finalResolvedModelRequest,
		});
	}

	const terminalCandidate =
		orderedExecutedCandidates.at(-1)?.candidate ?? fallbackParallelFailureCandidate;
	const ingestionResult = ingestToolResult({
		call_id: lastExecutedToolResult.call_id,
		current_state: 'TOOL_RESULT_INGESTING',
		run_id: input.run_id,
		tool_name: lastExecutedToolResult.tool_name,
		tool_result: lastExecutedToolResult,
		trace_id: input.trace_id,
	});

	if (ingestionResult.status === 'failed') {
		return createRunModelTurnFailureResult({
			current_state: input.current_state,
			error_message: ingestionResult.failure.message,
			model_response: modelResponse,
			model_turn_outcome: toToolCallOutcome(terminalCandidate),
			resolved_model_request: finalResolvedModelRequest,
			tool_result: lastExecutedToolResult,
			tool_results: orderedToolResults,
		});
	}

	return {
		continuation_result: {
			call_id: ingestionResult.call_id,
			events: executedEvents,
			final_state: ingestionResult.final_state,
			ingested_result: ingestionResult.ingested_result,
			outcome_kind: 'tool_call',
			state_transitions: [
				{ from: input.current_state, to: 'TOOL_EXECUTING' },
				{ from: 'TOOL_EXECUTING', to: 'TOOL_RESULT_INGESTING' },
			],
			status: 'completed',
			suggested_next_state: ingestionResult.suggested_next_state,
			tool_name: ingestionResult.tool_name,
			tool_result: ingestionResult.tool_result,
		},
		final_state: ingestionResult.final_state,
		ingested_result: ingestionResult.ingested_result,
		model_response: modelResponse,
		model_turn_outcome: toToolCallOutcome(terminalCandidate),
		resolved_model_request: finalResolvedModelRequest,
		status: 'completed',
		suggested_next_state: ingestionResult.suggested_next_state,
		tool_result: ingestionResult.tool_result,
		tool_results: orderedToolResults,
	};
}

async function executeLiveRun(
	socket: WebSocketConnection,
	payload: RunRequestPayload,
	options: ExecuteLiveRunOptions,
): Promise<RunToolWebSocketResult> {
	const runLogger = runExecutionLogger.child({
		conversation_id: payload.conversation_id,
		model: payload.request.model ?? payload.provider_config.defaultModel,
		provider: payload.provider,
		run_id: payload.run_id,
		trace_id: payload.trace_id,
	});
	const runSpan = startLogSpan(runLogger, 'run.execute', {
		include_presentation_blocks: payload.include_presentation_blocks === true,
	});
	const workspaceLayer =
		options.workspace_layer ?? (await buildLiveWorkspaceLayer(payload, options.workingDirectory));
	const policyWiring = getPolicyWiring(options);
	const runtimeSessionId = resolveRuntimeSessionId(payload, options.auth_context);
	const gateway = createModelGateway({
		config: payload.provider_config,
		health_signal: defaultProviderHealthStore.getSignal({
			session_id: runtimeSessionId,
		}),
		provider: payload.provider,
	});
	const toolResultsByCallId = new Map<string, ToolResult>();
	const toolResultHistory: ToolResult[] = [];
	const rememberToolResult = (toolResult: ToolResult | undefined): void => {
		if (toolResult === undefined) {
			return;
		}

		if (!toolResultsByCallId.has(toolResult.call_id)) {
			toolResultHistory.push(toolResult);
		}

		toolResultsByCallId.set(toolResult.call_id, toolResult);
	};

	for (const toolResult of options.initial_tool_results ?? []) {
		rememberToolResult(toolResult);
	}

	rememberToolResult(options.initial_tool_result);

	const runtimeRegistry = createRuntimeToolRegistry(options.registry, {
		enableDesktopVisionTools: supportsDesktopVisionProvider(payload.provider),
		memoryStore: options.memoryStore,
		modelGateway: gateway,
		resolveToolResult: (callId) => toolResultsByCallId.get(callId),
	});
	const liveExecutionContext = {
		auth_context: options.auth_context,
		create_storage_download_url: options.create_storage_download_url,
		desktop_bridge: (
			options.desktopAgentBridgeRegistry ?? defaultDesktopAgentBridgeRegistry
		).createInvoker(options.auth_context, payload.desktop_target_connection_id),
		storage_service: options.storage_service,
		working_directory: options.workingDirectory,
	};
	const events: AnyRuntimeEvent[] = [];
	const runtimeEvents: RuntimeEvent[] = [];
	const locale = resolveRunRequestLocale(payload);
	let previousRuntimeState: RuntimeState = options.initial_runtime_state ?? 'INIT';
	let lastIncrementalApprovalId: string | undefined;
	let lastIncrementalToolResultCallId: string | undefined;
	const appendAndSendRuntimeEvent = (event: RuntimeEvent): void => {
		events.push(event);
		runtimeEvents.push(event);
		sendServerMessage(socket, createRuntimeEventMessage(payload, event));
	};
	const continueGate = createAutoContinuePolicyGate({
		evaluate_permission(input) {
			return policyWiring.evaluateAutoContinuePermission(socket, input);
		},
		record_outcome(input) {
			return policyWiring.recordOutcome(socket, input);
		},
		remember_approval_decision(approvalId, decision) {
			policyWiring.rememberApprovalDecision(socket, approvalId, decision);
		},
	});

	const loop = runAgentLoop({
		build_model_request: async (input) => {
			const modelRequest = await buildLiveModelRequest(payload, options.workingDirectory, {
				current_state: input.snapshot.current_runtime_state,
				latest_tool_result: input.snapshot.tool_result,
				memoryStore: options.memoryStore,
				provider_capabilities: gateway.capabilities,
				recent_tool_calls: input.snapshot.recent_tool_calls,
				workspace_layer: workspaceLayer,
			});

			if (
				input.snapshot.current_runtime_state === 'TOOL_RESULT_INGESTING' &&
				(input.snapshot.tool_results?.length ?? 0) > 1
			) {
				return {
					...modelRequest,
					messages: replaceFinalUserMessage(
						modelRequest.messages,
						input.snapshot.tool_results ?? [],
					),
				};
			}

			return modelRequest;
		},
		config: {
			max_turns: 200,
			stop_conditions: {},
		},
		continue_gate: continueGate,
		execution_context: {
			...liveExecutionContext,
			delegate_agent: (request) =>
				runSequentialSubAgentDelegation({
					execution_context: liveExecutionContext,
					model_gateway: gateway,
					registry: runtimeRegistry,
					request,
				}),
		},
		initial_runtime_state: options.initial_runtime_state,
		initial_tool_result: options.initial_tool_result,
		initial_turn_count: options.initial_turn_count,
		model_gateway: gateway,
		registry: runtimeRegistry,
		run_id: payload.run_id,
		run_model_turn: (input) =>
			runPolicyAwareModelTurn(socket, input, policyWiring, {
				auth_context: options.auth_context,
				desktopAgentBridgeRegistry: options.desktopAgentBridgeRegistry,
				desktop_target_connection_id: payload.desktop_target_connection_id,
				get_next_runtime_sequence_no: () => getNextRuntimeSequenceNo(runtimeEvents),
				locale,
				on_runtime_event: appendAndSendRuntimeEvent,
				requested_provider: payload.provider,
				session_id: runtimeSessionId,
			}),
		on_yield: async ({ snapshot, yield: loopYield }) => {
			for (const toolResult of snapshot.tool_results ?? []) {
				rememberToolResult(toolResult);
			}
			rememberToolResult(snapshot.tool_result);

			if (
				payload.include_presentation_blocks !== true ||
				loopYield.type !== 'turn.completed' ||
				(snapshot.tool_result === undefined && snapshot.approval_request === undefined)
			) {
				return;
			}

			const hasNewToolResult =
				snapshot.tool_result !== undefined &&
				snapshot.tool_result.call_id !== lastIncrementalToolResultCallId;
			const hasNewApproval =
				snapshot.approval_request !== undefined &&
				snapshot.approval_request.approval_id !== lastIncrementalApprovalId;

			if (!hasNewToolResult && !hasNewApproval) {
				return;
			}

			const turnPresentationBlocks = createAutomaticTurnPresentationBlocks({
				approval_request: hasNewApproval ? snapshot.approval_request : undefined,
				created_at: events[events.length - 1]?.timestamp ?? new Date().toISOString(),
				pending_tool_call: withPendingDesktopTargetConnectionId(
					snapshot.pending_tool_call,
					payload,
				),
				tool_arguments: snapshot.tool_arguments,
				tool_result: hasNewToolResult ? snapshot.tool_result : undefined,
				working_directory: options.workingDirectory,
			});

			if (turnPresentationBlocks.length === 0) {
				return;
			}

			if (hasNewApproval && snapshot.approval_request !== undefined) {
				await persistApprovalPresentationInputs(
					options.approvalStore,
					createAutomaticApprovalPresentationInputs(
						{
							approval_request: snapshot.approval_request,
							events,
							final_state: snapshot.current_runtime_state ?? 'WAITING_APPROVAL',
							pending_tool_call: withPendingDesktopTargetConnectionId(
								snapshot.pending_tool_call,
								payload,
							),
							runtime_events: runtimeEvents,
							status: 'approval_required',
							tool_arguments: snapshot.tool_arguments,
							tool_result: snapshot.tool_result,
							tool_result_history: toolResultHistory,
							turn_count: snapshot.turn_count,
						},
						options.workingDirectory,
						payload,
					),
					approvalPersistenceScopeFromAuthContext(options.auth_context),
				);
			}

			if (hasNewToolResult) {
				lastIncrementalToolResultCallId = snapshot.tool_result?.call_id;
			}

			if (hasNewApproval) {
				lastIncrementalApprovalId = snapshot.approval_request?.approval_id;
			}

			sendServerMessage(
				socket,
				createPresentationBlocksMessage({
					blocks: turnPresentationBlocks,
					run_id: payload.run_id,
					trace_id: payload.trace_id,
				}),
			);
		},
		trace_id: payload.trace_id,
	});

	while (true) {
		const iteration = await loop.next();

		if (iteration.done) {
			const finalSnapshot = iteration.value.final_snapshot;
			for (const toolResult of finalSnapshot.tool_results ?? []) {
				rememberToolResult(toolResult);
			}
			rememberToolResult(finalSnapshot.tool_result);
			appendTerminalRuntimeEventsIfNeeded(
				appendAndSendRuntimeEvent,
				payload,
				runtimeEvents,
				finalSnapshot,
			);

			const result = {
				already_persisted_approval_id: lastIncrementalApprovalId,
				approval_request: finalSnapshot.approval_request,
				assistant_text: finalSnapshot.assistant_text,
				error_code:
					finalSnapshot.failure?.error_code ??
					resolveRuntimeTerminationCode(finalSnapshot.stop_reason) ??
					(finalSnapshot.current_loop_state === 'FAILED'
						? isErrorToolResult(finalSnapshot.tool_result)
							? finalSnapshot.tool_result.error_code
							: 'RUN_TERMINATED'
						: undefined),
				error_message:
					finalSnapshot.failure?.error_message ??
					(finalSnapshot.current_loop_state === 'FAILED'
						? buildTerminalFailureMessage(finalSnapshot)
						: undefined),
				events,
				final_state: toLoopFinalRuntimeState(finalSnapshot),
				pending_tool_call: withPendingDesktopTargetConnectionId(
					finalSnapshot.pending_tool_call,
					payload,
				),
				runtime_events: runtimeEvents,
				status: toLoopRunStatus(finalSnapshot),
				tool_arguments: finalSnapshot.tool_arguments,
				tool_result: finalSnapshot.tool_result,
				tool_results: finalSnapshot.tool_results,
				tool_result_history: toolResultHistory,
				turn_count: finalSnapshot.turn_count,
				workspace_layer: workspaceLayer,
			};
			runSpan.end({
				final_state: result.final_state,
				status: result.status,
				turn_count: result.turn_count,
			});

			return result;
		}

		if (iteration.value.type === 'turn.started') {
			runLogger.debug('run.turn.started', {
				turn_index: iteration.value.turn_index,
			});
			for (const event of createLoopTurnStartedEvents(
				payload,
				iteration.value.turn_index,
				previousRuntimeState,
			)) {
				appendAndSendRuntimeEvent(event);
			}
			continue;
		}

		if (iteration.value.type === 'turn.progress') {
			events.push(iteration.value.event);

			if (isRuntimeEvent(iteration.value.event)) {
				runtimeEvents.push(iteration.value.event);
				sendServerMessage(socket, createRuntimeEventMessage(payload, iteration.value.event));
			}

			continue;
		}

		if (iteration.value.type === 'turn.completed' && iteration.value.runtime_state !== undefined) {
			previousRuntimeState = iteration.value.runtime_state;
		}
	}
}

export async function finalizeLiveRunResult(
	socket: WebSocketConnection,
	payload: RunRequestPayload,
	result: RunToolWebSocketResult,
	options: RuntimeWebSocketHandlerOptions & {
		readonly approvalStore: ApprovalStore;
	},
	finalizeOptions: FinalizeLiveRunResultOptions,
): Promise<void> {
	const finalizeLogger = runExecutionLogger.child({
		conversation_id: finalizeOptions.conversation_id,
		run_id: payload.run_id,
		trace_id: payload.trace_id,
	});
	const persistEvents = options.persistEvents ?? persistRuntimeEvents;
	const persistRunStateRecord = options.persistRunState ?? persistRunState;
	const conversationStore = options.conversationStore ?? {
		appendConversationMessage,
		appendConversationRunBlocks,
	};

	if (finalizeOptions.persist_live_memory_write) {
		await persistLiveMemoryWrite(
			payload,
			result,
			finalizeOptions.working_directory,
			options.memoryStore,
		);
	}

	await persistEvents(result.runtime_events);
	await persistRunStateRecord({
		conversation_id: finalizeOptions.conversation_id,
		current_state: result.final_state,
		last_error_code: result.status === 'failed' ? result.error_code : undefined,
		recorded_at: result.runtime_events.at(-1)?.timestamp,
		run_id: payload.run_id,
		trace_id: payload.trace_id,
	});

	if (
		conversationStore &&
		finalizeOptions.conversation_id &&
		result.assistant_text &&
		result.assistant_text.trim().length > 0
	) {
		await conversationStore.appendConversationMessage({
			content: result.assistant_text,
			conversation_id: finalizeOptions.conversation_id,
			created_at: result.runtime_events.at(-1)?.timestamp,
			role: 'assistant',
			run_id: payload.run_id,
			scope: conversationScopeFromAuthContext(options.auth_context),
			trace_id: payload.trace_id,
		});
	}

	const automaticApprovalPresentationInputs = createAutomaticApprovalPresentationInputs(
		result,
		finalizeOptions.working_directory,
		payload,
	);
	const automaticApprovalPersistenceInputs = automaticApprovalPresentationInputs.filter(
		(input) =>
			input.kind !== 'request_result' ||
			input.result.status !== 'approval_required' ||
			input.result.approval_request.approval_id !== result.already_persisted_approval_id,
	);

	await persistApprovalPresentationInputs(
		options.approvalStore,
		automaticApprovalPersistenceInputs,
		approvalPersistenceScopeFromAuthContext(options.auth_context),
	);

	const presentationAdditionalBlocks =
		payload.include_presentation_blocks === true
			? [
					...(finalizeOptions.retained_presentation_blocks ?? []),
					...(await createAdditionalPresentationBlocks({
						approvalStore: options.approvalStore,
						automaticApprovalPresentationInputs,
						approvalPersistenceScope: approvalPersistenceScopeFromAuthContext(options.auth_context),
						hooks: options,
						payload,
						result,
					})),
				]
			: undefined;

	if (presentationAdditionalBlocks) {
		const presentationBlocks = createPresentationBlockList(
			result.runtime_events,
			presentationAdditionalBlocks,
		);
		const existingInspectionContext = getStoredInspectionContext(socket, payload.run_id);

		rememberInspectionContext(socket, {
			blocks: mergeRenderBlocks(existingInspectionContext?.blocks ?? [], presentationBlocks),
			events: mergeInspectionEvents(existingInspectionContext?.events ?? [], result.events),
			run_id: payload.run_id,
			trace_id: payload.trace_id,
			workspace_layer: result.workspace_layer ?? existingInspectionContext?.workspace_layer,
		});

		sendServerMessage(
			socket,
			createPresentationBlocksMessage({
				blocks: presentationBlocks,
				run_id: payload.run_id,
				trace_id: payload.trace_id,
			}),
		);

		if (
			presentationBlocks.length > 0 &&
			finalizeOptions.conversation_id &&
			conversationStore?.appendConversationRunBlocks
		) {
			await conversationStore.appendConversationRunBlocks({
				blocks: presentationBlocks,
				conversation_id: finalizeOptions.conversation_id,
				created_at: result.runtime_events.at(-1)?.timestamp,
				run_id: payload.run_id,
				scope: conversationScopeFromAuthContext(options.auth_context),
				trace_id: payload.trace_id,
			});
		}
	}

	const finishedMessage = createFinishedMessage(payload, result);

	if (finishedMessage) {
		sendServerMessage(socket, finishedMessage);
		await broadcastConversationRunFinished(socket, payload, result);
	}

	finalizeLogger.info('run.finalized', {
		final_state: result.final_state,
		status: result.status,
	});
}

export async function resumeApprovedAutoContinue(
	_socket: WebSocketConnection,
	pendingApproval: PendingApprovalEntry,
	options: RuntimeWebSocketHandlerOptions & {
		readonly approvalStore: ApprovalStore;
	},
	override?: Readonly<{
		readonly initial_tool_result?: ToolResult;
		readonly initial_turn_count?: number;
		readonly retained_presentation_blocks?: readonly RenderBlock[];
	}>,
): Promise<boolean> {
	if (pendingApproval.auto_continue_context === undefined) {
		return false;
	}

	const pendingContext = pendingApproval.auto_continue_context;
	const toolRegistry = options.toolRegistry ?? (await getDefaultToolRegistryAsync());
	const continuationResult = await executeLiveRun(_socket, pendingContext.payload, {
		approvalStore: options.approvalStore,
		auth_context: options.auth_context,
		create_storage_download_url: options.create_storage_download_url,
		desktopAgentBridgeRegistry: options.desktopAgentBridgeRegistry,
		initial_runtime_state: 'TOOL_RESULT_INGESTING',
		initial_tool_result: override?.initial_tool_result ?? pendingContext.tool_result,
		initial_tool_results: pendingContext.tool_result_history,
		initial_turn_count: override?.initial_turn_count ?? pendingContext.turn_count,
		memoryStore: options.memoryStore,
		policy_wiring: options.policy_wiring,
		registry: toolRegistry,
		storage_service: options.storage_service,
		workingDirectory: pendingContext.working_directory,
	});

	await finalizeLiveRunResult(_socket, pendingContext.payload, continuationResult, options, {
		conversation_id: pendingContext.payload.conversation_id,
		persist_live_memory_write: false,
		retained_presentation_blocks: override?.retained_presentation_blocks,
		working_directory: pendingContext.working_directory,
	});

	return true;
}

async function persistLiveMemoryWrite(
	payload: RunRequestPayload,
	result: RunToolWebSocketResult,
	workingDirectory: string,
	memoryStore?: MemoryOrchestrationStore,
): Promise<void> {
	if (!canPersistLiveMemory(memoryStore)) {
		return;
	}

	const extractedUserTurn = extractUserTurn(payload.request.messages);

	if (!extractedUserTurn) {
		return;
	}

	const orchestratedMemoryStore = memoryStore ?? defaultMemoryStore;
	const preferenceMemoryWriteResult = await orchestrateMemoryWrite({
		candidate_policy: 'user_preference',
		memory_store: orchestratedMemoryStore,
		run_id: payload.run_id,
		scope: 'user',
		scope_id: getLiveUserPreferenceScopeId(),
		source: {
			kind: 'user_text',
			text: extractedUserTurn.user_turn,
		},
		trace_id: payload.trace_id,
	});

	if (preferenceMemoryWriteResult.status === 'failed') {
		logLiveMemoryWriteFailure(
			payload,
			preferenceMemoryWriteResult.failure.message,
			preferenceMemoryWriteResult.failure.source_failure_code,
		);
	}

	if (result.status === 'failed') {
		return;
	}

	const workspaceMemoryWriteResult = await orchestrateMemoryWrite({
		memory_store: orchestratedMemoryStore,
		run_id: payload.run_id,
		scope: 'workspace',
		scope_id: getLiveMemoryScopeId(workingDirectory),
		source: {
			kind: 'user_text',
			text: extractedUserTurn.user_turn,
		},
		trace_id: payload.trace_id,
	});

	if (workspaceMemoryWriteResult.status === 'failed') {
		logLiveMemoryWriteFailure(
			payload,
			workspaceMemoryWriteResult.failure.message,
			workspaceMemoryWriteResult.failure.source_failure_code,
		);
	}
}

export async function handleRunRequestMessage(
	socket: WebSocketConnection,
	payload: RunRequestPayload,
	options: RuntimeWebSocketHandlerOptions & {
		readonly approvalStore: ApprovalStore;
	},
): Promise<void> {
	const requestLogger = runExecutionLogger.child({
		conversation_id: payload.conversation_id,
		model: payload.request.model ?? payload.provider_config.defaultModel,
		provider: payload.provider,
		run_id: payload.run_id,
		trace_id: payload.trace_id,
	});

	if (options.auth_context) {
		requireUsageRateLimit({
			auth: options.auth_context,
			metric: 'monthly_turns',
			scope: 'ws_run_request',
			subscription: options.subscription_context,
		});
	}

	const conversationStore =
		options.conversationStore ??
		(hasConversationStoreConfiguration()
			? {
					appendConversationMessage,
					appendConversationRunBlocks,
					ensureConversation,
				}
			: undefined);
	const conversationScope = conversationScopeFromAuthContext(options.auth_context);
	const extractedUserTurn = extractUserTurn(payload.request.messages);
	const resolvedConversation =
		conversationStore && extractedUserTurn
			? await conversationStore.ensureConversation({
					conversation_id: payload.conversation_id,
					initial_preview: extractedUserTurn.user_turn,
					scope: conversationScope,
				})
			: undefined;
	const resolvedPayload =
		resolvedConversation === undefined
			? payload
			: {
					...payload,
					conversation_id: resolvedConversation.conversation_id,
				};
	const policyWiring = getPolicyWiring(options);
	const approvalMode = normalizeApprovalMode(resolvedPayload.approval_policy?.mode);

	await policyWiring.setApprovalMode(socket, approvalMode);

	if (conversationStore && extractedUserTurn && resolvedPayload.conversation_id) {
		await conversationStore.appendConversationMessage({
			content: extractedUserTurn.user_turn,
			conversation_id: resolvedPayload.conversation_id,
			role: 'user',
			run_id: resolvedPayload.run_id,
			scope: conversationScope,
			trace_id: resolvedPayload.trace_id,
		});
	}

	requestLogger.info('run.request.accepted', {
		approval_mode: approvalMode,
		conversation_id: resolvedPayload.conversation_id,
	});
	sendServerMessage(socket, createAcceptedMessage(resolvedPayload));
	await broadcastConversationRunAccepted(socket, resolvedPayload);

	const toolRegistry = options.toolRegistry ?? (await getDefaultToolRegistryAsync());
	const workingDirectory = getLiveWorkingDirectory();
	let result: RunToolWebSocketResult;

	try {
		result = await executeLiveRun(socket, resolvedPayload, {
			approvalStore: options.approvalStore,
			auth_context: options.auth_context,
			create_storage_download_url: options.create_storage_download_url,
			desktopAgentBridgeRegistry: options.desktopAgentBridgeRegistry,
			memoryStore: options.memoryStore,
			policy_wiring: policyWiring,
			registry: toolRegistry,
			storage_service: options.storage_service,
			workingDirectory,
		});
	} catch (error: unknown) {
		requestLogger.error('run.request.failed_before_finalize', {
			error: error instanceof Error ? error : String(error),
		});
		throw error;
	}

	await finalizeLiveRunResult(socket, resolvedPayload, result, options, {
		conversation_id: resolvedPayload.conversation_id,
		persist_live_memory_write: true,
		working_directory: workingDirectory,
	});
}
