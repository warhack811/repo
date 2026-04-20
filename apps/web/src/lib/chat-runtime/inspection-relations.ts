import type { InspectionDetailLevel, InspectionTargetKind } from '../../ws-types.js';
import { DEFAULT_INSPECTION_DETAIL_LEVEL, type InspectionDetailRenderBlock } from './types.js';

export interface InspectionRequestIdentityInput {
	readonly detail_level: InspectionDetailLevel;
	readonly run_id: string;
	readonly target_id?: string;
	readonly target_kind: InspectionTargetKind;
}

export interface InspectionRequestIdentity {
	readonly detailBlockId: string;
	readonly normalizedTargetId?: string;
	readonly requestKey: string;
}

export function normalizeInspectionTargetId(targetId?: string): string | undefined {
	const normalizedTargetId = targetId?.trim();

	return normalizedTargetId && normalizedTargetId.length > 0 ? normalizedTargetId : undefined;
}

export function createInspectionDetailRequestKey(input: InspectionRequestIdentityInput): string {
	return `inspection_request:${input.run_id}:${input.target_kind}:${input.detail_level}:${normalizeInspectionTargetId(input.target_id) ?? 'latest'}`;
}

export function getInspectionDetailBlockId(
	runId: string,
	targetKind: InspectionTargetKind,
	targetId?: string,
): string {
	return `inspection_detail_block:${runId}:${targetKind}:${normalizeInspectionTargetId(targetId) ?? 'latest'}`;
}

export function createInspectionRequestIdentity(
	input: Omit<InspectionRequestIdentityInput, 'detail_level'> & {
		readonly detail_level?: InspectionDetailLevel;
	},
): InspectionRequestIdentity {
	const detailLevel = input.detail_level ?? DEFAULT_INSPECTION_DETAIL_LEVEL;
	const normalizedTargetId = normalizeInspectionTargetId(input.target_id);

	return {
		detailBlockId: getInspectionDetailBlockId(input.run_id, input.target_kind, normalizedTargetId),
		normalizedTargetId,
		requestKey: createInspectionDetailRequestKey({
			detail_level: detailLevel,
			run_id: input.run_id,
			target_id: normalizedTargetId,
			target_kind: input.target_kind,
		}),
	};
}

export function isInspectionDetailRequestKeyForRun(requestKey: string, runId: string): boolean {
	return requestKey.startsWith(`inspection_request:${runId}:`);
}

export function countInspectionRequestsForRun(
	requestKeys: readonly string[],
	runId: string,
): number {
	let requestCount = 0;

	for (const requestKey of requestKeys) {
		if (isInspectionDetailRequestKeyForRun(requestKey, runId)) {
			requestCount += 1;
		}
	}

	return requestCount;
}

export function getInspectionRequestKeyRunId(requestKey: string): string | undefined {
	const idSegments = requestKey.split(':');

	return idSegments.length >= 5 && idSegments[0] === 'inspection_request'
		? idSegments[1]
		: undefined;
}

export function getInspectionDetailBlockRunId(detailId: string): string | undefined {
	const idSegments = detailId.split(':');

	return idSegments.length >= 4 && idSegments[0] === 'inspection_detail_block'
		? idSegments[1]
		: undefined;
}

export function isInspectionDetailBlockIdForRun(detailId: string, runId: string): boolean {
	return detailId.startsWith(`inspection_detail_block:${runId}:`);
}

export function getInspectionDetailTargetId(blockId: string): string | undefined {
	const idSegments = blockId.split(':');

	if (idSegments.length < 4 || idSegments[0] !== 'inspection_detail_block') {
		return undefined;
	}

	const targetId = idSegments.slice(3).join(':');

	return targetId.length > 0 && targetId !== 'latest' ? targetId : undefined;
}

export function getInspectionDetailRequestKeyFromBlock(
	block: InspectionDetailRenderBlock,
	runId: string,
	requestKeysByDetailId?: ReadonlyMap<string, string>,
): string {
	return (
		requestKeysByDetailId?.get(block.id) ??
		createInspectionDetailRequestKey({
			detail_level: DEFAULT_INSPECTION_DETAIL_LEVEL,
			run_id: runId,
			target_id: getInspectionDetailTargetId(block.id),
			target_kind: block.payload.target_kind,
		})
	);
}
