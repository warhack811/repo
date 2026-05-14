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
						message: 'Cihazlar şu anda yüklenemedi. Biraz sonra yeniden deneyebilirsin.',
						status: 'error',
					});
					return;
				}

				setDesktopDevicesState({
					message: 'Cihazlar şu anda yüklenemedi. Biraz sonra yeniden deneyebilirsin.',
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
			<section className="runa-page-devicespage-1" aria-labelledby="devices-heading">
				<div className="runa-page-devicespage-2">
					<div className="runa-page-devicespage-3">Cihazlar</div>
					<h2 id="devices-heading" className="runa-page-devicespage-4">
						Bağlı bilgisayar
					</h2>
					<p className="runa-page-devicespage-5">
						Bilgisayar bağlantısı açık olduğunda dosya, ekran ve masaüstü adımları senin
						onayınla ilerler.
					</p>
				</div>
			</section>

			<section className="runa-page-devicespage-18" aria-labelledby="online-devices-heading">
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
