import type { DesktopAgentDiagnosticsSnapshot, DesktopAgentSettingsStoreState } from '@runa/types';

import { readFile } from 'node:fs/promises';

import { redactPii } from './logger.js';

export interface DesktopAgentDiagnosticsOptions {
	readonly appVersion: string;
	readonly arch: string;
	readonly electronVersion: string;
	readonly locale?: string;
	readonly logFilePath: string;
	readonly nodeVersion: string;
	readonly platform: string;
	readonly runtimeStatus: string;
	readonly settings: DesktopAgentSettingsStoreState;
}

function sanitizeLogLine(line: string): string {
	const redactedValue = redactPii(line);
	return typeof redactedValue === 'string' ? redactedValue : JSON.stringify(redactedValue);
}

export async function readLastLogLines(
	logFilePath: string,
	limit = 50,
): Promise<readonly string[]> {
	let logContent: string;

	try {
		logContent = await readFile(logFilePath, 'utf8');
	} catch {
		return [];
	}

	return logContent
		.split(/\r?\n/u)
		.filter((line) => line.trim().length > 0)
		.slice(-limit)
		.map((line) => sanitizeLogLine(line));
}

export async function createDesktopAgentDiagnosticsSnapshot(
	options: DesktopAgentDiagnosticsOptions,
): Promise<DesktopAgentDiagnosticsSnapshot> {
	return {
		app_version: options.appVersion,
		arch: options.arch,
		electron_version: options.electronVersion,
		last_log_lines: await readLastLogLines(options.logFilePath),
		locale: options.locale,
		node_version: options.nodeVersion,
		platform: options.platform,
		runtime_status: options.runtimeStatus,
		settings: {
			autoStart: options.settings.autoStart,
			openWindowOnStart: options.settings.openWindowOnStart,
			telemetryOptIn: options.settings.telemetryOptIn,
		},
	};
}
