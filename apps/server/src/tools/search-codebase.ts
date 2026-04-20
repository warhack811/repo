import { lstat, readFile, readdir } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

import type {
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
} from '@runa/types';

import { type RunaIgnoreMatcher, loadRunaIgnoreMatcher } from '../utils/runa-ignore.js';
import { sanitizePromptContent } from '../utils/sanitize-prompt-content.js';

const DEFAULT_MAX_RESULTS = 20;
const MAX_FILES_SCANNED = 2_000;
const MAX_FILE_SIZE_BYTES = 524_288;
const MAX_LINE_TEXT_LENGTH = 240;
const MAX_MAX_RESULTS = 100;
const MAX_MINIFIED_NEWLINES = 16;
const MINIFIED_FILE_MIN_BYTES = 32_768;
const MINIFIED_LINE_LENGTH_THRESHOLD = 1_200;

const EXCLUDED_DIRECTORY_NAMES = new Set([
	'.cache',
	'.git',
	'.next',
	'.nuxt',
	'.output',
	'.parcel-cache',
	'.pnpm-store',
	'.svelte-kit',
	'.turbo',
	'.vercel',
	'.yarn',
	'build',
	'coverage',
	'dist',
	'node_modules',
	'out',
]);
const EXCLUDED_FILE_NAMES = new Set(['.eslintcache']);
const EXCLUDED_FILE_SUFFIXES = ['.map', '.tsbuildinfo'] as const;
const MINIFIED_FILE_SUFFIXES = ['.min.cjs', '.min.css', '.min.js', '.min.mjs'] as const;

export type SearchCodebaseArguments = ToolArguments & {
	readonly include_hidden?: boolean;
	readonly max_results?: number;
	readonly query: string;
	readonly working_directory?: string;
};

export interface SearchCodebaseMatch {
	readonly line_number: number;
	readonly line_text: string;
	readonly path: string;
}

export interface SearchCodebaseSuccessData {
	readonly is_truncated: boolean;
	readonly matches: readonly SearchCodebaseMatch[];
	readonly searched_root: string;
	readonly total_matches?: number;
}

export type SearchCodebaseInput = ToolCallInput<'search.codebase', SearchCodebaseArguments>;

export type SearchCodebaseSuccessResult = ToolResultSuccess<
	'search.codebase',
	SearchCodebaseSuccessData
>;

export type SearchCodebaseErrorResult = ToolResultError<'search.codebase'>;

export type SearchCodebaseResult = ToolResult<'search.codebase', SearchCodebaseSuccessData>;

interface DirectoryEntry {
	readonly isDirectory: () => boolean;
	readonly isFile: () => boolean;
	readonly isSymbolicLink: () => boolean;
	readonly name: string;
}

interface SearchCodebaseDependencies {
	readonly lstat: typeof lstat;
	readonly readFile: typeof readFile;
	readonly readdir: typeof readdir;
}

interface CollectedFileTargets {
	readonly files: readonly string[];
	readonly is_truncated: boolean;
}

interface ResolvedSearchRoot {
	readonly searched_root: string;
	readonly workspace_root: string;
}

function normalizeText(text: string): string {
	return text.replace(/\s+/gu, ' ').trim();
}

function normalizeQuery(text: string): string {
	return text.trim();
}

function normalizeSearchText(text: string): string {
	return text.toLocaleLowerCase();
}

function truncateLineText(lineText: string): string {
	return lineText.length <= MAX_LINE_TEXT_LENGTH
		? lineText
		: `${lineText.slice(0, MAX_LINE_TEXT_LENGTH - 3)}...`;
}

function sanitizeLineText(lineText: string): string {
	return lineText.replace(/\t/gu, ' ').trim();
}

function buildLineSnippet(lineText: string, query: string): string {
	const sanitizedLineText = sanitizeLineText(lineText);

	if (sanitizedLineText.length <= MAX_LINE_TEXT_LENGTH) {
		return sanitizePromptContent(sanitizedLineText);
	}

	const searchableLine = normalizeSearchText(sanitizedLineText);
	const normalizedQuery = normalizeSearchText(query);
	const matchIndex = searchableLine.indexOf(normalizedQuery);

	if (matchIndex < 0 || normalizedQuery.length >= MAX_LINE_TEXT_LENGTH - 6) {
		return truncateLineText(sanitizedLineText);
	}

	const windowLength = MAX_LINE_TEXT_LENGTH - 6;
	const beforeBudget = Math.max(0, Math.floor((windowLength - normalizedQuery.length) / 2));
	let start = Math.max(0, matchIndex - beforeBudget);
	const end = Math.min(sanitizedLineText.length, start + windowLength);
	start = Math.max(0, end - windowLength);

	let snippet = sanitizedLineText.slice(start, end).trim();

	if (start > 0) {
		snippet = `...${snippet}`;
	}

	if (end < sanitizedLineText.length) {
		snippet = `${snippet}...`;
	}

	return sanitizePromptContent(truncateLineText(snippet));
}

function normalizePathForComparison(pathValue: string): string {
	const resolvedPath = resolve(pathValue);

	return process.platform === 'win32' ? resolvedPath.toLocaleLowerCase() : resolvedPath;
}

function isPathWithinRoot(rootPath: string, candidatePath: string): boolean {
	const relativePath = relative(
		normalizePathForComparison(rootPath),
		normalizePathForComparison(candidatePath),
	);

	return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}

function isHiddenName(name: string): boolean {
	return name.startsWith('.');
}

function shouldExcludeDirectory(name: string): boolean {
	return EXCLUDED_DIRECTORY_NAMES.has(name.toLocaleLowerCase());
}

function shouldExcludeFileByName(name: string): boolean {
	const normalizedName = name.toLocaleLowerCase();

	return (
		EXCLUDED_FILE_NAMES.has(normalizedName) ||
		EXCLUDED_FILE_SUFFIXES.some((suffix) => normalizedName.endsWith(suffix)) ||
		MINIFIED_FILE_SUFFIXES.some((suffix) => normalizedName.endsWith(suffix))
	);
}

function normalizeMaxResults(maxResults?: number): number | undefined {
	if (maxResults === undefined) {
		return DEFAULT_MAX_RESULTS;
	}

	if (!Number.isInteger(maxResults) || maxResults < 1) {
		return undefined;
	}

	return Math.min(maxResults, MAX_MAX_RESULTS);
}

function resolveSearchRoot(
	input: SearchCodebaseInput,
	context: ToolExecutionContext,
): ResolvedSearchRoot {
	const workspaceRoot = resolve(context.working_directory ?? process.cwd());
	const searchedRoot =
		input.arguments.working_directory === undefined
			? workspaceRoot
			: resolve(workspaceRoot, input.arguments.working_directory);

	return {
		searched_root: searchedRoot,
		workspace_root: workspaceRoot,
	};
}

function createErrorResult(
	input: SearchCodebaseInput,
	error_code: SearchCodebaseErrorResult['error_code'],
	error_message: string,
	searchedRoot: string,
	details?: SearchCodebaseErrorResult['details'],
	retryable?: boolean,
): SearchCodebaseErrorResult {
	return {
		call_id: input.call_id,
		details: {
			searched_root: searchedRoot,
			...details,
		},
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'search.codebase',
	};
}

function toErrorResult(
	input: SearchCodebaseInput,
	searchedRoot: string,
	error: unknown,
): SearchCodebaseErrorResult {
	if (error && typeof error === 'object' && 'code' in error) {
		const errorCode = error.code;

		if (errorCode === 'ENOENT') {
			return createErrorResult(
				input,
				'NOT_FOUND',
				`Code search root not found: ${searchedRoot}`,
				searchedRoot,
				{
					reason: 'working_directory_missing',
				},
				false,
			);
		}

		if (errorCode === 'EACCES' || errorCode === 'EPERM') {
			return createErrorResult(
				input,
				'PERMISSION_DENIED',
				`Permission denied while searching codebase: ${searchedRoot}`,
				searchedRoot,
				undefined,
				false,
			);
		}
	}

	if (error instanceof Error) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			`Failed to search codebase: ${error.message}`,
			searchedRoot,
			undefined,
			false,
		);
	}

	return createErrorResult(
		input,
		'UNKNOWN',
		`Failed to search codebase: ${searchedRoot}`,
		searchedRoot,
		undefined,
		false,
	);
}

async function validateSearchRoot(
	input: SearchCodebaseInput,
	resolvedRoot: ResolvedSearchRoot,
	dependencies: SearchCodebaseDependencies,
): Promise<SearchCodebaseErrorResult | undefined> {
	const rawWorkingDirectory = input.arguments.working_directory;

	if (
		rawWorkingDirectory !== undefined &&
		typeof rawWorkingDirectory === 'string' &&
		normalizeText(rawWorkingDirectory).length === 0
	) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'working_directory must be a non-empty string when provided.',
			resolvedRoot.searched_root,
			{
				reason: 'invalid_working_directory',
			},
			false,
		);
	}

	if (!isPathWithinRoot(resolvedRoot.workspace_root, resolvedRoot.searched_root)) {
		return createErrorResult(
			input,
			'PERMISSION_DENIED',
			'working_directory must stay within the current workspace.',
			resolvedRoot.searched_root,
			{
				reason: 'working_directory_outside_workspace',
				workspace_root: resolvedRoot.workspace_root,
			},
			false,
		);
	}

	try {
		const rootStats = await dependencies.lstat(resolvedRoot.searched_root);

		if (rootStats.isSymbolicLink()) {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				'Search root cannot be a symbolic link.',
				resolvedRoot.searched_root,
				{
					reason: 'working_directory_symlink',
				},
				false,
			);
		}

		if (!rootStats.isDirectory()) {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				`Expected a directory search root but received: ${resolvedRoot.searched_root}`,
				resolvedRoot.searched_root,
				{
					reason: 'working_directory_not_directory',
				},
				false,
			);
		}

		return undefined;
	} catch (error: unknown) {
		return toErrorResult(input, resolvedRoot.searched_root, error);
	}
}

async function collectFileTargets(
	rootPath: string,
	includeHidden: boolean,
	runaIgnoreMatcher: RunaIgnoreMatcher,
	dependencies: SearchCodebaseDependencies,
): Promise<CollectedFileTargets> {
	const filePaths: string[] = [];
	let isTruncated = false;

	async function visitDirectory(directoryPath: string): Promise<void> {
		if (isTruncated) {
			return;
		}

		if (
			runaIgnoreMatcher.isIgnoredAbsolutePath(directoryPath, {
				is_directory: true,
			})
		) {
			return;
		}

		const rawEntries = (await dependencies.readdir(directoryPath, {
			withFileTypes: true,
		})) as unknown as readonly DirectoryEntry[];

		const orderedEntries = rawEntries
			.filter((entry) => includeHidden || !isHiddenName(entry.name))
			.filter((entry) => !(entry.isDirectory() && shouldExcludeDirectory(entry.name)))
			.filter((entry) => !(entry.isFile() && shouldExcludeFileByName(entry.name)))
			.filter((entry) => !entry.isSymbolicLink())
			.sort((left, right) => left.name.localeCompare(right.name));

		for (const entry of orderedEntries) {
			if (isTruncated) {
				break;
			}

			const entryPath = join(directoryPath, entry.name);

			if (entry.isDirectory()) {
				if (runaIgnoreMatcher.isIgnoredAbsolutePath(entryPath, { is_directory: true })) {
					continue;
				}

				await visitDirectory(entryPath);
				continue;
			}

			if (!entry.isFile()) {
				continue;
			}

			if (runaIgnoreMatcher.isIgnoredAbsolutePath(entryPath, { is_directory: false })) {
				continue;
			}

			if (filePaths.length >= MAX_FILES_SCANNED) {
				isTruncated = true;
				break;
			}

			filePaths.push(entryPath);
		}
	}

	await visitDirectory(rootPath);

	return {
		files: filePaths.sort((left, right) => left.localeCompare(right)),
		is_truncated: isTruncated,
	};
}

function isBinaryBuffer(buffer: Buffer): boolean {
	if (buffer.includes(0)) {
		return true;
	}

	const sample = buffer.subarray(0, Math.min(buffer.length, 8_192));

	if (sample.length === 0) {
		return false;
	}

	let suspiciousByteCount = 0;

	for (const byte of sample) {
		if (byte === 9 || byte === 10 || byte === 13) {
			continue;
		}

		if (byte < 32 || byte === 127) {
			suspiciousByteCount += 1;
		}
	}

	return suspiciousByteCount / sample.length > 0.3;
}

function isLikelyMinifiedText(filePath: string, fileBuffer: Buffer, content: string): boolean {
	const normalizedPath = filePath.toLocaleLowerCase();

	if (MINIFIED_FILE_SUFFIXES.some((suffix) => normalizedPath.endsWith(suffix))) {
		return true;
	}

	if (fileBuffer.length < MINIFIED_FILE_MIN_BYTES) {
		return false;
	}

	const newlineCount = (content.match(/\n/gu) ?? []).length;

	if (newlineCount > MAX_MINIFIED_NEWLINES) {
		return false;
	}

	let longestLineLength = 0;

	for (const line of content.split(/\r?\n/gu)) {
		if (line.length > longestLineLength) {
			longestLineLength = line.length;
		}
	}

	return longestLineLength >= MINIFIED_LINE_LENGTH_THRESHOLD;
}

function collectMatchesForFile(
	filePath: string,
	content: string,
	query: string,
): readonly SearchCodebaseMatch[] {
	const normalizedQuery = normalizeSearchText(query);
	const lines = content.split(/\r?\n/u);
	const matches: SearchCodebaseMatch[] = [];

	for (let index = 0; index < lines.length; index += 1) {
		const lineText = lines[index] ?? '';
		const searchableLine = normalizeSearchText(lineText);

		if (!searchableLine.includes(normalizedQuery)) {
			continue;
		}

		matches.push({
			line_number: index + 1,
			line_text: buildLineSnippet(lineText, query),
			path: filePath,
		});
	}

	return matches;
}

export function createSearchCodebaseTool(
	dependencies: SearchCodebaseDependencies = {
		lstat,
		readFile,
		readdir,
	},
): ToolDefinition<SearchCodebaseInput, SearchCodebaseResult> {
	return {
		callable_schema: {
			parameters: {
				include_hidden: {
					description: 'Whether hidden files and directories may be searched.',
					type: 'boolean',
				},
				max_results: {
					description: 'Maximum number of matches to return, capped to a safe deterministic limit.',
					type: 'number',
				},
				query: {
					description:
						'Trimmed, case-insensitive text query for repo-local code, config, docs, or implementation truth inside the current workspace.',
					required: true,
					type: 'string',
				},
				working_directory: {
					description: 'Optional subdirectory inside the current workspace to search from.',
					type: 'string',
				},
			},
		},
		description:
			'Searches text-like workspace files with deterministic ordering, query trimming, conservative generated-file filtering, and workspace boundary checks. Prefer this over web.search for repo-local implementation truth.',
		async execute(input, context): Promise<SearchCodebaseResult> {
			const query = input.arguments.query;
			const resolvedRoot = resolveSearchRoot(input, context);
			const normalizedQuery = typeof query === 'string' ? normalizeQuery(query) : undefined;

			if (typeof query !== 'string' || !normalizedQuery) {
				return createErrorResult(
					input,
					'INVALID_INPUT',
					'query must be a non-empty string.',
					resolvedRoot.searched_root,
					{
						reason: 'invalid_query',
					},
					false,
				);
			}

			const maxResults = normalizeMaxResults(input.arguments.max_results);

			if (maxResults === undefined) {
				return createErrorResult(
					input,
					'INVALID_INPUT',
					'max_results must be a positive integer when provided.',
					resolvedRoot.searched_root,
					{
						reason: 'invalid_max_results',
					},
					false,
				);
			}

			const validationError = await validateSearchRoot(input, resolvedRoot, dependencies);

			if (validationError) {
				return validationError;
			}

			try {
				const runaIgnoreMatcher = await loadRunaIgnoreMatcher(resolvedRoot.workspace_root);

				if (
					runaIgnoreMatcher.isIgnoredAbsolutePath(resolvedRoot.searched_root, {
						is_directory: true,
					})
				) {
					return createErrorResult(
						input,
						'PERMISSION_DENIED',
						`Permission denied while searching codebase: ${resolvedRoot.searched_root}. Ignored by .runaignore.`,
						resolvedRoot.searched_root,
						{
							reason: 'ignored_by_runaignore',
						},
						false,
					);
				}

				const includeHidden = input.arguments.include_hidden ?? false;
				const collectedTargets = await collectFileTargets(
					resolvedRoot.searched_root,
					includeHidden,
					runaIgnoreMatcher,
					dependencies,
				);
				const matches: SearchCodebaseMatch[] = [];
				let totalMatches = 0;

				for (const filePath of collectedTargets.files) {
					const fileStats = await dependencies.lstat(filePath);

					if (
						!fileStats.isFile() ||
						fileStats.isSymbolicLink() ||
						fileStats.size > MAX_FILE_SIZE_BYTES
					) {
						continue;
					}

					const fileBuffer = await dependencies.readFile(filePath);

					if (isBinaryBuffer(fileBuffer)) {
						continue;
					}

					const fileContent = fileBuffer.toString('utf8');

					if (isLikelyMinifiedText(filePath, fileBuffer, fileContent)) {
						continue;
					}

					const fileMatches = collectMatchesForFile(filePath, fileContent, normalizedQuery);
					totalMatches += fileMatches.length;

					if (matches.length >= maxResults) {
						continue;
					}

					const remainingSlots = maxResults - matches.length;
					matches.push(...fileMatches.slice(0, remainingSlots));
				}

				return {
					call_id: input.call_id,
					output: {
						is_truncated: collectedTargets.is_truncated || totalMatches > matches.length,
						matches,
						searched_root: resolvedRoot.searched_root,
						total_matches: collectedTargets.is_truncated ? undefined : totalMatches,
					},
					status: 'success',
					tool_name: 'search.codebase',
				};
			} catch (error: unknown) {
				return toErrorResult(input, resolvedRoot.searched_root, error);
			}
		},
		metadata: {
			capability_class: 'search',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
			tags: ['codebase', 'search', 'text', 'workspace'],
		},
		name: 'search.codebase',
	};
}

export const searchCodebaseTool = createSearchCodebaseTool();
