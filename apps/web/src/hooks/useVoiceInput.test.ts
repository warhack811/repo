import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getVoiceInputErrorMessage, useVoiceInput } from './useVoiceInput.js';

function createMockRecognition() {
	return {
		abort: vi.fn(),
		continuous: false,
		interimResults: false,
		lang: '',
		maxAlternatives: 1,
		onend: null as ((event: Event) => void) | null,
		onerror: null as ((event: SpeechRecognitionErrorEvent) => void) | null,
		onresult: null as ((event: SpeechRecognitionEvent) => void) | null,
		start: vi.fn(),
		stop: vi.fn(),
	};
}

type MockRecognition = ReturnType<typeof createMockRecognition>;

function setMockSpeechRecognition(mock: MockRecognition): void {
	class MockSpeechRecognitionCtor {
		constructor() {
			return mock;
		}
	}
	(window as any).SpeechRecognition = MockSpeechRecognitionCtor;
}

function clearMockSpeechRecognition(): void {
	(window as any).SpeechRecognition = undefined;
}

describe('getVoiceInputErrorMessage', () => {
	it('returns user-friendly messages without technical terms', () => {
		const result = getVoiceInputErrorMessage('not-allowed');
		expect(result).toContain('Mikrofon');
		expect(result).not.toContain('SpeechRecognition');
		expect(result).not.toContain('webkitSpeechRecognition');
		expect(result).not.toContain('Web Speech API');
	});

	it('returns fallback for unknown error code', () => {
		const result = getVoiceInputErrorMessage('unknown');
		expect(result).toBe(
			'Ses girişi başlatılamadı. Tarayıcının ses desteğini kontrol et.',
		);
	});
});

describe('useVoiceInput', () => {
	let mockRecognition: MockRecognition;

	beforeEach(() => {
		mockRecognition = createMockRecognition();
		setMockSpeechRecognition(mockRecognition);
	});

	afterEach(() => {
		clearMockSpeechRecognition();
	});

	it('isSupported true when SpeechRecognition exists', () => {
		const { result } = renderHook(() => useVoiceInput());
		expect(result.current.isSupported).toBe(true);
		expect(result.current.status).toBe('idle');
	});

	it('isSupported false when SpeechRecognition is missing', () => {
		clearMockSpeechRecognition();
		const { result } = renderHook(() => useVoiceInput());
		expect(result.current.isSupported).toBe(false);
		expect(result.current.status).toBe('unsupported');
	});

	it('startListening sets isListening and status listening', () => {
		const { result } = renderHook(() => useVoiceInput());

		act(() => {
			result.current.startListening();
		});

		expect(mockRecognition.start).toHaveBeenCalledTimes(1);
		expect(result.current.isListening).toBe(true);
		expect(result.current.status).toBe('listening');
	});

	it('startListening when unsupported sets error without technical terms', () => {
		clearMockSpeechRecognition();
		const { result } = renderHook(() => useVoiceInput());

		act(() => {
			result.current.startListening();
		});

		expect(result.current.status).toBe('unsupported');
		expect(result.current.errorMessage).toBe(
			'Bu tarayıcı ses girişini desteklemiyor.',
		);
		expect(result.current.errorMessage).not.toContain('SpeechRecognition');
	});

	it('onerror not-allowed sets permissionDenied and denied status', () => {
		const { result } = renderHook(() => useVoiceInput());

		act(() => {
			result.current.startListening();
			mockRecognition.onerror?.({
				error: 'not-allowed',
				message: 'User denied',
			} as SpeechRecognitionErrorEvent);
		});

		expect(result.current.permissionDenied).toBe(true);
		expect(result.current.status).toBe('denied');
		expect(result.current.errorMessage).toContain('Mikrofon');
	});

	it('onerror no-speech sets error status with retry-friendly message', () => {
		const { result } = renderHook(() => useVoiceInput());

		act(() => {
			result.current.startListening();
			mockRecognition.onerror?.({
				error: 'no-speech',
				message: 'No speech detected',
			} as SpeechRecognitionErrorEvent);
		});

		expect(result.current.status).toBe('error');
		expect(result.current.errorMessage).toBe(
			'Ses algılanmadı. Tekrar deneyebilirsin.',
		);
	});

	it('onresult with final transcript calls onFinalTranscript with trimmed text', () => {
		const onFinalTranscript = vi.fn();
		const { result } = renderHook(() => useVoiceInput({ onFinalTranscript }));

		act(() => {
			result.current.startListening();
			mockRecognition.onresult?.({
				resultIndex: 0,
				results: [
					{
						isFinal: true,
						length: 1,
						[0]: { transcript: ' merhaba ', confidence: 0.9 },
					},
				],
			} as unknown as SpeechRecognitionEvent);
		});

		expect(onFinalTranscript).toHaveBeenCalledWith('merhaba');
	});

	it('onresult with empty transcript does not call callback', () => {
		const onFinalTranscript = vi.fn();

		act(() => {
			renderHook(() => useVoiceInput({ onFinalTranscript }));
		});

		const recognition = mockRecognition;

		act(() => {
			recognition.onresult?.({
				resultIndex: 0,
				results: [
					{
						isFinal: true,
						length: 1,
						[0]: { transcript: '   ', confidence: 0.5 },
					},
				],
			} as unknown as SpeechRecognitionEvent);
		});

		expect(onFinalTranscript).not.toHaveBeenCalled();
	});

	it('cleanup calls abort and nullifies handlers', () => {
		const { unmount } = renderHook(() => useVoiceInput());

		unmount();

		expect(mockRecognition.abort).toHaveBeenCalled();
		expect(mockRecognition.onend).toBeNull();
		expect(mockRecognition.onerror).toBeNull();
		expect(mockRecognition.onresult).toBeNull();
	});

	it('toggleListening stops when already listening', () => {
		const { result } = renderHook(() => useVoiceInput());

		act(() => {
			result.current.startListening();
		});

		expect(result.current.isListening).toBe(true);

		act(() => {
			result.current.toggleListening();
		});

		expect(mockRecognition.stop).toHaveBeenCalled();
		expect(result.current.isListening).toBe(false);
	});
});
