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

function getDeviceStatusLabel(device: DesktopDevicePresenceSnapshot): string {
	if (device.status === 'online') {
		return 'Bağlı';
	}

	return 'Kontrol ediliyor';
}

function getCapabilityLabel(toolName: string): string {
	switch (toolName) {
		case 'desktop.click':
			return 'Tıklama';
		case 'desktop.clipboard.read':
			return 'Panoyu okuma';
		case 'desktop.clipboard.write':
			return 'Panoya yazma';
		case 'desktop.keypress':
			return 'Klavye kısayolu';
		case 'desktop.launch':
			return 'Uygulama açma';
		case 'desktop.scroll':
			return 'Kaydırma';
		case 'desktop.screenshot':
			return 'Ekranı görme';
		case 'desktop.type':
			return 'Yazı yazma';
		case 'desktop.verify_state':
			return 'Ekran doğrulama';
		case 'desktop.vision_analyze':
			return 'Görüntü analizi';
		default:
			return 'Masaüstü izni';
	}
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
					Bağlı bilgisayar
				</div>
				<h2
					id="online-devices-heading"
					className="runa-migrated-components-desktop-devicepresencepanel-4"
				>
					Bilgisayar bağlantısı
				</h2>
				<p className="runa-migrated-components-desktop-devicepresencepanel-5">
					Bağlı bilgisayar, masaüstü adımlarını güvenli şekilde ilerletmeni sağlar.
				</p>
			</div>

			{error ? (
				<div role="alert" className="runa-alert runa-alert--warning">
					<strong>Cihaz durumu şu anda alınamadı.</strong>
					<div>{error}</div>
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
						Bağlı cihaz yok
					</div>
					<div className="runa-migrated-components-desktop-devicepresencepanel-11">
						Bilgisayar uygulamasını açınca bağlantı durumu güncellenir.
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
								Son görülme {formatConnectedAt(device.connected_at)}
							</div>
						</div>
						<span className="runa-migrated-components-desktop-devicepresencepanel-16">
							{getDeviceStatusLabel(device)}
						</span>
					</div>

					{device.capabilities.length > 0 ? (
						<div className="runa-inline-cluster">
							{device.capabilities.map((capability) => (
								<span key={`${device.connection_id}-${capability.tool_name}`} className="runa-pill">
									{getCapabilityLabel(capability.tool_name)}
								</span>
							))}
						</div>
					) : (
						<div className="runa-migrated-components-desktop-devicepresencepanel-17">
							Bu bilgisayar şu anda yalnız bağlantı durumunu paylaşıyor.
						</div>
					)}
				</article>
			))}

			{onRefresh ? (
				<button
					type="button"
					className="runa-button runa-button--secondary"
					onClick={onRefresh}
					disabled={isLoading}
				>
					Cihazları yenile
				</button>
			) : null}
		</div>
	);
}
