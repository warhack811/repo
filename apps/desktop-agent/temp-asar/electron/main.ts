/**
 * Runa Desktop Agent - Electron Main Process
 *
 * Entry point for the packaged Electron application.
 * Uses explicit Promise chain instead of top-level await to avoid
 * silent exit in packaged V8 context.
 *
 * Built as CommonJS for Electron compatibility.
 */

import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';

// Use __dirname directly for CJS - esbuild will resolve it at build time
// For the main entry, we use process.cwd() as base

// Boot logging for liveness detection
function logBoot(message: string, data?: unknown): void {
	const timestamp = new Date().toISOString();
	const payload = data !== undefined ? ` ${JSON.stringify(data)}` : '';
	console.log(`[boot:${message}]${payload}`);
}

// Get the directory where the script is located
function getAppDir(): string {
	return path.dirname(__filename);
}

// Tray state
let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

// Desktop agent shell state for tray mapping
type ShellState =
	| 'needs_sign_in'
	| 'connecting'
	| 'connected'
	| 'error'
	| 'stopped';

let currentShellState: ShellState = 'stopped';

function createTray(): void {
	const appDir = getAppDir();
	const iconPath = path.join(appDir, '../build/icon.png');
	const trayIcon = nativeImage.createFromPath(iconPath);

	tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon);

	const contextMenu = Menu.buildFromTemplate([
		{
			label: 'Open Runa Desktop',
			click: () => {
				showMainWindow();
			},
		},
		{ type: 'separator' },
		{
			label: 'Connect',
			click: () => {
				logBoot('tray:connect-clicked');
				updateShellState('connecting');
			},
		},
		{
			label: 'Disconnect',
			click: () => {
				logBoot('tray:disconnect-clicked');
				updateShellState('stopped');
			},
		},
		{ type: 'separator' },
		{
			label: 'Sign out',
			click: () => {
				logBoot('tray:signout-clicked');
				updateShellState('needs_sign_in');
			},
		},
		{ type: 'separator' },
		{
			label: 'Quit Runa Desktop',
			click: () => {
				logBoot('tray:quit-clicked');
				app.quit();
			},
		},
	]);

	tray.setContextMenu(contextMenu);
	tray.setToolTip('Runa Desktop - Disconnected');
}

function updateShellState(state: ShellState): void {
	currentShellState = state;
	logBoot('shell-state-update', { state });

	if (!tray) return;

	const toolTips: Record<ShellState, string> = {
		needs_sign_in: 'Runa Desktop - Sign in required',
		connecting: 'Runa Desktop - Connecting...',
		connected: 'Runa Desktop - Connected',
		error: 'Runa Desktop - Error',
		stopped: 'Runa Desktop - Disconnected',
	};

	tray.setToolTip(toolTips[state]);
}

function createMainWindow(): void {
	const appDir = getAppDir();

	logBoot('window:create-start');

	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		show: false,
		title: 'Runa Desktop',
		webPreferences: {
			preload: path.join(appDir, 'preload.js'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
		},
	});

	// Load the renderer - renderer files are in the parent directory (dist-electron/../electron/renderer/)
	const rendererPath = path.join(appDir, '../electron/renderer/index.html');
	mainWindow.loadFile(rendererPath);

	mainWindow.once('ready-to-show', () => {
		logBoot('window:ready-to-show');
		mainWindow?.show();
	});

	mainWindow.on('close', (event) => {
		// Intercept close to hide window instead of quitting
		if (mainWindow && !isQuitting) {
			event.preventDefault();
			logBoot('window:close-intercepted');
			mainWindow.hide();
		}
	});

	mainWindow.on('closed', () => {
		logBoot('window:closed');
		mainWindow = null;
	});

	logBoot('window:create-end');
}

function showMainWindow(): void {
	if (mainWindow) {
		logBoot('window:show-existing');
		mainWindow.show();
		mainWindow.focus();
	} else {
		logBoot('window:show-new');
		createMainWindow();
	}
}

// App lifecycle - using explicit then chain to avoid top-level await issues
app.whenReady().then(() => {
	logBoot('app-ready');

	try {
		createTray();
		logBoot('tray:created');

		createMainWindow();
		logBoot('main-process:boot-complete');
	} catch (error) {
		logBoot('main-process:boot-error', { error: String(error) });
		app.quit();
	}
});

app.on('window-all-closed', () => {
	logBoot('window-all-closed');
	// Keep app running for tray on Windows
});

app.on('before-quit', () => {
	isQuitting = true;
	logBoot('app:before-quit');

	if (tray) {
		tray.destroy();
		tray = null;
		logBoot('tray:destroyed');
	}
});

app.on('will-quit', (event) => {
	logBoot('app:will-quit');

	// Prevent default quit handling
	event.preventDefault();

	// Perform cleanup and exit gracefully
	Promise.resolve().then(() => {
		logBoot('app:cleanup-complete');
		process.exit(0);
	});
});

app.on('quit', () => {
	logBoot('app:quit');
});

// Error handlers
process.on('uncaughtException', (error) => {
	logBoot('process:uncaught-exception', {
		error: error.message,
		stack: error.stack,
	});
});

process.on('unhandledRejection', (reason) => {
	logBoot('process:unhandled-rejection', { reason: String(reason) });
});
