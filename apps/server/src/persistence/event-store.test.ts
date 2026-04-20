import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildRunStartedEvent } from '../runtime/runtime-events.js';
import {
	EventStoreConfigurationError,
	EventStoreWriteError,
	type RuntimeEventRecordWriter,
	persistRuntimeEvents,
} from './event-store.js';

const runtimeEvent = buildRunStartedEvent(
	{
		entry_state: 'INIT',
		trigger: 'user_message',
	},
	{
		run_id: 'run_persist_1',
		sequence_no: 1,
		trace_id: 'trace_persist_1',
	},
);

function clearDatabaseUrl(): void {
	const environment = process.env as NodeJS.ProcessEnv & {
		DATABASE_URL?: string;
		DATABASE_TARGET?: string;
		RUNA_DEBUG_PERSISTENCE?: string;
	};
	environment.DATABASE_URL = undefined;
	environment.DATABASE_TARGET = undefined;
	environment.RUNA_DEBUG_PERSISTENCE = undefined;
}

function getMutableEnvironment(): NodeJS.ProcessEnv & {
	DATABASE_TARGET?: string;
	DATABASE_URL?: string;
	RUNA_DEBUG_PERSISTENCE?: string;
} {
	return process.env as NodeJS.ProcessEnv & {
		DATABASE_TARGET?: string;
		DATABASE_URL?: string;
		RUNA_DEBUG_PERSISTENCE?: string;
	};
}

afterEach(() => {
	clearDatabaseUrl();
	vi.restoreAllMocks();
});

describe('event-store', () => {
	it('throws a typed configuration error when DATABASE_URL is missing', async () => {
		await expect(persistRuntimeEvents([runtimeEvent])).rejects.toThrowError(
			EventStoreConfigurationError,
		);
	});

	it('maps runtime events to append-only insert records', async () => {
		const append: RuntimeEventRecordWriter['append'] = vi.fn().mockResolvedValue(undefined);

		await persistRuntimeEvents([runtimeEvent], {
			writer: {
				append,
			},
		});

		expect(append).toHaveBeenCalledTimes(1);
		expect(append).toHaveBeenCalledWith([
			expect.objectContaining({
				envelope: runtimeEvent,
				event_id: runtimeEvent.event_id,
				event_type: runtimeEvent.event_type,
				event_version: runtimeEvent.event_version,
				payload: runtimeEvent.payload,
				run_id: runtimeEvent.run_id,
				sequence_no: runtimeEvent.sequence_no,
				timestamp: runtimeEvent.timestamp,
				trace_id: runtimeEvent.trace_id,
			}),
		]);
	});

	it('wraps writer failures in a typed persistence error', async () => {
		const append: RuntimeEventRecordWriter['append'] = vi
			.fn()
			.mockRejectedValue(new Error('insert failed'));

		await expect(
			persistRuntimeEvents([runtimeEvent], {
				writer: {
					append,
				},
			}),
		).rejects.toThrowError(EventStoreWriteError);
	});

	it('logs runtime event persistence failures only when persistence debug is enabled', async () => {
		const environment = getMutableEnvironment();
		environment.RUNA_DEBUG_PERSISTENCE = '1';
		environment.DATABASE_TARGET = 'local';
		environment.DATABASE_URL = 'postgres://local-debug/runtime';

		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const append: RuntimeEventRecordWriter['append'] = vi
			.fn()
			.mockRejectedValue(new Error('insert failed'));

		await expect(
			persistRuntimeEvents([runtimeEvent], {
				writer: {
					append,
				},
			}),
		).rejects.toThrowError(EventStoreWriteError);

		expect(consoleErrorSpy).toHaveBeenCalledWith('[persistence.error.debug]', {
			database_url_source: 'DATABASE_URL',
			error_message: 'insert failed',
			error_name: 'Error',
			operation: 'persist_runtime_events',
			run_id: runtimeEvent.run_id,
			stage: 'append_runtime_events',
			store: 'event-store',
			table: 'runtime_events',
			target: 'local',
			target_source: 'DATABASE_TARGET',
			trace_id: runtimeEvent.trace_id,
		});
	});

	it('keeps runtime event persistence debug logging silent by default', async () => {
		const environment = getMutableEnvironment();
		environment.DATABASE_TARGET = 'local';
		environment.DATABASE_URL = 'postgres://local-debug/runtime';

		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const append: RuntimeEventRecordWriter['append'] = vi
			.fn()
			.mockRejectedValue(new Error('insert failed'));

		await expect(
			persistRuntimeEvents([runtimeEvent], {
				writer: {
					append,
				},
			}),
		).rejects.toThrowError(EventStoreWriteError);

		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});
});
