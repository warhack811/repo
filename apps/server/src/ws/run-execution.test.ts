import type { AuthContext, RenderBlock, RuntimeEvent } from '@runa/types';
import { resolve as resolvePath } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { composeContext } from '../context/compose-context.js';
import type { ApprovalStore } from '../persistence/approval-store.js';
import type { AgentLoopSnapshot } from '../runtime/agent-loop.js';
import {
	buildNarrationCompletedEvent,
	buildNarrationStartedEvent,
	buildNarrationSupersededEvent,
	buildNarrationTokenEvent,
	buildNarrationToolOutcomeLinkedEvent,
	buildRunCompletedEvent,
	buildRunStartedEvent,
	buildStateEnteredEvent,
} from '../runtime/runtime-events.js';
import { evaluateStopConditions } from '../runtime/stop-conditions.js';
import { createMockSocket } from '../test-utils/mock-socket.js';
import { DesktopAgentBridgeRegistry } from './desktop-agent-bridge.js';
import { buildLiveModelRequest, buildToolResultContinuationUserTurn } from './live-request.js';
import type { RunRequestPayload } from './messages.js';
import type { ConversationOrchestrationStore } from './orchestration-types.js';
import {
	buildTerminalFailureMessage,
	createOrderedToolResultContinuationText,
	finalizeLiveRunResult,
	replaceFinalUserMessage,
	resolveApprovalTarget,
	resolveRuntimeTerminationCode,
	supportsDesktopVisionProvider,
} from './run-execution.js';

function createSnapshot(overrides: Partial<AgentLoopSnapshot>): AgentLoopSnapshot {
	return {
		config: {
			max_turns: 200,
			stop_conditions: {},
		},
		current_loop_state: 'FAILED',
		current_runtime_state: 'FAILED',
		run_id: 'run_terminal_message',
		trace_id: 'trace_terminal_message',
		turn_count: 3,
		...overrides,
	};
}

function createRunRequestPayload(): RunRequestPayload {
	return {
		include_presentation_blocks: true,
		provider: 'groq',
		provider_config: {
			apiKey: 'groq-key',
		},
		request: {
			messages: [
				{
					content: 'Read the HTML file and summarize it.',
					role: 'user',
				},
			],
			model: 'llama-3.3-70b-versatile',
		},
		run_id: 'run_tool_result_pipeline_regression',
		trace_id: 'trace_tool_result_pipeline_regression',
	};
}

function createAuthContext(): AuthContext {
	return {
		bearer_token_present: true,
		principal: {
			kind: 'authenticated',
			provider: 'internal',
			role: 'authenticated',
			scope: {
				tenant_id: 'tenant_1',
				workspace_id: 'workspace_1',
			},
			session_id: 'session_1',
			user_id: 'user_1',
		},
		request_id: 'req_run_execution_test',
		transport: 'websocket',
	};
}

function createApprovalStore(): ApprovalStore {
	return {
		getPendingApprovalById: vi.fn(async () => null),
		persistApprovalRequest: vi.fn(async () => {}),
		persistApprovalResolution: vi.fn(async () => {}),
	};
}

function createConversationStore(): ConversationOrchestrationStore {
	return {
		appendConversationMessage: vi.fn(async (input) => ({
			content: input.content,
			conversation_id: input.conversation_id,
			created_at: input.created_at ?? '2026-05-05T11:00:00.000Z',
			message_id: 'message_1',
			role: input.role,
			run_id: input.run_id,
			sequence_no: 1,
			trace_id: input.trace_id,
		})),
		appendConversationRunBlocks: vi.fn(async (input) => ({
			block_record_id: 'block_record_1',
			blocks: input.blocks,
			conversation_id: input.conversation_id,
			created_at: input.created_at ?? '2026-05-05T11:00:00.000Z',
			run_id: input.run_id,
			trace_id: input.trace_id,
		})),
		ensureConversation: vi.fn(async (input) => ({
			access_role: 'owner' as const,
			conversation_id: input.conversation_id ?? 'conversation_1',
			created_at: input.created_at ?? '2026-05-05T11:00:00.000Z',
			last_message_at: input.created_at ?? '2026-05-05T11:00:00.000Z',
			last_message_preview: input.initial_preview ?? 'test',
			title: input.initial_preview ?? 'test',
			updated_at: input.created_at ?? '2026-05-05T11:00:00.000Z',
		})),
	};
}

function createRuntimeEventContext(sequence_no: number, timestamp?: string) {
	return {
		run_id: 'run_tool_result_pipeline_regression',
		sequence_no,
		timestamp,
		trace_id: 'trace_tool_result_pipeline_regression',
	};
}

function createCompletedRuntimeEvents(
	narrationEvents: readonly RuntimeEvent[] = [],
): readonly RuntimeEvent[] {
	return [
		buildRunStartedEvent(
			{
				entry_state: 'INIT',
				trigger: 'user_message',
			},
			createRuntimeEventContext(1, '2026-05-05T11:00:00.000Z'),
		),
		buildStateEnteredEvent(
			{
				previous_state: 'INIT',
				reason: 'run-request-accepted',
				state: 'MODEL_THINKING',
			},
			{
				...createRuntimeEventContext(2, '2026-05-05T11:00:01.000Z'),
				state_after: 'MODEL_THINKING',
				state_before: 'INIT',
			},
		),
		...narrationEvents,
		buildRunCompletedEvent(
			{
				final_state: 'COMPLETED',
				output_text: 'Done.',
			},
			{
				...createRuntimeEventContext(99, '2026-05-05T11:00:09.000Z'),
				state_after: 'COMPLETED',
				state_before: 'MODEL_THINKING',
			},
		),
	];
}

function getPersistedBlocks(
	conversationStore: ConversationOrchestrationStore,
): readonly RenderBlock[] {
	if (!conversationStore.appendConversationRunBlocks) {
		throw new Error('Expected appendConversationRunBlocks to exist.');
	}

	const appendConversationRunBlocks = vi.mocked(conversationStore.appendConversationRunBlocks);
	const [input] = appendConversationRunBlocks.mock.calls[0] ?? [];

	if (!input) {
		throw new Error('Expected appendConversationRunBlocks to be called.');
	}

	return input.blocks;
}

describe('run-execution tool result pipeline helpers', () => {
	it('only enables desktop vision helpers for image-capable providers', () => {
		expect(supportsDesktopVisionProvider('claude')).toBe(true);
		expect(supportsDesktopVisionProvider('gemini')).toBe(true);
		expect(supportsDesktopVisionProvider('groq')).toBe(true);
		expect(supportsDesktopVisionProvider('openai')).toBe(true);
		expect(supportsDesktopVisionProvider('deepseek')).toBe(false);
		expect(supportsDesktopVisionProvider('sambanova')).toBe(false);
	});

	it('resolveRuntimeTerminationCode returns undefined for completed stop_reason', () => {
		expect(
			resolveRuntimeTerminationCode({
				disposition: 'terminal',
				final_runtime_state: 'COMPLETED',
				kind: 'completed',
				loop_state: 'COMPLETED',
				turn_count: 1,
			}),
		).toBeUndefined();
	});

	it('resolveRuntimeTerminationCode returns undefined for cancelled stop_reason', () => {
		expect(
			resolveRuntimeTerminationCode({
				actor: 'user',
				disposition: 'terminal',
				kind: 'cancelled',
				loop_state: 'CANCELLED',
				turn_count: 1,
			}),
		).toBeUndefined();
	});

	it('resolveRuntimeTerminationCode returns the failure code for repeated_tool_call', () => {
		expect(
			resolveRuntimeTerminationCode({
				consecutive_count: 3,
				disposition: 'terminal',
				kind: 'repeated_tool_call',
				loop_state: 'FAILED',
				tool_name: 'file.read',
				turn_count: 3,
			}),
		).toBe('REPEATED_TOOL_CALL');
	});

	it('buildTerminalFailureMessage surfaces repeated_tool_call details', () => {
		const message = buildTerminalFailureMessage(
			createSnapshot({
				stop_reason: {
					consecutive_count: 3,
					disposition: 'terminal',
					kind: 'repeated_tool_call',
					loop_state: 'FAILED',
					tool_name: 'file.read',
					turn_count: 3,
				},
			}),
		);

		expect(message).toBe(
			"Run terminated: tool 'file.read' was called 3 times with identical arguments.",
		);
	});

	it('buildTerminalFailureMessage surfaces max_turns_reached details', () => {
		const message = buildTerminalFailureMessage(
			createSnapshot({
				stop_reason: {
					disposition: 'terminal',
					kind: 'max_turns_reached',
					loop_state: 'FAILED',
					max_turns: 200,
					turn_count: 200,
				},
			}),
		);

		expect(message).toBe('Run terminated: reached max_turns limit (200).');
	});

	it('buildTerminalFailureMessage falls back to existing failure.error_message when present', () => {
		const message = buildTerminalFailureMessage(
			createSnapshot({
				failure: {
					error_code: 'TURN_EXECUTION_FAILED',
					error_message: 'Existing failure wins.',
				},
				stop_reason: {
					consecutive_count: 3,
					disposition: 'terminal',
					kind: 'repeated_tool_call',
					loop_state: 'FAILED',
					tool_name: 'file.read',
					turn_count: 3,
				},
			}),
		);

		expect(message).toBe('Existing failure wins.');
	});

	it('createOrderedToolResultContinuationText omits JSON output and includes call_id references', () => {
		const text = createOrderedToolResultContinuationText('Do the work.', [
			{
				call_id: 'call_abc1',
				output: {
					content: 'do not stringify this payload',
					path: 'README.md',
					size_bytes: 1583,
				},
				status: 'success',
				tool_name: 'file.read',
			},
			{
				call_id: 'call_def2',
				error_code: 'EXECUTION_FAILED',
				error_message: 'boom',
				status: 'error',
				tool_name: 'shell.exec',
			},
		]);

		expect(text).toContain('Ordered tool results (full content in run context):');
		expect(text).toContain('[1] file.read#call_abc1 (succeeded, 1583 bytes)');
		expect(text).toContain('[2] shell.exec#call_def2 (failed: EXECUTION_FAILED)');
		expect(text).not.toContain('do not stringify this payload');
	});

	it('replaceFinalUserMessage replaces previous Ordered tool results block instead of stacking', () => {
		const messages = replaceFinalUserMessage(
			[
				{
					content:
						'Do the work.\n\nOrdered tool results (full content in run context):\n[1] old#call_old (succeeded)',
					role: 'user',
				},
			],
			[
				{
					call_id: 'call_new1',
					output: {
						size_bytes: 42,
					},
					status: 'success',
					tool_name: 'file.read',
				},
				{
					call_id: 'call_new2',
					output: {},
					status: 'success',
					tool_name: 'file.write',
				},
			],
		);

		expect(messages).toHaveLength(1);
		expect(messages[0]?.content).toContain('file.read#call_new1');
		expect(messages[0]?.content).toContain('file.write#call_new2');
		expect(messages[0]?.content).not.toContain('call_old');
		expect(
			messages[0]?.content.match(/Ordered tool results \(full content in run context\):/gu),
		).toHaveLength(1);
	});
});

describe('tool-result-pipeline regression', () => {
	it('keeps a 1.5KB file.read result visible in the user message and RunLayer without triggering repeated_tool_call', async () => {
		const content = `<html>${'x'.repeat(1500)}</html>`;
		const toolResult = {
			call_id: 'call_regression_read_1',
			output: {
				content,
				path: 'D:/ai/Runa/index.html',
				size_bytes: content.length,
			},
			status: 'success' as const,
			tool_name: 'file.read' as const,
		};
		const request = await buildLiveModelRequest(createRunRequestPayload(), 'D:/ai/Runa', {
			current_state: 'TOOL_RESULT_INGESTING',
			latest_tool_result: toolResult,
		});
		const context = composeContext({
			current_state: 'TOOL_RESULT_INGESTING',
			latest_tool_result: {
				call_id: toolResult.call_id,
				output: toolResult.output,
				result_status: 'success',
				tool_name: toolResult.tool_name,
			},
			run_id: 'run_tool_result_pipeline_regression',
			trace_id: 'trace_tool_result_pipeline_regression',
		});
		const decision = evaluateStopConditions({
			config: {
				max_turns: 200,
				stop_conditions: {},
			},
			recent_tool_calls: [
				{ args_hash: 'same_file_args', tool_name: 'file.read' },
				{ args_hash: 'same_file_args', tool_name: 'file.read' },
			],
			turn_count: 2,
		});

		expect(request.messages[0]?.content).toContain(content);
		expect(context.layers[1]).toMatchObject({
			content: {
				latest_tool_result: {
					inline_output: toolResult.output,
				},
			},
		});
		expect(decision).toEqual({
			decision: 'continue',
			loop_state: 'RUNNING',
		});
	});

	it('terminates and surfaces repeated_tool_call after three identical file.read signatures', () => {
		const decision = evaluateStopConditions({
			config: {
				max_turns: 200,
				stop_conditions: {},
			},
			recent_tool_calls: [
				{ args_hash: 'same_file_args', tool_name: 'file.read' },
				{ args_hash: 'same_file_args', tool_name: 'file.read' },
				{ args_hash: 'same_file_args', tool_name: 'file.read' },
			],
			turn_count: 3,
		});

		expect(decision.decision).toBe('terminal');

		if (decision.decision !== 'terminal') {
			throw new Error('Expected repeated_tool_call terminal decision.');
		}

		expect(
			buildTerminalFailureMessage(
				createSnapshot({
					stop_reason: decision.reason,
				}),
			),
		).toBe("Run terminated: tool 'file.read' was called 3 times with identical arguments.");
	});

	it('adds a recovery preamble after the second identical file.read call to prevent a third call', () => {
		const message = buildToolResultContinuationUserTurn(
			'Read the HTML file and summarize it.',
			{
				call_id: 'call_regression_read_2',
				output: {
					content: `<html>${'x'.repeat(1500)}</html>`,
					path: 'D:/ai/Runa/index.html',
					size_bytes: 1513,
				},
				status: 'success',
				tool_name: 'file.read',
			},
			[
				{ args_hash: 'same_file_args', tool_name: 'file.read' },
				{ args_hash: 'same_file_args', tool_name: 'file.read' },
			],
		);

		expect(message).toContain('DO NOT call this tool again with the same arguments.');
	});
});

describe('resolveApprovalTarget', () => {
	it('returns file_path target for file.write using run working directory', () => {
		const result = resolveApprovalTarget({
			call_id: 'call_file_write_1',
			tool_input: {
				content: 'hello',
				path: './notes/todo.md',
			},
			tool_name: 'file.write',
			working_directory: 'D:/ai/Runa/apps/web',
		});

		expect(result).toEqual({
			call_id: 'call_file_write_1',
			kind: 'file_path',
			label: resolvePath('D:/ai/Runa/apps/web', './notes/todo.md'),
			path: resolvePath('D:/ai/Runa/apps/web', './notes/todo.md'),
			tool_name: 'file.write',
		});
	});

	it('prefers desktop target metadata for desktop tools', () => {
		const desktopRegistry = new DesktopAgentBridgeRegistry();
		vi.spyOn(desktopRegistry, 'listPresenceSnapshotsForUserId').mockReturnValue([
			{
				agent_id: 'agent_12345678',
				capabilities: [],
				connection_id: 'conn_1',
				connected_at: '2026-05-09T10:00:00.000Z',
				machine_label: 'QA Windows',
				status: 'online',
				transport: 'desktop_bridge',
				user_id: 'user_1',
			},
		]);

		const result = resolveApprovalTarget({
			auth_context: createAuthContext(),
			call_id: 'call_desktop_1',
			desktopAgentBridgeRegistry: desktopRegistry,
			target_connection_id: 'conn_1',
			tool_input: {},
			tool_name: 'desktop.click',
			working_directory: 'D:/ai/Runa',
		});

		expect(result).toEqual({
			call_id: 'call_desktop_1',
			kind: 'tool_call',
			label: 'QA Windows',
			tool_name: 'desktop.click',
		});
	});
});

describe('finalizeLiveRunResult presentation persistence', () => {
	it('persists mapper-created work narration blocks in conversation_run_blocks', async () => {
		const narrationEvents = [
			buildNarrationStartedEvent(
				{
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 10,
					turn_index: 1,
				},
				createRuntimeEventContext(10, '2026-05-05T11:00:02.000Z'),
			),
			buildNarrationTokenEvent(
				{
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 11,
					text_delta: 'package.json',
					turn_index: 1,
				},
				createRuntimeEventContext(11, '2026-05-05T11:00:03.000Z'),
			),
			buildNarrationCompletedEvent(
				{
					full_text: 'package.json kontrol ediyorum.',
					linked_tool_call_id: 'call_1',
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 12,
					turn_index: 1,
				},
				createRuntimeEventContext(12, '2026-05-05T11:00:04.000Z'),
			),
		];
		const runtimeEvents = createCompletedRuntimeEvents(narrationEvents);
		const conversationStore = createConversationStore();
		const { socket } = createMockSocket();

		await finalizeLiveRunResult(
			socket,
			{
				...createRunRequestPayload(),
				conversation_id: 'conversation_1',
			},
			{
				assistant_text: 'Done.',
				events: runtimeEvents,
				final_state: 'COMPLETED',
				runtime_events: runtimeEvents,
				status: 'completed',
				turn_count: 1,
			},
			{
				approvalStore: createApprovalStore(),
				auth_context: createAuthContext(),
				conversationStore,
				persistEvents: vi.fn(async () => {}),
				persistRunState: vi.fn(async () => {}),
			},
			{
				conversation_id: 'conversation_1',
				persist_live_memory_write: false,
				working_directory: 'D:/ai/Runa',
			},
		);

		const persistedBlocks = getPersistedBlocks(conversationStore);
		const narrationBlocks = persistedBlocks.filter((block) => block.type === 'work_narration');

		expect(narrationBlocks).toHaveLength(1);
		expect(narrationBlocks[0]).toEqual({
			created_at: '2026-05-05T11:00:02.000Z',
			id: 'nar_1',
			payload: {
				linked_tool_call_id: 'call_1',
				locale: 'tr',
				run_id: 'run_tool_result_pipeline_regression',
				sequence_no: 12,
				status: 'completed',
				text: 'package.json kontrol ediyorum.',
				turn_index: 1,
			},
			schema_version: 1,
			type: 'work_narration',
		});
		expect(persistedBlocks.map((block) => block.type)).toContain('event_list');
	});

	it('persists tool_failed narration status and deduplicates repeated completed events', async () => {
		const narrationEvents = [
			buildNarrationCompletedEvent(
				{
					full_text: 'ilk metin',
					linked_tool_call_id: 'call_1',
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 10,
					turn_index: 1,
				},
				createRuntimeEventContext(10),
			),
			buildNarrationCompletedEvent(
				{
					full_text: 'canonical metin',
					linked_tool_call_id: 'call_1',
					locale: 'tr',
					narration_id: 'nar_1',
					sequence_no: 11,
					turn_index: 1,
				},
				createRuntimeEventContext(11),
			),
			buildNarrationToolOutcomeLinkedEvent(
				{
					linked_tool_call_id: 'call_1',
					locale: 'tr',
					narration_id: 'nar_1',
					outcome: 'failure',
					sequence_no: 12,
					tool_call_id: 'call_1',
					turn_index: 1,
				},
				createRuntimeEventContext(12),
			),
		];
		const runtimeEvents = createCompletedRuntimeEvents(narrationEvents);
		const conversationStore = createConversationStore();
		const { socket } = createMockSocket();

		await finalizeLiveRunResult(
			socket,
			{
				...createRunRequestPayload(),
				conversation_id: 'conversation_1',
			},
			{
				assistant_text: 'Done.',
				events: runtimeEvents,
				final_state: 'COMPLETED',
				runtime_events: runtimeEvents,
				status: 'completed',
				turn_count: 1,
			},
			{
				approvalStore: createApprovalStore(),
				auth_context: createAuthContext(),
				conversationStore,
				persistEvents: vi.fn(async () => {}),
				persistRunState: vi.fn(async () => {}),
			},
			{
				conversation_id: 'conversation_1',
				persist_live_memory_write: false,
				working_directory: 'D:/ai/Runa',
			},
		);

		const narrationBlocks = getPersistedBlocks(conversationStore).filter(
			(block) => block.type === 'work_narration',
		);

		expect(narrationBlocks).toHaveLength(1);
		expect(narrationBlocks[0]).toMatchObject({
			id: 'nar_1',
			payload: {
				linked_tool_call_id: 'call_1',
				status: 'tool_failed',
				text: 'canonical metin',
			},
		});
	});

	it('persists superseded narration status for replay consistency', async () => {
		const narrationEvents = [
			buildNarrationStartedEvent(
				{
					locale: 'tr',
					narration_id: 'nar_superseded',
					sequence_no: 10,
					turn_index: 1,
				},
				createRuntimeEventContext(10, '2026-05-05T11:00:05.000Z'),
			),
			buildNarrationTokenEvent(
				{
					locale: 'tr',
					narration_id: 'nar_superseded',
					sequence_no: 11,
					text_delta: 'gecici metin',
					turn_index: 1,
				},
				createRuntimeEventContext(11, '2026-05-05T11:00:06.000Z'),
			),
			buildNarrationSupersededEvent(
				{
					locale: 'tr',
					narration_id: 'nar_superseded',
					sequence_no: 12,
					turn_index: 1,
				},
				createRuntimeEventContext(12, '2026-05-05T11:00:07.000Z'),
			),
		];
		const runtimeEvents = createCompletedRuntimeEvents(narrationEvents);
		const conversationStore = createConversationStore();
		const { socket } = createMockSocket();

		await finalizeLiveRunResult(
			socket,
			{
				...createRunRequestPayload(),
				conversation_id: 'conversation_1',
			},
			{
				assistant_text: 'Done.',
				events: runtimeEvents,
				final_state: 'COMPLETED',
				runtime_events: runtimeEvents,
				status: 'completed',
				turn_count: 1,
			},
			{
				approvalStore: createApprovalStore(),
				auth_context: createAuthContext(),
				conversationStore,
				persistEvents: vi.fn(async () => {}),
				persistRunState: vi.fn(async () => {}),
			},
			{
				conversation_id: 'conversation_1',
				persist_live_memory_write: false,
				working_directory: 'D:/ai/Runa',
			},
		);

		const narrationBlocks = getPersistedBlocks(conversationStore).filter(
			(block) => block.type === 'work_narration',
		);

		expect(narrationBlocks.map((block) => block.id)).toEqual(['nar_superseded']);
		expect(narrationBlocks[0]).toEqual({
			created_at: '2026-05-05T11:00:05.000Z',
			id: 'nar_superseded',
			payload: {
				locale: 'tr',
				run_id: 'run_tool_result_pipeline_regression',
				sequence_no: 10,
				status: 'superseded',
				text: 'gecici metin',
				turn_index: 1,
			},
			schema_version: 1,
			type: 'work_narration',
		});
	});
});
