import type {
	ModelGateway,
	ModelRequest,
	ModelResponse,
	ModelStreamChunk,
	RuntimeEvent,
} from '@runa/types';
import { describe, expect, it } from 'vitest';

import { readModelUsageEventMetadata } from './model-usage-accounting.js';
import { runModelStep } from './run-model-step.js';
import { InvalidStateTransitionError } from './state-machine.js';

class SuccessfulGateway implements ModelGateway {
	async generate(_request: ModelRequest): Promise<ModelResponse> {
		return {
			finish_reason: 'stop',
			message: {
				content: 'hello from gateway',
				role: 'assistant',
			},
			model: 'fake-model',
			provider: 'fake-provider',
			response_id: 'response_1',
		};
	}

	stream(_request: ModelRequest): AsyncIterable<ModelStreamChunk> {
		throw new Error('stream not used in this test');
	}
}

class FailingGateway implements ModelGateway {
	async generate(_request: ModelRequest): Promise<ModelResponse> {
		throw new Error('gateway failed');
	}

	stream(_request: ModelRequest): AsyncIterable<ModelStreamChunk> {
		throw new Error('stream not used in this test');
	}
}

const unknownGatewayFailure = {
	code: 'MODEL_DOWN',
	detail: 'transport closed unexpectedly',
};

class UnknownFailingGateway implements ModelGateway {
	async generate(_request: ModelRequest): Promise<ModelResponse> {
		throw unknownGatewayFailure;
	}

	stream(_request: ModelRequest): AsyncIterable<ModelStreamChunk> {
		throw new Error('stream not used in this test');
	}
}

function getEventTypes(events: readonly RuntimeEvent[]): string[] {
	return events.map((event) => event.event_type);
}

describe('run-model-step', () => {
	it('completes successfully and emits the expected event sequence', async () => {
		const result = await runModelStep({
			gateway: new SuccessfulGateway(),
			initial_state: 'INIT',
			request: {
				messages: [{ content: 'hello', role: 'user' }],
				run_id: 'run_1',
				trace_id: 'trace_1',
			},
			run_id: 'run_1',
			trace_id: 'trace_1',
		});

		expect(result.status).toBe('completed');
		expect(result.final_state).toBe('COMPLETED');
		expect(getEventTypes(result.events)).toEqual([
			'run.started',
			'state.entered',
			'model.completed',
			'state.entered',
			'run.completed',
		]);

		const modelCompletedEvent = result.events.find(
			(event) => event.event_type === 'model.completed',
		);

		if (!modelCompletedEvent || modelCompletedEvent.event_type !== 'model.completed') {
			throw new Error('Expected model.completed event.');
		}

		expect(readModelUsageEventMetadata(modelCompletedEvent.metadata)).toMatchObject({
			request: {
				measurement: 'approximate',
				messages: {
					message_count: 1,
				},
			},
			response: {
				measurement: 'approximate',
			},
		});
	});

	it('fails gracefully and emits run.failed when the gateway throws', async () => {
		const result = await runModelStep({
			gateway: new FailingGateway(),
			initial_state: 'INIT',
			request: {
				messages: [{ content: 'hello', role: 'user' }],
				run_id: 'run_2',
				trace_id: 'trace_2',
			},
			run_id: 'run_2',
			trace_id: 'trace_2',
		});

		expect(result.status).toBe('failed');
		expect(result.final_state).toBe('FAILED');
		expect(getEventTypes(result.events)).toEqual([
			'run.started',
			'state.entered',
			'state.entered',
			'run.failed',
		]);

		if (result.status === 'failed') {
			expect(result.failure.message).toBe('gateway failed');
			expect(result.failure.name).toBe('Error');
		}
	});

	it('normalizes non-Error gateway failures into a deterministic unknown failure surface', async () => {
		const result = await runModelStep({
			gateway: new UnknownFailingGateway(),
			initial_state: 'INIT',
			request: {
				messages: [{ content: 'hello', role: 'user' }],
				run_id: 'run_4',
				trace_id: 'trace_4',
			},
			run_id: 'run_4',
			trace_id: 'trace_4',
		});

		expect(result.status).toBe('failed');
		expect(result.final_state).toBe('FAILED');
		expect(getEventTypes(result.events)).toEqual([
			'run.started',
			'state.entered',
			'state.entered',
			'run.failed',
		]);

		if (result.status === 'failed') {
			expect(result.failure.cause).toBe(unknownGatewayFailure);
			expect(result.failure.code).toBeUndefined();
			expect(result.failure.message).toBe('Unknown model step failure.');
			expect(result.failure.name).toBe('UnknownError');
		}
	});

	it('rejects invalid initial states before the model step starts', async () => {
		await expect(() =>
			runModelStep({
				gateway: new SuccessfulGateway(),
				initial_state: 'COMPLETED',
				request: {
					messages: [{ content: 'hello', role: 'user' }],
					run_id: 'run_3',
					trace_id: 'trace_3',
				},
				run_id: 'run_3',
				trace_id: 'trace_3',
			}),
		).rejects.toThrowError(InvalidStateTransitionError);
	});
});
