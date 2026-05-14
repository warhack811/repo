import type { DesktopDevicePresenceSnapshot } from '@runa/types';
import { useEffect, useState } from 'react';

import { fetchDesktopDevices } from '../lib/desktop-devices.js';

const DESKTOP_DEVICES_REFRESH_INTERVAL_MS = 10_000;

export type UseDesktopDevicesInput = Readonly<{
	accessToken?: string | null;
	onSelectedDeviceMissing: () => void;
	refreshIntervalMs?: number;
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
	refreshIntervalMs = DESKTOP_DEVICES_REFRESH_INTERVAL_MS,
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

		let isDisposed = false;
		const abortControllers = new Set<AbortController>();

		async function loadDesktopDevices(showLoading: boolean): Promise<void> {
			const abortController = new AbortController();
			abortControllers.add(abortController);

			if (showLoading) {
				setIsDesktopDevicesLoading(true);
			}

			try {
				const response = await fetchDesktopDevices({
					bearerToken: normalizedAccessToken,
					signal: abortController.signal,
				});

				if (isDisposed || abortController.signal.aborted) {
					return;
				}

				setDesktopDevices(response.devices);
				setDesktopDeviceError(null);
			} catch (error: unknown) {
				if (isDisposed || abortController.signal.aborted) {
					return;
				}

				setDesktopDeviceError(
					error instanceof Error ? error.message : 'Desktop availability could not be loaded.',
				);
			} finally {
				abortControllers.delete(abortController);

				if (!isDisposed && !abortController.signal.aborted && showLoading) {
					setIsDesktopDevicesLoading(false);
				}
			}
		}

		void loadDesktopDevices(true);
		const refreshInterval =
			refreshIntervalMs > 0
				? setInterval(() => {
						void loadDesktopDevices(false);
					}, refreshIntervalMs)
				: undefined;

		return () => {
			isDisposed = true;
			if (refreshInterval !== undefined) {
				clearInterval(refreshInterval);
			}
			for (const abortController of abortControllers) {
				abortController.abort();
			}
		};
	}, [accessToken, desktopDevicesReloadKey, refreshIntervalMs]);

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
