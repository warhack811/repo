import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDesktopAgentDiagnosticsSnapshot } from './diagnostics.js';

describe('createDesktopAgentDiagnosticsSnapshot', () => {
	it('creates deterministic sanitized diagnostics snapshots', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'runa-diagnostics-'));
		const logFilePath = join(directory, 'main.log');

		try {
			await writeFile(
				logFilePath,
				['startup ok', 'Authorization: Bearer secret-token', 'jwt eyJabc.def.ghi'].join('\n'),
				'utf8',
			);

			await expect(
				createDesktopAgentDiagnosticsSnapshot({
					appVersion: '0.1.0',
					arch: 'x64',
					electronVersion: '38.0.0',
					locale: 'en-US',
					logFilePath,
					nodeVersion: '22.0.0',
					platform: 'win32',
					runtimeStatus: 'connected',
					settings: {
						autoStart: true,
						openWindowOnStart: false,
						telemetryOptIn: false,
					},
				}),
			).resolves.toEqual({
				app_version: '0.1.0',
				arch: 'x64',
				electron_version: '38.0.0',
				last_log_lines: ['startup ok', 'Authorization: Bearer [REDACTED]', 'jwt [REDACTED_JWT]'],
				locale: 'en-US',
				node_version: '22.0.0',
				platform: 'win32',
				runtime_status: 'connected',
				settings: {
					autoStart: true,
					openWindowOnStart: false,
					telemetryOptIn: false,
				},
			});
		} finally {
			await rm(directory, { force: true, recursive: true });
		}
	});
});
