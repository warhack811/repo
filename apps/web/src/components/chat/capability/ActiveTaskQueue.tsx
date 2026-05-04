import type { HTMLAttributes, ReactElement } from 'react';
import { RunaBadge } from '../../ui/RunaBadge.js';
import { RunaCard } from '../../ui/RunaCard.js';
import type { ActiveTaskQueueItem, CapabilityStatus, CapabilityTone } from './types.js';
import styles from './ActiveTaskQueue.module.css';

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
				styles['root'],
			]
				.filter(Boolean)
				.join(' ')}
			tone="subtle"
		>
			<div className={styles['content']}>
				<h3 className={styles['title']}>{title}</h3>
				<ul className={styles['taskList']}>
					{items.map((item) => (
						<li
							key={item.id}
							className={styles['taskItem']}
						>
							<div>
								<div className={styles['taskTitle']}>
									{item.title}
								</div>
								{item.description ? (
									<div className={styles['taskDescription']}>
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
