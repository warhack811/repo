import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ToolRegistry } from './registry.js';
import { createShellExecTool, evaluateCommandRisk, shellExecTool } from './shell-exec.js';

async function createTempWorkspace(): Promise<string> {
	return mkdtemp(join(tmpdir(), 'runa-shell-exec-'));
}

function createInput(
	command: string,
	options?: {
		readonly args?: readonly string[];
		readonly timeout_ms?: number;
		readonly working_directory?: string;
	},
) {
	return {
		arguments: {
			args: options?.args,
			command,
			timeout_ms: options?.timeout_ms,
			working_directory: options?.working_directory,
		},
		call_id: 'call_shell_exec',
		tool_name: 'shell.exec' as const,
	};
}

function createContext(working_directory: string) {
	return {
		run_id: 'run_shell_exec',
		trace_id: 'trace_shell_exec',
		working_directory,
	};
}

describe('shellExecTool', () => {
	it('executes a simple non-shell command successfully', async () => {
		const workspace = await createTempWorkspace();

		try {
			const result = await shellExecTool.execute(
				createInput(process.execPath, {
					args: ['-e', "process.stdout.write('ok'); process.stderr.write('warn');"],
				}),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result for shell.exec.');
			}

			expect(result.output).toMatchObject({
				args: ['-e', "process.stdout.write('ok'); process.stderr.write('warn');"],
				command: process.execPath,
				exit_code: 0,
				stderr: 'warn',
				stdout: 'ok',
				timed_out: false,
				working_directory: workspace,
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns a typed error result when command is empty', async () => {
		const workspace = await createTempWorkspace();

		try {
			const result = await shellExecTool.execute(createInput('   '), createContext(workspace));

			expect(result).toMatchObject({
				error_code: 'INVALID_INPUT',
				status: 'error',
				tool_name: 'shell.exec',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('blocks dangerous command patterns before execution', async () => {
		const workspace = await createTempWorkspace();
		const blockedInputs = [
			createInput('rm', { args: ['-rf', '/'] }),
			createInput('format'),
			createInput('shutdown'),
			createInput('sudo', { args: ['rm'] }),
			createInput('nc'),
		];

		try {
			for (const input of blockedInputs) {
				const result = await shellExecTool.execute(input, createContext(workspace));

				expect(result).toMatchObject({
					error_code: 'PERMISSION_DENIED',
					status: 'error',
					tool_name: 'shell.exec',
				});
			}
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('does not block safe command patterns during risk evaluation', () => {
		const workspace = join(tmpdir(), 'runa-safe-workspace');

		expect(
			evaluateCommandRisk('ls', [], {
				workspace_path: workspace,
			}),
		).toMatchObject({
			blocked: false,
		});
		expect(
			evaluateCommandRisk('git', ['status'], {
				workspace_path: workspace,
			}),
		).toMatchObject({
			blocked: false,
		});
		expect(
			evaluateCommandRisk('node', ['--version'], {
				workspace_path: workspace,
			}),
		).toMatchObject({
			blocked: false,
		});
		expect(
			evaluateCommandRisk('rm', ['file.txt'], {
				workspace_path: workspace,
			}),
		).toMatchObject({
			blocked: false,
		});
	});

	it('returns a typed error result when working directory is invalid', async () => {
		const workspace = await createTempWorkspace();
		const missingDirectory = join(workspace, 'missing');

		try {
			const result = await shellExecTool.execute(
				createInput(process.execPath, {
					working_directory: missingDirectory,
				}),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				error_code: 'NOT_FOUND',
				status: 'error',
				tool_name: 'shell.exec',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('allows a working directory inside the workspace boundary', async () => {
		const workspace = await createTempWorkspace();
		const nestedDirectory = join(workspace, 'nested');

		try {
			await mkdir(nestedDirectory);

			const result = await shellExecTool.execute(
				createInput(process.execPath, {
					args: ['-e', 'process.stdout.write(process.cwd());'],
					working_directory: nestedDirectory,
				}),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result for in-workspace directory.');
			}

			expect(result.output.working_directory).toBe(nestedDirectory);
			expect(result.output.stdout).toBe(nestedDirectory);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('blocks a working directory outside the workspace boundary', async () => {
		const workspace = await createTempWorkspace();
		const outsideDirectory = tmpdir();

		try {
			const result = await shellExecTool.execute(
				createInput(process.execPath, {
					args: ['-e', 'process.stdout.write(process.cwd());'],
					working_directory: outsideDirectory,
				}),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				error_code: 'PERMISSION_DENIED',
				status: 'error',
				tool_name: 'shell.exec',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns a typed error result when executable is missing', async () => {
		const workspace = await createTempWorkspace();

		try {
			const result = await shellExecTool.execute(
				createInput('runa-missing-command-binary'),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				error_code: 'NOT_FOUND',
				status: 'error',
				tool_name: 'shell.exec',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns detailed risk assessment data for blocked commands', () => {
		const assessment = evaluateCommandRisk('rm', ['-rf', '/']);

		expect(assessment).toMatchObject({
			blocked: true,
			matched_pattern: 'rm -rf',
			risk_category: 'data_destruction',
		});
	});

	it('returns a non-blocking risk assessment for safe commands', () => {
		const assessment = evaluateCommandRisk('git', ['status']);

		expect(assessment).toEqual({
			blocked: false,
		});
	});

	it('returns a typed timeout result when execution exceeds timeout', async () => {
		const workspace = await createTempWorkspace();

		try {
			const result = await shellExecTool.execute(
				createInput(process.execPath, {
					args: ['-e', "setTimeout(() => process.stdout.write('late'), 200);"],
					timeout_ms: 25,
				}),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				error_code: 'TIMEOUT',
				status: 'error',
				tool_name: 'shell.exec',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('captures stdout and stderr with truncation flags', async () => {
		const workspace = await createTempWorkspace();
		const tool = createShellExecTool({
			output_limit_bytes: 64,
		});

		try {
			const result = await tool.execute(
				createInput(process.execPath, {
					args: [
						'-e',
						"process.stdout.write('x'.repeat(200)); process.stderr.write('y'.repeat(200));",
					],
				}),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result for truncation behavior.');
			}

			expect(result.output.stdout).toHaveLength(64);
			expect(result.output.stderr).toHaveLength(64);
			expect(result.output.stdout_truncated).toBe(true);
			expect(result.output.stderr_truncated).toBe(true);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns a success result for non-zero exit codes and exposes stderr', async () => {
		const workspace = await createTempWorkspace();

		try {
			const result = await shellExecTool.execute(
				createInput(process.execPath, {
					args: ['-e', "process.stderr.write('boom'); process.exit(7);"],
				}),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result for non-zero exit.');
			}

			expect(result.output).toMatchObject({
				exit_code: 7,
				stderr: 'boom',
				timed_out: false,
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('redacts sensitive process env values from stdout and stderr', async () => {
		const workspace = await createTempWorkspace();
		const secretValue = 'runa_shell_process_secret_value_123456789';
		const previousSecretValue = process.env['RUNA_TEST_SECRET_KEY'];
		process.env['RUNA_TEST_SECRET_KEY'] = secretValue;

		try {
			const result = await shellExecTool.execute(
				createInput(process.execPath, {
					args: [
						'-e',
						`process.stdout.write(${JSON.stringify(secretValue)}); process.stderr.write(${JSON.stringify(secretValue)});`,
					],
				}),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected shell.exec success for redaction behavior.');
			}

			expect(result.output.stdout).toBe('[REDACTED_SECRET]');
			expect(result.output.stderr).toBe('[REDACTED_SECRET]');
			expect(result.output.stdout).not.toContain(secretValue);
			expect(result.output.stderr).not.toContain(secretValue);
			expect(JSON.stringify(result.output)).not.toContain(secretValue);
			expect(result.output.redaction_applied).toBe(true);
			expect(result.output.redacted_occurrence_count).toBeGreaterThanOrEqual(2);
			expect(result.output.redacted_source_kinds).toEqual(['process_env']);
			expect(result.output.secret_values_exposed).toBe(false);
		} finally {
			if (previousSecretValue === undefined) {
				delete process.env['RUNA_TEST_SECRET_KEY'];
			} else {
				process.env['RUNA_TEST_SECRET_KEY'] = previousSecretValue;
			}

			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('redacts sensitive repo env-file values from captured output', async () => {
		const workspace = await createTempWorkspace();
		const secretValue = 'runa_shell_file_secret_value_123456789';

		try {
			await writeFile(join(workspace, '.env.local'), `RUNA_FILE_SECRET_KEY=${secretValue}\n`);

			const result = await shellExecTool.execute(
				createInput(process.execPath, {
					args: ['-e', `process.stdout.write(${JSON.stringify(secretValue)});`],
				}),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected shell.exec success for env-file redaction.');
			}

			expect(result.output.stdout).toBe('[REDACTED_SECRET]');
			expect(result.output.stdout).not.toContain(secretValue);
			expect(JSON.stringify(result.output)).not.toContain(secretValue);
			expect(result.output.redacted_source_kinds).toEqual(['.env.local']);
			expect(result.output.secret_values_exposed).toBe(false);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('redacts timed-out command output in the error details', async () => {
		const workspace = await createTempWorkspace();
		const secretValue = 'runa_shell_timeout_secret_value_123456789';
		const previousSecretValue = process.env['RUNA_TIMEOUT_SECRET_KEY'];
		process.env['RUNA_TIMEOUT_SECRET_KEY'] = secretValue;

		try {
			const result = await shellExecTool.execute(
				createInput(process.execPath, {
					args: [
						'-e',
						`require('node:fs').writeSync(1, ${JSON.stringify(secretValue)}); setTimeout(() => {}, 500);`,
					],
					timeout_ms: 100,
				}),
				createContext(workspace),
			);

			expect(result.status).toBe('error');

			if (result.status !== 'error') {
				throw new Error('Expected shell.exec timeout error for redaction behavior.');
			}

			expect(result.error_code).toBe('TIMEOUT');
			expect(result.details?.['stdout']).toBe('[REDACTED_SECRET]');
			expect(result.details?.['stdout']).not.toContain(secretValue);
			expect(JSON.stringify(result.details)).not.toContain(secretValue);
			expect(result.details).toMatchObject({
				redaction_applied: true,
				redacted_source_kinds: ['process_env'],
				secret_values_exposed: false,
			});
		} finally {
			if (previousSecretValue === undefined) {
				delete process.env['RUNA_TIMEOUT_SECRET_KEY'];
			} else {
				process.env['RUNA_TIMEOUT_SECRET_KEY'] = previousSecretValue;
			}

			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('is compatible with the central ToolRegistry', () => {
		const registry = new ToolRegistry();

		registry.register(shellExecTool);

		expect(registry.has('shell.exec')).toBe(true);
		expect(registry.get('shell.exec')).toBe(shellExecTool);
	});

	it('uses the input working_directory when provided', async () => {
		const workspace = await createTempWorkspace();

		try {
			const result = await shellExecTool.execute(
				createInput(process.execPath, {
					args: ['-e', 'process.stdout.write(process.cwd());'],
					working_directory: workspace,
				}),
				createContext(tmpdir()),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result for explicit working directory.');
			}

			expect(result.output.working_directory).toBe(workspace);
			expect(result.output.stdout).toBe(workspace);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});
});
