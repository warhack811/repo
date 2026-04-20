import type {
	EventActor,
	EventEnvelope,
	EventMetadata,
	EventSource,
	ModelCompletedEvent,
	ModelCompletedEventPayload,
	RunCompletedEvent,
	RunCompletedEventPayload,
	RunFailedEvent,
	RunFailedEventPayload,
	RunStartedEvent,
	RunStartedEventPayload,
	RuntimeState,
	StateEnteredEvent,
	StateEnteredEventPayload,
} from '@runa/types';

interface RuntimeEventContext {
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
	context: RuntimeEventContext,
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

export function buildRunStartedEvent(
	payload: RunStartedEventPayload,
	context: RuntimeEventContext,
): RunStartedEvent {
	return {
		...buildEventBase(context),
		event_id: `${context.run_id}:run.started:${context.sequence_no}`,
		event_type: 'run.started',
		payload,
	};
}

export function buildStateEnteredEvent(
	payload: StateEnteredEventPayload,
	context: RuntimeEventContext & {
		readonly state_after: RuntimeState;
		readonly state_before?: RuntimeState;
	},
): StateEnteredEvent {
	return {
		...buildEventBase(context),
		event_id: `${context.run_id}:state.entered:${context.sequence_no}`,
		event_type: 'state.entered',
		payload,
		state_after: context.state_after,
		state_before: context.state_before,
	};
}

export function buildModelCompletedEvent(
	payload: ModelCompletedEventPayload,
	context: RuntimeEventContext & {
		readonly state_after: 'MODEL_THINKING';
		readonly state_before: 'MODEL_THINKING';
	},
): ModelCompletedEvent {
	return {
		...buildEventBase(context),
		event_id: `${context.run_id}:model.completed:${context.sequence_no}`,
		event_type: 'model.completed',
		payload,
		state_after: context.state_after,
		state_before: context.state_before,
	};
}

export function buildRunCompletedEvent(
	payload: RunCompletedEventPayload,
	context: RuntimeEventContext & {
		readonly state_after: 'COMPLETED';
		readonly state_before: 'MODEL_THINKING';
	},
): RunCompletedEvent {
	return {
		...buildEventBase(context),
		event_id: `${context.run_id}:run.completed:${context.sequence_no}`,
		event_type: 'run.completed',
		payload,
		state_after: context.state_after,
		state_before: context.state_before,
	};
}

export function buildRunFailedEvent(
	payload: RunFailedEventPayload,
	context: RuntimeEventContext & {
		readonly state_after: 'FAILED';
		readonly state_before: RuntimeState;
	},
): RunFailedEvent {
	return {
		...buildEventBase(context),
		event_id: `${context.run_id}:run.failed:${context.sequence_no}`,
		event_type: 'run.failed',
		payload,
		state_after: context.state_after,
		state_before: context.state_before,
	};
}
