import type {
	NarrationCompletedServerMessage,
	NarrationDeltaServerMessage,
	NarrationSupersededServerMessage,
	PresentationBlocksServerMessage,
	RenderBlock,
} from '../../ws-types.js';
import {
	getInspectionDetailBlockRunId,
	getInspectionDetailRequestKeyFromBlock,
	getInspectionDetailTargetId,
	getInspectionRequestKeyRunId,
	isInspectionDetailBlockIdForRun,
	isInspectionDetailRequestKeyForRun,
} from './inspection-relations.js';
import {
	type InspectionDetailRenderBlock,
	MAX_VISIBLE_PRESENTATION_RUNS,
	type PresentationBlockGroups,
	type PresentationRunSurface,
} from './types.js';

export interface PresentationBlocksUpdateInput {
	readonly expandedPastRunIds: ReadonlySet<string>;
	readonly expectedRunIds: ReadonlySet<string>;
	readonly inspectionAnchorIdsByDetailId: ReadonlyMap<string, string | undefined>;
	readonly inspectionRequestKeysByDetailId: ReadonlyMap<string, string>;
	readonly pendingInspectionRequestKeys: ReadonlySet<string>;
	readonly presentationRunId: string | null;
	readonly presentationRunSurfaces: readonly PresentationRunSurface[];
	readonly staleInspectionRequestKeys: ReadonlySet<string>;
}

export interface PresentationBlocksUpdate {
	readonly detailBlockIds: readonly string[];
	readonly expandedPastRunIds: ReadonlySet<string>;
	readonly expectedRunIds: ReadonlySet<string>;
	readonly inspectionAnchorIdsByDetailId: ReadonlyMap<string, string | undefined>;
	readonly inspectionRequestKeysByDetailId: ReadonlyMap<string, string>;
	readonly pendingInspectionRequestKeys: ReadonlySet<string>;
	readonly presentationRunId: string | null;
	readonly presentationRunSurfaces: readonly PresentationRunSurface[];
	readonly staleInspectionRequestKeys: ReadonlySet<string>;
}

export interface LiveNarrationUpdateInput {
	readonly expandedPastRunIds: ReadonlySet<string>;
	readonly expectedRunIds: ReadonlySet<string>;
	readonly presentationRunId: string | null;
	readonly presentationRunSurfaces: readonly PresentationRunSurface[];
}

export interface LiveNarrationUpdate {
	readonly expandedPastRunIds: ReadonlySet<string>;
	readonly expectedRunIds: ReadonlySet<string>;
	readonly presentationRunId: string | null;
	readonly presentationRunSurfaces: readonly PresentationRunSurface[];
}

export interface PresentationSurfaceState {
	readonly activeRunId: string | null;
	readonly currentPresentationSurface: PresentationRunSurface | null;
	readonly currentRunHasVisibleSurface: boolean;
	readonly pastPresentationSurfaces: readonly PresentationRunSurface[];
}

export function shouldHydratePresentationRun(
	messageRunId: string,
	trackedRunIds: ReadonlySet<string>,
	expectedRunIds: ReadonlySet<string>,
): boolean {
	if (trackedRunIds.has(messageRunId)) {
		return true;
	}

	if (expectedRunIds.size > 0) {
		return expectedRunIds.has(messageRunId);
	}

	return false;
}

export function matchesTrackedRun(
	messageRunId: string | undefined,
	currentRunId: string | null,
	expectedRunIds: ReadonlySet<string>,
): boolean {
	if (!messageRunId) {
		return false;
	}

	return messageRunId === currentRunId || expectedRunIds.has(messageRunId);
}

export function findPresentationRunSurface(
	runSurfaces: readonly PresentationRunSurface[],
	runId: string | null | undefined,
): PresentationRunSurface | undefined {
	if (!runId) {
		return undefined;
	}

	return runSurfaces.find((surface) => surface.run_id === runId);
}

export function splitPresentationBlocks(blocks: readonly RenderBlock[]): PresentationBlockGroups {
	const detailBlocks: InspectionDetailRenderBlock[] = [];
	const nonDetailBlocks: RenderBlock[] = [];

	for (const block of blocks) {
		if (block.type === 'inspection_detail_block') {
			detailBlocks.push(block);
			continue;
		}

		nonDetailBlocks.push(block);
	}

	return {
		detailBlocks,
		nonDetailBlocks,
	};
}

function isWorkNarrationBlock(
	block: RenderBlock,
): block is Extract<RenderBlock, { type: 'work_narration' }> {
	return block.type === 'work_narration';
}

function compareWorkNarrationBlocks(left: RenderBlock, right: RenderBlock): number {
	if (!isWorkNarrationBlock(left) || !isWorkNarrationBlock(right)) {
		return 0;
	}

	const turnDelta = left.payload.turn_index - right.payload.turn_index;

	if (turnDelta !== 0) {
		return turnDelta;
	}

	const sequenceDelta = left.payload.sequence_no - right.payload.sequence_no;

	if (sequenceDelta !== 0) {
		return sequenceDelta;
	}

	return left.id.localeCompare(right.id);
}

function upsertAndOrderWorkNarrationBlock(
	currentBlocks: readonly RenderBlock[],
	nextBlock: Extract<RenderBlock, { type: 'work_narration' }>,
): readonly RenderBlock[] {
	const existingIndex = currentBlocks.findIndex((block) => block.id === nextBlock.id);
	const nextBlocks =
		existingIndex === -1
			? [...currentBlocks, nextBlock]
			: currentBlocks.map((block, index) => (index === existingIndex ? nextBlock : block));

	return [...nextBlocks].sort(compareWorkNarrationBlocks);
}

function createStreamingNarrationBlock(
	message: NarrationDeltaServerMessage,
): Extract<RenderBlock, { type: 'work_narration' }> {
	return {
		created_at: new Date().toISOString(),
		id: message.payload.narration_id,
		payload: {
			locale: message.payload.locale,
			run_id: message.payload.run_id,
			sequence_no: message.payload.sequence_no,
			status: 'streaming',
			text: message.payload.text_delta,
			turn_index: message.payload.turn_index,
		},
		schema_version: 1,
		type: 'work_narration',
	};
}

function applyNarrationDeltaToBlocks(
	currentBlocks: readonly RenderBlock[],
	message: NarrationDeltaServerMessage,
): readonly RenderBlock[] {
	const existingBlock = currentBlocks.find(
		(block): block is Extract<RenderBlock, { type: 'work_narration' }> =>
			block.type === 'work_narration' && block.id === message.payload.narration_id,
	);
	const nextBlock = existingBlock
		? {
				...existingBlock,
				payload: {
					...existingBlock.payload,
					locale: message.payload.locale,
					run_id: message.payload.run_id,
					sequence_no: message.payload.sequence_no,
					status: 'streaming' as const,
					text: `${existingBlock.payload.text}${message.payload.text_delta}`,
					turn_index: message.payload.turn_index,
				},
			}
		: createStreamingNarrationBlock(message);

	return upsertAndOrderWorkNarrationBlock(currentBlocks, nextBlock);
}

function applyNarrationCompletedToBlocks(
	currentBlocks: readonly RenderBlock[],
	message: NarrationCompletedServerMessage,
): readonly RenderBlock[] {
	const existingBlock = currentBlocks.find(
		(block): block is Extract<RenderBlock, { type: 'work_narration' }> =>
			block.type === 'work_narration' && block.id === message.payload.narration_id,
	);
	const nextBlock: Extract<RenderBlock, { type: 'work_narration' }> = existingBlock
		? {
				...existingBlock,
				payload: {
					...existingBlock.payload,
					linked_tool_call_id: message.payload.linked_tool_call_id,
					run_id: message.payload.run_id,
					status: 'completed',
					text: message.payload.full_text,
				},
			}
		: {
				created_at: new Date().toISOString(),
				id: message.payload.narration_id,
				payload: {
					linked_tool_call_id: message.payload.linked_tool_call_id,
					locale: 'tr',
					run_id: message.payload.run_id,
					sequence_no: 0,
					status: 'completed',
					text: message.payload.full_text,
					turn_index: 1,
				},
				schema_version: 1,
				type: 'work_narration',
			};

	return upsertAndOrderWorkNarrationBlock(currentBlocks, nextBlock);
}

function applyNarrationSupersededToBlocks(
	currentBlocks: readonly RenderBlock[],
	message: NarrationSupersededServerMessage,
): readonly RenderBlock[] {
	const existingBlock = currentBlocks.find(
		(block): block is Extract<RenderBlock, { type: 'work_narration' }> =>
			block.type === 'work_narration' && block.id === message.payload.narration_id,
	);

	if (!existingBlock) {
		return currentBlocks;
	}

	return upsertAndOrderWorkNarrationBlock(currentBlocks, {
		...existingBlock,
		payload: {
			...existingBlock.payload,
			run_id: message.payload.run_id,
			status: 'superseded',
		},
	});
}

function isInspectionDetailOnlyMessage(blocks: readonly RenderBlock[]): boolean {
	return blocks.length > 0 && blocks.every((block) => block.type === 'inspection_detail_block');
}

function upsertBlocksById<TBlock extends { readonly id: string }>(
	currentBlocks: readonly TBlock[],
	nextBlocks: readonly TBlock[],
): readonly TBlock[] {
	if (currentBlocks.length === 0) {
		return [...nextBlocks];
	}

	const mergedBlocks = [...currentBlocks];
	const blockIndexesById = new Map(currentBlocks.map((block, index) => [block.id, index] as const));

	for (const block of nextBlocks) {
		const existingIndex = blockIndexesById.get(block.id);

		if (existingIndex === undefined) {
			blockIndexesById.set(block.id, mergedBlocks.length);
			mergedBlocks.push(block);
			continue;
		}

		mergedBlocks[existingIndex] = block;
	}

	return mergedBlocks;
}

function isRunSummarySnapshotMessage(blocks: readonly RenderBlock[]): boolean {
	return blocks.some(
		(block) => block.type === 'event_list' || block.type === 'status' || block.type === 'text',
	);
}

function composePresentationBlocks(
	nonDetailBlocks: readonly RenderBlock[],
	detailBlocks: readonly InspectionDetailRenderBlock[],
	inspectionAnchorIdsByDetailId?: ReadonlyMap<string, string | undefined>,
): readonly RenderBlock[] {
	if (detailBlocks.length === 0) {
		return [...nonDetailBlocks];
	}

	const anchoredDetailBlocksById = new Map<string, InspectionDetailRenderBlock[]>();
	const detachedDetailBlocks: InspectionDetailRenderBlock[] = [];
	const visibleBlockIds = new Set(nonDetailBlocks.map((block) => block.id));

	for (const detailBlock of detailBlocks) {
		const anchorId =
			inspectionAnchorIdsByDetailId?.get(detailBlock.id) ??
			getInspectionDetailTargetId(detailBlock.id);

		if (!anchorId || !visibleBlockIds.has(anchorId)) {
			detachedDetailBlocks.push(detailBlock);
			continue;
		}

		const anchoredBlocks = anchoredDetailBlocksById.get(anchorId) ?? [];
		anchoredBlocks.push(detailBlock);
		anchoredDetailBlocksById.set(anchorId, anchoredBlocks);
	}

	const orderedBlocks: RenderBlock[] = [];

	for (const block of nonDetailBlocks) {
		orderedBlocks.push(block);

		for (const detailBlock of anchoredDetailBlocksById.get(block.id) ?? []) {
			orderedBlocks.push(detailBlock);
		}
	}

	orderedBlocks.push(...detachedDetailBlocks);
	return orderedBlocks;
}

function mergePresentationBlocks(
	currentBlocks: readonly RenderBlock[],
	nextBlocks: readonly RenderBlock[],
	options: Readonly<{
		inspectionAnchorIdsByDetailId?: ReadonlyMap<string, string | undefined>;
		isSameRun: boolean;
	}>,
): readonly RenderBlock[] {
	const nextBlockGroups = splitPresentationBlocks(nextBlocks);

	if (currentBlocks.length === 0 || !options.isSameRun) {
		return composePresentationBlocks(
			nextBlockGroups.nonDetailBlocks,
			nextBlockGroups.detailBlocks,
			options.inspectionAnchorIdsByDetailId,
		);
	}

	const currentBlockGroups = splitPresentationBlocks(currentBlocks);
	const mergedNonDetailBlocks = isInspectionDetailOnlyMessage(nextBlocks)
		? currentBlockGroups.nonDetailBlocks
		: isRunSummarySnapshotMessage(nextBlockGroups.nonDetailBlocks)
			? nextBlockGroups.nonDetailBlocks
			: upsertBlocksById(currentBlockGroups.nonDetailBlocks, nextBlockGroups.nonDetailBlocks);
	const mergedDetailBlocks = upsertBlocksById(
		currentBlockGroups.detailBlocks,
		nextBlockGroups.detailBlocks,
	);

	return composePresentationBlocks(
		mergedNonDetailBlocks,
		mergedDetailBlocks,
		options.inspectionAnchorIdsByDetailId,
	);
}

function rememberInspectionDetailAnchors(
	blocks: readonly RenderBlock[],
	inspectionAnchorIdsByDetailId: Map<string, string | undefined>,
): void {
	for (const block of blocks) {
		if (block.type !== 'inspection_detail_block') {
			continue;
		}

		const targetId = getInspectionDetailTargetId(block.id);

		if (!targetId) {
			continue;
		}

		inspectionAnchorIdsByDetailId.set(block.id, targetId);
	}
}

function pruneInspectionDetailAnchors(
	blocks: readonly RenderBlock[],
	runId: string,
	inspectionAnchorIdsByDetailId: Map<string, string | undefined>,
	requestKeysByDetailId: ReadonlyMap<string, string>,
	retainedRequestKeys: ReadonlySet<string>,
): void {
	const visibleDetailIds = new Set(
		splitPresentationBlocks(blocks).detailBlocks.map((block) => block.id),
	);

	for (const detailId of [...inspectionAnchorIdsByDetailId.keys()]) {
		const requestKey = requestKeysByDetailId.get(detailId);
		const shouldRetain =
			isInspectionDetailBlockIdForRun(detailId, runId) &&
			(visibleDetailIds.has(detailId) ||
				(requestKey !== undefined && retainedRequestKeys.has(requestKey)));

		if (!shouldRetain) {
			inspectionAnchorIdsByDetailId.delete(detailId);
		}
	}
}

function rememberInspectionDetailRequestKeys(
	blocks: readonly RenderBlock[],
	runId: string,
	requestKeysByDetailId: Map<string, string>,
): void {
	for (const block of blocks) {
		if (block.type !== 'inspection_detail_block') {
			continue;
		}

		requestKeysByDetailId.set(
			block.id,
			getInspectionDetailRequestKeyFromBlock(block, runId, requestKeysByDetailId),
		);
	}
}

function pruneInspectionDetailRequestKeys(
	blocks: readonly RenderBlock[],
	runId: string,
	requestKeysByDetailId: Map<string, string>,
	retainedRequestKeys: ReadonlySet<string>,
): void {
	const visibleDetailIds = new Set(
		splitPresentationBlocks(blocks).detailBlocks.map((block) => block.id),
	);

	for (const [detailId, requestKey] of [...requestKeysByDetailId.entries()]) {
		const shouldRetain =
			isInspectionDetailBlockIdForRun(detailId, runId) &&
			isInspectionDetailRequestKeyForRun(requestKey, runId) &&
			(visibleDetailIds.has(detailId) || retainedRequestKeys.has(requestKey));

		if (!shouldRetain) {
			requestKeysByDetailId.delete(detailId);
		}
	}
}

function pruneInspectionTrackingForRetainedRuns(
	retainedRunIds: ReadonlySet<string>,
	inspectionAnchorIdsByDetailId: Map<string, string | undefined>,
	inspectionRequestKeysByDetailId: Map<string, string>,
	pendingRequestKeys: ReadonlySet<string>,
	staleRequestKeys: ReadonlySet<string>,
): {
	readonly pendingRequestKeys: ReadonlySet<string>;
	readonly staleRequestKeys: ReadonlySet<string>;
} {
	for (const detailId of [...inspectionAnchorIdsByDetailId.keys()]) {
		const detailRunId = getInspectionDetailBlockRunId(detailId);

		if (!detailRunId || !retainedRunIds.has(detailRunId)) {
			inspectionAnchorIdsByDetailId.delete(detailId);
		}
	}

	for (const [detailId, requestKey] of [...inspectionRequestKeysByDetailId.entries()]) {
		const detailRunId = getInspectionDetailBlockRunId(detailId);
		const requestRunId = getInspectionRequestKeyRunId(requestKey);

		if (
			!detailRunId ||
			!requestRunId ||
			!retainedRunIds.has(detailRunId) ||
			!retainedRunIds.has(requestRunId)
		) {
			inspectionRequestKeysByDetailId.delete(detailId);
		}
	}

	const nextPendingRequestKeys = new Set<string>();

	for (const requestKey of pendingRequestKeys) {
		const requestRunId = getInspectionRequestKeyRunId(requestKey);

		if (requestRunId && retainedRunIds.has(requestRunId)) {
			nextPendingRequestKeys.add(requestKey);
		}
	}

	const nextStaleRequestKeys = new Set<string>();

	for (const requestKey of staleRequestKeys) {
		const requestRunId = getInspectionRequestKeyRunId(requestKey);

		if (requestRunId && retainedRunIds.has(requestRunId)) {
			nextStaleRequestKeys.add(requestKey);
		}
	}

	return {
		pendingRequestKeys: nextPendingRequestKeys,
		staleRequestKeys: nextStaleRequestKeys,
	};
}

export function upsertPresentationRunSurface(
	runSurfaces: readonly PresentationRunSurface[],
	nextSurface: PresentationRunSurface,
	options: Readonly<{
		makeCurrent: boolean;
	}>,
): readonly PresentationRunSurface[] {
	const existingIndex = runSurfaces.findIndex((surface) => surface.run_id === nextSurface.run_id);

	if (existingIndex === -1) {
		const nextRunSurfaces = options.makeCurrent
			? [nextSurface, ...runSurfaces]
			: [...runSurfaces, nextSurface];

		return nextRunSurfaces.slice(0, MAX_VISIBLE_PRESENTATION_RUNS);
	}

	if (options.makeCurrent) {
		const remainingRunSurfaces = runSurfaces.filter(
			(surface) => surface.run_id !== nextSurface.run_id,
		);

		return [nextSurface, ...remainingRunSurfaces].slice(0, MAX_VISIBLE_PRESENTATION_RUNS);
	}

	const nextRunSurfaces = [...runSurfaces];
	nextRunSurfaces[existingIndex] = nextSurface;
	return nextRunSurfaces;
}

function deriveLiveNarrationUpdateForBlocks(
	message:
		| NarrationCompletedServerMessage
		| NarrationDeltaServerMessage
		| NarrationSupersededServerMessage,
	input: LiveNarrationUpdateInput,
	updateBlocks: (currentBlocks: readonly RenderBlock[]) => readonly RenderBlock[],
): LiveNarrationUpdate | null {
	const messageRunId = message.payload.run_id;
	const trackedRunIds = new Set(input.presentationRunSurfaces.map((surface) => surface.run_id));

	if (!shouldHydratePresentationRun(messageRunId, trackedRunIds, input.expectedRunIds)) {
		return null;
	}

	const currentSurface = findPresentationRunSurface(input.presentationRunSurfaces, messageRunId);
	const nextBlocks = updateBlocks(currentSurface?.blocks ?? []);
	const shouldMakeCurrentRun =
		input.presentationRunId === null ||
		input.presentationRunId === messageRunId ||
		input.expectedRunIds.has(messageRunId);
	const nextPresentationRunId = shouldMakeCurrentRun ? messageRunId : input.presentationRunId;
	const nextExpandedPastRunIds = new Set(input.expandedPastRunIds);

	if (nextPresentationRunId) {
		nextExpandedPastRunIds.delete(nextPresentationRunId);
	}

	const nextRunSurfaces = upsertPresentationRunSurface(
		input.presentationRunSurfaces,
		{
			blocks: nextBlocks,
			replayMode: false,
			run_id: messageRunId,
			trace_id: message.payload.trace_id,
		},
		{
			makeCurrent: shouldMakeCurrentRun,
		},
	);
	const retainedRunIds = new Set(nextRunSurfaces.map((surface) => surface.run_id));

	for (const runId of [...nextExpandedPastRunIds]) {
		if (!retainedRunIds.has(runId)) {
			nextExpandedPastRunIds.delete(runId);
		}
	}

	return {
		expandedPastRunIds: nextExpandedPastRunIds,
		expectedRunIds: shouldMakeCurrentRun
			? new Set([...input.expectedRunIds, messageRunId])
			: input.expectedRunIds,
		presentationRunId: nextPresentationRunId,
		presentationRunSurfaces: nextRunSurfaces,
	};
}

export function deriveLiveNarrationDeltaUpdate(
	message: NarrationDeltaServerMessage,
	input: LiveNarrationUpdateInput,
): LiveNarrationUpdate | null {
	return deriveLiveNarrationUpdateForBlocks(message, input, (currentBlocks) =>
		applyNarrationDeltaToBlocks(currentBlocks, message),
	);
}

export function deriveLiveNarrationCompletedUpdate(
	message: NarrationCompletedServerMessage,
	input: LiveNarrationUpdateInput,
): LiveNarrationUpdate | null {
	return deriveLiveNarrationUpdateForBlocks(message, input, (currentBlocks) =>
		applyNarrationCompletedToBlocks(currentBlocks, message),
	);
}

export function deriveLiveNarrationSupersededUpdate(
	message: NarrationSupersededServerMessage,
	input: LiveNarrationUpdateInput,
): LiveNarrationUpdate | null {
	return deriveLiveNarrationUpdateForBlocks(message, input, (currentBlocks) =>
		applyNarrationSupersededToBlocks(currentBlocks, message),
	);
}

export function derivePresentationBlocksUpdate(
	message: PresentationBlocksServerMessage,
	input: PresentationBlocksUpdateInput,
): PresentationBlocksUpdate | null {
	const messageRunId = message.payload.run_id;
	const trackedRunIds = new Set(input.presentationRunSurfaces.map((surface) => surface.run_id));

	if (!shouldHydratePresentationRun(messageRunId, trackedRunIds, input.expectedRunIds)) {
		return null;
	}

	const currentSurface = findPresentationRunSurface(input.presentationRunSurfaces, messageRunId);
	const currentBlocks = currentSurface?.blocks ?? [];
	const hasTrackedSurface = currentSurface !== undefined;
	const detailBlocks = message.payload.blocks.filter(
		(block): block is InspectionDetailRenderBlock => block.type === 'inspection_detail_block',
	);
	const detailBlockIds = detailBlocks.map((block) => block.id);
	const inspectionRequestKeysByDetailId = new Map(input.inspectionRequestKeysByDetailId);
	const inspectionAnchorIdsByDetailId = new Map(input.inspectionAnchorIdsByDetailId);
	const inspectionDetailRequestKeys = new Set(
		detailBlocks.map((block) =>
			getInspectionDetailRequestKeyFromBlock(block, messageRunId, inspectionRequestKeysByDetailId),
		),
	);
	const currentDetailBlocks = splitPresentationBlocks(currentBlocks).detailBlocks;
	const currentDetailRequestKeys = new Set(
		currentDetailBlocks.map((block) =>
			getInspectionDetailRequestKeyFromBlock(block, messageRunId, inspectionRequestKeysByDetailId),
		),
	);
	const staleDetailCandidateKeys = [...currentDetailRequestKeys].filter(
		(requestKey) => !inspectionDetailRequestKeys.has(requestKey),
	);
	const nextPendingRequestKeys = new Set(input.pendingInspectionRequestKeys);
	const nextStaleRequestKeys = new Set(input.staleInspectionRequestKeys);
	const nextBlocks = mergePresentationBlocks(currentBlocks, message.payload.blocks, {
		inspectionAnchorIdsByDetailId,
		isSameRun: hasTrackedSurface,
	});

	rememberInspectionDetailAnchors(message.payload.blocks, inspectionAnchorIdsByDetailId);
	rememberInspectionDetailRequestKeys(
		message.payload.blocks,
		messageRunId,
		inspectionRequestKeysByDetailId,
	);

	for (const requestKey of inspectionDetailRequestKeys) {
		nextPendingRequestKeys.delete(requestKey);
		nextStaleRequestKeys.delete(requestKey);
	}

	if (
		hasTrackedSurface &&
		!isInspectionDetailOnlyMessage(message.payload.blocks) &&
		staleDetailCandidateKeys.length > 0
	) {
		for (const requestKey of staleDetailCandidateKeys) {
			nextStaleRequestKeys.add(requestKey);
		}
	}

	const shouldMakeCurrentRun =
		input.presentationRunId === null ||
		input.presentationRunId === messageRunId ||
		input.expectedRunIds.has(messageRunId);
	const nextRunSurfaces = upsertPresentationRunSurface(
		input.presentationRunSurfaces,
		{
			blocks: nextBlocks,
			replayMode: currentSurface?.replayMode ?? false,
			run_id: messageRunId,
			trace_id: message.payload.trace_id,
		},
		{
			makeCurrent: shouldMakeCurrentRun,
		},
	);
	const retainedRunIds = new Set(nextRunSurfaces.map((surface) => surface.run_id));
	const nextInteractionTracking = pruneInspectionTrackingForRetainedRuns(
		retainedRunIds,
		inspectionAnchorIdsByDetailId,
		inspectionRequestKeysByDetailId,
		nextPendingRequestKeys,
		nextStaleRequestKeys,
	);
	const retainedRequestKeys = new Set([
		...nextInteractionTracking.pendingRequestKeys,
		...nextInteractionTracking.staleRequestKeys,
	]);

	pruneInspectionDetailRequestKeys(
		nextBlocks,
		messageRunId,
		inspectionRequestKeysByDetailId,
		retainedRequestKeys,
	);
	pruneInspectionDetailAnchors(
		nextBlocks,
		messageRunId,
		inspectionAnchorIdsByDetailId,
		inspectionRequestKeysByDetailId,
		retainedRequestKeys,
	);

	const nextCurrentRunId = shouldMakeCurrentRun ? messageRunId : input.presentationRunId;
	const nextExpandedPastRunIds = new Set(input.expandedPastRunIds);

	if (nextCurrentRunId) {
		nextExpandedPastRunIds.delete(nextCurrentRunId);
	}

	for (const runId of [...nextExpandedPastRunIds]) {
		if (!retainedRunIds.has(runId)) {
			nextExpandedPastRunIds.delete(runId);
		}
	}

	if (detailBlockIds.length > 0 && nextCurrentRunId !== messageRunId) {
		nextExpandedPastRunIds.add(messageRunId);
	}

	const nextExpectedRunIds = shouldMakeCurrentRun
		? new Set([...input.expectedRunIds, messageRunId])
		: input.expectedRunIds;

	return {
		detailBlockIds,
		expandedPastRunIds: nextExpandedPastRunIds,
		expectedRunIds: nextExpectedRunIds,
		inspectionAnchorIdsByDetailId,
		inspectionRequestKeysByDetailId,
		pendingInspectionRequestKeys: nextInteractionTracking.pendingRequestKeys,
		presentationRunId: nextCurrentRunId,
		presentationRunSurfaces: nextRunSurfaces,
		staleInspectionRequestKeys: nextInteractionTracking.staleRequestKeys,
	};
}

export function derivePresentationSurfaceState(input: {
	readonly expectedRunIds: ReadonlySet<string>;
	readonly presentationRunId: string | null;
	readonly presentationRunSurfaces: readonly PresentationRunSurface[];
}): PresentationSurfaceState {
	const currentPresentationSurface =
		findPresentationRunSurface(input.presentationRunSurfaces, input.presentationRunId) ??
		input.presentationRunSurfaces[0] ??
		null;
	const expectedRunId = input.expectedRunIds.values().next().value ?? null;
	const activeRunId =
		expectedRunId ?? currentPresentationSurface?.run_id ?? input.presentationRunId ?? null;

	return {
		activeRunId,
		currentPresentationSurface,
		currentRunHasVisibleSurface:
			activeRunId !== null &&
			findPresentationRunSurface(input.presentationRunSurfaces, activeRunId) !== undefined,
		pastPresentationSurfaces: currentPresentationSurface
			? input.presentationRunSurfaces.filter(
					(surface) => surface.run_id !== currentPresentationSurface.run_id,
				)
			: input.presentationRunSurfaces,
	};
}
