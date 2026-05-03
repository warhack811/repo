import { spawn } from 'node:child_process';
import electronPath from 'electron';

const EXPECTED_ELECTRON_MAJOR = 38;

function readElectronVersion() {
	return new Promise((resolve, reject) => {
		let stdout = '';
		let stderr = '';
		const child = spawn(electronPath, ['--version'], {
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true,
		});

		child.stdout.on('data', (chunk) => {
			stdout += String(chunk);
		});
		child.stderr.on('data', (chunk) => {
			stderr += String(chunk);
		});
		child.on('error', reject);
		child.on('exit', (code) => {
			if (code !== 0) {
				reject(new Error(`Electron version check failed: ${stderr.trim()}`));
				return;
			}

			resolve(stdout.trim().replace(/^v/u, ''));
		});
	});
}

const electronVersion = await readElectronVersion();
const majorVersion = Number.parseInt(electronVersion.split('.')[0] ?? '', 10);
const summary = {
	electron_version: electronVersion,
	expected_major: EXPECTED_ELECTRON_MAJOR,
	result: majorVersion === EXPECTED_ELECTRON_MAJOR ? 'PASS' : 'FAIL',
};

console.log(`[boot:electron-version] ${JSON.stringify(summary)}`);

if (summary.result !== 'PASS') {
	process.exitCode = 1;
}
