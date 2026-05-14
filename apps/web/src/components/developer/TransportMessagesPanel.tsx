import type { ReactElement } from 'react';
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
			aria-labelledby="transport-messages-heading"
			className="runa-ambient-panel runa-developer-transportmessagespanel-1"
		>
			<div className="runa-developer-transportmessagespanel-2">
				<div className="runa-developer-transportmessagespanel-3">
					<div className="runa-developer-transportmessagespanel-4">{uiCopy.developer.heading}</div>
					<h2 id="transport-messages-heading" className="runa-developer-transportmessagespanel-5">
						{uiCopy.developer.rawTransport}
					</h2>
				</div>
				<div className="runa-developer-transportmessagespanel-6">
					<div className="runa-developer-transportmessagespanel-7">{messages.length} ileti</div>
					<button
						type="button"
						onClick={onToggleTransportMessages}
						aria-expanded={showTransportMessages}
						aria-controls="transport-messages-content"
						className="runa-developer-transportmessagespanel-8"
					>
						{transportMessagesLabel}
					</button>
				</div>
			</div>

			{showTransportMessages ? (
				<div id="transport-messages-content" className="runa-developer-transportmessagespanel-9">
					{lastError ? (
						<div role="alert" className="runa-developer-transportmessagespanel-10">
							{lastError}
						</div>
					) : null}

					<div className="runa-developer-transportmessagespanel-11">
						{messages.length === 0 ? (
							<div className="runa-developer-transportmessagespanel-12">
								{uiCopy.developer.noMessages}
							</div>
						) : (
							messages.map((message, index) => (
								<article
									key={`${message.type}_${index}`}
									className="runa-developer-transportmessagespanel-13"
								>
									<div className="runa-developer-transportmessagespanel-14">
										<strong>{message.type}</strong>
										<span className="runa-developer-transportmessagespanel-15">
											{summarizeServerMessage(message)}
										</span>
									</div>
									<pre className="runa-developer-transportmessagespanel-16">
										{formatMessagePayload(message)}
									</pre>
								</article>
							))
						)}
					</div>
				</div>
			) : (
				<div id="transport-messages-content" className="runa-developer-transportmessagespanel-17">
					Ham transport verisi varsayılan olarak gizli kalır. Teknik WebSocket ayrıntısı veya
					hata incelemesi gerektiğinde bu alanı aç.
				</div>
			)}
		</aside>
	);
}
