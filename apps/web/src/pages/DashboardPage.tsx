import type { CSSProperties, ReactElement } from 'react';
import { useEffect, useState } from 'react';

import type { AuthContext } from '@runa/types';

import {
	appShellButtonRowStyle,
	appShellMetricCardStyle,
	appShellMutedTextStyle,
	appShellPanelStyle,
	appShellSecondaryButtonStyle,
	appShellSecondaryLabelStyle,
} from '../components/app/AppShell.js';
import { OperatorControlsPanel } from '../components/chat/OperatorControlsPanel.js';
import { TransportMessagesPanel } from '../components/chat/TransportMessagesPanel.js';
import type { UseChatRuntimeResult } from '../hooks/useChatRuntime.js';
import { useDeveloperMode } from '../hooks/useDeveloperMode.js';
import { uiCopy } from '../localization/copy.js';

const sectionGridStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
	gap: '20px',
};

const codeStyle: CSSProperties = {
	display: 'block',
	padding: '10px 12px',
	borderRadius: '12px',
	background: 'rgba(2, 6, 23, 0.68)',
	border: '1px solid rgba(148, 163, 184, 0.16)',
	color: '#bfdbfe',
	fontSize: '13px',
	overflowX: 'auto',
	maxHeight: '240px',
};

type DashboardPageProps = Readonly<{
	authContext: AuthContext;
	authError: string | null;
	hasStoredBearerToken: boolean;
	isAuthPending: boolean;
	onClearAuthToken: () => Promise<void>;
	onRefreshAuthContext: () => Promise<void>;
	runtime: UseChatRuntimeResult;
}>;

function stringifyScope(authContext: AuthContext): string {
	return JSON.stringify(authContext.principal.scope, null, 2);
}

function stringifyClaims(authContext: AuthContext): string {
	return JSON.stringify(authContext.claims ?? {}, null, 2);
}

function stringifyUserMetadata(authContext: AuthContext): string {
	return JSON.stringify(authContext.user?.metadata ?? {}, null, 2);
}

export function DashboardPage({
	authContext,
	authError,
	hasStoredBearerToken,
	isAuthPending,
	onClearAuthToken,
	onRefreshAuthContext,
	runtime,
}: DashboardPageProps): ReactElement {
	const { isDeveloperMode } = useDeveloperMode();
	const [showTransportMessages, setShowTransportMessages] = useState(false);

	useEffect(() => {
		if (runtime.lastError !== null) {
			setShowTransportMessages(true);
		}
	}, [runtime.lastError]);

	return (
		<>
			<section style={appShellPanelStyle} aria-labelledby="developer-mode-heading">
				<div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
					<div style={appShellSecondaryLabelStyle}>{uiCopy.developer.heading}</div>
					<h2 id="developer-mode-heading" style={{ margin: 0, fontSize: '24px' }}>
						{uiCopy.developer.heading}
					</h2>
					<p style={appShellMutedTextStyle}>{uiCopy.developer.description}</p>
				</div>

				<div style={sectionGridStyle}>
					<div style={appShellMetricCardStyle}>
						<div style={appShellSecondaryLabelStyle}>{uiCopy.developer.provider}</div>
						<div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
							{runtime.provider}
						</div>
					</div>
					<div style={appShellMetricCardStyle}>
						<div style={appShellSecondaryLabelStyle}>{uiCopy.developer.model}</div>
						<div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
							{runtime.model}
						</div>
					</div>
					<div style={appShellMetricCardStyle}>
						<div style={appShellSecondaryLabelStyle}>Token</div>
						<div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
							{hasStoredBearerToken ? uiCopy.auth.storedToken : uiCopy.auth.noStoredToken}
						</div>
					</div>
				</div>
			</section>

			{!isDeveloperMode ? (
				<section style={appShellPanelStyle} aria-label="Developer Mode disabled">
					<div style={{ display: 'grid', gap: '10px' }}>
						<div style={appShellSecondaryLabelStyle}>{uiCopy.developer.heading}</div>
						<h2 style={{ margin: 0, fontSize: '20px' }}>Developer Mode kapali</h2>
						<p style={appShellMutedTextStyle}>
							Runtime konfigurasyonu, ham transport ve troubleshooting panelleri bu tarayicida
							sadece Developer Mode acikken gorunur.
						</p>
					</div>
				</section>
			) : (
				<>
					<OperatorControlsPanel
						apiKey={runtime.apiKey}
						connectionStatus={runtime.connectionStatus}
						includePresentationBlocks={runtime.includePresentationBlocks}
						lastError={runtime.lastError}
						model={runtime.model}
						provider={runtime.provider}
						onApiKeyChange={runtime.setApiKey}
						onIncludePresentationBlocksChange={runtime.setIncludePresentationBlocks}
						onModelChange={runtime.setModel}
						onProviderChange={runtime.setProvider}
					/>

					<section style={appShellPanelStyle} aria-labelledby="developer-troubleshooting-heading">
						<div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
							<div style={appShellSecondaryLabelStyle}>{uiCopy.developer.troubleshooting}</div>
							<h2 id="developer-troubleshooting-heading" style={{ margin: 0, fontSize: '20px' }}>
								{uiCopy.developer.troubleshooting}
							</h2>
						</div>

						<div style={appShellButtonRowStyle}>
							<button
								type="button"
								onClick={() => void onRefreshAuthContext()}
								disabled={isAuthPending}
								style={{
									...appShellSecondaryButtonStyle,
									opacity: isAuthPending ? 0.6 : 1,
									width: '100%',
								}}
							>
								{uiCopy.developer.refreshAuthContext}
							</button>
							<button
								type="button"
								onClick={() => void onClearAuthToken()}
								disabled={isAuthPending}
								style={{
									...appShellSecondaryButtonStyle,
									opacity: isAuthPending ? 0.6 : 1,
									width: '100%',
								}}
							>
								{uiCopy.developer.clearLocalToken}
							</button>
						</div>

						{authError ? (
							<div
								role="alert"
								style={{
									marginTop: '16px',
									padding: '12px 14px',
									borderRadius: '14px',
									background: 'rgba(127, 29, 29, 0.28)',
									border: '1px solid rgba(248, 113, 113, 0.36)',
									color: '#fecaca',
									lineHeight: 1.5,
								}}
							>
								{authError}
							</div>
						) : null}
					</section>

					<section style={sectionGridStyle}>
						<article style={appShellPanelStyle}>
							<div style={{ display: 'grid', gap: '10px' }}>
								<div style={appShellSecondaryLabelStyle}>{uiCopy.developer.scope}</div>
								<code style={codeStyle}>{stringifyScope(authContext)}</code>
							</div>
						</article>

						<article style={appShellPanelStyle}>
							<div style={{ display: 'grid', gap: '10px' }}>
								<div style={appShellSecondaryLabelStyle}>{uiCopy.developer.claims}</div>
								<code style={codeStyle}>{stringifyClaims(authContext)}</code>
							</div>
						</article>

						<article style={appShellPanelStyle}>
							<div style={{ display: 'grid', gap: '10px' }}>
								<div style={appShellSecondaryLabelStyle}>{uiCopy.developer.userMetadata}</div>
								<code style={codeStyle}>{stringifyUserMetadata(authContext)}</code>
							</div>
						</article>
					</section>

					<TransportMessagesPanel
						formatMessagePayload={(message) => JSON.stringify(message, null, 2)}
						lastError={runtime.lastError}
						messages={runtime.messages}
						showTransportMessages={showTransportMessages}
						transportMessagesLabel={
							showTransportMessages
								? uiCopy.developer.hideTransport
								: uiCopy.developer.showTransport
						}
						onToggleTransportMessages={() => setShowTransportMessages((current) => !current)}
						summarizeServerMessage={(message) => message.type}
					/>
				</>
			)}
		</>
	);
}
