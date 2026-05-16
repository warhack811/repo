import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

function LocationProbe(): ReactElement {
	const location = useLocation();
	return <output data-testid="location-search">{location.search}</output>;
}

function renderSettings(
	initialEntry = '/account?tab=conversation',
	props: Partial<ComponentProps<typeof SettingsPage>> = {},
): void {
	render(
		<MemoryRouter initialEntries={[initialEntry]}>
			<Routes>
				<Route
					path="/account"
					element={
						<>
							<SettingsPage
								accessToken={null}
								authContext={authContext}
								authError={null}
								brandTheme="teal"
								isAuthPending={false}
								onBrandThemeChange={() => undefined}
								onLogout={async () => undefined}
								onThemeChange={() => undefined}
								theme="system"
								{...props}
							/>
							<LocationProbe />
						</>
					}
				/>
			</Routes>
		</MemoryRouter>,
	);
}

beforeEach(() => {
	window.localStorage.clear();
});

afterEach(() => {
	cleanup();
});

describe('SettingsPage approval mode preferences', () => {
	it('renders approval mode preferences with standard as the default', () => {
		renderSettings();

		expect(screen.getByRole('heading', { name: 'Onay modu' })).toBeTruthy();
		expect(screen.getByRole<HTMLInputElement>('radio', { name: /Standart/i }).checked).toBe(true);
		expect(screen.getByText(/komut, masaüstü kontrolü ve yüksek riskli işlemler/i)).toBeTruthy();
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
		fireEvent.click(screen.getByRole('radio', { name: /Güvenilir oturum/i }));

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

	it('surfaces brand theme choices through the controlled settings callback', () => {
		const onBrandThemeChange = vi.fn();

		renderSettings('/account', { onBrandThemeChange });
		fireEvent.click(screen.getByRole('tab', { name: /Görünüm/i }));
		fireEvent.click(screen.getByRole('button', { name: /Indigo/i }));

		expect(screen.getByRole('heading', { name: 'Tema' })).toBeTruthy();
		expect(onBrandThemeChange).toHaveBeenCalledWith('indigo');
	});
});

describe('SettingsPage tab parsing and URL normalization', () => {
	it('normalizes legacy preferences query to appearance default URL', async () => {
		renderSettings('/account?tab=preferences');

		expect(screen.getByRole('tab', { name: 'Görünüm', selected: true })).toBeTruthy();
		await waitFor(() => {
			expect(screen.getByTestId('location-search').textContent).toBe('');
		});
	});

	it('normalizes unknown query to appearance default URL', async () => {
		renderSettings('/account?tab=unknown');

		expect(screen.getByRole('tab', { name: 'Görünüm', selected: true })).toBeTruthy();
		await waitFor(() => {
			expect(screen.getByTestId('location-search').textContent).toBe('');
		});
	});

	it('keeps valid conversation query and tab selection', async () => {
		renderSettings('/account?tab=conversation');

		expect(screen.getByRole('tab', { name: 'Sohbet', selected: true })).toBeTruthy();
		await waitFor(() => {
			expect(screen.getByTestId('location-search').textContent).toBe('?tab=conversation');
		});
	});

	it('writes and clears tab query when switching between sohbet and görünüm tabs', async () => {
		renderSettings('/account');

		fireEvent.click(screen.getByRole('tab', { name: 'Sohbet' }));
		await waitFor(() => {
			expect(screen.getByTestId('location-search').textContent).toBe('?tab=conversation');
		});

		fireEvent.click(screen.getByRole('tab', { name: 'Görünüm' }));
		await waitFor(() => {
			expect(screen.getByTestId('location-search').textContent).toBe('');
		});
	});
});

describe('SettingsPage Turkish copy coherence', () => {
	it('renders updated copy and keeps old ASCII variants out of the UI', () => {
		renderSettings('/account?tab=conversation');

		expect(screen.getByText('Her işlemde sor')).toBeTruthy();
		expect(screen.getByText('Güvenilir oturum')).toBeTruthy();

		fireEvent.click(screen.getByRole('tab', { name: 'Görünüm' }));
		expect(screen.getByText('Metin yoğunluğu')).toBeTruthy();
		expect(screen.getByText('Sıkı')).toBeTruthy();

		fireEvent.click(screen.getByRole('tab', { name: 'Bildirimler' }));
		expect(screen.getByText('Türkçe')).toBeTruthy();
		expect(screen.getByText('30 gün')).toBeTruthy();
		expect(screen.getByText('Süresiz')).toBeTruthy();

		fireEvent.click(screen.getByRole('tab', { name: 'Gizlilik' }));
		expect(screen.getByText('Run klasörü')).toBeTruthy();
		expect(screen.getByText('Workspace kökü (varsayılan)')).toBeTruthy();

		const forbidden = [
			'Her islemde',
			'Guvenilir',
			'Metin yogunlugu',
			'Siki',
			'Turkce',
			'30 gun',
			'Suresiz',
			'Run klasoru',
			'Workspace koku',
		];
		const text = document.body.textContent ?? '';
		for (const item of forbidden) {
			expect(text).not.toContain(item);
		}
	});
});
