import type { ReactElement } from 'react';

import styles from './VoiceComposerControls.module.css';

type VoiceComposerControlsProps = Readonly<{
	canReadLatestResponse: boolean;
	isListening: boolean;
	isSpeechPlaybackSupported: boolean;
	isSpeaking: boolean;
	isVoiceSupported: boolean;
	onReadLatestResponse: () => void;
	onStopSpeaking: () => void;
	onToggleListening: () => void;
	voiceStatusMessage: string | null;
}>;

export function VoiceComposerControls({
	canReadLatestResponse,
	isListening,
	isSpeechPlaybackSupported,
	isSpeaking,
	isVoiceSupported,
	onReadLatestResponse,
	onStopSpeaking,
	onToggleListening,
	voiceStatusMessage,
}: VoiceComposerControlsProps): ReactElement {
	return (
		<div className={styles['root']}>
			<div className={styles['buttons']}>
				<button
					type="button"
					onClick={onToggleListening}
					disabled={!isVoiceSupported}
					aria-label={isListening ? 'Dinlemeyi durdur' : 'Sesle yaz'}
					title={isListening ? 'Dinlemeyi durdur' : 'Sesle yaz'}
					className={[
						`runa-button runa-button--secondary${
							isListening ? ' runa-voice-button--listening' : ''
						}`,
						styles['toggleButton'],
					]
						.filter(Boolean)
						.join(' ')}
					aria-pressed={isListening}
				>
					{isListening ? 'Dinlemeyi durdur' : 'Sesle yaz'}
				</button>

				<button
					type="button"
					onClick={isSpeaking ? onStopSpeaking : onReadLatestResponse}
					disabled={!canReadLatestResponse || !isSpeechPlaybackSupported}
					aria-label={isSpeaking ? 'Okumayı durdur' : 'Son yanıtı oku'}
					title={isSpeaking ? 'Okumayı durdur' : 'Son yanıtı oku'}
					className={`runa-button runa-button--secondary ${styles['speakButton']}`}
				>
					{isSpeaking ? 'Okumayı durdur' : 'Son yanıtı oku'}
				</button>
			</div>

			<div className={styles['status']} aria-live="polite">
				{voiceStatusMessage ??
					(isVoiceSupported
						? 'Mikrofonu açıp kısa bir not söyleyebilir veya son yanıtı sesli okutabilirsin.'
						: 'Bu tarayıcı sesli girişi desteklemiyor. Sohbet yazılı olarak devam eder.')}
			</div>
		</div>
	);
}
