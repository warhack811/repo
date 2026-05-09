/**
 * @runa/server — Entry Point
 *
 * Fastify backend sunucusu.
 * Sprint 1'de: HTTP + WebSocket sunucu, basic run loop.
 * Şu an scaffold placeholder — implementasyon sonraki görevlerde.
 */

import { pathToFileURL } from 'node:url';

import type { FastifyInstance } from 'fastify';

import type { BuildServerOptions } from './app.js';
import { buildServer } from './app.js';
import {
	type TlsEnvironment,
	type TlsFileReader,
	createServerTransportConfig,
} from './config/tls.js';

const DEFAULT_SERVER_HOST = '127.0.0.1';
const DEFAULT_SERVER_PORT = 3000;

function resolvePortFromEnvironment(): number | undefined {
	const candidateValue = process.env['RUNA_SERVER_PORT'] ?? process.env['PORT'];

	if (candidateValue === undefined || candidateValue.trim().length === 0) {
		return undefined;
	}

	const parsed = Number.parseInt(candidateValue, 10);

	if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
		return undefined;
	}

	return parsed;
}

export interface StartServerOptions {
	readonly build_server?: (options?: BuildServerOptions) => Promise<FastifyInstance>;
	readonly environment?: TlsEnvironment;
	readonly host?: string;
	readonly port?: number;
	readonly read_tls_file?: TlsFileReader;
}

export async function startServer(options: StartServerOptions = {}): Promise<FastifyInstance> {
	const resolvedPort = options.port ?? resolvePortFromEnvironment() ?? DEFAULT_SERVER_PORT;
	const transportConfig = createServerTransportConfig({
		environment: options.environment ?? (process.env as NodeJS.ProcessEnv & TlsEnvironment),
		read_file: options.read_tls_file,
	});
	const server = await (options.build_server ?? buildServer)(
		transportConfig.fastify_server_options as BuildServerOptions,
	);

	try {
		console.log(
			`[server] Attempting to listen on ${options.host ?? DEFAULT_SERVER_HOST}:${resolvedPort}...`,
		);
		await server.listen({
			host: options.host ?? DEFAULT_SERVER_HOST,
			port: resolvedPort,
		});
		console.log('[server] server.listen completed.');
		server.log.info(
			{
				http_protocol: transportConfig.http_protocol,
				transport_mode: transportConfig.mode,
				ws_protocol: transportConfig.ws_protocol,
			},
			'Server transport configured.',
		);
		return server;
	} catch (error: unknown) {
		server.log.error({ error }, 'Failed to start server');
		throw error;
	}
}

function isDirectExecution(argvEntry: string | undefined = process.argv[1]): boolean {
	return argvEntry !== undefined && import.meta.url === pathToFileURL(argvEntry).href;
}

if (isDirectExecution()) {
	await startServer();
}
