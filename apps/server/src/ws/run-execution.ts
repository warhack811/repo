import type {
	AnyRuntimeEvent,
	ModelRequest,
	ModelResponse,
	RuntimeEvent,
	RuntimeState,
	ToolDefinition,
	ToolResult,
	TurnProgressEvent,
} from '@runa/types';

import type { WorkspaceLayer } from '../context/compose-workspace-context.js';
import { createModelGateway } from '../gateway/factory.js';
import {
	type ApprovalStore,
	type PendingApprovalEntry,
	approvalPersistenceScopeFromAuthContext,
} from '../persistence/approval-store.js';
import { persistRuntimeEvents } from '../persistence/event-store.js';
import { defaultMemoryStore } from '../persistence/memory-store.js';
import { persistRunState } from '../persistence/run-store.js';
import { adaptModelResponseToTurnOutcome } from '../runtime/adapt-model-response-to-turn-outcome.js';
import type { AgentLoopSnapshot } from '../runtime/agent-loop.js';
import { createAutoContinuePolicyGate } from '../runtime/auto-continue-policy.js';
import { bindAvailableTools } from '../runtime/bind-available-tools.js';
import {
	type ToolCallOutcome,
	continueAssistantResponseFastPath,
} from '../runtime/continue-model-turn.js';
import { ingestToolResult } from '../runtime/ingest-tool-result.js';
import { orchestrateMemoryWrite } from '../runtime/orchestrate-memory-write.js';
import { requestApproval } from '../runtime/request-approval.js';
import { runAgentLoop } from '../runtime/run-agent-loop.js';
import type {
	RunModelTurnFailureResult,
	RunModelTurnInput,
	RunModelTurnResult,
} from '../runtime/run-model-turn.js';
import { runToolStep } from '../runtime/run-tool-step.js';
import { buildRunStartedEvent, buildStateEnteredEvent } from '../runtime/runtime-events.js';
import { buildRunFailedEvent } from '../runtime/runtime-events.js';
import {
	buildLiveModelRequest,
	buildLiveWorkspaceLayer,
	canPersistLiveMemory,
	extractUserTurn,
	getLiveMemoryScopeId,
	getLiveUserPreferenceScopeId,
	getLiveWorkingDirectory,
	logLiveMemoryWriteFailure,
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
import { getDefaultToolRegistry, getPolicyWiring } from './runtime-dependencies.js';
import {
	type WebSocketConnection,
	createAcceptedMessage,
	createFinishedMessage,
	createPresentationBlocksMessage,
	createRuntimeEventMessage,
	sendServerMessage,
} from './transport.js';

type LoopRuntimeProgressEvent = Extract<
	RuntimeEvent,
	{ readonly event_type: 'model.completed' | 'run.completed' | 'run.failed' | 'state.entered' }
>;

function isRuntimeEventEnvelope(event: AnyRuntimeEvent): event is RuntimeEvent {
	return (
		event.event_type === 'model.completed' ||
		event.event_type === 'run.completed' ||
		event.event_type === 'run.failed' ||
		event.event_type === 'run.started' ||
		event.event_type === 'state.entered'
	);
}

function isRuntimeEvent(event: TurnProgressEvent): event is LoopRuntimeProgressEvent {
	return isRuntimeEventEnvelope(event);
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

function getNextRuntimeSequenceNo(events: readonly RuntimeEvent[]): number {
	const lastEvent = events[events.length - 1];

	return (lastEvent?.sequence_no ?? 0) + 1;
}

function buildTerminalFailureMessage(snapshot: AgentLoopSnapshot): string {
	if (snapshot.failure?.error_message) {
		return snapshot.failure.error_message;
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

interface FinalizeLiveRunResultOptions {
	readonly persist_live_memory_write: boolean;
	readonly working_directory: string;
}

interface ExecuteLiveRunOptions {
	readonly initial_runtime_state?: RuntimeState;
	readonly initial_tool_result?: ToolResult;
	readonly initial_turn_count?: number;
	readonly memoryStore?: MemoryOrchestrationStore;
	readonly policy_wiring?: WebSocketPolicyWiring;
	readonly registry: ReturnType<typeof getDefaultToolRegistry>;
	readonly workingDirectory: string;
	readonly workspace_layer?: WorkspaceLayer;
}

function createRunModelTurnFailureResult(
	input: Readonly<{
		readonly current_state: RuntimeState;
		readonly error_message: string;
		readonly model_response?: ModelResponse;
		readonly model_turn_outcome?: ToolCallOutcome;
		readonly resolved_model_request?: ModelRequest;
	}>,
): RunModelTurnFailureResult {
	return {
		continuation_result: {
			call_id: input.model_turn_outcome?.call_id,
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
			tool_name: input.model_turn_outcome?.tool_name,
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
	};
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
): Promise<RunModelTurnResult> {
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
	let modelResponse: ModelResponse;

	try {
		modelResponse = await input.model_gateway.generate(resolvedModelRequest);
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown model generate failure.';

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
			resolved_model_request: resolvedModelRequest,
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
			resolved_model_request: resolvedModelRequest,
			status: 'completed',
		};
	}

	const toolDefinition = input.registry.get(adaptedOutcomeResult.outcome.tool_name);

	if (!toolDefinition) {
		return createRunModelTurnFailureResult({
			current_state: input.current_state,
			error_message: `Tool not found in registry: ${adaptedOutcomeResult.outcome.tool_name}`,
			model_response: modelResponse,
			model_turn_outcome: adaptedOutcomeResult.outcome,
			resolved_model_request: resolvedModelRequest,
		});
	}

	const permissionEvaluation = await policyWiring.evaluateToolPermission(socket, {
		call_id: adaptedOutcomeResult.outcome.call_id,
		tool_definition: toolDefinition,
	});

	switch (permissionEvaluation.decision.decision) {
		case 'allow': {
			await policyWiring.recordOutcome(socket, {
				decision: permissionEvaluation.decision,
				outcome: 'allowed',
			});

			const toolStepResult = await runToolStep({
				bypass_approval_gate: true,
				current_state: input.current_state,
				execution_context: input.execution_context,
				registry: input.registry,
				run_id: input.run_id,
				tool_input: {
					arguments: adaptedOutcomeResult.outcome.tool_input,
					call_id: adaptedOutcomeResult.outcome.call_id,
					tool_name: adaptedOutcomeResult.outcome.tool_name,
				},
				tool_name: adaptedOutcomeResult.outcome.tool_name,
				trace_id: input.trace_id,
			});

			if (toolStepResult.status === 'failed') {
				return createRunModelTurnFailureResult({
					current_state: input.current_state,
					error_message: toolStepResult.failure.message,
					model_response: modelResponse,
					model_turn_outcome: adaptedOutcomeResult.outcome,
					resolved_model_request: resolvedModelRequest,
				});
			}

			if (toolStepResult.status === 'approval_required') {
				return createRunModelTurnFailureResult({
					current_state: input.current_state,
					error_message: 'Policy allow path unexpectedly requested approval again.',
					model_response: modelResponse,
					model_turn_outcome: adaptedOutcomeResult.outcome,
					resolved_model_request: resolvedModelRequest,
				});
			}

			const ingestionResult = ingestToolResult({
				call_id: adaptedOutcomeResult.outcome.call_id,
				current_state: toolStepResult.final_state,
				run_id: input.run_id,
				tool_name: toolStepResult.tool_name,
				tool_result: toolStepResult.tool_result,
				trace_id: input.trace_id,
			});

			if (ingestionResult.status === 'failed') {
				return createRunModelTurnFailureResult({
					current_state: input.current_state,
					error_message: ingestionResult.failure.message,
					model_response: modelResponse,
					model_turn_outcome: adaptedOutcomeResult.outcome,
					resolved_model_request: resolvedModelRequest,
				});
			}

			return {
				continuation_result: {
					call_id: ingestionResult.call_id,
					events: toolStepResult.events,
					final_state: ingestionResult.final_state,
					ingested_result: ingestionResult.ingested_result,
					outcome_kind: 'tool_call',
					state_transitions: toolStepResult.state_transitions,
					status: 'completed',
					suggested_next_state: ingestionResult.suggested_next_state,
					tool_name: ingestionResult.tool_name,
					tool_result: ingestionResult.tool_result,
				},
				final_state: ingestionResult.final_state,
				ingested_result: ingestionResult.ingested_result,
				model_response: modelResponse,
				model_turn_outcome: adaptedOutcomeResult.outcome,
				resolved_model_request: resolvedModelRequest,
				status: 'completed',
				suggested_next_state: ingestionResult.suggested_next_state,
				tool_result: ingestionResult.tool_result,
			};
		}
		case 'require_approval': {
			const approvalResult = requestApproval({
				call_id: adaptedOutcomeResult.outcome.call_id,
				current_state: input.current_state,
				requires_reason: permissionEvaluation.decision.approval_requirement.requires_reason,
				run_id: input.run_id,
				tool_definition:
					permissionEvaluation.decision.reason === 'approval_required_by_policy'
						? cloneToolDefinitionWithApprovalRequired(toolDefinition)
						: toolDefinition,
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
					model_turn_outcome: adaptedOutcomeResult.outcome,
					resolved_model_request: resolvedModelRequest,
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
					call_id: adaptedOutcomeResult.outcome.call_id,
					events: [],
					final_state: approvalResult.final_state,
					outcome_kind: 'tool_call',
					state_transitions: approvalResult.state_transitions,
					status: 'approval_required',
					tool_name: adaptedOutcomeResult.outcome.tool_name,
				},
				final_state: approvalResult.final_state,
				model_response: modelResponse,
				model_turn_outcome: adaptedOutcomeResult.outcome,
				resolved_model_request: resolvedModelRequest,
				status: 'approval_required',
			};
		}
		case 'deny': {
			const outcomeResult = await policyWiring.recordOutcome(socket, {
				decision: permissionEvaluation.decision,
				outcome: 'denied',
			});
			const denialMessage =
				outcomeResult.pause_transition === 'entered'
					? `Permission denied for ${adaptedOutcomeResult.outcome.tool_name}; session paused after consecutive denials.`
					: `Permission denied for ${adaptedOutcomeResult.outcome.tool_name}.`;

			return createRunModelTurnFailureResult({
				current_state: input.current_state,
				error_message: denialMessage,
				model_response: modelResponse,
				model_turn_outcome: adaptedOutcomeResult.outcome,
				resolved_model_request: resolvedModelRequest,
			});
		}
		case 'pause':
			return createRunModelTurnFailureResult({
				current_state: input.current_state,
				error_message:
					'Session is paused after consecutive permission denials; approval is required before continuing.',
				model_response: modelResponse,
				model_turn_outcome: adaptedOutcomeResult.outcome,
				resolved_model_request: resolvedModelRequest,
			});
	}
}

async function executeLiveRun(
	socket: WebSocketConnection,
	payload: RunRequestPayload,
	options: ExecuteLiveRunOptions,
): Promise<RunToolWebSocketResult> {
	const workspaceLayer =
		options.workspace_layer ?? (await buildLiveWorkspaceLayer(payload, options.workingDirectory));
	const policyWiring = getPolicyWiring(options);
	const gateway = createModelGateway({
		config: payload.provider_config,
		provider: payload.provider,
	});
	const events: AnyRuntimeEvent[] = [];
	const runtimeEvents: RuntimeEvent[] = [];
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
		build_model_request: async (input) =>
			buildLiveModelRequest(payload, options.workingDirectory, {
				current_state: input.snapshot.current_runtime_state,
				latest_tool_result: input.snapshot.tool_result,
				memoryStore: options.memoryStore,
				workspace_layer: workspaceLayer,
			}),
		config: {
			max_turns: 200,
			stop_conditions: {},
		},
		continue_gate: continueGate,
		execution_context: {
			working_directory: options.workingDirectory,
		},
		initial_runtime_state: options.initial_runtime_state,
		initial_tool_result: options.initial_tool_result,
		initial_turn_count: options.initial_turn_count,
		model_gateway: gateway,
		registry: options.registry,
		run_id: payload.run_id,
		run_model_turn: (input) => runPolicyAwareModelTurn(socket, input, policyWiring),
		on_yield: ({ snapshot, yield: loopYield }) => {
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
				pending_tool_call: snapshot.pending_tool_call,
				tool_arguments: snapshot.tool_arguments,
				tool_result: hasNewToolResult ? snapshot.tool_result : undefined,
				working_directory: options.workingDirectory,
			});

			if (turnPresentationBlocks.length === 0) {
				return;
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
			appendTerminalRuntimeEventsIfNeeded(
				appendAndSendRuntimeEvent,
				payload,
				runtimeEvents,
				finalSnapshot,
			);

			return {
				approval_request: finalSnapshot.approval_request,
				assistant_text: finalSnapshot.assistant_text,
				error_code:
					finalSnapshot.failure?.error_code ??
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
				pending_tool_call: finalSnapshot.pending_tool_call,
				runtime_events: runtimeEvents,
				status: toLoopRunStatus(finalSnapshot),
				tool_arguments: finalSnapshot.tool_arguments,
				tool_result: finalSnapshot.tool_result,
				turn_count: finalSnapshot.turn_count,
				workspace_layer: workspaceLayer,
			};
		}

		if (iteration.value.type === 'turn.started') {
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

async function finalizeLiveRunResult(
	socket: WebSocketConnection,
	payload: RunRequestPayload,
	result: RunToolWebSocketResult,
	options: RuntimeWebSocketHandlerOptions & {
		readonly approvalStore: ApprovalStore;
	},
	finalizeOptions: FinalizeLiveRunResultOptions,
): Promise<void> {
	const persistEvents = options.persistEvents ?? persistRuntimeEvents;
	const persistRunStateRecord = options.persistRunState ?? persistRunState;

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
		current_state: result.final_state,
		last_error_code: result.status === 'failed' ? result.error_code : undefined,
		recorded_at: result.runtime_events.at(-1)?.timestamp,
		run_id: payload.run_id,
		trace_id: payload.trace_id,
	});

	const automaticApprovalPresentationInputs = createAutomaticApprovalPresentationInputs(
		result,
		finalizeOptions.working_directory,
		payload,
	);

	await persistApprovalPresentationInputs(
		options.approvalStore,
		automaticApprovalPresentationInputs,
		approvalPersistenceScopeFromAuthContext(options.auth_context),
	);

	const presentationAdditionalBlocks =
		payload.include_presentation_blocks === true
			? await createAdditionalPresentationBlocks({
					approvalStore: options.approvalStore,
					automaticApprovalPresentationInputs,
					approvalPersistenceScope: approvalPersistenceScopeFromAuthContext(options.auth_context),
					hooks: options,
					payload,
					result,
				})
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
	}

	const finishedMessage = createFinishedMessage(payload, result);

	if (finishedMessage) {
		sendServerMessage(socket, finishedMessage);
	}
}

export async function resumeApprovedAutoContinue(
	_socket: WebSocketConnection,
	pendingApproval: PendingApprovalEntry,
	options: RuntimeWebSocketHandlerOptions & {
		readonly approvalStore: ApprovalStore;
	},
): Promise<boolean> {
	if (pendingApproval.auto_continue_context === undefined) {
		return false;
	}

	const pendingContext = pendingApproval.auto_continue_context;
	const toolRegistry = options.toolRegistry ?? getDefaultToolRegistry();
	const continuationResult = await executeLiveRun(_socket, pendingContext.payload, {
		initial_runtime_state: 'TOOL_RESULT_INGESTING',
		initial_tool_result: pendingContext.tool_result,
		initial_turn_count: pendingContext.turn_count,
		memoryStore: options.memoryStore,
		policy_wiring: options.policy_wiring,
		registry: toolRegistry,
		workingDirectory: pendingContext.working_directory,
	});

	await finalizeLiveRunResult(_socket, pendingContext.payload, continuationResult, options, {
		persist_live_memory_write: false,
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
	if (result.status === 'failed' || !canPersistLiveMemory(memoryStore)) {
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
	sendServerMessage(socket, createAcceptedMessage(payload));

	const toolRegistry = options.toolRegistry ?? getDefaultToolRegistry();
	const workingDirectory = getLiveWorkingDirectory();
	const result = await executeLiveRun(socket, payload, {
		memoryStore: options.memoryStore,
		policy_wiring: options.policy_wiring,
		registry: toolRegistry,
		workingDirectory,
	});
	await finalizeLiveRunResult(socket, payload, result, options, {
		persist_live_memory_write: true,
		working_directory: workingDirectory,
	});
}
