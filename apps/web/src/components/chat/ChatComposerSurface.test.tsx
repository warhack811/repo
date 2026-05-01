import { describe, expect, it } from 'vitest';

import { shouldSubmitComposerKey } from './ChatComposerSurface.js';

describe('shouldSubmitComposerKey', () => {
	it('submits Enter when composer has content and is ready', () => {
		expect(
			shouldSubmitComposerKey({
				hasContent: true,
				isComposing: false,
				isSubmitDisabled: false,
				key: 'Enter',
				shiftKey: false,
			}),
		).toBe(true);
	});

	it('keeps Shift+Enter, IME composition, empty composer, and disabled state from submitting', () => {
		const readyEnter = {
			hasContent: true,
			isComposing: false,
			isSubmitDisabled: false,
			key: 'Enter',
			shiftKey: false,
		};

		expect(shouldSubmitComposerKey({ ...readyEnter, shiftKey: true })).toBe(false);
		expect(shouldSubmitComposerKey({ ...readyEnter, isComposing: true })).toBe(false);
		expect(shouldSubmitComposerKey({ ...readyEnter, hasContent: false })).toBe(false);
		expect(shouldSubmitComposerKey({ ...readyEnter, isSubmitDisabled: true })).toBe(false);
	});
});
