import { describe, expect, it } from 'vitest';

import { builtInTools } from './registry.js';

describe('Tool user_label_tr coverage', () => {
	it('every built-in tool exposes user_label_tr', () => {
		for (const tool of builtInTools) {
			expect(tool.user_label_tr, `tool ${tool.name} missing user_label_tr`).toBeTruthy();
			expect(tool.user_label_tr?.length ?? 0).toBeLessThanOrEqual(80);
		}
	});

	it('every built-in tool exposes user_summary_tr', () => {
		for (const tool of builtInTools) {
			expect(tool.user_summary_tr, `tool ${tool.name} missing user_summary_tr`).toBeTruthy();
			expect(tool.user_summary_tr?.length ?? 0).toBeLessThanOrEqual(140);
		}
	});

	it('user labels avoid raw english implementation markers', () => {
		const englishMarkers = ['execute', 'subprocess', 'argv', 'redaction', 'redacted', 'truncated'];

		for (const tool of builtInTools) {
			const lowerLabel = (tool.user_label_tr ?? '').toLocaleLowerCase('tr-TR');
			const lowerSummary = (tool.user_summary_tr ?? '').toLocaleLowerCase('tr-TR');

			for (const marker of englishMarkers) {
				expect(lowerLabel).not.toContain(marker);
				expect(lowerSummary).not.toContain(marker);
			}
		}
	});
});
