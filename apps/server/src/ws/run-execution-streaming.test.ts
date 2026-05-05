import type { ModelResponse, ModelStreamChunk, ProviderCapabilities } from '@runa/types';
import { describe, expect, it } from 'vitest';

import type { RuntimeEvent } from '@runa/types';
import { createMockSocket } from '../test-utils/mock-socket.js';
import { createMockStreamingGateway } from '../test-utils/mock-streaming-gateway.js';
import { generateModelResponseWithStreaming } from '../ws/run-execution.js';
import type { WebSocketConnection } from '../ws/transport.js';

const supportedCapabilities: ProviderCapabilities = {
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

function createBaseRequest() {
	return {
		messages: [],
		model: 'mock-model',
		run_id: 'run_test',
		trace_id: 'trace_test',
	};
}

describe('generateModelResponseWithStreaming', () => {
	it('returns model response from streaming gateway with tool calls', async () => {
		const mockResponse: ModelResponse = {
			message: {
				content: 'package.json kontrol ediyorum.',
				ordered_content: [
					{
						kind: 'text',
						text: 'package.json kontrol ediyorum.',
						index: 0,
						ordering_origin: 'wire_streaming',
					},
					{
						kind: 'tool_use',
						tool_call_id: 'call_001',
						tool_name: 'file.read',
						input: {},
						index: 1,
						ordering_origin: 'wire_streaming',
					},
				],
				role: 'assistant',
			},
			finish_reason: 'stop',
			model: 'mock-model',
			provider: 'mock',
			tool_call_candidates: [{ call_id: 'call_001', tool_name: 'file.read', tool_input: {} }],
		};

		const mockGateway = createMockStreamingGateway({
			capabilities: supportedCapabilities,
			chunks: [
				{ type: 'text.delta', text_delta: 'package.json', content_part_index: 0 },
				{ type: 'text.delta', text_delta: ' kontrol', content_part_index: 0 },
				{ type: 'text.delta', text_delta: ' ediyorum.', content_part_index: 0 },
				{ type: 'response.completed', response: mockResponse },
			],
			finalResponse: mockResponse,
		});

		const { socket } = createMockSocket();
		const runtimeEvents: RuntimeEvent[] = [];
		let seqCounter = 0;

		const result = await generateModelResponseWithStreaming(
			socket as unknown as WebSocketConnection,
			{ run_id: 'run_test', trace_id: 'trace_test' },
			mockGateway as unknown as Parameters<typeof generateModelResponseWithStreaming>[2],
			createBaseRequest(),
			undefined,
			{
				capabilities: mockGateway.capabilities,
				locale: 'tr',
				runId: 'run_test',
				traceId: 'trace_test',
				turnIndex: 1,
				onRuntimeEvent: (e) => runtimeEvents.push(e),
				getNextSequenceNo: () => ++seqCounter,
			},
		);

		expect(result.message.content).toBe('package.json kontrol ediyorum.');
		expect(result.finish_reason).toBe('stop');
	});

	it('falls back to text.delta for unsupported providers', async () => {
		const mockResponse: ModelResponse = {
			message: { content: 'merhaba dünya', role: 'assistant' },
			finish_reason: 'stop',
			model: 'mock',
			provider: 'mock',
		};

		const mockGateway = createMockStreamingGateway({
			capabilities: unsupportedCapabilities,
			chunks: [
				{ type: 'text.delta', text_delta: 'merhaba', content_part_index: 0 },
				{ type: 'text.delta', text_delta: ' dünya', content_part_index: 0 },
				{ type: 'response.completed', response: mockResponse },
			],
			finalResponse: mockResponse,
		});

		const { socket, sentMessages } = createMockSocket();
		const runtimeEvents: RuntimeEvent[] = [];

		await generateModelResponseWithStreaming(
			socket as unknown as WebSocketConnection,
			{ run_id: 'run_test', trace_id: 'trace_test' },
			mockGateway as unknown as Parameters<typeof generateModelResponseWithStreaming>[2],
			createBaseRequest(),
			undefined,
			{
				capabilities: mockGateway.capabilities,
				locale: 'tr',
				onRuntimeEvent: (e) => runtimeEvents.push(e),
				runId: 'run_test',
				traceId: 'trace_test',
				turnIndex: 1,
			},
		);

		const narrationDelta = sentMessages.filter((m) => m.type === 'narration.delta');
		const textDelta = sentMessages.filter((m) => m.type === 'text.delta');

		expect(narrationDelta.length).toBe(0);
		expect(textDelta.length).toBeGreaterThan(0);
		expect(runtimeEvents.length).toBe(0);
	});

	it('handles response.completed with tool_call_candidates', async () => {
		const mockResponse: ModelResponse = {
			message: {
				content: '',
				ordered_content: [
					{
						kind: 'tool_use',
						tool_call_id: 'call_001',
						tool_name: 'shell.run',
						input: {},
						index: 0,
						ordering_origin: 'wire_streaming',
					},
				],
				role: 'assistant',
			},
			finish_reason: 'stop',
			model: 'mock',
			provider: 'mock',
			tool_call_candidates: [{ call_id: 'call_001', tool_name: 'shell.run', tool_input: {} }],
		};

		const mockGateway = createMockStreamingGateway({
			capabilities: supportedCapabilities,
			chunks: [{ type: 'response.completed', response: mockResponse }],
			finalResponse: mockResponse,
		});

		const { socket } = createMockSocket();
		const runtimeEvents: RuntimeEvent[] = [];

		const result = await generateModelResponseWithStreaming(
			socket as unknown as WebSocketConnection,
			{ run_id: 'run_test', trace_id: 'trace_test' },
			mockGateway as unknown as Parameters<typeof generateModelResponseWithStreaming>[2],
			createBaseRequest(),
			undefined,
			{
				capabilities: mockGateway.capabilities,
				locale: 'tr',
				onRuntimeEvent: (e) => runtimeEvents.push(e),
				runId: 'run_test',
				traceId: 'trace_test',
				turnIndex: 1,
			},
		);

		expect(result).toBeDefined();
		expect(result.finish_reason).toBe('stop');
	});

	it('accepts options parameter', async () => {
		const mockGateway = createMockStreamingGateway({
			capabilities: supportedCapabilities,
			chunks: [
				{
					type: 'response.completed',
					response: {
						message: { content: 'ok', role: 'assistant' },
						finish_reason: 'stop',
						model: 'mock',
						provider: 'mock',
					},
				},
			],
		});

		const { socket } = createMockSocket();
		const events: RuntimeEvent[] = [];

		const result = await generateModelResponseWithStreaming(
			socket as unknown as WebSocketConnection,
			{ run_id: 'run', trace_id: 'trace' },
			mockGateway as unknown as Parameters<typeof generateModelResponseWithStreaming>[2],
			createBaseRequest(),
			undefined,
			{
				capabilities: supportedCapabilities,
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
