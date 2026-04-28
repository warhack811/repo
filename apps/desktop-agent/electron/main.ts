import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { BrowserWindow, Menu, Tray, app, ipcMain, nativeImage } from 'electron';

import {
	type DesktopAgentRuntimeSnapshot,
	createDesktopAgentSessionRuntime,
	createFileDesktopAgentSessionStorage,
	createNodeWebSocket,
	normalizeDesktopAgentSessionInputPayload,
	readDesktopAgentBootstrapConfigFromEnvironment,
	startDesktopAgentBridge,
} from '../src/index.js';

type ShellState = Readonly<{
	agentConnected: boolean;
	errorMessage?: string;
	sessionValid: boolean;
	status: 'connected' | 'connecting' | 'error' | 'needs_sign_in' | 'stopped';
}>;

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let runtime: ReturnType<typeof createDesktopAgentSessionRuntime> | null = null;
let currentShellState: ShellState = {
	agentConnected: false,
	sessionValid: false,
	status: 'stopped',
};

function logBoot(message: string, data?: unknown): void {
	const payload = data === undefined ? '' : ` ${JSON.stringify(data)}`;
	console.log(`[boot:${message}]${payload}`);
}

const userDataDirectoryOverride = process.env.RUNA_DESKTOP_AGENT_USER_DATA_DIR?.trim();
if (userDataDirectoryOverride) {
	app.setPath('userData', userDataDirectoryOverride);
}

function getAppDir(): string {
	return dirname(__filename);
}

function resolvePackagedPath(...segments: readonly string[]): string {
	return join(getAppDir(), ...segments);
}

function mapRuntimeSnapshotToShellState(snapshot: DesktopAgentRuntimeSnapshot): ShellState {
	switch (snapshot.status) {
		case 'bootstrapping':
		case 'bridge_connecting':
			return {
				agentConnected: false,
				sessionValid: 'session' in snapshot,
				status: 'connecting',
			};
		case 'bridge_connected':
			return {
				agentConnected: true,
				sessionValid: true,
				status: 'connected',
			};
		case 'bridge_error':
			return {
				agentConnected: false,
				errorMessage: snapshot.error_message,
				sessionValid: true,
				status: 'error',
			};
		case 'signed_in':
			return {
				agentConnected: false,
				sessionValid: true,
				status: 'stopped',
			};
		case 'signed_out':
			return {
				agentConnected: false,
				errorMessage: snapshot.error_message,
				sessionValid: false,
				status: 'needs_sign_in',
			};
	}
}

function broadcastShellState(): void {
	mainWindow?.webContents.send('shell:stateChanged', currentShellState);

	if (!tray) {
		return;
	}

	const toolTips: Record<ShellState['status'], string> = {
		connected: 'Runa Desktop - Connected',
		connecting: 'Runa Desktop - Connecting...',
		error: 'Runa Desktop - Connection needs attention',
		needs_sign_in: 'Runa Desktop - Sign in required',
		stopped: 'Runa Desktop - Disconnected',
	};

	tray.setToolTip(toolTips[currentShellState.status]);
}

function setShellState(nextState: ShellState): void {
	currentShellState = nextState;
	logBoot('shell-state-update', nextState);
	broadcastShellState();
}

async function startRuntime(): Promise<ShellState> {
	if (!runtime) {
		return currentShellState;
	}

	setShellState({
		...currentShellState,
		status: 'connecting',
	});
	const snapshot = await runtime.start();
	const nextState = mapRuntimeSnapshotToShellState(snapshot);
	setShellState(nextState);
	return nextState;
}

async function stopRuntime(): Promise<ShellState> {
	if (!runtime) {
		return currentShellState;
	}

	const snapshot = await runtime.stop();
	const nextState = mapRuntimeSnapshotToShellState(snapshot);
	setShellState(nextState);
	return nextState;
}

async function signOutRuntime(): Promise<ShellState> {
	if (!runtime) {
		return currentShellState;
	}

	const snapshot = await runtime.signOut();
	const nextState = mapRuntimeSnapshotToShellState(snapshot);
	setShellState(nextState);
	return nextState;
}

async function submitSession(payload: unknown): Promise<ShellState> {
	if (!runtime) {
		return currentShellState;
	}

	const session = normalizeDesktopAgentSessionInputPayload(
		payload as Parameters<typeof normalizeDesktopAgentSessionInputPayload>[0],
	);
	await runtime.setSession(session);
	return await startRuntime();
}

function createRuntimeFromEnvironment(): void {
	try {
		const config = readDesktopAgentBootstrapConfigFromEnvironment();
		runtime = createDesktopAgentSessionRuntime({
			...config,
			bridge_factory: async (bridgeOptions) =>
				await startDesktopAgentBridge({
					...bridgeOptions,
					web_socket_factory: createNodeWebSocket,
				}),
			session_storage: createFileDesktopAgentSessionStorage(app.getPath('userData')),
		});
		setShellState(mapRuntimeSnapshotToShellState(runtime.getSnapshot()));
		logBoot('runtime:configured', {
			agent_id: config.agent_id,
			has_initial_session: config.initial_session !== undefined,
			machine_label: config.machine_label,
			server_url: config.server_url,
		});
	} catch (error: unknown) {
		setShellState({
			agentConnected: false,
			errorMessage: error instanceof Error ? error.message : 'Desktop runtime setup failed.',
			sessionValid: false,
			status: 'needs_sign_in',
		});
		logBoot('runtime:configuration-error', {
			error: error instanceof Error ? error.message : String(error),
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
					void startRuntime();
				},
				label: 'Connect',
			},
			{
				click: () => {
					void stopRuntime();
				},
				label: 'Disconnect',
			},
			{ type: 'separator' },
			{
				click: () => {
					void signOutRuntime();
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
	broadcastShellState();
}

function createMainWindow(): void {
	logBoot('window:create-start');
	mainWindow = new BrowserWindow({
		height: 800,
		show: false,
		title: 'Runa Desktop',
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: resolvePackagedPath('preload.cjs'),
			sandbox: false,
		},
		width: 1200,
	});

	mainWindow.loadFile(resolvePackagedPath('renderer/index.html'));
	mainWindow.once('ready-to-show', () => {
		logBoot('window:ready-to-show');
		mainWindow?.show();
		broadcastShellState();
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
	ipcMain.handle('agent:getStatus', () => currentShellState);
	ipcMain.handle('shell:getState', () => currentShellState);
	ipcMain.handle('shell:connect', async () => await startRuntime());
	ipcMain.handle('shell:disconnect', async () => await stopRuntime());
	ipcMain.handle(
		'session:signIn',
		async (_event, payload: unknown) => await submitSession(payload),
	);
	ipcMain.handle('session:signOut', async () => await signOutRuntime());
}

app
	.whenReady()
	.then(async () => {
		logBoot('app-ready');
		registerIpcHandlers();
		createRuntimeFromEnvironment();
		createTray();
		createMainWindow();
		await startRuntime();
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
	void stopRuntime();
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
