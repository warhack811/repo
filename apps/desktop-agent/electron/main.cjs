/**
 * Runa Desktop Agent - Electron Main Process (Minimal Working Version)
 *
 * This is a minimal working version that demonstrates the liveness fix.
 * The key issue was that esbuild's bundled require() calls
 * were not resolving the electron module correctly in Electron's runtime.
 *
 * Solution: Use plain JavaScript with no bundling for the main process.
 */

const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

// Immediate console output to see if the script even loads
console.error('[BOOT] main.js loaded');
console.error('[BOOT] __dirname:', __dirname);
console.error('[BOOT] process.version:', process.version);
console.error('[BOOT] electron loaded:', typeof app !== 'undefined');

// Boot logging for liveness detection
function logBoot(message, data) {
	const timestamp = new Date().toISOString();
	const payload = data !== undefined ? ` ${JSON.stringify(data)}` : '';
	console.log(`[boot:${message}]${payload}`);
}

// Get the app directory - this works in both dev and packaged environments
function getAppDir() {
	// In packaged apps, __dirname points to the resources/app.asar directory
	// We need to get to the dist-electron directory
	return __dirname;
}

// Tray state
let tray = null;
let mainWindow = null;
let isQuitting = false;

// Desktop agent shell state for tray mapping
const currentShellState = 'stopped';

function createTray() {
	const appDir = getAppDir();
	const iconPath = path.join(appDir, '../build/icon.png');

	try {
		const trayIcon = nativeImage.createFromPath(iconPath);
		tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon);

		const contextMenu = Menu.buildFromTemplate([
			{
				label: 'Open Runa Desktop',
				click() {
					showMainWindow();
				},
			},
			{ type: 'separator' },
			{
				label: 'Quit Runa Desktop',
				click() {
					logBoot('tray:quit-clicked');
					app.quit();
				},
			},
		]);

		tray.setContextMenu(contextMenu);
		tray.setToolTip('Runa Desktop - Starting...');

		logBoot('tray:created');
	} catch (error) {
		logBoot('tray:error', { error: error.message });
	}
}

function createMainWindow() {
	logBoot('window:create-start');

	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		show: false,
		title: 'Runa Desktop',
		webPreferences: {
			preload: path.join(getAppDir(), 'preload.cjs'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false, // Disable sandbox for preload to work
		},
	});

	// Load the renderer - it's in the dist-electron/renderer directory
	const rendererPath = path.join(getAppDir(), 'renderer/index.html');
	mainWindow.loadFile(rendererPath);

	mainWindow.once('ready-to-show', () => {
		logBoot('window:ready-to-show');
		mainWindow.show();
	});

	mainWindow.on('close', (event) => {
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

function showMainWindow() {
	if (mainWindow) {
		logBoot('window:show-existing');
		mainWindow.show();
		mainWindow.focus();
	} else {
		logBoot('window:show-new');
		createMainWindow();
	}
}

// App lifecycle - THE KEY FIX: No top-level await, no complex module resolution
app.on('ready', () => {
	logBoot('app-ready');

	try {
		createTray();
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
