import { useEffect, useRef, useState } from 'react';

interface SpeechRecognitionAlternativeLike {
	readonly transcript: string;
}

interface SpeechRecognitionResultLike {
	readonly isFinal: boolean;
	readonly length: number;
	[index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
	readonly length: number;
	item(index: number): SpeechRecognitionResultLike | null;
	[index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
	readonly resultIndex: number;
	readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
	readonly error:
		| 'aborted'
		| 'audio-capture'
		| 'language-not-supported'
		| 'network'
		| 'not-allowed'
		| 'no-speech'
		| 'service-not-allowed'
		| 'unknown';
}

interface SpeechRecognitionLike extends EventTarget {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	maxAlternatives: number;
	onend: ((event: Event) => void) | null;
	onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
	onresult: ((event: SpeechRecognitionEventLike) => void) | null;
	start(): void;
	stop(): void;
	abort(): void;
}

interface SpeechRecognitionConstructorLike {
	new (): SpeechRecognitionLike;
}

declare global {
	interface Window {
		SpeechRecognition?: SpeechRecognitionConstructorLike;
		webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
	}
}

export interface UseVoiceInputOptions {
	readonly onFinalTranscript?: (transcript: string) => void;
}

export interface UseVoiceInputResult {
	readonly errorMessage: string | null;
	readonly isListening: boolean;
	readonly isSupported: boolean;
	readonly permissionDenied: boolean;
	readonly status: 'denied' | 'error' | 'idle' | 'listening' | 'unsupported';
	startListening: () => void;
	stopListening: () => void;
	toggleListening: () => void;
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructorLike | null {
	if (typeof window === 'undefined') {
		return null;
	}

	return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function getVoiceInputErrorMessage(
	error:
		| 'aborted'
		| 'audio-capture'
		| 'language-not-supported'
		| 'network'
		| 'not-allowed'
		| 'no-speech'
		| 'service-not-allowed'
		| 'unknown',
): string {
	switch (error) {
		case 'audio-capture':
			return 'Mikrofon kullanılabilir değil. Cihaz bağlantısını ve tarayıcı izinlerini kontrol et.';
		case 'language-not-supported':
			return 'Tarayıcı seçilen dilde ses tanımayı desteklemiyor.';
		case 'network':
			return 'Ses tanıma isteği sırasında bağlantı sorunu oluştu.';
		case 'no-speech':
			return 'Ses algılanmadı. Tekrar deneyebilirsin.';
		case 'not-allowed':
		case 'service-not-allowed':
			return 'Mikrofon izni reddedildi. Ses girişi kullanmak istersen tarayıcı iznini açman gerekiyor.';
		case 'aborted':
			return 'Ses dinleme durduruldu.';
		default:
			return 'Ses girişi başlatılamadı. Tarayıcının Web Speech API desteğini kontrol et.';
	}
}

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputResult {
	const { onFinalTranscript } = options;
	const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
	const onFinalTranscriptRef = useRef(onFinalTranscript);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isListening, setIsListening] = useState(false);
	const [permissionDenied, setPermissionDenied] = useState(false);
	const [status, setStatus] = useState<UseVoiceInputResult['status']>(() =>
		getSpeechRecognitionConstructor() ? 'idle' : 'unsupported',
	);
	const isSupported = getSpeechRecognitionConstructor() !== null;

	useEffect(() => {
		onFinalTranscriptRef.current = onFinalTranscript;
	}, [onFinalTranscript]);

	useEffect(() => {
		const SpeechRecognitionConstructor = getSpeechRecognitionConstructor();

		if (SpeechRecognitionConstructor === null) {
			setStatus('unsupported');
			return undefined;
		}

		const recognition = new SpeechRecognitionConstructor();

		recognition.continuous = false;
		recognition.interimResults = true;
		recognition.lang = 'tr-TR';
		recognition.maxAlternatives = 1;
		recognition.onresult = (event) => {
			let finalTranscript = '';

			for (let index = event.resultIndex; index < event.results.length; index += 1) {
				const result = event.results[index];

				if (result?.isFinal === true) {
					finalTranscript += result[0]?.transcript ?? '';
				}
			}

			const normalizedTranscript = finalTranscript.trim();

			if (normalizedTranscript.length > 0) {
				setErrorMessage(null);
				setPermissionDenied(false);
				onFinalTranscriptRef.current?.(normalizedTranscript);
			}
		};
		recognition.onerror = (event) => {
			const nextErrorMessage = getVoiceInputErrorMessage(event.error);

			setIsListening(false);
			setErrorMessage(nextErrorMessage);
			setPermissionDenied(event.error === 'not-allowed' || event.error === 'service-not-allowed');
			setStatus(
				event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'denied' : 'error',
			);
		};
		recognition.onend = () => {
			setIsListening(false);
			setStatus((currentStatus) => (currentStatus === 'listening' ? 'idle' : currentStatus));
		};
		recognitionRef.current = recognition;

		return () => {
			recognition.onend = null;
			recognition.onerror = null;
			recognition.onresult = null;
			recognition.abort();
			recognitionRef.current = null;
		};
	}, []);

	function startListening(): void {
		if (!isSupported || recognitionRef.current === null) {
			setStatus('unsupported');
			setErrorMessage('Bu tarayıcı ses girişini desteklemiyor.');
			return;
		}

		try {
			setErrorMessage(null);
			setStatus('listening');
			recognitionRef.current.start();
			setIsListening(true);
		} catch (error: unknown) {
			setIsListening(false);
			setStatus(permissionDenied ? 'denied' : 'error');
			setErrorMessage(
				error instanceof Error
					? error.message
					: 'Ses girişi başlatılırken beklenmeyen bir hata oluştu.',
			);
		}
	}

	function stopListening(): void {
		recognitionRef.current?.stop();
		setIsListening(false);
		setStatus((currentStatus) => (currentStatus === 'listening' ? 'idle' : currentStatus));
	}

	function toggleListening(): void {
		if (isListening) {
			stopListening();
			return;
		}

		startListening();
	}

	return {
		errorMessage,
		isListening,
		isSupported,
		permissionDenied,
		startListening,
		status,
		stopListening,
		toggleListening,
	};
}
