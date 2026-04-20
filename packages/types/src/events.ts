import type { ApprovalActionKind, ApprovalDecisionKind } from './policy.js';
import type { RuntimeState } from './state.js';
import type { ToolName } from './tools.js';

export type EventMetadata = Readonly<Record<string, unknown>>;

export interface EventSource {
	readonly kind: 'runtime' | 'gateway' | 'system' | 'websocket';
	readonly id?: string;
}

export interface EventActor {
	readonly type: 'system' | 'assistant' | 'user';
	readonly id?: string;
}

export interface RunStartedEventPayload {
	readonly entry_state: 'INIT';
	readonly trigger: 'user_message';
	readonly message_id?: string;
}

export interface StateEnteredEventPayload {
	readonly state: RuntimeState;
	readonly previous_state?: RuntimeState;
	readonly reason?: string;
}

export interface ModelCompletedEventPayload {
	readonly provider: string;
	readonly model: string;
	readonly output_text: string;
	readonly finish_reason?: 'stop' | 'max_tokens' | 'error';
}

export interface RunCompletedEventPayload {
	readonly final_state: 'COMPLETED';
	readonly output_text?: string;
}

export interface RunFailedEventPayload {
	readonly final_state: 'FAILED';
	readonly error_message: string;
	readonly error_code?: string;
	readonly retryable?: boolean;
}

export interface ToolCallStartedEventPayload {
	readonly call_id: string;
	readonly tool_name: ToolName;
}

export interface ToolCallCompletedEventPayload {
	readonly call_id: string;
	readonly result_status: 'error' | 'success';
	readonly tool_name: ToolName;
}

export interface ToolCallFailedEventPayload {
	readonly call_id: string;
	readonly error_code?: string;
	readonly error_message: string;
	readonly retryable?: boolean;
	readonly tool_name: ToolName;
}

export interface ApprovalRequestedEventPayload {
	readonly approval_id: string;
	readonly action_kind: ApprovalActionKind;
	readonly call_id?: string;
	readonly summary: string;
	readonly title: string;
	readonly tool_name?: ToolName;
}

export interface ApprovalResolvedEventPayload {
	readonly approval_id: string;
	readonly decision: ApprovalDecisionKind;
	readonly note?: string;
	readonly resolved_at: string;
}

export interface EventPayloadMap {
	readonly 'run.started': RunStartedEventPayload;
	readonly 'state.entered': StateEnteredEventPayload;
	readonly 'model.completed': ModelCompletedEventPayload;
	readonly 'run.completed': RunCompletedEventPayload;
	readonly 'run.failed': RunFailedEventPayload;
	readonly 'tool.call.started': ToolCallStartedEventPayload;
	readonly 'tool.call.completed': ToolCallCompletedEventPayload;
	readonly 'tool.call.failed': ToolCallFailedEventPayload;
	readonly 'approval.requested': ApprovalRequestedEventPayload;
	readonly 'approval.resolved': ApprovalResolvedEventPayload;
}

export type EventType = keyof EventPayloadMap;

export type EventPayload<TType extends EventType = EventType> = EventPayloadMap[TType];

export interface EventEnvelope<
	TType extends EventType = EventType,
	TPayload extends EventPayload<TType> = EventPayload<TType>,
> {
	readonly event_id: string;
	readonly event_version: number;
	readonly event_type: TType;
	readonly timestamp: string;
	readonly run_id: string;
	readonly trace_id: string;
	readonly payload: TPayload;
	readonly session_id?: string;
	readonly sequence_no?: number;
	readonly parent_event_id?: string;
	readonly source?: EventSource;
	readonly actor?: EventActor;
	readonly state_before?: RuntimeState;
	readonly state_after?: RuntimeState;
	readonly metadata?: EventMetadata;
}

export type RunStartedEvent = EventEnvelope<'run.started', RunStartedEventPayload>;

export type StateEnteredEvent = EventEnvelope<'state.entered', StateEnteredEventPayload>;

export type ModelCompletedEvent = EventEnvelope<'model.completed', ModelCompletedEventPayload>;

export type RunCompletedEvent = EventEnvelope<'run.completed', RunCompletedEventPayload>;

export type RunFailedEvent = EventEnvelope<'run.failed', RunFailedEventPayload>;

export type ToolCallStartedEvent = EventEnvelope<'tool.call.started', ToolCallStartedEventPayload>;

export type ToolCallCompletedEvent = EventEnvelope<
	'tool.call.completed',
	ToolCallCompletedEventPayload
>;

export type ToolCallFailedEvent = EventEnvelope<'tool.call.failed', ToolCallFailedEventPayload>;

export type ApprovalRequestedEvent = EventEnvelope<
	'approval.requested',
	ApprovalRequestedEventPayload
>;

export type ApprovalResolvedEvent = EventEnvelope<
	'approval.resolved',
	ApprovalResolvedEventPayload
>;

export type RuntimeEvent =
	| RunStartedEvent
	| StateEnteredEvent
	| ModelCompletedEvent
	| RunCompletedEvent
	| RunFailedEvent;

export type ToolRuntimeEvent = ToolCallStartedEvent | ToolCallCompletedEvent | ToolCallFailedEvent;

export type ApprovalRuntimeEvent = ApprovalRequestedEvent | ApprovalResolvedEvent;

export type AnyRuntimeEvent = RuntimeEvent | ToolRuntimeEvent | ApprovalRuntimeEvent;
