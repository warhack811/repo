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
			return '#22c55e';
		case 'error':
			return '#f87171';
		case 'closed':
			return '#94a3b8';
		default:
			return '#f59e0b';
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
			return '#fbbf24';
		case 'unified':
			return '#38bdf8';
		case 'after':
			return '#34d399';
		default:
			return '#94a3b8';
	}
}

export function renderRunFeedbackBanner(feedback: RunFeedbackState): ReactElement {
	return <RunFeedbackBlock feedback={feedback} />;
}

export { buildInspectionCorrelationLabel, summarizeEventListBlock };
