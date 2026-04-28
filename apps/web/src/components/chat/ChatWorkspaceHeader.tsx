import type { ReactElement } from 'react';
import { uiCopy } from '../../localization/copy.js';
import type { ConnectionStatus } from '../../ws-types.js';

type ChatWorkspaceHeaderProps = Readonly<{
	connectionStatus: ConnectionStatus;
	statusLabel: string;
}>;

export function ChatWorkspaceHeader({ statusLabel }: ChatWorkspaceHeaderProps): ReactElement {
	return (
		<header
			className="runa-card runa-card--hero runa-ambient-panel runa-migrated-components-chat-chatworkspaceheader-1"
			aria-labelledby="chat-workspace-heading"
			aria-describedby="chat-workspace-description"
		>
			<div className="runa-migrated-components-chat-chatworkspaceheader-2">
				<div className="runa-migrated-components-chat-chatworkspaceheader-3">
					<div className="runa-eyebrow">{uiCopy.appShell.chatEyebrow.toUpperCase()}</div>
					<h1
						id="chat-workspace-heading"
						className="runa-migrated-components-chat-chatworkspaceheader-4"
					>
						{uiCopy.chat.heroTitle}
					</h1>
					<p
						id="chat-workspace-description"
						className="runa-subtle-copy runa-migrated-components-chat-chatworkspaceheader-5"
					>
						{uiCopy.chat.heroSubtitle}
					</p>
				</div>
				<div className="runa-migrated-components-chat-chatworkspaceheader-6">{statusLabel}</div>
			</div>
		</header>
	);
}
