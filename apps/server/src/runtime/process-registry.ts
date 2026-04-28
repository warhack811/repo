import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ManagedProcessHandle {
	readonly killed?: boolean;
	readonly pid?: number;
	kill(signal?: NodeJS.Signals | number): boolean;
}

export interface ProcessRegistryEntry {
	readonly handle: ManagedProcessHandle;
	readonly label?: string;
	readonly registered_at: string;
	readonly run_id: string;
}

export interface ProcessCleanupFailure {
	readonly label?: string;
	readonly message: string;
	readonly pid?: number;
	readonly reason: 'kill_failed' | 'missing_pid' | 'process_tree_kill_failed';
}

export interface ProcessCleanupResult {
	readonly failures: readonly ProcessCleanupFailure[];
	readonly killed_count: number;
	readonly run_id: string;
}

export interface ProcessTreeKillerInput {
	readonly handle: ManagedProcessHandle;
	readonly label?: string;
	readonly platform: NodeJS.Platform;
	readonly run_id: string;
}

export type ProcessTreeKiller = (input: ProcessTreeKillerInput) => Promise<void> | void;

export interface RunProcessRegistryOptions {
	readonly platform?: NodeJS.Platform;
	readonly process_tree_killer?: ProcessTreeKiller;
}

export interface RegisteredProcess {
	readonly entry: ProcessRegistryEntry;
	unregister(): void;
}

function toFailureMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return 'Unknown process cleanup failure.';
}

async function killWindowsProcessTree(input: ProcessTreeKillerInput): Promise<void> {
	if (input.handle.pid === undefined) {
		throw new Error('Cannot kill Windows process tree without a pid.');
	}

	await execFileAsync('taskkill.exe', ['/PID', String(input.handle.pid), '/T', '/F'], {
		windowsHide: true,
	});
}

async function defaultProcessTreeKiller(input: ProcessTreeKillerInput): Promise<void> {
	if (input.platform === 'win32') {
		await killWindowsProcessTree(input);
		return;
	}

	if (!input.handle.kill('SIGTERM')) {
		throw new Error('Process kill returned false.');
	}
}

export class RunProcessRegistry {
	readonly #entriesByRunId = new Map<string, Map<ManagedProcessHandle, ProcessRegistryEntry>>();
	readonly #platform: NodeJS.Platform;
	readonly #processTreeKiller: ProcessTreeKiller;

	constructor(options: RunProcessRegistryOptions = {}) {
		this.#platform = options.platform ?? process.platform;
		this.#processTreeKiller = options.process_tree_killer ?? defaultProcessTreeKiller;
	}

	register(input: {
		readonly handle: ManagedProcessHandle;
		readonly label?: string;
		readonly run_id: string;
	}): RegisteredProcess {
		const entry: ProcessRegistryEntry = {
			handle: input.handle,
			label: input.label,
			registered_at: new Date().toISOString(),
			run_id: input.run_id,
		};
		const runEntries = this.#entriesByRunId.get(input.run_id) ?? new Map();

		runEntries.set(input.handle, entry);
		this.#entriesByRunId.set(input.run_id, runEntries);

		return {
			entry,
			unregister: () => {
				this.unregister(input.run_id, input.handle);
			},
		};
	}

	unregister(runId: string, handle: ManagedProcessHandle): void {
		const runEntries = this.#entriesByRunId.get(runId);

		if (runEntries === undefined) {
			return;
		}

		runEntries.delete(handle);

		if (runEntries.size === 0) {
			this.#entriesByRunId.delete(runId);
		}
	}

	list(runId: string): readonly ProcessRegistryEntry[] {
		return Array.from(this.#entriesByRunId.get(runId)?.values() ?? []);
	}

	async cleanupRun(runId: string): Promise<ProcessCleanupResult> {
		const entries = this.list(runId);
		const failures: ProcessCleanupFailure[] = [];
		let killedCount = 0;

		for (const entry of entries) {
			if (entry.handle.killed === true) {
				this.unregister(runId, entry.handle);
				continue;
			}

			try {
				await this.#processTreeKiller({
					handle: entry.handle,
					label: entry.label,
					platform: this.#platform,
					run_id: runId,
				});
				killedCount += 1;
				this.unregister(runId, entry.handle);
			} catch (error: unknown) {
				failures.push({
					label: entry.label,
					message: toFailureMessage(error),
					pid: entry.handle.pid,
					reason:
						entry.handle.pid === undefined && this.#platform === 'win32'
							? 'missing_pid'
							: 'process_tree_kill_failed',
				});

				if (entry.handle.kill('SIGTERM')) {
					killedCount += 1;
					this.unregister(runId, entry.handle);
					continue;
				}

				failures.push({
					label: entry.label,
					message: 'Fallback process kill returned false.',
					pid: entry.handle.pid,
					reason: 'kill_failed',
				});
			}
		}

		return {
			failures,
			killed_count: killedCount,
			run_id: runId,
		};
	}
}
