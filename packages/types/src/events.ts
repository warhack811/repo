import type { SupportedLocale } from './locale.js';
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

export interface NarrationEventPayloadBase {
	readonly locale: SupportedLocale;
	readonly narration_id: string;
	readonly run_id: string;
	readonly sequence_no: number;
	readonly timestamp: string;
	readonly turn_index: number;
	readonly linked_tool_call_id?: string;
}

export interface NarrationStartedEventPayload extends NarrationEventPayloadBase {}

export interface NarrationTokenEventPayload extends NarrationEventPayloadBase {
	readonly text_delta: string;
}

export interface NarrationCompletedEventPayload extends NarrationEventPayloadBase {
	readonly full_text: string;
}

export interface NarrationSupersededEventPayload extends NarrationEventPayloadBase {}

export type NarrationToolOutcome = 'failure' | 'success';

export interface NarrationToolOutcomeLinkedEventPayload extends NarrationEventPayloadBase {
	readonly outcome: NarrationToolOutcome;
	readonly tool_call_id: string;
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
	readonly 'narration.started': NarrationStartedEventPayload;
	readonly 'narration.token': NarrationTokenEventPayload;
	readonly 'narration.completed': NarrationCompletedEventPayload;
	readonly 'narration.superseded': NarrationSupersededEventPayload;
	readonly 'narration.tool_outcome_linked': NarrationToolOutcomeLinkedEventPayload;
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

export type NarrationStartedEvent = EventEnvelope<
	'narration.started',
	NarrationStartedEventPayload
>;

export type NarrationTokenEvent = EventEnvelope<'narration.token', NarrationTokenEventPayload>;

export type NarrationCompletedEvent = EventEnvelope<
	'narration.completed',
	NarrationCompletedEventPayload
>;

export type NarrationSupersededEvent = EventEnvelope<
	'narration.superseded',
	NarrationSupersededEventPayload
>;

export type NarrationToolOutcomeLinkedEvent = EventEnvelope<
	'narration.tool_outcome_linked',
	NarrationToolOutcomeLinkedEventPayload
>;

export type NarrationRuntimeEvent =
	| NarrationStartedEvent
	| NarrationTokenEvent
	| NarrationCompletedEvent
	| NarrationSupersededEvent
	| NarrationToolOutcomeLinkedEvent;

export type RuntimeEvent =
	| RunStartedEvent
	| StateEnteredEvent
	| ModelCompletedEvent
	| RunCompletedEvent
	| RunFailedEvent
	| NarrationRuntimeEvent;

export type ToolRuntimeEvent = ToolCallStartedEvent | ToolCallCompletedEvent | ToolCallFailedEvent;

export type ApprovalRuntimeEvent = ApprovalRequestedEvent | ApprovalResolvedEvent;

export type AnyRuntimeEvent = RuntimeEvent | ToolRuntimeEvent | ApprovalRuntimeEvent;
