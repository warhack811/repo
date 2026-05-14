import type { InspectionTargetKind, RenderBlock } from '../../../ws-types.js';
import {
	formatInspectionTargetLabel,
	getInspectionSummaryLabel,
	getInspectionSummaryTitle,
	getInspectionTargetKindForSummaryBlock,
	isInspectionSummaryBlock,
} from '../blocks/block-utils.js';
import type { InspectionDetailRelation, InspectionDetailRequestInput } from './types.js';

type InspectionDetailRenderBlock = Extract<RenderBlock, { type: 'inspection_detail_block' }>;

interface PresentationBlockGroups {
	readonly detailBlocks: readonly InspectionDetailRenderBlock[];
	readonly nonDetailBlocks: readonly RenderBlock[];
}

function normalizeInspectionTargetId(targetId?: string): string | undefined {
	const normalizedTargetId = targetId?.trim();
	return normalizedTargetId && normalizedTargetId.length > 0 ? normalizedTargetId : undefined;
}

function getInspectionDetailTargetId(blockId: string): string | undefined {
	const [, , , targetId] = blockId.split(':', 4);
	return targetId && targetId !== 'latest' ? targetId : undefined;
}

function splitPresentationBlocks(blocks: readonly RenderBlock[]): PresentationBlockGroups {
	const detailBlocks: InspectionDetailRenderBlock[] = [];
	const nonDetailBlocks: RenderBlock[] = [];

	for (const block of blocks) {
		if (block.type === 'inspection_detail_block') {
			detailBlocks.push(block);
		} else {
			nonDetailBlocks.push(block);
		}
	}

	return { detailBlocks, nonDetailBlocks };
}

export function countInspectionRequestsForRun(
	requestKeys: readonly string[],
	runId: string,
): number {
	return requestKeys.filter((requestKey) => isInspectionDetailRequestKeyForRun(requestKey, runId))
		.length;
}

export function isInspectionDetailRequestKeyForRun(requestKey: string, runId: string): boolean {
	return requestKey.startsWith(`inspection_request:${runId}:`);
}

export function createInspectionDetailRequestKey(input: InspectionDetailRequestInput): string {
	return `inspection_request:${input.run_id}:${input.target_kind}:${input.detail_level}:${
		normalizeInspectionTargetId(input.target_id) ?? 'latest'
	}`;
}

export function getInspectionDetailBlockId(
	runId: string,
	targetKind: InspectionTargetKind,
	targetId?: string,
): string {
	return `inspection_detail_block:${runId}:${targetKind}:${
		normalizeInspectionTargetId(targetId) ?? 'latest'
	}`;
}

export function buildInspectionDetailRelations(
	blocks: readonly RenderBlock[],
	inspectionAnchorIdsByDetailId: ReadonlyMap<string, string | undefined>,
): ReadonlyMap<string, InspectionDetailRelation> {
	const summaryMetaByTargetId = new Map<
		string,
		{
			readonly target_kind: InspectionTargetKind;
			readonly title: string;
		}
	>();

	for (const block of splitPresentationBlocks(blocks).nonDetailBlocks) {
		if (!isInspectionSummaryBlock(block)) {
			continue;
		}

		summaryMetaByTargetId.set(block.id, {
			target_kind: getInspectionTargetKindForSummaryBlock(block),
			title: getInspectionSummaryTitle(block),
		});
	}

	const relations = new Map<string, InspectionDetailRelation>();

	for (const block of splitPresentationBlocks(blocks).detailBlocks) {
		const targetId =
			inspectionAnchorIdsByDetailId.get(block.id) ?? getInspectionDetailTargetId(block.id);
		const targetMeta = targetId ? summaryMetaByTargetId.get(targetId) : undefined;

		relations.set(block.id, {
			anchor_id: targetId,
			summary_label: targetMeta
				? getInspectionSummaryLabel(targetMeta.target_kind)
				: formatInspectionTargetLabel(block.payload.target_kind),
			summary_title: targetMeta?.title ?? formatInspectionTargetLabel(block.payload.target_kind),
		});
	}

	return relations;
}

export function buildInspectionSurfaceMeta(blocks: readonly RenderBlock[]): Readonly<{
	detail_count: number;
	summary_count: number;
}> | null {
	const { detailBlocks, nonDetailBlocks } = splitPresentationBlocks(blocks);

	if (detailBlocks.length === 0 && nonDetailBlocks.length === 0) {
		return null;
	}

	return {
		detail_count: detailBlocks.length,
		summary_count: nonDetailBlocks.length,
	};
}
