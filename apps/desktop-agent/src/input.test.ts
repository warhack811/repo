import type { execFile } from 'node:child_process';

import { describe, expect, it, vi } from 'vitest';

import { executeDesktopAgentInput } from './input.js';

type ExecFileCallback = (
	error: NodeJS.ErrnoException | null,
	stdout: string | Buffer,
	stderr: string | Buffer,
) => void;

function createExecFileMock() {
	return vi.fn(
		(
			_command: string,
			_args: readonly string[],
			_options: Record<string, unknown>,
			callback: ExecFileCallback,
		) => {
			callback(null, '', '');
		},
	);
}

describe('desktop agent input executor', () => {
	it('uses signed wheel deltas for desktop.scroll input injection', async () => {
		const execFileMock = createExecFileMock();

		const result = await executeDesktopAgentInput(
			'desktop.scroll',
			{
				delta_y: -480,
			},
			{
				execFile: execFileMock as unknown as typeof execFile,
				platform: 'win32',
			},
		);

		expect(result).toEqual({
			output: {
				delta_x: 0,
				delta_y: -480,
			},
			status: 'success',
		});

		const script = execFileMock.mock.calls[0]?.[1]?.[4];
		expect(script).toContain('int dwData');
		expect(script).toContain('mouse_event(0x0800, 0, 0, -480');
		expect(script).not.toContain('[uint32]-480');
	});
});
