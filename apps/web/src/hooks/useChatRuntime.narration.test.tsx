import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RunRequestClientMessage, WebSocketServerBridgeMessage } from '../ws-types.js';
import { useChatRuntime } from './useChatRuntime.js';

type MockWebSocketListener = (event: { readonly data?: string; readonly reason?: string }) => void;

class MockWebSocket {
	static readonly OPEN = 1;
	static instances: MockWebSocket[] = [];

	readonly listeners = new Map<string, MockWebSocketListener[]>();
	readonly sentMessages: string[] = [];
	readyState = MockWebSocket.OPEN;

	constructor() {
		MockWebSocket.instances.push(this);
	}

	addEventListener(type: string, listener: MockWebSocketListener): void {
		const listeners = this.listeners.get(type) ?? [];
		listeners.push(listener);
		this.listeners.set(type, listeners);
	}

	close(): void {}

	emitMessage(message: WebSocketServerBridgeMessage): void {
		for (const listener of this.listeners.get('message') ?? []) {
			listener({ data: JSON.stringify(message) });
		}
	}

	send(message: string): void {
		this.sentMessages.push(message);
	}
}

function RuntimeHarness(): ReactElement {
	const runtime = useChatRuntime();
	const blocks = runtime.currentPresentationSurface?.blocks ?? [];

	return (
		<form onSubmit={runtime.submitRunRequest}>
			<button
				type="button"
				onClick={() => {
					runtime.setPrompt('package.json kontrol et');
				}}
			>
				prepare
			</button>
			<button type="submit">submit</button>
			<output data-testid="streaming-text">{runtime.currentStreamingText}</output>
			<output data-testid="blocks">{JSON.stringify(blocks)}</output>
		</form>
	);
}

async function submitRunAndResolveIds(): Promise<{
	readonly runId: string;
	readonly socket: MockWebSocket;
}> {
	await waitFor(() => {
		expect(MockWebSocket.instances.length).toBeGreaterThan(0);
	});

	fireEvent.click(screen.getByText('prepare'));
	fireEvent.click(screen.getByText('submit'));

	await waitFor(() => {
		expect(MockWebSocket.instances[0]?.sentMessages[0]).toBeDefined();
	});

	const socket = MockWebSocket.instances[0];

	if (!socket) {
		throw new Error('Expected an initialized websocket instance.');
	}

	const sentMessage = socket.sentMessages[0];

	if (!sentMessage) {
		throw new Error('Expected a submitted run request.');
	}

	const runRequest = JSON.parse(sentMessage) as RunRequestClientMessage;

	return {
		runId: runRequest.payload.run_id,
		socket,
	};
}

function createNarrationDelta(input: {
	readonly narrationId: string;
	readonly runId: string;
	readonly sequenceNo: number;
	readonly textDelta: string;
	readonly turnIndex?: number;
}): WebSocketServerBridgeMessage {
	return {
		payload: {
			locale: 'tr',
			narration_id: input.narrationId,
			run_id: input.runId,
			sequence_no: input.sequenceNo,
			text_delta: input.textDelta,
			trace_id: 'trace_hook',
			turn_index: input.turnIndex ?? 1,
		},
		type: 'narration.delta',
	};
}

function readRenderedBlocks(): readonly unknown[] {
	return JSON.parse(screen.getByTestId('blocks').textContent ?? '[]') as readonly unknown[];
}

describe('useChatRuntime narration streaming state', () => {
	beforeEach(() => {
		MockWebSocket.instances = [];
		window.localStorage.clear();
		vi.stubGlobal('WebSocket', MockWebSocket);
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it('appends narration.delta chunks into one live work_narration block', async () => {
		render(<RuntimeHarness />);
		const { runId, socket } = await submitRunAndResolveIds();

		socket.emitMessage(
			createNarrationDelta({
				narrationId: 'narration_001',
				runId,
				sequenceNo: 1,
				textDelta: 'package.json',
			}),
		);
		socket.emitMessage(
			createNarrationDelta({
				narrationId: 'narration_001',
				runId,
				sequenceNo: 2,
				textDelta: ' kontrol',
			}),
		);
		socket.emitMessage(
			createNarrationDelta({
				narrationId: 'narration_001',
				runId,
				sequenceNo: 3,
				textDelta: ' ediyorum.',
			}),
		);

		await waitFor(() => {
			expect(screen.getByTestId('blocks').textContent).toContain('package.json kontrol ediyorum.');
		});

		const blocks = readRenderedBlocks();

		expect(blocks).toHaveLength(1);
		expect(blocks[0]).toMatchObject({
			id: 'narration_001',
			payload: {
				sequence_no: 3,
				status: 'streaming',
				text: 'package.json kontrol ediyorum.',
			},
			type: 'work_narration',
		});
		expect(screen.getByTestId('streaming-text').textContent).toBe('');
	});

	it('finalizes narration.completed without duplicating the narration block', async () => {
		render(<RuntimeHarness />);
		const { runId, socket } = await submitRunAndResolveIds();

		socket.emitMessage(
			createNarrationDelta({
				narrationId: 'narration_001',
				runId,
				sequenceNo: 1,
				textDelta: 'pkg',
			}),
		);
		socket.emitMessage({
			payload: {
				full_text: 'package.json dosyasını kontrol ediyorum.',
				linked_tool_call_id: 'call_read',
				narration_id: 'narration_001',
				run_id: runId,
				trace_id: 'trace_hook',
			},
			type: 'narration.completed',
		});

		await waitFor(() => {
			expect(screen.getByTestId('blocks').textContent).toContain('"status":"completed"');
		});

		const blocks = readRenderedBlocks();

		expect(blocks).toHaveLength(1);
		expect(blocks[0]).toMatchObject({
			id: 'narration_001',
			payload: {
				linked_tool_call_id: 'call_read',
				status: 'completed',
				text: 'package.json dosyasını kontrol ediyorum.',
			},
			type: 'work_narration',
		});
	});

	it('marks narration.superseded for the renderer to collapse', async () => {
		render(<RuntimeHarness />);
		const { runId, socket } = await submitRunAndResolveIds();

		socket.emitMessage(
			createNarrationDelta({
				narrationId: 'narration_001',
				runId,
				sequenceNo: 1,
				textDelta: 'eski anlat?m',
			}),
		);
		socket.emitMessage({
			payload: {
				narration_id: 'narration_001',
				run_id: runId,
				trace_id: 'trace_hook',
			},
			type: 'narration.superseded',
		});

		await waitFor(() => {
			expect(screen.getByTestId('blocks').textContent).toContain('"status":"superseded"');
		});
	});

	it('keeps simultaneous narration ids separated', async () => {
		render(<RuntimeHarness />);
		const { runId, socket } = await submitRunAndResolveIds();

		socket.emitMessage(
			createNarrationDelta({
				narrationId: 'narration_a',
				runId,
				sequenceNo: 1,
				textDelta: 'birinci',
			}),
		);
		socket.emitMessage(
			createNarrationDelta({
				narrationId: 'narration_b',
				runId,
				sequenceNo: 2,
				textDelta: 'ikinci',
			}),
		);

		await waitFor(() => {
			expect(readRenderedBlocks()).toHaveLength(2);
		});

		expect(readRenderedBlocks()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: 'narration_a' }),
				expect.objectContaining({ id: 'narration_b' }),
			]),
		);
	});

	it('keeps legacy text.delta separate from narration blocks', async () => {
		render(<RuntimeHarness />);
		const { runId, socket } = await submitRunAndResolveIds();

		socket.emitMessage({
			payload: {
				run_id: runId,
				text_delta: 'final answer token',
				trace_id: 'trace_hook',
			},
			type: 'text.delta',
		});

		await waitFor(() => {
			expect(screen.getByTestId('streaming-text').textContent).toBe('final answer token');
		});

		expect(readRenderedBlocks()).toHaveLength(0);
	});
});
