import { describe, expect, it } from 'vitest';

import {
	appendReasoningContent,
	extractReasoningContent,
	joinReasoningContent,
} from './reasoning-isolation.js';

describe('reasoning isolation', () => {
	it('extracts streaming reasoning_content without reading visible content', () => {
		expect(
			extractReasoningContent({
				choices: [
					{
						delta: {
							content: 'Visible text',
							reasoning_content: 'hidden trace',
						},
					},
				],
			}),
		).toBe('hidden trace');
	});

	it('extracts non-streaming message reasoning_content', () => {
		expect(
			extractReasoningContent({
				choices: [
					{
						message: {
							content: 'Visible answer',
							reasoning_content: 'internal trace',
						},
					},
				],
			}),
		).toBe('internal trace');
	});

	it('joins reasoning chunks in a separate buffer', () => {
		const buffer: string[] = [];

		expect(
			appendReasoningContent(buffer, {
				choices: [{ delta: { reasoning_content: 'first ' } }],
			}),
		).toEqual({
			appended_length: 6,
			content: 'first ',
		});
		expect(
			appendReasoningContent(buffer, {
				choices: [{ delta: { content: 'visible only' } }],
			}),
		).toEqual({
			appended_length: 0,
		});
		expect(
			appendReasoningContent(buffer, {
				choices: [{ delta: { reasoning_content: 'second' } }],
			}),
		).toEqual({
			appended_length: 6,
			content: 'second',
		});

		expect(joinReasoningContent(buffer)).toBe('first second');
	});

	it('returns undefined when no reasoning was present', () => {
		expect(extractReasoningContent({ choices: [{ delta: { content: 'visible' } }] })).toBe(
			undefined,
		);
		expect(joinReasoningContent([])).toBe(undefined);
	});
});
