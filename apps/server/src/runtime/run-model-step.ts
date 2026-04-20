import type {
	EventActor,
	EventSource,
	ModelGateway,
	ModelRequest,
	ModelResponse,
	RuntimeEvent,
	RuntimeState,
} from '@runa/types';

import { buildModelUsageEventMetadata } from './model-usage-accounting.js';
import {
	buildModelCompletedEvent,
	buildRunCompletedEvent,
	buildRunFailedEvent,
	buildRunStartedEvent,
	buildStateEnteredEvent,
} from './runtime-events.js';
import {
	InvalidStateTransitionError,
	getAllowedNextStates,
	transitionState,
} from './state-machine.js';

interface RunModelStepMetadata {
	readonly actor?: EventActor;
	readonly request_message_id?: string;
	readonly session_id?: string;
	readonly source?: EventSource;
}

interface RunModelStepInput {
	readonly gateway: ModelGateway;
	readonly initial_state: RuntimeState;
	readonly metadata?: RunModelStepMetadata;
	readonly request: ModelRequest;
	readonly run_id: string;
	readonly trace_id: string;
}

interface RunModelStepFailure {
	readonly cause: unknown;
	readonly code?: string;
	readonly final_state: 'FAILED';
	readonly message: string;
	readonly name: string;
}

interface RunModelStepSuccess {
	readonly events: readonly RuntimeEvent[];
	readonly final_state: 'COMPLETED';
	readonly response: ModelResponse;
	readonly status: 'completed';
}

interface RunModelStepFailureResult {
	readonly events: readonly RuntimeEvent[];
	readonly failure: RunModelStepFailure;
	readonly final_state: 'FAILED';
	readonly status: 'failed';
}

export type RunModelStepResult = RunModelStepSuccess | RunModelStepFailureResult;

function normalizeFailure(error: unknown): RunModelStepFailure {
	if (error instanceof Error) {
		const errorWithCode = error as Error & { code?: string };

		return {
			cause: error,
			code: errorWithCode.code,
			final_state: 'FAILED',
			message: error.message,
			name: error.name,
		};
	}

	return {
		cause: error,
		final_state: 'FAILED',
		message: 'Unknown model step failure.',
		name: 'UnknownError',
	};
}

export async function runModelStep({
	gateway,
	initial_state,
	metadata,
	request,
	run_id,
	trace_id,
}: RunModelStepInput): Promise<RunModelStepResult> {
	const events: RuntimeEvent[] = [];

	if (initial_state !== 'INIT') {
		throw new InvalidStateTransitionError(
			initial_state,
			'MODEL_THINKING',
			getAllowedNextStates(initial_state),
		);
	}

	const thinkingState = transitionState(initial_state, 'MODEL_THINKING');

	events.push(
		buildRunStartedEvent(
			{
				entry_state: 'INIT',
				message_id: metadata?.request_message_id,
				trigger: 'user_message',
			},
			{
				actor: metadata?.actor,
				run_id,
				sequence_no: 1,
				session_id: metadata?.session_id,
				source: metadata?.source,
				trace_id,
			},
		),
	);

	events.push(
		buildStateEnteredEvent(
			{
				previous_state: initial_state,
				reason: 'model-step-started',
				state: thinkingState,
			},
			{
				actor: metadata?.actor,
				run_id,
				sequence_no: 2,
				session_id: metadata?.session_id,
				source: metadata?.source,
				state_after: thinkingState,
				state_before: initial_state,
				trace_id,
			},
		),
	);

	try {
		const response = await gateway.generate(request);

		events.push(
			buildModelCompletedEvent(
				{
					finish_reason: response.finish_reason,
					model: response.model,
					output_text: response.message.content,
					provider: response.provider,
				},
				{
					actor: metadata?.actor,
					metadata: buildModelUsageEventMetadata({
						model_request: request,
						model_response: response,
					}),
					run_id,
					sequence_no: 3,
					session_id: metadata?.session_id,
					source: metadata?.source,
					state_after: 'MODEL_THINKING',
					state_before: 'MODEL_THINKING',
					trace_id,
				},
			),
		);

		transitionState(thinkingState, 'COMPLETED');
		const completedState = 'COMPLETED';

		events.push(
			buildStateEnteredEvent(
				{
					previous_state: thinkingState,
					reason: 'model-step-succeeded',
					state: completedState,
				},
				{
					actor: metadata?.actor,
					run_id,
					sequence_no: 4,
					session_id: metadata?.session_id,
					source: metadata?.source,
					state_after: completedState,
					state_before: thinkingState,
					trace_id,
				},
			),
		);

		events.push(
			buildRunCompletedEvent(
				{
					final_state: completedState,
					output_text: response.message.content,
				},
				{
					actor: metadata?.actor,
					run_id,
					sequence_no: 5,
					session_id: metadata?.session_id,
					source: metadata?.source,
					state_after: completedState,
					state_before: 'MODEL_THINKING',
					trace_id,
				},
			),
		);

		return {
			events,
			final_state: completedState,
			response,
			status: 'completed',
		};
	} catch (error: unknown) {
		const failure = normalizeFailure(error);
		transitionState(thinkingState, 'FAILED');
		const failedState = 'FAILED';

		events.push(
			buildStateEnteredEvent(
				{
					previous_state: thinkingState,
					reason: 'model-step-failed',
					state: failedState,
				},
				{
					actor: metadata?.actor,
					run_id,
					sequence_no: 3,
					session_id: metadata?.session_id,
					source: metadata?.source,
					state_after: failedState,
					state_before: thinkingState,
					trace_id,
				},
			),
		);

		events.push(
			buildRunFailedEvent(
				{
					error_code: failure.code,
					error_message: failure.message,
					final_state: failedState,
					retryable: false,
				},
				{
					actor: metadata?.actor,
					run_id,
					sequence_no: 4,
					session_id: metadata?.session_id,
					source: metadata?.source,
					state_after: failedState,
					state_before: 'MODEL_THINKING',
					trace_id,
				},
			),
		);

		return {
			events,
			failure,
			final_state: failedState,
			status: 'failed',
		};
	}
}
