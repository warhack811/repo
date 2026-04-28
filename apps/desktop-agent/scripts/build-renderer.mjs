/**
 * Build script for Electron renderer
 * Bundles React app with esbuild
 */

import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

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

		console.log('Renderer build completed successfully');
	} catch (error) {
		console.error('Renderer build failed:', error);
		process.exit(1);
	}
}

buildRenderer();
