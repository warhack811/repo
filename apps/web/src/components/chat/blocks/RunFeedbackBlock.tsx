import type { ReactElement } from 'react';

import type { RunFeedbackState } from '../../../lib/chat-runtime/types.js';
import { cx } from '../../ui/ui-utils.js';
import styles from './BlockRenderer.module.css';
import { buildInspectionCorrelationLabel } from './block-utils.js';

type RunFeedbackBlockProps = Readonly<{
	feedback: RunFeedbackState;
}>;

function getToneClass(tone: RunFeedbackState['tone']): string | undefined {
	switch (tone) {
		case 'error':
			return styles['blockDanger'];
		case 'success':
			return styles['blockSuccess'];
		case 'warning':
			return styles['blockWarning'];
		case 'info':
			return styles['blockMuted'];
	}
}

function createPendingDetailLabel(count: number): string {
	return `${count} ${count === 1 ? 'detail pending' : 'details pending'}`;
}

export function RunFeedbackBlock({ feedback }: RunFeedbackBlockProps): ReactElement {
	const correlationLabel = buildInspectionCorrelationLabel(feedback.run_id, feedback.trace_id);

	return (
		<div aria-live="polite" className={cx(styles['block'], getToneClass(feedback.tone))}>
			<div className={styles['header']}>
				<div className={styles['headerStack']}>
					<span className={styles['eyebrow']}>Run feedback</span>
					<strong className={styles['title']}>{feedback.title}</strong>
				</div>
				<code className={styles['chip']}>{feedback.chip_label}</code>
			</div>
			<p className={styles['summary']}>{feedback.detail}</p>
			<div className={styles['chipRow']}>
				{correlationLabel ? <code className={styles['chip']}>{correlationLabel}</code> : null}
				{feedback.pending_detail_count > 0 ? (
					<code className={styles['chip']}>
						{createPendingDetailLabel(feedback.pending_detail_count)}
					</code>
				) : null}
			</div>
		</div>
	);
}
