import type {
	MemoryRecord,
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
} from '@runa/types';

import {
	type MemoryStore,
	MemoryStoreConfigurationError,
	MemoryStoreReadError,
	defaultMemoryStore,
} from '../persistence/memory-store.js';

import { resolveMemoryScope } from './memory-tool-policy.js';

export type MemoryListArguments = ToolArguments & {
	readonly limit?: number;
	readonly scope?: 'user' | 'workspace';
	readonly scope_id?: string;
};

export interface MemoryListItem {
	readonly created_at: string;
	readonly memory_id: string;
	readonly scope: 'user' | 'workspace';
	readonly scope_id: string;
	readonly source_kind: MemoryRecord['source_kind'];
	readonly summary: string;
	readonly updated_at: string;
}

export interface MemoryListSuccessData {
	readonly memories: readonly MemoryListItem[];
	readonly scope: 'user' | 'workspace';
	readonly scope_id: string;
}

export type MemoryListInput = ToolCallInput<'memory.list', MemoryListArguments>;
export type MemoryListResult = ToolResult<'memory.list', MemoryListSuccessData>;

type ReadableMemoryStore = Pick<MemoryStore, 'listActiveMemories'>;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function normalizeLimit(limit: unknown): number | undefined {
	if (limit === undefined) {
		return DEFAULT_LIMIT;
	}

	if (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 1) {
		return undefined;
	}

	return Math.min(Math.trunc(limit), MAX_LIMIT);
}

function createErrorResult(
	input: MemoryListInput,
	error_message: string,
	details?: Readonly<Record<string, unknown>>,
): Extract<MemoryListResult, { status: 'error' }> {
	return {
		call_id: input.call_id,
		details,
		error_code: 'INVALID_INPUT',
		error_message,
		status: 'error',
		tool_name: 'memory.list',
	};
}

function toStoreErrorResult(
	input: MemoryListInput,
	error: unknown,
): Extract<MemoryListResult, { status: 'error' }> {
	if (error instanceof MemoryStoreConfigurationError || error instanceof MemoryStoreReadError) {
		return {
			call_id: input.call_id,
			details: { reason: 'memory_store_read_failed' },
			error_code: 'EXECUTION_FAILED',
			error_message: error.message,
			retryable: error instanceof MemoryStoreReadError,
			status: 'error',
			tool_name: 'memory.list',
		};
	}

	return {
		call_id: input.call_id,
		details: { reason: 'memory_store_read_failed' },
		error_code: 'UNKNOWN',
		error_message: 'Failed to list memory.',
		retryable: true,
		status: 'error',
		tool_name: 'memory.list',
	};
}

export function createMemoryListTool(
	input: {
		readonly memory_store?: ReadableMemoryStore;
	} = {},
): ToolDefinition<MemoryListInput, MemoryListResult> {
	const memoryStore = input.memory_store ?? defaultMemoryStore;

	return {
		callable_schema: {
			parameters: {
				limit: {
					description: 'Maximum number of active memories to list.',
					type: 'number',
				},
				scope: {
					description: 'Memory scope to list; defaults to workspace.',
					type: 'string',
				},
				scope_id: {
					description: 'Optional explicit scope id; defaults to current workspace or local user.',
					type: 'string',
				},
			},
		},
		description:
			'Lists active user-visible memories for review, export, and deletion workflows without exposing hidden memory state.',
		async execute(
			toolInput: MemoryListInput,
			context: ToolExecutionContext,
		): Promise<MemoryListResult> {
			const limit = normalizeLimit(toolInput.arguments.limit);

			if (limit === undefined) {
				return createErrorResult(toolInput, 'limit must be a positive finite number.', {
					reason: 'invalid_limit',
				});
			}

			const resolvedScope = resolveMemoryScope(
				toolInput.arguments.scope,
				toolInput.arguments.scope_id,
				context,
			);

			if (!resolvedScope) {
				return createErrorResult(
					toolInput,
					'scope must be user or workspace with a non-empty scope_id.',
					{
						reason: 'invalid_scope',
					},
				);
			}

			try {
				const records = await memoryStore.listActiveMemories(
					resolvedScope.scope,
					resolvedScope.scope_id,
				);
				const memories = records.slice(0, limit).map((record) => ({
					created_at: record.created_at,
					memory_id: record.memory_id,
					scope: record.scope,
					scope_id: record.scope_id,
					source_kind: record.source_kind,
					summary: record.summary,
					updated_at: record.updated_at,
				}));

				return {
					call_id: toolInput.call_id,
					output: {
						memories,
						scope: resolvedScope.scope,
						scope_id: resolvedScope.scope_id,
					},
					status: 'success',
					tool_name: 'memory.list',
				};
			} catch (error: unknown) {
				return toStoreErrorResult(toolInput, error);
			}
		},
		metadata: {
			capability_class: 'memory',
			narration_policy: 'none',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
			tags: ['memory', 'privacy', 'visibility'],
		},
		name: 'memory.list',
	};
}

export const memoryListTool = createMemoryListTool();
