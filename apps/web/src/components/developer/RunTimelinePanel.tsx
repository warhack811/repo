import type { ReactElement, ReactNode } from 'react';
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
			aria-labelledby="presentation-blocks-heading"
			aria-describedby="inspection-surface-a11y-note"
			className="runa-ambient-panel runa-developer-runtimelinepanel-1"
		>
			<div className="runa-developer-runtimelinepanel-2">
				<h2 id="presentation-blocks-heading" className="runa-developer-runtimelinepanel-3">
					{uiCopy.run.surfaceHeading}
				</h2>
				<div className="runa-developer-runtimelinepanel-4">
					{createInspectionCountLabel(presentationRunSurfaceCount, 'run surface', 'run surfaces')}
				</div>
			</div>
			<p id="inspection-surface-a11y-note" className="runa-developer-runtimelinepanel-5">
				Inspection detail actions append a focused card below the related summary inside the same
				run group and move keyboard focus to that card. Use Back to summary to return focus to the
				linked summary card.
			</p>

			<div className="runa-developer-runtimelinepanel-6">
				{currentRunProgressPanel}
				{presentationRunSurfaceCount === 0 ? (
					emptyStateContent
				) : (
					<>
						{currentInspectionSurfaceMeta ? (
							<div className="runa-developer-runtimelinepanel-7">
								<div className="runa-developer-runtimelinepanel-8">
									<div className="runa-developer-runtimelinepanel-9">
										<div lang="tr" className="runa-developer-runtimelinepanel-10">
											{uiCopy.run.currentRunProgress}
										</div>
										<div className="runa-developer-runtimelinepanel-11">
											{uiCopy.run.surfaceSubtitle}
										</div>
									</div>
									<div className="runa-developer-runtimelinepanel-12">
										<code className="runa-developer-runtimelinepanel-13">
											{createInspectionCountLabel(
												currentInspectionSurfaceMeta.summary_count,
												'summary card',
												'summary cards',
											)}
										</code>
										<code className="runa-developer-runtimelinepanel-14">
											{createInspectionCountLabel(
												currentInspectionSurfaceMeta.detail_count,
												'detail card',
												'detail cards',
											)}
										</code>
										{pastPresentationSurfaceCount > 0 ? (
											<code className="runa-developer-runtimelinepanel-15">
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
							<div className="runa-developer-runtimelinepanel-16">
								<div className="runa-developer-runtimelinepanel-17">
									<div className="runa-developer-runtimelinepanel-18">
										<div lang="tr" className="runa-developer-runtimelinepanel-19">
											{uiCopy.run.pastRuns}
										</div>
										<div className="runa-developer-runtimelinepanel-20">
											{uiCopy.run.pastRunsCollapsed}
										</div>
									</div>
									<button
										type="button"
										onClick={onToggleRecentSessionRuns}
										aria-expanded={showRecentSessionRuns}
										aria-controls="recent-session-runs-panel"
										className="runa-developer-runtimelinepanel-21"
									>
										{recentSessionRunsLabel}
									</button>
								</div>
								{showRecentSessionRuns ? (
									<div id="recent-session-runs-panel">{pastPresentationContent}</div>
								) : (
									<div
										id="recent-session-runs-panel"
										className="runa-developer-runtimelinepanel-22"
									>
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
