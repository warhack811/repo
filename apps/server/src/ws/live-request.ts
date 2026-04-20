import type { ModelMessage, RuntimeState, ToolResult } from '@runa/types';

import { adaptContextToModelRequest } from '../context/adapt-context-to-model-request.js';
import { buildMemoryPromptLayer } from '../context/build-memory-prompt-layer.js';
import { composeContext } from '../context/compose-context.js';
import {
	type WorkspaceLayer,
	composeWorkspaceContext,
} from '../context/compose-workspace-context.js';
import { orchestrateMemoryRead } from '../context/orchestrate-memory-read.js';
import { defaultMemoryStore, hasMemoryStoreConfiguration } from '../persistence/memory-store.js';
import type { RunRequestPayload } from './messages.js';
import type { MemoryOrchestrationStore } from './orchestration-types.js';

interface ExtractedUserTurn {
	readonly history: readonly ModelMessage[];
	readonly user_turn: string;
}

export function getLiveWorkingDirectory(): string {
	return process.cwd();
}

export function getLiveMemoryScopeId(workingDirectory: string): string {
	return workingDirectory;
}

export function getLiveUserPreferenceScopeId(): string {
	return 'local_default_user';
}

export function extractUserTurn(messages: readonly ModelMessage[]): ExtractedUserTurn | undefined {
	const lastMessage = messages[messages.length - 1];

	if (!lastMessage || lastMessage.role !== 'user' || lastMessage.content.trim().length === 0) {
		return undefined;
	}

	return {
		history: messages.slice(0, -1),
		user_turn: lastMessage.content,
	};
}

function canUseMemoryOrchestration(memoryStore?: MemoryOrchestrationStore): boolean {
	return memoryStore !== undefined || hasMemoryStoreConfiguration();
}

function logMemoryIntegrationFailure(
	stage: 'read' | 'write',
	payload: Pick<RunRequestPayload, 'run_id' | 'trace_id'>,
	message: string,
	sourceFailureCode?: string,
): void {
	console.error('[memory.integration.failed]', {
		message,
		run_id: payload.run_id,
		source_failure_code: sourceFailureCode,
		stage,
		trace_id: payload.trace_id,
	});
}

function logWorkspaceIntegrationFailure(
	payload: Pick<RunRequestPayload, 'run_id' | 'trace_id'>,
	message: string,
	sourceFailureCode?: string,
): void {
	console.error('[workspace.integration.failed]', {
		message,
		run_id: payload.run_id,
		source_failure_code: sourceFailureCode,
		trace_id: payload.trace_id,
	});
}

export async function buildLiveWorkspaceLayer(
	payload: RunRequestPayload,
	workingDirectory: string,
): Promise<WorkspaceLayer | undefined> {
	const workspaceContext = await composeWorkspaceContext({
		working_directory: workingDirectory,
	});

	if (workspaceContext.status === 'workspace_layer_created') {
		return workspaceContext.workspace_layer;
	}

	if (workspaceContext.status === 'failed') {
		logWorkspaceIntegrationFailure(
			payload,
			workspaceContext.failure.message,
			workspaceContext.failure.code,
		);
	}

	return undefined;
}

async function buildLiveMemoryLayer(
	payload: RunRequestPayload,
	workingDirectory: string,
	memoryStore?: MemoryOrchestrationStore,
): Promise<Parameters<typeof composeContext>[0]['memory_layer']> {
	if (!canUseMemoryOrchestration(memoryStore)) {
		return undefined;
	}

	const combinedEntries: Parameters<typeof buildMemoryPromptLayer>[0]['entries'][number][] = [];
	const orchestratedMemoryStore = memoryStore ?? defaultMemoryStore;
	const memoryReadInputs = [
		{
			scope: 'user' as const,
			scope_id: getLiveUserPreferenceScopeId(),
		},
		{
			scope: 'workspace' as const,
			scope_id: getLiveMemoryScopeId(workingDirectory),
		},
	];

	for (const memoryReadInput of memoryReadInputs) {
		const memoryReadResult = await orchestrateMemoryRead({
			memory_store: orchestratedMemoryStore,
			scope: memoryReadInput.scope,
			scope_id: memoryReadInput.scope_id,
		});

		if (memoryReadResult.status === 'failed') {
			logMemoryIntegrationFailure(
				'read',
				payload,
				memoryReadResult.failure.message,
				memoryReadResult.failure.source_failure_code,
			);
			continue;
		}

		if (memoryReadResult.status !== 'memory_layer_created') {
			continue;
		}

		combinedEntries.push(
			...memoryReadResult.memory_layer.content.items.map((item) => ({
				content: item.content,
				source_kind: item.source_kind,
				summary: item.summary,
			})),
		);
	}

	if (combinedEntries.length === 0) {
		return undefined;
	}

	const combinedPromptLayer = buildMemoryPromptLayer({
		entries: combinedEntries,
	});

	if (combinedPromptLayer.status === 'failed' || combinedPromptLayer.status === 'no_prompt_layer') {
		return undefined;
	}

	return {
		content: combinedPromptLayer.prompt_layer,
		kind: 'memory',
		name: 'memory_layer',
	};
}

function toModelRequest(payload: RunRequestPayload): RunRequestPayload['request'] & {
	readonly run_id: string;
	readonly trace_id: string;
} {
	return {
		...payload.request,
		run_id: payload.run_id,
		trace_id: payload.trace_id,
	};
}

const MAX_TOOL_RESULT_CONTINUATION_CHARS = 1200;

function serializeToolResultPreviewValue(value: unknown): string {
	if (typeof value === 'string') {
		return value;
	}

	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

function truncateToolResultPreview(value: string): string {
	if (value.length <= MAX_TOOL_RESULT_CONTINUATION_CHARS) {
		return value;
	}

	return `${value.slice(0, MAX_TOOL_RESULT_CONTINUATION_CHARS)}\n...[truncated]`;
}

function buildToolResultContinuationUserTurn(userTurn: string, toolResult: ToolResult): string {
	const toolStatus =
		toolResult.status === 'success'
			? 'succeeded'
			: `failed${toolResult.error_code ? ` with ${toolResult.error_code}` : ''}`;
	const toolResultDetails =
		toolResult.status === 'success'
			? truncateToolResultPreview(serializeToolResultPreviewValue(toolResult.output))
			: (toolResult.error_message ?? 'The tool returned an error without a detailed message.');

	return [
		'Continue the same user request using the latest ingested tool result from the runtime context.',
		`Original user request: ${userTurn}`,
		`Latest completed tool call: ${toolResult.tool_name} (${toolStatus}).`,
		'Latest tool result details:',
		toolResultDetails,
		'Do not repeat that same completed tool call just to satisfy the original instruction.',
		'If the latest tool result already contains enough information, answer with an assistant response instead of calling another tool.',
		'Only call another tool if the latest tool result is insufficient for a materially different next step.',
		'Maintain the language of the original user request in your response.',
	].join('\n');
}

export async function buildLiveModelRequest(
	payload: RunRequestPayload,
	workingDirectory: string,
	options: Readonly<{
		readonly current_state?: RuntimeState;
		readonly latest_tool_result?: ToolResult;
		readonly memoryStore?: MemoryOrchestrationStore;
		readonly workspace_layer?: WorkspaceLayer;
	}> = {},
): Promise<
	RunRequestPayload['request'] & {
		readonly run_id: string;
		readonly trace_id: string;
	}
> {
	const extractedUserTurn = extractUserTurn(payload.request.messages);
	const memoryLayer = await buildLiveMemoryLayer(payload, workingDirectory, options.memoryStore);

	if (!extractedUserTurn) {
		return toModelRequest(payload);
	}

	const resolvedUserTurn =
		options.current_state === 'TOOL_RESULT_INGESTING' && options.latest_tool_result !== undefined
			? buildToolResultContinuationUserTurn(extractedUserTurn.user_turn, options.latest_tool_result)
			: extractedUserTurn.user_turn;

	const composedContext = composeContext({
		current_state: options.current_state ?? 'MODEL_THINKING',
		latest_tool_result:
			options.latest_tool_result === undefined
				? undefined
				: {
						artifact_ref:
							options.latest_tool_result.status === 'success'
								? options.latest_tool_result.artifact_ref
								: undefined,
						call_id: options.latest_tool_result.call_id,
						error_code:
							options.latest_tool_result.status === 'error'
								? options.latest_tool_result.error_code
								: undefined,
						error_message:
							options.latest_tool_result.status === 'error'
								? options.latest_tool_result.error_message
								: undefined,
						output:
							options.latest_tool_result.status === 'success'
								? options.latest_tool_result.output
								: undefined,
						result_status: options.latest_tool_result.status === 'success' ? 'success' : 'error',
						tool_name: options.latest_tool_result.tool_name,
					},
		memory_layer: memoryLayer,
		run_id: payload.run_id,
		trace_id: payload.trace_id,
		workspace_layer: options.workspace_layer,
		working_directory: workingDirectory,
	});

	return adaptContextToModelRequest({
		composed_context: composedContext,
		max_output_tokens: payload.request.max_output_tokens,
		messages: extractedUserTurn.history,
		metadata: payload.request.metadata,
		model: payload.request.model,
		run_id: payload.run_id,
		temperature: payload.request.temperature,
		trace_id: payload.trace_id,
		user_turn: resolvedUserTurn,
	});
}

export function logLiveMemoryWriteFailure(
	payload: Pick<RunRequestPayload, 'run_id' | 'trace_id'>,
	message: string,
	sourceFailureCode?: string,
): void {
	logMemoryIntegrationFailure('write', payload, message, sourceFailureCode);
}

export function canPersistLiveMemory(memoryStore?: MemoryOrchestrationStore): boolean {
	return canUseMemoryOrchestration(memoryStore);
}
