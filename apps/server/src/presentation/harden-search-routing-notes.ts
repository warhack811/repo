import type { RenderBlock, SearchResultBlock, WebSearchResultBlock } from '@runa/types';

const LOCAL_SOURCE_PRIORITY_NOTE =
	'Prefer workspace-local results for repo code, config, and implementation truth.';
const PUBLIC_SOURCE_PRIORITY_NOTE =
	'Public web results complement local truth for external docs, releases, vendor details, and latest verification.';
const CROSS_SOURCE_CONFLICT_NOTE =
	'Local and public sources were both consulted. If they differ, prefer workspace-local truth for implementation details.';
const FRESHNESS_CONFLICT_NOTE =
	'Local and public sources were both consulted. Prefer workspace-local truth for implementation details; public results may be newer for latest or release details.';
const FRESHNESS_QUERY_TOKENS = new Set([
	'announcement',
	'bugun',
	'bugün',
	'changelog',
	'current',
	'duyuru',
	'guncel',
	'güncel',
	'latest',
	'news',
	'recent',
	'release',
	'releases',
	'son',
	'surum',
	'sürüm',
	'today',
	'update',
	'updates',
	'vendor',
	'version',
	'versions',
	'versiyon',
]);

function isSearchResultBlock(block: RenderBlock): block is SearchResultBlock {
	return block.type === 'search_result_block';
}

function isWebSearchResultBlock(block: RenderBlock): block is WebSearchResultBlock {
	return block.type === 'web_search_result_block';
}

function normalizeQueryToken(token: string): string {
	return token.toLocaleLowerCase();
}

function extractQueryTokens(query: string): readonly string[] {
	return query
		.split(/[^\p{L}\p{N}]+/gu)
		.map((token) => normalizeQueryToken(token))
		.filter((token) => token.length >= 3);
}

function hasTokenOverlap(leftQuery: string, rightQuery: string): boolean {
	const leftTokens = new Set(extractQueryTokens(leftQuery));

	if (leftTokens.size === 0) {
		return false;
	}

	return extractQueryTokens(rightQuery).some((token) => leftTokens.has(token));
}

function isFreshnessBiasedWebSearch(block: WebSearchResultBlock): boolean {
	return (
		block.payload.freshness_note !== undefined ||
		extractQueryTokens(block.payload.query).some((token) => FRESHNESS_QUERY_TOKENS.has(token))
	);
}

function selectConflictNote(
	localBlocks: readonly SearchResultBlock[],
	webBlocks: readonly WebSearchResultBlock[],
): string | undefined {
	const hasFreshnessBias = webBlocks.some((block) => isFreshnessBiasedWebSearch(block));

	if (hasFreshnessBias) {
		return FRESHNESS_CONFLICT_NOTE;
	}

	const hasQueryOverlap = localBlocks.some((localBlock) =>
		webBlocks.some((webBlock) => hasTokenOverlap(localBlock.payload.query, webBlock.payload.query)),
	);

	return hasQueryOverlap ? CROSS_SOURCE_CONFLICT_NOTE : undefined;
}

function withLocalSearchNotes(
	block: SearchResultBlock,
	conflictNote: string | undefined,
): SearchResultBlock {
	return {
		...block,
		payload: {
			...block.payload,
			conflict_note: conflictNote ?? block.payload.conflict_note,
			source_priority_note: block.payload.source_priority_note ?? LOCAL_SOURCE_PRIORITY_NOTE,
		},
	};
}

function withWebSearchNotes(
	block: WebSearchResultBlock,
	conflictNote: string | undefined,
): WebSearchResultBlock {
	return {
		...block,
		payload: {
			...block.payload,
			conflict_note: conflictNote ?? block.payload.conflict_note,
			source_priority_note: block.payload.source_priority_note ?? PUBLIC_SOURCE_PRIORITY_NOTE,
		},
	};
}

export function hardenSearchRoutingPresentationBlocks(
	blocks: readonly RenderBlock[],
): readonly RenderBlock[] {
	const localBlocks = blocks.filter((block) => isSearchResultBlock(block));
	const webBlocks = blocks.filter((block) => isWebSearchResultBlock(block));

	if (localBlocks.length === 0 || webBlocks.length === 0) {
		return blocks;
	}

	const conflictNote = selectConflictNote(localBlocks, webBlocks);

	return blocks.map((block) => {
		if (isSearchResultBlock(block)) {
			return withLocalSearchNotes(block, conflictNote);
		}

		if (isWebSearchResultBlock(block)) {
			return withWebSearchNotes(block, conflictNote);
		}

		return block;
	});
}
