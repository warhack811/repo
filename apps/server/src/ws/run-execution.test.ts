import { describe, expect, it } from 'vitest';

import { composeContext } from '../context/compose-context.js';
import type { AgentLoopSnapshot } from '../runtime/agent-loop.js';
import { evaluateStopConditions } from '../runtime/stop-conditions.js';
import { buildLiveModelRequest, buildToolResultContinuationUserTurn } from './live-request.js';
import type { RunRequestPayload } from './messages.js';
import {
	buildTerminalFailureMessage,
	createOrderedToolResultContinuationText,
	replaceFinalUserMessage,
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
