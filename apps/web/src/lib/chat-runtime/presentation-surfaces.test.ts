import { describe, expect, it } from 'vitest';
import type {
	NarrationCompletedServerMessage,
	NarrationDeltaServerMessage,
	NarrationSupersededServerMessage,
	PresentationBlocksServerMessage,
	RenderBlock,
} from '../../ws-types.js';

import {
	deriveLiveNarrationCompletedUpdate,
	deriveLiveNarrationDeltaUpdate,
	deriveLiveNarrationSupersededUpdate,
	derivePresentationBlocksUpdate,
} from './presentation-surfaces.js';
import type { PresentationRunSurface } from './types.js';

const runId = 'run_narration';
const traceId = 'trace_narration';

function createDelta(
	narrationId: string,
	textDelta: string,
	sequenceNo: number,
	turnIndex = 1,
): NarrationDeltaServerMessage {
	return {
		payload: {
			locale: 'tr',
			narration_id: narrationId,
			run_id: runId,
			sequence_no: sequenceNo,
			text_delta: textDelta,
			trace_id: traceId,
			turn_index: turnIndex,
		},
		type: 'narration.delta',
	};
}

function createCompleted(
	narrationId: string,
	fullText: string,
	linkedToolCallId = 'call_001',
): NarrationCompletedServerMessage {
	return {
		payload: {
			full_text: fullText,
			linked_tool_call_id: linkedToolCallId,
			narration_id: narrationId,
			run_id: runId,
			trace_id: traceId,
		},
		type: 'narration.completed',
	};
}

function createSuperseded(narrationId: string): NarrationSupersededServerMessage {
	return {
		payload: {
			narration_id: narrationId,
			run_id: runId,
			trace_id: traceId,
		},
		type: 'narration.superseded',
	};
}

function getWorkNarrationBlocks(
	surfaces: readonly PresentationRunSurface[],
): readonly Extract<RenderBlock, { type: 'work_narration' }>[] {
	return (surfaces[0]?.blocks ?? []).filter(
		(block): block is Extract<RenderBlock, { type: 'work_narration' }> =>
			block.type === 'work_narration',
	);
}

describe('presentation narration surfaces', () => {
	it('appends narration.delta chunks into one streaming block', () => {
		const firstUpdate = deriveLiveNarrationDeltaUpdate(createDelta('narration_001', 'package', 1), {
			expandedPastRunIds: new Set(),
			expectedRunIds: new Set([runId]),
			presentationRunId: null,
			presentationRunSurfaces: [],
		});
		const secondUpdate = deriveLiveNarrationDeltaUpdate(createDelta('narration_001', '.json', 2), {
			expandedPastRunIds: firstUpdate?.expandedPastRunIds ?? new Set(),
			expectedRunIds: firstUpdate?.expectedRunIds ?? new Set([runId]),
			presentationRunId: firstUpdate?.presentationRunId ?? null,
			presentationRunSurfaces: firstUpdate?.presentationRunSurfaces ?? [],
		});

		const blocks = getWorkNarrationBlocks(secondUpdate?.presentationRunSurfaces ?? []);

		expect(blocks).toHaveLength(1);
		expect(blocks[0]?.payload).toMatchObject({
			sequence_no: 2,
			status: 'streaming',
			text: 'package.json',
			turn_index: 1,
		});
	});

	it('finalizes narration.completed with full text and linked tool id', () => {
		const deltaUpdate = deriveLiveNarrationDeltaUpdate(createDelta('narration_001', 'pkg', 1), {
			expandedPastRunIds: new Set(),
			expectedRunIds: new Set([runId]),
			presentationRunId: null,
			presentationRunSurfaces: [],
		});
		const completedUpdate = deriveLiveNarrationCompletedUpdate(
			createCompleted('narration_001', 'package.json dosyas?n? kontrol ediyorum.', 'call_read'),
			{
				expandedPastRunIds: deltaUpdate?.expandedPastRunIds ?? new Set(),
				expectedRunIds: deltaUpdate?.expectedRunIds ?? new Set([runId]),
				presentationRunId: deltaUpdate?.presentationRunId ?? null,
				presentationRunSurfaces: deltaUpdate?.presentationRunSurfaces ?? [],
			},
		);

		const blocks = getWorkNarrationBlocks(completedUpdate?.presentationRunSurfaces ?? []);

		expect(blocks).toHaveLength(1);
		expect(blocks[0]?.payload).toMatchObject({
			linked_tool_call_id: 'call_read',
			status: 'completed',
			text: 'package.json dosyas?n? kontrol ediyorum.',
		});
	});

	it('marks narration.superseded without deleting the canonical block', () => {
		const deltaUpdate = deriveLiveNarrationDeltaUpdate(createDelta('narration_001', 'eski', 1), {
			expandedPastRunIds: new Set(),
			expectedRunIds: new Set([runId]),
			presentationRunId: null,
			presentationRunSurfaces: [],
		});
		const supersededUpdate = deriveLiveNarrationSupersededUpdate(
			createSuperseded('narration_001'),
			{
				expandedPastRunIds: deltaUpdate?.expandedPastRunIds ?? new Set(),
				expectedRunIds: deltaUpdate?.expectedRunIds ?? new Set([runId]),
				presentationRunId: deltaUpdate?.presentationRunId ?? null,
				presentationRunSurfaces: deltaUpdate?.presentationRunSurfaces ?? [],
			},
		);

		const blocks = getWorkNarrationBlocks(supersededUpdate?.presentationRunSurfaces ?? []);

		expect(blocks).toHaveLength(1);
		expect(blocks[0]?.payload.status).toBe('superseded');
	});

	it('keeps multiple narration ids separate and ordered by turn and sequence', () => {
		const firstUpdate = deriveLiveNarrationDeltaUpdate(
			createDelta('narration_late', 'ikinci', 5, 2),
			{
				expandedPastRunIds: new Set(),
				expectedRunIds: new Set([runId]),
				presentationRunId: null,
				presentationRunSurfaces: [],
			},
		);
		const secondUpdate = deriveLiveNarrationDeltaUpdate(
			createDelta('narration_early', 'birinci', 1, 1),
			{
				expandedPastRunIds: firstUpdate?.expandedPastRunIds ?? new Set(),
				expectedRunIds: firstUpdate?.expectedRunIds ?? new Set([runId]),
				presentationRunId: firstUpdate?.presentationRunId ?? null,
				presentationRunSurfaces: firstUpdate?.presentationRunSurfaces ?? [],
			},
		);

		const blocks = getWorkNarrationBlocks(secondUpdate?.presentationRunSurfaces ?? []);

		expect(blocks.map((block) => block.id)).toEqual(['narration_early', 'narration_late']);
		expect(blocks.map((block) => block.payload.text)).toEqual(['birinci', 'ikinci']);
	});

	it('upserts persisted work_narration blocks by narration id without duplicates', () => {
		const liveUpdate = deriveLiveNarrationDeltaUpdate(createDelta('narration_001', 'pkg', 1), {
			expandedPastRunIds: new Set(),
			expectedRunIds: new Set([runId]),
			presentationRunId: null,
			presentationRunSurfaces: [],
		});
		const persistedBlock: Extract<RenderBlock, { type: 'work_narration' }> = {
			created_at: '2026-05-05T10:00:00.000Z',
			id: 'narration_001',
			payload: {
				linked_tool_call_id: 'call_read',
				locale: 'tr',
				run_id: runId,
				sequence_no: 1,
				status: 'completed',
				text: 'package.json dosyas?n? kontrol ediyorum.',
				turn_index: 1,
			},
			schema_version: 1,
			type: 'work_narration',
		};
		const presentationMessage: PresentationBlocksServerMessage = {
			payload: {
				blocks: [persistedBlock],
				run_id: runId,
				trace_id: traceId,
			},
			type: 'presentation.blocks',
		};
		const persistedUpdate = derivePresentationBlocksUpdate(presentationMessage, {
			expandedPastRunIds: liveUpdate?.expandedPastRunIds ?? new Set(),
			expectedRunIds: liveUpdate?.expectedRunIds ?? new Set([runId]),
			inspectionAnchorIdsByDetailId: new Map(),
			inspectionRequestKeysByDetailId: new Map(),
			pendingInspectionRequestKeys: new Set(),
			presentationRunId: liveUpdate?.presentationRunId ?? runId,
			presentationRunSurfaces: liveUpdate?.presentationRunSurfaces ?? [],
			staleInspectionRequestKeys: new Set(),
		});

		const blocks = getWorkNarrationBlocks(persistedUpdate?.presentationRunSurfaces ?? []);

		expect(blocks).toHaveLength(1);
		expect(blocks[0]?.payload).toMatchObject({
			linked_tool_call_id: 'call_read',
			status: 'completed',
			text: 'package.json dosyas?n? kontrol ediyorum.',
		});
	});
	it('preserves exact payload-based persisted work_narration blocks and their ordering', () => {
		const earlyBlock: Extract<RenderBlock, { type: 'work_narration' }> = {
			created_at: '2026-05-05T10:00:00.000Z',
			id: 'narration_early',
			payload: {
				locale: 'tr',
				run_id: runId,
				sequence_no: 1,
				status: 'completed',
				text: 'birinci',
				turn_index: 1,
			},
			schema_version: 1,
			type: 'work_narration',
		};
		const lateBlock: Extract<RenderBlock, { type: 'work_narration' }> = {
			created_at: '2026-05-05T10:00:01.000Z',
			id: 'narration_late',
			payload: {
				linked_tool_call_id: 'call_late',
				locale: 'tr',
				run_id: runId,
				sequence_no: 5,
				status: 'tool_failed',
				text: 'ikinci',
				turn_index: 2,
			},
			schema_version: 1,
			type: 'work_narration',
		};
		const presentationMessage: PresentationBlocksServerMessage = {
			payload: {
				blocks: [earlyBlock, lateBlock],
				run_id: runId,
				trace_id: traceId,
			},
			type: 'presentation.blocks',
		};
		const update = derivePresentationBlocksUpdate(presentationMessage, {
			expandedPastRunIds: new Set(),
			expectedRunIds: new Set([runId]),
			inspectionAnchorIdsByDetailId: new Map(),
			inspectionRequestKeysByDetailId: new Map(),
			pendingInspectionRequestKeys: new Set(),
			presentationRunId: null,
			presentationRunSurfaces: [],
			staleInspectionRequestKeys: new Set(),
		});

		const blocks = getWorkNarrationBlocks(update?.presentationRunSurfaces ?? []);

		expect(blocks).toEqual([earlyBlock, lateBlock]);
		expect(blocks[1]).not.toHaveProperty('text');
		expect(blocks[1]).not.toHaveProperty('status');
	});
});
