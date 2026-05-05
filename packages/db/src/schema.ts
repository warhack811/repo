import type {
	ApprovalActionKind,
	ApprovalDecisionKind,
	ApprovalMode,
	ApprovalStatus,
	ApprovalTargetKind,
	CheckpointMeta,
	CheckpointMetadata,
	CheckpointPersistenceMode,
	CheckpointScopeKind,
	CheckpointStatus,
	CheckpointTriggerKind,
	EventMetadata,
	LoopState,
	MemoryEmbeddingMetadata,
	MemoryScope,
	MemorySourceKind,
	MemoryStatus,
	RenderBlock,
	ResumeContext,
	RuntimeEvent,
	RuntimeState,
	StopReason,
	ToolArguments,
	ToolName,
	ToolRiskLevel,
} from '@runa/types';
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from 'drizzle-orm/pg-core';

type PolicyPauseReason = 'denial_threshold';

export const runtimeEventsTable = pgTable(
	'runtime_events',
	{
		envelope: jsonb('envelope').$type<RuntimeEvent>().notNull(),
		event_id: text('event_id').primaryKey(),
		event_type: text('event_type').notNull(),
		event_version: integer('event_version').notNull(),
		metadata: jsonb('metadata').$type<EventMetadata | null>(),
		payload: jsonb('payload').$type<RuntimeEvent['payload']>().notNull(),
		run_id: text('run_id').notNull(),
		sequence_no: integer('sequence_no'),
		tenant_id: text('tenant_id'),
		timestamp: timestamp('timestamp', { mode: 'string', withTimezone: true }).notNull(),
		trace_id: text('trace_id').notNull(),
		workspace_id: text('workspace_id'),
	},
	(table) => ({
		runIdIndex: index('runtime_events_run_id_idx').on(table.run_id),
		traceIdIndex: index('runtime_events_trace_id_idx').on(table.trace_id),
	}),
);

export const agentReasoningTracesTable = pgTable(
	'agent_reasoning_traces',
	{
		created_at: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
		expires_at: timestamp('expires_at', { mode: 'string', withTimezone: true }).notNull(),
		model: text('model').notNull(),
		provider: text('provider').notNull(),
		reasoning_content: text('reasoning_content').notNull(),
		retention_policy: text('retention_policy').$type<'debug_30d' | 'permanent_audit'>().notNull(),
		run_id: text('run_id').notNull(),
		trace_id: text('trace_id').notNull(),
		trace_record_id: text('trace_record_id').primaryKey(),
		turn_index: integer('turn_index').notNull(),
	},
	(table) => ({
		expiresAtIndex: index('agent_reasoning_traces_expires_at_idx').on(table.expires_at),
		runIdIndex: index('agent_reasoning_traces_run_id_idx').on(table.run_id),
	}),
);

export const runsTable = pgTable(
	'runs',
	{
		conversation_id: text('conversation_id'),
		created_at: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
		current_state: text('current_state').$type<RuntimeState>().notNull(),
		last_error_code: text('last_error_code'),
		last_state_at: timestamp('last_state_at', { mode: 'string', withTimezone: true }).notNull(),
		run_id: text('run_id').primaryKey(),
		tenant_id: text('tenant_id'),
		trace_id: text('trace_id').notNull(),
		updated_at: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
		user_id: text('user_id'),
		workspace_id: text('workspace_id'),
	},
	(table) => ({
		conversationIdIndex: index('runs_conversation_id_idx').on(table.conversation_id),
		currentStateIndex: index('runs_current_state_idx').on(table.current_state),
		traceIdIndex: index('runs_trace_id_idx').on(table.trace_id),
	}),
);

export const conversationsTable = pgTable(
	'conversations',
	{
		conversation_id: text('conversation_id').primaryKey(),
		created_at: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
		last_message_at: timestamp('last_message_at', { mode: 'string', withTimezone: true }).notNull(),
		last_message_preview: text('last_message_preview').notNull(),
		session_id: text('session_id'),
		tenant_id: text('tenant_id'),
		title: text('title').notNull(),
		updated_at: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
		user_id: text('user_id'),
		workspace_id: text('workspace_id'),
	},
	(table) => ({
		lastMessageAtIndex: index('conversations_last_message_at_idx').on(table.last_message_at),
		sessionIdIndex: index('conversations_session_id_idx').on(table.session_id),
		userIdIndex: index('conversations_user_id_idx').on(table.user_id),
	}),
);

export const conversationMessagesTable = pgTable(
	'conversation_messages',
	{
		content: text('content').notNull(),
		conversation_id: text('conversation_id').notNull(),
		created_at: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
		message_id: text('message_id').primaryKey(),
		role: text('role').$type<'assistant' | 'system' | 'user'>().notNull(),
		run_id: text('run_id'),
		sequence_no: integer('sequence_no').notNull(),
		tenant_id: text('tenant_id'),
		trace_id: text('trace_id'),
		user_id: text('user_id'),
		workspace_id: text('workspace_id'),
	},
	(table) => ({
		conversationIdIndex: index('conversation_messages_conversation_id_idx').on(
			table.conversation_id,
		),
		conversationSequenceIndex: index('conversation_messages_conversation_sequence_idx').on(
			table.conversation_id,
			table.sequence_no,
		),
		runIdIndex: index('conversation_messages_run_id_idx').on(table.run_id),
	}),
);

export const conversationMembersTable = pgTable(
	'conversation_members',
	{
		added_by_user_id: text('added_by_user_id'),
		conversation_id: text('conversation_id').notNull(),
		created_at: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
		member_role: text('member_role').$type<'editor' | 'owner' | 'viewer'>().notNull(),
		member_user_id: text('member_user_id').notNull(),
		tenant_id: text('tenant_id'),
		updated_at: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
		workspace_id: text('workspace_id'),
	},
	(table) => ({
		conversationMemberPk: primaryKey({
			columns: [table.conversation_id, table.member_user_id],
			name: 'conversation_members_pk',
		}),
		conversationIdIndex: index('conversation_members_conversation_id_idx').on(
			table.conversation_id,
		),
		memberUserIdIndex: index('conversation_members_member_user_id_idx').on(table.member_user_id),
	}),
);

export const toolCallsTable = pgTable(
	'tool_calls',
	{
		call_id: text('call_id').notNull(),
		completed_at: timestamp('completed_at', { mode: 'string', withTimezone: true }),
		created_at: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
		error_code: text('error_code'),
		id: text('id').primaryKey(),
		input_summary: text('input_summary'),
		result_summary: text('result_summary'),
		run_id: text('run_id').notNull(),
		state_after: text('state_after').$type<RuntimeState>(),
		state_before: text('state_before').$type<RuntimeState>(),
		status: text('status').$type<'completed' | 'failed' | 'started'>().notNull(),
		tenant_id: text('tenant_id'),
		tool_name: text('tool_name').$type<ToolName>().notNull(),
		trace_id: text('trace_id').notNull(),
		updated_at: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
		workspace_id: text('workspace_id'),
	},
	(table) => ({
		callIdIndex: index('tool_calls_call_id_idx').on(table.call_id),
		runIdIndex: index('tool_calls_run_id_idx').on(table.run_id),
		traceIdIndex: index('tool_calls_trace_id_idx').on(table.trace_id),
	}),
);

export const approvalsTable = pgTable(
	'approvals',
	{
		action_kind: text('action_kind').$type<ApprovalActionKind>().notNull(),
		approval_id: text('approval_id').primaryKey(),
		call_id: text('call_id'),
		created_at: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
		continuation_context: jsonb('continuation_context'),
		decision: text('decision').$type<ApprovalDecisionKind>(),
		note: text('note'),
		next_sequence_no: integer('next_sequence_no').notNull(),
		requested_at: timestamp('requested_at', { mode: 'string', withTimezone: true }).notNull(),
		requires_reason: boolean('requires_reason'),
		resolved_at: timestamp('resolved_at', { mode: 'string', withTimezone: true }),
		risk_level: text('risk_level').$type<ToolRiskLevel>(),
		run_id: text('run_id').notNull(),
		session_id: text('session_id'),
		status: text('status').$type<ApprovalStatus>().notNull(),
		summary: text('summary').notNull(),
		target_kind: text('target_kind').$type<ApprovalTargetKind>(),
		target_label: text('target_label'),
		title: text('title').notNull(),
		tenant_id: text('tenant_id'),
		tool_input: jsonb('tool_input').$type<ToolArguments | null>(),
		tool_name: text('tool_name').$type<ToolName>(),
		trace_id: text('trace_id').notNull(),
		updated_at: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
		user_id: text('user_id'),
		workspace_id: text('workspace_id'),
		working_directory: text('working_directory'),
	},
	(table) => ({
		callIdIndex: index('approvals_call_id_idx').on(table.call_id),
		runIdIndex: index('approvals_run_id_idx').on(table.run_id),
		sessionIdIndex: index('approvals_session_id_idx').on(table.session_id),
		statusIndex: index('approvals_status_idx').on(table.status),
		traceIdIndex: index('approvals_trace_id_idx').on(table.trace_id),
	}),
);

export const policyStatesTable = pgTable(
	'policy_states',
	{
		approval_mode: text('approval_mode').$type<ApprovalMode>(),
		approval_mode_updated_at: timestamp('approval_mode_updated_at', {
			mode: 'string',
			withTimezone: true,
		}),
		auto_continue_enabled: boolean('auto_continue_enabled').notNull(),
		auto_continue_enabled_at: timestamp('auto_continue_enabled_at', {
			mode: 'string',
			withTimezone: true,
		}),
		auto_continue_max_consecutive_turns: integer('auto_continue_max_consecutive_turns'),
		consecutive_denials: integer('consecutive_denials').notNull(),
		created_at: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
		last_denial_at: timestamp('last_denial_at', { mode: 'string', withTimezone: true }),
		last_denied_capability_id: text('last_denied_capability_id'),
		session_id: text('session_id').primaryKey(),
		session_pause_active: boolean('session_pause_active').notNull(),
		session_pause_paused_at: timestamp('session_pause_paused_at', {
			mode: 'string',
			withTimezone: true,
		}),
		session_pause_reason: text('session_pause_reason').$type<PolicyPauseReason>(),
		status: text('status').$type<'active' | 'paused'>().notNull(),
		tenant_id: text('tenant_id'),
		threshold: integer('threshold').notNull(),
		trusted_session_approved_capability_count: integer('trusted_session_approved_capability_count'),
		trusted_session_consumed_turns: integer('trusted_session_consumed_turns'),
		trusted_session_enabled: boolean('trusted_session_enabled'),
		trusted_session_enabled_at: timestamp('trusted_session_enabled_at', {
			mode: 'string',
			withTimezone: true,
		}),
		trusted_session_expires_at: timestamp('trusted_session_expires_at', {
			mode: 'string',
			withTimezone: true,
		}),
		trusted_session_max_approved_capabilities: integer('trusted_session_max_approved_capabilities'),
		trusted_session_max_turns: integer('trusted_session_max_turns'),
		updated_at: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
		user_id: text('user_id'),
		workspace_id: text('workspace_id'),
	},
	(table) => ({
		statusIndex: index('policy_states_status_idx').on(table.status),
		userIdIndex: index('policy_states_user_id_idx').on(table.user_id),
	}),
);

export const memoriesTable = pgTable(
	'memories',
	{
		archived_at: timestamp('archived_at', { mode: 'string', withTimezone: true }),
		content: text('content').notNull(),
		created_at: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
		embedding_metadata: jsonb('embedding_metadata').$type<MemoryEmbeddingMetadata | null>(),
		memory_id: text('memory_id').primaryKey(),
		retrieval_text: text('retrieval_text'),
		scope: text('scope').$type<MemoryScope>().notNull(),
		scope_id: text('scope_id').notNull(),
		source_kind: text('source_kind').$type<MemorySourceKind>().notNull(),
		source_run_id: text('source_run_id'),
		source_trace_id: text('source_trace_id'),
		status: text('status').$type<MemoryStatus>().notNull(),
		summary: text('summary').notNull(),
		tenant_id: text('tenant_id'),
		updated_at: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
		user_id: text('user_id'),
		workspace_id: text('workspace_id'),
	},
	(table) => ({
		scopeScopeIdStatusIndex: index('memories_scope_scope_id_status_idx').on(
			table.scope,
			table.scope_id,
			table.status,
		),
		sourceTraceIdIndex: index('memories_source_trace_id_idx').on(table.source_trace_id),
	}),
);

export const checkpointsTable = pgTable(
	'checkpoints',
	{
		checkpoint_id: text('checkpoint_id').primaryKey(),
		checkpoint_version: integer('checkpoint_version').notNull(),
		checkpointed_at: timestamp('checkpointed_at', { mode: 'string', withTimezone: true }).notNull(),
		created_at: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
		event_sequence_no: integer('event_sequence_no'),
		loop_state: text('loop_state').$type<LoopState>().notNull(),
		meta: jsonb('meta').$type<CheckpointMeta>().notNull(),
		metadata: jsonb('metadata').$type<CheckpointMetadata | null>(),
		parent_checkpoint_id: text('parent_checkpoint_id'),
		persistence_mode: text('persistence_mode').$type<CheckpointPersistenceMode>().notNull(),
		resume: jsonb('resume').$type<ResumeContext>().notNull(),
		run_id: text('run_id').notNull(),
		runtime_state: text('runtime_state').$type<RuntimeState>(),
		schema_version: integer('schema_version').notNull(),
		scope_kind: text('scope_kind').$type<CheckpointScopeKind>().notNull(),
		scope_subject_id: text('scope_subject_id').notNull(),
		session_id: text('session_id'),
		status: text('status').$type<CheckpointStatus>().notNull(),
		stop_reason: jsonb('stop_reason').$type<StopReason | null>(),
		tenant_id: text('tenant_id'),
		trace_id: text('trace_id').notNull(),
		trigger: text('trigger').$type<CheckpointTriggerKind>().notNull(),
		turn_index: integer('turn_index').notNull(),
		updated_at: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
		user_id: text('user_id'),
		workspace_id: text('workspace_id'),
	},
	(table) => ({
		runIdIndex: index('checkpoints_run_id_idx').on(table.run_id),
		sessionIdIndex: index('checkpoints_session_id_idx').on(table.session_id),
		statusIndex: index('checkpoints_status_idx').on(table.status),
		traceIdIndex: index('checkpoints_trace_id_idx').on(table.trace_id),
	}),
);

export const conversationRunBlocksTable = pgTable(
	'conversation_run_blocks',
	{
		block_record_id: text('block_record_id').primaryKey(),
		blocks: jsonb('blocks').$type<readonly RenderBlock[]>().notNull(),
		conversation_id: text('conversation_id').notNull(),
		created_at: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
		run_id: text('run_id').notNull().unique(),
		tenant_id: text('tenant_id'),
		trace_id: text('trace_id').notNull(),
		user_id: text('user_id'),
		workspace_id: text('workspace_id'),
	},
	(table) => ({
		conversationIdIndex: index('conversation_run_blocks_conversation_id_idx').on(
			table.conversation_id,
		),
		runIdIndex: index('conversation_run_blocks_run_id_idx').on(table.run_id),
	}),
);
