import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const requiredTlsEnvironmentKeys = ['TLS_KEY_PATH', 'TLS_CERT_PATH'] as const;
const optionalTlsEnvironmentKeys = ['TLS_CA_PATH'] as const;

type RequiredTlsEnvironmentKey = (typeof requiredTlsEnvironmentKeys)[number];
type OptionalTlsEnvironmentKey = (typeof optionalTlsEnvironmentKeys)[number];
type TlsEnvironmentKey = RequiredTlsEnvironmentKey | OptionalTlsEnvironmentKey;

export interface TlsEnvironment {
	readonly TLS_CA_PATH?: string;
	readonly TLS_CERT_PATH?: string;
	readonly TLS_KEY_PATH?: string;
}

export type TlsFileReader = (file_path: string) => string;

export interface ResolvedTlsConfig {
	readonly ca?: string;
	readonly ca_path?: string;
	readonly cert: string;
	readonly cert_path: string;
	readonly key: string;
	readonly key_path: string;
}

export interface ServerTransportFastifyOptions {
	readonly https?: {
		readonly ca?: string;
		readonly cert: string;
		readonly key: string;
	};
}

export interface PlainServerTransportConfig {
	readonly fastify_server_options: ServerTransportFastifyOptions;
	readonly http_protocol: 'http';
	readonly mode: 'plain';
	readonly ws_protocol: 'ws';
}

export interface TlsServerTransportConfig {
	readonly fastify_server_options: ServerTransportFastifyOptions;
	readonly http_protocol: 'https';
	readonly mode: 'tls';
	readonly tls: ResolvedTlsConfig;
	readonly ws_protocol: 'wss';
}

export type ServerTransportConfig = PlainServerTransportConfig | TlsServerTransportConfig;

export interface ResolveTlsConfigInput {
	readonly cwd?: string;
	readonly environment: TlsEnvironment;
	readonly read_file?: TlsFileReader;
}

export class TlsConfigError extends Error {
	readonly code = 'TLS_CONFIG_ERROR';
	readonly file_path?: string;
	readonly missing_keys: readonly TlsEnvironmentKey[];

	constructor(
		message: string,
		options: Readonly<{
			readonly file_path?: string;
			readonly missing_keys?: readonly TlsEnvironmentKey[];
		}> = {},
	) {
		super(message);
		this.name = 'TlsConfigError';
		this.file_path = options.file_path;
		this.missing_keys = options.missing_keys ?? [];
	}
}

function normalizeEnvironmentValue(value: string | undefined): string | undefined {
	if (value === undefined) {
		return undefined;
	}

	const normalizedValue = value.trim();

	return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function hasAnyTlsEnvironmentInput(environment: TlsEnvironment): boolean {
	return [...requiredTlsEnvironmentKeys, ...optionalTlsEnvironmentKeys].some(
		(key) => environment[key] !== undefined,
	);
}

function resolveTlsFilePath(filePath: string, cwd: string): string {
	return resolve(cwd, filePath);
}

function defaultReadTlsFile(filePath: string): string {
	return readFileSync(filePath, 'utf8');
}

function readTlsFile(
	filePath: string,
	label: 'certificate' | 'private key' | 'certificate authority bundle',
	readFile: TlsFileReader,
): string {
	try {
		const contents = readFile(filePath);

		if (contents.trim().length === 0) {
			throw new TlsConfigError(`TLS ${label} file "${filePath}" is empty.`, {
				file_path: filePath,
			});
		}

		return contents;
	} catch (error: unknown) {
		if (error instanceof TlsConfigError) {
			throw error;
		}

		throw new TlsConfigError(`Failed to read TLS ${label} file "${filePath}".`, {
			file_path: filePath,
		});
	}
}

export function resolveTlsConfig(input: ResolveTlsConfigInput): ResolvedTlsConfig | undefined {
	const { environment } = input;

	if (!hasAnyTlsEnvironmentInput(environment)) {
		return undefined;
	}

	const missingKeys = requiredTlsEnvironmentKeys.filter(
		(key) => normalizeEnvironmentValue(environment[key]) === undefined,
	);

	if (missingKeys.length > 0) {
		throw new TlsConfigError(
			'Incomplete TLS configuration. Provide TLS_KEY_PATH and TLS_CERT_PATH together or omit all TLS env settings for plain HTTP/WS mode.',
			{
				missing_keys: missingKeys,
			},
		);
	}

	const cwd = input.cwd ?? process.cwd();
	const readFile = input.read_file ?? defaultReadTlsFile;
	const keyPathValue = normalizeEnvironmentValue(environment.TLS_KEY_PATH);
	const certPathValue = normalizeEnvironmentValue(environment.TLS_CERT_PATH);

	if (keyPathValue === undefined || certPathValue === undefined) {
		throw new TlsConfigError(
			'Incomplete TLS configuration. Provide TLS_KEY_PATH and TLS_CERT_PATH together or omit all TLS env settings for plain HTTP/WS mode.',
			{
				missing_keys: requiredTlsEnvironmentKeys.filter(
					(key) => normalizeEnvironmentValue(environment[key]) === undefined,
				),
			},
		);
	}

	const keyPath = resolveTlsFilePath(keyPathValue, cwd);
	const certPath = resolveTlsFilePath(certPathValue, cwd);
	const caPathValue = normalizeEnvironmentValue(environment.TLS_CA_PATH);
	const caPath = caPathValue ? resolveTlsFilePath(caPathValue, cwd) : undefined;
	const key = readTlsFile(keyPath, 'private key', readFile);
	const cert = readTlsFile(certPath, 'certificate', readFile);
	const ca =
		caPath === undefined
			? undefined
			: readTlsFile(caPath, 'certificate authority bundle', readFile);

	return {
		ca,
		ca_path: caPath,
		cert,
		cert_path: certPath,
		key,
		key_path: keyPath,
	};
}

export function createServerTransportConfig(input: ResolveTlsConfigInput): ServerTransportConfig {
	const tlsConfig = resolveTlsConfig(input);

	if (tlsConfig === undefined) {
		return {
			fastify_server_options: {},
			http_protocol: 'http',
			mode: 'plain',
			ws_protocol: 'ws',
		};
	}

	return {
		fastify_server_options: {
			https: {
				ca: tlsConfig.ca,
				cert: tlsConfig.cert,
				key: tlsConfig.key,
			},
		},
		http_protocol: 'https',
		mode: 'tls',
		tls: tlsConfig,
		ws_protocol: 'wss',
	};
}
