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
			return 'var(--status-success-text)';
		case 'error':
			return 'var(--status-danger-text)';
		case 'closed':
			return 'var(--text-muted)';
		default:
			return 'var(--status-warning-text)';
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
			return 'var(--status-warning-text)';
		case 'unified':
			return 'var(--status-info-text)';
		case 'after':
			return 'var(--status-success-text)';
		default:
			return 'var(--text-muted)';
	}
}

export function renderRunFeedbackBanner(feedback: RunFeedbackState): ReactElement {
	return <RunFeedbackBlock feedback={feedback} />;
}

export { buildInspectionCorrelationLabel, summarizeEventListBlock };
