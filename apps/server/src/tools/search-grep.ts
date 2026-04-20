import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

import type {
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
} from '@runa/types';

export type SearchGrepArguments = ToolArguments & {
	readonly case_sensitive?: boolean;
	readonly include_hidden?: boolean;
	readonly max_results?: number;
	readonly path: string;
	readonly query: string;
};

export interface SearchGrepMatch {
	readonly column_end: number;
	readonly column_start: number;
	readonly line_number: number;
	readonly line_text: string;
	readonly path: string;
}

export interface SearchGrepSuccessData {
	readonly matches: readonly SearchGrepMatch[];
	readonly path: string;
	readonly query: string;
}

export type SearchGrepInput = ToolCallInput<'search.grep', SearchGrepArguments>;

export type SearchGrepSuccessResult = ToolResultSuccess<'search.grep', SearchGrepSuccessData>;

export type SearchGrepErrorResult = ToolResultError<'search.grep'>;

export type SearchGrepResult = ToolResult<'search.grep', SearchGrepSuccessData>;

interface DirectoryEntry {
	readonly isDirectory: () => boolean;
	readonly isFile: () => boolean;
	readonly name: string;
}

interface SearchGrepDependencies {
	readonly readdir: typeof readdir;
	readonly readFile: typeof readFile;
	readonly stat: typeof stat;
}

function resolveSearchPath(input: SearchGrepInput, context: ToolExecutionContext): string {
	const basePath = context.working_directory ?? process.cwd();

	return resolve(basePath, input.arguments.path);
}

function createErrorResult(
	input: SearchGrepInput,
	error_code: SearchGrepErrorResult['error_code'],
	error_message: string,
	path: string,
	details?: SearchGrepErrorResult['details'],
	retryable?: boolean,
): SearchGrepErrorResult {
	return {
		call_id: input.call_id,
		details: {
			path,
			...details,
		},
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'search.grep',
	};
}

function toErrorResult(
	input: SearchGrepInput,
	path: string,
	error: unknown,
): SearchGrepErrorResult {
	if (error && typeof error === 'object' && 'code' in error) {
		const errorCode = error.code;

		if (errorCode === 'ENOENT') {
			return createErrorResult(
				input,
				'NOT_FOUND',
				`Search path not found: ${path}`,
				path,
				undefined,
				false,
			);
		}

		if (errorCode === 'EACCES' || errorCode === 'EPERM') {
			return createErrorResult(
				input,
				'PERMISSION_DENIED',
				`Permission denied while searching path: ${path}`,
				path,
				undefined,
				false,
			);
		}
	}

	if (error instanceof Error) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			`Failed to search path: ${error.message}`,
			path,
			undefined,
			false,
		);
	}

	return createErrorResult(
		input,
		'UNKNOWN',
		`Failed to search path: ${path}`,
		path,
		undefined,
		false,
	);
}

function isHiddenName(name: string): boolean {
	return name.startsWith('.');
}

function normalizeForSearch(value: string, caseSensitive: boolean): string {
	return caseSensitive ? value : value.toLocaleLowerCase();
}

function collectMatchesForFile(
	filePath: string,
	content: string,
	query: string,
	caseSensitive: boolean,
	maxResults: number,
): SearchGrepMatch[] {
	const normalizedQuery = normalizeForSearch(query, caseSensitive);
	const lines = content.split(/\r?\n/u);
	const matches: SearchGrepMatch[] = [];

	for (let index = 0; index < lines.length; index += 1) {
		if (matches.length >= maxResults) {
			break;
		}

		const lineText = lines[index] ?? '';
		const searchableLine = normalizeForSearch(lineText, caseSensitive);
		const matchIndex = searchableLine.indexOf(normalizedQuery);

		if (matchIndex === -1) {
			continue;
		}

		matches.push({
			column_end: matchIndex + query.length,
			column_start: matchIndex,
			line_number: index + 1,
			line_text: lineText,
			path: filePath,
		});
	}

	return matches;
}

async function collectSearchTargets(
	targetPath: string,
	includeHidden: boolean,
	dependencies: SearchGrepDependencies,
): Promise<string[]> {
	const targetStats = await dependencies.stat(targetPath);

	if (targetStats.isFile()) {
		return [targetPath];
	}

	if (!targetStats.isDirectory()) {
		return [];
	}

	const rawEntries = (await dependencies.readdir(targetPath, {
		withFileTypes: true,
	})) as unknown as readonly DirectoryEntry[];

	const orderedEntries = rawEntries
		.filter((entry) => includeHidden || !isHiddenName(entry.name))
		.sort((left, right) => left.name.localeCompare(right.name));

	const filePaths: string[] = [];

	for (const entry of orderedEntries) {
		const entryPath = `${targetPath}${sep}${entry.name}`;

		if (entry.isDirectory()) {
			filePaths.push(...(await collectSearchTargets(entryPath, includeHidden, dependencies)));
			continue;
		}

		if (entry.isFile()) {
			filePaths.push(entryPath);
		}
	}

	return filePaths;
}

export function createSearchGrepTool(
	dependencies: SearchGrepDependencies = {
		readdir,
		readFile,
		stat,
	},
): ToolDefinition<SearchGrepInput, SearchGrepResult> {
	return {
		callable_schema: {
			parameters: {
				case_sensitive: {
					description: 'Whether the substring search should be case sensitive.',
					type: 'boolean',
				},
				include_hidden: {
					description: 'Whether hidden files and directories should be searched.',
					type: 'boolean',
				},
				max_results: {
					description: 'Maximum number of matches to return.',
					type: 'number',
				},
				path: {
					description: 'File or directory path to search.',
					required: true,
					type: 'string',
				},
				query: {
					description: 'Substring query to search for.',
					required: true,
					type: 'string',
				},
			},
		},
		description:
			'Searches for a text query in a file or recursively under a directory using deterministic substring matching.',
		async execute(input, context): Promise<SearchGrepResult> {
			const searchPath = resolveSearchPath(input, context);
			const includeHidden = input.arguments.include_hidden ?? false;
			const caseSensitive = input.arguments.case_sensitive ?? false;
			const maxResults = input.arguments.max_results ?? 50;
			const query = input.arguments.query;

			if (!query) {
				return createErrorResult(
					input,
					'INVALID_INPUT',
					'Query must be a non-empty string.',
					searchPath,
					{
						reason: 'empty_query',
					},
					false,
				);
			}

			if (!Number.isInteger(maxResults) || maxResults <= 0) {
				return createErrorResult(
					input,
					'INVALID_INPUT',
					'max_results must be a positive integer.',
					searchPath,
					{
						reason: 'invalid_max_results',
					},
					false,
				);
			}

			try {
				const targetStats = await dependencies.stat(searchPath);
				const filePaths = targetStats.isDirectory()
					? await collectSearchTargets(searchPath, includeHidden, dependencies)
					: [searchPath];

				if (!targetStats.isDirectory() && !targetStats.isFile()) {
					return createErrorResult(
						input,
						'INVALID_INPUT',
						`Expected a file or directory path but received an unsupported target: ${searchPath}`,
						searchPath,
						{
							reason: 'unsupported_target',
						},
						false,
					);
				}

				const orderedFilePaths = [...filePaths].sort((left, right) => left.localeCompare(right));
				const matches: SearchGrepMatch[] = [];

				for (const filePath of orderedFilePaths) {
					if (matches.length >= maxResults) {
						break;
					}

					const content = await dependencies.readFile(filePath, {
						encoding: 'utf8',
					});
					const remainingSlots = maxResults - matches.length;
					const fileMatches = collectMatchesForFile(
						filePath,
						content,
						query,
						caseSensitive,
						remainingSlots,
					);

					matches.push(...fileMatches);
				}

				return {
					call_id: input.call_id,
					output: {
						matches,
						path: searchPath,
						query,
					},
					status: 'success',
					tool_name: 'search.grep',
				};
			} catch (error: unknown) {
				return toErrorResult(input, searchPath, error);
			}
		},
		metadata: {
			capability_class: 'search',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
			tags: ['grep', 'search', 'substring', 'workspace'],
		},
		name: 'search.grep',
	};
}

export const searchGrepTool = createSearchGrepTool();
