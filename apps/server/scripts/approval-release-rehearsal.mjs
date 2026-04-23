import { resolve } from 'node:path';

import { classifyChainFailure, runSummaryScript } from './approval-release-rehearsal-lib.mjs';

const SUMMARY_TOKEN = 'APPROVAL_RELEASE_REHEARSAL_SUMMARY';
const serverRoot = resolve(import.meta.dirname, '..');

function printSummary(summary) {
	process.stdout.write(`${SUMMARY_TOKEN} ${JSON.stringify(summary)}\n`);
}

function logStep(message) {
	process.stdout.write(`[approval-release-rehearsal] ${message}\n`);
}

function selectPersistenceScenario(summary, scenarioId) {
	if (!Array.isArray(summary?.scenarios)) {
		return null;
	}

	return (
		summary.scenarios.find(
			(scenario) => scenario && typeof scenario === 'object' && scenario.scenario_id === scenarioId,
		) ?? null
	);
}

function buildReleaseStory(browserSummary, persistenceSummary) {
	const browserChain = browserSummary?.chain ?? null;
	const toolScenario = selectPersistenceScenario(persistenceSummary, 'tool_approval_restart');
	const autoContinueScenario = selectPersistenceScenario(
		persistenceSummary,
		'auto_continue_restart',
	);
	const autoContinueChain = autoContinueScenario?.chain ?? null;
	const toolChain = toolScenario?.chain ?? null;

	return {
		approval_boundary_observed: browserChain?.approval_boundary_observed === true,
		approval_resolve_to_continuation_observed:
			autoContinueChain?.approval_resolve_sent === true &&
			autoContinueChain?.continuation_observed === true,
		reconnect_restart_tolerated:
			autoContinueChain?.reconnect_restart_tolerated === true &&
			toolChain?.reconnect_restart_tolerated === true,
		terminal_run_finished_completed:
			browserChain?.terminal_run_finished_completed === true &&
			autoContinueChain?.terminal_run_finished_completed === true,
	};
}

function classifyReleaseFailure(input) {
	if (input.browserSummary?.result === 'BLOCKED') {
		return input.browserSummary.reason ?? 'browser_authority_blocked';
	}

	if (input.browserSummary?.result !== 'PASS') {
		return classifyChainFailure({
			approval_boundary_observed: input.browserSummary?.chain?.approval_boundary_observed === true,
			approval_resolve_sent: input.browserSummary?.chain?.approval_resolve_sent === true,
			continuation_observed:
				input.browserSummary?.chain?.continuation_observed === true ||
				input.browserSummary?.chain?.terminal_run_finished_completed === true,
			reconnect_restart_tolerated: true,
			terminal_run_finished_completed:
				input.browserSummary?.chain?.terminal_run_finished_completed === true,
		});
	}

	if (input.persistenceSummary?.result === 'BLOCKED') {
		return input.persistenceSummary.reason ?? 'persistence_rehearsal_blocked';
	}

	const autoContinueScenario = selectPersistenceScenario(
		input.persistenceSummary,
		'auto_continue_restart',
	);
	const toolScenario = selectPersistenceScenario(input.persistenceSummary, 'tool_approval_restart');
	const autoContinueFailure = classifyChainFailure(autoContinueScenario?.chain ?? null);

	if (autoContinueFailure !== null) {
		return autoContinueFailure;
	}

	const toolChain = toolScenario?.chain ?? null;

	if (toolChain?.reconnect_restart_tolerated !== true) {
		return 'restart_reconnect_missing';
	}

	return input.persistenceSummary?.result === 'PASS' ? null : 'persistence_rehearsal_failed';
}

async function main() {
	logStep('starting browser authority proof');
	const browserRun = await runSummaryScript({
		cwd: serverRoot,
		scriptPath: 'scripts/approval-browser-authority-check.mjs',
		summaryToken: 'APPROVAL_BROWSER_AUTHORITY_SUMMARY',
	});

	if (browserRun.summary === null) {
		printSummary({
			browser_authority: {
				exit_code: browserRun.exit.code,
				result: 'FAIL',
				signal: browserRun.exit.signal,
			},
			failure_stage: 'browser_summary_missing',
			result: 'FAIL',
			server_scope: '@runa/server',
		});
		process.exitCode = 1;
		return;
	}

	logStep('starting persistence and reconnect proof');
	const persistenceRun = await runSummaryScript({
		cwd: serverRoot,
		scriptPath: 'scripts/approval-persistence-live-smoke.mjs',
		summaryToken: 'APPROVAL_PERSISTENCE_LIVE_SMOKE_SUMMARY',
	});

	if (persistenceRun.summary === null) {
		printSummary({
			browser_authority: browserRun.summary,
			failure_stage: 'persistence_summary_missing',
			persistence_reconnect: {
				exit_code: persistenceRun.exit.code,
				result: 'FAIL',
				signal: persistenceRun.exit.signal,
			},
			result: 'FAIL',
			server_scope: '@runa/server',
		});
		process.exitCode = 1;
		return;
	}

	const releaseStory = buildReleaseStory(browserRun.summary, persistenceRun.summary);
	const failureStage = classifyReleaseFailure({
		browserSummary: browserRun.summary,
		persistenceSummary: persistenceRun.summary,
	});
	const result =
		browserRun.summary.result === 'PASS' &&
		persistenceRun.summary.result === 'PASS' &&
		failureStage === null
			? 'PASS'
			: browserRun.summary.result === 'BLOCKED' || persistenceRun.summary.result === 'BLOCKED'
				? 'BLOCKED'
				: 'FAIL';

	printSummary({
		browser_authority: browserRun.summary,
		failure_stage: failureStage,
		persistence_reconnect: persistenceRun.summary,
		release_story: releaseStory,
		result,
		server_scope: '@runa/server',
	});

	if (result === 'BLOCKED') {
		process.exitCode = 2;
		return;
	}

	process.exitCode = result === 'PASS' ? 0 : 1;
}

await main();
