import { type ReactElement, StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

import '../../src/styles/index.css';
import { VoiceComposerControls } from '../../src/components/chat/VoiceComposerControls.js';

function Section({
	children,
	testId,
	label,
}: {
	children: ReactElement;
	testId: string;
	label: string;
}) {
	return (
		<div
			data-testid={testId}
			style={{
				border: '1px solid color-mix(in srgb, var(--ink-1) 14%, transparent)',
				borderRadius: 8,
				marginBottom: 16,
				padding: 16,
			}}
		>
			<div
				style={{
					fontSize: 12,
					fontWeight: 600,
					color: 'var(--ink-3)',
					marginBottom: 8,
					textTransform: 'uppercase',
					letterSpacing: '0.05em',
				}}
			>
				{label}
			</div>
			{children}
		</div>
	);
}

function Fixture() {
	const [listening, setListening] = useState(false);

	return (
		<main className="runa-page runa-page--chat-product">
			<div
				style={{
					maxWidth: 480,
					margin: '0 auto',
					padding: 16,
				}}
			>
				<Section
					testId="voice-state-idle"
					label="Idle / supported"
				>
					<VoiceComposerControls
						canReadLatestResponse={true}
						isListening={false}
						isSpeechPlaybackSupported={true}
						isSpeaking={false}
						isVoiceSupported={true}
						onReadLatestResponse={() => {}}
						onStopSpeaking={() => {}}
						onToggleListening={() => {}}
						voiceStatusMessage={null}
					/>
				</Section>

				<Section
					testId="voice-state-listening"
					label="Listening"
				>
					<VoiceComposerControls
						canReadLatestResponse={true}
						isListening={true}
						isSpeechPlaybackSupported={true}
						isSpeaking={false}
						isVoiceSupported={true}
						onReadLatestResponse={() => {}}
						onStopSpeaking={() => {}}
						onToggleListening={() => {
							setListening((v) => !v);
						}}
						voiceInputStatus="listening"
						voiceStatusMessage={null}
					/>
				</Section>

				<Section
					testId="voice-state-denied"
					label="Permission denied"
				>
					<VoiceComposerControls
						canReadLatestResponse={true}
						isListening={false}
						isSpeechPlaybackSupported={true}
						isSpeaking={false}
						isVoiceSupported={true}
						onReadLatestResponse={() => {}}
						onStopSpeaking={() => {}}
						onToggleListening={() => {}}
						permissionDenied={true}
						voiceInputStatus="denied"
						voiceStatusMessage={null}
					/>
				</Section>

				<Section
					testId="voice-state-unsupported"
					label="Unsupported"
				>
					<VoiceComposerControls
						canReadLatestResponse={true}
						isListening={false}
						isSpeechPlaybackSupported={true}
						isSpeaking={false}
						isVoiceSupported={false}
						onReadLatestResponse={() => {}}
						onStopSpeaking={() => {}}
						onToggleListening={() => {}}
						voiceInputStatus="unsupported"
						voiceStatusMessage={null}
					/>
				</Section>

				<Section
					testId="voice-state-speaking"
					label="Speaking / read active"
				>
					<VoiceComposerControls
						canReadLatestResponse={true}
						isListening={false}
						isSpeechPlaybackSupported={true}
						isSpeaking={true}
						isVoiceSupported={true}
						onReadLatestResponse={() => {}}
						onStopSpeaking={() => {}}
						onToggleListening={() => {}}
						voiceStatusMessage={null}
					/>
				</Section>

				<Section
					testId="voice-state-no-response"
					label="No latest response"
				>
					<VoiceComposerControls
						canReadLatestResponse={false}
						isListening={false}
						isSpeechPlaybackSupported={true}
						isSpeaking={false}
						isVoiceSupported={true}
						onReadLatestResponse={() => {}}
						onStopSpeaking={() => {}}
						onToggleListening={() => {}}
						voiceStatusMessage={null}
					/>
				</Section>
			</div>
		</main>
	);
}

const rootElement = document.getElementById('root');

if (!rootElement) {
	throw new Error('Fixture root element is missing.');
}

createRoot(rootElement).render(
	<StrictMode>
		<Fixture />
	</StrictMode>,
);
