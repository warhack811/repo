import type { ModelToolCallCandidate, ToolDefinition } from '@runa/types';

import { describe, expect, it } from 'vitest';

import {
	classifyToolEffectClass,
	classifyToolResourceKey,
	planToolExecutionBatches,
} from './tool-scheduler.js';

function createToolDefinition(
	name: ToolDefinition['name'],
	metadataOverrides: Partial<ToolDefinition['metadata']> = {},
): ToolDefinition {
	return {
		description: `${name} scheduler test tool`,
		async execute() {
			throw new Error('Scheduler tests should not execute tools.');
		},
		metadata: {
			capability_class: name.startsWith('desktop.')
				? 'desktop'
				: name === 'web.search'
					? 'search'
					: name === 'shell.exec'
						? 'shell'
						: 'file_system',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
			...metadataOverrides,
		},
		name,
	};
}

function createCandidate(
	toolName: ModelToolCallCandidate['tool_name'],
	callId: string,
	overrides: Partial<{
		readonly effect_class: ReturnType<typeof classifyToolEffectClass>;
		readonly requires_approval: boolean;
		readonly resource_key: ReturnType<typeof classifyToolResourceKey>;
	}> = {},
) {
	const toolDefinition = createToolDefinition(toolName, {
		requires_approval: overrides.requires_approval ?? false,
	});

	return {
		candidate: {
			call_id: callId,
			tool_input: {},
			tool_name: toolName,
		},
		effect_class: overrides.effect_class ?? classifyToolEffectClass(toolDefinition),
		requires_approval: overrides.requires_approval ?? false,
		resource_key: overrides.resource_key ?? classifyToolResourceKey(toolDefinition),
	};
}

describe('tool-scheduler', () => {
	it('classifies built-in style tools conservatively by effect and resource', () => {
		expect(classifyToolEffectClass(createToolDefinition('file.read'))).toBe('read');
		expect(
			classifyToolEffectClass(createToolDefinition('file.write', { side_effect_level: 'write' })),
		).toBe('write');
		expect(
			classifyToolEffectClass(createToolDefinition('shell.exec', { side_effect_level: 'execute' })),
		).toBe('execute');
		expect(
			classifyToolEffectClass(
				createToolDefinition('desktop.click', { capability_class: 'desktop' }),
			),
		).toBe('desktop');

		expect(classifyToolResourceKey(createToolDefinition('file.read'))).toBe('filesystem');
		expect(classifyToolResourceKey(createToolDefinition('search.memory'))).toBe('memory');
		expect(classifyToolResourceKey(createToolDefinition('web.search'))).toBe('network');
		expect(
			classifyToolResourceKey(createToolDefinition('shell.exec', { side_effect_level: 'execute' })),
		).toBe('workspace');
		expect(
			classifyToolResourceKey(
				createToolDefinition('desktop.click', { capability_class: 'desktop' }),
			),
		).toBe('desktop_input');
	});

	it('plans read-only tools on different resources into the same parallel batch', () => {
		const plan = planToolExecutionBatches([
			createCandidate('file.read', 'call_parallel_1'),
			createCandidate('search.memory', 'call_parallel_2'),
			createCandidate('web.search', 'call_parallel_3'),
		]);

		expect(plan.blocked_candidate).toBeUndefined();
		expect(plan.batches).toEqual([
			{
				candidates: [
					expect.objectContaining({
						candidate: expect.objectContaining({ call_id: 'call_parallel_1' }),
					}),
					expect.objectContaining({
						candidate: expect.objectContaining({ call_id: 'call_parallel_2' }),
					}),
					expect.objectContaining({
						candidate: expect.objectContaining({ call_id: 'call_parallel_3' }),
					}),
				],
				execution_mode: 'parallel',
			},
		]);
	});

	it('splits same-resource read tools into deterministic separate batches', () => {
		const plan = planToolExecutionBatches([
			createCandidate('file.read', 'call_fs_1'),
			createCandidate('file.list', 'call_fs_2'),
			createCandidate('web.search', 'call_net_1'),
		]);

		expect(plan.blocked_candidate).toBeUndefined();
		expect(
			plan.batches.map((batch) => ({
				call_ids: batch.candidates.map((entry) => entry.candidate.call_id),
				execution_mode: batch.execution_mode,
			})),
		).toEqual([
			{
				call_ids: ['call_fs_1'],
				execution_mode: 'parallel',
			},
			{
				call_ids: ['call_fs_2', 'call_net_1'],
				execution_mode: 'parallel',
			},
		]);
	});

	it('forces side-effect tools into sequential single-item batches', () => {
		const plan = planToolExecutionBatches([
			createCandidate('file.read', 'call_read_1'),
			createCandidate('file.write', 'call_write_1', {
				effect_class: 'write',
				resource_key: 'filesystem',
			}),
			createCandidate('shell.exec', 'call_exec_1', {
				effect_class: 'execute',
				resource_key: 'workspace',
			}),
		]);

		expect(
			plan.batches.map((batch) => ({
				call_ids: batch.candidates.map((entry) => entry.candidate.call_id),
				execution_mode: batch.execution_mode,
			})),
		).toEqual([
			{
				call_ids: ['call_read_1'],
				execution_mode: 'parallel',
			},
			{
				call_ids: ['call_write_1'],
				execution_mode: 'sequential',
			},
			{
				call_ids: ['call_exec_1'],
				execution_mode: 'sequential',
			},
		]);
	});

	it('stops planning before the first approval-required candidate', () => {
		const plan = planToolExecutionBatches([
			createCandidate('file.read', 'call_allowed_1'),
			createCandidate('file.write', 'call_blocked_approval', {
				effect_class: 'write',
				requires_approval: true,
				resource_key: 'filesystem',
			}),
			createCandidate('web.search', 'call_after_blocked'),
		]);

		expect(
			plan.batches.map((batch) => batch.candidates.map((entry) => entry.candidate.call_id)),
		).toEqual([['call_allowed_1']]);
		expect(plan.blocked_candidate).toMatchObject({
			candidate: {
				call_id: 'call_blocked_approval',
			},
			requires_approval: true,
		});
	});
});
