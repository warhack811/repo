import type { DesktopDevicePresenceSnapshot } from '@runa/types';
import { useEffect, useState } from 'react';

import { fetchDesktopDevices } from '../lib/desktop-devices.js';

export type UseDesktopDevicesInput = Readonly<{
	accessToken?: string | null;
	onSelectedDeviceMissing: () => void;
	selectedConnectionId: string | null;
}>;

export type UseDesktopDevicesResult = Readonly<{
	desktopDeviceError: string | null;
	desktopDevices: readonly DesktopDevicePresenceSnapshot[];
	isDesktopDevicesLoading: boolean;
	reloadDesktopDevices: () => void;
}>;

export function useDesktopDevices({
	accessToken,
	onSelectedDeviceMissing,
	selectedConnectionId,
}: UseDesktopDevicesInput): UseDesktopDevicesResult {
	const [desktopDeviceError, setDesktopDeviceError] = useState<string | null>(null);
	const [desktopDevices, setDesktopDevices] = useState<readonly DesktopDevicePresenceSnapshot[]>(
		[],
	);
	const [desktopDevicesReloadKey, setDesktopDevicesReloadKey] = useState(0);
	const [isDesktopDevicesLoading, setIsDesktopDevicesLoading] = useState(false);

	useEffect(() => {
		const normalizedAccessToken = accessToken?.trim() ?? '';
		const currentDesktopDevicesReloadKey = desktopDevicesReloadKey;
		void currentDesktopDevicesReloadKey;

		if (normalizedAccessToken.length === 0) {
			setDesktopDevices([]);
			setDesktopDeviceError(null);
			setIsDesktopDevicesLoading(false);
			return;
		}

		const abortController = new AbortController();
		setIsDesktopDevicesLoading(true);

		void fetchDesktopDevices({
			bearerToken: normalizedAccessToken,
			signal: abortController.signal,
		})
			.then((response) => {
				setDesktopDevices(response.devices);
				setDesktopDeviceError(null);
			})
			.catch((error: unknown) => {
				if (abortController.signal.aborted) {
					return;
				}

				setDesktopDeviceError(
					error instanceof Error ? error.message : 'Desktop availability could not be loaded.',
				);
			})
			.finally(() => {
				if (!abortController.signal.aborted) {
					setIsDesktopDevicesLoading(false);
				}
			});

		return () => {
			abortController.abort();
		};
	}, [accessToken, desktopDevicesReloadKey]);

	useEffect(() => {
		if (
			selectedConnectionId !== null &&
			desktopDevices.every((device) => device.connection_id !== selectedConnectionId)
		) {
			onSelectedDeviceMissing();
		}
	}, [desktopDevices, onSelectedDeviceMissing, selectedConnectionId]);

	return {
		desktopDeviceError,
		desktopDevices,
		isDesktopDevicesLoading,
		reloadDesktopDevices: () => setDesktopDevicesReloadKey((current) => current + 1),
	};
}
