import type { DesktopDevicePresenceSnapshot } from '@runa/types';
import type { CSSProperties, FormEvent, ReactElement } from 'react';
import { useId } from 'react';
import { Link } from 'react-router-dom';

import { secondaryLabelStyle } from '../../lib/chat-styles.js';
import { designTokens } from '../../lib/design-tokens.js';
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

const composerCardStyle: CSSProperties = {
	background: designTokens.color.background.panelStrong,
	border: `1px solid ${designTokens.color.border.soft}`,
	borderRadius: designTokens.radius.card,
	boxShadow: '0 24px 60px rgba(2, 6, 23, 0.38)',
	display: 'grid',
	gap: designTokens.spacing.lg,
	padding: designTokens.spacing.panel,
};

const inlineRowStyle: CSSProperties = {
	alignItems: 'center',
	display: 'flex',
	flexWrap: 'wrap',
	gap: designTokens.spacing.md,
	justifyContent: 'space-between',
};

const secondaryButtonLinkStyle: CSSProperties = {
	alignItems: 'center',
	background: 'rgba(9, 14, 25, 0.82)',
	border: '1px solid rgba(148, 163, 184, 0.26)',
	borderRadius: designTokens.radius.button,
	color: '#e5e7eb',
	display: 'inline-flex',
	fontWeight: 600,
	justifyContent: 'center',
	padding: '10px 14px',
	textDecoration: 'none',
	transition: 'transform 180ms ease, border-color 180ms ease, background 180ms ease',
};

const attachmentPreviewStyle: CSSProperties = {
	border: `1px solid ${designTokens.color.border.soft}`,
	borderRadius: '16px',
	background: 'rgba(9, 14, 25, 0.68)',
	display: 'grid',
	gap: designTokens.spacing.xs,
	padding: '12px 14px',
};

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
			className="runa-card runa-card--strong runa-chat-surface"
			style={composerCardStyle}
			aria-labelledby="chat-composer-heading"
		>
			<div style={{ display: 'grid', gap: designTokens.spacing.xs }}>
				<div style={secondaryLabelStyle}>Sohbet</div>
				<h2 id="chat-composer-heading" style={{ margin: 0, fontSize: '20px' }}>
					Neyi ilerletmek istiyorsun?
				</h2>
				<div className="runa-subtle-copy">
					Kisa yazabilirsin. Runa gerekirse dosya, kaynak ve onay isteyen adimlari sohbetin icinde
					sade sekilde toparlar.
				</div>
			</div>

			{showDeveloperControls && !apiKey.trim() && isRuntimeConfigReady ? (
				<div
					style={{
						alignItems: 'center',
						display: 'flex',
						fontSize: '13px',
						gap: designTokens.spacing.sm,
					}}
					className="runa-alert runa-alert--warning"
				>
					<span style={{ color: '#f59e0b' }}>Baglanti</span>
					Gelistirici ayarlarindaki varsayilan baglanti kullanilacak.
				</div>
			) : null}

			{!isRuntimeConfigReady ? (
				<output
					aria-live="polite"
					style={{
						display: 'grid',
						gap: designTokens.spacing.sm,
						transition: designTokens.motion.transition.surface,
					}}
					className="runa-alert runa-alert--warning"
				>
					<div style={{ color: designTokens.color.foreground.warning, fontWeight: 700 }}>
						Runa su anda mesaj gondermeye hazir degil.
					</div>
					<div className="runa-subtle-copy">
						Baglanti hazir oldugunda mesajini buradan gonderebilirsin.
					</div>
					{showDeveloperControls ? (
						<div style={{ display: 'flex', gap: designTokens.spacing.sm, flexWrap: 'wrap' }}>
							<RunaButton
								className="runa-button runa-button--primary"
								onClick={onOpenDeveloperMode}
								style={{ boxShadow: 'none', padding: '10px 14px' }}
								variant="primary"
							>
								Developer Mode'u etkinlestir
							</RunaButton>
							<Link
								className="runa-button runa-button--secondary"
								style={secondaryButtonLinkStyle}
								to="/developer"
							>
								{uiCopy.chat.openDeveloper}
							</Link>
						</div>
					) : null}
				</output>
			) : null}

			<form onSubmit={onSubmit} style={{ display: 'grid', gap: designTokens.spacing.md }}>
				<label htmlFor={promptTextareaId} style={{ display: 'grid', gap: designTokens.spacing.xs }}>
					<span style={{ color: '#e5e7eb', fontWeight: 600 }}>{uiCopy.chat.send}</span>
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

				<div style={{ display: 'grid', gap: designTokens.spacing.sm }}>
					<div style={inlineRowStyle}>
						<div style={secondaryLabelStyle}>Dosyalar</div>
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
						<div style={{ display: 'grid', gap: designTokens.spacing.sm }}>
							{attachments.map((attachment) => (
								<RunaCard key={attachment.blob_id} style={attachmentPreviewStyle} tone="subtle">
									<div style={inlineRowStyle}>
										<div style={{ display: 'grid', gap: designTokens.spacing.xxs }}>
											<strong style={{ color: designTokens.color.foreground.strong }}>
												{attachment.filename ?? attachment.blob_id}
											</strong>
											<div className="runa-subtle-copy">
												{attachment.kind} - {attachment.size_bytes} bytes
											</div>
										</div>
										<RunaButton
											className="runa-button runa-button--secondary"
											onClick={() =>
												onAttachmentsChange(
													attachments.filter(
														(candidate) => candidate.blob_id !== attachment.blob_id,
													),
												)
											}
											style={{ padding: '8px 12px' }}
											variant="secondary"
										>
											Kaldir
										</RunaButton>
									</div>
									{attachment.kind === 'image' ? (
										<img
											alt={attachment.filename ?? 'Uploaded attachment preview'}
											src={attachment.data_url}
											style={{
												border: `1px solid ${designTokens.color.border.soft}`,
												borderRadius: designTokens.radius.image,
												maxWidth: 'min(220px, 100%)',
											}}
										/>
									) : attachment.kind === 'text' ? (
										<div
											style={{
												color: '#cbd5e1',
												fontSize: '13px',
												lineHeight: 1.5,
												whiteSpace: 'pre-wrap',
											}}
										>
											{attachment.text_content}
										</div>
									) : (
										<div
											style={{
												color: '#cbd5e1',
												fontSize: '13px',
												lineHeight: 1.5,
												whiteSpace: 'pre-wrap',
											}}
										>
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
						style={{ lineHeight: 1.5, transition: designTokens.motion.transition.surface }}
						className="runa-alert runa-alert--danger"
					>
						<strong>Runa bu istegi baslatamadi. </strong>
						{lastError}
					</div>
				) : null}

				<div style={inlineRowStyle}>
					<div style={{ color: '#94a3b8', fontSize: '13px' }}>{statusLabel}</div>
					<RunaButton
						className="runa-button runa-button--primary"
						disabled={isSubmitDisabled}
						style={{ width: 'min(220px, 100%)' }}
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
