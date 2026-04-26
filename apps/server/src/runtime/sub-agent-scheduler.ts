import type { AgentDelegationRequest, AgentDelegationResult } from '@runa/types';

import type { RunCancellationScope } from './run-cancellation.js';
import { DEFAULT_SUB_AGENT_MAX_TURNS } from './sub-agent-runner.js';

export const DEFAULT_PARALLEL_SUB_AGENT_LIMIT = 2;

export interface ParallelSubAgentJob {
	readonly id: string;
	readonly request: AgentDelegationRequest;
}

export interface ParallelSubAgentHandlerContext {
	readonly cancellation_scope: RunCancellationScope;
	readonly job_id: string;
}

export type ParallelSubAgentHandler = (
	job: ParallelSubAgentJob,
	context: ParallelSubAgentHandlerContext,
) => Promise<AgentDelegationResult>;

export interface ParallelSubAgentCompletedResult {
	readonly id: string;
	readonly index: number;
	readonly result: AgentDelegationResult;
	readonly status: 'completed';
}

export interface ParallelSubAgentFailedResult {
	readonly error_message: string;
	readonly id: string;
	readonly index: number;
	readonly role: AgentDelegationRequest['role'];
	readonly status: 'failed';
}

export type ParallelSubAgentResult = ParallelSubAgentCompletedResult | ParallelSubAgentFailedResult;

export interface ParallelSubAgentScheduleResult {
	readonly max_parallel: number;
	readonly results: readonly ParallelSubAgentResult[];
}

export interface RunParallelSubAgentDelegationsInput {
	readonly delegate: ParallelSubAgentHandler;
	readonly jobs: readonly ParallelSubAgentJob[];
	readonly max_parallel?: number;
	readonly parent_cancellation_scope: RunCancellationScope;
}

function normalizeParallelLimit(value: number | undefined): number {
	if (!Number.isFinite(value) || value === undefined || value < 1) {
		return DEFAULT_PARALLEL_SUB_AGENT_LIMIT;
	}

	return Math.min(DEFAULT_PARALLEL_SUB_AGENT_LIMIT, Math.trunc(value));
}

function normalizeRequestBudget(request: AgentDelegationRequest): AgentDelegationRequest {
	return {
		...request,
		max_turns: Math.min(request.max_turns, DEFAULT_SUB_AGENT_MAX_TURNS),
	};
}

function createFailureResult(
	job: ParallelSubAgentJob,
	index: number,
	error: unknown,
): ParallelSubAgentFailedResult {
	return {
		error_message: error instanceof Error ? error.message : 'Unknown sub-agent failure.',
		id: job.id,
		index,
		role: job.request.role,
		status: 'failed',
	};
}

export async function runParallelSubAgentDelegations(
	input: RunParallelSubAgentDelegationsInput,
): Promise<ParallelSubAgentScheduleResult> {
	const maxParallel = normalizeParallelLimit(input.max_parallel);
	const results = new Map<number, ParallelSubAgentResult>();
	let nextIndex = 0;

	async function runWorker(): Promise<void> {
		while (nextIndex < input.jobs.length && !input.parent_cancellation_scope.is_cancelled()) {
			const index = nextIndex;
			nextIndex += 1;

			const job = input.jobs[index];

			if (job === undefined) {
				continue;
			}

			const childScope = input.parent_cancellation_scope.create_child_scope(
				`${input.parent_cancellation_scope.run_id}:${job.id}`,
			);

			try {
				const result = await input.delegate(
					{
						...job,
						request: normalizeRequestBudget(job.request),
					},
					{
						cancellation_scope: childScope,
						job_id: job.id,
					},
				);

				results.set(index, {
					id: job.id,
					index,
					result,
					status: 'completed',
				});
			} catch (error: unknown) {
				results.set(index, createFailureResult(job, index, error));
			}
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(maxParallel, input.jobs.length) }, () => runWorker()),
	);

	return {
		max_parallel: maxParallel,
		results: Array.from({ length: input.jobs.length }, (_value, index) =>
			results.get(index),
		).filter((result): result is ParallelSubAgentResult => result !== undefined),
	};
}
