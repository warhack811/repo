import type {
	ModelContentPart,
	ModelRequest,
	ModelResponse,
	ProviderCapabilities,
	RuntimeEvent,
	WebSocketServerBridgeMessage,
} from '@runa/types';
import { describe, expect, it } from 'vitest';

import { createMockSocket } from '../test-utils/mock-socket.js';
import { createMockStreamingGateway } from '../test-utils/mock-streaming-gateway.js';
import { generateModelResponseWithStreaming } from '../ws/run-execution.js';

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

function createBaseRequest(): ModelRequest {
	return {
		messages: [],
		model: 'mock-model',
		run_id: 'run_test',
		trace_id: 'trace_test',
	};
}

function createResponse(input: {
	content: string;
	ordered_content?: readonly ModelContentPart[];
	tool_call_candidates?: ModelResponse['tool_call_candidates'];
}): ModelResponse {
	return {
		message: {
			content: input.content,
			ordered_content: input.ordered_content,
			role: 'assistant',
		},
		finish_reason: 'stop',
		model: 'mock-model',
		provider: 'mock',
		tool_call_candidates: input.tool_call_candidates,
	};
}

async function runStreaming(input: {
	capabilities: ProviderCapabilities;
	chunks: Parameters<typeof createMockStreamingGateway>[0]['chunks'];
	finalResponse?: ModelResponse;
}): Promise<{
	runtimeEvents: RuntimeEvent[];
	sentMessages: WebSocketServerBridgeMessage[];
}> {
	const mockGateway = createMockStreamingGateway({
		capabilities: input.capabilities,
		chunks: input.chunks,
		finalResponse: input.finalResponse,
	});
	const { socket, sentMessages } = createMockSocket();
	const runtimeEvents: RuntimeEvent[] = [];
	let seqCounter = 0;

	await generateModelResponseWithStreaming(
		socket,
		{ run_id: 'run_test', trace_id: 'trace_test' },
		mockGateway,
		createBaseRequest(),
		undefined,
		{
			capabilities: mockGateway.capabilities,
			getNextSequenceNo: () => ++seqCounter,
			locale: 'tr',
			onRuntimeEvent: (event) => runtimeEvents.push(event),
			runId: 'run_test',
			traceId: 'trace_test',
			turnIndex: 1,
		},
	);

	return { runtimeEvents, sentMessages };
}

describe('generateModelResponseWithStreaming', () => {
	it('streams narration tokens then flushes at response.completed', async () => {
		const mockResponse = createResponse({
			content: 'package.json kontrol ediyorum.',
			ordered_content: [
				{
					index: 0,
					kind: 'text',
					ordering_origin: 'wire_streaming',
					text: 'package.json kontrol ediyorum.',
				},
				{
					index: 1,
					input: {},
					kind: 'tool_use',
					ordering_origin: 'wire_streaming',
					tool_call_id: 'call_001',
					tool_name: 'file.read',
				},
			],
			tool_call_candidates: [{ call_id: 'call_001', tool_input: {}, tool_name: 'file.read' }],
		});

		const { runtimeEvents, sentMessages } = await runStreaming({
			capabilities: supportedCapabilities,
			chunks: [
				{ content_part_index: 0, text_delta: 'package.json', type: 'text.delta' },
				{ content_part_index: 0, text_delta: ' kontrol', type: 'text.delta' },
				{ content_part_index: 0, text_delta: ' ediyorum.', type: 'text.delta' },
				{ response: mockResponse, type: 'response.completed' },
			],
			finalResponse: mockResponse,
		});

		const narrationDeltas = sentMessages.filter((message) => message.type === 'narration.delta');
		const narrationCompleted = sentMessages.filter(
			(message) => message.type === 'narration.completed',
		);
		const textDeltas = sentMessages.filter((message) => message.type === 'text.delta');
		const startedEvents = runtimeEvents.filter((event) => event.event_type === 'narration.started');
		const tokenEvents = runtimeEvents.filter((event) => event.event_type === 'narration.token');
		const completedEvents = runtimeEvents.filter(
			(event) => event.event_type === 'narration.completed',
		);

		expect(narrationDeltas.length).toBe(3);
		expect(narrationDeltas.map((message) => message.payload.text_delta).join('')).toBe(
			'package.json kontrol ediyorum.',
		);
		expect(narrationCompleted.length).toBe(1);
		expect(narrationCompleted[0]?.payload.full_text).toBe('package.json kontrol ediyorum.');
		expect(narrationCompleted[0]?.payload.linked_tool_call_id).toBe('call_001');
		expect(textDeltas.length).toBe(0);
		expect(startedEvents.length).toBe(1);
		expect(tokenEvents.length).toBe(3);
		expect(completedEvents.length).toBe(1);
		expect(tokenEvents.map((event) => event.payload.text_delta)).toEqual([
			'package.json',
			' kontrol',
			' ediyorum.',
		]);
	});

	it('emits text.delta and zero narration for unsupported providers', async () => {
		const mockResponse = createResponse({ content: 'merhaba dunya' });

		const { runtimeEvents, sentMessages } = await runStreaming({
			capabilities: unsupportedCapabilities,
			chunks: [
				{ content_part_index: 0, text_delta: 'merhaba', type: 'text.delta' },
				{ content_part_index: 0, text_delta: ' dunya', type: 'text.delta' },
				{ response: mockResponse, type: 'response.completed' },
			],
			finalResponse: mockResponse,
		});

		expect(sentMessages.filter((message) => message.type === 'narration.delta').length).toBe(0);
		expect(sentMessages.filter((message) => message.type === 'narration.completed').length).toBe(0);
		expect(sentMessages.filter((message) => message.type === 'text.delta').length).toBe(2);
		expect(runtimeEvents.filter((event) => event.event_type === 'narration.started').length).toBe(
			0,
		);
		expect(runtimeEvents.filter((event) => event.event_type === 'narration.token').length).toBe(0);
	});

	it('handles multiple narration parts grouped by content_part_index', async () => {
		const mockResponse = createResponse({
			content: 'birinci kisimikinci kisim',
			ordered_content: [
				{
					index: 0,
					kind: 'text',
					ordering_origin: 'wire_streaming',
					text: 'birinci kisim',
				},
				{
					index: 1,
					input: {},
					kind: 'tool_use',
					ordering_origin: 'wire_streaming',
					tool_call_id: 'call_001',
					tool_name: 'file.list',
				},
				{
					index: 2,
					kind: 'text',
					ordering_origin: 'wire_streaming',
					text: 'ikinci kisim',
				},
				{
					index: 3,
					input: {},
					kind: 'tool_use',
					ordering_origin: 'wire_streaming',
					tool_call_id: 'call_002',
					tool_name: 'shell.exec',
				},
			],
			tool_call_candidates: [
				{ call_id: 'call_001', tool_input: {}, tool_name: 'file.list' },
				{ call_id: 'call_002', tool_input: {}, tool_name: 'shell.exec' },
			],
		});

		const { sentMessages } = await runStreaming({
			capabilities: supportedCapabilities,
			chunks: [
				{ content_part_index: 0, text_delta: 'birinci', type: 'text.delta' },
				{ content_part_index: 0, text_delta: ' kisim', type: 'text.delta' },
				{ content_part_index: 2, text_delta: 'ikinci', type: 'text.delta' },
				{ content_part_index: 2, text_delta: ' kisim', type: 'text.delta' },
				{ response: mockResponse, type: 'response.completed' },
			],
			finalResponse: mockResponse,
		});

		const completed = sentMessages.filter((message) => message.type === 'narration.completed');

		expect(sentMessages.filter((message) => message.type === 'narration.delta').length).toBe(4);
		expect(completed.length).toBe(2);
		expect(completed[0]?.payload.linked_tool_call_id).toBe('call_001');
		expect(completed[0]?.payload.full_text).toBe('birinci kisim');
		expect(completed[1]?.payload.linked_tool_call_id).toBe('call_002');
		expect(completed[1]?.payload.full_text).toBe('ikinci kisim');
		expect(sentMessages.filter((message) => message.type === 'text.delta').length).toBe(0);
	});

	it('emits no narration when stream has no text deltas', async () => {
		const mockResponse = createResponse({
			content: '',
			ordered_content: [
				{
					index: 0,
					input: {},
					kind: 'tool_use',
					ordering_origin: 'wire_streaming',
					tool_call_id: 'call_001',
					tool_name: 'file.list',
				},
			],
			tool_call_candidates: [{ call_id: 'call_001', tool_input: {}, tool_name: 'file.list' }],
		});

		const { sentMessages } = await runStreaming({
			capabilities: supportedCapabilities,
			chunks: [{ response: mockResponse, type: 'response.completed' }],
			finalResponse: mockResponse,
		});

		expect(sentMessages.filter((message) => message.type === 'narration.delta').length).toBe(0);
		expect(sentMessages.filter((message) => message.type === 'narration.completed').length).toBe(0);
		expect(sentMessages.filter((message) => message.type === 'text.delta').length).toBe(0);
	});
});
