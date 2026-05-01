import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyWebSocketClose, getTransportErrorState } from './error-catalog';

describe('transport error catalog', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('maps abnormal WebSocket close events to retryable disconnect state', () => {
		const code = classifyWebSocketClose({
			code: 1006,
			reason: '',
			wasClean: false,
		});

		expect(code).toBe('ws-disconnect');
		if (code === null) {
			throw new Error('Expected a transport error code.');
		}
		expect(getTransportErrorState(code).label).toContain('Tekrar dene');
	});

	it('maps offline abnormal WebSocket close events to the network retry banner state', () => {
		vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);

		const code = classifyWebSocketClose({
			code: 1006,
			reason: '',
			wasClean: false,
		});

		expect(code).toBe('network-cut');
		if (code === null) {
			throw new Error('Expected a transport error code.');
		}
		expect(getTransportErrorState(code).label).toBe('Bağlantı koptu — Tekrar dene');
	});

	it('ignores clean WebSocket closes', () => {
		expect(
			classifyWebSocketClose({
				code: 1000,
				reason: '',
				wasClean: true,
			}),
		).toBeNull();
	});
});
