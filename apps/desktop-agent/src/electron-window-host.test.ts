import type {
	ElectronWindowHostLegacyShellState,
	ElectronWindowHostWebContents,
} from './electron-window-host.js';
import type { DesktopAgentLaunchControllerViewModel } from './launch-controller.js';

import { describe, expect, it } from 'vitest';

import { createElectronDesktopAgentWindowHost } from './electron-window-host.js';

interface SentMessage {
	readonly channel: string;
	readonly payload: unknown;
}

class FakeWebContents implements ElectronWindowHostWebContents {
	readonly messages: SentMessage[] = [];

	send(channel: 'shell:viewModel', viewModel: DesktopAgentLaunchControllerViewModel): void;
	send(channel: 'shell:stateChanged', shellState: ElectronWindowHostLegacyShellState): void;
	send(channel: string, payload: unknown): void {
		this.messages.push({ channel, payload });
	}
}

function createViewModel(
	status: DesktopAgentLaunchControllerViewModel['status'],
): DesktopAgentLaunchControllerViewModel {
	return {
		agent_id: 'agent-1',
		awaiting_session_input: status === 'awaiting_session_input',
		message: status,
		primary_action: {
			id: 'connect',
			label: 'Connect',
		},
		session_present: status !== 'awaiting_session_input' && status !== 'needs_sign_in',
		status,
		title: status,
	};
}

describe('createElectronDesktopAgentWindowHost', () => {
	it('emits view-model IPC updates and legacy shell updates', () => {
		const webContents = new FakeWebContents();
		const toolTips: string[] = [];
		const host = createElectronDesktopAgentWindowHost({
			mainWindow: {
				webContents,
			},
			tray: {
				setToolTip: (toolTip) => {
					toolTips.push(toolTip);
				},
			},
		});

		host.mount({ html: '<html></html>' }, createViewModel('awaiting_session_input'));
		host.update({ html: '<html></html>' }, createViewModel('connected'));

		expect(webContents.messages.map((message) => message.channel)).toEqual([
			'shell:viewModel',
			'shell:stateChanged',
			'shell:viewModel',
			'shell:stateChanged',
		]);
		expect(toolTips).toEqual(['Runa Desktop - Sign in required', 'Runa Desktop - Connected']);
	});

	it('stops publishing after disposal', () => {
		const webContents = new FakeWebContents();
		const host = createElectronDesktopAgentWindowHost({
			mainWindow: {
				webContents,
			},
			tray: null,
		});

		host.dispose();
		host.update({ html: '<html></html>' }, createViewModel('connected'));

		expect(webContents.messages).toEqual([]);
	});
});
