import type { DesktopDevicePresenceSnapshot } from '@runa/types';
import { ChevronRight, Paperclip, SendHorizontal, SlidersHorizontal, Square } from 'lucide-react';
import type { FormEvent, KeyboardEvent, ReactElement, ReactNode } from 'react';
import { useId, useRef } from 'react';
import { uiCopy } from '../../localization/copy.js';
import type { ModelAttachment } from '../../ws-types.js';
import { RunaButton } from '../ui/RunaButton.js';
import { RunaCard } from '../ui/RunaCard.js';
import { RunaTextarea } from '../ui/RunaTextarea.js';
import styles from './ChatComposerSurface.module.css';
import { DesktopTargetSelector } from './DesktopTargetSelector.js';
import { FileUploadButton } from './FileUploadButton.js';
import { VoiceComposerControls } from './VoiceComposerControls.js';

type ChatComposerSurfaceProps = Readonly<{
	accessToken?: string | null;
	apiKey: string;
	attachmentUploadError: string | null;
	attachments: readonly ModelAttachment[];
	canReadLatestResponse: boolean;
	connectionStatus: string;
	currentStreamingRunId: string | null;
	desktopDeviceError: string | null;
	desktopDevices: readonly DesktopDevicePresenceSnapshot[];
	emptySuggestions?: ReactNode;
	isDesktopDevicesLoading: boolean;
	isListening: boolean;
	isRuntimeConfigReady: boolean;
	isSpeaking: boolean;
	isSpeechPlaybackSupported: boolean;
	isSubmitting: boolean;
	isContextSheetOpen: boolean;
	isUploadingAttachment: boolean;
	isVoiceSupported: boolean;
	lastError: string | null;
	onAttachmentUploadStateChange: (input: {
		readonly error: string | null;
		readonly isUploading: boolean;
	}) => void;
	onAttachmentsChange: (attachments: readonly ModelAttachment[]) => void;
	onAbortRun: () => void;
	onClearDesktopTarget: () => void;
	onPromptChange: (prompt: string) => void;
	onOpenContextSheet: () => void;
	onReadLatestResponse: () => void;
	onRetryDesktopDevices: () => void;
	onSelectDesktopTarget: (connectionId: string) => void;
	onStopSpeaking: () => void;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	onToggleListening: () => void;
	prompt: string;
	selectedDesktopTargetConnectionId: string | null;
	showDeveloperControls?: boolean;
	statusLabel: string;
	submitButtonLabel: string;
	voiceStatusMessage: string | null;
}>;

function shouldDisableSubmit(input: {
	readonly connectionStatus: string;
	readonly isRuntimeConfigReady: boolean;
	readonly isUploadingAttachment: boolean;
}): boolean {
	return (
		input.isUploadingAttachment || input.connectionStatus !== 'open' || !input.isRuntimeConfigReady
	);
}

export function shouldSubmitComposerKey(input: {
	readonly hasContent: boolean;
	readonly isComposing: boolean;
	readonly isSubmitDisabled: boolean;
	readonly key: string;
	readonly shiftKey: boolean;
}): boolean {
	return (
		input.key === 'Enter' &&
		!input.shiftKey &&
		!input.isComposing &&
		!input.isSubmitDisabled &&
		input.hasContent
	);
}

export function ChatComposerSurface({
	accessToken,
	apiKey,
	attachmentUploadError,
	attachments,
	canReadLatestResponse,
	connectionStatus,
	currentStreamingRunId,
	desktopDeviceError,
	desktopDevices,
	emptySuggestions = null,
	isDesktopDevicesLoading,
	isListening,
	isRuntimeConfigReady,
	isSpeaking,
	isSpeechPlaybackSupported,
	isSubmitting,
	isContextSheetOpen,
	isUploadingAttachment,
	isVoiceSupported,
	lastError,
	onAttachmentUploadStateChange,
	onAttachmentsChange,
	onAbortRun,
	onClearDesktopTarget,
	onPromptChange,
	onOpenContextSheet,
	onReadLatestResponse,
	onRetryDesktopDevices,
	onSelectDesktopTarget,
	onStopSpeaking,
	onSubmit,
	onToggleListening,
	prompt,
	selectedDesktopTargetConnectionId,
	showDeveloperControls,
	statusLabel,
	submitButtonLabel,
	voiceStatusMessage,
}: ChatComposerSurfaceProps): ReactElement {
	const promptTextareaId = useId();
	const moreDetailsRef = useRef<HTMLDetailsElement | null>(null);
	const contextCount = attachments.length;
	const isRunning = isSubmitting || currentStreamingRunId !== null;
	const isSubmitDisabled =
		isRunning ||
		shouldDisableSubmit({
			connectionStatus,
			isRuntimeConfigReady,
			isUploadingAttachment,
		});
	const canSubmit = prompt.trim().length > 0 || attachments.length > 0;
	const showEmptyIntro = emptySuggestions !== null;

	function handleMoreToolsKeyDown(event: KeyboardEvent<HTMLDetailsElement>): void {
		if (event.key !== 'Escape' || !moreDetailsRef.current?.open) {
			return;
		}

		event.preventDefault();
		moreDetailsRef.current.open = false;
		moreDetailsRef.current.querySelector<HTMLElement>('summary')?.focus();
	}

	function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
		if (
			!shouldSubmitComposerKey({
				hasContent: prompt.trim().length > 0 || attachments.length > 0,
				isComposing: event.nativeEvent.isComposing,
				isSubmitDisabled,
				key: event.key,
				shiftKey: event.shiftKey,
			})
		) {
			return;
		}

		event.preventDefault();
		event.currentTarget.form?.requestSubmit();
	}

	return (
		<section
			className={`runa-chat-composer-surface runa-chat-surface ${styles['root']}${
				showEmptyIntro ? ' runa-chat-composer-surface--empty' : ''
			}`}
			aria-label={showEmptyIntro ? undefined : 'Mesaj yaz'}
			aria-labelledby={showEmptyIntro ? 'chat-composer-heading' : undefined}
		>
			<div className={`runa-chat-composer-surface__intro ${styles['intro']}`}>
				<div className={styles['eyebrow']}>Sohbet</div>
				<h2 id="chat-composer-heading" className={styles['title']}>
					Neyi ilerletmek istiyorsun?
				</h2>
				<div className="runa-subtle-copy">
					Bugün ne yapmak istersin? Kısa yazabilirsin; kaynak, dosya ve onay gereken adımlar
					birlikte toparlanır.
				</div>
			</div>

			{showDeveloperControls && !apiKey.trim() && isRuntimeConfigReady ? (
				<div className={`runa-alert runa-alert--warning ${styles['alert']}`}>
					<span className={styles['alertBadge']}>Bağlantı</span>
					Varsayılan bağlantı kullanılacak.
				</div>
			) : null}

			{!isRuntimeConfigReady ? (
				<output
					aria-live="polite"
					className={`runa-alert runa-alert--warning ${styles['outputAlert']}`}
				>
					<div className={styles['alertText']}>Runa şu anda mesaj göndermeye hazır değil.</div>
					<div className="runa-subtle-copy">Bağlantı hazır olduğunda yeniden deneyebilirsin.</div>
				</output>
			) : null}

			<form onSubmit={onSubmit} className={`runa-chat-composer-form ${styles['form']}`}>
				<label
					htmlFor={promptTextareaId}
					className={`runa-chat-composer-input ${styles['inputLabel']}`}
				>
					<span className={`runa-chat-visually-hidden ${styles['visuallyHidden']}`}>Mesaj</span>
					<RunaTextarea
						className="runa-input runa-input--textarea"
						id={promptTextareaId}
						onChange={(event) => onPromptChange(event.target.value)}
						onKeyDown={handlePromptKeyDown}
						placeholder={uiCopy.chat.composerPlaceholder}
						rows={showEmptyIntro ? 4 : 2}
						value={prompt}
					/>
				</label>

				<div className={`runa-chat-composer-actions ${styles['actions']}`}>
					<div className={`runa-chat-composer-actions__left ${styles['actionsLeft']}`}>
						<FileUploadButton
							accessToken={accessToken}
							disabled={!isRuntimeConfigReady || isSubmitting}
							icon={<Paperclip aria-hidden="true" size={18} />}
							onAttachmentUploaded={(attachment) => {
								onAttachmentsChange([...attachments, attachment]);
								onAttachmentUploadStateChange({ error: null, isUploading: false });
							}}
							onUploadStateChange={onAttachmentUploadStateChange}
						/>
						{contextCount > 0 ? (
							<button
								type="button"
								className="runa-composer-context-chip"
								onClick={onOpenContextSheet}
								aria-controls="context-sheet"
								aria-expanded={isContextSheetOpen}
								aria-label={`${contextCount} calisma ogesi. Baglami ac`}
							>
								<Paperclip size={14} aria-hidden="true" />
								<span>{contextCount} working files</span>
								<ChevronRight size={14} aria-hidden="true" />
							</button>
						) : null}
					</div>
					<div className={`runa-chat-composer-actions__right ${styles['actionsRight']}`}>
						<details
							className={`runa-chat-composer-more ${styles['moreTools']}`}
							onKeyDown={handleMoreToolsKeyDown}
							ref={moreDetailsRef}
						>
							<summary
								className={styles['moreSummary']}
								aria-label="Diğer sohbet araçları"
								title="Diğer sohbet araçları"
							>
								<SlidersHorizontal aria-hidden="true" size={18} />
								<span className="runa-chat-visually-hidden">Diğer sohbet araçları</span>
							</summary>
							<div className={`runa-chat-composer-more__content ${styles['moreContent']}`}>
								<DesktopTargetSelector
									devices={desktopDevices}
									errorMessage={desktopDeviceError}
									isLoading={isDesktopDevicesLoading}
									onClear={onClearDesktopTarget}
									onRetry={onRetryDesktopDevices}
									onSelect={onSelectDesktopTarget}
									selectedConnectionId={selectedDesktopTargetConnectionId}
								/>
								<VoiceComposerControls
									canReadLatestResponse={canReadLatestResponse}
									isListening={isListening}
									isSpeaking={isSpeaking}
									isSpeechPlaybackSupported={isSpeechPlaybackSupported}
									isVoiceSupported={isVoiceSupported}
									onReadLatestResponse={onReadLatestResponse}
									onStopSpeaking={onStopSpeaking}
									onToggleListening={onToggleListening}
									voiceStatusMessage={voiceStatusMessage}
								/>
							</div>
						</details>
						<RunaButton
							aria-label={isRunning ? 'Çalışmayı durdur' : submitButtonLabel}
							className={`runa-button runa-button--primary runa-chat-send-button ${styles['sendButton']}${
								isRunning ? ` ${styles['sendButtonStop']}` : ''
							}`}
							disabled={!isRunning && (isSubmitDisabled || !canSubmit)}
							onClick={isRunning ? onAbortRun : undefined}
							type={isRunning ? 'button' : 'submit'}
							variant={isRunning ? 'secondary' : 'primary'}
						>
							{isRunning ? (
								<Square aria-hidden="true" size={18} />
							) : (
								<SendHorizontal aria-hidden="true" size={18} />
							)}
						</RunaButton>
					</div>
				</div>

				<div className="runa-chat-composer-attachments">
					{attachments.length > 0 ? (
						<div className={styles['attachmentsList']}>
							{attachments.map((attachment) => (
								<RunaCard
									key={attachment.blob_id}
									className={styles['attachmentCard']}
									tone="subtle"
								>
									<div className={styles['attachmentInfo']}>
										<div className={styles['attachmentInfoInner']}>
											<strong className={styles['attachmentName']}>
												{attachment.filename ?? attachment.blob_id}
											</strong>
											<div className="runa-subtle-copy">
												{attachment.kind} - {attachment.size_bytes} bytes
											</div>
										</div>
										<RunaButton
											className={`runa-button runa-button--secondary ${styles['removeButton']}`}
											onClick={() =>
												onAttachmentsChange(
													attachments.filter(
														(candidate) => candidate.blob_id !== attachment.blob_id,
													),
												)
											}
											variant="secondary"
										>
											Kaldır
										</RunaButton>
									</div>
									{attachment.kind === 'image' ? (
										<img
											alt={attachment.filename ?? 'Ek dosya önizlemesi'}
											src={attachment.data_url}
											className={styles['imagePreview']}
										/>
									) : attachment.kind === 'text' ? (
										<div className={styles['textPreview']}>{attachment.text_content}</div>
									) : (
										<div className={styles['documentPreview']}>
											{attachment.text_preview ?? 'Doküman eklendi'}
										</div>
									)}
								</RunaCard>
							))}
						</div>
					) : null}
					{attachmentUploadError ? (
						<div className="runa-alert runa-alert--warning">{attachmentUploadError}</div>
					) : isUploadingAttachment ? (
						<div className="runa-subtle-copy">Seçilen dosya yükleniyor...</div>
					) : null}
				</div>

				{lastError ? (
					<div role="alert" className={`runa-alert runa-alert--danger ${styles['errorAlert']}`}>
						<strong>Runa bu isteği başlatamadı. </strong>
						{lastError}
					</div>
				) : null}
				<div className={`runa-chat-composer-status ${styles['status']}`}>{statusLabel}</div>
			</form>
			{emptySuggestions}
		</section>
	);
}
