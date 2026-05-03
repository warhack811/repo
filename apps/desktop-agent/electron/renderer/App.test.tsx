// @vitest-environment jsdom

import type {
	DesktopAgentLaunchControllerViewModel,
	DesktopAgentSessionInputPayload,
} from '../../src/index.js';

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from './App.tsx';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function createAwaitingSessionViewModel(): DesktopAgentLaunchControllerViewModel {
	return {
		agent_id: 'agent-1',
		awaiting_session_input: true,
		machine_label: 'Test PC',
		message: 'Paste your session to continue connecting this computer.',
		primary_action: {
			id: 'submit_session',
			label: 'Continue',
		},
		session_input: {
			access_token_label: 'Access token',
			refresh_token_label: 'Refresh token',
		},
		session_present: false,
		status: 'awaiting_session_input',
		title: 'Sign in required',
	};
}

function createConnectedViewModel(): DesktopAgentLaunchControllerViewModel {
	return {
		agent_id: 'agent-1',
		awaiting_session_input: false,
		machine_label: 'Test PC',
		message: 'This computer is connected and ready.',
		primary_action: {
			id: 'connect',
			label: 'Connected',
		},
		secondary_action: {
			id: 'sign_out',
			label: 'Sign out',
		},
		session_present: true,
		status: 'connected',
		title: 'Connected',
	};
}

function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
	const prototype =
		element instanceof HTMLTextAreaElement
			? HTMLTextAreaElement.prototype
			: HTMLInputElement.prototype;
	const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
	valueSetter?.call(element, value);
	element.dispatchEvent(new Event('input', { bubbles: true }));
	element.dispatchEvent(new Event('change', { bubbles: true }));
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('Desktop renderer App', () => {
	it('submits the session form over IPC and renders pushed view-model updates', async () => {
		const listeners: Array<(viewModel: DesktopAgentLaunchControllerViewModel) => void> = [];
		const submittedPayloads: DesktopAgentSessionInputPayload[] = [];

		window.runaDesktop = {
			connect: async () => undefined,
			disconnect: async () => undefined,
			getAgentStatus: async () => undefined,
			getShellState: async () => undefined,
			getViewModel: async () => createAwaitingSessionViewModel(),
			invokeAction: async () => createConnectedViewModel(),
			onShellStateChange: () => () => undefined,
			onViewModelChange: (callback) => {
				listeners.push(callback);
				return () => undefined;
			},
			platform: 'win32',
			signIn: async () => undefined,
			signOut: async () => undefined,
			submitSession: async (payload) => {
				submittedPayloads.push(payload);
				return createConnectedViewModel();
			},
			versions: {
				chrome: '130.0.0',
				electron: '38.0.0',
				node: '22.0.0',
			},
		};

		const container = document.createElement('div');
		document.body.append(container);
		const root = createRoot(container);

		await act(async () => {
			root.render(<App />);
		});

		const accessTokenInput = document.querySelector<HTMLTextAreaElement>(
			'#desktop-agent-access-token',
		);
		const refreshTokenInput = document.querySelector<HTMLTextAreaElement>(
			'#desktop-agent-refresh-token',
		);
		const expiresAtInput = document.querySelector<HTMLInputElement>('#desktop-agent-expires-at');
		const form = document.querySelector<HTMLFormElement>('[data-field="session-form"]');

		expect(accessTokenInput).not.toBeNull();
		expect(refreshTokenInput).not.toBeNull();
		expect(expiresAtInput).not.toBeNull();
		expect(form).not.toBeNull();

		await act(async () => {
			if (accessTokenInput && refreshTokenInput && expiresAtInput) {
				setInputValue(accessTokenInput, 'access-token');
				setInputValue(refreshTokenInput, 'refresh-token');
				setInputValue(expiresAtInput, '1770000000');
			}
		});

		await act(async () => {
			if (form) {
				form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
			}
		});

		expect(submittedPayloads).toEqual([
			{
				access_token: 'access-token',
				expires_at: 1770000000,
				refresh_token: 'refresh-token',
			},
		]);
		expect(document.querySelector('[data-field="status-value"]')?.textContent).toBe('Connected');

		await act(async () => {
			for (const listener of listeners) {
				listener({
					...createConnectedViewModel(),
					message: 'Updated from IPC',
				});
			}
		});

		expect(document.querySelector('[data-field="message"]')?.textContent).toBe('Updated from IPC');
	});
});
