import { readFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';

import type { ToolCallableSchema, ToolName, ToolRiskLevel, ToolSideEffectLevel } from '@runa/types';

export const PLUGIN_MANIFEST_FILE_NAME = 'runa-plugin.json';
export const RUNA_PLUGIN_DIRS_ENV_KEY = 'RUNA_PLUGIN_DIRS';

interface StringRecord {
	readonly [key: string]: unknown;
}

export interface PluginToolManifest {
	readonly callable_schema?: ToolCallableSchema;
	readonly description: string;
	readonly entry: string;
	readonly name: ToolName;
	readonly requires_approval?: boolean;
	readonly risk_level?: ToolRiskLevel;
	readonly side_effect_level?: ToolSideEffectLevel;
	readonly tags?: readonly string[];
	readonly timeout_ms?: number;
}

export interface PluginManifest {
	readonly plugin_id: string;
	readonly plugin_root: string;
	readonly schema_version: 1;
	readonly tools: readonly PluginToolManifest[];
}

export class PluginManifestError extends Error {
	constructor(
		message: string,
		override readonly cause?: unknown,
	) {
		super(message);
		this.name = 'PluginManifestError';
	}
}

function isStringRecord(value: unknown): value is StringRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTags(value: unknown, fieldName: string): readonly string[] | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
		throw new PluginManifestError(`${fieldName} must be an array of strings.`);
	}

	return value;
}

function parseTimeoutMs(value: unknown, fieldName: string): number | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
		throw new PluginManifestError(`${fieldName} must be a positive number.`);
	}

	return value;
}

function parseCallableSchema(value: unknown, fieldName: string): ToolCallableSchema | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (!isStringRecord(value)) {
		throw new PluginManifestError(`${fieldName} must be an object.`);
	}

	return value as ToolCallableSchema;
}

function parseToolName(value: unknown, fieldName: string): ToolName {
	if (typeof value !== 'string' || value.length === 0) {
		throw new PluginManifestError(`${fieldName} must be a non-empty string.`);
	}

	if (!value.includes('.')) {
		throw new PluginManifestError(`${fieldName} must include a namespace prefix.`);
	}

	return value as ToolName;
}

function parseRiskLevel(value: unknown, fieldName: string): ToolRiskLevel | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (value === 'low' || value === 'medium' || value === 'high') {
		return value;
	}

	throw new PluginManifestError(`${fieldName} must be one of low, medium, or high.`);
}

function parseSideEffectLevel(value: unknown, fieldName: string): ToolSideEffectLevel | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (value === 'none' || value === 'read' || value === 'write' || value === 'execute') {
		return value;
	}

	throw new PluginManifestError(`${fieldName} must be one of none, read, write, or execute.`);
}

function parseToolManifest(value: unknown, index: number, pluginRoot: string): PluginToolManifest {
	if (!isStringRecord(value)) {
		throw new PluginManifestError(`tools[${index}] must be an object.`);
	}

	const typedValue = value as {
		readonly callable_schema?: unknown;
		readonly description?: unknown;
		readonly entry?: unknown;
		readonly name?: unknown;
		readonly requires_approval?: unknown;
		readonly risk_level?: unknown;
		readonly side_effect_level?: unknown;
		readonly tags?: unknown;
		readonly timeout_ms?: unknown;
	};
	const description = typedValue.description;
	const entry = typedValue.entry;
	const requiresApproval = typedValue.requires_approval;

	if (typeof description !== 'string' || description.length === 0) {
		throw new PluginManifestError(`tools[${index}].description must be a non-empty string.`);
	}

	if (typeof entry !== 'string' || entry.length === 0) {
		throw new PluginManifestError(`tools[${index}].entry must be a non-empty string.`);
	}

	if (requiresApproval !== undefined && typeof requiresApproval !== 'boolean') {
		throw new PluginManifestError(`tools[${index}].requires_approval must be a boolean.`);
	}

	return {
		callable_schema: parseCallableSchema(
			typedValue.callable_schema,
			`tools[${index}].callable_schema`,
		),
		description,
		entry: resolve(pluginRoot, entry),
		name: parseToolName(typedValue.name, `tools[${index}].name`),
		requires_approval: requiresApproval,
		risk_level: parseRiskLevel(typedValue.risk_level, `tools[${index}].risk_level`),
		side_effect_level: parseSideEffectLevel(
			typedValue.side_effect_level,
			`tools[${index}].side_effect_level`,
		),
		tags: parseTags(typedValue.tags, `tools[${index}].tags`),
		timeout_ms: parseTimeoutMs(typedValue.timeout_ms, `tools[${index}].timeout_ms`),
	};
}

export function parsePluginManifest(rawValue: string, pluginRoot: string): PluginManifest {
	let parsedValue: unknown;

	try {
		parsedValue = JSON.parse(rawValue);
	} catch (error: unknown) {
		throw new PluginManifestError('Plugin manifest must be valid JSON.', error);
	}

	if (!isStringRecord(parsedValue)) {
		throw new PluginManifestError('Plugin manifest root must be an object.');
	}

	const typedValue = parsedValue as {
		readonly plugin_id?: unknown;
		readonly schema_version?: unknown;
		readonly tools?: unknown;
	};
	const schemaVersion = typedValue.schema_version;
	const pluginId = typedValue.plugin_id;
	const tools = typedValue.tools;

	if (schemaVersion !== 1) {
		throw new PluginManifestError('Plugin manifest schema_version must be 1.');
	}

	if (typeof pluginId !== 'string' || pluginId.length === 0) {
		throw new PluginManifestError('Plugin manifest plugin_id must be a non-empty string.');
	}

	if (!Array.isArray(tools) || tools.length === 0) {
		throw new PluginManifestError('Plugin manifest tools must be a non-empty array.');
	}

	return {
		plugin_id: pluginId,
		plugin_root: pluginRoot,
		schema_version: 1,
		tools: tools.map((tool, index) => parseToolManifest(tool, index, pluginRoot)),
	};
}

export function readPluginManifestSync(pluginRoot: string): PluginManifest {
	const manifestPath = join(pluginRoot, PLUGIN_MANIFEST_FILE_NAME);

	return parsePluginManifest(readFileSync(manifestPath, 'utf8'), pluginRoot);
}

export function readPluginDirsFromEnvironment(
	env: NodeJS.ProcessEnv = process.env,
): readonly string[] {
	const rawValue = env[RUNA_PLUGIN_DIRS_ENV_KEY];

	if (!rawValue) {
		return [];
	}

	return rawValue
		.split(delimiter)
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0)
		.map((entry) => resolve(entry));
}
