/**
 * Runa Desktop Agent - React Renderer App
 *
 * Minimal React application for the desktop launch surface.
 */

import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

declare global {
	// eslint-disable-next-line no-var
	var runaDesktop: {
		versions: {
			node: string;
			chrome: string;
			electron: string;
		};
		platform: string;
		getShellState(): Promise<unknown>;
		onShellStateChange(callback: (state: unknown) => void): () => void;
	} | undefined;
}

interface ShellState {
	status: 'needs_sign_in' | 'connecting' | 'connected' | 'error' | 'stopped';
	agentConnected: boolean;
	sessionValid: boolean;
}

function App(): React.JSX.Element {
	const [shellState, setShellState] = useState<ShellState>({
		status: 'needs_sign_in',
		agentConnected: false,
		sessionValid: false,
	});
	const [versionInfo, setVersionInfo] = useState<string>('');

	useEffect(() => {
		// Get version info from preload
		if (globalThis.window.runaDesktop) {
			setVersionInfo(`Electron ${globalThis.window.runaDesktop.versions.electron} / Chrome ${globalThis.window.runaDesktop.versions.chrome}`);

			// Get initial shell state
			globalThis.window.runaDesktop
				.getShellState()
				.then((state) => {
					if (state) {
						setShellState(state as ShellState);
					}
				})
				.catch(console.error);

			// Subscribe to shell state changes
			const unsubscribe = globalThis.window.runaDesktop.onShellStateChange((state) => {
				setShellState(state as ShellState);
			});

			return unsubscribe;
		}
	}, []);

	const getStatusDisplay = () => {
		const statusMap: Record<ShellState['status'], { text: string; color: string }> = {
			needs_sign_in: { text: 'Sign In Required', color: '#f59e0b' },
			connecting: { text: 'Connecting...', color: '#3b82f6' },
			connected: { text: 'Connected', color: '#22c55e' },
			error: { text: 'Error', color: '#ef4444' },
			stopped: { text: 'Disconnected', color: '#6b7280' },
		};
		return statusMap[shellState.status];
	};

	const statusDisplay = getStatusDisplay();

	return (
		<div className="app-container">
			<header className="app-header">
				<h1 className="app-title">Runa Desktop</h1>
				<span className="version-badge">{versionInfo}</span>
			</header>

			<main className="app-main">
				<div className="status-card" data-field="status-card">
					<div
						className="status-indicator"
						style={{ backgroundColor: statusDisplay.color }}
						data-action-role="status-indicator"
					/>
					<div className="status-content">
						<span className="status-label">Status</span>
						<span className="status-value" data-field="status-value">
							{statusDisplay.text}
						</span>
					</div>
				</div>

				<div className="info-grid">
					<div className="info-item">
						<span className="info-label">Platform</span>
						<span className="info-value">{globalThis.window.runaDesktop?.platform || 'unknown'}</span>
					</div>
					<div className="info-item">
						<span className="info-label">Agent</span>
						<span className="info-value">{shellState.agentConnected ? 'Online' : 'Offline'}</span>
					</div>
				</div>

				<div className="actions">
					{shellState.status === 'needs_sign_in' && (
						<button
							className="action-button primary"
							data-action-role="sign-in-button"
							onClick={() => {
								// Open web interface for sign in
								console.log('Sign in action triggered');
							}}
						>
							Sign In
						</button>
					)}

					{shellState.status === 'connected' && (
						<button
							className="action-button secondary"
							data-action-role="disconnect-button"
							onClick={() => {
								console.log('Disconnect action triggered');
							}}
						>
							Disconnect
						</button>
					)}

					{shellState.status === 'stopped' && (
						<button
							className="action-button primary"
							data-action-role="connect-button"
							onClick={() => {
								console.log('Connect action triggered');
							}}
						>
							Connect
						</button>
					)}
				</div>
			</main>

			<footer className="app-footer">
				<span className="footer-text">Runa Desktop Agent v0.1.0</span>
			</footer>
		</div>
	);
}

// Mount React app
const container = document.getElementById('root');
if (container) {
	const root = createRoot(container);
	root.render(<App />);
}
