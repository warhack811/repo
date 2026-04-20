import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		dir: 'src',
		environment: 'node',
		exclude: ['**/node_modules/**'],
		include: ['**/*.{test,spec}.{js,jsx,mjs,cjs,ts,tsx}'],
		passWithNoTests: true,
	},
});
