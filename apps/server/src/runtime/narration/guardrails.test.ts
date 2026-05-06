import { describe, expect, it } from 'vitest';

import { applyGuardrails } from './guardrails.js';

describe('applyGuardrails', () => {
	const context = {
		locale: 'tr',
		previous_narrations: [],
	} as const;

	it.each(['', '   ', '\n\n'])('rejects empty text: %j', (value) => {
		expect(applyGuardrails(value, context)).toEqual({
			accepted: false,
			reject_reason: 'empty',
		});
	});

	it('truncates long text at the hard cap when no sentence boundary exists', () => {
		const result = applyGuardrails('a'.repeat(250), context);

		expect(result.accepted).toBe(true);
		expect(result.sanitized?.length).toBeLessThanOrEqual(240);
		expect(result.sanitized?.endsWith('\u2026')).toBe(true);
	});

	it('truncates long text at a sentence boundary', () => {
		const result = applyGuardrails(`${'a'.repeat(80)}. ${'b'.repeat(180)}`, context);

		expect(result).toEqual({
			accepted: true,
			sanitized: `${'a'.repeat(80)}.`,
		});
	});

	it('rejects exact duplicates', () => {
		expect(
			applyGuardrails('package.json kontrol ediyorum', {
				locale: 'tr',
				previous_narrations: ['package.json kontrol ediyorum'],
			}),
		).toEqual({
			accepted: false,
			reject_reason: 'duplicate',
		});
	});

	it('rejects similar duplicates', () => {
		expect(
			applyGuardrails('package json dosyasini kontrol ediyorum simdi', {
				locale: 'tr',
				previous_narrations: ['package json dosyasini kontrol ediyorum hemen'],
			}),
		).toEqual({
			accepted: false,
			reject_reason: 'duplicate',
		});
	});

	it('accepts non-duplicate text', () => {
		expect(
			applyGuardrails('README dosyasini inceliyorum', {
				locale: 'tr',
				previous_narrations: ['package json dosyasini kontrol ediyorum'],
			}),
		).toEqual({
			accepted: true,
			sanitized: 'README dosyasini inceliyorum',
		});
	});

	it('rejects TR deliberation', () => {
		expect(applyGuardrails("acaba package.json'a baksam mi", context)).toEqual({
			accepted: false,
			reject_reason: 'deliberation',
		});
	});

	it.each([
		'acaba package.json dosyasina bakiyorum',
		'belki package.json dosyasina bakiyorum',
		'sanirim package.json dosyasina bakiyorum',
		'sanırım package.json dosyasına bakıyorum',
		'dusunuyorum package.json dosyasina bakiyorum',
		'düşünüyorum package.json dosyasına bakıyorum',
	])('rejects TR deliberation keyword: %s', (text) => {
		expect(applyGuardrails(text, context)).toEqual({
			accepted: false,
			reject_reason: 'deliberation',
		});
	});

	it('rejects EN deliberation in EN locale', () => {
		expect(
			applyGuardrails('maybe I should check the file', {
				locale: 'en',
				previous_narrations: [],
			}),
		).toEqual({
			accepted: false,
			reject_reason: 'deliberation',
		});
	});

	it.each([
		'maybe I should check package.json',
		'perhaps I should check package.json',
		'I think I should check package.json',
		'let me think about package.json',
	])('rejects EN deliberation keyword: %s', (text) => {
		expect(
			applyGuardrails(text, {
				locale: 'en',
				previous_narrations: [],
			}),
		).toEqual({
			accepted: false,
			reject_reason: 'deliberation',
		});
	});

	it('keeps the simple TR belki rule conservative', () => {
		expect(applyGuardrails('simdi belki klasorunu aciyorum', context)).toEqual({
			accepted: false,
			reject_reason: 'deliberation',
		});
	});

	it('rejects long exact tool result quotes', () => {
		expect(
			applyGuardrails(
				'Bu sonucu gordum: abcdefghijklmnopqrstuvwxyz123456 devam ediyorum',
				context,
				['tool output abcdefghijklmnopqrstuvwxyz123456 with details'],
			),
		).toEqual({
			accepted: false,
			reject_reason: 'tool_result_quote',
		});
	});

	it('accepts short tool result overlaps', () => {
		expect(applyGuardrails('abcdefghijklmnopqrst', context, ['xxabcdefghijklmnopqrstxx'])).toEqual({
			accepted: true,
			sanitized: 'abcdefghijklmnopqrst',
		});
	});

	it('accepts happy path TR narration', () => {
		expect(applyGuardrails("package.json'i kontrol ediyorum", context)).toEqual({
			accepted: true,
			sanitized: "package.json'i kontrol ediyorum",
		});
	});

	it('accepts happy path EN narration', () => {
		expect(
			applyGuardrails('checking package.json', {
				locale: 'en',
				previous_narrations: [],
			}),
		).toEqual({
			accepted: true,
			sanitized: 'checking package.json',
		});
	});

	it('rejects EN deliberation in TR locale', () => {
		expect(applyGuardrails('maybe I should inspect package.json', context)).toEqual({
			accepted: false,
			reject_reason: 'deliberation',
		});
	});

	it('rejects TR deliberation in EN locale', () => {
		expect(
			applyGuardrails('Sanırım package.json dosyasini kontrol etmem gerekiyor', {
				locale: 'en',
				previous_narrations: [],
			}),
		).toEqual({
			accepted: false,
			reject_reason: 'deliberation',
		});
	});
});
