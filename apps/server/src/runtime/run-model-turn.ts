import type {
	ApprovalRequest,
	ModelGateway,
	ModelRequest,
	ModelResponse,
	RuntimeState,
	ToolExecutionContext,
	ToolName,
	ToolResult,
} from '@runa/types';

import type { RunRecordWriter } from '../persistence/run-store.js';
import type {
	ContinueModelTurnApprovalRequiredResult,
	ContinueModelTurnAssistantResponseResult,
	ContinueModelTurnFailureResult,
	ContinueModelTurnResult,
	ContinueModelTurnToolCallResult,
	ModelTurnOutcome,
} from './continue-model-turn.js';
import type { IngestedToolResult } from './ingest-tool-result.js';
import type { TokenLimitRecovery } from './token-limit-recovery.js';

import type { ToolRegistry } from '../tools/registry.js';

import { hasRunStoreConfiguration, persistRunState } from '../persistence/run-store.js';
import { adaptModelResponseToTurnOutcome } from './adapt-model-response-to-turn-outcome.js';
import { bindAvailableTools } from './bind-available-tools.js';
import { continueAssistantResponseFastPath, continueModelTurn } from './continue-model-turn.js';

interface RunModelTurnFailure {
	readonly cause?: unknown;
	readonly code:
		| 'AVAILABLE_TOOLS_BINDING_FAILED'
		| 'INVALID_CURRENT_STATE'
		| 'MODEL_GENERATE_FAILED'
		| 'MODEL_RESPONSE_ADAPTATION_FAILED'
		| 'RUN_STATE_PERSISTENCE_FAILED'
		| 'TURN_CONTINUATION_FAILED';
	readonly message: string;
}

export interface RunModelTurnInput {
	readonly current_state: RuntimeState;
	readonly execution_context: ToolExecutionContext;
	readonly model_gateway: ModelGateway;
	readonly model_request: ModelRequest;
	readonly persistence_writer?: RunRecordWriter;
	readonly registry: ToolRegistry;
	readonly run_id: string;
	readonly token_limit_recovery?: TokenLimitRecovery;
	readonly tool_names?: readonly ToolName[];
	readonly trace_id: string;
}

export interface RunModelTurnAssistantResponseResult {
	readonly assistant_text: string;
	readonly continuation_result: ContinueModelTurnAssistantResponseResult;
	readonly final_state: 'COMPLETED';
	readonly model_response: ModelResponse;
	readonly model_turn_outcome: Extract<ModelTurnOutcome, { kind: 'assistant_response' }>;
	readonly resolved_model_request: ModelRequest;
	readonly status: 'completed';
}

export interface RunModelTurnToolCallResult {
	readonly continuation_result: ContinueModelTurnToolCallResult;
	readonly final_state: 'TOOL_RESULT_INGESTING';
	readonly ingested_result: IngestedToolResult;
	readonly model_response: ModelResponse;
	readonly model_turn_outcome: Extract<ModelTurnOutcome, { kind: 'tool_call' }>;
	readonly resolved_model_request: ModelRequest;
	readonly status: 'completed';
	readonly suggested_next_state: 'MODEL_THINKING';
	readonly tool_result: ToolResult;
}

export interface RunModelTurnApprovalRequiredResult {
	readonly approval_event: ContinueModelTurnApprovalRequiredResult['approval_event'];
	readonly approval_request: ApprovalRequest;
	readonly continuation_result: ContinueModelTurnApprovalRequiredResult;
	readonly final_state: 'WAITING_APPROVAL';
	readonly model_response: ModelResponse;
	readonly model_turn_outcome: Extract<ModelTurnOutcome, { kind: 'tool_call' }>;
	readonly resolved_model_request: ModelRequest;
	readonly status: 'approval_required';
}

export interface RunModelTurnFailureResult {
	readonly continuation_result?: ContinueModelTurnFailureResult;
	readonly failure: RunModelTurnFailure;
	readonly final_state: 'FAILED';
	readonly model_response?: ModelResponse;
	readonly model_turn_outcome?: ModelTurnOutcome;
	readonly resolved_model_request?: ModelRequest;
	readonly status: 'failed';
}

export type RunModelTurnResult =
	| RunModelTurnAssistantResponseResult
	| RunModelTurnApprovalRequiredResult
	| RunModelTurnToolCallResult
	| RunModelTurnFailureResult;

function createFailure(
	code: RunModelTurnFailure['code'],
	message: string,
	cause?: unknown,
): RunModelTurnFailure {
	return {
		cause,
		code,
		message,
	};
}

function toGenerateFailureMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return 'Unknown model generate failure.';
}

function shouldPersist(input: RunModelTurnInput): boolean {
	return input.persistence_writer !== undefined || hasRunStoreConfiguration();
}

async function persistRunStateIfConfigured(
	input: RunModelTurnInput,
	currentState: RuntimeState,
	lastErrorCode?: string,
	recordedAt?: string,
): Promise<RunModelTurnFailure | undefined> {
	if (!shouldPersist(input)) {
		return undefined;
	}

	try {
		await persistRunState(
			{
				current_state: currentState,
				last_error_code: lastErrorCode,
				recorded_at: recordedAt,
				run_id: input.run_id,
				trace_id: input.trace_id,
			},
			{
				writer: input.persistence_writer,
			},
		);
		return undefined;
	} catch (error: unknown) {
		return createFailure(
			'RUN_STATE_PERSISTENCE_FAILED',
			`Run state persistence failed: ${toGenerateFailureMessage(error)}`,
			error,
		);
	}
}

function createFailureResult(
	failure: RunModelTurnFailure,
	options: Readonly<{
		continuation_result?: ContinueModelTurnFailureResult;
		model_response?: ModelResponse;
		model_turn_outcome?: ModelTurnOutcome;
		resolved_model_request?: ModelRequest;
	}> = {},
): RunModelTurnFailureResult {
	return {
		continuation_result: options.continuation_result,
		failure,
		final_state: 'FAILED',
		model_response: options.model_response,
		model_turn_outcome: options.model_turn_outcome,
		resolved_model_request: options.resolved_model_request,
		status: 'failed',
	};
}

function resolveModelRequest(input: RunModelTurnInput):
	| {
			readonly model_request: ModelRequest;
			readonly status: 'completed';
	  }
	| {
			readonly failure: RunModelTurnFailure;
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
			failure: createFailure(
				'AVAILABLE_TOOLS_BINDING_FAILED',
				bindingResult.failure.message,
				bindingResult.failure,
			),
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

function toSuccessResult(
	modelResponse: ModelResponse,
	modelTurnOutcome: ModelTurnOutcome,
	continuationResult: ContinueModelTurnResult,
	resolvedModelRequest: ModelRequest,
):
	| RunModelTurnApprovalRequiredResult
	| RunModelTurnAssistantResponseResult
	| RunModelTurnToolCallResult
	| RunModelTurnFailureResult {
	if (continuationResult.status === 'failed') {
		return createFailureResult(
			createFailure(
				'TURN_CONTINUATION_FAILED',
				continuationResult.failure.message,
				continuationResult.failure,
			),
			{
				continuation_result: continuationResult,
				model_response: modelResponse,
				model_turn_outcome: modelTurnOutcome,
			},
		);
	}

	if (continuationResult.outcome_kind === 'assistant_response') {
		if (modelTurnOutcome.kind !== 'assistant_response') {
			return createFailureResult(
				createFailure(
					'TURN_CONTINUATION_FAILED',
					'Continuation result did not match the adapted model turn outcome.',
				),
				{
					model_response: modelResponse,
					model_turn_outcome: modelTurnOutcome,
				},
			);
		}

		return {
			assistant_text: continuationResult.assistant_text,
			continuation_result: continuationResult,
			final_state: continuationResult.final_state,
			model_response: modelResponse,
			model_turn_outcome: modelTurnOutcome,
			resolved_model_request: resolvedModelRequest,
			status: 'completed',
		};
	}

	if (continuationResult.status === 'approval_required') {
		if (modelTurnOutcome.kind !== 'tool_call') {
			return createFailureResult(
				createFailure(
					'TURN_CONTINUATION_FAILED',
					'Continuation result did not match the adapted model turn outcome.',
				),
				{
					model_response: modelResponse,
					model_turn_outcome: modelTurnOutcome,
				},
			);
		}

		return {
			approval_event: continuationResult.approval_event,
			approval_request: continuationResult.approval_request,
			continuation_result: continuationResult,
			final_state: continuationResult.final_state,
			model_response: modelResponse,
			model_turn_outcome: modelTurnOutcome,
			resolved_model_request: resolvedModelRequest,
			status: 'approval_required',
		};
	}

	if (modelTurnOutcome.kind !== 'tool_call') {
		return createFailureResult(
			createFailure(
				'TURN_CONTINUATION_FAILED',
				'Continuation result did not match the adapted model turn outcome.',
			),
			{
				model_response: modelResponse,
				model_turn_outcome: modelTurnOutcome,
			},
		);
	}

	return {
		continuation_result: continuationResult,
		final_state: continuationResult.final_state,
		ingested_result: continuationResult.ingested_result,
		model_response: modelResponse,
		model_turn_outcome: modelTurnOutcome,
		resolved_model_request: resolvedModelRequest,
		status: 'completed',
		suggested_next_state: continuationResult.suggested_next_state,
		tool_result: continuationResult.tool_result,
	};
}

export async function runModelTurn(input: RunModelTurnInput): Promise<RunModelTurnResult> {
	const startedAt = new Date().toISOString();

	if (input.current_state !== 'MODEL_THINKING') {
		const failure = createFailure(
			'INVALID_CURRENT_STATE',
			`runModelTurn expects MODEL_THINKING but received ${input.current_state}`,
		);

		const persistenceFailure = await persistRunStateIfConfigured(
			input,
			'FAILED',
			failure.code,
			startedAt,
		);

		return createFailureResult(persistenceFailure ?? failure);
	}

	const initialPersistenceFailure = await persistRunStateIfConfigured(
		input,
		'MODEL_THINKING',
		undefined,
		startedAt,
	);

	if (initialPersistenceFailure) {
		return createFailureResult(initialPersistenceFailure);
	}

	const modelRequestResult = resolveModelRequest(input);

	if (modelRequestResult.status === 'failed') {
		const persistenceFailure = await persistRunStateIfConfigured(
			input,
			'FAILED',
			modelRequestResult.failure.code,
			new Date().toISOString(),
		);

		return createFailureResult(persistenceFailure ?? modelRequestResult.failure);
	}

	const resolvedModelRequest = modelRequestResult.model_request;
	let modelResponse: ModelResponse;
	let finalModelRequest = resolvedModelRequest;

	try {
		modelResponse = await input.model_gateway.generate(resolvedModelRequest);
	} catch (error: unknown) {
		if (input.token_limit_recovery !== undefined) {
			const recoveryResult = await input.token_limit_recovery.recover({
				error,
				model_request: resolvedModelRequest,
				retry_executor(request) {
					return input.model_gateway.generate(request);
				},
			});

			if (recoveryResult.status === 'recovered') {
				modelResponse = recoveryResult.model_response;
				finalModelRequest = recoveryResult.model_request;
			} else {
				const recoveryMessage =
					recoveryResult.status === 'unrecoverable'
						? ` after token limit recovery: ${recoveryResult.reason}`
						: '';
				const failure = createFailure(
					'MODEL_GENERATE_FAILED',
					`Model generate failed${recoveryMessage}: ${toGenerateFailureMessage(error)}`,
					recoveryResult.status === 'unrecoverable' ? (recoveryResult.cause ?? error) : error,
				);

				const persistenceFailure = await persistRunStateIfConfigured(
					input,
					'FAILED',
					failure.code,
					new Date().toISOString(),
				);

				return createFailureResult(persistenceFailure ?? failure, {
					resolved_model_request: resolvedModelRequest,
				});
			}
		} else {
			const failure = createFailure(
				'MODEL_GENERATE_FAILED',
				`Model generate failed: ${toGenerateFailureMessage(error)}`,
				error,
			);

			const persistenceFailure = await persistRunStateIfConfigured(
				input,
				'FAILED',
				failure.code,
				new Date().toISOString(),
			);

			return createFailureResult(persistenceFailure ?? failure, {
				resolved_model_request: resolvedModelRequest,
			});
		}
	}

	const adaptedOutcomeResult = adaptModelResponseToTurnOutcome({
		model_response: modelResponse,
	});

	if (adaptedOutcomeResult.status === 'failed') {
		const failure = createFailure(
			'MODEL_RESPONSE_ADAPTATION_FAILED',
			adaptedOutcomeResult.failure.message,
			adaptedOutcomeResult.failure,
		);

		const persistenceFailure = await persistRunStateIfConfigured(
			input,
			'FAILED',
			failure.code,
			new Date().toISOString(),
		);

		return createFailureResult(persistenceFailure ?? failure, {
			model_response: modelResponse,
			resolved_model_request: resolvedModelRequest,
		});
	}

	const continuationResult =
		adaptedOutcomeResult.outcome.kind === 'assistant_response'
			? continueAssistantResponseFastPath(
					{
						current_state: input.current_state,
					},
					adaptedOutcomeResult.outcome,
				)
			: await continueModelTurn({
					current_state: input.current_state,
					execution_context: input.execution_context,
					model_turn_outcome: adaptedOutcomeResult.outcome,
					persistence_writer: input.persistence_writer,
					registry: input.registry,
					run_id: input.run_id,
					trace_id: input.trace_id,
				});

	const result = toSuccessResult(
		modelResponse,
		adaptedOutcomeResult.outcome,
		continuationResult,
		finalModelRequest,
	);
	const finalPersistenceFailure = await persistRunStateIfConfigured(
		input,
		result.final_state,
		result.status === 'failed' ? result.failure.code : undefined,
		new Date().toISOString(),
	);

	if (finalPersistenceFailure) {
		return createFailureResult(finalPersistenceFailure, {
			continuation_result: result.status === 'failed' ? result.continuation_result : undefined,
			model_response: modelResponse,
			model_turn_outcome: adaptedOutcomeResult.outcome,
			resolved_model_request: resolvedModelRequest,
		});
	}

	return result;
}
