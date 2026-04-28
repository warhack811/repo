import { useCallback, useMemo } from 'react';

import type { InspectionActionState } from '../components/chat/PresentationBlockRenderer.js';
import {
	buildInspectionSurfaceMeta,
	createInspectionDetailRequestKey,
	getInspectionDetailBlockId,
} from '../components/chat/chat-presentation.js';
import { DEFAULT_INSPECTION_DETAIL_LEVEL } from '../lib/chat-runtime/types.js';
import type { InspectionTargetKind, RenderBlock } from '../ws-types.js';

export type UseChatPageInspectionInput = Readonly<{
	currentBlocks: readonly RenderBlock[] | null;
	pendingInspectionRequestKeys: readonly string[];
	staleInspectionRequestKeys: readonly string[];
}>;

export type UseChatPageInspectionResult = Readonly<{
	currentInspectionSurfaceMeta: ReturnType<typeof buildInspectionSurfaceMeta>;
	getInspectionActionState: (
		runId: string,
		runBlocks: readonly RenderBlock[],
		targetKind: InspectionTargetKind,
		targetId?: string,
	) => InspectionActionState;
}>;

export function useChatPageInspection({
	currentBlocks,
	pendingInspectionRequestKeys,
	staleInspectionRequestKeys,
}: UseChatPageInspectionInput): UseChatPageInspectionResult {
	const currentInspectionSurfaceMeta = useMemo(
		() => (currentBlocks ? buildInspectionSurfaceMeta(currentBlocks) : null),
		[currentBlocks],
	);
	const getInspectionActionState = useCallback(
		(
			runId: string,
			runBlocks: readonly RenderBlock[],
			targetKind: InspectionTargetKind,
			targetId?: string,
		): InspectionActionState => {
			const detailBlockId = getInspectionDetailBlockId(runId, targetKind, targetId);
			const requestKey = createInspectionDetailRequestKey({
				detail_level: DEFAULT_INSPECTION_DETAIL_LEVEL,
				run_id: runId,
				target_id: targetId,
				target_kind: targetKind,
			});
			const hasExistingDetail = runBlocks.some((block) => block.id === detailBlockId);
			const isStaleDetail = staleInspectionRequestKeys.includes(requestKey);
			const isPendingDetail = pendingInspectionRequestKeys.includes(requestKey);

			if (isPendingDetail) {
				return {
					detail_block_id: detailBlockId,
					is_pending: true,
					is_open: hasExistingDetail,
					is_stale: false,
					label: 'Loading detail',
					note: hasExistingDetail ? 'Refreshing below summary' : 'Opening below summary',
					title: hasExistingDetail
						? 'Refreshing the related detail card below this summary. Focus will move when the update arrives.'
						: 'Opening the related detail card below this summary. Focus will move when it arrives.',
				};
			}

			if (hasExistingDetail) {
				return {
					detail_block_id: detailBlockId,
					is_pending: false,
					is_open: true,
					is_stale: isStaleDetail,
					label: isStaleDetail ? 'Refresh detail' : 'Go to detail',
					note: isStaleDetail ? 'Summary updated' : undefined,
					title: isStaleDetail
						? 'Request a fresh detail card for this summary and move focus when it arrives.'
						: 'Move focus to the existing detail card beneath this summary.',
				};
			}

			return {
				detail_block_id: detailBlockId,
				is_pending: false,
				is_open: false,
				is_stale: false,
				label: 'Open detail',
				title: 'Open the related detail card beneath this summary and move focus to it.',
			};
		},
		[pendingInspectionRequestKeys, staleInspectionRequestKeys],
	);

	return {
		currentInspectionSurfaceMeta,
		getInspectionActionState,
	};
}
