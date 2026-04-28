import { type CSSProperties, type ReactElement, useCallback, useEffect, useState } from 'react';

import { type Theme, applyTheme, getStoredTheme, storeTheme } from '../lib/theme.js';

import type { AuthContext, DesktopDevicePresenceSnapshot } from '@runa/types';

import {
	appShellButtonRowStyle,
	appShellMutedTextStyle,
	appShellPanelStyle,
	appShellSecondaryButtonStyle,
	appShellSecondaryLabelStyle,
} from '../components/app/AppShell.js';
import { ProfileCard } from '../components/auth/ProfileCard.js';
import { DevicePresencePanel } from '../components/desktop/DevicePresencePanel.js';
import { ProjectMemorySummary } from '../components/settings/ProjectMemorySummary.js';
import { useTextToSpeech } from '../hooks/useTextToSpeech.js';
import { useVoiceInput } from '../hooks/useVoiceInput.js';
import { readStoredBearerToken } from '../lib/auth-client.js';
import { pillStyle } from '../lib/chat-styles.js';
import {
	DesktopDevicesResponseValidationError,
	fetchDesktopDevices,
} from '../lib/desktop-devices.js';
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

type DesktopDevicesState =
	| {
			readonly status: 'idle' | 'loading';
	  }
	| {
			readonly devices: readonly DesktopDevicePresenceSnapshot[];
			readonly status: 'success';
	  }
	| {
			readonly message: string;
			readonly status: 'error';
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
	const [theme, setTheme] = useState<Theme>(getStoredTheme);
	const [desktopDevicesState, setDesktopDevicesState] = useState<DesktopDevicesState>({
		status: 'idle',
	});
	const [desktopDevicesReloadKey, setDesktopDevicesReloadKey] = useState(0);
	const {
		autoReadEnabled,
		cancel: cancelTextToSpeech,
		errorMessage: textToSpeechErrorMessage,
		isSpeaking,
		isSupported: isTextToSpeechSupported,
		setAutoReadEnabled,
	} = useTextToSpeech();
	const voiceInput = useVoiceInput();
	const loadDesktopDevices = useCallback(
		async (signal: AbortSignal) => {
			if (authContext.principal.kind !== 'authenticated') {
				setDesktopDevicesState({
					status: 'success',
					devices: [],
				});
				return;
			}

			setDesktopDevicesState({
				status: 'loading',
			});

			try {
				const response = await fetchDesktopDevices({
					bearerToken: readStoredBearerToken() ?? undefined,
					signal,
				});

				if (signal.aborted) {
					return;
				}

				setDesktopDevicesState({
					devices: response.devices,
					status: 'success',
				});
			} catch (error) {
				if (signal.aborted) {
					return;
				}

				if (error instanceof DesktopDevicesResponseValidationError) {
					setDesktopDevicesState({
						message: 'Cihaz listesi beklenen sekilde donmedi. Lutfen biraz sonra yeniden dene.',
						status: 'error',
					});
					return;
				}

				setDesktopDevicesState({
					message:
						error instanceof Error
							? error.message
							: 'Cihazlar su anda yuklenemedi. Lutfen biraz sonra yeniden dene.',
					status: 'error',
				});
			}
		},
		[authContext.principal.kind],
	);

	useEffect(() => {
		const abortController = new AbortController();
		const currentReloadKey = desktopDevicesReloadKey;
		void currentReloadKey;
		void loadDesktopDevices(abortController.signal);

		return () => {
			abortController.abort();
		};
	}, [desktopDevicesReloadKey, loadDesktopDevices]);

	const desktopDevices = getDesktopDevices(desktopDevicesState);
	const desktopDeviceError = getDesktopDeviceError(desktopDevicesState);
	const isDesktopDeviceLoading =
		desktopDevicesState.status === 'idle' || desktopDevicesState.status === 'loading';

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
					aria-labelledby="online-devices-heading"
				>
					<DevicePresencePanel
						devices={desktopDevices}
						error={desktopDeviceError}
						isLoading={isDesktopDeviceLoading}
						onRefresh={() => setDesktopDevicesReloadKey((current) => current + 1)}
					/>
				</section>

				<ProjectMemorySummary status="unavailable" />

				<section
					style={appShellPanelStyle}
					className="runa-card runa-card--subtle"
					aria-labelledby="theme-heading"
				>
					<div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
						<div style={appShellSecondaryLabelStyle}>Görünüm</div>
						<h2 id="theme-heading" style={{ margin: 0, fontSize: '20px' }}>
							Tema
						</h2>
						<p style={appShellMutedTextStyle}>
							Arayüz rengini tercihine göre ayarla. Sistem seçeneği cihazın temasını takip eder.
						</p>
					</div>
					<div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
						{THEME_OPTIONS.map(({ value, label }) => (
							<button
								key={value}
								type="button"
								onClick={() => {
									storeTheme(value);
									applyTheme(value);
									setTheme(value);
								}}
								className={`runa-button ${theme === value ? 'runa-button--secondary-active' : 'runa-button--secondary'}`}
								style={{ flex: '1 1 0', minWidth: 0 }}
							>
								{label}
							</button>
						))}
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
					<div className="runa-alert runa-alert--info">
						Bu tarayici icin gelistirici sayfasini acmak istersen ustteki ikincil anahtari
						kullanabilirsin.
					</div>
				</section>
			</section>
		</>
	);
}
