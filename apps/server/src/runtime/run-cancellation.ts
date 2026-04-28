import type { ToolExecutionSignal } from '@runa/types';

import type { AgentLoopCancellationSignal } from './agent-loop.js';
import { type ProcessCleanupResult, RunProcessRegistry } from './process-registry.js';

export interface RunCancellationRequest {
	readonly actor?: 'system' | 'user';
	readonly reason?: string;
}

export interface RunCancellationCleanupResult {
	readonly child_results: readonly RunCancellationCleanupResult[];
	readonly process_cleanup: ProcessCleanupResult;
	readonly run_id: string;
}

export interface RunCancellationScopeOptions {
	readonly abort_controller?: AbortController;
	readonly actor?: 'system' | 'user';
	readonly process_registry?: RunProcessRegistry;
	readonly run_id: string;
}

export interface RunScopedCancellationSignal extends AgentLoopCancellationSignal {
	readonly abort_signal: AbortSignal;
	readonly tool_signal: ToolExecutionSignal;
}

function toToolExecutionSignal(signal: AbortSignal): ToolExecutionSignal {
	return {
		addEventListener(type, listener, options) {
			signal.addEventListener(type, listener, options);
		},
		get aborted() {
			return signal.aborted;
		},
		get reason() {
			return signal.reason;
		},
		removeEventListener(type, listener) {
			signal.removeEventListener(type, listener);
		},
	};
}

function toAbortReason(request: RunCancellationRequest): Error {
	return new Error(request.reason ?? 'Run cancellation requested.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isToolExecutionSignal(value: unknown): value is ToolExecutionSignal {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as { readonly aborted?: unknown };

	return typeof candidate.aborted === 'boolean';
}

export function getToolExecutionSignalFromCancellation(
	signal: AgentLoopCancellationSignal | undefined,
): ToolExecutionSignal | undefined {
	if (!isRecord(signal)) {
		return undefined;
	}

	const candidate = signal.tool_signal;

	return isToolExecutionSignal(candidate) ? candidate : undefined;
}

export class RunCancellationScope {
	readonly #abortController: AbortController;
	readonly #children = new Set<RunCancellationScope>();
	readonly #processRegistry: RunProcessRegistry;
	#actor: 'system' | 'user' | undefined;

	readonly run_id: string;
	readonly signal: RunScopedCancellationSignal;
	readonly tool_signal: ToolExecutionSignal;

	constructor(options: RunCancellationScopeOptions) {
		this.#abortController = options.abort_controller ?? new AbortController();
		this.#actor = options.actor;
		this.#processRegistry = options.process_registry ?? new RunProcessRegistry();
		this.run_id = options.run_id;
		this.tool_signal = toToolExecutionSignal(this.#abortController.signal);
		const abortSignal = this.#abortController.signal;
		const readActor = () => this.#actor;
		this.signal = {
			get abort_signal() {
				return abortSignal;
			},
			get actor() {
				return readActor();
			},
			is_cancelled: () => this.is_cancelled(),
			tool_signal: this.tool_signal,
		};
	}

	get process_registry(): RunProcessRegistry {
		return this.#processRegistry;
	}

	create_child_scope(runId: string): RunCancellationScope {
		const childScope = new RunCancellationScope({
			process_registry: this.#processRegistry,
			run_id: runId,
		});

		this.#children.add(childScope);

		return childScope;
	}

	is_cancelled(): boolean {
		return this.#abortController.signal.aborted;
	}

	async cancel(request: RunCancellationRequest = {}): Promise<RunCancellationCleanupResult> {
		this.#actor = request.actor ?? this.#actor;

		if (!this.#abortController.signal.aborted) {
			this.#abortController.abort(toAbortReason(request));
		}

		const childResults: RunCancellationCleanupResult[] = [];

		for (const child of this.#children) {
			childResults.push(
				await child.cancel({
					actor: this.#actor,
					reason: request.reason ?? 'Parent run cancellation requested.',
				}),
			);
		}

		return {
			child_results: childResults,
			process_cleanup: await this.#processRegistry.cleanupRun(this.run_id),
			run_id: this.run_id,
		};
	}
}

export function createRunCancellationScope(
	options: RunCancellationScopeOptions,
): RunCancellationScope {
	return new RunCancellationScope(options);
}
