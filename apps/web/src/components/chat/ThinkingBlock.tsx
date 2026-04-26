import type { CSSProperties, ReactElement } from 'react';

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

const panelStyle: CSSProperties = {
	background: 'rgba(15, 23, 42, 0.56)',
	border: '1px solid rgba(96, 165, 250, 0.2)',
	borderRadius: '16px',
	display: 'grid',
	gap: '12px',
	padding: '14px',
};

const stepStyle: CSSProperties = {
	border: '1px solid rgba(148, 163, 184, 0.16)',
	borderRadius: '12px',
	display: 'grid',
	gap: '6px',
	padding: '10px',
};

const chipStyle: CSSProperties = {
	background: 'rgba(15, 23, 42, 0.8)',
	border: '1px solid rgba(148, 163, 184, 0.18)',
	borderRadius: '999px',
	color: '#cbd5e1',
	fontSize: '11px',
	padding: '3px 8px',
	width: 'fit-content',
};

function getStatusColor(status: ThinkingStepStatus): string {
	switch (status) {
		case 'active':
			return '#93c5fd';
		case 'completed':
			return '#86efac';
		case 'failed':
			return '#fca5a5';
		case 'paused':
			return '#fde68a';
		case 'pending':
			return '#cbd5e1';
	}
}

export function ThinkingBlock({
	duration,
	isActive = false,
	steps,
}: ThinkingBlockProps): ReactElement | null {
	if (steps.length === 0) {
		return null;
	}

	return (
		<section aria-label="Runa work summary" style={panelStyle}>
			<div
				style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', flexWrap: 'wrap' }}
			>
				<strong style={{ color: '#f8fafc' }}>
					{isActive ? 'Runa calisiyor' : 'Calisma ozeti'}
				</strong>
				{duration !== undefined ? <code style={chipStyle}>{duration}ms</code> : null}
			</div>
			<div style={{ display: 'grid', gap: '8px' }}>
				{steps.map((step) => (
					<div
						key={step.id}
						style={{ ...stepStyle, borderColor: `${getStatusColor(step.status)}55` }}
					>
						<div
							style={{
								alignItems: 'center',
								display: 'flex',
								flexWrap: 'wrap',
								gap: '8px',
								justifyContent: 'space-between',
							}}
						>
							<div style={{ color: '#f8fafc', fontWeight: 600 }}>{step.label}</div>
							<code style={{ ...chipStyle, color: getStatusColor(step.status) }}>
								{step.status}
							</code>
						</div>
						{step.detail ? (
							<div style={{ color: '#cbd5e1', lineHeight: 1.5 }}>{step.detail}</div>
						) : null}
						{step.tool_name || step.duration_ms !== undefined ? (
							<div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
								{step.tool_name ? <code style={chipStyle}>{step.tool_name}</code> : null}
								{step.duration_ms !== undefined ? (
									<code style={chipStyle}>{step.duration_ms}ms</code>
								) : null}
							</div>
						) : null}
					</div>
				))}
			</div>
		</section>
	);
}
