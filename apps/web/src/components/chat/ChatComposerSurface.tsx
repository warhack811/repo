import type { DesktopDevicePresenceSnapshot } from '@runa/types';
import { Paperclip, SendHorizontal, SlidersHorizontal } from 'lucide-react';
import type { FormEvent, KeyboardEvent, ReactElement, ReactNode } from 'react';
import { useId, useRef } from 'react';
import { uiCopy } from '../../localization/copy.js';
import type { ModelAttachment } from '../../ws-types.js';
import { RunaButton } from '../ui/RunaButton.js';
import { RunaCard } from '../ui/RunaCard.js';
import { RunaTextarea } from '../ui/RunaTextarea.js';
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
	desktopDeviceError: string | null;
	desktopDevices: readonly DesktopDevicePresenceSnapshot[];
	emptySuggestions?: ReactNode;
	isDesktopDevicesLoading: boolean;
	isListening: boolean;
	isRuntimeConfigReady: boolean;
	isSpeaking: boolean;
	isSpeechPlaybackSupported: boolean;
	isSubmitting: boolean;
	isUploadingAttachment: boolean;
	isVoiceSupported: boolean;
	lastError: string | null;
	onAttachmentUploadStateChange: (input: {
		readonly error: string | null;
		readonly isUploading: boolean;
	}) => void;
	onAttachmentsChange: (attachments: readonly ModelAttachment[]) => void;
	onClearDesktopTarget: () => void;
	onPromptChange: (prompt: string) => void;
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
	readonly isSubmitting: boolean;
	readonly isUploadingAttachment: boolean;
}): boolean {
	return (
		input.isSubmitting ||
		input.isUploadingAttachment ||
		input.connectionStatus !== 'open' ||
		!input.isRuntimeConfigReady
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
	desktopDeviceError,
	desktopDevices,
	emptySuggestions = null,
	isDesktopDevicesLoading,
	isListening,
	isRuntimeConfigReady,
	isSpeaking,
	isSpeechPlaybackSupported,
	isSubmitting,
	isUploadingAttachment,
	isVoiceSupported,
	lastError,
	onAttachmentUploadStateChange,
	onAttachmentsChange,
	onClearDesktopTarget,
	onPromptChange,
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
	const isSubmitDisabled = shouldDisableSubmit({
		connectionStatus,
		isRuntimeConfigReady,
		isSubmitting,
		isUploadingAttachment,
	});
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
			className={`runa-chat-composer-surface runa-chat-surface runa-migrated-components-chat-chatcomposersurface-1${
				showEmptyIntro ? ' runa-chat-composer-surface--empty' : ''
			}`}
			aria-label={showEmptyIntro ? undefined : 'Mesaj yaz'}
			aria-labelledby={showEmptyIntro ? 'chat-composer-heading' : undefined}
		>
			<div className="runa-chat-composer-surface__intro runa-migrated-components-chat-chatcomposersurface-2">
				<div className="runa-migrated-components-chat-chatcomposersurface-3">Sohbet</div>
				<h2
					id="chat-composer-heading"
					className="runa-migrated-components-chat-chatcomposersurface-4"
				>
					Neyi ilerletmek istiyorsun?
				</h2>
				<div className="runa-subtle-copy">
					Bugün ne yapmak istersin? Kısa yazabilirsin; kaynak, dosya ve onay gereken adımlar
					birlikte toparlanır.
				</div>
			</div>

			{showDeveloperControls && !apiKey.trim() && isRuntimeConfigReady ? (
				<div className="runa-alert runa-alert--warning runa-migrated-components-chat-chatcomposersurface-5">
					<span className="runa-migrated-components-chat-chatcomposersurface-6">Bağlantı</span>
					Varsayılan bağlantı kullanılacak.
				</div>
			) : null}

			{!isRuntimeConfigReady ? (
				<output
					aria-live="polite"
					className="runa-alert runa-alert--warning runa-migrated-components-chat-chatcomposersurface-7"
				>
					<div className="runa-migrated-components-chat-chatcomposersurface-8">
						Runa şu anda mesaj göndermeye hazır değil.
					</div>
					<div className="runa-subtle-copy">Bağlantı hazır olduğunda yeniden deneyebilirsin.</div>
				</output>
			) : null}

			<form
				onSubmit={onSubmit}
				className="runa-chat-composer-form runa-migrated-components-chat-chatcomposersurface-12"
			>
				<label
					htmlFor={promptTextareaId}
					className="runa-chat-composer-input runa-migrated-components-chat-chatcomposersurface-13"
				>
					<span className="runa-chat-visually-hidden runa-migrated-components-chat-chatcomposersurface-14">
						Mesaj
					</span>
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

				<div className="runa-chat-composer-actions runa-migrated-components-chat-chatcomposersurface-15">
					<div className="runa-chat-composer-actions__left runa-migrated-components-chat-chatcomposersurface-16">
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
					</div>
					<div className="runa-chat-composer-actions__right">
						<details
							className="runa-chat-composer-more"
							onKeyDown={handleMoreToolsKeyDown}
							ref={moreDetailsRef}
						>
							<summary aria-label="Diğer sohbet araçları" title="Diğer sohbet araçları">
								<SlidersHorizontal aria-hidden="true" size={18} />
							</summary>
							<div className="runa-chat-composer-more__content">
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
							aria-label={submitButtonLabel}
							className="runa-button runa-button--primary runa-chat-send-button runa-migrated-components-chat-chatcomposersurface-30"
							disabled={isSubmitDisabled}
							type="submit"
							variant="primary"
						>
							<SendHorizontal aria-hidden="true" size={18} />
						</RunaButton>
					</div>
				</div>

				<div className="runa-chat-composer-attachments">
					{attachments.length > 0 ? (
						<div className="runa-migrated-components-chat-chatcomposersurface-18">
							{attachments.map((attachment) => (
								<RunaCard
									key={attachment.blob_id}
									className="runa-migrated-components-chat-chatcomposersurface-19"
									tone="subtle"
								>
									<div className="runa-migrated-components-chat-chatcomposersurface-20">
										<div className="runa-migrated-components-chat-chatcomposersurface-21">
											<strong className="runa-migrated-components-chat-chatcomposersurface-22">
												{attachment.filename ?? attachment.blob_id}
											</strong>
											<div className="runa-subtle-copy">
												{attachment.kind} - {attachment.size_bytes} bytes
											</div>
										</div>
										<RunaButton
											className="runa-button runa-button--secondary runa-migrated-components-chat-chatcomposersurface-23"
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
											className="runa-migrated-components-chat-chatcomposersurface-24"
										/>
									) : attachment.kind === 'text' ? (
										<div className="runa-migrated-components-chat-chatcomposersurface-25">
											{attachment.text_content}
										</div>
									) : (
										<div className="runa-migrated-components-chat-chatcomposersurface-26">
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
					<div
						role="alert"
						className="runa-alert runa-alert--danger runa-migrated-components-chat-chatcomposersurface-27"
					>
						<strong>Runa bu isteği başlatamadı. </strong>
						{lastError}
					</div>
				) : null}
				<div className="runa-chat-composer-status runa-migrated-components-chat-chatcomposersurface-29">
					{statusLabel}
				</div>
			</form>
			{emptySuggestions}
		</section>
	);
}
