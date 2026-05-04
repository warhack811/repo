import type { DesktopDevicePresenceSnapshot } from '@runa/types';
import type { ReactElement } from 'react';

import styles from './DesktopTargetSelector.module.css';

type DesktopTargetSelectorProps = Readonly<{
	devices: readonly DesktopDevicePresenceSnapshot[];
	errorMessage?: string | null;
	isLoading?: boolean;
	onClear: () => void;
	onRetry?: () => void;
	onSelect: (connectionId: string) => void;
	selectedConnectionId?: string | null;
}>;

function formatConnectedAt(connectedAt: string): string {
	const date = new Date(connectedAt);

	if (Number.isNaN(date.getTime())) {
		return 'Çevrimiçi cihaz';
	}

	return `Bağlandı: ${date.toLocaleString()}`;
}

function getDeviceLabel(device: DesktopDevicePresenceSnapshot): string {
	const machineLabel = device.machine_label?.trim();

	if (machineLabel && machineLabel.length > 0) {
		return machineLabel;
	}

	return `Cihaz ${device.agent_id.slice(0, 8)}`;
}

export function DesktopTargetSelector({
	devices,
	errorMessage = null,
	isLoading = false,
	onClear,
	onRetry,
	onSelect,
	selectedConnectionId = null,
}: DesktopTargetSelectorProps): ReactElement | null {
	if (devices.length === 0 && selectedConnectionId === null) {
		return null;
	}

	return (
		<div className={styles['root']}>
			<div className={styles['header']}>
				<div className={styles['eyebrow']}>Masaüstü hedefi</div>
				<div className={styles['description']}>
					İstersen sonraki isteği açık bir bilgisayara yönlendirebilirsin.
				</div>
			</div>

			{devices.length > 0 ? (
				<div className={styles['buttons']}>
					<button
						type="button"
						onClick={onClear}
						className={styles['clearButton']}
					>
						<span className={styles['clearLabel']}>
							Masaüstü seçilmedi
						</span>
						<span className={styles['clearDescription']}>
							Sonraki istek normal sohbet akışında ilerlesin.
						</span>
					</button>
					{devices.map((device) => {
						return (
							<button
								key={device.connection_id}
								type="button"
								onClick={() => onSelect(device.connection_id)}
								className={styles['deviceButton']}
							>
								<span className={styles['deviceLabel']}>
									{getDeviceLabel(device)}
								</span>
								<span className={styles['deviceMeta']}>
									{formatConnectedAt(device.connected_at)}
								</span>
							</button>
						);
					})}
				</div>
			) : null}

			{isLoading ? (
				<div className={styles['loading']}>
					Açık bir masaüstü aranıyor...
				</div>
			) : null}

			{errorMessage ? (
				<div className={styles['errorRow']}>
					<div className={styles['errorText']}>
						Masaüstü listesi şimdilik yenilenemedi. Sohbet etkilenmeden devam eder.
					</div>
					{typeof onRetry === 'function' ? (
						<button
							type="button"
							onClick={onRetry}
							className={styles['retryButton']}
						>
							Tekrar dene
						</button>
					) : null}
				</div>
			) : null}
		</div>
	);
}
