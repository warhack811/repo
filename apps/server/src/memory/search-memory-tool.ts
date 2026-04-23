import type {
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
} from '@runa/types';

import type { MemoryStore } from '../persistence/memory-store.js';

import { retrieveSemanticMemories } from './retrieve-semantic-memories.js';

export type SearchMemoryScope = 'all' | 'user' | 'workspace';

export type SearchMemoryArguments = ToolArguments & {
	readonly limit?: number;
	readonly query: string;
	readonly scope?: SearchMemoryScope;
};

export interface SearchMemoryMatch {
	readonly content: string;
	readonly matched_terms: readonly string[];
	readonly retrieval_reason: 'recent_fallback' | 'semantic_overlap';
	readonly retrieval_score: number;
	readonly scope: 'user' | 'workspace';
	readonly source_kind: string;
	readonly summary: string;
}

export interface SearchMemorySuccessData {
	readonly matches: readonly SearchMemoryMatch[];
	readonly query: string;
}

export type SearchMemoryInput = ToolCallInput<'search.memory', SearchMemoryArguments>;
export type SearchMemoryResult = ToolResult<'search.memory', SearchMemorySuccessData>;

const DEFAULT_LIMIT = 5;

function getUserScopeId(): string {
	return 'local_default_user';
}

function createErrorResult(
	input: SearchMemoryInput,
	message: string,
	details?: Readonly<Record<string, unknown>>,
): Extract<SearchMemoryResult, { status: 'error' }> {
	return {
		call_id: input.call_id,
		details,
		error_code: 'INVALID_INPUT',
		error_message: message,
		status: 'error',
		tool_name: 'search.memory',
	};
}

export function createSearchMemoryTool(input: {
	readonly memory_store: Pick<MemoryStore, 'listActiveMemories'>;
}): ToolDefinition<SearchMemoryInput, SearchMemoryResult> {
	return {
		callable_schema: {
			parameters: {
				limit: {
					description: 'Maximum number of relevant memories to return.',
					type: 'number',
				},
				query: {
					description: 'Question or topic to search against durable user/workspace memory.',
					required: true,
					type: 'string',
				},
				scope: {
					description: 'Restrict search to user, workspace, or both.',
					type: 'string',
				},
			},
		},
		description:
			'Searches the durable memory store for relevant user or workspace facts. Prefer this over broad web or codebase search when the question is about remembered context.',
		async execute(
			toolInput: SearchMemoryInput,
			context: ToolExecutionContext,
		): Promise<SearchMemoryResult> {
			const query =
				typeof toolInput.arguments.query === 'string' ? toolInput.arguments.query.trim() : '';

			if (!query) {
				return createErrorResult(toolInput, 'query must be a non-empty string.', {
					reason: 'invalid_query',
				});
			}

			const scope = toolInput.arguments.scope ?? 'all';

			if (!['all', 'user', 'workspace'].includes(scope)) {
				return createErrorResult(toolInput, "scope must be one of 'all', 'user', or 'workspace'.", {
					reason: 'invalid_scope',
				});
			}

			const limit =
				typeof toolInput.arguments.limit === 'number' && Number.isFinite(toolInput.arguments.limit)
					? Math.max(1, Math.trunc(toolInput.arguments.limit))
					: DEFAULT_LIMIT;
			const workingDirectory = context.working_directory ?? process.cwd();
			const scopeInputs =
				scope === 'all'
					? [
							{ scope: 'user' as const, scope_id: getUserScopeId() },
							{ scope: 'workspace' as const, scope_id: workingDirectory },
						]
					: [
							{
								scope,
								scope_id: scope === 'user' ? getUserScopeId() : workingDirectory,
							},
						];
			const matches = (
				await Promise.all(
					scopeInputs.map((scopeInput) =>
						retrieveSemanticMemories({
							limit,
							memory_store: input.memory_store,
							query,
							scope: scopeInput.scope,
							scope_id: scopeInput.scope_id,
						}),
					),
				)
			)
				.flat()
				.sort((left, right) => {
					if (right.retrieval_score !== left.retrieval_score) {
						return right.retrieval_score - left.retrieval_score;
					}

					return right.updated_at.localeCompare(left.updated_at);
				})
				.slice(0, limit)
				.map((record) => ({
					content: record.content,
					matched_terms: record.matched_terms,
					retrieval_reason: record.retrieval_reason,
					retrieval_score: record.retrieval_score,
					scope: record.scope,
					source_kind: record.source_kind,
					summary: record.summary,
				}));

			return {
				call_id: toolInput.call_id,
				output: {
					matches,
					query,
				},
				status: 'success',
				tool_name: 'search.memory',
			};
		},
		metadata: {
			capability_class: 'search',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
			tags: ['memory', 'rag', 'semantic', 'workspace'],
		},
		name: 'search.memory',
	};
}
