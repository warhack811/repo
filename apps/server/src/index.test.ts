import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { FastifyInstance } from 'fastify';

import type { BuildServerOptions } from './app.js';
import { startServer } from './index.js';

describe('startServer', () => {
	it('uses the resolved plain transport config deterministically during bootstrap', async () => {
		const listen = vi.fn().mockResolvedValue(undefined);
		const info = vi.fn();
		const error = vi.fn();
		const fakeServer = {
			listen,
			log: {
				error,
				info,
			},
		} as unknown as FastifyInstance;
		const buildServer = vi
			.fn<(options?: BuildServerOptions) => Promise<FastifyInstance>>()
			.mockResolvedValue(fakeServer);

		const server = await startServer({
			build_server: buildServer,
			environment: {},
			host: '0.0.0.0',
			port: 3100,
		});

		expect(server).toBe(fakeServer);
		expect(buildServer).toHaveBeenCalledWith({});
		expect(listen).toHaveBeenCalledWith({
			host: '0.0.0.0',
			port: 3100,
		});
		expect(info).toHaveBeenCalledWith(
			{
				http_protocol: 'http',
				transport_mode: 'plain',
				ws_protocol: 'ws',
			},
			'Server transport configured.',
		);
		expect(error).not.toHaveBeenCalled();
	});

	it('uses the resolved TLS transport config deterministically during bootstrap', async () => {
		const listen = vi.fn().mockResolvedValue(undefined);
		const info = vi.fn();
		const fakeServer = {
			listen,
			log: {
				error: vi.fn(),
				info,
			},
		} as unknown as FastifyInstance;
		const buildServer = vi
			.fn<(options?: BuildServerOptions) => Promise<FastifyInstance>>()
			.mockResolvedValue(fakeServer);
		const readTlsFile = vi.fn((filePath: string) => `pem:${filePath}`);

		await startServer({
			build_server: buildServer,
			environment: {
				TLS_CERT_PATH: 'certs/server.crt',
				TLS_KEY_PATH: 'certs/server.key',
			},
			host: '127.0.0.1',
			port: 3443,
			read_tls_file: readTlsFile,
		});

		expect(buildServer).toHaveBeenCalledWith({
			https: {
				ca: undefined,
				cert: `pem:${resolve(process.cwd(), 'certs/server.crt')}`,
				key: `pem:${resolve(process.cwd(), 'certs/server.key')}`,
			},
		});
		expect(listen).toHaveBeenCalledWith({
			host: '127.0.0.1',
			port: 3443,
		});
		expect(info).toHaveBeenCalledWith(
			{
				http_protocol: 'https',
				transport_mode: 'tls',
				ws_protocol: 'wss',
			},
			'Server transport configured.',
		);
	});
});
