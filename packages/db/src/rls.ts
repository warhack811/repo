import { sql } from 'drizzle-orm';

import type { DatabaseConnection } from './client.js';
import type { DatabaseRuntimeConfig } from './config.js';

import { closeDatabaseConnection, createDatabaseConnection } from './client.js';
import { type DatabaseEnvironment, resolveDatabaseConfig } from './config.js';

export const rlsResources = [
	'runs',
	'runtime_events',
	'tool_calls',
	'approvals',
	'policy_states',
	'memories',
] as const;

export type RlsResource = (typeof rlsResources)[number];

export const rlsPolicyKinds = ['select', 'insert', 'update', 'delete'] as const;

export type RlsPolicyKind = (typeof rlsPolicyKinds)[number];

export const rlsAccessModels = ['workspace_isolation', 'workspace_or_user_isolation'] as const;

export type RlsAccessModel = (typeof rlsAccessModels)[number];

export type RlsPlanMode = 'skip' | 'deferred' | 'ready';

export interface ReadyRlsPolicyPlan {
	readonly kind: RlsPolicyKind;
	readonly name: string;
	readonly sql: string;
	readonly status: 'ready';
}

export interface DeferredRlsPolicyPlan {
	readonly kind: RlsPolicyKind;
	readonly name: string;
	readonly reason: string;
	readonly status: 'deferred';
}

export type RlsPolicyPlan = ReadyRlsPolicyPlan | DeferredRlsPolicyPlan;

export interface RlsResourcePlan {
	readonly access_model: RlsAccessModel;
	readonly policies: readonly RlsPolicyPlan[];
	readonly required_scope_columns: readonly string[];
	readonly resource: RlsResource;
}

export interface RlsPlan {
	readonly config: DatabaseRuntimeConfig;
	readonly mode: RlsPlanMode;
	readonly resources: readonly RlsResourcePlan[];
}

export interface RlsApplyDependencies {
	readonly close_connection?: (connection: DatabaseConnection) => Promise<void>;
	readonly create_connection?: (config: DatabaseRuntimeConfig) => DatabaseConnection;
	readonly execute_policy?: (
		connection: DatabaseConnection,
		policy: ReadyRlsPolicyPlan,
		resource: RlsResourcePlan,
	) => Promise<void>;
}

export interface RlsApplyResult {
	readonly executed_policies: readonly string[];
	readonly mode: RlsPlanMode;
	readonly skipped_policies: readonly string[];
	readonly target: DatabaseRuntimeConfig['target'];
}

export class RlsApplyError extends Error {
	readonly code = 'RLS_APPLY_ERROR';
	readonly policy_name: string;
	readonly resource: RlsResource;
	readonly target: DatabaseRuntimeConfig['target'];

	constructor(
		message: string,
		options: Readonly<{
			readonly cause?: unknown;
			readonly policy_name: string;
			readonly resource: RlsResource;
			readonly target: DatabaseRuntimeConfig['target'];
		}>,
	) {
		super(message);
		this.name = 'RlsApplyError';
		this.cause = options.cause;
		this.policy_name = options.policy_name;
		this.resource = options.resource;
		this.target = options.target;
	}
}

const CLOUD_RLS_DEFERRED_REASON =
	'Scope columns now exist, but current write paths do not yet persist them consistently and claim SQL is not finalized.';

function createDeferredPolicies(resource: RlsResource): readonly DeferredRlsPolicyPlan[] {
	return rlsPolicyKinds.map((kind) => ({
		kind,
		name: `${resource}_${kind}_policy`,
		reason: CLOUD_RLS_DEFERRED_REASON,
		status: 'deferred',
	}));
}

function createInitialResourcePlans(): readonly RlsResourcePlan[] {
	return [
		{
			access_model: 'workspace_or_user_isolation',
			policies: createDeferredPolicies('runs'),
			required_scope_columns: ['tenant_id', 'workspace_id', 'user_id'],
			resource: 'runs',
		},
		{
			access_model: 'workspace_isolation',
			policies: createDeferredPolicies('runtime_events'),
			required_scope_columns: ['tenant_id', 'workspace_id'],
			resource: 'runtime_events',
		},
		{
			access_model: 'workspace_isolation',
			policies: createDeferredPolicies('tool_calls'),
			required_scope_columns: ['tenant_id', 'workspace_id'],
			resource: 'tool_calls',
		},
		{
			access_model: 'workspace_or_user_isolation',
			policies: createDeferredPolicies('approvals'),
			required_scope_columns: ['tenant_id', 'workspace_id', 'user_id'],
			resource: 'approvals',
		},
		{
			access_model: 'workspace_or_user_isolation',
			policies: createDeferredPolicies('policy_states'),
			required_scope_columns: ['tenant_id', 'workspace_id', 'user_id'],
			resource: 'policy_states',
		},
		{
			access_model: 'workspace_or_user_isolation',
			policies: createDeferredPolicies('memories'),
			required_scope_columns: ['tenant_id', 'workspace_id', 'user_id'],
			resource: 'memories',
		},
	];
}

function resolvePlanMode(config: DatabaseRuntimeConfig): RlsPlanMode {
	if (config.target === 'local') {
		return 'skip';
	}

	return 'deferred';
}

export function createRlsPlan(config: DatabaseRuntimeConfig): RlsPlan {
	return {
		config,
		mode: resolvePlanMode(config),
		resources: createInitialResourcePlans(),
	};
}

export function createRlsPlanFromEnvironment(environment: DatabaseEnvironment): RlsPlan {
	return createRlsPlan(resolveDatabaseConfig(environment));
}

async function defaultExecutePolicy(
	connection: DatabaseConnection,
	policy: ReadyRlsPolicyPlan,
): Promise<void> {
	await connection.db.execute(sql.raw(policy.sql));
}

export async function applyRlsPlan(
	plan: RlsPlan,
	dependencies: RlsApplyDependencies = {},
): Promise<RlsApplyResult> {
	const executedPolicies: string[] = [];
	const skippedPolicies = plan.resources.flatMap((resource) =>
		resource.policies
			.filter((policy): policy is DeferredRlsPolicyPlan => policy.status === 'deferred')
			.map((policy) => policy.name),
	);

	if (plan.mode === 'skip') {
		return {
			executed_policies: executedPolicies,
			mode: plan.mode,
			skipped_policies: skippedPolicies,
			target: plan.config.target,
		};
	}

	const readyPolicies = plan.resources.flatMap((resource) =>
		resource.policies
			.filter((policy): policy is ReadyRlsPolicyPlan => policy.status === 'ready')
			.map((policy) => ({ policy, resource })),
	);

	if (readyPolicies.length === 0) {
		return {
			executed_policies: executedPolicies,
			mode: plan.mode,
			skipped_policies: skippedPolicies,
			target: plan.config.target,
		};
	}

	const createConnection = dependencies.create_connection ?? createDatabaseConnection;
	const closeConnection = dependencies.close_connection ?? closeDatabaseConnection;
	const executePolicy = dependencies.execute_policy ?? defaultExecutePolicy;
	const connection = createConnection(plan.config);

	try {
		for (const { policy, resource } of readyPolicies) {
			try {
				await executePolicy(connection, policy, resource);
				executedPolicies.push(policy.name);
			} catch (error: unknown) {
				throw new RlsApplyError(
					`Failed to apply RLS policy "${policy.name}" for resource "${resource.resource}".`,
					{
						cause: error,
						policy_name: policy.name,
						resource: resource.resource,
						target: plan.config.target,
					},
				);
			}
		}

		return {
			executed_policies: executedPolicies,
			mode: plan.mode,
			skipped_policies: skippedPolicies,
			target: plan.config.target,
		};
	} finally {
		await closeConnection(connection);
	}
}

export function applyRlsPlanFromEnvironment(
	environment: DatabaseEnvironment,
	dependencies: RlsApplyDependencies = {},
): Promise<RlsApplyResult> {
	return applyRlsPlan(createRlsPlanFromEnvironment(environment), dependencies);
}
