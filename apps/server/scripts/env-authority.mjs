import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const defaultEnvFileSpecs = [
	{ label: '.env.local', relativePath: '.env.local' },
	{ label: '.env', relativePath: '.env' },
	{ label: '.env.compose', relativePath: '.env.compose' },
];

export function normalizeEnvValue(rawValue) {
	const trimmedValue = rawValue.trim();

	if (
		(trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
		(trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
	) {
		return trimmedValue.slice(1, -1);
	}

	return trimmedValue;
}

export function parseEnvFileText(text) {
	const values = {};

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

export function loadEnvAuthorityFiles(repoRoot, specs = defaultEnvFileSpecs) {
	return specs.flatMap((spec) => {
		const filePath = resolve(repoRoot, spec.relativePath);

		if (!existsSync(filePath)) {
			return [];
		}

		return [
			{
				label: spec.label,
				path: filePath,
				values: parseEnvFileText(readFileSync(filePath, 'utf8')),
			},
		];
	});
}

export function readEnvValue(env, name) {
	const value = env[name];
	const trimmedValue = typeof value === 'string' ? value.trim() : '';

	return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export function maskSecret(value) {
	if (!value) {
		return undefined;
	}

	if (value.length <= 8) {
		return `${value.slice(0, 2)}...${value.slice(-2)}`;
	}

	return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function resolveFileValue(files, name) {
	for (const spec of defaultEnvFileSpecs) {
		const file = files.find((candidate) => candidate.label === spec.label);
		const value = readEnvValue(file?.values ?? {}, name);

		if (value) {
			return {
				source: file.label,
				value,
			};
		}
	}

	return undefined;
}

export function resolveEnvAuthority({
	clientValue,
	defaultValue,
	env = process.env,
	files = [],
	name,
	required = false,
}) {
	const loadedFileLabels = files.map((file) => file.label);
	const resolvedClientValue = readEnvValue({ clientValue }, 'clientValue');
	const processValue = readEnvValue(env, name);
	const fileValue = resolveFileValue(files, name);
	const resolvedDefaultValue = readEnvValue({ defaultValue }, 'defaultValue');

	const resolved =
		resolvedClientValue !== undefined
			? { resolvedFrom: 'client_config', source: 'client_config', value: resolvedClientValue }
			: processValue !== undefined
				? { resolvedFrom: name, source: 'process_env', value: processValue }
				: fileValue !== undefined
					? { resolvedFrom: name, source: fileValue.source, value: fileValue.value }
					: resolvedDefaultValue !== undefined
						? { resolvedFrom: 'default', source: 'default', value: resolvedDefaultValue }
						: { resolvedFrom: null, source: 'missing', value: undefined };

	const authoritative = resolved.value !== undefined && resolved.source !== 'default';

	return {
		report: {
			authoritative,
			loaded_file_labels: loadedFileLabels,
			masked_preview: authoritative ? maskSecret(resolved.value) : undefined,
			missing_required_names: required && !authoritative ? [name] : [],
			name,
			present: resolved.value !== undefined && resolved.source !== 'missing',
			resolved_from: resolved.resolvedFrom,
			source: resolved.source,
		},
		value: resolved.value,
	};
}

export function buildProviderAuthoritySummary({
	aliasEnv = null,
	apiKeyAuthority,
	authoritativeEnv,
	legacyNonAuthoritativeEnvs,
	modelAuthorities = {},
}) {
	return {
		api_key_authority: {
			alias_env: aliasEnv,
			authoritative: apiKeyAuthority.report.authoritative,
			authoritative_env: authoritativeEnv,
			legacy_non_authoritative_envs: legacyNonAuthoritativeEnvs,
			loaded_file_labels: apiKeyAuthority.report.loaded_file_labels,
			masked_preview: apiKeyAuthority.report.masked_preview,
			missing_required_names: apiKeyAuthority.report.missing_required_names,
			present: apiKeyAuthority.report.present,
			resolved_from: apiKeyAuthority.report.resolved_from,
			source: apiKeyAuthority.report.source,
		},
		env_example_authoritative: false,
		model_authority: modelAuthorities,
	};
}

export function applyFileBackedEnvironment(env, files) {
	const merged = { ...env };
	const loadedKeysByFile = {};

	for (const spec of [...defaultEnvFileSpecs].reverse()) {
		const file = files.find((candidate) => candidate.label === spec.label);

		if (!file) {
			continue;
		}

		let loadedKeys = 0;

		for (const [key, value] of Object.entries(file.values)) {
			if (readEnvValue(env, key) !== undefined) {
				continue;
			}

			const currentValue = readEnvValue(merged, key);

			if (currentValue === value) {
				continue;
			}

			merged[key] = value;
			loadedKeys += 1;
		}

		loadedKeysByFile[file.label] = loadedKeys;
	}

	return {
		env: merged,
		summary: {
			file_backed_subprocess_env: true,
			loaded_file_labels: files.map((file) => file.label),
			loaded_keys_by_file: loadedKeysByFile,
			shell_env_preserved: true,
		},
	};
}
