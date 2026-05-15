import type { RunRequestClientMessage } from '@runa/types';
import { act, render, waitFor } from '@testing-library/react';
import type { FormEvent, ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RunaToastProvider } from '../../components/ui/RunaToast.js';
import { useChatRuntime } from '../../hooks/useChatRuntime.js';
import type { UseChatRuntimeResult } from '../../hooks/useChatRuntime.js';
import type { UseConversationsResult } from '../../hooks/useConversations.js';
import { ChatPage } from '../../pages/ChatPage.js';

type MockWebSocketListener = (event: { readonly data?: string; readonly reason?: string }) => void;

class MockWebSocket {
	static readonly OPEN = 1;
	static instances: MockWebSocket[] = [];

	readonly listeners = new Map<string, MockWebSocketListener[]>();
	readonly sentMessages: string[] = [];
	readyState = MockWebSocket.OPEN;

	constructor() {
		MockWebSocket.instances.push(this);
		queueMicrotask(() => {
			for (const listener of this.listeners.get('open') ?? []) {
				listener({});
			}
		});
	}

	addEventListener(type: string, listener: MockWebSocketListener): void {
		const listeners = this.listeners.get(type) ?? [];
		listeners.push(listener);
		this.listeners.set(type, listeners);
	}

	close(): void {}

	emitMessage(message: unknown): void {
		for (const listener of this.listeners.get('message') ?? []) {
			listener({ data: JSON.stringify(message) });
		}
	}

	removeEventListener(type: string, listener: MockWebSocketListener): void {
		const listeners = this.listeners.get(type);
		if (!listeners) {
			return;
		}

		this.listeners.set(
			type,
			listeners.filter((candidate) => candidate !== listener),
		);
	}

	send(message: string): void {
		this.sentMessages.push(message);
	}
}

class MockResizeObserver {
	disconnect(): void {}

	observe(): void {}

	unobserve(): void {}
}

function createConversations(): UseConversationsResult {
	return {
		activeConversationId: null,
		activeConversationMembers: [],
		activeConversationMessages: [],
		activeConversationRunSurfaces: [],
		activeConversationSummary: null,
		beginDraftConversation: () => undefined,
		buildRequestMessages: () => [],
		conversationError: null,
		conversations: [],
		handleRunAccepted: () => undefined,
		handleRunFinished: () => undefined,
		handleRunFinishing: () => undefined,
		isConversationLoading: false,
		isMemberLoading: false,
		memberError: null,
		removeConversationMember: async () => undefined,
		selectConversation: () => undefined,
		shareConversationMember: async () => undefined,
	};
}

let chatPageRenderCount = 0;
let currentRuntime: UseChatRuntimeResult | null = null;

function CountingChatPage(): ReactElement {
	const runtime = useChatRuntime();
	const conversations = createConversations();

	currentRuntime = runtime;
	chatPageRenderCount += 1;

	return <ChatPage conversations={conversations} runtime={runtime} />;
}

async function submitRun(): Promise<{ readonly runId: string; readonly socket: MockWebSocket }> {
	await waitFor(() => {
		expect(MockWebSocket.instances.length).toBeGreaterThan(0);
	});

	if (!currentRuntime) {
		throw new Error('Expected a live runtime handle.');
	}

	act(() => {
		currentRuntime?.setPrompt('package.json kontrol et');
	});
	await waitFor(() => {
		expect(currentRuntime?.prompt).toBe('package.json kontrol et');
	});
	act(() => {
		currentRuntime?.submitRunRequest({
			preventDefault: () => undefined,
		} as FormEvent<HTMLFormElement>);
	});

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

describe('useChatRuntime rerender budget', () => {
	beforeEach(() => {
		MockWebSocket.instances = [];
		chatPageRenderCount = 0;
		currentRuntime = null;
		window.localStorage.clear();
		vi.stubGlobal('WebSocket', MockWebSocket);
		vi.stubGlobal('ResizeObserver', MockResizeObserver);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('keeps ChatPage rerenders bounded across 10 streaming chunks', async () => {
		render(
			<RunaToastProvider>
				<MemoryRouter>
					<CountingChatPage />
				</MemoryRouter>
			</RunaToastProvider>,
		);

		const { runId, socket } = await submitRun();

		for (let index = 0; index < 10; index += 1) {
			socket.emitMessage({
				payload: {
					run_id: runId,
					text_delta: `chunk_${index}`,
					trace_id: 'trace_perf',
				},
				type: 'text.delta',
			});
		}

		await waitFor(() => {
			expect(chatPageRenderCount).toBeLessThanOrEqual(5);
		});
	});
});
