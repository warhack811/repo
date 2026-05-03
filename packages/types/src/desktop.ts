import type { DesktopAgentCapability } from './ws.js';

export interface DesktopDevicePresenceSnapshot {
	readonly agent_id: string;
	readonly capabilities: readonly DesktopAgentCapability[];
	readonly connected_at: string;
	readonly connection_id: string;
	readonly machine_label?: string;
	readonly status: 'online';
	readonly transport: 'desktop_bridge';
	readonly user_id: string;
}

export interface DesktopDevicePresenceListResponse {
	readonly devices: readonly DesktopDevicePresenceSnapshot[];
}

export interface DesktopAgentSettingsStoreState {
	readonly autoStart: boolean;
	readonly openWindowOnStart: boolean;
	readonly telemetryOptIn: boolean;
}

export interface DesktopAgentPairingCodePayload {
	readonly code: string;
}

export interface DesktopAgentDiagnosticsSnapshot {
	readonly app_version: string;
	readonly arch: string;
	readonly electron_version: string;
	readonly last_log_lines: readonly string[];
	readonly locale?: string;
	readonly node_version: string;
	readonly platform: string;
	readonly runtime_status: string;
	readonly settings: DesktopAgentSettingsStoreState;
}
