import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { type RunaIgnoreMatcher, loadRunaIgnoreMatcher } from '../utils/runa-ignore.js';
import { sanitizePromptContent } from '../utils/sanitize-prompt-content.js';

const DEFAULT_MAX_TOP_LEVEL_ENTRIES = 5;
const DEFAULT_README_CHAR_BUDGET = 240;
const DEFAULT_SUMMARY_CHAR_BUDGET = 280;
const MAX_DEPENDENCY_HINTS = 8;
const MAX_SCRIPTS = 7;
const MAX_README_SENTENCES = 2;
const WORKSPACE_LAYER_TITLE = 'Workspace Overview';

const EXCLUDED_TOP_LEVEL_ENTRIES = new Set(['.git', '.turbo', 'coverage', 'dist', 'node_modules']);

const PRIORITIZED_SCRIPT_NAMES = [
	'dev',
	'build',
	'test',
	'lint',
	'start',
	'typecheck',
	'format',
] as const;

const PRIORITIZED_TOP_LEVEL_SIGNALS = [
	'apps',
	'packages',
	'pnpm-workspace.yaml',
	'turbo.json',
	'nx.json',
	'src',
	'docs',
	'scripts',
] as const;

const CURATED_DEPENDENCY_HINTS = new Set([
	'cac',
	'commander',
	'drizzle-orm',
	'express',
	'fastify',
	'hono',
	'jest',
	'next',
	'react',
	'turbo',
	'typescript',
	'vite',
	'vitest',
	'yargs',
]);

type WorkspaceSignalSource = 'package_json' | 'readme' | 'top_level_entries';

type ProjectTypeHint =
	| 'express-server'
	| 'fastify-server'
	| 'hono-server'
	| 'jest'
	| 'monorepo'
	| 'nextjs'
	| 'node-cli'
	| 'react'
	| 'turborepo'
	| 'typescript'
	| 'vite'
	| 'vitest';

interface WorkspaceContextFailure {
	readonly code:
		| 'INVALID_MAX_TOP_LEVEL_ENTRIES'
		| 'INVALID_README_CHAR_BUDGET'
		| 'INVALID_WORKING_DIRECTORY'
		| 'WORKSPACE_READ_FAILED';
	readonly message: string;
}

export interface WorkspaceLayerContent {
	readonly dependency_hints: readonly string[];
	readonly layer_type: 'workspace_layer';
	readonly project_name?: string;
	readonly project_type_hints: readonly string[];
	readonly scripts: readonly string[];
	readonly summary: string;
	readonly title: string;
	readonly top_level_signals: readonly string[];
}

export interface WorkspaceLayer {
	readonly content: WorkspaceLayerContent;
	readonly kind: 'workspace';
	readonly name: 'workspace_layer';
}

export interface ComposeWorkspaceContextInput {
	readonly max_top_level_entries?: number;
	readonly readme_char_budget?: number;
	readonly working_directory: string;
}

export interface WorkspaceLayerCreatedResult {
	readonly signals_used: readonly WorkspaceSignalSource[];
	readonly status: 'workspace_layer_created';
	readonly workspace_layer: WorkspaceLayer;
}

export interface NoWorkspaceLayerResult {
	readonly signals_used: readonly [];
	readonly status: 'no_workspace_layer';
}

export interface ComposeWorkspaceContextFailureResult {
	readonly failure: WorkspaceContextFailure;
	readonly signals_used: readonly [];
	readonly status: 'failed';
}

export type ComposeWorkspaceContextResult =
	| ComposeWorkspaceContextFailureResult
	| NoWorkspaceLayerResult
	| WorkspaceLayerCreatedResult;

interface PackageJsonSignals {
	readonly all_dependency_names: readonly string[];
	readonly dependency_hints: readonly string[];
	readonly has_workspaces: boolean;
	readonly private?: boolean;
	readonly project_name?: string;
	readonly scripts: readonly string[];
	readonly version?: string;
}

interface ReadmeSignals {
	readonly summary?: string;
	readonly title?: string;
}

interface WorkspacePackageJson extends Readonly<Record<string, unknown>> {
	readonly dependencies?: unknown;
	readonly devDependencies?: unknown;
	readonly name?: unknown;
	readonly private?: unknown;
	readonly scripts?: unknown;
	readonly version?: unknown;
	readonly workspaces?: unknown;
}

interface WorkspacePackageJsonWorkspaces extends Readonly<Record<string, unknown>> {
	readonly packages?: unknown;
}

function normalizeText(text: string): string {
	return text.replace(/\s+/gu, ' ').trim();
}

function truncateText(text: string, maxLength: number): string {
	return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && normalizeText(value).length > 0;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function joinLabels(labels: readonly string[]): string {
	if (labels.length === 0) {
		return '';
	}

	if (labels.length === 1) {
		return labels[0] ?? '';
	}

	if (labels.length === 2) {
		return `${labels[0]} and ${labels[1]}`;
	}

	const leadingLabels = labels.slice(0, -1);
	const trailingLabel = labels.at(-1);

	return `${leadingLabels.join(', ')}, and ${trailingLabel}`;
}

function normalizePositiveInteger(
	value: number | undefined,
	code: WorkspaceContextFailure['code'],
	label: string,
	fallback: number,
): number | ComposeWorkspaceContextFailureResult {
	if (value === undefined) {
		return fallback;
	}

	if (!Number.isFinite(value) || value < 1) {
		return createFailure(code, `${label} must be a positive finite number.`);
	}

	return Math.trunc(value);
}

function isFailureResult(
	value: number | ComposeWorkspaceContextFailureResult,
): value is ComposeWorkspaceContextFailureResult {
	return typeof value === 'object';
}

function createFailure(
	code: WorkspaceContextFailure['code'],
	message: string,
): ComposeWorkspaceContextFailureResult {
	return {
		failure: {
			code,
			message,
		},
		signals_used: [],
		status: 'failed',
	};
}

function normalizeObjectKeys(value: unknown): readonly string[] {
	if (!isRecord(value)) {
		return [];
	}

	return Object.keys(value)
		.filter((key) => normalizeText(key).length > 0)
		.sort((left, right) => left.localeCompare(right));
}

function selectScriptNames(value: unknown): readonly string[] {
	const allScriptNames = normalizeObjectKeys(value);
	const prioritizedScriptNames = new Set<string>(PRIORITIZED_SCRIPT_NAMES);
	const prioritizedScripts = PRIORITIZED_SCRIPT_NAMES.filter((scriptName) =>
		allScriptNames.includes(scriptName),
	);

	if (prioritizedScripts.length > 0) {
		return prioritizedScripts.slice(0, MAX_SCRIPTS);
	}

	return allScriptNames
		.filter((scriptName) => !prioritizedScriptNames.has(scriptName))
		.slice(0, Math.min(3, MAX_SCRIPTS));
}

function selectDependencyHints(allDependencyNames: readonly string[]): readonly string[] {
	const curatedHints = allDependencyNames
		.filter((dependencyName) => CURATED_DEPENDENCY_HINTS.has(dependencyName))
		.sort((left, right) => left.localeCompare(right));

	if (curatedHints.length > 0) {
		return curatedHints.slice(0, MAX_DEPENDENCY_HINTS);
	}

	return allDependencyNames.slice(0, MAX_DEPENDENCY_HINTS);
}

function cleanMarkdownText(text: string): string {
	return sanitizePromptContent(
		normalizeText(
			text
				.replace(/!\[[^\]]*\]\([^)]+\)/gu, ' ')
				.replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
				.replace(/`([^`]+)`/gu, '$1')
				.replace(/[*_#]/gu, ' '),
		),
	);
}

function takeLeadingSentences(text: string, maxSentences: number): string {
	const normalizedText = cleanMarkdownText(text);

	if (!normalizedText) {
		return '';
	}

	const sentences = normalizedText
		.split(/(?<=[.!?])\s+/u)
		.filter((sentence) => sentence.length > 0);

	if (sentences.length === 0) {
		return normalizedText;
	}

	return sentences.slice(0, maxSentences).join(' ');
}

async function validateWorkingDirectory(
	workingDirectory: string,
): Promise<ComposeWorkspaceContextFailureResult | string> {
	const normalizedWorkingDirectory = normalizeText(workingDirectory);

	if (!normalizedWorkingDirectory) {
		return createFailure(
			'INVALID_WORKING_DIRECTORY',
			'composeWorkspaceContext requires a non-empty working_directory.',
		);
	}

	try {
		const directoryStat = await stat(normalizedWorkingDirectory);

		if (!directoryStat.isDirectory()) {
			return createFailure(
				'INVALID_WORKING_DIRECTORY',
				'composeWorkspaceContext requires working_directory to point to a directory.',
			);
		}

		return normalizedWorkingDirectory;
	} catch {
		return createFailure(
			'INVALID_WORKING_DIRECTORY',
			'composeWorkspaceContext could not access the working_directory.',
		);
	}
}

async function readPackageJsonSignals(
	workingDirectory: string,
	runaIgnoreMatcher: RunaIgnoreMatcher,
): Promise<PackageJsonSignals | undefined> {
	if (runaIgnoreMatcher.isIgnoredRelativePath('package.json', { is_directory: false })) {
		return undefined;
	}

	const packageJsonPath = path.join(workingDirectory, 'package.json');

	let rawPackageJson: string;

	try {
		rawPackageJson = await readFile(packageJsonPath, 'utf8');
	} catch (error) {
		const errorCode =
			typeof error === 'object' &&
			error !== null &&
			'code' in error &&
			typeof error.code === 'string'
				? error.code
				: undefined;

		if (errorCode === 'ENOENT') {
			return undefined;
		}

		throw error;
	}

	let parsedPackageJson: unknown;

	try {
		parsedPackageJson = JSON.parse(rawPackageJson);
	} catch {
		return undefined;
	}

	if (!isRecord(parsedPackageJson)) {
		return undefined;
	}

	const workspacePackageJson = parsedPackageJson as WorkspacePackageJson;
	const workspacePackages = isRecord(workspacePackageJson.workspaces)
		? (workspacePackageJson.workspaces as WorkspacePackageJsonWorkspaces)
		: undefined;

	const allDependencyNames = Array.from(
		new Set([
			...normalizeObjectKeys(workspacePackageJson.dependencies),
			...normalizeObjectKeys(workspacePackageJson.devDependencies),
		]),
	).sort((left, right) => left.localeCompare(right));

	return {
		all_dependency_names: allDependencyNames,
		dependency_hints: selectDependencyHints(allDependencyNames),
		has_workspaces:
			Array.isArray(workspacePackageJson.workspaces) ||
			(workspacePackages !== undefined && Array.isArray(workspacePackages.packages)),
		private:
			typeof workspacePackageJson.private === 'boolean' ? workspacePackageJson.private : undefined,
		project_name: isNonEmptyString(workspacePackageJson.name)
			? normalizeText(workspacePackageJson.name)
			: undefined,
		scripts: selectScriptNames(workspacePackageJson.scripts),
		version: isNonEmptyString(workspacePackageJson.version)
			? normalizeText(workspacePackageJson.version)
			: undefined,
	};
}

function extractReadmeParagraph(lines: readonly string[]): string | undefined {
	const paragraphLines: string[] = [];

	for (const line of lines) {
		const normalizedLine = normalizeText(line);

		if (!normalizedLine) {
			if (paragraphLines.length > 0) {
				break;
			}

			continue;
		}

		if (normalizedLine.startsWith('#')) {
			if (paragraphLines.length > 0) {
				break;
			}

			continue;
		}

		paragraphLines.push(normalizedLine);
	}

	return paragraphLines.length > 0 ? paragraphLines.join(' ') : undefined;
}

async function readReadmeSignals(
	workingDirectory: string,
	readmeCharBudget: number,
	runaIgnoreMatcher: RunaIgnoreMatcher,
): Promise<ReadmeSignals | undefined> {
	const readmeCandidates = ['README.md', 'README'];

	for (const readmeCandidate of readmeCandidates) {
		if (runaIgnoreMatcher.isIgnoredRelativePath(readmeCandidate, { is_directory: false })) {
			continue;
		}

		const readmePath = path.join(workingDirectory, readmeCandidate);

		let readmeText: string;

		try {
			readmeText = await readFile(readmePath, 'utf8');
		} catch (error) {
			const errorCode =
				typeof error === 'object' &&
				error !== null &&
				'code' in error &&
				typeof error.code === 'string'
					? error.code
					: undefined;

			if (errorCode === 'ENOENT') {
				continue;
			}

			throw error;
		}

		const lines = readmeText.split(/\r?\n/gu);
		const titleLine = lines.find((line) => normalizeText(line).startsWith('# '));
		const paragraph = extractReadmeParagraph(lines);
		const summary = paragraph
			? truncateText(takeLeadingSentences(paragraph, MAX_README_SENTENCES), readmeCharBudget)
			: undefined;

		if (!titleLine && !summary) {
			return undefined;
		}

		return {
			summary,
			title: titleLine ? cleanMarkdownText(titleLine.replace(/^#\s+/u, '')) : undefined,
		};
	}

	return undefined;
}

async function readTopLevelSignals(
	workingDirectory: string,
	maxTopLevelEntries: number,
	runaIgnoreMatcher: RunaIgnoreMatcher,
): Promise<readonly string[]> {
	const entries = await readdir(workingDirectory, {
		withFileTypes: true,
	});
	const visibleEntries = entries.filter(
		(entry) =>
			!runaIgnoreMatcher.isIgnoredRelativePath(entry.name, {
				is_directory: entry.isDirectory(),
			}),
	);

	const directorySignals = visibleEntries
		.filter(
			(entry) =>
				entry.isDirectory() &&
				!entry.name.startsWith('.') &&
				!EXCLUDED_TOP_LEVEL_ENTRIES.has(entry.name.toLowerCase()),
		)
		.map((entry) => entry.name)
		.sort((left, right) => left.localeCompare(right));

	const entryNames = new Set(visibleEntries.map((entry) => entry.name.toLowerCase()));
	const prioritizedSignals = PRIORITIZED_TOP_LEVEL_SIGNALS.filter((signal) =>
		entryNames.has(signal),
	);
	const prioritizedSignalNames = new Set<string>(prioritizedSignals);
	const additionalDirectories = directorySignals.filter(
		(directorySignal) => !prioritizedSignalNames.has(directorySignal),
	);

	return [...prioritizedSignals, ...additionalDirectories].slice(0, maxTopLevelEntries);
}

function inferProjectTypeHints(input: {
	readonly all_dependency_names: readonly string[];
	readonly has_workspaces: boolean;
	readonly top_level_signals: readonly string[];
}): readonly ProjectTypeHint[] {
	const dependencyNames = new Set(input.all_dependency_names);
	const topLevelSignals = new Set(input.top_level_signals);
	const hints: ProjectTypeHint[] = [];

	if (
		input.has_workspaces ||
		(topLevelSignals.has('apps') && topLevelSignals.has('packages')) ||
		topLevelSignals.has('pnpm-workspace.yaml') ||
		topLevelSignals.has('turbo.json') ||
		topLevelSignals.has('nx.json')
	) {
		hints.push('monorepo');
	}

	if (topLevelSignals.has('turbo.json') || dependencyNames.has('turbo')) {
		hints.push('turborepo');
	}

	if (dependencyNames.has('next')) {
		hints.push('nextjs');
	} else if (dependencyNames.has('react')) {
		hints.push('react');
	}

	if (dependencyNames.has('vite')) {
		hints.push('vite');
	}

	if (dependencyNames.has('typescript')) {
		hints.push('typescript');
	}

	if (dependencyNames.has('fastify')) {
		hints.push('fastify-server');
	} else if (dependencyNames.has('express')) {
		hints.push('express-server');
	} else if (dependencyNames.has('hono')) {
		hints.push('hono-server');
	}

	if (
		dependencyNames.has('commander') ||
		dependencyNames.has('cac') ||
		dependencyNames.has('yargs')
	) {
		hints.push('node-cli');
	}

	if (dependencyNames.has('vitest')) {
		hints.push('vitest');
	} else if (dependencyNames.has('jest')) {
		hints.push('jest');
	}

	return hints;
}

function buildWorkspaceSubject(input: {
	readonly project_name?: string;
	readonly project_type_hints: readonly ProjectTypeHint[];
}): { readonly mode: 'includes' | 'with'; readonly text: string } {
	const isMonorepo = input.project_type_hints.includes('monorepo');
	const isTypescript = input.project_type_hints.includes('typescript');
	const descriptorParts = [
		isMonorepo ? 'monorepo-style' : undefined,
		isTypescript ? 'TypeScript' : undefined,
	].filter((part): part is string => part !== undefined);

	if (input.project_name && descriptorParts.length > 0) {
		return {
			mode: 'with',
			text: `${input.project_name} is a ${descriptorParts.join(' ')} workspace`,
		};
	}

	if (descriptorParts.length > 0) {
		return {
			mode: 'with',
			text: `This is a ${descriptorParts.join(' ')} workspace`,
		};
	}

	if (input.project_name) {
		return {
			mode: 'with',
			text: `${input.project_name} is a workspace`,
		};
	}

	return {
		mode: 'includes',
		text: 'This workspace',
	};
}

function buildLayoutPhrase(topLevelSignals: readonly string[]): string | undefined {
	const signalSet = new Set(topLevelSignals);

	if (signalSet.has('apps') && signalSet.has('packages')) {
		return 'an apps/packages layout';
	}

	if (signalSet.has('src')) {
		return 'a src-first layout';
	}

	return undefined;
}

function buildWorkspaceSignalLabels(topLevelSignals: readonly string[]): readonly string[] {
	const signalSet = new Set(topLevelSignals);
	const labels: string[] = [];

	if (signalSet.has('pnpm-workspace.yaml')) {
		labels.push('pnpm workspace');
	}

	if (signalSet.has('turbo.json')) {
		labels.push('Turborepo');
	}

	if (signalSet.has('nx.json')) {
		labels.push('Nx workspace');
	}

	return labels;
}

function buildPlatformHintLabels(projectTypeHints: readonly ProjectTypeHint[]): readonly string[] {
	const hintSet = new Set(projectTypeHints);
	const labels: string[] = [];

	if (hintSet.has('nextjs')) {
		labels.push('Next.js');
	} else if (hintSet.has('react')) {
		labels.push('React');
	}

	if (hintSet.has('vite')) {
		labels.push('Vite');
	}

	if (hintSet.has('fastify-server')) {
		labels.push('Fastify');
	} else if (hintSet.has('express-server')) {
		labels.push('Express');
	} else if (hintSet.has('hono-server')) {
		labels.push('Hono');
	}

	if (labels.length === 0 && hintSet.has('node-cli')) {
		labels.push('Node CLI');
	}

	if (labels.length === 0 && hintSet.has('vitest')) {
		labels.push('Vitest tests');
	} else if (labels.length === 0 && hintSet.has('jest')) {
		labels.push('Jest tests');
	}

	return labels.slice(0, 3);
}

function buildWorkspaceSummary(input: {
	readonly dependency_hints: readonly string[];
	readonly project_name?: string;
	readonly project_type_hints: readonly ProjectTypeHint[];
	readonly readme_summary?: string;
	readonly top_level_signals: readonly string[];
}): string {
	const clauses: string[] = [];
	const subject = buildWorkspaceSubject({
		project_name: input.project_name,
		project_type_hints: input.project_type_hints,
	});

	const layoutPhrase = buildLayoutPhrase(input.top_level_signals);

	if (layoutPhrase) {
		clauses.push(layoutPhrase);
	}

	const workspaceSignalLabels = buildWorkspaceSignalLabels(input.top_level_signals);

	if (workspaceSignalLabels.length > 0) {
		clauses.push(`${joinLabels(workspaceSignalLabels)} signals`);
	}

	const platformHintLabels = buildPlatformHintLabels(input.project_type_hints);

	if (platformHintLabels.length > 0) {
		clauses.push(`${joinLabels(platformHintLabels)} hints`);
	}

	if (clauses.length === 0 && input.dependency_hints.length > 0) {
		clauses.push(`${joinLabels(input.dependency_hints.slice(0, 3))} dependency hints`);
	}

	const parts: string[] = [];

	if (clauses.length > 0) {
		const verb = subject.mode === 'with' ? ' with ' : ' includes ';
		parts.push(`${subject.text}${verb}${joinLabels(clauses)}.`);
	}

	if (input.readme_summary) {
		const orientingReadmeSummary =
			clauses.length > 0
				? takeLeadingSentences(input.readme_summary, 1)
				: takeLeadingSentences(input.readme_summary, MAX_README_SENTENCES);

		if (orientingReadmeSummary) {
			parts.push(orientingReadmeSummary);
		}
	}

	return truncateText(normalizeText(parts.join(' ')), DEFAULT_SUMMARY_CHAR_BUDGET);
}

export async function composeWorkspaceContext(
	input: ComposeWorkspaceContextInput,
): Promise<ComposeWorkspaceContextResult> {
	const readmeCharBudget = normalizePositiveInteger(
		input.readme_char_budget,
		'INVALID_README_CHAR_BUDGET',
		'readme_char_budget',
		DEFAULT_README_CHAR_BUDGET,
	);

	if (isFailureResult(readmeCharBudget)) {
		return readmeCharBudget;
	}

	const maxTopLevelEntries = normalizePositiveInteger(
		input.max_top_level_entries,
		'INVALID_MAX_TOP_LEVEL_ENTRIES',
		'max_top_level_entries',
		DEFAULT_MAX_TOP_LEVEL_ENTRIES,
	);

	if (isFailureResult(maxTopLevelEntries)) {
		return maxTopLevelEntries;
	}

	const workingDirectory = await validateWorkingDirectory(input.working_directory);

	if (typeof workingDirectory !== 'string') {
		return workingDirectory;
	}

	try {
		const runaIgnoreMatcher = await loadRunaIgnoreMatcher(workingDirectory);
		const [packageJsonSignals, readmeSignals, topLevelSignals] = await Promise.all([
			readPackageJsonSignals(workingDirectory, runaIgnoreMatcher),
			readReadmeSignals(workingDirectory, readmeCharBudget, runaIgnoreMatcher),
			readTopLevelSignals(workingDirectory, maxTopLevelEntries, runaIgnoreMatcher),
		]);

		const signalsUsed: WorkspaceSignalSource[] = [];

		if (packageJsonSignals) {
			signalsUsed.push('package_json');
		}

		if (readmeSignals) {
			signalsUsed.push('readme');
		}

		if (topLevelSignals.length > 0) {
			signalsUsed.push('top_level_entries');
		}

		const projectTypeHints = inferProjectTypeHints({
			all_dependency_names: packageJsonSignals?.all_dependency_names ?? [],
			has_workspaces: packageJsonSignals?.has_workspaces ?? false,
			top_level_signals: topLevelSignals,
		});

		const summary = buildWorkspaceSummary({
			dependency_hints: packageJsonSignals?.dependency_hints ?? [],
			project_name: packageJsonSignals?.project_name,
			project_type_hints: projectTypeHints,
			readme_summary: readmeSignals?.summary,
			top_level_signals: topLevelSignals,
		});

		if (!summary) {
			return {
				signals_used: [],
				status: 'no_workspace_layer',
			};
		}

		return {
			signals_used: signalsUsed,
			status: 'workspace_layer_created',
			workspace_layer: {
				content: {
					dependency_hints: packageJsonSignals?.dependency_hints ?? [],
					layer_type: 'workspace_layer',
					project_name: packageJsonSignals?.project_name,
					project_type_hints: projectTypeHints,
					scripts: packageJsonSignals?.scripts ?? [],
					summary,
					title: readmeSignals?.title ?? packageJsonSignals?.project_name ?? WORKSPACE_LAYER_TITLE,
					top_level_signals: topLevelSignals,
				},
				kind: 'workspace',
				name: 'workspace_layer',
			},
		};
	} catch {
		return createFailure(
			'WORKSPACE_READ_FAILED',
			'composeWorkspaceContext failed to read workspace signals.',
		);
	}
}
