import type { MemoryScope, MemorySourceKind, ToolExecutionContext } from '@runa/types';

export const memoryToolSources = ['explicit', 'inferred', 'conversation'] as const;

export type MemoryToolSource = (typeof memoryToolSources)[number];

export interface ResolvedMemoryScope {
	readonly scope: MemoryScope;
	readonly scope_id: string;
}

export interface SensitiveMemoryScanResult {
	readonly matched_categories: readonly string[];
	readonly safe_to_store: boolean;
}

const DEFAULT_USER_SCOPE_ID = 'local_default_user';
const MAX_SCOPE_ID_LENGTH = 512;
const SENSITIVE_PATTERNS: readonly {
	readonly category: string;
	readonly pattern: RegExp;
}[] = [
	{
		category: 'api_key',
		pattern: /\b(api[_\s-]?key|secret[_\s-]?key)\b\s*[:=]\s*\S{8,}/iu,
	},
	{
		category: 'password',
		pattern: /\b(pass(word)?|pwd)\b\s*[:=]\s*\S{6,}/iu,
	},
	{
		category: 'token',
		pattern:
			/\b(bearer|token|access[_\s-]?token|refresh[_\s-]?token)\b\s*[:=]?\s*[a-z0-9._~+/=-]{12,}/iu,
	},
	{
		category: 'provider_secret',
		pattern: /\b(sk-[a-z0-9_-]{16,}|ghp_[a-z0-9_]{16,}|xox[baprs]-[a-z0-9-]{16,})\b/iu,
	},
	{
		category: 'payment_data',
		pattern: /\b(?:\d[ -]*?){13,19}\b/u,
	},
	{
		category: 'payment_data',
		pattern: /\b(cvv|cvc|card number|credit card|payment card)\b/iu,
	},
];

function normalizeText(value: string): string {
	return value.replace(/\s+/gu, ' ').trim();
}

export function isMemoryToolSource(value: unknown): value is MemoryToolSource {
	return typeof value === 'string' && memoryToolSources.includes(value as MemoryToolSource);
}

export function isMemoryScope(value: unknown): value is MemoryScope {
	return value === 'user' || value === 'workspace';
}

export function resolveMemoryScope(
	scope: unknown,
	scopeId: unknown,
	context: ToolExecutionContext,
): ResolvedMemoryScope | undefined {
	const resolvedScope = scope === undefined ? 'workspace' : scope;

	if (!isMemoryScope(resolvedScope)) {
		return undefined;
	}

	const rawScopeId =
		typeof scopeId === 'string'
			? scopeId
			: resolvedScope === 'user'
				? DEFAULT_USER_SCOPE_ID
				: (context.working_directory ?? process.cwd());
	const normalizedScopeId = normalizeText(rawScopeId);

	if (!normalizedScopeId || normalizedScopeId.length > MAX_SCOPE_ID_LENGTH) {
		return undefined;
	}

	return {
		scope: resolvedScope,
		scope_id: normalizedScopeId,
	};
}

export function mapMemoryToolSource(source: MemoryToolSource): MemorySourceKind {
	switch (source) {
		case 'explicit':
			return 'explicit';
		case 'inferred':
			return 'inferred';
		case 'conversation':
			return 'conversation';
	}
}

export function normalizeMemoryText(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const normalized = normalizeText(value);
	return normalized.length > 0 ? normalized : undefined;
}

export function scanSensitiveMemoryContent(text: string): SensitiveMemoryScanResult {
	const matchedCategories = Array.from(
		new Set(
			SENSITIVE_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
				({ category }) => category,
			),
		),
	).sort();

	return {
		matched_categories: matchedCategories,
		safe_to_store: matchedCategories.length === 0,
	};
}

export function isConversationMemoryEnabled(
	environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
	const { RUNA_CONVERSATION_MEMORY_ENABLED } = environment;

	return RUNA_CONVERSATION_MEMORY_ENABLED === 'true';
}
