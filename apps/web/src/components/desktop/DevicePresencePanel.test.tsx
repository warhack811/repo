import type { DesktopDevicePresenceSnapshot } from '@runa/types';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DevicePresencePanel } from './DevicePresencePanel.js';

const device: DesktopDevicePresenceSnapshot = {
	agent_id: 'agent_123456789',
	capabilities: [{ tool_name: 'desktop.screenshot' }],
	connected_at: '2026-04-25T12:00:00.000Z',
	connection_id: 'connection_123',
	machine_label: 'Workstation',
	status: 'online',
	transport: 'desktop_bridge',
	user_id: 'user_123',
};

describe('DevicePresencePanel', () => {
	it('renders an honest empty state without fake devices', () => {
		const markup = renderToStaticMarkup(<DevicePresencePanel devices={[]} />);

		expect(markup).toContain('Bagli cihaz yok');
		expect(markup).not.toContain('desktop.screenshot');
	});

	it('renders real device presence and hides raw connection detail behind details', () => {
		const markup = renderToStaticMarkup(<DevicePresencePanel devices={[device]} />);

		expect(markup).toContain('Workstation');
		expect(markup).toContain('desktop.screenshot');
		expect(markup).toContain('<details');
		expect(markup).toContain('connection_123');
	});
});
