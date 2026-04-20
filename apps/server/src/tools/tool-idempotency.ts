import { createHash } from 'node:crypto';

import type { ToolName } from '@runa/types';

export interface ToolEffectIdempotencyRecord {
	readonly applied_at: string;
	readonly key: string;
	readonly run_id: string;
	readonly tool_name: ToolName;
}

export interface ToolEffectIdempotencyStore {
	clear(): void;
	get(key: string): ToolEffectIdempotencyRecord | undefined;
	markApplied(record: ToolEffectIdempotencyRecord): void;
}

export interface BuildToolEffectIdempotencyKeyInput {
	readonly payload: unknown;
	readonly run_id: string;
	readonly target: string;
	readonly tool_name: ToolName;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeForStableSerialization(value: unknown): unknown {
	if (
		value === null ||
		typeof value === 'boolean' ||
		typeof value === 'number' ||
		typeof value === 'string'
	) {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((entry) => normalizeForStableSerialization(entry));
	}

	if (isRecord(value)) {
		return Object.fromEntries(
			Object.keys(value)
				.sort((left, right) => left.localeCompare(right))
				.map((key) => [key, normalizeForStableSerialization(value[key])]),
		);
	}

	return String(value);
}

function stableSerialize(value: unknown): string {
	const serialized = JSON.stringify(normalizeForStableSerialization(value));

	return serialized ?? 'null';
}

export function buildToolEffectIdempotencyKey(input: BuildToolEffectIdempotencyKeyInput): string {
	const serialized = stableSerialize({
		payload: input.payload,
		run_id: input.run_id,
		target: input.target,
		tool_name: input.tool_name,
		version: 1,
	});
	const digest = createHash('sha256').update(serialized, 'utf8').digest('hex');

	return `${input.tool_name}:${digest}`;
}

export class InMemoryToolEffectIdempotencyStore implements ToolEffectIdempotencyStore {
	#records = new Map<string, ToolEffectIdempotencyRecord>();

	clear(): void {
		this.#records.clear();
	}

	get(key: string): ToolEffectIdempotencyRecord | undefined {
		return this.#records.get(key);
	}

	markApplied(record: ToolEffectIdempotencyRecord): void {
		this.#records.set(record.key, record);
	}
}

export const defaultToolEffectIdempotencyStore = new InMemoryToolEffectIdempotencyStore();

export function resetDefaultToolEffectIdempotencyStore(): void {
	defaultToolEffectIdempotencyStore.clear();
}
