import { useSyncExternalStore } from 'react';

import type { PresentationRunSurface, RunTransportSummary } from '../lib/chat-runtime/types.js';
import type { TransportErrorCode } from '../lib/transport/error-catalog.js';
import type {
	ConnectionStatus,
	GatewayProvider,
	WebSocketServerBridgeMessage,
} from '../ws-types.js';

export type RuntimeConfigState = Readonly<{
	apiKey: string;
	includePresentationBlocks: boolean;
	model: string;
	provider: GatewayProvider;
}>;

export type ConnectionStoreState = Readonly<{
	connectionStatus: ConnectionStatus;
	isSubmitting: boolean;
	lastError: string | null;
	transportErrorCode: TransportErrorCode | null;
}>;

export type PresentationStoreState = Readonly<{
	currentStreamingRunId: string | null;
	currentStreamingText: string;
	expandedPastRunIds: readonly string[];
	pendingInspectionRequestKeys: readonly string[];
	presentationRunId: string | null;
	presentationRunSurfaces: readonly PresentationRunSurface[];
	staleInspectionRequestKeys: readonly string[];
}>;

export type TransportStoreState = Readonly<{
	latestRunRequestIncludesPresentationBlocks: boolean | null;
	messages: readonly WebSocketServerBridgeMessage[];
	runTransportSummaries: ReadonlyMap<string, RunTransportSummary>;
}>;

export type ChatStoreState = Readonly<{
	connection: ConnectionStoreState;
	presentation: PresentationStoreState;
	runtimeConfig: RuntimeConfigState;
	transport: TransportStoreState;
}>;

type Listener = () => void;
type StoreUpdater<T> = T | ((currentState: T) => T);

export interface ChatStore {
	getState: () => ChatStoreState;
	setConnectionState: (nextState: StoreUpdater<ConnectionStoreState>) => void;
	setPresentationState: (nextState: StoreUpdater<PresentationStoreState>) => void;
	setRuntimeConfigState: (nextState: StoreUpdater<RuntimeConfigState>) => void;
	setTransportState: (nextState: StoreUpdater<TransportStoreState>) => void;
	subscribe: (listener: Listener) => () => void;
}

function resolveNextState<T>(currentState: T, nextState: StoreUpdater<T>): T {
	return typeof nextState === 'function'
		? (nextState as (currentState: T) => T)(currentState)
		: nextState;
}

function createSliceSetter<TKey extends keyof ChatStoreState>(
	getState: () => ChatStoreState,
	setState: (nextState: ChatStoreState) => void,
	key: TKey,
): (nextState: StoreUpdater<ChatStoreState[TKey]>) => void {
	return (nextState) => {
		const currentState = getState();
		const nextSliceState = resolveNextState(currentState[key], nextState);

		if (Object.is(nextSliceState, currentState[key])) {
			return;
		}

		setState({
			...currentState,
			[key]: nextSliceState,
		});
	};
}

export function createChatStore(initialState: ChatStoreState): ChatStore {
	let state = initialState;
	const listeners = new Set<Listener>();

	function setState(nextState: ChatStoreState): void {
		if (Object.is(nextState, state)) {
			return;
		}

		state = nextState;

		for (const listener of listeners) {
			listener();
		}
	}

	return {
		getState: () => state,
		setConnectionState: createSliceSetter(() => state, setState, 'connection'),
		setPresentationState: createSliceSetter(() => state, setState, 'presentation'),
		setRuntimeConfigState: createSliceSetter(() => state, setState, 'runtimeConfig'),
		setTransportState: createSliceSetter(() => state, setState, 'transport'),
		subscribe: (listener) => {
			listeners.add(listener);

			return () => {
				listeners.delete(listener);
			};
		},
	};
}

export function useChatStoreSelector<TSelected>(
	store: ChatStore,
	selector: (state: ChatStoreState) => TSelected,
): TSelected {
	return useSyncExternalStore(
		store.subscribe,
		() => selector(store.getState()),
		() => selector(store.getState()),
	);
}

export function selectConnectionState(state: ChatStoreState): ConnectionStoreState {
	return state.connection;
}

export function selectPresentationState(state: ChatStoreState): PresentationStoreState {
	return state.presentation;
}

export function selectRuntimeConfigState(state: ChatStoreState): RuntimeConfigState {
	return state.runtimeConfig;
}

export function selectTransportState(state: ChatStoreState): TransportStoreState {
	return state.transport;
}
