import { defaultGatewayModels } from '@runa/types';
import type { ModelRequest } from '@runa/types';

import type { ProviderHealthSignal } from '../runtime/provider-health.js';
import type { GatewayProvider } from './providers.js';

export type ModelRouteIntent = 'balanced' | 'cheap' | 'deep_reasoning' | 'tool_heavy';

const deepSeekModelByIntent: Readonly<Record<ModelRouteIntent, string>> = {
	balanced: 'deepseek-v4-flash',
	cheap: 'deepseek-v4-flash',
	deep_reasoning: 'deepseek-v4-pro',
	tool_heavy: 'deepseek-v4-pro',
};

function readNonEmptyEnvironmentValue(value: string | undefined): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

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
	readonly streaming_eligible: boolean;
}

const providerDemotionOrder: readonly GatewayProvider[] = [
	'groq',
	'sambanova',
	'openai',
	'gemini',
	'claude',
	'deepseek',
];

function isGatewayProvider(value: unknown): value is GatewayProvider {
	return (
		value === 'claude' ||
		value === 'deepseek' ||
		value === 'gemini' ||
		value === 'groq' ||
		value === 'openai' ||
		value === 'sambanova'
	);
}

function isTruthyEnvironmentFlag(value: string | undefined): boolean {
	return value === '1' || value?.toLowerCase() === 'true';
}

function isDisabledEnvironmentFlag(value: string | undefined): boolean {
	return value === '0' || value?.toLowerCase() === 'false';
}

function isStreamingToolHeavyBypassEnabled(): boolean {
	const env = process.env as NodeJS.ProcessEnv & {
		readonly RUNA_STREAMING_TOOL_HEAVY_BYPASS?: string;
	};

	return !isDisabledEnvironmentFlag(env.RUNA_STREAMING_TOOL_HEAVY_BYPASS);
}

export function resolveStreamingEligibility(
	intent: ModelRouteIntent,
	provider: GatewayProvider,
): boolean {
	if (
		isStreamingToolHeavyBypassEnabled() &&
		provider === 'deepseek' &&
		(intent === 'tool_heavy' || intent === 'deep_reasoning')
	) {
		return false;
	}

	return true;
}

function resolveDeepSeekModelForIntent(intent: ModelRouteIntent): string {
	const env = process.env as NodeJS.ProcessEnv & {
		readonly DEEPSEEK_FAST_MODEL?: string;
		readonly DEEPSEEK_REASONING_MODEL?: string;
	};
	const fastModel = readNonEmptyEnvironmentValue(env.DEEPSEEK_FAST_MODEL);
	const reasoningModel = readNonEmptyEnvironmentValue(env.DEEPSEEK_REASONING_MODEL);

	if (intent === 'deep_reasoning' || intent === 'tool_heavy') {
		return reasoningModel ?? deepSeekModelByIntent[intent];
	}

	return fastModel ?? deepSeekModelByIntent[intent];
}

function isModelRouterEnabled(
	metadata: ModelRouterMetadataCandidate | null,
	requestedProvider: GatewayProvider,
): boolean {
	if (metadata?.enabled === true) {
		return true;
	}

	if (metadata?.enabled === false) {
		return false;
	}

	const env = process.env as NodeJS.ProcessEnv & {
		readonly RUNA_DEEPSEEK_MODEL_ROUTER_ENABLED?: string;
		readonly RUNA_MODEL_ROUTER_ENABLED?: string;
	};

	if (isTruthyEnvironmentFlag(env.RUNA_MODEL_ROUTER_ENABLED)) {
		return true;
	}

	if (requestedProvider === 'deepseek') {
		return !isDisabledEnvironmentFlag(env.RUNA_DEEPSEEK_MODEL_ROUTER_ENABLED);
	}

	return false;
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
			'deep analysis',
			'deep reasoning',
			'deeply',
			'derin',
			'mimari',
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
		readonly health_signal?: ProviderHealthSignal;
		readonly request: ModelRequest;
		readonly requested_provider: GatewayProvider;
	}>,
): ResolvedModelRoute {
	const metadata = readModelRouterMetadata(input.request);

	if (!isModelRouterEnabled(metadata, input.requested_provider)) {
		return applyProviderHealthSignal(
			{
				allow_provider_fallback: false,
				intent: 'balanced',
				reason: 'requested_provider',
				routed_model:
					typeof input.request.model === 'string' && input.request.model.trim().length > 0
						? input.request.model
						: defaultGatewayModels[input.requested_provider],
				routed_provider: input.requested_provider,
				streaming_eligible: resolveStreamingEligibility('balanced', input.requested_provider),
			},
			input.health_signal,
		);
	}

	const preferredProvider = metadata?.preferred_provider;

	if (isGatewayProvider(preferredProvider)) {
		const preferredModel = metadata?.preferred_model;

		const intent = classifyModelRouteIntent(input.request);

		return applyProviderHealthSignal(
			{
				allow_provider_fallback: metadata?.allow_provider_fallback !== false,
				intent,
				reason: 'explicit_preferred_provider',
				routed_model:
					typeof preferredModel === 'string' && preferredModel.trim().length > 0
						? preferredModel
						: defaultGatewayModels[preferredProvider],
				routed_provider: preferredProvider,
				streaming_eligible: resolveStreamingEligibility(intent, preferredProvider),
			},
			input.health_signal,
		);
	}

	const intent = classifyModelRouteIntent(input.request);

	if (input.requested_provider === 'deepseek') {
		return applyProviderHealthSignal(
			{
				allow_provider_fallback: metadata?.allow_provider_fallback !== false,
				intent,
				reason:
					intent === 'cheap'
						? 'heuristic_cheap'
						: intent === 'deep_reasoning'
							? 'heuristic_deep_reasoning'
							: intent === 'tool_heavy'
								? 'heuristic_tool_heavy'
								: 'requested_provider',
				routed_model: resolveDeepSeekModelForIntent(intent),
				routed_provider: 'deepseek',
				streaming_eligible: resolveStreamingEligibility(intent, 'deepseek'),
			},
			input.health_signal,
		);
	}

	switch (intent) {
		case 'cheap':
			return applyProviderHealthSignal(
				{
					allow_provider_fallback: metadata?.allow_provider_fallback !== false,
					intent,
					reason: 'heuristic_cheap',
					routed_model: defaultGatewayModels.deepseek,
					routed_provider: 'deepseek',
					streaming_eligible: resolveStreamingEligibility(intent, 'deepseek'),
				},
				input.health_signal,
			);
		case 'deep_reasoning':
			return applyProviderHealthSignal(
				{
					allow_provider_fallback: metadata?.allow_provider_fallback !== false,
					intent,
					reason: 'heuristic_deep_reasoning',
					routed_model: defaultGatewayModels.claude,
					routed_provider: 'claude',
					streaming_eligible: resolveStreamingEligibility(intent, 'claude'),
				},
				input.health_signal,
			);
		case 'tool_heavy':
			return applyProviderHealthSignal(
				{
					allow_provider_fallback: metadata?.allow_provider_fallback !== false,
					intent,
					reason: 'heuristic_tool_heavy',
					routed_model: defaultGatewayModels.claude,
					routed_provider: 'claude',
					streaming_eligible: resolveStreamingEligibility(intent, 'claude'),
				},
				input.health_signal,
			);
		case 'balanced':
			return applyProviderHealthSignal(
				{
					allow_provider_fallback: metadata?.allow_provider_fallback !== false,
					intent,
					reason: 'requested_provider',
					routed_model:
						typeof input.request.model === 'string' && input.request.model.trim().length > 0
							? input.request.model
							: defaultGatewayModels[input.requested_provider],
					routed_provider: input.requested_provider,
					streaming_eligible: resolveStreamingEligibility(intent, input.requested_provider),
				},
				input.health_signal,
			);
	}
}

function applyProviderHealthSignal(
	route: ResolvedModelRoute,
	healthSignal: ProviderHealthSignal | undefined,
): ResolvedModelRoute {
	if (
		healthSignal === undefined ||
		!healthSignal.demoted_providers.includes(route.routed_provider)
	) {
		return route;
	}

	const nextProvider = providerDemotionOrder.find(
		(provider) =>
			provider !== route.routed_provider && !healthSignal.demoted_providers.includes(provider),
	);

	if (nextProvider === undefined) {
		return route;
	}

	return {
		...route,
		routed_model: defaultGatewayModels[nextProvider],
		routed_provider: nextProvider,
		streaming_eligible: resolveStreamingEligibility(route.intent, nextProvider),
	};
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
