import type {
	ApprovalRequestedEvent,
	ApprovalRequestedEventPayload,
	ApprovalResolvedEvent,
	ApprovalResolvedEventPayload,
	EventActor,
	EventEnvelope,
	EventMetadata,
	EventSource,
} from '@runa/types';

interface ApprovalEventContext {
	readonly actor?: EventActor;
	readonly metadata?: EventMetadata;
	readonly parent_event_id?: string;
	readonly sequence_no: number;
	readonly session_id?: string;
	readonly source?: EventSource;
	readonly timestamp?: string;
	readonly trace_id: string;
	readonly run_id: string;
}

const EVENT_VERSION = 1;

function buildEventBase(
	context: ApprovalEventContext,
): Omit<EventEnvelope, 'event_id' | 'event_type' | 'payload' | 'state_after' | 'state_before'> {
	return {
		event_version: EVENT_VERSION,
		run_id: context.run_id,
		timestamp: context.timestamp ?? new Date().toISOString(),
		trace_id: context.trace_id,
		actor: context.actor,
		metadata: context.metadata,
		parent_event_id: context.parent_event_id,
		sequence_no: context.sequence_no,
		session_id: context.session_id,
		source: context.source,
	};
}

export function buildApprovalRequestedEvent(
	payload: ApprovalRequestedEventPayload,
	context: ApprovalEventContext & {
		readonly state_after: 'WAITING_APPROVAL';
		readonly state_before: 'MODEL_THINKING' | 'TOOL_RESULT_INGESTING';
	},
): ApprovalRequestedEvent {
	return {
		...buildEventBase(context),
		event_id: `${context.run_id}:approval.requested:${context.sequence_no}`,
		event_type: 'approval.requested',
		payload,
		state_after: context.state_after,
		state_before: context.state_before,
	};
}

export function buildApprovalResolvedEvent(
	payload: ApprovalResolvedEventPayload,
	context: ApprovalEventContext & {
		readonly state_after: 'FAILED' | 'MODEL_THINKING';
		readonly state_before: 'WAITING_APPROVAL';
	},
): ApprovalResolvedEvent {
	return {
		...buildEventBase(context),
		event_id: `${context.run_id}:approval.resolved:${context.sequence_no}`,
		event_type: 'approval.resolved',
		payload,
		state_after: context.state_after,
		state_before: context.state_before,
	};
}
