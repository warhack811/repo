import type { DesktopDevicePresenceSnapshot } from '@runa/types';
import type { ReactElement } from 'react';

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
	if (devices.length === 0 && !isLoading && errorMessage === null) {
		return null;
	}

	return (
		<div className="runa-migrated-components-chat-desktoptargetselector-1">
			<div className="runa-migrated-components-chat-desktoptargetselector-2">
				<div className="runa-migrated-components-chat-desktoptargetselector-3">Masaüstü hedefi</div>
				<div className="runa-migrated-components-chat-desktoptargetselector-4">
					İstersen sonraki isteği açık bir bilgisayara yönlendirebilirsin.
				</div>
			</div>

			{devices.length > 0 ? (
				<div className="runa-migrated-components-chat-desktoptargetselector-5">
					<button
						type="button"
						onClick={onClear}
						className="runa-migrated-components-chat-desktoptargetselector-6"
					>
						<span className="runa-migrated-components-chat-desktoptargetselector-7">
							Masaustu secilmedi
						</span>
						<span className="runa-migrated-components-chat-desktoptargetselector-8">
							Sonraki istek normal sohbet akisinda kalsin.
						</span>
					</button>
					{devices.map((device) => {
						return (
							<button
								key={device.connection_id}
								type="button"
								onClick={() => onSelect(device.connection_id)}
								className="runa-migrated-components-chat-desktoptargetselector-9"
							>
								<span className="runa-migrated-components-chat-desktoptargetselector-10">
									{getDeviceLabel(device)}
								</span>
								<span className="runa-migrated-components-chat-desktoptargetselector-11">
									{formatConnectedAt(device.connected_at)}
								</span>
							</button>
						);
					})}
				</div>
			) : null}

			{isLoading ? (
				<div className="runa-migrated-components-chat-desktoptargetselector-12">
					Açık bir masaüstü aranıyor...
				</div>
			) : null}

			{errorMessage ? (
				<div className="runa-migrated-components-chat-desktoptargetselector-13">
					<div className="runa-migrated-components-chat-desktoptargetselector-14">
						Masaustu listesi simdilik yenilenemedi. Sohbet burada calismaya devam ediyor.
					</div>
					{typeof onRetry === 'function' ? (
						<button
							type="button"
							onClick={onRetry}
							className="runa-migrated-components-chat-desktoptargetselector-15"
						>
							Tekrar dene
						</button>
					) : null}
				</div>
			) : null}
		</div>
	);
}
