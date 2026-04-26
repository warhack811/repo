import type { McpServerConfig, ToolCallInput, ToolDefinition, ToolResult } from '@runa/types';

import { McpClient } from './client.js';

export class McpToolBridgeError extends Error {
	constructor(
		message: string,
		override readonly cause?: unknown,
	) {
		super(message);
		this.name = 'McpToolBridgeError';
	}
}

function sanitizeNameSegment(value: string): string {
	return value.replace(/[^a-zA-Z0-9._-]/gu, '_');
}

function createNamespacedToolName(serverId: string, toolName: string): `mcp.${string}` {
	return `mcp.${sanitizeNameSegment(serverId)}.${sanitizeNameSegment(toolName)}`;
}

function mapMcpToolDefinitions(
	config: McpServerConfig,
	client: McpClient,
	discoveredTools: ReturnType<McpClient['listToolsSync']>,
): readonly ToolDefinition[] {
	return discoveredTools
		.filter((tool) => tool.input_schema !== undefined)
		.map((tool) => {
			const bridgedName = createNamespacedToolName(config.id, tool.name);

			return {
				callable_schema: tool.input_schema,
				description: tool.description
					? `[MCP:${config.id}] ${tool.description}`
					: `[MCP:${config.id}] ${tool.name}`,
				async execute(input, context): Promise<ToolResult> {
					const result = await client.callTool({
						arguments: input.arguments,
						name: tool.name,
					});

					if (result.is_error) {
						return {
							call_id: input.call_id,
							details: {
								content: result.content,
								mcp_server_id: config.id,
								mcp_tool_name: tool.name,
								structured_content: result.structured_content,
							},
							error_code: result.error_code,
							error_message: result.error_message,
							retryable: false,
							status: 'error',
							tool_name: bridgedName,
						};
					}

					return {
						call_id: input.call_id,
						metadata: {
							mcp_server_id: config.id,
							mcp_tool_name: tool.name,
							trace_id: context.trace_id,
						},
						output: {
							content: result.content,
							structured_content: result.structured_content,
						},
						status: 'success',
						tool_name: bridgedName,
					};
				},
				metadata: {
					capability_class: 'external',
					requires_approval: true,
					risk_level: 'high',
					side_effect_level: 'execute',
					tags: ['external', 'mcp', config.id, tool.name],
				},
				name: bridgedName,
			} satisfies ToolDefinition<ToolCallInput<`mcp.${string}`>>;
		});
}

export function discoverMcpToolsSync(
	serverConfigs: readonly McpServerConfig[],
): readonly ToolDefinition[] {
	return serverConfigs.flatMap((config) => {
		const client = new McpClient(config);
		const discoveredTools = client.listToolsSync();

		return mapMcpToolDefinitions(config, client, discoveredTools);
	});
}

export async function discoverMcpTools(
	serverConfigs: readonly McpServerConfig[],
): Promise<readonly ToolDefinition[]> {
	const toolGroups = await Promise.all(
		serverConfigs.map(async (config) => {
			const client = new McpClient(config);
			const discoveredTools = await client.listTools();

			return mapMcpToolDefinitions(config, client, discoveredTools);
		}),
	);

	return toolGroups.flat();
}
