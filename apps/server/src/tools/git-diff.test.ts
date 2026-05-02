import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { createGitDiffTool, gitDiffTool } from './git-diff.js';
import { ToolRegistry } from './registry.js';

const execFileAsync = promisify(execFile);
const GIT_BACKED_TOOL_TEST_TIMEOUT_MS = 15_000;

async function createTempWorkspace(prefix: string): Promise<string> {
	return mkdtemp(join(tmpdir(), prefix));
}

async function removeTempWorkspace(workspace: string): Promise<void> {
	await rm(workspace, {
		force: true,
		maxRetries: 10,
		recursive: true,
		retryDelay: 50,
	});
}

async function runGit(args: readonly string[], workingDirectory: string): Promise<void> {
	await execFileAsync('git', [...args], {
		cwd: workingDirectory,
		windowsHide: true,
	});
}

async function createCommittedGitWorkspace(): Promise<string> {
	const workspace = await createTempWorkspace('runa-git-diff-');

	await runGit(['init'], workspace);
	await runGit(['config', 'user.email', 'runa@example.com'], workspace);
	await runGit(['config', 'user.name', 'Runa'], workspace);
	await writeFile(join(workspace, 'alpha.txt'), 'alpha\n');
	await writeFile(join(workspace, 'beta.txt'), 'beta\n');
	await runGit(['add', 'alpha.txt', 'beta.txt'], workspace);
	await runGit(['commit', '--quiet', '-m', 'initial'], workspace);

	return workspace;
}

function createInput(options?: {
	readonly cached?: boolean;
	readonly path?: string;
	readonly working_directory?: string;
}) {
	return {
		arguments: {
			cached: options?.cached,
			path: options?.path,
			working_directory: options?.working_directory,
		},
		call_id: 'call_git_diff',
		tool_name: 'git.diff' as const,
	};
}

function createContext(working_directory: string) {
	return {
		run_id: 'run_git_diff',
		trace_id: 'trace_git_diff',
		working_directory,
	};
}

describe('gitDiffTool', () => {
	it(
		'returns diff text and changed paths for workspace changes',
		async () => {
			const workspace = await createCommittedGitWorkspace();

			try {
				await writeFile(join(workspace, 'alpha.txt'), 'alpha updated\n');

				const result = await gitDiffTool.execute(createInput(), createContext(workspace));

				expect(result.status).toBe('success');

				if (result.status !== 'success') {
					throw new Error('Expected a success result for git.diff.');
				}

				expect(result.output.changed_paths).toEqual(['alpha.txt']);
				expect(result.output.diff_text).toContain('alpha updated');
				expect(result.output.is_truncated).toBe(false);
			} finally {
				await removeTempWorkspace(workspace);
			}
		},
		GIT_BACKED_TOOL_TEST_TIMEOUT_MS,
	);

	it(
		'supports path filtering',
		async () => {
			const workspace = await createCommittedGitWorkspace();

			try {
				await writeFile(join(workspace, 'alpha.txt'), 'alpha updated\n');
				await writeFile(join(workspace, 'beta.txt'), 'beta updated\n');

				const result = await gitDiffTool.execute(
					createInput({
						path: 'alpha.txt',
					}),
					createContext(workspace),
				);

				expect(result.status).toBe('success');

				if (result.status !== 'success') {
					throw new Error('Expected a success result for git.diff path filter.');
				}

				expect(result.output.changed_paths).toEqual(['alpha.txt']);
				expect(result.output.diff_text).toContain('alpha updated');
				expect(result.output.diff_text).not.toContain('beta updated');
			} finally {
				await removeTempWorkspace(workspace);
			}
		},
		GIT_BACKED_TOOL_TEST_TIMEOUT_MS,
	);

	it(
		'truncates large diffs deterministically',
		async () => {
			const workspace = await createCommittedGitWorkspace();
			const tool = createGitDiffTool({
				max_diff_bytes: 96,
			});

			try {
				await writeFile(join(workspace, 'alpha.txt'), `${'line\n'.repeat(80)}final\n`);

				const result = await tool.execute(createInput(), createContext(workspace));

				expect(result.status).toBe('success');

				if (result.status !== 'success') {
					throw new Error('Expected a success result for git.diff truncation.');
				}

				expect(result.output.is_truncated).toBe(true);
				expect(result.output.diff_text).toContain('[truncated]');
				expect(result.output.changed_paths).toEqual(['alpha.txt']);
			} finally {
				await removeTempWorkspace(workspace);
			}
		},
		GIT_BACKED_TOOL_TEST_TIMEOUT_MS,
	);

	it(
		'returns a typed error result for a non-repository path',
		async () => {
			const workspace = await createTempWorkspace('runa-git-diff-missing-repo-');

			try {
				const result = await gitDiffTool.execute(createInput(), createContext(workspace));

				expect(result).toMatchObject({
					error_code: 'INVALID_INPUT',
					status: 'error',
					tool_name: 'git.diff',
				});
			} finally {
				await removeTempWorkspace(workspace);
			}
		},
		GIT_BACKED_TOOL_TEST_TIMEOUT_MS,
	);

	it('is compatible with the central ToolRegistry', () => {
		const registry = new ToolRegistry();

		registry.register(gitDiffTool);

		expect(registry.has('git.diff')).toBe(true);
		expect(registry.get('git.diff')).toBe(gitDiffTool);
	});
});
