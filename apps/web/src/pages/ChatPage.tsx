import type { DesktopDevicePresenceSnapshot } from '@runa/types';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ChatComposerSurface } from '../components/chat/ChatComposerSurface.js';
import { ChatDeveloperHint } from '../components/chat/ChatDeveloperHint.js';
import { ChatShell } from '../components/chat/ChatShell.js';
import { ChatWorkspaceHeader } from '../components/chat/ChatWorkspaceHeader.js';
import { ConversationSidebar } from '../components/chat/ConversationSidebar.js';
import { CurrentRunSurface } from '../components/chat/CurrentRunSurface.js';
import { PastRunSurfaces } from '../components/chat/PastRunSurfaces.js';
import { renderRunFeedbackBanner } from '../components/chat/PresentationBlockRenderer.js';
import type { InspectionActionState } from '../components/chat/PresentationBlockRenderer.js';
import { PresentationRunSurfaceCard } from '../components/chat/PresentationRunSurfaceCard.js';
import { RunProgressPanel } from '../components/chat/RunProgressPanel.js';
import { RunTimelinePanel } from '../components/chat/RunTimelinePanel.js';
import {
	buildInspectionSurfaceMeta,
	createInspectionDetailRequestKey,
	getInspectionDetailBlockId,
} from '../components/chat/chat-presentation.js';
import type { UseChatRuntimeResult } from '../hooks/useChatRuntime.js';
import { useChatRuntimeView } from '../hooks/useChatRuntimeView.js';
import type { UseConversationsResult } from '../hooks/useConversations.js';
import { useDeveloperMode } from '../hooks/useDeveloperMode.js';
import { useTextToSpeech } from '../hooks/useTextToSpeech.js';
import { useVoiceInput } from '../hooks/useVoiceInput.js';
import { deriveCurrentRunProgressSurface } from '../lib/chat-runtime/current-run-progress.js';
import { DEFAULT_INSPECTION_DETAIL_LEVEL } from '../lib/chat-runtime/types.js';
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

const workspaceGridStyle = {
	display: 'grid',
	gap: '20px',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
	alignItems: 'start',
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

	const pastPresentationContent = (
		<PastRunSurfaces
			expandedPastRunIds={expandedPastRunIds}
			inspectionAnchorIdsByDetailId={inspectionAnchorIdsByDetailId}
			onRequestInspection={requestInspection}
			onResolveApproval={resolveApproval}
			onToggleExpanded={setPastRunExpanded}
			pastPresentationSurfaces={pastPresentationSurfaces}
			pendingInspectionRequestKeys={pendingInspectionRequestKeys}
			runTransportSummaries={runTransportSummaries}
			getInspectionActionState={getInspectionActionState}
		/>
	);

	return (
		<ChatShell embedded={embedded}>
			<ChatWorkspaceHeader connectionStatus={connectionStatus} statusLabel={statusLabel} />

			<ChatComposerSurface
				accessToken={accessToken}
				apiKey={apiKey}
				attachmentUploadError={attachmentUploadError}
				attachments={attachments}
				canReadLatestResponse={latestReadableResponse.length > 0}
				connectionStatus={connectionStatus}
				desktopDeviceError={desktopDeviceError}
				desktopDevices={desktopDevices}
				isDesktopDevicesLoading={isDesktopDevicesLoading}
				isListening={voiceInput.isListening}
				isRuntimeConfigReady={isRuntimeConfigReady}
				isSpeaking={isSpeaking}
				isSpeechPlaybackSupported={isTextToSpeechSupported}
				isSubmitting={isSubmitting}
				isUploadingAttachment={isUploadingAttachment}
				isVoiceSupported={voiceInput.isSupported}
				lastError={lastError}
				onAttachmentUploadStateChange={({ error, isUploading }) => {
					setAttachmentUploadError(error);
					setIsUploadingAttachment(isUploading);
				}}
				onAttachmentsChange={setAttachments}
				onClearDesktopTarget={() => setSelectedDesktopTargetConnectionId(null)}
				onOpenDeveloperMode={() => setDeveloperMode(true)}
				onPromptChange={setPrompt}
				onReadLatestResponse={() => speak(latestReadableResponse)}
				onRetryDesktopDevices={() => setDesktopDevicesReloadKey((current) => current + 1)}
				onSelectDesktopTarget={setSelectedDesktopTargetConnectionId}
				onStopSpeaking={cancelTextToSpeech}
				onSubmit={submitRunRequest}
				onToggleListening={voiceInput.toggleListening}
				prompt={prompt}
				selectedDesktopTargetConnectionId={selectedDesktopTargetConnectionId}
				statusLabel={statusLabel}
				submitButtonLabel={submitButtonLabel}
				voiceStatusMessage={voiceStatusMessage}
			/>

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
				<CurrentRunSurface
					activeConversationId={activeConversationId}
					activeConversationMessages={activeConversationMessages}
					currentPresentationContent={currentPresentationContent}
					currentRunId={currentRunId}
					currentRunProgressPanel={currentRunProgressPanel}
					currentStreamingRunId={currentStreamingRunId}
					currentStreamingText={currentStreamingText}
					emptyStateContent={emptyRunTimelineContent}
				/>
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
				<ChatDeveloperHint />
			)}
		</ChatShell>
	);
}
