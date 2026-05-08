import type { ReactElement, ReactNode } from 'react';

import type { CurrentRunProgressSurface } from '../../lib/chat-runtime/current-run-progress.js';
import { uiCopy } from '../../localization/copy.js';
import styles from './RunProgressPanel.module.css';
import { RunStatusChips } from './RunStatusChips.js';
import { ThinkingBlock } from './ThinkingBlock.js';
import type { ThinkingStep, ThinkingStepStatus } from './ThinkingBlock.js';
import { ToolActivityIndicator } from './ToolActivityIndicator.js';
import type { ToolActivityItem } from './ToolActivityIndicator.js';
import {
	formatWorkDetail,
	formatWorkTimelineLabel,
	formatWorkToolLabel,
} from './workNarrationFormat.js';

type RunProgressPanelProps = Readonly<{
	feedbackBanner?: ReactNode;
	isDeveloperMode?: boolean;
	progress: CurrentRunProgressSurface;
}>;

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

function getThinkingStepStatus(
	item: CurrentRunProgressSurface['step_items'][number],
): ThinkingStepStatus {
	if (item.kind === 'tool_failed' || item.state === 'failed' || item.state === 'error') {
		return 'failed';
	}

	if (
		item.kind === 'tool_completed' ||
		item.kind === 'assistant_completed' ||
		item.kind === 'model_completed' ||
		item.state === 'completed' ||
		item.state === 'success'
	) {
		return 'completed';
	}

	if (
		item.kind === 'approval_requested' ||
		item.state === 'pending' ||
		item.state === 'requested'
	) {
		return 'paused';
	}

	if (item.kind === 'tool_requested' || item.state === 'active') {
		return 'active';
	}

	return 'pending';
}

function createThinkingSteps(progress: CurrentRunProgressSurface): readonly ThinkingStep[] {
	return progress.step_items.map((item, index) => ({
		detail: formatWorkDetail(item.detail),
		id: `${item.kind}:${item.call_id ?? item.label}:${index}`,
		label: formatWorkTimelineLabel(item.label),
		status: getThinkingStepStatus(item),
		tool_name: item.tool_name,
	}));
}

function createToolActivityItems(progress: CurrentRunProgressSurface): readonly ToolActivityItem[] {
	return progress.step_items
		.filter(
			(item) =>
				item.kind === 'tool_requested' ||
				item.kind === 'tool_completed' ||
				item.kind === 'tool_failed',
		)
		.map((item, index) => ({
			detail: formatWorkDetail(item.detail),
			id: `${item.kind}:${item.call_id ?? item.label}:${index}`,
			label: item.tool_name
				? formatWorkToolLabel(item.tool_name)
				: formatWorkTimelineLabel(item.label),
			status:
				item.kind === 'tool_failed'
					? 'failed'
					: item.kind === 'tool_completed'
						? 'completed'
						: 'active',
		}));
}

export function RunProgressPanel({
	feedbackBanner,
	isDeveloperMode = false,
	progress,
}: RunProgressPanelProps): ReactElement {
	const shouldShowDiagnostics = isDeveloperMode;
	const toolActivityItems = createToolActivityItems(progress);
	const formattedDetail = formatWorkDetail(progress.detail) ?? progress.detail;

	if (!isDeveloperMode) {
		const thinkingSteps = createThinkingSteps(progress);
		return (
			<section aria-labelledby="current-run-progress-heading" className={styles['activityLine']}>
				<span className={styles['activityPulse']} aria-hidden="true" />
				<div className={styles['activityCopy']}>
					<h3 id="current-run-progress-heading" className={styles['activityHeadline']}>
						{progress.headline}
					</h3>
					<p className={styles['activityDetail']}>{formattedDetail}</p>
					{thinkingSteps.length > 0 ? (
						<ThinkingBlock
							isActive={progress.status_tone === 'info' || progress.status_tone === 'warning'}
							steps={thinkingSteps}
						/>
					) : toolActivityItems.length > 0 ? (
						<ToolActivityIndicator items={toolActivityItems.slice(0, 3)} />
					) : null}
				</div>
			</section>
		);
	}

	return (
		<section aria-labelledby="current-run-progress-heading" className={styles['root']}>
			<div className={styles['headerSection']}>
				<div className={styles['eyebrow']}>{uiCopy.run.currentRunProgress}</div>
				<div className={styles['contentRow']}>
					<div className={styles['progressDetails']}>
						<h3 id="current-run-progress-heading" className={styles['headline']}>
							{progress.headline}
						</h3>
						<div className={styles['detail']}>{formattedDetail}</div>
					</div>
				</div>
			</div>

			{shouldShowDiagnostics ? feedbackBanner : null}

			{shouldShowDiagnostics ? (
				<>
					<div className={styles['diagnosticsSection']}>
						<div className={styles['diagnosticsEyebrow']}>{uiCopy.run.runtimePhases}</div>
						<RunStatusChips ariaLabel="Current work phases" items={progress.phase_items} />
					</div>

					<div className={styles['contextSection']}>
						<div className={styles['contextEyebrow']}>{uiCopy.run.currentSurfaceContext}</div>
						<RunStatusChips ariaLabel="Current work context" items={progress.meta_items} />
					</div>
				</>
			) : null}

			{shouldShowDiagnostics && progress.approval_block?.payload.target_label ? (
				<div className={styles['targetSection']}>
					<div className={styles['targetEyebrow']}>Hedef cihaz</div>
					<div className={styles['targetLabel']}>
						{progress.approval_block.payload.target_label}
					</div>
				</div>
			) : null}

			{shouldShowDiagnostics && progress.step_items.length > 0 ? (
				<div className={styles['stepsSection']}>
					<div className={styles['stepsHeader']}>
						<div className={styles['stepsEyebrow']}>{uiCopy.run.observedSteps}</div>
						{progress.hidden_step_count > 0 ? (
							<div className={styles['stepsCount']}>
								{uiCopy.run.showingLatestSteps.replace(
									'{count}',
									progress.step_items.length.toString(),
								)}
							</div>
						) : null}
					</div>
					<ThinkingBlock
						isActive={progress.status_tone === 'info' || progress.status_tone === 'warning'}
						steps={createThinkingSteps(progress)}
					/>
					<ToolActivityIndicator items={createToolActivityItems(progress)} />
				</div>
			) : null}

			{shouldShowDiagnostics && progress.approval_block ? (
				<div className={styles['approvalBoundary']}>
					{uiCopy.run.approvalBoundary}: {progress.approval_block.payload.title}
				</div>
			) : null}
		</section>
	);
}
