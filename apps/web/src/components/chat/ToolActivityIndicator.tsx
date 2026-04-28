import type { ReactElement } from 'react';

export type ToolActivityItem = Readonly<{
	detail?: string;
	id: string;
	label: string;
	status: 'active' | 'completed' | 'failed';
}>;

type ToolActivityIndicatorProps = Readonly<{
	items: readonly ToolActivityItem[];
}>;

function getStatusColor(status: ToolActivityItem['status']): string {
	switch (status) {
		case 'active':
			return '#93c5fd';
		case 'completed':
			return '#86efac';
		case 'failed':
			return '#fca5a5';
	}
}

export function ToolActivityIndicator({ items }: ToolActivityIndicatorProps): ReactElement | null {
	if (items.length === 0) {
		return null;
	}

	return (
		<div
			aria-label="Tool activity"
			className="runa-migrated-components-chat-toolactivityindicator-1"
		>
			{items.map((item) => (
				<div
					key={item.id}
					title={item.detail}
					className="runa-migrated-components-chat-toolactivityindicator-2"
				>
					<span className="runa-migrated-components-chat-toolactivityindicator-3">
						{item.status}
					</span>
					<span className="runa-migrated-components-chat-toolactivityindicator-4">
						{item.label}
					</span>
				</div>
			))}
		</div>
	);
}
