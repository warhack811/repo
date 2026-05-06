import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { dirname, join } from 'node:path';
import {
	BrowserWindow,
	Menu,
	Tray,
	app,
	clipboard,
	crashReporter,
	shell as electronShell,
	ipcMain,
	nativeImage,
	powerMonitor,
	protocol,
	safeStorage,
	session,
} from 'electron';

import type { DesktopAgentSettingsStoreState } from '@runa/types';

import {
	type DesktopAgentLaunchController,
	type DesktopAgentLaunchControllerViewModel,
	type DesktopAgentLogger,
	type DesktopAgentPersistedSession,
	type DesktopAgentSessionInputPayload,
	type DesktopAgentSessionStorage,
	createDesktopAgentDiagnosticsSnapshot,
	createDesktopAgentLaunchController,
	createDesktopAgentLogger,
	createDesktopAgentSessionStorageForSafeStorage,
	createElectronDesktopAgentWindowHost,
	createFileDesktopAgentSettingsStore,
	createNodeWebSocket,
	findDesktopPairingCodeInArgv,
	isAllowedExternalUrl,
	readAllowedExternalUrlPolicy,
	readDesktopAgentBootstrapConfigFromEnvironment,
	redactPii,
	startDesktopAgentBridge,
} from '../src/index.js';

type LegacyShellState = Readonly<{
	agentConnected: boolean;
	errorMessage?: string;
	sessionValid: boolean;
	status: 'connected' | 'connecting' | 'error' | 'needs_sign_in' | 'stopped';
}>;

type ShellInvokeActionPayload = Readonly<{
	actionId: DesktopAgentLaunchControllerViewModel['primary_action']['id'];
}>;

type DesktopAgentDeviceIdentityRecord = Readonly<{
	agent_id: string;
	machine_label?: string;
}>;

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let controller: DesktopAgentLaunchController | null = null;
let configurationErrorMessage: string | null = null;
let configuredDesktopWebUrl: URL | null = null;
let rendererFallbackErrorMessage: string | null = null;
let insecureStorageWarning = false;
let smokeShutdownWatchHandle: ReturnType<typeof setInterval> | null = null;
let smokeSignOutWatchHandle: ReturnType<typeof setInterval> | null = null;
let smokeShutdownInProgress = false;
let smokeSignOutInProgress = false;
const gotSingleInstanceLock = app.requestSingleInstanceLock();
const allowedExternalUrlPolicy = readAllowedExternalUrlPolicy();
const startHidden = process.argv.includes('--hidden');
const sensitiveDesktopWebUrlParams = new Set([
	'access_token',
	'refresh_token',
	'authorization',
	'api_key',
	'apikey',
	'secret',
	'token',
]);
let currentSettings: DesktopAgentSettingsStoreState = {
	autoStart: true,
	openWindowOnStart: false,
	telemetryOptIn: false,
};

const userDataDirectoryOverride = process.env.RUNA_DESKTOP_AGENT_USER_DATA_DIR?.trim();
if (userDataDirectoryOverride) {
	app.setPath('userData', userDataDirectoryOverride);
}

crashReporter.start({
	companyName: 'Runa',
	ignoreSystemCrashHandler: false,
	productName: 'Runa Desktop',
	submitURL: process.env['RUNA_CRASH_SUBMIT_URL'] ?? 'https://localhost/',
	uploadToServer: process.env['RUNA_CRASH_UPLOAD'] === 'true',
});

const desktopLogger = createDesktopAgentLogger({
	userDataDirectory: app.getPath('userData'),
});

function getMainLogFilePath(): string {
	return join(app.getPath('userData'), 'logs', 'main.log');
}

function getCrashpadDirectoryPath(): string {
	return join(app.getPath('userData'), 'Crashpad');
}

function getDeviceIdentityFilePath(): string {
	return join(app.getPath('userData'), 'device-identity.json');
}

function logBoot(message: string, data?: unknown): void {
	const safeData = data === undefined ? undefined : redactPii(data);
	const payload = safeData === undefined ? '' : ` ${JSON.stringify(safeData)}`;
	console.log(`[boot:${message}]${payload}`);
	desktopLogger.info(`[boot:${message}]`, safeData ?? {});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDesktopAgentDeviceIdentityRecord(
	value: unknown,
): value is DesktopAgentDeviceIdentityRecord {
	if (!isRecord(value)) {
		return false;
	}

	return (
		typeof value['agent_id'] === 'string' &&
		value['agent_id'].trim().length > 0 &&
		(value['machine_label'] === undefined || typeof value['machine_label'] === 'string')
	);
}

async function readDeviceIdentityRecord(): Promise<DesktopAgentDeviceIdentityRecord | null> {
	try {
		const rawValue = await readFile(getDeviceIdentityFilePath(), 'utf8');
		const parsedValue = JSON.parse(rawValue) as unknown;

		if (!isDesktopAgentDeviceIdentityRecord(parsedValue)) {
			return null;
		}

		return {
			agent_id: parsedValue.agent_id.trim(),
			machine_label: parsedValue.machine_label?.trim() || undefined,
		};
	} catch {
		return null;
	}
}

async function writeDeviceIdentityRecord(record: DesktopAgentDeviceIdentityRecord): Promise<void> {
	const filePath = getDeviceIdentityFilePath();

	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, JSON.stringify(record, null, 2), 'utf8');
}

function createDefaultMachineLabel(): string {
	const normalizedHostname = hostname().trim();
	return normalizedHostname.length > 0 ? normalizedHostname : 'Runa Desktop';
}

function sanitizeDesktopWebUrl(url: URL): URL {
	const sanitizedUrl = new URL(url.toString());

	for (const paramName of [...sanitizedUrl.searchParams.keys()]) {
		if (sensitiveDesktopWebUrlParams.has(paramName.toLowerCase())) {
			sanitizedUrl.searchParams.delete(paramName);
		}
	}

	if (sanitizedUrl.hash.length > 1) {
		const hashParams = new URLSearchParams(sanitizedUrl.hash.slice(1));
		let removedHashSecret = false;

		for (const paramName of [...hashParams.keys()]) {
			if (sensitiveDesktopWebUrlParams.has(paramName.toLowerCase())) {
				hashParams.delete(paramName);
				removedHashSecret = true;
			}
		}

		if (removedHashSecret) {
			const nextHash = hashParams.toString();
			sanitizedUrl.hash = nextHash.length > 0 ? nextHash : '';
		}
	}

	return sanitizedUrl;
}

function readDesktopWebUrlFromEnvironment(): URL | null {
	const explicitCandidate =
		process.env.RUNA_DESKTOP_WEB_URL !== undefined
			? process.env.RUNA_DESKTOP_WEB_URL
			: process.env.RUNA_WEB_URL;
	const candidate =
		explicitCandidate !== undefined
			? explicitCandidate.trim()
			: app.isPackaged && process.env.RUNA_DESKTOP_DISABLE_WEB_FALLBACK !== '1'
				? 'https://app.runa.app'
				: '';

	if (candidate.length === 0) {
		configurationErrorMessage =
			'Runa web app is not configured yet. Set the desktop web URL and try again.';
		return null;
	}

	let parsedUrl: URL;

	try {
		parsedUrl = new URL(candidate);
	} catch {
		configurationErrorMessage =
			'Runa web app URL is invalid. Check the desktop configuration and try again.';
		return null;
	}

	if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
		configurationErrorMessage =
			'Runa web app URL must use http or https. Check the desktop configuration and try again.';
		return null;
	}

	configurationErrorMessage = null;
	return sanitizeDesktopWebUrl(parsedUrl);
}

function readDesktopWebUrlForLog(url: URL | null): Record<string, string> {
	if (!url) {
		return {
			mode: 'internal',
		};
	}

	return {
		mode: 'web',
		origin: url.origin,
		pathname: url.pathname,
	};
}

function readUrlForLog(rawUrl: string): Record<string, boolean | string> {
	try {
		const parsedUrl = new URL(rawUrl);

		return {
			has_hash: parsedUrl.hash.length > 0,
			has_search: parsedUrl.search.length > 0,
			origin: parsedUrl.origin,
			pathname: parsedUrl.pathname,
			protocol: parsedUrl.protocol,
		};
	} catch {
		return {
			pathname: 'unparseable',
		};
	}
}

function readSmokeShutdownFileFromEnvironment(): string | null {
	const candidate = process.env.RUNA_DESKTOP_AGENT_SMOKE_SHUTDOWN_FILE?.trim();
	return candidate && candidate.length > 0 ? candidate : null;
}

function readSmokeSignOutFileFromEnvironment(): string | null {
	const candidate = process.env.RUNA_DESKTOP_AGENT_SMOKE_SIGN_OUT_FILE?.trim();
	return candidate && candidate.length > 0 ? candidate : null;
}

async function signOutFromSmokeControl(signOutFilePath: string): Promise<void> {
	if (smokeSignOutInProgress) {
		return;
	}

	smokeSignOutInProgress = true;
	logBoot('smoke:sign-out-requested');

	try {
		await rm(signOutFilePath, { force: true });
	} catch (error: unknown) {
		logBoot('smoke:sign-out-file-remove-failed', {
			error: error instanceof Error ? error.message : String(error),
		});
	}

	try {
		await controller?.signOut();
	} catch (error: unknown) {
		logBoot('smoke:sign-out-failed', {
			error: error instanceof Error ? error.message : String(error),
		});
	} finally {
		smokeSignOutInProgress = false;
	}
}

async function shutdownFromSmokeControl(shutdownFilePath: string): Promise<void> {
	if (smokeShutdownInProgress) {
		return;
	}

	smokeShutdownInProgress = true;
	isQuitting = true;
	logBoot('smoke:shutdown-requested');

	if (smokeShutdownWatchHandle) {
		clearInterval(smokeShutdownWatchHandle);
		smokeShutdownWatchHandle = null;
	}

	try {
		await rm(shutdownFilePath, { force: true });
	} catch (error: unknown) {
		logBoot('smoke:shutdown-file-remove-failed', {
			error: error instanceof Error ? error.message : String(error),
		});
	}

	try {
		await controller?.stop();
	} catch (error: unknown) {
		logBoot('smoke:shutdown-stop-failed', {
			error: error instanceof Error ? error.message : String(error),
		});
	}

	app.quit();
}

function registerSmokeShutdownFileWatcher(): void {
	const shutdownFilePath = readSmokeShutdownFileFromEnvironment();
	if (!shutdownFilePath || smokeShutdownWatchHandle) {
		return;
	}

	smokeShutdownWatchHandle = setInterval(() => {
		if (!existsSync(shutdownFilePath)) {
			return;
		}

		void shutdownFromSmokeControl(shutdownFilePath);
	}, 250);
	smokeShutdownWatchHandle.unref?.();
	logBoot('smoke:shutdown-watch-enabled');
}

function registerSmokeSignOutFileWatcher(): void {
	const signOutFilePath = readSmokeSignOutFileFromEnvironment();
	if (!signOutFilePath || smokeSignOutWatchHandle) {
		return;
	}

	smokeSignOutWatchHandle = setInterval(() => {
		if (!existsSync(signOutFilePath)) {
			return;
		}

		void signOutFromSmokeControl(signOutFilePath);
	}, 250);
	smokeSignOutWatchHandle.unref?.();
	logBoot('smoke:sign-out-watch-enabled');
}

async function reconnectControllerAfterPowerResume(): Promise<void> {
	if (!controller) {
		logBoot('power:resume-reconnect-skipped', {
			reason: 'missing_controller',
		});
		return;
	}

	const snapshot = controller.getSnapshot();
	logBoot('power:resume-detected', {
		session_present: snapshot.session_present,
		status: snapshot.status,
	});

	if (!snapshot.session_present) {
		logBoot('power:resume-reconnect-skipped', {
			reason: 'missing_session',
			status: snapshot.status,
		});
		return;
	}

	try {
		await controller.stop();
		await controller.start();
		publishCurrentViewModel();
		logBoot('power:resume-reconnect-completed', {
			status: controller.getSnapshot().status,
		});
	} catch (error: unknown) {
		logBoot('power:resume-reconnect-failed', {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

function registerPowerMonitorHandlers(): void {
	powerMonitor.on('suspend', () => {
		logBoot('power:suspend-detected');
	});
	powerMonitor.on('resume', () => {
		void reconnectControllerAfterPowerResume();
	});
	logBoot('power:monitor-watch-enabled');
}

function describeSessionPayloadForLog(payload: unknown): Record<string, boolean | string> {
	if (!isRecord(payload)) {
		return {
			payload_type: typeof payload,
		};
	}

	return {
		has_access_token: typeof payload['access_token'] === 'string',
		has_expires_at: typeof payload['expires_at'] === 'number',
		has_refresh_token: typeof payload['refresh_token'] === 'string',
		has_token_type: typeof payload['token_type'] === 'string',
		payload_type: 'object',
	};
}

async function ensureDesktopAgentBootstrapEnvironment(webUrl: URL | null): Promise<void> {
	const existingAgentId = process.env.RUNA_DESKTOP_AGENT_ID?.trim();
	const existingMachineLabel = process.env.RUNA_DESKTOP_AGENT_MACHINE_LABEL?.trim();
	const storedIdentity = await readDeviceIdentityRecord();
	const nextIdentity: DesktopAgentDeviceIdentityRecord = {
		agent_id:
			existingAgentId && existingAgentId.length > 0
				? existingAgentId
				: (storedIdentity?.agent_id ?? `runa-desktop-${randomUUID()}`),
		machine_label:
			existingMachineLabel && existingMachineLabel.length > 0
				? existingMachineLabel
				: (storedIdentity?.machine_label ?? createDefaultMachineLabel()),
	};

	process.env.RUNA_DESKTOP_AGENT_ID = nextIdentity.agent_id;
	process.env.RUNA_DESKTOP_AGENT_MACHINE_LABEL = nextIdentity.machine_label;
	await writeDeviceIdentityRecord(nextIdentity);

	if (!process.env.RUNA_DESKTOP_AGENT_SERVER_URL?.trim() && webUrl) {
		process.env.RUNA_DESKTOP_AGENT_SERVER_URL = webUrl.origin;
	}
}

const bootLogger: Pick<DesktopAgentLogger, 'warn'> = {
	warn: (message: string): void => {
		const safeMessage = redactPii(message);
		const printableMessage =
			typeof safeMessage === 'string' ? safeMessage : JSON.stringify(safeMessage);
		console.warn(`[boot:warn] ${printableMessage}`);
		desktopLogger.warn(`[boot:warn] ${printableMessage}`);
	},
};

const settingsStore = createFileDesktopAgentSettingsStore(app.getPath('userData'));

protocol.registerSchemesAsPrivileged([
	{
		privileges: {
			secure: true,
			standard: true,
			supportFetchAPI: true,
		},
		scheme: 'runa-desktop',
	},
]);

function getAppDir(): string {
	return dirname(__filename);
}

function resolvePackagedPath(...segments: readonly string[]): string {
	return join(getAppDir(), ...segments);
}

function createFallbackViewModel(): DesktopAgentLaunchControllerViewModel {
	return {
		agent_id: 'unconfigured',
		awaiting_session_input: false,
		message:
			rendererFallbackErrorMessage ?? configurationErrorMessage ?? 'Desktop runtime setup failed.',
		primary_action: {
			id: 'retry',
			label: 'Try again',
		},
		session_present: false,
		status: 'error',
		title: rendererFallbackErrorMessage ? 'Runa Desktop needs setup' : 'Connection failed',
	};
}

function getViewModel(): DesktopAgentLaunchControllerViewModel {
	if (rendererFallbackErrorMessage) {
		return createFallbackViewModel();
	}

	return controller?.getViewModel() ?? createFallbackViewModel();
}

function projectViewModelToLegacyShellState(
	viewModel: DesktopAgentLaunchControllerViewModel,
): LegacyShellState {
	switch (viewModel.status) {
		case 'bootstrapping':
		case 'connecting':
			return {
				agentConnected: false,
				sessionValid: viewModel.session_present,
				status: 'connecting',
			};
		case 'connected':
			return {
				agentConnected: true,
				sessionValid: true,
				status: 'connected',
			};
		case 'error':
			return {
				agentConnected: false,
				errorMessage: viewModel.message,
				sessionValid: viewModel.session_present,
				status: 'error',
			};
		case 'awaiting_session_input':
		case 'needs_sign_in':
			return {
				agentConnected: false,
				sessionValid: false,
				status: 'needs_sign_in',
			};
		case 'ready':
			return {
				agentConnected: false,
				sessionValid: true,
				status: 'stopped',
			};
	}
}

function isDesktopAgentSessionInputPayload(
	value: unknown,
): value is DesktopAgentSessionInputPayload {
	if (!isRecord(value)) {
		return false;
	}

	const expiresAt = value.expires_at;

	return (
		typeof value.access_token === 'string' &&
		(value.refresh_token === undefined || typeof value.refresh_token === 'string') &&
		(expiresAt === undefined || typeof expiresAt === 'number') &&
		(value.token_type === undefined || typeof value.token_type === 'string')
	);
}

function isShellInvokeActionPayload(value: unknown): value is ShellInvokeActionPayload {
	if (!isRecord(value)) {
		return false;
	}

	return (
		value.actionId === 'connect' ||
		value.actionId === 'connecting' ||
		value.actionId === 'retry' ||
		value.actionId === 'sign_in' ||
		value.actionId === 'sign_out'
	);
}

function isSettingsPatch(value: unknown): value is Partial<DesktopAgentSettingsStoreState> {
	if (!isRecord(value)) {
		return false;
	}

	return (
		(value['autoStart'] === undefined || typeof value['autoStart'] === 'boolean') &&
		(value['openWindowOnStart'] === undefined || typeof value['openWindowOnStart'] === 'boolean') &&
		(value['telemetryOptIn'] === undefined || typeof value['telemetryOptIn'] === 'boolean')
	);
}

function applyLoginItemSettings(settings: DesktopAgentSettingsStoreState): void {
	app.setLoginItemSettings({
		args: ['--hidden'],
		openAsHidden: !settings.openWindowOnStart,
		openAtLogin: settings.autoStart,
	});
}

async function updateSettings(
	patch: Partial<DesktopAgentSettingsStoreState>,
): Promise<DesktopAgentSettingsStoreState> {
	currentSettings = await settingsStore.update(patch);
	applyLoginItemSettings(currentSettings);
	createTrayMenu();
	return currentSettings;
}

async function openLogFolder(): Promise<void> {
	await electronShell.openPath(join(app.getPath('userData'), 'logs'));
}

async function openCrashFolder(): Promise<void> {
	await electronShell.openPath(getCrashpadDirectoryPath());
}

async function copyDiagnosticsSnapshot(): Promise<void> {
	const snapshot = await createDesktopAgentDiagnosticsSnapshot({
		appVersion: app.getVersion(),
		arch: process.arch,
		electronVersion: process.versions.electron,
		locale: app.getLocale(),
		logFilePath: getMainLogFilePath(),
		nodeVersion: process.versions.node,
		platform: process.platform,
		runtimeStatus: getViewModel().status,
		settings: currentSettings,
	});

	clipboard.writeText(JSON.stringify(snapshot, null, 2));
	logBoot('diagnostics:copied');
}

async function handleDeepLinkArgv(argv: readonly string[]): Promise<void> {
	const payload = findDesktopPairingCodeInArgv(argv);

	if (!payload || !controller) {
		return;
	}

	showMainWindow();
	await controller.handlePairingCode(payload.code);
}

function resolveRendererAssetPath(requestUrl: string): string | null {
	let parsedUrl: URL;

	try {
		parsedUrl = new URL(requestUrl);
	} catch {
		return null;
	}

	const assetPath = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/u, '')) || 'index.html';

	if (assetPath.split('/').includes('..')) {
		return null;
	}

	return resolvePackagedPath('renderer', assetPath);
}

function resolveRendererAssetContentType(filePath: string): string {
	if (filePath.endsWith('.css')) {
		return 'text/css; charset=utf-8';
	}

	if (filePath.endsWith('.js')) {
		return 'text/javascript; charset=utf-8';
	}

	if (filePath.endsWith('.html')) {
		return 'text/html; charset=utf-8';
	}

	return 'application/octet-stream';
}

function registerRendererProtocol(): void {
	protocol.handle('runa-desktop', async (request) => {
		const assetPath = resolveRendererAssetPath(request.url);

		if (!assetPath) {
			return new Response('Not found', { status: 404 });
		}

		try {
			const body = await readFile(assetPath);
			return new Response(body, {
				headers: {
					'content-type': resolveRendererAssetContentType(assetPath),
				},
			});
		} catch {
			return new Response('Not found', { status: 404 });
		}
	});
}

function publishCurrentViewModel(): void {
	mainWindow?.webContents.send('shell:viewModel', getViewModel());
	mainWindow?.webContents.send(
		'shell:stateChanged',
		projectViewModelToLegacyShellState(getViewModel()),
	);
}

async function loadInternalRendererFallback(message: string): Promise<void> {
	if (!mainWindow || rendererFallbackErrorMessage) {
		return;
	}

	rendererFallbackErrorMessage = message;
	logBoot('window:fallback-renderer-selected', {
		reason: message,
	});

	await mainWindow.loadURL('runa-desktop://app/index.html');
	publishCurrentViewModel();
}

async function invokeControllerAction(
	actionId: ShellInvokeActionPayload['actionId'],
): Promise<DesktopAgentLaunchControllerViewModel> {
	if (!controller) {
		return getViewModel();
	}

	await controller.invokeAction(actionId);
	return controller.getViewModel();
}

async function stopController(): Promise<DesktopAgentLaunchControllerViewModel> {
	if (!controller) {
		return getViewModel();
	}

	await controller.stop();
	return controller.getViewModel();
}

async function signOutController(): Promise<DesktopAgentLaunchControllerViewModel> {
	if (!controller) {
		logBoot('session:sign-out-skipped', { reason: 'missing_controller' });
		return getViewModel();
	}

	await controller.signOut();
	logBoot('session:sign-out-handled');
	return controller.getViewModel();
}

async function submitSession(payload: unknown): Promise<DesktopAgentLaunchControllerViewModel> {
	logBoot('session:submit-received', describeSessionPayloadForLog(payload));

	if (!controller) {
		logBoot('session:submit-rejected', { reason: 'missing_controller' });
		return getViewModel();
	}

	if (!isDesktopAgentSessionInputPayload(payload)) {
		logBoot('session:submit-rejected', { reason: 'invalid_payload' });
		return getViewModel();
	}

	await controller.submitSession(payload);
	logBoot('session:submit-handled', {
		view_model_status: controller.getViewModel().status,
	});
	return controller.getViewModel();
}

function isConfiguredDesktopWebNavigation(url: string): boolean {
	if (!configuredDesktopWebUrl) {
		return false;
	}

	try {
		const parsedUrl = new URL(url);
		return (
			(parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') &&
			parsedUrl.origin === configuredDesktopWebUrl.origin
		);
	} catch {
		return false;
	}
}

async function createControllerFromEnvironment(): Promise<void> {
	try {
		await ensureDesktopAgentBootstrapEnvironment(configuredDesktopWebUrl);
		const config = readDesktopAgentBootstrapConfigFromEnvironment();
		const sessionStorageSelection = createDesktopAgentSessionStorageForSafeStorage({
			logger: bootLogger,
			safeStorage,
			userDataDirectory: app.getPath('userData'),
		});
		insecureStorageWarning = sessionStorageSelection.insecure_storage;
		const storedSession = await readStoredSessionForBootstrap(sessionStorageSelection.storage);
		const initialSession = config.initial_session ?? storedSession ?? undefined;
		controller = createDesktopAgentLaunchController({
			...config,
			initial_session: initialSession,
			bridge_factory: async (bridgeOptions) =>
				await startDesktopAgentBridge({
					...bridgeOptions,
					web_socket_factory: createNodeWebSocket,
				}),
			host: createElectronDesktopAgentWindowHost({
				insecureStorageWarning,
				mainWindow,
				tray,
			}),
			logger: bootLogger,
			session_storage: sessionStorageSelection.storage,
		});
		configurationErrorMessage = null;
		logBoot('runtime:configured', {
			agent_id: config.agent_id,
			has_initial_session: initialSession !== undefined,
			machine_label: config.machine_label,
			server_url: config.server_url,
			storage_mode: insecureStorageWarning ? 'plaintext' : 'encrypted',
		});
	} catch (error: unknown) {
		configurationErrorMessage =
			error instanceof Error ? error.message : 'Desktop runtime setup failed.';
		logBoot('runtime:configuration-error', {
			error: configurationErrorMessage,
		});
	}
}

async function readStoredSessionForBootstrap(
	sessionStorage: DesktopAgentSessionStorage,
): Promise<DesktopAgentPersistedSession | null> {
	try {
		return await sessionStorage.load();
	} catch (error: unknown) {
		logBoot('runtime:stored-session-load-failed', {
			error: error instanceof Error ? error.message : 'Stored desktop session could not be loaded.',
		});
		return null;
	}
}

function createTray(): void {
	const iconPath = resolvePackagedPath('../build/icon.png');
	const trayIcon = existsSync(iconPath)
		? nativeImage.createFromPath(iconPath)
		: nativeImage.createEmpty();

	tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon);
	createTrayMenu();
}

function createTrayMenu(): void {
	if (!tray) {
		return;
	}

	tray.setContextMenu(
		Menu.buildFromTemplate([
			{
				click: () => showMainWindow(),
				label: 'Open Runa Desktop',
			},
			{ type: 'separator' },
			{
				click: () => {
					void invokeControllerAction('connect');
				},
				label: 'Connect',
			},
			{
				click: () => {
					void stopController();
				},
				label: 'Disconnect',
			},
			{ type: 'separator' },
			{
				click: () => {
					void signOutController();
				},
				label: 'Sign out',
			},
			{ type: 'separator' },
			{
				checked: currentSettings.autoStart,
				click: () => {
					void updateSettings({
						autoStart: !currentSettings.autoStart,
					});
				},
				label: 'Start with Windows',
				type: 'checkbox',
			},
			{ type: 'separator' },
			{
				click: () => {
					void openLogFolder();
				},
				label: 'Open log folder',
			},
			{
				click: () => {
					void openCrashFolder();
				},
				label: 'Open crash folder',
			},
			{
				click: () => {
					void copyDiagnosticsSnapshot();
				},
				label: 'Copy diagnostics',
			},
			{ type: 'separator' },
			{
				click: () => app.quit(),
				label: 'Quit Runa Desktop',
			},
		]),
	);
}

function createMainWindow(): void {
	logBoot('window:create-start');
	mainWindow = new BrowserWindow({
		height: 800,
		show: false,
		title: 'Runa Desktop',
		webPreferences: {
			allowRunningInsecureContent: false,
			contextIsolation: true,
			experimentalFeatures: false,
			webSecurity: true,
			nodeIntegration: false,
			preload: resolvePackagedPath('preload.cjs'),
			sandbox: true,
		},
		width: 1200,
	});

	mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
	mainWindow.webContents.on('will-navigate', (event, url) => {
		if (isConfiguredDesktopWebNavigation(url)) {
			return;
		}

		event.preventDefault();

		if (isAllowedExternalUrl(url, allowedExternalUrlPolicy)) {
			void electronShell.openExternal(url);
		}
	});
	mainWindow.webContents.on('did-finish-load', () => {
		logBoot('window:did-finish-load', readUrlForLog(mainWindow?.webContents.getURL() ?? ''));
	});
	mainWindow.webContents.on(
		'did-fail-load',
		(_event, errorCode, _errorDescription, validatedUrl, isMainFrame) => {
			if (!isMainFrame || errorCode === -3 || !isConfiguredDesktopWebNavigation(validatedUrl)) {
				return;
			}

			void loadInternalRendererFallback(
				'Runa web app is unavailable right now. Check your desktop server/web configuration and try again.',
			);
		},
	);
	const initialRendererUrl = configuredDesktopWebUrl?.toString() ?? 'runa-desktop://app/index.html';
	mainWindow.loadURL(initialRendererUrl);
	mainWindow.once('ready-to-show', () => {
		logBoot('window:ready-to-show', readDesktopWebUrlForLog(configuredDesktopWebUrl));
		if (!startHidden) {
			mainWindow?.show();
		}
		publishCurrentViewModel();
	});
	mainWindow.on('close', (event) => {
		if (!isQuitting) {
			event.preventDefault();
			mainWindow?.hide();
		}
	});
	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

function showMainWindow(): void {
	if (!mainWindow) {
		createMainWindow();
		return;
	}

	mainWindow.show();
	mainWindow.focus();
}

function registerIpcHandlers(): void {
	ipcMain.handle('shell:getViewModel', () => getViewModel());
	ipcMain.handle('shell:invokeAction', async (_event, payload: unknown) => {
		if (!isShellInvokeActionPayload(payload)) {
			return getViewModel();
		}

		return await invokeControllerAction(payload.actionId);
	});
	ipcMain.handle(
		'session:submit',
		async (_event, payload: unknown) => await submitSession(payload),
	);
	ipcMain.handle('settings:get', () => currentSettings);
	ipcMain.handle('settings:update', async (_event, payload: unknown) => {
		if (!isSettingsPatch(payload)) {
			return currentSettings;
		}

		return await updateSettings(payload);
	});

	// Deprecated compatibility adapter. Remove in desktop IPC v2.
	ipcMain.handle('agent:getStatus', () => projectViewModelToLegacyShellState(getViewModel()));
	// Deprecated compatibility adapter. Remove in desktop IPC v2.
	ipcMain.handle('shell:getState', () => projectViewModelToLegacyShellState(getViewModel()));
	// Deprecated compatibility adapter. Remove in desktop IPC v2.
	ipcMain.handle('shell:connect', async () => await invokeControllerAction('connect'));
	// Deprecated compatibility adapter. Remove in desktop IPC v2.
	ipcMain.handle('shell:disconnect', async () => await stopController());
	// Deprecated compatibility adapter. Remove in desktop IPC v2.
	ipcMain.handle(
		'session:signIn',
		async (_event, payload: unknown) => await submitSession(payload),
	);
	// Deprecated compatibility adapter. Remove in desktop IPC v2.
	ipcMain.handle('session:signOut', async () => await signOutController());
}

if (!gotSingleInstanceLock) {
	app.quit();
} else {
	app.on('second-instance', (_event, argv) => {
		showMainWindow();
		void handleDeepLinkArgv(argv);
	});

	app.on('open-url', (event, url) => {
		event.preventDefault();
		void handleDeepLinkArgv([url]);
	});

	app
		.whenReady()
		.then(async () => {
			logBoot('app-ready');
			currentSettings = await settingsStore.load();
			applyLoginItemSettings(currentSettings);
			app.setAsDefaultProtocolClient('runa');
			session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
				callback(false);
			});
			session.defaultSession.setPermissionCheckHandler(() => false);
			logBoot('electron-version', {
				electron_version: process.versions.electron,
			});
			configuredDesktopWebUrl = readDesktopWebUrlFromEnvironment();
			logBoot('window:renderer-selected', readDesktopWebUrlForLog(configuredDesktopWebUrl));
			registerRendererProtocol();
			registerIpcHandlers();
			registerSmokeShutdownFileWatcher();
			registerSmokeSignOutFileWatcher();
			registerPowerMonitorHandlers();
			createTray();
			createMainWindow();
			await createControllerFromEnvironment();
			await handleDeepLinkArgv(process.argv);
			await controller?.start();
			logBoot('main-process:boot-complete');
		})
		.catch((error: unknown) => {
			logBoot('main-process:boot-error', {
				error: error instanceof Error ? error.message : String(error),
			});
			app.quit();
		});
}

app.on('window-all-closed', () => {
	logBoot('window-all-closed');
});

app.on('before-quit', () => {
	isQuitting = true;
	if (smokeShutdownWatchHandle) {
		clearInterval(smokeShutdownWatchHandle);
		smokeShutdownWatchHandle = null;
	}
	if (smokeSignOutWatchHandle) {
		clearInterval(smokeSignOutWatchHandle);
		smokeSignOutWatchHandle = null;
	}
	logBoot('app:before-quit');
	tray?.destroy();
	tray = null;
	void controller?.stop();
});

process.on('uncaughtException', (error) => {
	logBoot('process:uncaught-exception', {
		error: error.message,
		stack: error.stack,
	});
	desktopLogger.error('uncaught', error);
});

process.on('unhandledRejection', (reason) => {
	logBoot('process:unhandled-rejection', { reason: String(reason) });
	desktopLogger.error('unhandled', reason);
});
