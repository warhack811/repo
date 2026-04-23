import type { DesktopAgentSessionInputPayload } from './auth.js';

export type DesktopAgentWindowActionId =
	| 'connect'
	| 'retry'
	| 'sign_in'
	| 'sign_out'
	| 'submit_session';

export interface DesktopAgentWindowDocument {
	readonly html: string;
}

export interface DesktopAgentWindowConnectActionEvent {
	readonly id: 'connect';
}

export interface DesktopAgentWindowRetryActionEvent {
	readonly id: 'retry';
}

export interface DesktopAgentWindowSignInActionEvent {
	readonly id: 'sign_in';
}

export interface DesktopAgentWindowSignOutActionEvent {
	readonly id: 'sign_out';
}

export interface DesktopAgentWindowSubmitSessionActionEvent {
	readonly id: 'submit_session';
	readonly payload: DesktopAgentSessionInputPayload;
}

export type DesktopAgentWindowActionEvent =
	| DesktopAgentWindowConnectActionEvent
	| DesktopAgentWindowRetryActionEvent
	| DesktopAgentWindowSignInActionEvent
	| DesktopAgentWindowSignOutActionEvent
	| DesktopAgentWindowSubmitSessionActionEvent;

export type DesktopAgentWindowActionHandler = (
	event: DesktopAgentWindowActionEvent,
) => Promise<void> | void;

export interface DesktopAgentWindowHost {
	dispose(): Promise<void> | void;
	mount(document: DesktopAgentWindowDocument): Promise<void> | void;
	setActionHandler(handler: DesktopAgentWindowActionHandler): Promise<void> | void;
	update(document: DesktopAgentWindowDocument): Promise<void> | void;
}

class NoopDesktopAgentWindowHost implements DesktopAgentWindowHost {
	#document: DesktopAgentWindowDocument | null = null;
	#handler: DesktopAgentWindowActionHandler | null = null;

	dispose(): void {
		this.#document = null;
		this.#handler = null;
	}

	mount(document: DesktopAgentWindowDocument): void {
		this.#document = document;
	}

	setActionHandler(handler: DesktopAgentWindowActionHandler): void {
		this.#handler = handler;
	}

	update(document: DesktopAgentWindowDocument): void {
		this.#document = document;
	}
}

export function createNoopDesktopAgentWindowHost(): DesktopAgentWindowHost {
	return new NoopDesktopAgentWindowHost();
}
