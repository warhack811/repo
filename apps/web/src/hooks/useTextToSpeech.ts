import { useEffect, useState } from 'react';

export const RUNA_AUTO_READ_STORAGE_KEY = 'runa.voice.auto_read_enabled';

export interface UseTextToSpeechResult {
	readonly autoReadEnabled: boolean;
	readonly errorMessage: string | null;
	readonly isSpeaking: boolean;
	readonly isSupported: boolean;
	cancel: () => void;
	setAutoReadEnabled: (value: boolean) => void;
	speak: (text: string) => void;
}

function resolveStorage(): Storage | null {
	if (typeof window === 'undefined') {
		return null;
	}

	return window.localStorage;
}

function readStoredAutoReadPreference(): boolean {
	const storage = resolveStorage();

	if (storage === null) {
		return false;
	}

	try {
		return storage.getItem(RUNA_AUTO_READ_STORAGE_KEY) === 'true';
	} catch {
		return false;
	}
}

function persistAutoReadPreference(value: boolean): void {
	const storage = resolveStorage();

	if (storage === null) {
		return;
	}

	storage.setItem(RUNA_AUTO_READ_STORAGE_KEY, String(value));
}

export function useTextToSpeech(): UseTextToSpeechResult {
	const isSupported =
		typeof window !== 'undefined' &&
		typeof window.speechSynthesis !== 'undefined' &&
		typeof window.SpeechSynthesisUtterance !== 'undefined';
	const [autoReadEnabled, setAutoReadEnabledState] = useState(readStoredAutoReadPreference);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isSpeaking, setIsSpeaking] = useState(false);

	useEffect(() => {
		if (!isSupported) {
			setErrorMessage('Bu tarayıcı sesli okuma desteği sunmuyor.');
			return;
		}

		return () => {
			window.speechSynthesis.cancel();
		};
	}, [isSupported]);

	function setAutoReadEnabled(value: boolean): void {
		setAutoReadEnabledState(value);
		persistAutoReadPreference(value);
	}

	function cancel(): void {
		if (!isSupported) {
			return;
		}

		window.speechSynthesis.cancel();
		setIsSpeaking(false);
	}

	function speak(text: string): void {
		if (!isSupported) {
			setErrorMessage('Bu tarayıcı sesli okuma desteği sunmuyor.');
			return;
		}

		const normalizedText = text.trim();

		if (normalizedText.length === 0) {
			return;
		}

		window.speechSynthesis.cancel();

		const utterance = new SpeechSynthesisUtterance(normalizedText);

		utterance.lang = 'tr-TR';
		utterance.rate = 1;
		utterance.onstart = () => {
			setErrorMessage(null);
			setIsSpeaking(true);
		};
		utterance.onend = () => {
			setIsSpeaking(false);
		};
		utterance.onerror = () => {
			setIsSpeaking(false);
			setErrorMessage(
				'Sesli okuma başlatılamadı. Tarayıcı izinlerini veya cihaz ses ayarlarını kontrol et.',
			);
		};
		window.speechSynthesis.speak(utterance);
	}

	return {
		autoReadEnabled,
		cancel,
		errorMessage,
		isSpeaking,
		isSupported,
		setAutoReadEnabled,
		speak,
	};
}
