import type { DesktopDevicePresenceSnapshot } from '@runa/types';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchDesktopDevices } from '../lib/desktop-devices.js';
import { useDesktopDevices } from './useDesktopDevices.js';

vi.mock('../lib/desktop-devices.js', () => ({
	fetchDesktopDevices: vi.fn(),
}));

const fetchDesktopDevicesMock = vi.mocked(fetchDesktopDevices);

const desktopDevice: DesktopDevicePresenceSnapshot = {
	agent_id: 'agent_1',
	capabilities: [{ tool_name: 'desktop.screenshot' }],
	connected_at: '2026-05-05T00:00:00.000Z',
	connection_id: 'connection_1',
	machine_label: 'Codex Presence Poll Agent',
	status: 'online',
	transport: 'desktop_bridge',
	user_id: 'local-dev-user',
};

describe('useDesktopDevices', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		fetchDesktopDevicesMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('refreshes desktop presence in the background without returning to a loading state', async () => {
		fetchDesktopDevicesMock
			.mockResolvedValueOnce({ devices: [] })
			.mockResolvedValueOnce({ devices: [desktopDevice] });
		const onSelectedDeviceMissing = vi.fn();

		const { result } = renderHook(() =>
			useDesktopDevices({
				accessToken: 'token',
				onSelectedDeviceMissing,
				refreshIntervalMs: 1_000,
				selectedConnectionId: null,
			}),
		);

		await act(async () => {
			await Promise.resolve();
		});

		expect(result.current.isDesktopDevicesLoading).toBe(false);
		expect(result.current.desktopDevices).toEqual([]);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1_000);
		});

		await act(async () => {
			await Promise.resolve();
		});

		expect(result.current.desktopDevices).toEqual([desktopDevice]);
		expect(result.current.isDesktopDevicesLoading).toBe(false);
		expect(onSelectedDeviceMissing).not.toHaveBeenCalled();
	});
});
