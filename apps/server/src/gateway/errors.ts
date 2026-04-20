export class GatewayConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'GatewayConfigurationError';
	}
}

export class GatewayRequestError extends Error {
	override readonly cause?: unknown;
	readonly provider: string;

	constructor(provider: string, message: string, cause?: unknown) {
		super(message);
		this.name = 'GatewayRequestError';
		this.cause = cause;
		this.provider = provider;
	}
}

export class GatewayResponseError extends Error {
	readonly details?: unknown;
	readonly provider: string;

	constructor(provider: string, message: string, details?: unknown) {
		super(message);
		this.details = details;
		this.name = 'GatewayResponseError';
		this.provider = provider;
	}
}

export class GatewayUnsupportedOperationError extends Error {
	readonly operation: 'generate' | 'stream';
	readonly provider: string;

	constructor(provider: string, operation: 'generate' | 'stream', message: string) {
		super(message);
		this.name = 'GatewayUnsupportedOperationError';
		this.provider = provider;
		this.operation = operation;
	}
}
