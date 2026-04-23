import type { MemoryRecord, MemoryScope } from '@runa/types';

import { retrieveSemanticMemories } from '../memory/retrieve-semantic-memories.js';
import {
	type MemoryStore,
	MemoryStoreConfigurationError,
	MemoryStoreReadError,
	defaultMemoryStore,
} from '../persistence/memory-store.js';
import {
	type MemoryPromptLayer,
	type MemoryPromptLayerItemInput,
	buildMemoryPromptLayer,
} from './build-memory-prompt-layer.js';

type ReadableMemoryStore = Pick<MemoryStore, 'listActiveMemories'>;

export interface MemoryLayer {
	readonly content: MemoryPromptLayer;
	readonly kind: 'memory';
	readonly name: 'memory_layer';
}

interface ComposeMemoryContextFailure {
	readonly code:
		| 'INVALID_SCOPE_ID'
		| 'MEMORY_STORE_CONFIGURATION_FAILED'
		| 'MEMORY_PROMPT_LAYER_FAILED'
		| 'MEMORY_STORE_READ_FAILED';
	readonly message: string;
}

export interface ComposeMemoryContextInput {
	readonly limit?: number;
	readonly memory_store?: ReadableMemoryStore;
	readonly query?: string;
	readonly scope: MemoryScope;
	readonly scope_id: string;
}

export interface MemoryLayerCreatedResult {
	readonly memory_count: number;
	readonly memory_layer: MemoryLayer;
	readonly status: 'memory_layer_created';
}

export interface NoMemoryLayerResult {
	readonly memory_count: 0;
	readonly status: 'no_memory_layer';
}

export interface ComposeMemoryContextFailureResult {
	readonly failure: ComposeMemoryContextFailure;
	readonly memory_count: 0;
	readonly status: 'failed';
}

export type ComposeMemoryContextResult =
	| ComposeMemoryContextFailureResult
	| MemoryLayerCreatedResult
	| NoMemoryLayerResult;

function normalizeText(text: string): string {
	return text.replace(/\s+/gu, ' ').trim();
}

function isValidScopeId(scopeId: string): boolean {
	return normalizeText(scopeId).length > 0;
}

function normalizeLimit(limit?: number): number | undefined {
	if (limit === undefined) {
		return undefined;
	}

	if (!Number.isFinite(limit) || limit < 1) {
		return undefined;
	}

	return Math.trunc(limit);
}

function toMemoryPromptLayerItem(record: MemoryRecord): MemoryPromptLayerItemInput {
	return {
		content: record.content,
		source_kind: record.source_kind,
		summary: record.summary,
	};
}

function createFailure(
	code: ComposeMemoryContextFailure['code'],
	message: string,
): ComposeMemoryContextFailureResult {
	return {
		failure: {
			code,
			message,
		},
		memory_count: 0,
		status: 'failed',
	};
}

export async function composeMemoryContext(
	input: ComposeMemoryContextInput,
): Promise<ComposeMemoryContextResult> {
	if (!isValidScopeId(input.scope_id)) {
		return createFailure('INVALID_SCOPE_ID', 'composeMemoryContext requires a non-empty scope_id.');
	}

	const memoryStore = input.memory_store ?? defaultMemoryStore;

	let records: readonly MemoryRecord[];

	try {
		records = await retrieveSemanticMemories({
			limit: input.limit,
			memory_store: memoryStore,
			query: input.query,
			scope: input.scope,
			scope_id: input.scope_id,
		});
	} catch (error) {
		if (error instanceof MemoryStoreConfigurationError) {
			return createFailure('MEMORY_STORE_CONFIGURATION_FAILED', error.message);
		}

		if (error instanceof MemoryStoreReadError) {
			return createFailure('MEMORY_STORE_READ_FAILED', error.message);
		}

		return createFailure('MEMORY_STORE_READ_FAILED', 'Failed to list active memories.');
	}

	const limit = normalizeLimit(input.limit);
	const limitedRecords = limit !== undefined ? records.slice(0, limit) : records;

	if (limitedRecords.length === 0) {
		return {
			memory_count: 0,
			status: 'no_memory_layer',
		};
	}

	const promptLayerResult = buildMemoryPromptLayer({
		entries: limitedRecords.map((record) => toMemoryPromptLayerItem(record)),
		max_items: limit,
	});

	if (promptLayerResult.status === 'failed') {
		return createFailure('MEMORY_PROMPT_LAYER_FAILED', promptLayerResult.failure.message);
	}

	if (promptLayerResult.status === 'no_prompt_layer') {
		return {
			memory_count: 0,
			status: 'no_memory_layer',
		};
	}

	return {
		memory_count: promptLayerResult.item_count,
		memory_layer: {
			content: promptLayerResult.prompt_layer,
			kind: 'memory',
			name: 'memory_layer',
		},
		status: 'memory_layer_created',
	};
}
