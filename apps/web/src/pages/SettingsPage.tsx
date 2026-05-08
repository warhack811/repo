import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { ApprovalMode, AuthContext } from '@runa/types';
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

const runtimeConfigStorageKey = 'runa.developer.runtime_config';
const approvalModeValues = ['ask-every-time', 'standard', 'trusted-session'] as const;
const defaultSettingsApprovalMode: ApprovalMode = 'standard';

const approvalModeOptions: readonly {
	readonly description: string;
	readonly label: string;
	readonly value: ApprovalMode;
}[] = [
	{
		description: 'Her tool/capability kullanimi icin acik onay ister.',
		label: 'Her islemde sor',
		value: 'ask-every-time',
	},
	{
		description: 'Dusuk riskli okumalar akici kalir; yazma ve riskli islemler onay ister.',
		label: 'Standart',
		value: 'standard',
	},
	{
		description:
			'Oturumla sinirlidir; komut, masaustu kontrolu ve yuksek riskli islemler yine onay ister.',
		label: 'Guvenilir oturum',
		value: 'trusted-session',
	},
];

function isApprovalMode(value: unknown): value is ApprovalMode {
	return typeof value === 'string' && approvalModeValues.includes(value as ApprovalMode);
}

function readStoredApprovalMode(): ApprovalMode {
	if (typeof window === 'undefined') {
		return defaultSettingsApprovalMode;
	}

	try {
		const rawValue = window.localStorage.getItem(runtimeConfigStorageKey);

		if (rawValue === null) {
			return defaultSettingsApprovalMode;
		}

		const parsedValue = JSON.parse(rawValue) as { readonly approvalMode?: unknown };

		return isApprovalMode(parsedValue.approvalMode)
			? parsedValue.approvalMode
			: defaultSettingsApprovalMode;
	} catch {
		return defaultSettingsApprovalMode;
	}
}

function storeApprovalMode(mode: ApprovalMode): void {
	if (typeof window === 'undefined') {
		return;
	}

	try {
		const rawValue = window.localStorage.getItem(runtimeConfigStorageKey);
		const parsedValue = rawValue === null ? {} : (JSON.parse(rawValue) as Record<string, unknown>);

		window.localStorage.setItem(
			runtimeConfigStorageKey,
			JSON.stringify({
				...parsedValue,
				approvalMode: mode,
			}),
		);
	} catch {
		window.localStorage.setItem(runtimeConfigStorageKey, JSON.stringify({ approvalMode: mode }));
	}
}

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
	const [approvalMode, setApprovalMode] = useState<ApprovalMode>(() => readStoredApprovalMode());
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

	function selectApprovalMode(nextMode: ApprovalMode): void {
		setApprovalMode(nextMode);
		storeApprovalMode(nextMode);
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
							<section
								className="runa-settings-preference-section"
								aria-labelledby="approval-mode-heading"
							>
								<h2 id="approval-mode-heading">Onay modu</h2>
								<div
									className="runa-settings-approval-modes"
									role="radiogroup"
									aria-label="Onay modu"
								>
									{approvalModeOptions.map((option) => (
										<label
											key={option.value}
											className={
												approvalMode === option.value
													? 'runa-settings-approval-mode is-active'
													: 'runa-settings-approval-mode'
											}
										>
											<input
												type="radio"
												name="approval-mode"
												value={option.value}
												checked={approvalMode === option.value}
												onChange={() => selectApprovalMode(option.value)}
											/>
											<span>
												<strong>{option.label}</strong>
												<small>{option.description}</small>
											</span>
										</label>
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
