import type { TransportErrorCode } from '@runa/types';

export type { TransportErrorCode } from '@runa/types';

export type BackendTransportErrorReason =
	| 'network_lost'
	| 'provider_unavailable'
	| 'rate_limit'
	| 'server_error'
	| 'timeout'
	| 'unknown'
	| 'unreliable_sources'
	| 'ws_disconnect';

export const transportErrorCatalogCodes = [
	'network-cut',
	'rate-limit',
	'server-error',
	'timeout',
	'unknown',
	'ws-disconnect',
] as const satisfies readonly TransportErrorCode[];

const reasonToCatalogCode: Readonly<Record<BackendTransportErrorReason, TransportErrorCode>> = {
	network_lost: 'network-cut',
	provider_unavailable: 'network-cut',
	rate_limit: 'rate-limit',
	server_error: 'server-error',
	timeout: 'timeout',
	unknown: 'unknown',
	unreliable_sources: 'server-error',
	ws_disconnect: 'ws-disconnect',
};

export class TransportMappedError extends Error {
	readonly retryable: boolean;
	readonly transport_error_code: TransportErrorCode;

	constructor(
		message: string,
		options: Readonly<{
			readonly cause?: unknown;
			readonly retryable: boolean;
			readonly transport_error_code: TransportErrorCode;
		}>,
	) {
		super(message);
		this.name = 'TransportMappedError';
		this.cause = options.cause;
		this.retryable = options.retryable;
		this.transport_error_code = options.transport_error_code;
	}
}

export function mapTransportErrorReason(reason: BackendTransportErrorReason): TransportErrorCode {
	return reasonToCatalogCode[reason];
}

export function getTransportErrorCode(error: unknown): TransportErrorCode | undefined {
	if (
		error instanceof Error &&
		'transport_error_code' in error &&
		typeof error.transport_error_code === 'string' &&
		transportErrorCatalogCodes.includes(error.transport_error_code as TransportErrorCode)
	) {
		return error.transport_error_code as TransportErrorCode;
	}

	return undefined;
}

export function createTransportMappedError(
	message: string,
	input: Readonly<{
		readonly cause?: unknown;
		readonly reason: BackendTransportErrorReason;
		readonly retryable?: boolean;
	}>,
): TransportMappedError {
	return new TransportMappedError(message, {
		cause: input.cause,
		retryable: input.retryable ?? true,
		transport_error_code: mapTransportErrorReason(input.reason),
	});
}
