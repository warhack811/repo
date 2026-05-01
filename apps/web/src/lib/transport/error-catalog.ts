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

export function getTransportErrorState(code: TransportErrorCode): TransportErrorState {
	const state = getTransportError(code);
	return { ...state, kind: state.code };
}

export function createTransportError(code: TransportErrorCode): Error {
	return new Error(getTransportError(code).label);
}

export type WebSocketCloseSnapshot = Readonly<{
	code: number;
	reason: string;
	wasClean: boolean;
}>;

function isBrowserOffline(): boolean {
	return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function classifyWebSocketClose(
	closeEvent: WebSocketCloseSnapshot,
): TransportErrorCode | null {
	if (closeEvent.wasClean || closeEvent.code === 1000 || closeEvent.code === 1001) {
		return null;
	}

	if (isBrowserOffline()) {
		return 'network-cut';
	}

	const reason = closeEvent.reason.toLowerCase();

	if (reason.includes('timeout') || reason.includes('timed out')) {
		return 'timeout';
	}

	if (closeEvent.code === 1011 || closeEvent.code >= 4000) {
		return 'server-error';
	}

	return 'ws-disconnect';
}

export function classifyTransportError(error: Error): TransportErrorState {
	const message = error.message.toLowerCase();

	if (message.includes('429') || message.includes('rate')) {
		return getTransportErrorState('rate-limit');
	}

	if (message.includes('timeout') || message.includes('timed out')) {
		return getTransportErrorState('timeout');
	}

	if (
		message.includes('websocket') ||
		message.includes('socket') ||
		message.includes('connection closed')
	) {
		return getTransportErrorState('ws-disconnect');
	}

	if (message.includes('500') || message.includes('server')) {
		return getTransportErrorState('server-error');
	}

	if (message.includes('network') || message.includes('fetch') || message.includes('terminated')) {
		return getTransportErrorState('network-cut');
	}

	return getTransportErrorState('unknown');
}
