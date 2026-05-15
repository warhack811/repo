import { useCallback, useRef, useSyncExternalStore } from 'react';

import type { ChatStore, ChatStoreState } from '../stores/chat-store.js';

const UNINITIALIZED = Symbol('chat-store-slice-uninitialized');

export function useChatStoreSlice<T>(
	store: ChatStore,
	selector: (state: ChatStoreState) => T,
	isEqual: (left: T, right: T) => boolean = Object.is,
): T {
	const lastSelectedValueRef = useRef<T | typeof UNINITIALIZED>(UNINITIALIZED);

	const getSnapshot = useCallback((): T => {
		const nextSelectedValue = selector(store.getState());
		const lastSelectedValue = lastSelectedValueRef.current;

		if (lastSelectedValue !== UNINITIALIZED && isEqual(lastSelectedValue, nextSelectedValue)) {
			return lastSelectedValue;
		}

		lastSelectedValueRef.current = nextSelectedValue;
		return nextSelectedValue;
	}, [isEqual, selector, store]);

	return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
