import type { CSSProperties, ReactElement } from 'react';
import { Link } from 'react-router-dom';

import type { AuthContext } from '@runa/types';

import {
	appShellButtonRowStyle,
	appShellMutedTextStyle,
	appShellPanelStyle,
	appShellSecondaryButtonStyle,
	appShellSecondaryLabelStyle,
} from '../components/app/AppShell.js';
import { ProfileCard } from '../components/auth/ProfileCard.js';
import { useDeveloperMode } from '../hooks/useDeveloperMode.js';
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

function getDesktopDevices(state: DesktopDevicesState): readonly DesktopDevicePresenceSnapshot[] {
	return state.status === 'success' ? state.devices : [];
}

function getDesktopDeviceError(state: DesktopDevicesState): string | null {
	return state.status === 'error' ? state.message : null;
}

const THEME_OPTIONS: { value: Theme; label: string }[] = [
	{ value: 'system', label: 'Sistem' },
	{ value: 'dark', label: 'Koyu' },
	{ value: 'light', label: 'Açık' },
];

export function SettingsPage({
	authContext,
	authError,
	isAuthPending,
	onLogout,
}: SettingsPageProps): ReactElement {
	const { isDeveloperMode, toggleDeveloperMode } = useDeveloperMode();
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
					<span style={pillStyle}>
						{authContext.principal.kind === 'authenticated' ? 'Oturum acik' : 'Sinirli oturum'}
					</span>
					<span style={{ ...pillStyle, borderColor: 'rgba(96, 165, 250, 0.26)', color: '#bfdbfe' }}>
						Tarayici hazir
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

				<section
					style={appShellPanelStyle}
					className="runa-card runa-card--subtle"
					aria-labelledby="voice-preferences-heading"
				>
					<div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
						<div style={appShellSecondaryLabelStyle}>Tercihler</div>
						<h2 id="voice-preferences-heading" style={{ margin: 0, fontSize: '20px' }}>
							Ses tercihleri
						</h2>
						<p style={appShellMutedTextStyle}>
							Sohbet varsayilan olarak metinle baslar. Sesli giris ve yanit okuma bu ikincil ayar
							katmaninda kalir.
						</p>
					</div>

					<div style={{ display: 'grid', gap: '14px' }}>
						<label className="runa-settings-row">
							<div style={{ display: 'grid', gap: '6px' }}>
								<span style={{ color: '#f8fafc', fontWeight: 700 }}>
									Yeni yanitlari otomatik oku
								</span>
								<span style={appShellMutedTextStyle}>
									Yalniz bu tarayici sesli okuma destekliyorsa calisir.
								</span>
							</div>
							<input
								type="checkbox"
								checked={autoReadEnabled}
								onChange={(event) => setAutoReadEnabled(event.target.checked)}
								disabled={!isTextToSpeechSupported}
							/>
						</label>

						<div className="runa-settings-row runa-settings-row--stacked">
							<div style={{ color: '#f8fafc', fontWeight: 700 }}>Tarayici yetenekleri</div>
							<div style={appShellMutedTextStyle}>
								Mikrofon: {voiceInput.isSupported ? 'hazir' : 'desteklenmiyor'}
							</div>
							<div style={appShellMutedTextStyle}>
								Sesli okuma: {isTextToSpeechSupported ? 'hazir' : 'desteklenmiyor'}
							</div>
							{voiceInput.permissionDenied ? (
								<div className="runa-alert runa-alert--warning">
									Mikrofon izni reddedildi. Metinle sohbet akisi etkilenmeden devam eder.
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

				<section
					style={appShellPanelStyle}
					className="runa-card runa-card--subtle"
					aria-labelledby="developer-settings-heading"
				>
					<div style={{ display: 'grid', gap: '10px' }}>
						<div style={appShellSecondaryLabelStyle}>Developer</div>
						<h2 id="developer-settings-heading" style={{ margin: 0, fontSize: '20px' }}>
							Gelistirici yuzeyleri
						</h2>
						<p style={appShellMutedTextStyle}>
							Gelistirici modu ve ham teknik gorunumler ikinci katmanda kalir; ana sohbet alani
							sakin bir calisma ortagi gibi davranmaya devam eder.
						</p>
					</div>
					<label className="runa-settings-row">
						<div style={{ display: 'grid', gap: '6px' }}>
							<span style={{ color: '#f8fafc', fontWeight: 700 }}>Developer Mode</span>
							<span style={appShellMutedTextStyle}>
								Aktif oldugunda runtime ayarlari ve ham teknik gorunumler ayri sayfada acilir.
							</span>
						</div>
						<input type="checkbox" checked={isDeveloperMode} onChange={toggleDeveloperMode} />
					</label>
					<div style={appShellButtonRowStyle}>
						<Link
							to="/developer"
							style={{
								...appShellSecondaryButtonStyle,
								opacity: isDeveloperMode ? 1 : 0.64,
								textAlign: 'center',
								textDecoration: 'none',
							}}
							className="runa-button runa-button--secondary"
						>
							Developer yuzeyini ac
						</Link>
					</div>
				</section>
			</section>
		</>
	);
}
