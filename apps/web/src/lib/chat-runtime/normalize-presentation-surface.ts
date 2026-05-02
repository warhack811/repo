import type { ConversationMessage } from '../../hooks/useConversations.js';
import type { RenderBlock } from '../../ws-types.js';
import type { PresentationRunSurface } from './types.js';

function filterSupersededApprovalBlocks(blocks: readonly RenderBlock[]): readonly RenderBlock[] {
	const resolvedApprovalIds = new Set<string>();

	for (const block of blocks) {
		if (block.type === 'approval_block' && block.payload.status !== 'pending') {
			resolvedApprovalIds.add(block.payload.approval_id);
		}
	}

	if (resolvedApprovalIds.size === 0) {
		return blocks;
	}

	return blocks.filter(
		(block) =>
			block.type !== 'approval_block' ||
			block.payload.status !== 'pending' ||
			!resolvedApprovalIds.has(block.payload.approval_id),
	);
}

export function normalizePresentationSurface(
	surface: PresentationRunSurface | null,
	activeConversationMessages: readonly ConversationMessage[] = [],
): PresentationRunSurface | null {
	if (!surface) {
		return null;
	}

	const assistantTranscriptTextForRun = new Set(
		activeConversationMessages
			.filter(
				(message) =>
					message.role === 'assistant' &&
					message.run_id === surface.run_id &&
					message.content.trim().length > 0,
			)
			.map((message) => message.content.trim()),
	);

	const filteredBlocks = filterSupersededApprovalBlocks(surface.blocks).filter((block) => {
		if (block.type !== 'text') {
			return true;
		}

		return !assistantTranscriptTextForRun.has(block.payload.text.trim());
	});

	if (filteredBlocks.length === 0) {
		return null;
	}

	return {
		...surface,
		blocks: filteredBlocks,
	};
}
