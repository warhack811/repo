import { defineConfig } from 'vitest/config';

export default defineConfig({
	esbuild: {
		jsx: 'automatic',
		jsxImportSource: 'react',
	},
	test: {
		coverage: {
			exclude: ['electron/**/*.js', 'electron/**/*.cjs'],
			provider: 'v8',
			reporter: ['text'],
		},
		include: ['src/**/*.test.ts', 'electron/renderer/**/*.test.tsx'],
	},
});
