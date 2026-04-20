import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		dir: 'dist',
		environment: 'node',
		exclude: ['**/node_modules/**'],
		include: ['**/*.{test,spec}.js'],
		passWithNoTests: false,
	},
});
