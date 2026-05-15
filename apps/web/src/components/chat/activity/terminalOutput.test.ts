import { describe, expect, it } from 'vitest';

import {
	formatDurationLabel,
	formatTerminalOutputSection,
	redactTerminalText,
} from './terminalOutput.js';

describe('terminalOutput', () => {
	describe('redactTerminalText', () => {
		it('redacts token query params', () => {
			const input = [
				'https://example.com?access_token=abc123456&refresh_token=ref123456',
				'ws_ticket=ws123456',
			].join('\n');

			const output = redactTerminalText(input);
			expect(output).toContain('access_token=[redacted]');
			expect(output).toContain('refresh_token=[redacted]');
			expect(output).toContain('ws_ticket=[redacted]');
			expect(output).not.toContain('abc123456');
			expect(output).not.toContain('ref123456');
			expect(output).not.toContain('ws123456');
		});

		it('redacts authorization bearer, jwt-like values, and api keys', () => {
			const input = [
				'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbb',
				'token=aaaaaaaaaaaaaaaa.aaaaaaaaaaaaaaaa.aaaaaaaaaaaaaaaa',
				'sk-abcdefghijklmnopqrstuvwxyz123456',
				'gsk_abcdefghijklmnopqrstuvwxyz123456',
			].join('\n');

			const output = redactTerminalText(input);
			expect(output).toContain('Authorization: Bearer [redacted]');
			expect(output).toContain('[redacted-jwt]');
			expect(output).toContain('[redacted-key]');
			expect(output).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
			expect(output).not.toContain('sk-abcdefghijklmnopqrstuvwxyz123456');
			expect(output).not.toContain('gsk_abcdefghijklmnopqrstuvwxyz123456');
		});

		it('keeps short words and file paths intact', () => {
			const input = 'src/components/Button.tsx\nok\nbtn-primary';
			const output = redactTerminalText(input);

			expect(output).toContain('src/components/Button.tsx');
			expect(output).toContain('ok');
			expect(output).toContain('btn-primary');
		});
	});

	describe('formatTerminalOutputSection', () => {
		it('returns null for empty input', () => {
			expect(formatTerminalOutputSection('stdout', undefined)).toBeNull();
			expect(formatTerminalOutputSection('stdout', '')).toBeNull();
			expect(formatTerminalOutputSection('stdout', '   ')).toBeNull();
		});

		it('normalizes CRLF and applies maxLines', () => {
			const input = 'line1\r\nline2\r\nline3';
			const section = formatTerminalOutputSection('stdout', input, { maxLines: 2, maxChars: 500 });
			expect(section).not.toBeNull();
			if (!section) {
				throw new Error('Expected section.');
			}

			expect(section.value).toBe('line1\nline2');
			expect(section.originalLineCount).toBe(3);
			expect(section.visibleLineCount).toBe(2);
			expect(section.truncated).toBe(true);
		});

		it('applies maxChars truncation metadata', () => {
			const section = formatTerminalOutputSection('stdout', 'abcdefghij', {
				maxChars: 5,
				maxLines: 50,
			});
			expect(section).not.toBeNull();
			if (!section) {
				throw new Error('Expected section.');
			}

			expect(section.value).toBe('abcde');
			expect(section.truncated).toBe(true);
			expect(section.originalLineCount).toBe(1);
			expect(section.visibleLineCount).toBe(1);
		});

		it('applies redaction before truncation', () => {
			const input = 'access_token=abc1234567890';
			const section = formatTerminalOutputSection('stdout', input, {
				maxChars: 24,
				maxLines: 50,
			});
			expect(section).not.toBeNull();
			if (!section) {
				throw new Error('Expected section.');
			}

			expect(section.value).toContain('access_token=[redacted]');
			expect(section.value).not.toContain('abc1234567890');
			expect(section.truncated).toBe(false);
		});
	});

	describe('formatDurationLabel', () => {
		it('formats milliseconds and seconds', () => {
			expect(formatDurationLabel(undefined)).toBeUndefined();
			expect(formatDurationLabel(999)).toBe('999 ms');
			expect(formatDurationLabel(1200)).toBe('yaklaşık 1.2 sn');
		});
	});
});
