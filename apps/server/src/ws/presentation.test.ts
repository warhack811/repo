import type { ApprovalRequest, RunRequestPayload, ToolResult } from '@runa/types';

import { describe, expect, it } from 'vitest';

import {
	createAutomaticApprovalPresentationInputs,
	createAutomaticTurnPresentationBlocks,
} from './presentation.js';

function createPayload(): RunRequestPayload {
	return {
		include_presentation_blocks: true,
		provider: 'groq',
		provider_config: {
			apiKey: 'test-key',
			defaultModel: 'llama-3.3-70b-versatile',
		},
		request: {
			messages: [{ content: 'Click the Settings button', role: 'user' }],
		},
		run_id: 'run_presentation_vision_loop',
		trace_id: 'trace_presentation_vision_loop',
	};
}

function createApprovalRequest(toolName: ApprovalRequest['tool_name']): ApprovalRequest {
	return {
		action_kind: 'tool_execution',
		approval_id: `approval_${toolName}`,
		call_id: `call_${toolName}`,
		requested_at: '2026-04-25T10:00:00.000Z',
		risk_level: 'high',
		run_id: 'run_presentation_vision_loop',
		status: 'pending',
		summary: `Approve ${toolName}`,
		target: {
			call_id: `call_${toolName}`,
			kind: 'tool_call',
			label: toolName ?? 'unknown',
			tool_name: toolName,
		},
		title: `Approve ${toolName}`,
		tool_name: toolName,
		trace_id: 'trace_presentation_vision_loop',
	};
}

function createToolResult(callId: string, toolName: ToolResult['tool_name']): ToolResult {
	return {
		call_id: callId,
		output: {
			ok: true,
		},
		status: 'success',
		tool_name: toolName,
	};
}

describe('createAutomaticApprovalPresentationInputs', () => {
	it('surfaces shell session runtime feedback in automatic tool presentation', () => {
		const toolResult: ToolResult = {
			call_id: 'call_shell_session_read',
			output: {
				runtime_feedback:
					'Shell session session_present is still running. No buffered output is available for the selected stream yet.',
				session_id: 'session_present',
				status: 'running',
			},
			status: 'success',
			tool_name: 'shell.session.read',
		};

		const blocks = createAutomaticTurnPresentationBlocks({
			created_at: '2026-04-25T10:00:00.000Z',
			tool_result: toolResult,
			working_directory: 'd:\\ai\\Runa',
		});

		expect(blocks[0]).toMatchObject({
			payload: {
				summary: expect.stringContaining('No buffered output'),
				tool_name: 'shell.session.read',
			},
			type: 'tool_result',
		});
	});

	it('persists desktop approval continuation context with prior tool result history', () => {
		const screenshotResult = createToolResult('call_before_screenshot', 'desktop.screenshot');
		const visionResult = createToolResult('call_vision_analyze', 'desktop.vision_analyze');
		const inputs = createAutomaticApprovalPresentationInputs(
			{
				approval_request: createApprovalRequest('desktop.click'),
				events: [],
				final_state: 'WAITING_APPROVAL',
				runtime_events: [],
				status: 'approval_required',
				tool_result: visionResult,
				tool_result_history: [screenshotResult, visionResult],
				turn_count: 3,
			},
			'd:\\ai\\Runa',
			createPayload(),
		);

		const input = inputs[0];
		expect(input?.kind).toBe('request_result');
		if (input?.kind !== 'request_result') {
			throw new Error('Expected request_result approval presentation input.');
		}
		expect(input.continuation_context).toEqual({
			payload: createPayload(),
			tool_result: visionResult,
			tool_result_history: [screenshotResult, visionResult],
			turn_count: 3,
			working_directory: 'd:\\ai\\Runa',
		});
	});

	it('persists non-desktop approval continuation context for replay follow-up', () => {
		const contextResult = createToolResult('call_shell_context', 'search.codebase');
		const inputs = createAutomaticApprovalPresentationInputs(
			{
				approval_request: createApprovalRequest('shell.exec'),
				events: [],
				final_state: 'WAITING_APPROVAL',
				runtime_events: [],
				status: 'approval_required',
				tool_result: contextResult,
				turn_count: 2,
			},
			'd:\\ai\\Runa',
			createPayload(),
		);

		const input = inputs[0];
		expect(input?.kind).toBe('request_result');
		if (input?.kind !== 'request_result') {
			throw new Error('Expected request_result approval presentation input.');
		}
		expect(input.continuation_context).toEqual({
			payload: createPayload(),
			tool_result: contextResult,
			tool_result_history: [contextResult],
			turn_count: 2,
			working_directory: 'd:\\ai\\Runa',
		});
	});

	it('persists first-tool approval continuation context before any tool result exists', () => {
		const inputs = createAutomaticApprovalPresentationInputs(
			{
				approval_request: createApprovalRequest('file.write'),
				events: [],
				final_state: 'WAITING_APPROVAL',
				runtime_events: [],
				status: 'approval_required',
				turn_count: 1,
			},
			'd:\\ai\\Runa',
			createPayload(),
		);

		const input = inputs[0];
		expect(input?.kind).toBe('request_result');
		if (input?.kind !== 'request_result') {
			throw new Error('Expected request_result approval presentation input.');
		}
		expect(input.continuation_context).toEqual({
			payload: createPayload(),
			tool_result: undefined,
			tool_result_history: undefined,
			turn_count: 1,
			working_directory: 'd:\\ai\\Runa',
		});
	});
});
