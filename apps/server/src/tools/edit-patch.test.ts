import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
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
const GIT_BACKED_TOOL_TEST_TIMEOUT_MS = 15_000;

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

function createInput(patch: string, working_directory?: string, target_path?: string) {
	return {
		arguments: {
			patch,
			target_path,
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
	it(
		'applies a valid patch and returns affected files',
		async () => {
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
		},
		GIT_BACKED_TOOL_TEST_TIMEOUT_MS,
	);

	it(
		'applies patch when target_path matches patch header target',
		async () => {
			const workspace = await createCommittedGitWorkspace();

			try {
				const result = await editPatchTool.execute(
					createInput(createValidPatch(), undefined, 'note.txt'),
					createContext(workspace),
				);

				expect(result.status).toBe('success');

				if (result.status !== 'success') {
					throw new Error('Expected a success result for edit.patch target_path match.');
				}

				expect(result.output).toMatchObject({
					affected_files: ['note.txt'],
					effect: 'applied',
				});
			} finally {
				await rm(workspace, { force: true, recursive: true });
			}
		},
		GIT_BACKED_TOOL_TEST_TIMEOUT_MS,
	);

	it(
		'fails closed when target_path mismatches patch header target',
		async () => {
			const workspace = await createCommittedGitWorkspace();
			await writeFile(join(workspace, 'other.txt'), 'before\n');
			await runGit(['add', 'other.txt'], workspace);
			await runGit(['commit', '--quiet', '-m', 'add other'], workspace);
			const mismatchedPatch = [
				'diff --git a/other.txt b/other.txt',
				'--- a/other.txt',
				'+++ b/other.txt',
				'@@ -1 +1 @@',
				'-before',
				'+after',
				'',
			].join('\n');

			try {
				const result = await editPatchTool.execute(
					createInput(mismatchedPatch, undefined, 'note.txt'),
					createContext(workspace),
				);

				expect(result).toMatchObject({
					error_code: 'INVALID_INPUT',
					status: 'error',
					tool_name: 'edit.patch',
				});

				if (result.status !== 'error') {
					throw new Error('Expected target_path mismatch to fail closed.');
				}

				expect(result.details).toMatchObject({
					expected_target: 'note.txt',
					patch_header_paths: ['other.txt'],
					reason: 'target_path_mismatch',
					validation_stage: 'validate_target_identity',
				});

				const untouchedOther = await readFile(join(workspace, 'other.txt'), 'utf8');
				expect(untouchedOther.replaceAll('\r\n', '\n')).toBe('before\n');
			} finally {
				await rm(workspace, { force: true, recursive: true });
			}
		},
		GIT_BACKED_TOOL_TEST_TIMEOUT_MS,
	);

	it(
		'fails when target_path escapes workspace',
		async () => {
			const workspace = await createCommittedGitWorkspace();

			try {
				const result = await editPatchTool.execute(
					createInput(createValidPatch(), undefined, '../outside.txt'),
					createContext(workspace),
				);

				expect(result).toMatchObject({
					error_code: 'PERMISSION_DENIED',
					status: 'error',
					tool_name: 'edit.patch',
				});

				if (result.status !== 'error') {
					throw new Error('Expected target_path outside workspace to fail.');
				}

				expect(result.details).toMatchObject({
					expected_target: '../outside.txt',
					reason: 'target_path_outside_workspace',
					validation_stage: 'resolve_target_path',
				});
			} finally {
				await rm(workspace, { force: true, recursive: true });
			}
		},
		GIT_BACKED_TOOL_TEST_TIMEOUT_MS,
	);

	it(
		'returns a typed error result for an invalid patch',
		async () => {
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
		},
		GIT_BACKED_TOOL_TEST_TIMEOUT_MS,
	);

	it(
		'returns a typed error result when patch target escapes the workspace',
		async () => {
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

				if (result.status !== 'error') {
					throw new Error('Expected patch target escape failure.');
				}

				expect(result.details).toMatchObject({
					patch_header_paths: ['../outside.txt'],
					reason: 'patch_header_path_outside_workspace',
				});
			} finally {
				await rm(workspace, { force: true, recursive: true });
			}
		},
		GIT_BACKED_TOOL_TEST_TIMEOUT_MS,
	);

	it(
		'normalizes Windows-style backslash target_path for explicit target matching',
		async () => {
			const workspace = await createCommittedGitWorkspace();

			try {
				const result = await editPatchTool.execute(
					createInput(createValidPatch(), undefined, '.\\note.txt'),
					createContext(workspace),
				);

				expect(result.status).toBe('success');
			} finally {
				await rm(workspace, { force: true, recursive: true });
			}
		},
		GIT_BACKED_TOOL_TEST_TIMEOUT_MS,
	);

	it(
		'enforces explicit path identity when same filename exists in multiple directories',
		async () => {
			const workspace = await createCommittedGitWorkspace();
			await mkdir(join(workspace, 'dir-one'), { recursive: true });
			await mkdir(join(workspace, 'dir-two'), { recursive: true });
			await writeFile(join(workspace, 'dir-one', 'note.txt'), 'one\n');
			await writeFile(join(workspace, 'dir-two', 'note.txt'), 'two\n');
			await runGit(['add', 'dir-one/note.txt', 'dir-two/note.txt'], workspace);
			await runGit(['commit', '--quiet', '-m', 'add duplicate filenames'], workspace);
			const patch = [
				'diff --git a/dir-two/note.txt b/dir-two/note.txt',
				'--- a/dir-two/note.txt',
				'+++ b/dir-two/note.txt',
				'@@ -1 +1 @@',
				'-two',
				'+two-updated',
				'',
			].join('\n');

			try {
				const result = await editPatchTool.execute(
					createInput(patch, undefined, 'dir-one/note.txt'),
					createContext(workspace),
				);

				expect(result).toMatchObject({
					error_code: 'INVALID_INPUT',
					status: 'error',
					tool_name: 'edit.patch',
				});

				const firstContent = await readFile(join(workspace, 'dir-one', 'note.txt'), 'utf8');
				const secondContent = await readFile(join(workspace, 'dir-two', 'note.txt'), 'utf8');
				expect(firstContent.replaceAll('\r\n', '\n')).toBe('one\n');
				expect(secondContent.replaceAll('\r\n', '\n')).toBe('two\n');
			} finally {
				await rm(workspace, { force: true, recursive: true });
			}
		},
		GIT_BACKED_TOOL_TEST_TIMEOUT_MS,
	);

	it(
		'returns a typed error result when a patch target does not exist',
		async () => {
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
		},
		GIT_BACKED_TOOL_TEST_TIMEOUT_MS,
	);

	it(
		'returns already_applied for the same semantic patch after the first success',
		async () => {
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
		},
		GIT_BACKED_TOOL_TEST_TIMEOUT_MS,
	);

	it('is compatible with the central ToolRegistry', () => {
		const registry = new ToolRegistry();

		registry.register(editPatchTool);

		expect(registry.has('edit.patch')).toBe(true);
		expect(registry.get('edit.patch')).toBe(editPatchTool);
	});
});
