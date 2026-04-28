import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import type { DesktopDevicePresenceSnapshot } from '@runa/types';
import { DevicePresencePanel } from '../components/desktop/DevicePresencePanel.js';
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
			<section className="runa-migrated-pages-devicespage-1" aria-labelledby="devices-heading">
				<div className="runa-migrated-pages-devicespage-2">
					<div className="runa-migrated-pages-devicespage-3">Cihazlar</div>
					<h2 id="devices-heading" className="runa-migrated-pages-devicespage-4">
						Bagli cihazlar
					</h2>
					<p className="runa-migrated-pages-devicespage-5">
						Masaustu companion baglantisi burada gorunur. Runa bagli olmayan bir bilgisayari hazir
						gibi gostermez ve yetenekleri yalniz bildirilmis izinlerle sunar.
					</p>
				</div>

				<div className="runa-migrated-pages-devicespage-6">
					<span className="runa-migrated-pages-devicespage-7">
						{desktopDevices.length} aktif cihaz
					</span>
					<span className="runa-migrated-pages-devicespage-8">
						{getCapabilityCount(desktopDevices)} izinli yetenek
					</span>
				</div>
			</section>

			<section className="runa-migrated-pages-devicespage-9">
				<div className="runa-migrated-pages-devicespage-10">
					<div className="runa-migrated-pages-devicespage-11">Urun alani</div>
					<div className="runa-migrated-pages-devicespage-12">Desktop companion</div>
					<p className="runa-migrated-pages-devicespage-13">
						Cihazlar hesap ayarlarina gomulmeden, Runa'nin dogal capability alani olarak burada
						izlenir.
					</p>
				</div>
				<div className="runa-migrated-pages-devicespage-14">
					<div className="runa-migrated-pages-devicespage-15">Guven</div>
					<div className="runa-migrated-pages-devicespage-16">Canli durum</div>
					<p className="runa-migrated-pages-devicespage-17">
						Baglanti yoksa bos durum acikca soyler; sahte cihaz veya hazirlik mesaji uretilmez.
					</p>
				</div>
			</section>

			<section
				className="runa-card runa-card--subtle runa-migrated-pages-devicespage-18"
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
