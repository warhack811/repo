import type {
	RuntimeState,
	ToolArtifactRef,
	ToolName,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
} from '@runa/types';

import { transitionState } from './state-machine.js';

interface IngestToolResultFailure {
	readonly cause?: unknown;
	readonly code: 'INVALID_CURRENT_STATE' | 'TOOL_RESULT_MISMATCH';
	readonly message: string;
}

export interface IngestedToolSuccessResult {
	readonly artifact_ref?: ToolArtifactRef;
	readonly call_id: string;
	readonly kind: 'tool_result';
	readonly metadata?: Readonly<Record<string, unknown>>;
	readonly output: unknown;
	readonly result_status: 'success';
	readonly tool_name: ToolName;
}

export interface IngestedToolErrorResult {
	readonly call_id: string;
	readonly details?: Readonly<Record<string, unknown>>;
	readonly error_code: ToolResultError['error_code'];
	readonly error_message: string;
	readonly kind: 'tool_result';
	readonly result_status: 'error';
	readonly retryable?: boolean;
	readonly tool_name: ToolName;
}

export type IngestedToolResult = IngestedToolSuccessResult | IngestedToolErrorResult;

export interface IngestToolResultInput {
	readonly call_id: string;
	readonly current_state: RuntimeState;
	readonly run_id: string;
	readonly tool_name: ToolName;
	readonly tool_result: ToolResult;
	readonly trace_id: string;
}

export interface IngestToolResultSuccess {
	readonly call_id: string;
	readonly final_state: 'TOOL_RESULT_INGESTING';
	readonly ingested_result: IngestedToolResult;
	readonly run_id: string;
	readonly status: 'completed';
	readonly suggested_next_state: 'MODEL_THINKING';
	readonly tool_name: ToolName;
	readonly tool_result: ToolResult;
	readonly trace_id: string;
}

export interface IngestToolResultFailureResult {
	readonly call_id: string;
	readonly failure: IngestToolResultFailure;
	readonly final_state: 'FAILED';
	readonly run_id: string;
	readonly status: 'failed';
	readonly tool_name: ToolName;
	readonly trace_id: string;
}

export type IngestToolResultResult = IngestToolResultSuccess | IngestToolResultFailureResult;

function createFailure(
	code: IngestToolResultFailure['code'],
	message: string,
	cause?: unknown,
): IngestToolResultFailure {
	return {
		cause,
		code,
		message,
	};
}

function hasMatchingToolIdentity(input: IngestToolResultInput): boolean {
	return (
		input.tool_result.call_id === input.call_id && input.tool_result.tool_name === input.tool_name
	);
}

function ingestSuccessResult(result: ToolResultSuccess): IngestedToolSuccessResult {
	return {
		artifact_ref: result.artifact_ref,
		call_id: result.call_id,
		kind: 'tool_result',
		metadata: result.metadata,
		output: result.output,
		result_status: 'success',
		tool_name: result.tool_name,
	};
}

function ingestErrorResult(result: ToolResultError): IngestedToolErrorResult {
	return {
		call_id: result.call_id,
		details: result.details,
		error_code: result.error_code,
		error_message: result.error_message,
		kind: 'tool_result',
		result_status: 'error',
		retryable: result.retryable,
		tool_name: result.tool_name,
	};
}

function toIngestedToolResult(result: ToolResult): IngestedToolResult {
	if (result.status === 'success') {
		return ingestSuccessResult(result);
	}

	return ingestErrorResult(result);
}

export function ingestToolResult(input: IngestToolResultInput): IngestToolResultResult {
	if (input.current_state !== 'TOOL_RESULT_INGESTING') {
		return {
			call_id: input.call_id,
			failure: createFailure(
				'INVALID_CURRENT_STATE',
				`ingestToolResult expects TOOL_RESULT_INGESTING but received ${input.current_state}`,
			),
			final_state: 'FAILED',
			run_id: input.run_id,
			status: 'failed',
			tool_name: input.tool_name,
			trace_id: input.trace_id,
		};
	}

	if (!hasMatchingToolIdentity(input)) {
		transitionState('TOOL_RESULT_INGESTING', 'FAILED');

		return {
			call_id: input.call_id,
			failure: createFailure(
				'TOOL_RESULT_MISMATCH',
				`Tool result identity mismatch: expected ${input.tool_name}/${input.call_id} but received ${input.tool_result.tool_name}/${input.tool_result.call_id}`,
			),
			final_state: 'FAILED',
			run_id: input.run_id,
			status: 'failed',
			tool_name: input.tool_name,
			trace_id: input.trace_id,
		};
	}

	const suggestedNextState: 'MODEL_THINKING' = transitionState(
		'TOOL_RESULT_INGESTING',
		'MODEL_THINKING',
	) as 'MODEL_THINKING';

	return {
		call_id: input.call_id,
		final_state: 'TOOL_RESULT_INGESTING',
		ingested_result: toIngestedToolResult(input.tool_result),
		run_id: input.run_id,
		status: 'completed',
		suggested_next_state: suggestedNextState,
		tool_name: input.tool_name,
		tool_result: input.tool_result,
		trace_id: input.trace_id,
	};
}
