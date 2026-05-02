import { execFile } from 'node:child_process';
import type { Stats } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { createGitStatusTool, gitStatusTool } from './git-status.js';
import { ToolRegistry } from './registry.js';

const execFileAsync = promisify(execFile);
const GIT_BACKED_TOOL_TEST_TIMEOUT_MS = 15_000;
type GitStatusStat = typeof import('node:fs/promises')['stat'];

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
	const workspace = await createTempWorkspace('runa-git-status-');

	await runGit(['init'], workspace);
	await runGit(['config', 'user.email', 'runa@example.com'], workspace);
	await runGit(['config', 'user.name', 'Runa'], workspace);
	await writeFile(join(workspace, 'tracked.txt'), 'tracked\n');
	await mkdir(join(workspace, 'src'));
	await writeFile(join(workspace, 'src', 'nested.txt'), 'nested\n');
	await runGit(['add', 'tracked.txt', 'src/nested.txt'], workspace);
	await runGit(['commit', '--quiet', '-m', 'initial'], workspace);

	return workspace;
}

function createInput(working_directory?: string) {
	return {
		arguments: {
			working_directory,
		},
		call_id: 'call_git_status',
		tool_name: 'git.status' as const,
	};
}

function createContext(working_directory: string) {
	return {
		run_id: 'run_git_status',
		trace_id: 'trace_git_status',
		working_directory,
	};
}

function createStatsResult(isDirectory: boolean): Stats {
	return {
		isDirectory: () => isDirectory,
	} as unknown as Stats;
}

describe('gitStatusTool', () => {
	it(
		'returns a clean repository summary',
		async () => {
			const workspace = await createCommittedGitWorkspace();

			try {
				const result = await gitStatusTool.execute(createInput(), createContext(workspace));

				expect(result.status).toBe('success');

				if (result.status !== 'success') {
					throw new Error('Expected a success result for git.status.');
				}

				expect(result.output.is_clean).toBe(true);
				expect(result.output.branch.length).toBeGreaterThan(0);
				expect(result.output.staged_files).toEqual([]);
				expect(result.output.modified_files).toEqual([]);
				expect(result.output.untracked_files).toEqual([]);
				expect(result.output.working_directory).toBe(workspace);
			} finally {
				await rm(workspace, { force: true, recursive: true });
			}
		},
		GIT_BACKED_TOOL_TEST_TIMEOUT_MS,
	);

	it(
		'returns modified and untracked file lists deterministically',
		async () => {
			const workspace = await createCommittedGitWorkspace();

			try {
				await writeFile(join(workspace, 'tracked.txt'), 'tracked changed\n');
				await writeFile(join(workspace, 'src', 'nested.txt'), 'nested changed\n');
				await runGit(['add', 'src/nested.txt'], workspace);
				await writeFile(join(workspace, 'untracked.txt'), 'new file\n');

				const result = await gitStatusTool.execute(createInput(), createContext(workspace));

				expect(result.status).toBe('success');

				if (result.status !== 'success') {
					throw new Error('Expected a success result for git.status changes.');
				}

				expect(result.output.is_clean).toBe(false);
				expect(result.output.staged_files).toEqual(['src/nested.txt']);
				expect(result.output.modified_files).toEqual(['tracked.txt']);
				expect(result.output.untracked_files).toEqual(['untracked.txt']);
			} finally {
				await rm(workspace, { force: true, recursive: true });
			}
		},
		GIT_BACKED_TOOL_TEST_TIMEOUT_MS,
	);

	it(
		'returns a typed error result for a non-repository path',
		async () => {
			const workspace = await createTempWorkspace('runa-git-status-missing-repo-');

			try {
				const result = await gitStatusTool.execute(createInput(), createContext(workspace));

				expect(result).toMatchObject({
					error_code: 'INVALID_INPUT',
					status: 'error',
					tool_name: 'git.status',
				});
			} finally {
				await rm(workspace, { force: true, recursive: true });
			}
		},
		GIT_BACKED_TOOL_TEST_TIMEOUT_MS,
	);

	it('returns a typed error result when the resolved working directory is not a directory', async () => {
		let execCallCount = 0;
		const workingDirectory = join(process.cwd(), 'virtual-git-status-file.txt');
		const tool = createGitStatusTool({
			execFile: ((..._args) => {
				execCallCount += 1;

				return {} as unknown as ReturnType<typeof execFile>;
			}) as typeof execFile,
			stat: (async () => createStatsResult(false)) as unknown as GitStatusStat,
		});

		const result = await tool.execute(createInput(workingDirectory), createContext(process.cwd()));

		expect(execCallCount).toBe(0);
		expect(result).toMatchObject({
			details: {
				reason: 'working_directory_not_directory',
				working_directory: workingDirectory,
			},
			error_code: 'INVALID_INPUT',
			error_message: `Working directory is not a directory: ${workingDirectory}`,
			retryable: false,
			status: 'error',
			tool_name: 'git.status',
		});
	});

	it('returns a typed error result when the git executable is unavailable', async () => {
		const workingDirectory = join(process.cwd(), 'virtual-git-workspace');
		const tool = createGitStatusTool({
			execFile: ((_file, _args, _options, callback) => {
				const error = Object.assign(new Error('spawn git ENOENT'), {
					code: 'ENOENT',
				}) as NodeJS.ErrnoException;
				const typedCallback = callback as
					| ((error: NodeJS.ErrnoException | null, stdout: string, stderr: string) => void)
					| undefined;

				typedCallback?.(error, '', '');

				return {} as unknown as ReturnType<typeof execFile>;
			}) as typeof execFile,
			stat: (async () => createStatsResult(true)) as unknown as GitStatusStat,
		});

		const result = await tool.execute(createInput(workingDirectory), createContext(process.cwd()));

		expect(result).toMatchObject({
			details: {
				reason: 'git_not_installed',
				working_directory: workingDirectory,
			},
			error_code: 'NOT_FOUND',
			error_message: 'Git executable not found.',
			retryable: false,
			status: 'error',
			tool_name: 'git.status',
		});
	});

	it('is compatible with the central ToolRegistry', () => {
		const registry = new ToolRegistry();

		registry.register(gitStatusTool);

		expect(registry.has('git.status')).toBe(true);
		expect(registry.get('git.status')).toBe(gitStatusTool);
	});
});
