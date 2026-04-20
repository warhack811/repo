import type {
	ApprovalActionKind,
	ToolCapabilityClass,
	ToolDefinition,
	ToolName,
	ToolRiskLevel,
	ToolSideEffectLevel,
} from '@runa/types';

const DEFAULT_DENIAL_PAUSE_THRESHOLD = 3;
const AUTO_CONTINUE_CAPABILITY_ID = 'agent.auto_continue';

export const permissionDecisionKinds = ['allow', 'require_approval', 'deny', 'pause'] as const;

export type PermissionDecisionKind = (typeof permissionDecisionKinds)[number];

export const permissionOutcomeKinds = [
	'allowed',
	'approval_approved',
	'approval_rejected',
	'denied',
	'session_resumed',
] as const;

export type PermissionOutcomeKind = (typeof permissionOutcomeKinds)[number];

export type PermissionActionKind = ApprovalActionKind | 'auto_continue';

export type PermissionCapabilityClass = ToolCapabilityClass | 'session_control';

export type PermissionSideEffectLevel = ToolSideEffectLevel | 'session_control';

export type PermissionDecisionReason =
	| 'approval_required_by_capability'
	| 'approval_required_by_policy'
	| 'auto_continue_disabled'
	| 'capability_hard_denied'
	| 'progressive_trust_enabled'
	| 'safe_capability'
	| 'session_paused_after_denials';

export type PermissionPauseReason = 'denial_threshold';

export interface PermissionCapabilityDescriptor {
	readonly action_kind: PermissionActionKind;
	readonly capability_class: PermissionCapabilityClass;
	readonly capability_id: string;
	readonly requires_approval: boolean;
	readonly risk_level: ToolRiskLevel;
	readonly side_effect_level: PermissionSideEffectLevel;
	readonly tool_name?: ToolName;
}

export interface ToolExecutionPermissionRequest {
	readonly call_id?: string;
	readonly capability: PermissionCapabilityDescriptor;
	readonly kind: 'tool_execution';
}

export interface AutoContinuePermissionRequest {
	readonly capability: PermissionCapabilityDescriptor;
	readonly kind: 'auto_continue';
	readonly requested_max_consecutive_turns?: number;
}

export type PermissionRequest = AutoContinuePermissionRequest | ToolExecutionPermissionRequest;

export interface PermissionDenialTrackingState {
	readonly consecutive_denials: number;
	readonly last_denial_at?: string;
	readonly last_denied_capability_id?: string;
	readonly threshold: number;
}

export interface PermissionProgressiveTrustState {
	readonly auto_continue: {
		readonly enabled: boolean;
		readonly enabled_at?: string;
		readonly max_consecutive_turns?: number;
	};
}

export interface PermissionSessionPauseState {
	readonly active: boolean;
	readonly paused_at?: string;
	readonly reason?: PermissionPauseReason;
}

export interface PermissionEngineState {
	readonly denial_tracking: PermissionDenialTrackingState;
	readonly progressive_trust: PermissionProgressiveTrustState;
	readonly session_pause: PermissionSessionPauseState;
}

interface PermissionDecisionBase<
	TKind extends PermissionDecisionKind,
	TReason extends PermissionDecisionReason,
> {
	readonly decision: TKind;
	readonly reason: TReason;
	readonly request: PermissionRequest;
}

export interface AllowPermissionDecision
	extends PermissionDecisionBase<'allow', 'progressive_trust_enabled' | 'safe_capability'> {}

export interface RequireApprovalPermissionDecision
	extends PermissionDecisionBase<
		'require_approval',
		'approval_required_by_capability' | 'approval_required_by_policy' | 'auto_continue_disabled'
	> {
	readonly approval_requirement: {
		readonly action_kind: PermissionActionKind;
		readonly requires_reason: boolean;
		readonly source: 'capability' | 'policy' | 'progressive_trust';
	};
}

export interface DenyPermissionDecision
	extends PermissionDecisionBase<'deny', 'capability_hard_denied'> {
	readonly denial: {
		readonly capability_id: string;
		readonly source: 'policy';
	};
}

export interface PausePermissionDecision
	extends PermissionDecisionBase<'pause', 'session_paused_after_denials'> {
	readonly pause: {
		readonly consecutive_denials: number;
		readonly reason: PermissionPauseReason;
		readonly threshold: number;
	};
}

export type PermissionDecision =
	| AllowPermissionDecision
	| DenyPermissionDecision
	| PausePermissionDecision
	| RequireApprovalPermissionDecision;

export interface PermissionEngineInput {
	readonly request: PermissionRequest;
	readonly state?: PermissionEngineState;
}

export interface RecordPermissionOutcomeInput {
	readonly decision: PermissionDecision;
	readonly outcome: PermissionOutcomeKind;
	readonly state?: PermissionEngineState;
}

export interface PermissionOutcomeResult {
	readonly next_state: PermissionEngineState;
	readonly outcome: PermissionOutcomeKind;
	readonly pause_transition: 'cleared' | 'entered' | 'none';
}

export interface PermissionEngineConfig {
	readonly approval_required_capability_ids?: readonly string[];
	readonly denial_pause_threshold?: number;
	readonly hard_denied_capability_ids?: readonly string[];
	readonly now?: () => string;
}

export interface PermissionEngine {
	createInitialState(): PermissionEngineState;
	evaluatePermission(input: PermissionEngineInput): PermissionDecision;
	recordPermissionOutcome(input: RecordPermissionOutcomeInput): PermissionOutcomeResult;
}

export class PermissionEngineError extends Error {
	override readonly cause?: unknown;
	readonly code = 'PERMISSION_ENGINE_ERROR';

	constructor(message: string, cause?: unknown) {
		super(message);
		this.cause = cause;
		this.name = 'PermissionEngineError';
	}
}

function normalizeThreshold(threshold: number | undefined): number {
	const resolvedThreshold = threshold ?? DEFAULT_DENIAL_PAUSE_THRESHOLD;

	if (!Number.isInteger(resolvedThreshold) || resolvedThreshold < 1) {
		throw new PermissionEngineError(
			`Permission denial pause threshold must be a positive integer, received ${String(threshold)}.`,
		);
	}

	return resolvedThreshold;
}

function createRuleSet(values: readonly string[] | undefined): ReadonlySet<string> {
	return new Set(values ?? []);
}

function createNow(now: (() => string) | undefined): () => string {
	return now ?? (() => new Date().toISOString());
}

function shouldRequireReason(capability: PermissionCapabilityDescriptor): boolean {
	return capability.risk_level === 'high' || capability.side_effect_level === 'execute';
}

function isAutoContinueRequest(
	request: PermissionRequest,
): request is AutoContinuePermissionRequest {
	return request.kind === 'auto_continue';
}

function createSessionPauseState(
	input: Readonly<{
		readonly active: boolean;
		readonly paused_at?: string;
		readonly reason?: PermissionPauseReason;
	}>,
): PermissionSessionPauseState {
	if (!input.active) {
		return {
			active: false,
		};
	}

	return {
		active: true,
		paused_at: input.paused_at,
		reason: input.reason,
	};
}

export function createInitialPermissionEngineState(
	config: Pick<PermissionEngineConfig, 'denial_pause_threshold'> = {},
): PermissionEngineState {
	return {
		denial_tracking: {
			consecutive_denials: 0,
			threshold: normalizeThreshold(config.denial_pause_threshold),
		},
		progressive_trust: {
			auto_continue: {
				enabled: false,
			},
		},
		session_pause: createSessionPauseState({
			active: false,
		}),
	};
}

function resolveState(
	state: PermissionEngineState | undefined,
	threshold: number,
): PermissionEngineState {
	if (state !== undefined) {
		return state;
	}

	return createInitialPermissionEngineState({
		denial_pause_threshold: threshold,
	});
}

function isSessionPaused(state: PermissionEngineState): boolean {
	return state.session_pause.active;
}

function createPauseDecision(
	request: PermissionRequest,
	state: PermissionEngineState,
): PausePermissionDecision {
	return {
		decision: 'pause',
		pause: {
			consecutive_denials: state.denial_tracking.consecutive_denials,
			reason: 'denial_threshold',
			threshold: state.denial_tracking.threshold,
		},
		reason: 'session_paused_after_denials',
		request,
	};
}

function createApprovalDecision(
	request: PermissionRequest,
	reason: RequireApprovalPermissionDecision['reason'],
	source: RequireApprovalPermissionDecision['approval_requirement']['source'],
): RequireApprovalPermissionDecision {
	return {
		approval_requirement: {
			action_kind: request.capability.action_kind,
			requires_reason: shouldRequireReason(request.capability),
			source,
		},
		decision: 'require_approval',
		reason,
		request,
	};
}

function createAllowDecision(
	request: PermissionRequest,
	reason: AllowPermissionDecision['reason'],
): AllowPermissionDecision {
	return {
		decision: 'allow',
		reason,
		request,
	};
}

function createDenyDecision(request: PermissionRequest): DenyPermissionDecision {
	return {
		decision: 'deny',
		denial: {
			capability_id: request.capability.capability_id,
			source: 'policy',
		},
		reason: 'capability_hard_denied',
		request,
	};
}

export function evaluatePermission(
	input: PermissionEngineInput,
	config: PermissionEngineConfig = {},
): PermissionDecision {
	const threshold = normalizeThreshold(config.denial_pause_threshold);
	const state = resolveState(input.state, threshold);
	const hardDeniedCapabilities = createRuleSet(config.hard_denied_capability_ids);
	const approvalRequiredCapabilities = createRuleSet(config.approval_required_capability_ids);
	const capabilityId = input.request.capability.capability_id;

	if (isSessionPaused(state)) {
		return createPauseDecision(input.request, state);
	}

	if (hardDeniedCapabilities.has(capabilityId)) {
		return createDenyDecision(input.request);
	}

	if (
		isAutoContinueRequest(input.request) &&
		state.progressive_trust.auto_continue.enabled !== true
	) {
		return createApprovalDecision(input.request, 'auto_continue_disabled', 'progressive_trust');
	}

	if (approvalRequiredCapabilities.has(capabilityId)) {
		return createApprovalDecision(input.request, 'approval_required_by_policy', 'policy');
	}

	if (input.request.capability.requires_approval) {
		return createApprovalDecision(input.request, 'approval_required_by_capability', 'capability');
	}

	if (isAutoContinueRequest(input.request)) {
		return createAllowDecision(input.request, 'progressive_trust_enabled');
	}

	return createAllowDecision(input.request, 'safe_capability');
}

function resetDenialTracking(state: PermissionEngineState): PermissionEngineState {
	return {
		...state,
		denial_tracking: {
			consecutive_denials: 0,
			threshold: state.denial_tracking.threshold,
		},
	};
}

function recordDenial(
	state: PermissionEngineState,
	request: PermissionRequest,
	now: () => string,
): PermissionOutcomeResult {
	const deniedAt = now();
	const nextDenials = state.denial_tracking.consecutive_denials + 1;
	const pauseTriggered = nextDenials >= state.denial_tracking.threshold;

	return {
		next_state: {
			...state,
			denial_tracking: {
				consecutive_denials: nextDenials,
				last_denial_at: deniedAt,
				last_denied_capability_id: request.capability.capability_id,
				threshold: state.denial_tracking.threshold,
			},
			session_pause: createSessionPauseState({
				active: pauseTriggered,
				paused_at: pauseTriggered ? deniedAt : undefined,
				reason: pauseTriggered ? 'denial_threshold' : undefined,
			}),
		},
		outcome: 'denied',
		pause_transition: pauseTriggered ? 'entered' : 'none',
	};
}

function recordApprovalApproved(
	state: PermissionEngineState,
	decision: RequireApprovalPermissionDecision,
	now: () => string,
): PermissionOutcomeResult {
	const clearedState = resetDenialTracking(state);

	if (!isAutoContinueRequest(decision.request)) {
		return {
			next_state: {
				...clearedState,
				session_pause: state.session_pause,
			},
			outcome: 'approval_approved',
			pause_transition: 'none',
		};
	}

	return {
		next_state: {
			...clearedState,
			progressive_trust: {
				...clearedState.progressive_trust,
				auto_continue: {
					enabled: true,
					enabled_at: now(),
					max_consecutive_turns: decision.request.requested_max_consecutive_turns,
				},
			},
			session_pause: state.session_pause,
		},
		outcome: 'approval_approved',
		pause_transition: 'none',
	};
}

function recordAllowed(state: PermissionEngineState): PermissionOutcomeResult {
	return {
		next_state: {
			...resetDenialTracking(state),
			session_pause: state.session_pause,
		},
		outcome: 'allowed',
		pause_transition: 'none',
	};
}

function recordSessionResumed(state: PermissionEngineState): PermissionOutcomeResult {
	return {
		next_state: {
			...resetDenialTracking(state),
			session_pause: createSessionPauseState({
				active: false,
			}),
		},
		outcome: 'session_resumed',
		pause_transition: state.session_pause.active ? 'cleared' : 'none',
	};
}

function assertOutcomeCompatibility(
	decision: PermissionDecision,
	outcome: PermissionOutcomeKind,
): void {
	switch (outcome) {
		case 'allowed':
			if (decision.decision !== 'allow') {
				throw new PermissionEngineError(
					`Permission outcome "${outcome}" is only valid for allow decisions.`,
				);
			}
			return;
		case 'approval_approved':
		case 'approval_rejected':
			if (decision.decision !== 'require_approval') {
				throw new PermissionEngineError(
					`Permission outcome "${outcome}" is only valid for require_approval decisions.`,
				);
			}
			return;
		case 'denied':
			if (decision.decision !== 'deny' && decision.decision !== 'require_approval') {
				throw new PermissionEngineError(
					`Permission outcome "${outcome}" is only valid for deny or require_approval decisions.`,
				);
			}
			return;
		case 'session_resumed':
			return;
	}
}

function assertRequireApprovalDecision(
	decision: PermissionDecision,
): asserts decision is RequireApprovalPermissionDecision {
	if (decision.decision !== 'require_approval') {
		throw new PermissionEngineError(
			'Permission decision must be require_approval for this outcome.',
		);
	}
}

export function recordPermissionOutcome(
	input: RecordPermissionOutcomeInput,
	config: Pick<PermissionEngineConfig, 'denial_pause_threshold' | 'now'> = {},
): PermissionOutcomeResult {
	const threshold = normalizeThreshold(config.denial_pause_threshold);
	const state = resolveState(input.state, threshold);
	const now = createNow(config.now);

	assertOutcomeCompatibility(input.decision, input.outcome);

	switch (input.outcome) {
		case 'allowed':
			return recordAllowed(state);
		case 'approval_approved':
			assertRequireApprovalDecision(input.decision);
			return recordApprovalApproved(state, input.decision, now);
		case 'approval_rejected':
		case 'denied':
			return recordDenial(state, input.decision.request, now);
		case 'session_resumed':
			return recordSessionResumed(state);
	}
}

export function createPermissionEngine(config: PermissionEngineConfig = {}): PermissionEngine {
	const threshold = normalizeThreshold(config.denial_pause_threshold);

	return {
		createInitialState() {
			return createInitialPermissionEngineState({
				denial_pause_threshold: threshold,
			});
		},
		evaluatePermission(input) {
			return evaluatePermission(input, {
				approval_required_capability_ids: config.approval_required_capability_ids,
				denial_pause_threshold: threshold,
				hard_denied_capability_ids: config.hard_denied_capability_ids,
			});
		},
		recordPermissionOutcome(input) {
			return recordPermissionOutcome(input, {
				denial_pause_threshold: threshold,
				now: config.now,
			});
		},
	};
}

function buildActionKindFromTool(
	tool: Pick<ToolDefinition, 'metadata' | 'name'>,
): ApprovalActionKind {
	if (
		tool.name === 'file.write' ||
		(tool.metadata.capability_class === 'file_system' &&
			tool.metadata.side_effect_level === 'write')
	) {
		return 'file_write';
	}

	if (
		tool.name === 'shell.exec' ||
		(tool.metadata.capability_class === 'shell' && tool.metadata.side_effect_level === 'execute')
	) {
		return 'shell_execution';
	}

	return 'tool_execution';
}

export function createToolPermissionRequest(
	input: Readonly<{
		readonly call_id?: string;
		readonly tool_definition: Pick<ToolDefinition, 'metadata' | 'name'>;
	}>,
): ToolExecutionPermissionRequest {
	return {
		call_id: input.call_id,
		capability: {
			action_kind: buildActionKindFromTool(input.tool_definition),
			capability_class: input.tool_definition.metadata.capability_class,
			capability_id: input.tool_definition.name,
			requires_approval: input.tool_definition.metadata.requires_approval,
			risk_level: input.tool_definition.metadata.risk_level,
			side_effect_level: input.tool_definition.metadata.side_effect_level,
			tool_name: input.tool_definition.name,
		},
		kind: 'tool_execution',
	};
}

export function createAutoContinuePermissionRequest(
	input: Readonly<{
		readonly requested_max_consecutive_turns?: number;
	}> = {},
): AutoContinuePermissionRequest {
	return {
		capability: {
			action_kind: 'auto_continue',
			capability_class: 'session_control',
			capability_id: AUTO_CONTINUE_CAPABILITY_ID,
			requires_approval: false,
			risk_level: 'high',
			side_effect_level: 'session_control',
		},
		kind: 'auto_continue',
		requested_max_consecutive_turns: input.requested_max_consecutive_turns,
	};
}
