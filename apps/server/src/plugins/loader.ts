import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { ToolDefinition, ToolName } from '@runa/types';

import { listBuiltInToolNames } from '../tools/registry.js';
import {
	PLUGIN_MANIFEST_FILE_NAME,
	type PluginManifest,
	readPluginManifestSync,
} from './manifest.js';
import { createPluginToolDefinition } from './tool-bridge.js';

export class PluginConflictError extends Error {
	readonly tool_name: ToolName;

	constructor(toolName: ToolName) {
		super(`Plugin tool cannot override an existing tool: ${toolName}`);
		this.name = 'PluginConflictError';
		this.tool_name = toolName;
	}
}

function listCandidatePluginRoots(pluginDir: string): readonly string[] {
	const resolvedDir = resolve(pluginDir);
	const directManifestPath = join(resolvedDir, PLUGIN_MANIFEST_FILE_NAME);

	if (existsSync(directManifestPath)) {
		return [resolvedDir];
	}

	if (!existsSync(resolvedDir) || !statSync(resolvedDir).isDirectory()) {
		return [];
	}

	return readdirSync(resolvedDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => join(resolvedDir, entry.name))
		.filter((entryPath) => existsSync(join(entryPath, PLUGIN_MANIFEST_FILE_NAME)));
}

function buildReservedToolNameSet(additionalReservedNames: readonly ToolName[]): Set<ToolName> {
	return new Set<ToolName>([...listBuiltInToolNames(), ...additionalReservedNames]);
}

function assertNoReservedToolNames(
	manifest: PluginManifest,
	reservedNames: ReadonlySet<ToolName>,
): void {
	for (const tool of manifest.tools) {
		if (reservedNames.has(tool.name)) {
			throw new PluginConflictError(tool.name);
		}
	}
}

export function discoverPluginToolsSync(
	pluginDirs: readonly string[],
	options: Readonly<{
		readonly reserved_tool_names?: readonly ToolName[];
	}> = {},
): readonly ToolDefinition[] {
	const manifests = pluginDirs.flatMap((pluginDir) =>
		listCandidatePluginRoots(pluginDir).map((pluginRoot) => readPluginManifestSync(pluginRoot)),
	);
	const reservedNames = buildReservedToolNameSet(options.reserved_tool_names ?? []);
	const discoveredTools: ToolDefinition[] = [];

	for (const manifest of manifests) {
		assertNoReservedToolNames(manifest, reservedNames);

		for (const tool of manifest.tools) {
			reservedNames.add(tool.name);
			discoveredTools.push(createPluginToolDefinition(manifest, tool));
		}
	}

	return discoveredTools;
}
