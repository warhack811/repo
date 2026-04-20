import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { composeContext } from './compose-context.js';
import { composeMemoryContext } from './compose-memory-context.js';
import { composeWorkspaceContext } from './compose-workspace-context.js';

describe('composeContext', () => {
	it('appends workspace_layer after run_layer when workspace context is provided', async () => {
		const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), 'runa-compose-context-'));

		try {
			await writeFile(
				path.join(workspaceDirectory, 'package.json'),
				JSON.stringify(
					{
						dependencies: {
							fastify: '^5.0.0',
						},
						name: 'runa-context',
						scripts: {
							dev: 'pnpm dev',
						},
						version: '1.0.0',
					},
					null,
					2,
				),
			);
			await writeFile(
				path.join(workspaceDirectory, 'README.md'),
				['# Runa Context', '', 'A workspace focused on deterministic context composition.'].join(
					'\n',
				),
			);
			await mkdir(path.join(workspaceDirectory, 'apps'));

			const workspaceContext = await composeWorkspaceContext({
				working_directory: workspaceDirectory,
			});

			if (workspaceContext.status !== 'workspace_layer_created') {
				throw new Error('Expected workspace_layer_created result.');
			}

			const result = composeContext({
				current_state: 'MODEL_THINKING',
				run_id: 'run_context_workspace',
				trace_id: 'trace_context_workspace',
				workspace_layer: workspaceContext.workspace_layer,
			});

			expect(result.layers.map((layer) => layer.name)).toEqual([
				'core_rules',
				'run_layer',
				'workspace_layer',
			]);
			expect(result.layers[2]).toMatchObject({
				content: {
					layer_type: 'workspace_layer',
					project_name: 'runa-context',
					project_type_hints: ['fastify-server'],
					scripts: ['dev'],
					title: 'Runa Context',
					top_level_signals: ['apps'],
				},
				kind: 'workspace',
				name: 'workspace_layer',
			});
		} finally {
			await rm(workspaceDirectory, {
				force: true,
				recursive: true,
			});
		}
	});

	it('produces core_rules and run_layer in deterministic order', () => {
		const result = composeContext({
			current_state: 'MODEL_THINKING',
			run_id: 'run_context_order',
			trace_id: 'trace_context_order',
		});

		expect(result.layers.map((layer) => layer.name)).toEqual(['core_rules', 'run_layer']);
		expect(result.layers[0]).toMatchObject({
			kind: 'instruction',
			name: 'core_rules',
		});
		expect(result.layers[1]).toMatchObject({
			kind: 'runtime',
			name: 'run_layer',
		});
	});

	it('appends memory_layer after workspace_layer when both contexts are provided', async () => {
		const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), 'runa-compose-context-'));

		try {
			await writeFile(
				path.join(workspaceDirectory, 'package.json'),
				JSON.stringify(
					{
						name: 'runa-context-memory',
						scripts: {
							dev: 'pnpm dev',
						},
						workspaces: ['apps/*', 'packages/*'],
					},
					null,
					2,
				),
			);
			await mkdir(path.join(workspaceDirectory, 'apps'));
			await mkdir(path.join(workspaceDirectory, 'packages'));

			const memoryContext = await composeMemoryContext({
				memory_store: {
					async listActiveMemories() {
						return [
							{
								content: 'Use pnpm for package management.',
								created_at: '2026-04-11T16:00:00.000Z',
								memory_id: 'memory_context_compose_1',
								scope: 'workspace',
								scope_id: 'workspace_1',
								source_kind: 'tool_result',
								source_run_id: 'run_context_memory',
								source_trace_id: 'trace_context_memory',
								status: 'active',
								summary: 'Workspace uses pnpm.',
								updated_at: '2026-04-11T16:10:00.000Z',
							},
						];
					},
				},
				scope: 'workspace',
				scope_id: 'workspace_1',
			});
			const workspaceContext = await composeWorkspaceContext({
				working_directory: workspaceDirectory,
			});

			if (memoryContext.status !== 'memory_layer_created') {
				throw new Error('Expected memory_layer_created result.');
			}

			if (workspaceContext.status !== 'workspace_layer_created') {
				throw new Error('Expected workspace_layer_created result.');
			}

			const result = composeContext({
				current_state: 'MODEL_THINKING',
				memory_layer: memoryContext.memory_layer,
				run_id: 'run_context_memory',
				trace_id: 'trace_context_memory',
				workspace_layer: workspaceContext.workspace_layer,
			});

			expect(result.layers.map((layer) => layer.name)).toEqual([
				'core_rules',
				'run_layer',
				'workspace_layer',
				'memory_layer',
			]);
			expect(result.layers[2]).toMatchObject({
				content: {
					layer_type: 'workspace_layer',
					project_name: 'runa-context-memory',
					project_type_hints: ['monorepo'],
					scripts: ['dev'],
					top_level_signals: ['apps', 'packages'],
				},
				kind: 'workspace',
				name: 'workspace_layer',
			});
			expect(result.layers[3]).toMatchObject({
				content: {
					items: [
						{
							content: 'Use pnpm for package management.',
							memory_kind: 'general',
							source_kind: 'tool_result',
							summary: 'Workspace uses pnpm.',
						},
					],
					layer_type: 'memory_layer',
					title: 'Relevant Memory',
				},
				kind: 'memory',
				name: 'memory_layer',
			});
		} finally {
			await rm(workspaceDirectory, {
				force: true,
				recursive: true,
			});
		}
	});

	it('projects runtime state and run identifiers into the run layer', () => {
		const result = composeContext({
			current_state: 'TOOL_RESULT_INGESTING',
			run_id: 'run_context_projection',
			trace_id: 'trace_context_projection',
			working_directory: 'D:/ai/Runa',
		});

		const runLayer = result.layers[1];

		if (!runLayer) {
			throw new Error('Expected run_layer to be present.');
		}

		expect(runLayer.name).toBe('run_layer');
		expect(runLayer.content).toMatchObject({
			current_state: 'TOOL_RESULT_INGESTING',
			run_id: 'run_context_projection',
			trace_id: 'trace_context_projection',
			working_directory: 'D:/ai/Runa',
		});
	});

	it('includes the latest ingested tool result in a narrow deterministic summary', () => {
		const result = composeContext({
			current_state: 'TOOL_RESULT_INGESTING',
			latest_tool_result: {
				call_id: 'call_context_tool',
				output: {
					path: 'README.md',
				},
				result_status: 'success',
				tool_name: 'file.read',
			},
			run_id: 'run_context_tool',
			trace_id: 'trace_context_tool',
		});

		expect(result.layers[1]).toMatchObject({
			content: {
				latest_tool_result: {
					artifact_attached: false,
					call_id: 'call_context_tool',
					output_kind: 'object',
					result_status: 'success',
					tool_name: 'file.read',
				},
			},
			name: 'run_layer',
		});
	});

	it('returns the same composed context for the same input', () => {
		const input = {
			current_state: 'MODEL_THINKING' as const,
			latest_tool_result: {
				call_id: 'call_context_repeat',
				error_code: 'NOT_FOUND' as const,
				error_message: 'missing file',
				result_status: 'error' as const,
				tool_name: 'file.read' as const,
			},
			run_id: 'run_context_repeat',
			trace_id: 'trace_context_repeat',
			working_directory: 'D:/ai/Runa',
		};

		const first = composeContext(input);
		const second = composeContext(input);

		expect(first).toEqual(second);
	});
});
