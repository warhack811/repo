import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
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
	protocol,
	safeStorage,
	session,
} from 'electron';

import type { DesktopAgentSettingsStoreState } from '@runa/types';

import {
	type DesktopAgentLaunchController,
	type DesktopAgentLaunchControllerViewModel,
	type DesktopAgentLogger,
	type DesktopAgentSessionInputPayload,
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

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let controller: DesktopAgentLaunchController | null = null;
let configurationErrorMessage: string | null = null;
let insecureStorageWarning = false;
const gotSingleInstanceLock = app.requestSingleInstanceLock();
const allowedExternalUrlPolicy = readAllowedExternalUrlPolicy();
const startHidden = process.argv.includes('--hidden');
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

function logBoot(message: string, data?: unknown): void {
	const safeData = data === undefined ? undefined : redactPii(data);
	const payload = safeData === undefined ? '' : ` ${JSON.stringify(safeData)}`;
	console.log(`[boot:${message}]${payload}`);
	desktopLogger.info(`[boot:${message}]`, safeData ?? {});
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
		message: configurationErrorMessage ?? 'Desktop runtime setup failed.',
		primary_action: {
			id: 'retry',
			label: 'Try again',
		},
		session_present: false,
		status: 'error',
		title: 'Connection failed',
	};
}

function getViewModel(): DesktopAgentLaunchControllerViewModel {
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
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
		typeof value.refresh_token === 'string' &&
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
		return getViewModel();
	}

	await controller.signOut();
	return controller.getViewModel();
}

async function submitSession(payload: unknown): Promise<DesktopAgentLaunchControllerViewModel> {
	if (!controller || !isDesktopAgentSessionInputPayload(payload)) {
		return getViewModel();
	}

	await controller.submitSession(payload);
	return controller.getViewModel();
}

function createControllerFromEnvironment(): void {
	try {
		const config = readDesktopAgentBootstrapConfigFromEnvironment();
		const sessionStorageSelection = createDesktopAgentSessionStorageForSafeStorage({
			logger: bootLogger,
			safeStorage,
			userDataDirectory: app.getPath('userData'),
		});
		insecureStorageWarning = sessionStorageSelection.insecure_storage;
		controller = createDesktopAgentLaunchController({
			...config,
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
			has_initial_session: config.initial_session !== undefined,
			machine_label: config.machine_label,
			server_url: config.server_url,
		});
	} catch (error: unknown) {
		configurationErrorMessage =
			error instanceof Error ? error.message : 'Desktop runtime setup failed.';
		logBoot('runtime:configuration-error', {
			error: configurationErrorMessage,
		});
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
		event.preventDefault();

		if (isAllowedExternalUrl(url, allowedExternalUrlPolicy)) {
			void electronShell.openExternal(url);
		}
	});
	mainWindow.loadURL('runa-desktop://app/index.html');
	mainWindow.once('ready-to-show', () => {
		logBoot('window:ready-to-show');
		if (!startHidden) {
			mainWindow?.show();
		}
		mainWindow?.webContents.send('shell:viewModel', getViewModel());
		mainWindow?.webContents.send(
			'shell:stateChanged',
			projectViewModelToLegacyShellState(getViewModel()),
		);
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
			registerRendererProtocol();
			registerIpcHandlers();
			createTray();
			createMainWindow();
			createControllerFromEnvironment();
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
