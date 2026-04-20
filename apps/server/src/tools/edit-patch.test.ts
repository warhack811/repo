import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import { createEditPatchTool, editPatchTool } from './edit-patch.js';
import { ToolRegistry } from './registry.js';
import {
	InMemoryToolEffectIdempotencyStore,
	resetDefaultToolEffectIdempotencyStore,
} from './tool-idempotency.js';

const execFileAsync = promisify(execFile);

async function createTempWorkspace(prefix: string): Promise<string> {
	return mkdtemp(join(tmpdir(), prefix));
}

async function runGit(args: readonly string[], workingDirectory: string): Promise<void> {
	await execFileAsync('git', [...args], {
		cwd: workingDirectory,
		windowsHide: true,
	});
}

async function createCommittedGitWorkspace(): Promise<string> {
	const workspace = await createTempWorkspace('runa-edit-patch-');

	await runGit(['init'], workspace);
	await runGit(['config', 'user.email', 'runa@example.com'], workspace);
	await runGit(['config', 'user.name', 'Runa'], workspace);
	await writeFile(join(workspace, 'note.txt'), 'before\nline two\n');
	await runGit(['add', 'note.txt'], workspace);
	await runGit(['commit', '--quiet', '-m', 'initial'], workspace);

	return workspace;
}

function createInput(patch: string, working_directory?: string) {
	return {
		arguments: {
			patch,
			working_directory,
		},
		call_id: 'call_edit_patch',
		tool_name: 'edit.patch' as const,
	};
}

function createContext(working_directory: string) {
	return {
		run_id: 'run_edit_patch',
		trace_id: 'trace_edit_patch',
		working_directory,
	};
}

function createValidPatch(): string {
	return [
		'diff --git a/note.txt b/note.txt',
		'--- a/note.txt',
		'+++ b/note.txt',
		'@@ -1,2 +1,2 @@',
		'-before',
		'+after',
		' line two',
		'',
	].join('\n');
}

afterEach(() => {
	resetDefaultToolEffectIdempotencyStore();
});

describe('editPatchTool', () => {
	it('applies a valid patch and returns affected files', async () => {
		const workspace = await createCommittedGitWorkspace();

		try {
			const result = await editPatchTool.execute(
				createInput(createValidPatch()),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result for edit.patch.');
			}

			expect(result.output).toMatchObject({
				affected_files: ['note.txt'],
				effect: 'applied',
				working_directory: workspace,
			});
			expect(result.output.idempotency_key).toContain('edit.patch:');
			const patchedContent = await readFile(join(workspace, 'note.txt'), 'utf8');

			expect(patchedContent.replaceAll('\r\n', '\n')).toBe('after\nline two\n');
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns a typed error result for an invalid patch', async () => {
		const workspace = await createCommittedGitWorkspace();

		try {
			const result = await editPatchTool.execute(
				createInput('this is not a patch'),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				error_code: 'INVALID_INPUT',
				status: 'error',
				tool_name: 'edit.patch',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns a typed error result when patch target escapes the workspace', async () => {
		const workspace = await createCommittedGitWorkspace();
		const patch = [
			'diff --git a/../outside.txt b/../outside.txt',
			'--- a/../outside.txt',
			'+++ b/../outside.txt',
			'@@ -1 +1 @@',
			'-before',
			'+after',
			'',
		].join('\n');

		try {
			const result = await editPatchTool.execute(createInput(patch), createContext(workspace));

			expect(result).toMatchObject({
				error_code: 'PERMISSION_DENIED',
				status: 'error',
				tool_name: 'edit.patch',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns a typed error result when a patch target does not exist', async () => {
		const workspace = await createCommittedGitWorkspace();
		const patch = [
			'diff --git a/missing.txt b/missing.txt',
			'--- a/missing.txt',
			'+++ b/missing.txt',
			'@@ -1 +1 @@',
			'-before',
			'+after',
			'',
		].join('\n');

		try {
			const result = await editPatchTool.execute(createInput(patch), createContext(workspace));

			expect(result).toMatchObject({
				error_code: 'NOT_FOUND',
				status: 'error',
				tool_name: 'edit.patch',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns already_applied for the same semantic patch after the first success', async () => {
		const workspace = await createCommittedGitWorkspace();
		const tool = createEditPatchTool({
			execFile,
			idempotencyStore: new InMemoryToolEffectIdempotencyStore(),
			mkdtemp,
			rm,
			stat,
			writeFile,
		});

		try {
			const firstResult = await tool.execute(
				createInput(createValidPatch()),
				createContext(workspace),
			);
			const secondResult = await tool.execute(
				createInput(createValidPatch()),
				createContext(workspace),
			);

			expect(firstResult.status).toBe('success');
			expect(secondResult.status).toBe('success');

			if (firstResult.status !== 'success' || secondResult.status !== 'success') {
				throw new Error('Expected success results for duplicate edit.patch idempotency test.');
			}

			expect(firstResult.output).toMatchObject({
				affected_files: ['note.txt'],
				effect: 'applied',
				working_directory: workspace,
			});
			expect(secondResult.output).toEqual({
				affected_files: ['note.txt'],
				effect: 'already_applied',
				idempotency_key: firstResult.output.idempotency_key,
				working_directory: workspace,
			});

			const patchedContent = await readFile(join(workspace, 'note.txt'), 'utf8');
			expect(patchedContent.replaceAll('\r\n', '\n')).toBe('after\nline two\n');
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('is compatible with the central ToolRegistry', () => {
		const registry = new ToolRegistry();

		registry.register(editPatchTool);

		expect(registry.has('edit.patch')).toBe(true);
		expect(registry.get('edit.patch')).toBe(editPatchTool);
	});
});
