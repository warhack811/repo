import type { ReactElement } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { AuthContext } from '@runa/types';
import { ProfileCard } from '../components/auth/ProfileCard.js';
import { DevicePresencePanel } from '../components/desktop/DevicePresencePanel.js';
import { ProjectMemorySummary } from '../components/settings/ProjectMemorySummary.js';
import { RunaSkeleton } from '../components/ui/RunaSkeleton.js';
import { useDeveloperMode } from '../hooks/useDeveloperMode.js';
import { useTextToSpeech } from '../hooks/useTextToSpeech.js';
import { useVoiceInput } from '../hooks/useVoiceInput.js';
import { type Theme, applyTheme, getStoredTheme, storeTheme } from '../lib/theme.js';
import { uiCopy } from '../localization/copy.js';
import '../styles/routes/desktop-device-presence-migration.css';
import '../styles/routes/settings-migration.css';

type SettingsTab = 'account' | 'developer' | 'devices' | 'memory' | 'preferences';

type SettingsPageProps = Readonly<{
	authContext: AuthContext;
	authError: string | null;
	isAuthPending: boolean;
	onLogout: () => Promise<void>;
}>;

const tabs: readonly { id: SettingsTab; label: string }[] = [
	{ id: 'account', label: 'Account' },
	{ id: 'preferences', label: 'Preferences' },
	{ id: 'devices', label: 'Devices' },
	{ id: 'memory', label: 'Project Memory' },
	{ id: 'developer', label: 'Developer' },
];

const themeOptions: readonly { value: Theme; label: string }[] = [
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
	const [activeTab, setActiveTab] = useState<SettingsTab>('account');
	const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
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

	function selectTheme(nextTheme: Theme): void {
		setTheme(nextTheme);
		storeTheme(nextTheme);
		applyTheme(nextTheme);
	}

	return (
		<>
			<section
				aria-labelledby="account-heading"
				className="runa-card runa-card--hero runa-ambient-panel runa-settings-hero"
			>
				<div>
					<div className="runa-eyebrow">{uiCopy.account.heading}</div>
					<h2 id="account-heading">{uiCopy.account.heading}</h2>
					<p>{uiCopy.account.description}</p>
				</div>
				<div className="runa-inline-cluster">
					<span className="runa-pill">
						{authContext.principal.kind === 'authenticated' ? 'Oturum açık' : 'Sınırlı oturum'}
					</span>
					<span className="runa-pill">Tarayıcı hazır</span>
				</div>
				{authError ? (
					<div role="alert" className="runa-alert runa-alert--danger">
						<strong>{uiCopy.account.authErrorTitle}: </strong>
						{authError}
					</div>
				) : null}
			</section>

			<section className="runa-settings-tabs" aria-label="Account settings">
				<div className="runa-settings-tabs__list" role="tablist">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							type="button"
							role="tab"
							aria-selected={activeTab === tab.id}
							className={activeTab === tab.id ? 'is-active' : undefined}
							onClick={() => setActiveTab(tab.id)}
						>
							{tab.label}
						</button>
					))}
				</div>

				<div className="runa-settings-tabs__panel" role="tabpanel">
					{activeTab === 'account' ? (
						<div className="runa-settings-panel-grid">
							{isAuthPending ? (
								<output aria-busy="true" className="runa-settings-skeleton">
									<RunaSkeleton variant="rect" />
									<RunaSkeleton variant="text" />
								</output>
							) : (
								<ProfileCard authContext={authContext} />
							)}
							<button
								type="button"
								onClick={() => void onLogout()}
								disabled={isAuthPending}
								className="runa-button runa-button--secondary runa-button--danger"
							>
								{uiCopy.account.logout}
							</button>
						</div>
					) : null}

					{activeTab === 'preferences' ? (
						<div className="runa-settings-panel-grid">
							<section className="runa-card runa-card--subtle" aria-labelledby="theme-heading">
								<h2 id="theme-heading">Tema</h2>
								<div className="runa-settings-segmented" role="radiogroup" aria-label="Tema">
									{themeOptions.map((option) => (
										<button
											key={option.value}
											type="button"
											aria-pressed={theme === option.value}
											className={theme === option.value ? 'is-active' : undefined}
											onClick={() => selectTheme(option.value)}
										>
											{option.label}
										</button>
									))}
								</div>
							</section>
							<section className="runa-card runa-card--subtle" aria-labelledby="voice-heading">
								<h2 id="voice-heading">Ses tercihleri</h2>
								<label className="runa-settings-row">
									<span>Yeni yanıtları otomatik oku</span>
									<input
										type="checkbox"
										checked={autoReadEnabled}
										onChange={(event) => setAutoReadEnabled(event.target.checked)}
										disabled={!isTextToSpeechSupported}
									/>
								</label>
								<div className="runa-settings-row runa-settings-row--stacked">
									<div>Mikrofon: {voiceInput.isSupported ? 'hazır' : 'desteklenmiyor'}</div>
									<div>Sesli okuma: {isTextToSpeechSupported ? 'hazır' : 'desteklenmiyor'}</div>
									{voiceInput.permissionDenied ? (
										<div className="runa-alert runa-alert--warning">Mikrofon izni reddedildi.</div>
									) : null}
									{isSpeaking ? (
										<button
											type="button"
											onClick={cancelTextToSpeech}
											className="runa-button runa-button--secondary"
										>
											Okumayı durdur
										</button>
									) : null}
									{(voiceInput.errorMessage ?? textToSpeechErrorMessage) ? (
										<div className="runa-subtle-copy">
											{voiceInput.errorMessage ?? textToSpeechErrorMessage}
										</div>
									) : null}
								</div>
							</section>
						</div>
					) : null}

					{activeTab === 'devices' ? (
						<section className="runa-card runa-card--subtle">
							<DevicePresencePanel devices={[]} isLoading={isAuthPending} />
							<Link to="/devices" className="runa-button runa-button--secondary">
								Cihazlar sayfasını aç
							</Link>
						</section>
					) : null}

					{activeTab === 'memory' ? (
						<section className="runa-card runa-card--subtle">
							<ProjectMemorySummary isLoading={isAuthPending} status="unavailable" />
						</section>
					) : null}

					{activeTab === 'developer' ? (
						<section
							className="runa-card runa-card--subtle"
							aria-labelledby="developer-settings-heading"
						>
							<h2 id="developer-settings-heading">Geliştirici yüzeyleri</h2>
							<label className="runa-settings-row">
								<span>Developer Mode</span>
								<input type="checkbox" checked={isDeveloperMode} onChange={toggleDeveloperMode} />
							</label>
							<Link to="/developer" className="runa-button runa-button--secondary">
								Developer yüzeyini aç
							</Link>
						</section>
					) : null}
				</div>
			</section>
		</>
	);
}
