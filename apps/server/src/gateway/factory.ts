import type {
	ModelGateway,
	ModelRequest,
	ModelResponse,
	ModelStreamChunk,
	ProviderCapabilities,
} from '@runa/types';

import { defaultGatewayModels } from '@runa/types';

import type { ProviderHealthSignal } from '../runtime/provider-health.js';
import { createLogger } from '../utils/logger.js';
import { ClaudeGateway, claudeProviderCapabilities } from './claude-gateway.js';
import { resolveGatewayConfig } from './config-resolver.js';
import { DeepSeekGateway, deepSeekProviderCapabilities } from './deepseek-gateway.js';
import { GatewayConfigurationError } from './errors.js';
import { buildProviderFallbackChain, shouldAttemptProviderFallback } from './fallback-chain.js';
import { GeminiGateway, geminiProviderCapabilities } from './gemini-gateway.js';
import { GroqGateway, groqProviderCapabilities } from './groq-gateway.js';
import { applyModelRouteToRequest, resolveModelRoute } from './model-router.js';
import { OpenAiGateway, openAiProviderCapabilities } from './openai-gateway.js';
import type { CreateGatewayOptions, GatewayProvider, GatewayProviderConfig } from './providers.js';
import { SambaNovaGateway, sambaNovaProviderCapabilities } from './sambanova-gateway.js';

const gatewayFactoryLogger = createLogger({
	context: {
		component: 'gateway.factory',
	},
});

const providerCapabilities: Readonly<Record<GatewayProvider, ProviderCapabilities>> = {
	claude: claudeProviderCapabilities,
	deepseek: deepSeekProviderCapabilities,
	gemini: geminiProviderCapabilities,
	groq: groqProviderCapabilities,
	openai: openAiProviderCapabilities,
	sambanova: sambaNovaProviderCapabilities,
};

export function getGatewayProviderCapabilities(provider: GatewayProvider): ProviderCapabilities {
	return providerCapabilities[provider];
}

function instantiateGateway({ config, provider }: CreateGatewayOptions): ModelGateway {
	const resolvedConfig = resolveGatewayConfig(provider, config);

	if (resolvedConfig.apiKey.trim().length === 0) {
		throw new GatewayConfigurationError(
			`Missing API key for ${provider} gateway (not provided in request or server environment).`,
		);
	}

	const gateway = (() => {
		switch (provider) {
			case 'claude':
				return new ClaudeGateway(resolvedConfig);
			case 'deepseek':
				return new DeepSeekGateway(resolvedConfig);
			case 'gemini':
				return new GeminiGateway(resolvedConfig);
			case 'groq':
				return new GroqGateway(resolvedConfig);
			case 'openai':
				return new OpenAiGateway(resolvedConfig);
			case 'sambanova':
				return new SambaNovaGateway(resolvedConfig);
		}
	})();

	gatewayFactoryLogger.debug('gateway.capability.loaded', {
		narration_strategy: gateway.capabilities?.narration_strategy,
		provider,
		streaming_supported: gateway.capabilities?.streaming_supported,
	});

	return gateway;
}

function resolveRouteModelForProvider(
	route: ReturnType<typeof resolveModelRoute>,
	provider: GatewayProvider,
): string {
	return provider === route.routed_provider ? route.routed_model : defaultGatewayModels[provider];
}

function buildGatewayConfigForProvider(
	requestedProvider: GatewayProvider,
	requestedConfig: GatewayProviderConfig,
	targetProvider: GatewayProvider,
): GatewayProviderConfig {
	if (requestedProvider === targetProvider) {
		return requestedConfig;
	}

	return {
		apiKey: '',
		defaultMaxOutputTokens: requestedConfig.defaultMaxOutputTokens,
		defaultModel: defaultGatewayModels[targetProvider],
	};
}

class RoutedModelGateway implements ModelGateway {
	readonly #healthSignal: ProviderHealthSignal | undefined;
	readonly #requestedConfig: GatewayProviderConfig;
	readonly #requestedProvider: GatewayProvider;
	readonly capabilities: ProviderCapabilities;

	constructor(
		input: Readonly<{
			readonly requested_config: GatewayProviderConfig;
			readonly requested_provider: GatewayProvider;
			readonly health_signal?: ProviderHealthSignal;
		}>,
	) {
		this.#healthSignal = input.health_signal;
		this.#requestedConfig = input.requested_config;
		this.#requestedProvider = input.requested_provider;
		this.capabilities = getGatewayProviderCapabilities(input.requested_provider);
	}

	async generate(request: ModelRequest): Promise<ModelResponse> {
		const route = resolveModelRoute({
			health_signal: this.#healthSignal,
			request,
			requested_provider: this.#requestedProvider,
		});
		const fallbackProviders = buildProviderFallbackChain({
			allow_provider_fallback: route.allow_provider_fallback,
			intent: route.intent,
			requested_provider: this.#requestedProvider,
			routed_provider: route.routed_provider,
		});
		const providersToTry = [route.routed_provider, ...fallbackProviders];
		let lastError: unknown;

		for (const provider of providersToTry) {
			try {
				const gateway = instantiateGateway({
					config: buildGatewayConfigForProvider(
						this.#requestedProvider,
						this.#requestedConfig,
						provider,
					),
					provider,
				});

				return await gateway.generate(
					applyModelRouteToRequest(request, {
						...route,
						routed_model: resolveRouteModelForProvider(route, provider),
						routed_provider: provider,
					}),
				);
			} catch (error: unknown) {
				lastError = error;

				if (!shouldAttemptProviderFallback(error) || provider === providersToTry.at(-1)) {
					throw error;
				}
			}
		}

		throw lastError instanceof Error
			? lastError
			: new GatewayConfigurationError('No gateway provider could satisfy the routed request.');
	}

	async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
		const route = resolveModelRoute({
			health_signal: this.#healthSignal,
			request,
			requested_provider: this.#requestedProvider,
		});
		const fallbackProviders = buildProviderFallbackChain({
			allow_provider_fallback: route.allow_provider_fallback,
			intent: route.intent,
			requested_provider: this.#requestedProvider,
			routed_provider: route.routed_provider,
		});
		const providersToTry = [route.routed_provider, ...fallbackProviders];
		let lastError: unknown;

		for (const provider of providersToTry) {
			let emittedChunk = false;

			try {
				const gateway = instantiateGateway({
					config: buildGatewayConfigForProvider(
						this.#requestedProvider,
						this.#requestedConfig,
						provider,
					),
					provider,
				});

				for await (const chunk of gateway.stream(
					applyModelRouteToRequest(request, {
						...route,
						routed_model: resolveRouteModelForProvider(route, provider),
						routed_provider: provider,
					}),
				)) {
					emittedChunk = true;
					yield chunk;
				}

				return;
			} catch (error: unknown) {
				lastError = error;

				if (
					emittedChunk ||
					!shouldAttemptProviderFallback(error) ||
					provider === providersToTry.at(-1)
				) {
					throw error;
				}
			}
		}

		throw lastError instanceof Error
			? lastError
			: new GatewayConfigurationError(
					'No gateway provider could satisfy the routed stream request.',
				);
	}
}

export function createModelGateway({
	config,
	health_signal,
	provider,
}: CreateGatewayOptions & {
	readonly health_signal?: ProviderHealthSignal;
}): ModelGateway {
	return new RoutedModelGateway({
		health_signal,
		requested_config: config,
		requested_provider: provider,
	});
}
