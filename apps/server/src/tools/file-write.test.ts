import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createFileWriteTool, fileWriteTool } from './file-write.js';
import { ToolRegistry } from './registry.js';
import {
	InMemoryToolEffectIdempotencyStore,
	resetDefaultToolEffectIdempotencyStore,
} from './tool-idempotency.js';

async function createTempWorkspace(): Promise<string> {
	return mkdtemp(join(tmpdir(), 'runa-file-write-'));
}

function createInput(path: string, content: string, overwrite?: boolean) {
	return {
		arguments: {
			content,
			overwrite,
			path,
		},
		call_id: 'call_file_write',
		tool_name: 'file.write' as const,
	};
}

function createContext(working_directory: string) {
	return {
		run_id: 'run_file_write',
		trace_id: 'trace_file_write',
		working_directory,
	};
}

afterEach(() => {
	resetDefaultToolEffectIdempotencyStore();
});

describe('fileWriteTool', () => {
	it('writes a new text file successfully', async () => {
		const workspace = await createTempWorkspace();
		const relativePath = 'created.txt';

		try {
			const result = await fileWriteTool.execute(
				createInput(relativePath, 'hello from file.write\n'),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result for file.write.');
			}

			expect(result.output).toMatchObject({
				bytes_written: 22,
				created: true,
				effect: 'applied',
				encoding: 'utf8',
				overwritten: false,
				path: join(workspace, relativePath),
			});
			expect(result.output.idempotency_key).toContain('file.write:');
			await expect(readFile(join(workspace, relativePath), 'utf8')).resolves.toBe(
				'hello from file.write\n',
			);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns a typed error result when the parent directory does not exist', async () => {
		const workspace = await createTempWorkspace();

		try {
			const result = await fileWriteTool.execute(
				createInput('missing/new-file.txt', 'content'),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				error_code: 'NOT_FOUND',
				status: 'error',
				tool_name: 'file.write',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns a typed error result when the target path is a directory', async () => {
		const workspace = await createTempWorkspace();
		const directoryPath = join(workspace, 'folder');

		try {
			await mkdir(directoryPath);

			const result = await fileWriteTool.execute(
				createInput('folder', 'content'),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				error_code: 'INVALID_INPUT',
				status: 'error',
				tool_name: 'file.write',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns a typed conflict-style error result when overwrite is disabled', async () => {
		const workspace = await createTempWorkspace();
		const filePath = join(workspace, 'existing.txt');

		try {
			await fileWriteTool.execute(
				createInput('existing.txt', 'original content', true),
				createContext(workspace),
			);

			const result = await fileWriteTool.execute(
				createInput('existing.txt', 'new content'),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				error_code: 'INVALID_INPUT',
				status: 'error',
				tool_name: 'file.write',
			});
			await expect(readFile(filePath, 'utf8')).resolves.toBe('original content');
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('overwrites an existing file when overwrite is true', async () => {
		const workspace = await createTempWorkspace();
		const filePath = join(workspace, 'existing.txt');

		try {
			await fileWriteTool.execute(
				createInput('existing.txt', 'before', true),
				createContext(workspace),
			);

			const result = await fileWriteTool.execute(
				createInput('existing.txt', 'after', true),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result when overwrite is true.');
			}

			expect(result.output).toMatchObject({
				created: false,
				effect: 'applied',
				overwritten: true,
			});
			await expect(readFile(filePath, 'utf8')).resolves.toBe('after');
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('converts write exceptions into an error result surface', async () => {
		const workspace = await createTempWorkspace();
		const tool = createFileWriteTool({
			idempotencyStore: new InMemoryToolEffectIdempotencyStore(),
			readFile,
			stat,
			writeFile: async () => {
				throw Object.assign(new Error('simulated write failure'), { code: 'EIO' });
			},
		});

		try {
			const result = await tool.execute(
				createInput('failure.txt', 'content'),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				error_code: 'EXECUTION_FAILED',
				status: 'error',
				tool_name: 'file.write',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns already_applied for the same semantic write after the first success', async () => {
		const workspace = await createTempWorkspace();
		const store = new InMemoryToolEffectIdempotencyStore();
		const tool = createFileWriteTool({
			idempotencyStore: store,
			readFile,
			stat,
			writeFile,
		});

		try {
			const firstResult = await tool.execute(
				createInput('duplicate.txt', 'same content'),
				createContext(workspace),
			);
			const secondResult = await tool.execute(
				createInput('duplicate.txt', 'same content'),
				createContext(workspace),
			);

			expect(firstResult.status).toBe('success');
			expect(secondResult.status).toBe('success');

			if (firstResult.status !== 'success' || secondResult.status !== 'success') {
				throw new Error('Expected success results for duplicate file.write idempotency test.');
			}

			expect(firstResult.output).toMatchObject({
				bytes_written: 12,
				created: true,
				effect: 'applied',
				overwritten: false,
			});
			expect(secondResult.output).toEqual({
				bytes_written: 0,
				created: false,
				effect: 'already_applied',
				encoding: 'utf8',
				idempotency_key: firstResult.output.idempotency_key,
				overwritten: false,
				path: join(workspace, 'duplicate.txt'),
			});
			await expect(readFile(join(workspace, 'duplicate.txt'), 'utf8')).resolves.toBe(
				'same content',
			);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('is compatible with the central ToolRegistry', () => {
		const registry = new ToolRegistry();

		registry.register(fileWriteTool);

		expect(registry.has('file.write')).toBe(true);
		expect(registry.get('file.write')).toBe(fileWriteTool);
	});
});
