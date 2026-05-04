import { describe, expect, it, vi } from 'vitest';

import { executeDesktopAgentLaunch } from './app-launcher.js';

type ExecFileCallback = (
	error: NodeJS.ErrnoException | null,
	stdout: string | Buffer,
	stderr: string | Buffer,
) => void;

function createExecFileMock(stdout: string, stderr = '') {
	return vi.fn(
		(
			_command: string,
			_args: readonly string[],
			_options: Record<string, unknown>,
			callback: ExecFileCallback,
		) => {
			callback?.(null, stdout, stderr);
		},
	);
}

describe('desktop agent app launcher', () => {
	it('launches whitelisted apps through PowerShell Start-Process', async () => {
		const execFileMock = createExecFileMock('4242');

		const result = await executeDesktopAgentLaunch(
			{
				app_name: 'Notepad',
			},
			{
				execFile: execFileMock,
				platform: 'win32',
			},
		);

		expect(result).toEqual({
			output: {
				launched: true,
				pid: 4242,
				process_name: 'notepad',
			},
			status: 'success',
		});
		expect(execFileMock).toHaveBeenCalledWith(
			'powershell.exe',
			expect.arrayContaining(['-NoProfile', '-NonInteractive', '-Command']),
			expect.objectContaining({
				windowsHide: true,
			}),
			expect.any(Function),
		);
	});

	it('rejects non-whitelisted apps before execution', async () => {
		const execFileMock = createExecFileMock('1234');

		const result = await executeDesktopAgentLaunch(
			{
				app_name: 'powershell',
			},
			{
				execFile: execFileMock,
				platform: 'win32',
			},
		);

		expect(result).toMatchObject({
			details: {
				reason: 'app_not_whitelisted',
			},
			error_code: 'PERMISSION_DENIED',
			status: 'error',
		});
		expect(execFileMock).not.toHaveBeenCalled();
	});

	it('reports unsupported hosts without invoking PowerShell', async () => {
		const execFileMock = createExecFileMock('1234');

		const result = await executeDesktopAgentLaunch(
			{
				app_name: 'calc',
			},
			{
				execFile: execFileMock,
				platform: 'linux',
			},
		);

		expect(result).toMatchObject({
			details: {
				reason: 'unsupported_platform',
			},
			error_code: 'EXECUTION_FAILED',
			status: 'error',
		});
		expect(execFileMock).not.toHaveBeenCalled();
	});
});
