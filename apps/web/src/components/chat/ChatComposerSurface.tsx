import type { DesktopDevicePresenceSnapshot } from '@runa/types';
import type { FormEvent, ReactElement } from 'react';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { uiCopy } from '../../localization/copy.js';
import type { ModelAttachment } from '../../ws-types.js';
import { RunaButton, RunaCard, RunaTextarea } from '../ui/index.js';
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
	onOpenDeveloperMode: () => void;
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

export function ChatComposerSurface({
	accessToken,
	apiKey,
	attachmentUploadError,
	attachments,
	canReadLatestResponse,
	connectionStatus,
	desktopDeviceError,
	desktopDevices,
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
	onOpenDeveloperMode,
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
	const isSubmitDisabled = shouldDisableSubmit({
		connectionStatus,
		isRuntimeConfigReady,
		isSubmitting,
		isUploadingAttachment,
	});

	return (
		<section
			className="runa-card runa-card--strong runa-chat-surface runa-migrated-components-chat-chatcomposersurface-1"
			aria-labelledby="chat-composer-heading"
		>
			<div className="runa-migrated-components-chat-chatcomposersurface-2">
				<div className="runa-migrated-components-chat-chatcomposersurface-3">Sohbet</div>
				<h2
					id="chat-composer-heading"
					className="runa-migrated-components-chat-chatcomposersurface-4"
				>
					Neyi ilerletmek istiyorsun?
				</h2>
				<div className="runa-subtle-copy">
					Kisa yazabilirsin. Runa gerekirse dosya, kaynak ve onay isteyen adimlari sohbetin icinde
					sade sekilde toparlar.
				</div>
			</div>

			{showDeveloperControls && !apiKey.trim() && isRuntimeConfigReady ? (
				<div className="runa-alert runa-alert--warning runa-migrated-components-chat-chatcomposersurface-5">
					<span className="runa-migrated-components-chat-chatcomposersurface-6">Baglanti</span>
					Gelistirici ayarlarindaki varsayilan baglanti kullanilacak.
				</div>
			) : null}

			{!isRuntimeConfigReady ? (
				<output
					aria-live="polite"
					className="runa-alert runa-alert--warning runa-migrated-components-chat-chatcomposersurface-7"
				>
					<div className="runa-migrated-components-chat-chatcomposersurface-8">
						Runa su anda mesaj gondermeye hazir degil.
					</div>
					<div className="runa-subtle-copy">
						Baglanti hazir oldugunda mesajini buradan gonderebilirsin.
					</div>
					{showDeveloperControls ? (
						<div className="runa-migrated-components-chat-chatcomposersurface-9">
							<RunaButton
								className="runa-button runa-button--primary runa-migrated-components-chat-chatcomposersurface-10"
								onClick={onOpenDeveloperMode}
								variant="primary"
							>
								Developer Mode'u etkinlestir
							</RunaButton>
							<Link
								className="runa-button runa-button--secondary runa-migrated-components-chat-chatcomposersurface-11"
								to="/developer"
							>
								{uiCopy.chat.openDeveloper}
							</Link>
						</div>
					) : null}
				</output>
			) : null}

			<form onSubmit={onSubmit} className="runa-migrated-components-chat-chatcomposersurface-12">
				<label
					htmlFor={promptTextareaId}
					className="runa-migrated-components-chat-chatcomposersurface-13"
				>
					<span className="runa-migrated-components-chat-chatcomposersurface-14">
						{uiCopy.chat.send}
					</span>
					<RunaTextarea
						className="runa-input runa-input--textarea"
						id={promptTextareaId}
						onChange={(event) => onPromptChange(event.target.value)}
						placeholder={uiCopy.chat.composerPlaceholder}
						rows={5}
						value={prompt}
					/>
				</label>

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

				<div className="runa-migrated-components-chat-chatcomposersurface-15">
					<div className="runa-migrated-components-chat-chatcomposersurface-16">
						<div className="runa-migrated-components-chat-chatcomposersurface-17">Dosyalar</div>
						<FileUploadButton
							accessToken={accessToken}
							disabled={!isRuntimeConfigReady || isSubmitting}
							onAttachmentUploaded={(attachment) => {
								onAttachmentsChange([...attachments, attachment]);
								onAttachmentUploadStateChange({ error: null, isUploading: false });
							}}
							onUploadStateChange={onAttachmentUploadStateChange}
						/>
					</div>
					<div className="runa-subtle-copy">
						Gorsel, metin veya desteklenen dokumanlari ekleyebilirsin. Runa bunlari yalniz bu
						sohbetin baglaminda kullanir.
					</div>
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
											Kaldir
										</RunaButton>
									</div>
									{attachment.kind === 'image' ? (
										<img
											alt={attachment.filename ?? 'Uploaded attachment preview'}
											src={attachment.data_url}
											className="runa-migrated-components-chat-chatcomposersurface-24"
										/>
									) : attachment.kind === 'text' ? (
										<div className="runa-migrated-components-chat-chatcomposersurface-25">
											{attachment.text_content}
										</div>
									) : (
										<div className="runa-migrated-components-chat-chatcomposersurface-26">
											{attachment.text_preview ?? 'Dokuman eklendi'}
										</div>
									)}
								</RunaCard>
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
						className="runa-alert runa-alert--danger runa-migrated-components-chat-chatcomposersurface-27"
					>
						<strong>Runa bu istegi baslatamadi. </strong>
						{lastError}
					</div>
				) : null}

				<div className="runa-migrated-components-chat-chatcomposersurface-28">
					<div className="runa-migrated-components-chat-chatcomposersurface-29">{statusLabel}</div>
					<RunaButton
						className="runa-button runa-button--primary runa-migrated-components-chat-chatcomposersurface-30"
						disabled={isSubmitDisabled}
						type="submit"
						variant="primary"
					>
						{submitButtonLabel}
					</RunaButton>
				</div>
			</form>
		</section>
	);
}
