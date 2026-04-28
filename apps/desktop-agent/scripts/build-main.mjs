/**
 * Build script for Electron main process
 * Simple TypeScript compilation followed by a simple CJS wrapper
 */

import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';

async function buildMain() {
	try {
		// Compile TypeScript to plain JavaScript with CommonJS
		await esbuild.build({
			entryPoints: [path.join(__dirname, '../electron/main.ts')],
			bundle: true,
			platform: 'node',
			target: 'node18',
			format: 'cjs',
			outfile: path.join(__dirname, '../dist-electron/main.cjs'),
			sourcemap: !isProduction,
			minify: isProduction,
			// Keep these external - let Node.js resolve them at runtime
			external: ['electron', 'path'],
		});

		// Read the output
		let output = await fs.promises.readFile(
			path.join(__dirname, '../dist-electron/main.cjs'),
			'utf-8',
		);

		// The issue is that electron package's main field returns executable path
		// When running inside electron.exe, Node should handle require('electron') correctly
		// But our bundled code may be getting wrong module resolution
		// Let's just ensure the require is clean
		output = output.replace(/__toESM\(require\("electron"\), [^)]+\)/, 'require("electron")');
		output = output.replace(/__toESM\(require\("path"\), [^)]+\)/, 'require("path")');

		await fs.promises.writeFile(path.join(__dirname, '../dist-electron/main.cjs'), output);
		await fs.promises.writeFile(path.join(__dirname, '../electron/main.cjs'), output);

		// Build preload as CJS
		await esbuild.build({
			entryPoints: [path.join(__dirname, '../electron/preload.mts')],
			bundle: true,
			platform: 'node',
			target: 'node18',
			format: 'cjs',
			outfile: path.join(__dirname, '../dist-electron/preload.cjs'),
			sourcemap: !isProduction,
			minify: isProduction,
			external: ['electron', 'path'],
		});

		let preloadOutput = await fs.promises.readFile(
			path.join(__dirname, '../dist-electron/preload.cjs'),
			'utf-8',
		);

		preloadOutput = preloadOutput.replace(
			/__toESM\(require\("electron"\), [^)]+\)/,
			'require("electron")',
		);
		preloadOutput = preloadOutput.replace(/__toESM\(require\("path"\), [^)]+\)/, 'require("path")');

		await fs.promises.writeFile(
			path.join(__dirname, '../dist-electron/preload.cjs'),
			preloadOutput,
		);
		await fs.promises.writeFile(path.join(__dirname, '../electron/preload.cjs'), preloadOutput);

		console.log('Main process build completed');
	} catch (error) {
		console.error('Main process build failed:', error);
		process.exit(1);
	}
}

buildMain();
