import type { ApprovalRequest, ApprovalResolution, ToolResult } from '@runa/types';

import type { ApprovalRecordWriter } from './approval-store.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	ApprovalStoreConfigurationError,
	ApprovalStoreReadError,
	ApprovalStoreWriteError,
	approvalPersistenceScopeFromAuthContext,
	getPendingApprovalById,
	persistApprovalRequest,
	persistApprovalResolution,
} from './approval-store.js';

function clearDatabaseUrl(): void {
	const environment = process.env as NodeJS.ProcessEnv & {
		ANTHROPIC_API_KEY?: string;
		DATABASE_URL?: string;
		GROQ_API_KEY?: string;
	};
	Reflect.deleteProperty(environment, 'ANTHROPIC_API_KEY');
	Reflect.deleteProperty(environment, 'DATABASE_URL');
	Reflect.deleteProperty(environment, 'GROQ_API_KEY');
}

function createApprovalRequest(): ApprovalRequest {
	return {
		action_kind: 'shell_execution',
		approval_id: 'approval_store_1',
		call_id: 'call_approval_store_1',
		requested_at: '2026-04-11T10:00:00.000Z',
		requires_reason: true,
		risk_level: 'high',
		run_id: 'run_approval_store_1',
		status: 'pending' as const,
		summary: 'Run shell command in workspace root.',
		target: {
			call_id: 'call_approval_store_1',
			kind: 'tool_call' as const,
			label: 'shell.exec',
			tool_name: 'shell.exec' as const,
		},
		title: 'Approve shell command',
		tool_name: 'shell.exec',
		trace_id: 'trace_approval_store_1',
	};
}

function createApprovalResolution(): ApprovalResolution {
	return {
		approval_id: 'approval_store_1',
		decision: {
			approval_id: 'approval_store_1',
			decision: 'approved' as const,
			note: 'Approved by reviewer',
			resolved_at: '2026-04-11T10:05:00.000Z',
		},
		final_status: 'approved' as const,
	};
}

function createPendingToolCall() {
	return {
		tool_input: {
			command: 'npm test',
		},
		working_directory: 'd:\\ai\\Runa',
	} as const;
}

function createToolResult(): ToolResult {
	return {
		call_id: 'call_approval_store_1',
		output: {
			stdout: 'ok',
		},
		status: 'success',
		tool_name: 'shell.exec',
	};
}

function createAutoContinueContext() {
	return {
		payload: {
			include_presentation_blocks: true,
			provider: 'groq' as const,
			provider_config: {
				apiKey: 'groq-key',
				defaultMaxOutputTokens: 64,
				defaultModel: 'llama-3.3-70b-versatile',
			},
			request: {
				max_output_tokens: 64,
				messages: [{ content: 'Continue after the tool result', role: 'user' as const }],
				model: 'llama-3.3-70b-versatile',
			},
			run_id: 'run_approval_store_1',
			trace_id: 'trace_approval_store_1',
		},
		tool_result: createToolResult(),
		turn_count: 2,
		working_directory: 'd:\\ai\\Runa',
	} as const;
}

function createSanitizedAutoContinueContext() {
	return {
		...createAutoContinueContext(),
		payload: {
			...createAutoContinueContext().payload,
			provider_config: {
				apiKey: '',
			},
		},
	} as const;
}

function createContinuationContextWithProviderDefaultsOnly() {
	return {
		...createAutoContinueContext(),
		payload: {
			...createAutoContinueContext().payload,
			provider: 'claude' as const,
			provider_config: {
				apiKey: 'claude-key',
				defaultMaxOutputTokens: 96,
				defaultModel: 'claude-3-7-sonnet',
			},
			request: {
				messages: [{ content: 'Continue after the tool result', role: 'user' as const }],
			},
		},
	} as const;
}

afterEach(() => {
	clearDatabaseUrl();
});

describe('approval-store', () => {
	it('throws a typed configuration error when DATABASE_URL is missing', async () => {
		await expect(
			persistApprovalRequest({
				approval_request: createApprovalRequest(),
			}),
		).rejects.toThrowError(ApprovalStoreConfigurationError);
	});

	it('maps approval request writes to deterministic upsert records', async () => {
		const environment = process.env as NodeJS.ProcessEnv & {
			GROQ_API_KEY?: string;
		};
		environment.GROQ_API_KEY = 'env-groq-key';
		const upsertApproval: ApprovalRecordWriter['upsertApproval'] = vi
			.fn()
			.mockResolvedValue(undefined);

		await persistApprovalRequest(
			{
				approval_request: createApprovalRequest(),
				auto_continue_context: createAutoContinueContext(),
				next_sequence_no: 12,
				pending_tool_call: createPendingToolCall(),
			},
			{
				writer: {
					async getPendingApprovalById() {
						return null;
					},
					upsertApproval,
				},
			},
		);

		expect(upsertApproval).toHaveBeenCalledWith({
			action_kind: 'shell_execution',
			approval_id: 'approval_store_1',
			call_id: 'call_approval_store_1',
			created_at: '2026-04-11T10:00:00.000Z',
			continuation_context: createSanitizedAutoContinueContext(),
			decision: null,
			next_sequence_no: 12,
			note: null,
			requested_at: '2026-04-11T10:00:00.000Z',
			requires_reason: true,
			resolved_at: null,
			risk_level: 'high',
			run_id: 'run_approval_store_1',
			session_id: null,
			status: 'pending',
			summary: 'Run shell command in workspace root.',
			target_kind: 'tool_call',
			target_label: 'shell.exec',
			tenant_id: null,
			title: 'Approve shell command',
			tool_input: {
				command: 'npm test',
			},
			tool_name: 'shell.exec',
			trace_id: 'trace_approval_store_1',
			updated_at: '2026-04-11T10:00:00.000Z',
			user_id: null,
			workspace_id: null,
			working_directory: 'd:\\ai\\Runa',
		});
	});

	it('maps approval resolution writes to deterministic upsert records', async () => {
		const environment = process.env as NodeJS.ProcessEnv & {
			GROQ_API_KEY?: string;
		};
		environment.GROQ_API_KEY = 'env-groq-key';
		const upsertApproval: ApprovalRecordWriter['upsertApproval'] = vi
			.fn()
			.mockResolvedValue(undefined);

		await persistApprovalResolution(
			{
				approval_request: createApprovalRequest(),
				approval_resolution: createApprovalResolution(),
				auto_continue_context: createAutoContinueContext(),
				next_sequence_no: 12,
				pending_tool_call: createPendingToolCall(),
			},
			{
				writer: {
					async getPendingApprovalById() {
						return null;
					},
					upsertApproval,
				},
			},
		);

		expect(upsertApproval).toHaveBeenCalledWith({
			action_kind: 'shell_execution',
			approval_id: 'approval_store_1',
			call_id: 'call_approval_store_1',
			created_at: '2026-04-11T10:00:00.000Z',
			continuation_context: createSanitizedAutoContinueContext(),
			decision: 'approved',
			next_sequence_no: 12,
			note: 'Approved by reviewer',
			requested_at: '2026-04-11T10:00:00.000Z',
			requires_reason: true,
			resolved_at: '2026-04-11T10:05:00.000Z',
			risk_level: 'high',
			run_id: 'run_approval_store_1',
			session_id: null,
			status: 'approved',
			summary: 'Run shell command in workspace root.',
			target_kind: 'tool_call',
			target_label: 'shell.exec',
			tenant_id: null,
			title: 'Approve shell command',
			tool_input: {
				command: 'npm test',
			},
			tool_name: 'shell.exec',
			trace_id: 'trace_approval_store_1',
			updated_at: '2026-04-11T10:05:00.000Z',
			user_id: null,
			workspace_id: null,
			working_directory: 'd:\\ai\\Runa',
		});
	});

	it('hydrates pending approval lookup results into runtime-friendly entries', async () => {
		const environment = process.env as NodeJS.ProcessEnv & {
			GROQ_API_KEY?: string;
		};
		environment.GROQ_API_KEY = 'env-groq-key';
		const entry = await getPendingApprovalById('approval_store_1', {
			writer: {
				async getPendingApprovalById() {
					return {
						action_kind: 'shell_execution',
						approval_id: 'approval_store_1',
						call_id: 'call_approval_store_1',
						created_at: '2026-04-11T10:00:00.000Z',
						continuation_context: createAutoContinueContext(),
						decision: null,
						next_sequence_no: 12,
						note: null,
						requested_at: '2026-04-11T10:00:00.000Z',
						requires_reason: true,
						resolved_at: null,
						risk_level: 'high',
						run_id: 'run_approval_store_1',
						session_id: null,
						status: 'pending',
						summary: 'Run shell command in workspace root.',
						target_kind: 'tool_call',
						target_label: 'shell.exec',
						title: 'Approve shell command',
						tool_input: {
							command: 'npm test',
						},
						tool_name: 'shell.exec',
						tenant_id: null,
						trace_id: 'trace_approval_store_1',
						updated_at: '2026-04-11T10:00:00.000Z',
						user_id: null,
						workspace_id: null,
						working_directory: 'd:\\ai\\Runa',
					};
				},
				async upsertApproval() {},
			},
		});

		expect(entry).toEqual({
			approval_request: createApprovalRequest(),
			auto_continue_context: createSanitizedAutoContinueContext(),
			next_sequence_no: 12,
			pending_tool_call: createPendingToolCall(),
		});
	});

	it('preserves request-only provider secrets when no environment fallback exists', async () => {
		const upsertApproval: ApprovalRecordWriter['upsertApproval'] = vi
			.fn()
			.mockResolvedValue(undefined);

		await persistApprovalRequest(
			{
				approval_request: createApprovalRequest(),
				auto_continue_context: createAutoContinueContext(),
			},
			{
				writer: {
					async getPendingApprovalById() {
						return null;
					},
					upsertApproval,
				},
			},
		);

		expect(upsertApproval).toHaveBeenCalledWith(
			expect.objectContaining({
				continuation_context: {
					...createAutoContinueContext(),
					payload: {
						...createAutoContinueContext().payload,
						provider_config: {
							apiKey: 'groq-key',
						},
					},
				},
			}),
		);
	});

	it('preserves provider defaults only when the continuation request still needs them', async () => {
		const upsertApproval: ApprovalRecordWriter['upsertApproval'] = vi
			.fn()
			.mockResolvedValue(undefined);

		await persistApprovalRequest(
			{
				approval_request: createApprovalRequest(),
				auto_continue_context: createContinuationContextWithProviderDefaultsOnly(),
			},
			{
				writer: {
					async getPendingApprovalById() {
						return null;
					},
					upsertApproval,
				},
			},
		);

		expect(upsertApproval).toHaveBeenCalledWith(
			expect.objectContaining({
				continuation_context: createContinuationContextWithProviderDefaultsOnly(),
			}),
		);
	});

	it('wraps reader failures in a typed read error', async () => {
		await expect(
			getPendingApprovalById('approval_store_read_failure', {
				writer: {
					async getPendingApprovalById() {
						throw new Error('read failed');
					},
					async upsertApproval() {},
				},
			}),
		).rejects.toThrowError(ApprovalStoreReadError);
	});

	it('wraps writer failures in a typed write error', async () => {
		await expect(
			persistApprovalResolution(
				{
					approval_request: createApprovalRequest(),
					approval_resolution: createApprovalResolution(),
				},
				{
					writer: {
						async getPendingApprovalById() {
							return null;
						},
						async upsertApproval() {
							throw new Error('write failed');
						},
					},
				},
			),
		).rejects.toThrowError(ApprovalStoreWriteError);
	});

	it('derives approval persistence scope from authenticated auth context', () => {
		expect(
			approvalPersistenceScopeFromAuthContext({
				principal: {
					email: 'user@example.com',
					kind: 'authenticated',
					provider: 'supabase',
					role: 'authenticated',
					scope: {
						tenant_id: 'tenant_1',
						workspace_id: 'workspace_1',
					},
					session_id: 'session_1',
					user_id: 'user_1',
				},
				session: {
					identity_provider: 'email_password',
					provider: 'supabase',
					scope: {
						tenant_id: 'tenant_1',
						workspace_id: 'workspace_1',
					},
					session_id: 'session_1',
					user_id: 'user_1',
				},
				transport: 'websocket',
			}),
		).toEqual({
			session_id: 'session_1',
			tenant_id: 'tenant_1',
			user_id: 'user_1',
			workspace_id: 'workspace_1',
		});
	});
});
