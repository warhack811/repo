import type { CSSProperties, ReactElement } from 'react';

import type { AuthContext } from '@runa/types';

import {
	appShellButtonRowStyle,
	appShellMutedTextStyle,
	appShellPanelStyle,
	appShellSecondaryButtonStyle,
	appShellSecondaryLabelStyle,
} from '../components/app/AppShell.js';
import { ProfileCard } from '../components/auth/ProfileCard.js';
import { SessionCard } from '../components/auth/SessionCard.js';
import { useTextToSpeech } from '../hooks/useTextToSpeech.js';
import { useVoiceInput } from '../hooks/useVoiceInput.js';
import { pillStyle } from '../lib/chat-styles.js';
import { uiCopy } from '../localization/copy.js';

const sectionGridStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
	gap: '20px',
};

const heroMetricRowStyle: CSSProperties = {
	display: 'flex',
	flexWrap: 'wrap',
	gap: '10px',
	marginTop: '16px',
};

const destructiveButtonStyle: CSSProperties = {
	...appShellSecondaryButtonStyle,
	border: '1px solid rgba(248, 113, 113, 0.36)',
	color: '#fecaca',
};

type SettingsPageProps = Readonly<{
	authContext: AuthContext;
	authError: string | null;
	isAuthPending: boolean;
	onLogout: () => Promise<void>;
}>;

export function SettingsPage({
	authContext,
	authError,
	isAuthPending,
	onLogout,
}: SettingsPageProps): ReactElement {
	const {
		autoReadEnabled,
		cancel: cancelTextToSpeech,
		errorMessage: textToSpeechErrorMessage,
		isSpeaking,
		isSupported: isTextToSpeechSupported,
		setAutoReadEnabled,
	} = useTextToSpeech();
	const voiceInput = useVoiceInput();

	return (
		<>
			<section
				style={{
					...appShellPanelStyle,
					background:
						'radial-gradient(circle at top right, rgba(245, 158, 11, 0.14), transparent 30%), linear-gradient(180deg, rgba(20, 26, 40, 0.92) 0%, rgba(15, 23, 42, 0.8) 100%)',
				}}
				aria-labelledby="account-heading"
				className="runa-card runa-card--hero runa-ambient-panel"
			>
				<div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
					<div style={appShellSecondaryLabelStyle}>{uiCopy.account.heading}</div>
					<h2 id="account-heading" style={{ margin: 0, fontSize: '24px' }}>
						{uiCopy.account.heading}
					</h2>
					<p style={appShellMutedTextStyle}>{uiCopy.account.description}</p>
				</div>

				<div style={heroMetricRowStyle}>
					<span style={pillStyle}>{authContext.principal.kind}</span>
					<span style={{ ...pillStyle, borderColor: 'rgba(96, 165, 250, 0.26)', color: '#bfdbfe' }}>
						{authContext.transport}
					</span>
				</div>

				<div style={appShellButtonRowStyle}>
					<button
						type="button"
						onClick={() => void onLogout()}
						disabled={isAuthPending}
						style={{
							...destructiveButtonStyle,
							opacity: isAuthPending ? 0.6 : 1,
							width: '100%',
						}}
						className="runa-button runa-button--secondary runa-button--danger"
					>
						{uiCopy.account.logout}
					</button>
				</div>

				{authError ? (
					<div
						role="alert"
						style={{
							marginTop: '16px',
							lineHeight: 1.5,
						}}
						className="runa-alert runa-alert--danger"
					>
						<strong>{uiCopy.account.authErrorTitle}: </strong>
						{authError}
					</div>
				) : null}
			</section>

			<section style={sectionGridStyle}>
				<ProfileCard authContext={authContext} />
				<SessionCard authContext={authContext} />
				<section
					style={appShellPanelStyle}
					className="runa-card runa-card--subtle"
					aria-labelledby="voice-preferences-heading"
				>
					<div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
						<div style={appShellSecondaryLabelStyle}>Voice</div>
						<h2 id="voice-preferences-heading" style={{ margin: 0, fontSize: '20px' }}>
							Voice preferences
						</h2>
						<p style={appShellMutedTextStyle}>
							Minimum voice seam burada kalir: sohbet varsayilan olarak yazili devam eder,
							destekliyse sesli okuma ve mikrofon tetigi ikinci katmanda acilir.
						</p>
					</div>

					<div style={{ display: 'grid', gap: '14px' }}>
						<label
							style={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								gap: '16px',
								padding: '14px 16px',
								borderRadius: '18px',
								border: '1px solid rgba(148, 163, 184, 0.16)',
								background: 'rgba(9, 14, 25, 0.68)',
							}}
						>
							<div style={{ display: 'grid', gap: '6px' }}>
								<span style={{ color: '#f8fafc', fontWeight: 700 }}>
									Yeni asistan yanitlarini otomatik oku
								</span>
								<span style={appShellMutedTextStyle}>
									Yalniz tarayici speech synthesis destekliyorsa calisir.
								</span>
							</div>
							<input
								type="checkbox"
								checked={autoReadEnabled}
								onChange={(event) => setAutoReadEnabled(event.target.checked)}
								disabled={!isTextToSpeechSupported}
							/>
						</label>

						<div
							style={{
								display: 'grid',
								gap: '8px',
								padding: '14px 16px',
								borderRadius: '18px',
								border: '1px solid rgba(148, 163, 184, 0.16)',
								background: 'rgba(9, 14, 25, 0.68)',
							}}
						>
							<div style={{ color: '#f8fafc', fontWeight: 700 }}>Tarayici yetenekleri</div>
							<div style={appShellMutedTextStyle}>
								Mikrofon: {voiceInput.isSupported ? 'hazir' : 'desteklenmiyor'}
							</div>
							<div style={appShellMutedTextStyle}>
								Sesli okuma: {isTextToSpeechSupported ? 'hazir' : 'desteklenmiyor'}
							</div>
							{voiceInput.permissionDenied ? (
								<div className="runa-alert runa-alert--warning">
									Mikrofon izni reddedilmis. Chat ekranindaki voice trigger yazili akisi bozmadan
									pasif kalir; tekrar kullanmak istersen tarayici iznini acman yeterli.
								</div>
							) : null}
							{isSpeaking ? (
								<button
									type="button"
									onClick={cancelTextToSpeech}
									style={appShellSecondaryButtonStyle}
									className="runa-button runa-button--secondary"
								>
									Okumayi durdur
								</button>
							) : null}
							{(voiceInput.errorMessage ?? textToSpeechErrorMessage) ? (
								<div className="runa-subtle-copy">
									{voiceInput.errorMessage ?? textToSpeechErrorMessage}
								</div>
							) : null}
						</div>
					</div>
				</section>
			</section>
		</>
	);
}
