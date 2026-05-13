export const CHAT_SURFACE_EVENT_OPEN_HISTORY_SHEET = 'runa:chat:open-history-sheet';
export const CHAT_SURFACE_EVENT_OPEN_MENU_SHEET = 'runa:chat:open-menu-sheet';
export const CHAT_SURFACE_EVENT_OPEN_CONTEXT_SHEET = 'runa:chat:open-context-sheet';

export type ChatSurfaceEventName =
	| typeof CHAT_SURFACE_EVENT_OPEN_HISTORY_SHEET
	| typeof CHAT_SURFACE_EVENT_OPEN_MENU_SHEET
	| typeof CHAT_SURFACE_EVENT_OPEN_CONTEXT_SHEET;

export function dispatchChatSurfaceEvent(eventName: ChatSurfaceEventName): void {
	if (typeof window === 'undefined') {
		return;
	}

	window.dispatchEvent(new CustomEvent(eventName));
}
