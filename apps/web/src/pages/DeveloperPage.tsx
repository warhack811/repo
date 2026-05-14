import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import type { AuthContext } from '@runa/types';
import { OperatorControlsPanel } from '../components/developer/OperatorControlsPanel.js';
import { TransportMessagesPanel } from '../components/developer/TransportMessagesPanel.js';
import type { UseChatRuntimeResult } from '../hooks/useChatRuntime.js';
import { useDeveloperMode } from '../hooks/useDeveloperMode.js';
import { uiCopy } from '../localization/copy.js';
import {
	selectConnectionState,
	selectRuntimeConfigState,
	selectTransportState,
	useChatStoreSelector,
} from '../stores/chat-store.js';

type DeveloperPageProps = Readonly<{
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

export function DeveloperPage({
	authContext,
	authError,
	hasStoredBearerToken,
	isAuthPending,
	onClearAuthToken,
	onRefreshAuthContext,
	runtime,
}: DeveloperPageProps): ReactElement {
	const { isDeveloperMode } = useDeveloperMode();
	const [showTransportMessages, setShowTransportMessages] = useState(false);
	const runtimeConfig = useChatStoreSelector(runtime.store, selectRuntimeConfigState);
	const connectionState = useChatStoreSelector(runtime.store, selectConnectionState);
	const transportState = useChatStoreSelector(runtime.store, selectTransportState);

	useEffect(() => {
		if (connectionState.lastError !== null) {
			setShowTransportMessages(true);
		}
	}, [connectionState.lastError]);

	return (
		<>
			<section className="runa-page-developerpage-1" aria-labelledby="developer-mode-heading">
				<div className="runa-page-developerpage-2">
					<div className="runa-page-developerpage-3">{uiCopy.developer.heading}</div>
					<h2 id="developer-mode-heading" className="runa-page-developerpage-4">
						{uiCopy.developer.heading}
					</h2>
					<p className="runa-page-developerpage-5">{uiCopy.developer.description}</p>
				</div>

				<div className="runa-page-developerpage-6">
					<div className="runa-page-developerpage-7">
						<div className="runa-page-developerpage-8">{uiCopy.developer.provider}</div>
						<div className="runa-page-developerpage-9">{runtimeConfig.provider}</div>
					</div>
					<div className="runa-page-developerpage-10">
						<div className="runa-page-developerpage-11">{uiCopy.developer.model}</div>
						<div className="runa-page-developerpage-12">{runtimeConfig.model}</div>
					</div>
					<div className="runa-page-developerpage-13">
						<div className="runa-page-developerpage-14">Token</div>
						<div className="runa-page-developerpage-15">
							{hasStoredBearerToken ? uiCopy.auth.storedToken : uiCopy.auth.noStoredToken}
						</div>
					</div>
				</div>
			</section>

			{!isDeveloperMode ? (
				<section className="runa-page-developerpage-16" aria-label="Developer Mode disabled">
					<div className="runa-page-developerpage-17">
						<div className="runa-page-developerpage-18">{uiCopy.developer.heading}</div>
						<h2 className="runa-page-developerpage-19">Developer Mode kapalı</h2>
						<p className="runa-page-developerpage-20">
							Runtime konfigürasyonu, ham transport ve troubleshooting panelleri bu tarayıcıda
							sadece Developer Mode açıkken görünür.
						</p>
					</div>
				</section>
			) : (
				<>
					<OperatorControlsPanel
						apiKey={runtimeConfig.apiKey}
						connectionStatus={connectionState.connectionStatus}
						includePresentationBlocks={runtimeConfig.includePresentationBlocks}
						lastError={connectionState.lastError}
						model={runtimeConfig.model}
						provider={runtimeConfig.provider}
						onApiKeyChange={runtime.setApiKey}
						onIncludePresentationBlocksChange={runtime.setIncludePresentationBlocks}
						onModelChange={runtime.setModel}
						onProviderChange={runtime.setProvider}
					/>

					<section
						className="runa-page-developerpage-21"
						aria-labelledby="developer-troubleshooting-heading"
					>
						<div className="runa-page-developerpage-22">
							<div className="runa-page-developerpage-23">{uiCopy.developer.troubleshooting}</div>
							<h2 id="developer-troubleshooting-heading" className="runa-page-developerpage-24">
								{uiCopy.developer.troubleshooting}
							</h2>
						</div>

						<div className="runa-page-developerpage-25">
							<button
								type="button"
								onClick={() => void onRefreshAuthContext()}
								disabled={isAuthPending}
								className="runa-page-developerpage-26"
							>
								{uiCopy.developer.refreshAuthContext}
							</button>
							<button
								type="button"
								onClick={() => void onClearAuthToken()}
								disabled={isAuthPending}
								className="runa-page-developerpage-27"
							>
								{uiCopy.developer.clearLocalToken}
							</button>
						</div>

						{authError ? (
							<div role="alert" className="runa-page-developerpage-28">
								{authError}
							</div>
						) : null}
					</section>

					<section className="runa-page-developerpage-29">
						<article className="runa-page-developerpage-30">
							<div className="runa-page-developerpage-31">
								<div className="runa-page-developerpage-32">{uiCopy.developer.scope}</div>
								<code className="runa-page-developerpage-33">{stringifyScope(authContext)}</code>
							</div>
						</article>

						<article className="runa-page-developerpage-34">
							<div className="runa-page-developerpage-35">
								<div className="runa-page-developerpage-36">{uiCopy.developer.claims}</div>
								<code className="runa-page-developerpage-37">{stringifyClaims(authContext)}</code>
							</div>
						</article>

						<article className="runa-page-developerpage-38">
							<div className="runa-page-developerpage-39">
								<div className="runa-page-developerpage-40">{uiCopy.developer.userMetadata}</div>
								<code className="runa-page-developerpage-41">
									{stringifyUserMetadata(authContext)}
								</code>
							</div>
						</article>
					</section>

					<TransportMessagesPanel
						formatMessagePayload={(message) => JSON.stringify(message, null, 2)}
						lastError={connectionState.lastError}
						messages={transportState.messages}
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
