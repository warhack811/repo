import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthContext } from '@runa/types';
import { SettingsPage } from './SettingsPage.js';

const authContext: AuthContext = {
	principal: {
		email: 'person@example.com',
		kind: 'authenticated',
		provider: 'supabase',
		role: 'authenticated',
		scope: {},
		session_id: 'session_settings',
		user_id: 'user_settings',
	},
	session: {
		identity_provider: 'email_password',
		provider: 'supabase',
		scope: {},
		session_id: 'session_settings',
		user_id: 'user_settings',
	},
	transport: 'websocket',
};

function renderSettings(): void {
	render(
		<MemoryRouter initialEntries={['/account?tab=preferences']}>
			<SettingsPage
				authContext={authContext}
				authError={null}
				isAuthPending={false}
				onLogout={async () => undefined}
			/>
		</MemoryRouter>,
	);
}

describe('SettingsPage approval mode preferences', () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	afterEach(() => {
		cleanup();
	});

	it('renders approval mode preferences with standard as the default', () => {
		renderSettings();

		expect(screen.getByRole('heading', { name: 'Onay modu' })).toBeTruthy();
		expect(screen.getByRole<HTMLInputElement>('radio', { name: /Standart/i }).checked).toBe(true);
		expect(screen.getByText(/komut, masaustu kontrolu ve yuksek riskli islemler/i)).toBeTruthy();
	});

	it('persists the selected approval mode while preserving existing runtime config', () => {
		window.localStorage.setItem(
			'runa.developer.runtime_config',
			JSON.stringify({
				apiKey: 'existing-key',
				includePresentationBlocks: true,
				model: 'deepseek-v4-flash',
				provider: 'deepseek',
			}),
		);

		renderSettings();
		fireEvent.click(screen.getByRole('radio', { name: /Guvenilir oturum/i }));

		expect(
			JSON.parse(window.localStorage.getItem('runa.developer.runtime_config') ?? '{}'),
		).toEqual({
			apiKey: 'existing-key',
			approvalMode: 'trusted-session',
			includePresentationBlocks: true,
			model: 'deepseek-v4-flash',
			provider: 'deepseek',
		});
	});
});
