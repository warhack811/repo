import type {
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
	MemoryStoreWriteError,
	defaultMemoryStore,
} from '../persistence/memory-store.js';

import { normalizeMemoryText, resolveMemoryScope } from './memory-tool-policy.js';

export type MemoryDeleteArguments = ToolArguments & {
	readonly memory_id: string;
	readonly scope?: 'user' | 'workspace';
	readonly scope_id?: string;
};

export interface MemoryDeleteSuccessData {
	readonly memory_id: string;
	readonly status: 'deleted';
}

export type MemoryDeleteInput = ToolCallInput<'memory.delete', MemoryDeleteArguments>;
export type MemoryDeleteResult = ToolResult<'memory.delete', MemoryDeleteSuccessData>;

type DeletableMemoryStore = Pick<MemoryStore, 'archiveMemory' | 'getMemoryById'>;

function createErrorResult(
	input: MemoryDeleteInput,
	error_message: string,
	details?: Readonly<Record<string, unknown>>,
): Extract<MemoryDeleteResult, { status: 'error' }> {
	return {
		call_id: input.call_id,
		details,
		error_code: 'INVALID_INPUT',
		error_message,
		status: 'error',
		tool_name: 'memory.delete',
	};
}

function toStoreErrorResult(
	input: MemoryDeleteInput,
	error: unknown,
): Extract<MemoryDeleteResult, { status: 'error' }> {
	if (
		error instanceof MemoryStoreConfigurationError ||
		error instanceof MemoryStoreReadError ||
		error instanceof MemoryStoreWriteError
	) {
		return {
			call_id: input.call_id,
			details: { reason: 'memory_store_delete_failed' },
			error_code: 'EXECUTION_FAILED',
			error_message: error.message,
			retryable: error instanceof MemoryStoreReadError || error instanceof MemoryStoreWriteError,
			status: 'error',
			tool_name: 'memory.delete',
		};
	}

	return {
		call_id: input.call_id,
		details: { reason: 'memory_store_delete_failed' },
		error_code: 'UNKNOWN',
		error_message: 'Failed to delete memory.',
		retryable: true,
		status: 'error',
		tool_name: 'memory.delete',
	};
}

export function createMemoryDeleteTool(
	input: {
		readonly memory_store?: DeletableMemoryStore;
	} = {},
): ToolDefinition<MemoryDeleteInput, MemoryDeleteResult> {
	const memoryStore = input.memory_store ?? defaultMemoryStore;

	return {
		callable_schema: {
			parameters: {
				memory_id: {
					description: 'Memory id returned by memory.list or memory.search.',
					required: true,
					type: 'string',
				},
				scope: {
					description: 'Expected memory scope; defaults to workspace.',
					type: 'string',
				},
				scope_id: {
					description: 'Optional explicit scope id; defaults to current workspace or local user.',
					type: 'string',
				},
			},
		},
		description:
			'Deletes a user-visible memory through soft archive after checking it belongs to the requested user/workspace scope.',
		async execute(
			toolInput: MemoryDeleteInput,
			context: ToolExecutionContext,
		): Promise<MemoryDeleteResult> {
			const memoryId = normalizeMemoryText(toolInput.arguments.memory_id);

			if (!memoryId) {
				return createErrorResult(toolInput, 'memory_id must be a non-empty string.', {
					reason: 'invalid_memory_id',
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
				const record = await memoryStore.getMemoryById(memoryId);

				if (!record) {
					return {
						call_id: toolInput.call_id,
						details: { reason: 'memory_not_found' },
						error_code: 'NOT_FOUND',
						error_message: 'Memory not found.',
						status: 'error',
						tool_name: 'memory.delete',
					};
				}

				if (record.scope !== resolvedScope.scope || record.scope_id !== resolvedScope.scope_id) {
					return {
						call_id: toolInput.call_id,
						details: { reason: 'memory_scope_mismatch' },
						error_code: 'PERMISSION_DENIED',
						error_message: 'Memory does not belong to the requested scope.',
						status: 'error',
						tool_name: 'memory.delete',
					};
				}

				await memoryStore.archiveMemory({ memory_id: memoryId });

				return {
					call_id: toolInput.call_id,
					output: {
						memory_id: memoryId,
						status: 'deleted',
					},
					status: 'success',
					tool_name: 'memory.delete',
				};
			} catch (error: unknown) {
				return toStoreErrorResult(toolInput, error);
			}
		},
		metadata: {
			capability_class: 'memory',
			requires_approval: false,
			risk_level: 'medium',
			side_effect_level: 'write',
			tags: ['memory', 'privacy', 'delete'],
		},
		name: 'memory.delete',
	};
}

export const memoryDeleteTool = createMemoryDeleteTool();
