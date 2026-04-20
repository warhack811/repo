import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ChatShell } from '../components/chat/ChatShell.js';
import { renderRunFeedbackBanner } from '../components/chat/PresentationBlockRenderer.js';
import type { InspectionActionState } from '../components/chat/PresentationBlockRenderer.js';
import { PresentationRunSurfaceCard } from '../components/chat/PresentationRunSurfaceCard.js';
import { RunProgressPanel } from '../components/chat/RunProgressPanel.js';
import { RunTimelinePanel } from '../components/chat/RunTimelinePanel.js';
import {
	buildInspectionSurfaceMeta,
	createInspectionDetailRequestKey,
	getInspectionDetailBlockId,
	getStatusAccent,
} from '../components/chat/chat-presentation.js';
import type { UseChatRuntimeResult } from '../hooks/useChatRuntime.js';
import { useChatRuntimeView } from '../hooks/useChatRuntimeView.js';
import { useDeveloperMode } from '../hooks/useDeveloperMode.js';
import { deriveCurrentRunProgressSurface } from '../lib/chat-runtime/current-run-progress.js';
import { DEFAULT_INSPECTION_DETAIL_LEVEL } from '../lib/chat-runtime/types.js';
import { heroPanelStyle, secondaryLabelStyle } from '../lib/chat-styles.js';
import { uiCopy } from '../localization/copy.js';
import type { InspectionTargetKind, RenderBlock } from '../ws-types.js';

type ChatPageProps = Readonly<{
	embedded?: boolean;
	runtime: UseChatRuntimeResult;
}>;

const composerCardStyle = {
	borderRadius: '24px',
	border: '1px solid rgba(148, 163, 184, 0.18)',
	background: 'linear-gradient(180deg, rgba(12, 18, 31, 0.9) 0%, rgba(9, 14, 25, 0.82) 100%)',
	padding: 'clamp(18px, 3vw, 24px)',
	display: 'grid',
	gap: '16px',
	boxShadow: '0 24px 60px rgba(2, 6, 23, 0.38)',
} as const;

const composerInputStyle = {
	width: '100%',
	padding: '14px 16px',
	borderRadius: '18px',
	border: '1px solid rgba(148, 163, 184, 0.2)',
	background: 'rgba(5, 10, 20, 0.84)',
	color: '#f8fafc',
	fontSize: '15px',
	boxSizing: 'border-box',
	resize: 'vertical',
	minHeight: '140px',
	boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
} as const;

const primaryButtonStyle = {
	padding: '12px 18px',
	borderRadius: '14px',
	border: 'none',
	background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
	color: '#1f1303',
	fontWeight: 700,
	cursor: 'pointer',
	boxShadow: '0 18px 36px rgba(245, 158, 11, 0.2)',
	transition: 'transform 180ms ease, opacity 180ms ease, box-shadow 180ms ease',
} as const;

const secondaryButtonLinkStyle = {
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	padding: '10px 14px',
	borderRadius: '14px',
	border: '1px solid rgba(148, 163, 184, 0.26)',
	background: 'rgba(9, 14, 25, 0.82)',
	color: '#e5e7eb',
	fontWeight: 600,
	textDecoration: 'none',
	transition: 'transform 180ms ease, border-color 180ms ease, background 180ms ease',
} as const;

const conversationSurfaceStyle = {
	borderRadius: '24px',
	border: '1px solid rgba(148, 163, 184, 0.16)',
	background: 'linear-gradient(180deg, rgba(12, 18, 31, 0.88) 0%, rgba(7, 11, 20, 0.74) 100%)',
	padding: 'clamp(18px, 3vw, 24px)',
	display: 'grid',
	gap: '16px',
	boxShadow: '0 24px 60px rgba(2, 6, 23, 0.38)',
	transition: 'opacity 220ms ease, transform 220ms ease, border-color 220ms ease',
} as const;

const developerHintStyle = {
	borderRadius: '18px',
	border: '1px solid rgba(245, 158, 11, 0.24)',
	background: 'rgba(38, 26, 8, 0.44)',
	padding: '14px 16px',
	display: 'grid',
	gap: '12px',
	transition: 'opacity 220ms ease, transform 220ms ease',
} as const;

export function ChatPage({ embedded = false, runtime }: ChatPageProps): ReactElement {
	const { isDeveloperMode, setDeveloperMode } = useDeveloperMode();
	const {
		connectionStatus,
		currentPresentationSurface,
		currentRunFeedback,
		expandedPastRunIds,
		inspectionAnchorIdsByDetailId,
		isSubmitting,
		isRuntimeConfigReady,
		lastError,
		pastPresentationSurfaces,
		pendingInspectionRequestKeys,
		presentationRunSurfaces,
		prompt,
		requestInspection,
		resolveApproval,
		runTransportSummaries,
		setPastRunExpanded,
		staleInspectionRequestKeys,
		submitRunRequest,
		setPrompt,
		apiKey,
	} = runtime;
	const [showRecentSessionRuns, setShowRecentSessionRuns] = useState(false);

	const currentInspectionSurfaceMeta = useMemo(
		() =>
			currentPresentationSurface
				? buildInspectionSurfaceMeta(currentPresentationSurface.blocks)
				: null,
		[currentPresentationSurface],
	);

	const shouldShowRunFeedbackBanner = useMemo(() => {
		if (!currentRunFeedback) {
			return false;
		}

		if (!currentPresentationSurface) {
			return true;
		}

		return (
			currentRunFeedback.run_id !== currentPresentationSurface.run_id ||
			currentRunFeedback.tone === 'error' ||
			currentRunFeedback.tone === 'warning' ||
			currentRunFeedback.pending_detail_count > 0
		);
	}, [currentPresentationSurface, currentRunFeedback]);

	const { statusLabel, submitButtonLabel } = useChatRuntimeView({
		connectionStatus,
		currentRunFeedbackChipLabel: currentRunFeedback?.chip_label,
		isSubmitting,
	});

	const currentRunFeedbackBanner =
		shouldShowRunFeedbackBanner && currentRunFeedback
			? renderRunFeedbackBanner(currentRunFeedback)
			: null;

	const currentRunSummary = useMemo(() => {
		const activeRunId = currentRunFeedback?.run_id ?? currentPresentationSurface?.run_id;
		return activeRunId ? runTransportSummaries.get(activeRunId) : undefined;
	}, [currentPresentationSurface, currentRunFeedback, runTransportSummaries]);

	const currentRunProgress = useMemo(
		() =>
			deriveCurrentRunProgressSurface({
				current_presentation_surface: currentPresentationSurface,
				current_run_feedback: currentRunFeedback,
				run_summary: currentRunSummary,
			}),
		[currentPresentationSurface, currentRunFeedback, currentRunSummary],
	);

	const currentRunProgressPanel = currentRunProgress ? (
		<RunProgressPanel feedbackBanner={currentRunFeedbackBanner} progress={currentRunProgress} />
	) : null;

	const emptyRunTimelineContent = (
		<div
			style={{
				borderRadius: '14px',
				border: '1px dashed rgba(148, 163, 184, 0.24)',
				padding: '20px',
				color: '#94a3b8',
				transition: 'opacity 220ms ease, transform 220ms ease',
			}}
		>
			{uiCopy.chat.emptySurface}
		</div>
	);

	function getInspectionActionState(
		runId: string,
		runBlocks: readonly RenderBlock[],
		targetKind: InspectionTargetKind,
		targetId?: string,
	): InspectionActionState {
		const detailBlockId = getInspectionDetailBlockId(runId, targetKind, targetId);
		const requestKey = createInspectionDetailRequestKey({
			detail_level: DEFAULT_INSPECTION_DETAIL_LEVEL,
			run_id: runId,
			target_id: targetId,
			target_kind: targetKind,
		});
		const hasExistingDetail = runBlocks.some((block) => block.id === detailBlockId);
		const isStaleDetail = staleInspectionRequestKeys.includes(requestKey);
		const isPendingDetail = pendingInspectionRequestKeys.includes(requestKey);

		if (isPendingDetail) {
			return {
				detail_block_id: detailBlockId,
				is_pending: true,
				is_open: hasExistingDetail,
				is_stale: false,
				label: 'Loading detail',
				note: hasExistingDetail ? 'Refreshing below summary' : 'Opening below summary',
				title: hasExistingDetail
					? 'Refreshing the related detail card below this summary. Focus will move when the update arrives.'
					: 'Opening the related detail card below this summary. Focus will move when it arrives.',
			};
		}

		if (hasExistingDetail) {
			return {
				detail_block_id: detailBlockId,
				is_pending: false,
				is_open: true,
				is_stale: isStaleDetail,
				label: isStaleDetail ? 'Refresh detail' : 'Go to detail',
				note: isStaleDetail ? 'Summary updated' : undefined,
				title: isStaleDetail
					? 'Request a fresh detail card for this summary and move focus when it arrives.'
					: 'Move focus to the existing detail card beneath this summary.',
			};
		}

		return {
			detail_block_id: detailBlockId,
			is_pending: false,
			is_open: false,
			is_stale: false,
			label: 'Open detail',
			title: 'Open the related detail card beneath this summary and move focus to it.',
		};
	}

	const currentPresentationContent = currentPresentationSurface ? (
		<PresentationRunSurfaceCard
			expanded
			inspectionAnchorIdsByDetailId={inspectionAnchorIdsByDetailId}
			isCurrent
			onRequestInspection={requestInspection}
			onResolveApproval={resolveApproval}
			pendingInspectionRequestKeys={pendingInspectionRequestKeys}
			runTransportSummaries={runTransportSummaries}
			surface={currentPresentationSurface}
			getInspectionActionState={getInspectionActionState}
		/>
	) : null;

	const pastPresentationContent = pastPresentationSurfaces.map((surface) => (
		<PresentationRunSurfaceCard
			key={surface.run_id}
			expanded={expandedPastRunIds.includes(surface.run_id)}
			inspectionAnchorIdsByDetailId={inspectionAnchorIdsByDetailId}
			isCurrent={false}
			onRequestInspection={requestInspection}
			onResolveApproval={resolveApproval}
			onToggleExpanded={(runId, nextOpen) => setPastRunExpanded(runId, nextOpen)}
			pendingInspectionRequestKeys={pendingInspectionRequestKeys}
			runTransportSummaries={runTransportSummaries}
			surface={surface}
			getInspectionActionState={getInspectionActionState}
		/>
	));

	return (
		<ChatShell embedded={embedded}>
			<section
				className="runa-ambient-panel"
				style={heroPanelStyle}
				aria-labelledby="chat-workspace-heading"
				aria-describedby="chat-workspace-description"
			>
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						gap: '12px',
						flexWrap: 'wrap',
					}}
				>
					<div style={{ maxWidth: 'min(720px, 100%)' }}>
						<div className="runa-eyebrow">{uiCopy.appShell.chatEyebrow.toUpperCase()}</div>
						<h1
							id="chat-workspace-heading"
							style={{ margin: '10px 0 6px', fontSize: 'clamp(28px, 5vw, 40px)' }}
						>
							{uiCopy.chat.heroTitle}
						</h1>
						<p
							id="chat-workspace-description"
							className="runa-subtle-copy"
							style={{ maxWidth: 'min(620px, 100%)' }}
						>
							{uiCopy.chat.heroSubtitle}
						</p>
					</div>
					<div
						style={{
							padding: '8px 12px',
							borderRadius: '999px',
							border: `1px solid ${getStatusAccent(connectionStatus)}`,
							color: getStatusAccent(connectionStatus),
							fontWeight: 700,
							fontSize: '12px',
							letterSpacing: '0.08em',
						}}
					>
						{statusLabel}
					</div>
				</div>
			</section>

			<section
				className="runa-chat-surface"
				style={composerCardStyle}
				aria-labelledby="chat-composer-heading"
			>
				<div style={{ display: 'grid', gap: '8px' }}>
					<div style={secondaryLabelStyle}>Conversation</div>
					<h2 id="chat-composer-heading" style={{ margin: 0, fontSize: '20px' }}>
						Sohbetten devam et
					</h2>
					<div className="runa-subtle-copy">
						Hedefini yaz, Runa akisi burada tutsun ve gerekirse seni sonraki adima tasiyacagini
						gostersin.
					</div>
				</div>

				{!apiKey.trim() && isRuntimeConfigReady ? (
					<div
						style={{
							padding: '12px 16px',
							borderRadius: '16px',
							border: '1px solid rgba(148, 163, 184, 0.2)',
							background: 'rgba(15, 23, 42, 0.4)',
							color: '#94a3b8',
							fontSize: '13px',
							display: 'flex',
							alignItems: 'center',
							gap: '10px',
						}}
					>
						<span style={{ color: '#f59e0b' }}>●</span>
						Sunucu tarafındaki varsayılan API anahtarı kullanılacak.
					</div>
				) : null}

				{!isRuntimeConfigReady ? (
					<output
						aria-live="polite"
						style={{
							padding: '14px 16px',
							borderRadius: '18px',
							border: '1px solid rgba(250, 204, 21, 0.32)',
							background: 'rgba(120, 53, 15, 0.16)',
							display: 'grid',
							gap: '10px',
							transition: 'opacity 220ms ease, transform 220ms ease',
						}}
					>
						<div style={{ color: '#fde68a', fontWeight: 700 }}>{uiCopy.chat.configMissing}</div>
						<div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
							<button
								type="button"
								onClick={() => setDeveloperMode(true)}
								style={{
									...primaryButtonStyle,
									padding: '10px 14px',
									boxShadow: 'none',
								}}
							>
								Developer Mode'u etkinlestir
							</button>
							<Link style={secondaryButtonLinkStyle} to="/developer">
								{uiCopy.chat.openDeveloper}
							</Link>
						</div>
					</output>
				) : null}

				<form onSubmit={submitRunRequest} style={{ display: 'grid', gap: '12px' }}>
					<label style={{ display: 'grid', gap: '8px' }}>
						<span style={{ color: '#e5e7eb', fontWeight: 600 }}>{uiCopy.chat.send}</span>
						<textarea
							value={prompt}
							onChange={(event) => setPrompt(event.target.value)}
							placeholder={uiCopy.chat.composerPlaceholder}
							rows={5}
							style={composerInputStyle}
						/>
					</label>

					{lastError ? (
						<div
							role="alert"
							style={{
								padding: '12px 14px',
								borderRadius: '14px',
								background: 'rgba(127, 29, 29, 0.28)',
								border: '1px solid rgba(248, 113, 113, 0.36)',
								color: '#fecaca',
								lineHeight: 1.5,
								transition: 'opacity 220ms ease, transform 220ms ease',
							}}
						>
							{lastError}
						</div>
					) : null}

					<div
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							gap: '12px',
							flexWrap: 'wrap',
						}}
					>
						<div style={{ color: '#94a3b8', fontSize: '13px' }}>{statusLabel}</div>
						<button
							type="submit"
							disabled={isSubmitting || connectionStatus !== 'open' || !isRuntimeConfigReady}
							style={{
								...primaryButtonStyle,
								opacity:
									isSubmitting || connectionStatus !== 'open' || !isRuntimeConfigReady ? 0.6 : 1,
								width: 'min(220px, 100%)',
							}}
						>
							{submitButtonLabel}
						</button>
					</div>
				</form>
			</section>

			<section
				className="runa-chat-surface"
				style={conversationSurfaceStyle}
				aria-labelledby="chat-conversation-surface-heading"
			>
				<div style={{ display: 'grid', gap: '8px' }}>
					<div style={secondaryLabelStyle}>{uiCopy.run.currentRunProgress}</div>
					<h2 id="chat-conversation-surface-heading" style={{ fontSize: '20px' }}>
						Aktif sohbet akisi
					</h2>
					<div className="runa-subtle-copy">
						Guncel calisma, onaylar ve yardimci kartlar burada sakin bir akista kalir.
					</div>
				</div>
				{currentRunProgressPanel}
				{currentPresentationContent ?? emptyRunTimelineContent}
			</section>

			{isDeveloperMode ? (
				<RunTimelinePanel
					currentInspectionSurfaceMeta={currentInspectionSurfaceMeta}
					currentPresentationContent={currentPresentationContent}
					currentRunProgressPanel={currentRunProgressPanel}
					emptyStateContent={emptyRunTimelineContent}
					pastPresentationContent={pastPresentationContent}
					pastPresentationSurfaceCount={pastPresentationSurfaces.length}
					presentationRunSurfaceCount={presentationRunSurfaces.length}
					recentSessionRunsLabel={uiCopy.run.pastRuns}
					showRecentSessionRuns={showRecentSessionRuns}
					onToggleRecentSessionRuns={() => setShowRecentSessionRuns((current) => !current)}
				/>
			) : (
				<section style={developerHintStyle} aria-label="Developer Mode notice">
					<div style={{ color: '#fde68a', fontWeight: 700 }}>Developer Mode kapali</div>
					<div className="runa-subtle-copy">
						Ham timeline, gecmis calismalar ve teknik izler ikinci katmanda tutulur. Ihtiyac
						oldugunda navigation icinden Developer Mode'u acabilirsin.
					</div>
				</section>
			)}
		</ChatShell>
	);
}
