import type { AgentDelegationRequest, AgentDelegationResult } from '@runa/types';
import { describe, expect, it } from 'vitest';

import { type ManagedProcessHandle, RunProcessRegistry } from './process-registry.js';
import { type RunCancellationScope, createRunCancellationScope } from './run-cancellation.js';
import { type ParallelSubAgentJob, runParallelSubAgentDelegations } from './sub-agent-scheduler.js';

function createRequest(id: string): AgentDelegationRequest {
	return {
		depth: 1,
		max_turns: 99,
		parent_run_id: 'parent_run',
		role: 'researcher',
		task: `Research task ${id}`,
		tool_allowlist: ['file.read'],
		trace_id: 'trace_1',
	};
}

function createResult(request: AgentDelegationRequest, summary: string): AgentDelegationResult {
	return {
		evidence: [
			{
				label: 'job',
				value: summary,
			},
		],
		role: request.role,
		status: 'completed',
		summary,
		turns_used: 2,
	};
}

function createJobs(count: number): readonly ParallelSubAgentJob[] {
	return Array.from({ length: count }, (_value, index) => ({
		id: `job_${index + 1}`,
		request: createRequest(String(index + 1)),
	}));
}

function createParentScope(): RunCancellationScope {
	return createRunCancellationScope({
		run_id: 'parent_run',
	});
}

describe('parallel sub-agent scheduler', () => {
	it('limits parallel sub-agent execution to two jobs', async () => {
		const jobs = createJobs(3);
		let activeCount = 0;
		let maxActiveCount = 0;

		const result = await runParallelSubAgentDelegations({
			async delegate(job) {
				activeCount += 1;
				maxActiveCount = Math.max(maxActiveCount, activeCount);
				await new Promise((resolve) => setTimeout(resolve, 5));
				activeCount -= 1;

				return createResult(job.request, job.id);
			},
			jobs,
			max_parallel: 10,
			parent_cancellation_scope: createParentScope(),
		});

		expect(result.max_parallel).toBe(2);
		expect(maxActiveCount).toBeLessThanOrEqual(2);
		expect(result.results).toHaveLength(3);
	});

	it('merges out-of-order completions deterministically by input order', async () => {
		const jobs = createJobs(2);
		const result = await runParallelSubAgentDelegations({
			async delegate(job) {
				if (job.id === 'job_1') {
					await new Promise((resolve) => setTimeout(resolve, 10));
				}

				return createResult(job.request, job.id);
			},
			jobs,
			parent_cancellation_scope: createParentScope(),
		});

		expect(result.results.map((entry) => entry.id)).toEqual(['job_1', 'job_2']);
		expect(result.results.map((entry) => entry.index)).toEqual([0, 1]);
	});

	it('keeps partial failures local to the failed sub-agent', async () => {
		const jobs = createJobs(3);
		const result = await runParallelSubAgentDelegations({
			async delegate(job) {
				if (job.id === 'job_2') {
					throw new Error('reviewer failed');
				}

				return createResult(job.request, job.id);
			},
			jobs,
			parent_cancellation_scope: createParentScope(),
		});

		expect(result.results).toMatchObject([
			{
				id: 'job_1',
				status: 'completed',
			},
			{
				error_message: 'reviewer failed',
				id: 'job_2',
				status: 'failed',
			},
			{
				id: 'job_3',
				status: 'completed',
			},
		]);
	});

	it('fans parent cancellation out to running child scopes and their processes', async () => {
		let childScope: RunCancellationScope | undefined;
		let killed = false;
		const processRegistry = new RunProcessRegistry({
			platform: 'win32',
			process_tree_killer({ handle }) {
				handle.kill('SIGTERM');
			},
		});
		const parentScope = createRunCancellationScope({
			process_registry: processRegistry,
			run_id: 'parent_run',
		});
		const handle: ManagedProcessHandle = {
			pid: 9876,
			kill() {
				killed = true;
				return true;
			},
		};

		const schedule = runParallelSubAgentDelegations({
			async delegate(job, context) {
				childScope = context.cancellation_scope;
				processRegistry.register({
					handle,
					label: 'parallel-sub-agent-process',
					run_id: context.cancellation_scope.run_id,
				});
				await parentScope.cancel({
					actor: 'user',
					reason: 'user cancelled parent during parallel delegation',
				});

				return createResult(job.request, job.id);
			},
			jobs: createJobs(1),
			parent_cancellation_scope: parentScope,
		});

		await schedule;

		expect(parentScope.is_cancelled()).toBe(true);
		expect(childScope?.is_cancelled()).toBe(true);
		expect(killed).toBe(true);
		expect(processRegistry.list(childScope?.run_id ?? '')).toEqual([]);
	});
});
