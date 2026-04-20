import type { MemoryRecord, MemoryWriteCandidate } from '@runa/types';

import {
	type MemoryStore,
	MemoryStoreConfigurationError,
	MemoryStoreWriteError,
	defaultMemoryStore,
} from '../persistence/memory-store.js';

import type {
	BuildMemoryWriteCandidateFailure,
	BuildMemoryWriteCandidateResult,
} from './build-memory-write-candidate.js';

type WritableMemoryStore = Pick<MemoryStore, 'createMemory'>;

interface WriteMemoryCandidateFailure {
	readonly code:
		| 'CANDIDATE_BUILD_FAILED'
		| 'MEMORY_STORE_CONFIGURATION_FAILED'
		| 'MEMORY_STORE_WRITE_FAILED';
	readonly message: string;
	readonly source_failure_code?: BuildMemoryWriteCandidateFailure['code'];
}

export interface WriteMemoryCandidateInput {
	readonly candidate: BuildMemoryWriteCandidateResult | MemoryWriteCandidate;
	readonly memory_store?: WritableMemoryStore;
}

export interface MemoryWrittenResult {
	readonly memory_record: MemoryRecord;
	readonly status: 'memory_written';
}

export interface NoMemoryWrittenResult {
	readonly reason: 'empty_content' | 'insufficient_signal';
	readonly status: 'no_memory_written';
}

export interface WriteMemoryCandidateFailureResult {
	readonly failure: WriteMemoryCandidateFailure;
	readonly status: 'failed';
}

export type WriteMemoryCandidateResult =
	| MemoryWrittenResult
	| NoMemoryWrittenResult
	| WriteMemoryCandidateFailureResult;

function isCandidateResult(
	candidate: WriteMemoryCandidateInput['candidate'],
): candidate is BuildMemoryWriteCandidateResult {
	return typeof candidate === 'object' && candidate !== null && 'status' in candidate;
}

function createCandidateBuildFailure(
	failure: BuildMemoryWriteCandidateFailure,
): WriteMemoryCandidateFailureResult {
	return {
		failure: {
			code: 'CANDIDATE_BUILD_FAILED',
			message: failure.message,
			source_failure_code: failure.code,
		},
		status: 'failed',
	};
}

export async function writeMemoryCandidate(
	input: WriteMemoryCandidateInput,
): Promise<WriteMemoryCandidateResult> {
	const memoryStore = input.memory_store ?? defaultMemoryStore;
	const candidateInput = input.candidate;

	if (isCandidateResult(candidateInput)) {
		if (candidateInput.status === 'failed') {
			return createCandidateBuildFailure(candidateInput.failure);
		}

		if (candidateInput.status === 'no_candidate') {
			return {
				reason: candidateInput.reason,
				status: 'no_memory_written',
			};
		}
	}

	const candidate =
		isCandidateResult(candidateInput) && candidateInput.status === 'candidate_created'
			? candidateInput.candidate
			: candidateInput;

	try {
		const memoryRecord = await memoryStore.createMemory(candidate);
		return {
			memory_record: memoryRecord,
			status: 'memory_written',
		};
	} catch (error) {
		if (error instanceof MemoryStoreConfigurationError) {
			return {
				failure: {
					code: 'MEMORY_STORE_CONFIGURATION_FAILED',
					message: error.message,
				},
				status: 'failed',
			};
		}

		if (error instanceof MemoryStoreWriteError) {
			return {
				failure: {
					code: 'MEMORY_STORE_WRITE_FAILED',
					message: error.message,
				},
				status: 'failed',
			};
		}

		return {
			failure: {
				code: 'MEMORY_STORE_WRITE_FAILED',
				message: 'Failed to write memory candidate.',
			},
			status: 'failed',
		};
	}
}
