import { describe, expect, it } from 'vitest';

import { type VoiceComposerStateInput, deriveVoiceComposerState } from './voiceComposerState.js';

const idleInput: VoiceComposerStateInput = {
	canReadLatestResponse: true,
	isListening: false,
	isSpeechPlaybackSupported: true,
	isSpeaking: false,
	isVoiceSupported: true,
	permissionDenied: false,
	voiceInputStatus: 'idle',
	voiceStatusMessage: null,
};

describe('deriveVoiceComposerState', () => {
	it('idle state: input label and status', () => {
		const state = deriveVoiceComposerState(idleInput);

		expect(state.inputButtonLabel).toBe('Sesle yaz');
		expect(state.inputButtonAriaLabel).toBe('Sesle yaz');
		expect(state.inputButtonDisabled).toBe(false);
		expect(state.inputStatusText).toBe('Mikrofonu açıp kısa bir not söyleyebilirsin.');
		expect(state.inputStatusTone).toBe('default');
	});

	it('idle state: read label when not speaking and response available', () => {
		const state = deriveVoiceComposerState(idleInput);

		expect(state.readButtonLabel).toBe('Son yanıtı oku');
		expect(state.readButtonDisabled).toBe(false);
		expect(state.readStatusText).toBeNull();
	});

	it('listening state', () => {
		const state = deriveVoiceComposerState({
			...idleInput,
			isListening: true,
			voiceInputStatus: 'listening',
		});

		expect(state.inputButtonLabel).toBe('Dinlemeyi durdur');
		expect(state.inputButtonAriaLabel).toBe('Dinlemeyi durdur');
		expect(state.inputButtonDisabled).toBe(false);
		expect(state.inputStatusText).toBe('Dinliyorum. Bitirdiğinde durdurabilirsin.');
		expect(state.inputStatusTone).toBe('listening');
	});

	it('unsupported state: input disabled, user-friendly message', () => {
		const state = deriveVoiceComposerState({
			...idleInput,
			isVoiceSupported: false,
			voiceInputStatus: 'unsupported',
		});

		expect(state.inputButtonDisabled).toBe(true);
		expect(state.inputButtonLabel).toBe('Sesle yaz');
		expect(state.inputStatusText).toBe(
			'Bu tarayıcı sesle yazmayı desteklemiyor. Yazıyla devam edebilirsin.',
		);
		expect(state.inputStatusTone).toBe('unsupported');
	});

	it('unsupported via voiceInputStatus alone', () => {
		const state = deriveVoiceComposerState({
			...idleInput,
			isVoiceSupported: true,
			voiceInputStatus: 'unsupported',
		});

		expect(state.inputButtonDisabled).toBe(true);
		expect(state.inputStatusText).toContain('desteklemiyor');
		expect(state.inputStatusTone).toBe('unsupported');
	});

	it('denied state: permission recovery text, disabled input', () => {
		const state = deriveVoiceComposerState({
			...idleInput,
			permissionDenied: true,
			voiceInputStatus: 'denied',
		});

		expect(state.inputButtonDisabled).toBe(true);
		expect(state.inputStatusText).toBe(
			'Mikrofon izni kapalı. Tarayıcı izinlerinden açıp yeniden deneyebilirsin.',
		);
		expect(state.inputStatusTone).toBe('error');
	});

	it('denied via permissionDenied alone', () => {
		const state = deriveVoiceComposerState({
			...idleInput,
			isVoiceSupported: true,
			permissionDenied: true,
			voiceInputStatus: 'idle',
		});

		expect(state.inputButtonDisabled).toBe(true);
		expect(state.inputStatusText).toContain('Mikrofon izni');
		expect(state.inputStatusTone).toBe('error');
	});

	it('error state: uses voiceStatusMessage if provided', () => {
		const state = deriveVoiceComposerState({
			...idleInput,
			voiceInputStatus: 'error',
			voiceStatusMessage: 'Ses algılanmadı. Tekrar deneyebilirsin.',
		});

		expect(state.inputButtonDisabled).toBe(false);
		expect(state.inputStatusText).toBe('Ses algılanmadı. Tekrar deneyebilirsin.');
		expect(state.inputStatusTone).toBe('error');
	});

	it('error state: fallback message when no voiceStatusMessage', () => {
		const state = deriveVoiceComposerState({
			...idleInput,
			voiceInputStatus: 'error',
			voiceStatusMessage: null,
		});

		expect(state.inputButtonDisabled).toBe(false);
		expect(state.inputStatusText).toBe('Sesle yazma başlatılamadı. Tekrar deneyebilirsin.');
		expect(state.inputStatusTone).toBe('error');
	});

	it('TTS: no latest response → read disabled + helper text', () => {
		const state = deriveVoiceComposerState({
			...idleInput,
			canReadLatestResponse: false,
		});

		expect(state.readButtonDisabled).toBe(true);
		expect(state.readButtonLabel).toBe('Son yanıtı oku');
		expect(state.readStatusText).toBe('Son yanıt yoksa okuma kapalı kalır.');
	});

	it('TTS: unsupported speech playback → read disabled + helper text', () => {
		const state = deriveVoiceComposerState({
			...idleInput,
			isSpeechPlaybackSupported: false,
		});

		expect(state.readButtonDisabled).toBe(true);
		expect(state.readButtonLabel).toBe('Son yanıtı oku');
		expect(state.readStatusText).toBe('Bu tarayıcı sesli okumayı desteklemiyor.');
	});

	it('TTS: speaking → label Okumayı durdur', () => {
		const state = deriveVoiceComposerState({
			...idleInput,
			isSpeaking: true,
		});

		expect(state.readButtonLabel).toBe('Okumayı durdur');
		expect(state.readButtonAriaLabel).toBe('Okumayı durdur');
		expect(state.readButtonDisabled).toBe(false);
		expect(state.readStatusText).toBeNull();
	});

	it('forbidden technical strings are absent from output', () => {
		const inputs: VoiceComposerStateInput[] = [
			idleInput,
			{ ...idleInput, isListening: true, voiceInputStatus: 'listening' },
			{ ...idleInput, isVoiceSupported: false, voiceInputStatus: 'unsupported' },
			{ ...idleInput, permissionDenied: true, voiceInputStatus: 'denied' },
			{ ...idleInput, voiceInputStatus: 'error', voiceStatusMessage: 'test hatası' },
		];

		const forbidden = [
			'Web Speech API',
			'SpeechRecognition',
			'webkitSpeechRecognition',
			'runtime',
			'metadata',
			'protocol',
			'backend',
		];

		for (const input of inputs) {
			const state = deriveVoiceComposerState(input);
			const allText = [
				state.inputButtonLabel,
				state.inputButtonAriaLabel,
				state.inputStatusText,
				state.readButtonLabel,
				state.readButtonAriaLabel,
				state.readStatusText ?? '',
			].join(' ');

			for (const term of forbidden) {
				expect(
					allText,
					`forbidden term "${term}" in state for input ${JSON.stringify(input)}`,
				).not.toContain(term);
			}
		}
	});
});
