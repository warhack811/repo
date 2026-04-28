import { defaultGatewayModels, gatewayProviders } from '@runa/types';
import type { CSSProperties, ReactElement } from 'react';

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

const panelStyle: CSSProperties = {
	background: 'rgba(10, 15, 28, 0.72)',
	border: '1px solid rgba(148, 163, 184, 0.16)',
	borderRadius: '18px',
	boxShadow: '0 14px 30px rgba(15, 23, 42, 0.22)',
	padding: 'clamp(16px, 3vw, 20px)',
	backdropFilter: 'blur(12px)',
	display: 'grid',
	gap: '14px',
};

const secondaryLabelStyle: CSSProperties = {
	fontSize: '11px',
	letterSpacing: '0.08em',
	textTransform: 'uppercase',
	color: '#94a3b8',
};

const inputStyle: CSSProperties = {
	width: '100%',
	padding: '10px 12px',
	borderRadius: '10px',
	border: '1px solid rgba(148, 163, 184, 0.3)',
	background: 'rgba(15, 23, 42, 0.8)',
	color: '#f8fafc',
	fontSize: '14px',
	boxSizing: 'border-box',
	minWidth: 0,
};

const formGridStyle: CSSProperties = {
	display: 'grid',
	gap: '12px',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
};

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
		<section style={panelStyle} aria-labelledby="developer-runtime-config-heading">
			<div style={{ display: 'grid', gap: '8px' }}>
				<div style={secondaryLabelStyle}>{uiCopy.developer.heading}</div>
				<h2 id="developer-runtime-config-heading" style={{ margin: 0, fontSize: '20px' }}>
					{uiCopy.developer.configHeading}
				</h2>
				<div style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
					{uiCopy.developer.configDescription}
				</div>
			</div>

			{connectionNotice ? (
				<div
					role={connectionNotice.tone === 'error' ? 'alert' : 'status'}
					style={{
						padding: '14px 16px',
						borderRadius: '14px',
						border:
							connectionNotice.tone === 'error'
								? '1px solid rgba(248, 113, 113, 0.4)'
								: '1px solid rgba(250, 204, 21, 0.32)',
						background:
							connectionNotice.tone === 'error'
								? 'rgba(127, 29, 29, 0.28)'
								: 'rgba(120, 53, 15, 0.18)',
						display: 'grid',
						gap: '6px',
					}}
				>
					<strong
						style={{
							fontSize: '15px',
							color: connectionNotice.tone === 'error' ? '#fecaca' : '#fde68a',
						}}
					>
						{connectionNotice.title}
					</strong>
					<div
						style={{
							color: connectionNotice.tone === 'error' ? '#fecaca' : '#fef3c7',
							lineHeight: 1.5,
						}}
					>
						{connectionNotice.detail}
					</div>
				</div>
			) : null}

			<div style={formGridStyle}>
				<label style={{ display: 'grid', gap: '6px' }}>
					<span>{uiCopy.developer.apiKey}</span>
					<input
						value={apiKey}
						onChange={(event) => onApiKeyChange(event.target.value)}
						placeholder={uiCopy.developer.apiKey}
						type="password"
						style={inputStyle}
					/>
				</label>

				<label style={{ display: 'grid', gap: '6px' }}>
					<span>{uiCopy.developer.provider}</span>
					<select
						value={provider}
						onChange={(event) => onProviderChange(event.target.value as GatewayProvider)}
						style={inputStyle}
					>
						{gatewayProviders.map((providerOption) => (
							<option key={providerOption} value={providerOption}>
								{providerOption}
							</option>
						))}
					</select>
				</label>

				<label style={{ display: 'grid', gap: '6px' }}>
					<span>{uiCopy.developer.model}</span>
					<input
						value={model}
						onChange={(event) => onModelChange(event.target.value)}
						placeholder={defaultGatewayModels[provider]}
						style={inputStyle}
					/>
				</label>
			</div>

			<label
				style={{
					display: 'flex',
					alignItems: 'flex-start',
					gap: '10px',
					color: '#cbd5e1',
					fontSize: '14px',
					flexWrap: 'wrap',
				}}
			>
				<input
					checked={includePresentationBlocks}
					onChange={(event) => onIncludePresentationBlocksChange(event.target.checked)}
					type="checkbox"
				/>
				<span>{uiCopy.developer.includePresentationBlocks}</span>
			</label>

			<div style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.6 }}>
				{uiCopy.developer.localOnlyNote}
			</div>
		</section>
	);
}
