import type { ReactElement, ReactNode } from 'react';

import type { CurrentRunProgressSurface } from '../../lib/chat-runtime/current-run-progress.js';
import { uiCopy } from '../../localization/copy.js';
import { RunStatusChips } from './RunStatusChips.js';
import { ThinkingBlock } from './ThinkingBlock.js';
import type { ThinkingStep, ThinkingStepStatus } from './ThinkingBlock.js';
import { ToolActivityIndicator } from './ToolActivityIndicator.js';
import type { ToolActivityItem } from './ToolActivityIndicator.js';

type RunProgressPanelProps = Readonly<{
	feedbackBanner?: ReactNode;
	isDeveloperMode?: boolean;
	progress: CurrentRunProgressSurface;
}>;

const userFacingToolLabels = new Map<string, string>([
	['desktop.screenshot', 'Ekran goruntusu'],
	['file.read', 'Dosya okuma'],
	['file.write', 'Dosya yazma'],
	['search.codebase', 'Kod arama'],
	['web.search', 'Web arama'],
]);

function formatUserFacingToolLabel(toolName: string): string {
	return userFacingToolLabels.get(toolName) ?? toolName.replace(/\./gu, ' ');
}

function formatUserFacingToolDetail(detail: string | undefined): string | undefined {
	if (!detail) {
		return undefined;
	}

	let formattedDetail = detail;

	for (const [technicalLabel, friendlyLabel] of userFacingToolLabels) {
		formattedDetail = formattedDetail.replaceAll(technicalLabel, friendlyLabel);
	}

	return formattedDetail;
}

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
		detail: item.detail,
		id: `${item.kind}:${item.call_id ?? item.label}:${index}`,
		label: item.label,
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
			detail: formatUserFacingToolDetail(item.detail),
			id: `${item.kind}:${item.call_id ?? item.label}:${index}`,
			label: item.tool_name ? formatUserFacingToolLabel(item.tool_name) : item.label,
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
	const accent = getPanelAccent(progress.status_tone);
	const shouldShowDiagnostics = isDeveloperMode;
	const toolActivityItems = createToolActivityItems(progress);

	if (!isDeveloperMode) {
		return (
			<section
				aria-labelledby="current-run-progress-heading"
				className="runa-run-activity-line runa-migrated-components-chat-runprogresspanel-1"
			>
				<span className="runa-run-activity-line__pulse" aria-hidden="true" />
				<div className="runa-run-activity-line__copy">
					<h3 id="current-run-progress-heading">{progress.headline}</h3>
					<p>{progress.detail}</p>
					{toolActivityItems.length > 0 ? (
						<ToolActivityIndicator items={toolActivityItems.slice(0, 3)} />
					) : null}
				</div>
			</section>
		);
	}

	return (
		<section
			aria-labelledby="current-run-progress-heading"
			className="runa-migrated-components-chat-runprogresspanel-1"
		>
			<div className="runa-migrated-components-chat-runprogresspanel-2">
				<div className="runa-migrated-components-chat-runprogresspanel-3">
					{uiCopy.run.currentRunProgress}
				</div>
				<div className="runa-migrated-components-chat-runprogresspanel-4">
					<div className="runa-migrated-components-chat-runprogresspanel-5">
						<h3
							id="current-run-progress-heading"
							className="runa-migrated-components-chat-runprogresspanel-6"
						>
							{progress.headline}
						</h3>
						<div className="runa-migrated-components-chat-runprogresspanel-7">
							{progress.detail}
						</div>
					</div>
				</div>
			</div>

			{shouldShowDiagnostics ? feedbackBanner : null}

			{shouldShowDiagnostics ? (
				<>
					<div className="runa-migrated-components-chat-runprogresspanel-8">
						<div className="runa-migrated-components-chat-runprogresspanel-9">
							{uiCopy.run.runtimePhases}
						</div>
						<RunStatusChips ariaLabel="Current work phases" items={progress.phase_items} />
					</div>

					<div className="runa-migrated-components-chat-runprogresspanel-10">
						<div className="runa-migrated-components-chat-runprogresspanel-11">
							{uiCopy.run.currentSurfaceContext}
						</div>
						<RunStatusChips ariaLabel="Current work context" items={progress.meta_items} />
					</div>
				</>
			) : null}

			{shouldShowDiagnostics && progress.approval_block?.payload.target_label ? (
				<div className="runa-migrated-components-chat-runprogresspanel-12">
					<div className="runa-migrated-components-chat-runprogresspanel-13">Hedef cihaz</div>
					<div className="runa-migrated-components-chat-runprogresspanel-14">
						{progress.approval_block.payload.target_label}
					</div>
				</div>
			) : null}

			{shouldShowDiagnostics && progress.step_items.length > 0 ? (
				<div className="runa-migrated-components-chat-runprogresspanel-15">
					<div className="runa-migrated-components-chat-runprogresspanel-16">
						<div className="runa-migrated-components-chat-runprogresspanel-17">
							{uiCopy.run.observedSteps}
						</div>
						{progress.hidden_step_count > 0 ? (
							<div className="runa-migrated-components-chat-runprogresspanel-18">
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
				<div className="runa-migrated-components-chat-runprogresspanel-19">
					{uiCopy.run.approvalBoundary}: {progress.approval_block.payload.title}
				</div>
			) : null}
		</section>
	);
}
