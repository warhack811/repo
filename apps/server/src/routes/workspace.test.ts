import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { registerWorkspaceRoutes } from './workspace.js';

describe('registerWorkspaceRoutes', () => {
	const servers: ReturnType<typeof Fastify>[] = [];

	afterEach(async () => {
		await Promise.all(
			servers.splice(0, servers.length).map(async (server) => {
				await server.close();
			}),
		);
	});

	it('returns workspace directories for authenticated requests', async () => {
		const server = Fastify();
		servers.push(server);
		server.addHook('onRequest', async (request) => {
			(request as unknown as { auth: unknown }).auth = {
				principal: {
					kind: 'authenticated',
				},
				transport: 'websocket',
			};
		});
		await registerWorkspaceRoutes(server);

		const response = await server.inject({
			method: 'GET',
			url: '/workspace/directories',
		});

		expect(response.statusCode).toBe(200);
		const payload = response.json() as {
			readonly directories: readonly { readonly relative_path: string }[];
			readonly workspace_root_name: string;
		};
		expect(typeof payload.workspace_root_name).toBe('string');
		expect(Array.isArray(payload.directories)).toBe(true);
		expect(payload.directories.some((entry) => entry.relative_path === 'apps')).toBe(true);
	});

	it('rejects anonymous requests', async () => {
		const server = Fastify();
		servers.push(server);
		server.addHook('onRequest', async (request) => {
			(request as unknown as { auth: unknown }).auth = {
				principal: {
					kind: 'anonymous',
				},
				transport: 'websocket',
			};
		});
		await registerWorkspaceRoutes(server);

		const response = await server.inject({
			method: 'GET',
			url: '/workspace/directories',
		});

		expect(response.statusCode).toBe(401);
	});
});
