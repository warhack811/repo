import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { ApprovalMode, AuthContext } from '@runa/types';
import { ProfileCard } from '../components/auth/ProfileCard.js';
import { RunaSkeleton } from '../components/ui/RunaSkeleton.js';
import { useTextToSpeech } from '../hooks/useTextToSpeech.js';
import { useVoiceInput } from '../hooks/useVoiceInput.js';
import { BRAND_THEME_OPTIONS, type BrandTheme, type Theme } from '../lib/theme.js';
import { fetchWorkspaceDirectories } from '../lib/workspace-directories.js';
import { uiCopy } from '../localization/copy.js';
import '../styles/routes/desktop-device-presence-migration.css';
import '../styles/routes/settings-migration.css';

type SettingsTab = 'account' | 'preferences';

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
		void workspaceDirectoriesReloadNonce;
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
								<div className="runa-settings-theme-groups">
									<div className="runa-settings-theme-group">
										<div className="runa-settings-theme-label">Görünüm</div>
										<div className="runa-settings-segmented" role="radiogroup" aria-label="Görünüm">
											{themeOptions.map((option) => (
												<button
													key={option.value}
													type="button"
													aria-pressed={theme === option.value}
													className={theme === option.value ? 'is-active' : undefined}
													onClick={() => onThemeChange(option.value)}
												>
													{option.label}
												</button>
											))}
										</div>
									</div>
									<div className="runa-settings-theme-group">
										<div className="runa-settings-theme-label">Renk</div>
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
									</div>
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
										<span>Run klasörü</span>
										<select
											value={workingDirectory}
											onChange={(event) => selectWorkingDirectory(event.target.value)}
											disabled={workspaceDirectoryLoading || workspaceDirectories.length === 0}
										>
											<option value="">Workspace kökü (varsayılan)</option>
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
											Secilen klasor yeni runlarda calisma koku olarak kullanilir.
										</div>
									)}
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
