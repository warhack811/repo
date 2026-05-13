import type { ReactElement } from 'react';
import { lazy, useMemo, useState } from 'react';

import { AppSidebar } from '../components/app/AppSidebar.js';
import { ChatComposerSurface } from '../components/chat/ChatComposerSurface.js';
import { ChatHeader } from '../components/chat/ChatHeader.js';
import { ChatLayout } from '../components/chat/ChatLayout.js';
import { ChatShell } from '../components/chat/ChatShell.js';
import { ConversationSidebar } from '../components/chat/ConversationSidebar.js';
import { CurrentRunSurface } from '../components/chat/CurrentRunSurface.js';
import { EmptyState } from '../components/chat/EmptyState.js';
import { PastRunSurfaces } from '../components/chat/PastRunSurfaces.js';
import { renderRunFeedbackBanner } from '../components/chat/PresentationBlockRenderer.js';
import { PresentationRunSurfaceCard } from '../components/chat/PresentationRunSurfaceCard.js';
import { RunProgressPanel } from '../components/chat/RunProgressPanel.js';
import { TransportErrorBanner } from '../lib/transport/errors.js';

const RunTimelinePanel = lazy(() =>
	import('../components/developer/RunTimelinePanel.js').then((module) => ({
		default: module.RunTimelinePanel,
	})),
);
import { useChatPageInspection } from '../hooks/useChatPageInspection.js';
import type { UseChatRuntimeResult } from '../hooks/useChatRuntime.js';
import { useChatRuntimeView } from '../hooks/useChatRuntimeView.js';
import type { UseConversationsResult } from '../hooks/useConversations.js';
import { useDesktopDevices } from '../hooks/useDesktopDevices.js';
import { useDeveloperMode } from '../hooks/useDeveloperMode.js';
import { useTextToSpeechIntegration } from '../hooks/useTextToSpeechIntegration.js';
import { deriveCurrentRunProgressSurface } from '../lib/chat-runtime/current-run-progress.js';
import { normalizePresentationSurface } from '../lib/chat-runtime/normalize-presentation-surface.js';
import type { PresentationRunSurface } from '../lib/chat-runtime/types.js';
import { uiCopy } from '../localization/copy.js';
import {
	selectConnectionState,
	selectPresentationState,
	selectRuntimeConfigState,
	selectTransportState,
	useChatStoreSelector,
} from '../stores/chat-store.js';
import '../styles/routes/chat-migration.css';

type ChatPageProps = Readonly<{
	conversations: UseConversationsResult;
	embedded?: boolean;
	runtime: UseChatRuntimeResult;
}>;

function hasResolvedApprovalBlock(surface: PresentationRunSurface | null): boolean {
	return Boolean(
		surface?.blocks.some(
			(block) => block.type === 'approval_block' && block.payload.status !== 'pending',
		),
	);
}

export function ChatPage({
	conversations,
	embedded = false,
	runtime,
}: ChatPageProps): ReactElement {
	const { isDeveloperMode } = useDeveloperMode();
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
	const { connectionStatus, isSubmitting, lastError, transportErrorCode } = connectionState;
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
	const [isConversationSidebarOpen, setIsConversationSidebarOpen] = useState(false);
	const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
	const visibleCurrentPresentationSurface = useMemo(
		() => normalizePresentationSurface(currentPresentationSurface, activeConversationMessages),
		[currentPresentationSurface, activeConversationMessages],
	);
	const currentRunFeedbackForProgress = hasResolvedApprovalBlock(visibleCurrentPresentationSurface)
		? null
		: currentRunFeedback;

	const latestAssistantMessage = useMemo(
		() =>
			[...activeConversationMessages].reverse().find((message) => message.role === 'assistant') ??
			null,
		[activeConversationMessages],
	);
	const latestReadableResponse = latestAssistantMessage?.content?.trim() ?? '';
	const {
		cancelTextToSpeech,
		isSpeaking,
		isTextToSpeechSupported,
		speakLatestResponse,
		voiceInput,
		voiceStatusMessage,
	} = useTextToSpeechIntegration({
		latestAssistantMessage,
		latestReadableResponse,
		onPromptChange: setPrompt,
		prompt,
	});
	const { desktopDeviceError, desktopDevices, isDesktopDevicesLoading, reloadDesktopDevices } =
		useDesktopDevices({
			accessToken,
			onSelectedDeviceMissing: () => setDesktopTargetConnectionId(null),
			selectedConnectionId: runtimeDesktopTargetConnectionId,
		});

	const { currentInspectionSurfaceMeta, getInspectionActionState } = useChatPageInspection({
		currentBlocks: currentPresentationSurface?.blocks ?? null,
		pendingInspectionRequestKeys,
		staleInspectionRequestKeys,
	});

	const shouldShowRunFeedbackBanner = useMemo(() => {
		if (!currentRunFeedbackForProgress) {
			return false;
		}

		if (!visibleCurrentPresentationSurface) {
			return true;
		}

		return (
			currentRunFeedbackForProgress.run_id !== visibleCurrentPresentationSurface.run_id ||
			currentRunFeedbackForProgress.tone === 'error' ||
			currentRunFeedbackForProgress.tone === 'warning' ||
			currentRunFeedbackForProgress.pending_detail_count > 0
		);
	}, [visibleCurrentPresentationSurface, currentRunFeedbackForProgress]);

	const { statusLabel, submitButtonLabel } = useChatRuntimeView({
		connectionStatus,
		currentRunFeedbackChipLabel: currentRunFeedback?.chip_label,
		isSubmitting,
	});

	const currentRunFeedbackBanner =
		shouldShowRunFeedbackBanner && currentRunFeedbackForProgress
			? renderRunFeedbackBanner(currentRunFeedbackForProgress)
			: null;

	const currentRunSummary = useMemo(() => {
		const activeRunId = currentRunFeedback?.run_id ?? visibleCurrentPresentationSurface?.run_id;
		return activeRunId ? runTransportSummaries.get(activeRunId) : undefined;
	}, [visibleCurrentPresentationSurface, currentRunFeedback, runTransportSummaries]);
	const canResolveCurrentApproval = Boolean(
		currentRunSummary?.has_accepted && currentRunSummary.final_state === undefined,
	);

	const currentRunProgress = useMemo(
		() =>
			deriveCurrentRunProgressSurface({
				current_presentation_surface: visibleCurrentPresentationSurface,
				current_run_feedback: currentRunFeedbackForProgress,
				run_summary: currentRunSummary,
			}),
		[visibleCurrentPresentationSurface, currentRunFeedbackForProgress, currentRunSummary],
	);

	const isRunCompleted = currentRunProgress?.status_tone === 'success';
	const isRunInProgress = currentRunProgress !== null && !isRunCompleted;
	const currentRunProgressPanel =
		isDeveloperMode && currentRunProgress && !isRunCompleted ? (
			<RunProgressPanel
				feedbackBanner={currentRunFeedbackBanner}
				isDeveloperMode={isDeveloperMode}
				progress={currentRunProgress}
			/>
		) : null;
	const currentRunId = currentRunFeedback?.run_id ?? visibleCurrentPresentationSurface?.run_id;
	const transportErrorBanner = transportErrorCode ? (
		<TransportErrorBanner code={transportErrorCode} onRetry={runtime.retryTransport} />
	) : null;

	const emptyRunTimelineContent = (
		<EmptyState onSubmitSuggestion={(suggestionPrompt) => setPrompt(suggestionPrompt)} />
	);

	const currentPresentationContent = visibleCurrentPresentationSurface ? (
		<PresentationRunSurfaceCard
			expanded
			inspectionAnchorIdsByDetailId={inspectionAnchorIdsByDetailId}
			isCurrent
			isDeveloperMode={isDeveloperMode}
			onRequestInspection={requestInspection}
			onResolveApproval={canResolveCurrentApproval ? resolveApproval : undefined}
			pendingInspectionRequestKeys={pendingInspectionRequestKeys}
			runTransportSummaries={runTransportSummaries}
			surface={visibleCurrentPresentationSurface}
			getInspectionActionState={getInspectionActionState}
		/>
	) : null;

	const pastPresentationContent = (
		<PastRunSurfaces
			expandedPastRunIds={expandedPastRunIds}
			inspectionAnchorIdsByDetailId={inspectionAnchorIdsByDetailId}
			isDeveloperMode={isDeveloperMode}
			onRequestInspection={requestInspection}
			onToggleExpanded={setPastRunExpanded}
			pastPresentationSurfaces={pastPresentationSurfaces}
			pendingInspectionRequestKeys={pendingInspectionRequestKeys}
			runTransportSummaries={runTransportSummaries}
			getInspectionActionState={getInspectionActionState}
		/>
	);
	const hasVisibleRunSurface =
		isRunInProgress ||
		currentPresentationContent !== null ||
		currentStreamingText.trim().length > 0;
	const shouldShowEmptyComposerSuggestions =
		!hasVisibleRunSurface && activeConversationMessages.length === 0 && !isConversationLoading;

	return (
		<ChatShell embedded={embedded}>
			<ChatHeader
				activeConversationTitle={conversations.activeConversationSummary?.title}
				onToggleSidebar={() => setIsConversationSidebarOpen(true)}
			/>

			<ChatLayout
				composer={
					<>
						{transportErrorBanner}
						<ChatComposerSurface
							accessToken={accessToken}
							apiKey={apiKey}
							attachmentUploadError={attachmentUploadError}
							attachments={attachments}
							canReadLatestResponse={latestReadableResponse.length > 0}
							connectionStatus={connectionStatus}
							desktopDeviceError={desktopDeviceError}
							desktopDevices={desktopDevices}
							emptySuggestions={shouldShowEmptyComposerSuggestions ? emptyRunTimelineContent : null}
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
							onClearDesktopTarget={() => setDesktopTargetConnectionId(null)}
							onPromptChange={setPrompt}
							onReadLatestResponse={speakLatestResponse}
							onRetryDesktopDevices={reloadDesktopDevices}
							onSelectDesktopTarget={setDesktopTargetConnectionId}
							onStopSpeaking={cancelTextToSpeech}
							onSubmit={submitRunRequest}
							onToggleListening={voiceInput.toggleListening}
							prompt={prompt}
							selectedDesktopTargetConnectionId={runtimeDesktopTargetConnectionId}
							showDeveloperControls={isDeveloperMode}
							statusLabel={statusLabel}
							submitButtonLabel={submitButtonLabel}
							voiceStatusMessage={voiceStatusMessage}
						/>
					</>
				}
				isSidebarOpen={isConversationSidebarOpen}
				messages={
					<CurrentRunSurface
						activeConversationId={activeConversationId}
						activeConversationMessages={activeConversationMessages}
						currentPresentationContent={currentPresentationContent}
						currentRunId={currentRunId}
						currentStreamingRunId={currentStreamingRunId}
						currentStreamingText={currentStreamingText}
						emptyStateContent={null}
						isHistoryLoading={isConversationLoading}
					/>
				}
				onCloseSidebar={() => setIsConversationSidebarOpen(false)}
				sidebar={
					<AppSidebar
						activePage="chat"
						conversationSidebar={
							<ConversationSidebar
								activeConversationId={activeConversationId}
								activeConversationMembers={conversations.activeConversationMembers}
								activeConversationSummary={conversations.activeConversationSummary}
								conversationError={conversationError}
								conversations={conversationList}
								isLoading={isConversationLoading}
								isMemberLoading={conversations.isMemberLoading}
								isOpen={isConversationSidebarOpen}
								memberError={conversations.memberError}
								onClose={() => setIsConversationSidebarOpen(false)}
								onRemoveMember={conversations.removeConversationMember}
								onSelectConversation={selectConversation}
								onShareMember={conversations.shareConversationMember}
								onStartNewConversation={beginDraftConversation}
							/>
						}
					/>
				}
			/>

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
			) : null}
		</ChatShell>
	);
}
