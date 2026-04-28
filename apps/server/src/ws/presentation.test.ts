import type { ApprovalRequest, RunRequestPayload, ToolResult } from '@runa/types';

import { describe, expect, it } from 'vitest';

import { createAutomaticApprovalPresentationInputs } from './presentation.js';

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

	it('does not attach continuation context to unrelated non-desktop approvals', () => {
		const inputs = createAutomaticApprovalPresentationInputs(
			{
				approval_request: createApprovalRequest('shell.exec'),
				events: [],
				final_state: 'WAITING_APPROVAL',
				runtime_events: [],
				status: 'approval_required',
				tool_result: createToolResult('call_shell_context', 'search.codebase'),
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
		expect(input.continuation_context).toBeUndefined();
	});
});
