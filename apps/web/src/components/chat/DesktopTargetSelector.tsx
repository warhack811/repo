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

const selectorShellStyle = {
	display: 'grid',
	gap: '10px',
	padding: '12px 14px',
	borderRadius: '18px',
	border: '1px solid rgba(148, 163, 184, 0.14)',
	background: 'rgba(7, 11, 20, 0.46)',
} as const;

const selectorLabelRowStyle = {
	display: 'grid',
	gap: '4px',
} as const;

const selectorEyebrowStyle = {
	color: '#f8fafc',
	fontSize: '13px',
	fontWeight: 700,
} as const;

const selectorHintStyle = {
	color: '#94a3b8',
	fontSize: '13px',
	lineHeight: 1.5,
} as const;

const selectorOptionsStyle = {
	display: 'flex',
	flexWrap: 'wrap',
	gap: '10px',
} as const;

function createOptionStyle(isSelected: boolean) {
	return {
		display: 'grid',
		gap: '4px',
		padding: '10px 12px',
		minWidth: '150px',
		borderRadius: '16px',
		border: isSelected
			? '1px solid rgba(245, 158, 11, 0.58)'
			: '1px solid rgba(148, 163, 184, 0.18)',
		background: isSelected ? 'rgba(245, 158, 11, 0.14)' : 'rgba(9, 14, 25, 0.82)',
		color: '#f8fafc',
		cursor: 'pointer',
		textAlign: 'left' as const,
		transition: 'border-color 180ms ease, background 180ms ease, transform 180ms ease',
	};
}

const optionTitleStyle = {
	fontSize: '13px',
	fontWeight: 700,
} as const;

const optionMetaStyle = {
	color: '#94a3b8',
	fontSize: '12px',
	lineHeight: 1.4,
} as const;

const retryButtonStyle = {
	padding: '8px 12px',
	borderRadius: '12px',
	border: '1px solid rgba(148, 163, 184, 0.22)',
	background: 'rgba(9, 14, 25, 0.82)',
	color: '#e5e7eb',
	fontSize: '12px',
	fontWeight: 600,
	cursor: 'pointer',
} as const;

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
		<div style={selectorShellStyle}>
			<div style={selectorLabelRowStyle}>
				<div style={selectorEyebrowStyle}>Masaüstü hedefi</div>
				<div style={selectorHintStyle}>
					İstersen sonraki isteği açık bir bilgisayara yönlendirebilirsin.
				</div>
			</div>

			{devices.length > 0 ? (
				<div style={selectorOptionsStyle}>
					<button
						type="button"
						onClick={onClear}
						style={createOptionStyle(selectedConnectionId === null)}
					>
						<span style={optionTitleStyle}>Masaustu secilmedi</span>
						<span style={optionMetaStyle}>Sonraki istek normal sohbet akisinda kalsin.</span>
					</button>
					{devices.map((device) => {
						const isSelected = selectedConnectionId === device.connection_id;

						return (
							<button
								key={device.connection_id}
								type="button"
								onClick={() => onSelect(device.connection_id)}
								style={createOptionStyle(isSelected)}
							>
								<span style={optionTitleStyle}>{getDeviceLabel(device)}</span>
								<span style={optionMetaStyle}>{formatConnectedAt(device.connected_at)}</span>
							</button>
						);
					})}
				</div>
			) : null}

			{isLoading ? <div style={selectorHintStyle}>Açık bir masaüstü aranıyor...</div> : null}

			{errorMessage ? (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						gap: '12px',
						flexWrap: 'wrap',
					}}
				>
					<div style={selectorHintStyle}>
						Masaustu listesi simdilik yenilenemedi. Sohbet burada calismaya devam ediyor.
					</div>
					{typeof onRetry === 'function' ? (
						<button type="button" onClick={onRetry} style={retryButtonStyle}>
							Tekrar dene
						</button>
					) : null}
				</div>
			) : null}
		</div>
	);
}
