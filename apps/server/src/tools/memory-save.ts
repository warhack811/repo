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
	MemoryStoreWriteError,
	defaultMemoryStore,
} from '../persistence/memory-store.js';

import {
	isConversationMemoryEnabled,
	isMemoryToolSource,
	mapMemoryToolSource,
	normalizeMemoryText,
	resolveMemoryScope,
	scanSensitiveMemoryContent,
} from './memory-tool-policy.js';

export type MemorySaveArguments = ToolArguments & {
	readonly consent_confirmed?: boolean;
	readonly content: string;
	readonly scope?: 'user' | 'workspace';
	readonly scope_id?: string;
	readonly source?: 'conversation' | 'explicit' | 'inferred';
	readonly summary?: string;
};

export interface MemorySaveSuccessData {
	readonly memory_id: string;
	readonly scope: 'user' | 'workspace';
	readonly scope_id: string;
	readonly source: 'conversation' | 'explicit' | 'inferred';
	readonly status: 'saved';
}

export type MemorySaveInput = ToolCallInput<'memory.save', MemorySaveArguments>;
export type MemorySaveResult = ToolResult<'memory.save', MemorySaveSuccessData>;

type WritableMemoryStore = Pick<MemoryStore, 'createMemory'>;

function createErrorResult(
	input: MemorySaveInput,
	error_message: string,
	details?: Readonly<Record<string, unknown>>,
): Extract<MemorySaveResult, { status: 'error' }> {
	return {
		call_id: input.call_id,
		details,
		error_code: 'INVALID_INPUT',
		error_message,
		status: 'error',
		tool_name: 'memory.save',
	};
}

function toStoreErrorResult(
	input: MemorySaveInput,
	error: unknown,
): Extract<MemorySaveResult, { status: 'error' }> {
	if (error instanceof MemoryStoreConfigurationError) {
		return {
			call_id: input.call_id,
			details: { reason: 'memory_store_configuration_failed' },
			error_code: 'EXECUTION_FAILED',
			error_message: error.message,
			retryable: false,
			status: 'error',
			tool_name: 'memory.save',
		};
	}

	if (error instanceof MemoryStoreWriteError) {
		return {
			call_id: input.call_id,
			details: { reason: 'memory_store_write_failed' },
			error_code: 'EXECUTION_FAILED',
			error_message: error.message,
			retryable: true,
			status: 'error',
			tool_name: 'memory.save',
		};
	}

	return {
		call_id: input.call_id,
		details: { reason: 'memory_store_write_failed' },
		error_code: 'UNKNOWN',
		error_message: 'Failed to save memory.',
		retryable: true,
		status: 'error',
		tool_name: 'memory.save',
	};
}

export function createMemorySaveTool(
	input: {
		readonly memory_store?: WritableMemoryStore;
	} = {},
): ToolDefinition<MemorySaveInput, MemorySaveResult> {
	const memoryStore = input.memory_store ?? defaultMemoryStore;

	return {
		callable_schema: {
			parameters: {
				consent_confirmed: {
					description:
						'Required true for inferred or conversation memory. Explicit memory is used only when the user directly asked Runa to remember it.',
					type: 'boolean',
				},
				content: {
					description: 'Memory content to store after privacy checks.',
					required: true,
					type: 'string',
				},
				scope: {
					description: 'Whether this memory belongs to the current user or workspace.',
					type: 'string',
				},
				scope_id: {
					description: 'Optional explicit scope id; defaults to current workspace or local user.',
					type: 'string',
				},
				source: {
					description: 'Memory source policy: explicit, inferred, or conversation.',
					type: 'string',
				},
				summary: {
					description: 'Short human-readable memory summary.',
					type: 'string',
				},
			},
		},
		description:
			'Saves user-visible durable memory with source policy, consent gating for inferred/conversation sources, and sensitive-data rejection.',
		async execute(
			toolInput: MemorySaveInput,
			context: ToolExecutionContext,
		): Promise<MemorySaveResult> {
			const content = normalizeMemoryText(toolInput.arguments.content);

			if (!content) {
				return createErrorResult(toolInput, 'content must be a non-empty string.', {
					reason: 'invalid_content',
				});
			}

			const source = toolInput.arguments.source ?? 'explicit';

			if (!isMemoryToolSource(source)) {
				return createErrorResult(
					toolInput,
					"source must be one of 'explicit', 'inferred', or 'conversation'.",
					{ reason: 'invalid_source' },
				);
			}

			if (
				(source === 'inferred' || source === 'conversation') &&
				toolInput.arguments.consent_confirmed !== true
			) {
				return createErrorResult(
					toolInput,
					'inferred and conversation memory require explicit consent_confirmed=true.',
					{
						reason: 'consent_required',
						source,
					},
				);
			}

			if (source === 'conversation' && !isConversationMemoryEnabled()) {
				return createErrorResult(
					toolInput,
					'conversation memory is disabled unless RUNA_CONVERSATION_MEMORY_ENABLED=true.',
					{
						reason: 'conversation_memory_disabled',
					},
				);
			}

			const sensitiveScan = scanSensitiveMemoryContent(
				`${toolInput.arguments.summary ?? ''}\n${content}`,
			);

			if (!sensitiveScan.safe_to_store) {
				return createErrorResult(toolInput, 'Sensitive content cannot be saved to memory.', {
					matched_categories: sensitiveScan.matched_categories,
					reason: 'sensitive_content_rejected',
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

			const summary = normalizeMemoryText(toolInput.arguments.summary) ?? content.slice(0, 120);

			try {
				const record = await memoryStore.createMemory({
					content,
					scope: resolvedScope.scope,
					scope_id: resolvedScope.scope_id,
					source_kind: mapMemoryToolSource(source),
					source_run_id: context.run_id,
					source_trace_id: context.trace_id,
					summary,
				});

				return {
					call_id: toolInput.call_id,
					output: {
						memory_id: record.memory_id,
						scope: record.scope,
						scope_id: record.scope_id,
						source,
						status: 'saved',
					},
					status: 'success',
					tool_name: 'memory.save',
				};
			} catch (error: unknown) {
				return toStoreErrorResult(toolInput, error);
			}
		},
		metadata: {
			capability_class: 'memory',
			narration_policy: 'required',
			requires_approval: false,
			risk_level: 'medium',
			side_effect_level: 'write',
			tags: ['memory', 'privacy', 'semantic'],
		},
		name: 'memory.save',
		user_label_tr: 'Bellege kaydetme',
		user_summary_tr: 'Onemli bir bilgi proje bellegine kaydedilir.',
	};
}

export const memorySaveTool = createMemorySaveTool();
