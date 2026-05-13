import { Bell, ChevronLeft, MoreHorizontal, Search, Settings } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { useCommandPaletteTrigger } from '../command/CommandPaletteContext.js';

type ChatHeaderProps = Readonly<{
	activeConversationTitle?: string;
	onToggleSidebar: () => void;
}>;

function getCommandShortcutLabel(): string {
	if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/u.test(navigator.platform)) {
		return '⌘K';
	}

	return 'Ctrl K';
}

export function ChatHeader({
	activeConversationTitle,
	onToggleSidebar,
}: ChatHeaderProps): ReactElement {
	const openCommandPalette = useCommandPaletteTrigger();
	const title = activeConversationTitle?.trim() || 'Yeni sohbet';
	const shortcutLabel = getCommandShortcutLabel();

	return (
		<header className="runa-chat-header" aria-label="Sohbet basligi">
			<div className="runa-chat-header__left">
				<button
					type="button"
					className="runa-chat-icon-button runa-chat-header__mobile-action"
					aria-label="Sohbet gecmisini ac"
					onClick={onToggleSidebar}
				>
					<ChevronLeft aria-hidden="true" size={21} />
				</button>
				<h1 className="runa-chat-header__title">{title}</h1>
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
				<button type="button" className="runa-chat-icon-button" aria-label="Bildirimler">
					<Bell aria-hidden="true" size={18} />
				</button>
				<Link className="runa-chat-icon-button" aria-label="Hesap" to="/account">
					<Settings aria-hidden="true" size={19} />
				</Link>
				<button
					type="button"
					className="runa-chat-icon-button runa-chat-header__mobile-action"
					aria-label="Menuyu ac"
					onClick={() => console.warn('Menu sheet PR-6 kapsaminda acilacak.')}
				>
					<MoreHorizontal aria-hidden="true" size={21} />
				</button>
			</div>
		</header>
	);
}
