import { Bell, ChevronLeft, MoreHorizontal, Search, Settings } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useCommandPaletteTrigger } from '../command/CommandPaletteContext.js';

type ChatHeaderProps = Readonly<{
	activeConversationTitle?: string;
	activeDeviceLabel?: string;
	isHistorySheetOpen: boolean;
	isMenuSheetOpen: boolean;
	onOpenHistorySheet: () => void;
	onOpenMenuSheet: () => void;
}>;

function getCommandShortcutLabel(): string {
	if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/u.test(navigator.platform)) {
		return 'Cmd K';
	}

	return 'Ctrl K';
}

export function ChatHeader({
	activeConversationTitle,
	activeDeviceLabel,
	isHistorySheetOpen,
	isMenuSheetOpen,
	onOpenHistorySheet,
	onOpenMenuSheet,
}: ChatHeaderProps): ReactElement {
	const navigate = useNavigate();
	const openCommandPalette = useCommandPaletteTrigger();
	const title = activeConversationTitle?.trim() || 'Yeni sohbet';
	const shortcutLabel = getCommandShortcutLabel();

	return (
		<header className="runa-chat-header" aria-label="Sohbet basligi">
			<div className="runa-chat-header__left">
				<button
					type="button"
					className="runa-chat-icon-button runa-chat-header__mobile-action runa-chat-header__back"
					aria-controls="history-sheet"
					aria-expanded={isHistorySheetOpen}
					aria-label="Sohbet gecmisini ac"
					onClick={onOpenHistorySheet}
				>
					<ChevronLeft aria-hidden="true" size={21} />
				</button>
				<div className="runa-chat-header__title-group">
					<h1 className="runa-chat-header__title">{title}</h1>
					{activeDeviceLabel ? (
						<>
							<p className="runa-chat-header__subtitle runa-chat-header__subtitle--desktop">
								{activeDeviceLabel} uzerinde
							</p>
							<p className="runa-chat-header__subtitle runa-chat-header__subtitle--mobile">
								cevrimici - {activeDeviceLabel}
							</p>
						</>
					) : (
						<p className="runa-chat-header__subtitle">Cihaz bağlantısı bekleniyor</p>
					)}
				</div>
			</div>

			<div className="runa-chat-header__actions">
				<button
					type="button"
					className="runa-command-palette-trigger runa-chat-header__command"
					onClick={openCommandPalette ?? undefined}
					aria-label="Komut paletini ac"
					disabled={!openCommandPalette}
				>
					<Search aria-hidden="true" size={15} />
					<span>Komut ara</span>
					<kbd>{shortcutLabel}</kbd>
				</button>
				<button
					type="button"
					className="runa-chat-icon-button"
					aria-label="Bildirimler"
					onClick={() => navigate('/notifications')}
				>
					<Bell aria-hidden="true" size={18} />
				</button>
				<Link className="runa-chat-icon-button" aria-label="Hesap" to="/account">
					<Settings aria-hidden="true" size={19} />
				</Link>
				<button
					type="button"
					className="runa-chat-icon-button runa-chat-header__mobile-action runa-chat-header__menu"
					aria-controls="menu-sheet"
					aria-expanded={isMenuSheetOpen}
					aria-label="Menuyu ac"
					onClick={onOpenMenuSheet}
				>
					<MoreHorizontal aria-hidden="true" size={21} />
				</button>
			</div>
		</header>
	);
}
