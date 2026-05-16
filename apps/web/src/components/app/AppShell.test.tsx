import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createAppCommands } from './AppShell.js';

const navigateMock = vi.fn<(path: string) => void>();

vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
	return {
		...actual,
		useNavigate: () => navigateMock,
	};
});

vi.mock('../command/CommandPalette.js', () => ({
	CommandPalette: () => null,
}));

vi.mock('../command/CommandPaletteContext.js', () => ({
	CommandPaletteProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../command/useCommandPalette.js', () => ({
	useCommandPalette: () => ({
		closePalette: vi.fn(),
		isOpen: false,
		openPalette: vi.fn(),
	}),
}));

vi.mock('../../lib/theme.js', () => ({
	applyBrandTheme: vi.fn(),
	applyTheme: vi.fn(),
	storeBrandTheme: vi.fn(),
	storeTheme: vi.fn(),
}));

function getCommands(options?: Parameters<typeof createAppCommands>[1]) {
	return createAppCommands(navigateMock, options);
}

describe('createAppCommands copy', () => {
	it('produces expected label/description/keywords with correct Turkish UTF-8', () => {
		const commands = getCommands();

		const goChat = commands.find((c) => c.id === 'go-chat');
		expect(goChat?.description).toBe('Ana sohbete dön.');
		expect(goChat?.keywords).toContain('çalışma alanı');

		const startNewChat = commands.find((c) => c.id === 'start-new-chat');
		expect(startNewChat?.description).toBe('Yeni bir sohbet taslağı aç.');
		expect(startNewChat?.keywords).toContain('başlat');

		const openHistorySheet = commands.find((c) => c.id === 'open-history-sheet');
		expect(openHistorySheet?.description).toBe('Sohbet geçmişini aç.');
		expect(openHistorySheet?.keywords).toContain('sohbet geçmişi');
		expect(openHistorySheet?.keywords).toContain('kaldığım iş');
		expect(openHistorySheet?.keywords).toContain('arşiv');
		expect(openHistorySheet?.label).toBe('Geçmişi aç');

		const openContextSheet = commands.find((c) => c.id === 'open-context-sheet');
		expect(openContextSheet?.description).toBe('Bağlam panelini aç.');
		expect(openContextSheet?.keywords).toContain('bağlam');
		expect(openContextSheet?.label).toBe('Bağlamı aç');

		const themeSystem = commands.find((c) => c.id === 'theme-system');
		expect(themeSystem?.description).toBe('Tema seçimini Sistem moduna geri getir.');

		const toggleAdvancedView = commands.find((c) => c.id === 'toggle-advanced-view');
		expect(toggleAdvancedView?.description).toBe('Gelişmiş görünümü aç veya kapat.');
		expect(toggleAdvancedView?.label).toBe('Gelişmiş görünümü aç');
		expect(toggleAdvancedView?.keywords).toContain('gelişmiş');
		expect(toggleAdvancedView?.keywords).toContain('geliştirici');
		expect(toggleAdvancedView?.keywords).toContain('görünüm');

		const showNotifications = commands.find((c) => c.id === 'show-notifications');
		expect(showNotifications?.description).toBe('Bildirim panelini aç.');
		expect(showNotifications?.label).toBe('Bildirimleri göster');
		expect(showNotifications?.keywords).toContain('uyarı');
		expect(showNotifications?.keywords).toContain('hatırlatma');

		const goHistoryRoute = commands.find((c) => c.id === 'go-history-route');
		expect(goHistoryRoute?.description).toBe('Kayıtlı sohbetleri sayfa görünümünde aç.');
		expect(goHistoryRoute?.label).toBe('Geçmiş sayfasına git');
		expect(goHistoryRoute?.keywords).toContain('geçmiş sayfası');
		expect(goHistoryRoute?.keywords).toContain('kayıtlı sohbetler');
	});

	it('does not contain old ASCII Turkish copy', () => {
		const commands = getCommands();
		const allText = commands.flatMap((c) => [c.label, c.description, ...c.keywords]).join(' ');

		const forbidden = [
			'alanina',
			'don',
			'calisma',
			'taslagi',
			'baslat',
			'gecmisi',
			'kaldigim',
			'arsiv',
			'Gecmisi',
			'Baglami',
			'secimini',
			'Gelismis',
			'gorunum',
			'gelistirici',
			'Bildirimleri goster',
			'Kayitli',
			'working files',
		];

		for (const token of forbidden) {
			expect(allText, `forbidden token: "${token}"`).not.toContain(token);
		}
	});

	it('shows closed label when isAdvancedMode is true', () => {
		const commands = getCommands({ isAdvancedMode: true });
		const toggle = commands.find((c) => c.id === 'toggle-advanced-view');
		expect(toggle?.label).toBe('Gelişmiş görünümü kapat');
	});

	it('applies system default theme without throwing', () => {
		const commands = getCommands();
		const themeSystem = commands.find((c) => c.id === 'theme-system');
		expect(() => themeSystem?.run()).not.toThrow();
	});
});

describe('createAppCommands behavior', () => {
	it('go-chat navigates to /chat', () => {
		const commands = getCommands();
		const goChat = commands.find((c) => c.id === 'go-chat');
		goChat?.run();
		expect(navigateMock).toHaveBeenCalledWith('/chat');
	});

	it('start-new-chat navigates to /chat?new=1', () => {
		const commands = getCommands();
		const startNewChat = commands.find((c) => c.id === 'start-new-chat');
		startNewChat?.run();
		expect(navigateMock).toHaveBeenCalledWith('/chat?new=1');
	});

	it('toggle-advanced-view calls onSetAdvancedMode with correct boolean', () => {
		const onSetAdvancedMode = vi.fn();
		const commands = getCommands({ isAdvancedMode: false, onSetAdvancedMode });
		const toggle = commands.find((c) => c.id === 'toggle-advanced-view');
		toggle?.run();
		expect(onSetAdvancedMode).toHaveBeenCalledWith(true);
	});

	it('open-history-sheet calls onOpenHistorySheet when activePage is chat', () => {
		const onOpenHistorySheet = vi.fn();
		const commands = getCommands({ activePage: 'chat', onOpenHistorySheet });
		const cmd = commands.find((c) => c.id === 'open-history-sheet');
		cmd?.run();
		expect(onOpenHistorySheet).toHaveBeenCalledTimes(1);
	});

	it('open-history-sheet navigates to chat when activePage is not chat', () => {
		const navigateToChat = vi.fn();
		const commands = getCommands({ activePage: 'history', navigateToChat });
		const cmd = commands.find((c) => c.id === 'open-history-sheet');
		cmd?.run();
		expect(navigateToChat).toHaveBeenCalledTimes(1);
	});

	it('open-context-sheet calls onOpenContextSheet when activePage is chat', () => {
		const onOpenContextSheet = vi.fn();
		const commands = getCommands({ activePage: 'chat', onOpenContextSheet });
		const cmd = commands.find((c) => c.id === 'open-context-sheet');
		cmd?.run();
		expect(onOpenContextSheet).toHaveBeenCalledTimes(1);
	});

	it('open-context-sheet navigates to chat when activePage is not chat', () => {
		const navigateToChat = vi.fn();
		const commands = getCommands({ activePage: 'account', navigateToChat });
		const cmd = commands.find((c) => c.id === 'open-context-sheet');
		cmd?.run();
		expect(navigateToChat).toHaveBeenCalledTimes(1);
	});

	it('show-notifications calls onShowNotifications', () => {
		const onShowNotifications = vi.fn();
		const commands = getCommands({ onShowNotifications });
		const cmd = commands.find((c) => c.id === 'show-notifications');
		cmd?.run();
		expect(onShowNotifications).toHaveBeenCalledTimes(1);
	});

	it('go-history-route calls navigateToHistoryRoute', () => {
		const navigateToHistoryRoute = vi.fn();
		const commands = getCommands({ navigateToHistoryRoute });
		const cmd = commands.find((c) => c.id === 'go-history-route');
		cmd?.run();
		expect(navigateToHistoryRoute).toHaveBeenCalledTimes(1);
	});
});
