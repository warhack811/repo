import type { CSSProperties, HTMLAttributes, ReactElement } from 'react';

import { designTokens } from '../../../lib/design-tokens.js';
import { RunaBadge } from '../../ui/index.js';
import type { CapabilityProgressStep, CapabilityStatus, CapabilityTone } from './types.js';

export type CapabilityProgressListProps = Readonly<
	Omit<HTMLAttributes<HTMLOListElement>, 'children'> & {
		steps: readonly CapabilityProgressStep[];
	}
>;

const listStyle: CSSProperties = {
	display: 'grid',
	gap: designTokens.spacing.sm,
	listStyle: 'none',
	margin: 0,
	padding: 0,
};

const itemStyle: CSSProperties = {
	alignItems: 'flex-start',
	background: 'rgba(15, 23, 42, 0.46)',
	border: `1px solid ${designTokens.color.border.soft}`,
	borderRadius: designTokens.radius.soft,
	display: 'grid',
	gap: designTokens.spacing.xs,
	gridTemplateColumns: 'minmax(0, 1fr) auto',
	minWidth: 0,
	padding: designTokens.spacing.md,
	transition: designTokens.motion.transition.surface,
};

const labelStyle: CSSProperties = {
	color: designTokens.color.foreground.text,
	fontWeight: 700,
	lineHeight: 1.4,
};

const descriptionStyle: CSSProperties = {
	color: designTokens.color.foreground.muted,
	fontSize: designTokens.typography.small.fontSize,
	lineHeight: designTokens.typography.small.lineHeight,
};

function getStatusTone(status: CapabilityStatus): CapabilityTone {
	switch (status) {
		case 'completed':
			return 'success';
		case 'failed':
			return 'danger';
		case 'running':
			return 'info';
		case 'waiting':
			return 'warning';
		case 'queued':
			return 'neutral';
	}
}

function formatStatusLabel(status: CapabilityStatus): string {
	return status;
}

export function CapabilityProgressList({
	className,
	steps,
	style,
	...listProps
}: CapabilityProgressListProps): ReactElement | null {
	if (steps.length === 0) {
		return null;
	}

	return (
		<ol
			{...listProps}
			className={['runa-capability-progress-list', className].filter(Boolean).join(' ')}
			style={{ ...listStyle, ...style }}
		>
			{steps.map((step) => (
				<li key={step.id} style={itemStyle}>
					<div>
						<div style={labelStyle}>{step.label}</div>
						{step.description ? <div style={descriptionStyle}>{step.description}</div> : null}
					</div>
					<RunaBadge tone={getStatusTone(step.status)}>{formatStatusLabel(step.status)}</RunaBadge>
				</li>
			))}
		</ol>
	);
}
