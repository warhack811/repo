import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

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
	readonly apiKey: string;
	readonly connectionStatus: ConnectionStatus;
	readonly currentPresentationSurface: PresentationRunSurface | null;
	readonly currentRunFeedback: RunFeedbackState | null;
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
	readonly staleInspectionRequestKeys: readonly string[];
	setApiKey: (value: string) => void;
	setIncludePresentationBlocks: (value: boolean) => void;
	setModel: (value: string) => void;
	setPastRunExpanded: (runId: string, isExpanded: boolean) => void;
	setPrompt: (value: string) => void;
	setProvider: (value: GatewayProvider) => void;
	submitRunRequest: (event: FormEvent<HTMLFormElement>) => void;
	requestInspection: (runId: string, targetKind: InspectionTargetKind, targetId?: string) => void;
	resolveApproval: (approvalId: string, decision: ApprovalResolveDecision) => void;
}

export interface UseChatRuntimeOptions {
	readonly accessToken?: string | null;
}

interface StoredRuntimeConfigCandidate {
	readonly apiKey?: unknown;
	readonly includePresentationBlocks?: unknown;
	readonly model?: unknown;
	readonly provider?: unknown;
}

const RUNTIME_CONFIG_STORAGE_KEY = 'runa.developer.runtime_config';
const DEFAULT_PROVIDER: GatewayProvider = 'groq';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';

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

		return {
			apiKey: typeof parsedValue.apiKey === 'string' ? parsedValue.apiKey : '',
			includePresentationBlocks:
				typeof parsedValue.includePresentationBlocks === 'boolean'
					? parsedValue.includePresentationBlocks
					: true,
			model:
				typeof parsedValue.model === 'string' && parsedValue.model.trim().length > 0
					? parsedValue.model
					: DEFAULT_MODEL,
			provider:
				parsedValue.provider === 'claude' || parsedValue.provider === 'groq'
					? parsedValue.provider
					: DEFAULT_PROVIDER,
		};
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
	const { accessToken } = options;
	const storedRuntimeConfig = readStoredRuntimeConfig();
	const reconnectTimerRef = useRef<number | null>(null);
	const socketRef = useRef<WebSocket | null>(null);
	const expectedPresentationRunIdRef = useRef<string | null>(null);
	const expandedPastRunIdsRef = useRef<Set<string>>(new Set());
	const inspectionAnchorIdsByDetailIdRef = useRef<Map<string, string | undefined>>(new Map());
	const inspectionRequestKeysByDetailIdRef = useRef<Map<string, string>>(new Map());
	const pendingInspectionRequestKeysRef = useRef<Set<string>>(new Set());
	const presentationRunSurfacesRef = useRef<readonly PresentationRunSurface[]>([]);
	const presentationRunIdRef = useRef<string | null>(null);
	const staleInspectionRequestKeysRef = useRef<Set<string>>(new Set());
	const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
	const [includePresentationBlocks, setIncludePresentationBlocks] = useState(
		storedRuntimeConfig.includePresentationBlocks,
	);
	const [provider, setProvider] = useState<GatewayProvider>(storedRuntimeConfig.provider);
	const [model, setModel] = useState(storedRuntimeConfig.model);
	const [apiKey, setApiKey] = useState(storedRuntimeConfig.apiKey);
	const [prompt, setPrompt] = useState('');
	const [messages, setMessages] = useState<WebSocketServerBridgeMessage[]>([]);
	const [expandedPastRunIds, setExpandedPastRunIds] = useState<readonly string[]>([]);
	const [presentationRunId, setPresentationRunId] = useState<string | null>(null);
	const [presentationRunSurfaces, setPresentationRunSurfaces] = useState<
		readonly PresentationRunSurface[]
	>([]);
	const [pendingInspectionRequestKeys, setPendingInspectionRequestKeys] = useState<
		readonly string[]
	>([]);
	const [staleInspectionRequestKeys, setStaleInspectionRequestKeys] = useState<readonly string[]>(
		[],
	);
	const [lastError, setLastError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [
		latestRunRequestIncludesPresentationBlocks,
		setLatestRunRequestIncludesPresentationBlocks,
	] = useState<boolean | null>(null);
	const isRuntimeConfigReady = model.trim().length > 0;

	useEffect(() => {
		persistRuntimeConfig({
			apiKey,
			includePresentationBlocks,
			model,
			provider,
		});
	}, [apiKey, includePresentationBlocks, model, provider]);

	function replacePendingInspectionRequestKeys(nextRequestKeys: Iterable<string>): void {
		const nextKeySet = new Set(nextRequestKeys);

		pendingInspectionRequestKeysRef.current = nextKeySet;
		setPendingInspectionRequestKeys(toSortedStringArray(nextKeySet));
	}

	function replaceStaleInspectionRequestKeys(nextRequestKeys: Iterable<string>): void {
		const nextKeySet = new Set(nextRequestKeys);

		staleInspectionRequestKeysRef.current = nextKeySet;
		setStaleInspectionRequestKeys(toSortedStringArray(nextKeySet));
	}

	function replaceExpandedPastRunIds(nextRunIds: Iterable<string>): void {
		const nextRunIdSet = new Set(nextRunIds);

		expandedPastRunIdsRef.current = nextRunIdSet;
		setExpandedPastRunIds(toSortedStringArray(nextRunIdSet));
	}

	function setPastRunExpanded(runId: string, isExpanded: boolean): void {
		const nextExpandedPastRunIds = new Set(expandedPastRunIdsRef.current);

		if (isExpanded) {
			nextExpandedPastRunIds.add(runId);
		} else {
			nextExpandedPastRunIds.delete(runId);
		}

		replaceExpandedPastRunIds(nextExpandedPastRunIds);
	}

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
			setPendingInspectionRequestKeys(toSortedStringArray(nextKeySet));
		}

		function commitStaleInspectionRequestKeys(nextRequestKeys: Iterable<string>): void {
			const nextKeySet = new Set(nextRequestKeys);

			staleInspectionRequestKeysRef.current = nextKeySet;
			setStaleInspectionRequestKeys(toSortedStringArray(nextKeySet));
		}

		function commitExpandedPastRunIds(nextRunIds: Iterable<string>): void {
			const nextRunIdSet = new Set(nextRunIds);

			expandedPastRunIdsRef.current = nextRunIdSet;
			setExpandedPastRunIds(toSortedStringArray(nextRunIdSet));
		}

		function scheduleReconnect(message?: string): void {
			if (isDisposed) {
				return;
			}

			clearReconnectTimer();
			reconnectAttemptCount += 1;
			setConnectionStatus('connecting');
			setLastError(message ?? uiCopy.runtime.wsClosedRetrying);
			reconnectTimerRef.current = window.setTimeout(
				() => {
					connectSocket();
				},
				Math.min(1000 * reconnectAttemptCount, 4000),
			);
		}

		function connectSocket(): void {
			if (isDisposed) {
				return;
			}

			clearReconnectTimer();
			setConnectionStatus('connecting');
			const socket = new WebSocket(createWebSocketUrl(accessToken));
			activeSocket = socket;
			socketRef.current = socket;

			socket.addEventListener('open', () => {
				if (isDisposed || activeSocket !== socket) {
					return;
				}

				reconnectAttemptCount = 0;
				setConnectionStatus('open');
				setLastError(null);
			});

			socket.addEventListener('close', (event) => {
				if (isDisposed || activeSocket !== socket) {
					return;
				}

				activeSocket = null;
				socketRef.current = null;

				const closeReason = event.reason.trim();

				if (event.code === 1008) {
					setConnectionStatus('error');
					setLastError(
						closeReason.length > 0 ? closeReason : 'Authenticated WebSocket connection required.',
					);
					return;
				}

				scheduleReconnect(
					closeReason.length > 0
						? `${closeReason} Retrying live connection...`
						: uiCopy.runtime.wsClosedRetrying,
				);
			});

			socket.addEventListener('error', () => {
				if (isDisposed || activeSocket !== socket) {
					return;
				}

				setConnectionStatus('error');
				setLastError(uiCopy.runtime.wsFailedRetrying);
			});

			socket.addEventListener('message', (event) => {
				void (async () => {
					if (isDisposed || activeSocket !== socket) {
						return;
					}

					try {
						const raw = await decodeWebSocketMessageData(event.data as Blob | string);
						const parsedMessage = parseServerMessage(raw);

						setMessages((currentMessages) => [...currentMessages, parsedMessage]);

						if (parsedMessage.type === 'presentation.blocks') {
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
							setPresentationRunId(nextPresentationState.presentationRunId);
							setPresentationRunSurfaces(nextPresentationState.presentationRunSurfaces);

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

						if (parsedMessage.type === 'run.rejected') {
							if (
								matchesTrackedRun(
									parsedMessage.payload.run_id,
									presentationRunIdRef.current,
									expectedPresentationRunIdRef.current,
								)
							) {
								setIsSubmitting(false);

								if (parsedMessage.payload.run_id === expectedPresentationRunIdRef.current) {
									expectedPresentationRunIdRef.current = presentationRunIdRef.current;
								}
							}

							setLastError(parsedMessage.payload.error_message);
						}

						if (parsedMessage.type === 'run.finished') {
							if (
								!matchesTrackedRun(
									parsedMessage.payload.run_id,
									presentationRunIdRef.current,
									expectedPresentationRunIdRef.current,
								)
							) {
								return;
							}

							setIsSubmitting(false);
							setLastError(
								parsedMessage.payload.final_state === 'FAILED'
									? (parsedMessage.payload.error_message ?? 'Calisma hata ile bitti.')
									: null,
							);
						}
					} catch (error: unknown) {
						const message =
							error instanceof Error ? error.message : uiCopy.runtime.wsParsingUnknown;
						setLastError(message);
					}
				})();
			});
		}

		connectSocket();

		return () => {
			isDisposed = true;
			clearReconnectTimer();
			activeSocket?.close();
			socketRef.current = null;
		};
	}, [accessToken]);

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
	const runTransportSummaries = useMemo(() => buildRunTransportSummaryMap(messages), [messages]);
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

	function submitRunRequest(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault();

		try {
			const payload = createRunRequestPayload({
				apiKey,
				includePresentationBlocks,
				model,
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

			setIsSubmitting(true);
			setLastError(null);
			setLatestRunRequestIncludesPresentationBlocks(payload.include_presentation_blocks === true);
			expectedPresentationRunIdRef.current = payload.run_id;
			socketRef.current.send(JSON.stringify(createRunRequestMessage(payload)));
			setPrompt('');
		} catch (error: unknown) {
			setIsSubmitting(false);
			setLastError(error instanceof Error ? error.message : uiCopy.runtime.unknownSubmit);
		}
	}

	function resolveApproval(approvalId: string, decision: ApprovalResolveDecision): void {
		try {
			if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
				throw new Error(uiCopy.runtime.wsNotOpen);
			}

			setLastError(null);
			socketRef.current.send(
				JSON.stringify(
					createApprovalResolveMessage({
						approval_id: approvalId,
						decision,
					}),
				),
			);
		} catch (error: unknown) {
			setLastError(error instanceof Error ? error.message : uiCopy.runtime.unknownApprovalSubmit);
		}
	}

	function requestInspection(
		runId: string,
		targetKind: InspectionTargetKind,
		targetId?: string,
	): void {
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
			const isStaleDetail = staleInspectionRequestKeysRef.current.has(inspectionRequest.requestKey);

			if (hasExistingDetail && !isStaleDetail) {
				scrollToPresentationBlock(inspectionRequest.detailBlockId);
				return;
			}

			if (pendingInspectionRequestKeysRef.current.has(inspectionRequest.requestKey)) {
				return;
			}

			setLastError(null);
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

			setLastError(error instanceof Error ? error.message : uiCopy.runtime.unknownInspectionSubmit);
		}
	}

	return {
		apiKey,
		connectionStatus,
		currentPresentationSurface: presentationSurfaceState.currentPresentationSurface,
		currentRunFeedback,
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
		runTransportSummaries,
		setApiKey,
		setIncludePresentationBlocks,
		setModel,
		setPastRunExpanded,
		setPrompt,
		setProvider,
		staleInspectionRequestKeys,
		submitRunRequest,
	};
}
