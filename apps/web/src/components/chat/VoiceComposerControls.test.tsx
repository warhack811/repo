import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { VoiceComposerControls } from './VoiceComposerControls.js';

function renderControls(overrides: Record<string, unknown> = {}) {
	const defaultProps = {
		canReadLatestResponse: true,
		isListening: false,
		isSpeechPlaybackSupported: true,
		isSpeaking: false,
		isVoiceSupported: true,
		onReadLatestResponse: vi.fn(),
		onStopSpeaking: vi.fn(),
		onToggleListening: vi.fn(),
		voiceStatusMessage: null,
		...overrides,
	};

	return render(<VoiceComposerControls {...defaultProps} />);
}

const forbiddenTechnical = [
	'Web Speech API',
	'SpeechRecognition',
	'webkitSpeechRecognition',
	'runtime',
	'metadata',
	'protocol',
	'backend',
];

const mojibakePatterns = ['\u00C3', '\u00C4', '\u00C5', '\u00E2\u20AC\u00A2', '\uFFFD'];

function assertNoForbiddenTerms(container: HTMLElement): void {
	const text = container.textContent ?? '';
	for (const term of forbiddenTechnical) {
		expect(text, `forbidden technical string: "${term}"`).not.toContain(term);
	}
	for (const pattern of mojibakePatterns) {
		expect(text, `mojibake pattern: "${pattern}"`).not.toContain(pattern);
	}
}

describe('VoiceComposerControls', () => {
	it('idle supported state: shows Sesle yaz and Son yanıtı oku', () => {
		const { container } = renderControls();
		expect(screen.getByText('Sesle yaz')).toBeTruthy();
		expect(screen.getByText('Son yanıtı oku')).toBeTruthy();
		expect(screen.getByText('Mikrofonu açıp kısa bir not söyleyebilirsin.')).toBeTruthy();
		assertNoForbiddenTerms(container);
	});

	it('listening: shows Dinlemeyi durdur and aria-pressed', () => {
		const { container } = renderControls({
			isListening: true,
			voiceInputStatus: 'listening',
		});
		const button = screen.getByText('Dinlemeyi durdur');
		expect(button).toBeTruthy();
		expect(button.getAttribute('aria-pressed')).toBe('true');
		expect(screen.getByText('Dinliyorum. Bitirdiğinde durdurabilirsin.')).toBeTruthy();
		assertNoForbiddenTerms(container);
	});

	it('denied: shows permission recovery text without technical strings', () => {
		const { container } = renderControls({
			permissionDenied: true,
			voiceInputStatus: 'denied',
		});
		expect(
			screen.getByText('Mikrofon izni kapalı. Tarayıcı izinlerinden açıp yeniden deneyebilirsin.'),
		).toBeTruthy();
		assertNoForbiddenTerms(container);
	});

	it('denied: input button disabled', () => {
		renderControls({
			permissionDenied: true,
			voiceInputStatus: 'denied',
		});
		const button = screen.getByText('Sesle yaz');
		expect(button).toBeTruthy();
		expect((button as HTMLButtonElement).disabled).toBe(true);
	});

	it('unsupported: input disabled and written fallback text', () => {
		const { container } = renderControls({
			isVoiceSupported: false,
			voiceInputStatus: 'unsupported',
		});
		const button = screen.getByText('Sesle yaz');
		expect((button as HTMLButtonElement).disabled).toBe(true);
		expect(
			screen.getByText('Bu tarayıcı sesle yazmayı desteklemiyor. Yazıyla devam edebilirsin.'),
		).toBeTruthy();
		assertNoForbiddenTerms(container);
	});

	it('TTS speaking: shows Okumayı durdur', () => {
		const { container } = renderControls({ isSpeaking: true });
		expect(screen.getByText('Okumayı durdur')).toBeTruthy();
		assertNoForbiddenTerms(container);
	});

	it('no latest response: read disabled with helper text', () => {
		const { container } = renderControls({
			canReadLatestResponse: false,
		});
		const button = screen.getByText('Son yanıtı oku');
		expect((button as HTMLButtonElement).disabled).toBe(true);
		expect(screen.getByText('Son yanıt yoksa okuma kapalı kalır.')).toBeTruthy();
		assertNoForbiddenTerms(container);
	});

	it('clicking input button calls onToggleListening', () => {
		const onToggleListening = vi.fn();
		renderControls({ onToggleListening });
		screen.getByText('Sesle yaz').click();
		expect(onToggleListening).toHaveBeenCalledTimes(1);
	});

	it('clicking read button when not speaking calls onReadLatestResponse', () => {
		const onReadLatestResponse = vi.fn();
		renderControls({ onReadLatestResponse });
		screen.getByText('Son yanıtı oku').click();
		expect(onReadLatestResponse).toHaveBeenCalledTimes(1);
	});

	it('clicking read button while speaking calls onStopSpeaking', () => {
		const onStopSpeaking = vi.fn();
		renderControls({ isSpeaking: true, onStopSpeaking });
		screen.getByText('Okumayı durdur').click();
		expect(onStopSpeaking).toHaveBeenCalledTimes(1);
	});
});
