import type { CSSProperties, ReactElement } from 'react';
import { useEffect, useState } from 'react';

import type { DesktopDevicePresenceSnapshot } from '@runa/types';

import {
	appShellMetricCardStyle,
	appShellMutedTextStyle,
	appShellPanelStyle,
	appShellSecondaryLabelStyle,
} from '../components/app/AppShell.js';
import { DevicePresencePanel } from '../components/desktop/DevicePresencePanel.js';
import { pillStyle } from '../lib/chat-styles.js';
import {
	DesktopDevicesResponseValidationError,
	fetchDesktopDevices,
} from '../lib/desktop-devices.js';

type DevicesPageProps = Readonly<{
	accessToken: string | null;
}>;

type DesktopDevicesState =
	| {
			readonly status: 'idle' | 'loading';
	  }
	| {
			readonly devices: readonly DesktopDevicePresenceSnapshot[];
			readonly status: 'success';
	  }
	| {
			readonly message: string;
			readonly status: 'error';
	  };

const sectionGridStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
	gap: '16px',
};

function getDesktopDevices(state: DesktopDevicesState): readonly DesktopDevicePresenceSnapshot[] {
	return state.status === 'success' ? state.devices : [];
}

function getDesktopDeviceError(state: DesktopDevicesState): string | null {
	return state.status === 'error' ? state.message : null;
}

function getCapabilityCount(devices: readonly DesktopDevicePresenceSnapshot[]): number {
	return devices.reduce((total, device) => total + device.capabilities.length, 0);
}

export function DevicesPage({ accessToken }: DevicesPageProps): ReactElement {
	const [desktopDevicesState, setDesktopDevicesState] = useState<DesktopDevicesState>({
		status: 'idle',
	});
	const [desktopDevicesReloadKey, setDesktopDevicesReloadKey] = useState(0);

	useEffect(() => {
		const normalizedAccessToken = accessToken?.trim() ?? '';
		const currentReloadKey = desktopDevicesReloadKey;
		void currentReloadKey;

		if (normalizedAccessToken.length === 0) {
			setDesktopDevicesState({
				devices: [],
				status: 'success',
			});
			return;
		}

		const abortController = new AbortController();
		setDesktopDevicesState({
			status: 'loading',
		});

		void fetchDesktopDevices({
			bearerToken: normalizedAccessToken,
			signal: abortController.signal,
		})
			.then((response) => {
				setDesktopDevicesState({
					devices: response.devices,
					status: 'success',
				});
			})
			.catch((error: unknown) => {
				if (abortController.signal.aborted) {
					return;
				}

				if (error instanceof DesktopDevicesResponseValidationError) {
					setDesktopDevicesState({
						message: 'Cihaz listesi beklenen sekilde donmedi. Lutfen biraz sonra yeniden dene.',
						status: 'error',
					});
					return;
				}

				setDesktopDevicesState({
					message:
						error instanceof Error
							? error.message
							: 'Cihazlar su anda yuklenemedi. Lutfen biraz sonra yeniden dene.',
					status: 'error',
				});
			});

		return () => {
			abortController.abort();
		};
	}, [accessToken, desktopDevicesReloadKey]);

	const desktopDevices = getDesktopDevices(desktopDevicesState);
	const desktopDeviceError = getDesktopDeviceError(desktopDevicesState);
	const isDesktopDeviceLoading =
		desktopDevicesState.status === 'idle' || desktopDevicesState.status === 'loading';

	return (
		<>
			<section style={appShellPanelStyle} aria-labelledby="devices-heading">
				<div style={{ display: 'grid', gap: '10px' }}>
					<div style={appShellSecondaryLabelStyle}>Cihazlar</div>
					<h2 id="devices-heading" style={{ margin: 0, fontSize: '24px' }}>
						Bagli cihazlar
					</h2>
					<p style={appShellMutedTextStyle}>
						Masaustu companion baglantisi burada gorunur. Runa bagli olmayan bir bilgisayari hazir
						gibi gostermez ve yetenekleri yalniz bildirilmis izinlerle sunar.
					</p>
				</div>

				<div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '16px' }}>
					<span style={pillStyle}>{desktopDevices.length} aktif cihaz</span>
					<span style={{ ...pillStyle, borderColor: 'rgba(96, 165, 250, 0.26)', color: '#bfdbfe' }}>
						{getCapabilityCount(desktopDevices)} izinli yetenek
					</span>
				</div>
			</section>

			<section style={sectionGridStyle}>
				<div style={appShellMetricCardStyle}>
					<div style={appShellSecondaryLabelStyle}>Urun alani</div>
					<div style={{ color: '#f8fafc', fontSize: '18px', fontWeight: 700 }}>
						Desktop companion
					</div>
					<p style={appShellMutedTextStyle}>
						Cihazlar hesap ayarlarina gomulmeden, Runa'nin dogal capability alani olarak burada
						izlenir.
					</p>
				</div>
				<div style={appShellMetricCardStyle}>
					<div style={appShellSecondaryLabelStyle}>Guven</div>
					<div style={{ color: '#f8fafc', fontSize: '18px', fontWeight: 700 }}>Canli durum</div>
					<p style={appShellMutedTextStyle}>
						Baglanti yoksa bos durum acikca soyler; sahte cihaz veya hazirlik mesaji uretilmez.
					</p>
				</div>
			</section>

			<section
				style={appShellPanelStyle}
				className="runa-card runa-card--subtle"
				aria-labelledby="online-devices-heading"
			>
				<DevicePresencePanel
					devices={desktopDevices}
					error={desktopDeviceError}
					isLoading={isDesktopDeviceLoading}
					onRefresh={() => setDesktopDevicesReloadKey((current) => current + 1)}
				/>
			</section>
		</>
	);
}
