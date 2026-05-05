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
		const distRendererDirectory = path.join(__dirname, '../dist-electron/renderer');
		const electronRendererDirectory = path.join(__dirname, '../electron/renderer');

		await esbuild.build({
			entryPoints: [path.join(__dirname, '../electron/renderer/App.tsx')],
			bundle: true,
			platform: 'browser',
			target: 'chrome119',
			format: 'esm',
			outfile: path.join(distRendererDirectory, 'App.js'),
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
		await mkdir(electronRendererDirectory, { recursive: true });
		await copyFile(
			path.join(distRendererDirectory, 'App.js'),
			path.join(electronRendererDirectory, 'App.js'),
		);
		await copyFile(
			path.join(electronRendererDirectory, 'index.html'),
			path.join(distRendererDirectory, 'index.html'),
		);
		await copyFile(
			path.join(electronRendererDirectory, 'styles.css'),
			path.join(distRendererDirectory, 'styles.css'),
		);

		console.log('Renderer build completed successfully');
	} catch (error) {
		console.error('Renderer build failed:', error);
		process.exit(1);
	}
}

buildRenderer();
