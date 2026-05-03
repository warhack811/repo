import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
	BrowserWindow,
	Menu,
	Tray,
	app,
	shell as electronShell,
	ipcMain,
	nativeImage,
	protocol,
	session,
} from 'electron';

import {
	type DesktopAgentLaunchController,
	type DesktopAgentLaunchControllerViewModel,
	type DesktopAgentSessionInputPayload,
	createDesktopAgentLaunchController,
	createElectronDesktopAgentWindowHost,
	createFileDesktopAgentSessionStorage,
	createNodeWebSocket,
	isAllowedExternalUrl,
	readAllowedExternalUrlPolicy,
	readDesktopAgentBootstrapConfigFromEnvironment,
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
const allowedExternalUrlPolicy = readAllowedExternalUrlPolicy();

function logBoot(message: string, data?: unknown): void {
	const payload = data === undefined ? '' : ` ${JSON.stringify(data)}`;
	console.log(`[boot:${message}]${payload}`);
}

const userDataDirectoryOverride = process.env.RUNA_DESKTOP_AGENT_USER_DATA_DIR?.trim();
if (userDataDirectoryOverride) {
	app.setPath('userData', userDataDirectoryOverride);
}

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
		controller = createDesktopAgentLaunchController({
			...config,
			bridge_factory: async (bridgeOptions) =>
				await startDesktopAgentBridge({
					...bridgeOptions,
					web_socket_factory: createNodeWebSocket,
				}),
			host: createElectronDesktopAgentWindowHost({
				mainWindow,
				tray,
			}),
			session_storage: createFileDesktopAgentSessionStorage(app.getPath('userData')),
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
		mainWindow?.show();
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

app
	.whenReady()
	.then(async () => {
		logBoot('app-ready');
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
		await controller?.start();
		logBoot('main-process:boot-complete');
	})
	.catch((error: unknown) => {
		logBoot('main-process:boot-error', {
			error: error instanceof Error ? error.message : String(error),
		});
		app.quit();
	});

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
});

process.on('unhandledRejection', (reason) => {
	logBoot('process:unhandled-rejection', { reason: String(reason) });
});
