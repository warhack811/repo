import type { RuntimeEvent } from '@runa/types';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type { runtimeEventsTable } from './schema.js';

export type RuntimeEventRecord = InferSelectModel<typeof runtimeEventsTable>;

export type NewRuntimeEventRecord = InferInsertModel<typeof runtimeEventsTable>;

export function toRuntimeEventRecord(event: RuntimeEvent): NewRuntimeEventRecord {
	return {
		envelope: event,
		event_id: event.event_id,
		event_type: event.event_type,
		event_version: event.event_version,
		metadata: event.metadata ?? null,
		payload: event.payload,
		run_id: event.run_id,
		sequence_no: event.sequence_no,
		timestamp: event.timestamp,
		trace_id: event.trace_id,
	};
}
