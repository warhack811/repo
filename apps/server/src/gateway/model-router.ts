import { defaultGatewayModels } from '@runa/types';
import type { ModelRequest } from '@runa/types';

import type { GatewayProvider } from './providers.js';

export type ModelRouteIntent = 'balanced' | 'cheap' | 'deep_reasoning' | 'tool_heavy';

type ModelRouterMetadataContainer = Readonly<{
	model_router?: unknown;
}>;

interface ModelRouterMetadataCandidate {
	readonly allow_provider_fallback?: unknown;
	readonly enabled?: unknown;
	readonly intent?: unknown;
	readonly preferred_model?: unknown;
	readonly preferred_provider?: unknown;
}

export interface ResolvedModelRoute {
	readonly allow_provider_fallback: boolean;
	readonly intent: ModelRouteIntent;
	readonly reason:
		| 'explicit_preferred_provider'
		| 'heuristic_cheap'
		| 'heuristic_deep_reasoning'
		| 'heuristic_tool_heavy'
		| 'requested_provider';
	readonly routed_model: string;
	readonly routed_provider: GatewayProvider;
}

function isGatewayProvider(value: unknown): value is GatewayProvider {
	return (
		value === 'claude' ||
		value === 'gemini' ||
		value === 'groq' ||
		value === 'openai' ||
		value === 'sambanova'
	);
}

function isModelRouteIntent(value: unknown): value is ModelRouteIntent {
	return (
		value === 'balanced' ||
		value === 'cheap' ||
		value === 'deep_reasoning' ||
		value === 'tool_heavy'
	);
}

function isObjectRecord(
	value: unknown,
): value is Readonly<Record<string, unknown>> & ModelRouterMetadataCandidate {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readModelRouterMetadata(request: ModelRequest): ModelRouterMetadataCandidate | null {
	const metadata = request.metadata as ModelRouterMetadataContainer | undefined;
	const routerMetadata = metadata?.model_router;

	return isObjectRecord(routerMetadata) ? routerMetadata : null;
}

function collectPromptText(request: ModelRequest): string {
	return request.messages
		.map((message) => message.content.trim())
		.filter((content) => content.length > 0)
		.join('\n');
}

function includesIntentKeyword(promptText: string, keywords: readonly string[]): boolean {
	const normalizedPrompt = promptText.toLowerCase();

	return keywords.some((keyword) => normalizedPrompt.includes(keyword));
}

export function classifyModelRouteIntent(request: ModelRequest): ModelRouteIntent {
	const metadata = readModelRouterMetadata(request);

	if (isModelRouteIntent(metadata?.intent)) {
		return metadata.intent;
	}

	const availableToolCount = request.available_tools?.length ?? 0;
	const promptText = collectPromptText(request);
	const compiledLayerCount = request.compiled_context?.layers.length ?? 0;
	const promptLength = promptText.length;

	if (
		availableToolCount >= 5 ||
		compiledLayerCount >= 3 ||
		includesIntentKeyword(promptText, [
			'architecture',
			'investigate',
			'analiz',
			'analyze',
			'compare',
			'deep',
			'refactor',
		])
	) {
		return 'deep_reasoning';
	}

	if (
		availableToolCount >= 2 ||
		includesIntentKeyword(promptText, ['tool', 'search', 'grep', 'git', 'shell', 'file', 'dosya'])
	) {
		return 'tool_heavy';
	}

	if (
		availableToolCount === 0 &&
		compiledLayerCount === 0 &&
		promptLength > 0 &&
		promptLength <= 220
	) {
		return 'cheap';
	}

	return 'balanced';
}

export function resolveModelRoute(
	input: Readonly<{
		readonly request: ModelRequest;
		readonly requested_provider: GatewayProvider;
	}>,
): ResolvedModelRoute {
	const metadata = readModelRouterMetadata(input.request);

	// Router is disabled by default during development (Groq-only).
	// Post-launch: change to `metadata?.enabled === false` to activate
	// intelligent routing with Claude Opus as the primary provider.
	if (metadata?.enabled !== true) {
		return {
			allow_provider_fallback: false,
			intent: 'balanced',
			reason: 'requested_provider',
			routed_model:
				typeof input.request.model === 'string' && input.request.model.trim().length > 0
					? input.request.model
					: defaultGatewayModels[input.requested_provider],
			routed_provider: input.requested_provider,
		};
	}

	if (isGatewayProvider(metadata.preferred_provider)) {
		return {
			allow_provider_fallback: metadata.allow_provider_fallback !== false,
			intent: classifyModelRouteIntent(input.request),
			reason: 'explicit_preferred_provider',
			routed_model:
				typeof metadata.preferred_model === 'string' && metadata.preferred_model.trim().length > 0
					? metadata.preferred_model
					: defaultGatewayModels[metadata.preferred_provider],
			routed_provider: metadata.preferred_provider,
		};
	}

	const intent = classifyModelRouteIntent(input.request);

	switch (intent) {
		case 'cheap':
			return {
				allow_provider_fallback: metadata.allow_provider_fallback !== false,
				intent,
				reason: 'heuristic_cheap',
				routed_model: defaultGatewayModels.groq,
				routed_provider: 'groq',
			};
		case 'deep_reasoning':
			return {
				allow_provider_fallback: metadata.allow_provider_fallback !== false,
				intent,
				reason: 'heuristic_deep_reasoning',
				routed_model: defaultGatewayModels.claude,
				routed_provider: 'claude',
			};
		case 'tool_heavy':
			return {
				allow_provider_fallback: metadata.allow_provider_fallback !== false,
				intent,
				reason: 'heuristic_tool_heavy',
				routed_model: defaultGatewayModels.claude,
				routed_provider: 'claude',
			};
		case 'balanced':
			return {
				allow_provider_fallback: metadata.allow_provider_fallback !== false,
				intent,
				reason: 'requested_provider',
				routed_model:
					typeof input.request.model === 'string' && input.request.model.trim().length > 0
						? input.request.model
						: defaultGatewayModels[input.requested_provider],
				routed_provider: input.requested_provider,
			};
	}
}

export function applyModelRouteToRequest(
	request: ModelRequest,
	route: ResolvedModelRoute,
): ModelRequest {
	if (request.model === route.routed_model) {
		return request;
	}

	return {
		...request,
		model: route.routed_model,
	};
}
