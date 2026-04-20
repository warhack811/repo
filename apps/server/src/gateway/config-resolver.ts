import type { GatewayProviderConfig } from './providers.js';

/**
 * GatewayConfigResolver
 *
 * Kullanıcıdan gelen (client-side) yapılandırma ile sunucu tarafındaki (env)
 * varsayılan ayarları birleştirir.
 */
export function resolveGatewayConfig(
	provider: string,
	clientConfig: GatewayProviderConfig,
): GatewayProviderConfig {
	const envKeyMap: Record<string, string> = {
		groq: 'GROQ_API_KEY',
		claude: 'ANTHROPIC_API_KEY',
	};

	const envKeyName = envKeyMap[provider];
	const effectiveApiKey =
		clientConfig.apiKey.trim().length > 0
			? clientConfig.apiKey
			: envKeyName
				? process.env[envKeyName]
				: undefined;

	return {
		...clientConfig,
		apiKey: effectiveApiKey ?? '',
	};
}
