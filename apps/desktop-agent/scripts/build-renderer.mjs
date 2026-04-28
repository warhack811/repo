/**
 * Build script for Electron renderer
 * Bundles React app with esbuild
 */

import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';

async function buildRenderer() {
	try {
		await esbuild.build({
			entryPoints: [path.join(__dirname, '../electron/renderer/App.tsx')],
			bundle: true,
			platform: 'browser',
			target: 'chrome119',
			format: 'esm',
			outfile: path.join(__dirname, '../dist-electron/renderer/App.js'),
			loader: {
				'.tsx': 'tsx',
				'.ts': 'tsx',
			},
			jsx: 'automatic',
			sourcemap: !isProduction,
			minify: isProduction,
			define: {
				'process.env.NODE_ENV': isProduction ? '"production"' : '"development"',
			},
		});
		await mkdir(path.join(__dirname, '../electron/renderer'), { recursive: true });
		await copyFile(
			path.join(__dirname, '../dist-electron/renderer/App.js'),
			path.join(__dirname, '../electron/renderer/App.js'),
		);

		console.log('Renderer build completed successfully');
	} catch (error) {
		console.error('Renderer build failed:', error);
		process.exit(1);
	}
}

buildRenderer();
