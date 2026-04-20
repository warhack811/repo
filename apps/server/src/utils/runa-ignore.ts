import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

const DEFAULT_IGNORE_PATTERNS = ['/.git/', '/node_modules/'] as const;
const RUNA_IGNORE_FILE_NAME = '.runaignore';
const RUNA_IGNORE_LINE_SPLITTER = /\r?\n/gu;

interface RunaIgnoreDependencies {
	readonly readFile: typeof readFile;
}

interface IgnoreCheckOptions {
	readonly is_directory?: boolean;
}

interface CompiledIgnoreRule {
	readonly matches: (normalizedPath: string, options?: IgnoreCheckOptions) => boolean;
	readonly pattern: string;
}

interface NormalizedIgnorePattern {
	readonly anchored: boolean;
	readonly directory_only: boolean;
	readonly pattern: string;
}

export interface RunaIgnoreMatcher {
	readonly patterns: readonly string[];
	readonly workspace_root: string;
	isIgnoredAbsolutePath(pathValue: string, options?: IgnoreCheckOptions): boolean;
	isIgnoredRelativePath(pathValue: string, options?: IgnoreCheckOptions): boolean;
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

function normalizePathLikeValue(pathValue: string): string {
	return pathValue
		.replace(/\\/gu, '/')
		.replace(/^\.\//u, '')
		.replace(/^\/+/u, '')
		.replace(/\/+/gu, '/')
		.replace(/\/$/u, '');
}

function normalizeRelativePath(pathValue: string): string {
	const normalized = normalizePathLikeValue(pathValue);

	return normalized === '.' ? '' : normalized;
}

function escapeRegexCharacter(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function globToRegexBody(pattern: string): string {
	let regexBody = '';

	for (let index = 0; index < pattern.length; index += 1) {
		const character = pattern[index];

		if (character === '*') {
			const nextCharacter = pattern[index + 1];

			if (nextCharacter === '*') {
				regexBody += '.*';
				index += 1;
			} else {
				regexBody += '[^/]*';
			}

			continue;
		}

		if (character === '?') {
			regexBody += '[^/]';
			continue;
		}

		regexBody += escapeRegexCharacter(character ?? '');
	}

	return regexBody;
}

function normalizeIgnorePattern(rawPattern: string): NormalizedIgnorePattern | undefined {
	const trimmedPattern = rawPattern.trim();

	if (
		trimmedPattern.length === 0 ||
		trimmedPattern.startsWith('#') ||
		trimmedPattern.startsWith('!')
	) {
		return undefined;
	}

	const anchored = trimmedPattern.startsWith('/');
	const directoryOnly = trimmedPattern.endsWith('/');
	const normalizedPattern = normalizePathLikeValue(trimmedPattern);

	if (!normalizedPattern) {
		return undefined;
	}

	return {
		anchored,
		directory_only: directoryOnly,
		pattern: normalizedPattern,
	};
}

function compileIgnoreRule(pattern: string): CompiledIgnoreRule | undefined {
	const normalizedPattern = normalizeIgnorePattern(pattern);

	if (!normalizedPattern) {
		return undefined;
	}

	const patternBody = globToRegexBody(normalizedPattern.pattern);
	const prefix = normalizedPattern.anchored ? '^' : '^(?:.*/)?';

	if (normalizedPattern.pattern.includes('/')) {
		const exactRegex = new RegExp(`${prefix}${patternBody}$`, 'u');
		const childRegex = new RegExp(`${prefix}${patternBody}/.+$`, 'u');

		return {
			matches(normalizedPath, options) {
				return (
					childRegex.test(normalizedPath) ||
					(normalizedPattern.directory_only
						? options?.is_directory === true && exactRegex.test(normalizedPath)
						: exactRegex.test(normalizedPath))
				);
			},
			pattern,
		};
	}

	const segmentRegex = new RegExp(`^${patternBody}$`, 'u');

	return {
		matches(normalizedPath, options) {
			const segments = normalizedPath.split('/').filter((segment) => segment.length > 0);

			for (let index = 0; index < segments.length; index += 1) {
				const segment = segments[index];

				if (!segmentRegex.test(segment ?? '')) {
					continue;
				}

				if (!normalizedPattern.directory_only) {
					return true;
				}

				const isDescendantOfMatchedSegment = index < segments.length - 1;

				if (isDescendantOfMatchedSegment || options?.is_directory === true) {
					return true;
				}
			}

			return false;
		},
		pattern,
	};
}

async function readRunaIgnorePatterns(
	workspaceRoot: string,
	dependencies: RunaIgnoreDependencies,
): Promise<readonly string[]> {
	const ignoreFilePath = resolve(workspaceRoot, RUNA_IGNORE_FILE_NAME);

	try {
		const ignoreFileContent = await dependencies.readFile(ignoreFilePath, 'utf8');

		return ignoreFileContent
			.split(RUNA_IGNORE_LINE_SPLITTER)
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
	} catch (error: unknown) {
		if (
			error &&
			typeof error === 'object' &&
			'code' in error &&
			typeof error.code === 'string' &&
			error.code === 'ENOENT'
		) {
			return [];
		}

		throw error;
	}
}

export async function loadRunaIgnoreMatcher(
	workspaceRoot: string,
	dependencies: RunaIgnoreDependencies = {
		readFile,
	},
): Promise<RunaIgnoreMatcher> {
	const resolvedWorkspaceRoot = resolve(workspaceRoot);
	const configuredPatterns = await readRunaIgnorePatterns(resolvedWorkspaceRoot, dependencies);
	const patterns = [...DEFAULT_IGNORE_PATTERNS, ...configuredPatterns];
	const rules = patterns
		.map((pattern) => compileIgnoreRule(pattern))
		.filter((rule): rule is CompiledIgnoreRule => rule !== undefined);
	const isIgnoredRelativePath = (pathValue: string, options?: IgnoreCheckOptions): boolean => {
		const normalizedRelativePath = normalizeRelativePath(pathValue);

		if (!normalizedRelativePath) {
			return false;
		}

		return rules.some((rule) => rule.matches(normalizedRelativePath, options));
	};

	return {
		patterns: rules.map((rule) => rule.pattern),
		workspace_root: resolvedWorkspaceRoot,
		isIgnoredAbsolutePath(pathValue, options) {
			const resolvedCandidate = resolve(pathValue);

			if (!isPathWithinRoot(resolvedWorkspaceRoot, resolvedCandidate)) {
				return false;
			}

			const relativePath = relative(resolvedWorkspaceRoot, resolvedCandidate);

			return isIgnoredRelativePath(relativePath, options);
		},
		isIgnoredRelativePath,
	};
}
