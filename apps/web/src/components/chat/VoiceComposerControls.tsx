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
					aria-label={isSpeaking ? 'OkumayÄ± durdur' : 'Son yanÄ±tÄ± oku'}
					title={isSpeaking ? 'OkumayÄ± durdur' : 'Son yanÄ±tÄ± oku'}
					className={`runa-button runa-button--secondary ${styles['speakButton']}`}
				>
					{isSpeaking ? 'OkumayÄ± durdur' : 'Son yanÄ±tÄ± oku'}
				</button>
			</div>

			<div className={styles['status']} aria-live="polite">
				{voiceStatusMessage ?? (isVoiceSupported
						? 'Mikrofonu aÃ§Ä±p kÄ±sa bir not sÃ¶yleyebilir veya son yanÄ±tÄ± sesli okutabilirsin.'
						: 'Bu tarayÄ±cÄ± sesli giriÅŸi desteklemiyor. Sohbet yazÄ±lÄ± olarak devam eder.')}
			</div>
		</div>
	);
}

