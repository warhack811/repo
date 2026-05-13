import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { basename, resolve, sep } from 'node:path';

import type {
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
} from '@runa/types';

import {
	type ShellOutputRedactionContext,
	type ShellOutputRedactionMetadata,
	combineShellOutputRedactionMetadata,
	loadShellOutputRedactionContext,
	redactShellOutput,
} from './shell-output-redaction.js';

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_OUTPUT_LIMIT_BYTES = 16_384;
const FORCE_KILL_GRACE_MS = 250;

export type ShellExecArguments = ToolArguments & {
	readonly args?: readonly string[];
	readonly command: string;
	readonly timeout_ms?: number;
	readonly working_directory?: string;
};

export interface ShellExecSuccessData {
	readonly args: readonly string[];
	readonly command: string;
	readonly duration_ms: number;
	readonly exit_code: number | null;
	readonly redacted_occurrence_count: number;
	readonly redacted_source_kinds: readonly string[];
	readonly redaction_applied: boolean;
	readonly secret_values_exposed: false;
	readonly signal: NodeJS.Signals | null;
	readonly stderr: string;
	readonly stderr_truncated: boolean;
	readonly stdout: string;
	readonly stdout_truncated: boolean;
	readonly timed_out: false;
	readonly working_directory: string;
}

export type ShellExecInput = ToolCallInput<'shell.exec', ShellExecArguments>;

export type ShellExecSuccessResult = ToolResultSuccess<'shell.exec', ShellExecSuccessData>;

export type ShellExecErrorResult = ToolResultError<'shell.exec'>;

export type ShellExecResult = ToolResult<'shell.exec', ShellExecSuccessData>;

interface OutputCaptureState {
	readonly chunks: Buffer[];
	captured_bytes: number;
	truncated: boolean;
}

interface ProcessExecutionOutcome {
	readonly duration_ms: number;
	readonly exit_code: number | null;
	readonly signal: NodeJS.Signals | null;
	readonly stderr: string;
	readonly stderr_truncated: boolean;
	readonly stdout: string;
	readonly stdout_truncated: boolean;
	readonly timed_out: boolean;
}

interface ShellExecDependencies {
	readonly now: () => number;
	readonly output_limit_bytes: number;
	readonly spawn: typeof spawn;
	readonly stat: typeof stat;
}

const WINDOWS_EXECUTABLE_EXTENSION_PATTERN = /\.(?:bat|cmd|com|exe|ps1)$/i;

const SYSTEM_TASKKILL_TARGETS = new Set([
	'csrss.exe',
	'idle',
	'lsass.exe',
	'memcompression',
	'registry',
	'services.exe',
	'smss.exe',
	'svchost.exe',
	'system',
	'wininit.exe',
	'winlogon.exe',
]);

export interface CommandRiskAssessment {
	readonly blocked: boolean;
	readonly matched_pattern?: string;
	readonly risk_category?:
		| 'data_destruction'
		| 'network_exfiltration'
		| 'privilege_escalation'
		| 'system_control';
	readonly risk_detail?: string;
}

interface CommandRiskEvaluationOptions {
	readonly working_directory?: string;
	readonly workspace_path?: string;
}

function resolveWorkingDirectory(input: ShellExecInput, context: ToolExecutionContext): string {
	const basePath = input.arguments.working_directory ?? context.working_directory ?? process.cwd();

	return resolve(basePath);
}

function normalizeCommandName(command: string): string {
	return basename(command.trim()).replace(WINDOWS_EXECUTABLE_EXTENSION_PATTERN, '').toLowerCase();
}

export function isWithinWorkspaceBoundary(resolvedPath: string, workspacePath: string): boolean {
	const normalizedResolved = resolve(resolvedPath).toLowerCase();
	const normalizedWorkspace = resolve(workspacePath).toLowerCase();

	return (
		normalizedResolved === normalizedWorkspace ||
		normalizedResolved.startsWith(normalizedWorkspace + sep.toLowerCase()) ||
		normalizedResolved.startsWith(`${normalizedWorkspace}/`)
	);
}

function createBlockedRiskAssessment(
	matchedPattern: string,
	riskCategory: NonNullable<CommandRiskAssessment['risk_category']>,
	riskDetail: string,
): CommandRiskAssessment {
	return {
		blocked: true,
		matched_pattern: matchedPattern,
		risk_category: riskCategory,
		risk_detail: riskDetail,
	};
}

function hasRecursiveForceFlag(args: readonly string[]): boolean {
	return args.some((arg) => {
		const normalizedArgument = arg.toLowerCase();

		if (normalizedArgument === '--recursive') {
			return true;
		}

		if (!normalizedArgument.startsWith('-') || normalizedArgument.startsWith('--')) {
			return false;
		}

		return normalizedArgument.includes('r') && normalizedArgument.includes('f');
	});
}

function resolveWorkspaceRelativeOutputPath(
	outputTarget: string,
	options: CommandRiskEvaluationOptions,
): string {
	const basePath = options.working_directory ?? options.workspace_path ?? process.cwd();

	return resolve(basePath, outputTarget);
}

function getCommandOutputTarget(commandName: string, args: readonly string[]): string | undefined {
	if (commandName !== 'curl' && commandName !== 'wget') {
		return undefined;
	}

	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];

		if (argument === undefined) {
			continue;
		}

		const normalizedArgument = argument.toLowerCase();

		if (normalizedArgument === '-o' || normalizedArgument === '--output') {
			return args[index + 1];
		}

		if (normalizedArgument.startsWith('-o=')) {
			return argument.slice(3);
		}

		if (normalizedArgument.startsWith('--output=')) {
			return argument.slice('--output='.length);
		}
	}

	return undefined;
}

function isTaskkillTargetingSystemProcess(args: readonly string[]): boolean {
	for (let index = 0; index < args.length; index += 1) {
		if (args[index]?.toLowerCase() !== '/im') {
			continue;
		}

		const targetName = args[index + 1]?.toLowerCase();

		if (targetName === undefined) {
			return true;
		}

		return SYSTEM_TASKKILL_TARGETS.has(targetName);
	}

	return true;
}

export function evaluateCommandRisk(
	command: string,
	args: readonly string[],
	options: CommandRiskEvaluationOptions = {},
): CommandRiskAssessment {
	const commandName = normalizeCommandName(command);
	const normalizedArguments = args.map((argument) => argument.toLowerCase());

	if (commandName === 'rm' && hasRecursiveForceFlag(args)) {
		return createBlockedRiskAssessment(
			'rm -rf',
			'data_destruction',
			'Recursive force deletion is blocked for shell.exec.',
		);
	}

	if (commandName === 'rmdir' && normalizedArguments.includes('/s')) {
		return createBlockedRiskAssessment(
			'rmdir /s',
			'data_destruction',
			'Recursive directory removal is blocked for shell.exec.',
		);
	}

	if (
		commandName === 'del' &&
		(normalizedArguments.includes('/s') || normalizedArguments.includes('/q'))
	) {
		return createBlockedRiskAssessment(
			'del /s|/q',
			'data_destruction',
			'Bulk file deletion flags are blocked for shell.exec.',
		);
	}

	if (commandName === 'format') {
		return createBlockedRiskAssessment(
			'format',
			'data_destruction',
			'Disk formatting commands are blocked for shell.exec.',
		);
	}

	if (
		commandName === 'shutdown' ||
		commandName === 'restart' ||
		commandName === 'reboot' ||
		commandName === 'halt' ||
		commandName === 'poweroff'
	) {
		return createBlockedRiskAssessment(
			commandName,
			'system_control',
			'System power control commands are blocked for shell.exec.',
		);
	}

	if (commandName === 'taskkill' && isTaskkillTargetingSystemProcess(args)) {
		return createBlockedRiskAssessment(
			'taskkill system process',
			'system_control',
			'taskkill without a safe /im target is blocked for shell.exec.',
		);
	}

	if (commandName === 'reg' && normalizedArguments.includes('delete')) {
		return createBlockedRiskAssessment(
			'reg delete',
			'system_control',
			'Registry deletion commands are blocked for shell.exec.',
		);
	}

	if (commandName === 'nc' || commandName === 'ncat') {
		return createBlockedRiskAssessment(
			commandName,
			'network_exfiltration',
			'Raw network socket utilities are blocked for shell.exec.',
		);
	}

	const outputTarget = getCommandOutputTarget(commandName, args);
	const workspacePath = options.workspace_path;

	if (outputTarget && workspacePath) {
		const resolvedOutputTarget = resolveWorkspaceRelativeOutputPath(outputTarget, options);

		if (!isWithinWorkspaceBoundary(resolvedOutputTarget, workspacePath)) {
			return createBlockedRiskAssessment(
				`${commandName} --output`,
				'network_exfiltration',
				`Output path resolves outside the workspace boundary: ${resolvedOutputTarget}`,
			);
		}
	}

	if (commandName === 'sudo' || commandName === 'runas') {
		return createBlockedRiskAssessment(
			commandName,
			'privilege_escalation',
			'Privilege escalation commands are blocked for shell.exec.',
		);
	}

	if (
		commandName === 'chmod' &&
		args.some((argument) => {
			const normalizedArgument = argument.toLowerCase();
			return (
				normalizedArgument.includes('+s') ||
				normalizedArgument === '777' ||
				normalizedArgument === '0777'
			);
		})
	) {
		return createBlockedRiskAssessment(
			'chmod 777|+s',
			'privilege_escalation',
			'Dangerous chmod permission changes are blocked for shell.exec.',
		);
	}

	if (commandName === 'chown') {
		return createBlockedRiskAssessment(
			'chown',
			'privilege_escalation',
			'Ownership changes are blocked for shell.exec.',
		);
	}

	return {
		blocked: false,
	};
}

function createErrorResult(
	input: ShellExecInput,
	error_code: ShellExecErrorResult['error_code'],
	error_message: string,
	details?: ShellExecErrorResult['details'],
	retryable?: boolean,
): ShellExecErrorResult {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'shell.exec',
	};
}

function createOutputCaptureState(): OutputCaptureState {
	return {
		captured_bytes: 0,
		chunks: [],
		truncated: false,
	};
}

function appendOutputChunk(
	state: OutputCaptureState,
	chunk: Buffer | string,
	limitBytes: number,
): void {
	if (state.captured_bytes >= limitBytes) {
		state.truncated = true;

		return;
	}

	const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8');
	const remainingBytes = limitBytes - state.captured_bytes;

	if (bufferChunk.byteLength <= remainingBytes) {
		state.chunks.push(bufferChunk);
		state.captured_bytes += bufferChunk.byteLength;

		return;
	}

	state.chunks.push(bufferChunk.subarray(0, remainingBytes));
	state.captured_bytes += remainingBytes;
	state.truncated = true;
}

function finalizeOutput(state: OutputCaptureState): {
	readonly text: string;
	readonly truncated: boolean;
} {
	return {
		text: Buffer.concat(state.chunks).toString('utf8'),
		truncated: state.truncated,
	};
}

function isShellExecErrorResult(
	value: ProcessExecutionOutcome | ShellExecErrorResult,
): value is ShellExecErrorResult {
	return 'status' in value;
}

function toSpawnErrorResult(
	input: ShellExecInput,
	workingDirectory: string,
	error: unknown,
): ShellExecErrorResult {
	const details = {
		args: input.arguments.args ?? [],
		command: input.arguments.command,
		working_directory: workingDirectory,
	};

	if (error && typeof error === 'object' && 'code' in error) {
		const errorCode = error.code;

		if (errorCode === 'ENOENT') {
			return createErrorResult(
				input,
				'NOT_FOUND',
				`Executable not found: ${input.arguments.command}`,
				details,
				false,
			);
		}

		if (errorCode === 'EACCES' || errorCode === 'EPERM') {
			return createErrorResult(
				input,
				'PERMISSION_DENIED',
				`Permission denied while starting command: ${input.arguments.command}`,
				details,
				false,
			);
		}
	}

	if (error instanceof Error) {
		return createErrorResult(
			input,
			'EXECUTION_FAILED',
			`Failed to start command: ${error.message}`,
			details,
			false,
		);
	}

	return createErrorResult(
		input,
		'UNKNOWN',
		`Failed to start command: ${input.arguments.command}`,
		details,
		false,
	);
}

async function runCommand(
	input: ShellExecInput,
	workingDirectory: string,
	timeoutMs: number,
	dependencies: ShellExecDependencies,
): Promise<ProcessExecutionOutcome | ShellExecErrorResult> {
	const stdoutState = createOutputCaptureState();
	const stderrState = createOutputCaptureState();
	const startedAt = dependencies.now();
	const args = [...(input.arguments.args ?? [])];

	return new Promise((resolvePromise) => {
		let settled = false;
		let timedOut = false;
		let forceKillHandle: NodeJS.Timeout | undefined;

		const childProcess = dependencies.spawn(input.arguments.command, args, {
			cwd: workingDirectory,
			env: buildSafeEnvironment(),
			shell: false,
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true,
		});

		const finalize = (result: ProcessExecutionOutcome | ShellExecErrorResult): void => {
			if (settled) {
				return;
			}

			settled = true;

			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
			}

			if (forceKillHandle) {
				clearTimeout(forceKillHandle);
			}

			resolvePromise(result);
		};

		childProcess.once('error', (error: unknown) => {
			finalize(toSpawnErrorResult(input, workingDirectory, error));
		});

		childProcess.stdout.on('data', (chunk: Buffer | string) => {
			appendOutputChunk(stdoutState, chunk, dependencies.output_limit_bytes);
		});

		childProcess.stderr.on('data', (chunk: Buffer | string) => {
			appendOutputChunk(stderrState, chunk, dependencies.output_limit_bytes);
		});

		childProcess.once('close', (exitCode, signal) => {
			const stdout = finalizeOutput(stdoutState);
			const stderr = finalizeOutput(stderrState);

			finalize({
				duration_ms: dependencies.now() - startedAt,
				exit_code: exitCode,
				signal,
				stderr: stderr.text,
				stderr_truncated: stderr.truncated,
				stdout: stdout.text,
				stdout_truncated: stdout.truncated,
				timed_out: timedOut,
			});
		});

		const timeoutHandle = setTimeout(() => {
			timedOut = true;
			childProcess.kill();

			forceKillHandle = setTimeout(() => {
				if (!settled) {
					childProcess.kill('SIGKILL');
				}
			}, FORCE_KILL_GRACE_MS);
		}, timeoutMs);
	});
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

function redactExecutionOutcome(
	outcome: ProcessExecutionOutcome,
	redactionContext: ShellOutputRedactionContext,
): ProcessExecutionOutcome & ShellOutputRedactionMetadata {
	const stdout = redactShellOutput(outcome.stdout, redactionContext);
	const stderr = redactShellOutput(outcome.stderr, redactionContext);
	const metadata = combineShellOutputRedactionMetadata([stdout.metadata, stderr.metadata]);

	return {
		...outcome,
		...metadata,
		stderr: stderr.text,
		stdout: stdout.text,
	};
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

export function createShellExecTool(
	dependencies: Partial<ShellExecDependencies> = {},
): ToolDefinition<ShellExecInput, ShellExecResult> {
	const resolvedDependencies: ShellExecDependencies = {
		now: dependencies.now ?? Date.now,
		output_limit_bytes: dependencies.output_limit_bytes ?? DEFAULT_OUTPUT_LIMIT_BYTES,
		spawn: dependencies.spawn ?? spawn,
		stat: dependencies.stat ?? stat,
	};

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
					description: 'Executable to run.',
					required: true,
					type: 'string',
				},
				timeout_ms: {
					description: 'Execution timeout in milliseconds.',
					type: 'number',
				},
				working_directory: {
					description: 'Optional working directory for the subprocess.',
					type: 'string',
				},
			},
		},
		description:
			'Executes a non-interactive argv-based subprocess without shell parsing and returns captured output.',
		async execute(input, context): Promise<ShellExecResult> {
			const command = input.arguments.command.trim();
			const args = input.arguments.args ?? [];
			const timeoutMs = input.arguments.timeout_ms ?? DEFAULT_TIMEOUT_MS;
			const workingDirectory = resolveWorkingDirectory(input, context);
			const contextWorkspacePath = context.working_directory ?? process.cwd();

			if (!command) {
				return createErrorResult(
					input,
					'INVALID_INPUT',
					'Command must be a non-empty string.',
					{
						reason: 'empty_command',
					},
					false,
				);
			}

			if (!Array.isArray(args) || args.some((value) => typeof value !== 'string')) {
				return createErrorResult(
					input,
					'INVALID_INPUT',
					'args must be an array of strings.',
					{
						reason: 'invalid_args',
					},
					false,
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
					`Command blocked by safety policy: ${riskAssessment.risk_detail ?? riskAssessment.matched_pattern}`,
					{
						command,
						matched_pattern: riskAssessment.matched_pattern,
						risk_category: riskAssessment.risk_category,
					},
					false,
				);
			}

			if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
				return createErrorResult(
					input,
					'INVALID_INPUT',
					'timeout_ms must be a positive integer.',
					{
						reason: 'invalid_timeout',
					},
					false,
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
					false,
				);
			}

			try {
				const workingDirectoryStats = await resolvedDependencies.stat(workingDirectory);

				if (!workingDirectoryStats.isDirectory()) {
					return createErrorResult(
						input,
						'INVALID_INPUT',
						`Working directory is not a directory: ${workingDirectory}`,
						{
							command,
							working_directory: workingDirectory,
						},
						false,
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
						false,
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
						false,
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
					false,
				);
			}

			const redactionContext = await resolveRedactionContext(contextWorkspacePath);
			const rawExecutionResult = await runCommand(
				{
					...input,
					arguments: {
						...input.arguments,
						command,
					},
				},
				workingDirectory,
				timeoutMs,
				resolvedDependencies,
			);

			if (isShellExecErrorResult(rawExecutionResult)) {
				return rawExecutionResult;
			}

			const executionResult = redactExecutionOutcome(rawExecutionResult, redactionContext);
			const commandSurface = redactCommandSurface(command, args, redactionContext);
			const outputRedactionMetadata = combineShellOutputRedactionMetadata([
				executionResult,
				commandSurface.metadata,
			]);

			if (executionResult.timed_out) {
				return createErrorResult(
					input,
					'TIMEOUT',
					`Command timed out after ${timeoutMs}ms: ${commandSurface.command}`,
					{
						args: commandSurface.args,
						command: commandSurface.command,
						exit_code: executionResult.exit_code,
						redacted_occurrence_count: outputRedactionMetadata.redacted_occurrence_count,
						redacted_source_kinds: outputRedactionMetadata.redacted_source_kinds,
						redaction_applied: outputRedactionMetadata.redaction_applied,
						secret_values_exposed: outputRedactionMetadata.secret_values_exposed,
						signal: executionResult.signal,
						stderr: executionResult.stderr,
						stderr_truncated: executionResult.stderr_truncated,
						stdout: executionResult.stdout,
						stdout_truncated: executionResult.stdout_truncated,
						working_directory: workingDirectory,
					},
					true,
				);
			}

			return {
				call_id: input.call_id,
				output: {
					args: commandSurface.args,
					command: commandSurface.command,
					duration_ms: executionResult.duration_ms,
					exit_code: executionResult.exit_code,
					redacted_occurrence_count: outputRedactionMetadata.redacted_occurrence_count,
					redacted_source_kinds: outputRedactionMetadata.redacted_source_kinds,
					redaction_applied: outputRedactionMetadata.redaction_applied,
					secret_values_exposed: outputRedactionMetadata.secret_values_exposed,
					signal: executionResult.signal,
					stderr: executionResult.stderr,
					stderr_truncated: executionResult.stderr_truncated,
					stdout: executionResult.stdout,
					stdout_truncated: executionResult.stdout_truncated,
					timed_out: false,
					working_directory: workingDirectory,
				},
				status: 'success',
				tool_name: 'shell.exec',
			};
		},
		metadata: {
			capability_class: 'shell',
			narration_policy: 'required',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'execute',
			tags: ['argv', 'command', 'non-interactive', 'subprocess'],
		},
		name: 'shell.exec',
		user_label_tr: 'Terminal komutu',
		user_summary_tr: 'Bagli oturumda komut calistirilir, ciktisi sohbete eklenir.',
	};
}

export const shellExecTool = createShellExecTool();
