import { describe, expect, it } from 'vitest';

import { containsUnsafeErrorCopy, getAppErrorRecoveryCopy } from './appErrorBoundaryCopy.js';

describe('appErrorBoundaryCopy', () => {
	it('returns expected Turkish recovery copy', () => {
		const copy = getAppErrorRecoveryCopy();

		expect(copy.title).toBe('Bir şey ters gitti.');
		expect(copy.description).toBe(
			'Bu ekran şu anda açılmadı. Tekrar deneyebilir veya sohbete dönebilirsin.',
		);
		expect(copy.retryLabel).toBe('Tekrar dene');
		expect(copy.recoverLabel).toBe('Sohbete dön');
		expect(copy.eyebrow).toBe('Güvenli kurtarma');
	});

	it('copy contains no forbidden raw/internal tokens', () => {
		const copy = getAppErrorRecoveryCopy();
		const allText = Object.values(copy).join(' ');

		expect(containsUnsafeErrorCopy(allText)).toBe(false);
	});

	it('containsUnsafeErrorCopy catches TypeError', () => {
		expect(containsUnsafeErrorCopy('TypeError: x is not a function')).toBe(true);
	});

	it('containsUnsafeErrorCopy catches Cannot read properties', () => {
		expect(containsUnsafeErrorCopy('Cannot read properties of undefined')).toBe(true);
	});

	it('containsUnsafeErrorCopy catches Internal Server Error', () => {
		expect(containsUnsafeErrorCopy('Internal Server Error')).toBe(true);
	});

	it('containsUnsafeErrorCopy catches stack', () => {
		expect(containsUnsafeErrorCopy('at Component.render (stack)')).toBe(true);
	});

	it('containsUnsafeErrorCopy catches trace', () => {
		expect(containsUnsafeErrorCopy('Error trace:')).toBe(true);
	});

	it('containsUnsafeErrorCopy catches undefined', () => {
		expect(containsUnsafeErrorCopy('undefined is not an object')).toBe(true);
	});

	it('containsUnsafeErrorCopy catches null', () => {
		expect(containsUnsafeErrorCopy('null pointer')).toBe(true);
	});

	it('safe Turkish text returns false', () => {
		expect(containsUnsafeErrorCopy('Bir şey ters gitti.')).toBe(false);
		expect(
			containsUnsafeErrorCopy(
				'Bu ekran şu anda açılmadı. Tekrar deneyebilir veya sohbete dönebilirsin.',
			),
		).toBe(false);
		expect(containsUnsafeErrorCopy('Güvenli kurtarma')).toBe(false);
		expect(containsUnsafeErrorCopy('Tekrar dene')).toBe(false);
		expect(containsUnsafeErrorCopy('Sohbete dön')).toBe(false);
	});

	it('copy has no mojibake', () => {
		const copy = getAppErrorRecoveryCopy();
		const allText = Object.values(copy).join(' ');
		const mojibakePatterns = ['Ã', 'Ä', 'Å', 'â€¢', '�'];

		for (const pattern of mojibakePatterns) {
			expect(allText).not.toContain(pattern);
		}
	});
});
