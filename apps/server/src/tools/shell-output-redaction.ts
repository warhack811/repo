import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parseEnvFileText } from '../config/env-authority.js';

const ENV_FILE_LABELS = ['.env.local', '.env', '.env.compose'] as const;
const REDACTED_SECRET = '[REDACTED_SECRET]';
const REDACTED_DATABASE_PASSWORD = '[REDACTED_DATABASE_PASSWORD]';

type EnvFileLabel = (typeof ENV_FILE_LABELS)[number];

export interface ShellOutputRedactionMetadata {
	readonly redaction_applied: boolean;
	readonly redacted_occurrence_count: number;
	readonly redacted_source_kinds: readonly string[];
	readonly secret_values_exposed: false;
}

export interface ShellOutputRedactionContext {
	readonly env?: Readonly<Record<string, string | undefined>>;
	readonly files?: readonly Readonly<{
		readonly label: EnvFileLabel;
		readonly values: Readonly<Record<string, string | undefined>>;
	}>[];
	readonly workspace_path?: string;
}

export interface ShellOutputRedactionResult {
	readonly metadata: ShellOutputRedactionMetadata;
	readonly text: string;
}

export interface ShellOutputSecretCandidate {
	readonly source_kind: string;
	readonly value: string;
}

const SENSITIVE_ENV_NAME_PATTERN =
	/(?:KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL|CONNECTION_STRING|PRIVATE|CREDENTIAL)/iu;
const LOW_SIGNAL_VALUES = new Set([
	'0',
	'1',
	'development',
	'false',
	'local',
	'none',
	'null',
	'test',
	'true',
	'undefined',
]);

const TOKEN_PATTERNS: readonly Readonly<{
	readonly pattern: RegExp;
	readonly replacement: string;
	readonly source_kind: string;
}>[] = [
	{
		pattern: /\bsk-[A-Za-z0-9_-]{8,}\b/gu,
		replacement: REDACTED_SECRET,
		source_kind: 'token_pattern',
	},
	{
		pattern: /\bgsk_[A-Za-z0-9_-]{8,}\b/gu,
		replacement: REDACTED_SECRET,
		source_kind: 'token_pattern',
	},
	{
		pattern: /\bsb_publishable_[A-Za-z0-9_-]{8,}\b/gu,
		replacement: REDACTED_SECRET,
		source_kind: 'token_pattern',
	},
	{
		pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{8,}\b/gu,
		replacement: REDACTED_SECRET,
		source_kind: 'token_pattern',
	},
	{
		pattern: /(postgres(?:ql)?:\/\/[^:\s/@]+:)([^@\s/]{8,})(@)/giu,
		replacement: `$1${REDACTED_DATABASE_PASSWORD}$3`,
		source_kind: 'database_url_password',
	},
];

function isSensitiveEnvName(name: string): boolean {
	return SENSITIVE_ENV_NAME_PATTERN.test(name);
}

function isHighSignalSecretValue(value: string | undefined): value is string {
	if (value === undefined) {
		return false;
	}

	const trimmed = value.trim();

	if (trimmed.length < 8) {
		return false;
	}

	return !LOW_SIGNAL_VALUES.has(trimmed.toLowerCase());
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function buildLiteralCandidates(
	value: string,
	sourceKind: string,
): readonly ShellOutputSecretCandidate[] {
	const candidates: ShellOutputSecretCandidate[] = [
		{
			source_kind: sourceKind,
			value,
		},
	];

	if (value.length > 24) {
		const prefix = value.slice(0, 16);
		const suffix = value.slice(-16);

		if (isHighSignalSecretValue(prefix)) {
			candidates.push({
				source_kind: sourceKind,
				value: prefix,
			});
		}

		if (suffix !== prefix && isHighSignalSecretValue(suffix)) {
			candidates.push({
				source_kind: sourceKind,
				value: suffix,
			});
		}
	}

	return candidates;
}

function collectSecretCandidatesFromValues(
	values: Readonly<Record<string, string | undefined>>,
	sourceKind: string,
): readonly ShellOutputSecretCandidate[] {
	const candidates: ShellOutputSecretCandidate[] = [];

	for (const [name, value] of Object.entries(values)) {
		if (!isSensitiveEnvName(name) || !isHighSignalSecretValue(value)) {
			continue;
		}

		candidates.push(...buildLiteralCandidates(value.trim(), sourceKind));
	}

	return candidates;
}

export function buildShellOutputSecretCandidates(
	context: ShellOutputRedactionContext = {},
): readonly ShellOutputSecretCandidate[] {
	const env = context.env ?? process.env;
	const candidates = [
		...collectSecretCandidatesFromValues(env, 'process_env'),
		...(context.files ?? []).flatMap((file) =>
			collectSecretCandidatesFromValues(file.values, file.label),
		),
	];
	const seen = new Set<string>();

	return candidates
		.sort((left, right) => right.value.length - left.value.length)
		.filter((candidate) => {
			const key = `${candidate.source_kind}:${candidate.value}`;

			if (seen.has(key)) {
				return false;
			}

			seen.add(key);
			return true;
		});
}

async function readEnvFile(workspacePath: string, label: EnvFileLabel) {
	try {
		const text = await readFile(join(workspacePath, label), 'utf8');

		return {
			label,
			values: parseEnvFileText(text),
		};
	} catch (error: unknown) {
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
			return undefined;
		}

		throw error;
	}
}

export async function loadShellOutputRedactionContext(
	workspacePath: string,
	env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<ShellOutputRedactionContext> {
	const files = (
		await Promise.all(ENV_FILE_LABELS.map((label) => readEnvFile(workspacePath, label)))
	).filter((file): file is NonNullable<typeof file> => file !== undefined);

	return {
		env,
		files,
		workspace_path: workspacePath,
	};
}

function applyPatternRedaction(
	text: string,
	metadata: {
		occurrenceCount: number;
		sourceKinds: Set<string>;
	},
): string {
	let redacted = text;

	for (const { pattern, replacement, source_kind } of TOKEN_PATTERNS) {
		redacted = redacted.replace(pattern, (...args: readonly unknown[]) => {
			const match = args[0];

			if (typeof match !== 'string') {
				return replacement;
			}

			metadata.occurrenceCount += 1;
			metadata.sourceKinds.add(source_kind);

			if (source_kind === 'database_url_password') {
				const prefix = typeof args[1] === 'string' ? args[1] : '';
				const suffix = typeof args[3] === 'string' ? args[3] : '';

				return `${prefix}${REDACTED_DATABASE_PASSWORD}${suffix}`;
			}

			return replacement;
		});
	}

	return redacted;
}

function applyLiteralRedaction(
	text: string,
	candidates: readonly ShellOutputSecretCandidate[],
	metadata: {
		occurrenceCount: number;
		sourceKinds: Set<string>;
	},
): string {
	let redacted = text;

	for (const candidate of candidates) {
		const pattern = new RegExp(escapeRegExp(candidate.value), 'gu');

		redacted = redacted.replace(pattern, () => {
			metadata.occurrenceCount += 1;
			metadata.sourceKinds.add(candidate.source_kind);
			return REDACTED_SECRET;
		});
	}

	return redacted;
}

export function redactShellOutput(
	text: string,
	context: ShellOutputRedactionContext = {},
): ShellOutputRedactionResult {
	const metadataState = {
		occurrenceCount: 0,
		sourceKinds: new Set<string>(),
	};
	const secretCandidates = buildShellOutputSecretCandidates(context);
	const patternRedactedText = applyPatternRedaction(text, metadataState);
	const redactedText = applyLiteralRedaction(patternRedactedText, secretCandidates, metadataState);
	const redactedSourceKinds = [...metadataState.sourceKinds].sort();

	return {
		metadata: {
			redaction_applied: metadataState.occurrenceCount > 0,
			redacted_occurrence_count: metadataState.occurrenceCount,
			redacted_source_kinds: redactedSourceKinds,
			secret_values_exposed: false,
		},
		text: redactedText,
	};
}

export function combineShellOutputRedactionMetadata(
	metadata: readonly ShellOutputRedactionMetadata[],
): ShellOutputRedactionMetadata {
	const occurrenceCount = metadata.reduce(
		(total, item) => total + item.redacted_occurrence_count,
		0,
	);
	const sourceKinds = new Set<string>();

	for (const item of metadata) {
		for (const sourceKind of item.redacted_source_kinds) {
			sourceKinds.add(sourceKind);
		}
	}

	return {
		redaction_applied: occurrenceCount > 0,
		redacted_occurrence_count: occurrenceCount,
		redacted_source_kinds: [...sourceKinds].sort(),
		secret_values_exposed: false,
	};
}
