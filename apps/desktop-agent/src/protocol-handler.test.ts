import { describe, expect, it } from 'vitest';

import {
	findDesktopPairingCodeInArgv,
	maskDesktopPairingCode,
	parseDesktopPairingCodeUrl,
} from './protocol-handler.js';

describe('desktop protocol handler', () => {
	it('parses valid runa desktop pairing URLs', () => {
		expect(parseDesktopPairingCodeUrl('runa://desktop-pair?code=ABCD1234')).toEqual({
			code: 'ABCD1234',
		});
		expect(
			findDesktopPairingCodeInArgv(['--hidden', 'runa://desktop-pair?code=ABCD_1234-XYZ']),
		).toEqual({
			code: 'ABCD_1234-XYZ',
		});
	});

	it('rejects malformed protocol inputs and unsafe codes', () => {
		expect(parseDesktopPairingCodeUrl('https://runa.app/desktop-pair?code=ABCD1234')).toBeNull();
		expect(parseDesktopPairingCodeUrl('runa://desktop-pair?code=abc123')).toBeNull();
		expect(parseDesktopPairingCodeUrl('runa://desktop-pair?code=ABCD')).toBeNull();
		expect(parseDesktopPairingCodeUrl('runa://desktop-pair?code=ABCD%201234')).toBeNull();
		expect(parseDesktopPairingCodeUrl('not a url')).toBeNull();
	});

	it('masks pairing codes for display', () => {
		expect(maskDesktopPairingCode('ABCD1234')).toBe('ABCD...');
		expect(maskDesktopPairingCode('ABCD')).toBe('****');
	});
});
