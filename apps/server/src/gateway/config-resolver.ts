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
	const env = process.env as NodeJS.ProcessEnv & {
		readonly OPENAI_BASE_URL?: string;
		readonly RUNA_OPENAI_BASE_URL?: string;
	};
	const envKeyMap: Record<string, string> = {
		claude: 'ANTHROPIC_API_KEY',
		deepseek: 'DEEPSEEK_API_KEY',
		gemini: 'GEMINI_API_KEY',
		groq: 'GROQ_API_KEY',
		openai: 'OPENAI_API_KEY',
		sambanova: 'SAMBANOVA_API_KEY',
	};

	const envKeyName = envKeyMap[provider];
	const envBaseUrl =
		provider === 'openai' ? (env.RUNA_OPENAI_BASE_URL ?? env.OPENAI_BASE_URL) : undefined;
	const clientBaseUrl = clientConfig.baseUrl?.trim();
	const effectiveBaseUrl =
		clientBaseUrl && clientBaseUrl.length > 0
			? clientBaseUrl
			: envBaseUrl && envBaseUrl.trim().length > 0
				? envBaseUrl.trim()
				: undefined;
	const effectiveApiKey =
		clientConfig.apiKey.trim().length > 0
			? clientConfig.apiKey
			: envKeyName
				? process.env[envKeyName]
				: undefined;

	return {
		...clientConfig,
		apiKey: effectiveApiKey?.trim() ?? '',
		baseUrl: effectiveBaseUrl,
	};
}
