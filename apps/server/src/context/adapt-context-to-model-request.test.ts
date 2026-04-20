import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { ModelRequest } from '@runa/types';
import { describe, expect, it } from 'vitest';

import { adaptContextToModelRequest } from './adapt-context-to-model-request.js';
import { composeContext } from './compose-context.js';
import { composeMemoryContext } from './compose-memory-context.js';
import { composeWorkspaceContext } from './compose-workspace-context.js';

describe('adaptContextToModelRequest', () => {
	it('binds composed context to the model request in deterministic layer order', () => {
		const composedContext = composeContext({
			current_state: 'MODEL_THINKING',
			run_id: 'run_adapter_order',
			trace_id: 'trace_adapter_order',
			working_directory: 'D:/ai/Runa',
		});

		const request = adaptContextToModelRequest({
			composed_context: composedContext,
			messages: [
				{
					content: 'Existing assistant summary.',
					role: 'assistant',
				},
			],
			model: 'groq/test-model',
			run_id: 'run_adapter_order',
			trace_id: 'trace_adapter_order',
			user_turn: 'Read the repository status.',
		});

		expect(request.compiled_context.layers.map((layer) => layer.name)).toEqual([
			'core_rules',
			'run_layer',
		]);
		expect(request.compiled_context.layers[0]).toMatchObject({
			kind: 'instruction',
			name: 'core_rules',
		});
		expect(request.compiled_context.layers[1]).toMatchObject({
			kind: 'runtime',
			name: 'run_layer',
		});
		expect(request.model).toBe('groq/test-model');
	});

	it('includes memory_layer in compiled_context without folding it into the user turn', async () => {
		const memoryContext = await composeMemoryContext({
			memory_store: {
				async listActiveMemories() {
					return [
						{
							content: 'User prefers concise blocker-first code reviews.',
							created_at: '2026-04-11T16:00:00.000Z',
							memory_id: 'memory_adapter_memory_1',
							scope: 'user',
							scope_id: 'user_1',
							source_kind: 'user_explicit',
							source_run_id: 'run_adapter_memory',
							source_trace_id: 'trace_adapter_memory',
							status: 'active',
							summary: 'User prefers concise blocker-first reviews.',
							updated_at: '2026-04-11T16:05:00.000Z',
						},
					];
				},
			},
			scope: 'user',
			scope_id: 'user_1',
		});

		if (memoryContext.status !== 'memory_layer_created') {
			throw new Error('Expected memory_layer_created result.');
		}

		const composedContext = composeContext({
			current_state: 'MODEL_THINKING',
			memory_layer: memoryContext.memory_layer,
			run_id: 'run_adapter_memory',
			trace_id: 'trace_adapter_memory',
		});

		const request = adaptContextToModelRequest({
			composed_context: composedContext,
			run_id: 'run_adapter_memory',
			trace_id: 'trace_adapter_memory',
			user_turn: 'Continue using the remembered preferences.',
		});

		expect(request.compiled_context.layers.map((layer) => layer.name)).toEqual([
			'core_rules',
			'run_layer',
			'memory_layer',
		]);
		expect(request.compiled_context.layers[2]).toMatchObject({
			content: {
				items: [
					{
						content: 'User prefers concise blocker-first code reviews.',
						memory_kind: 'general',
						source_kind: 'user_explicit',
						summary: 'User prefers concise blocker-first reviews.',
					},
				],
				layer_type: 'memory_layer',
				title: 'Relevant Memory',
			},
			kind: 'memory',
			name: 'memory_layer',
		});
		expect(request.messages).toEqual([
			{
				content: 'Continue using the remembered preferences.',
				role: 'user',
			},
		]);
	});

	it('includes workspace_layer in compiled_context without folding it into the user turn', async () => {
		const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), 'runa-adapt-context-'));

		try {
			await writeFile(
				path.join(workspaceDirectory, 'package.json'),
				JSON.stringify(
					{
						dependencies: {
							react: '^19.0.0',
							vite: '^7.0.0',
						},
						name: 'runa-adapter-workspace',
						scripts: {
							dev: 'vite',
						},
					},
					null,
					2,
				),
			);
			await writeFile(
				path.join(workspaceDirectory, 'README.md'),
				[
					'# Adapter Workspace',
					'',
					'A workspace that feeds project context into the model request.',
				].join('\n'),
			);
			await mkdir(path.join(workspaceDirectory, 'src'));

			const workspaceContext = await composeWorkspaceContext({
				working_directory: workspaceDirectory,
			});

			if (workspaceContext.status !== 'workspace_layer_created') {
				throw new Error('Expected workspace_layer_created result.');
			}

			const composedContext = composeContext({
				current_state: 'MODEL_THINKING',
				run_id: 'run_adapter_workspace',
				trace_id: 'trace_adapter_workspace',
				workspace_layer: workspaceContext.workspace_layer,
			});

			const request = adaptContextToModelRequest({
				composed_context: composedContext,
				run_id: 'run_adapter_workspace',
				trace_id: 'trace_adapter_workspace',
				user_turn: 'Use the workspace context to answer.',
			});

			expect(request.compiled_context.layers.map((layer) => layer.name)).toEqual([
				'core_rules',
				'run_layer',
				'workspace_layer',
			]);
			expect(request.compiled_context.layers[2]).toMatchObject({
				content: {
					dependency_hints: ['react', 'vite'],
					layer_type: 'workspace_layer',
					project_name: 'runa-adapter-workspace',
					project_type_hints: ['react', 'vite'],
					scripts: ['dev'],
					title: 'Adapter Workspace',
					top_level_signals: ['src'],
				},
				kind: 'workspace',
				name: 'workspace_layer',
			});
			expect(request.messages).toEqual([
				{
					content: 'Use the workspace context to answer.',
					role: 'user',
				},
			]);
		} finally {
			await rm(workspaceDirectory, {
				force: true,
				recursive: true,
			});
		}
	});

	it('keeps the user turn separate from the compiled context artifact', () => {
		const composedContext = composeContext({
			current_state: 'MODEL_THINKING',
			run_id: 'run_adapter_user',
			trace_id: 'trace_adapter_user',
		});

		const request = adaptContextToModelRequest({
			composed_context: composedContext,
			run_id: 'run_adapter_user',
			trace_id: 'trace_adapter_user',
			user_turn: 'Summarize the latest tool result.',
		});

		expect(request.messages).toEqual([
			{
				content: 'Summarize the latest tool result.',
				role: 'user',
			},
		]);
		expect(request.compiled_context.layers[1]).toMatchObject({
			content: {
				current_state: 'MODEL_THINKING',
				run_id: 'run_adapter_user',
				trace_id: 'trace_adapter_user',
			},
			name: 'run_layer',
		});
	});

	it('carries the latest tool result summary through the run layer', () => {
		const composedContext = composeContext({
			current_state: 'TOOL_RESULT_INGESTING',
			latest_tool_result: {
				call_id: 'call_adapter_tool',
				output: {
					entries: 3,
				},
				result_status: 'success',
				tool_name: 'file.list',
			},
			run_id: 'run_adapter_tool',
			trace_id: 'trace_adapter_tool',
		});

		const request = adaptContextToModelRequest({
			composed_context: composedContext,
			max_output_tokens: 512,
			run_id: 'run_adapter_tool',
			trace_id: 'trace_adapter_tool',
			user_turn: 'Use the last tool result to continue.',
		});

		expect(request.compiled_context.layers[1]).toMatchObject({
			content: {
				current_state: 'TOOL_RESULT_INGESTING',
				latest_tool_result: {
					call_id: 'call_adapter_tool',
					output_kind: 'object',
					result_status: 'success',
					tool_name: 'file.list',
				},
			},
			name: 'run_layer',
		});
		expect(request.max_output_tokens).toBe(512);
	});

	it('returns the same model request artifact for the same input', () => {
		const composedContext = composeContext({
			current_state: 'TOOL_RESULT_INGESTING',
			latest_tool_result: {
				call_id: 'call_adapter_repeat',
				error_code: 'NOT_FOUND',
				error_message: 'missing file',
				result_status: 'error',
				tool_name: 'file.read',
			},
			run_id: 'run_adapter_repeat',
			trace_id: 'trace_adapter_repeat',
			working_directory: 'D:/ai/Runa',
		});

		const input = {
			composed_context: composedContext,
			metadata: {
				source: 'adapter-test',
			},
			model: 'claude/test-model',
			run_id: 'run_adapter_repeat',
			temperature: 0.1,
			trace_id: 'trace_adapter_repeat',
			user_turn: 'Continue with the error context.',
		} satisfies Parameters<typeof adaptContextToModelRequest>[0];

		const first = adaptContextToModelRequest(input);
		const second = adaptContextToModelRequest(input);

		expect(first).toEqual(second);
	});

	it('remains compatible with the ModelRequest surface', () => {
		const composedContext = composeContext({
			current_state: 'MODEL_THINKING',
			run_id: 'run_adapter_shape',
			trace_id: 'trace_adapter_shape',
		});

		const request: ModelRequest = adaptContextToModelRequest({
			composed_context: composedContext,
			run_id: 'run_adapter_shape',
			trace_id: 'trace_adapter_shape',
			user_turn: 'Provide the next step.',
		});

		expect(request).toMatchObject({
			messages: [
				{
					content: 'Provide the next step.',
					role: 'user',
				},
			],
			run_id: 'run_adapter_shape',
			trace_id: 'trace_adapter_shape',
		});
		expect(request.compiled_context).toBeDefined();
	});
});
