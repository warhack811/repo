import type { RenderBlock } from '@runa/types';
import { render, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PresentationRunSurface } from '../lib/chat-runtime/types.js';
import { useConversationBackedChatRuntime } from './useConversationBackedChatRuntime.js';

interface PresentationState {
	readonly presentationRunId: string | null;
	readonly presentationRunSurfaces: readonly PresentationRunSurface[];
}

interface RuntimeStoreState {
	readonly presentation: {
		readonly currentStreamingRunId: string | null;
	};
}

const mocks = vi.hoisted(() => ({
	setPresentationState: vi.fn(),
	useChatRuntime: vi.fn(),
	useConversations: vi.fn(),
}));

vi.mock('./useChatRuntime.js', () => ({
	useChatRuntime: mocks.useChatRuntime,
}));

vi.mock('./useConversations.js', () => ({
	useConversations: mocks.useConversations,
}));

const persistedWorkNarrationBlock: Extract<RenderBlock, { type: 'work_narration' }> = {
	created_at: '2026-05-05T12:00:00.000Z',
	id: 'narration_replay_contract',
	payload: {
		linked_tool_call_id: 'call_replay_contract',
		locale: 'tr',
		run_id: 'run_replay_contract',
		sequence_no: 7,
		status: 'completed',
		text: 'package.json dosyasini kontrol ediyorum.',
		turn_index: 2,
	},
	schema_version: 1,
	type: 'work_narration',
};

function RuntimeHarness(): ReactElement {
	useConversationBackedChatRuntime('test-token');
	return <div data-testid="harness" />;
}

function expectPresentationState(
	value: PresentationState | undefined,
): asserts value is PresentationState {
	expect(value).toBeDefined();
}

describe('useConversationBackedChatRuntime', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('loads persisted work_narration blocks into replay surfaces with the canonical payload shape intact', async () => {
		const capturedState: { current?: PresentationState } = {};
		const initialState: PresentationState = {
			presentationRunId: null,
			presentationRunSurfaces: [],
		};

		mocks.setPresentationState.mockImplementation(
			(updater: (current: PresentationState) => PresentationState) => {
				capturedState.current = updater(initialState);
			},
		);
		mocks.useConversations.mockReturnValue({
			activeConversationId: 'conversation_replay_contract',
			activeConversationRunSurfaces: [
				{
					blocks: [persistedWorkNarrationBlock],
					run_id: 'run_replay_contract',
					trace_id: 'trace_replay_contract',
				},
			],
			buildRequestMessages: vi.fn(),
			handleRunAccepted: vi.fn(),
			handleRunFinished: vi.fn(),
			handleRunFinishing: vi.fn(),
		});
		const mockStore = {
			getState: (): RuntimeStoreState => ({
				presentation: {
					currentStreamingRunId: null,
				},
			}),
			setPresentationState: mocks.setPresentationState,
			subscribe: () => () => undefined,
		};
		mocks.useChatRuntime.mockReturnValue({
			isSubmitting: false,
			resetRunState: vi.fn(),
			store: mockStore,
		});

		render(<RuntimeHarness />);

		await waitFor(() => {
			expect(mocks.setPresentationState).toHaveBeenCalled();
		});

		expectPresentationState(capturedState.current);
		const replaySurface = capturedState.current.presentationRunSurfaces[0];

		expect(replaySurface).toMatchObject({
			replayMode: true,
			run_id: 'run_replay_contract',
			trace_id: 'trace_replay_contract',
		});
		expect(replaySurface?.blocks[0]).toEqual(persistedWorkNarrationBlock);
		expect(replaySurface?.blocks[0]).not.toHaveProperty('text');
		expect(replaySurface?.blocks[0]).not.toHaveProperty('status');
	});
});
