import type { DesktopDevicePresenceSnapshot } from '@runa/types';
import type { ReactElement } from 'react';

import { RunaSkeleton } from '../ui/RunaSkeleton.js';

type DevicePresencePanelProps = Readonly<{
	devices: readonly DesktopDevicePresenceSnapshot[];
	error?: string | null;
	isLoading?: boolean;
	onRefresh?: () => void;
}>;

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
		<div className="runa-migrated-components-desktop-devicepresencepanel-1">
			<div className="runa-migrated-components-desktop-devicepresencepanel-2">
				<div className="runa-migrated-components-desktop-devicepresencepanel-3">
					Bagli bilgisayar
				</div>
				<h2
					id="online-devices-heading"
					className="runa-migrated-components-desktop-devicepresencepanel-4"
				>
					Cihaz durumu
				</h2>
				<p className="runa-migrated-components-desktop-devicepresencepanel-5">
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
				<output
					aria-busy="true"
					className="runa-migrated-components-desktop-devicepresencepanel-6 runa-device-skeleton"
				>
					<RunaSkeleton variant="text" />
					<RunaSkeleton variant="rect" />
				</output>
			) : null}

			{!isLoading && !error && devices.length === 0 ? (
				<div className="runa-migrated-components-desktop-devicepresencepanel-9">
					<div className="runa-migrated-components-desktop-devicepresencepanel-10">
						Bagli cihaz yok
					</div>
					<div className="runa-migrated-components-desktop-devicepresencepanel-11">
						Masaustu companion oturumu acildiginda burada durumu ve izinli yetenekleri gorunecek.
					</div>
				</div>
			) : null}

			{devices.map((device) => (
				<article
					key={device.connection_id}
					className="runa-migrated-components-desktop-devicepresencepanel-12"
				>
					<div className="runa-device-card__top">
						<div className="runa-migrated-components-desktop-devicepresencepanel-13">
							<div className="runa-migrated-components-desktop-devicepresencepanel-14">
								{getDeviceLabel(device)}
							</div>
							<div className="runa-migrated-components-desktop-devicepresencepanel-15">
								Son gorulme {formatConnectedAt(device.connected_at)}
							</div>
						</div>
						<span className="runa-migrated-components-desktop-devicepresencepanel-16">
							{device.status}
						</span>
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
						<div className="runa-migrated-components-desktop-devicepresencepanel-17">
							Bu cihaz icin acik yetenek bildirilmedi.
						</div>
					)}

					<details>
						<summary>Baglanti bilgisi</summary>
						<div className="runa-migrated-components-desktop-devicepresencepanel-18">
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
