import { uiText } from '@/lib/i18n/strings';

export type TransportErrorCode =
	| 'network-cut'
	| 'rate-limit'
	| 'server-error'
	| 'timeout'
	| 'unknown'
	| 'ws-disconnect';

export type TransportError = Readonly<{
	code: TransportErrorCode;
	label: string;
	retryable: boolean;
}>;

export type TransportErrorState = Readonly<{
	kind: TransportErrorCode;
	label: string;
	retryable: boolean;
}>;

const transportErrorCatalog: Readonly<Record<TransportErrorCode, TransportError>> = {
	'network-cut': {
		code: 'network-cut',
		label: uiText.transport.connectionLost,
		retryable: true,
	},
	'rate-limit': {
		code: 'rate-limit',
		label: uiText.transport.rateLimit,
		retryable: true,
	},
	'server-error': {
		code: 'server-error',
		label: uiText.transport.serverError,
		retryable: true,
	},
	timeout: {
		code: 'timeout',
		label: uiText.transport.timeout,
		retryable: true,
	},
	unknown: {
		code: 'unknown',
		label: uiText.transport.unknown,
		retryable: true,
	},
	'ws-disconnect': {
		code: 'ws-disconnect',
		label: uiText.transport.wsDisconnected,
		retryable: true,
	},
};

export function getTransportError(code: TransportErrorCode): TransportError {
	return transportErrorCatalog[code];
}

export function classifyTransportError(error: Error): TransportErrorState {
	const message = error.message.toLowerCase();

	if (message.includes('429') || message.includes('rate')) {
		const state = getTransportError('rate-limit');
		return { ...state, kind: state.code };
	}

	if (message.includes('timeout') || message.includes('timed out')) {
		const state = getTransportError('timeout');
		return { ...state, kind: state.code };
	}

	if (
		message.includes('websocket') ||
		message.includes('socket') ||
		message.includes('connection closed')
	) {
		const state = getTransportError('ws-disconnect');
		return { ...state, kind: state.code };
	}

	if (message.includes('500') || message.includes('server')) {
		const state = getTransportError('server-error');
		return { ...state, kind: state.code };
	}

	if (message.includes('network') || message.includes('fetch') || message.includes('terminated')) {
		const state = getTransportError('network-cut');
		return { ...state, kind: state.code };
	}

	const state = getTransportError('unknown');
	return { ...state, kind: state.code };
}
