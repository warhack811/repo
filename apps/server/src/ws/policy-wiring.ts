import type {
	ApprovalActionKind,
	ApprovalMode,
	ApprovalRequest,
	ToolCapabilityClass,
	ToolDefinition,
	ToolName,
	ToolRiskLevel,
	ToolSideEffectLevel,
} from '@runa/types';

import type { PendingApprovalEntry } from '../persistence/approval-store.js';
import {
	type PolicyStateStore,
	createDefaultPolicyStateStore,
	toPolicyStateScope,
} from '../persistence/policy-state-store.js';
import {
	type PermissionDecision,
	type PermissionEngine,
	type PermissionEngineState,
	type PermissionOutcomeKind,
	type PermissionOutcomeResult,
	type RequireApprovalPermissionDecision,
	createAutoContinuePermissionRequest,
	createPermissionEngine,
	createToolPermissionRequest,
} from '../policy/permission-engine.js';
import { type WebSocketConnection, getWebSocketAuthContext } from './transport.js';

const AUTO_CONTINUE_APPROVAL_TARGET_LABEL = 'agent.auto_continue';

export interface WebSocketPolicyWiring {
	readonly permission_engine: PermissionEngine;
	evaluateAutoContinuePermission(
		socket: WebSocketConnection,
		input?: Readonly<{
			readonly requested_max_consecutive_turns?: number;
		}>,
	): Promise<
		Readonly<{
			readonly decision: PermissionDecision;
			readonly state: PermissionEngineState;
		}>
	>;
	evaluateToolPermission(
		socket: WebSocketConnection,
		input: Readonly<{
			readonly call_id: string;
			readonly tool_definition: Pick<ToolDefinition, 'metadata' | 'name'>;
		}>,
	): Promise<
		Readonly<{
			readonly decision: PermissionDecision;
			readonly state: PermissionEngineState;
		}>
	>;
	getState(socket: WebSocketConnection): Promise<PermissionEngineState>;
	recordOutcome(
		socket: WebSocketConnection,
		input: Readonly<{
			readonly decision: PermissionDecision;
			readonly outcome: PermissionOutcomeKind;
		}>,
	): Promise<PermissionOutcomeResult>;
	setApprovalMode(
		socket: WebSocketConnection,
		approvalMode: ApprovalMode | string | undefined,
	): Promise<PermissionEngineState>;
	rememberApprovalDecision(
		socket: WebSocketConnection,
		approval_id: string,
		decision: RequireApprovalPermissionDecision,
	): void;
	resolveApprovalDecision(
		socket: WebSocketConnection,
		input: Readonly<{
			readonly pending_approval: PendingApprovalEntry;
			readonly tool_definition?: Pick<ToolDefinition, 'metadata' | 'name'>;
		}>,
	): RequireApprovalPermissionDecision;
}

interface CreateWebSocketPolicyWiringOptions {
	readonly permission_engine?: PermissionEngine;
	readonly policy_state_store?: PolicyStateStore | null;
}

function inferCapabilityClass(
	actionKind: ApprovalActionKind,
	toolName: ToolName | undefined,
): ToolCapabilityClass {
	if (actionKind === 'shell_execution' || toolName === 'shell.exec') {
		return 'shell';
	}

	if (toolName?.startsWith('search.') === true || toolName === 'web.search') {
		return 'search';
	}

	return 'file_system';
}

function inferRiskLevel(
	actionKind: ApprovalActionKind,
	riskLevel: ToolRiskLevel | undefined,
): ToolRiskLevel {
	if (riskLevel !== undefined) {
		return riskLevel;
	}

	return actionKind === 'shell_execution' ? 'high' : 'medium';
}

function inferSideEffectLevel(
	actionKind: ApprovalActionKind,
	toolName: ToolName | undefined,
): ToolSideEffectLevel {
	if (actionKind === 'shell_execution' || toolName === 'shell.exec') {
		return 'execute';
	}

	if (actionKind === 'file_write' || toolName === 'file.write' || toolName === 'edit.patch') {
		return 'write';
	}

	if (
		toolName?.startsWith('search.') === true ||
		toolName === 'web.search' ||
		toolName === 'file.read' ||
		toolName === 'file.list' ||
		toolName === 'git.diff' ||
		toolName === 'git.status'
	) {
		return 'read';
	}

	return 'read';
}

function toToolName(value: string | undefined): ToolName | undefined {
	if (value === undefined || value.includes('.') !== true) {
		return undefined;
	}

	return value as ToolName;
}

function createFallbackApprovalDecision(
	approvalRequest: ApprovalRequest,
	toolDefinition?: Pick<ToolDefinition, 'metadata' | 'name'>,
): RequireApprovalPermissionDecision {
	if (approvalRequest.target?.label === AUTO_CONTINUE_APPROVAL_TARGET_LABEL) {
		return {
			approval_requirement: {
				action_kind: 'auto_continue',
				requires_reason: approvalRequest.requires_reason ?? true,
				source: 'progressive_trust',
			},
			decision: 'require_approval',
			reason: 'auto_continue_disabled',
			request: createAutoContinuePermissionRequest(),
		};
	}

	const toolName =
		toolDefinition?.name ?? approvalRequest.tool_name ?? toToolName(approvalRequest.target?.label);
	const capabilityId =
		toolName ??
		approvalRequest.target?.tool_name ??
		approvalRequest.target?.label ??
		approvalRequest.action_kind;
	const capabilityClass =
		toolDefinition?.metadata.capability_class ??
		inferCapabilityClass(approvalRequest.action_kind, toolName);
	const requiresApproval = toolDefinition?.metadata.requires_approval ?? true;

	return {
		approval_requirement: {
			action_kind: approvalRequest.action_kind,
			requires_reason: approvalRequest.requires_reason ?? false,
			source: requiresApproval ? 'capability' : 'policy',
		},
		decision: 'require_approval',
		reason: requiresApproval ? 'approval_required_by_capability' : 'approval_required_by_policy',
		request: {
			call_id: approvalRequest.call_id,
			capability: {
				action_kind: approvalRequest.action_kind,
				capability_class: capabilityClass,
				capability_id: capabilityId,
				requires_approval: requiresApproval,
				risk_level:
					toolDefinition?.metadata.risk_level ??
					inferRiskLevel(approvalRequest.action_kind, approvalRequest.risk_level),
				side_effect_level:
					toolDefinition?.metadata.side_effect_level ??
					inferSideEffectLevel(approvalRequest.action_kind, toolName),
				tool_name: toolName,
			},
			kind: 'tool_execution',
		},
	};
}

export function createWebSocketPolicyWiring(
	options: CreateWebSocketPolicyWiringOptions = {},
): WebSocketPolicyWiring {
	const permissionEngine = options.permission_engine ?? createPermissionEngine();
	const policyStateStore =
		options.policy_state_store === undefined
			? createDefaultPolicyStateStore()
			: options.policy_state_store;
	const stateBySocket = new WeakMap<WebSocketConnection, PermissionEngineState>();

	function getPersistentScope(socket: WebSocketConnection) {
		return toPolicyStateScope(getWebSocketAuthContext(socket));
	}

	async function getOrCreateState(socket: WebSocketConnection): Promise<PermissionEngineState> {
		const existingState = stateBySocket.get(socket);

		if (existingState !== undefined) {
			return existingState;
		}

		const persistentScope = getPersistentScope(socket);

		if (policyStateStore && persistentScope) {
			const persistedState = await policyStateStore.getPolicyState(persistentScope);

			if (persistedState !== null) {
				stateBySocket.set(socket, persistedState);
				return persistedState;
			}
		}

		const initialState = permissionEngine.createInitialState();
		stateBySocket.set(socket, initialState);
		return initialState;
	}

	async function setState(
		socket: WebSocketConnection,
		state: PermissionEngineState,
	): Promise<void> {
		stateBySocket.set(socket, state);

		const persistentScope = getPersistentScope(socket);

		if (policyStateStore && persistentScope) {
			await policyStateStore.putPolicyState(persistentScope, state);
		}
	}

	return {
		permission_engine: permissionEngine,
		async evaluateAutoContinuePermission(socket, input = {}) {
			const state = await getOrCreateState(socket);
			const decision = permissionEngine.evaluatePermission({
				request: createAutoContinuePermissionRequest({
					requested_max_consecutive_turns: input.requested_max_consecutive_turns,
				}),
				state,
			});

			return {
				decision,
				state,
			};
		},
		async evaluateToolPermission(socket, input) {
			const state = await getOrCreateState(socket);
			const decision = permissionEngine.evaluatePermission({
				request: createToolPermissionRequest({
					call_id: input.call_id,
					tool_definition: input.tool_definition,
				}),
				state,
			});

			return {
				decision,
				state,
			};
		},
		getState(socket) {
			return getOrCreateState(socket);
		},
		async recordOutcome(socket, input) {
			const result = permissionEngine.recordPermissionOutcome({
				decision: input.decision,
				outcome: input.outcome,
				state: await getOrCreateState(socket),
			});

			await setState(socket, result.next_state);
			return result;
		},
		async setApprovalMode(socket, approvalMode) {
			const nextState = permissionEngine.applyApprovalMode({
				approval_mode: approvalMode,
				state: await getOrCreateState(socket),
			});

			await setState(socket, nextState);
			return nextState;
		},
		rememberApprovalDecision(_socket, _approvalId, _decision) {
			// Approval decisions are reconstructed from persisted approval metadata when resolved.
		},
		resolveApprovalDecision(_socket, input) {
			return createFallbackApprovalDecision(
				input.pending_approval.approval_request,
				input.tool_definition,
			);
		},
	};
}
