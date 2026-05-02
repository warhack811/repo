import { describe, expect, it } from 'vitest';

import { createProviderHealthStore, hashSessionId } from './provider-health.js';

describe('provider-health', () => {
	it('demotes a provider after three terminal failures inside the rolling window', () => {
		const store = createProviderHealthStore();

		store.recordFailure({
			now_ms: 1_000,
			provider: 'deepseek',
			reason: 'unparseable_tool_input',
			session_id: 'session_a',
		});
		store.recordFailure({
			now_ms: 2_000,
			provider: 'deepseek',
			reason: 'retry_still_unparseable',
			session_id: 'session_a',
		});
		const signal = store.recordFailure({
			now_ms: 3_000,
			provider: 'deepseek',
			reason: 'unparseable_tool_input',
			session_id: 'session_a',
		});

		expect(signal.demoted_providers).toEqual(['deepseek']);
	});

	it('keeps sessions isolated and drops failures outside the ten-minute window', () => {
		const store = createProviderHealthStore();

		for (const now_ms of [1_000, 2_000, 3_000]) {
			store.recordFailure({
				now_ms,
				provider: 'deepseek',
				reason: 'unparseable_tool_input',
				session_id: 'session_a',
			});
		}

		expect(
			store.getSignal({
				now_ms: 3_000,
				session_id: 'session_b',
			}).demoted_providers,
		).toEqual([]);
		expect(
			store.getSignal({
				now_ms: 700_000,
				session_id: 'session_a',
			}).demoted_providers,
		).toEqual([]);
	});

	it('hashes session ids without exposing the raw value', () => {
		expect(hashSessionId('session_secret')).not.toBe('session_secret');
		expect(hashSessionId('session_secret')).toBe(hashSessionId('session_secret'));
	});
});
