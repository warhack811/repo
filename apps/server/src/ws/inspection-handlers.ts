import type { InspectionRequestPayload } from '@runa/types';

import {
	createInspectionDetailPresentationBlocks,
	getStoredInspectionContext,
	mergeRenderBlocks,
	rememberInspectionContext,
} from './presentation.js';
import {
	type WebSocketConnection,
	createStandalonePresentationBlocksMessage,
	sendServerMessage,
} from './transport.js';

export function handleInspectionRequestMessage(
	socket: WebSocketConnection,
	payload: InspectionRequestPayload,
): void {
	const inspectionContext = getStoredInspectionContext(socket, payload.run_id);

	if (!inspectionContext) {
		throw new Error(`Inspection context not found for run: ${payload.run_id}`);
	}

	const detailBlocks = createInspectionDetailPresentationBlocks({
		context: inspectionContext,
		payload,
	});

	if (detailBlocks.length === 0) {
		throw new Error(`Inspection detail target is unavailable: ${payload.target_kind}`);
	}

	const nextBlocks = mergeRenderBlocks(inspectionContext.blocks, detailBlocks);

	rememberInspectionContext(socket, {
		...inspectionContext,
		blocks: nextBlocks,
	});

	sendServerMessage(
		socket,
		createStandalonePresentationBlocksMessage({
			blocks: detailBlocks,
			run_id: inspectionContext.run_id,
			trace_id: inspectionContext.trace_id,
		}),
	);
}
