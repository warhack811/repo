import type { CSSProperties, HTMLAttributes, ReactElement } from 'react';

import { designTokens } from '../../../lib/design-tokens.js';
import { RunaBadge, RunaCard } from '../../ui/index.js';
import type { ActiveTaskQueueItem, CapabilityStatus, CapabilityTone } from './types.js';

export type ActiveTaskQueueProps = Readonly<
	Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
		items: readonly ActiveTaskQueueItem[];
		title?: string;
	}
>;

const queueStyle: CSSProperties = {
	display: 'grid',
	gap: designTokens.spacing.md,
};

const headingStyle: CSSProperties = {
	color: designTokens.color.foreground.strong,
	fontSize: '15px',
	fontWeight: 700,
	margin: 0,
};

const listStyle: CSSProperties = {
	display: 'grid',
	gap: designTokens.spacing.sm,
	listStyle: 'none',
	margin: 0,
	padding: 0,
};

const itemStyle: CSSProperties = {
	alignItems: 'flex-start',
	background: 'rgba(15, 23, 42, 0.42)',
	border: `1px solid ${designTokens.color.border.soft}`,
	borderRadius: designTokens.radius.soft,
	display: 'grid',
	gap: designTokens.spacing.xs,
	gridTemplateColumns: 'minmax(0, 1fr) auto',
	padding: designTokens.spacing.md,
};

const itemTitleStyle: CSSProperties = {
	color: designTokens.color.foreground.text,
	fontWeight: 700,
	lineHeight: 1.4,
};

const itemDescriptionStyle: CSSProperties = {
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

export function ActiveTaskQueue({
	className,
	items,
	style,
	title = 'Active tasks',
	...queueProps
}: ActiveTaskQueueProps): ReactElement | null {
	if (items.length === 0) {
		return null;
	}

	return (
		<RunaCard
			{...queueProps}
			className={['runa-active-task-queue', className].filter(Boolean).join(' ')}
			style={style}
			tone="subtle"
		>
			<div style={queueStyle}>
				<h3 style={headingStyle}>{title}</h3>
				<ul style={listStyle}>
					{items.map((item) => (
						<li key={item.id} style={itemStyle}>
							<div>
								<div style={itemTitleStyle}>{item.title}</div>
								{item.description ? (
									<div style={itemDescriptionStyle}>{item.description}</div>
								) : null}
							</div>
							<RunaBadge tone={item.tone ?? getStatusTone(item.status)}>{item.status}</RunaBadge>
						</li>
					))}
				</ul>
			</div>
		</RunaCard>
	);
}
