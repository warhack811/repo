import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { useId } from 'react';
import { RunaBadge } from '../../ui/RunaBadge.js';
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
			className={[
				['runa-ui-card', 'runa-ui-card--subtle', 'runa-capability-card', className]
					.filter(Boolean)
					.join(' '),
				'runa-migrated-components-chat-capability-capabilitycard-1',
			]
				.filter(Boolean)
				.join(' ')}
		>
			<div className="runa-migrated-components-chat-capability-capabilitycard-2">
				<div className="runa-migrated-components-chat-capability-capabilitycard-3">
					{eyebrow ? (
						<div className="runa-migrated-components-chat-capability-capabilitycard-4">
							{eyebrow}
						</div>
					) : null}
					{title ? (
						<h3
							id={headingId}
							className="runa-migrated-components-chat-capability-capabilitycard-5"
						>
							{title}
						</h3>
					) : null}
					{description ? (
						<p className="runa-migrated-components-chat-capability-capabilitycard-6">
							{description}
						</p>
					) : null}
				</div>
				{headerAside ??
					(status ? <RunaBadge tone={statusTone}>{formatStatusLabel(status)}</RunaBadge> : null)}
			</div>
			{children ? (
				<div className="runa-migrated-components-chat-capability-capabilitycard-7">{children}</div>
			) : null}
		</CardElement>
	);
}
