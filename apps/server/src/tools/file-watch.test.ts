import { EventEmitter } from 'node:events';
import type { FSWatcher, watch } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createFileWatchTool, fileWatchTool } from './file-watch.js';
import { ToolRegistry, createBuiltInToolRegistry } from './registry.js';

class FakeWatcher extends EventEmitter {
	readonly close = vi.fn();

	ref(): FSWatcher {
		return this as unknown as FSWatcher;
	}

	unref(): FSWatcher {
		return this as unknown as FSWatcher;
	}
}

async function createTempWorkspace(): Promise<string> {
	return mkdtemp(join(tmpdir(), 'runa-file-watch-'));
}

function createInput(argumentsValue: Record<string, unknown>) {
	return {
		arguments: argumentsValue,
		call_id: 'call_file_watch',
		tool_name: 'file.watch' as const,
	};
}

function createContext(working_directory: string) {
	return {
		run_id: 'run_file_watch',
		trace_id: 'trace_file_watch',
		working_directory,
	};
}

function createWatchMock(emitEvents: number): {
	fakeWatcher: FakeWatcher;
	watchMock: typeof watch;
} {
	const fakeWatcher = new FakeWatcher();
	const watchMock = ((...args: readonly unknown[]) => {
		const listener = args[2];

		if (typeof listener === 'function') {
			queueMicrotask(() => {
				for (let index = 0; index < emitEvents; index += 1) {
					listener('change', `file-${String(index)}.txt`);
				}
			});
		}

		return fakeWatcher as unknown as FSWatcher;
	}) as typeof watch;

	return { fakeWatcher, watchMock };
}

describe('fileWatchTool', () => {
	it('watches a workspace path for a bounded duration', async () => {
		const workspace = await createTempWorkspace();
		const { fakeWatcher, watchMock } = createWatchMock(0);
		const tool = createFileWatchTool({
			watch: watchMock,
		});

		try {
			await writeFile(join(workspace, 'observed.txt'), 'initial');

			const result = await tool.execute(
				createInput({
					duration_ms: 1,
					path: '.',
				}),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				output: {
					event_count: 0,
					is_truncated: false,
					path: '.',
				},
				status: 'success',
				tool_name: 'file.watch',
			});
			expect(fakeWatcher.close).toHaveBeenCalledTimes(1);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('caps watch events at 50 and reports truncation', async () => {
		const workspace = await createTempWorkspace();
		const { fakeWatcher, watchMock } = createWatchMock(55);
		const tool = createFileWatchTool({
			watch: watchMock,
		});

		try {
			await writeFile(join(workspace, 'observed.txt'), 'initial');

			const result = await tool.execute(
				createInput({
					duration_ms: 30_000,
					path: '.',
				}),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result for bounded file.watch events.');
			}

			expect(result.output.event_count).toBe(50);
			expect(result.output.is_truncated).toBe(true);
			expect(fakeWatcher.close).toHaveBeenCalledTimes(1);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('rejects workspace escape attempts before opening a watcher', async () => {
		const workspace = await createTempWorkspace();
		const { watchMock } = createWatchMock(0);
		const watchSpy = vi.fn(watchMock);
		const tool = createFileWatchTool({
			watch: watchSpy as unknown as typeof watch,
		});

		try {
			const result = await tool.execute(
				createInput({
					path: '..',
				}),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				details: {
					reason: 'outside_workspace',
				},
				error_code: 'PERMISSION_DENIED',
				status: 'error',
				tool_name: 'file.watch',
			});
			expect(watchSpy).not.toHaveBeenCalled();
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('rejects unbounded watch duration requests', async () => {
		const workspace = await createTempWorkspace();

		try {
			const result = await fileWatchTool.execute(
				createInput({
					duration_ms: 30_001,
					path: '.',
				}),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				error_code: 'INVALID_INPUT',
				status: 'error',
				tool_name: 'file.watch',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('registers as a built-in workspace tool', () => {
		const registry = new ToolRegistry();

		registry.register(fileWatchTool);

		expect(registry.has('file.watch')).toBe(true);
		expect(createBuiltInToolRegistry().has('file.watch')).toBe(true);
	});
});
