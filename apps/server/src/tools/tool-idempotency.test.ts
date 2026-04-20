import { afterEach, describe, expect, it } from 'vitest';

import {
	InMemoryToolEffectIdempotencyStore,
	buildToolEffectIdempotencyKey,
	defaultToolEffectIdempotencyStore,
	resetDefaultToolEffectIdempotencyStore,
} from './tool-idempotency.js';

afterEach(() => {
	resetDefaultToolEffectIdempotencyStore();
});

describe('tool-idempotency', () => {
	it('builds the same key for semantically identical payloads', () => {
		const firstKey = buildToolEffectIdempotencyKey({
			payload: {
				content: 'same patch',
				flags: ['safe', 'tracked'],
				path: 'src/auth.ts',
				patch: {
					mode: 'replace',
					start: 10,
				},
			},
			run_id: 'run_tool_idempotency_1',
			target: 'workspace://src/auth.ts',
			tool_name: 'edit.patch',
		});
		const secondKey = buildToolEffectIdempotencyKey({
			payload: {
				flags: ['safe', 'tracked'],
				patch: {
					start: 10,
					mode: 'replace',
				},
				path: 'src/auth.ts',
				content: 'same patch',
			},
			run_id: 'run_tool_idempotency_1',
			target: 'workspace://src/auth.ts',
			tool_name: 'edit.patch',
		});
		const thirdKey = buildToolEffectIdempotencyKey({
			payload: {
				content: 'different patch',
				path: 'src/auth.ts',
			},
			run_id: 'run_tool_idempotency_1',
			target: 'workspace://src/auth.ts',
			tool_name: 'edit.patch',
		});

		expect(firstKey).toBe(secondKey);
		expect(thirdKey).not.toBe(firstKey);
		expect(firstKey).toMatch(/^edit\.patch:[0-9a-f]{64}$/);
	});

	it('stores applied effects in memory and resets the shared default store', () => {
		const record = {
			applied_at: '2026-04-12T16:25:00.000Z',
			key: 'file.write:abc123',
			run_id: 'run_tool_idempotency_2',
			tool_name: 'file.write' as const,
		};
		const store = new InMemoryToolEffectIdempotencyStore();

		expect(store.get(record.key)).toBeUndefined();

		store.markApplied(record);
		defaultToolEffectIdempotencyStore.markApplied(record);

		expect(store.get(record.key)).toEqual(record);
		expect(defaultToolEffectIdempotencyStore.get(record.key)).toEqual(record);

		resetDefaultToolEffectIdempotencyStore();

		expect(defaultToolEffectIdempotencyStore.get(record.key)).toBeUndefined();
	});
});
