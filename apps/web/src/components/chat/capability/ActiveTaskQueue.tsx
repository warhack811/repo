import type { HTMLAttributes, ReactElement } from 'react';
import { RunaBadge, RunaCard } from '../../ui/index.js';
import type { ActiveTaskQueueItem, CapabilityStatus, CapabilityTone } from './types.js';

export type ActiveTaskQueueProps = Readonly<
	Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
		items: readonly ActiveTaskQueueItem[];
		title?: string;
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
			className={[
				['runa-active-task-queue', className].filter(Boolean).join(' '),
				'runa-migrated-components-chat-capability-activetaskqueue-1',
			]
				.filter(Boolean)
				.join(' ')}
			tone="subtle"
		>
			<div className="runa-migrated-components-chat-capability-activetaskqueue-2">
				<h3 className="runa-migrated-components-chat-capability-activetaskqueue-3">{title}</h3>
				<ul className="runa-migrated-components-chat-capability-activetaskqueue-4">
					{items.map((item) => (
						<li
							key={item.id}
							className="runa-migrated-components-chat-capability-activetaskqueue-5"
						>
							<div>
								<div className="runa-migrated-components-chat-capability-activetaskqueue-6">
									{item.title}
								</div>
								{item.description ? (
									<div className="runa-migrated-components-chat-capability-activetaskqueue-7">
										{item.description}
									</div>
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
