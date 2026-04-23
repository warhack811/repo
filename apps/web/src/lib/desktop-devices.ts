import type { DesktopDevicePresenceListResponse, DesktopDevicePresenceSnapshot } from '@runa/types';

export interface FetchDesktopDevicesInput {
	readonly bearerToken?: string;
	readonly signal?: AbortSignal;
}

interface DesktopDevicePresenceSnapshotCandidate extends Record<string, unknown> {
	readonly agent_id?: unknown;
	readonly capabilities?: unknown;
	readonly connected_at?: unknown;
	readonly connection_id?: unknown;
	readonly machine_label?: unknown;
	readonly status?: unknown;
	readonly transport?: unknown;
	readonly user_id?: unknown;
}

interface DesktopDevicePresenceListResponseCandidate extends Record<string, unknown> {
	readonly devices?: unknown;
}

interface DesktopAgentCapabilityCandidate extends Record<string, unknown> {
	readonly tool_name?: unknown;
}

export class DesktopDevicesResponseValidationError extends Error {
	constructor(message = 'Desktop devices response did not match the expected shape.') {
		super(message);
		this.name = 'DesktopDevicesResponseValidationError';
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDesktopAgentCapability(value: unknown): boolean {
	if (!isRecord(value)) {
		return false;
	}

	const capability = value as DesktopAgentCapabilityCandidate;

	return typeof capability.tool_name === 'string';
}

function isDesktopDevicePresenceSnapshot(value: unknown): value is DesktopDevicePresenceSnapshot {
	if (!isRecord(value)) {
		return false;
	}

	const snapshot = value as DesktopDevicePresenceSnapshotCandidate;

	return (
		typeof snapshot.agent_id === 'string' &&
		Array.isArray(snapshot.capabilities) &&
		snapshot.capabilities.every((capability) => isDesktopAgentCapability(capability)) &&
		typeof snapshot.connected_at === 'string' &&
		typeof snapshot.connection_id === 'string' &&
		(snapshot.machine_label === undefined || typeof snapshot.machine_label === 'string') &&
		snapshot.status === 'online' &&
		snapshot.transport === 'desktop_bridge' &&
		typeof snapshot.user_id === 'string'
	);
}

function isDesktopDevicePresenceListResponse(
	value: unknown,
): value is DesktopDevicePresenceListResponse {
	if (!isRecord(value)) {
		return false;
	}

	const response = value as DesktopDevicePresenceListResponseCandidate;

	return (
		Array.isArray(response.devices) &&
		response.devices.every((device) => isDesktopDevicePresenceSnapshot(device))
	);
}

async function readErrorMessage(response: Response): Promise<string> {
	const responseText = await response.text();
	const trimmedText = responseText.trim();

	if (trimmedText.length === 0) {
		return `Desktop devices request failed with status ${response.status}.`;
	}

	return trimmedText;
}

export async function fetchDesktopDevices(
	input: FetchDesktopDevicesInput = {},
): Promise<DesktopDevicePresenceListResponse> {
	const headers = new Headers({
		accept: 'application/json',
	});

	if (input.bearerToken && input.bearerToken.trim().length > 0) {
		headers.set('authorization', `Bearer ${input.bearerToken.trim()}`);
	}

	const response = await fetch('/desktop/devices', {
		cache: 'no-store',
		credentials: 'same-origin',
		headers,
		method: 'GET',
		signal: input.signal,
	});

	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}

	const parsed = (await response.json()) as unknown;

	if (!isDesktopDevicePresenceListResponse(parsed)) {
		throw new DesktopDevicesResponseValidationError();
	}

	return parsed;
}
