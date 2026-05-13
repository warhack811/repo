import type { DesktopDevicePresenceSnapshot } from '@runa/types';
import { Menu, Settings } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import type { ConnectionStatus } from '../../ws-types.js';
import { HafizaMark } from '../ui/HafizaMark.js';

type ChatHeaderProps = Readonly<{
	activeConversationTitle?: string;
	connectionStatus: ConnectionStatus;
	desktopDevices: readonly DesktopDevicePresenceSnapshot[];
	onToggleSidebar: () => void;
	statusLabel: string;
}>;

function getPresenceLabel(input: {
	readonly desktopDevices: readonly DesktopDevicePresenceSnapshot[];
	readonly statusLabel: string;
}): string {
	const firstDevice = input.desktopDevices[0];

	if (firstDevice) {
		return firstDevice.machine_label?.trim() || 'Masaüstü bağlı';
	}

	return input.statusLabel;
}

export function ChatHeader({
	activeConversationTitle,
	connectionStatus,
	desktopDevices,
	onToggleSidebar,
	statusLabel,
}: ChatHeaderProps): ReactElement {
	const presenceLabel = getPresenceLabel({ desktopDevices, statusLabel });
	const conversationLabel = activeConversationTitle?.trim() ? 'Sohbet devam ediyor' : 'Yeni sohbet';

	return (
		<header className="runa-chat-header" aria-label="Sohbet başlığı">
			<div className="runa-chat-header__left">
				<button
					type="button"
					className="runa-chat-icon-button"
					aria-label="Sohbet geçmişini aç"
					onClick={onToggleSidebar}
				>
					<Menu aria-hidden="true" size={20} />
				</button>
				<div className="runa-chat-header__brand">
					<HafizaMark weight="regular" variant="brand" className="runa-chat-header__mark" />
					<strong>Runa</strong>
					<span>{conversationLabel}</span>
				</div>
			</div>

			<div className="runa-chat-header__right">
				<span
					className={`runa-chat-presence runa-chat-presence--${connectionStatus}`}
					aria-live="polite"
				>
					{presenceLabel}
				</span>
				<Link className="runa-chat-icon-button" aria-label="Hesap ve ayarlar" to="/account">
					<Settings aria-hidden="true" size={19} />
				</Link>
			</div>
		</header>
	);
}
