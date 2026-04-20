export const gatewayProviders = ['groq', 'claude'] as const;

export type GatewayProvider = (typeof gatewayProviders)[number];

export interface GatewayProviderConfig {
	readonly apiKey: string;
	readonly defaultModel?: string;
	readonly defaultMaxOutputTokens?: number;
}

export interface CreateGatewayOptions {
	readonly provider: GatewayProvider;
	readonly config: GatewayProviderConfig;
}
