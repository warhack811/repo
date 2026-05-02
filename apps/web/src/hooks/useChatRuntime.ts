import { gatewayProviders, defaultGatewayModels as runtimeDefaultGatewayModels } from '@runa/types';
import type { ModelAttachment, ModelMessage } from '@runa/types';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { toSortedStringArray } from '../lib/chat-runtime/collections.js';
import {
	countInspectionRequestsForRun,
	createInspectionRequestIdentity,
} from '../lib/chat-runtime/inspection-relations.js';
import {
	derivePresentationBlocksUpdate,
	derivePresentationSurfaceState,
	findPresentationRunSurface,
	matchesTrackedRun,
} from '../lib/chat-runtime/presentation-surfaces.js';
import { createRunRequestPayload } from '../lib/chat-runtime/request-payload.js';
import {
	buildRunFeedbackState,
	buildRunTransportSummaryMap,
} from '../lib/chat-runtime/runtime-feedback.js';
import { DEFAULT_INSPECTION_DETAIL_LEVEL } from '../lib/chat-runtime/types.js';
import type {
	PresentationRunSurface,
	RunFeedbackState,
	RunTransportSummary,
} from '../lib/chat-runtime/types.js';
import { reportTelemetryEvent, reportTransportErrorMetric } from '../lib/monitoring/telemetry.js';
import {
	type TransportErrorCode,
	classifyWebSocketClose,
	getTransportError,
} from '../lib/transport/error-catalog.js';
import {
	createApprovalResolveMessage,
	createClientId,
	createInspectionRequestMessage,
	createRunRequestMessage,
	createWebSocketUrl,
	decodeWebSocketMessageData,
	parseServerMessage,
} from '../lib/ws-client.js';
import { uiCopy } from '../localization/copy.js';
import {
	createChatStore,
	selectConnectionState,
	selectPresentationState,
	selectRuntimeConfigState,
	selectTransportState,
	useChatStoreSelector,
} from '../stores/chat-store.js';
import type { ChatStore } from '../stores/chat-store.js';
import type {
	ApprovalResolveDecision,
	ConnectionStatus,
	GatewayProvider,
	InspectionTargetKind,
	WebSocketServerBridgeMessage,
} from '../ws-types.js';

export type {
	PresentationRunSurface,
	RunFeedbackState,
	RunTransportSummary,
} from '../lib/chat-runtime/types.js';

export interface UseChatRuntimeResult {
	readonly accessToken?: string | null;
	readonly attachments: readonly ModelAttachment[];
	readonly apiKey: string;
	readonly connectionStatus: ConnectionStatus;
	readonly currentPresentationSurface: PresentationRunSurface | null;
	readonly currentRunFeedback: RunFeedbackState | null;
	readonly currentStreamingRunId: string | null;
	readonly currentStreamingText: string;
	readonly desktopTargetConnectionId: string | null;
	readonly expandedPastRunIds: readonly string[];
	readonly includePresentationBlocks: boolean;
	readonly inspectionAnchorIdsByDetailId: ReadonlyMap<string, string | undefined>;
	readonly isSubmitting: boolean;
	readonly isRuntimeConfigReady: boolean;
	readonly lastError: string | null;
	readonly latestRunRequestIncludesPresentationBlocks: boolean | null;
	readonly messages: readonly WebSocketServerBridgeMessage[];
	readonly model: string;
	readonly pastPresentationSurfaces: readonly PresentationRunSurface[];
	readonly pendingInspectionRequestKeys: readonly string[];
	readonly presentationRunSurfaces: readonly PresentationRunSurface[];
	readonly prompt: string;
	readonly provider: GatewayProvider;
	readonly runTransportSummaries: ReadonlyMap<string, RunTransportSummary>;
	readonly store: ChatStore;
	readonly staleInspectionRequestKeys: readonly string[];
	readonly transportErrorCode: TransportErrorCode | null;
	setApiKey: (value: string) => void;
	setAttachments: (value: readonly ModelAttachment[]) => void;
	setDesktopTargetConnectionId: (value: string | null) => void;
	setIncludePresentationBlocks: (value: boolean) => void;
	setModel: (value: string) => void;
	setPastRunExpanded: (runId: string, isExpanded: boolean) => void;
	setPrompt: (value: string) => void;
	setProvider: (value: GatewayProvider) => void;
	submitRunRequest: (event: FormEvent<HTMLFormElement>) => void;
	requestInspection: (runId: string, targetKind: InspectionTargetKind, targetId?: string) => void;
	resolveApproval: (approvalId: string, decision: ApprovalResolveDecision) => void;
	retryTransport: () => void;
}

export interface UseChatRuntimeOptions {
	readonly accessToken?: string | null;
	readonly activeConversationId?: string | null;
	readonly buildRequestMessages?: (prompt: string) => readonly ModelMessage[];
	readonly desktopTargetConnectionId?: string | null;
	readonly onRunAccepted?: (input: {
		readonly conversationId?: string;
		readonly prompt: string;
		readonly runId: string;
	}) => void;
	readonly onRunFinished?: (input: {
		readonly conversationId?: string;
		readonly runId: string;
	}) => void;
}

interface StoredRuntimeConfigCandidate {
	readonly apiKey?: unknown;
	readonly includePresentationBlocks?: unknown;
	readonly model?: unknown;
	readonly provider?: unknown;
}

const RUNTIME_CONFIG_STORAGE_KEY = 'runa.developer.runtime_config';
const DEFAULT_PROVIDER: GatewayProvider = 'deepseek';
const DEFAULT_MODEL = runtimeDefaultGatewayModels[DEFAULT_PROVIDER];
const LEGACY_DEFAULT_PROVIDER: GatewayProvider = 'groq';
const LEGACY_DEFAULT_MODEL = runtimeDefaultGatewayModels[LEGACY_DEFAULT_PROVIDER];
function isGatewayProviderValue(value: unknown): value is GatewayProvider {
	return typeof value === 'string' && gatewayProviders.includes(value as GatewayProvider);
}

function resolveRuntimeConfigStorage(): Storage | null {
	if (typeof window === 'undefined') {
		return null;
	}

	return window.localStorage;
}

function createDefaultRuntimeConfig(): Readonly<{
	apiKey: string;
	includePresentationBlocks: boolean;
	model: string;
	provider: GatewayProvider;
}> {
	return {
		apiKey: '',
		includePresentationBlocks: true,
		model: DEFAULT_MODEL,
		provider: DEFAULT_PROVIDER,
	};
}

function shouldMigrateStoredRuntimeConfigToDefaultProvider(
	config: Readonly<{
		model: string;
		provider: GatewayProvider;
	}>,
): boolean {
	return (
		config.provider === LEGACY_DEFAULT_PROVIDER &&
		(config.model.trim().length === 0 || config.model.trim() === LEGACY_DEFAULT_MODEL)
	);
}

function isStoredRuntimeConfigCandidate(value: unknown): value is StoredRuntimeConfigCandidate {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStoredRuntimeConfig(): Readonly<{
	apiKey: string;
	includePresentationBlocks: boolean;
	model: string;
	provider: GatewayProvider;
}> {
	const storage = resolveRuntimeConfigStorage();

	if (storage === null) {
		return createDefaultRuntimeConfig();
	}

	try {
		const rawValue = storage.getItem(RUNTIME_CONFIG_STORAGE_KEY);

		if (rawValue === null) {
			return createDefaultRuntimeConfig();
		}

		const parsedValue = JSON.parse(rawValue) as unknown;

		if (!isStoredRuntimeConfigCandidate(parsedValue)) {
			return createDefaultRuntimeConfig();
		}

		const parsedProvider = isGatewayProviderValue(parsedValue.provider)
			? parsedValue.provider
			: DEFAULT_PROVIDER;
		const parsedModel =
			typeof parsedValue.model === 'string' && parsedValue.model.trim().length > 0
				? parsedValue.model
				: runtimeDefaultGatewayModels[parsedProvider];
		const storedConfig = {
			apiKey: typeof parsedValue.apiKey === 'string' ? parsedValue.apiKey : '',
			includePresentationBlocks:
				typeof parsedValue.includePresentationBlocks === 'boolean'
					? parsedValue.includePresentationBlocks
					: true,
			model: parsedModel,
			provider: parsedProvider,
		};

		if (shouldMigrateStoredRuntimeConfigToDefaultProvider(storedConfig)) {
			const migratedConfig = createDefaultRuntimeConfig();
			persistRuntimeConfig(migratedConfig);
			return migratedConfig;
		}

		return storedConfig;
	} catch {
		return createDefaultRuntimeConfig();
	}
}

function persistRuntimeConfig(
	input: Readonly<{
		apiKey: string;
		includePresentationBlocks: boolean;
		model: string;
		provider: GatewayProvider;
	}>,
): void {
	const storage = resolveRuntimeConfigStorage();

	if (storage === null) {
		return;
	}

	storage.setItem(
		RUNTIME_CONFIG_STORAGE_KEY,
		JSON.stringify({
			apiKey: input.apiKey,
			includePresentationBlocks: input.includePresentationBlocks,
			model: input.model,
			provider: input.provider,
		}),
	);
}

function getPresentationBlockDomId(blockId: string): string {
	return `presentation-block:${encodeURIComponent(blockId)}`;
}

function normalizeDesktopTargetConnectionId(value: string | null | undefined): string | null {
	if (typeof value !== 'string') {
		return null;
	}

	const trimmedValue = value.trim();

	return trimmedValue.length > 0 ? trimmedValue : null;
}

function scrollToPresentationBlock(blockId: string): void {
	const blockElement = document.getElementById(getPresentationBlockDomId(blockId));

	if (!(blockElement instanceof HTMLElement)) {
		return;
	}

	blockElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	window.requestAnimationFrame(() => {
		blockElement.focus({ preventScroll: true });
	});
}

export function useChatRuntime(options: UseChatRuntimeOptions = {}): UseChatRuntimeResult {
	const {
		accessToken,
		activeConversationId,
		buildRequestMessages,
		desktopTargetConnectionId,
		onRunAccepted,
		onRunFinished,
	} = options;
	const chatStoreRef = useRef<ChatStore | null>(null);

	if (chatStoreRef.current === null) {
		const initialRuntimeConfig = readStoredRuntimeConfig();

		chatStoreRef.current = createChatStore({
			connection: {
				connectionStatus: 'connecting',
				isSubmitting: false,
				lastError: null,
				transportErrorCode: null,
			},
			presentation: {
				currentStreamingRunId: null,
				currentStreamingText: '',
				expandedPastRunIds: [],
				pendingInspectionRequestKeys: [],
				presentationRunId: null,
				presentationRunSurfaces: [],
				staleInspectionRequestKeys: [],
			},
			runtimeConfig: initialRuntimeConfig,
			transport: {
				latestRunRequestIncludesPresentationBlocks: null,
				messages: [],
				runTransportSummaries: new Map(),
			},
		});
	}

	const chatStore = chatStoreRef.current;

	if (chatStore === null) {
		throw new Error('Chat runtime store failed to initialize.');
	}
	const reconnectTimerRef = useRef<number | null>(null);
	const socketRef = useRef<WebSocket | null>(null);
	const reconnectNowRef = useRef<() => void>(() => undefined);
	const expectedPresentationRunIdRef = useRef<string | null>(null);
	const expandedPastRunIdsRef = useRef<Set<string>>(new Set());
	const inspectionAnchorIdsByDetailIdRef = useRef<Map<string, string | undefined>>(new Map());
	const inspectionRequestKeysByDetailIdRef = useRef<Map<string, string>>(new Map());
	const pendingInspectionRequestKeysRef = useRef<Set<string>>(new Set());
	const presentationRunSurfacesRef = useRef<readonly PresentationRunSurface[]>([]);
	const presentationRunIdRef = useRef<string | null>(null);
	const staleInspectionRequestKeysRef = useRef<Set<string>>(new Set());
	const conversationIdByRunIdRef = useRef<Map<string, string | undefined>>(new Map());
	const activeConversationIdRef = useRef(activeConversationId);
	const onRunAcceptedRef = useRef(onRunAccepted);
	const onRunFinishedRef = useRef(onRunFinished);
	const submittedPromptByRunIdRef = useRef<Map<string, string>>(new Map());
	const firstTokenSeenRunIdsRef = useRef<Set<string>>(new Set());
	const reportedSearchRunIdsRef = useRef<Set<string>>(new Set());
	const reportedToolCallIdsRef = useRef<Set<string>>(new Set());
	const runSubmittedAtRef = useRef<Map<string, number>>(new Map());
	const [attachments, setAttachments] = useState<readonly ModelAttachment[]>([]);
	const [selectedDesktopTargetConnectionId, setSelectedDesktopTargetConnectionId] = useState<
		string | null
	>(() => normalizeDesktopTargetConnectionId(desktopTargetConnectionId));
	const [prompt, setPrompt] = useState('');

	const runtimeConfig = useChatStoreSelector(chatStore, selectRuntimeConfigState);
	const connectionState = useChatStoreSelector(chatStore, selectConnectionState);
	const presentationState = useChatStoreSelector(chatStore, selectPresentationState);
	const transportState = useChatStoreSelector(chatStore, selectTransportState);
	const { apiKey, includePresentationBlocks, model, provider } = runtimeConfig;
	const { connectionStatus, isSubmitting, lastError, transportErrorCode } = connectionState;
	const {
		currentStreamingRunId,
		currentStreamingText,
		expandedPastRunIds,
		pendingInspectionRequestKeys,
		presentationRunId,
		presentationRunSurfaces,
		staleInspectionRequestKeys,
	} = presentationState;
	const { latestRunRequestIncludesPresentationBlocks, messages, runTransportSummaries } =
		transportState;
	const isRuntimeConfigReady = model.trim().length > 0;

	useEffect(() => {
		onRunAcceptedRef.current = onRunAccepted;
	}, [onRunAccepted]);

	useEffect(() => {
		activeConversationIdRef.current = activeConversationId;
	}, [activeConversationId]);

	useEffect(() => {
		onRunFinishedRef.current = onRunFinished;
	}, [onRunFinished]);

	useEffect(() => {
		setSelectedDesktopTargetConnectionId(
			normalizeDesktopTargetConnectionId(desktopTargetConnectionId),
		);
	}, [desktopTargetConnectionId]);

	const setApiKey = useCallback(
		(value: string): void => {
			chatStore.setRuntimeConfigState((currentRuntimeConfig) => ({
				...currentRuntimeConfig,
				apiKey: value,
			}));
		},
		[chatStore],
	);

	const setIncludePresentationBlocks = useCallback(
		(value: boolean): void => {
			chatStore.setRuntimeConfigState((currentRuntimeConfig) => ({
				...currentRuntimeConfig,
				includePresentationBlocks: value,
			}));
		},
		[chatStore],
	);

	const setModel = useCallback(
		(value: string): void => {
			chatStore.setRuntimeConfigState((currentRuntimeConfig) => ({
				...currentRuntimeConfig,
				model: value,
			}));
		},
		[chatStore],
	);

	const setProvider = useCallback(
		(nextProvider: GatewayProvider): void => {
			chatStore.setRuntimeConfigState((currentRuntimeConfig) => {
				const trimmedModel = currentRuntimeConfig.model.trim();
				const currentDefaultModel = runtimeDefaultGatewayModels[currentRuntimeConfig.provider];

				return {
					...currentRuntimeConfig,
					model:
						trimmedModel.length === 0 || trimmedModel === currentDefaultModel
							? runtimeDefaultGatewayModels[nextProvider]
							: currentRuntimeConfig.model,
					provider: nextProvider,
				};
			});
		},
		[chatStore],
	);

	useEffect(() => {
		persistRuntimeConfig({
			apiKey,
			includePresentationBlocks,
			model,
			provider,
		});
	}, [apiKey, includePresentationBlocks, model, provider]);

	const replacePendingInspectionRequestKeys = useCallback(
		(nextRequestKeys: Iterable<string>): void => {
			const nextKeySet = new Set(nextRequestKeys);

			pendingInspectionRequestKeysRef.current = nextKeySet;
			chatStore.setPresentationState((currentPresentationState) => ({
				...currentPresentationState,
				pendingInspectionRequestKeys: toSortedStringArray(nextKeySet),
			}));
		},
		[chatStore],
	);

	const replaceStaleInspectionRequestKeys = useCallback(
		(nextRequestKeys: Iterable<string>): void => {
			const nextKeySet = new Set(nextRequestKeys);

			staleInspectionRequestKeysRef.current = nextKeySet;
			chatStore.setPresentationState((currentPresentationState) => ({
				...currentPresentationState,
				staleInspectionRequestKeys: toSortedStringArray(nextKeySet),
			}));
		},
		[chatStore],
	);

	const replaceExpandedPastRunIds = useCallback(
		(nextRunIds: Iterable<string>): void => {
			const nextRunIdSet = new Set(nextRunIds);

			expandedPastRunIdsRef.current = nextRunIdSet;
			chatStore.setPresentationState((currentPresentationState) => ({
				...currentPresentationState,
				expandedPastRunIds: toSortedStringArray(nextRunIdSet),
			}));
		},
		[chatStore],
	);

	const setPastRunExpanded = useCallback(
		(runId: string, isExpanded: boolean): void => {
			const nextExpandedPastRunIds = new Set(expandedPastRunIdsRef.current);

			if (isExpanded) {
				nextExpandedPastRunIds.add(runId);
			} else {
				nextExpandedPastRunIds.delete(runId);
			}

			replaceExpandedPastRunIds(nextExpandedPastRunIds);
		},
		[replaceExpandedPastRunIds],
	);

	useEffect(() => {
		let isDisposed = false;
		let activeSocket: WebSocket | null = null;
		let reconnectAttemptCount = 0;

		function clearReconnectTimer(): void {
			if (reconnectTimerRef.current === null) {
				return;
			}

			window.clearTimeout(reconnectTimerRef.current);
			reconnectTimerRef.current = null;
		}

		function commitPendingInspectionRequestKeys(nextRequestKeys: Iterable<string>): void {
			const nextKeySet = new Set(nextRequestKeys);

			pendingInspectionRequestKeysRef.current = nextKeySet;
			chatStore.setPresentationState((currentPresentationState) => ({
				...currentPresentationState,
				pendingInspectionRequestKeys: toSortedStringArray(nextKeySet),
			}));
		}

		function commitStaleInspectionRequestKeys(nextRequestKeys: Iterable<string>): void {
			const nextKeySet = new Set(nextRequestKeys);

			staleInspectionRequestKeysRef.current = nextKeySet;
			chatStore.setPresentationState((currentPresentationState) => ({
				...currentPresentationState,
				staleInspectionRequestKeys: toSortedStringArray(nextKeySet),
			}));
		}

		function commitExpandedPastRunIds(nextRunIds: Iterable<string>): void {
			const nextRunIdSet = new Set(nextRunIds);

			expandedPastRunIdsRef.current = nextRunIdSet;
			chatStore.setPresentationState((currentPresentationState) => ({
				...currentPresentationState,
				expandedPastRunIds: toSortedStringArray(nextRunIdSet),
			}));
		}

		function scheduleReconnect(
			message?: string,
			transportErrorCode: TransportErrorCode = 'ws-disconnect',
		): void {
			if (isDisposed) {
				return;
			}

			clearReconnectTimer();
			reconnectAttemptCount += 1;
			reportTransportErrorMetric(transportErrorCode);
			const transportError = getTransportError(transportErrorCode);
			chatStore.setConnectionState((currentConnectionState) => ({
				...currentConnectionState,
				connectionStatus: 'connecting',
				lastError: message ?? transportError.label,
				transportErrorCode,
			}));
			reconnectTimerRef.current = window.setTimeout(
				() => {
					connectSocket();
				},
				Math.min(1000 * reconnectAttemptCount, 4000),
			);
		}

		function commitTransportError(transportErrorCode: TransportErrorCode): void {
			if (isDisposed) {
				return;
			}

			reportTransportErrorMetric(transportErrorCode);
			const transportError = getTransportError(transportErrorCode);
			chatStore.setConnectionState((currentConnectionState) => ({
				...currentConnectionState,
				connectionStatus: 'error',
				lastError: transportError.label,
				transportErrorCode,
			}));
		}

		function connectSocket(): void {
			if (isDisposed) {
				return;
			}

			clearReconnectTimer();
			chatStore.setConnectionState((currentConnectionState) => ({
				...currentConnectionState,
				connectionStatus: 'connecting',
			}));
			const socket = new WebSocket(createWebSocketUrl(accessToken));
			activeSocket = socket;
			socketRef.current = socket;

			socket.addEventListener('open', () => {
				if (isDisposed || activeSocket !== socket) {
					return;
				}

				reconnectAttemptCount = 0;
				chatStore.setConnectionState((currentConnectionState) => ({
					...currentConnectionState,
					connectionStatus: 'open',
					lastError: null,
					transportErrorCode: null,
				}));
			});

			socket.addEventListener('close', (event) => {
				if (isDisposed || activeSocket !== socket) {
					return;
				}

				activeSocket = null;
				socketRef.current = null;

				const closeReason = event.reason.trim();

				if (event.code === 1008) {
					chatStore.setConnectionState((currentConnectionState) => ({
						...currentConnectionState,
						connectionStatus: 'error',
						lastError:
							closeReason.length > 0 ? closeReason : 'Authenticated WebSocket connection required.',
						transportErrorCode: 'server-error',
					}));
					reportTransportErrorMetric('server-error');
					return;
				}

				const closeTransportErrorCode =
					classifyWebSocketClose({
						code: event.code,
						reason: closeReason,
						wasClean: event.wasClean,
					}) ?? 'ws-disconnect';
				const transportError = getTransportError(closeTransportErrorCode);
				scheduleReconnect(transportError.label, closeTransportErrorCode);
			});

			socket.addEventListener('error', () => {
				if (isDisposed || activeSocket !== socket) {
					return;
				}

				const socketErrorCode: TransportErrorCode =
					typeof navigator !== 'undefined' && navigator.onLine === false
						? 'network-cut'
						: 'ws-disconnect';
				commitTransportError(socketErrorCode);
			});

			socket.addEventListener('message', (event) => {
				void (async () => {
					if (isDisposed || activeSocket !== socket) {
						return;
					}

					try {
						const raw = await decodeWebSocketMessageData(event.data as Blob | string);
						const parsedMessage = parseServerMessage(raw);

						chatStore.setTransportState((currentTransportState) => {
							const nextMessages = [...currentTransportState.messages, parsedMessage];

							return {
								...currentTransportState,
								messages: nextMessages,
								runTransportSummaries: buildRunTransportSummaryMap(nextMessages),
							};
						});

						if (parsedMessage.type === 'presentation.blocks') {
							const runStartedAt = runSubmittedAtRef.current.get(parsedMessage.payload.run_id);

							if (runStartedAt !== undefined) {
								for (const block of parsedMessage.payload.blocks) {
									if (block.type === 'tool_result') {
										const callId = block.payload.call_id;

										if (!reportedToolCallIdsRef.current.has(callId)) {
											reportedToolCallIdsRef.current.add(callId);
											reportTelemetryEvent('tool_call_duration', performance.now() - runStartedAt, {
												run_id: parsedMessage.payload.run_id,
												status: block.payload.status,
												tool_name: block.payload.tool_name,
											});
										}
									}

									if (
										(block.type === 'web_search_result_block' ||
											(block.type === 'tool_result' && block.payload.tool_name === 'web.search')) &&
										!reportedSearchRunIdsRef.current.has(parsedMessage.payload.run_id)
									) {
										reportedSearchRunIdsRef.current.add(parsedMessage.payload.run_id);
										reportTelemetryEvent(
											'search_evidence_latency',
											performance.now() - runStartedAt,
											{ run_id: parsedMessage.payload.run_id },
										);
									}
								}
							}

							const nextPresentationState = derivePresentationBlocksUpdate(parsedMessage, {
								expandedPastRunIds: expandedPastRunIdsRef.current,
								expectedRunId: expectedPresentationRunIdRef.current,
								inspectionAnchorIdsByDetailId: inspectionAnchorIdsByDetailIdRef.current,
								inspectionRequestKeysByDetailId: inspectionRequestKeysByDetailIdRef.current,
								pendingInspectionRequestKeys: pendingInspectionRequestKeysRef.current,
								presentationRunId: presentationRunIdRef.current,
								presentationRunSurfaces: presentationRunSurfacesRef.current,
								staleInspectionRequestKeys: staleInspectionRequestKeysRef.current,
							});

							if (!nextPresentationState) {
								return;
							}

							commitPendingInspectionRequestKeys(
								nextPresentationState.pendingInspectionRequestKeys,
							);
							commitStaleInspectionRequestKeys(nextPresentationState.staleInspectionRequestKeys);
							commitExpandedPastRunIds(nextPresentationState.expandedPastRunIds);

							inspectionAnchorIdsByDetailIdRef.current = new Map(
								nextPresentationState.inspectionAnchorIdsByDetailId,
							);
							inspectionRequestKeysByDetailIdRef.current = new Map(
								nextPresentationState.inspectionRequestKeysByDetailId,
							);
							expectedPresentationRunIdRef.current = nextPresentationState.expectedRunId;
							presentationRunIdRef.current = nextPresentationState.presentationRunId;
							presentationRunSurfacesRef.current = nextPresentationState.presentationRunSurfaces;
							chatStore.setPresentationState((currentPresentationState) => ({
								...currentPresentationState,
								presentationRunId: nextPresentationState.presentationRunId,
								presentationRunSurfaces: nextPresentationState.presentationRunSurfaces,
							}));

							if (nextPresentationState.detailBlockIds.length > 0) {
								window.requestAnimationFrame(() => {
									const latestDetailBlockId =
										nextPresentationState.detailBlockIds[
											nextPresentationState.detailBlockIds.length - 1
										];

									if (latestDetailBlockId) {
										scrollToPresentationBlock(latestDetailBlockId);
									}
								});
							}
						}

						if (parsedMessage.type === 'text.delta') {
							if (
								!matchesTrackedRun(
									parsedMessage.payload.run_id,
									presentationRunIdRef.current,
									expectedPresentationRunIdRef.current,
								)
							) {
								return;
							}

							if (!firstTokenSeenRunIdsRef.current.has(parsedMessage.payload.run_id)) {
								const runStartedAt = runSubmittedAtRef.current.get(parsedMessage.payload.run_id);

								if (runStartedAt !== undefined) {
									firstTokenSeenRunIdsRef.current.add(parsedMessage.payload.run_id);
									reportTelemetryEvent('time_to_first_token', performance.now() - runStartedAt, {
										run_id: parsedMessage.payload.run_id,
									});
								}
							}

							chatStore.setPresentationState((currentPresentationState) => ({
								...currentPresentationState,
								currentStreamingRunId: parsedMessage.payload.run_id,
								currentStreamingText:
									currentPresentationState.currentStreamingText + parsedMessage.payload.text_delta,
							}));
							return;
						}

						if (parsedMessage.type === 'text.delta.discard') {
							if (
								!matchesTrackedRun(
									parsedMessage.payload.run_id,
									presentationRunIdRef.current,
									expectedPresentationRunIdRef.current,
								)
							) {
								return;
							}

							chatStore.setPresentationState((currentPresentationState) => ({
								...currentPresentationState,
								currentStreamingRunId: parsedMessage.payload.run_id,
								currentStreamingText: '',
							}));
							return;
						}

						if (parsedMessage.type === 'run.rejected') {
							submittedPromptByRunIdRef.current.delete(parsedMessage.payload.run_id ?? '');
							if (
								matchesTrackedRun(
									parsedMessage.payload.run_id,
									presentationRunIdRef.current,
									expectedPresentationRunIdRef.current,
								)
							) {
								chatStore.setConnectionState((currentConnectionState) => ({
									...currentConnectionState,
									isSubmitting: false,
								}));
								chatStore.setPresentationState((currentPresentationState) => ({
									...currentPresentationState,
									currentStreamingRunId: null,
									currentStreamingText: '',
								}));

								if (parsedMessage.payload.run_id === expectedPresentationRunIdRef.current) {
									expectedPresentationRunIdRef.current = presentationRunIdRef.current;
								}
							}

							chatStore.setConnectionState((currentConnectionState) => ({
								...currentConnectionState,
								lastError: parsedMessage.payload.error_message,
								transportErrorCode:
									parsedMessage.payload.error_code ?? currentConnectionState.transportErrorCode,
							}));
							if (parsedMessage.payload.error_code) {
								reportTransportErrorMetric(parsedMessage.payload.error_code);
							}
						}

						if (parsedMessage.type === 'run.finished') {
							submittedPromptByRunIdRef.current.delete(parsedMessage.payload.run_id);
							const runStartedAt = runSubmittedAtRef.current.get(parsedMessage.payload.run_id);

							if (runStartedAt !== undefined) {
								reportTelemetryEvent('stream_latency', performance.now() - runStartedAt, {
									final_state: parsedMessage.payload.final_state,
									run_id: parsedMessage.payload.run_id,
								});
								runSubmittedAtRef.current.delete(parsedMessage.payload.run_id);
								firstTokenSeenRunIdsRef.current.delete(parsedMessage.payload.run_id);
								reportedSearchRunIdsRef.current.delete(parsedMessage.payload.run_id);
							}
							const conversationId = conversationIdByRunIdRef.current.get(
								parsedMessage.payload.run_id,
							);
							const shouldNotifyConversationSync =
								conversationId !== undefined &&
								(conversationId === activeConversationIdRef.current ||
									matchesTrackedRun(
										parsedMessage.payload.run_id,
										presentationRunIdRef.current,
										expectedPresentationRunIdRef.current,
									));

							if (shouldNotifyConversationSync) {
								onRunFinishedRef.current?.({
									conversationId,
									runId: parsedMessage.payload.run_id,
								});
							}

							if (
								!matchesTrackedRun(
									parsedMessage.payload.run_id,
									presentationRunIdRef.current,
									expectedPresentationRunIdRef.current,
								)
							) {
								return;
							}

							chatStore.setConnectionState((currentConnectionState) => ({
								...currentConnectionState,
								isSubmitting: false,
								lastError:
									parsedMessage.payload.final_state === 'FAILED'
										? (parsedMessage.payload.error_message ?? 'Çalışma hata ile bitti.')
										: null,
							}));
							chatStore.setPresentationState((currentPresentationState) => ({
								...currentPresentationState,
								currentStreamingRunId: null,
								currentStreamingText: '',
							}));
						}

						if (parsedMessage.type === 'run.accepted') {
							conversationIdByRunIdRef.current.set(
								parsedMessage.payload.run_id,
								parsedMessage.payload.conversation_id,
							);
							const submittedPrompt = submittedPromptByRunIdRef.current.get(
								parsedMessage.payload.run_id,
							);

							if (submittedPrompt) {
								onRunAcceptedRef.current?.({
									conversationId: parsedMessage.payload.conversation_id,
									prompt: submittedPrompt,
									runId: parsedMessage.payload.run_id,
								});
							}
							if (!runSubmittedAtRef.current.has(parsedMessage.payload.run_id)) {
								runSubmittedAtRef.current.set(parsedMessage.payload.run_id, performance.now());
							}
						}
					} catch (error: unknown) {
						const message =
							error instanceof Error ? error.message : uiCopy.runtime.wsParsingUnknown;
						chatStore.setConnectionState((currentConnectionState) => ({
							...currentConnectionState,
							lastError: message,
						}));
					}
				})();
			});
		}

		reconnectNowRef.current = () => {
			if (isDisposed) {
				return;
			}

			clearReconnectTimer();
			const socketToClose = activeSocket;
			activeSocket = null;
			socketRef.current = null;
			socketToClose?.close();
			connectSocket();
		};

		function handleBrowserOffline(): void {
			clearReconnectTimer();
			commitTransportError('network-cut');
		}

		function handleBrowserOnline(): void {
			if (isDisposed) {
				return;
			}

			chatStore.setConnectionState((currentConnectionState) => ({
				...currentConnectionState,
				connectionStatus:
					currentConnectionState.connectionStatus === 'open'
						? currentConnectionState.connectionStatus
						: 'connecting',
				lastError: null,
				transportErrorCode: null,
			}));
			reconnectNowRef.current();
		}

		window.addEventListener('offline', handleBrowserOffline);
		window.addEventListener('online', handleBrowserOnline);
		connectSocket();

		return () => {
			isDisposed = true;
			window.removeEventListener('offline', handleBrowserOffline);
			window.removeEventListener('online', handleBrowserOnline);
			clearReconnectTimer();
			activeSocket?.close();
			socketRef.current = null;
			reconnectNowRef.current = () => undefined;
		};
	}, [accessToken, chatStore]);

	const expectedPresentationRunId = expectedPresentationRunIdRef.current;
	const presentationSurfaceState = useMemo(
		() =>
			derivePresentationSurfaceState({
				expectedRunId: expectedPresentationRunId,
				presentationRunId,
				presentationRunSurfaces,
			}),
		[expectedPresentationRunId, presentationRunId, presentationRunSurfaces],
	);
	const currentRunSummary = presentationSurfaceState.activeRunId
		? runTransportSummaries.get(presentationSurfaceState.activeRunId)
		: undefined;
	const currentRunPendingDetailCount = presentationSurfaceState.activeRunId
		? countInspectionRequestsForRun(
				pendingInspectionRequestKeys,
				presentationSurfaceState.activeRunId,
			)
		: 0;
	const currentRunFeedback = useMemo(
		() =>
			buildRunFeedbackState({
				has_visible_surface: presentationSurfaceState.currentRunHasVisibleSurface,
				include_presentation_blocks: latestRunRequestIncludesPresentationBlocks,
				is_submitting: isSubmitting,
				pending_detail_count: currentRunPendingDetailCount,
				run_id: presentationSurfaceState.activeRunId,
				run_summary: currentRunSummary,
			}),
		[
			currentRunPendingDetailCount,
			currentRunSummary,
			isSubmitting,
			latestRunRequestIncludesPresentationBlocks,
			presentationSurfaceState.activeRunId,
			presentationSurfaceState.currentRunHasVisibleSurface,
		],
	);

	const submitRunRequest = useCallback(
		(event: FormEvent<HTMLFormElement>): void => {
			event.preventDefault();

			try {
				const payload = createRunRequestPayload({
					apiKey,
					attachments,
					conversationId: activeConversationId,
					desktopTargetConnectionId: selectedDesktopTargetConnectionId,
					includePresentationBlocks,
					model,
					messages: buildRequestMessages?.(prompt),
					prompt,
					provider,
					runId: createClientId('run'),
					traceId: createClientId('trace'),
				});

				if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
					throw new Error(
						connectionStatus === 'connecting'
							? uiCopy.runtime.connectionOpening
							: uiCopy.runtime.connectionUnavailable,
					);
				}

				chatStore.setConnectionState((currentConnectionState) => ({
					...currentConnectionState,
					isSubmitting: true,
					lastError: null,
					transportErrorCode: null,
				}));
				chatStore.setTransportState((currentTransportState) => ({
					...currentTransportState,
					latestRunRequestIncludesPresentationBlocks: payload.include_presentation_blocks === true,
				}));
				chatStore.setPresentationState((currentPresentationState) => ({
					...currentPresentationState,
					currentStreamingRunId: payload.run_id,
					currentStreamingText: '',
				}));
				expectedPresentationRunIdRef.current = payload.run_id;
				conversationIdByRunIdRef.current.set(payload.run_id, payload.conversation_id);
				submittedPromptByRunIdRef.current.set(payload.run_id, prompt);
				runSubmittedAtRef.current.set(payload.run_id, performance.now());
				socketRef.current.send(JSON.stringify(createRunRequestMessage(payload)));
				setAttachments([]);
				setPrompt('');
			} catch (error: unknown) {
				chatStore.setConnectionState((currentConnectionState) => ({
					...currentConnectionState,
					isSubmitting: false,
					lastError: error instanceof Error ? error.message : uiCopy.runtime.unknownSubmit,
					transportErrorCode:
						connectionStatus === 'open' ? null : currentConnectionState.transportErrorCode,
				}));
			}
		},
		[
			apiKey,
			attachments,
			activeConversationId,
			selectedDesktopTargetConnectionId,
			includePresentationBlocks,
			model,
			buildRequestMessages,
			prompt,
			provider,
			connectionStatus,
			chatStore,
		],
	);

	const resolveApproval = useCallback(
		(approvalId: string, decision: ApprovalResolveDecision): void => {
			try {
				if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
					throw new Error(uiCopy.runtime.wsNotOpen);
				}

				chatStore.setConnectionState((currentConnectionState) => ({
					...currentConnectionState,
					lastError: null,
					transportErrorCode: null,
				}));
				socketRef.current.send(
					JSON.stringify(
						createApprovalResolveMessage({
							approval_id: approvalId,
							decision,
						}),
					),
				);
			} catch (error: unknown) {
				chatStore.setConnectionState((currentConnectionState) => ({
					...currentConnectionState,
					lastError: error instanceof Error ? error.message : uiCopy.runtime.unknownApprovalSubmit,
				}));
			}
		},
		[chatStore],
	);

	const requestInspection = useCallback(
		(runId: string, targetKind: InspectionTargetKind, targetId?: string): void => {
			const inspectionRequest = createInspectionRequestIdentity({
				detail_level: DEFAULT_INSPECTION_DETAIL_LEVEL,
				run_id: runId,
				target_id: targetId,
				target_kind: targetKind,
			});
			const previousAnchorId = inspectionAnchorIdsByDetailIdRef.current.get(
				inspectionRequest.detailBlockId,
			);
			const previousRequestKey = inspectionRequestKeysByDetailIdRef.current.get(
				inspectionRequest.detailBlockId,
			);
			const wasStale = staleInspectionRequestKeysRef.current.has(inspectionRequest.requestKey);

			try {
				if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
					throw new Error(uiCopy.runtime.wsNotOpen);
				}

				const runSurface = findPresentationRunSurface(presentationRunSurfacesRef.current, runId);

				if (!runSurface) {
					throw new Error('No tracked presentation run is available for inspection.');
				}

				if (presentationRunIdRef.current !== runId) {
					setPastRunExpanded(runId, true);
				}

				const hasExistingDetail = runSurface.blocks.some(
					(block) => block.id === inspectionRequest.detailBlockId,
				);
				const isStaleDetail = staleInspectionRequestKeysRef.current.has(
					inspectionRequest.requestKey,
				);

				if (hasExistingDetail && !isStaleDetail) {
					scrollToPresentationBlock(inspectionRequest.detailBlockId);
					return;
				}

				if (pendingInspectionRequestKeysRef.current.has(inspectionRequest.requestKey)) {
					return;
				}

				chatStore.setConnectionState((currentConnectionState) => ({
					...currentConnectionState,
					lastError: null,
					transportErrorCode: null,
				}));
				const nextStaleRequestKeys = new Set(staleInspectionRequestKeysRef.current);
				const nextPendingRequestKeys = new Set(pendingInspectionRequestKeysRef.current);

				nextStaleRequestKeys.delete(inspectionRequest.requestKey);
				nextPendingRequestKeys.add(inspectionRequest.requestKey);
				inspectionAnchorIdsByDetailIdRef.current.set(
					inspectionRequest.detailBlockId,
					inspectionRequest.normalizedTargetId,
				);
				inspectionRequestKeysByDetailIdRef.current.set(
					inspectionRequest.detailBlockId,
					inspectionRequest.requestKey,
				);
				replaceStaleInspectionRequestKeys(nextStaleRequestKeys);
				replacePendingInspectionRequestKeys(nextPendingRequestKeys);
				socketRef.current.send(
					JSON.stringify(
						createInspectionRequestMessage({
							detail_level: DEFAULT_INSPECTION_DETAIL_LEVEL,
							run_id: runId,
							target_id: targetId,
							target_kind: targetKind,
						}),
					),
				);
			} catch (error: unknown) {
				const nextPendingRequestKeys = new Set(pendingInspectionRequestKeysRef.current);
				const nextStaleRequestKeys = new Set(staleInspectionRequestKeysRef.current);

				nextPendingRequestKeys.delete(inspectionRequest.requestKey);

				if (wasStale) {
					nextStaleRequestKeys.add(inspectionRequest.requestKey);
				}

				replacePendingInspectionRequestKeys(nextPendingRequestKeys);
				replaceStaleInspectionRequestKeys(nextStaleRequestKeys);

				if (previousAnchorId === undefined) {
					inspectionAnchorIdsByDetailIdRef.current.delete(inspectionRequest.detailBlockId);
				} else {
					inspectionAnchorIdsByDetailIdRef.current.set(
						inspectionRequest.detailBlockId,
						previousAnchorId,
					);
				}

				if (previousRequestKey === undefined) {
					inspectionRequestKeysByDetailIdRef.current.delete(inspectionRequest.detailBlockId);
				} else {
					inspectionRequestKeysByDetailIdRef.current.set(
						inspectionRequest.detailBlockId,
						previousRequestKey,
					);
				}

				chatStore.setConnectionState((currentConnectionState) => ({
					...currentConnectionState,
					lastError:
						error instanceof Error ? error.message : uiCopy.runtime.unknownInspectionSubmit,
				}));
			}
		},
		[
			chatStore,
			replacePendingInspectionRequestKeys,
			replaceStaleInspectionRequestKeys,
			setPastRunExpanded,
		],
	);

	const retryTransport = useCallback((): void => {
		chatStore.setConnectionState((currentConnectionState) => ({
			...currentConnectionState,
			connectionStatus:
				currentConnectionState.connectionStatus === 'open'
					? currentConnectionState.connectionStatus
					: 'connecting',
			lastError: null,
			transportErrorCode: null,
		}));
		reconnectNowRef.current();
	}, [chatStore]);

	return useMemo(
		() => ({
			accessToken,
			attachments,
			apiKey,
			connectionStatus,
			currentPresentationSurface: presentationSurfaceState.currentPresentationSurface,
			currentRunFeedback,
			currentStreamingRunId,
			currentStreamingText,
			desktopTargetConnectionId: selectedDesktopTargetConnectionId,
			expandedPastRunIds,
			includePresentationBlocks,
			inspectionAnchorIdsByDetailId: inspectionAnchorIdsByDetailIdRef.current,
			isSubmitting,
			isRuntimeConfigReady,
			lastError,
			latestRunRequestIncludesPresentationBlocks,
			messages,
			model,
			pastPresentationSurfaces: presentationSurfaceState.pastPresentationSurfaces,
			pendingInspectionRequestKeys,
			presentationRunSurfaces,
			prompt,
			provider,
			requestInspection,
			resolveApproval,
			retryTransport,
			runTransportSummaries,
			store: chatStore,
			setApiKey,
			setAttachments,
			setDesktopTargetConnectionId: setSelectedDesktopTargetConnectionId,
			setIncludePresentationBlocks,
			setModel,
			setPastRunExpanded,
			setPrompt,
			setProvider,
			staleInspectionRequestKeys,
			submitRunRequest,
			transportErrorCode,
		}),
		[
			accessToken,
			attachments,
			apiKey,
			connectionStatus,
			presentationSurfaceState,
			currentRunFeedback,
			currentStreamingRunId,
			currentStreamingText,
			selectedDesktopTargetConnectionId,
			expandedPastRunIds,
			includePresentationBlocks,
			isSubmitting,
			isRuntimeConfigReady,
			lastError,
			latestRunRequestIncludesPresentationBlocks,
			messages,
			model,
			pendingInspectionRequestKeys,
			presentationRunSurfaces,
			prompt,
			provider,
			requestInspection,
			resolveApproval,
			retryTransport,
			runTransportSummaries,
			chatStore,
			setApiKey,
			setIncludePresentationBlocks,
			setModel,
			setPastRunExpanded,
			setProvider,
			staleInspectionRequestKeys,
			submitRunRequest,
			transportErrorCode,
		],
	);
}
