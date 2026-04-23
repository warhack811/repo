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
