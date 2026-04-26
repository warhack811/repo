import type {
	McpCallToolRequest,
	McpCallToolResult,
	McpClientInfo,
	McpHttpServerConfig,
	McpProtocolVersion,
	McpServerConfig,
	McpStdioServerConfig,
	McpToolContent,
	McpToolDefinition,
	ToolCallableArrayParameter,
	ToolCallableParameter,
	ToolCallableScalarParameter,
	ToolCallableSchema,
	ToolResultError,
} from '@runa/types';

import { executeMcpHttpSession } from './http-transport.js';
import {
	McpTransportError,
	executeMcpStdioSession,
	executeMcpStdioSessionSync,
} from './stdio-transport.js';

const MCP_PROTOCOL_VERSION: McpProtocolVersion = '2025-03-26';
const MCP_CLIENT_INFO: McpClientInfo = {
	name: 'runa',
	version: '0.1.0',
};

interface JsonRpcResponseShape {
	readonly error?: {
		readonly code?: unknown;
		readonly data?: unknown;
		readonly message?: unknown;
	};
	readonly id?: number | string;
	readonly result?: unknown;
}

interface McpInitializeResult {
	readonly capabilities?: Readonly<Record<string, unknown>>;
	readonly protocolVersion?: string;
	readonly serverInfo?: Readonly<Record<string, unknown>>;
}

interface McpListToolsResult {
	readonly nextCursor?: unknown;
	readonly tools?: readonly unknown[];
}

interface McpCallToolResultShape {
	readonly content?: readonly unknown[];
	readonly isError?: unknown;
	readonly structuredContent?: unknown;
}

export class McpClientError extends Error {
	constructor(
		message: string,
		readonly details: Readonly<Record<string, unknown>> = {},
		override readonly cause?: unknown,
	) {
		super(message);
		this.name = 'McpClientError';
	}
}

function getTransport(config: McpServerConfig): 'http' | 'stdio' {
	return config.transport ?? 'stdio';
}

function assertStdioConfig(config: McpServerConfig): McpStdioServerConfig {
	if (config.transport === 'http') {
		throw new McpClientError(`MCP server ${config.id} does not support synchronous HTTP calls.`, {
			server_id: config.id,
			transport: getTransport(config),
		});
	}

	return config;
}

function assertHttpConfig(config: McpServerConfig): McpHttpServerConfig {
	if (config.transport !== 'http') {
		throw new McpClientError(`MCP server ${config.id} is not configured for HTTP transport.`, {
			server_id: config.id,
			transport: getTransport(config),
		});
	}

	return config;
}

function createInitializeMessages(request: unknown): readonly unknown[] {
	return [
		{
			id: 'runa.initialize',
			jsonrpc: '2.0',
			method: 'initialize',
			params: {
				capabilities: {},
				clientInfo: MCP_CLIENT_INFO,
				protocolVersion: MCP_PROTOCOL_VERSION,
			},
		},
		{
			jsonrpc: '2.0',
			method: 'notifications/initialized',
		},
		request,
	];
}

function findResponseById(
	responses: readonly JsonRpcResponseShape[],
	responseId: number | string,
): JsonRpcResponseShape {
	const response = responses.find((entry) => entry.id === responseId);

	if (!response) {
		throw new McpClientError(`MCP response ${String(responseId)} was not returned by the server.`, {
			response_id: responseId,
		});
	}

	return response;
}

function assertNoJsonRpcError(
	response: JsonRpcResponseShape,
	config: McpServerConfig,
	stderr: string,
): void {
	if (!response.error) {
		return;
	}

	const message =
		typeof response.error.message === 'string'
			? response.error.message
			: `MCP server ${config.id} returned a JSON-RPC error.`;

	throw new McpClientError(message, {
		code: response.error.code,
		data: response.error.data,
		server_id: config.id,
		stderr,
	});
}

function assertInitializeSucceeded(
	responses: readonly JsonRpcResponseShape[],
	config: McpServerConfig,
	stderr: string,
): McpInitializeResult {
	const initializeResponse = findResponseById(responses, 'runa.initialize');

	assertNoJsonRpcError(initializeResponse, config, stderr);

	if (!initializeResponse.result || typeof initializeResponse.result !== 'object') {
		throw new McpClientError(`MCP server ${config.id} returned an invalid initialize response.`, {
			server_id: config.id,
			stderr,
		});
	}

	return initializeResponse.result as McpInitializeResult;
}

function mapScalarParameter(
	value: unknown,
	required: boolean,
): ToolCallableScalarParameter | ToolCallableArrayParameter | undefined {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}

	const rawType = 'type' in value ? value.type : undefined;
	const description =
		'description' in value && typeof value.description === 'string' ? value.description : undefined;

	if (rawType === 'string' || rawType === 'number' || rawType === 'boolean') {
		return {
			description,
			required,
			type: rawType,
		};
	}

	if (rawType === 'array' && 'items' in value && value.items && typeof value.items === 'object') {
		const items = value.items;
		const itemType = 'type' in items ? items.type : undefined;

		if (itemType === 'string' || itemType === 'number' || itemType === 'boolean') {
			return {
				description,
				items: {
					type: itemType,
				},
				required,
				type: 'array',
			};
		}
	}

	return undefined;
}

function toCallableSchema(inputSchema: unknown): ToolCallableSchema | undefined {
	if (!inputSchema || typeof inputSchema !== 'object' || Array.isArray(inputSchema)) {
		return undefined;
	}

	if (!('type' in inputSchema) || inputSchema.type !== 'object') {
		return undefined;
	}

	const properties =
		'properties' in inputSchema &&
		inputSchema.properties &&
		typeof inputSchema.properties === 'object'
			? inputSchema.properties
			: undefined;

	if (!properties) {
		return {
			parameters: {},
		};
	}

	const requiredNames =
		'required' in inputSchema && Array.isArray(inputSchema.required)
			? new Set(inputSchema.required.filter((entry): entry is string => typeof entry === 'string'))
			: new Set<string>();

	const mappedEntries = Object.entries(properties)
		.map(([name, value]) => {
			const mappedParameter = mapScalarParameter(value, requiredNames.has(name));
			return mappedParameter ? ([name, mappedParameter] as const) : undefined;
		})
		.filter((entry): entry is readonly [string, ToolCallableParameter] => entry !== undefined);

	return {
		parameters: Object.fromEntries(mappedEntries),
	};
}

function mapToolDefinition(value: unknown): McpToolDefinition | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}

	const rawName = 'name' in value ? value.name : undefined;
	if (typeof rawName !== 'string' || rawName.length === 0) {
		return undefined;
	}

	const description =
		'description' in value && typeof value.description === 'string' ? value.description : undefined;
	const inputSchema = 'inputSchema' in value ? value.inputSchema : undefined;

	return {
		description,
		input_schema: toCallableSchema(inputSchema),
		name: rawName,
	};
}

function mapTextualContent(value: unknown): McpToolContent | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value) || !('type' in value)) {
		return undefined;
	}

	if (value.type === 'text' && 'text' in value && typeof value.text === 'string') {
		return {
			text: value.text,
			type: 'text',
		};
	}

	if (value.type === 'image' && 'data' in value && typeof value.data === 'string') {
		return {
			data: value.data,
			mime_type:
				'mimeType' in value && typeof value.mimeType === 'string' ? value.mimeType : undefined,
			type: 'image',
		};
	}

	if (
		value.type === 'resource' &&
		'resource' in value &&
		value.resource &&
		typeof value.resource === 'object'
	) {
		return {
			resource: value.resource as Readonly<Record<string, unknown>>,
			type: 'resource',
		};
	}

	return undefined;
}

function summarizeContent(content: readonly McpToolContent[]): string {
	const textParts = content
		.filter((entry): entry is Extract<McpToolContent, { type: 'text' }> => entry.type === 'text')
		.map((entry) => entry.text.trim())
		.filter((entry) => entry.length > 0);

	if (textParts.length > 0) {
		return textParts.join('\n');
	}

	return 'MCP tool execution failed without text content.';
}

function toToolErrorCode(code: unknown): ToolResultError['error_code'] {
	return code === -32602 ? 'INVALID_INPUT' : 'EXECUTION_FAILED';
}

function mapCallToolResult(
	result: unknown,
	config: McpServerConfig,
	toolName: string,
): McpCallToolResult {
	if (!result || typeof result !== 'object') {
		throw new McpClientError(`MCP server ${config.id} returned an invalid tools/call result.`, {
			server_id: config.id,
			tool_name: toolName,
		});
	}

	const typedResult = result as McpCallToolResultShape;
	const content = Array.isArray(typedResult.content)
		? typedResult.content
				.map((entry) => mapTextualContent(entry))
				.filter((entry): entry is McpToolContent => entry !== undefined)
		: [];
	const structuredContent =
		typedResult.structuredContent && typeof typedResult.structuredContent === 'object'
			? (typedResult.structuredContent as Readonly<Record<string, unknown>>)
			: undefined;

	if (typedResult.isError === true) {
		return {
			content,
			error_code: 'EXECUTION_FAILED',
			error_message: summarizeContent(content),
			is_error: true,
			structured_content: structuredContent,
		};
	}

	return {
		content,
		is_error: false,
		structured_content: structuredContent,
	};
}

function mapToolListResult(result: unknown, config: McpServerConfig): readonly McpToolDefinition[] {
	if (!result || typeof result !== 'object') {
		throw new McpClientError(`MCP server ${config.id} returned an invalid tools/list result.`, {
			server_id: config.id,
		});
	}

	const typedResult = result as McpListToolsResult;
	if (!Array.isArray(typedResult.tools)) {
		throw new McpClientError(`MCP server ${config.id} returned tools/list without a tools array.`, {
			server_id: config.id,
		});
	}

	return typedResult.tools
		.map((entry) => mapToolDefinition(entry))
		.filter((entry): entry is McpToolDefinition => entry !== undefined)
		.sort((left, right) => left.name.localeCompare(right.name));
}

export class McpClient {
	constructor(readonly config: McpServerConfig) {}

	listToolsSync(): readonly McpToolDefinition[] {
		const stdioConfig = assertStdioConfig(this.config);
		const sessionResult = executeMcpStdioSessionSync(
			stdioConfig,
			createInitializeMessages({
				id: 'runa.tools.list',
				jsonrpc: '2.0',
				method: 'tools/list',
				params: {},
			}),
		);

		assertInitializeSucceeded(sessionResult.responses, stdioConfig, sessionResult.stderr);
		const listResponse = findResponseById(sessionResult.responses, 'runa.tools.list');
		assertNoJsonRpcError(listResponse, stdioConfig, sessionResult.stderr);
		return mapToolListResult(listResponse.result, stdioConfig);
	}

	async listTools(
		options: Readonly<{ signal?: AbortSignal }> = {},
	): Promise<readonly McpToolDefinition[]> {
		if (getTransport(this.config) === 'stdio') {
			const sessionResult = await executeMcpStdioSession(
				assertStdioConfig(this.config),
				createInitializeMessages({
					id: 'runa.tools.list',
					jsonrpc: '2.0',
					method: 'tools/list',
					params: {},
				}),
			);

			assertInitializeSucceeded(sessionResult.responses, this.config, sessionResult.stderr);
			const listResponse = findResponseById(sessionResult.responses, 'runa.tools.list');
			assertNoJsonRpcError(listResponse, this.config, sessionResult.stderr);
			return mapToolListResult(listResponse.result, this.config);
		}

		const sessionResult = await executeMcpHttpSession(
			assertHttpConfig(this.config),
			createInitializeMessages({
				id: 'runa.tools.list',
				jsonrpc: '2.0',
				method: 'tools/list',
				params: {},
			}),
			options,
		);

		assertInitializeSucceeded(sessionResult.responses, this.config, sessionResult.stderr);
		const listResponse = findResponseById(sessionResult.responses, 'runa.tools.list');
		assertNoJsonRpcError(listResponse, this.config, sessionResult.stderr);
		return mapToolListResult(listResponse.result, this.config);
	}

	async callTool(request: McpCallToolRequest): Promise<McpCallToolResult> {
		const callMessage = {
			id: 'runa.tools.call',
			jsonrpc: '2.0',
			method: 'tools/call',
			params: {
				arguments: request.arguments,
				name: request.name,
			},
		};
		const sessionResult =
			getTransport(this.config) === 'http'
				? await executeMcpHttpSession(
						assertHttpConfig(this.config),
						createInitializeMessages(callMessage),
					)
				: await executeMcpStdioSession(
						assertStdioConfig(this.config),
						createInitializeMessages(callMessage),
					);

		assertInitializeSucceeded(sessionResult.responses, this.config, sessionResult.stderr);
		const callResponse = findResponseById(sessionResult.responses, 'runa.tools.call');
		assertNoJsonRpcError(callResponse, this.config, sessionResult.stderr);
		return mapCallToolResult(callResponse.result, this.config, request.name);
	}
}

export { MCP_CLIENT_INFO, MCP_PROTOCOL_VERSION, McpTransportError };
