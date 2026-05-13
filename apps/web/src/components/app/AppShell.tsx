import type { ReactElement, ReactNode } from 'react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { uiCopy } from '../../localization/copy.js';
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

type AppShellProps = Readonly<{
	activePage: AuthenticatedPageId;
	children: ReactNode;
}>;

export function createAppCommands(
	navigate: (to: string) => void,
): readonly CommandPaletteCommand[] {
	return [
		{
			description: 'Ana sohbet alanına dön.',
			id: 'go-chat',
			keywords: ['ana ekran', 'mesaj', 'çalışma alanı'],
			label: 'Sohbet’e git',
			run: () => navigate('/chat'),
		},
		{
			description: 'Yeni bir sohbet taslağı aç.',
			id: 'start-new-chat',
			keywords: ['başlat', 'yeni mesaj', 'temiz sohbet'],
			label: 'Yeni sohbet başlat',
			run: () => navigate('/chat?new=1'),
		},
		{
			description: 'Kaydedilmiş sohbetleri ara ve aç.',
			id: 'go-history',
			keywords: ['kayıtlı sohbet', 'arama', 'önceki işler'],
			label: 'Geçmiş’e git',
			run: () => navigate('/history'),
		},
		{
			description: 'Sohbet geçmişi yüzeyini aç.',
			id: 'open-history',
			keywords: ['sohbet geçmişi', 'kaldığım iş', 'arşiv'],
			label: 'Sohbet geçmişini aç',
			run: () => navigate('/history'),
		},
		{
			description: 'Bağlı bilgisayarlarını görüntüle.',
			id: 'go-devices',
			keywords: ['bilgisayar', 'masaüstü', 'bağlantı'],
			label: 'Cihazlar’a git',
			run: () => navigate('/devices'),
		},
		{
			description: 'Cihaz bağlantılarını kontrol et.',
			id: 'view-device-connections',
			keywords: ['masaüstü bağlantısı', 'açık bilgisayar', 'izinler'],
			label: 'Cihaz bağlantılarını görüntüle',
			run: () => navigate('/devices'),
		},
		{
			description: 'Profil ve oturum bilgilerini gör.',
			id: 'go-account',
			keywords: ['profil', 'oturum', 'çıkış'],
			label: 'Hesap’a git',
			run: () => navigate('/account'),
		},
		{
			description: 'Tema ve ses tercihlerini düzenle.',
			id: 'open-preferences',
			keywords: ['ayarlar', 'tema', 'ses'],
			label: 'Tercihleri aç',
			run: () => navigate('/account?tab=preferences'),
		},
	] as const;
}

function getCommandShortcutLabel(): string {
	if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/u.test(navigator.platform)) {
		return '⌘K';
	}

	return 'Ctrl K';
}

export function AppShell({ activePage, children }: AppShellProps): ReactElement {
	const navigate = useNavigate();
	const { closePalette, isOpen, openPalette } = useCommandPalette();
	const pageCopy = pageCopyById[activePage];
	const commands = useMemo(() => createAppCommands(navigate), [navigate]);
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
							aria-label="Komut paletini aç"
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
