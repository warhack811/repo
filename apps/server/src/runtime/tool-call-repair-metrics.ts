import type { ModelRouteIntent } from '../gateway/model-router.js';
import type { GatewayProvider } from '../gateway/providers.js';
import { createLogger } from '../utils/logger.js';
import type { RepairStrategy } from './tool-call-repair-recovery.js';

let terminalFailureTotal = 0;

const metricsLogger = createLogger({
	context: {
		component: 'runtime.tool_call_repair_metrics',
	},
});

export interface RecordToolCallRepairTerminalFailureInput {
	readonly intent?: ModelRouteIntent;
	readonly provider: GatewayProvider;
	readonly strategies_tried: readonly RepairStrategy[];
}

export function recordToolCallRepairTerminalFailure(
	input: RecordToolCallRepairTerminalFailureInput,
): number {
	terminalFailureTotal += 1;
	metricsLogger.warn('tool_call_repair_terminal_failure', {
		intent: input.intent,
		metric: 'tool_call_repair_terminal_failure',
		provider: input.provider,
		strategies_tried: input.strategies_tried,
		tool_call_repair_terminal_failure_total: terminalFailureTotal,
	});

	return terminalFailureTotal;
}

export function getToolCallRepairTerminalFailureTotal(): number {
	return terminalFailureTotal;
}

export function resetToolCallRepairTerminalFailureTotal(): void {
	terminalFailureTotal = 0;
}
