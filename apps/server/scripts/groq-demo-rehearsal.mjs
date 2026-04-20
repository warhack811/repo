import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');

const steps = [
	{
		command: [process.execPath, 'scripts/formal-demo-repeatability.mjs'],
		key: 'formal_repeatability',
		label: 'formal repeatability',
		summaryToken: 'FORMAL_REPEATABILITY_SUMMARY',
	},
	{
		command: [process.execPath, 'scripts/capture-core-coverage.mjs'],
		key: 'core_coverage',
		label: 'core coverage capture',
		summaryToken: 'CORE_COVERAGE_SUMMARY',
	},
];

function extractSummary(output, summaryToken) {
	const summaryLine = output.split(/\r?\n/u).find((line) => line.startsWith(`${summaryToken} `));

	if (!summaryLine) {
		return {
			error: 'summary_missing',
			value: null,
		};
	}

	const rawPayload = summaryLine.slice(summaryToken.length + 1).trim();

	if (rawPayload.length === 0) {
		return {
			error: 'summary_empty',
			value: null,
		};
	}

	try {
		return {
			error: null,
			value: JSON.parse(rawPayload),
		};
	} catch (error) {
		return {
			error:
				error instanceof Error ? `summary_parse_failed:${error.message}` : 'summary_parse_failed',
			value: null,
		};
	}
}

process.stdout.write('Groq-only demo rehearsal helper\n');
process.stdout.write(
	'This helper bundles formal repeatability and core coverage evidence into one server-side rehearsal pass.\n',
);
process.stdout.write(
	'It does not replace browser e2e, deployment pipeline automation, or an enterprise release platform.\n',
);

const stepResults = [];

for (const step of steps) {
	const startedAt = new Date().toISOString();
	const result = spawnSync(step.command[0], step.command.slice(1), {
		cwd: serverRoot,
		encoding: 'utf8',
	});
	const finishedAt = new Date().toISOString();
	const parsedSummary = extractSummary(result.stdout ?? '', step.summaryToken);
	const passed =
		result.status === 0 && parsedSummary.error === null && parsedSummary.value !== null;

	stepResults.push({
		command: step.command.join(' '),
		finished_at: finishedAt,
		result: passed ? 'PASS' : 'FAIL',
		started_at: startedAt,
		step: step.key,
		summary: parsedSummary.value,
		summary_error: parsedSummary.error,
		summary_token: step.summaryToken,
	});

	process.stdout.write(`[groq-demo-rehearsal] ${step.label}: ${passed ? 'PASS' : 'FAIL'}\n`);

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

const passedSteps = stepResults.filter((step) => step.result === 'PASS').length;
const summary = {
	baseline: 'Groq-only validated baseline',
	helper_scope: 'formal repeatability + core coverage capture',
	non_goals: ['full browser e2e', 'deployment pipeline automation', 'enterprise release platform'],
	passed_steps: passedSteps,
	result: passedSteps === stepResults.length ? 'PASS' : 'FAIL',
	step_count: stepResults.length,
	steps: stepResults,
};

process.stdout.write(`GROQ_DEMO_REHEARSAL_SUMMARY ${JSON.stringify(summary)}\n`);

if (summary.result !== 'PASS') {
	process.exitCode = 1;
}
