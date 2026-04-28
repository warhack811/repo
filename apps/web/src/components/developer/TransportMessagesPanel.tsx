import type { CSSProperties, ReactElement } from 'react';

import {
	emptyStateCardStyle,
	eventCardStyle,
	eventListStyle,
	panelStyle,
	secondaryButtonStyle,
	secondaryLabelStyle,
	subcardStyle,
} from '../../lib/chat-styles.js';
import { uiCopy } from '../../localization/copy.js';
import type { WebSocketServerBridgeMessage } from '../../ws-types.js';

type TransportMessagesPanelProps = Readonly<{
	formatMessagePayload: (message: WebSocketServerBridgeMessage) => string;
	lastError: string | null;
	messages: readonly WebSocketServerBridgeMessage[];
	showTransportMessages: boolean;
	transportMessagesLabel: string;
	onToggleTransportMessages: () => void;
	summarizeServerMessage: (message: WebSocketServerBridgeMessage) => string;
}>;

const preStyle: CSSProperties = {
	margin: 0,
	background: 'linear-gradient(180deg, rgba(6, 11, 21, 0.9) 0%, rgba(2, 6, 23, 0.84) 100%)',
	padding: '12px',
	borderRadius: '14px',
	border: '1px solid rgba(148, 163, 184, 0.16)',
	overflowX: 'auto',
	fontSize: '12px',
	lineHeight: 1.55,
	color: '#cbd5e1',
	whiteSpace: 'pre-wrap',
	wordBreak: 'break-word',
};

export function TransportMessagesPanel({
	formatMessagePayload,
	lastError,
	messages,
	showTransportMessages,
	transportMessagesLabel,
	onToggleTransportMessages,
	summarizeServerMessage,
}: TransportMessagesPanelProps): ReactElement {
	return (
		<aside
			style={{
				...panelStyle,
				padding: 'clamp(18px, 3vw, 22px)',
				background:
					'radial-gradient(circle at top right, rgba(56, 189, 248, 0.08), transparent 32%), linear-gradient(180deg, rgba(8, 12, 24, 0.76) 0%, rgba(4, 9, 19, 0.72) 100%)',
			}}
			aria-labelledby="transport-messages-heading"
			className="runa-ambient-panel"
		>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					gap: '12px',
					flexWrap: 'wrap',
					marginBottom: '12px',
				}}
			>
				<div style={{ display: 'grid', gap: '4px' }}>
					<div style={secondaryLabelStyle}>{uiCopy.developer.heading}</div>
					<h2 id="transport-messages-heading" style={{ margin: 0, fontSize: '20px' }}>
						{uiCopy.developer.rawTransport}
					</h2>
				</div>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '12px',
						flexWrap: 'wrap',
					}}
				>
					<div style={{ color: '#94a3b8', fontSize: '13px' }}>{messages.length} ileti</div>
					<button
						type="button"
						onClick={onToggleTransportMessages}
						aria-expanded={showTransportMessages}
						aria-controls="transport-messages-content"
						style={secondaryButtonStyle}
					>
						{transportMessagesLabel}
					</button>
				</div>
			</div>

			{showTransportMessages ? (
				<div id="transport-messages-content" style={{ display: 'grid', gap: '12px' }}>
					{lastError ? (
						<div
							role="alert"
							style={{
								...subcardStyle,
								background: 'rgba(127, 29, 29, 0.35)',
								border: '1px solid rgba(248, 113, 113, 0.4)',
								color: '#fecaca',
							}}
						>
							{lastError}
						</div>
					) : null}

					<div style={eventListStyle}>
						{messages.length === 0 ? (
							<div style={emptyStateCardStyle}>{uiCopy.developer.noMessages}</div>
						) : (
							messages.map((message, index) => (
								<article
									key={`${message.type}_${index}`}
									style={{
										...eventCardStyle,
										borderColor: 'rgba(148, 163, 184, 0.14)',
									}}
								>
									<div
										style={{
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'center',
											gap: '12px',
											marginBottom: '8px',
											flexWrap: 'wrap',
										}}
									>
										<strong>{message.type}</strong>
										<span style={{ color: '#94a3b8', fontSize: '12px' }}>
											{summarizeServerMessage(message)}
										</span>
									</div>
									<pre style={preStyle}>{formatMessagePayload(message)}</pre>
								</article>
							))
						)}
					</div>
				</div>
			) : (
				<div id="transport-messages-content" style={{ color: '#94a3b8', lineHeight: 1.5 }}>
					Ham transport verisi varsayılan olarak gizli kalır. Teknik WebSocket ayrıntısı veya hata
					incelemesi gerektiğinde bu alanı aç.
				</div>
			)}
		</aside>
	);
}
