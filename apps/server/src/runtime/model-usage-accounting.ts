import type { EventMetadata, ModelRequest, ModelResponse } from '@runa/types';

import {
	type CompiledContextUsage,
	type TextUsageEstimate,
	estimateTextUsage,
	measureCompiledContextUsage,
	stableSerializeContextValue,
} from '../context/compiled-context-text.js';

export const MODEL_USAGE_METADATA_KEY = 'model_usage';

export interface RequestMessageUsageSummary extends TextUsageEstimate {
	readonly message_count: number;
}

export interface RequestToolUsageSummary extends TextUsageEstimate {
	readonly tool_count: number;
}

export interface ModelRequestUsageSummary {
	readonly available_tools?: RequestToolUsageSummary;
	readonly compiled_context?: CompiledContextUsage;
	readonly measurement: 'approximate';
	readonly messages: RequestMessageUsageSummary;
	readonly total: TextUsageEstimate;
}

export interface ModelResponseUsageSummary extends TextUsageEstimate {
	readonly input_tokens?: number;
	readonly measurement: 'approximate' | 'provider';
	readonly output_tokens?: number;
}

export interface ModelUsageSummary {
	readonly request: ModelRequestUsageSummary;
	readonly response: ModelResponseUsageSummary;
}

interface MetadataCandidate extends Readonly<Record<string, unknown>> {
	readonly [MODEL_USAGE_METADATA_KEY]?: unknown;
}

interface TextUsageEstimateCandidate extends Readonly<Record<string, unknown>> {
	readonly char_count?: unknown;
	readonly token_count?: unknown;
}

interface CompiledContextLayerUsageCandidate extends TextUsageEstimateCandidate {
	readonly kind?: unknown;
	readonly name?: unknown;
}

interface CompiledContextUsageCandidate extends Readonly<Record<string, unknown>> {
	readonly layer_count?: unknown;
	readonly layers?: unknown;
	readonly total?: unknown;
}

interface RequestMessageUsageSummaryCandidate extends TextUsageEstimateCandidate {
	readonly message_count?: unknown;
}

interface RequestToolUsageSummaryCandidate extends TextUsageEstimateCandidate {
	readonly tool_count?: unknown;
}

interface ModelRequestUsageSummaryCandidate extends Readonly<Record<string, unknown>> {
	readonly available_tools?: unknown;
	readonly compiled_context?: unknown;
	readonly measurement?: unknown;
	readonly messages?: unknown;
	readonly total?: unknown;
}

interface ModelResponseUsageSummaryCandidate extends TextUsageEstimateCandidate {
	readonly input_tokens?: unknown;
	readonly measurement?: unknown;
	readonly output_tokens?: unknown;
}

interface ModelUsageSummaryCandidate extends Readonly<Record<string, unknown>> {
	readonly request?: unknown;
	readonly response?: unknown;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function sumTextUsage(usages: readonly TextUsageEstimate[]): TextUsageEstimate {
	return usages.reduce<TextUsageEstimate>(
		(total, usage) => ({
			char_count: total.char_count + usage.char_count,
			token_count: total.token_count + usage.token_count,
		}),
		{
			char_count: 0,
			token_count: 0,
		},
	);
}

function measureMessageUsage(
	messages: readonly ModelRequest['messages'][number][],
): RequestMessageUsageSummary {
	const usages = messages.map((message) =>
		estimateTextUsage(`[${message.role}]\n${message.content}`),
	);
	const total = sumTextUsage(usages);

	return {
		...total,
		message_count: messages.length,
	};
}

function measureAvailableToolUsage(
	availableTools: ModelRequest['available_tools'],
): RequestToolUsageSummary | undefined {
	if (!availableTools || availableTools.length === 0) {
		return undefined;
	}

	return {
		...estimateTextUsage(stableSerializeContextValue(availableTools)),
		tool_count: availableTools.length,
	};
}

function measureResponseTextUsage(response: ModelResponse): TextUsageEstimate {
	return estimateTextUsage(
		stableSerializeContextValue({
			message: response.message,
			tool_call_candidate: response.tool_call_candidate,
		}),
	);
}

function measureResponseUsage(response: ModelResponse): ModelResponseUsageSummary {
	const textUsage = measureResponseTextUsage(response);
	const inputTokens = response.usage?.input_tokens;
	const outputTokens = response.usage?.output_tokens;
	const totalTokens = response.usage?.total_tokens;
	const hasProviderUsage =
		isFiniteNumber(inputTokens) || isFiniteNumber(outputTokens) || isFiniteNumber(totalTokens);
	const providerTokenCount =
		(isFiniteNumber(totalTokens) ? totalTokens : undefined) ??
		(isFiniteNumber(inputTokens) && isFiniteNumber(outputTokens)
			? inputTokens + outputTokens
			: undefined) ??
		(isFiniteNumber(outputTokens) ? outputTokens : undefined) ??
		(isFiniteNumber(inputTokens) ? inputTokens : undefined);

	if (hasProviderUsage && providerTokenCount !== undefined) {
		return {
			char_count: textUsage.char_count,
			input_tokens: isFiniteNumber(inputTokens) ? inputTokens : undefined,
			measurement: 'provider',
			output_tokens: isFiniteNumber(outputTokens) ? outputTokens : undefined,
			token_count: providerTokenCount,
		};
	}

	return {
		...textUsage,
		measurement: 'approximate',
	};
}

export function createModelUsageSummary(input: {
	readonly model_request: ModelRequest;
	readonly model_response: ModelResponse;
}): ModelUsageSummary {
	const compiledContextUsage = measureCompiledContextUsage(input.model_request.compiled_context);
	const messageUsage = measureMessageUsage(input.model_request.messages);
	const availableToolUsage = measureAvailableToolUsage(input.model_request.available_tools);
	const requestTotal = sumTextUsage(
		[messageUsage, compiledContextUsage?.total, availableToolUsage].filter(
			(usage): usage is TextUsageEstimate => usage !== undefined,
		),
	);

	return {
		request: {
			available_tools: availableToolUsage,
			compiled_context: compiledContextUsage,
			measurement: 'approximate',
			messages: messageUsage,
			total: requestTotal,
		},
		response: measureResponseUsage(input.model_response),
	};
}

export function buildModelUsageEventMetadata(input: {
	readonly model_request: ModelRequest;
	readonly model_response: ModelResponse;
}): EventMetadata {
	return {
		[MODEL_USAGE_METADATA_KEY]: createModelUsageSummary(input),
	};
}

function isTextUsageEstimate(value: unknown): value is TextUsageEstimate {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as TextUsageEstimateCandidate;

	return isFiniteNumber(candidate.char_count) && isFiniteNumber(candidate.token_count);
}

function isCompiledContextLayerUsage(
	value: unknown,
): value is CompiledContextUsage['layers'][number] {
	if (!isRecord(value) || !isTextUsageEstimate(value)) {
		return false;
	}

	const candidate = value as CompiledContextLayerUsageCandidate;

	return typeof candidate.name === 'string' && typeof candidate.kind === 'string';
}

function isCompiledContextUsage(value: unknown): value is CompiledContextUsage {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as CompiledContextUsageCandidate;
	const layers = candidate.layers;

	return (
		isFiniteNumber(candidate.layer_count) &&
		Array.isArray(layers) &&
		layers.every((layer) => isCompiledContextLayerUsage(layer)) &&
		isTextUsageEstimate(candidate.total)
	);
}

function isRequestMessageUsageSummary(value: unknown): value is RequestMessageUsageSummary {
	if (!isRecord(value) || !isTextUsageEstimate(value)) {
		return false;
	}

	const candidate = value as RequestMessageUsageSummaryCandidate;

	return isFiniteNumber(candidate.message_count);
}

function isRequestToolUsageSummary(value: unknown): value is RequestToolUsageSummary {
	if (!isRecord(value) || !isTextUsageEstimate(value)) {
		return false;
	}

	const candidate = value as RequestToolUsageSummaryCandidate;

	return isFiniteNumber(candidate.tool_count);
}

function isModelRequestUsageSummary(value: unknown): value is ModelRequestUsageSummary {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as ModelRequestUsageSummaryCandidate;

	return (
		candidate.measurement === 'approximate' &&
		isRequestMessageUsageSummary(candidate.messages) &&
		(candidate.compiled_context === undefined ||
			isCompiledContextUsage(candidate.compiled_context)) &&
		(candidate.available_tools === undefined ||
			isRequestToolUsageSummary(candidate.available_tools)) &&
		isTextUsageEstimate(candidate.total)
	);
}

function isModelResponseUsageSummary(value: unknown): value is ModelResponseUsageSummary {
	if (!isRecord(value) || !isTextUsageEstimate(value)) {
		return false;
	}

	const candidate = value as ModelResponseUsageSummaryCandidate;

	return (
		(candidate.measurement === 'approximate' || candidate.measurement === 'provider') &&
		(candidate.input_tokens === undefined || isFiniteNumber(candidate.input_tokens)) &&
		(candidate.output_tokens === undefined || isFiniteNumber(candidate.output_tokens))
	);
}

function isModelUsageSummary(value: unknown): value is ModelUsageSummary {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as ModelUsageSummaryCandidate;

	return (
		isModelRequestUsageSummary(candidate.request) && isModelResponseUsageSummary(candidate.response)
	);
}

export function readModelUsageEventMetadata(
	metadata?: EventMetadata,
): ModelUsageSummary | undefined {
	if (!isRecord(metadata)) {
		return undefined;
	}

	const candidate = (metadata as MetadataCandidate)[MODEL_USAGE_METADATA_KEY];

	return isModelUsageSummary(candidate) ? candidate : undefined;
}
