import { useEffect, useRef, useState } from 'react';

type VoiceInputErrorCode =
	| SpeechRecognitionErrorEvent['error']
	| 'language-not-supported'
	| 'unknown';

interface BrowserSpeechRecognition extends EventTarget {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	maxAlternatives: number;
	onend: ((event: Event) => void) | null;
	onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
	onresult: ((event: SpeechRecognitionEvent) => void) | null;
	abort(): void;
	start(): void;
	stop(): void;
}

interface BrowserSpeechRecognitionConstructor {
	new (): BrowserSpeechRecognition;
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

function getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
	if (typeof window === 'undefined') {
		return null;
	}

	const SpeechRecognitionConstructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;

	return (SpeechRecognitionConstructor as BrowserSpeechRecognitionConstructor | undefined) ?? null;
}

function getVoiceInputErrorMessage(error: VoiceInputErrorCode): string {
	switch (error) {
		case 'audio-capture':
			return 'Mikrofon kullanÄ±labilir deÄŸil. Cihaz baÄŸlantÄ±sÄ±nÄ± ve tarayÄ±cÄ± izinlerini kontrol et.';
		case 'language-not-supported':
			return 'TarayÄ±cÄ± seÃ§ilen dilde ses tanÄ±mayÄ± desteklemiyor.';
		case 'network':
			return 'Ses tanÄ±ma isteÄŸi sÄ±rasÄ±nda baÄŸlantÄ± sorunu oluÅŸtu.';
		case 'no-speech':
			return 'Ses algÄ±lanmadÄ±. Tekrar deneyebilirsin.';
		case 'not-allowed':
		case 'service-not-allowed':
			return 'Mikrofon izni reddedildi. Ses giriÅŸi kullanmak istersen tarayÄ±cÄ± iznini aÃ§man gerekiyor.';
		case 'aborted':
			return 'Ses dinleme durduruldu.';
		default:
			return 'Ses giriÅŸi baÅŸlatÄ±lamadÄ±. TarayÄ±cÄ±nÄ±n ses desteÄŸini kontrol et.';
	}
}

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputResult {
	const { onFinalTranscript } = options;
	const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
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
			setErrorMessage('Bu tarayÄ±cÄ± ses giriÅŸini desteklemiyor.');
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
					: 'Ses giriÅŸi baÅŸlatÄ±lÄ±rken beklenmeyen bir hata oluÅŸtu.',
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
