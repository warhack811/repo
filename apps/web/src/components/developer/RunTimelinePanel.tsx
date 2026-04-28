import type { CSSProperties, ReactElement, ReactNode } from 'react';

import {
	emptyStateCardStyle,
	eventListStyle,
	inspectionChipStyle,
	inspectionSurfaceBannerStyle,
	panelStyle,
	pillStyle,
	secondaryButtonStyle,
	secondaryLabelStyle,
	secondarySurfaceStyle,
} from '../../lib/chat-styles.js';
import { uiCopy } from '../../localization/copy.js';

type RunTimelinePanelProps = Readonly<{
	currentInspectionSurfaceMeta: Readonly<{
		detail_count: number;
		summary_count: number;
	}> | null;
	currentPresentationContent: ReactNode;
	currentRunProgressPanel: ReactNode;
	emptyStateContent: ReactNode;
	pastPresentationContent: ReactNode;
	pastPresentationSurfaceCount: number;
	presentationRunSurfaceCount: number;
	recentSessionRunsLabel: string;
	showRecentSessionRuns: boolean;
	onToggleRecentSessionRuns: () => void;
}>;

const inspectionChipListStyle: CSSProperties = {
	display: 'flex',
	flexWrap: 'wrap',
	gap: '8px',
};

const visuallyHiddenStyle: CSSProperties = {
	border: 0,
	clip: 'rect(0 0 0 0)',
	height: '1px',
	margin: '-1px',
	overflow: 'hidden',
	padding: 0,
	position: 'absolute',
	whiteSpace: 'nowrap',
	width: '1px',
};

function createInspectionCountLabel(count: number, singular: string, plural: string): string {
	return `${count} ${count === 1 ? singular : plural}`;
}

export function RunTimelinePanel({
	currentInspectionSurfaceMeta,
	currentPresentationContent,
	currentRunProgressPanel,
	emptyStateContent,
	pastPresentationContent,
	pastPresentationSurfaceCount,
	presentationRunSurfaceCount,
	recentSessionRunsLabel,
	showRecentSessionRuns,
	onToggleRecentSessionRuns,
}: RunTimelinePanelProps): ReactElement {
	return (
		<section
			style={{ ...panelStyle, padding: 'clamp(18px, 3vw, 22px)' }}
			aria-labelledby="presentation-blocks-heading"
			aria-describedby="inspection-surface-a11y-note"
			className="runa-ambient-panel"
		>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					gap: '12px',
					flexWrap: 'wrap',
					marginBottom: '12px',
				}}
			>
				<h2 id="presentation-blocks-heading" style={{ margin: 0, fontSize: '20px' }}>
					{uiCopy.run.surfaceHeading}
				</h2>
				<div style={{ ...pillStyle, padding: '6px 10px' }}>
					{createInspectionCountLabel(presentationRunSurfaceCount, 'run surface', 'run surfaces')}
				</div>
			</div>
			<p id="inspection-surface-a11y-note" style={visuallyHiddenStyle}>
				Inspection detail actions append a focused card below the related summary inside the same
				run group and move keyboard focus to that card. Use Back to summary to return focus to the
				linked summary card.
			</p>

			<div style={eventListStyle}>
				{currentRunProgressPanel}
				{presentationRunSurfaceCount === 0 ? (
					emptyStateContent
				) : (
					<>
						{currentInspectionSurfaceMeta ? (
							<div style={inspectionSurfaceBannerStyle}>
								<div
									style={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'flex-start',
										gap: '12px',
										flexWrap: 'wrap',
									}}
								>
									<div style={{ display: 'grid', gap: '6px', maxWidth: 'min(720px, 100%)' }}>
										<div lang="tr" style={{ ...secondaryLabelStyle, color: '#93c5fd' }}>
											{uiCopy.run.currentRunProgress}
										</div>
										<div style={{ color: '#e5e7eb', lineHeight: 1.5 }}>
											{uiCopy.run.surfaceSubtitle}
										</div>
									</div>
									<div style={inspectionChipListStyle}>
										<code style={inspectionChipStyle}>
											{createInspectionCountLabel(
												currentInspectionSurfaceMeta.summary_count,
												'summary card',
												'summary cards',
											)}
										</code>
										<code style={inspectionChipStyle}>
											{createInspectionCountLabel(
												currentInspectionSurfaceMeta.detail_count,
												'detail card',
												'detail cards',
											)}
										</code>
										{pastPresentationSurfaceCount > 0 ? (
											<code style={inspectionChipStyle}>
												{createInspectionCountLabel(
													pastPresentationSurfaceCount,
													'recent run',
													'recent runs',
												)}
											</code>
										) : null}
									</div>
								</div>
							</div>
						) : null}
						{currentPresentationContent}
						{pastPresentationSurfaceCount > 0 ? (
							<div style={secondarySurfaceStyle}>
								<div
									style={{
										display: 'flex',
										alignItems: 'flex-start',
										justifyContent: 'space-between',
										gap: '12px',
										flexWrap: 'wrap',
									}}
								>
									<div style={{ display: 'grid', gap: '4px', maxWidth: 'min(720px, 100%)' }}>
										<div lang="tr" style={secondaryLabelStyle}>
											{uiCopy.run.pastRuns}
										</div>
										<div style={{ color: '#cbd5e1', lineHeight: 1.5 }}>
											{uiCopy.run.pastRunsCollapsed}
										</div>
									</div>
									<button
										type="button"
										onClick={onToggleRecentSessionRuns}
										aria-expanded={showRecentSessionRuns}
										aria-controls="recent-session-runs-panel"
										style={secondaryButtonStyle}
									>
										{recentSessionRunsLabel}
									</button>
								</div>
								{showRecentSessionRuns ? (
									<div id="recent-session-runs-panel">{pastPresentationContent}</div>
								) : (
									<div id="recent-session-runs-panel" style={emptyStateCardStyle}>
										{uiCopy.run.pastRunsCollapsed}
									</div>
								)}
							</div>
						) : null}
					</>
				)}
			</div>
		</section>
	);
}
