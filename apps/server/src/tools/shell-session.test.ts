import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ToolRegistry } from './registry.js';
import {
	MAX_ACTIVE_SESSIONS,
	ShellSessionManager,
	createShellSessionTools,
	shellSessionReadTool,
	shellSessionStartTool,
	shellSessionStopTool,
} from './shell-session.js';

async function createTempWorkspace(): Promise<string> {
	return mkdtemp(join(tmpdir(), 'runa-shell-session-'));
}

function createContext(workingDirectory: string, runId = 'run_shell_session') {
	return {
		run_id: runId,
		trace_id: 'trace_shell_session',
		working_directory: workingDirectory,
	};
}

function startInput(
	options: {
		readonly args?: readonly string[];
		readonly command?: string;
		readonly idle_timeout_ms?: number;
		readonly max_runtime_ms?: number;
		readonly output_limit_bytes?: number;
		readonly working_directory?: string;
	} = {},
) {
	return {
		arguments: {
			args: options.args,
			command: options.command ?? process.execPath,
			idle_timeout_ms: options.idle_timeout_ms,
			max_runtime_ms: options.max_runtime_ms,
			output_limit_bytes: options.output_limit_bytes,
			working_directory: options.working_directory,
		},
		call_id: 'call_shell_session_start',
		tool_name: 'shell.session.start' as const,
	};
}

function readInput(
	sessionId: string,
	options: {
		readonly max_bytes?: number;
		readonly stream?: 'both' | 'stderr' | 'stdout';
	} = {},
) {
	return {
		arguments: {
			max_bytes: options.max_bytes,
			session_id: sessionId,
			stream: options.stream,
		},
		call_id: 'call_shell_session_read',
		tool_name: 'shell.session.read' as const,
	};
}

function stopInput(
	sessionId: string,
	options: {
		readonly force?: boolean;
	} = {},
) {
	return {
		arguments: {
			force: options.force,
			session_id: sessionId,
		},
		call_id: 'call_shell_session_stop',
		tool_name: 'shell.session.stop' as const,
	};
}

function createTools() {
	const manager = new ShellSessionManager();
	const [startTool, readTool, stopTool] = createShellSessionTools(manager);

	return {
		manager,
		readTool,
		startTool,
		stopTool,
	};
}

async function wait(ms: number): Promise<void> {
	await new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});
}

async function stopIfStarted(
	stopTool: ReturnType<typeof createTools>['stopTool'],
	sessionId: string | undefined,
): Promise<void> {
	if (sessionId) {
		await stopTool.execute(stopInput(sessionId, { force: true }), createContext(tmpdir()));
	}
}

describe('shell session tools', () => {
	it('starts a long-running argv-based process and reads redacted output', async () => {
		const workspace = await createTempWorkspace();
		const { readTool, startTool, stopTool } = createTools();
		let sessionId: string | undefined;

		try {
			const startResult = await startTool.execute(
				startInput({
					args: [
						'-e',
						"process.stdout.write('ready'); process.stderr.write('warn'); setTimeout(() => {}, 5000);",
					],
					idle_timeout_ms: 1000,
					max_runtime_ms: 5000,
				}),
				createContext(workspace),
			);

			expect(startResult.status).toBe('success');

			if (startResult.status !== 'success') {
				throw new Error('Expected shell.session.start success.');
			}

			sessionId = startResult.output.session_id;
			expect(startResult.output).toMatchObject({
				command: process.execPath,
				next_action_hint: 'read_or_stop',
				runtime_feedback: expect.stringContaining('started and is running'),
				status: 'running',
				working_directory: workspace,
			});
			expect(startResult.metadata?.['shell_session']).toMatchObject({
				kind: 'shell_session_lifecycle',
				next_action_hint: 'read_or_stop',
				session_id: sessionId,
				status: 'running',
				tool_name: 'shell.session.start',
			});

			await wait(500);

			const readResult = await readTool.execute(readInput(sessionId), createContext(workspace));

			expect(readResult.status).toBe('success');

			if (readResult.status !== 'success') {
				throw new Error('Expected shell.session.read success.');
			}

			expect(readResult.output.status).toBe('running');
			expect(readResult.output.stdout).toBe('ready');
			expect(readResult.output.stderr).toBe('warn');
			expect(readResult.output.has_output).toBe(true);
			expect(readResult.output.next_action_hint).toBe('read_or_stop');
			expect(readResult.output.runtime_feedback).toContain('returned buffered output');
			expect(readResult.output.secret_values_exposed).toBe(false);
			expect(readResult.metadata?.['shell_session']).toMatchObject({
				has_output: true,
				kind: 'shell_session_lifecycle',
				next_action_hint: 'read_or_stop',
				session_id: sessionId,
				status: 'running',
				tool_name: 'shell.session.read',
			});
		} finally {
			await stopIfStarted(stopTool, sessionId);
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('redacts sensitive process env and env-file values from buffered output', async () => {
		const workspace = await createTempWorkspace();
		const { readTool, startTool, stopTool } = createTools();
		const processSecret = 'runa_session_process_secret_value_123456789';
		const fileSecret = 'runa_session_file_secret_value_123456789';
		const previousSecret = process.env['RUNA_SESSION_SECRET_KEY'];
		let sessionId: string | undefined;
		process.env['RUNA_SESSION_SECRET_KEY'] = processSecret;

		try {
			await writeFile(join(workspace, '.env.local'), `RUNA_FILE_SECRET_KEY=${fileSecret}\n`);

			const startResult = await startTool.execute(
				startInput({
					args: [
						'-e',
						`process.stdout.write(${JSON.stringify(`${processSecret}\n${fileSecret}`)}); setTimeout(() => {}, 5000);`,
					],
					idle_timeout_ms: 1000,
					max_runtime_ms: 5000,
				}),
				createContext(workspace),
			);

			expect(startResult.status).toBe('success');

			if (startResult.status !== 'success') {
				throw new Error('Expected shell.session.start success for redaction behavior.');
			}

			sessionId = startResult.output.session_id;
			expect(JSON.stringify(startResult.output)).not.toContain(processSecret);
			expect(JSON.stringify(startResult.output)).not.toContain(fileSecret);
			await wait(500);

			const readResult = await readTool.execute(readInput(sessionId), createContext(workspace));

			expect(readResult.status).toBe('success');

			if (readResult.status !== 'success') {
				throw new Error('Expected shell.session.read success for redaction behavior.');
			}

			expect(readResult.output.stdout).toBe('[REDACTED_SECRET]\n[REDACTED_SECRET]');
			expect(JSON.stringify(readResult.output)).not.toContain(processSecret);
			expect(JSON.stringify(readResult.output)).not.toContain(fileSecret);
			expect(readResult.output.redaction_applied).toBe(true);
			expect(readResult.output.redacted_source_kinds).toEqual(['.env.local', 'process_env']);
			expect(readResult.output.secret_values_exposed).toBe(false);
		} finally {
			if (previousSecret === undefined) {
				process.env['RUNA_SESSION_SECRET_KEY'] = undefined;
			} else {
				process.env['RUNA_SESSION_SECRET_KEY'] = previousSecret;
			}

			await stopIfStarted(stopTool, sessionId);
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('stops a running session and keeps stop idempotent', async () => {
		const workspace = await createTempWorkspace();
		const { readTool, startTool, stopTool } = createTools();
		let sessionId: string | undefined;

		try {
			const startResult = await startTool.execute(
				startInput({
					args: ['-e', 'setTimeout(() => {}, 5000);'],
					idle_timeout_ms: 1000,
					max_runtime_ms: 5000,
				}),
				createContext(workspace),
			);

			expect(startResult.status).toBe('success');

			if (startResult.status !== 'success') {
				throw new Error('Expected shell.session.start success for stop behavior.');
			}

			sessionId = startResult.output.session_id;

			const stopResult = await stopTool.execute(stopInput(sessionId), createContext(workspace));
			const secondStopResult = await stopTool.execute(
				stopInput(sessionId),
				createContext(workspace),
			);

			expect(stopResult.status).toBe('success');
			expect(secondStopResult.status).toBe('success');

			if (stopResult.status !== 'success' || secondStopResult.status !== 'success') {
				throw new Error('Expected idempotent shell.session.stop success.');
			}

			expect(['stopped', 'killed']).toContain(stopResult.output.status);
			expect(stopResult.output.next_action_hint).toBe('continue_or_inspect');
			expect(stopResult.output.runtime_feedback).toContain('final buffer');
			expect(stopResult.metadata?.['shell_session']).toMatchObject({
				kind: 'shell_session_lifecycle',
				next_action_hint: 'continue_or_inspect',
				session_id: sessionId,
				tool_name: 'shell.session.stop',
			});
			expect(secondStopResult.output.status).toBe(stopResult.output.status);

			const readResult = await readTool.execute(readInput(sessionId), createContext(workspace));

			expect(readResult.status).toBe('success');

			if (readResult.status !== 'success') {
				throw new Error('Expected stopped shell.session.read success.');
			}

			expect(['stopped', 'killed']).toContain(readResult.output.status);
		} finally {
			await stopIfStarted(stopTool, sessionId);
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('marks sessions as timed_out when max runtime is exceeded', async () => {
		const workspace = await createTempWorkspace();
		const { readTool, startTool, stopTool } = createTools();
		let sessionId: string | undefined;

		try {
			const startResult = await startTool.execute(
				startInput({
					args: ['-e', 'setTimeout(() => {}, 1000);'],
					idle_timeout_ms: 1000,
					max_runtime_ms: 50,
				}),
				createContext(workspace),
			);

			expect(startResult.status).toBe('success');

			if (startResult.status !== 'success') {
				throw new Error('Expected shell.session.start success for max runtime timeout.');
			}

			sessionId = startResult.output.session_id;
			await wait(180);

			const readResult = await readTool.execute(readInput(sessionId), createContext(workspace));

			expect(readResult.status).toBe('success');

			if (readResult.status !== 'success') {
				throw new Error('Expected timed-out shell.session.read success.');
			}

			expect(readResult.output.status).toBe('timed_out');
			expect(readResult.output.ended_at).toBeDefined();
		} finally {
			await stopIfStarted(stopTool, sessionId);
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('marks sessions as timed_out when idle timeout is exceeded', async () => {
		const workspace = await createTempWorkspace();
		const { readTool, startTool, stopTool } = createTools();
		let sessionId: string | undefined;

		try {
			const startResult = await startTool.execute(
				startInput({
					args: ['-e', 'setTimeout(() => {}, 1000);'],
					idle_timeout_ms: 50,
					max_runtime_ms: 1000,
				}),
				createContext(workspace),
			);

			expect(startResult.status).toBe('success');

			if (startResult.status !== 'success') {
				throw new Error('Expected shell.session.start success for idle timeout.');
			}

			sessionId = startResult.output.session_id;
			await wait(180);

			const readResult = await readTool.execute(readInput(sessionId), createContext(workspace));

			expect(readResult.status).toBe('success');

			if (readResult.status !== 'success') {
				throw new Error('Expected idle timed-out shell.session.read success.');
			}

			expect(readResult.output.status).toBe('timed_out');
		} finally {
			await stopIfStarted(stopTool, sessionId);
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('keeps a bounded latest-output buffer and reports overflow metadata', async () => {
		const workspace = await createTempWorkspace();
		const { readTool, startTool, stopTool } = createTools();
		let sessionId: string | undefined;

		try {
			const startResult = await startTool.execute(
				startInput({
					args: ['-e', "process.stdout.write('x'.repeat(200)); setTimeout(() => {}, 5000);"],
					idle_timeout_ms: 1000,
					max_runtime_ms: 5000,
					output_limit_bytes: 64,
				}),
				createContext(workspace),
			);

			expect(startResult.status).toBe('success');

			if (startResult.status !== 'success') {
				throw new Error('Expected shell.session.start success for buffer behavior.');
			}

			sessionId = startResult.output.session_id;
			await wait(200);

			const readResult = await readTool.execute(
				readInput(sessionId, {
					max_bytes: 32,
					stream: 'stdout',
				}),
				createContext(workspace),
			);

			expect(readResult.status).toBe('success');

			if (readResult.status !== 'success') {
				throw new Error('Expected shell.session.read success for buffer behavior.');
			}

			expect(readResult.output.stdout).toHaveLength(32);
			expect(readResult.output.stdout_buffer_overflow).toBe(true);
			expect(readResult.output.stdout_truncated).toBe(true);
		} finally {
			await stopIfStarted(stopTool, sessionId);
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns typed NOT_FOUND errors for unknown sessions', async () => {
		const workspace = await createTempWorkspace();
		const { readTool, stopTool } = createTools();

		try {
			const readResult = await readTool.execute(
				readInput('missing-session'),
				createContext(workspace),
			);
			const stopResult = await stopTool.execute(
				stopInput('missing-session'),
				createContext(workspace),
			);

			expect(readResult).toMatchObject({
				error_code: 'NOT_FOUND',
				status: 'error',
				tool_name: 'shell.session.read',
			});
			expect(stopResult).toMatchObject({
				error_code: 'NOT_FOUND',
				status: 'error',
				tool_name: 'shell.session.stop',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('keeps sessions scoped to their owning run', async () => {
		const workspace = await createTempWorkspace();
		const { readTool, startTool, stopTool } = createTools();
		let sessionId: string | undefined;

		try {
			const startResult = await startTool.execute(
				startInput({
					args: ['-e', 'setTimeout(() => {}, 5000);'],
					idle_timeout_ms: 1000,
					max_runtime_ms: 5000,
				}),
				createContext(workspace, 'run_shell_session_owner'),
			);

			expect(startResult.status).toBe('success');

			if (startResult.status !== 'success') {
				throw new Error('Expected shell.session.start success for owner scoping.');
			}

			sessionId = startResult.output.session_id;

			const readResult = await readTool.execute(
				readInput(sessionId),
				createContext(workspace, 'run_shell_session_intruder'),
			);
			const stopResult = await stopTool.execute(
				stopInput(sessionId),
				createContext(workspace, 'run_shell_session_intruder'),
			);

			expect(readResult).toMatchObject({
				details: {
					owner_mismatch: true,
					session_id: sessionId,
				},
				error_code: 'PERMISSION_DENIED',
				status: 'error',
				tool_name: 'shell.session.read',
			});
			expect(stopResult).toMatchObject({
				details: {
					owner_mismatch: true,
					session_id: sessionId,
				},
				error_code: 'PERMISSION_DENIED',
				status: 'error',
				tool_name: 'shell.session.stop',
			});
		} finally {
			if (sessionId) {
				await stopTool.execute(
					stopInput(sessionId, { force: true }),
					createContext(workspace, 'run_shell_session_owner'),
				);
			}
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('blocks risky commands before starting a session', async () => {
		const workspace = await createTempWorkspace();
		const { startTool } = createTools();

		try {
			const result = await startTool.execute(
				startInput({
					args: ['-rf', '/'],
					command: 'rm',
				}),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				error_code: 'PERMISSION_DENIED',
				status: 'error',
				tool_name: 'shell.session.start',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('enforces the active session limit', async () => {
		const workspace = await createTempWorkspace();
		const { startTool, stopTool } = createTools();
		const sessionIds: string[] = [];

		try {
			for (let index = 0; index < MAX_ACTIVE_SESSIONS; index += 1) {
				const startResult = await startTool.execute(
					startInput({
						args: ['-e', 'setTimeout(() => {}, 5000);'],
						idle_timeout_ms: 1000,
						max_runtime_ms: 5000,
					}),
					createContext(workspace),
				);

				expect(startResult.status).toBe('success');

				if (startResult.status !== 'success') {
					throw new Error('Expected shell.session.start success before active limit.');
				}

				sessionIds.push(startResult.output.session_id);
			}

			const blockedResult = await startTool.execute(
				startInput({
					args: ['-e', 'setTimeout(() => {}, 5000);'],
					idle_timeout_ms: 1000,
					max_runtime_ms: 5000,
				}),
				createContext(workspace),
			);

			expect(blockedResult).toMatchObject({
				error_code: 'PERMISSION_DENIED',
				status: 'error',
				tool_name: 'shell.session.start',
			});
		} finally {
			await Promise.all(
				sessionIds.map((sessionId) =>
					stopTool.execute(stopInput(sessionId, { force: true }), createContext(workspace)),
				),
			);
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('is compatible with the central ToolRegistry', () => {
		const registry = new ToolRegistry();

		registry.register(shellSessionStartTool);
		registry.register(shellSessionReadTool);
		registry.register(shellSessionStopTool);

		expect(registry.has('shell.session.start')).toBe(true);
		expect(registry.has('shell.session.read')).toBe(true);
		expect(registry.has('shell.session.stop')).toBe(true);
	});
});
