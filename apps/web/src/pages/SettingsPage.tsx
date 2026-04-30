import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { AuthContext } from '@runa/types';
import { ProfileCard } from '../components/auth/ProfileCard.js';
import { RunaSkeleton } from '../components/ui/RunaSkeleton.js';
import { useTextToSpeech } from '../hooks/useTextToSpeech.js';
import { useVoiceInput } from '../hooks/useVoiceInput.js';
import { type Theme, applyTheme, getStoredTheme, storeTheme } from '../lib/theme.js';
import { uiCopy } from '../localization/copy.js';
import '../styles/routes/desktop-device-presence-migration.css';
import '../styles/routes/settings-migration.css';

type SettingsTab = 'account' | 'preferences';

type SettingsPageProps = Readonly<{
	authContext: AuthContext;
	authError: string | null;
	isAuthPending: boolean;
	onLogout: () => Promise<void>;
}>;

function parseSettingsTab(value: string | null): SettingsTab {
	return value === 'preferences' ? 'preferences' : 'account';
}

const tabs: readonly { id: SettingsTab; label: string }[] = [
	{ id: 'account', label: 'Hesap' },
	{ id: 'preferences', label: 'Tercihler' },
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
	const [searchParams, setSearchParams] = useSearchParams();
	const [activeTab, setActiveTab] = useState<SettingsTab>(() =>
		parseSettingsTab(searchParams.get('tab')),
	);
	const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
	const {
		autoReadEnabled,
		cancel: cancelTextToSpeech,
		errorMessage: textToSpeechErrorMessage,
		isSpeaking,
		isSupported: isTextToSpeechSupported,
		setAutoReadEnabled,
	} = useTextToSpeech();
	const voiceInput = useVoiceInput();

	useEffect(() => {
		setActiveTab(parseSettingsTab(searchParams.get('tab')));
	}, [searchParams]);

	function selectTheme(nextTheme: Theme): void {
		setTheme(nextTheme);
		storeTheme(nextTheme);
		applyTheme(nextTheme);
	}

	function selectTab(nextTab: SettingsTab): void {
		setActiveTab(nextTab);
		setSearchParams(nextTab === 'preferences' ? { tab: 'preferences' } : {}, { replace: true });
	}

	return (
		<>
			{authError ? (
				<div role="alert" className="runa-alert runa-alert--danger">
					<strong>{uiCopy.account.authErrorTitle}: </strong>
					{authError}
				</div>
			) : null}

			<section className="runa-settings-tabs" aria-label="Hesap ayarları">
				<div className="runa-settings-tabs__list" role="tablist">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							type="button"
							role="tab"
							aria-selected={activeTab === tab.id}
							className={activeTab === tab.id ? 'is-active' : undefined}
							onClick={() => selectTab(tab.id)}
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
							<section className="runa-settings-preference-section" aria-labelledby="theme-heading">
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
							<section className="runa-settings-preference-section" aria-labelledby="voice-heading">
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
									<div>
										Mikrofon {voiceInput.isSupported ? 'kullanılabilir' : 'desteklenmiyor'}.
									</div>
									<div>
										Sesli yanıt {isTextToSpeechSupported ? 'kullanılabilir' : 'desteklenmiyor'}.
									</div>
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
				</div>
			</section>
		</>
	);
}
