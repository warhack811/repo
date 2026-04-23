import type { DesktopAgentWindowActionId, DesktopAgentWindowDocument } from './window-host.js';

export interface DesktopAgentLaunchSessionInputViewModel {
	readonly access_token_label: string;
	readonly refresh_token_label: string;
}

export interface DesktopAgentLaunchDocumentViewModel {
	readonly agent_id: string;
	readonly connected_at?: string;
	readonly machine_label?: string;
	readonly message: string;
	readonly primary_action: {
		readonly id: DesktopAgentWindowActionId;
		readonly label: string;
	};
	readonly secondary_action?: {
		readonly id: DesktopAgentWindowActionId;
		readonly label: string;
	};
	readonly session_present: boolean;
	readonly session_input?: DesktopAgentLaunchSessionInputViewModel;
	readonly status: string;
	readonly title: string;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function renderDeviceLabel(viewModel: DesktopAgentLaunchDocumentViewModel): string {
	if (viewModel.machine_label) {
		return viewModel.machine_label;
	}

	return `Agent ${viewModel.agent_id}`;
}

function renderSessionInputMarkup(viewModel: DesktopAgentLaunchDocumentViewModel): string {
	if (!viewModel.session_input) {
		return '';
	}

	return `<section data-session-input="true">
        <label for="desktop-agent-access-token">${escapeHtml(
					viewModel.session_input.access_token_label,
				)}</label>
        <textarea id="desktop-agent-access-token" name="access_token" rows="4"></textarea>
        <label for="desktop-agent-refresh-token">${escapeHtml(
					viewModel.session_input.refresh_token_label,
				)}</label>
        <textarea id="desktop-agent-refresh-token" name="refresh_token" rows="4"></textarea>
      </section>`;
}

export function renderDesktopAgentLaunchDocument(
	viewModel: DesktopAgentLaunchDocumentViewModel,
): DesktopAgentWindowDocument {
	const secondaryActionMarkup = viewModel.secondary_action
		? `<button type="button" data-action="${escapeHtml(viewModel.secondary_action.id)}">${escapeHtml(
				viewModel.secondary_action.label,
			)}</button>`
		: '';
	const connectedAtMarkup = viewModel.connected_at
		? `<p class="launch-meta">Connected at ${escapeHtml(viewModel.connected_at)}</p>`
		: '';
	const sessionInputMarkup = renderSessionInputMarkup(viewModel);

	return {
		html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(viewModel.title)}</title>
  </head>
  <body>
    <main data-status="${escapeHtml(viewModel.status)}">
      <header>
        <p>${escapeHtml(renderDeviceLabel(viewModel))}</p>
        <h1>${escapeHtml(viewModel.title)}</h1>
      </header>
      <p>${escapeHtml(viewModel.message)}</p>
      ${connectedAtMarkup}
      ${sessionInputMarkup}
      <section>
        <button type="button" data-action="${escapeHtml(viewModel.primary_action.id)}">${escapeHtml(
					viewModel.primary_action.label,
				)}</button>
        ${secondaryActionMarkup}
      </section>
    </main>
  </body>
</html>`,
	};
}
