import {
	type NewRuntimeEventRecord,
	createDatabaseConnection,
	ensureDatabaseSchema,
	runtimeEventsTable,
	toRuntimeEventRecord,
} from '@runa/db';
import type { RuntimeEvent } from '@runa/types';

import { logPersistenceDebugFailure, resolvePersistenceDatabaseUrl } from './database-config.js';

export class EventStoreConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'EventStoreConfigurationError';
	}
}

export class EventStoreWriteError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'EventStoreWriteError';
	}
}

export interface RuntimeEventRecordWriter {
	append(records: readonly NewRuntimeEventRecord[]): Promise<void>;
}

class DatabaseRuntimeEventRecordWriter implements RuntimeEventRecordWriter {
	#ready: Promise<void>;
	#db: ReturnType<typeof createDatabaseConnection>['db'];

	constructor(databaseUrl: string) {
		const connection = createDatabaseConnection(databaseUrl);
		this.#db = connection.db;
		this.#ready = ensureDatabaseSchema(connection);
	}

	async append(records: readonly NewRuntimeEventRecord[]): Promise<void> {
		await this.#ready;
		await this.#db.insert(runtimeEventsTable).values([...records]);
	}
}

interface PersistRuntimeEventsOptions {
	readonly writer?: RuntimeEventRecordWriter;
}

let defaultWriterPromise: Promise<RuntimeEventRecordWriter> | null = null;

function getDatabaseUrl(): string {
	return resolvePersistenceDatabaseUrl(
		(message) => new EventStoreConfigurationError(message),
		'DATABASE_URL is required for runtime event persistence.',
	);
}

async function getDefaultWriter(): Promise<RuntimeEventRecordWriter> {
	if (!defaultWriterPromise) {
		defaultWriterPromise = Promise.resolve(new DatabaseRuntimeEventRecordWriter(getDatabaseUrl()));
	}

	try {
		return await defaultWriterPromise;
	} catch (error) {
		defaultWriterPromise = null;
		throw error;
	}
}

export async function persistRuntimeEvents(
	events: readonly RuntimeEvent[],
	options: PersistRuntimeEventsOptions = {},
): Promise<void> {
	if (events.length === 0) {
		return;
	}

	const records = events.map((event) => toRuntimeEventRecord(event));
	const firstEvent = events[0];

	try {
		const writer = options.writer ?? (await getDefaultWriter());
		await writer.append(records);
	} catch (error) {
		logPersistenceDebugFailure({
			error,
			operation: 'persist_runtime_events',
			run_id: firstEvent?.run_id,
			stage: 'append_runtime_events',
			store: 'event-store',
			table: 'runtime_events',
			trace_id: firstEvent?.trace_id,
		});

		if (error instanceof EventStoreConfigurationError || error instanceof EventStoreWriteError) {
			throw error;
		}

		throw new EventStoreWriteError('Failed to persist runtime events.', {
			cause: error,
		});
	}
}
