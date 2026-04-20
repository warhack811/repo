import type {
	CheckpointBlobKind,
	CheckpointBlobRef,
	CheckpointMeta,
	CheckpointRecord,
	CheckpointStatus,
	ResumableResumeContext,
	ResumeContext,
	RuntimeState,
	TerminalResumeContext,
} from '@runa/types';

export interface CheckpointMetadataEntry {
	readonly meta: CheckpointMeta;
	readonly resume: ResumeContext;
}

export interface ListCheckpointMetadataInput {
	readonly limit?: number;
	readonly run_id?: string;
	readonly session_id?: string;
	readonly statuses?: readonly CheckpointStatus[];
	readonly trace_id?: string;
}

export interface CheckpointMetadataStore {
	get_checkpoint_metadata(checkpoint_id: string): Promise<CheckpointMetadataEntry | null>;
	list_checkpoint_metadata(
		input: ListCheckpointMetadataInput,
	): Promise<readonly CheckpointMetadataEntry[]>;
	put_checkpoint_metadata(entry: CheckpointMetadataEntry): Promise<CheckpointMetadataEntry>;
}

export interface CheckpointBlobStore {
	list_checkpoint_blob_refs(checkpoint_id: string): Promise<readonly CheckpointBlobRef[]>;
	replace_checkpoint_blob_refs(
		checkpoint_id: string,
		blob_refs: readonly CheckpointBlobRef[],
	): Promise<readonly CheckpointBlobRef[]>;
}

export interface CheckpointManagerDependencies {
	readonly blob_store?: CheckpointBlobStore;
	readonly metadata_store: CheckpointMetadataStore;
}

export interface ResolveResumeCheckpointInput {
	readonly checkpoint_id: string;
}

export interface MissingResumeCheckpointResult {
	readonly checkpoint_id: string;
	readonly status: 'missing';
}

export interface ResumableCheckpointResult {
	readonly checkpoint: CheckpointRecord;
	readonly resume: ResumableResumeContext;
	readonly status: 'resumable';
}

export interface TerminalCheckpointResult {
	readonly checkpoint: CheckpointRecord;
	readonly resume: TerminalResumeContext;
	readonly status: 'terminal';
}

export type ResolveResumeCheckpointResult =
	| MissingResumeCheckpointResult
	| ResumableCheckpointResult
	| TerminalCheckpointResult;

export interface CheckpointManager {
	getCheckpoint(checkpoint_id: string): Promise<CheckpointRecord | null>;
	getCheckpointMeta(checkpoint_id: string): Promise<CheckpointMeta | null>;
	listCheckpointMetas(input: ListCheckpointMetadataInput): Promise<readonly CheckpointMeta[]>;
	resolveResumeCheckpoint(
		input: ResolveResumeCheckpointInput,
	): Promise<ResolveResumeCheckpointResult>;
	saveCheckpoint(record: CheckpointRecord): Promise<CheckpointRecord>;
}

export class CheckpointManagerConfigurationError extends Error {
	override readonly cause?: unknown;
	readonly code = 'CHECKPOINT_MANAGER_CONFIGURATION_ERROR';

	constructor(message: string, cause?: unknown) {
		super(message);
		this.cause = cause;
		this.name = 'CheckpointManagerConfigurationError';
	}
}

export class CheckpointManagerValidationError extends Error {
	override readonly cause?: unknown;
	readonly code = 'CHECKPOINT_MANAGER_VALIDATION_ERROR';

	constructor(message: string, cause?: unknown) {
		super(message);
		this.cause = cause;
		this.name = 'CheckpointManagerValidationError';
	}
}

export class CheckpointManagerReadError extends Error {
	override readonly cause?: unknown;
	readonly code = 'CHECKPOINT_MANAGER_READ_ERROR';

	constructor(message: string, cause?: unknown) {
		super(message);
		this.cause = cause;
		this.name = 'CheckpointManagerReadError';
	}
}

export class CheckpointManagerWriteError extends Error {
	override readonly cause?: unknown;
	readonly code = 'CHECKPOINT_MANAGER_WRITE_ERROR';

	constructor(message: string, cause?: unknown) {
		super(message);
		this.cause = cause;
		this.name = 'CheckpointManagerWriteError';
	}
}

function isResumableResumeContext(resume: ResumeContext): resume is ResumableResumeContext {
	return resume.disposition === 'resumable';
}

function isTerminalRuntimeState(
	state: RuntimeState | undefined,
): state is Extract<RuntimeState, 'COMPLETED' | 'FAILED'> {
	return state === 'COMPLETED' || state === 'FAILED';
}

function isTerminalLoopState(loopState: CheckpointMeta['loop_state']): boolean {
	return loopState === 'COMPLETED' || loopState === 'FAILED' || loopState === 'CANCELLED';
}

function requireBlobStore(
	dependencies: CheckpointManagerDependencies,
	operation: 'read' | 'write',
): CheckpointBlobStore {
	if (dependencies.blob_store === undefined) {
		throw new CheckpointManagerConfigurationError(
			`Checkpoint blob store is required for hybrid checkpoint ${operation} operations.`,
		);
	}

	return dependencies.blob_store;
}

function validateBlobRefs(record: CheckpointRecord): void {
	for (const blobRef of record.blob_refs) {
		if (blobRef.checkpoint_id !== record.meta.checkpoint_id) {
			throw new CheckpointManagerValidationError(
				`Checkpoint blob ref "${blobRef.blob_id}" does not match checkpoint "${record.meta.checkpoint_id}".`,
			);
		}
	}
}

function validateResumeContext(record: CheckpointRecord): void {
	if (isResumableResumeContext(record.resume)) {
		if (isTerminalLoopState(record.meta.loop_state)) {
			throw new CheckpointManagerValidationError(
				'Resumable checkpoints cannot use a terminal loop_state in metadata.',
			);
		}

		if (isTerminalRuntimeState(record.meta.runtime_state)) {
			throw new CheckpointManagerValidationError(
				'Resumable checkpoints cannot use a terminal runtime_state in metadata.',
			);
		}

		if (record.resume.cursor.checkpoint_id !== record.meta.checkpoint_id) {
			throw new CheckpointManagerValidationError(
				'Resume cursor checkpoint_id must match checkpoint metadata.',
			);
		}

		if (record.resume.cursor.checkpoint_version !== record.meta.checkpoint_version) {
			throw new CheckpointManagerValidationError(
				'Resume cursor checkpoint_version must match checkpoint metadata.',
			);
		}

		if (record.resume.cursor.run_id !== record.meta.run_id) {
			throw new CheckpointManagerValidationError(
				'Resume cursor run_id must match checkpoint metadata.',
			);
		}

		if (record.resume.cursor.trace_id !== record.meta.trace_id) {
			throw new CheckpointManagerValidationError(
				'Resume cursor trace_id must match checkpoint metadata.',
			);
		}

		const requiredBlobKinds = record.resume.required_blob_kinds ?? [];
		const persistedBlobRefs: readonly CheckpointBlobRef[] = record.blob_refs;

		for (const requiredBlobKind of requiredBlobKinds) {
			if (!persistedBlobRefs.some((blobRef) => blobRef.kind === requiredBlobKind)) {
				throw new CheckpointManagerValidationError(
					`Required checkpoint blob kind "${requiredBlobKind}" is missing.`,
				);
			}
		}

		return;
	}

	if (!isTerminalLoopState(record.meta.loop_state)) {
		throw new CheckpointManagerValidationError(
			'Terminal checkpoints must use a terminal loop_state in metadata.',
		);
	}

	if (record.resume.final_loop_state !== record.meta.loop_state) {
		throw new CheckpointManagerValidationError(
			'Terminal resume final_loop_state must match checkpoint metadata loop_state.',
		);
	}

	if (
		record.resume.final_runtime_state !== undefined &&
		record.meta.runtime_state !== undefined &&
		record.resume.final_runtime_state !== record.meta.runtime_state
	) {
		throw new CheckpointManagerValidationError(
			'Terminal resume final_runtime_state must match checkpoint metadata runtime_state when both are present.',
		);
	}

	if (
		record.meta.runtime_state !== undefined &&
		!isTerminalRuntimeState(record.meta.runtime_state)
	) {
		throw new CheckpointManagerValidationError(
			'Terminal checkpoints cannot use a non-terminal runtime_state in metadata.',
		);
	}
}

function validateCheckpointRecord(record: CheckpointRecord): void {
	if (record.meta.persistence_mode === 'metadata_only' && record.blob_refs.length > 0) {
		throw new CheckpointManagerValidationError(
			'Metadata-only checkpoints cannot persist blob refs.',
		);
	}

	if (record.meta.persistence_mode === 'hybrid' && record.blob_refs.length === 0) {
		throw new CheckpointManagerValidationError(
			'Hybrid checkpoints must persist at least one blob ref.',
		);
	}

	validateBlobRefs(record);
	validateResumeContext(record);
}

function toCheckpointRecord(
	entry: CheckpointMetadataEntry,
	blobRefs: readonly CheckpointBlobRef[],
): CheckpointRecord {
	const record = {
		blob_refs: entry.meta.persistence_mode === 'metadata_only' ? [] : blobRefs,
		meta: entry.meta,
		resume: entry.resume,
	} as CheckpointRecord;

	validateCheckpointRecord(record);

	return record;
}

async function loadCheckpointBlobRefs(
	meta: CheckpointMeta,
	dependencies: CheckpointManagerDependencies,
): Promise<readonly CheckpointBlobRef[]> {
	if (meta.persistence_mode === 'metadata_only') {
		return [];
	}

	const blobStore = requireBlobStore(dependencies, 'read');
	return blobStore.list_checkpoint_blob_refs(meta.checkpoint_id);
}

export async function saveCheckpoint(
	record: CheckpointRecord,
	dependencies: CheckpointManagerDependencies,
): Promise<CheckpointRecord> {
	validateCheckpointRecord(record);

	if (record.meta.persistence_mode === 'hybrid') {
		requireBlobStore(dependencies, 'write');
	}

	try {
		const metadataEntry = await dependencies.metadata_store.put_checkpoint_metadata({
			meta: record.meta,
			resume: record.resume,
		});
		const persistedBlobRefs =
			record.meta.persistence_mode === 'metadata_only'
				? []
				: await requireBlobStore(dependencies, 'write').replace_checkpoint_blob_refs(
						record.meta.checkpoint_id,
						record.blob_refs,
					);

		return toCheckpointRecord(metadataEntry, persistedBlobRefs);
	} catch (error: unknown) {
		if (
			error instanceof CheckpointManagerConfigurationError ||
			error instanceof CheckpointManagerValidationError ||
			error instanceof CheckpointManagerWriteError
		) {
			throw error;
		}

		throw new CheckpointManagerWriteError('Failed to persist checkpoint.', error);
	}
}

export async function getCheckpoint(
	checkpoint_id: string,
	dependencies: CheckpointManagerDependencies,
): Promise<CheckpointRecord | null> {
	try {
		const entry = await dependencies.metadata_store.get_checkpoint_metadata(checkpoint_id);

		if (entry === null) {
			return null;
		}

		return toCheckpointRecord(entry, await loadCheckpointBlobRefs(entry.meta, dependencies));
	} catch (error: unknown) {
		if (
			error instanceof CheckpointManagerConfigurationError ||
			error instanceof CheckpointManagerValidationError ||
			error instanceof CheckpointManagerReadError
		) {
			throw error;
		}

		throw new CheckpointManagerReadError(`Failed to read checkpoint "${checkpoint_id}".`, error);
	}
}

export async function getCheckpointMeta(
	checkpoint_id: string,
	dependencies: CheckpointManagerDependencies,
): Promise<CheckpointMeta | null> {
	try {
		const entry = await dependencies.metadata_store.get_checkpoint_metadata(checkpoint_id);
		return entry?.meta ?? null;
	} catch (error: unknown) {
		if (error instanceof CheckpointManagerReadError) {
			throw error;
		}

		throw new CheckpointManagerReadError(
			`Failed to read checkpoint metadata for "${checkpoint_id}".`,
			error,
		);
	}
}

export async function listCheckpointMetas(
	input: ListCheckpointMetadataInput,
	dependencies: CheckpointManagerDependencies,
): Promise<readonly CheckpointMeta[]> {
	try {
		const entries = await dependencies.metadata_store.list_checkpoint_metadata(input);
		return entries.map((entry) => entry.meta);
	} catch (error: unknown) {
		if (error instanceof CheckpointManagerReadError) {
			throw error;
		}

		throw new CheckpointManagerReadError('Failed to list checkpoint metadata.', error);
	}
}

export async function resolveResumeCheckpoint(
	input: ResolveResumeCheckpointInput,
	dependencies: CheckpointManagerDependencies,
): Promise<ResolveResumeCheckpointResult> {
	const checkpoint = await getCheckpoint(input.checkpoint_id, dependencies);

	if (checkpoint === null) {
		return {
			checkpoint_id: input.checkpoint_id,
			status: 'missing',
		};
	}

	if (isResumableResumeContext(checkpoint.resume)) {
		return {
			checkpoint,
			resume: checkpoint.resume,
			status: 'resumable',
		};
	}

	return {
		checkpoint,
		resume: checkpoint.resume,
		status: 'terminal',
	};
}

export function createCheckpointManager(
	dependencies: CheckpointManagerDependencies,
): CheckpointManager {
	return {
		getCheckpoint(checkpoint_id) {
			return getCheckpoint(checkpoint_id, dependencies);
		},
		getCheckpointMeta(checkpoint_id) {
			return getCheckpointMeta(checkpoint_id, dependencies);
		},
		listCheckpointMetas(input) {
			return listCheckpointMetas(input, dependencies);
		},
		resolveResumeCheckpoint(input) {
			return resolveResumeCheckpoint(input, dependencies);
		},
		saveCheckpoint(record) {
			return saveCheckpoint(record, dependencies);
		},
	};
}
