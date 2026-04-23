import type { CSSProperties, ReactElement, ReactNode } from 'react';

import type { CurrentRunProgressSurface } from '../../lib/chat-runtime/current-run-progress.js';
import { uiCopy } from '../../localization/copy.js';
import { RunStatusChips } from './RunStatusChips.js';

type RunProgressPanelProps = Readonly<{
	feedbackBanner?: ReactNode;
	progress: CurrentRunProgressSurface;
}>;

const panelStyle: CSSProperties = {
	borderRadius: '18px',
	border: '1px solid rgba(96, 165, 250, 0.22)',
	background: 'linear-gradient(180deg, rgba(10, 20, 38, 0.94) 0%, rgba(3, 8, 24, 0.9) 100%)',
	padding: 'clamp(16px, 3vw, 20px)',
	display: 'grid',
	gap: '16px',
};

const sectionLabelStyle: CSSProperties = {
	fontSize: '11px',
	letterSpacing: '0.08em',
	textTransform: 'uppercase',
	color: '#93c5fd',
};

const stepGridStyle: CSSProperties = {
	display: 'grid',
	gap: '10px',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
};

const stepCardStyle: CSSProperties = {
	padding: '12px',
	borderRadius: '14px',
	border: '1px solid rgba(148, 163, 184, 0.18)',
	background: 'rgba(15, 23, 42, 0.62)',
	display: 'grid',
	gap: '8px',
	minWidth: 0,
};

const stepMetaStyle: CSSProperties = {
	display: 'flex',
	gap: '8px',
	flexWrap: 'wrap',
};

const chipStyle: CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	padding: '3px 8px',
	borderRadius: '999px',
	background: 'rgba(15, 23, 42, 0.82)',
	border: '1px solid rgba(148, 163, 184, 0.18)',
	color: '#cbd5e1',
	fontSize: '11px',
};

function getPanelAccent(tone: CurrentRunProgressSurface['status_tone']): Readonly<{
	readonly borderColor: string;
	readonly eyebrowColor: string;
}> {
	switch (tone) {
		case 'success':
			return {
				borderColor: 'rgba(34, 197, 94, 0.26)',
				eyebrowColor: '#86efac',
			};
		case 'warning':
			return {
				borderColor: 'rgba(250, 204, 21, 0.26)',
				eyebrowColor: '#fde68a',
			};
		case 'error':
			return {
				borderColor: 'rgba(248, 113, 113, 0.26)',
				eyebrowColor: '#fca5a5',
			};
		default:
			return {
				borderColor: 'rgba(96, 165, 250, 0.24)',
				eyebrowColor: '#93c5fd',
			};
	}
}

export function RunProgressPanel({
	feedbackBanner,
	progress,
}: RunProgressPanelProps): ReactElement {
	const accent = getPanelAccent(progress.status_tone);

	return (
		<section
			aria-labelledby="current-run-progress-heading"
			style={{
				...panelStyle,
				borderColor: accent.borderColor,
			}}
		>
			<div style={{ display: 'grid', gap: '8px' }}>
				<div style={{ ...sectionLabelStyle, color: accent.eyebrowColor }}>
					{uiCopy.run.currentRunProgress}
				</div>
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'flex-start',
						gap: '12px',
						flexWrap: 'wrap',
					}}
				>
					<div style={{ display: 'grid', gap: '8px', maxWidth: 'min(760px, 100%)' }}>
						<h3
							id="current-run-progress-heading"
							style={{ margin: 0, fontSize: '20px', color: '#f8fafc' }}
						>
							{progress.headline}
						</h3>
						<div style={{ color: '#cbd5e1', lineHeight: 1.6 }}>{progress.detail}</div>
					</div>
					{progress.correlation_label ? (
						<code style={chipStyle}>{progress.correlation_label}</code>
					) : null}
				</div>
			</div>

			{feedbackBanner}

			<div style={{ display: 'grid', gap: '10px' }}>
				<div style={sectionLabelStyle}>{uiCopy.run.runtimePhases}</div>
				<RunStatusChips ariaLabel="Current run runtime phases" items={progress.phase_items} />
			</div>

			<div style={{ display: 'grid', gap: '10px' }}>
				<div style={sectionLabelStyle}>{uiCopy.run.currentSurfaceContext}</div>
				<RunStatusChips ariaLabel="Current run context" items={progress.meta_items} />
			</div>

			{progress.approval_block?.payload.target_label ? (
				<div style={{ display: 'grid', gap: '8px' }}>
					<div style={sectionLabelStyle}>Hedef cihaz</div>
					<div style={{ ...chipStyle, width: 'fit-content', color: '#f8fafc' }}>
						{progress.approval_block.payload.target_label}
					</div>
				</div>
			) : null}

			{progress.step_items.length > 0 ? (
				<div style={{ display: 'grid', gap: '10px' }}>
					<div
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							gap: '12px',
							flexWrap: 'wrap',
						}}
					>
						<div style={sectionLabelStyle}>{uiCopy.run.observedSteps}</div>
						{progress.hidden_step_count > 0 ? (
							<div style={{ color: '#94a3b8', fontSize: '12px' }}>
								{uiCopy.run.showingLatestSteps.replace(
									'{count}',
									progress.step_items.length.toString(),
								)}
							</div>
						) : null}
					</div>
					<div style={stepGridStyle}>
						{progress.step_items.map((item, index) => (
							<div
								key={`${item.kind}:${item.call_id ?? item.label}:${index}`}
								style={{
									...stepCardStyle,
									borderColor:
										index === progress.step_items.length - 1
											? 'rgba(96, 165, 250, 0.26)'
											: 'rgba(148, 163, 184, 0.18)',
								}}
							>
								<div style={{ color: '#f8fafc', fontWeight: 600 }}>{item.label}</div>
								{item.detail ? (
									<div style={{ color: '#cbd5e1', lineHeight: 1.5 }}>{item.detail}</div>
								) : null}
								{item.tool_name || item.call_id || item.state ? (
									<div style={stepMetaStyle}>
										{item.state ? <span style={chipStyle}>{item.state}</span> : null}
										{item.tool_name ? <code style={chipStyle}>{item.tool_name}</code> : null}
										{item.call_id ? <code style={chipStyle}>{item.call_id}</code> : null}
									</div>
								) : null}
							</div>
						))}
					</div>
				</div>
			) : null}

			{progress.approval_block ? (
				<div style={{ color: '#fcd34d', fontSize: '13px', lineHeight: 1.6 }}>
					{uiCopy.run.approvalBoundary}: {progress.approval_block.payload.title}
				</div>
			) : null}
		</section>
	);
}
