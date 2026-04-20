import type { MemoryRecord, MemoryWriteCandidate } from '@runa/types';

import {
	type MemoryStore,
	MemoryStoreConfigurationError,
	MemoryStoreReadError,
	defaultMemoryStore,
} from '../persistence/memory-store.js';

type ReadableMemoryStore = Pick<MemoryStore, 'listActiveMemories'>;

interface RefineMemoryLifecycleFailure {
	readonly code: 'MEMORY_STORE_CONFIGURATION_FAILED' | 'MEMORY_STORE_READ_FAILED';
	readonly message: string;
}

export interface MemoryLifecycleAction {
	readonly action: 'supersede_previous';
	readonly memory_id: string;
}

export interface RefineMemoryLifecycleInput {
	readonly candidate: MemoryWriteCandidate;
	readonly existing_memories?: readonly MemoryRecord[];
	readonly memory_store?: ReadableMemoryStore;
}

export interface MemoryLifecycleNoChangeResult {
	readonly candidate: MemoryWriteCandidate;
	readonly lifecycle_actions: readonly [];
	readonly status: 'write_without_lifecycle_change';
}

export interface MemoryLifecycleSupersedeResult {
	readonly candidate: MemoryWriteCandidate;
	readonly lifecycle_actions: readonly [MemoryLifecycleAction];
	readonly matched_memory_id: string;
	readonly status: 'write_and_supersede_previous';
}

export interface RefineMemoryLifecycleFailureResult {
	readonly failure: RefineMemoryLifecycleFailure;
	readonly status: 'failed';
}

export type RefineMemoryLifecycleResult =
	| MemoryLifecycleNoChangeResult
	| MemoryLifecycleSupersedeResult
	| RefineMemoryLifecycleFailureResult;

function normalizeText(text: string): string {
	return text.replace(/\s+/gu, ' ').trim();
}

function toComparableText(text: string): string {
	return normalizeText(text).toLocaleLowerCase('en-US');
}

function compareLifecycleCandidates(left: MemoryRecord, right: MemoryRecord): number {
	const updatedAtComparison = right.updated_at.localeCompare(left.updated_at);

	if (updatedAtComparison !== 0) {
		return updatedAtComparison;
	}

	return left.memory_id.localeCompare(right.memory_id);
}

function isSupersedeMatch(candidate: MemoryWriteCandidate, memory: MemoryRecord): boolean {
	if (
		memory.status !== 'active' ||
		memory.scope !== candidate.scope ||
		memory.scope_id !== candidate.scope_id ||
		memory.source_kind !== candidate.source_kind
	) {
		return false;
	}

	const candidateSummary = toComparableText(candidate.summary);
	const memorySummary = toComparableText(memory.summary);

	if (!candidateSummary || candidateSummary !== memorySummary) {
		return false;
	}

	const candidateContent = toComparableText(candidate.content);
	const memoryContent = toComparableText(memory.content);

	return Boolean(candidateContent) && candidateContent !== memoryContent;
}

function createFailure(
	code: RefineMemoryLifecycleFailure['code'],
	message: string,
): RefineMemoryLifecycleFailureResult {
	return {
		failure: {
			code,
			message,
		},
		status: 'failed',
	};
}

async function readExistingMemories(
	input: RefineMemoryLifecycleInput,
): Promise<readonly MemoryRecord[] | RefineMemoryLifecycleFailureResult> {
	if (input.existing_memories) {
		return input.existing_memories;
	}

	const memoryStore = input.memory_store ?? defaultMemoryStore;

	try {
		return await memoryStore.listActiveMemories(input.candidate.scope, input.candidate.scope_id);
	} catch (error) {
		if (error instanceof MemoryStoreConfigurationError) {
			return createFailure('MEMORY_STORE_CONFIGURATION_FAILED', error.message);
		}

		if (error instanceof MemoryStoreReadError) {
			return createFailure('MEMORY_STORE_READ_FAILED', error.message);
		}

		return createFailure('MEMORY_STORE_READ_FAILED', 'Failed to read active memories.');
	}
}

function isFailureResult(
	result: readonly MemoryRecord[] | RefineMemoryLifecycleFailureResult,
): result is RefineMemoryLifecycleFailureResult {
	return !Array.isArray(result);
}

export async function refineMemoryLifecycle(
	input: RefineMemoryLifecycleInput,
): Promise<RefineMemoryLifecycleResult> {
	const existingMemories = await readExistingMemories(input);

	if (isFailureResult(existingMemories)) {
		return existingMemories;
	}

	const matchedMemory = [...existingMemories]
		.filter((memory) => isSupersedeMatch(input.candidate, memory))
		.sort(compareLifecycleCandidates)[0];

	if (!matchedMemory) {
		return {
			candidate: input.candidate,
			lifecycle_actions: [],
			status: 'write_without_lifecycle_change',
		};
	}

	return {
		candidate: input.candidate,
		lifecycle_actions: [
			{
				action: 'supersede_previous',
				memory_id: matchedMemory.memory_id,
			},
		],
		matched_memory_id: matchedMemory.memory_id,
		status: 'write_and_supersede_previous',
	};
}
