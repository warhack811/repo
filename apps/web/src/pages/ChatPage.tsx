import type { DesktopDevicePresenceSnapshot } from '@runa/types';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { ChatShell } from '../components/chat/ChatShell.js';
import { ConversationSidebar } from '../components/chat/ConversationSidebar.js';
import { DesktopTargetSelector } from '../components/chat/DesktopTargetSelector.js';
import { FileUploadButton } from '../components/chat/FileUploadButton.js';
import { MarkdownRenderer } from '../components/chat/MarkdownRenderer.js';
import { renderRunFeedbackBanner } from '../components/chat/PresentationBlockRenderer.js';
import type { InspectionActionState } from '../components/chat/PresentationBlockRenderer.js';
import { PresentationRunSurfaceCard } from '../components/chat/PresentationRunSurfaceCard.js';
import { RunProgressPanel } from '../components/chat/RunProgressPanel.js';
import { RunTimelinePanel } from '../components/chat/RunTimelinePanel.js';
import { VoiceComposerControls } from '../components/chat/VoiceComposerControls.js';
import {
	buildInspectionSurfaceMeta,
	createInspectionDetailRequestKey,
	getInspectionDetailBlockId,
	getStatusAccent,
} from '../components/chat/chat-presentation.js';
import type { UseChatRuntimeResult } from '../hooks/useChatRuntime.js';
import { useChatRuntimeView } from '../hooks/useChatRuntimeView.js';
import type { UseConversationsResult } from '../hooks/useConversations.js';
import { useDeveloperMode } from '../hooks/useDeveloperMode.js';
import { useTextToSpeech } from '../hooks/useTextToSpeech.js';
import { useVoiceInput } from '../hooks/useVoiceInput.js';
import { deriveCurrentRunProgressSurface } from '../lib/chat-runtime/current-run-progress.js';
import { DEFAULT_INSPECTION_DETAIL_LEVEL } from '../lib/chat-runtime/types.js';
import { heroPanelStyle, secondaryLabelStyle } from '../lib/chat-styles.js';
import { fetchDesktopDevices } from '../lib/desktop-devices.js';
import { uiCopy } from '../localization/copy.js';
import {
	selectConnectionState,
	selectPresentationState,
	selectRuntimeConfigState,
	selectTransportState,
	useChatStoreSelector,
} from '../stores/chat-store.js';
import type { InspectionTargetKind, RenderBlock } from '../ws-types.js';

type ChatPageProps = Readonly<{
	conversations: UseConversationsResult;
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

const streamingSurfaceStyle = {
	borderRadius: '20px',
	border: '1px solid rgba(245, 158, 11, 0.28)',
	background: 'linear-gradient(180deg, rgba(54, 32, 7, 0.28) 0%, rgba(15, 23, 42, 0.3) 100%)',
	padding: '16px 18px',
	display: 'grid',
	gap: '10px',
	boxShadow: '0 18px 36px rgba(15, 23, 42, 0.22)',
} as const;

const workspaceGridStyle = {
	display: 'grid',
	gap: '20px',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
	alignItems: 'start',
} as const;

const persistedMessagesStyle = {
	display: 'grid',
	gap: '12px',
} as const;

export function ChatPage({
	conversations,
	embedded = false,
	runtime,
}: ChatPageProps): ReactElement {
	const { isDeveloperMode, setDeveloperMode } = useDeveloperMode();
	const runtimeConfig = useChatStoreSelector(runtime.store, selectRuntimeConfigState);
	const connectionState = useChatStoreSelector(runtime.store, selectConnectionState);
	const presentationState = useChatStoreSelector(runtime.store, selectPresentationState);
	const transportState = useChatStoreSelector(runtime.store, selectTransportState);
	const currentPresentationSurface = runtime.currentPresentationSurface;
	const currentRunFeedback = runtime.currentRunFeedback;
	const pastPresentationSurfaces = runtime.pastPresentationSurfaces;
	const {
		currentStreamingRunId,
		currentStreamingText,
		expandedPastRunIds,
		pendingInspectionRequestKeys,
		presentationRunSurfaces,
		staleInspectionRequestKeys,
	} = presentationState;
	const { connectionStatus, isSubmitting, lastError } = connectionState;
	const { apiKey, model } = runtimeConfig;
	const isRuntimeConfigReady = model.trim().length > 0;
	const {
		accessToken,
		attachments,
		desktopTargetConnectionId: runtimeDesktopTargetConnectionId,
		inspectionAnchorIdsByDetailId,
		prompt,
		requestInspection,
		resolveApproval,
		setDesktopTargetConnectionId,
		setPastRunExpanded,
		setPrompt,
		setAttachments,
		submitRunRequest,
	} = runtime;
	const { runTransportSummaries } = transportState;
	const {
		activeConversationId,
		activeConversationMessages,
		beginDraftConversation,
		conversationError,
		conversations: conversationList,
		isConversationLoading,
		selectConversation,
	} = conversations;
	const [showRecentSessionRuns, setShowRecentSessionRuns] = useState(false);
	const [attachmentUploadError, setAttachmentUploadError] = useState<string | null>(null);
	const [desktopDeviceError, setDesktopDeviceError] = useState<string | null>(null);
	const [desktopDevices, setDesktopDevices] = useState<readonly DesktopDevicePresenceSnapshot[]>(
		[],
	);
	const [desktopDevicesReloadKey, setDesktopDevicesReloadKey] = useState(0);
	const [isDesktopDevicesLoading, setIsDesktopDevicesLoading] = useState(false);
	const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
	const [selectedDesktopTargetConnectionId, setSelectedDesktopTargetConnectionId] = useState<
		string | null
	>(runtimeDesktopTargetConnectionId);
	const promptRef = useRef(prompt);
	const lastSeenAssistantMessageIdRef = useRef<string | null>(null);

	const latestAssistantMessage = useMemo(
		() =>
			[...activeConversationMessages].reverse().find((message) => message.role === 'assistant') ??
			null,
		[activeConversationMessages],
	);
	const latestReadableResponse = latestAssistantMessage?.content?.trim() ?? '';
	const {
		autoReadEnabled,
		cancel: cancelTextToSpeech,
		errorMessage: textToSpeechErrorMessage,
		isSpeaking,
		isSupported: isTextToSpeechSupported,
		speak,
	} = useTextToSpeech();
	const voiceInput = useVoiceInput({
		onFinalTranscript: (transcript) => {
			const existingPrompt = promptRef.current.trim();
			const nextPrompt =
				existingPrompt.length > 0 ? `${promptRef.current.trimEnd()}\n${transcript}` : transcript;

			setPrompt(nextPrompt);
		},
	});

	useEffect(() => {
		promptRef.current = prompt;
	}, [prompt]);

	useEffect(() => {
		const normalizedAccessToken = accessToken?.trim() ?? '';
		const currentDesktopDevicesReloadKey = desktopDevicesReloadKey;
		void currentDesktopDevicesReloadKey;

		if (normalizedAccessToken.length === 0) {
			setDesktopDevices([]);
			setDesktopDeviceError(null);
			setIsDesktopDevicesLoading(false);
			return;
		}

		const abortController = new AbortController();
		setIsDesktopDevicesLoading(true);

		void fetchDesktopDevices({
			bearerToken: normalizedAccessToken,
			signal: abortController.signal,
		})
			.then((response) => {
				setDesktopDevices(response.devices);
				setDesktopDeviceError(null);
			})
			.catch((error: unknown) => {
				if (abortController.signal.aborted) {
					return;
				}

				setDesktopDeviceError(
					error instanceof Error ? error.message : 'Desktop availability could not be loaded.',
				);
			})
			.finally(() => {
				if (!abortController.signal.aborted) {
					setIsDesktopDevicesLoading(false);
				}
			});

		return () => {
			abortController.abort();
		};
	}, [accessToken, desktopDevicesReloadKey]);

	useEffect(() => {
		if (
			selectedDesktopTargetConnectionId !== null &&
			desktopDevices.every((device) => device.connection_id !== selectedDesktopTargetConnectionId)
		) {
			setSelectedDesktopTargetConnectionId(null);
		}
	}, [desktopDevices, selectedDesktopTargetConnectionId]);

	useEffect(() => {
		if (runtimeDesktopTargetConnectionId !== selectedDesktopTargetConnectionId) {
			setDesktopTargetConnectionId(selectedDesktopTargetConnectionId);
		}
	}, [
		runtimeDesktopTargetConnectionId,
		selectedDesktopTargetConnectionId,
		setDesktopTargetConnectionId,
	]);

	useEffect(() => {
		lastSeenAssistantMessageIdRef.current = latestAssistantMessage?.message_id ?? null;
	}, [latestAssistantMessage?.message_id]);

	useEffect(() => {
		const latestAssistantMessageId = latestAssistantMessage?.message_id ?? null;

		if (latestAssistantMessageId === null) {
			return;
		}

		if (lastSeenAssistantMessageIdRef.current === null) {
			lastSeenAssistantMessageIdRef.current = latestAssistantMessageId;
			return;
		}

		if (lastSeenAssistantMessageIdRef.current === latestAssistantMessageId) {
			return;
		}

		lastSeenAssistantMessageIdRef.current = latestAssistantMessageId;

		if (autoReadEnabled && latestReadableResponse.length > 0) {
			speak(latestReadableResponse);
		}
	}, [autoReadEnabled, latestAssistantMessage?.message_id, latestReadableResponse, speak]);

	const voiceStatusMessage = voiceInput.errorMessage ?? textToSpeechErrorMessage ?? null;

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
	const currentRunId = currentRunFeedback?.run_id ?? currentPresentationSurface?.run_id;
	const shouldShowStreamingSurface =
		currentStreamingText.trim().length > 0 &&
		currentStreamingRunId !== null &&
		currentStreamingRunId === currentRunId;
	const streamingSurface = shouldShowStreamingSurface ? (
		<div style={streamingSurfaceStyle} aria-live="polite">
			<div style={secondaryLabelStyle}>Live response</div>
			<MarkdownRenderer
				className="runa-streaming-response"
				content={currentStreamingText}
				isStreaming
			/>
		</div>
	) : null;

	const persistedConversationMessages =
		activeConversationMessages.length > 0 ? (
			<div style={persistedMessagesStyle} aria-live="polite">
				<div style={secondaryLabelStyle}>Persisted transcript</div>
				{activeConversationMessages.map((message) => (
					<div
						key={message.message_id}
						style={{
							borderRadius: '18px',
							border:
								message.role === 'user'
									? '1px solid rgba(245, 158, 11, 0.24)'
									: '1px solid rgba(148, 163, 184, 0.14)',
							background:
								message.role === 'user' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(7, 11, 20, 0.46)',
							padding: '14px 16px',
							display: 'grid',
							gap: '8px',
						}}
					>
						<div
							style={{
								display: 'flex',
								justifyContent: 'space-between',
								gap: '12px',
								flexWrap: 'wrap',
								fontSize: '12px',
								color: '#94a3b8',
							}}
						>
							<strong style={{ color: '#e5e7eb' }}>
								{message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Runa' : 'System'}
							</strong>
							<span>{new Date(message.created_at).toLocaleString()}</span>
						</div>
						<MarkdownRenderer content={message.content} />
					</div>
				))}
			</div>
		) : activeConversationId ? (
			<div className="runa-subtle-copy">
				Bu conversation icin henuz kalici mesaj bulunmuyor. Ilk yanit tamamlandiginda burada
				gorunecek.
			</div>
		) : (
			<div className="runa-subtle-copy">
				Yeni draft conversation acik. Ilk mesaji gonderdiginde otomatik olarak kalici bir
				conversation olusturulacak.
			</div>
		);

	const emptyRunTimelineContent = (
		<div
			style={{
				transition: 'opacity 220ms ease, transform 220ms ease',
			}}
			className="runa-empty-state"
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
				className="runa-card runa-card--hero runa-ambient-panel"
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
				className="runa-card runa-card--strong runa-chat-surface"
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
							fontSize: '13px',
							display: 'flex',
							alignItems: 'center',
							gap: '10px',
						}}
						className="runa-alert runa-alert--warning"
					>
						<span style={{ color: '#f59e0b' }}>●</span>
						Sunucu tarafındaki varsayılan API anahtarı kullanılacak.
					</div>
				) : null}

				{!isRuntimeConfigReady ? (
					<output
						aria-live="polite"
						style={{
							display: 'grid',
							gap: '10px',
							transition: 'opacity 220ms ease, transform 220ms ease',
						}}
						className="runa-alert runa-alert--warning"
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
								className="runa-button runa-button--primary"
							>
								Developer Mode'u etkinlestir
							</button>
							<Link
								className="runa-button runa-button--secondary"
								style={secondaryButtonLinkStyle}
								to="/developer"
							>
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
							className="runa-input runa-input--textarea"
						/>
					</label>

					<DesktopTargetSelector
						devices={desktopDevices}
						errorMessage={desktopDeviceError}
						isLoading={isDesktopDevicesLoading}
						onClear={() => setSelectedDesktopTargetConnectionId(null)}
						onRetry={() => setDesktopDevicesReloadKey((current) => current + 1)}
						onSelect={setSelectedDesktopTargetConnectionId}
						selectedConnectionId={selectedDesktopTargetConnectionId}
					/>

					<VoiceComposerControls
						canReadLatestResponse={latestReadableResponse.length > 0}
						isListening={voiceInput.isListening}
						isSpeaking={isSpeaking}
						isSpeechPlaybackSupported={isTextToSpeechSupported}
						isVoiceSupported={voiceInput.isSupported}
						onReadLatestResponse={() => speak(latestReadableResponse)}
						onStopSpeaking={cancelTextToSpeech}
						onToggleListening={voiceInput.toggleListening}
						voiceStatusMessage={voiceStatusMessage}
					/>

					<div style={{ display: 'grid', gap: '10px' }}>
						<div
							style={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								gap: '12px',
								flexWrap: 'wrap',
							}}
						>
							<div style={secondaryLabelStyle}>Attachments</div>
							<FileUploadButton
								accessToken={accessToken}
								disabled={!isRuntimeConfigReady || isSubmitting}
								onAttachmentUploaded={(attachment) => {
									setAttachments([...attachments, attachment]);
									setAttachmentUploadError(null);
								}}
								onUploadStateChange={({ error, isUploading }) => {
									setAttachmentUploadError(error);
									setIsUploadingAttachment(isUploading);
								}}
							/>
						</div>
						<div className="runa-subtle-copy">
							Bu minimum seam simdilik `image/*`, `text/*` ve `application/json` dosyalari ile
							sinirli. Prompt'a kisa bir niyet ekleyip dosyayi birlikte gonderebilirsin.
						</div>
						{attachments.length > 0 ? (
							<div style={{ display: 'grid', gap: '10px' }}>
								{attachments.map((attachment) => (
									<div
										key={attachment.blob_id}
										style={{
											display: 'grid',
											gap: '8px',
											padding: '12px 14px',
											borderRadius: '16px',
											border: '1px solid rgba(148, 163, 184, 0.16)',
											background: 'rgba(9, 14, 25, 0.68)',
										}}
									>
										<div
											style={{
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'space-between',
												gap: '12px',
												flexWrap: 'wrap',
											}}
										>
											<div style={{ display: 'grid', gap: '4px' }}>
												<strong style={{ color: '#f8fafc' }}>
													{attachment.filename ?? attachment.blob_id}
												</strong>
												<div className="runa-subtle-copy">
													{attachment.kind} • {attachment.media_type} • {attachment.size_bytes}{' '}
													bytes
												</div>
											</div>
											<button
												type="button"
												onClick={() =>
													setAttachments(
														attachments.filter(
															(candidate) => candidate.blob_id !== attachment.blob_id,
														),
													)
												}
												style={{
													...secondaryButtonLinkStyle,
													padding: '8px 12px',
												}}
												className="runa-button runa-button--secondary"
											>
												Kaldir
											</button>
										</div>
										{attachment.kind === 'image' ? (
											<img
												alt={attachment.filename ?? 'Uploaded attachment preview'}
												src={attachment.data_url}
												style={{
													maxWidth: 'min(220px, 100%)',
													borderRadius: '14px',
													border: '1px solid rgba(148, 163, 184, 0.16)',
												}}
											/>
										) : (
											<div
												style={{
													fontSize: '13px',
													lineHeight: 1.5,
													color: '#cbd5e1',
													whiteSpace: 'pre-wrap',
												}}
											>
												{attachment.text_content}
											</div>
										)}
									</div>
								))}
							</div>
						) : null}
						{attachmentUploadError ? (
							<div className="runa-alert runa-alert--warning">{attachmentUploadError}</div>
						) : isUploadingAttachment ? (
							<div className="runa-subtle-copy">Secilen dosya yukleniyor...</div>
						) : null}
					</div>

					{lastError ? (
						<div
							role="alert"
							style={{
								lineHeight: 1.5,
								transition: 'opacity 220ms ease, transform 220ms ease',
							}}
							className="runa-alert runa-alert--danger"
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
							disabled={
								isSubmitting ||
								isUploadingAttachment ||
								connectionStatus !== 'open' ||
								!isRuntimeConfigReady
							}
							style={{
								...primaryButtonStyle,
								opacity:
									isSubmitting ||
									isUploadingAttachment ||
									connectionStatus !== 'open' ||
									!isRuntimeConfigReady
										? 0.6
										: 1,
								width: 'min(220px, 100%)',
							}}
							className="runa-button runa-button--primary"
						>
							{submitButtonLabel}
						</button>
					</div>
				</form>
			</section>

			<section style={workspaceGridStyle} aria-label="Conversation workspace">
				<ConversationSidebar
					activeConversationId={activeConversationId}
					activeConversationMembers={conversations.activeConversationMembers}
					activeConversationSummary={conversations.activeConversationSummary}
					conversationError={conversationError}
					conversations={conversationList}
					isLoading={isConversationLoading}
					isMemberLoading={conversations.isMemberLoading}
					memberError={conversations.memberError}
					onRemoveMember={conversations.removeConversationMember}
					onSelectConversation={selectConversation}
					onShareMember={conversations.shareConversationMember}
					onStartNewConversation={beginDraftConversation}
				/>
				<div
					className="runa-card runa-card--chat runa-chat-surface"
					style={conversationSurfaceStyle}
					aria-labelledby="chat-conversation-surface-heading"
				>
					<div style={{ display: 'grid', gap: '8px' }}>
						<div style={secondaryLabelStyle}>{uiCopy.run.currentRunProgress}</div>
						<h2 id="chat-conversation-surface-heading" style={{ fontSize: '20px' }}>
							Aktif sohbet akisi
						</h2>
						<div className="runa-subtle-copy">
							Guncel calisma, kalici mesajlar ve yardimci kartlar burada sakin bir akista kalir.
						</div>
					</div>
					{persistedConversationMessages}
					{currentRunProgressPanel}
					{streamingSurface}
					{currentPresentationContent ?? emptyRunTimelineContent}
				</div>
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
				<section
					style={developerHintStyle}
					className="runa-card runa-card--subtle"
					aria-label="Developer Mode notice"
				>
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
