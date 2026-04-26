import type { DesktopDevicePresenceSnapshot } from '@runa/types';
import type { CSSProperties, ReactElement } from 'react';

import { appShellMutedTextStyle, appShellSecondaryLabelStyle } from '../app/AppShell.js';

type DevicePresencePanelProps = Readonly<{
	devices: readonly DesktopDevicePresenceSnapshot[];
	error?: string | null;
	isLoading?: boolean;
	onRefresh?: () => void;
}>;

const deviceCardStyle: CSSProperties = {
	display: 'grid',
	gap: '10px',
	padding: '14px 16px',
	borderRadius: '18px',
	border: '1px solid rgba(148, 163, 184, 0.16)',
	background: 'rgba(9, 14, 25, 0.68)',
	minWidth: 0,
};

const badgeStyle: CSSProperties = {
	borderRadius: '999px',
	border: '1px solid rgba(74, 222, 128, 0.24)',
	color: '#bbf7d0',
	background: 'rgba(20, 83, 45, 0.18)',
	fontSize: '12px',
	fontWeight: 700,
	padding: '6px 10px',
	textTransform: 'uppercase',
};

function formatConnectedAt(connectedAt: string): string {
	const parsed = new Date(connectedAt);

	if (Number.isNaN(parsed.getTime())) {
		return connectedAt;
	}

	return new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(parsed);
}

function getDeviceLabel(device: DesktopDevicePresenceSnapshot): string {
	const label = device.machine_label?.trim();

	if (label && label.length > 0) {
		return label;
	}

	return `Desktop ${device.agent_id.slice(0, 8)}`;
}

export function DevicePresencePanel({
	devices,
	error = null,
	isLoading = false,
	onRefresh,
}: DevicePresencePanelProps): ReactElement {
	return (
		<div style={{ display: 'grid', gap: '14px' }}>
			<div style={{ display: 'grid', gap: '10px' }}>
				<div style={appShellSecondaryLabelStyle}>Bagli bilgisayar</div>
				<h2 id="online-devices-heading" style={{ margin: 0, fontSize: '20px' }}>
					Cihaz durumu
				</h2>
				<p style={appShellMutedTextStyle}>
					Masaustu companion oturumu aciksa burada gorunur. Runa bagli olmayan bir cihazi hazir gibi
					gostermez.
				</p>
			</div>

			{error ? (
				<div role="alert" className="runa-alert runa-alert--warning">
					<strong>Cihaz durumu su anda alinamadi. </strong>
					{error}
				</div>
			) : null}

			{isLoading ? (
				<div style={deviceCardStyle} aria-live="polite">
					<div style={{ color: '#f8fafc', fontWeight: 700 }}>Cihazlar kontrol ediliyor</div>
					<div style={appShellMutedTextStyle}>
						Bu hesaba bagli aktif bir masaustu oturumu araniyor.
					</div>
				</div>
			) : null}

			{!isLoading && !error && devices.length === 0 ? (
				<div style={deviceCardStyle}>
					<div style={{ color: '#f8fafc', fontWeight: 700 }}>Bagli cihaz yok</div>
					<div style={appShellMutedTextStyle}>
						Masaustu companion oturumu acildiginda burada durumu ve izinli yetenekleri gorunecek.
					</div>
				</div>
			) : null}

			{devices.map((device) => (
				<article key={device.connection_id} style={deviceCardStyle}>
					<div className="runa-device-card__top">
						<div style={{ display: 'grid', gap: '6px', minWidth: 0 }}>
							<div style={{ color: '#f8fafc', fontWeight: 700, overflowWrap: 'anywhere' }}>
								{getDeviceLabel(device)}
							</div>
							<div style={appShellMutedTextStyle}>
								Son gorulme {formatConnectedAt(device.connected_at)}
							</div>
						</div>
						<span style={badgeStyle}>{device.status}</span>
					</div>

					{device.capabilities.length > 0 ? (
						<div className="runa-inline-cluster">
							{device.capabilities.map((capability) => (
								<span key={`${device.connection_id}-${capability.tool_name}`} className="runa-pill">
									{capability.tool_name}
								</span>
							))}
						</div>
					) : (
						<div style={appShellMutedTextStyle}>Bu cihaz icin acik yetenek bildirilmedi.</div>
					)}

					<details>
						<summary>Baglanti bilgisi</summary>
						<div style={{ ...appShellMutedTextStyle, marginTop: '8px', overflowWrap: 'anywhere' }}>
							Connection {device.connection_id}
						</div>
					</details>
				</article>
			))}

			{onRefresh ? (
				<button
					type="button"
					className="runa-button runa-button--secondary"
					onClick={onRefresh}
					disabled={isLoading}
				>
					Cihazlari yenile
				</button>
			) : null}
		</div>
	);
}
