import type { ReactElement } from 'react';

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
		<div className="runa-migrated-components-chat-voicecomposercontrols-1">
			<div className="runa-migrated-components-chat-voicecomposercontrols-2">
				<button
					type="button"
					onClick={onToggleListening}
					disabled={!isVoiceSupported}
					className={[
						`runa-button runa-button--secondary${
							isListening ? ' runa-voice-button--listening' : ''
						}`,
						'runa-migrated-components-chat-voicecomposercontrols-3',
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
					className="runa-button runa-button--secondary runa-migrated-components-chat-voicecomposercontrols-4"
				>
					{isSpeaking ? 'Okumayı durdur' : 'Son yanıtı oku'}
				</button>
			</div>

			<div className="runa-migrated-components-chat-voicecomposercontrols-5" aria-live="polite">
				{voiceStatusMessage ??
					(isVoiceSupported
						? 'Mikrofonu açıp kısa bir not söyleyebilir veya son yanıtı sesli okutabilirsin.'
						: 'Bu tarayıcı sesli girişi desteklemiyor. Sohbet yazılı olarak devam eder.')}
			</div>
		</div>
	);
}
