import type { FormEvent, ReactNode } from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../../src/styles/index.css';
import { ChatComposerSurface } from '../../src/components/chat/ChatComposerSurface.js';
import type { ChatStore } from '../../src/stores/chat-store.js';
import type { ModelAttachment } from '../../src/ws-types.js';

function createStore(): ChatStore {
	return {
		getState: () => ({
			presentation: {
				currentStreamingRunId: null,
				currentStreamingText: '',
			},
		}),
		setConnectionState: () => undefined,
		setPresentationState: () => undefined,
		setTransportState: () => undefined,
		setRuntimeConfigState: () => undefined,
		subscribe: () => () => undefined,
	} as unknown as ChatStore;
}

function createImageAttachment(overrides: Partial<ModelAttachment> = {}): ModelAttachment {
	return {
		blob_id: 'img-1',
		data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAA==',
		filename: 'ekran-goruntusu.png',
		kind: 'image',
		media_type: 'image/png',
		size_bytes: 1_572_864,
		...overrides,
	} as ModelAttachment;
}

function createTextAttachment(overrides: Partial<ModelAttachment> = {}): ModelAttachment {
	return {
		blob_id: 'txt-1',
		filename: 'notlar.txt',
		kind: 'text',
		media_type: 'text/plain',
		size_bytes: 8_192,
		text_content: 'Toplantı notları kısa ve net şekilde burada listelenir.',
		...overrides,
	} as ModelAttachment;
}

function createDocumentAttachment(overrides: Partial<ModelAttachment> = {}): ModelAttachment {
	return {
		blob_id: 'doc-1',
		filename: 'teklif.pdf',
		kind: 'document',
		media_type: 'application/pdf',
		size_bytes: 1_048_576,
		storage_ref: 'storage-ref-doc-1',
		text_preview: 'Doküman özeti örneği.',
		...overrides,
	} as ModelAttachment;
}

const baseProps = {
	accessToken: null,
	apiKey: 'fixture-key',
	canReadLatestResponse: false,
	composerPrepareNotice: null,
	connectionStatus: 'open',
	desktopDeviceError: null,
	desktopDevices: [],
	emptySuggestions: null,
	isDesktopDevicesLoading: false,
	isListening: false,
	isRuntimeConfigReady: true,
	isSpeaking: false,
	isSpeechPlaybackSupported: false,
	isSubmitting: false,
	isContextSheetOpen: false,
	isVoiceSupported: false,
	voiceInputStatus: 'idle' as const,
	voicePermissionDenied: false,
	lastError: null,
	store: createStore(),
	onAttachmentUploadStateChange: () => undefined,
	onAttachmentsChange: () => undefined,
	onAbortRun: () => undefined,
	onClearDesktopTarget: () => undefined,
	onPromptChange: () => undefined,
	onOpenContextSheet: () => undefined,
	onReadLatestResponse: () => undefined,
	onRetryDesktopDevices: () => undefined,
	onSelectDesktopTarget: () => undefined,
	onStopSpeaking: () => undefined,
	onSubmit: (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
	},
	onToggleListening: () => undefined,
	prompt: '',
	selectedDesktopTargetConnectionId: null,
	showDeveloperControls: false,
	statusLabel: 'Hazır',
	submitButtonLabel: 'Gönder',
	voiceStatusMessage: null,
};

function Section(props: { children: ReactNode; label: string; testId: string }) {
	return (
		<section
			aria-label={props.label}
			data-testid={props.testId}
			style={{
				border: '1px solid color-mix(in srgb, var(--ink-1) 14%, transparent)',
				borderRadius: 12,
				display: 'grid',
				gap: 10,
				marginBottom: 14,
				padding: 12,
			}}
		>
			<h2
				style={{
					fontSize: 14,
					fontWeight: 600,
					margin: 0,
				}}
			>
				{props.label}
			</h2>
			{props.children}
		</section>
	);
}

function Fixture() {
	return (
		<main className="runa-page runa-page--chat-product">
			<div style={{ margin: '0 auto', maxWidth: 860, padding: 12 }}>
				<Section label="State 1 - No attachment" testId="state-no-attachment">
					<ChatComposerSurface
						{...baseProps}
						attachmentUploadError={null}
						attachments={[]}
						isUploadingAttachment={false}
					/>
				</Section>

				<Section
					label="State 2 - Image text document attachments"
					testId="state-attachments-rich"
				>
					<ChatComposerSurface
						{...baseProps}
						attachmentUploadError={null}
						attachments={[
							createImageAttachment(),
							createTextAttachment(),
							createDocumentAttachment(),
						]}
						isUploadingAttachment={false}
					/>
				</Section>

				<Section label="State 3 - Upload error" testId="state-upload-error">
					<ChatComposerSurface
						{...baseProps}
						attachmentUploadError="Dosya yüklenemedi. Yeniden seçip tekrar deneyebilirsin."
						attachments={[createImageAttachment(), createDocumentAttachment()]}
						isUploadingAttachment={false}
					/>
				</Section>

				<Section label="State 4 - Uploading" testId="state-uploading">
					<ChatComposerSurface
						{...baseProps}
						attachmentUploadError={null}
						attachments={[createTextAttachment()]}
						isUploadingAttachment={true}
					/>
				</Section>

				<Section label="State 5 - Long filename and text preview" testId="state-long-content">
					<ChatComposerSurface
						{...baseProps}
						attachmentUploadError={null}
						attachments={[
							createTextAttachment({
								filename:
									'bu-cok-uzun-bir-dosya-adi-ve-320-genislikte-bile-tasmadan-gozukmesi-gereken-ornek-notlar-metni.txt',
								text_content:
									'Uzun metin önizlemesi satır kırma ve kaydırma güvenliği için burada tekrar eder. '.repeat(
										8,
									),
							}),
						]}
						isUploadingAttachment={false}
					/>
				</Section>
			</div>
		</main>
	);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
	throw new Error('Fixture root element is missing.');
}

createRoot(rootElement).render(
	<StrictMode>
		<Fixture />
	</StrictMode>,
);
