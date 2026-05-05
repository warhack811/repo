import type {
	EventListBlock,
	RenderBlock,
	RuntimeEvent,
	StatusBlock,
	TextBlock,
	WorkNarrationBlock,
} from '@runa/types';

import { mapAssistantTextToStructuredBlocks } from './map-structured-output.js';

interface PresentationContext {
	readonly created_at: string;
	readonly run_id: string;
	readonly trace_id: string;
}

interface WorkNarrationDraft {
	readonly created_at: string;
	readonly id: string;
	readonly linked_tool_call_id?: string;
	readonly locale: WorkNarrationBlock['payload']['locale'];
	readonly run_id: string;
	readonly sequence_no: number;
	readonly status: WorkNarrationBlock['payload']['status'];
	readonly text: string;
	readonly turn_index: number;
}

function getPresentationContext(events: readonly RuntimeEvent[]): PresentationContext | null {
	const [firstEvent] = events;

	if (!firstEvent) {
		return null;
	}

	const lastEvent = events[events.length - 1] ?? firstEvent;

	return {
		created_at: lastEvent.timestamp,
		run_id: firstEvent.run_id,
		trace_id: firstEvent.trace_id,
	};
}

function createStatusBlock(
	context: PresentationContext,
	level: StatusBlock['payload']['level'],
	message: string,
): StatusBlock {
	return {
		created_at: context.created_at,
		id: `status:${context.run_id}:${context.trace_id}`,
		payload: {
			level,
			message,
		},
		schema_version: 1,
		type: 'status',
	};
}

function createTextBlock(context: PresentationContext, text: string): TextBlock {
	return {
		created_at: context.created_at,
		id: `text:${context.run_id}:${context.trace_id}`,
		payload: {
			text,
		},
		schema_version: 1,
		type: 'text',
	};
}

function createEventListBlock(
	context: PresentationContext,
	events: readonly RuntimeEvent[],
): EventListBlock {
	return {
		created_at: context.created_at,
		id: `event_list:${context.run_id}:${context.trace_id}`,
		payload: {
			events,
			run_id: context.run_id,
			trace_id: context.trace_id,
		},
		schema_version: 1,
		type: 'event_list',
	};
}

function createWorkNarrationBlocks(
	context: PresentationContext,
	events: readonly RuntimeEvent[],
): readonly WorkNarrationBlock[] {
	const draftsByNarrationId = new Map<string, WorkNarrationDraft>();

	const upsertDraft = (
		narrationId: string,
		createOrUpdate: (existing: WorkNarrationDraft | undefined) => WorkNarrationDraft,
	): void => {
		draftsByNarrationId.set(narrationId, createOrUpdate(draftsByNarrationId.get(narrationId)));
	};

	for (const event of events) {
		if (event.event_type === 'narration.started') {
			upsertDraft(event.payload.narration_id, (existing) => ({
				created_at: existing?.created_at ?? event.timestamp,
				id: event.payload.narration_id,
				linked_tool_call_id: existing?.linked_tool_call_id ?? event.payload.linked_tool_call_id,
				locale: existing?.locale ?? event.payload.locale,
				run_id: event.payload.run_id,
				sequence_no: existing?.sequence_no ?? event.payload.sequence_no,
				status: existing?.status ?? 'streaming',
				text: existing?.text ?? '',
				turn_index: existing?.turn_index ?? event.payload.turn_index,
			}));
			continue;
		}

		if (event.event_type === 'narration.token') {
			upsertDraft(event.payload.narration_id, (existing) => {
				if (
					existing?.status === 'completed' ||
					existing?.status === 'superseded' ||
					existing?.status === 'tool_failed'
				) {
					return existing;
				}

				return {
					created_at: existing?.created_at ?? event.timestamp,
					id: event.payload.narration_id,
					linked_tool_call_id: existing?.linked_tool_call_id ?? event.payload.linked_tool_call_id,
					locale: existing?.locale ?? event.payload.locale,
					run_id: event.payload.run_id,
					sequence_no: existing?.sequence_no ?? event.payload.sequence_no,
					status: 'streaming',
					text: `${existing?.text ?? ''}${event.payload.text_delta}`,
					turn_index: existing?.turn_index ?? event.payload.turn_index,
				};
			});
			continue;
		}

		if (event.event_type === 'narration.completed') {
			upsertDraft(event.payload.narration_id, (existing) => ({
				created_at: existing?.created_at ?? event.timestamp,
				id: event.payload.narration_id,
				linked_tool_call_id: event.payload.linked_tool_call_id ?? existing?.linked_tool_call_id,
				locale: event.payload.locale,
				run_id: event.payload.run_id,
				sequence_no: event.payload.sequence_no,
				status: 'completed',
				text: event.payload.full_text,
				turn_index: event.payload.turn_index,
			}));
			continue;
		}

		if (event.event_type === 'narration.superseded') {
			upsertDraft(event.payload.narration_id, (existing) => ({
				created_at: existing?.created_at ?? event.timestamp,
				id: event.payload.narration_id,
				linked_tool_call_id: existing?.linked_tool_call_id ?? event.payload.linked_tool_call_id,
				locale: existing?.locale ?? event.payload.locale,
				run_id: existing?.run_id ?? event.payload.run_id,
				sequence_no: existing?.sequence_no ?? event.payload.sequence_no,
				status: 'superseded',
				text: existing?.text ?? '',
				turn_index: existing?.turn_index ?? event.payload.turn_index,
			}));
			continue;
		}

		if (event.event_type === 'narration.tool_outcome_linked') {
			upsertDraft(event.payload.narration_id, (existing) => ({
				created_at: existing?.created_at ?? event.timestamp,
				id: event.payload.narration_id,
				linked_tool_call_id: event.payload.linked_tool_call_id ?? existing?.linked_tool_call_id,
				locale: existing?.locale ?? event.payload.locale,
				run_id: existing?.run_id ?? event.payload.run_id,
				sequence_no: existing?.sequence_no ?? event.payload.sequence_no,
				status:
					event.payload.outcome === 'failure' ? 'tool_failed' : (existing?.status ?? 'completed'),
				text: existing?.text ?? '',
				turn_index: existing?.turn_index ?? event.payload.turn_index,
			}));
		}
	}

	return [...draftsByNarrationId.values()]
		.filter(
			(draft) =>
				draft.text.trim().length > 0 ||
				draft.status === 'superseded' ||
				draft.status === 'tool_failed',
		)
		.sort(
			(left, right) =>
				left.turn_index - right.turn_index ||
				left.sequence_no - right.sequence_no ||
				left.id.localeCompare(right.id),
		)
		.map((draft) => ({
			created_at: draft.created_at,
			id: draft.id,
			payload: {
				linked_tool_call_id: draft.linked_tool_call_id,
				locale: draft.locale,
				run_id: draft.run_id || context.run_id,
				sequence_no: draft.sequence_no,
				status: draft.status,
				text: draft.text,
				turn_index: draft.turn_index,
			},
			schema_version: 1,
			type: 'work_narration',
		}));
}

function getTerminalFailureEvent(events: readonly RuntimeEvent[]): RuntimeEvent | null {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];

		if (event?.event_type === 'run.failed') {
			return event;
		}
	}

	return null;
}

function getTerminalCompletedEvent(events: readonly RuntimeEvent[]): RuntimeEvent | null {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];

		if (event?.event_type === 'run.completed') {
			return event;
		}
	}

	return null;
}

function getCompletionSummaryText(events: readonly RuntimeEvent[]): string | null {
	const completedEvent = getTerminalCompletedEvent(events);

	if (!completedEvent || completedEvent.event_type !== 'run.completed') {
		return null;
	}

	return completedEvent.payload.output_text ?? 'Run completed successfully.';
}

function getFailureSummaryText(events: readonly RuntimeEvent[]): string | null {
	const failedEvent = getTerminalFailureEvent(events);

	if (!failedEvent || failedEvent.event_type !== 'run.failed') {
		return null;
	}

	return failedEvent.payload.error_message;
}

function createSummaryBlocks(
	context: PresentationContext,
	events: readonly RuntimeEvent[],
): readonly RenderBlock[] {
	const failureText = getFailureSummaryText(events);

	if (failureText) {
		return [
			createStatusBlock(context, 'error', 'Run failed.'),
			createTextBlock(context, failureText),
		];
	}

	const completionText = getCompletionSummaryText(events);

	if (completionText) {
		return [
			createStatusBlock(context, 'success', 'Run completed successfully.'),
			...mapAssistantTextToStructuredBlocks(context, completionText),
		];
	}

	return [createStatusBlock(context, 'info', 'Run event stream is available.')];
}

export function mapRuntimeEventsToRenderBlocks(
	events: readonly RuntimeEvent[],
): readonly RenderBlock[] {
	const context = getPresentationContext(events);

	if (!context) {
		return [];
	}

	return [
		...createSummaryBlocks(context, events),
		...createWorkNarrationBlocks(context, events),
		createEventListBlock(context, events),
	];
}
