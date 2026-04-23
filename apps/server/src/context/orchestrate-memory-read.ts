import type { MemoryScope } from '@runa/types';

import type { MemoryStore } from '../persistence/memory-store.js';

import {
	type ComposeMemoryContextFailureResult,
	type ComposeMemoryContextResult,
	type MemoryLayer,
	composeMemoryContext,
} from './compose-memory-context.js';

type ReadableMemoryStore = Pick<MemoryStore, 'listActiveMemories'>;

interface OrchestrateMemoryReadFailure {
	readonly code: 'MEMORY_CONTEXT_COMPOSITION_FAILED';
	readonly message: string;
	readonly source_failure_code?: ComposeMemoryContextFailureResult['failure']['code'];
}

export interface OrchestrateMemoryReadInput {
	readonly limit?: number;
	readonly memory_store?: ReadableMemoryStore;
	readonly query?: string;
	readonly scope: MemoryScope;
	readonly scope_id: string;
}

export interface MemoryReadLayerCreatedResult {
	readonly compose_result: Extract<ComposeMemoryContextResult, { status: 'memory_layer_created' }>;
	readonly memory_count: number;
	readonly memory_layer: MemoryLayer;
	readonly status: 'memory_layer_created';
}

export interface NoMemoryReadLayerResult {
	readonly compose_result: Extract<ComposeMemoryContextResult, { status: 'no_memory_layer' }>;
	readonly memory_count: 0;
	readonly status: 'no_memory_layer';
}

export interface OrchestrateMemoryReadFailureResult {
	readonly compose_result: ComposeMemoryContextFailureResult;
	readonly failure: OrchestrateMemoryReadFailure;
	readonly memory_count: 0;
	readonly status: 'failed';
}

export type OrchestrateMemoryReadResult =
	| MemoryReadLayerCreatedResult
	| NoMemoryReadLayerResult
	| OrchestrateMemoryReadFailureResult;

export async function orchestrateMemoryRead(
	input: OrchestrateMemoryReadInput,
): Promise<OrchestrateMemoryReadResult> {
	const composeResult = await composeMemoryContext({
		limit: input.limit,
		memory_store: input.memory_store,
		query: input.query,
		scope: input.scope,
		scope_id: input.scope_id,
	});

	if (composeResult.status === 'failed') {
		return {
			compose_result: composeResult,
			failure: {
				code: 'MEMORY_CONTEXT_COMPOSITION_FAILED',
				message: composeResult.failure.message,
				source_failure_code: composeResult.failure.code,
			},
			memory_count: 0,
			status: 'failed',
		};
	}

	if (composeResult.status === 'no_memory_layer') {
		return {
			compose_result: composeResult,
			memory_count: 0,
			status: 'no_memory_layer',
		};
	}

	return {
		compose_result: composeResult,
		memory_count: composeResult.memory_count,
		memory_layer: composeResult.memory_layer,
		status: 'memory_layer_created',
	};
}
