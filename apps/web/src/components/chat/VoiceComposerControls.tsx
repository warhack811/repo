import type { CSSProperties, ReactElement } from 'react';

const controlRowStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: '10px',
	flexWrap: 'wrap',
};

const secondaryButtonStyle: CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	gap: '8px',
	padding: '10px 14px',
	borderRadius: '14px',
	border: '1px solid rgba(148, 163, 184, 0.22)',
	background: 'rgba(10, 15, 27, 0.86)',
	color: '#e5e7eb',
	fontWeight: 600,
	cursor: 'pointer',
	transition: 'transform 180ms ease, border-color 180ms ease, background 180ms ease',
};

const noteStyle: CSSProperties = {
	fontSize: '13px',
	lineHeight: 1.5,
	color: '#94a3b8',
};

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
		<div style={{ display: 'grid', gap: '10px' }}>
			<div style={controlRowStyle}>
				<button
					type="button"
					onClick={onToggleListening}
					disabled={!isVoiceSupported}
					style={{
						...secondaryButtonStyle,
						borderColor: isListening ? 'rgba(245, 158, 11, 0.42)' : 'rgba(148, 163, 184, 0.22)',
						background: isListening ? 'rgba(120, 53, 15, 0.32)' : secondaryButtonStyle.background,
						opacity: isVoiceSupported ? 1 : 0.6,
					}}
					className="runa-button runa-button--secondary"
					aria-pressed={isListening}
				>
					<span aria-hidden="true">{isListening ? '●' : '○'}</span>
					{isListening ? 'Dinlemeyi durdur' : 'Sesle yaz'}
				</button>

				<button
					type="button"
					onClick={isSpeaking ? onStopSpeaking : onReadLatestResponse}
					disabled={!canReadLatestResponse || !isSpeechPlaybackSupported}
					style={{
						...secondaryButtonStyle,
						opacity: canReadLatestResponse && isSpeechPlaybackSupported ? 1 : 0.6,
					}}
					className="runa-button runa-button--secondary"
				>
					{isSpeaking ? 'Okumayi durdur' : 'Son yaniti oku'}
				</button>
			</div>

			<div style={noteStyle} aria-live="polite">
				{voiceStatusMessage ??
					(isVoiceSupported
						? 'Mikrofonu açıp kısa bir not söyleyebilir veya son asistan yanıtını sesli okutabilirsin.'
						: 'Bu tarayici Web Speech API sunmuyor. Sohbet yazili modda aynen calismaya devam eder.')}
			</div>
		</div>
	);
}
