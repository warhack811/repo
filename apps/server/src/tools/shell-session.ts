import { type ChildProcessByStdio, spawn as nodeSpawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Readable } from 'node:stream';

import type {
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
} from '@runa/types';

import { evaluateCommandRisk, isWithinWorkspaceBoundary } from './shell-exec.js';
import {
	type ShellOutputRedactionContext,
	type ShellOutputRedactionMetadata,
	combineShellOutputRedactionMetadata,
	loadShellOutputRedactionContext,
	redactShellOutput,
} from './shell-output-redaction.js';

export const MAX_ACTIVE_SESSIONS = 8;
export const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
export const MAX_IDLE_TIMEOUT_MS = 120_000;
export const DEFAULT_MAX_RUNTIME_MS = 120_000;
export const MAX_RUNTIME_MS = 300_000;
export const DEFAULT_READ_MAX_BYTES = 16_384;
export const MAX_READ_BYTES = 65_536;
export const SESSION_BUFFER_LIMIT_BYTES = 131_072;
export const FINAL_SESSION_TTL_MS = 60_000;

const FORCE_KILL_GRACE_MS = 250;

type ShellSessionToolName = 'shell.session.read' | 'shell.session.start' | 'shell.session.stop';

export type ShellSessionStatus =
	| 'error'
	| 'exited'
	| 'killed'
	| 'running'
	| 'stopped'
	| 'timed_out';

type ShellSessionStreamSelection = 'both' | 'stderr' | 'stdout';

export type ShellSessionNextActionHint =
	| 'continue_or_inspect'
	| 'fix_or_retry'
	| 'read_later_or_stop'
	| 'read_or_stop';

export interface ShellSessionRuntimeMetadata {
	readonly kind: 'shell_session_lifecycle';
	readonly exit_code?: number | null;
	readonly has_output?: boolean;
	readonly next_action_hint: ShellSessionNextActionHint;
	readonly redacted_occurrence_count: number;
	readonly redacted_source_kinds: readonly string[];
	readonly redaction_applied: boolean;
	readonly secret_values_exposed: false;
	readonly session_id: string;
	readonly signal?: NodeJS.Signals | null;
	readonly status: ShellSessionStatus;
	readonly stderr_available_bytes?: number;
	readonly stderr_buffer_overflow?: boolean;
	readonly stderr_truncated?: boolean;
	readonly stdout_available_bytes?: number;
	readonly stdout_buffer_overflow?: boolean;
	readonly stdout_truncated?: boolean;
	readonly tool_name: ShellSessionToolName;
}

export type ShellSessionStartArguments = ToolArguments & {
	readonly args?: readonly string[];
	readonly command: string;
	readonly idle_timeout_ms?: number;
	readonly max_runtime_ms?: number;
	readonly output_limit_bytes?: number;
	readonly working_directory?: string;
};

export type ShellSessionReadArguments = ToolArguments & {
	readonly max_bytes?: number;
	readonly session_id: string;
	readonly stream?: ShellSessionStreamSelection;
};

export type ShellSessionStopArguments = ToolArguments & {
	readonly force?: boolean;
	readonly session_id: string;
};

export interface ShellSessionStartData extends ShellOutputRedactionMetadata {
	readonly args: readonly string[];
	readonly command: string;
	readonly idle_timeout_ms: number;
	readonly max_runtime_ms: number;
	readonly next_action_hint: ShellSessionNextActionHint;
	readonly runtime_feedback: string;
	readonly session_id: string;
	readonly started_at: string;
	readonly status: 'running';
	readonly stderr_available_bytes: number;
	readonly stdout_available_bytes: number;
	readonly working_directory: string;
}

export interface ShellSessionReadData extends ShellOutputRedactionMetadata {
	readonly duration_ms: number;
	readonly ended_at?: string;
	readonly exit_code: number | null;
	readonly has_output: boolean;
	readonly next_action_hint: ShellSessionNextActionHint;
	readonly runtime_feedback: string;
	readonly session_id: string;
	readonly signal: NodeJS.Signals | null;
	readonly started_at: string;
	readonly status: ShellSessionStatus;
	readonly stderr: string;
	readonly stderr_available_bytes: number;
	readonly stderr_buffer_overflow: boolean;
	readonly stderr_truncated: boolean;
	readonly stdout: string;
	readonly stdout_available_bytes: number;
	readonly stdout_buffer_overflow: boolean;
	readonly stdout_truncated: boolean;
}

export interface ShellSessionStopData extends ShellOutputRedactionMetadata {
	readonly exit_code: number | null;
	readonly next_action_hint: ShellSessionNextActionHint;
	readonly runtime_feedback: string;
	readonly session_id: string;
	readonly signal: NodeJS.Signals | null;
	readonly status: Exclude<ShellSessionStatus, 'running'>;
	readonly stopped_at: string;
}

export type ShellSessionStartInput = ToolCallInput<
	'shell.session.start',
	ShellSessionStartArguments
>;
export type ShellSessionReadInput = ToolCallInput<'shell.session.read', ShellSessionReadArguments>;
export type ShellSessionStopInput = ToolCallInput<'shell.session.stop', ShellSessionStopArguments>;

export type ShellSessionStartResult = ToolResult<'shell.session.start', ShellSessionStartData>;
export type ShellSessionReadResult = ToolResult<'shell.session.read', ShellSessionReadData>;
export type ShellSessionStopResult = ToolResult<'shell.session.stop', ShellSessionStopData>;

type ShellSessionAnyInput = ShellSessionReadInput | ShellSessionStartInput | ShellSessionStopInput;

interface ShellSessionDependencies {
	readonly now: () => number;
	readonly random_uuid: () => string;
	readonly spawn: typeof nodeSpawn;
	readonly stat: typeof stat;
}

interface BoundedOutputSnapshot {
	readonly buffer_overflow: boolean;
	readonly byte_length: number;
	readonly text: string;
	readonly truncated: boolean;
}

class BoundedOutputBuffer {
	#byteLength = 0;
	#chunks: Buffer[] = [];
	#overflow = false;

	constructor(readonly limit_bytes: number) {}

	append(chunk: Buffer | string): void {
		let bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8');

		if (bufferChunk.byteLength > this.limit_bytes) {
			bufferChunk = bufferChunk.subarray(bufferChunk.byteLength - this.limit_bytes);
			this.#chunks = [bufferChunk];
			this.#byteLength = bufferChunk.byteLength;
			this.#overflow = true;
			return;
		}

		this.#chunks.push(bufferChunk);
		this.#byteLength += bufferChunk.byteLength;

		while (this.#byteLength > this.limit_bytes) {
			const firstChunk = this.#chunks[0];

			if (firstChunk === undefined) {
				this.#byteLength = 0;
				break;
			}

			const overflowBytes = this.#byteLength - this.limit_bytes;

			if (firstChunk.byteLength <= overflowBytes) {
				this.#chunks.shift();
				this.#byteLength -= firstChunk.byteLength;
			} else {
				this.#chunks[0] = firstChunk.subarray(overflowBytes);
				this.#byteLength -= overflowBytes;
			}

			this.#overflow = true;
		}
	}

	get byte_length(): number {
		return this.#byteLength;
	}

	get overflow(): boolean {
		return this.#overflow;
	}

	snapshot(maxBytes: number): BoundedOutputSnapshot {
		const combined = Buffer.concat(this.#chunks);
		const truncated = combined.byteLength > maxBytes;
		const selected = truncated ? combined.subarray(combined.byteLength - maxBytes) : combined;

		return {
			buffer_overflow: this.#overflow,
			byte_length: this.#byteLength,
			text: selected.toString('utf8'),
			truncated,
		};
	}
}

interface InternalShellSession {
	readonly args: readonly string[];
	readonly child: ChildProcessByStdio<null, Readable, Readable>;
	readonly command: string;
	readonly created_at_ms: number;
	readonly idle_timeout_ms: number;
	readonly max_runtime_ms: number;
	readonly owner_run_id: string;
	readonly owner_trace_id?: string;
	readonly redaction_context: ShellOutputRedactionContext;
	readonly session_id: string;
	readonly started_at: string;
	readonly stderr: BoundedOutputBuffer;
	readonly stdout: BoundedOutputBuffer;
	readonly working_directory: string;
	close_promise: Promise<void>;
	ended_at?: string;
	ended_at_ms?: number;
	exit_code: number | null;
	final_ttl_handle?: NodeJS.Timeout;
	idle_handle?: NodeJS.Timeout;
	max_runtime_handle?: NodeJS.Timeout;
	requested_final_status?: Exclude<ShellSessionStatus, 'running'>;
	signal: NodeJS.Signals | null;
	status: ShellSessionStatus;
	stop_force_handle?: NodeJS.Timeout;
}

export class ShellSessionManager {
	#dependencies: ShellSessionDependencies;
	#exitCleanupInstalled = false;
	#sessions = new Map<string, InternalShellSession>();

	constructor(dependencies: Partial<ShellSessionDependencies> = {}) {
		this.#dependencies = {
			now: dependencies.now ?? Date.now,
			random_uuid: dependencies.random_uuid ?? randomUUID,
			spawn: dependencies.spawn ?? nodeSpawn,
			stat: dependencies.stat ?? stat,
		};
	}

	installProcessExitCleanup(): void {
		if (this.#exitCleanupInstalled) {
			return;
		}

		this.#exitCleanupInstalled = true;
		process.once('exit', () => {
			this.stopAllForProcessExit();
		});
	}

	get active_session_count(): number {
		let count = 0;

		for (const session of this.#sessions.values()) {
			if (session.status === 'running') {
				count += 1;
			}
		}

		return count;
	}

	async startSession(
		input: ShellSessionStartInput,
		context: ToolExecutionContext,
	): Promise<ShellSessionStartResult> {
		this.#cleanupExpiredFinalSessions();

		const command = input.arguments.command.trim();
		const args = input.arguments.args ?? [];
		const contextWorkspacePath = context.working_directory ?? process.cwd();
		const workingDirectory = resolveWorkingDirectory(input.arguments.working_directory, context);
		const idleTimeoutMs = normalizePositiveInteger(
			input.arguments.idle_timeout_ms,
			DEFAULT_IDLE_TIMEOUT_MS,
			MAX_IDLE_TIMEOUT_MS,
		);
		const maxRuntimeMs = normalizePositiveInteger(
			input.arguments.max_runtime_ms,
			DEFAULT_MAX_RUNTIME_MS,
			MAX_RUNTIME_MS,
		);
		const outputLimitBytes = normalizePositiveInteger(
			input.arguments.output_limit_bytes,
			SESSION_BUFFER_LIMIT_BYTES,
			SESSION_BUFFER_LIMIT_BYTES,
		);

		if (!command) {
			return createErrorResult(input, 'INVALID_INPUT', 'Command must be a non-empty string.', {
				reason: 'empty_command',
			});
		}

		if (!Array.isArray(args) || args.some((value) => typeof value !== 'string')) {
			return createErrorResult(input, 'INVALID_INPUT', 'args must be an array of strings.', {
				reason: 'invalid_args',
			});
		}

		if (idleTimeoutMs === undefined) {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				'idle_timeout_ms must be a positive integer when provided.',
				{ reason: 'invalid_idle_timeout' },
			);
		}

		if (maxRuntimeMs === undefined) {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				'max_runtime_ms must be a positive integer when provided.',
				{ reason: 'invalid_max_runtime' },
			);
		}

		if (outputLimitBytes === undefined) {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				'output_limit_bytes must be a positive integer when provided.',
				{ reason: 'invalid_output_limit' },
			);
		}

		if (this.active_session_count >= MAX_ACTIVE_SESSIONS) {
			return createErrorResult(
				input,
				'PERMISSION_DENIED',
				`Maximum active shell sessions reached: ${MAX_ACTIVE_SESSIONS}`,
				{
					active_session_count: this.active_session_count,
					max_active_sessions: MAX_ACTIVE_SESSIONS,
				},
				true,
			);
		}

		const riskAssessment = evaluateCommandRisk(command, args, {
			working_directory: workingDirectory,
			workspace_path: contextWorkspacePath,
		});

		if (riskAssessment.blocked) {
			return createErrorResult(
				input,
				'PERMISSION_DENIED',
				`Command blocked by safety policy: ${
					riskAssessment.risk_detail ?? riskAssessment.matched_pattern
				}`,
				{
					command,
					matched_pattern: riskAssessment.matched_pattern,
					risk_category: riskAssessment.risk_category,
				},
			);
		}

		if (!isWithinWorkspaceBoundary(workingDirectory, contextWorkspacePath)) {
			return createErrorResult(
				input,
				'PERMISSION_DENIED',
				`Working directory is outside workspace boundary: ${workingDirectory}`,
				{
					command,
					resolved_workspace: contextWorkspacePath,
					working_directory: workingDirectory,
				},
			);
		}

		const workingDirectoryError = await this.#validateWorkingDirectory(
			input,
			command,
			workingDirectory,
		);

		if (workingDirectoryError) {
			return workingDirectoryError;
		}

		const redactionContext = await resolveRedactionContext(contextWorkspacePath);
		const commandSurface = redactCommandSurface(command, args, redactionContext);
		const sessionId = this.#dependencies.random_uuid();
		const startedAtMs = this.#dependencies.now();
		const startedAt = new Date(startedAtMs).toISOString();
		const child = this.#dependencies.spawn(command, [...args], {
			cwd: workingDirectory,
			env: buildSafeEnvironment(),
			shell: false,
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true,
		});

		const session: InternalShellSession = {
			args,
			child,
			close_promise: Promise.resolve(),
			command,
			created_at_ms: startedAtMs,
			exit_code: null,
			idle_timeout_ms: idleTimeoutMs,
			max_runtime_ms: maxRuntimeMs,
			owner_run_id: context.run_id,
			owner_trace_id: context.trace_id,
			redaction_context: redactionContext,
			session_id: sessionId,
			signal: null,
			started_at: startedAt,
			status: 'running',
			stderr: new BoundedOutputBuffer(outputLimitBytes),
			stdout: new BoundedOutputBuffer(outputLimitBytes),
			working_directory: workingDirectory,
		};

		session.close_promise = new Promise((resolveClose) => {
			const finalizeAndResolve = (
				status: Exclude<ShellSessionStatus, 'running'>,
				exitCode: number | null,
				signal: NodeJS.Signals | null,
			) => {
				this.#finalizeSession(session, status, exitCode, signal);
				resolveClose();
			};

			child.stdout.on('data', (chunk: Buffer | string) => {
				session.stdout.append(chunk);
				this.#resetIdleTimer(session);
			});

			child.stderr.on('data', (chunk: Buffer | string) => {
				session.stderr.append(chunk);
				this.#resetIdleTimer(session);
			});

			child.once('error', (error: unknown) => {
				const message = error instanceof Error ? error.message : 'Unknown process spawn error.';
				session.stderr.append(message);
				finalizeAndResolve('error', null, null);
			});

			child.once('close', (exitCode, signal) => {
				const finalStatus = session.requested_final_status ?? (exitCode === 0 ? 'exited' : 'error');

				finalizeAndResolve(finalStatus, exitCode, signal);
			});
		});

		this.#sessions.set(sessionId, session);

		// Immediately flush any available stdout/stderr
		const flushAvailableOutput = (stream: Readable, buffer: BoundedOutputBuffer): void => {
			try {
				let chunk: Buffer | string | null;
				while ((chunk = stream.read()) !== null) {
					buffer.append(chunk);
				}
			} catch {
				// Stream closed or not ready yet
			}
		};

		flushAvailableOutput(child.stdout, session.stdout);
		flushAvailableOutput(child.stderr, session.stderr);

		this.#resetIdleTimer(session);
		session.max_runtime_handle = setTimeout(() => {
			this.#terminateForTimeout(session);
		}, maxRuntimeMs);
		const output: ShellSessionStartData = {
			args: commandSurface.args,
			command: commandSurface.command,
			idle_timeout_ms: idleTimeoutMs,
			max_runtime_ms: maxRuntimeMs,
			next_action_hint: 'read_or_stop',
			redacted_occurrence_count: commandSurface.metadata.redacted_occurrence_count,
			redacted_source_kinds: commandSurface.metadata.redacted_source_kinds,
			redaction_applied: commandSurface.metadata.redaction_applied,
			runtime_feedback: `Shell session ${sessionId} started and is running. Use shell.session.read to inspect output or shell.session.stop to end it.`,
			secret_values_exposed: false,
			session_id: sessionId,
			started_at: startedAt,
			status: 'running',
			stderr_available_bytes: 0,
			stdout_available_bytes: 0,
			working_directory: workingDirectory,
		};

		return createSuccessResult(input, output);
	}

	async readSession(
		input: ShellSessionReadInput,
		context: ToolExecutionContext,
	): Promise<ShellSessionReadResult> {
		this.#cleanupExpiredFinalSessions();

		const sessionId = input.arguments.session_id.trim();
		const session = this.#sessions.get(sessionId);
		const maxBytes = normalizePositiveInteger(
			input.arguments.max_bytes,
			DEFAULT_READ_MAX_BYTES,
			MAX_READ_BYTES,
		);
		const stream = input.arguments.stream ?? 'both';

		if (!sessionId) {
			return createErrorResult(input, 'INVALID_INPUT', 'session_id must be a non-empty string.', {
				reason: 'empty_session_id',
			});
		}

		if (maxBytes === undefined) {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				'max_bytes must be a positive integer when provided.',
				{ reason: 'invalid_max_bytes' },
			);
		}

		if (stream !== 'both' && stream !== 'stderr' && stream !== 'stdout') {
			return createErrorResult(input, 'INVALID_INPUT', 'stream must be stdout, stderr, or both.', {
				reason: 'invalid_stream',
			});
		}

		if (!session) {
			return createErrorResult(input, 'NOT_FOUND', `Shell session not found: ${sessionId}`, {
				session_id: sessionId,
			});
		}

		const ownershipError = validateSessionOwnership(input, session, context);

		if (ownershipError) {
			return ownershipError;
		}

		return createSuccessResult(input, this.#buildReadData(session, maxBytes, stream));
	}

	async stopSession(
		input: ShellSessionStopInput,
		context: ToolExecutionContext,
	): Promise<ShellSessionStopResult> {
		this.#cleanupExpiredFinalSessions();

		const sessionId = input.arguments.session_id.trim();
		const force = input.arguments.force ?? false;
		const session = this.#sessions.get(sessionId);

		if (!sessionId) {
			return createErrorResult(input, 'INVALID_INPUT', 'session_id must be a non-empty string.', {
				reason: 'empty_session_id',
			});
		}

		if (typeof force !== 'boolean') {
			return createErrorResult(input, 'INVALID_INPUT', 'force must be a boolean when provided.', {
				reason: 'invalid_force',
			});
		}

		if (!session) {
			return createErrorResult(input, 'NOT_FOUND', `Shell session not found: ${sessionId}`, {
				session_id: sessionId,
			});
		}

		const ownershipError = validateSessionOwnership(input, session, context);

		if (ownershipError) {
			return ownershipError;
		}

		if (session.status === 'running') {
			await this.#requestStop(session, force);
		}

		const status = toFinalSessionStatus(session.status);
		const metadata = combineShellOutputRedactionMetadata([]);
		const output: ShellSessionStopData = {
			exit_code: session.exit_code,
			next_action_hint: 'continue_or_inspect',
			redacted_occurrence_count: metadata.redacted_occurrence_count,
			redacted_source_kinds: metadata.redacted_source_kinds,
			redaction_applied: metadata.redaction_applied,
			runtime_feedback: `Shell session ${sessionId} is ${status}. Use shell.session.read while the final buffer is still available if you need the captured output.`,
			secret_values_exposed: false,
			session_id: sessionId,
			signal: session.signal,
			status,
			stopped_at: new Date(this.#dependencies.now()).toISOString(),
		};

		return createSuccessResult(input, output);
	}

	stopAllForProcessExit(): void {
		for (const session of this.#sessions.values()) {
			if (session.status === 'running') {
				session.requested_final_status = 'killed';
				this.#killChild(session, true);
			}
		}
	}

	async #validateWorkingDirectory(
		input: ShellSessionStartInput,
		command: string,
		workingDirectory: string,
	): Promise<ToolResultError<'shell.session.start'> | undefined> {
		try {
			const workingDirectoryStats = await this.#dependencies.stat(workingDirectory);

			if (!workingDirectoryStats.isDirectory()) {
				return createErrorResult(
					input,
					'INVALID_INPUT',
					`Working directory is not a directory: ${workingDirectory}`,
					{
						command,
						working_directory: workingDirectory,
					},
				);
			}
		} catch (error: unknown) {
			if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
				return createErrorResult(
					input,
					'NOT_FOUND',
					`Working directory not found: ${workingDirectory}`,
					{
						command,
						working_directory: workingDirectory,
					},
				);
			}

			if (error instanceof Error) {
				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					`Failed to validate working directory: ${error.message}`,
					{
						command,
						working_directory: workingDirectory,
					},
				);
			}

			return createErrorResult(
				input,
				'UNKNOWN',
				`Failed to validate working directory: ${workingDirectory}`,
				{
					command,
					working_directory: workingDirectory,
				},
			);
		}

		return undefined;
	}

	#buildReadData(
		session: InternalShellSession,
		maxBytes: number,
		stream: ShellSessionStreamSelection,
	): ShellSessionReadData {
		const includeStdout = stream === 'both' || stream === 'stdout';
		const includeStderr = stream === 'both' || stream === 'stderr';
		const stdoutSnapshot = includeStdout
			? session.stdout.snapshot(maxBytes)
			: emptyOutputSnapshot();
		const stderrSnapshot = includeStderr
			? session.stderr.snapshot(maxBytes)
			: emptyOutputSnapshot();
		const redactedStdout = redactShellOutput(stdoutSnapshot.text, session.redaction_context);
		const redactedStderr = redactShellOutput(stderrSnapshot.text, session.redaction_context);
		const metadata = combineShellOutputRedactionMetadata([
			redactedStdout.metadata,
			redactedStderr.metadata,
		]);
		const hasOutput = stdoutSnapshot.byte_length > 0 || stderrSnapshot.byte_length > 0;
		const nextActionHint: ShellSessionNextActionHint =
			session.status === 'running'
				? hasOutput
					? 'read_or_stop'
					: 'read_later_or_stop'
				: 'continue_or_inspect';

		return {
			duration_ms: this.#getDurationMs(session),
			ended_at: session.ended_at,
			exit_code: session.exit_code,
			has_output: hasOutput,
			next_action_hint: nextActionHint,
			redacted_occurrence_count: metadata.redacted_occurrence_count,
			redacted_source_kinds: metadata.redacted_source_kinds,
			redaction_applied: metadata.redaction_applied,
			runtime_feedback: buildReadRuntimeFeedback({
				has_output: hasOutput,
				session_id: session.session_id,
				status: session.status,
			}),
			secret_values_exposed: false,
			session_id: session.session_id,
			signal: session.signal,
			started_at: session.started_at,
			status: session.status,
			stderr: redactedStderr.text,
			stderr_available_bytes: stderrSnapshot.byte_length,
			stderr_buffer_overflow: stderrSnapshot.buffer_overflow,
			stderr_truncated: stderrSnapshot.truncated,
			stdout: redactedStdout.text,
			stdout_available_bytes: stdoutSnapshot.byte_length,
			stdout_buffer_overflow: stdoutSnapshot.buffer_overflow,
			stdout_truncated: stdoutSnapshot.truncated,
		};
	}

	#cleanupExpiredFinalSessions(): void {
		const now = this.#dependencies.now();

		for (const [sessionId, session] of this.#sessions.entries()) {
			if (session.status === 'running' || session.ended_at_ms === undefined) {
				continue;
			}

			if (now - session.ended_at_ms >= FINAL_SESSION_TTL_MS) {
				this.#sessions.delete(sessionId);
			}
		}
	}

	#finalizeSession(
		session: InternalShellSession,
		status: Exclude<ShellSessionStatus, 'running'>,
		exitCode: number | null,
		signal: NodeJS.Signals | null,
	): void {
		if (session.status !== 'running') {
			return;
		}

		if (session.idle_handle) {
			clearTimeout(session.idle_handle);
		}

		if (session.max_runtime_handle) {
			clearTimeout(session.max_runtime_handle);
		}

		if (session.stop_force_handle) {
			clearTimeout(session.stop_force_handle);
		}

		session.ended_at_ms = this.#dependencies.now();
		session.ended_at = new Date(session.ended_at_ms).toISOString();
		session.exit_code = exitCode;
		session.signal = signal;
		session.status = status;
		session.final_ttl_handle = setTimeout(() => {
			this.#sessions.delete(session.session_id);
		}, FINAL_SESSION_TTL_MS);
		session.final_ttl_handle.unref?.();
	}

	#getDurationMs(session: InternalShellSession): number {
		return (session.ended_at_ms ?? this.#dependencies.now()) - session.created_at_ms;
	}

	#killChild(session: InternalShellSession, force: boolean): void {
		if (process.platform === 'win32' && force && session.child.pid !== undefined) {
			const taskkill = nodeSpawn('taskkill', ['/pid', String(session.child.pid), '/t', '/f'], {
				stdio: 'ignore',
				windowsHide: true,
			});
			taskkill.once('error', () => {
				session.child.kill('SIGKILL');
			});
			return;
		}

		session.child.kill(force ? 'SIGKILL' : undefined);
	}

	async #requestStop(session: InternalShellSession, force: boolean): Promise<void> {
		session.requested_final_status = force ? 'killed' : 'stopped';
		this.#killChild(session, force);

		if (!force) {
			session.stop_force_handle = setTimeout(() => {
				if (session.status === 'running') {
					session.requested_final_status = 'killed';
					this.#killChild(session, true);
				}
			}, FORCE_KILL_GRACE_MS);
		}

		await Promise.race([
			session.close_promise,
			new Promise<void>((resolveTimeout) => {
				setTimeout(resolveTimeout, FORCE_KILL_GRACE_MS * 4);
			}),
		]);

		if (session.status === 'running') {
			this.#finalizeSession(session, force ? 'killed' : 'stopped', null, null);
		}
	}

	#resetIdleTimer(session: InternalShellSession): void {
		if (session.status !== 'running') {
			return;
		}

		if (session.idle_handle) {
			clearTimeout(session.idle_handle);
		}

		session.idle_handle = setTimeout(() => {
			this.#terminateForTimeout(session);
		}, session.idle_timeout_ms);
	}

	#terminateForTimeout(session: InternalShellSession): void {
		if (session.status !== 'running') {
			return;
		}

		session.requested_final_status = 'timed_out';
		this.#killChild(session, false);
		session.stop_force_handle = setTimeout(() => {
			if (session.status === 'running') {
				this.#killChild(session, true);
			}
		}, FORCE_KILL_GRACE_MS);
	}
}

function buildSafeEnvironment(): NodeJS.ProcessEnv {
	const allowedKeys = [
		'COMSPEC',
		'HOME',
		'LANG',
		'LC_ALL',
		'PATH',
		'PATHEXT',
		'SYSTEMROOT',
		'TEMP',
		'TMP',
		'USERPROFILE',
		'WINDIR',
	] as const;
	const safeEnvironment: NodeJS.ProcessEnv = {};

	for (const key of allowedKeys) {
		const value = process.env[key];

		if (value !== undefined) {
			safeEnvironment[key] = value;
		}
	}

	return safeEnvironment;
}

function createErrorResult<TInput extends ShellSessionAnyInput>(
	input: TInput,
	error_code: ToolResultError<TInput['tool_name']>['error_code'],
	error_message: string,
	details?: ToolResultError<TInput['tool_name']>['details'],
	retryable?: boolean,
): ToolResultError<TInput['tool_name']> {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: input.tool_name,
	};
}

function createSuccessResult<
	TInput extends ShellSessionAnyInput,
	TOutput extends ShellSessionReadData | ShellSessionStartData | ShellSessionStopData,
>(input: TInput, output: TOutput): ToolResultSuccess<TInput['tool_name'], TOutput> {
	return {
		call_id: input.call_id,
		metadata: {
			shell_session: buildShellSessionRuntimeMetadata(input.tool_name, output),
		},
		output,
		status: 'success',
		tool_name: input.tool_name,
	};
}

function buildShellSessionRuntimeMetadata(
	toolName: ShellSessionToolName,
	output: ShellSessionReadData | ShellSessionStartData | ShellSessionStopData,
): ShellSessionRuntimeMetadata {
	const readOutput = isShellSessionReadData(output) ? output : undefined;

	return {
		exit_code: 'exit_code' in output ? output.exit_code : undefined,
		has_output: readOutput?.has_output,
		kind: 'shell_session_lifecycle',
		next_action_hint: output.next_action_hint,
		redacted_occurrence_count: output.redacted_occurrence_count,
		redacted_source_kinds: output.redacted_source_kinds,
		redaction_applied: output.redaction_applied,
		secret_values_exposed: false,
		session_id: output.session_id,
		signal: 'signal' in output ? output.signal : undefined,
		status: output.status,
		stderr_available_bytes:
			'stderr_available_bytes' in output ? output.stderr_available_bytes : undefined,
		stderr_buffer_overflow: readOutput?.stderr_buffer_overflow,
		stderr_truncated: readOutput?.stderr_truncated,
		stdout_available_bytes:
			'stdout_available_bytes' in output ? output.stdout_available_bytes : undefined,
		stdout_buffer_overflow: readOutput?.stdout_buffer_overflow,
		stdout_truncated: readOutput?.stdout_truncated,
		tool_name: toolName,
	};
}

function isShellSessionReadData(
	output: ShellSessionReadData | ShellSessionStartData | ShellSessionStopData,
): output is ShellSessionReadData {
	return 'stdout' in output && 'stderr' in output;
}

function buildReadRuntimeFeedback(input: {
	readonly has_output: boolean;
	readonly session_id: string;
	readonly status: ShellSessionStatus;
}): string {
	if (input.status === 'running') {
		if (!input.has_output) {
			return `Shell session ${input.session_id} is still running. No buffered output is available for the selected stream yet. Read again later or stop it if the command is no longer needed.`;
		}

		return `Shell session ${input.session_id} is still running and returned buffered output. Continue only if more output is expected, otherwise stop the session.`;
	}

	if (input.status === 'timed_out') {
		return `Shell session ${input.session_id} timed out. Inspect the captured output, then decide whether a shorter or different command is needed.`;
	}

	if (input.status === 'error') {
		return `Shell session ${input.session_id} finished with an error status. Inspect stdout, stderr, exit_code, and signal before retrying.`;
	}

	return `Shell session ${input.session_id} is ${input.status}. Inspect the captured output and continue with the next model step.`;
}

function validateSessionOwnership<TInput extends ShellSessionReadInput | ShellSessionStopInput>(
	input: TInput,
	session: InternalShellSession,
	context: ToolExecutionContext,
): ToolResultError<TInput['tool_name']> | undefined {
	if (session.owner_run_id === context.run_id) {
		return undefined;
	}

	return createErrorResult(
		input,
		'PERMISSION_DENIED',
		'Shell session belongs to a different run and cannot be accessed from this run.',
		{
			owner_mismatch: true,
			session_id: session.session_id,
		},
		false,
	);
}

function createToolMetadata() {
	return {
		capability_class: 'shell',
		narration_policy: 'required',
		requires_approval: true,
		risk_level: 'high',
		side_effect_level: 'execute',
		tags: ['argv', 'bounded-session', 'lifecycle', 'subprocess'],
	} as const;
}

function emptyOutputSnapshot(): BoundedOutputSnapshot {
	return {
		buffer_overflow: false,
		byte_length: 0,
		text: '',
		truncated: false,
	};
}

function normalizePositiveInteger(
	value: number | undefined,
	defaultValue: number,
	maxValue: number,
): number | undefined {
	if (value === undefined) {
		return defaultValue;
	}

	if (!Number.isInteger(value) || value <= 0) {
		return undefined;
	}

	return Math.min(value, maxValue);
}

function toFinalSessionStatus(status: ShellSessionStatus): Exclude<ShellSessionStatus, 'running'> {
	return status === 'running' ? 'killed' : status;
}

function redactCommandSurface(
	command: string,
	args: readonly string[],
	redactionContext: ShellOutputRedactionContext,
): {
	readonly args: readonly string[];
	readonly command: string;
	readonly metadata: ShellOutputRedactionMetadata;
} {
	const redactedCommand = redactShellOutput(command, redactionContext);
	const redactedArgs = args.map((arg) => redactShellOutput(arg, redactionContext));
	const metadata = combineShellOutputRedactionMetadata([
		redactedCommand.metadata,
		...redactedArgs.map((arg) => arg.metadata),
	]);

	return {
		args: redactedArgs.map((arg) => arg.text),
		command: redactedCommand.text,
		metadata,
	};
}

async function resolveRedactionContext(
	workspacePath: string,
): Promise<ShellOutputRedactionContext> {
	try {
		return await loadShellOutputRedactionContext(workspacePath);
	} catch {
		return {
			env: process.env,
			workspace_path: workspacePath,
		};
	}
}

function resolveWorkingDirectory(
	workingDirectory: string | undefined,
	context: ToolExecutionContext,
): string {
	const basePath = workingDirectory ?? context.working_directory ?? process.cwd();

	return resolve(basePath);
}

function createShellSessionStartTool(
	manager: ShellSessionManager,
): ToolDefinition<ShellSessionStartInput, ShellSessionStartResult> {
	return {
		callable_schema: {
			parameters: {
				args: {
					description: 'Argument list for the executable.',
					items: {
						type: 'string',
					},
					type: 'array',
				},
				command: {
					description: 'Executable to run as a bounded background session.',
					required: true,
					type: 'string',
				},
				idle_timeout_ms: {
					description: 'Maximum idle time without output before termination.',
					type: 'number',
				},
				max_runtime_ms: {
					description: 'Maximum runtime before termination.',
					type: 'number',
				},
				output_limit_bytes: {
					description: 'Per-stream bounded buffer size.',
					type: 'number',
				},
				working_directory: {
					description: 'Optional working directory for the subprocess.',
					type: 'string',
				},
			},
		},
		description:
			'Starts a bounded argv-based subprocess session with lifecycle limits and redacted output surfaces.',
		execute: (input, context) => manager.startSession(input, context),
		metadata: createToolMetadata(),
		name: 'shell.session.start',
	};
}

function createShellSessionReadTool(
	manager: ShellSessionManager,
): ToolDefinition<ShellSessionReadInput, ShellSessionReadResult> {
	return {
		callable_schema: {
			parameters: {
				max_bytes: {
					description: 'Maximum bytes to read per stream.',
					type: 'number',
				},
				session_id: {
					description: 'Shell session identifier.',
					required: true,
					type: 'string',
				},
				stream: {
					description: 'Output stream to read.',
					enum: ['both', 'stderr', 'stdout'],
					type: 'string',
				},
			},
		},
		description: 'Reads bounded, redacted output from a shell session.',
		execute: (input, context) => manager.readSession(input, context),
		metadata: createToolMetadata(),
		name: 'shell.session.read',
	};
}

function createShellSessionStopTool(
	manager: ShellSessionManager,
): ToolDefinition<ShellSessionStopInput, ShellSessionStopResult> {
	return {
		callable_schema: {
			parameters: {
				force: {
					description: 'Force process-tree termination when supported.',
					type: 'boolean',
				},
				session_id: {
					description: 'Shell session identifier.',
					required: true,
					type: 'string',
				},
			},
		},
		description: 'Stops a shell session and keeps final output readable until cleanup.',
		execute: (input, context) => manager.stopSession(input, context),
		metadata: createToolMetadata(),
		name: 'shell.session.stop',
	};
}

export function createShellSessionTools(
	manager = new ShellSessionManager(),
): readonly [
	ToolDefinition<ShellSessionStartInput, ShellSessionStartResult>,
	ToolDefinition<ShellSessionReadInput, ShellSessionReadResult>,
	ToolDefinition<ShellSessionStopInput, ShellSessionStopResult>,
] {
	return [
		createShellSessionStartTool(manager),
		createShellSessionReadTool(manager),
		createShellSessionStopTool(manager),
	];
}

export const defaultShellSessionManager = new ShellSessionManager();
defaultShellSessionManager.installProcessExitCleanup();

export const [shellSessionStartTool, shellSessionReadTool, shellSessionStopTool] =
	createShellSessionTools(defaultShellSessionManager);
