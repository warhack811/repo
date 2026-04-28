import type { ReactElement } from 'react';
import { lazy, useMemo, useState } from 'react';

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
import { uiCopy } from '../localization/copy.js';
import {
	selectConnectionState,
	selectPresentationState,
	selectRuntimeConfigState,
	selectTransportState,
	useChatStoreSelector,
} from '../stores/chat-store.js';

type ChatPageProps = Readonly<{
	conversations: UseConversationsResult;
	embedded?: boolean;
	runtime: UseChatRuntimeResult;
}>;

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
	const [isConversationSidebarOpen, setIsConversationSidebarOpen] = useState(false);
	const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

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
		<EmptyState onSubmitSuggestion={(suggestionPrompt) => setPrompt(suggestionPrompt)} />
	);

	const currentPresentationContent = currentPresentationSurface ? (
		<PresentationRunSurfaceCard
			expanded
			inspectionAnchorIdsByDetailId={inspectionAnchorIdsByDetailId}
			isCurrent
			isDeveloperMode={isDeveloperMode}
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
			isDeveloperMode={isDeveloperMode}
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
			<ChatHeader
				activeConversationTitle={conversations.activeConversationSummary?.title}
				connectionStatus={connectionStatus}
				desktopDevices={desktopDevices}
				onToggleSidebar={() => setIsConversationSidebarOpen(true)}
				statusLabel={statusLabel}
			/>

			<ChatLayout
				composer={
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
						onClearDesktopTarget={() => setDesktopTargetConnectionId(null)}
						onOpenDeveloperMode={() => setDeveloperMode(true)}
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
				}
				isSidebarOpen={isConversationSidebarOpen}
				messages={
					<CurrentRunSurface
						activeConversationId={activeConversationId}
						activeConversationMessages={activeConversationMessages}
						currentPresentationContent={currentPresentationContent}
						currentRunId={currentRunId}
						currentRunProgressPanel={currentRunProgressPanel}
						currentStreamingRunId={currentStreamingRunId}
						currentStreamingText={currentStreamingText}
						emptyStateContent={emptyRunTimelineContent}
						isHistoryLoading={isConversationLoading}
					/>
				}
				onCloseSidebar={() => setIsConversationSidebarOpen(false)}
				onToggleSidebar={() => setIsConversationSidebarOpen(true)}
				sidebar={
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
