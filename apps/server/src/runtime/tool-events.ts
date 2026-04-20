import type {
	EventActor,
	EventEnvelope,
	EventMetadata,
	EventSource,
	RuntimeState,
	ToolCallCompletedEvent,
	ToolCallCompletedEventPayload,
	ToolCallFailedEvent,
	ToolCallFailedEventPayload,
	ToolCallStartedEvent,
	ToolCallStartedEventPayload,
} from '@runa/types';

interface ToolEventContext {
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
	context: ToolEventContext,
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

export function buildToolCallStartedEvent(
	payload: ToolCallStartedEventPayload,
	context: ToolEventContext & {
		readonly state_after: 'TOOL_EXECUTING';
		readonly state_before: 'MODEL_THINKING';
	},
): ToolCallStartedEvent {
	return {
		...buildEventBase(context),
		event_id: `${context.run_id}:tool.call.started:${context.sequence_no}`,
		event_type: 'tool.call.started',
		payload,
		state_after: context.state_after,
		state_before: context.state_before,
	};
}

export function buildToolCallCompletedEvent(
	payload: ToolCallCompletedEventPayload,
	context: ToolEventContext & {
		readonly state_after: 'TOOL_RESULT_INGESTING';
		readonly state_before: 'TOOL_EXECUTING';
	},
): ToolCallCompletedEvent {
	return {
		...buildEventBase(context),
		event_id: `${context.run_id}:tool.call.completed:${context.sequence_no}`,
		event_type: 'tool.call.completed',
		payload,
		state_after: context.state_after,
		state_before: context.state_before,
	};
}

export function buildToolCallFailedEvent(
	payload: ToolCallFailedEventPayload,
	context: ToolEventContext & {
		readonly state_after: 'FAILED';
		readonly state_before: RuntimeState;
	},
): ToolCallFailedEvent {
	return {
		...buildEventBase(context),
		event_id: `${context.run_id}:tool.call.failed:${context.sequence_no}`,
		event_type: 'tool.call.failed',
		payload,
		state_after: context.state_after,
		state_before: context.state_before,
	};
}
