import type { ReactElement } from 'react';

import type { RunFeedbackState } from '../../lib/chat-runtime/types.js';
import type { ConnectionStatus } from '../../ws-types.js';
import { RunFeedbackBlock } from './blocks/RunFeedbackBlock.js';
import { buildInspectionCorrelationLabel, summarizeEventListBlock } from './blocks/block-utils.js';
export type {
	GetInspectionActionState,
	InspectionActionState,
	InspectionSummaryRenderBlock,
} from './blocks/block-types.js';

export type RunFeedbackTone = RunFeedbackState['tone'];

export function getStatusAccent(status: ConnectionStatus): string {
	switch (status) {
		case 'open':
			return 'color-mix(in srgb, var(--status) 85%, white)';
		case 'error':
			return 'color-mix(in srgb, var(--error) 84%, white)';
		case 'closed':
			return 'var(--ink-2)';
		default:
			return 'color-mix(in srgb, var(--warn) 84%, white)';
	}
}

export function createPendingDetailLabel(count: number): string {
	return `${count} ${count === 1 ? 'detail pending' : 'details pending'}`;
}

export function createInspectionCountLabel(
	count: number,
	singular: string,
	plural: string,
): string {
	return `${count} ${count === 1 ? singular : plural}`;
}

export function getCodeBlockAccent(diffKind: 'after' | 'before' | 'unified' | undefined): string {
	switch (diffKind) {
		case 'before':
			return 'color-mix(in srgb, var(--warn) 84%, white)';
		case 'unified':
			return 'var(--accent-2)';
		case 'after':
			return 'color-mix(in srgb, var(--status) 85%, white)';
		default:
			return 'var(--ink-2)';
	}
}

export function renderRunFeedbackBanner(feedback: RunFeedbackState): ReactElement {
	return <RunFeedbackBlock feedback={feedback} />;
}

export { buildInspectionCorrelationLabel, summarizeEventListBlock };
