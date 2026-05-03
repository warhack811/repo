import type {
	DesktopAgentLaunchControllerViewModel,
	DesktopAgentSessionInputPayload,
} from '../../src/index.js';

import type React from 'react';

import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { strings } from './strings.js';

interface SessionFormState {
	readonly access_token: string;
	readonly expires_at: string;
	readonly refresh_token: string;
}

const emptySessionFormState: SessionFormState = {
	access_token: '',
	expires_at: '',
	refresh_token: '',
};

function buildSessionPayload(formState: SessionFormState): DesktopAgentSessionInputPayload {
	const normalizedExpiresAt = formState.expires_at.trim();

	return {
		access_token: formState.access_token,
		expires_at:
			normalizedExpiresAt.length > 0 ? Number.parseInt(normalizedExpiresAt, 10) : undefined,
		refresh_token: formState.refresh_token,
	};
}

function renderDeviceLabel(viewModel: DesktopAgentLaunchControllerViewModel): string {
	return viewModel.machine_label ?? strings.machineFallback;
}

export function App(): React.JSX.Element {
	const [viewModel, setViewModel] = useState<DesktopAgentLaunchControllerViewModel | null>(null);
	const [versionInfo, setVersionInfo] = useState<string>(strings.versionFallback);
	const [formState, setFormState] = useState<SessionFormState>(emptySessionFormState);
	const [formError, setFormError] = useState<string | null>(null);

	useEffect(() => {
		const api = globalThis.window.runaDesktop;
		setVersionInfo(`Electron ${api.versions.electron} / Chrome ${api.versions.chrome}`);

		api
			.getViewModel()
			.then((nextViewModel) => {
				setViewModel(nextViewModel);
			})
			.catch(() => {
				setFormError(strings.sessionSubmitError);
			});

		return api.onViewModelChange((nextViewModel) => {
			setViewModel(nextViewModel);
		});
	}, []);

	const handleInvokeAction = async (
		actionId: DesktopAgentLaunchControllerViewModel['primary_action']['id'],
	): Promise<void> => {
		if (actionId === 'submit_session') {
			return;
		}

		const nextViewModel = await globalThis.window.runaDesktop.invokeAction({ actionId });
		setViewModel(nextViewModel);
	};

	const handleSubmitSession = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
		event.preventDefault();
		setFormError(null);

		try {
			const nextViewModel = await globalThis.window.runaDesktop.submitSession(
				buildSessionPayload(formState),
			);
			setFormState(emptySessionFormState);
			setViewModel(nextViewModel);
		} catch {
			setFormError(strings.sessionSubmitError);
		}
	};

	if (!viewModel) {
		return (
			<div className="app-container" data-status="bootstrapping">
				<header className="app-header">
					<h1 className="app-title">{strings.appTitle}</h1>
					<span className="version-badge">{versionInfo}</span>
				</header>
			</div>
		);
	}

	const isPrimaryDisabled = viewModel.primary_action.id === 'connecting';
	const secondaryAction = viewModel.secondary_action;

	return (
		<div className="app-container" data-status={viewModel.status}>
			<header className="app-header">
				<h1 className="app-title">{strings.appTitle}</h1>
				<span className="version-badge">{versionInfo}</span>
			</header>

			<main className="app-main">
				<section className="status-card" data-field="status-card">
					<div className="status-indicator" data-action-role="status-indicator" />
					<div className="status-content">
						<span className="status-label">{strings.statusLabel}</span>
						<span className="status-value" data-field="status-value">
							{viewModel.title}
						</span>
					</div>
				</section>

				<section className="message-panel">
					<p className="device-label">{renderDeviceLabel(viewModel)}</p>
					<p className="message-text" data-field="message">
						{viewModel.message}
					</p>
				</section>

				<section className="info-grid">
					<div className="info-item">
						<span className="info-label">{strings.platformLabel}</span>
						<span className="info-value">
							{globalThis.window.runaDesktop?.platform || strings.unknownPlatform}
						</span>
					</div>
				</section>

				{viewModel.awaiting_session_input && viewModel.session_input ? (
					<form
						className="session-form"
						data-field="session-form"
						onSubmit={(event) => {
							void handleSubmitSession(event);
						}}
					>
						<label className="field-label" htmlFor="desktop-agent-access-token">
							{viewModel.session_input.access_token_label}
						</label>
						<textarea
							id="desktop-agent-access-token"
							name="access_token"
							placeholder={strings.tokenPlaceholder}
							rows={3}
							value={formState.access_token}
							onChange={(event) => {
								setFormState({
									...formState,
									access_token: event.currentTarget.value,
								});
							}}
						/>
						<label className="field-label" htmlFor="desktop-agent-refresh-token">
							{viewModel.session_input.refresh_token_label}
						</label>
						<textarea
							id="desktop-agent-refresh-token"
							name="refresh_token"
							placeholder={strings.tokenPlaceholder}
							rows={3}
							value={formState.refresh_token}
							onChange={(event) => {
								setFormState({
									...formState,
									refresh_token: event.currentTarget.value,
								});
							}}
						/>
						<label className="field-label" htmlFor="desktop-agent-expires-at">
							{strings.expiresAtLabel}
						</label>
						<input
							id="desktop-agent-expires-at"
							inputMode="numeric"
							name="expires_at"
							placeholder={strings.expiresAtPlaceholder}
							type="text"
							value={formState.expires_at}
							onChange={(event) => {
								setFormState({
									...formState,
									expires_at: event.currentTarget.value,
								});
							}}
						/>
						{formError ? <p className="form-error">{formError}</p> : null}
						<button className="action-button primary" type="submit">
							{viewModel.primary_action.label}
						</button>
					</form>
				) : (
					<div className="actions">
						<button
							className="action-button primary"
							data-action-role="primary-action"
							disabled={isPrimaryDisabled}
							type="button"
							onClick={() => {
								void handleInvokeAction(viewModel.primary_action.id);
							}}
						>
							{isPrimaryDisabled ? strings.actionBusyLabel : viewModel.primary_action.label}
						</button>
						{secondaryAction ? (
							<button
								className="action-button secondary"
								data-action-role="secondary-action"
								type="button"
								onClick={() => {
									void handleInvokeAction(secondaryAction.id);
								}}
							>
								{secondaryAction.label}
							</button>
						) : null}
					</div>
				)}
			</main>

			<footer className="app-footer">
				<span className="footer-text">{strings.footer}</span>
			</footer>
		</div>
	);
}

const container = document.getElementById('root');
if (container) {
	const root = createRoot(container);
	root.render(<App />);
}
