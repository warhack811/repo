import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ChatStore } from '../../stores/chat-store.js';
import type { ModelAttachment } from '../../ws-types.js';
import { ChatComposerSurface } from './ChatComposerSurface.js';

type ComposerProps = ComponentProps<typeof ChatComposerSurface>;

function createMockStore(): ChatStore {
	return {
		getState: () => ({
			presentation: {
				currentStreamingRunId: null,
				currentStreamingText: '',
			},
		}),
		setConnectionState: vi.fn(),
		setPresentationState: vi.fn(),
		setTransportState: vi.fn(),
		setRuntimeConfigState: vi.fn(),
		subscribe: vi.fn(),
	} as unknown as ChatStore;
}

function createImageAttachment(overrides: Partial<ModelAttachment> = {}): ModelAttachment {
	return {
		blob_id: 'blob-image-1',
		data_url: 'data:image/png;base64,ZmFrZQ==',
		filename: 'ekran.png',
		kind: 'image',
		media_type: 'image/png',
		size_bytes: 1_572_864,
		...overrides,
	} as ModelAttachment;
}

function createTextAttachment(overrides: Partial<ModelAttachment> = {}): ModelAttachment {
	return {
		blob_id: 'blob-text-1',
		filename: 'notlar.txt',
		kind: 'text',
		media_type: 'text/plain',
		size_bytes: 5_120,
		text_content: 'Özet notlar burada.',
		...overrides,
	} as ModelAttachment;
}

function createDocumentAttachment(overrides: Partial<ModelAttachment> = {}): ModelAttachment {
	return {
		blob_id: 'blob-doc-1',
		filename: 'rapor.pdf',
		kind: 'document',
		media_type: 'application/pdf',
		size_bytes: 1_048_576,
		storage_ref: 'storage-ref',
		text_preview: 'Doküman özeti.',
		...overrides,
	} as ModelAttachment;
}

function createComposerProps(overrides: Partial<ComposerProps> = {}): ComposerProps {
	return {
		accessToken: null,
		apiKey: 'test-key',
		attachmentUploadError: null,
		attachments: [],
		canReadLatestResponse: false,
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
		isUploadingAttachment: false,
		isVoiceSupported: false,
		voiceInputStatus: 'idle',
		voicePermissionDenied: false,
		lastError: null,
		store: createMockStore(),
		onAttachmentUploadStateChange: vi.fn(),
		onAttachmentsChange: vi.fn(),
		onAbortRun: vi.fn(),
		onClearDesktopTarget: vi.fn(),
		onPromptChange: vi.fn(),
		onOpenContextSheet: vi.fn(),
		onReadLatestResponse: vi.fn(),
		onRetryDesktopDevices: vi.fn(),
		onSelectDesktopTarget: vi.fn(),
		onStopSpeaking: vi.fn(),
		onSubmit: vi.fn(),
		onToggleListening: vi.fn(),
		prompt: '',
		selectedDesktopTargetConnectionId: null,
		showDeveloperControls: false,
		statusLabel: 'Hazır',
		submitButtonLabel: 'Gönder',
		voiceStatusMessage: null,
		...overrides,
	};
}

function renderComposer(overrides: Partial<ComposerProps> = {}) {
	return render(<ChatComposerSurface {...createComposerProps(overrides)} />);
}

function createUploadFile(): File {
	const file = new File(['icerik'], 'tekrar.txt', { type: 'text/plain' });
	Object.defineProperty(file, 'arrayBuffer', {
		configurable: true,
		value: vi.fn(async () => new Uint8Array([104, 101, 108, 108, 111]).buffer),
	});
	return file;
}

describe('ChatComposerSurface', () => {
	it('renders composerPrepareNotice as aria-live output', () => {
		renderComposer({ composerPrepareNotice: "Mesaj düzenlemek için composer'a taşındı." });
		const output = screen.getByText("Mesaj düzenlemek için composer'a taşındı.");
		expect(output.tagName).toBe('OUTPUT');
		expect(output.getAttribute('aria-live')).toBe('polite');
	});

	it('passes denied and unsupported voice status to controls', () => {
		renderComposer({
			isVoiceSupported: true,
			voiceInputStatus: 'denied',
			voicePermissionDenied: true,
		});
		expect(screen.getByText(/Mikrofon izni kapalı/)).toBeTruthy();

		renderComposer({
			isVoiceSupported: false,
			voiceInputStatus: 'unsupported',
		});
		expect(screen.getByText(/Bu tarayıcı sesle yazmayı desteklemiyor/)).toBeTruthy();
	});

	it('renders attachment summaries in Turkish and hides english bytes wording', () => {
		const { container } = renderComposer({
			attachments: [createImageAttachment(), createTextAttachment(), createDocumentAttachment()],
		});
		const text = container.textContent ?? '';
		expect(text).toContain('Görsel');
		expect(text).toContain('Metin');
		expect(text).toContain('Doküman');
		expect(text).not.toContain('working files');
		expect(text).not.toContain(' bytes');
	});

	it('renders context chip as Turkish ek count', () => {
		renderComposer({ attachments: [createImageAttachment()] });
		expect(screen.getByText('1 ek')).toBeTruthy();

		renderComposer({ attachments: [createImageAttachment(), createDocumentAttachment()] });
		expect(screen.getByText('2 ek')).toBeTruthy();
		expect(screen.queryByText('working files')).toBeNull();
	});

	it('shows upload error alert with Tekrar seç action', () => {
		renderComposer({
			attachmentUploadError: 'Dosya yüklenemedi. Yeniden seçip tekrar deneyebilirsin.',
		});
		expect(
			screen.getByText('Dosya yüklenemedi. Yeniden seçip tekrar deneyebilirsin.'),
		).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Tekrar seç' })).toBeTruthy();
	});

	it('routes retry upload through FileUploadButton callbacks', async () => {
		const onAttachmentUploadStateChange = vi.fn();
		const onAttachmentsChange = vi.fn();
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							attachment: {
								blob_id: 'retry-blob-1',
								filename: 'tekrar.txt',
								kind: 'text',
								media_type: 'text/plain',
								size_bytes: 2048,
								text_content: 'yeniden',
							},
						}),
						{ headers: { 'content-type': 'application/json' }, status: 200 },
					),
			),
		);

		const { container } = renderComposer({
			attachmentUploadError: 'Dosya yüklenemedi. Yeniden seçip tekrar deneyebilirsin.',
			attachments: [createDocumentAttachment()],
			onAttachmentUploadStateChange,
			onAttachmentsChange,
		});

		const inputs = container.querySelectorAll('input[type="file"]');
		const retryInput = inputs.item(1);
		if (!(retryInput instanceof HTMLInputElement)) {
			throw new Error('Retry file input not found.');
		}
		fireEvent.change(retryInput, { target: { files: [createUploadFile()] } });

		await waitFor(() => {
			expect(onAttachmentsChange).toHaveBeenCalled();
		});
		expect(onAttachmentUploadStateChange).toHaveBeenLastCalledWith({
			error: null,
			isUploading: false,
		});
	});

	it('removes attachment through callback and keeps blob id hidden', () => {
		const onAttachmentsChange = vi.fn();
		renderComposer({
			attachments: [createTextAttachment({ filename: undefined, blob_id: 'secret-blob-77' })],
			onAttachmentsChange,
		});

		expect(screen.getByText('Adsız ek')).toBeTruthy();
		expect(screen.queryByText('secret-blob-77')).toBeNull();
		const removeButton = screen.getByRole('button', { name: 'Eki kaldır: Adsız ek' });
		fireEvent.click(removeButton);
		expect(onAttachmentsChange).toHaveBeenCalledWith([]);
	});

	it('does not contain forbidden technical strings in normal surface', () => {
		const { container } = renderComposer({
			attachments: [createImageAttachment()],
		});
		const text = container.textContent ?? '';
		for (const forbidden of ['blob_id', 'kind', 'size_bytes', 'bytes', 'working files']) {
			expect(text).not.toContain(forbidden);
		}
	});
});
