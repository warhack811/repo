export type TerminalOutputKind = 'command' | 'stdout' | 'stderr' | 'preview';

export type TerminalOutputSection = Readonly<{
	kind: TerminalOutputKind;
	label: string;
	value: string;
	truncated: boolean;
	originalLineCount: number;
	visibleLineCount: number;
}>;

const DEFAULT_MAX_CHARS = 6000;
const DEFAULT_MAX_LINES = 160;

function normalizeNewlines(input: string): string {
	return input.replace(/\r\n?/g, '\n');
}

function clampLimit(value: number | undefined, fallback: number): number {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
		return fallback;
	}

	return Math.floor(value);
}

function getSectionLabel(kind: TerminalOutputKind): string {
	switch (kind) {
		case 'command':
			return 'Komut';
		case 'stdout':
			return 'stdout';
		case 'stderr':
			return 'stderr';
		case 'preview':
			return 'Sonuç önizlemesi';
	}
}

export function redactTerminalText(input: string): string {
	let output = input;

	output = output.replace(
		/(access_token|refresh_token|ws_ticket)\s*=\s*([^&\s]+)/gi,
		(_, key: string) => `${key}=[redacted]`,
	);
	output = output.replace(
		/Authorization\s*:\s*Bearer\s+[A-Za-z0-9\-._~+/=]{8,}/gi,
		'Authorization: Bearer [redacted]',
	);
	output = output.replace(
		/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g,
		'[redacted-jwt]',
	);
	output = output.replace(
		/\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,
		'[redacted-jwt]',
	);
	output = output.replace(/\b(?:sk-|gsk_)[A-Za-z0-9_-]{10,}\b/g, '[redacted-key]');

	return output;
}

export function formatTerminalOutputSection(
	kind: TerminalOutputKind,
	input: string | undefined,
	options?: {
		readonly maxChars?: number;
		readonly maxLines?: number;
	},
): TerminalOutputSection | null {
	if (typeof input !== 'string') {
		return null;
	}

	const normalized = normalizeNewlines(input);
	if (normalized.trim().length === 0) {
		return null;
	}

	const redacted = redactTerminalText(normalized);
	const lines = redacted.split('\n');
	const originalLineCount = lines.length;
	const maxLines = clampLimit(options?.maxLines, DEFAULT_MAX_LINES);
	const maxChars = clampLimit(options?.maxChars, DEFAULT_MAX_CHARS);

	let visible = lines.slice(0, maxLines).join('\n');
	let truncated = originalLineCount > maxLines;

	if (visible.length > maxChars) {
		visible = visible.slice(0, maxChars);
		truncated = true;
	}

	const visibleLineCount = visible.split('\n').length;

	return {
		kind,
		label: getSectionLabel(kind),
		originalLineCount,
		truncated,
		value: visible,
		visibleLineCount,
	};
}

export function formatTerminalCopyText(input: string | undefined): string | undefined {
	if (typeof input !== 'string') {
		return undefined;
	}

	const normalized = normalizeNewlines(input);
	if (normalized.trim().length === 0) {
		return undefined;
	}

	return redactTerminalText(normalized);
}

export function formatDurationLabel(durationMs: number | undefined): string | undefined {
	if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) {
		return undefined;
	}

	if (durationMs < 1000) {
		return `${Math.round(durationMs)} ms`;
	}

	const seconds = Math.round((durationMs / 1000) * 10) / 10;
	return `yaklaşık ${seconds} sn`;
}
