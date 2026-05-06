import { defineConfig, devices } from '@playwright/test';

const serverPort = Number(process.env.RUNA_E2E_SERVER_PORT ?? '3000');
const webPort = Number(process.env.RUNA_E2E_WEB_PORT ?? '4173');
const baseUrl = `http://127.0.0.1:${webPort}`;
const reuseExistingServer = !process.env.CI && process.env.RUNA_E2E_STRICT_SERVER !== '1';

export default defineConfig({
	forbidOnly: Boolean(process.env.CI),
	outputDir: 'test-results/playwright',
	reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
	retries: process.env.CI ? 2 : 0,
	testDir: '.',
	testIgnore: ['**/.claude/**', '**/.kilo/**', '**/node_modules/**'],
	testMatch: ['e2e/*.spec.ts', 'apps/web/tests/visual/*.spec.ts'],
	timeout: 60_000,
	use: {
		baseURL: baseUrl,
		headless: true,
		screenshot: 'only-on-failure',
		serviceWorkers: 'block',
		trace: 'on-first-retry',
		video: 'retain-on-failure',
	},
	webServer: [
		{
			command: 'node e2e/serve-runa-e2e.mjs',
			port: serverPort,
			reuseExistingServer,
			timeout: 60_000,
		},
		{
			command: `pnpm --dir apps/web exec vite --host 127.0.0.1 --port ${webPort} --strictPort`,
			port: webPort,
			reuseExistingServer,
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
