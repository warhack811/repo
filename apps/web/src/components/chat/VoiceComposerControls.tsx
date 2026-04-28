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
					{isSpeaking ? 'Okumayi durdur' : 'Son yaniti oku'}
				</button>
			</div>

			<div className="runa-migrated-components-chat-voicecomposercontrols-5" aria-live="polite">
				{voiceStatusMessage ??
					(isVoiceSupported
						? 'Mikrofonu acip kisa bir not soyleyebilir veya son yaniti sesli okutabilirsin.'
						: 'Bu tarayici Web Speech API sunmuyor. Sohbet yazili modda aynen calismaya devam eder.')}
			</div>
		</div>
	);
}
