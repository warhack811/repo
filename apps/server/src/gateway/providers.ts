import type { GatewayProvider as SharedGatewayProvider } from '@runa/types';
export { defaultGatewayModels, gatewayProviders } from '@runa/types';

export type GatewayProvider = SharedGatewayProvider;

export interface GatewayProviderConfig {
	readonly apiKey: string;
	readonly defaultModel?: string;
	readonly defaultMaxOutputTokens?: number;
}

export interface CreateGatewayOptions {
	readonly provider: GatewayProvider;
	readonly config: GatewayProviderConfig;
}
