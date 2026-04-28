import type { CSSProperties, ReactElement } from 'react';

export type ToolActivityItem = Readonly<{
	detail?: string;
	id: string;
	label: string;
	status: 'active' | 'completed' | 'failed';
}>;

type ToolActivityIndicatorProps = Readonly<{
	items: readonly ToolActivityItem[];
}>;

const listStyle: CSSProperties = {
	display: 'flex',
	flexWrap: 'wrap',
	gap: '8px',
};

const itemStyle: CSSProperties = {
	alignItems: 'center',
	background: 'rgba(15, 23, 42, 0.72)',
	border: '1px solid rgba(148, 163, 184, 0.18)',
	borderRadius: '999px',
	color: '#cbd5e1',
	display: 'inline-flex',
	fontSize: '12px',
	gap: '6px',
	minWidth: 0,
	padding: '5px 10px',
};

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
		<div aria-label="Tool activity" style={listStyle}>
			{items.map((item) => (
				<div
					key={item.id}
					title={item.detail}
					style={{ ...itemStyle, borderColor: `${getStatusColor(item.status)}55` }}
				>
					<span style={{ color: getStatusColor(item.status), fontWeight: 700 }}>{item.status}</span>
					<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
						{item.label}
					</span>
				</div>
			))}
		</div>
	);
}
