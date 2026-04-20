import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createFileListTool, fileListTool } from './file-list.js';
import { ToolRegistry } from './registry.js';

async function createTempWorkspace(): Promise<string> {
	return mkdtemp(join(tmpdir(), 'runa-file-list-'));
}

function createInput(path: string, include_hidden?: boolean) {
	return {
		arguments: {
			include_hidden,
			path,
		},
		call_id: 'call_file_list',
		tool_name: 'file.list' as const,
	};
}

function createContext(working_directory: string) {
	return {
		run_id: 'run_file_list',
		trace_id: 'trace_file_list',
		working_directory,
	};
}

describe('fileListTool', () => {
	it('lists an existing directory successfully', async () => {
		const workspace = await createTempWorkspace();

		try {
			await writeFile(join(workspace, 'b.txt'), 'b');
			await writeFile(join(workspace, 'a.txt'), 'a');
			await mkdir(join(workspace, 'folder'));

			const result = await fileListTool.execute(createInput('.'), createContext(workspace));

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result for file.list.');
			}

			expect(result.output).toEqual({
				entries: [
					{
						kind: 'file',
						name: 'a.txt',
						path: join(workspace, 'a.txt'),
					},
					{
						kind: 'file',
						name: 'b.txt',
						path: join(workspace, 'b.txt'),
					},
					{
						kind: 'directory',
						name: 'folder',
						path: join(workspace, 'folder'),
					},
				],
				path: workspace,
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns results in deterministic ascending name order', async () => {
		const workspace = await createTempWorkspace();

		try {
			await writeFile(join(workspace, 'zeta.txt'), 'z');
			await writeFile(join(workspace, 'alpha.txt'), 'a');
			await writeFile(join(workspace, 'middle.txt'), 'm');

			const result = await fileListTool.execute(createInput('.'), createContext(workspace));

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result for deterministic ordering.');
			}

			expect(result.output.entries.map((entry) => entry.name)).toEqual([
				'alpha.txt',
				'middle.txt',
				'zeta.txt',
			]);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns a typed error result for a missing path', async () => {
		const workspace = await createTempWorkspace();

		try {
			const result = await fileListTool.execute(
				createInput('missing-directory'),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				error_code: 'NOT_FOUND',
				status: 'error',
				tool_name: 'file.list',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns a typed error result for a file path', async () => {
		const workspace = await createTempWorkspace();

		try {
			await writeFile(join(workspace, 'single.txt'), 'content');

			const result = await fileListTool.execute(
				createInput('single.txt'),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				error_code: 'INVALID_INPUT',
				status: 'error',
				tool_name: 'file.list',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('hides dot-prefixed entries when include_hidden is false', async () => {
		const workspace = await createTempWorkspace();

		try {
			await writeFile(join(workspace, '.secret'), 'hidden');
			await writeFile(join(workspace, 'visible.txt'), 'visible');

			const result = await fileListTool.execute(createInput('.'), createContext(workspace));

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result for hidden filtering.');
			}

			expect(result.output.entries.map((entry) => entry.name)).toEqual(['visible.txt']);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('includes dot-prefixed entries when include_hidden is true', async () => {
		const workspace = await createTempWorkspace();

		try {
			await writeFile(join(workspace, '.secret'), 'hidden');
			await writeFile(join(workspace, 'visible.txt'), 'visible');

			const result = await fileListTool.execute(createInput('.', true), createContext(workspace));

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result when include_hidden is true.');
			}

			expect(result.output.entries.map((entry) => entry.name)).toEqual(['.secret', 'visible.txt']);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('converts list exceptions into an error result surface', async () => {
		const workspace = await createTempWorkspace();
		const tool = createFileListTool({
			readdir: async () => {
				throw Object.assign(new Error('simulated list failure'), { code: 'EIO' });
			},
			stat,
		});

		try {
			const result = await tool.execute(createInput('.'), createContext(workspace));

			expect(result).toMatchObject({
				error_code: 'EXECUTION_FAILED',
				status: 'error',
				tool_name: 'file.list',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('is compatible with the central ToolRegistry', () => {
		const registry = new ToolRegistry();

		registry.register(fileListTool);

		expect(registry.has('file.list')).toBe(true);
		expect(registry.get('file.list')).toBe(fileListTool);
	});
});
