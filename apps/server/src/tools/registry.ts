import type { ToolDefinition, ToolName, ToolRegistryEntry, ToolRegistryLike } from '@runa/types';

import { desktopScreenshotTool } from './desktop-screenshot.js';
import { editPatchTool } from './edit-patch.js';
import { fileListTool } from './file-list.js';
import { fileReadTool } from './file-read.js';
import { fileWriteTool } from './file-write.js';
import { gitDiffTool } from './git-diff.js';
import { gitStatusTool } from './git-status.js';
import { searchCodebaseTool } from './search-codebase.js';
import { searchGrepTool } from './search-grep.js';
import { shellExecTool } from './shell-exec.js';
import { webSearchTool } from './web-search.js';

export class ToolAlreadyRegisteredError extends Error {
	readonly tool_name: ToolName;

	constructor(toolName: ToolName) {
		super(`Tool already registered: ${toolName}`);
		this.name = 'ToolAlreadyRegisteredError';
		this.tool_name = toolName;
	}
}

export class ToolNotFoundError extends Error {
	readonly tool_name: ToolName;

	constructor(toolName: ToolName) {
		super(`Tool not found: ${toolName}`);
		this.name = 'ToolNotFoundError';
		this.tool_name = toolName;
	}
}

export class ToolRegistry implements ToolRegistryLike {
	#tools = new Map<ToolName, ToolDefinition>();

	register<TTool extends ToolDefinition>(tool: TTool): void {
		if (this.#tools.has(tool.name)) {
			throw new ToolAlreadyRegisteredError(tool.name);
		}

		this.#tools.set(tool.name, tool);
	}

	registerMany(tools: readonly ToolDefinition[]): void {
		for (const tool of tools) {
			this.register(tool);
		}
	}

	get(name: ToolName): ToolDefinition | undefined {
		return this.#tools.get(name);
	}

	getOrThrow(name: ToolName): ToolDefinition {
		const tool = this.get(name);

		if (!tool) {
			throw new ToolNotFoundError(name);
		}

		return tool;
	}

	has(name: ToolName): boolean {
		return this.#tools.has(name);
	}

	list(): readonly ToolRegistryEntry[] {
		return Array.from(this.#tools.values(), (tool) => ({
			description: tool.description,
			metadata: tool.metadata,
			name: tool.name,
			tool,
		}));
	}

	listNames(): readonly ToolName[] {
		return Array.from(this.#tools.keys());
	}
}

export const builtInTools = [
	fileReadTool,
	fileWriteTool,
	fileListTool,
	searchCodebaseTool,
	searchGrepTool,
	webSearchTool,
	shellExecTool,
	gitStatusTool,
	gitDiffTool,
	editPatchTool,
	desktopScreenshotTool,
] as const satisfies readonly ToolDefinition[];

export function registerBuiltInTools(registry: ToolRegistry): ToolRegistry {
	registry.registerMany(builtInTools);
	return registry;
}

export function createBuiltInToolRegistry(): ToolRegistry {
	return registerBuiltInTools(new ToolRegistry());
}
