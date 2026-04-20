import { ClaudeGateway } from './claude-gateway.js';
import { resolveGatewayConfig } from './config-resolver.js';
import { GatewayConfigurationError } from './errors.js';
import { GroqGateway } from './groq-gateway.js';
import type { CreateGatewayOptions } from './providers.js';

export function createModelGateway({ config, provider }: CreateGatewayOptions) {
	const resolvedConfig = resolveGatewayConfig(provider, config);

	if (resolvedConfig.apiKey.trim().length === 0) {
		throw new GatewayConfigurationError(
			`Missing API key for ${provider} gateway (not provided in request or server environment).`,
		);
	}

	switch (provider) {
		case 'groq':
			return new GroqGateway(resolvedConfig);
		case 'claude':
			return new ClaudeGateway(resolvedConfig);
	}
}
