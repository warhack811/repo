import { defineConfig, devices } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:4173';

export default defineConfig({
	forbidOnly: Boolean(process.env.CI),
	outputDir: 'test-results/playwright',
	reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
	retries: process.env.CI ? 2 : 0,
	testDir: './e2e',
	testMatch: '*.spec.ts',
	timeout: 60_000,
	use: {
		baseURL: baseUrl,
		headless: true,
		screenshot: 'only-on-failure',
		trace: 'on-first-retry',
		video: 'retain-on-failure',
	},
	webServer: [
		{
			command: 'node e2e/serve-runa-e2e.mjs',
			port: 3000,
			reuseExistingServer: !process.env.CI,
			timeout: 60_000,
		},
		{
			command: 'pnpm --dir apps/web exec vite --host 127.0.0.1 --port 4173 --strictPort',
			port: 4173,
			reuseExistingServer: !process.env.CI,
			timeout: 60_000,
		},
	],
	workers: process.env.CI ? 1 : undefined,
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
			},
		},
	],
});
