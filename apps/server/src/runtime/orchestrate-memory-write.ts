import type { MemoryRecord, MemoryScope, MemoryWriteCandidate } from '@runa/types';

import {
	type MemoryStore,
	MemoryStoreConfigurationError,
	MemoryStoreWriteError,
	defaultMemoryStore,
} from '../persistence/memory-store.js';

import {
	type BuildMemoryWriteCandidateFailure,
	type BuildMemoryWriteCandidateResult,
	type BuildMemoryWriteCandidateSource,
	type MemoryWriteCandidateCreatedResult,
	type MemoryWriteCandidateNoCandidateResult,
	buildMemoryWriteCandidate,
} from './build-memory-write-candidate.js';
import {
	type RefineMemoryLifecycleFailureResult,
	type RefineMemoryLifecycleResult,
	refineMemoryLifecycle,
} from './refine-memory-lifecycle.js';
import {
	type SelectMemoryCandidateFailureResult,
	type SelectMemoryCandidateInput,
	type SelectMemoryCandidateResult,
	selectMemoryCandidate,
} from './select-memory-candidate.js';
import {
	type MemoryWrittenResult,
	type WriteMemoryCandidateFailureResult,
	writeMemoryCandidate,
} from './write-memory-candidate.js';

type OrchestrationMemoryStore = Pick<
	MemoryStore,
	'createMemory' | 'listActiveMemories' | 'supersedeMemory'
>;

interface OrchestrateMemoryWriteFailure {
	readonly code:
		| 'CANDIDATE_BUILD_FAILED'
		| 'MEMORY_LIFECYCLE_FAILED'
		| 'MEMORY_SELECTION_FAILED'
		| 'MEMORY_WRITE_FAILED';
	readonly message: string;
	readonly source_failure_code?: string;
}

export interface OrchestrateMemoryWriteInput {
	readonly candidate_policy?: 'general' | 'user_preference';
	readonly existing_memories?: readonly MemoryRecord[];
	readonly memory_store?: OrchestrationMemoryStore;
	readonly run_id?: string;
	readonly scope: MemoryScope;
	readonly scope_id: string;
	readonly source: BuildMemoryWriteCandidateSource;
	readonly trace_id?: string;
}

export interface OrchestratedMemoryWrittenResult {
	readonly candidate: MemoryWriteCandidate;
	readonly candidate_result: MemoryWriteCandidateCreatedResult;
	readonly lifecycle_result: Exclude<RefineMemoryLifecycleResult, { status: 'failed' }>;
	readonly memory_record: MemoryRecord;
	readonly selection_result: Extract<SelectMemoryCandidateResult, { status: 'selected' }>;
	readonly status: 'memory_written';
	readonly superseded_memory?: MemoryRecord;
	readonly write_result: MemoryWrittenResult;
}

export interface OrchestratedNoCandidateResult {
	readonly candidate_result: MemoryWriteCandidateNoCandidateResult;
	readonly reason: MemoryWriteCandidateNoCandidateResult['reason'];
	readonly status: 'no_candidate';
}

export interface OrchestratedDiscardedResult {
	readonly candidate: MemoryWriteCandidate;
	readonly candidate_result: MemoryWriteCandidateCreatedResult;
	readonly matched_memory_id?: string;
	readonly reason: Extract<SelectMemoryCandidateResult, { status: 'discarded' }>['reason'];
	readonly selection_result: Extract<SelectMemoryCandidateResult, { status: 'discarded' }>;
	readonly status: 'discarded';
}

export interface OrchestratedMemoryWriteFailureResult {
	readonly candidate_result?: MemoryWriteCandidateCreatedResult;
	readonly failure: OrchestrateMemoryWriteFailure;
	readonly lifecycle_result?: RefineMemoryLifecycleFailureResult;
	readonly memory_record?: MemoryRecord;
	readonly selection_result?: SelectMemoryCandidateFailureResult;
	readonly stage: 'candidate_build' | 'lifecycle' | 'selection' | 'write';
	readonly status: 'failed';
	readonly write_result?: MemoryWrittenResult | WriteMemoryCandidateFailureResult;
}

export type OrchestrateMemoryWriteResult =
	| OrchestratedDiscardedResult
	| OrchestratedMemoryWriteFailureResult
	| OrchestratedMemoryWrittenResult
	| OrchestratedNoCandidateResult;

function createFailure(
	stage: OrchestratedMemoryWriteFailureResult['stage'],
	code: OrchestrateMemoryWriteFailure['code'],
	message: string,
	options: {
		readonly candidate_result?: MemoryWriteCandidateCreatedResult;
		readonly lifecycle_result?: RefineMemoryLifecycleFailureResult;
		readonly memory_record?: MemoryRecord;
		readonly selection_result?: SelectMemoryCandidateFailureResult;
		readonly source_failure_code?: string;
		readonly write_result?: MemoryWrittenResult | WriteMemoryCandidateFailureResult;
	} = {},
): OrchestratedMemoryWriteFailureResult {
	return {
		candidate_result: options.candidate_result,
		failure: {
			code,
			message,
			source_failure_code: options.source_failure_code,
		},
		lifecycle_result: options.lifecycle_result,
		memory_record: options.memory_record,
		selection_result: options.selection_result,
		stage,
		status: 'failed',
		write_result: options.write_result,
	};
}

function createCandidateBuildFailure(
	result: Extract<BuildMemoryWriteCandidateResult, { status: 'failed' }>,
): OrchestratedMemoryWriteFailureResult {
	return createFailure('candidate_build', 'CANDIDATE_BUILD_FAILED', result.failure.message, {
		source_failure_code: result.failure.code,
	});
}

function createSelectionFailure(
	candidate_result: MemoryWriteCandidateCreatedResult,
	result: SelectMemoryCandidateFailureResult,
): OrchestratedMemoryWriteFailureResult {
	return createFailure('selection', 'MEMORY_SELECTION_FAILED', result.failure.message, {
		candidate_result,
		selection_result: result,
		source_failure_code: result.failure.code,
	});
}

function createLifecycleFailure(
	candidate_result: MemoryWriteCandidateCreatedResult,
	result: RefineMemoryLifecycleFailureResult,
): OrchestratedMemoryWriteFailureResult {
	return createFailure('lifecycle', 'MEMORY_LIFECYCLE_FAILED', result.failure.message, {
		candidate_result,
		lifecycle_result: result,
		source_failure_code: result.failure.code,
	});
}

function createWriteFailure(
	candidate_result: MemoryWriteCandidateCreatedResult,
	result: WriteMemoryCandidateFailureResult,
): OrchestratedMemoryWriteFailureResult {
	return createFailure('write', 'MEMORY_WRITE_FAILED', result.failure.message, {
		candidate_result,
		source_failure_code: result.failure.code,
		write_result: result,
	});
}

function toSelectionInput(
	input: OrchestrateMemoryWriteInput,
	candidate: MemoryWriteCandidate,
): SelectMemoryCandidateInput {
	return {
		candidate,
		existing_memories: input.existing_memories,
		memory_store: input.memory_store,
	};
}

function createLifecycleMutationFailure(
	candidate_result: MemoryWriteCandidateCreatedResult,
	memoryRecord: MemoryRecord,
	message: string,
	sourceFailureCode?: string,
): OrchestratedMemoryWriteFailureResult {
	return createFailure('lifecycle', 'MEMORY_LIFECYCLE_FAILED', message, {
		candidate_result,
		memory_record: memoryRecord,
		source_failure_code: sourceFailureCode,
		write_result: {
			memory_record: memoryRecord,
			status: 'memory_written',
		},
	});
}

export async function orchestrateMemoryWrite(
	input: OrchestrateMemoryWriteInput,
): Promise<OrchestrateMemoryWriteResult> {
	const candidateResult = buildMemoryWriteCandidate({
		candidate_policy: input.candidate_policy,
		run_id: input.run_id,
		scope: input.scope,
		scope_id: input.scope_id,
		source: input.source,
		trace_id: input.trace_id,
	});

	if (candidateResult.status === 'failed') {
		return createCandidateBuildFailure(candidateResult);
	}

	if (candidateResult.status === 'no_candidate') {
		return {
			candidate_result: candidateResult,
			reason: candidateResult.reason,
			status: 'no_candidate',
		};
	}

	const selectionResult = await selectMemoryCandidate(
		toSelectionInput(input, candidateResult.candidate),
	);

	if (selectionResult.status === 'failed') {
		return createSelectionFailure(candidateResult, selectionResult);
	}

	if (selectionResult.status === 'discarded') {
		return {
			candidate: candidateResult.candidate,
			candidate_result: candidateResult,
			matched_memory_id: selectionResult.matched_memory_id,
			reason: selectionResult.reason,
			selection_result: selectionResult,
			status: 'discarded',
		};
	}

	const lifecycleResult = await refineMemoryLifecycle({
		candidate: candidateResult.candidate,
		existing_memories: input.existing_memories,
		memory_store: input.memory_store,
	});

	if (lifecycleResult.status === 'failed') {
		return createLifecycleFailure(candidateResult, lifecycleResult);
	}

	const writeResult = await writeMemoryCandidate({
		candidate: candidateResult.candidate,
		memory_store: input.memory_store,
	});

	if (writeResult.status === 'failed') {
		return createWriteFailure(candidateResult, writeResult);
	}

	if (writeResult.status !== 'memory_written') {
		return createFailure(
			'write',
			'MEMORY_WRITE_FAILED',
			'writeMemoryCandidate returned an unexpected no-op result for a selected candidate.',
			{
				candidate_result: candidateResult,
			},
		);
	}

	let supersededMemory: MemoryRecord | undefined;

	if (lifecycleResult.status === 'write_and_supersede_previous') {
		const memoryStore = input.memory_store ?? defaultMemoryStore;

		try {
			const supersededResult = await memoryStore.supersedeMemory({
				memory_id: lifecycleResult.matched_memory_id,
			});

			if (!supersededResult) {
				return createLifecycleMutationFailure(
					candidateResult,
					writeResult.memory_record,
					'Lifecycle target memory was not found for supersede.',
					'MEMORY_STORE_WRITE_FAILED',
				);
			}

			supersededMemory = supersededResult;
		} catch (error) {
			if (error instanceof MemoryStoreConfigurationError) {
				return createLifecycleMutationFailure(
					candidateResult,
					writeResult.memory_record,
					error.message,
					'MEMORY_STORE_CONFIGURATION_FAILED',
				);
			}

			if (error instanceof MemoryStoreWriteError) {
				return createLifecycleMutationFailure(
					candidateResult,
					writeResult.memory_record,
					error.message,
					'MEMORY_STORE_WRITE_FAILED',
				);
			}

			return createLifecycleMutationFailure(
				candidateResult,
				writeResult.memory_record,
				'Failed to supersede previous memory.',
				'MEMORY_STORE_WRITE_FAILED',
			);
		}
	}

	return {
		candidate: candidateResult.candidate,
		candidate_result: candidateResult,
		lifecycle_result: lifecycleResult,
		memory_record: writeResult.memory_record,
		selection_result: selectionResult,
		status: 'memory_written',
		superseded_memory: supersededMemory,
		write_result: writeResult,
	};
}
