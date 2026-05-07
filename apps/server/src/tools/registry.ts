import type { ToolDefinition, ToolName, ToolRegistryEntry, ToolRegistryLike } from '@runa/types';

import { agentDelegateTool } from './agent-delegate.js';
import { browserClickTool } from './browser-click.js';
import { browserExtractTool } from './browser-extract.js';
import { browserFillTool } from './browser-fill.js';
import { browserNavigateTool } from './browser-navigate.js';
import { desktopClickTool } from './desktop-click.js';
import { desktopClipboardReadTool, desktopClipboardWriteTool } from './desktop-clipboard.js';
import { desktopKeypressTool } from './desktop-keypress.js';
import { desktopLaunchTool } from './desktop-launch.js';
import { desktopScreenshotTool } from './desktop-screenshot.js';
import { desktopScrollTool } from './desktop-scroll.js';
import { desktopTypeTool } from './desktop-type.js';
import { desktopVerifyStateTool } from './desktop-verify-state.js';
import { desktopVisionAnalyzeTool } from './desktop-vision-analyze.js';
import { editPatchTool } from './edit-patch.js';
import { fileListTool } from './file-list.js';
import { fileReadTool } from './file-read.js';
import { fileShareTool } from './file-share.js';
import { fileWatchTool } from './file-watch.js';
import { fileWriteTool } from './file-write.js';
import { gitDiffTool } from './git-diff.js';
import { gitStatusTool } from './git-status.js';
import { memoryDeleteTool } from './memory-delete.js';
import { memoryListTool } from './memory-list.js';
import { memorySaveTool } from './memory-save.js';
import { memorySearchTool } from './memory-search.js';
import { searchCodebaseTool } from './search-codebase.js';
import { searchGrepTool } from './search-grep.js';
import { shellExecTool } from './shell-exec.js';
import {
	shellSessionReadTool,
	shellSessionStartTool,
	shellSessionStopTool,
} from './shell-session.js';
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
	agentDelegateTool,
	browserNavigateTool,
	browserExtractTool,
	browserClickTool,
	browserFillTool,
	desktopClickTool,
	desktopClipboardReadTool,
	desktopClipboardWriteTool,
	desktopKeypressTool,
	desktopLaunchTool,
	desktopScrollTool,
	desktopVisionAnalyzeTool,
	desktopVerifyStateTool,
	fileReadTool,
	fileShareTool,
	fileWriteTool,
	fileWatchTool,
	fileListTool,
	memorySaveTool,
	memorySearchTool,
	memoryListTool,
	memoryDeleteTool,
	searchCodebaseTool,
	searchGrepTool,
	webSearchTool,
	shellExecTool,
	shellSessionStartTool,
	shellSessionReadTool,
	shellSessionStopTool,
	gitStatusTool,
	gitDiffTool,
	editPatchTool,
	desktopScreenshotTool,
	desktopTypeTool,
] as const satisfies readonly ToolDefinition[];

export function listBuiltInToolNames(): readonly ToolName[] {
	return builtInTools.map((tool) => tool.name);
}

export function registerBuiltInTools(registry: ToolRegistry): ToolRegistry {
	registry.registerMany(builtInTools);
	return registry;
}

export function createBuiltInToolRegistry(): ToolRegistry {
	return registerBuiltInTools(new ToolRegistry());
}
