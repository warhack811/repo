export type EnvAuthoritySource =
	| '.env'
	| '.env.compose'
	| '.env.local'
	| 'client_config'
	| 'default'
	| 'missing'
	| 'process_env';

export interface EnvFileValues {
	readonly label: '.env' | '.env.compose' | '.env.local';
	readonly values: Readonly<Record<string, string | undefined>>;
}

export interface EnvAuthorityReport {
	readonly authoritative: boolean;
	readonly loaded_file_labels: readonly string[];
	readonly masked_preview?: string;
	readonly missing_required_names: readonly string[];
	readonly name: string;
	readonly present: boolean;
	readonly resolved_from: string | null;
	readonly source: EnvAuthoritySource;
}

export interface ResolvedEnvAuthority {
	readonly report: EnvAuthorityReport;
	readonly value: string | undefined;
}

export interface ResolveEnvAuthorityInput {
	readonly clientValue?: string;
	readonly defaultValue?: string;
	readonly env?: Readonly<Record<string, string | undefined>>;
	readonly files?: readonly EnvFileValues[];
	readonly name: string;
	readonly required?: boolean;
}

export const DEFAULT_ENV_FILE_PRECEDENCE: readonly EnvFileValues['label'][] = [
	'.env.local',
	'.env',
	'.env.compose',
];

export function normalizeEnvValue(rawValue: string): string {
	const trimmedValue = rawValue.trim();

	if (
		(trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
		(trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
	) {
		return trimmedValue.slice(1, -1);
	}

	return trimmedValue;
}

export function parseEnvFileText(text: string): Record<string, string> {
	const values: Record<string, string> = {};

	for (const line of text.split(/\r?\n/u)) {
		const trimmedLine = line.trim();

		if (trimmedLine.length === 0 || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
			continue;
		}

		const separatorIndex = trimmedLine.indexOf('=');

		if (separatorIndex <= 0) {
			continue;
		}

		const key = trimmedLine.slice(0, separatorIndex).trim();
		const value = normalizeEnvValue(trimmedLine.slice(separatorIndex + 1));

		if (key.length > 0 && value.length > 0) {
			values[key] = value;
		}
	}

	return values;
}

export function maskSecret(value: string | undefined): string | undefined {
	if (!value) {
		return undefined;
	}

	if (value.length <= 8) {
		return `${value.slice(0, 2)}...${value.slice(-2)}`;
	}

	return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function readPresentValue(value: string | undefined): string | undefined {
	const normalized = value?.trim();

	return normalized && normalized.length > 0 ? normalized : undefined;
}

function resolveFileValue(
	name: string,
	files: readonly EnvFileValues[],
): { readonly source: EnvFileValues['label']; readonly value: string } | undefined {
	for (const label of DEFAULT_ENV_FILE_PRECEDENCE) {
		const file = files.find((candidate) => candidate.label === label);
		const value = readPresentValue(file?.values[name]);

		if (value) {
			return {
				source: label,
				value,
			};
		}
	}

	return undefined;
}

export function resolveEnvAuthority(input: ResolveEnvAuthorityInput): ResolvedEnvAuthority {
	const env = input.env ?? process.env;
	const files = input.files ?? [];
	const loadedFileLabels = files.map((file) => file.label);
	const clientValue = readPresentValue(input.clientValue);
	const processValue = readPresentValue(env[input.name]);
	const fileValue = resolveFileValue(input.name, files);
	const defaultValue = readPresentValue(input.defaultValue);

	const resolved =
		clientValue !== undefined
			? { resolvedFrom: 'client_config', source: 'client_config' as const, value: clientValue }
			: processValue !== undefined
				? { resolvedFrom: input.name, source: 'process_env' as const, value: processValue }
				: fileValue !== undefined
					? { resolvedFrom: input.name, source: fileValue.source, value: fileValue.value }
					: defaultValue !== undefined
						? { resolvedFrom: 'default', source: 'default' as const, value: defaultValue }
						: { resolvedFrom: null, source: 'missing' as const, value: undefined };

	const source: EnvAuthoritySource = resolved.source;
	const value = resolved.value;
	const present = value !== undefined && source !== 'missing';
	const authoritative = present && source !== 'default';

	return {
		report: {
			authoritative,
			loaded_file_labels: loadedFileLabels,
			masked_preview: authoritative ? maskSecret(value) : undefined,
			missing_required_names: input.required && !authoritative ? [input.name] : [],
			name: input.name,
			present,
			resolved_from: resolved.resolvedFrom,
			source,
		},
		value,
	};
}
