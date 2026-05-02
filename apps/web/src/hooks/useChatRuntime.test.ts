import { describe, expect, it } from 'vitest';

import { shouldMigrateStoredRuntimeConfigToDefaultProvider } from './useChatRuntime.js';

describe('shouldMigrateStoredRuntimeConfigToDefaultProvider', () => {
	it('migrates current and previous Groq defaults to the DeepSeek runtime default', () => {
		expect(
			shouldMigrateStoredRuntimeConfigToDefaultProvider({
				model: 'qwen/qwen3-32b',
				provider: 'groq',
			}),
		).toBe(true);
		expect(
			shouldMigrateStoredRuntimeConfigToDefaultProvider({
				model: 'llama-3.3-70b-versatile',
				provider: 'groq',
			}),
		).toBe(true);
	});

	it('keeps explicit non-default provider selections untouched', () => {
		expect(
			shouldMigrateStoredRuntimeConfigToDefaultProvider({
				model: 'llama-3.1-8b-instant',
				provider: 'groq',
			}),
		).toBe(false);
		expect(
			shouldMigrateStoredRuntimeConfigToDefaultProvider({
				model: 'deepseek-v4-flash',
				provider: 'deepseek',
			}),
		).toBe(false);
	});
});
