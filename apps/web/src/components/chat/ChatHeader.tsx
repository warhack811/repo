import type { DesktopDevicePresenceSnapshot } from '@runa/types';
import { Menu, Settings } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import type { ConnectionStatus } from '../../ws-types.js';

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
		return firstDevice.machine_label?.trim() || 'Desktop connected';
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

	return (
		<header className="runa-chat-header" aria-label="Runa chat header">
			<div className="runa-chat-header__left">
				<button
					type="button"
					className="runa-chat-icon-button"
					aria-label="Sohbet gecmisini ac"
					onClick={onToggleSidebar}
				>
					<Menu aria-hidden="true" size={20} />
				</button>
				<div className="runa-chat-header__brand">
					<strong>Runa</strong>
					<span>{activeConversationTitle?.trim() || 'Yeni sohbet'}</span>
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
