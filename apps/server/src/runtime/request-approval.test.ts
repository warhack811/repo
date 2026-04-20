import type { ToolDefinition } from '@runa/types';

import { describe, expect, it } from 'vitest';

import { fileWriteTool } from '../tools/file-write.js';
import { shellExecTool } from '../tools/shell-exec.js';

import { requestApproval } from './request-approval.js';

function createFakeReadOnlyTool(): ToolDefinition {
	return {
		description: 'Reads a file without mutating the workspace.',
		async execute() {
			throw new Error('Not implemented in requestApproval tests.');
		},
		metadata: {
			capability_class: 'file_system',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
		},
		name: 'file.read',
	};
}

function createFakeApprovalRequiredTool(): ToolDefinition {
	return {
		description: 'Searches the workspace for matching content.',
		async execute() {
			throw new Error('Not implemented in requestApproval tests.');
		},
		metadata: {
			capability_class: 'search',
			requires_approval: true,
			risk_level: 'medium',
			side_effect_level: 'read',
		},
		name: 'search.grep',
	};
}

describe('requestApproval', () => {
	it('returns approval_not_required for tools that do not require approval', () => {
		const result = requestApproval({
			current_state: 'MODEL_THINKING',
			run_id: 'run_request_approval_read',
			tool_definition: createFakeReadOnlyTool(),
			trace_id: 'trace_request_approval_read',
		});

		expect(result).toEqual({
			final_state: 'MODEL_THINKING',
			state_transitions: [],
			status: 'approval_not_required',
			tool_name: 'file.read',
		});
	});

	it('creates an approval request and event for file.write', () => {
		const result = requestApproval({
			call_id: 'call_file_write_approval',
			current_state: 'MODEL_THINKING',
			event_context: {
				sequence_no: 7,
				timestamp: '2026-04-10T18:30:00.000Z',
			},
			run_id: 'run_request_approval_write',
			summary: 'Write changes to src/app.ts',
			title: 'Approve file write',
			tool_definition: fileWriteTool,
			trace_id: 'trace_request_approval_write',
		});

		expect(result.status).toBe('approval_required');

		if (result.status !== 'approval_required') {
			throw new Error('Expected approval_required result.');
		}

		expect(result.final_state).toBe('WAITING_APPROVAL');
		expect(result.state_transitions).toEqual([{ from: 'MODEL_THINKING', to: 'WAITING_APPROVAL' }]);
		expect(result.approval_request).toMatchObject({
			action_kind: 'file_write',
			approval_id: 'run_request_approval_write:approval:call_file_write_approval',
			call_id: 'call_file_write_approval',
			requested_at: '2026-04-10T18:30:00.000Z',
			risk_level: 'medium',
			run_id: 'run_request_approval_write',
			status: 'pending',
			summary: 'Write changes to src/app.ts',
			title: 'Approve file write',
			tool_name: 'file.write',
			trace_id: 'trace_request_approval_write',
		});
		expect(result.approval_event.event_type).toBe('approval.requested');
		expect(result.approval_event.run_id).toBe('run_request_approval_write');
		expect(result.approval_event.trace_id).toBe('trace_request_approval_write');
		expect(result.approval_event.payload).toMatchObject({
			action_kind: 'file_write',
			approval_id: 'run_request_approval_write:approval:call_file_write_approval',
			call_id: 'call_file_write_approval',
			summary: 'Write changes to src/app.ts',
			title: 'Approve file write',
			tool_name: 'file.write',
		});
	});

	it('maps shell.exec to shell_execution approval action kind', () => {
		const result = requestApproval({
			call_id: 'call_shell_exec_approval',
			current_state: 'MODEL_THINKING',
			run_id: 'run_request_approval_shell',
			tool_definition: shellExecTool,
			trace_id: 'trace_request_approval_shell',
		});

		expect(result.status).toBe('approval_required');

		if (result.status !== 'approval_required') {
			throw new Error('Expected shell approval_required result.');
		}

		expect(result.approval_request.action_kind).toBe('shell_execution');
		expect(result.approval_request.tool_name).toBe('shell.exec');
		expect(result.approval_event.payload.tool_name).toBe('shell.exec');
	});

	it('uses deterministic defaults for generic approval-required tools without explicit copy', () => {
		const metadata = {
			correlation_id: 'corr_request_approval_generic_1',
			preview_mode: true,
		};
		const result = requestApproval({
			current_state: 'MODEL_THINKING',
			event_context: {
				actor: {
					id: 'assistant_approval_default',
					type: 'assistant',
				},
				metadata,
				parent_event_id: 'event_parent_request_approval_generic_1',
				sequence_no: 5,
				session_id: 'session_request_approval_generic_1',
				source: {
					id: 'request-approval-test',
					kind: 'runtime',
				},
				timestamp: '2026-04-12T09:45:00.000Z',
			},
			requires_reason: true,
			run_id: 'run_request_approval_generic',
			tool_definition: createFakeApprovalRequiredTool(),
			trace_id: 'trace_request_approval_generic',
		});

		expect(result.status).toBe('approval_required');

		if (result.status !== 'approval_required') {
			throw new Error('Expected approval_required result for generic approval tool.');
		}

		expect(result.approval_request).toEqual({
			action_kind: 'tool_execution',
			approval_id: 'run_request_approval_generic:approval:search.grep:5',
			call_id: undefined,
			requested_at: '2026-04-12T09:45:00.000Z',
			requires_reason: true,
			risk_level: 'medium',
			run_id: 'run_request_approval_generic',
			status: 'pending',
			summary: 'Searches the workspace for matching content.',
			target: {
				call_id: undefined,
				kind: 'tool_call',
				label: 'search.grep',
				tool_name: 'search.grep',
			},
			title: 'Approval required for search.grep',
			tool_name: 'search.grep',
			trace_id: 'trace_request_approval_generic',
		});
		expect(result.approval_event).toMatchObject({
			actor: {
				id: 'assistant_approval_default',
				type: 'assistant',
			},
			event_id: 'run_request_approval_generic:approval.requested:5',
			event_type: 'approval.requested',
			metadata,
			parent_event_id: 'event_parent_request_approval_generic_1',
			run_id: 'run_request_approval_generic',
			sequence_no: 5,
			session_id: 'session_request_approval_generic_1',
			source: {
				id: 'request-approval-test',
				kind: 'runtime',
			},
			state_after: 'WAITING_APPROVAL',
			state_before: 'MODEL_THINKING',
			timestamp: '2026-04-12T09:45:00.000Z',
			trace_id: 'trace_request_approval_generic',
		});
		expect(result.approval_event.payload).toEqual({
			action_kind: 'tool_execution',
			approval_id: 'run_request_approval_generic:approval:search.grep:5',
			call_id: undefined,
			summary: 'Searches the workspace for matching content.',
			title: 'Approval required for search.grep',
			tool_name: 'search.grep',
		});
	});

	it('returns an explicit failure for invalid starting state', () => {
		const result = requestApproval({
			call_id: 'call_invalid_approval',
			current_state: 'COMPLETED',
			run_id: 'run_request_approval_invalid',
			tool_definition: fileWriteTool,
			trace_id: 'trace_request_approval_invalid',
		});

		expect(result.status).toBe('failed');

		if (result.status !== 'failed') {
			throw new Error('Expected invalid current state failure.');
		}

		expect(result.failure.code).toBe('INVALID_CURRENT_STATE');
		expect(result.final_state).toBe('FAILED');
		expect(result.state_transitions).toEqual([]);
		expect(result.tool_name).toBe('file.write');
	});
});
