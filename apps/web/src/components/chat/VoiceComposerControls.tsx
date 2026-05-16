import type { ReactElement } from 'react';

import styles from './VoiceComposerControls.module.css';
import { type VoiceInputStatus, deriveVoiceComposerState } from './voiceComposerState.js';

type VoiceComposerControlsProps = Readonly<{
	canReadLatestResponse: boolean;
	isListening: boolean;
	isSpeechPlaybackSupported: boolean;
	isSpeaking: boolean;
	isVoiceSupported: boolean;
	onReadLatestResponse: () => void;
	onStopSpeaking: () => void;
	onToggleListening: () => void;
	permissionDenied?: boolean;
	voiceInputStatus?: VoiceInputStatus;
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
	permissionDenied = false,
	voiceInputStatus,
	voiceStatusMessage,
}: VoiceComposerControlsProps): ReactElement {
	const state = deriveVoiceComposerState({
		canReadLatestResponse,
		isListening,
		isSpeechPlaybackSupported,
		isSpeaking,
		isVoiceSupported,
		permissionDenied,
		voiceInputStatus,
		voiceStatusMessage,
	});

	return (
		<div className={styles['root']}>
			<div className={styles['buttons']}>
				<button
					type="button"
					onClick={onToggleListening}
					disabled={state.inputButtonDisabled}
					aria-label={state.inputButtonAriaLabel}
					title={state.inputButtonLabel}
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
					{state.inputButtonLabel}
				</button>

				<button
					type="button"
					onClick={isSpeaking ? onStopSpeaking : onReadLatestResponse}
					disabled={state.readButtonDisabled}
					aria-label={state.readButtonAriaLabel}
					title={state.readButtonLabel}
					className={`runa-button runa-button--secondary ${styles['speakButton']}`}
				>
					{state.readButtonLabel}
				</button>
			</div>

			<div className={styles['status']} aria-live="polite">
				<span className={styles['statusText']}>{state.inputStatusText}</span>
				{state.readStatusText ? (
					<span className={styles['readStatusLine']}>{state.readStatusText}</span>
				) : null}
			</div>
		</div>
	);
}
