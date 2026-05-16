import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MenuSheet } from './MenuSheet.js';

const navigateMock = vi.fn<(path: string) => void>();
const pushToastMock = vi.fn();
const dismissToastMock = vi.fn();

vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
	return {
		...actual,
		useNavigate: () => navigateMock,
	};
});

vi.mock('../ui/RunaToast.js', async () => {
	const actual = await vi.importActual<typeof import('../ui/RunaToast.js')>('../ui/RunaToast.js');
	return {
		...actual,
		useRunaToast: () => ({
			dismissToast: dismissToastMock,
			pushToast: pushToastMock,
		}),
	};
});

function renderMenu(overrides?: Partial<ComponentProps<typeof MenuSheet>>): {
	onOpenChange: ReturnType<typeof vi.fn>;
	onOpenHistorySheet: ReturnType<typeof vi.fn>;
	onToggleDeveloperMode: ReturnType<typeof vi.fn>;
} {
	const onOpenChange = vi.fn();
	const onOpenHistorySheet = vi.fn();
	const onToggleDeveloperMode = vi.fn();

	render(
		<MemoryRouter>
			<MenuSheet
				isDeveloperMode={true}
				open={true}
				onOpenChange={onOpenChange}
				onOpenHistorySheet={onOpenHistorySheet}
				onToggleDeveloperMode={onToggleDeveloperMode}
				{...overrides}
			/>
		</MemoryRouter>,
	);

	return { onOpenChange, onOpenHistorySheet, onToggleDeveloperMode };
}

afterEach(() => {
	cleanup();
	navigateMock.mockReset();
	pushToastMock.mockReset();
	dismissToastMock.mockReset();
});

describe('MenuSheet', () => {
	it('renders required menu labels with coherent Turkish copy', () => {
		renderMenu();

		expect(screen.getByRole('region', { name: 'Hızlı menü' })).toBeTruthy();
		expect(screen.getByText('Geçmiş')).toBeTruthy();
		expect(screen.getByText('Ayarlar')).toBeTruthy();
		expect(screen.getByText('Gelişmiş görünüm')).toBeTruthy();
		expect(screen.getByText('Yardım ve geri bildirim')).toBeTruthy();
		expect(screen.getByText('Açık')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Menüyü kapat' })).toBeTruthy();
	});

	it('navigates to /account from Ayarlar and never uses preferences query', () => {
		const { onOpenChange } = renderMenu();

		fireEvent.click(screen.getByRole('button', { name: 'Ayarlar' }));

		expect(navigateMock).toHaveBeenCalledWith('/account');
		expect(navigateMock).not.toHaveBeenCalledWith('/account?tab=preferences');
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('keeps history and developer callbacks wired', () => {
		const { onOpenChange, onOpenHistorySheet, onToggleDeveloperMode } = renderMenu({
			isDeveloperMode: false,
		});

		fireEvent.click(screen.getByRole('button', { name: 'Geçmiş' }));
		expect(onOpenHistorySheet).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenCalledWith(false);

		fireEvent.click(screen.getByRole('button', { name: /Gelişmiş görünüm/ }));
		expect(onToggleDeveloperMode).toHaveBeenCalledTimes(1);
		expect(screen.getByText('Kapalı')).toBeTruthy();
	});

	it('shows Yakında toast title for help action', () => {
		renderMenu();

		fireEvent.click(screen.getByRole('button', { name: /Yardım ve geri bildirim/ }));

		expect(pushToastMock).toHaveBeenCalledWith(
			expect.objectContaining({
				title: 'Yakında',
				tone: 'info',
			}),
		);
	});

	it('does not render old ASCII Turkish copy variants', () => {
		renderMenu();
		const bodyText = document.body.textContent ?? '';

		const forbidden = [
			'Gecmis',
			'Gelismis',
			'Acik',
			'Kapali',
			'Yardim',
			'Yakinda',
			'Hizli menu',
			'Menuyu kapat',
		];

		for (const token of forbidden) {
			expect(bodyText).not.toContain(token);
		}
	});
});
