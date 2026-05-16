import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ChatStore } from '../../stores/chat-store.js';
import { ChatComposerSurface } from './ChatComposerSurface.js';

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

function renderComposer(overrides: Record<string, unknown> = {}) {
	const defaultProps = {
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

	return render(<ChatComposerSurface {...(defaultProps as any)} />);
}

describe('ChatComposerSurface focus and notice', () => {
	it('renders composerPrepareNotice as aria-live output', () => {
		renderComposer({ composerPrepareNotice: "Mesaj düzenlemek için composer'a taşındı." });
		const output = screen.getByText("Mesaj düzenlemek için composer'a taşındı.");
		expect(output).toBeTruthy();
		expect(output.tagName).toBe('OUTPUT');
		expect(output.getAttribute('aria-live')).toBe('polite');
	});

	it('renders retry notice', () => {
		renderComposer({
			composerPrepareNotice: "Önceki istek tekrar denemek için composer'a taşındı.",
		});
		expect(screen.getByText("Önceki istek tekrar denemek için composer'a taşındı.")).toBeTruthy();
	});

	it('does not render notice when null', () => {
		const { container } = renderComposer({ composerPrepareNotice: null });
		const output = container.querySelector('output[aria-live="polite"]');
		expect(output).toBeNull();
	});

	it('does not contain forbidden technical strings', () => {
		const { container } = renderComposer({
			composerPrepareNotice: "Mesaj düzenlemek için composer'a taşındı.",
		});
		const body = container;
		const forbidden = ['message_id', 'run_id', 'trace_id', 'metadata', 'protocol', 'backend'];
		for (const term of forbidden) {
			expect(body.textContent).not.toContain(term);
		}
	});

	it('passes denied voice status to VoiceComposerControls', () => {
		const { container } = renderComposer({
			isVoiceSupported: true,
			voiceInputStatus: 'denied',
			voicePermissionDenied: true,
		});
		expect(container.textContent).toContain('Mikrofon izni kapalı');
	});

	it('passes unsupported voice status to VoiceComposerControls', () => {
		const { container } = renderComposer({
			isVoiceSupported: false,
			voiceInputStatus: 'unsupported',
		});
		expect(container.textContent).toContain('Bu tarayıcı sesle yazmayı desteklemiyor');
	});
});
