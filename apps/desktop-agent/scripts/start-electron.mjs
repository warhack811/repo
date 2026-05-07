/**
 * Start Electron app in development mode
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set required environment variables for testing
process.env.RUNA_DESKTOP_AGENT_ID = process.env.RUNA_DESKTOP_AGENT_ID || 'test-agent-id';
process.env.RUNA_DESKTOP_AGENT_SERVER_URL =
	process.env.RUNA_DESKTOP_AGENT_SERVER_URL || 'http://127.0.0.1:3000';

const electronPath = path.join(__dirname, '../node_modules/electron/dist/electron.exe');
const mainPath = path.join(__dirname, '../dist-electron/main.cjs');

console.log('Starting Electron app...');
console.log('Electron path:', electronPath);
console.log('Main path:', mainPath);

const electronProcess = spawn(electronPath, [mainPath], {
	env: { ...process.env },
	stdio: ['pipe', 'pipe', 'pipe'],
	windowsHide: true,
});

electronProcess.stdout.on('data', (data) => {
	process.stdout.write(data);
});

electronProcess.stderr.on('data', (data) => {
	process.stderr.write(data);
});

electronProcess.on('close', (code) => {
	console.log('Electron process exited with code:', code);
	process.exit(code || 0);
});

electronProcess.on('error', (error) => {
	console.error('Failed to start Electron:', error);
	process.exit(1);
});

// Keep process alive for testing
console.log('Electron process started with PID:', electronProcess.pid);
console.log('Press Ctrl+C to stop...');
