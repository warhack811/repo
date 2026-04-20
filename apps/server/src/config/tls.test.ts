import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
	type ServerTransportConfig,
	TlsConfigError,
	createServerTransportConfig,
	resolveTlsConfig,
} from './tls.js';

describe('resolveTlsConfig', () => {
	it('returns undefined when no TLS config is provided and allows plain HTTP/WS fallback', () => {
		expect(resolveTlsConfig({ environment: {} })).toBeUndefined();
		expect(createServerTransportConfig({ environment: {} })).toEqual({
			fastify_server_options: {},
			http_protocol: 'http',
			mode: 'plain',
			ws_protocol: 'ws',
		} satisfies ServerTransportConfig);
	});

	it('resolves complete TLS config into HTTPS/WSS transport settings', () => {
		const cwd = 'D:\\ai\\Runa\\apps\\server';
		const readFile = vi.fn((filePath: string) => `pem:${filePath}`);
		const transport = createServerTransportConfig({
			cwd,
			environment: {
				TLS_CA_PATH: 'certs/root-ca.pem',
				TLS_CERT_PATH: './certs/server.crt',
				TLS_KEY_PATH: './certs/server.key',
			},
			read_file: readFile,
		});

		expect(transport).toEqual({
			fastify_server_options: {
				https: {
					ca: `pem:${resolve(cwd, 'certs/root-ca.pem')}`,
					cert: `pem:${resolve(cwd, 'certs/server.crt')}`,
					key: `pem:${resolve(cwd, 'certs/server.key')}`,
				},
			},
			http_protocol: 'https',
			mode: 'tls',
			tls: {
				ca: `pem:${resolve(cwd, 'certs/root-ca.pem')}`,
				ca_path: resolve(cwd, 'certs/root-ca.pem'),
				cert: `pem:${resolve(cwd, 'certs/server.crt')}`,
				cert_path: resolve(cwd, 'certs/server.crt'),
				key: `pem:${resolve(cwd, 'certs/server.key')}`,
				key_path: resolve(cwd, 'certs/server.key'),
			},
			ws_protocol: 'wss',
		} satisfies ServerTransportConfig);
		expect(readFile).toHaveBeenCalledTimes(3);
		expect(readFile).toHaveBeenNthCalledWith(1, resolve(cwd, 'certs/server.key'));
		expect(readFile).toHaveBeenNthCalledWith(2, resolve(cwd, 'certs/server.crt'));
		expect(readFile).toHaveBeenNthCalledWith(3, resolve(cwd, 'certs/root-ca.pem'));
	});

	it('throws a controlled config error when TLS config is incomplete', () => {
		expect(() =>
			resolveTlsConfig({
				environment: {
					TLS_KEY_PATH: './certs/server.key',
				},
			}),
		).toThrowError(TlsConfigError);

		try {
			resolveTlsConfig({
				environment: {
					TLS_CA_PATH: './certs/root-ca.pem',
					TLS_KEY_PATH: './certs/server.key',
				},
			});
			throw new Error('Expected TLS config resolution to fail.');
		} catch (error: unknown) {
			expect(error).toBeInstanceOf(TlsConfigError);
			expect((error as TlsConfigError).missing_keys).toEqual(['TLS_CERT_PATH']);
		}
	});

	it('throws a controlled config error when TLS file contents cannot be read', () => {
		expect(() =>
			resolveTlsConfig({
				environment: {
					TLS_CERT_PATH: './certs/server.crt',
					TLS_KEY_PATH: './certs/server.key',
				},
				read_file: () => {
					throw new Error('ENOENT');
				},
			}),
		).toThrowError(TlsConfigError);
	});
});
