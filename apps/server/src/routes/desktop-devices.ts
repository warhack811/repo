import type { DesktopDevicePresenceListResponse } from '@runa/types';
import type { FastifyInstance } from 'fastify';

import { SupabaseAuthError } from '../auth/supabase-auth.js';
import {
	type DesktopAgentBridgeRegistry,
	defaultDesktopAgentBridgeRegistry,
} from '../ws/desktop-agent-bridge.js';

export interface RegisterDesktopDeviceRoutesOptions {
	readonly desktopAgentBridgeRegistry?: DesktopAgentBridgeRegistry;
}

export async function registerDesktopDeviceRoutes(
	server: FastifyInstance,
	options: RegisterDesktopDeviceRoutesOptions = {},
): Promise<void> {
	const desktopAgentBridgeRegistry =
		options.desktopAgentBridgeRegistry ?? defaultDesktopAgentBridgeRegistry;

	server.get<{ Reply: DesktopDevicePresenceListResponse }>('/desktop/devices', async (request) => {
		if (request.auth.principal.kind !== 'authenticated') {
			throw new SupabaseAuthError(
				'SUPABASE_AUTH_REQUIRED',
				'Desktop device listing requires an authenticated user session.',
			);
		}

		return {
			devices: desktopAgentBridgeRegistry.listPresenceSnapshotsForUserId(
				request.auth.principal.user_id,
			),
		};
	});
}
