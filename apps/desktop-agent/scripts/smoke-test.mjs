/**
 * Desktop Agent Electron Smoke Test
 *
 * Verifies that the packaged Electron app starts without silent exit.
 * Tests for the boot log chain: boot:app-ready, window:ready-to-show, etc.
 */

import { exec, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SMOKE_TIMEOUT_MS = 30_000; // 30 seconds max
const EXPECTED_BOOT_LOGS = [
	'boot:app-ready',
	'boot:main-process:boot-complete',
	'boot:window:ready-to-show',
];

// Test environment
process.env.RUNA_DESKTOP_AGENT_ID = 'smoke-test-agent';
process.env.RUNA_DESKTOP_AGENT_SERVER_URL = 'http://localhost:3001';

async function runSmokeTest() {
	console.log('=== Runa Desktop Agent Electron Smoke Test ===\n');

	const electronPath = path.join(__dirname, '../node_modules/electron/dist/electron.exe');
	const mainPath = path.join(__dirname, '../dist-electron/main.js');

	console.log('Electron path:', electronPath);
	console.log('Main path:', mainPath);
	console.log('Timeout:', SMOKE_TIMEOUT_MS, 'ms\n');

	const collectedLogs = [];
	let resolved = false;

	// Start the Electron process
	const electronProcess = spawn(electronPath, [mainPath], {
		env: { ...process.env },
		stdio: ['pipe', 'pipe', 'pipe'],
	});

	const timeoutHandle = setTimeout(() => {
		if (!resolved) {
			resolved = true;
			console.error('\n[TIMEOUT] App did not trigger ready-to-show within timeout');
			electronProcess.kill('SIGTERM');
			process.exit(1);
		}
	}, SMOKE_TIMEOUT_MS);

	electronProcess.stdout.on('data', (data) => {
		const text = data.toString().trim();
		if (text) {
			collectedLogs.push({ type: 'stdout', text });
			console.log('[stdout]', text);
		}
	});

	electronProcess.stderr.on('data', (data) => {
		const text = data.toString().trim();
		if (text) {
			collectedLogs.push({ type: 'stderr', text });
			// Ignore common non-error warnings
			if (!text.includes('deprecation') && !text.includes('Warning')) {
				console.log('[stderr]', text);
			}
		}
	});

	electronProcess.on('close', (code) => {
		if (!resolved) {
			resolved = true;
			clearTimeout(timeoutHandle);

			console.log('\n=== Test Results ===\n');
			console.log('Exit code:', code);

			// Check for expected boot logs
			const allText = collectedLogs.map((l) => l.text).join('\n');
			const results = EXPECTED_BOOT_LOGS.map((expectedLog) => ({
				log: expectedLog,
				found: allText.includes(expectedLog),
			}));

			console.log('\nExpected boot logs:');
			for (const result of results) {
				console.log(`  ${result.found ? '✓' : '✗'} ${result.log}`);
			}

			const allPassed = results.every((r) => r.found);

			if (allPassed) {
				console.log('\n[SUCCESS] All boot logs found. App liveness verified!');
				process.exit(0);
			} else {
				console.log('\n[FAILURE] Missing expected boot logs. App may have exited silently.');
				process.exit(1);
			}
		}
	});

	electronProcess.on('error', (error) => {
		if (!resolved) {
			resolved = true;
			clearTimeout(timeoutHandle);
			console.error('\n[ERROR] Failed to start Electron:', error.message);
			process.exit(1);
		}
	});

	// Keep test running
	return new Promise(() => {});
}

runSmokeTest().catch((error) => {
	console.error('Test runner error:', error);
	process.exit(1);
});
