import type {
	ModelCallableTool,
	ModelCallableToolArrayParameter,
	ModelCallableToolParameter,
	ModelCallableToolScalarParameter,
} from '@runa/types';

interface JsonSchemaScalarProperty {
	readonly description?: string;
	readonly type: ModelCallableToolScalarParameter['type'];
}

interface JsonSchemaArrayProperty {
	readonly description?: string;
	readonly items: {
		readonly type: ModelCallableToolArrayParameter['items']['type'];
	};
	readonly type: 'array';
}

export type ToolJsonSchemaProperty = JsonSchemaArrayProperty | JsonSchemaScalarProperty;

export interface ToolJsonSchemaObject {
	readonly properties: Readonly<Record<string, ToolJsonSchemaProperty>>;
	readonly required?: readonly string[];
	readonly type: 'object';
}

export interface ToolSchemaSerializationOptions {
	readonly include_parameter_descriptions?: boolean;
}

export interface SerializedCallableTool {
	readonly description?: string;
	readonly name: string;
	readonly parameters: ToolJsonSchemaObject;
}

export interface CallableToolSerializationOptions extends ToolSchemaSerializationOptions {
	readonly include_tool_description?: boolean;
}

const TOOL_RELEVANCE_HINTS = {
	'desktop.screenshot': ['desktop', 'ekran', 'screen', 'screenshot'],
	'edit.patch': ['diff', 'patch', 'duzelt', 'edit', 'fix', 'guncelle', 'update'],
	'file.list': [
		'bul',
		'dir',
		'directory',
		'dosya',
		'entries',
		'file',
		'files',
		'klasor',
		'list',
		'liste',
		'listele',
	],
	'file.read': ['content', 'icerik', 'oku', 'read', 'readme'],
	'file.write': ['kaydet', 'write', 'yaz'],
	'git.diff': ['degisiklik', 'diff', 'patch'],
	'git.status': ['git', 'status'],
	'search.codebase': ['ara', 'codebase', 'pattern', 'search'],
	'search.grep': ['ara', 'grep', 'pattern', 'search'],
	'shell.exec': ['cmd', 'command', 'komut', 'run', 'shell'],
	'web.search': ['internet', 'search', 'web'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

function sortStrings(values: readonly string[]): readonly string[] {
	return [...values].sort((left, right) => left.localeCompare(right));
}

function tokenizePrompt(text: string): readonly string[] {
	return Array.from(
		new Set(
			text
				.toLocaleLowerCase()
				.split(/[^\p{L}\p{N}._-]+/u)
				.map((token) => token.trim())
				.filter((token) => token.length > 0),
		),
	);
}

function scoreToolForPrompt(tool: ModelCallableTool, prompt: string): number {
	const normalizedPrompt = prompt.toLocaleLowerCase();
	const promptTokens = tokenizePrompt(prompt);
	const promptTokenSet = new Set(promptTokens);
	let score = 0;

	if (normalizedPrompt.includes(tool.name.toLocaleLowerCase())) {
		score += 100;
	}

	const hintTokens = TOOL_RELEVANCE_HINTS[tool.name as keyof typeof TOOL_RELEVANCE_HINTS] ?? [];

	for (const hintToken of hintTokens) {
		if (promptTokenSet.has(hintToken)) {
			score += 20;
		}
	}

	if (
		tool.name === 'file.list' &&
		(promptTokenSet.has('package.json') ||
			(promptTokenSet.has('package') && promptTokenSet.has('json')))
	) {
		score += 30;
	}

	if (
		tool.name === 'file.read' &&
		(promptTokenSet.has('readme.md') ||
			promptTokenSet.has('readme') ||
			(promptTokenSet.has('read') && promptTokenSet.has('readme')))
	) {
		score += 30;
	}

	return score;
}

function toJsonSchemaProperty(
	parameter: ModelCallableToolParameter,
	options: ToolSchemaSerializationOptions,
): ToolJsonSchemaProperty {
	if (parameter.type === 'array') {
		return {
			description:
				options.include_parameter_descriptions === false ? undefined : parameter.description,
			items: {
				type: parameter.items.type,
			},
			type: 'array',
		};
	}

	return {
		description:
			options.include_parameter_descriptions === false ? undefined : parameter.description,
		type: parameter.type,
	};
}

export function buildToolJsonSchema(
	tool: ModelCallableTool,
	options: ToolSchemaSerializationOptions = {},
): ToolJsonSchemaObject {
	const parameters = tool.parameters ?? {};
	const properties = Object.fromEntries(
		sortStrings(Object.keys(parameters)).map((name) => [
			name,
			toJsonSchemaProperty(parameters[name] as ModelCallableToolParameter, options),
		]),
	);
	const required = sortStrings(
		Object.entries(parameters)
			.filter(([, parameter]) => parameter.required === true)
			.map(([name]) => name),
	);

	return {
		properties,
		required: required.length > 0 ? required : undefined,
		type: 'object',
	};
}

export function serializeCallableTool(
	tool: ModelCallableTool,
	options: CallableToolSerializationOptions = {},
): SerializedCallableTool {
	return {
		description: options.include_tool_description === false ? undefined : tool.description,
		name: tool.name,
		parameters: buildToolJsonSchema(tool, options),
	};
}

export function prioritizeToolsForPrompt(
	tools: readonly ModelCallableTool[],
	prompt?: string,
): readonly ModelCallableTool[] {
	if (!prompt || prompt.trim().length === 0 || tools.length < 2) {
		return tools;
	}

	return [...tools].sort((left, right) => {
		const scoreDelta = scoreToolForPrompt(right, prompt) - scoreToolForPrompt(left, prompt);

		if (scoreDelta !== 0) {
			return scoreDelta;
		}

		return left.name.localeCompare(right.name);
	});
}
