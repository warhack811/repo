import { defaultGatewayModels, gatewayProviders } from '@runa/types';
import type { ReactElement } from 'react';

import { uiCopy } from '../../localization/copy.js';
import type { ConnectionStatus, GatewayProvider } from '../../ws-types.js';

type OperatorControlsPanelProps = Readonly<{
	apiKey: string;
	connectionStatus: ConnectionStatus;
	includePresentationBlocks: boolean;
	lastError: string | null;
	model: string;
	provider: GatewayProvider;
	onApiKeyChange: (value: string) => void;
	onIncludePresentationBlocksChange: (value: boolean) => void;
	onModelChange: (value: string) => void;
	onProviderChange: (value: GatewayProvider) => void;
}>;

function getConnectionNotice(
	input: Readonly<{
		connectionStatus: ConnectionStatus;
		lastError: string | null;
	}>,
): Readonly<{
	detail: string;
	tone: 'error' | 'warning';
	title: string;
} | null> {
	if (input.connectionStatus === 'open') {
		return null;
	}

	if (input.connectionStatus === 'connecting') {
		return {
			detail: uiCopy.chat.submitConnectionConnecting,
			title: uiCopy.chat.runConnectionConnecting,
			tone: 'warning',
		};
	}

	return {
		detail: input.lastError ?? uiCopy.runtime.connectionUnavailable,
		title: uiCopy.chat.runConnectionClosed,
		tone: 'error',
	};
}

export function OperatorControlsPanel({
	apiKey,
	connectionStatus,
	includePresentationBlocks,
	lastError,
	model,
	provider,
	onApiKeyChange,
	onIncludePresentationBlocksChange,
	onModelChange,
	onProviderChange,
}: OperatorControlsPanelProps): ReactElement {
	const connectionNotice = getConnectionNotice({
		connectionStatus,
		lastError,
	});

	return (
		<section
			className="runa-developer-operatorcontrolspanel-1"
			aria-labelledby="developer-runtime-config-heading"
		>
			<div className="runa-developer-operatorcontrolspanel-2">
				<div className="runa-developer-operatorcontrolspanel-3">{uiCopy.developer.heading}</div>
				<h2
					id="developer-runtime-config-heading"
					className="runa-developer-operatorcontrolspanel-4"
				>
					{uiCopy.developer.configHeading}
				</h2>
				<div className="runa-developer-operatorcontrolspanel-5">
					{uiCopy.developer.configDescription}
				</div>
			</div>

			{connectionNotice ? (
				<div
					role={connectionNotice.tone === 'error' ? 'alert' : 'status'}
					className="runa-developer-operatorcontrolspanel-6"
				>
					<strong className="runa-developer-operatorcontrolspanel-7">
						{connectionNotice.title}
					</strong>
					<div className="runa-developer-operatorcontrolspanel-8">{connectionNotice.detail}</div>
				</div>
			) : null}

			<div className="runa-developer-operatorcontrolspanel-9">
				<label className="runa-developer-operatorcontrolspanel-10">
					<span>{uiCopy.developer.apiKey}</span>
					<input
						value={apiKey}
						onChange={(event) => onApiKeyChange(event.target.value)}
						placeholder={uiCopy.developer.apiKey}
						type="password"
						className="runa-developer-operatorcontrolspanel-11"
					/>
				</label>

				<label className="runa-developer-operatorcontrolspanel-12">
					<span>{uiCopy.developer.provider}</span>
					<select
						value={provider}
						onChange={(event) => onProviderChange(event.target.value as GatewayProvider)}
						className="runa-developer-operatorcontrolspanel-13"
					>
						{gatewayProviders.map((providerOption) => (
							<option key={providerOption} value={providerOption}>
								{providerOption}
							</option>
						))}
					</select>
				</label>

				<label className="runa-developer-operatorcontrolspanel-14">
					<span>{uiCopy.developer.model}</span>
					<input
						value={model}
						onChange={(event) => onModelChange(event.target.value)}
						placeholder={defaultGatewayModels[provider]}
						className="runa-developer-operatorcontrolspanel-15"
					/>
				</label>
			</div>

			<label className="runa-developer-operatorcontrolspanel-16">
				<input
					checked={includePresentationBlocks}
					onChange={(event) => onIncludePresentationBlocksChange(event.target.checked)}
					type="checkbox"
				/>
				<span>{uiCopy.developer.includePresentationBlocks}</span>
			</label>

			<div className="runa-developer-operatorcontrolspanel-17">
				{uiCopy.developer.localOnlyNote}
			</div>
		</section>
	);
}
