import type { ModelFinishReason, ModelResponse, ToolArguments, ToolName } from '@runa/types';

import type { ModelTurnOutcome } from './continue-model-turn.js';

interface AdaptModelResponseToTurnOutcomeFailure {
	readonly cause?: unknown;
	readonly code: 'INVALID_MODEL_RESPONSE' | 'INVALID_TOOL_CALL_CANDIDATE';
	readonly message: string;
}

export interface AdaptModelResponseToTurnOutcomeInput {
	readonly model_response: unknown;
}

export interface AdaptModelResponseToTurnOutcomeSuccess {
	readonly outcome: ModelTurnOutcome;
	readonly status: 'completed';
}

export interface AdaptModelResponseToTurnOutcomeFailureResult {
	readonly failure: AdaptModelResponseToTurnOutcomeFailure;
	readonly status: 'failed';
}

export type AdaptModelResponseToTurnOutcomeResult =
	| AdaptModelResponseToTurnOutcomeSuccess
	| AdaptModelResponseToTurnOutcomeFailureResult;

interface RawModelMessageShape {
	readonly content?: unknown;
	readonly role?: unknown;
}

interface RawToolCallCandidateShape {
	readonly call_id?: unknown;
	readonly tool_input?: unknown;
	readonly tool_name?: unknown;
}

interface RawModelResponseShape {
	readonly finish_reason?: unknown;
	readonly message?: unknown;
	readonly model?: unknown;
	readonly provider?: unknown;
	readonly response_id?: unknown;
	readonly tool_call_candidate?: unknown;
	readonly usage?: unknown;
}

function createFailure(
	code: AdaptModelResponseToTurnOutcomeFailure['code'],
	message: string,
	cause?: unknown,
): AdaptModelResponseToTurnOutcomeFailure {
	return {
		cause,
		code,
		message,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isModelFinishReason(value: unknown): value is ModelFinishReason {
	return value === 'stop' || value === 'max_tokens' || value === 'error';
}

function isToolArguments(value: unknown): value is ToolArguments {
	return isRecord(value);
}

function isToolName(value: unknown): value is ToolName {
	return typeof value === 'string' && value.trim().length > 0 && value.includes('.');
}

function isModelMessage(value: unknown): value is ModelResponse['message'] {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as RawModelMessageShape;

	return candidate.role === 'assistant' && typeof candidate.content === 'string';
}

function isToolCallCandidate(
	value: unknown,
): value is NonNullable<ModelResponse['tool_call_candidate']> {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as RawToolCallCandidateShape;

	return (
		typeof candidate.call_id === 'string' &&
		candidate.call_id.trim().length > 0 &&
		isToolName(candidate.tool_name) &&
		isToolArguments(candidate.tool_input)
	);
}

function isModelResponse(value: unknown): value is ModelResponse {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as RawModelResponseShape;

	return (
		typeof candidate.provider === 'string' &&
		typeof candidate.model === 'string' &&
		isModelMessage(candidate.message) &&
		isModelFinishReason(candidate.finish_reason) &&
		(candidate.response_id === undefined || typeof candidate.response_id === 'string') &&
		(candidate.usage === undefined || isRecord(candidate.usage)) &&
		(candidate.tool_call_candidate === undefined ||
			isToolCallCandidate(candidate.tool_call_candidate))
	);
}

function hasInvalidToolCallCandidate(value: unknown): boolean {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as RawModelResponseShape;

	return (
		candidate.tool_call_candidate !== undefined &&
		!isToolCallCandidate(candidate.tool_call_candidate)
	);
}

function toAssistantResponseOutcome(response: ModelResponse): ModelTurnOutcome {
	return {
		kind: 'assistant_response',
		text: response.message.content,
	};
}

function toToolCallOutcome(
	toolCallCandidate: NonNullable<ModelResponse['tool_call_candidate']>,
): ModelTurnOutcome {
	return {
		call_id: toolCallCandidate.call_id,
		kind: 'tool_call',
		tool_input: toolCallCandidate.tool_input,
		tool_name: toolCallCandidate.tool_name,
	};
}

export function adaptModelResponseToTurnOutcome(
	input: AdaptModelResponseToTurnOutcomeInput,
): AdaptModelResponseToTurnOutcomeResult {
	if (hasInvalidToolCallCandidate(input.model_response)) {
		return {
			failure: createFailure(
				'INVALID_TOOL_CALL_CANDIDATE',
				'Model response tool_call_candidate must include non-empty call_id, tool_name, and tool_input fields.',
			),
			status: 'failed',
		};
	}

	if (!isModelResponse(input.model_response)) {
		return {
			failure: createFailure(
				'INVALID_MODEL_RESPONSE',
				'Model response must include provider, model, finish_reason, and an assistant message.',
			),
			status: 'failed',
		};
	}

	const toolCallCandidate = input.model_response.tool_call_candidate;

	return {
		outcome:
			toolCallCandidate !== undefined
				? toToolCallOutcome(toolCallCandidate)
				: toAssistantResponseOutcome(input.model_response),
		status: 'completed',
	};
}
