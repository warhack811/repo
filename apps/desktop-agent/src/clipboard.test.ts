import { describe, expect, it, vi } from 'vitest';

import {
	executeDesktopAgentClipboardRead,
	executeDesktopAgentClipboardWrite,
} from './clipboard.js';

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

describe('desktop agent clipboard executor', () => {
	it('reads bounded clipboard text without arguments', async () => {
		const execFileMock = createExecFileMock('hello clipboard\r\n');

		const result = await executeDesktopAgentClipboardRead(
			{},
			{
				execFile: execFileMock,
				platform: 'win32',
			},
		);

		expect(result).toEqual({
			output: {
				byte_length: 16,
				character_count: 16,
				content: 'hello clipboard\n',
				is_redacted: false,
				is_truncated: false,
			},
			status: 'success',
		});
		expect(execFileMock).toHaveBeenCalledWith(
			'powershell.exe',
			['-NoProfile', '-NonInteractive', '-STA', '-Command', 'Get-Clipboard -Raw -Format Text'],
			expect.objectContaining({
				windowsHide: true,
			}),
			expect.any(Function),
		);
	});

	it('redacts clipboard content that looks sensitive', async () => {
		const execFileMock = createExecFileMock('api_key=sk_test_sensitive_value_123456');

		const result = await executeDesktopAgentClipboardRead(
			{},
			{
				execFile: execFileMock,
				platform: 'win32',
			},
		);

		expect(result).toMatchObject({
			output: {
				content: '[redacted-sensitive-clipboard-content]',
				is_redacted: true,
				is_truncated: false,
			},
			status: 'success',
		});
	});

	it('writes text through Set-Clipboard and reports byte counts', async () => {
		const execFileMock = createExecFileMock('');

		const result = await executeDesktopAgentClipboardWrite(
			{
				text: "Runa clipboard smoke: it's safe",
			},
			{
				execFile: execFileMock,
				platform: 'win32',
			},
		);

		expect(result).toEqual({
			output: {
				byte_length: 31,
				character_count: 31,
				written: true,
			},
			status: 'success',
		});
		expect(execFileMock).toHaveBeenCalledWith(
			'powershell.exe',
			expect.arrayContaining(['-STA', '-Command']),
			expect.objectContaining({
				windowsHide: true,
			}),
			expect.any(Function),
		);
	});

	it('rejects oversized writes before invoking PowerShell', async () => {
		const execFileMock = createExecFileMock('');

		const result = await executeDesktopAgentClipboardWrite(
			{
				text: 'x'.repeat(10 * 1024 + 1),
			},
			{
				execFile: execFileMock,
				platform: 'win32',
			},
		);

		expect(result).toMatchObject({
			error_code: 'INVALID_INPUT',
			status: 'error',
		});
		expect(execFileMock).not.toHaveBeenCalled();
	});
});
