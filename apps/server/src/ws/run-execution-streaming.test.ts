import type { ModelStreamChunk, ProviderCapabilities } from '@runa/types';
import { describe, expect, it } from 'vitest';

import type { ModelResponse, RuntimeEvent } from '@runa/types';
import type { WebSocketConnection } from '../ws/transport.js';
import { generateModelResponseWithStreaming } from '../ws/run-execution.js';

interface MockSocket {
	close(code?: number, reason?: string): void;
	on(event: 'close' | 'message', listener: (message?: unknown) => void): void;
	send(message: string): void;
}

interface MockGateway {
	capabilities?: ProviderCapabilities;
	generate(request: unknown): Promise<ModelResponse>;
	stream(request: unknown): AsyncGenerator<ModelStreamChunk>;
}

function createMockSocket(): { socket: MockSocket; sentMessages: unknown[] } {
	const sentMessages: unknown[] = [];
	return {
		socket: {
			close: () => {},
			on: () => {},
			send: (msg: string) => sentMessages.push(JSON.parse(msg)),
		},
		sentMessages,
	};
}

function createMockGateway(
	capabilities: ProviderCapabilities,
	chunks: readonly ModelStreamChunk[],
): MockGateway {
	const chunkArray = [...chunks];
	let completedResponse: ModelResponse | undefined = undefined;

	return {
		capabilities,
		async generate() {
			if (completedResponse) return completedResponse;
			const textPart = chunkArray.find((c) => c.type === 'text.delta');
			const text = textPart ? textPart.text_delta : '';
			return {
				message: { content: text, role: 'assistant' as const },
				finish_reason: 'stop' as const,
				model: 'mock',
				provider: 'mock',
			};
		},
		async *stream() {
			for (const chunk of chunkArray) {
				if (chunk.type === 'response.completed') completedResponse = chunk.response;
				yield chunk;
			}
		},
	};
}

const defaultCapabilities: ProviderCapabilities = {
	emits_reasoning_content: false,
	narration_strategy: 'temporal_stream',
	streaming_supported: true,
	tool_call_fallthrough_risk: 'none',
};

const unsupportedCapabilities: ProviderCapabilities = {
	emits_reasoning_content: false,
	narration_strategy: 'unsupported',
	streaming_supported: true,
	tool_call_fallthrough_risk: 'none',
};

describe('generateModelResponseWithStreaming', () => {
	it('returns model response from streaming gateway', async () => {
		const chunks: readonly ModelStreamChunk[] = [
			{ type: 'text.delta', text_delta: 'Hello', content_part_index: 0 },
			{
				type: 'response.completed',
				response: {
					message: { content: 'Hello', role: 'assistant' },
					finish_reason: 'stop',
					model: 'mock',
					provider: 'mock',
				},
			},
		];

		const mockGateway = createMockGateway(defaultCapabilities, chunks);
		const { socket } = createMockSocket();

		const result = await generateModelResponseWithStreaming(
			socket as unknown as WebSocketConnection,
			{ run_id: 'run', trace_id: 'trace' },
			mockGateway as unknown as Parameters<typeof generateModelResponseWithStreaming>[2],
			{ messages: [], model: 'm', run_id: 'r', trace_id: 't' },
			undefined,
		);

		expect(result.message.content).toBe('Hello');
	});

	it('uses text.delta for unsupported providers', async () => {
		const chunks: readonly ModelStreamChunk[] = [
			{ type: 'text.delta', text_delta: 'Test', content_part_index: 0 },
			{
				type: 'response.completed',
				response: {
					message: { content: 'Test', role: 'assistant' },
					finish_reason: 'stop',
					model: 'mock',
					provider: 'mock',
				},
			},
		];

		const mockGateway = createMockGateway(unsupportedCapabilities, chunks);
		const { socket, sentMessages } = createMockSocket();

		await generateModelResponseWithStreaming(
			socket as unknown as WebSocketConnection,
			{ run_id: 'run', trace_id: 'trace' },
			mockGateway as unknown as Parameters<typeof generateModelResponseWithStreaming>[2],
			{ messages: [], model: 'm', run_id: 'r', trace_id: 't' },
			undefined,
		);

		const textDeltas = sentMessages.filter((m) => (m as { type?: string }).type === 'text.delta');
		expect(textDeltas.length).toBe(1);
	});

	it('handles empty text delta', async () => {
		const chunks: readonly ModelStreamChunk[] = [
			{ type: 'text.delta', text_delta: '', content_part_index: 0 },
			{
				type: 'response.completed',
				response: {
					message: { content: '', role: 'assistant' },
					finish_reason: 'stop',
					model: 'mock',
					provider: 'mock',
				},
			},
		];

		const mockGateway = createMockGateway(defaultCapabilities, chunks);
		const { socket } = createMockSocket();

		const result = await generateModelResponseWithStreaming(
			socket as unknown as WebSocketConnection,
			{ run_id: 'run', trace_id: 'trace' },
			mockGateway as unknown as Parameters<typeof generateModelResponseWithStreaming>[2],
			{ messages: [], model: 'm', run_id: 'r', trace_id: 't' },
			undefined,
			{ capabilities: defaultCapabilities, locale: 'tr', runId: 'r', traceId: 't', turnIndex: 1 },
		);

		expect(result).toBeDefined();
	});

	it('accepts options parameter', async () => {
		const chunks: readonly ModelStreamChunk[] = [
			{
				type: 'response.completed',
				response: {
					message: { content: 'ok', role: 'assistant' },
					finish_reason: 'stop',
					model: 'mock',
					provider: 'mock',
				},
			},
		];

		const mockGateway = createMockGateway(defaultCapabilities, chunks);
		const { socket } = createMockSocket();
		const events: RuntimeEvent[] = [];

		const result = await generateModelResponseWithStreaming(
			socket as unknown as WebSocketConnection,
			{ run_id: 'run', trace_id: 'trace' },
			mockGateway as unknown as Parameters<typeof generateModelResponseWithStreaming>[2],
			{ messages: [], model: 'm', run_id: 'r', trace_id: 't' },
			undefined,
			{
				capabilities: defaultCapabilities,
				locale: 'tr',
				onRuntimeEvent: (e) => events.push(e),
				runId: 'run',
				traceId: 'trace',
				turnIndex: 1,
			},
		);

		expect(result.message.content).toBe('ok');
	});
});