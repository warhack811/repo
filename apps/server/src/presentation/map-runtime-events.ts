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
	const blocksByNarrationId = new Map<string, WorkNarrationBlock>();

	for (const event of events) {
		if (event.event_type === 'narration.completed') {
			blocksByNarrationId.set(event.payload.narration_id, {
				created_at: event.timestamp,
				id: event.payload.narration_id,
				payload: {
					linked_tool_call_id: event.payload.linked_tool_call_id,
					locale: event.payload.locale,
					run_id: context.run_id,
					sequence_no: event.payload.sequence_no,
					status: 'completed',
					text: event.payload.full_text,
					turn_index: event.payload.turn_index,
				},
				schema_version: 1,
				type: 'work_narration',
			});
			continue;
		}

		if (event.event_type === 'narration.superseded') {
			const existingBlock = blocksByNarrationId.get(event.payload.narration_id);

			if (existingBlock) {
				blocksByNarrationId.set(event.payload.narration_id, {
					...existingBlock,
					payload: {
						...existingBlock.payload,
						status: 'superseded',
					},
				});
			}
			continue;
		}

		if (
			event.event_type === 'narration.tool_outcome_linked' &&
			event.payload.outcome === 'failure'
		) {
			const existingBlock = blocksByNarrationId.get(event.payload.narration_id);

			if (existingBlock) {
				blocksByNarrationId.set(event.payload.narration_id, {
					...existingBlock,
					payload: {
						...existingBlock.payload,
						status: 'tool_failed',
					},
				});
			}
		}
	}

	return [...blocksByNarrationId.values()].sort(
		(left, right) =>
			left.payload.turn_index - right.payload.turn_index ||
			left.payload.sequence_no - right.payload.sequence_no,
	);
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
