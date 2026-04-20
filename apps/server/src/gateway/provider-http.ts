import { GatewayRequestError, GatewayResponseError } from './errors.js';

interface HttpTextResponse {
	readonly ok: boolean;
	readonly status: number;
	text(): Promise<string>;
}

type HttpFetch = (
	input: string,
	init: {
		readonly body: string;
		readonly headers: Record<string, string>;
		readonly method: 'POST';
	},
) => Promise<HttpTextResponse>;

interface PostJsonOptions {
	readonly body: unknown;
	readonly debug_context?: ProviderErrorDebugContext;
	readonly headers: Record<string, string>;
	readonly provider: string;
	readonly url: string;
}

interface ProviderErrorDebugContext {
	readonly compiled_context_chars?: number;
	readonly has_compiled_context?: boolean;
	readonly max_output_tokens?: number;
	readonly message_count?: number;
	readonly message_roles?: readonly string[];
	readonly model?: string;
	readonly tool_count?: number;
	readonly tool_names?: readonly string[];
}

interface ProviderErrorDebugPayload {
	readonly provider: string;
	readonly request_summary?: ProviderErrorDebugContext;
	readonly response_body: string;
	readonly status_code?: number;
}

function getFetchImplementation(): HttpFetch {
	const fetchImplementation = (
		globalThis as typeof globalThis & {
			fetch?: HttpFetch;
		}
	).fetch;

	if (!fetchImplementation) {
		throw new GatewayRequestError('unknown', 'Global fetch is not available in this runtime.');
	}

	return fetchImplementation;
}

export function buildJsonHeaders(headers: Record<string, string>): Record<string, string> {
	return {
		'content-type': 'application/json',
		...headers,
	};
}

function isProviderErrorDebugEnabled(): boolean {
	const environment = process.env as NodeJS.ProcessEnv & {
		readonly RUNA_DEBUG_PROVIDER_ERRORS?: string;
	};

	return environment.RUNA_DEBUG_PROVIDER_ERRORS?.trim() === '1';
}

function logProviderErrorDebug(payload: ProviderErrorDebugPayload): void {
	if (!isProviderErrorDebugEnabled()) {
		return;
	}

	console.error('[provider.error.debug]', payload);
}

export async function postJson(options: PostJsonOptions): Promise<unknown> {
	const fetchImplementation = getFetchImplementation();

	let response: HttpTextResponse;

	try {
		response = await fetchImplementation(options.url, {
			body: JSON.stringify(options.body),
			headers: buildJsonHeaders(options.headers),
			method: 'POST',
		});
	} catch (error: unknown) {
		if (error instanceof Error) {
			throw new GatewayRequestError(
				options.provider,
				`${options.provider} request failed: ${error.message}`,
				error,
			);
		}

		throw new GatewayRequestError(
			options.provider,
			`${options.provider} request failed with an unknown network error.`,
			error,
		);
	}

	const responseText = await response.text();

	if (!response.ok) {
		logProviderErrorDebug({
			provider: options.provider,
			request_summary: options.debug_context,
			response_body: responseText,
			status_code: response.status,
		});

		throw new GatewayResponseError(
			options.provider,
			`${options.provider} returned HTTP ${response.status}.`,
			{
				response_body: responseText,
				status_code: response.status,
			},
		);
	}

	try {
		return JSON.parse(responseText) as unknown;
	} catch (error: unknown) {
		logProviderErrorDebug({
			provider: options.provider,
			request_summary: options.debug_context,
			response_body: responseText,
			status_code: response.status,
		});

		throw new GatewayResponseError(options.provider, `${options.provider} returned invalid JSON.`, {
			cause: error,
			response_body: responseText,
			status_code: response.status,
		});
	}
}
