import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		dir: 'src',
		environment: 'node',
		exclude: ['**/node_modules/**'],
		include: ['**/*.{test,spec}.ts'],
		passWithNoTests: false,
	},
});
