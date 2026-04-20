import type { MemoryRecord, MemoryWriteCandidate } from '@runa/types';

import {
	type MemoryStore,
	MemoryStoreConfigurationError,
	MemoryStoreReadError,
	defaultMemoryStore,
} from '../persistence/memory-store.js';

type ReadableMemoryStore = Pick<MemoryStore, 'listActiveMemories'>;

const MIN_MEMORY_CONTENT_LENGTH = 12;

const GENERIC_MEMORY_FINGERPRINTS = new Set<string>([
	'important note',
	'important preference',
	'noted',
	'remember that',
	'remember this',
	'user preference',
	'workspace preference',
]);

type DiscardReason =
	| 'content_too_short'
	| 'duplicate_active_memory'
	| 'empty_content'
	| 'generic_content';

interface SelectMemoryCandidateFailure {
	readonly code: 'MEMORY_STORE_CONFIGURATION_FAILED' | 'MEMORY_STORE_READ_FAILED';
	readonly message: string;
}

export interface SelectMemoryCandidateInput {
	readonly candidate: MemoryWriteCandidate;
	readonly existing_memories?: readonly MemoryRecord[];
	readonly memory_store?: ReadableMemoryStore;
}

export interface MemoryCandidateSelectedResult {
	readonly candidate: MemoryWriteCandidate;
	readonly reason: 'eligible';
	readonly status: 'selected';
}

export interface MemoryCandidateDiscardedResult {
	readonly matched_memory_id?: string;
	readonly reason: DiscardReason;
	readonly status: 'discarded';
}

export interface SelectMemoryCandidateFailureResult {
	readonly failure: SelectMemoryCandidateFailure;
	readonly status: 'failed';
}

export type SelectMemoryCandidateResult =
	| MemoryCandidateDiscardedResult
	| MemoryCandidateSelectedResult
	| SelectMemoryCandidateFailureResult;

function normalizeText(text: string): string {
	return text.replace(/\s+/gu, ' ').trim();
}

function toMemoryFingerprint(text: string): string {
	return normalizeText(text)
		.toLocaleLowerCase('en-US')
		.replace(/^[\s"'`()[\]{}.,;:!?-]+|[\s"'`()[\]{}.,;:!?-]+$/gu, '');
}

function hasMeaningfulText(text: string): boolean {
	return /[\p{L}\p{N}]/u.test(text);
}

function createFailure(
	code: SelectMemoryCandidateFailure['code'],
	message: string,
): SelectMemoryCandidateFailureResult {
	return {
		failure: {
			code,
			message,
		},
		status: 'failed',
	};
}

function isGenericCandidate(contentFingerprint: string, summaryFingerprint: string): boolean {
	return (
		GENERIC_MEMORY_FINGERPRINTS.has(contentFingerprint) ||
		GENERIC_MEMORY_FINGERPRINTS.has(summaryFingerprint)
	);
}

function findExactMemoryMatch(
	candidate: MemoryWriteCandidate,
	existingMemories: readonly MemoryRecord[],
): MemoryRecord | undefined {
	const candidateContentFingerprint = toMemoryFingerprint(candidate.content);

	return existingMemories.find((memory) => {
		if (
			memory.status !== 'active' ||
			memory.scope !== candidate.scope ||
			memory.scope_id !== candidate.scope_id
		) {
			return false;
		}

		return toMemoryFingerprint(memory.content) === candidateContentFingerprint;
	});
}

async function readExistingMemories(
	input: SelectMemoryCandidateInput,
): Promise<readonly MemoryRecord[] | SelectMemoryCandidateFailureResult> {
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

function isSelectionFailureResult(
	result: readonly MemoryRecord[] | SelectMemoryCandidateFailureResult,
): result is SelectMemoryCandidateFailureResult {
	return !Array.isArray(result);
}

export async function selectMemoryCandidate(
	input: SelectMemoryCandidateInput,
): Promise<SelectMemoryCandidateResult> {
	const contentFingerprint = toMemoryFingerprint(input.candidate.content);
	const summaryFingerprint = toMemoryFingerprint(input.candidate.summary);

	if (
		!contentFingerprint ||
		!summaryFingerprint ||
		!hasMeaningfulText(contentFingerprint) ||
		!hasMeaningfulText(summaryFingerprint)
	) {
		return {
			reason: 'empty_content',
			status: 'discarded',
		};
	}

	if (contentFingerprint.length < MIN_MEMORY_CONTENT_LENGTH) {
		return {
			reason: 'content_too_short',
			status: 'discarded',
		};
	}

	if (isGenericCandidate(contentFingerprint, summaryFingerprint)) {
		return {
			reason: 'generic_content',
			status: 'discarded',
		};
	}

	const existingMemories = await readExistingMemories(input);

	if (isSelectionFailureResult(existingMemories)) {
		return existingMemories;
	}

	const matchedMemory = findExactMemoryMatch(input.candidate, existingMemories);

	if (matchedMemory) {
		return {
			matched_memory_id: matchedMemory.memory_id,
			reason: 'duplicate_active_memory',
			status: 'discarded',
		};
	}

	return {
		candidate: input.candidate,
		reason: 'eligible',
		status: 'selected',
	};
}
