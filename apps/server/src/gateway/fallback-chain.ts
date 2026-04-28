import { GatewayConfigurationError, GatewayRequestError, GatewayResponseError } from './errors.js';
import type { ModelRouteIntent } from './model-router.js';
import type { GatewayProvider } from './providers.js';

const fallbackPriorityByProvider: Readonly<Record<GatewayProvider, readonly GatewayProvider[]>> = {
	claude: ['openai', 'gemini', 'deepseek', 'sambanova', 'groq'],
	deepseek: ['groq', 'sambanova', 'openai', 'gemini', 'claude'],
	gemini: ['openai', 'claude', 'deepseek', 'sambanova', 'groq'],
	groq: ['deepseek', 'gemini', 'openai', 'sambanova', 'claude'],
	openai: ['claude', 'gemini', 'deepseek', 'sambanova', 'groq'],
	sambanova: ['deepseek', 'groq', 'openai', 'gemini', 'claude'],
};

function getIntentAdjustedPriority(
	intent: ModelRouteIntent,
	provider: GatewayProvider,
): readonly GatewayProvider[] {
	if (provider !== 'groq') {
		return fallbackPriorityByProvider[provider];
	}

	return intent === 'cheap'
		? ['deepseek', 'gemini', 'sambanova', 'openai', 'claude']
		: ['openai', 'gemini', 'deepseek', 'sambanova', 'claude'];
}

export function buildProviderFallbackChain(
	input: Readonly<{
		readonly allow_provider_fallback: boolean;
		readonly intent: ModelRouteIntent;
		readonly requested_provider: GatewayProvider;
		readonly routed_provider: GatewayProvider;
	}>,
): readonly GatewayProvider[] {
	if (!input.allow_provider_fallback) {
		return [];
	}

	const orderedProviders: GatewayProvider[] = [];

	if (input.requested_provider !== input.routed_provider) {
		orderedProviders.push(input.requested_provider);
	}

	for (const provider of getIntentAdjustedPriority(input.intent, input.routed_provider)) {
		if (provider === input.routed_provider || orderedProviders.includes(provider)) {
			continue;
		}

		orderedProviders.push(provider);
	}

	return orderedProviders;
}

export function shouldAttemptProviderFallback(error: unknown): boolean {
	return (
		error instanceof GatewayConfigurationError ||
		error instanceof GatewayRequestError ||
		error instanceof GatewayResponseError
	);
}
