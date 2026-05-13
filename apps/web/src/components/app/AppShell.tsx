import type { ReactElement, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { BrandTheme, Theme } from '../../lib/theme.js';

import { applyBrandTheme, applyTheme, storeBrandTheme, storeTheme } from '../../lib/theme.js';
import { uiCopy } from '../../localization/copy.js';
import {
	CHAT_SURFACE_EVENT_OPEN_CONTEXT_SHEET,
	CHAT_SURFACE_EVENT_OPEN_HISTORY_SHEET,
	dispatchChatSurfaceEvent,
} from '../chat/chat-surface-events.js';
import { CommandPalette } from '../command/CommandPalette.js';
import { CommandPaletteProvider } from '../command/CommandPaletteContext.js';
import type { CommandPaletteCommand } from '../command/command-palette-utils.js';
import { useCommandPalette } from '../command/useCommandPalette.js';
import { RunaSurface } from '../ui/RunaSurface.js';
import { AppNav, type AuthenticatedPageId } from './AppNav.js';

const pageCopyById: Record<
	AuthenticatedPageId,
	{
		readonly eyebrow: string;
		readonly subtitle: string;
		readonly title: string;
	}
> = {
	chat: {
		eyebrow: uiCopy.appShell.chatEyebrow,
		subtitle: uiCopy.appShell.chatSubtitle,
		title: uiCopy.appShell.chatTitle,
	},
	account: {
		eyebrow: uiCopy.appShell.accountEyebrow,
		subtitle: uiCopy.appShell.accountSubtitle,
		title: uiCopy.appShell.accountTitle,
	},
	devices: {
		eyebrow: uiCopy.appShell.devicesEyebrow,
		subtitle: uiCopy.appShell.devicesSubtitle,
		title: uiCopy.appShell.devicesTitle,
	},
	history: {
		eyebrow: uiCopy.appShell.historyEyebrow,
		subtitle: uiCopy.appShell.historySubtitle,
		title: uiCopy.appShell.historyTitle,
	},
};

const ADVANCED_MODE_STORAGE_KEY = 'runa_dev_mode';

type AppShellProps = Readonly<{
	activePage: AuthenticatedPageId;
	children: ReactNode;
}>;

type CreateAppCommandOptions = Readonly<{
	activePage?: AuthenticatedPageId;
	isAdvancedMode?: boolean;
	navigateToChat: () => void;
	navigateToHistoryRoute: () => void;
	onOpenContextSheet: () => void;
	onOpenHistorySheet: () => void;
	onSetAdvancedMode: (nextValue: boolean) => void;
	onSetThemePreset: (preset: 'ember-dark' | 'ember-light' | 'rose-dark' | 'system') => void;
	onShowNotifications: () => void;
}>;

export function createAppCommands(
	navigate: (to: string) => void,
	options?: CreateAppCommandOptions,
): readonly CommandPaletteCommand[] {
	const activePage = options?.activePage ?? 'chat';
	const isAdvancedMode = options?.isAdvancedMode ?? false;
	const openHistory = options?.onOpenHistorySheet ?? (() => navigate('/history'));
	const openContext = options?.onOpenContextSheet ?? (() => navigate('/chat'));
	const showNotifications = options?.onShowNotifications ?? (() => undefined);
	const setAdvancedMode = options?.onSetAdvancedMode ?? (() => undefined);
	const setThemePreset = options?.onSetThemePreset ?? (() => undefined);
	const navigateToChat = options?.navigateToChat ?? (() => navigate('/chat'));
	const navigateToHistoryRoute = options?.navigateToHistoryRoute ?? (() => navigate('/history'));

	function runChatSurfaceAction(action: () => void): void {
		if (activePage !== 'chat') {
			navigateToChat();
			return;
		}

		action();
	}

	return [
		{
			description: 'Ana sohbet alanina don.',
			id: 'go-chat',
			keywords: ['ana ekran', 'mesaj', 'calisma alani'],
			label: 'Sohbete git',
			run: () => navigate('/chat'),
			shortcut: 'Ctrl+K',
		},
		{
			description: 'Yeni bir sohbet taslagi ac.',
			id: 'start-new-chat',
			keywords: ['baslat', 'yeni mesaj', 'temiz sohbet'],
			label: 'Yeni sohbet baslat',
			run: () => navigate('/chat?new=1'),
			shortcut: 'Ctrl+N',
		},
		{
			description: 'Sohbet gecmisi sheetini ac.',
			id: 'open-history-sheet',
			keywords: ['sohbet gecmisi', 'kaldigim is', 'arsiv'],
			label: 'Gecmisi ac',
			run: () => runChatSurfaceAction(openHistory),
		},
		{
			description: 'Baglam panelini ac.',
			id: 'open-context-sheet',
			keywords: ['baglam', 'ekler', 'working files'],
			label: 'Baglami ac',
			run: () => runChatSurfaceAction(openContext),
		},
		{
			description: 'Tema presetini Ember Dark olarak ayarla.',
			id: 'theme-ember-dark',
			keywords: ['tema', 'koyu', 'ember'],
			label: 'Tema: Ember Dark',
			run: () => setThemePreset('ember-dark'),
		},
		{
			description: 'Tema presetini Light olarak ayarla.',
			id: 'theme-light',
			keywords: ['tema', 'acik', 'light'],
			label: 'Tema: Light',
			run: () => setThemePreset('ember-light'),
		},
		{
			description: 'Tema presetini Rose olarak ayarla.',
			id: 'theme-rose',
			keywords: ['tema', 'rose', 'vurgu'],
			label: 'Tema: Rose',
			run: () => setThemePreset('rose-dark'),
		},
		{
			description: 'Tema secimini Sistem moduna geri getir.',
			id: 'theme-system',
			keywords: ['tema', 'sistem', 'default'],
			label: 'Tema: Sistem',
			run: () => setThemePreset('system'),
		},
		{
			description: 'Gelismis gorunumu ac veya kapat.',
			id: 'toggle-advanced-view',
			keywords: ['gelismis', 'gelistirici', 'gorunum'],
			label: isAdvancedMode ? 'Gelismis gorunumu kapat' : 'Gelismis gorunumu ac',
			run: () => setAdvancedMode(!isAdvancedMode),
		},
		{
			description: 'Bildirim panelini ac.',
			id: 'show-notifications',
			keywords: ['bildirim', 'uyari', 'hatirlatma'],
			label: 'Bildirimleri goster',
			run: showNotifications,
		},
		{
			description: 'Kayitli sohbetleri sayfa gorunumunde ac.',
			id: 'go-history-route',
			keywords: ['history sayfasi', 'kayitli sohbetler'],
			label: 'Gecmis sayfasina git',
			run: navigateToHistoryRoute,
		},
	] as const;
}

function getCommandShortcutLabel(): string {
	if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/u.test(navigator.platform)) {
		return 'Cmd K';
	}

	return 'Ctrl K';
}

function applyThemePreset(preset: 'ember-dark' | 'ember-light' | 'rose-dark' | 'system'): void {
	const themeByPreset: Record<'ember-dark' | 'ember-light' | 'rose-dark' | 'system', Theme> = {
		'ember-dark': 'ember-dark',
		'ember-light': 'ember-light',
		'rose-dark': 'rose-dark',
		system: 'system',
	};
	const brandByPreset: Partial<
		Record<'ember-dark' | 'ember-light' | 'rose-dark' | 'system', BrandTheme>
	> = {
		'ember-dark': 'amber',
		'rose-dark': 'plum',
	};
	const nextTheme = themeByPreset[preset];
	const nextBrandTheme = brandByPreset[preset];

	storeTheme(nextTheme);
	applyTheme(nextTheme);

	if (nextBrandTheme) {
		storeBrandTheme(nextBrandTheme);
		applyBrandTheme(nextBrandTheme);
	}
}

function readAdvancedMode(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}

	return window.localStorage.getItem(ADVANCED_MODE_STORAGE_KEY) === 'true';
}

function writeAdvancedMode(nextValue: boolean): void {
	if (typeof window === 'undefined') {
		return;
	}

	window.localStorage.setItem(ADVANCED_MODE_STORAGE_KEY, nextValue ? 'true' : 'false');
}

export function AppShell({ activePage, children }: AppShellProps): ReactElement {
	const location = useLocation();
	const navigate = useNavigate();
	const { closePalette, isOpen, openPalette } = useCommandPalette();
	const [isAdvancedMode, setIsAdvancedMode] = useState<boolean>(() => readAdvancedMode());
	const pageCopy = pageCopyById[activePage];
	const commands = useMemo(
		() =>
			createAppCommands(navigate, {
				activePage,
				isAdvancedMode,
				navigateToChat: () => navigate('/chat'),
				navigateToHistoryRoute: () => navigate('/history'),
				onOpenContextSheet: () => dispatchChatSurfaceEvent(CHAT_SURFACE_EVENT_OPEN_CONTEXT_SHEET),
				onOpenHistorySheet: () => dispatchChatSurfaceEvent(CHAT_SURFACE_EVENT_OPEN_HISTORY_SHEET),
				onSetAdvancedMode: (nextValue) => {
					writeAdvancedMode(nextValue);
					setIsAdvancedMode(nextValue);
				},
				onSetThemePreset: applyThemePreset,
				onShowNotifications: () => {
					if (location.pathname !== '/chat') {
						navigate('/chat');
					}
				},
			}),
		[activePage, isAdvancedMode, location.pathname, navigate],
	);
	const commandShortcutLabel = getCommandShortcutLabel();

	const commandPalette = (
		<CommandPalette commands={commands} isOpen={isOpen} onClose={closePalette} />
	);

	if (activePage === 'chat') {
		return (
			<div className="runa-page runa-page--chat-product runa-migrated-components-app-appshell-1">
				<CommandPaletteProvider openPalette={openPalette}>
					<main
						id="authenticated-app-content"
						className="runa-app-shell-main runa-app-shell-main--chat runa-route-transition runa-migrated-components-app-appshell-2"
					>
						{children}
					</main>
				</CommandPaletteProvider>
				{commandPalette}
			</div>
		);
	}

	return (
		<div className="runa-page runa-page--app-shell runa-migrated-components-app-appshell-3">
			<div className="runa-shell-frame runa-shell-frame--app runa-migrated-components-app-appshell-4">
				<header className="runa-card runa-card--hero runa-ambient-panel runa-app-shell-header runa-migrated-components-app-appshell-5">
					<div className="runa-app-shell-header__top">
						<div className="runa-app-shell-header__copy">
							<div className="runa-eyebrow">{pageCopy.eyebrow.toUpperCase()}</div>
							<h1 className="runa-migrated-components-app-appshell-6">{pageCopy.title}</h1>
							<p className="runa-migrated-components-app-appshell-7">{pageCopy.subtitle}</p>
						</div>
						<button
							type="button"
							className="runa-command-palette-trigger"
							onClick={openPalette}
							aria-label="Komut paletini ac"
						>
							<span>Komut ara</span>
							<kbd>{commandShortcutLabel}</kbd>
						</button>
					</div>

					<div className="runa-app-shell-nav">
						<AppNav activePage={activePage} />
					</div>
				</header>

				<RunaSurface
					as="main"
					id="authenticated-app-content"
					className="runa-app-shell-main runa-route-transition runa-migrated-components-app-appshell-8"
					tone="plain"
				>
					{children}
				</RunaSurface>
				{commandPalette}
			</div>
		</div>
	);
}
