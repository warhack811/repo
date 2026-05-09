import { existsSync, statSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

import type {
	ModelMessage,
	ProviderCapabilities,
	RuntimeState,
	SupportedLocale,
	ToolResult,
} from '@runa/types';

import { adaptContextToModelRequest } from '../context/adapt-context-to-model-request.js';
import { buildMemoryPromptLayer } from '../context/build-memory-prompt-layer.js';
import { composeContext } from '../context/compose-context.js';
import {
	type WorkspaceLayer,
	composeWorkspaceContext,
} from '../context/compose-workspace-context.js';
import { orchestrateMemoryRead } from '../context/orchestrate-memory-read.js';
import {
	INLINE_MAX_CHARS,
	TOOL_RESULT_TRUNCATED_NOTICE,
} from '../context/runtime-context-limits.js';
import { defaultMemoryStore, hasMemoryStoreConfiguration } from '../persistence/memory-store.js';
import type { ToolCallSignature } from '../runtime/stop-conditions.js';
import type { RunRequestPayload } from './messages.js';
import type { MemoryOrchestrationStore } from './orchestration-types.js';

interface ExtractedUserTurn {
	readonly history: readonly ModelMessage[];
	readonly user_turn: string;
}

const TURKISH_SIGNAL_PATTERN =
	/[çğıöşüÇĞİÖŞÜ]|\b(merhaba|lutfen|lütfen|dosya|komut|kontrol|çalıştır|calistir|proje|sunucu|oku|yaz|bul)\b/iu;
const ENGLISH_SIGNAL_PATTERN =
	/\b(hello|please|could|would|should|what|how|read|check|find|write|run|project|server|file|command)\b/iu;

function hasWorkspaceRootMarker(directory: string): boolean {
	return (
		existsSync(resolve(directory, 'pnpm-workspace.yaml')) ||
		(existsSync(resolve(directory, '.git')) && existsSync(resolve(directory, 'package.json')))
	);
}

export function getLiveWorkingDirectory(startDirectory = process.cwd()): string {
	let currentDirectory = resolve(startDirectory);

	while (true) {
		if (hasWorkspaceRootMarker(currentDirectory)) {
			return currentDirectory;
		}

		const parentDirectory = dirname(currentDirectory);

		if (parentDirectory === currentDirectory) {
			return resolve(startDirectory);
		}

		currentDirectory = parentDirectory;
	}
}

function isPathWithinWorkspaceBoundary(resolvedPath: string, workspaceRoot: string): boolean {
	const normalizedResolvedPath = resolve(resolvedPath).toLowerCase();
	const normalizedWorkspaceRoot = resolve(workspaceRoot).toLowerCase();

	return (
		normalizedResolvedPath === normalizedWorkspaceRoot ||
		normalizedResolvedPath.startsWith(normalizedWorkspaceRoot + sep.toLowerCase()) ||
		normalizedResolvedPath.startsWith(`${normalizedWorkspaceRoot}/`)
	);
}

export function resolveLiveRunWorkingDirectory(
	payload: Pick<RunRequestPayload, 'working_directory'>,
	startDirectory = process.cwd(),
): string {
	const workspaceRoot = getLiveWorkingDirectory(startDirectory);
	const requestedWorkingDirectory = payload.working_directory?.trim();

	if (!requestedWorkingDirectory || requestedWorkingDirectory.length === 0) {
		return workspaceRoot;
	}

	const resolvedWorkingDirectory = resolve(workspaceRoot, requestedWorkingDirectory);

	if (!isPathWithinWorkspaceBoundary(resolvedWorkingDirectory, workspaceRoot)) {
		throw new Error('Requested working directory must stay within the active workspace boundary.');
	}

	if (!existsSync(resolvedWorkingDirectory)) {
		throw new Error('Requested working directory does not exist.');
	}

	if (!statSync(resolvedWorkingDirectory).isDirectory()) {
		throw new Error('Requested working directory must reference a directory.');
	}

	return resolvedWorkingDirectory;
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

export function inferSupportedLocaleFromText(text: string): SupportedLocale {
	if (TURKISH_SIGNAL_PATTERN.test(text)) {
		return 'tr';
	}

	if (ENGLISH_SIGNAL_PATTERN.test(text)) {
		return 'en';
	}

	return 'tr';
}

export function resolveRunRequestLocale(
	payload: Pick<RunRequestPayload, 'locale' | 'request'>,
): SupportedLocale {
	if (payload.locale) {
		return payload.locale;
	}

	const lastUserMessage = [...payload.request.messages]
		.reverse()
		.find((message) => message.role === 'user' && message.content.trim().length > 0);

	return inferSupportedLocaleFromText(lastUserMessage?.content ?? '');
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
	query: string | undefined,
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
			query,
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
	if (value.length <= INLINE_MAX_CHARS) {
		return value;
	}

	return `${value.slice(0, INLINE_MAX_CHARS)}\n${TOOL_RESULT_TRUNCATED_NOTICE}`;
}

function hasMatchingRecentToolCall(
	toolResult: ToolResult,
	recentToolCalls: readonly ToolCallSignature[] | undefined,
): boolean {
	if (recentToolCalls === undefined || recentToolCalls.length < 2) {
		return false;
	}

	const tail = recentToolCalls[recentToolCalls.length - 1];

	if (tail === undefined || tail.tool_name !== toolResult.tool_name) {
		return false;
	}

	return recentToolCalls
		.slice(0, -1)
		.some(
			(signature) =>
				signature.tool_name === tail.tool_name && signature.args_hash === tail.args_hash,
		);
}

export function buildToolResultContinuationUserTurn(
	userTurn: string,
	toolResult: ToolResult,
	recentToolCalls?: readonly ToolCallSignature[],
): string {
	const toolStatus =
		toolResult.status === 'success'
			? 'succeeded'
			: `failed${toolResult.error_code ? ` with ${toolResult.error_code}` : ''}`;
	const toolResultDetails =
		toolResult.status === 'success'
			? truncateToolResultPreview(serializeToolResultPreviewValue(toolResult.output))
			: (toolResult.error_message ?? 'The tool returned an error without a detailed message.');
	const recoveryPreamble = hasMatchingRecentToolCall(toolResult, recentToolCalls)
		? [
				'ATTENTION: You already called this exact tool with these arguments earlier in this run.',
				'The previous result is shown below. DO NOT call this tool again with the same arguments.',
				'Use the result to write your assistant response, or call a DIFFERENT tool / DIFFERENT arguments.',
			]
		: [];

	return [
		...recoveryPreamble,
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
		readonly provider_capabilities?: ProviderCapabilities;
		readonly recent_tool_calls?: readonly ToolCallSignature[];
		readonly workspace_layer?: WorkspaceLayer;
	}> = {},
): Promise<
	RunRequestPayload['request'] & {
		readonly run_id: string;
		readonly trace_id: string;
	}
> {
	const extractedUserTurn = extractUserTurn(payload.request.messages);
	const locale = resolveRunRequestLocale(payload);
	const memoryLayer = await buildLiveMemoryLayer(
		payload,
		workingDirectory,
		extractedUserTurn?.user_turn,
		options.memoryStore,
	);

	if (!extractedUserTurn) {
		return toModelRequest(payload);
	}

	const resolvedUserTurn =
		options.current_state === 'TOOL_RESULT_INGESTING' && options.latest_tool_result !== undefined
			? buildToolResultContinuationUserTurn(
					extractedUserTurn.user_turn,
					options.latest_tool_result,
					options.recent_tool_calls,
				)
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
		locale,
		memory_layer: memoryLayer,
		provider_capabilities: options.provider_capabilities,
		run_id: payload.run_id,
		trace_id: payload.trace_id,
		workspace_layer: options.workspace_layer,
		working_directory: workingDirectory,
	});

	return adaptContextToModelRequest({
		attachments: payload.attachments,
		available_tools: payload.request.available_tools,
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
