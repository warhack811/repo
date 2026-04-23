export type ApprovalReleaseChain = Readonly<{
	approval_boundary_observed: boolean;
	approval_resolve_sent: boolean;
	continuation_observed: boolean;
	reconnect_restart_tolerated: boolean;
	terminal_run_finished_completed: boolean;
}>;

export function classifyApprovalReleaseChainFailure(
	chain: ApprovalReleaseChain | null | undefined,
): string | null {
	if (chain == null) {
		return 'summary_missing';
	}

	if (chain.approval_boundary_observed !== true) {
		return 'approval_boundary_missing';
	}

	if (chain.approval_resolve_sent !== true) {
		return 'approval_resolve_missing';
	}

	if (chain.continuation_observed !== true) {
		return 'continuation_missing';
	}

	if (chain.reconnect_restart_tolerated !== true) {
		return 'restart_reconnect_missing';
	}

	if (chain.terminal_run_finished_completed !== true) {
		return 'terminal_finish_missing';
	}

	return null;
}

export function extractApprovalReleaseSummaryFromOutput<T>(
	output: string,
	summaryToken: string,
): T | null {
	const lines = output.split(/\r?\n/u);

	for (let index = lines.length - 1; index >= 0; index -= 1) {
		const line = lines[index]?.trim();

		if (!line?.startsWith(`${summaryToken} `)) {
			continue;
		}

		return JSON.parse(line.slice(summaryToken.length + 1)) as T;
	}

	return null;
}
