import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { type LogErrorOptions, type Plugin, defineConfig } from 'vite';

const shouldAnalyzeBundle = process.env['ANALYZE'] === 'true';
const devServerPort = Number(process.env['RUNA_E2E_SERVER_PORT'] ?? '3000');
const devHttpTarget = `http://127.0.0.1:${devServerPort}`;
const devWsTarget = `ws://127.0.0.1:${devServerPort}`;

interface NodeError extends Error {
	readonly code?: string;
}

function isExpectedWsProxyShutdownNoise(message: string, options?: LogErrorOptions): boolean {
	const errorCode = options?.error instanceof Error ? (options.error as NodeError).code : undefined;
	const isWsProxyLog =
		message.includes('ws proxy error:') || message.includes('ws proxy socket error:');
	const isExpectedSocketShutdown =
		errorCode === 'ECONNABORTED' ||
		errorCode === 'ECONNRESET' ||
		errorCode === 'ECONNREFUSED' ||
		message.includes('ECONNABORTED') ||
		message.includes('ECONNRESET') ||
		message.includes('ECONNREFUSED');

	return isWsProxyLog && isExpectedSocketShutdown;
}

function suppressExpectedWsProxyShutdownNoise(): Plugin {
	return {
		name: 'runa:suppress-expected-ws-proxy-shutdown-noise',
		configResolved(config) {
			const originalError = config.logger.error.bind(config.logger);

			config.logger.error = (message: string, options?: LogErrorOptions) => {
				if (isExpectedWsProxyShutdownNoise(message, options)) {
					return;
				}

				originalError(message, options);
			};
		},
	};
}

// Dev proxy follows the Fastify server port used by local dev and isolated E2E runs.
export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		suppressExpectedWsProxyShutdownNoise(),
		...(shouldAnalyzeBundle
			? [
					visualizer({
						filename: 'dist/bundle-visualizer.html',
						gzipSize: true,
						brotliSize: true,
						template: 'treemap',
					}),
				]
			: []),
	],
	resolve: {
		alias: {
			'@': new URL('./src', import.meta.url).pathname,
		},
	},
	server: {
		port: 5173,
		proxy: {
			'/auth': {
				target: devHttpTarget,
			},
			'/ws': {
				target: devWsTarget,
				ws: true,
			},
			'/conversations': {
				target: devHttpTarget,
			},
			'/desktop': {
				target: devHttpTarget,
			},
			'/upload': {
				target: devHttpTarget,
			},
			'/storage': {
				target: devHttpTarget,
			},
		},
	},
});
