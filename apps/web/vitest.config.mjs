import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	test: {
		dir: 'src',
		environment: 'jsdom',
		exclude: ['**/node_modules/**'],
		include: ['**/*.{test,spec}.{js,jsx,mjs,cjs,ts,tsx}'],
		passWithNoTests: true,
		setupFiles: ['./src/test/setup.ts'],
	},
});
