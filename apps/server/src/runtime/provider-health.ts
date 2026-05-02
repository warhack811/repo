import type { GatewayProvider } from '../gateway/providers.js';
import { createLogger } from '../utils/logger.js';

export interface ProviderHealthSignal {
	readonly demoted_providers: readonly GatewayProvider[];
}

interface ProviderFailureEntry {
	readonly occurred_at_ms: number;
	readonly provider: GatewayProvider;
	readonly reason: 'retry_still_unparseable' | 'unparseable_tool_input';
	readonly session_id: string;
}

export interface RecordProviderFailureInput {
	readonly now_ms?: number;
	readonly provider: GatewayProvider;
	readonly reason: 'retry_still_unparseable' | 'unparseable_tool_input';
	readonly session_id: string;
}

export interface ProviderHealthStore {
	getSignal(input: { readonly now_ms?: number; readonly session_id: string }): ProviderHealthSignal;
	recordFailure(input: RecordProviderFailureInput): ProviderHealthSignal;
	reset(): void;
}

const windowMs = 10 * 60 * 1000;
const demoteThreshold = 3;

const providerHealthLogger = createLogger({
	context: {
		component: 'runtime.provider_health',
	},
});

function pruneEntries(
	entries: readonly ProviderFailureEntry[],
	nowMs: number,
): readonly ProviderFailureEntry[] {
	const windowStart = nowMs - windowMs;

	return entries.filter((entry) => entry.occurred_at_ms >= windowStart);
}

export function hashSessionId(sessionId: string): string {
	let hash = 0;

	for (let index = 0; index < sessionId.length; index += 1) {
		hash = (hash * 31 + sessionId.charCodeAt(index)) >>> 0;
	}

	return hash.toString(16).padStart(8, '0');
}

export function createProviderHealthStore(): ProviderHealthStore {
	const entriesBySession = new Map<string, readonly ProviderFailureEntry[]>();
	const demotedBySession = new Map<string, readonly GatewayProvider[]>();

	function refreshSession(sessionId: string, nowMs: number): ProviderHealthSignal {
		const entries = pruneEntries(entriesBySession.get(sessionId) ?? [], nowMs);
		entriesBySession.set(sessionId, entries);

		const providersToDemote: GatewayProvider[] = [];
		const providers = new Set(entries.map((entry) => entry.provider));

		for (const provider of providers) {
			const failureCount = entries.filter((entry) => entry.provider === provider).length;

			if (failureCount >= demoteThreshold) {
				providersToDemote.push(provider);
			}
		}

		demotedBySession.set(sessionId, providersToDemote);

		return {
			demoted_providers: providersToDemote,
		};
	}

	return {
		getSignal(input) {
			return refreshSession(input.session_id, input.now_ms ?? Date.now());
		},
		recordFailure(input) {
			const nowMs = input.now_ms ?? Date.now();
			const nextEntries = [
				...pruneEntries(entriesBySession.get(input.session_id) ?? [], nowMs),
				{
					occurred_at_ms: nowMs,
					provider: input.provider,
					reason: input.reason,
					session_id: input.session_id,
				},
			];

			entriesBySession.set(input.session_id, nextEntries);
			const previousDemotedProviders = demotedBySession.get(input.session_id) ?? [];
			const signal = refreshSession(input.session_id, nowMs);

			for (const provider of signal.demoted_providers) {
				if (previousDemotedProviders.includes(provider)) {
					continue;
				}

				const failureCount = nextEntries.filter((entry) => entry.provider === provider).length;

				providerHealthLogger.warn('provider.demoted', {
					failure_count: failureCount,
					provider,
					session_id_hash: hashSessionId(input.session_id),
					window_seconds: windowMs / 1000,
				});
			}

			return signal;
		},
		reset() {
			entriesBySession.clear();
			demotedBySession.clear();
		},
	};
}

export const defaultProviderHealthStore = createProviderHealthStore();
