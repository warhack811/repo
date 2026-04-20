import type {
	AgentLoopConfig,
	BoundaryLoopState,
	LoopState,
	StopReason,
	TerminalLoopState,
} from './agent-loop.js';
import type { EventMetadata } from './events.js';
import type { NonTerminalRuntimeState, RuntimeState, TerminalRuntimeState } from './state.js';

export const checkpointSchemaVersions = [1] as const;

export type CheckpointSchemaVersion = (typeof checkpointSchemaVersions)[number];

export const checkpointStatuses = ['pending', 'ready', 'resumed', 'superseded', 'failed'] as const;

export type CheckpointStatus = (typeof checkpointStatuses)[number];

export const checkpointPersistenceModes = ['metadata_only', 'hybrid'] as const;

export type CheckpointPersistenceMode = (typeof checkpointPersistenceModes)[number];

export const checkpointScopeKinds = ['run', 'session', 'workspace', 'user'] as const;

export type CheckpointScopeKind = (typeof checkpointScopeKinds)[number];

export const checkpointTriggerKinds = [
	'turn_boundary',
	'loop_boundary',
	'manual',
	'shutdown_recovery',
	'token_recovery',
	'resume_preflight',
] as const;

export type CheckpointTriggerKind = (typeof checkpointTriggerKinds)[number];

export const checkpointBlobKinds = [
	'loop_snapshot',
	'context_snapshot',
	'event_slice',
	'presentation_snapshot',
	'tool_state',
	'custom',
] as const;

export type CheckpointBlobKind = (typeof checkpointBlobKinds)[number];

export const checkpointBlobStorageKinds = ['object_storage', 'database', 'inline'] as const;

export type CheckpointBlobStorageKind = (typeof checkpointBlobStorageKinds)[number];

export const checkpointContentEncodings = ['identity', 'gzip', 'brotli'] as const;

export type CheckpointContentEncoding = (typeof checkpointContentEncodings)[number];

export const resumeBoundaryKinds = ['turn', 'approval', 'loop'] as const;

export type ResumeBoundaryKind = (typeof resumeBoundaryKinds)[number];

export type CheckpointMetadata = EventMetadata;

export interface CheckpointScope {
	readonly kind: CheckpointScopeKind;
	readonly subject_id: string;
	readonly run_id?: string;
	readonly session_id?: string;
	readonly tenant_id?: string;
	readonly trace_id?: string;
	readonly user_id?: string;
	readonly workspace_id?: string;
}

export interface CheckpointBlobRef {
	readonly blob_id: string;
	readonly checkpoint_id: string;
	readonly content_encoding?: CheckpointContentEncoding;
	readonly content_type: string;
	readonly byte_length?: number;
	readonly checksum?: string;
	readonly created_at?: string;
	readonly kind: CheckpointBlobKind;
	readonly locator?: string;
	readonly metadata?: CheckpointMetadata;
	readonly storage_kind: CheckpointBlobStorageKind;
}

export interface CheckpointMeta {
	readonly checkpoint_id: string;
	readonly checkpoint_version: number;
	readonly checkpointed_at: string;
	readonly created_at: string;
	readonly event_sequence_no?: number;
	readonly loop_state: LoopState;
	readonly metadata?: CheckpointMetadata;
	readonly parent_checkpoint_id?: string;
	readonly persistence_mode: CheckpointPersistenceMode;
	readonly run_id: string;
	readonly runtime_state?: RuntimeState;
	readonly schema_version: CheckpointSchemaVersion;
	readonly scope: CheckpointScope;
	readonly session_id?: string;
	readonly status: CheckpointStatus;
	readonly stop_reason?: StopReason;
	readonly trace_id: string;
	readonly trigger: CheckpointTriggerKind;
	readonly turn_index: number;
	readonly updated_at: string;
}

export interface ResumeCursor {
	readonly boundary: ResumeBoundaryKind;
	readonly checkpoint_id: string;
	readonly checkpoint_version: number;
	readonly checkpointed_at: string;
	readonly event_sequence_no?: number;
	readonly loop_state: Exclude<LoopState, TerminalLoopState>;
	readonly run_id: string;
	readonly runtime_state?: NonTerminalRuntimeState;
	readonly trace_id: string;
	readonly turn_index: number;
}

export interface ResumableResumeContext {
	readonly cursor: ResumeCursor;
	readonly disposition: 'resumable';
	readonly loop_config?: AgentLoopConfig;
	readonly required_blob_kinds?: readonly CheckpointBlobKind[];
	readonly stop_reason?: Extract<StopReason, { readonly loop_state: BoundaryLoopState }>;
}

export interface TerminalResumeContext {
	readonly disposition: 'terminal';
	readonly final_loop_state: TerminalLoopState;
	readonly final_runtime_state?: TerminalRuntimeState;
	readonly stop_reason?: StopReason;
}

export type ResumeContext = ResumableResumeContext | TerminalResumeContext;

interface CheckpointRecordBase<TMode extends CheckpointPersistenceMode> {
	readonly blob_refs: TMode extends 'metadata_only' ? readonly [] : readonly CheckpointBlobRef[];
	readonly meta: CheckpointMeta & {
		readonly persistence_mode: TMode;
	};
	readonly resume: ResumeContext;
}

export type MetadataOnlyCheckpointRecord = CheckpointRecordBase<'metadata_only'>;

export type HybridCheckpointRecord = CheckpointRecordBase<'hybrid'>;

export type CheckpointRecord = MetadataOnlyCheckpointRecord | HybridCheckpointRecord;
