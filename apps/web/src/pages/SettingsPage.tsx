import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { ApprovalMode, AuthContext } from '@runa/types';
import { ProfileCard } from '../components/auth/ProfileCard.js';
import { ThemePicker } from '../components/settings/ThemePicker.js';
import { RunaSkeleton } from '../components/ui/RunaSkeleton.js';
import { useAdvancedViewMode } from '../hooks/useAdvancedViewMode.js';
import { useTextToSpeech } from '../hooks/useTextToSpeech.js';
import { useVoiceInput } from '../hooks/useVoiceInput.js';
import { BRAND_THEME_OPTIONS, type BrandTheme, type Theme } from '../lib/theme.js';
import { fetchWorkspaceDirectories } from '../lib/workspace-directories.js';
import { uiCopy } from '../localization/copy.js';

type SettingsTab = 'advanced' | 'appearance' | 'conversation' | 'notifications' | 'privacy';

type SettingsPageProps = Readonly<{
	accessToken: string | null;
	authContext: AuthContext;
	authError: string | null;
	brandTheme: BrandTheme;
	isAuthPending: boolean;
	onBrandThemeChange: (theme: BrandTheme) => void;
	onLogout: () => Promise<void>;
	onThemeChange: (theme: Theme) => void;
	theme: Theme;
}>;

const runtimeConfigStorageKey = 'runa.developer.runtime_config';
const typographyStorageKey = 'runa.settings.typography';
const notificationsSettingsStorageKey = 'runa.settings.notifications';
const approvalModeValues = ['ask-every-time', 'standard', 'trusted-session'] as const;
const defaultSettingsApprovalMode: ApprovalMode = 'standard';

type NotificationSettings = Readonly<{
	dataRetention: '30' | '90' | 'forever';
	language: 'en' | 'tr';
	quietHours: boolean;
}>;

const defaultNotificationSettings: NotificationSettings = {
	dataRetention: '90',
	language: 'tr',
	quietHours: true,
};

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

const tabs: readonly { id: SettingsTab; label: string }[] = [
	{ id: 'appearance', label: 'Appearance' },
	{ id: 'conversation', label: 'Conversation' },
	{ id: 'notifications', label: 'Notifications' },
	{ id: 'privacy', label: 'Privacy' },
	{ id: 'advanced', label: 'Advanced' },
];

function parseSettingsTab(value: string | null): SettingsTab {
	if (value === 'conversation') {
		return 'conversation';
	}

	if (value === 'notifications') {
		return 'notifications';
	}

	if (value === 'privacy') {
		return 'privacy';
	}

	if (value === 'advanced') {
		return 'advanced';
	}

	return 'appearance';
}

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

function readStoredWorkingDirectory(): string {
	if (typeof window === 'undefined') {
		return '';
	}

	try {
		const rawValue = window.localStorage.getItem(runtimeConfigStorageKey);

		if (rawValue === null) {
			return '';
		}

		const parsedValue = JSON.parse(rawValue) as { readonly workingDirectory?: unknown };

		return typeof parsedValue.workingDirectory === 'string' ? parsedValue.workingDirectory : '';
	} catch {
		return '';
	}
}

function readStoredTypographyPreference(): 'comfortable' | 'compact' {
	if (typeof window === 'undefined') {
		return 'comfortable';
	}

	const rawValue = window.localStorage.getItem(typographyStorageKey);
	return rawValue === 'compact' ? 'compact' : 'comfortable';
}

function readStoredNotificationSettings(): NotificationSettings {
	if (typeof window === 'undefined') {
		return defaultNotificationSettings;
	}

	try {
		const rawValue = window.localStorage.getItem(notificationsSettingsStorageKey);
		if (!rawValue) {
			return defaultNotificationSettings;
		}

		const parsed = JSON.parse(rawValue) as Partial<NotificationSettings>;
		return {
			dataRetention:
				parsed.dataRetention === '30' || parsed.dataRetention === 'forever'
					? parsed.dataRetention
					: '90',
			language: parsed.language === 'en' ? 'en' : 'tr',
			quietHours: parsed.quietHours !== false,
		};
	} catch {
		return defaultNotificationSettings;
	}
}

function storeNotificationSettings(next: NotificationSettings): void {
	if (typeof window === 'undefined') {
		return;
	}

	window.localStorage.setItem(notificationsSettingsStorageKey, JSON.stringify(next));
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

function storeWorkingDirectory(workingDirectory: string): void {
	if (typeof window === 'undefined') {
		return;
	}

	const normalizedWorkingDirectory = workingDirectory.trim();

	try {
		const rawValue = window.localStorage.getItem(runtimeConfigStorageKey);
		const parsedValue = rawValue === null ? {} : (JSON.parse(rawValue) as Record<string, unknown>);

		window.localStorage.setItem(
			runtimeConfigStorageKey,
			JSON.stringify({
				...parsedValue,
				workingDirectory: normalizedWorkingDirectory,
			}),
		);
	} catch {
		window.localStorage.setItem(
			runtimeConfigStorageKey,
			JSON.stringify({ workingDirectory: normalizedWorkingDirectory }),
		);
	}
}

export function SettingsPage({
	accessToken,
	authContext,
	authError,
	brandTheme,
	isAuthPending,
	onBrandThemeChange,
	onLogout,
	onThemeChange,
	theme,
}: SettingsPageProps): ReactElement {
	const [searchParams, setSearchParams] = useSearchParams();
	const [activeTab, setActiveTab] = useState<SettingsTab>(() =>
		parseSettingsTab(searchParams.get('tab')),
	);
	const [approvalMode, setApprovalMode] = useState<ApprovalMode>(() => readStoredApprovalMode());
	const [workspaceDirectories, setWorkspaceDirectories] = useState<
		readonly { readonly depth: number; readonly name: string; readonly relative_path: string }[]
	>([]);
	const [workspaceDirectoryError, setWorkspaceDirectoryError] = useState<string | null>(null);
	const [workspaceDirectoryLoading, setWorkspaceDirectoryLoading] = useState(false);
	const [workspaceDirectoriesReloadNonce, setWorkspaceDirectoriesReloadNonce] = useState(0);
	const [workspaceRootName, setWorkspaceRootName] = useState('Workspace');
	const [workingDirectory, setWorkingDirectory] = useState(() => readStoredWorkingDirectory());
	const [typographyPreference, setTypographyPreference] = useState<'comfortable' | 'compact'>(() =>
		readStoredTypographyPreference(),
	);
	const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() =>
		readStoredNotificationSettings(),
	);
	const { isEnabled: isAdvancedViewEnabled, setEnabled: setAdvancedViewEnabled } =
		useAdvancedViewMode();
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

	useEffect(() => {
		const normalizedAccessToken = accessToken?.trim() ?? '';

		if (normalizedAccessToken.length === 0) {
			setWorkspaceDirectories([]);
			setWorkspaceDirectoryError(null);
			setWorkspaceDirectoryLoading(false);
			return;
		}

		const abortController = new AbortController();
		let isDisposed = false;

		async function loadWorkspaceDirectories(): Promise<void> {
			setWorkspaceDirectoryLoading(true);
			setWorkspaceDirectoryError(null);

			try {
				const response = await fetchWorkspaceDirectories({
					bearerToken: normalizedAccessToken,
					reloadNonce: workspaceDirectoriesReloadNonce,
					signal: abortController.signal,
				});

				if (isDisposed || abortController.signal.aborted) {
					return;
				}

				setWorkspaceDirectories(response.directories);
				setWorkspaceRootName(response.workspace_root_name);
			} catch (error: unknown) {
				if (isDisposed || abortController.signal.aborted) {
					return;
				}

				setWorkspaceDirectoryError(
					error instanceof Error
						? error.message
						: 'Çalışma klasörleri yüklenemedi. Bağlantıyı kontrol edip tekrar dene.',
				);
			} finally {
				if (!isDisposed && !abortController.signal.aborted) {
					setWorkspaceDirectoryLoading(false);
				}
			}
		}

		void loadWorkspaceDirectories();

		return () => {
			isDisposed = true;
			abortController.abort();
		};
	}, [accessToken, workspaceDirectoriesReloadNonce]);

	useEffect(() => {
		const normalizedAccessToken = accessToken?.trim() ?? '';

		if (normalizedAccessToken.length === 0 || workspaceDirectoryLoading) {
			return;
		}

		if (workingDirectory.trim().length === 0) {
			return;
		}

		const existsInDirectoryList = workspaceDirectories.some(
			(directory) => directory.relative_path === workingDirectory,
		);

		if (existsInDirectoryList) {
			return;
		}

		setWorkingDirectory('');
		storeWorkingDirectory('');
	}, [accessToken, workingDirectory, workspaceDirectories, workspaceDirectoryLoading]);

	function selectApprovalMode(nextMode: ApprovalMode): void {
		setApprovalMode(nextMode);
		storeApprovalMode(nextMode);
	}

	function selectWorkingDirectory(nextDirectory: string): void {
		setWorkingDirectory(nextDirectory);
		storeWorkingDirectory(nextDirectory);
	}

	function reloadWorkspaceDirectories(): void {
		setWorkspaceDirectoriesReloadNonce((current) => current + 1);
	}

	function selectTab(nextTab: SettingsTab): void {
		setActiveTab(nextTab);
		setSearchParams(nextTab === 'appearance' ? {} : { tab: nextTab }, { replace: true });
	}

	function selectTypographyPreference(nextValue: 'comfortable' | 'compact'): void {
		setTypographyPreference(nextValue);
		window.localStorage.setItem(typographyStorageKey, nextValue);
	}

	function patchNotificationSettings(nextValue: Partial<NotificationSettings>): void {
		setNotificationSettings((current) => {
			const nextSettings = {
				...current,
				...nextValue,
			};
			storeNotificationSettings(nextSettings);
			return nextSettings;
		});
	}

	return (
		<>
			{authError ? (
				<div role="alert" className="runa-alert runa-alert--danger">
					<strong>{uiCopy.account.authErrorTitle}: </strong>
					{authError}
				</div>
			) : null}

			<section className="runa-settings-panel-grid" aria-labelledby="account-heading">
				<section className="runa-settings-preference-section" id="account-heading">
					<h2>Hesap</h2>
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
				</section>
			</section>

			<section className="runa-settings-tabs" aria-label="Hesap ayarlari">
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
					{activeTab === 'appearance' ? (
						<div className="runa-settings-panel-grid">
							<section className="runa-settings-preference-section" aria-labelledby="theme-heading">
								<h2 id="theme-heading">Tema</h2>
								<ThemePicker value={theme} onChange={onThemeChange} />
							</section>
							<section className="runa-settings-preference-section" aria-labelledby="brand-heading">
								<h2 id="brand-heading">Renk paleti</h2>
								<div className="runa-settings-brand-themes" role="radiogroup" aria-label="Renk">
									{BRAND_THEME_OPTIONS.map((option) => (
										<button
											key={option.value}
											type="button"
											aria-pressed={brandTheme === option.value}
											className={
												brandTheme === option.value
													? 'runa-settings-brand-theme is-active'
													: 'runa-settings-brand-theme'
											}
											onClick={() => onBrandThemeChange(option.value)}
										>
											<span
												className="runa-settings-brand-theme__swatch"
												data-brand-theme={option.value}
												aria-hidden="true"
											/>
											<span>{option.label}</span>
										</button>
									))}
								</div>
							</section>
							<section
								className="runa-settings-preference-section"
								aria-labelledby="typography-heading"
							>
								<h2 id="typography-heading">Tipografi</h2>
								<label className="runa-settings-row">
									<span>Metin yogunlugu</span>
									<select
										value={typographyPreference}
										onChange={(event) =>
											selectTypographyPreference(
												event.target.value === 'compact' ? 'compact' : 'comfortable',
											)
										}
									>
										<option value="comfortable">Rahat</option>
										<option value="compact">Siki</option>
									</select>
								</label>
							</section>
						</div>
					) : null}

					{activeTab === 'conversation' ? (
						<div className="runa-settings-panel-grid">
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
									<span>Yeni yanitlari otomatik oku</span>
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
											Okumayi durdur
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

					{activeTab === 'notifications' ? (
						<div className="runa-settings-panel-grid">
							<section
								className="runa-settings-preference-section"
								aria-labelledby="notifications-heading"
							>
								<h2 id="notifications-heading">Bildirimler</h2>
								<label className="runa-settings-row">
									<span>Dil</span>
									<select
										value={notificationSettings.language}
										onChange={(event) =>
											patchNotificationSettings({
												language: event.target.value === 'en' ? 'en' : 'tr',
											})
										}
									>
										<option value="tr">Turkce</option>
										<option value="en">English</option>
									</select>
								</label>
								<label className="runa-settings-row">
									<span>Sessiz saatler (22:00-08:00)</span>
									<input
										type="checkbox"
										checked={notificationSettings.quietHours}
										onChange={(event) =>
											patchNotificationSettings({ quietHours: event.target.checked })
										}
									/>
								</label>
								<label className="runa-settings-row">
									<span>Veri saklama suresi</span>
									<select
										value={notificationSettings.dataRetention}
										onChange={(event) =>
											patchNotificationSettings({
												dataRetention:
													event.target.value === '30' || event.target.value === 'forever'
														? event.target.value
														: '90',
											})
										}
									>
										<option value="30">30 gun</option>
										<option value="90">90 gun</option>
										<option value="forever">Suresiz</option>
									</select>
								</label>
							</section>
						</div>
					) : null}

					{activeTab === 'privacy' ? (
						<div className="runa-settings-panel-grid">
							<section
								className="runa-settings-preference-section"
								aria-labelledby="workspace-directory-heading"
							>
								<h2 id="workspace-directory-heading">Çalışma klasörü</h2>
								<div className="runa-settings-row runa-settings-row--stacked">
									<label className="runa-settings-row">
										<span>Aktif çalışma kökü</span>
										<output>{workspaceRootName}</output>
									</label>
									<label className="runa-settings-row">
										<span>Run klasoru</span>
										<select
											value={workingDirectory}
											onChange={(event) => selectWorkingDirectory(event.target.value)}
											disabled={workspaceDirectoryLoading || workspaceDirectories.length === 0}
										>
											<option value="">Workspace koku (varsayilan)</option>
											{workspaceDirectories.map((directory) => (
												<option key={directory.relative_path} value={directory.relative_path}>
													{`${'  '.repeat(directory.depth)}${directory.relative_path}`}
												</option>
											))}
										</select>
									</label>
									<div className="runa-settings-row">
										<button
											type="button"
											className="runa-button runa-button--secondary"
											onClick={reloadWorkspaceDirectories}
											disabled={workspaceDirectoryLoading}
										>
											{workspaceDirectoryLoading ? 'Yenileniyor...' : 'Klasörleri yenile'}
										</button>
									</div>
									{workspaceDirectoryError ? (
										<div className="runa-alert runa-alert--warning">{workspaceDirectoryError}</div>
									) : (
										<div className="runa-subtle-copy">
											Seçilen klasör yeni runlarda çalışma kökü olarak kullanılır.
										</div>
									)}
								</div>
							</section>
						</div>
					) : null}

					{activeTab === 'advanced' ? (
						<div className="runa-settings-panel-grid">
							<section
								className="runa-settings-preference-section"
								aria-labelledby="advanced-view-heading"
							>
								<h2 id="advanced-view-heading">Gelismis gorunum</h2>
								<label className="runa-settings-row">
									<span>{uiCopy.advancedView.heading}</span>
									<input
										type="checkbox"
										checked={isAdvancedViewEnabled}
										onChange={(event) => setAdvancedViewEnabled(event.target.checked)}
									/>
								</label>
								<div className="runa-subtle-copy">{uiCopy.advancedView.description}</div>
							</section>
						</div>
					) : null}
				</div>
			</section>
		</>
	);
}
