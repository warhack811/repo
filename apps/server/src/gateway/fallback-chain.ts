import { GatewayConfigurationError, GatewayRequestError, GatewayResponseError } from './errors.js';
import type { ModelRouteIntent } from './model-router.js';
import type { GatewayProvider } from './providers.js';

const fallbackPriorityByProvider: Readonly<Record<GatewayProvider, readonly GatewayProvider[]>> = {
	claude: ['openai', 'gemini', 'groq'],
	gemini: ['openai', 'claude', 'groq'],
	groq: ['gemini', 'openai', 'claude'],
	openai: ['claude', 'gemini', 'groq'],
};

function getIntentAdjustedPriority(
	intent: ModelRouteIntent,
	provider: GatewayProvider,
): readonly GatewayProvider[] {
	if (provider !== 'groq') {
		return fallbackPriorityByProvider[provider];
	}

	return intent === 'cheap' ? ['gemini', 'openai', 'claude'] : ['openai', 'gemini', 'claude'];
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
