import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');
const tscEntrypoint = path.resolve(
	serverRoot,
	'..',
	'..',
	'node_modules',
	'typescript',
	'bin',
	'tsc',
);
const vitestEntrypoint = path.resolve(
	serverRoot,
	'..',
	'..',
	'node_modules',
	'vitest',
	'vitest.mjs',
);

const RUN_COUNT = 5;
const TEST_FILE = 'dist/ws/register-ws.test.js';
const TEST_NAME =
	'automates a narrow demo-style live chain across search, read, and approval-gated write on one workspace fixture';

const runs = [];

for (const entrypoint of [tscEntrypoint, vitestEntrypoint]) {
	if (!fs.existsSync(entrypoint)) {
		process.stderr.write(`Entrypoint not found: ${entrypoint}\n`);
		process.exit(1);
	}
}

function writeResultOutput(result) {
	if (result.error) {
		process.stderr.write(`${result.error.message}\n`);
	}

	if (result.stdout) {
		process.stdout.write(result.stdout);
	}

	if (result.stderr) {
		process.stderr.write(result.stderr);
	}
}

const preflightSteps = [
	{
		args: [tscEntrypoint],
		command: process.execPath,
		label: 'compile',
	},
	{
		args: ['scripts/copy-test-fixtures.mjs'],
		command: process.execPath,
		label: 'copy-test-fixtures',
	},
];

for (const step of preflightSteps) {
	const result = spawnSync(step.command, step.args, {
		cwd: serverRoot,
		encoding: 'utf8',
	});

	writeResultOutput(result);

	if (result.status !== 0) {
		const summary = {
			failed_preflight_step: step.label,
			passed_threshold: false,
			passed_runs: 0,
			result: 'FAIL',
			run_count: RUN_COUNT,
			scenario: TEST_NAME,
			test_file: TEST_FILE,
		};

		process.stdout.write(`FORMAL_REPEATABILITY_SUMMARY ${JSON.stringify(summary)}\n`);
		process.exit(1);
	}
}

for (let index = 0; index < RUN_COUNT; index += 1) {
	const startedAt = new Date().toISOString();
	const result = spawnSync(
		process.execPath,
		[
			vitestEntrypoint,
			'run',
			TEST_FILE,
			'--testNamePattern',
			TEST_NAME,
			'--reporter',
			'default',
			'--config',
			'./vitest.config.mjs',
			'--configLoader',
			'runner',
		],
		{
			cwd: serverRoot,
			encoding: 'utf8',
		},
	);
	const finishedAt = new Date().toISOString();
	const passed = result.status === 0;

	runs.push({
		finished_at: finishedAt,
		passed,
		run_index: index + 1,
		started_at: startedAt,
	});

	process.stdout.write(
		`[formal-repeatability] run ${index + 1}/${RUN_COUNT}: ${passed ? 'PASS' : 'FAIL'}\n`,
	);

	writeResultOutput(result);
}

const passedRuns = runs.filter((run) => run.passed).length;
const summary = {
	passed_threshold: passedRuns === RUN_COUNT,
	passed_runs: passedRuns,
	result: passedRuns === RUN_COUNT ? 'PASS' : 'FAIL',
	run_count: RUN_COUNT,
	scenario: TEST_NAME,
	test_file: TEST_FILE,
};

process.stdout.write(`FORMAL_REPEATABILITY_SUMMARY ${JSON.stringify(summary)}\n`);

if (summary.result !== 'PASS') {
	process.exitCode = 1;
}
