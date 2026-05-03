import type { DesktopAgentPersistedSession } from './auth.js';
import type {
	DesktopAgentLaunchSurface,
	DesktopAgentLaunchSurfaceListener,
	DesktopAgentLaunchSurfaceSnapshot,
	DesktopAgentLaunchViewModel,
} from './launch-surface.js';
import type {
	DesktopAgentWindowActionHandler,
	DesktopAgentWindowDocument,
	DesktopAgentWindowHost,
} from './window-host.js';

import { describe, expect, it } from 'vitest';

import { createDesktopAgentLaunchController } from './launch-controller.js';

class FakeLaunchSurface implements DesktopAgentLaunchSurface {
	readonly #listeners = new Set<DesktopAgentLaunchSurfaceListener>();
	#snapshot: DesktopAgentLaunchSurfaceSnapshot;

	constructor(snapshot: DesktopAgentLaunchSurfaceSnapshot) {
		this.#snapshot = snapshot;
	}

	getSnapshot(): DesktopAgentLaunchSurfaceSnapshot {
		return {
			...this.#snapshot,
		};
	}

	getViewModel(): DesktopAgentLaunchViewModel {
		const snapshot = this.getSnapshot();

		return {
			agent_id: snapshot.agent_id,
			connected_at: snapshot.connected_at,
			machine_label: snapshot.machine_label,
			message: snapshot.message ?? snapshot.status,
			primary_action: {
				id: snapshot.session_present ? 'connect' : 'sign_in',
				label: snapshot.session_present ? 'Connect' : 'Sign in',
			},
			secondary_action: snapshot.session_present
				? {
						id: 'sign_out',
						label: 'Sign out',
					}
				: undefined,
			session_present: snapshot.session_present,
			status: snapshot.status,
			title: snapshot.status,
		};
	}

	async retry(): Promise<DesktopAgentLaunchSurfaceSnapshot> {
		return await this.start();
	}

	async signOut(): Promise<DesktopAgentLaunchSurfaceSnapshot> {
		return this.#setSnapshot({
			agent_id: this.#snapshot.agent_id,
			machine_label: this.#snapshot.machine_label,
			message: 'Signed out',
			session_present: false,
			status: 'needs_sign_in',
		});
	}

	async start(): Promise<DesktopAgentLaunchSurfaceSnapshot> {
		if (!this.#snapshot.session_present) {
			return this.#setSnapshot({
				agent_id: this.#snapshot.agent_id,
				machine_label: this.#snapshot.machine_label,
				message: 'Sign in required',
				session_present: false,
				status: 'needs_sign_in',
			});
		}

		await this.#setSnapshot({
			agent_id: this.#snapshot.agent_id,
			machine_label: this.#snapshot.machine_label,
			message: 'Connecting',
			session_present: true,
			status: 'connecting',
		});

		return this.#setSnapshot({
			agent_id: this.#snapshot.agent_id,
			connected_at: '2026-05-03T00:00:00.000Z',
			machine_label: this.#snapshot.machine_label,
			message: 'Connected',
			session_present: true,
			status: 'connected',
		});
	}

	async stop(): Promise<DesktopAgentLaunchSurfaceSnapshot> {
		return this.#setSnapshot({
			agent_id: this.#snapshot.agent_id,
			machine_label: this.#snapshot.machine_label,
			message: 'Ready',
			session_present: true,
			status: 'ready',
		});
	}

	async submitSession(
		_session: DesktopAgentPersistedSession,
	): Promise<DesktopAgentLaunchSurfaceSnapshot> {
		await this.#setSnapshot({
			agent_id: this.#snapshot.agent_id,
			machine_label: this.#snapshot.machine_label,
			message: 'Connecting',
			session_present: true,
			status: 'connecting',
		});

		return this.#setSnapshot({
			agent_id: this.#snapshot.agent_id,
			connected_at: '2026-05-03T00:00:00.000Z',
			machine_label: this.#snapshot.machine_label,
			message: 'Connected',
			session_present: true,
			status: 'connected',
		});
	}

	subscribe(listener: DesktopAgentLaunchSurfaceListener): () => void {
		this.#listeners.add(listener);
		listener(this.getSnapshot(), this.getViewModel());

		return () => {
			this.#listeners.delete(listener);
		};
	}

	#setSnapshot(snapshot: DesktopAgentLaunchSurfaceSnapshot): DesktopAgentLaunchSurfaceSnapshot {
		this.#snapshot = snapshot;

		for (const listener of this.#listeners) {
			listener(this.getSnapshot(), this.getViewModel());
		}

		return this.getSnapshot();
	}
}

class CapturingWindowHost implements DesktopAgentWindowHost {
	readonly statuses: string[] = [];

	dispose(): void {}

	mount(_document: DesktopAgentWindowDocument, viewModel?: { readonly status: string }): void {
		if (viewModel) {
			this.statuses.push(viewModel.status);
		}
	}

	setActionHandler(_handler: DesktopAgentWindowActionHandler): void {}

	update(_document: DesktopAgentWindowDocument, viewModel?: { readonly status: string }): void {
		if (viewModel) {
			this.statuses.push(viewModel.status);
		}
	}
}

describe('DesktopAgentLaunchController', () => {
	it('drives no-session start, submit, connected stop, and sign out transitions', async () => {
		const host = new CapturingWindowHost();
		const controller = createDesktopAgentLaunchController({
			agent_id: 'agent-1',
			host,
			launch_surface: new FakeLaunchSurface({
				agent_id: 'agent-1',
				machine_label: 'Test PC',
				session_present: false,
				status: 'needs_sign_in',
			}),
			server_url: 'ws://127.0.0.1:3000/ws/desktop-agent',
		});

		await controller.start();
		expect(controller.getSnapshot().status).toBe('awaiting_session_input');

		await controller.submitSession({
			access_token: 'access-token',
			refresh_token: 'refresh-token',
		});
		expect(controller.getSnapshot().status).toBe('connected');

		await controller.stop();
		expect(controller.getSnapshot().status).toBe('ready');

		await controller.signOut();
		expect(controller.getSnapshot().status).toBe('awaiting_session_input');
		expect(host.statuses).toContain('connecting');
		expect(host.statuses).toContain('connected');
	});
});
