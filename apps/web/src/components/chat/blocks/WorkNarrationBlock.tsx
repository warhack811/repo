import { CheckCircle2, LoaderCircle, TriangleAlert } from 'lucide-react';
import type { ReactElement } from 'react';

import type { RenderBlock } from '../../../ws-types.js';
import styles from './WorkNarrationBlock.module.css';

type WorkNarrationRenderBlock = Extract<RenderBlock, { type: 'work_narration' }>;

export type WorkNarrationBlockProps = Readonly<{
	block: WorkNarrationRenderBlock;
	replayMode?: boolean;
}>;

function resolveClassName(
	status: WorkNarrationRenderBlock['payload']['status'],
	replayMode: boolean,
): string {
	const classNames = [styles['narration']];

	if (status === 'streaming') {
		classNames.push(styles['streaming']);
	} else if (status === 'tool_failed') {
		classNames.push(styles['toolFailed']);
	} else {
		classNames.push(styles['completed']);
	}

	if (replayMode) {
		classNames.push(styles['replay']);
	}

	return classNames.join(' ');
}

function renderIcon(status: WorkNarrationRenderBlock['payload']['status']): ReactElement {
	if (status === 'streaming') {
		return <LoaderCircle aria-hidden="true" className={`${styles['icon']} ${styles['spinner']}`} />;
	}

	if (status === 'tool_failed') {
		return <TriangleAlert aria-hidden="true" className={styles['icon']} />;
	}

	return <CheckCircle2 aria-hidden="true" className={styles['icon']} />;
}

export function WorkNarrationBlock({
	block,
	replayMode = false,
}: WorkNarrationBlockProps): ReactElement | null {
	if (block.payload.status === 'superseded') {
		return null;
	}

	const text = block.payload.text.trim();

	if (text.length === 0) {
		return null;
	}

	return (
		<div
			className={resolveClassName(block.payload.status, replayMode)}
			aria-live={block.payload.status === 'streaming' ? 'polite' : undefined}
		>
			{renderIcon(block.payload.status)}
			<span className={styles['text']}>{text}</span>
		</div>
	);
}
