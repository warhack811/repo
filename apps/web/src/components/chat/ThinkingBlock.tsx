import type { ReactElement } from 'react';

import { RunaDisclosure } from '../ui/RunaDisclosure.js';
import styles from './ThinkingBlock.module.css';

export type ThinkingStepStatus = 'active' | 'completed' | 'failed' | 'paused' | 'pending';

export type ThinkingStep = Readonly<{
	detail?: string;
	duration_ms?: number;
	id: string;
	label: string;
	status: ThinkingStepStatus;
	tool_name?: string;
}>;

type ThinkingBlockProps = Readonly<{
	duration?: number;
	isActive?: boolean;
	steps: readonly ThinkingStep[];
}>;

function ThinkingDots(): ReactElement {
	return (
		<span aria-hidden="true" className={styles['dots']}>
			<span />
			<span />
			<span />
		</span>
	);
}

function renderStep(step: ThinkingStep): ReactElement {
	return (
		<div className={styles['step']} key={step.id}>
			<div className={styles['stepTop']}>
				<div className={styles['stepTitle']}>{step.label}</div>
				<code className={styles['chip']}>{step.status}</code>
			</div>
			{step.detail ? <div className={styles['detail']}>{step.detail}</div> : null}
			{step.tool_name || step.duration_ms !== undefined ? (
				<div className={styles['meta']}>
					{step.tool_name ? <code className={styles['chip']}>{step.tool_name}</code> : null}
					{step.duration_ms !== undefined ? (
						<code className={styles['chip']}>{step.duration_ms}ms</code>
					) : null}
				</div>
			) : null}
		</div>
	);
}

export function ThinkingBlock({
	duration,
	isActive = false,
	steps,
}: ThinkingBlockProps): ReactElement | null {
	if (steps.length === 0) {
		return null;
	}

	const title = isActive ? (
		<span className={styles['title']}>
			<ThinkingDots />
			Runa calisiyor - Dusunuyor...
		</span>
	) : (
		<span className={styles['title']}>Dusunme sureci</span>
	);

	return (
		<section aria-label="Runa work summary" className={styles['thinking']}>
			<div className={styles['header']}>
				{title}
				{duration !== undefined ? <code className={styles['duration']}>{duration}ms</code> : null}
			</div>
			<RunaDisclosure defaultOpen={isActive} title={isActive ? 'Canli adimlar' : 'Detayi goster'}>
				<div className={styles['steps']}>{steps.map((step) => renderStep(step))}</div>
			</RunaDisclosure>
		</section>
	);
}
