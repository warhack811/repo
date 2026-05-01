import type { SearchProvider, SearchProviderEnvironment } from './provider.js';
import { SerperProvider } from './providers/serper.js';

export type SearchProviderName = 'serper' | 'exa';

export interface SearchProviderRegistryOptions {
	readonly environment?: SearchProviderEnvironment;
	readonly fetch?: typeof fetch;
}

export function getProvider(
	name: SearchProviderName,
	options: SearchProviderRegistryOptions = {},
): SearchProvider {
	switch (name) {
		case 'serper':
			return new SerperProvider({
				environment: options.environment,
				fetch: options.fetch,
			});
		case 'exa':
			throw new Error('Search provider "exa" is not configured yet.');
	}
}

export function getDefaultProvider(options: SearchProviderRegistryOptions = {}): SearchProvider {
	return getProvider('serper', options);
}
