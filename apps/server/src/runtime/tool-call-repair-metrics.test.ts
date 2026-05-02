import { describe, expect, it } from 'vitest';

import {
	getToolCallRepairTerminalFailureTotal,
	recordToolCallRepairTerminalFailure,
	resetToolCallRepairTerminalFailureTotal,
} from './tool-call-repair-metrics.js';

describe('tool-call-repair-metrics', () => {
	it('increments the process-local terminal failure counter', () => {
		resetToolCallRepairTerminalFailureTotal();

		const total = recordToolCallRepairTerminalFailure({
			intent: 'tool_heavy',
			provider: 'deepseek',
			strategies_tried: ['strict_reinforce', 'tool_subset', 'force_no_tools'],
		});

		expect(total).toBe(1);
		expect(getToolCallRepairTerminalFailureTotal()).toBe(1);
	});
});
