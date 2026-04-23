/**
 * @runa/db - Database Layer
 *
 * Minimal Drizzle/Postgres surface for Sprint 1 persistence wiring.
 */

export {
	closeDatabaseConnection,
	createDatabaseConnection,
	createDatabaseConnectionFromEnvironment,
	ensureDatabaseSchema,
	getDatabaseSchemaBootstrapStatements,
	type DatabaseConnection,
	type RunaDatabase,
} from './client.js';
export {
	DatabaseConfigError,
	isCloudDatabaseTarget,
	resolveDatabaseConfig,
	type CloudDatabaseRuntimeConfig,
	type DatabaseEnvironment,
	type DatabaseRuntimeConfig,
	type DatabaseTarget,
	type DatabaseTargetInput,
	type DatabaseTargetSource,
	type DatabaseUrlSource,
	type LocalDatabaseRuntimeConfig,
} from './config.js';
export {
	createDatabaseBootstrapPlan,
	runDatabaseBootstrapFromEnvironment,
	runDatabaseBootstrapPlan,
	type DatabaseBootstrapDependencies,
	type DatabaseBootstrapPlan,
	type DatabaseBootstrapResult,
} from './migrate.js';
export {
	RlsApplyError,
	applyRlsPlan,
	applyRlsPlanFromEnvironment,
	createRlsPlan,
	createRlsPlanFromEnvironment,
	type DeferredRlsPolicyPlan,
	type ReadyRlsPolicyPlan,
	type RlsAccessModel,
	type RlsApplyDependencies,
	type RlsApplyResult,
	type RlsPlan,
	type RlsPlanMode,
	type RlsPolicyKind,
	type RlsPolicyPlan,
	type RlsResource,
	type RlsResourcePlan,
} from './rls.js';
export {
	DatabaseCrudSmokeError,
	createDatabaseCrudSmokePlan,
	runDatabaseCrudSmokeFromEnvironment,
	runDatabaseCrudSmokePlan,
	type DatabaseCrudSmokeDependencies,
	type DatabaseCrudSmokeFixtures,
	type DatabaseCrudSmokePlan,
	type DatabaseCrudSmokeResult,
	type DatabaseCrudSmokeStep,
	type DatabaseCrudSmokeStepKind,
} from './smoke.js';
export type { ApprovalRecord, NewApprovalRecord } from './approvals.js';
export type {
	ConversationMemberRecord,
	ConversationMessageRecord,
	ConversationRecord,
	NewConversationMemberRecord,
	NewConversationMessageRecord,
	NewConversationRecord,
} from './conversations.js';
export {
	createConversationDatabaseClient,
	type ConversationDatabaseClient,
	type ListConversationRowsInput,
} from './conversations.js';
export {
	createCheckpointPersistenceDatabaseClient,
	type CheckpointPersistenceDatabaseClient,
	type ListCheckpointRowsInput,
} from './checkpoint-store.js';
export type { CheckpointRecord, NewCheckpointRecord } from './checkpoints.js';
export type { MemoryRecord, NewMemoryRecord } from './memories.js';
export {
	createPolicyStateDatabaseClient,
	type PolicyStateDatabaseClient,
} from './policy-state-store.js';
export type { NewPolicyStateRecord, PolicyStateRecord } from './policy-states.js';
export {
	toRuntimeEventRecord,
	type NewRuntimeEventRecord,
	type RuntimeEventRecord,
} from './runtime-events.js';
export type { NewRunRecord, RunRecord } from './runs.js';
export {
	conversationMembersTable,
	approvalsTable,
	checkpointsTable,
	conversationMessagesTable,
	conversationsTable,
	memoriesTable,
	policyStatesTable,
	runtimeEventsTable,
	runsTable,
	toolCallsTable,
} from './schema.js';
export type { NewToolCallRecord, ToolCallRecord } from './tool-calls.js';
