import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from 'react';
import { useId } from 'react';

import { designTokens } from '../../../lib/design-tokens.js';
import { RunaBadge } from '../../ui/index.js';
import type { CapabilityStatus, CapabilityTone } from './types.js';

export type CapabilityCardElement = 'article' | 'div';

export type CapabilityCardProps = Readonly<
	Omit<HTMLAttributes<HTMLElement>, 'title'> & {
		as?: CapabilityCardElement;
		children?: ReactNode;
		description?: ReactNode;
		eyebrow?: string;
		headerAside?: ReactNode;
		status?: CapabilityStatus;
		title?: ReactNode;
		titleId?: string;
		tone?: CapabilityTone;
	}
>;

const baseCardStyle: CSSProperties = {
	backdropFilter: 'blur(12px)',
	background: designTokens.color.background.subtle,
	border: `1px solid ${designTokens.color.border.soft}`,
	borderRadius: designTokens.radius.soft,
	boxShadow: designTokens.shadow.panelSoft,
	display: 'grid',
	gap: designTokens.spacing.lg,
	minWidth: 0,
	overflow: 'hidden',
	padding: designTokens.spacing.subcard,
	position: 'relative',
	transition: designTokens.motion.transition.surface,
};

const headerStyle: CSSProperties = {
	alignItems: 'flex-start',
	display: 'flex',
	flexWrap: 'wrap',
	gap: designTokens.spacing.md,
	justifyContent: 'space-between',
	minWidth: 0,
};

const copyStackStyle: CSSProperties = {
	display: 'grid',
	gap: designTokens.spacing.xs,
	minWidth: 0,
};

const eyebrowStyle: CSSProperties = {
	...designTokens.typography.label,
	color: designTokens.color.foreground.soft,
};

const titleStyle: CSSProperties = {
	color: designTokens.color.foreground.strong,
	fontSize: '16px',
	lineHeight: 1.4,
	margin: 0,
};

const descriptionStyle: CSSProperties = {
	color: designTokens.color.foreground.muted,
	lineHeight: designTokens.typography.text.lineHeight,
	margin: 0,
};

const bodyStyle: CSSProperties = {
	display: 'grid',
	gap: designTokens.spacing.md,
	minWidth: 0,
};

const toneBorderStyles: Record<CapabilityTone, CSSProperties> = {
	danger: {
		borderColor: designTokens.color.border.danger,
	},
	info: {
		borderColor: designTokens.color.border.info,
	},
	neutral: {
		borderColor: designTokens.color.border.soft,
	},
	success: {
		borderColor: designTokens.color.border.success,
	},
	warning: {
		borderColor: designTokens.color.border.warning,
	},
};

function getStatusTone(status: CapabilityStatus | undefined, tone: CapabilityTone): CapabilityTone {
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
		default:
			return tone;
	}
}

function formatStatusLabel(status: CapabilityStatus): string {
	return status.replace(/_/gu, ' ');
}

export function CapabilityCard({
	as = 'div',
	children,
	className,
	description,
	eyebrow,
	headerAside,
	status,
	style,
	title,
	titleId,
	tone = 'neutral',
	...cardProps
}: CapabilityCardProps): ReactElement {
	const generatedHeadingId = useId();
	const headingId = titleId ?? generatedHeadingId;
	const labelledBy = cardProps['aria-labelledby'] ?? (title ? headingId : undefined);
	const statusTone = getStatusTone(status, tone);
	const CardElement = as;

	return (
		<CardElement
			{...cardProps}
			aria-labelledby={labelledBy}
			className={['runa-ui-card', 'runa-ui-card--subtle', 'runa-capability-card', className]
				.filter(Boolean)
				.join(' ')}
			style={{ ...baseCardStyle, ...toneBorderStyles[tone], ...style }}
		>
			<div style={headerStyle}>
				<div style={copyStackStyle}>
					{eyebrow ? <div style={eyebrowStyle}>{eyebrow}</div> : null}
					{title ? (
						<h3 id={headingId} style={titleStyle}>
							{title}
						</h3>
					) : null}
					{description ? <p style={descriptionStyle}>{description}</p> : null}
				</div>
				{headerAside ??
					(status ? <RunaBadge tone={statusTone}>{formatStatusLabel(status)}</RunaBadge> : null)}
			</div>
			{children ? <div style={bodyStyle}>{children}</div> : null}
		</CardElement>
	);
}
