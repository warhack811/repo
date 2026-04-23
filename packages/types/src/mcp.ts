import type { ToolArguments, ToolCallableSchema, ToolResultError } from './tools.js';

export type McpProtocolVersion = '2025-03-26';

export interface McpClientInfo {
	readonly name: string;
	readonly version: string;
}

export interface McpServerConfig {
	readonly args?: readonly string[];
	readonly command: string;
	readonly cwd?: string;
	readonly env?: Readonly<Record<string, string>>;
	readonly id: string;
	readonly timeout_ms?: number;
}

export interface McpToolDefinition {
	readonly description?: string;
	readonly input_schema?: ToolCallableSchema;
	readonly name: string;
}

export interface McpTextContent {
	readonly text: string;
	readonly type: 'text';
}

export interface McpImageContent {
	readonly data: string;
	readonly mime_type?: string;
	readonly type: 'image';
}

export interface McpEmbeddedResourceContent {
	readonly resource: Readonly<Record<string, unknown>>;
	readonly type: 'resource';
}

export type McpToolContent = McpEmbeddedResourceContent | McpImageContent | McpTextContent;

export interface McpCallToolSuccess {
	readonly content: readonly McpToolContent[];
	readonly is_error: false;
	readonly structured_content?: Readonly<Record<string, unknown>>;
}

export interface McpCallToolFailure {
	readonly content: readonly McpToolContent[];
	readonly error_code: ToolResultError['error_code'];
	readonly error_message: string;
	readonly is_error: true;
	readonly structured_content?: Readonly<Record<string, unknown>>;
}

export type McpCallToolResult = McpCallToolFailure | McpCallToolSuccess;

export interface McpCallToolRequest {
	readonly arguments: ToolArguments;
	readonly name: string;
}
