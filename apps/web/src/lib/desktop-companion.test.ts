import { afterEach, describe, expect, it, vi } from 'vitest';

import { bindDesktopCompanionSession, clearDesktopCompanionSession } from './desktop-companion.js';

describe('desktop companion session handoff', () => {
	afterEach(() => {
		Reflect.deleteProperty(window, 'runaDesktop');
	});

	it('submits a production-style auth session through the preload API only', () => {
		const submitSession = vi.fn();
		Object.defineProperty(window, 'runaDesktop', {
			configurable: true,
			value: {
				submitSession,
			},
		});

		bindDesktopCompanionSession({
			access_token: ' access-token ',
			expires_at: 1_777_777_777,
			refresh_token: ' refresh-token ',
			token_type: 'Bearer',
		});

		expect(submitSession).toHaveBeenCalledWith({
			access_token: 'access-token',
			expires_at: 1_777_777_777,
			refresh_token: 'refresh-token',
			token_type: 'Bearer',
		});
	});

	it('clears the desktop companion session through signOut when available', () => {
		const signOut = vi.fn();
		Object.defineProperty(window, 'runaDesktop', {
			configurable: true,
			value: {
				signOut,
			},
		});

		clearDesktopCompanionSession();

		expect(signOut).toHaveBeenCalledTimes(1);
	});
});
