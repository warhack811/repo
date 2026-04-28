import type { CSSProperties, ReactElement } from 'react';

import { heroPanelStyle } from '../../lib/chat-styles.js';
import { uiCopy } from '../../localization/copy.js';
import type { ConnectionStatus } from '../../ws-types.js';
import { getStatusAccent } from './chat-presentation.js';

type ChatWorkspaceHeaderProps = Readonly<{
	connectionStatus: ConnectionStatus;
	statusLabel: string;
}>;

const headerRowStyle: CSSProperties = {
	display: 'flex',
	justifyContent: 'space-between',
	alignItems: 'center',
	gap: '12px',
	flexWrap: 'wrap',
};

const headerCopyStyle: CSSProperties = {
	maxWidth: 'min(720px, 100%)',
};

const subtitleStyle: CSSProperties = {
	maxWidth: 'min(620px, 100%)',
};

function createStatusPillStyle(connectionStatus: ConnectionStatus): CSSProperties {
	const statusAccent = getStatusAccent(connectionStatus);

	return {
		padding: '8px 12px',
		borderRadius: '999px',
		border: `1px solid ${statusAccent}`,
		color: statusAccent,
		fontWeight: 700,
		fontSize: '12px',
		letterSpacing: '0.08em',
	};
}

export function ChatWorkspaceHeader({
	connectionStatus,
	statusLabel,
}: ChatWorkspaceHeaderProps): ReactElement {
	return (
		<header
			className="runa-card runa-card--hero runa-ambient-panel"
			style={heroPanelStyle}
			aria-labelledby="chat-workspace-heading"
			aria-describedby="chat-workspace-description"
		>
			<div style={headerRowStyle}>
				<div style={headerCopyStyle}>
					<div className="runa-eyebrow">{uiCopy.appShell.chatEyebrow.toUpperCase()}</div>
					<h1
						id="chat-workspace-heading"
						style={{ margin: '10px 0 6px', fontSize: 'clamp(28px, 5vw, 40px)' }}
					>
						{uiCopy.chat.heroTitle}
					</h1>
					<p id="chat-workspace-description" className="runa-subtle-copy" style={subtitleStyle}>
						{uiCopy.chat.heroSubtitle}
					</p>
				</div>
				<div style={createStatusPillStyle(connectionStatus)}>{statusLabel}</div>
			</div>
		</header>
	);
}
