import type { HTMLAttributes, ReactElement } from 'react';
import { RunaBadge } from '../../ui/index.js';
import type { CapabilityProgressStep, CapabilityStatus, CapabilityTone } from './types.js';

export type CapabilityProgressListProps = Readonly<
	Omit<HTMLAttributes<HTMLOListElement>, 'children'> & {
		steps: readonly CapabilityProgressStep[];
	}
>;

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
			className={[
				['runa-capability-progress-list', className].filter(Boolean).join(' '),
				'runa-migrated-components-chat-capability-capabilityprogresslist-1',
			]
				.filter(Boolean)
				.join(' ')}
		>
			{steps.map((step) => (
				<li
					key={step.id}
					className="runa-migrated-components-chat-capability-capabilityprogresslist-2"
				>
					<div>
						<div className="runa-migrated-components-chat-capability-capabilityprogresslist-3">
							{step.label}
						</div>
						{step.description ? (
							<div className="runa-migrated-components-chat-capability-capabilityprogresslist-4">
								{step.description}
							</div>
						) : null}
					</div>
					<RunaBadge tone={getStatusTone(step.status)}>{formatStatusLabel(step.status)}</RunaBadge>
				</li>
			))}
		</ol>
	);
}
