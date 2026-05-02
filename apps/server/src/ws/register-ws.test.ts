import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';

import type {
	AuthContext,
	MemoryRecord,
	RenderBlock,
	RuntimeEvent,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultBlock,
} from '@runa/types';
import type { WebSocketServerBridgeMessage } from './messages.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { composeWorkspaceContext } from '../context/compose-workspace-context.js';
import type {
	ApprovalStore,
	PendingApprovalEntry,
	PersistApprovalRequestInput,
} from '../persistence/approval-store.js';
import type { MemoryStore } from '../persistence/memory-store.js';
import type { PersistRunStateInput } from '../persistence/run-store.js';
import { createPermissionEngine } from '../policy/permission-engine.js';
import { resetUsageRateLimitStore } from '../policy/usage-quota.js';
import { mapSearchResultToBlock } from '../presentation/map-search-result.js';
import { ingestToolResult } from '../runtime/ingest-tool-result.js';
import { requestApproval } from '../runtime/request-approval.js';
import { resolveApproval } from '../runtime/resolve-approval.js';
import { runToolStep } from '../runtime/run-tool-step.js';
import { createDesktopScreenshotTool } from '../tools/desktop-screenshot.js';
import { fileReadTool } from '../tools/file-read.js';
import { fileWriteTool } from '../tools/file-write.js';
import { ToolRegistry, listBuiltInToolNames } from '../tools/registry.js';
import { searchCodebaseTool } from '../tools/search-codebase.js';
import { shellExecTool } from '../tools/shell-exec.js';
import { resetDefaultToolEffectIdempotencyStore } from '../tools/tool-idempotency.js';
import { webSearchTool } from '../tools/web-search.js';
import {
	classifyApprovalReleaseChainFailure,
	extractApprovalReleaseSummaryFromOutput,
} from './approval-release-rehearsal-summary.js';
import {
	resetConversationCollaborationHub,
	setConversationCollaborationAccessResolver,
} from './conversation-collaboration.js';
import { DesktopAgentBridgeRegistry } from './desktop-agent-bridge.js';
import { getLiveMemoryScopeId, getLiveWorkingDirectory } from './live-request.js';
import { createWebSocketPolicyWiring } from './policy-wiring.js';
import {
	attachDesktopAgentWebSocketHandler,
	attachRuntimeWebSocketHandler,
	handleWebSocketMessage,
} from './register-ws.js';

const execFileAsync = promisify(execFile);

vi.mock('../persistence/run-store.js', async () => {
	const actual = await vi.importActual<typeof import('../persistence/run-store.js')>(
		'../persistence/run-store.js',
	);

	return {
		...actual,
		persistRunState: vi.fn(async () => {}),
	};
});

class MockSocket {
	readonly sentMessages: string[] = [];
	closed = false;
	closeCode?: number;
	closeReason?: string;
	#closeListener?: () => void;
	#messageListener?: (message: unknown) => void;

	on(event: 'close' | 'message', listener: (message?: unknown) => void): void {
		if (event === 'close') {
			this.#closeListener = listener as () => void;
			return;
		}

		if (event === 'message') {
			this.#messageListener = listener as (message: unknown) => void;
		}
	}

	send(message: string): void {
		this.sentMessages.push(message);
	}

	close(code?: number, reason?: string): void {
		this.closed = true;
		this.closeCode = code;
		this.closeReason = reason;
		this.#closeListener?.();
	}

	emitMessage(message: unknown): void {
		this.#messageListener?.(message);
	}
}

function parseMessages(socket: MockSocket): WebSocketServerBridgeMessage[] {
	return socket.sentMessages.map((message) => JSON.parse(message) as WebSocketServerBridgeMessage);
}

function getLatestDesktopAgentConnectionId(socket: MockSocket): string {
	const sessionAcceptedMessage = socket.sentMessages
		.map(
			(message) =>
				JSON.parse(message) as {
					readonly payload?: {
						readonly connection_id?: unknown;
					};
					readonly type?: unknown;
				},
		)
		.filter((message) => message.type === 'desktop-agent.session.accepted')
		.at(-1);

	if (typeof sessionAcceptedMessage?.payload?.connection_id !== 'string') {
		throw new Error('Expected desktop-agent.session.accepted to include a connection_id.');
	}

	return sessionAcceptedMessage.payload.connection_id;
}

function getLatestDesktopAgentHeartbeatPing(socket: MockSocket): {
	readonly payload: {
		readonly ping_id: string;
		readonly sent_at: string;
	};
	readonly type: 'desktop-agent.heartbeat.ping';
} {
	const heartbeatMessage = socket.sentMessages
		.map(
			(message) =>
				JSON.parse(message) as {
					readonly payload?: {
						readonly ping_id?: unknown;
						readonly sent_at?: unknown;
					};
					readonly type?: unknown;
				},
		)
		.reverse()
		.find((message) => message.type === 'desktop-agent.heartbeat.ping');

	if (
		heartbeatMessage?.type !== 'desktop-agent.heartbeat.ping' ||
		typeof heartbeatMessage.payload?.ping_id !== 'string' ||
		typeof heartbeatMessage.payload?.sent_at !== 'string'
	) {
		throw new Error('Expected desktop-agent.heartbeat.ping to be emitted.');
	}

	return {
		payload: {
			ping_id: heartbeatMessage.payload.ping_id,
			sent_at: heartbeatMessage.payload.sent_at,
		},
		type: 'desktop-agent.heartbeat.ping',
	};
}

function sendDesktopAgentHeartbeatPong(
	socket: MockSocket,
	ping: ReturnType<typeof getLatestDesktopAgentHeartbeatPing>,
): void {
	socket.emitMessage(
		JSON.stringify({
			payload: {
				ping_id: ping.payload.ping_id,
				received_at: new Date().toISOString(),
			},
			type: 'desktop-agent.heartbeat.pong',
		}),
	);
}

function createFakeTool(
	name: ToolCallInput['tool_name'],
	execute: (input: ToolCallInput, context: ToolExecutionContext) => Promise<ToolResult>,
	metadataOverrides: Partial<ToolDefinition['metadata']> = {},
): ToolDefinition {
	return {
		callable_schema: {
			parameters: {},
		},
		description: `Fake ${name} tool for ws visibility tests.`,
		execute,
		metadata: {
			capability_class: name.startsWith('shell.') ? 'shell' : 'file_system',
			requires_approval: false,
			risk_level: name.startsWith('shell.') ? 'high' : 'low',
			side_effect_level: name.startsWith('shell.') ? 'execute' : 'read',
			...metadataOverrides,
		},
		name,
	};
}

function createExecutionContext(
	overrides: Partial<ToolExecutionContext> = {},
): ToolExecutionContext {
	return {
		run_id: 'run_ws_tool_context',
		trace_id: 'trace_ws_tool_context',
		working_directory: 'd:\\ai\\Runa',
		...overrides,
	};
}

function createAuthenticatedAuthContext(): AuthContext {
	return {
		bearer_token_present: true,
		principal: {
			email: 'dev@runa.local',
			kind: 'authenticated',
			provider: 'internal',
			role: 'authenticated',
			scope: {
				tenant_id: 'tenant_1',
				workspace_id: 'workspace_1',
				workspace_ids: ['workspace_1'],
			},
			session_id: 'session_1',
			user_id: 'user_1',
		},
		request_id: 'req_ws_runtime_1',
		transport: 'websocket',
	};
}

function createApprovalStore(): {
	readonly entries: Map<string, PendingApprovalEntry>;
	readonly getPendingApprovalByIdMock: ReturnType<typeof vi.fn>;
	readonly persistApprovalRequestMock: ReturnType<typeof vi.fn>;
	readonly persistApprovalResolutionMock: ReturnType<typeof vi.fn>;
	readonly store: ApprovalStore;
} {
	const entries = new Map<string, PendingApprovalEntry>();
	const getPendingApprovalById: ApprovalStore['getPendingApprovalById'] = vi.fn(
		async (approval_id) => entries.get(approval_id) ?? null,
	);
	const persistApprovalRequest: ApprovalStore['persistApprovalRequest'] = vi.fn(async (input) => {
		entries.set(input.approval_request.approval_id, {
			approval_request: input.approval_request,
			auto_continue_context: input.auto_continue_context,
			next_sequence_no: input.next_sequence_no ?? 1,
			pending_tool_call: input.pending_tool_call,
		});
	});
	const persistApprovalResolution: ApprovalStore['persistApprovalResolution'] = vi.fn(
		async (input) => {
			entries.delete(input.approval_request.approval_id);
		},
	);

	return {
		entries,
		getPendingApprovalByIdMock: getPendingApprovalById as ReturnType<typeof vi.fn>,
		persistApprovalRequestMock: persistApprovalRequest as ReturnType<typeof vi.fn>,
		persistApprovalResolutionMock: persistApprovalResolution as ReturnType<typeof vi.fn>,
		store: {
			getPendingApprovalById,
			persistApprovalRequest,
			persistApprovalResolution,
		},
	};
}

function createSharedApprovalStore(entries: Map<string, PendingApprovalEntry>): {
	readonly getPendingApprovalByIdMock: ReturnType<typeof vi.fn>;
	readonly persistApprovalRequestMock: ReturnType<typeof vi.fn>;
	readonly persistApprovalResolutionMock: ReturnType<typeof vi.fn>;
	readonly store: ApprovalStore;
} {
	const getPendingApprovalById: ApprovalStore['getPendingApprovalById'] = vi.fn(
		async (approval_id) => entries.get(approval_id) ?? null,
	);
	const persistApprovalRequest: ApprovalStore['persistApprovalRequest'] = vi.fn(async (input) => {
		entries.set(input.approval_request.approval_id, {
			approval_request: input.approval_request,
			auto_continue_context: input.auto_continue_context,
			next_sequence_no: input.next_sequence_no ?? 1,
			pending_tool_call: input.pending_tool_call,
		});
	});
	const persistApprovalResolution: ApprovalStore['persistApprovalResolution'] = vi.fn(
		async (input) => {
			entries.delete(input.approval_request.approval_id);
		},
	);

	return {
		getPendingApprovalByIdMock: getPendingApprovalById as ReturnType<typeof vi.fn>,
		persistApprovalRequestMock: persistApprovalRequest as ReturnType<typeof vi.fn>,
		persistApprovalResolutionMock: persistApprovalResolution as ReturnType<typeof vi.fn>,
		store: {
			getPendingApprovalById,
			persistApprovalRequest,
			persistApprovalResolution,
		},
	};
}

function createPolicyStateStore() {
	const states = new Map<
		string,
		Awaited<ReturnType<ReturnType<typeof createWebSocketPolicyWiring>['getState']>>
	>();
	const getPolicyState = vi.fn(async (scope: { readonly session_id: string }) => {
		return states.get(scope.session_id) ?? null;
	});
	const putPolicyState = vi.fn(
		async (
			scope: { readonly session_id: string },
			state: Awaited<ReturnType<ReturnType<typeof createWebSocketPolicyWiring>['getState']>>,
		) => {
			states.set(scope.session_id, state);
		},
	);

	return {
		getPolicyStateMock: getPolicyState,
		putPolicyStateMock: putPolicyState,
		store: {
			getPolicyState,
			putPolicyState,
		},
	};
}

async function enableAutoContinueForSocket(
	socket: MockSocket,
): Promise<ReturnType<typeof createWebSocketPolicyWiring>> {
	const policyWiring = createWebSocketPolicyWiring();
	const autoContinueDecision = (
		await policyWiring.evaluateAutoContinuePermission(socket, {
			requested_max_consecutive_turns: 4,
		})
	).decision;

	if (autoContinueDecision.decision !== 'require_approval') {
		throw new Error(
			'Expected auto-continue to require approval before progressive trust is enabled.',
		);
	}

	await policyWiring.recordOutcome(socket, {
		decision: autoContinueDecision,
		outcome: 'approval_approved',
	});

	return policyWiring;
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
	vi.unstubAllGlobals();
	resetConversationCollaborationHub();
	resetDefaultToolEffectIdempotencyStore();
	resetUsageRateLimitStore();
	Reflect.deleteProperty(process.env, 'ANTHROPIC_API_KEY');
	Reflect.deleteProperty(process.env, 'GROQ_API_KEY');
	Reflect.deleteProperty(process.env, 'RUNA_STREAMING_TOOL_HEAVY_BYPASS');
});

describe('approval release rehearsal helpers', () => {
	it('classifies the exact missing approval chain stage', () => {
		expect(
			classifyApprovalReleaseChainFailure({
				approval_boundary_observed: true,
				approval_resolve_sent: false,
				continuation_observed: false,
				reconnect_restart_tolerated: false,
				terminal_run_finished_completed: false,
			}),
		).toBe('approval_resolve_missing');
		expect(
			classifyApprovalReleaseChainFailure({
				approval_boundary_observed: true,
				approval_resolve_sent: true,
				continuation_observed: true,
				reconnect_restart_tolerated: true,
				terminal_run_finished_completed: false,
			}),
		).toBe('terminal_finish_missing');
	});

	it('extracts the last structured rehearsal summary from script output', () => {
		expect(
			extractApprovalReleaseSummaryFromOutput(
				[
					'[approval-smoke] booting',
					'APPROVAL_RELEASE_REHEARSAL_SUMMARY {"result":"FAIL","failure_stage":"continuation_missing"}',
					'APPROVAL_RELEASE_REHEARSAL_SUMMARY {"result":"PASS","failure_stage":null}',
				].join('\n'),
				'APPROVAL_RELEASE_REHEARSAL_SUMMARY',
			),
		).toEqual({
			failure_stage: null,
			result: 'PASS',
		});
	});
});

async function withTempDirectory<T>(callback: (directory: string) => Promise<T>): Promise<T> {
	const directory = await mkdtemp(join(tmpdir(), 'runa-ws-'));

	try {
		return await callback(directory);
	} finally {
		await rm(directory, {
			force: true,
			recursive: true,
		});
	}
}

async function withWorkspaceTempDirectory<T>(
	callback: (directory: string) => Promise<T>,
): Promise<T> {
	const directory = await mkdtemp(join(getLiveWorkingDirectory(), 'runa-ws-live-'));

	try {
		return await callback(directory);
	} finally {
		await rm(directory, {
			force: true,
			recursive: true,
		});
	}
}

async function runGit(args: readonly string[], workingDirectory: string): Promise<void> {
	await execFileAsync('git', [...args], {
		cwd: workingDirectory,
		windowsHide: true,
	});
}

function parseToolNamesFromRequestBody(bodyText: string): readonly string[] {
	if (bodyText.length === 0) {
		return [];
	}

	const parsedBody = JSON.parse(bodyText) as {
		readonly tools?: ReadonlyArray<{
			readonly function?: {
				readonly name?: unknown;
			};
		}>;
	};

	return (parsedBody.tools ?? [])
		.map((tool) => tool.function?.name)
		.filter((name): name is string => typeof name === 'string')
		.sort((left, right) => left.localeCompare(right));
}

function parseGroqMessagesFromRequestBody(
	bodyText: string,
): readonly Readonly<{ content: string; role: string }>[] {
	if (bodyText.length === 0) {
		return [];
	}

	const parsedBody = JSON.parse(bodyText) as {
		readonly messages?: ReadonlyArray<{
			readonly content?: unknown;
			readonly role?: unknown;
		}>;
	};

	return (parsedBody.messages ?? []).filter(
		(message): message is Readonly<{ content: string; role: string }> =>
			typeof message.content === 'string' && typeof message.role === 'string',
	);
}

function createGroqAssistantResponse(input: {
	readonly content: string;
	readonly response_id: string;
}): Response {
	return new Response(
		JSON.stringify({
			choices: [
				{
					finish_reason: 'stop',
					message: {
						content: input.content,
						role: 'assistant',
					},
				},
			],
			id: input.response_id,
			model: 'llama-3.3-70b-versatile',
			usage: {
				completion_tokens: 12,
				prompt_tokens: 8,
				total_tokens: 20,
			},
		}),
		{
			headers: {
				'content-type': 'application/json',
			},
			status: 200,
		},
	);
}

function createDeepSeekAssistantResponse(input: {
	readonly content: string;
	readonly response_id: string;
}): Response {
	return new Response(
		JSON.stringify({
			choices: [
				{
					finish_reason: 'stop',
					message: {
						content: input.content,
						role: 'assistant',
					},
				},
			],
			id: input.response_id,
			model: 'deepseek-v4-flash',
			usage: {
				completion_tokens: 12,
				prompt_tokens: 8,
				total_tokens: 20,
			},
		}),
		{
			headers: {
				'content-type': 'application/json',
			},
			status: 200,
		},
	);
}

function createGroqToolCallResponse(input: {
	readonly arguments: Readonly<Record<string, unknown>>;
	readonly call_id: string;
	readonly response_id: string;
	readonly tool_name: string;
}): Response {
	return new Response(
		JSON.stringify({
			choices: [
				{
					finish_reason: 'tool_calls',
					message: {
						role: 'assistant',
						tool_calls: [
							{
								function: {
									arguments: input.arguments,
									name: input.tool_name,
								},
								id: input.call_id,
								type: 'function',
							},
						],
					},
				},
			],
			id: input.response_id,
			model: 'llama-3.3-70b-versatile',
			usage: {
				completion_tokens: 12,
				prompt_tokens: 8,
				total_tokens: 20,
			},
		}),
		{
			headers: {
				'content-type': 'application/json',
			},
			status: 200,
		},
	);
}

function createGroqMultiToolCallResponse(input: {
	readonly response_id: string;
	readonly tool_calls: readonly Readonly<{
		readonly arguments: Readonly<Record<string, unknown>>;
		readonly call_id: string;
		readonly tool_name: string;
	}>[];
}): Response {
	return new Response(
		JSON.stringify({
			choices: [
				{
					finish_reason: 'tool_calls',
					message: {
						role: 'assistant',
						tool_calls: input.tool_calls.map((toolCall) => ({
							function: {
								arguments: toolCall.arguments,
								name: toolCall.tool_name,
							},
							id: toolCall.call_id,
							type: 'function',
						})),
					},
				},
			],
			id: input.response_id,
			model: 'llama-3.3-70b-versatile',
			usage: {
				completion_tokens: 12,
				prompt_tokens: 8,
				total_tokens: 20,
			},
		}),
		{
			headers: {
				'content-type': 'application/json',
			},
			status: 200,
		},
	);
}

function createMemoryStore(): {
	readonly createMemoryMock: ReturnType<typeof vi.fn>;
	readonly listActiveMemoriesMock: ReturnType<typeof vi.fn>;
	readonly records: MemoryRecord[];
	readonly store: Pick<MemoryStore, 'createMemory' | 'listActiveMemories' | 'supersedeMemory'>;
	readonly supersedeMemoryMock: ReturnType<typeof vi.fn>;
} {
	const records: MemoryRecord[] = [];
	let sequence = 0;

	function nextTimestamp(): string {
		const timestamp = `2026-04-11T12:00:${String(sequence).padStart(2, '0')}.000Z`;
		sequence += 1;
		return timestamp;
	}

	const createMemory: MemoryStore['createMemory'] = vi.fn(async (input) => {
		const createdAt = nextTimestamp();
		const record: MemoryRecord = {
			archived_at: undefined,
			content: input.content,
			created_at: createdAt,
			memory_id: `memory_${String(sequence).padStart(4, '0')}`,
			scope: input.scope,
			scope_id: input.scope_id,
			source_kind: input.source_kind,
			source_run_id: input.source_run_id,
			source_trace_id: input.source_trace_id,
			status: 'active',
			summary: input.summary,
			updated_at: createdAt,
		};

		records.push(record);
		return record;
	});

	const listActiveMemories: MemoryStore['listActiveMemories'] = vi.fn(async (scope, scope_id) =>
		records
			.filter(
				(record) =>
					record.status === 'active' && record.scope === scope && record.scope_id === scope_id,
			)
			.sort((left, right) => {
				const updatedAtComparison = right.updated_at.localeCompare(left.updated_at);

				if (updatedAtComparison !== 0) {
					return updatedAtComparison;
				}

				return left.memory_id.localeCompare(right.memory_id);
			}),
	);

	const supersedeMemory: MemoryStore['supersedeMemory'] = vi.fn(async ({ memory_id }) => {
		const index = records.findIndex((record) => record.memory_id === memory_id);

		if (index < 0) {
			return null;
		}

		const existingRecord = records[index];

		if (!existingRecord || existingRecord.status !== 'active') {
			return existingRecord ?? null;
		}

		const updatedAt = nextTimestamp();
		const supersededRecord: MemoryRecord = {
			...existingRecord,
			archived_at: updatedAt,
			status: 'superseded',
			updated_at: updatedAt,
		};

		records[index] = supersededRecord;
		return supersededRecord;
	});

	return {
		createMemoryMock: createMemory as ReturnType<typeof vi.fn>,
		listActiveMemoriesMock: listActiveMemories as ReturnType<typeof vi.fn>,
		records,
		store: {
			createMemory,
			listActiveMemories,
			supersedeMemory,
		},
		supersedeMemoryMock: supersedeMemory as ReturnType<typeof vi.fn>,
	};
}

describe('register-ws', () => {
	const toolResultBlock: ToolResultBlock = {
		created_at: '2026-04-10T12:00:00.000Z',
		id: 'tool_result:file.read:call_ws_1',
		payload: {
			call_id: 'call_ws_1',
			result_preview: {
				kind: 'string',
				summary_text: 'hello.txt',
			},
			status: 'success',
			summary: 'file.read completed successfully.',
			tool_name: 'file.read',
		},
		schema_version: 1,
		type: 'tool_result',
	};

	it('resolves live working directory to the workspace root when server cwd is the package', async () => {
		const previousCwd = process.cwd();
		const workspaceRoot = getLiveWorkingDirectory(previousCwd);
		const serverPackageDirectory = join(workspaceRoot, 'apps', 'server');

		try {
			process.chdir(serverPackageDirectory);

			expect(getLiveWorkingDirectory()).toBe(workspaceRoot);
			expect(getLiveMemoryScopeId(getLiveWorkingDirectory())).toBe(workspaceRoot);
		} finally {
			process.chdir(previousCwd);
		}
	});

	it('keeps explicit temporary directories when no workspace root marker exists', async () => {
		await withTempDirectory(async (directory) => {
			expect(getLiveWorkingDirectory(directory)).toBe(directory);
			expect(getLiveMemoryScopeId(directory)).toBe(directory);
		});
	});

	it('sends connection.ready when a connection is attached', () => {
		const socket = new MockSocket();

		attachRuntimeWebSocketHandler(socket);

		expect(parseMessages(socket)).toEqual([
			{
				message: 'ready',
				transport: 'websocket',
				type: 'connection.ready',
			},
		]);
	});

	it('sends run.accepted, runtime.event messages and run.finished for a valid run.request', async () => {
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const persistRunState = vi.fn(async (_input: PersistRunStateInput) => {});

		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'stop',
									message: {
										content: 'Hello over websocket',
										role: 'assistant',
									},
								},
							],
							id: 'chatcmpl_ws',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Hello', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_1',
					trace_id: 'trace_ws_1',
				},
				type: 'run.request',
			}),
			{
				persistEvents,
				persistRunState,
			},
		);

		expect(parseMessages(socket).map((message) => message.type)).toEqual([
			'connection.ready',
			'run.accepted',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'run.finished',
		]);
		expect(parseMessages(socket).some((message) => message.type === 'presentation.blocks')).toBe(
			false,
		);
		expect(persistEvents).toHaveBeenCalledTimes(1);
		expect(persistEvents.mock.calls[0]?.[0]).toHaveLength(5);
		expect(persistRunState).toHaveBeenCalledWith(
			expect.objectContaining({
				current_state: 'COMPLETED',
				run_id: 'run_ws_1',
				trace_id: 'trace_ws_1',
			}),
		);
	});

	it('rejects viewers from starting a run in a shared conversation', async () => {
		const socket = new MockSocket();

		attachRuntimeWebSocketHandler(socket);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					conversation_id: 'conversation_shared',
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Hello', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_viewer',
					trace_id: 'trace_ws_viewer',
				},
				type: 'run.request',
			}),
			{
				conversationStore: {
					appendConversationMessage: vi.fn(),
					ensureConversation: vi.fn(async () => {
						throw new Error('Conversation not found for the current user.');
					}),
				},
			},
		);

		const messages = parseMessages(socket);
		expect(messages.map((message) => message.type)).toEqual(['connection.ready', 'run.rejected']);
	});

	it('allows editors to start a run and fans out completion to another shared socket', async () => {
		const ownerSocket = new MockSocket();
		const viewerSocket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const persistRunState = vi.fn(async (_input: PersistRunStateInput) => {});

		setConversationCollaborationAccessResolver(async (_conversationId, scope) => {
			if (scope.user_id === 'viewer_user') {
				return 'viewer';
			}

			if (scope.user_id === 'owner_user') {
				return 'owner';
			}

			return null;
		});

		attachRuntimeWebSocketHandler(ownerSocket, {
			auth_context: {
				principal: {
					email: 'owner@runa.local',
					kind: 'authenticated',
					provider: 'supabase',
					role: 'authenticated',
					scope: {},
					user_id: 'owner_user',
				},
				transport: 'websocket',
			},
		});
		attachRuntimeWebSocketHandler(viewerSocket, {
			auth_context: {
				principal: {
					email: 'viewer@runa.local',
					kind: 'authenticated',
					provider: 'supabase',
					role: 'authenticated',
					scope: {},
					user_id: 'viewer_user',
				},
				transport: 'websocket',
			},
		});

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'stop',
									message: {
										content: 'Shared answer',
										role: 'assistant',
									},
								},
							],
							id: 'chatcmpl_ws_shared',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		await handleWebSocketMessage(
			ownerSocket,
			JSON.stringify({
				payload: {
					conversation_id: 'conversation_shared',
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Hello shared', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_shared',
					trace_id: 'trace_ws_shared',
				},
				type: 'run.request',
			}),
			{
				conversationStore: {
					appendConversationMessage: vi.fn(async (input) => ({
						content: input.content,
						conversation_id: input.conversation_id,
						created_at: input.created_at ?? '2026-04-23T12:00:00.000Z',
						message_id: `message_${input.conversation_id}`,
						role: input.role,
						run_id: input.run_id,
						sequence_no: 1,
						trace_id: input.trace_id,
					})),
					ensureConversation: vi.fn(async (input) => ({
						access_role: 'owner' as const,
						conversation_id: input.conversation_id ?? 'conversation_shared',
						created_at: input.created_at ?? '2026-04-23T12:00:00.000Z',
						last_message_at: input.created_at ?? '2026-04-23T12:00:00.000Z',
						last_message_preview: input.initial_preview ?? 'Hello shared',
						owner_user_id: 'owner_user',
						title: 'Shared conversation',
						updated_at: input.created_at ?? '2026-04-23T12:00:00.000Z',
					})),
				},
				persistEvents,
				persistRunState,
			},
		);

		const viewerMessages = parseMessages(viewerSocket).map((message) => message.type);
		expect(viewerMessages).toContain('run.accepted');
		expect(viewerMessages).toContain('run.finished');
	});

	it('streams text.delta messages before run.finished when the provider returns SSE text chunks', async () => {
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const persistRunState = vi.fn(async (_input: PersistRunStateInput) => {});

		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						[
							'data: {"id":"chatcmpl_ws_stream","model":"llama-3.3-70b-versatile","choices":[{"delta":{"role":"assistant","content":"Hello "},"finish_reason":null}]}',
							'',
							'data: {"id":"chatcmpl_ws_stream","model":"llama-3.3-70b-versatile","choices":[{"delta":{"content":"streaming world"},"finish_reason":"stop"}],"usage":{"prompt_tokens":8,"completion_tokens":12,"total_tokens":20}}',
							'',
							'data: [DONE]',
							'',
						].join('\n'),
						{
							headers: {
								'content-type': 'text/event-stream',
							},
							status: 200,
						},
					),
			),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Hello', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_stream_1',
					trace_id: 'trace_ws_stream_1',
				},
				type: 'run.request',
			}),
			{
				persistEvents,
				persistRunState,
			},
		);

		const messages = parseMessages(socket);
		const textDeltaMessages = messages.filter(
			(message): message is Extract<WebSocketServerBridgeMessage, { type: 'text.delta' }> =>
				message.type === 'text.delta',
		);
		const finishedMessageIndex = messages.findIndex((message) => message.type === 'run.finished');
		const lastTextDeltaIndex = messages.reduce(
			(lastIndex, message, index) => (message.type === 'text.delta' ? index : lastIndex),
			-1,
		);

		expect(textDeltaMessages.map((message) => message.payload.text_delta)).toEqual([
			'Hello ',
			'streaming world',
		]);
		expect(lastTextDeltaIndex).toBeGreaterThan(-1);
		expect(finishedMessageIndex).toBeGreaterThan(lastTextDeltaIndex);
		expect(messages[finishedMessageIndex]).toMatchObject({
			payload: {
				final_state: 'COMPLETED',
				run_id: 'run_ws_stream_1',
				status: 'completed',
				trace_id: 'trace_ws_stream_1',
			},
			type: 'run.finished',
		});
	});

	it('discards tentative DeepSeek streaming text and falls back to generate on unparseable tool calls', async () => {
		process.env['RUNA_STREAMING_TOOL_HEAVY_BYPASS'] = '0';
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const registry = new ToolRegistry();
		const requestBodies: Array<{
			readonly messages?: ReadonlyArray<{
				readonly content?: unknown;
				readonly role?: unknown;
			}>;
		}> = [];
		const fetchResponses = [
			new Response(
				[
					'data: {"id":"chatcmpl_deepseek_ws_bad_tool","model":"deepseek-v4-flash","choices":[{"delta":{"role":"assistant","content":"Tentative text before tool "},"finish_reason":null}]}',
					'',
					'data: {"id":"chatcmpl_deepseek_ws_bad_tool","model":"deepseek-v4-flash","choices":[{"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_bad_json","type":"function","function":{"name":"file_read","arguments":"{\\"path\\""}}]},"finish_reason":null}]}',
					'',
					'data: {"id":"chatcmpl_deepseek_ws_bad_tool","model":"deepseek-v4-flash","choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
					'',
					'data: [DONE]',
					'',
				].join('\n'),
				{
					headers: {
						'content-type': 'text/event-stream',
					},
					status: 200,
				},
			),
			createDeepSeekAssistantResponse({
				content: 'Tool call repaired and the run can continue.',
				response_id: 'chatcmpl_deepseek_ws_repaired',
			}),
		];

		registry.register(fileReadTool);
		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(async (_input, init) => {
				if (init && typeof init === 'object' && 'body' in init && typeof init.body === 'string') {
					requestBodies.push(JSON.parse(init.body) as (typeof requestBodies)[number]);
				}

				const nextResponse = fetchResponses.shift();

				if (!nextResponse) {
					throw new Error('Unexpected fetch call in DeepSeek repair recovery test.');
				}

				return nextResponse;
			}),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					provider: 'deepseek',
					provider_config: {
						apiKey: 'deepseek-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Read a file', role: 'user' }],
						metadata: {
							model_router: {
								allow_provider_fallback: false,
							},
						},
						model: 'deepseek-v4-flash',
					},
					run_id: 'run_ws_deepseek_repair_1',
					trace_id: 'trace_ws_deepseek_repair_1',
				},
				type: 'run.request',
			}),
			{
				persistEvents,
				toolRegistry: registry,
			},
		);

		const messages = parseMessages(socket);
		const runtimeEventMessages = messages.filter(
			(message): message is Extract<WebSocketServerBridgeMessage, { type: 'runtime.event' }> =>
				message.type === 'runtime.event',
		);
		const discardMessages = messages.filter(
			(message): message is Extract<WebSocketServerBridgeMessage, { type: 'text.delta.discard' }> =>
				message.type === 'text.delta.discard',
		);
		const modelCompletedMessage = runtimeEventMessages.find(
			(message) => message.payload.event.event_type === 'model.completed',
		);
		const secondRequestMessages = requestBodies[1]?.messages ?? [];

		expect(requestBodies).toHaveLength(2);
		expect(
			secondRequestMessages.some(
				(message) =>
					message.role === 'system' &&
					typeof message.content === 'string' &&
					message.content.includes('strictly JSON-parseable'),
			),
		).toBe(false);
		expect(discardMessages).toEqual([
			{
				payload: {
					run_id: 'run_ws_deepseek_repair_1',
					trace_id: 'trace_ws_deepseek_repair_1',
				},
				type: 'text.delta.discard',
			},
		]);
		expect(modelCompletedMessage?.payload.event.metadata).not.toMatchObject({
			recovery: {
				type: 'tool_call_repair',
			},
		});
		expect(messages.at(-1)).toMatchObject({
			payload: {
				final_state: 'COMPLETED',
				run_id: 'run_ws_deepseek_repair_1',
				status: 'completed',
				trace_id: 'trace_ws_deepseek_repair_1',
			},
			type: 'run.finished',
		});
	});

	it('bypasses streaming for DeepSeek tool-heavy live run requests by default', async () => {
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const registry = new ToolRegistry();
		const requestBodies: Array<Readonly<Record<string, unknown>>> = [];

		registry.register(fileReadTool);
		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(async (_input, init) => {
				if (init && typeof init === 'object' && 'body' in init && typeof init.body === 'string') {
					requestBodies.push(JSON.parse(init.body) as Readonly<Record<string, unknown>>);
				}

				return createDeepSeekAssistantResponse({
					content: 'Generated without streaming for tool-heavy intent.',
					response_id: 'chatcmpl_deepseek_ws_bypass',
				});
			}),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					provider: 'deepseek',
					provider_config: {
						apiKey: 'deepseek-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Use file.read to inspect the workspace.', role: 'user' }],
						model: 'deepseek-v4-flash',
					},
					run_id: 'run_ws_deepseek_bypass_1',
					trace_id: 'trace_ws_deepseek_bypass_1',
				},
				type: 'run.request',
			}),
			{
				persistEvents,
				toolRegistry: registry,
			},
		);

		const messages = parseMessages(socket);
		const finishedMessage = messages.find((message) => message.type === 'run.finished');

		expect(requestBodies).toHaveLength(1);
		expect(requestBodies[0]?.['stream']).toBeUndefined();
		expect(messages.some((message) => message.type === 'text.delta')).toBe(false);
		expect(finishedMessage).toMatchObject({
			payload: {
				final_state: 'COMPLETED',
				run_id: 'run_ws_deepseek_bypass_1',
				status: 'completed',
			},
			type: 'run.finished',
		});
	});

	it('fast-paths assistant-only presentation.blocks after streamed runtime.event messages when explicitly requested', async () => {
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});

		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'stop',
									message: {
										content: 'Hello over websocket',
										role: 'assistant',
									},
								},
							],
							id: 'chatcmpl_ws_blocks',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					include_presentation_blocks: true,
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Hello', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_blocks_1',
					trace_id: 'trace_ws_blocks_1',
				},
				type: 'run.request',
			}),
			{
				persistEvents,
			},
		);

		const messages = parseMessages(socket);

		expect(messages.map((message) => message.type)).toEqual([
			'connection.ready',
			'run.accepted',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'presentation.blocks',
			'run.finished',
		]);

		const presentationMessage = messages.find((message) => message.type === 'presentation.blocks');

		expect(presentationMessage).toBeDefined();

		if (presentationMessage?.type === 'presentation.blocks') {
			expect(presentationMessage.payload.run_id).toBe('run_ws_blocks_1');
			expect(presentationMessage.payload.trace_id).toBe('trace_ws_blocks_1');
			expect(Array.isArray(presentationMessage.payload.blocks)).toBe(true);
			expect(presentationMessage.payload.blocks.map((block) => block.type)).toEqual([
				'status',
				'text',
				'event_list',
				'workspace_inspection_block',
				'run_timeline_block',
				'trace_debug_block',
			]);
			expect(presentationMessage.payload.blocks[5]).toMatchObject({
				payload: {
					debug_notes: expect.arrayContaining([
						expect.stringContaining('Context accounting:'),
						expect.stringContaining('Model usage: request'),
					]),
					run_state: 'COMPLETED',
					summary: 'Run completed without tool use.',
					title: 'Trace / Debug',
				},
				type: 'trace_debug_block',
			});
		}
		expect(persistEvents).toHaveBeenCalledTimes(1);
	});

	it('opens a live inspection.request -> inspection_detail_block interaction after summary blocks', async () => {
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});

		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'stop',
									message: {
										content: 'Inspection-ready response',
										role: 'assistant',
									},
								},
							],
							id: 'chatcmpl_ws_inspection_foundation',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					include_presentation_blocks: true,
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Give me a compact summary first.', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_inspection_foundation_1',
					trace_id: 'trace_ws_inspection_foundation_1',
				},
				type: 'run.request',
			}),
			{
				persistEvents,
			},
		);

		const initialMessages = parseMessages(socket);
		const initialPresentationMessage = initialMessages.find(
			(
				message,
			): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
				message.type === 'presentation.blocks',
		);

		expect(initialPresentationMessage).toBeDefined();

		if (initialPresentationMessage?.type !== 'presentation.blocks') {
			throw new Error('Expected initial summary presentation blocks.');
		}

		expect(initialPresentationMessage.payload.blocks.map((block) => block.type)).toEqual([
			'status',
			'text',
			'event_list',
			'workspace_inspection_block',
			'run_timeline_block',
			'trace_debug_block',
		]);

		const workspaceBlock = initialPresentationMessage.payload.blocks[3];
		const traceDebugBlock = initialPresentationMessage.payload.blocks[5];

		if (!workspaceBlock || workspaceBlock.type !== 'workspace_inspection_block') {
			throw new Error('Expected workspace inspection block in summary-first run.');
		}

		if (!traceDebugBlock || traceDebugBlock.type !== 'trace_debug_block') {
			throw new Error('Expected trace/debug block in summary-first run.');
		}

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					run_id: 'run_ws_inspection_foundation_1',
					target_id: workspaceBlock.id,
					target_kind: 'workspace',
				},
				type: 'inspection.request',
			}),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					detail_level: 'expanded',
					run_id: 'run_ws_inspection_foundation_1',
					target_id: traceDebugBlock.id,
					target_kind: 'trace_debug',
				},
				type: 'inspection.request',
			}),
		);

		const allMessages = parseMessages(socket);
		const presentationMessages = allMessages.filter(
			(
				message,
			): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
				message.type === 'presentation.blocks',
		);
		const workspaceDetailMessage = presentationMessages[1];
		const traceDebugDetailMessage = presentationMessages[2];

		expect(allMessages.map((message) => message.type)).toEqual([
			'connection.ready',
			'run.accepted',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'presentation.blocks',
			'run.finished',
			'presentation.blocks',
			'presentation.blocks',
		]);

		expect(workspaceDetailMessage?.payload.blocks).toHaveLength(1);
		expect(traceDebugDetailMessage?.payload.blocks).toHaveLength(1);

		if (workspaceDetailMessage?.type === 'presentation.blocks') {
			expect(workspaceDetailMessage.payload.blocks[0]).toMatchObject({
				payload: {
					target_kind: 'workspace',
					title: expect.stringContaining('Details'),
				},
				type: 'inspection_detail_block',
			});
		}

		if (traceDebugDetailMessage?.type === 'presentation.blocks') {
			expect(traceDebugDetailMessage.payload.blocks[0]).toMatchObject({
				payload: {
					detail_items: expect.arrayContaining([
						{
							label: 'Run context',
							value: 'run run_ws_i...tion_1 / trace trace_ws...tion_1',
						},
						expect.objectContaining({
							label: 'Request usage',
							value: expect.stringContaining('messages ~'),
						}),
						expect.objectContaining({
							label: 'Response usage',
							value: expect.stringContaining('provider 20 tok'),
						}),
					]),
					target_kind: 'trace_debug',
					title: 'Trace / Debug Details',
				},
				type: 'inspection_detail_block',
			});
		}
	});

	it('keeps repeated same-target inspection responses stable and cross-target detail responses isolated', async () => {
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});

		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'stop',
									message: {
										content: 'Inspection refinement response',
										role: 'assistant',
									},
								},
							],
							id: 'chatcmpl_ws_inspection_refinement',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					include_presentation_blocks: true,
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Give me summary-first inspection blocks.', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_inspection_refinement_1',
					trace_id: 'trace_ws_inspection_refinement_1',
				},
				type: 'run.request',
			}),
			{
				persistEvents,
			},
		);

		const initialPresentationMessage = parseMessages(socket).find(
			(
				message,
			): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
				message.type === 'presentation.blocks',
		);

		if (initialPresentationMessage?.type !== 'presentation.blocks') {
			throw new Error('Expected initial summary presentation blocks for inspection refinement.');
		}

		const workspaceBlock = initialPresentationMessage.payload.blocks.find(
			(block): block is Extract<RenderBlock, { type: 'workspace_inspection_block' }> =>
				block.type === 'workspace_inspection_block',
		);
		const traceDebugBlock = initialPresentationMessage.payload.blocks.find(
			(block): block is Extract<RenderBlock, { type: 'trace_debug_block' }> =>
				block.type === 'trace_debug_block',
		);

		if (!workspaceBlock || !traceDebugBlock) {
			throw new Error('Expected workspace and trace/debug summary blocks.');
		}

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					run_id: 'run_ws_inspection_refinement_1',
					target_id: workspaceBlock.id,
					target_kind: 'workspace',
				},
				type: 'inspection.request',
			}),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					run_id: 'run_ws_inspection_refinement_1',
					target_id: workspaceBlock.id,
					target_kind: 'workspace',
				},
				type: 'inspection.request',
			}),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					detail_level: 'expanded',
					run_id: 'run_ws_inspection_refinement_1',
					target_id: traceDebugBlock.id,
					target_kind: 'trace_debug',
				},
				type: 'inspection.request',
			}),
		);

		const presentationMessages = parseMessages(socket).filter(
			(
				message,
			): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
				message.type === 'presentation.blocks',
		);
		const firstWorkspaceDetailBlock = presentationMessages[1]?.payload.blocks[0];
		const secondWorkspaceDetailBlock = presentationMessages[2]?.payload.blocks[0];
		const traceDebugDetailBlock = presentationMessages[3]?.payload.blocks[0];

		expect(firstWorkspaceDetailBlock).toMatchObject({
			id: secondWorkspaceDetailBlock?.id,
			payload: secondWorkspaceDetailBlock?.payload,
			schema_version: secondWorkspaceDetailBlock?.schema_version,
			type: secondWorkspaceDetailBlock?.type,
		});
		expect(firstWorkspaceDetailBlock).toMatchObject({
			id: 'inspection_detail_block:run_ws_inspection_refinement_1:workspace:workspace_inspection_block:run_ws_inspection_refinement_1',
			payload: {
				target_kind: 'workspace',
			},
			type: 'inspection_detail_block',
		});
		expect(traceDebugDetailBlock).toMatchObject({
			id: 'inspection_detail_block:run_ws_inspection_refinement_1:trace_debug:trace_debug_block:run_ws_inspection_refinement_1',
			payload: {
				target_kind: 'trace_debug',
			},
			type: 'inspection_detail_block',
		});
		expect(traceDebugDetailBlock).not.toEqual(firstWorkspaceDetailBlock);
		expect(parseMessages(socket).map((message) => message.type)).toEqual([
			'connection.ready',
			'run.accepted',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'presentation.blocks',
			'run.finished',
			'presentation.blocks',
			'presentation.blocks',
			'presentation.blocks',
		]);
	});

	it('isolates inspection detail contexts across runs on the same socket', async () => {
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});

		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'stop',
									message: {
										content: 'Cross-run inspection isolation response',
										role: 'assistant',
									},
								},
							],
							id: 'chatcmpl_ws_inspection_cross_run',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		for (const runId of ['run_ws_inspection_cross_run_1', 'run_ws_inspection_cross_run_2']) {
			await handleWebSocketMessage(
				socket,
				JSON.stringify({
					payload: {
						include_presentation_blocks: true,
						provider: 'groq',
						provider_config: {
							apiKey: 'groq-key',
						},
						request: {
							max_output_tokens: 64,
							messages: [{ content: `Prepare summary blocks for ${runId}.`, role: 'user' }],
							model: 'llama-3.3-70b-versatile',
						},
						run_id: runId,
						trace_id: `trace_for_${runId}`,
					},
					type: 'run.request',
				}),
				{
					persistEvents,
				},
			);
		}

		const summaryPresentationMessages = parseMessages(socket).filter(
			(
				message,
			): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
				message.type === 'presentation.blocks',
		);
		const firstRunSummary = summaryPresentationMessages[0];
		const secondRunSummary = summaryPresentationMessages[1];

		if (firstRunSummary?.type !== 'presentation.blocks') {
			throw new Error('Expected summary presentation blocks for the first run.');
		}

		if (secondRunSummary?.type !== 'presentation.blocks') {
			throw new Error('Expected summary presentation blocks for the second run.');
		}

		const firstRunWorkspaceBlock = firstRunSummary.payload.blocks.find(
			(block): block is Extract<RenderBlock, { type: 'workspace_inspection_block' }> =>
				block.type === 'workspace_inspection_block',
		);
		const secondRunWorkspaceBlock = secondRunSummary.payload.blocks.find(
			(block): block is Extract<RenderBlock, { type: 'workspace_inspection_block' }> =>
				block.type === 'workspace_inspection_block',
		);

		if (!firstRunWorkspaceBlock || !secondRunWorkspaceBlock) {
			throw new Error('Expected workspace summary blocks for both runs.');
		}

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					run_id: 'run_ws_inspection_cross_run_1',
					target_id: firstRunWorkspaceBlock.id,
					target_kind: 'workspace',
				},
				type: 'inspection.request',
			}),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					run_id: 'run_ws_inspection_cross_run_2',
					target_id: secondRunWorkspaceBlock.id,
					target_kind: 'workspace',
				},
				type: 'inspection.request',
			}),
		);

		const allPresentationMessages = parseMessages(socket).filter(
			(
				message,
			): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
				message.type === 'presentation.blocks',
		);
		const firstRunDetailMessage = allPresentationMessages[2];
		const secondRunDetailMessage = allPresentationMessages[3];
		const firstRunDetailBlock = firstRunDetailMessage?.payload.blocks[0];
		const secondRunDetailBlock = secondRunDetailMessage?.payload.blocks[0];

		expect(firstRunDetailMessage?.payload.run_id).toBe('run_ws_inspection_cross_run_1');
		expect(secondRunDetailMessage?.payload.run_id).toBe('run_ws_inspection_cross_run_2');
		expect(firstRunDetailBlock).toMatchObject({
			id: `inspection_detail_block:run_ws_inspection_cross_run_1:workspace:${firstRunWorkspaceBlock.id}`,
			payload: {
				target_kind: 'workspace',
			},
			type: 'inspection_detail_block',
		});
		expect(secondRunDetailBlock).toMatchObject({
			id: `inspection_detail_block:run_ws_inspection_cross_run_2:workspace:${secondRunWorkspaceBlock.id}`,
			payload: {
				target_kind: 'workspace',
			},
			type: 'inspection_detail_block',
		});
		expect(firstRunDetailBlock).not.toEqual(secondRunDetailBlock);
		expect(parseMessages(socket).map((message) => message.type)).toEqual([
			'connection.ready',
			'run.accepted',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'presentation.blocks',
			'run.finished',
			'run.accepted',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'presentation.blocks',
			'run.finished',
			'presentation.blocks',
			'presentation.blocks',
		]);
	});

	it('keeps recent inspection contexts bounded while preserving retained past-run detail access', async () => {
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});

		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'stop',
									message: {
										content: 'Recent inspection visibility response',
										role: 'assistant',
									},
								},
							],
							id: 'chatcmpl_ws_inspection_recent_runs',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		const runIds = Array.from({ length: 7 }, (_, index) => `run_ws_inspection_recent_${index + 1}`);

		for (const runId of runIds) {
			await handleWebSocketMessage(
				socket,
				JSON.stringify({
					payload: {
						include_presentation_blocks: true,
						provider: 'groq',
						provider_config: {
							apiKey: 'groq-key',
						},
						request: {
							max_output_tokens: 64,
							messages: [{ content: `Prepare summary blocks for ${runId}.`, role: 'user' }],
							model: 'llama-3.3-70b-versatile',
						},
						run_id: runId,
						trace_id: `trace_for_${runId}`,
					},
					type: 'run.request',
				}),
				{
					persistEvents,
				},
			);
		}

		const summaryPresentationMessages = parseMessages(socket).filter(
			(
				message,
			): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
				message.type === 'presentation.blocks',
		);
		const oldestRunId = runIds[0];
		const latestRunId = runIds[runIds.length - 1];
		const firstRunSummary = summaryPresentationMessages[0];
		const latestRunSummary = summaryPresentationMessages[summaryPresentationMessages.length - 1];

		if (!oldestRunId || !latestRunId) {
			throw new Error('Expected bounded inspection run ids.');
		}

		if (firstRunSummary?.type !== 'presentation.blocks') {
			throw new Error('Expected summary presentation blocks for the oldest run.');
		}

		if (latestRunSummary?.type !== 'presentation.blocks') {
			throw new Error('Expected summary presentation blocks for the latest run.');
		}

		const firstRunWorkspaceBlock = firstRunSummary.payload.blocks.find(
			(block): block is Extract<RenderBlock, { type: 'workspace_inspection_block' }> =>
				block.type === 'workspace_inspection_block',
		);
		const latestRunWorkspaceBlock = latestRunSummary.payload.blocks.find(
			(block): block is Extract<RenderBlock, { type: 'workspace_inspection_block' }> =>
				block.type === 'workspace_inspection_block',
		);

		if (!firstRunWorkspaceBlock || !latestRunWorkspaceBlock) {
			throw new Error('Expected workspace summary blocks for the oldest and latest runs.');
		}

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					run_id: oldestRunId,
					target_id: firstRunWorkspaceBlock.id,
					target_kind: 'workspace',
				},
				type: 'inspection.request',
			}),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					run_id: latestRunId,
					target_id: latestRunWorkspaceBlock.id,
					target_kind: 'workspace',
				},
				type: 'inspection.request',
			}),
		);

		const allMessages = parseMessages(socket);
		const latestMessages = allMessages.slice(-2);
		const latestRunDetailMessage = latestMessages.find(
			(
				message,
			): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
				message.type === 'presentation.blocks',
		);
		const prunedRunRejection = latestMessages.find(
			(message): message is Extract<WebSocketServerBridgeMessage, { type: 'run.rejected' }> =>
				message.type === 'run.rejected',
		);

		expect(prunedRunRejection).toMatchObject({
			payload: {
				error_message: expect.stringContaining('Inspection context not found'),
			},
			type: 'run.rejected',
		});
		expect(latestRunDetailMessage?.payload.run_id).toBe(latestRunId);
		expect(latestRunDetailMessage?.payload.blocks[0]).toMatchObject({
			id: `inspection_detail_block:${latestRunId}:workspace:${latestRunWorkspaceBlock.id}`,
			payload: {
				target_kind: 'workspace',
			},
			type: 'inspection_detail_block',
		});
	});

	it('sends additive tool_result blocks through the existing presentation.blocks message', async () => {
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const getAdditionalPresentationBlocks = vi.fn(async () => [toolResultBlock] as const);

		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'stop',
									message: {
										content: 'Hello over websocket',
										role: 'assistant',
									},
								},
							],
							id: 'chatcmpl_ws_tool_blocks',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					include_presentation_blocks: true,
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Hello', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_tool_blocks_1',
					trace_id: 'trace_ws_tool_blocks_1',
				},
				type: 'run.request',
			}),
			{
				getAdditionalPresentationBlocks,
				persistEvents,
			},
		);

		const messages = parseMessages(socket);

		expect(messages.map((message) => message.type)).toEqual([
			'connection.ready',
			'run.accepted',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'presentation.blocks',
			'run.finished',
		]);

		const presentationMessage = messages.find((message) => message.type === 'presentation.blocks');

		expect(presentationMessage).toBeDefined();
		expect(getAdditionalPresentationBlocks).toHaveBeenCalledTimes(1);

		if (presentationMessage?.type === 'presentation.blocks') {
			expect(presentationMessage.payload.blocks.map((block) => block.type)).toEqual([
				'status',
				'text',
				'event_list',
				'tool_result',
				'workspace_inspection_block',
				'run_timeline_block',
				'trace_debug_block',
			]);
			expect(presentationMessage.payload.blocks[3]).toEqual(toolResultBlock);
			expect(presentationMessage.payload.blocks[6]).toMatchObject({
				payload: {
					run_state: 'COMPLETED',
					summary: 'Run completed after tool execution.',
					title: 'Trace / Debug',
					tool_chain_summary: 'Tool chain: File read.',
				},
				type: 'trace_debug_block',
			});
		}
	});

	it('sends real runtime approval request and resolution visibility through the existing presentation.blocks message', async () => {
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const approvalStore = createApprovalStore();
		const pendingApprovalResult = requestApproval({
			call_id: 'call_ws_pending_1',
			current_state: 'MODEL_THINKING',
			event_context: {
				sequence_no: 1,
				timestamp: '2026-04-10T20:30:00.000Z',
			},
			run_id: 'run_ws_pending_1',
			summary: 'Shell command needs approval.',
			title: 'Approve shell command',
			tool_definition: shellExecTool,
			trace_id: 'trace_ws_pending_1',
		});
		const resolvedApprovalRequestResult = requestApproval({
			call_id: 'call_ws_resolved_1',
			current_state: 'MODEL_THINKING',
			event_context: {
				sequence_no: 2,
				timestamp: '2026-04-10T20:35:00.000Z',
			},
			run_id: 'run_ws_resolved_1',
			summary: 'Write changes to src/app.ts',
			title: 'Approve file write',
			tool_definition: fileWriteTool,
			trace_id: 'trace_ws_resolved_1',
		});

		expect(pendingApprovalResult.status).toBe('approval_required');
		expect(resolvedApprovalRequestResult.status).toBe('approval_required');

		if (
			pendingApprovalResult.status !== 'approval_required' ||
			resolvedApprovalRequestResult.status !== 'approval_required'
		) {
			throw new Error('Expected real approval request results for ws visibility test.');
		}

		const resolvedApprovalResult = resolveApproval({
			approval_request: resolvedApprovalRequestResult.approval_request,
			current_state: 'WAITING_APPROVAL',
			decision: 'approved',
			event_context: {
				sequence_no: 3,
				timestamp: '2026-04-10T20:36:00.000Z',
			},
			note: 'Approved by reviewer',
			run_id: 'run_ws_resolved_1',
			trace_id: 'trace_ws_resolved_1',
		});

		expect(resolvedApprovalResult.status).toBe('approved');

		if (resolvedApprovalResult.status !== 'approved') {
			throw new Error('Expected approval resolution to succeed for ws visibility test.');
		}

		const getApprovalPresentationInputs = vi.fn(
			async () =>
				[
					{
						kind: 'request_result',
						result: pendingApprovalResult,
					},
					{
						approval_request: resolvedApprovalRequestResult.approval_request,
						kind: 'resolution_result',
						result: resolvedApprovalResult,
					},
				] as const,
		);

		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'stop',
									message: {
										content: 'Hello over websocket',
										role: 'assistant',
									},
								},
							],
							id: 'chatcmpl_ws_approval_blocks',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					include_presentation_blocks: true,
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Hello', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_approval_blocks_1',
					trace_id: 'trace_ws_approval_blocks_1',
				},
				type: 'run.request',
			}),
			{
				approvalStore: approvalStore.store,
				getApprovalPresentationInputs,
				persistEvents,
			},
		);

		const messages = parseMessages(socket);
		const presentationMessage = messages.find((message) => message.type === 'presentation.blocks');

		expect(messages.map((message) => message.type)).toEqual([
			'connection.ready',
			'run.accepted',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'presentation.blocks',
			'run.finished',
		]);
		expect(getApprovalPresentationInputs).toHaveBeenCalledTimes(1);
		expect(approvalStore.persistApprovalRequestMock).toHaveBeenCalledTimes(1);
		expect(approvalStore.persistApprovalResolutionMock).toHaveBeenCalledTimes(1);
		expect(presentationMessage).toBeDefined();

		if (presentationMessage?.type === 'presentation.blocks') {
			expect(presentationMessage.payload.blocks.map((block) => block.type)).toEqual([
				'status',
				'text',
				'event_list',
				'approval_block',
				'approval_block',
				'workspace_inspection_block',
				'run_timeline_block',
				'trace_debug_block',
			]);
			expect(presentationMessage.payload.blocks[3]).toMatchObject({
				created_at: '2026-04-10T20:30:00.000Z',
				payload: {
					action_kind: 'shell_execution',
					approval_id: pendingApprovalResult.approval_request.approval_id,
					call_id: 'call_ws_pending_1',
					status: 'pending',
					summary: 'Shell command needs approval.',
					title: 'Approve shell command',
					tool_name: 'shell.exec',
				},
				type: 'approval_block',
			});
			expect(presentationMessage.payload.blocks[4]).toMatchObject({
				created_at: '2026-04-10T20:36:00.000Z',
				payload: {
					action_kind: 'file_write',
					approval_id: resolvedApprovalRequestResult.approval_request.approval_id,
					call_id: 'call_ws_resolved_1',
					decision: 'approved',
					note: 'Approved by reviewer',
					status: 'approved',
					summary: 'Write changes to src/app.ts',
					title: 'Approve file write',
					tool_name: 'file.write',
				},
				type: 'approval_block',
			});
			expect(presentationMessage.payload.blocks[6]).toMatchObject({
				payload: {
					summary: 'Timeline shows approval resolution for file write, then assistant completion.',
					title: 'Run Timeline',
				},
				type: 'run_timeline_block',
			});
			expect(presentationMessage.payload.blocks[7]).toMatchObject({
				payload: {
					approval_summary: 'Approval granted for file write.',
					debug_notes: expect.arrayContaining([
						'Workspace context prepared.',
						expect.stringContaining('Context accounting:'),
						expect.stringContaining('Model usage: request'),
					]),
					run_state: 'COMPLETED',
					summary: 'Run completed without tool use.',
					title: 'Trace / Debug',
				},
				type: 'trace_debug_block',
			});
			expect(
				presentationMessage.payload.blocks[6]?.type === 'run_timeline_block'
					? presentationMessage.payload.blocks[6].payload.items
					: [],
			).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						kind: 'approval_requested',
						label: 'Approval requested for shell.exec',
						state: 'pending',
						tool_name: 'shell.exec',
					}),
					expect.objectContaining({
						kind: 'approval_resolved',
						label: 'Approval approved for file.write',
						state: 'approved',
						tool_name: 'file.write',
					}),
				]),
			);
		}
	});

	it('maps a real runtime tool result into presentation.blocks through the ws visibility seam', async () => {
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const registry = new ToolRegistry();
		const runtimeToolResult: ToolResult = {
			call_id: 'call_ws_real_tool_1',
			output: {
				content: 'console.log("hello");',
				path: 'src/example.ts',
			},
			status: 'success',
			tool_name: 'file.read',
		};

		registry.register(createFakeTool('file.read', async () => runtimeToolResult));

		const runToolResult = await runToolStep({
			current_state: 'MODEL_THINKING',
			execution_context: {
				run_id: 'run_ws_real_tool_1',
				trace_id: 'trace_ws_real_tool_1',
				working_directory: 'd:\\ai\\Runa',
			},
			registry,
			run_id: 'run_ws_real_tool_1',
			tool_input: {
				arguments: {
					path: 'src/example.ts',
				},
				call_id: 'call_ws_real_tool_1',
				tool_name: 'file.read',
			},
			tool_name: 'file.read',
			trace_id: 'trace_ws_real_tool_1',
		});

		expect(runToolResult.status).toBe('completed');

		if (runToolResult.status !== 'completed') {
			throw new Error('Expected runToolStep to complete for ws visibility test.');
		}

		const ingestedToolResult = ingestToolResult({
			call_id: 'call_ws_real_tool_1',
			current_state: runToolResult.final_state,
			run_id: 'run_ws_real_tool_1',
			tool_name: 'file.read',
			tool_result: runToolResult.tool_result,
			trace_id: 'trace_ws_real_tool_1',
		});

		expect(ingestedToolResult.status).toBe('completed');

		if (ingestedToolResult.status !== 'completed') {
			throw new Error('Expected ingestToolResult to complete for ws visibility test.');
		}

		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'stop',
									message: {
										content: 'Hello over websocket',
										role: 'assistant',
									},
								},
							],
							id: 'chatcmpl_ws_real_tool_blocks',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					include_presentation_blocks: true,
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Hello', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_real_tool_blocks_1',
					trace_id: 'trace_ws_real_tool_blocks_1',
				},
				type: 'run.request',
			}),
			{
				getToolResultPresentationInputs: async () => [
					{
						call_id: ingestedToolResult.call_id,
						created_at: runToolResult.events[1]?.timestamp ?? '2026-04-10T12:00:00.000Z',
						result: ingestedToolResult.ingested_result,
						tool_name: ingestedToolResult.tool_name,
					},
				],
				persistEvents,
			},
		);

		const messages = parseMessages(socket);
		const presentationMessage = messages.find((message) => message.type === 'presentation.blocks');

		expect(messages.map((message) => message.type)).toEqual([
			'connection.ready',
			'run.accepted',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'presentation.blocks',
			'run.finished',
		]);
		expect(presentationMessage).toBeDefined();

		if (presentationMessage?.type === 'presentation.blocks') {
			expect(presentationMessage.payload.blocks.map((block) => block.type)).toEqual([
				'status',
				'text',
				'event_list',
				'tool_result',
				'code_block',
				'workspace_inspection_block',
				'run_timeline_block',
				'trace_debug_block',
			]);
			expect(presentationMessage.payload.blocks[3]).toMatchObject({
				payload: {
					call_id: 'call_ws_real_tool_1',
					result_preview: {
						kind: 'object',
						summary_text: 'Object{content, path}',
					},
					status: 'success',
					summary: 'file.read completed successfully.',
					tool_name: 'file.read',
				},
				type: 'tool_result',
			});
			expect(presentationMessage.payload.blocks[4]).toMatchObject({
				payload: {
					content: 'console.log("hello");',
					diff_kind: 'after',
					language: 'typescript',
					path: 'src/example.ts',
					summary: 'Code preview from src/example.ts',
					title: 'src/example.ts',
				},
				type: 'code_block',
			});
		}
	});

	it('adds a diff_block alongside tool_result for git.diff visibility', async () => {
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});

		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'stop',
									message: {
										content: 'Hello over websocket',
										role: 'assistant',
									},
								},
							],
							id: 'chatcmpl_ws_diff_blocks',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					include_presentation_blocks: true,
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Hello', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_diff_blocks_1',
					trace_id: 'trace_ws_diff_blocks_1',
				},
				type: 'run.request',
			}),
			{
				getToolResultPresentationInputs: async () => [
					{
						call_id: 'call_ws_diff_1',
						created_at: '2026-04-11T12:00:00.000Z',
						result: {
							call_id: 'call_ws_diff_1',
							output: {
								changed_paths: ['src/example.ts'],
								diff_text: '@@ -1 +1 @@\n-old\n+new\n... [truncated]',
								is_truncated: true,
								working_directory: 'd:\\ai\\Runa',
							},
							status: 'success',
							tool_name: 'git.diff',
						},
						tool_name: 'git.diff',
					},
				],
				persistEvents,
			},
		);

		const messages = parseMessages(socket);
		const presentationMessage = messages.find((message) => message.type === 'presentation.blocks');

		expect(messages.map((message) => message.type)).toEqual([
			'connection.ready',
			'run.accepted',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'presentation.blocks',
			'run.finished',
		]);
		expect(presentationMessage).toBeDefined();

		if (presentationMessage?.type === 'presentation.blocks') {
			expect(presentationMessage.payload.blocks.map((block) => block.type)).toEqual([
				'status',
				'text',
				'event_list',
				'tool_result',
				'diff_block',
				'workspace_inspection_block',
				'run_timeline_block',
				'trace_debug_block',
			]);
			expect(presentationMessage.payload.blocks[3]).toMatchObject({
				payload: {
					call_id: 'call_ws_diff_1',
					result_preview: {
						kind: 'object',
						summary_text: 'Object{changed_paths, diff_text, is_truncated}, +1 more',
					},
					status: 'success',
					summary: 'git.diff completed successfully.',
					tool_name: 'git.diff',
				},
				type: 'tool_result',
			});
			expect(presentationMessage.payload.blocks[4]).toMatchObject({
				payload: {
					changed_paths: ['src/example.ts'],
					diff_text: '@@ -1 +1 @@\n-old\n+new\n... [truncated]',
					is_truncated: true,
					path: 'src/example.ts',
					summary: 'Diff preview for 1 changed path.',
					title: 'src/example.ts',
				},
				type: 'diff_block',
			});
		}
	});

	it('routes a live run.request tool call through the tool-aware runtime chain', async () => {
		await withTempDirectory(async (directory) => {
			const socket = new MockSocket();
			const policyWiring = await enableAutoContinueForSocket(socket);
			const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
			const registry = new ToolRegistry();
			const filePath = join(directory, 'example.ts');
			const fetchResponses = [
				new Response(
					JSON.stringify({
						choices: [
							{
								finish_reason: 'tool_calls',
								message: {
									role: 'assistant',
									tool_calls: [
										{
											function: {
												arguments: {
													path: filePath,
												},
												name: 'file.read',
											},
											id: 'call_ws_live_tool_call_1',
											type: 'function',
										},
									],
								},
							},
						],
						id: 'chatcmpl_ws_live_tool_call',
						model: 'llama-3.3-70b-versatile',
						usage: {
							completion_tokens: 12,
							prompt_tokens: 8,
							total_tokens: 20,
						},
					}),
					{
						headers: {
							'content-type': 'application/json',
						},
						status: 200,
					},
				),
				createGroqAssistantResponse({
					content: 'File contents gathered.',
					response_id: 'chatcmpl_ws_live_tool_call_2',
				}),
			];
			let requestedToolNames: readonly string[] = [];

			registry.register(fileReadTool);
			await writeFile(filePath, 'export const value = 1;\n', 'utf8');

			attachRuntimeWebSocketHandler(socket);

			vi.stubGlobal(
				'fetch',
				vi.fn(async (_input, init) => {
					if (init && typeof init === 'object' && 'body' in init && typeof init.body === 'string') {
						requestedToolNames = parseToolNamesFromRequestBody(init.body);
					}

					const nextResponse = fetchResponses.shift();

					if (!nextResponse) {
						throw new Error('Unexpected fetch call in tool-aware runtime chain test.');
					}

					return nextResponse;
				}),
			);

			await handleWebSocketMessage(
				socket,
				JSON.stringify({
					payload: {
						include_presentation_blocks: true,
						provider: 'groq',
						provider_config: {
							apiKey: 'groq-key',
						},
						request: {
							max_output_tokens: 64,
							messages: [{ content: 'Show me the file', role: 'user' }],
							model: 'llama-3.3-70b-versatile',
						},
						run_id: 'run_ws_live_tool_call_1',
						trace_id: 'trace_ws_live_tool_call_1',
					},
					type: 'run.request',
				}),
				{
					persistEvents,
					policy_wiring: policyWiring,
					toolRegistry: registry,
				},
			);

			const messages = parseMessages(socket);
			const presentationMessages = messages.filter(
				(
					message,
				): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
					message.type === 'presentation.blocks',
			);
			const incrementalPresentationMessage = presentationMessages[0];
			const presentationMessage = presentationMessages[presentationMessages.length - 1];
			const runtimeEventMessages = messages.filter(
				(message): message is Extract<WebSocketServerBridgeMessage, { type: 'runtime.event' }> =>
					message.type === 'runtime.event',
			);

			expect(messages.map((message) => message.type)).toEqual([
				'connection.ready',
				'run.accepted',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'presentation.blocks',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'presentation.blocks',
				'run.finished',
			]);
			expect(runtimeEventMessages.map((message) => message.payload.event.event_type)).toEqual([
				'run.started',
				'state.entered',
				'model.completed',
				'state.entered',
				'state.entered',
				'state.entered',
				'model.completed',
				'state.entered',
				'run.completed',
			]);
			expect(requestedToolNames).toEqual([
				'desktop.verify_state',
				'desktop.vision_analyze',
				'file.read',
			]);
			expect(persistEvents).toHaveBeenCalledTimes(1);
			expect(persistEvents.mock.calls[0]?.[0].map((event) => event.event_type)).toEqual([
				'run.started',
				'state.entered',
				'model.completed',
				'state.entered',
				'state.entered',
				'state.entered',
				'model.completed',
				'state.entered',
				'run.completed',
			]);
			expect(presentationMessages).toHaveLength(2);

			if (incrementalPresentationMessage?.type === 'presentation.blocks') {
				expect(incrementalPresentationMessage.payload.blocks.map((block) => block.type)).toEqual([
					'tool_result',
					'code_block',
				]);
			}

			if (presentationMessage?.type === 'presentation.blocks') {
				expect(presentationMessage.payload.blocks.map((block) => block.type)).toEqual([
					'status',
					'text',
					'event_list',
					'tool_result',
					'code_block',
					'workspace_inspection_block',
					'run_timeline_block',
					'trace_debug_block',
				]);
				expect(presentationMessage.payload.blocks[3]).toMatchObject({
					payload: {
						call_id: 'call_ws_live_tool_call_1',
						status: 'success',
						summary: 'file.read completed successfully.',
						tool_name: 'file.read',
					},
					type: 'tool_result',
				});
				expect(presentationMessage.payload.blocks[4]).toMatchObject({
					payload: {
						content: 'export const value = 1;\n',
						language: 'typescript',
						path: filePath,
					},
					type: 'code_block',
				});
				expect(presentationMessage.payload.blocks[6]).toMatchObject({
					type: 'run_timeline_block',
				});
				expect(
					presentationMessage.payload.blocks[6]?.type === 'run_timeline_block'
						? presentationMessage.payload.blocks[6].payload.items
						: [],
				).toEqual([
					{
						kind: 'run_started',
						label: 'Run started',
					},
					{
						detail: 'groq / llama-3.3-70b-versatile',
						kind: 'model_completed',
						label: 'Model planned the next step',
						state: 'completed',
					},
					{
						call_id: 'call_ws_live_tool_call_1',
						detail: 'file.read completed successfully.',
						kind: 'tool_completed',
						label: 'Read file contents',
						state: 'success',
						tool_name: 'file.read',
					},
					{
						kind: 'assistant_completed',
						label: 'Assistant finished the turn',
						state: 'completed',
					},
				]);
			}
		});
	});

	it('continues a desktop vision loop through approval replay and verify_state', async () => {
		const socket = new MockSocket();
		const policyWiring = await enableAutoContinueForSocket(socket);
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const approvalStore = createApprovalStore();
		const registry = new ToolRegistry();
		const pngBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 118, 105, 115, 105, 111, 110]);
		const pngBase64 = pngBytes.toString('base64');
		const requestBodies: Array<{
			readonly messages?: ReadonlyArray<{
				readonly content?: unknown;
			}>;
			readonly tools?: unknown;
		}> = [];
		const fetchResponses = [
			createGroqToolCallResponse({
				arguments: {},
				call_id: 'call_vision_loop_before_screenshot',
				response_id: 'chatcmpl_vision_loop_1',
				tool_name: 'desktop.screenshot',
			}),
			createGroqToolCallResponse({
				arguments: {
					screenshot_call_id: 'call_vision_loop_before_screenshot',
					task: 'Click the Settings button',
				},
				call_id: 'call_vision_loop_analyze',
				response_id: 'chatcmpl_vision_loop_2',
				tool_name: 'desktop.vision_analyze',
			}),
			createGroqAssistantResponse({
				content: JSON.stringify({
					element_description: 'Settings button',
					reasoning_summary: 'The Settings button is visible in the toolbar.',
					requires_user_confirmation: false,
					visibility: 'visible',
					x: 320,
					y: 240,
				}),
				response_id: 'chatcmpl_vision_loop_analyze_model',
			}),
			createGroqToolCallResponse({
				arguments: {
					x: 320,
					y: 240,
				},
				call_id: 'call_vision_loop_click',
				response_id: 'chatcmpl_vision_loop_3',
				tool_name: 'desktop.click',
			}),
			createGroqToolCallResponse({
				arguments: {},
				call_id: 'call_vision_loop_after_screenshot',
				response_id: 'chatcmpl_vision_loop_4',
				tool_name: 'desktop.screenshot',
			}),
			createGroqToolCallResponse({
				arguments: {
					after_screenshot_call_id: 'call_vision_loop_after_screenshot',
					before_screenshot_call_id: 'call_vision_loop_before_screenshot',
					expected_change: 'Settings panel is open',
				},
				call_id: 'call_vision_loop_verify',
				response_id: 'chatcmpl_vision_loop_5',
				tool_name: 'desktop.verify_state',
			}),
			createGroqAssistantResponse({
				content: JSON.stringify({
					needs_retry: false,
					needs_user_help: false,
					observed_change: 'The Settings panel is open.',
					verified: true,
				}),
				response_id: 'chatcmpl_vision_loop_verify_model',
			}),
			createGroqAssistantResponse({
				content: 'Verified: the Settings panel is open.',
				response_id: 'chatcmpl_vision_loop_6',
			}),
		];

		registry.register(
			createFakeTool(
				'desktop.screenshot',
				async (input) => ({
					call_id: input.call_id,
					output: {
						base64_data: pngBase64,
						byte_length: pngBytes.byteLength,
						format: 'png',
						mime_type: 'image/png',
					},
					status: 'success',
					tool_name: 'desktop.screenshot',
				}),
				{
					capability_class: 'desktop',
					requires_approval: false,
					risk_level: 'low',
					side_effect_level: 'read',
				},
			),
		);
		registry.register(
			createFakeTool(
				'desktop.click',
				async (input) => ({
					call_id: input.call_id,
					output: {
						clicked: true,
						position: input.arguments,
					},
					status: 'success',
					tool_name: 'desktop.click',
				}),
				{
					capability_class: 'desktop',
					requires_approval: true,
					risk_level: 'high',
					side_effect_level: 'execute',
				},
			),
		);
		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(async (_input, init) => {
				if (init && typeof init === 'object' && 'body' in init && typeof init.body === 'string') {
					requestBodies.push(
						JSON.parse(init.body) as {
							readonly messages?: ReadonlyArray<{
								readonly content?: unknown;
							}>;
							readonly tools?: unknown;
						},
					);
				}

				const nextResponse = fetchResponses.shift();

				if (!nextResponse) {
					throw new Error('Unexpected fetch call in desktop vision loop test.');
				}

				return nextResponse;
			}),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					include_presentation_blocks: true,
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Open Settings using the desktop', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_desktop_vision_loop_1',
					trace_id: 'trace_ws_desktop_vision_loop_1',
				},
				type: 'run.request',
			}),
			{
				approvalStore: approvalStore.store,
				persistEvents,
				policy_wiring: policyWiring,
				toolRegistry: registry,
			},
		);

		const initialMessages = parseMessages(socket);
		const initialApprovalBlock = initialMessages
			.flatMap((message) => (message.type === 'presentation.blocks' ? message.payload.blocks : []))
			.find(
				(block): block is Extract<RenderBlock, { type: 'approval_block' }> =>
					block.type === 'approval_block' && block.payload.tool_name === 'desktop.click',
			);

		if (!initialApprovalBlock) {
			throw new Error('Expected desktop click approval before continuing the vision loop.');
		}

		const persistedDesktopApproval = approvalStore.persistApprovalRequestMock.mock.calls
			.map((call): PersistApprovalRequestInput => call[0] as PersistApprovalRequestInput)
			.find((input) => input.approval_request.tool_name === 'desktop.click');

		expect(
			persistedDesktopApproval?.auto_continue_context?.tool_result_history?.map(
				(toolResult) => toolResult.call_id,
			),
		).toEqual(['call_vision_loop_before_screenshot', 'call_vision_loop_analyze']);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					approval_id: initialApprovalBlock.payload.approval_id,
					decision: 'approved',
					note: 'Click approved for vision loop test',
				},
				type: 'approval.resolve',
			}),
			{
				approvalStore: approvalStore.store,
				persistEvents,
				policy_wiring: policyWiring,
				toolRegistry: registry,
			},
		);

		const finalMessages = parseMessages(socket);
		const finishedMessage = finalMessages
			.filter(
				(message): message is Extract<WebSocketServerBridgeMessage, { type: 'run.finished' }> =>
					message.type === 'run.finished',
			)
			.at(-1);
		const toolResultBlocks = finalMessages
			.flatMap((message) => (message.type === 'presentation.blocks' ? message.payload.blocks : []))
			.filter(
				(block): block is Extract<RenderBlock, { type: 'tool_result' }> =>
					block.type === 'tool_result',
			);
		const hasImageAttachmentRequest = requestBodies.some((body) =>
			(body.messages ?? []).some(
				(message) =>
					Array.isArray(message.content) &&
					message.content.some((part) => {
						if (typeof part !== 'object' || part === null || Array.isArray(part)) {
							return false;
						}

						const candidate = part as {
							readonly image_url?: unknown;
							readonly type?: unknown;
						};

						return candidate.type === 'image_url' && typeof candidate.image_url === 'object';
					}),
			),
		);

		expect(finishedMessage).toMatchObject({
			payload: {
				final_state: 'COMPLETED',
				status: 'completed',
			},
			type: 'run.finished',
		});
		expect(toolResultBlocks.map((block) => block.payload.tool_name)).toEqual(
			expect.arrayContaining([
				'desktop.screenshot',
				'desktop.vision_analyze',
				'desktop.click',
				'desktop.verify_state',
			]),
		);
		expect(hasImageAttachmentRequest).toBe(true);
		expect(fetchResponses).toHaveLength(0);
	});

	it('keeps multi-tool read batches deterministic even when parallel completions finish out of order', async () => {
		const socket = new MockSocket();
		const policyWiring = await enableAutoContinueForSocket(socket);
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const registry = new ToolRegistry();
		const requestBodies: string[] = [];

		registry.register(
			createFakeTool(
				'file.read',
				async (input) => {
					await new Promise((resolve) => setTimeout(resolve, 10));

					return {
						call_id: input.call_id,
						output: {
							content: 'alpha file contents',
						},
						status: 'success',
						tool_name: 'file.read',
					};
				},
				{
					requires_approval: false,
					risk_level: 'low',
					side_effect_level: 'read',
				},
			),
		);
		registry.register(
			createFakeTool(
				'web.search',
				async (input) => ({
					call_id: input.call_id,
					output: {
						query: 'latest docs',
						results: ['doc result'],
					},
					status: 'success',
					tool_name: 'web.search',
				}),
				{
					capability_class: 'search',
					requires_approval: false,
					risk_level: 'low',
					side_effect_level: 'read',
				},
			),
		);

		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(async (_input, init) => {
				if (init && typeof init === 'object' && 'body' in init && typeof init.body === 'string') {
					requestBodies.push(init.body);
				}

				if (requestBodies.length === 1) {
					return createGroqMultiToolCallResponse({
						response_id: 'chatcmpl_ws_parallel_tools_1',
						tool_calls: [
							{
								arguments: {
									path: 'docs/alpha.md',
								},
								call_id: 'call_ws_parallel_file_read',
								tool_name: 'file.read',
							},
							{
								arguments: {
									query: 'latest docs',
								},
								call_id: 'call_ws_parallel_web_search',
								tool_name: 'web.search',
							},
						],
					});
				}

				if (requestBodies.length === 2) {
					return createGroqAssistantResponse({
						content: 'I checked the file and the web results.',
						response_id: 'chatcmpl_ws_parallel_tools_2',
					});
				}

				throw new Error('Unexpected fetch call in parallel tool scheduler test.');
			}),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Read the file and search the web', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_parallel_tools_1',
					trace_id: 'trace_ws_parallel_tools_1',
				},
				type: 'run.request',
			}),
			{
				approvalStore: createApprovalStore().store,
				persistEvents,
				policy_wiring: policyWiring,
				toolRegistry: registry,
			},
		);

		expect(requestBodies).toHaveLength(2);

		const continuationMessages = parseGroqMessagesFromRequestBody(requestBodies[1] ?? '');
		const continuationUserMessage = continuationMessages.at(-1);

		expect(continuationUserMessage).toMatchObject({
			role: 'user',
		});
		expect(continuationUserMessage?.content).toContain('[1] file.read (succeeded)');
		expect(continuationUserMessage?.content).toContain('[2] web.search (succeeded)');
		expect(continuationUserMessage?.content.indexOf('[1] file.read')).toBeLessThan(
			continuationUserMessage?.content.indexOf('[2] web.search') ?? Number.POSITIVE_INFINITY,
		);
	});

	it('stops later multi-tool candidates behind approval and replays only the approved tool after approval.resolve', async () => {
		const socket = new MockSocket();
		const policyWiring = await enableAutoContinueForSocket(socket);
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const approvalStore = createApprovalStore();
		const registry = new ToolRegistry();
		const executeCounts = {
			file_read: 0,
			file_write: 0,
			web_search: 0,
		};

		registry.register(
			createFakeTool(
				'file.read',
				async (input) => {
					executeCounts.file_read += 1;

					return {
						call_id: input.call_id,
						output: {
							content: 'prefetched file',
						},
						status: 'success',
						tool_name: 'file.read',
					};
				},
				{
					requires_approval: false,
					risk_level: 'low',
					side_effect_level: 'read',
				},
			),
		);
		registry.register(
			createFakeTool(
				'file.write',
				async (input) => {
					executeCounts.file_write += 1;
					const toolArguments = input.arguments as {
						readonly path?: string;
					};

					return {
						call_id: input.call_id,
						output: {
							path: toolArguments.path,
							written: true,
						},
						status: 'success',
						tool_name: 'file.write',
					};
				},
				{
					requires_approval: true,
					risk_level: 'medium',
					side_effect_level: 'write',
				},
			),
		);
		registry.register(
			createFakeTool(
				'web.search',
				async (input) => {
					executeCounts.web_search += 1;

					return {
						call_id: input.call_id,
						output: {
							results: ['should not run before approval'],
						},
						status: 'success',
						tool_name: 'web.search',
					};
				},
				{
					capability_class: 'search',
					requires_approval: false,
					risk_level: 'low',
					side_effect_level: 'read',
				},
			),
		);

		attachRuntimeWebSocketHandler(socket);

		let fetchCount = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				fetchCount += 1;

				if (fetchCount === 1) {
					return createGroqMultiToolCallResponse({
						response_id: 'chatcmpl_ws_parallel_approval_1',
						tool_calls: [
							{
								arguments: {
									path: 'docs/context.md',
								},
								call_id: 'call_ws_parallel_approval_read',
								tool_name: 'file.read',
							},
							{
								arguments: {
									content: 'approved content',
									path: 'docs/output.md',
								},
								call_id: 'call_ws_parallel_approval_write',
								tool_name: 'file.write',
							},
							{
								arguments: {
									query: 'should wait',
								},
								call_id: 'call_ws_parallel_approval_search',
								tool_name: 'web.search',
							},
						],
					});
				}

				if (fetchCount === 2) {
					return createGroqAssistantResponse({
						content: 'Approved tool executed; no further queued tool was replayed automatically.',
						response_id: 'chatcmpl_ws_parallel_approval_2',
					});
				}

				throw new Error('Unexpected fetch call in parallel approval scheduler test.');
			}),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					include_presentation_blocks: true,
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Read, then write, then maybe search', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_parallel_approval_1',
					trace_id: 'trace_ws_parallel_approval_1',
				},
				type: 'run.request',
			}),
			{
				approvalStore: approvalStore.store,
				persistEvents,
				policy_wiring: policyWiring,
				toolRegistry: registry,
			},
		);

		expect(executeCounts).toEqual({
			file_read: 1,
			file_write: 0,
			web_search: 0,
		});

		const pendingApproval = approvalStore.persistApprovalRequestMock.mock.calls
			.map((call): PersistApprovalRequestInput => call[0] as PersistApprovalRequestInput)
			.find((call) => call.approval_request.tool_name === 'file.write');

		expect(pendingApproval?.approval_request.call_id).toBe('call_ws_parallel_approval_write');

		const approvalMessage = parseMessages(socket)
			.flatMap((message) => (message.type === 'presentation.blocks' ? message.payload.blocks : []))
			.find(
				(block): block is Extract<RenderBlock, { type: 'approval_block' }> =>
					block.type === 'approval_block' && block.payload.tool_name === 'file.write',
			);

		if (!approvalMessage) {
			throw new Error('Expected file.write approval block in parallel approval scheduler test.');
		}

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					approval_id: approvalMessage.payload.approval_id,
					decision: 'approved',
				},
				type: 'approval.resolve',
			}),
			{
				approvalStore: approvalStore.store,
				persistEvents,
				policy_wiring: policyWiring,
				toolRegistry: registry,
			},
		);

		expect(executeCounts).toEqual({
			file_read: 1,
			file_write: 1,
			web_search: 0,
		});
	});

	it('stops a live tool-follow-up turn at approval when auto-continue remains disabled', async () => {
		await withTempDirectory(async (directory) => {
			const socket = new MockSocket();
			const approvalStore = createApprovalStore();
			const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
			const registry = new ToolRegistry();
			const filePath = join(directory, 'example.ts');
			let fetchCallCount = 0;

			registry.register(fileReadTool);
			await writeFile(filePath, 'export const value = 1;\n', 'utf8');

			attachRuntimeWebSocketHandler(socket);

			vi.stubGlobal(
				'fetch',
				vi.fn(async () => {
					fetchCallCount += 1;

					if (fetchCallCount !== 1) {
						throw new Error('Auto-continue-disabled flow must not request a second model turn.');
					}

					return new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'tool_calls',
									message: {
										role: 'assistant',
										tool_calls: [
											{
												function: {
													arguments: {
														path: filePath,
													},
													name: 'file.read',
												},
												id: 'call_ws_live_tool_call_auto_continue_1',
												type: 'function',
											},
										],
									},
								},
							],
							id: 'chatcmpl_ws_live_tool_call_auto_continue',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					);
				}),
			);

			await handleWebSocketMessage(
				socket,
				JSON.stringify({
					payload: {
						include_presentation_blocks: true,
						provider: 'groq',
						provider_config: {
							apiKey: 'groq-key',
						},
						request: {
							max_output_tokens: 64,
							messages: [{ content: 'Show me the file', role: 'user' }],
							model: 'llama-3.3-70b-versatile',
						},
						run_id: 'run_ws_live_tool_call_auto_continue_1',
						trace_id: 'trace_ws_live_tool_call_auto_continue_1',
					},
					type: 'run.request',
				}),
				{
					approvalStore: approvalStore.store,
					persistEvents,
					toolRegistry: registry,
				},
			);

			const messages = parseMessages(socket);
			const runtimeEventMessages = messages.filter(
				(message): message is Extract<WebSocketServerBridgeMessage, { type: 'runtime.event' }> =>
					message.type === 'runtime.event',
			);
			expect(messages.map((message) => message.type)).toContain('run.accepted');
			expect(messages.map((message) => message.type)).not.toContain('run.finished');
			expect(runtimeEventMessages.map((message) => message.payload.event.event_type)).toEqual([
				'run.started',
				'state.entered',
				'model.completed',
				'state.entered',
				'state.entered',
				'state.entered',
			]);
			expect(
				runtimeEventMessages
					.filter((message) => message.payload.event.event_type === 'state.entered')
					.map((message) =>
						message.payload.event.event_type === 'state.entered'
							? message.payload.event.payload.state
							: undefined,
					),
			).toEqual(['MODEL_THINKING', 'TOOL_EXECUTING', 'TOOL_RESULT_INGESTING', 'WAITING_APPROVAL']);
			expect(fetchCallCount).toBe(1);
		});
	});

	it('stops at approval when a live tool result fails after ingestion and auto-continue is disabled', async () => {
		await withTempDirectory(async (directory) => {
			const socket = new MockSocket();
			const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
			const registry = new ToolRegistry();
			const missingFilePath = join(directory, 'missing.ts');

			registry.register(fileReadTool);
			attachRuntimeWebSocketHandler(socket);

			vi.stubGlobal(
				'fetch',
				vi.fn(
					async () =>
						new Response(
							JSON.stringify({
								choices: [
									{
										finish_reason: 'tool_calls',
										message: {
											role: 'assistant',
											tool_calls: [
												{
													function: {
														arguments: {
															path: missingFilePath,
														},
														name: 'file.read',
													},
													id: 'call_ws_live_tool_failure_1',
													type: 'function',
												},
											],
										},
									},
								],
								id: 'chatcmpl_ws_live_tool_failure_1',
								model: 'llama-3.3-70b-versatile',
								usage: {
									completion_tokens: 12,
									prompt_tokens: 8,
									total_tokens: 20,
								},
							}),
							{
								headers: {
									'content-type': 'application/json',
								},
								status: 200,
							},
						),
				),
			);

			await handleWebSocketMessage(
				socket,
				JSON.stringify({
					payload: {
						provider: 'groq',
						provider_config: {
							apiKey: 'groq-key',
						},
						request: {
							max_output_tokens: 64,
							messages: [{ content: 'Read the missing file', role: 'user' }],
							model: 'llama-3.3-70b-versatile',
						},
						run_id: 'run_ws_live_tool_failure_1',
						trace_id: 'trace_ws_live_tool_failure_1',
					},
					type: 'run.request',
				}),
				{
					persistEvents,
					toolRegistry: registry,
				},
			);

			const messages = parseMessages(socket);
			const runtimeEvents = messages.filter(
				(message): message is Extract<WebSocketServerBridgeMessage, { type: 'runtime.event' }> =>
					message.type === 'runtime.event',
			);
			const finishedMessage = messages.find(
				(message): message is Extract<WebSocketServerBridgeMessage, { type: 'run.finished' }> =>
					message.type === 'run.finished',
			);

			expect(runtimeEvents.map((message) => message.payload.event.event_type)).toEqual([
				'run.started',
				'state.entered',
				'model.completed',
				'state.entered',
				'state.entered',
				'state.entered',
			]);
			expect(
				runtimeEvents
					.filter((message) => message.payload.event.event_type === 'state.entered')
					.map((message) =>
						message.payload.event.event_type === 'state.entered'
							? message.payload.event.payload.state
							: undefined,
					),
			).toEqual(['MODEL_THINKING', 'TOOL_EXECUTING', 'TOOL_RESULT_INGESTING', 'WAITING_APPROVAL']);
			expect(finishedMessage).toBeUndefined();
		});
	});

	it('continues a live tool-follow-up turn after approving auto-continue', async () => {
		const environment = process.env as NodeJS.ProcessEnv & {
			GROQ_API_KEY?: string;
		};
		environment.GROQ_API_KEY = 'env-groq-key';

		await withTempDirectory(async (directory) => {
			const socket = new MockSocket();
			const approvalResolveSocket = new MockSocket();
			const approvalStore = createApprovalStore();
			const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
			const persistRunState = vi.fn(async (_input: PersistRunStateInput) => {});
			const registry = new ToolRegistry();
			const filePath = join(directory, 'example.ts');
			let fetchCallCount = 0;

			registry.register(fileReadTool);
			await writeFile(filePath, 'export const value = 1;\n', 'utf8');

			attachRuntimeWebSocketHandler(socket);
			attachRuntimeWebSocketHandler(approvalResolveSocket);

			vi.stubGlobal(
				'fetch',
				vi.fn(async () => {
					fetchCallCount += 1;

					if (fetchCallCount === 1) {
						return new Response(
							JSON.stringify({
								choices: [
									{
										finish_reason: 'tool_calls',
										message: {
											role: 'assistant',
											tool_calls: [
												{
													function: {
														arguments: {
															path: filePath,
														},
														name: 'file.read',
													},
													id: 'call_ws_live_tool_call_auto_continue_resume_1',
													type: 'function',
												},
											],
										},
									},
								],
								id: 'chatcmpl_ws_live_tool_call_auto_continue_resume_1',
								model: 'llama-3.3-70b-versatile',
								usage: {
									completion_tokens: 12,
									prompt_tokens: 8,
									total_tokens: 20,
								},
							}),
							{
								headers: {
									'content-type': 'application/json',
								},
								status: 200,
							},
						);
					}

					if (fetchCallCount === 2) {
						return new Response(
							JSON.stringify({
								choices: [
									{
										finish_reason: 'stop',
										message: {
											content: 'The file exports value = 1.',
											role: 'assistant',
										},
									},
								],
								id: 'chatcmpl_ws_live_tool_call_auto_continue_resume_2',
								model: 'llama-3.3-70b-versatile',
								usage: {
									completion_tokens: 10,
									prompt_tokens: 10,
									total_tokens: 20,
								},
							}),
							{
								headers: {
									'content-type': 'application/json',
								},
								status: 200,
							},
						);
					}

					throw new Error('Expected auto-continue approval flow to finish on the second turn.');
				}),
			);

			await handleWebSocketMessage(
				socket,
				JSON.stringify({
					payload: {
						include_presentation_blocks: true,
						provider: 'groq',
						provider_config: {
							apiKey: 'groq-key',
						},
						request: {
							max_output_tokens: 64,
							messages: [{ content: 'Show me the file', role: 'user' }],
							model: 'llama-3.3-70b-versatile',
						},
						run_id: 'run_ws_live_tool_call_auto_continue_resume_1',
						trace_id: 'trace_ws_live_tool_call_auto_continue_resume_1',
					},
					type: 'run.request',
				}),
				{
					approvalStore: approvalStore.store,
					persistEvents,
					persistRunState,
					toolRegistry: registry,
				},
			);

			const pendingApprovalMessage = parseMessages(socket)
				.filter(
					(
						message,
					): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
						message.type === 'presentation.blocks',
				)
				.find((message) => message.payload.blocks.some((block) => block.type === 'approval_block'));

			if (pendingApprovalMessage?.type !== 'presentation.blocks') {
				throw new Error('Expected an auto-continue approval block before approval.resolve.');
			}

			const pendingApprovalBlock = pendingApprovalMessage.payload.blocks.find(
				(block): block is Extract<RenderBlock, { type: 'approval_block' }> =>
					block.type === 'approval_block',
			);

			if (!pendingApprovalBlock) {
				throw new Error('Expected an auto-continue approval block.');
			}

			const persistedPendingEntry = approvalStore.entries.get(
				pendingApprovalBlock.payload.approval_id,
			);

			if (!persistedPendingEntry?.auto_continue_context) {
				throw new Error('Expected persisted auto-continue context before approval.resolve.');
			}

			approvalStore.entries.set(pendingApprovalBlock.payload.approval_id, {
				...persistedPendingEntry,
				auto_continue_context: {
					...persistedPendingEntry.auto_continue_context,
					payload: {
						...persistedPendingEntry.auto_continue_context.payload,
						provider_config: {
							...persistedPendingEntry.auto_continue_context.payload.provider_config,
							apiKey: '',
						},
					},
				},
			});

			await handleWebSocketMessage(
				approvalResolveSocket,
				JSON.stringify({
					payload: {
						approval_id: pendingApprovalBlock.payload.approval_id,
						decision: 'approved',
					},
					type: 'approval.resolve',
				}),
				{
					approvalStore: approvalStore.store,
					persistEvents,
					persistRunState,
					toolRegistry: registry,
				},
			);

			const resumedMessages = parseMessages(approvalResolveSocket);
			const runtimeEventMessages = resumedMessages.filter(
				(message): message is Extract<WebSocketServerBridgeMessage, { type: 'runtime.event' }> =>
					message.type === 'runtime.event' &&
					message.payload.run_id === 'run_ws_live_tool_call_auto_continue_resume_1',
			);
			expect(fetchCallCount).toBe(2);
			expect(runtimeEventMessages.map((message) => message.payload.event.event_type)).toEqual([
				'state.entered',
				'model.completed',
				'state.entered',
				'run.completed',
			]);
			expect(
				runtimeEventMessages
					.filter((message) => message.payload.event.event_type === 'state.entered')
					.map((message) =>
						message.payload.event.event_type === 'state.entered'
							? message.payload.event.payload.state
							: undefined,
					),
			).toEqual(['MODEL_THINKING', 'COMPLETED']);
			expect(resumedMessages.map((message) => message.type)).toEqual([
				'connection.ready',
				'presentation.blocks',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'presentation.blocks',
				'presentation.blocks',
				'run.finished',
			]);
			expect(persistRunState.mock.calls).toEqual([
				[
					expect.objectContaining({
						current_state: 'WAITING_APPROVAL',
						run_id: 'run_ws_live_tool_call_auto_continue_resume_1',
						trace_id: 'trace_ws_live_tool_call_auto_continue_resume_1',
					}),
				],
				[
					expect.objectContaining({
						current_state: 'COMPLETED',
						run_id: 'run_ws_live_tool_call_auto_continue_resume_1',
						trace_id: 'trace_ws_live_tool_call_auto_continue_resume_1',
					}),
				],
			]);
		});
	});

	it('resolves git.diff from the live default registry and exposes the closure tools to the model request', async () => {
		await withTempDirectory(async (directory) => {
			const socket = new MockSocket();
			const policyWiring = await enableAutoContinueForSocket(socket);
			const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
			const filePath = join(directory, 'alpha.txt');
			const fetchResponses = [
				new Response(
					JSON.stringify({
						choices: [
							{
								finish_reason: 'tool_calls',
								message: {
									role: 'assistant',
									tool_calls: [
										{
											function: {
												arguments: {
													working_directory: directory,
												},
												name: 'git.diff',
											},
											id: 'call_ws_live_git_diff_1',
											type: 'function',
										},
									],
								},
							},
						],
						id: 'chatcmpl_ws_live_git_diff',
						model: 'llama-3.3-70b-versatile',
						usage: {
							completion_tokens: 12,
							prompt_tokens: 8,
							total_tokens: 20,
						},
					}),
					{
						headers: {
							'content-type': 'application/json',
						},
						status: 200,
					},
				),
				createGroqAssistantResponse({
					content: 'Diff inspection complete.',
					response_id: 'chatcmpl_ws_live_git_diff_2',
				}),
			];
			let requestedToolNames: readonly string[] = [];

			await runGit(['init'], directory);
			await runGit(['config', 'user.email', 'runa@example.com'], directory);
			await runGit(['config', 'user.name', 'Runa'], directory);
			await writeFile(filePath, 'alpha\n', 'utf8');
			await runGit(['add', 'alpha.txt'], directory);
			await runGit(['commit', '--quiet', '-m', 'initial'], directory);
			await writeFile(filePath, 'alpha updated\n', 'utf8');

			attachRuntimeWebSocketHandler(socket);

			vi.stubGlobal(
				'fetch',
				vi.fn(async (_input, init) => {
					if (init && typeof init === 'object' && 'body' in init && typeof init.body === 'string') {
						requestedToolNames = parseToolNamesFromRequestBody(init.body);
					}

					const nextResponse = fetchResponses.shift();

					if (!nextResponse) {
						throw new Error('Unexpected fetch call in git.diff live integration test.');
					}

					return nextResponse;
				}),
			);

			await handleWebSocketMessage(
				socket,
				JSON.stringify({
					payload: {
						include_presentation_blocks: true,
						provider: 'groq',
						provider_config: {
							apiKey: 'groq-key',
						},
						request: {
							max_output_tokens: 64,
							messages: [{ content: 'Show me the current diff', role: 'user' }],
							model: 'llama-3.3-70b-versatile',
						},
						run_id: 'run_ws_live_git_diff_1',
						trace_id: 'trace_ws_live_git_diff_1',
					},
					type: 'run.request',
				}),
				{
					persistEvents,
					policy_wiring: policyWiring,
				},
			);

			const messages = parseMessages(socket);
			const presentationMessages = messages.filter(
				(
					message,
				): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
					message.type === 'presentation.blocks',
			);
			const incrementalPresentationMessage = presentationMessages[0];
			const presentationMessage = presentationMessages[presentationMessages.length - 1];
			const runtimeEventMessages = messages.filter(
				(message): message is Extract<WebSocketServerBridgeMessage, { type: 'runtime.event' }> =>
					message.type === 'runtime.event',
			);

			expect([...requestedToolNames].sort()).toEqual([...listBuiltInToolNames()].sort());
			expect(messages.map((message) => message.type)).toEqual([
				'connection.ready',
				'run.accepted',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'presentation.blocks',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'presentation.blocks',
				'run.finished',
			]);
			expect(runtimeEventMessages.map((message) => message.payload.event.event_type)).toEqual([
				'run.started',
				'state.entered',
				'model.completed',
				'state.entered',
				'state.entered',
				'state.entered',
				'model.completed',
				'state.entered',
				'run.completed',
			]);
			expect(persistEvents).toHaveBeenCalledTimes(1);
			expect(presentationMessages).toHaveLength(2);

			if (incrementalPresentationMessage?.type === 'presentation.blocks') {
				expect(incrementalPresentationMessage.payload.blocks.map((block) => block.type)).toEqual([
					'tool_result',
					'diff_block',
				]);
			}

			if (presentationMessage?.type === 'presentation.blocks') {
				expect(presentationMessage.payload.blocks.map((block) => block.type)).toEqual([
					'status',
					'text',
					'event_list',
					'tool_result',
					'diff_block',
					'workspace_inspection_block',
					'run_timeline_block',
					'trace_debug_block',
				]);
				expect(presentationMessage.payload.blocks[3]).toMatchObject({
					payload: {
						call_id: 'call_ws_live_git_diff_1',
						status: 'success',
						summary: 'git.diff completed successfully.',
						tool_name: 'git.diff',
					},
					type: 'tool_result',
				});
				expect(presentationMessage.payload.blocks[4]).toMatchObject({
					payload: {
						changed_paths: ['alpha.txt'],
						path: 'alpha.txt',
						summary: 'Diff preview for 1 changed path.',
						title: 'alpha.txt',
					},
					type: 'diff_block',
				});
				expect(
					presentationMessage.payload.blocks[4]?.type === 'diff_block'
						? presentationMessage.payload.blocks[4].payload.diff_text
						: '',
				).toContain('alpha updated');
			}
		});
	});

	it('resolves search.codebase from the live default registry and emits tool_result plus search_result_block on run.request', async () => {
		await withWorkspaceTempDirectory(async (directory) => {
			const socket = new MockSocket();
			const policyWiring = await enableAutoContinueForSocket(socket);
			const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
			const executeSpy = vi.spyOn(searchCodebaseTool, 'execute');
			const workspaceRelativePath = relative(getLiveWorkingDirectory(), directory);
			const filePath = join(directory, 'match.ts');
			const query = 'search_codebase_live_needle_66';

			await writeFile(filePath, `const marker = '${query}';\n`, 'utf8');

			attachRuntimeWebSocketHandler(socket);

			vi.stubGlobal(
				'fetch',
				vi.fn(async () => {
					const nextResponse =
						executeSpy.mock.calls.length === 0
							? new Response(
									JSON.stringify({
										choices: [
											{
												finish_reason: 'tool_calls',
												message: {
													role: 'assistant',
													tool_calls: [
														{
															function: {
																arguments: {
																	query,
																	working_directory: workspaceRelativePath,
																},
																name: 'search.codebase',
															},
															id: 'call_ws_live_search_codebase_1',
															type: 'function',
														},
													],
												},
											},
										],
										id: 'chatcmpl_ws_live_search_codebase',
										model: 'llama-3.3-70b-versatile',
										usage: {
											completion_tokens: 12,
											prompt_tokens: 8,
											total_tokens: 20,
										},
									}),
									{
										headers: {
											'content-type': 'application/json',
										},
										status: 200,
									},
								)
							: createGroqAssistantResponse({
									content: 'Search complete.',
									response_id: 'chatcmpl_ws_live_search_codebase_2',
								});

					return nextResponse;
				}),
			);

			await handleWebSocketMessage(
				socket,
				JSON.stringify({
					payload: {
						include_presentation_blocks: true,
						provider: 'groq',
						provider_config: {
							apiKey: 'groq-key',
						},
						request: {
							max_output_tokens: 64,
							messages: [{ content: 'Search the codebase for the marker', role: 'user' }],
							model: 'llama-3.3-70b-versatile',
						},
						run_id: 'run_ws_live_search_codebase_1',
						trace_id: 'trace_ws_live_search_codebase_1',
					},
					type: 'run.request',
				}),
				{
					persistEvents,
					policy_wiring: policyWiring,
				},
			);

			const messages = parseMessages(socket);
			const presentationMessages = messages.filter(
				(
					message,
				): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
					message.type === 'presentation.blocks',
			);
			const incrementalPresentationMessage = presentationMessages[0];
			const presentationMessage = presentationMessages[presentationMessages.length - 1];
			const runtimeEventMessages = messages.filter(
				(message): message is Extract<WebSocketServerBridgeMessage, { type: 'runtime.event' }> =>
					message.type === 'runtime.event',
			);
			const executeResult = executeSpy.mock.results[0];

			expect(messages.map((message) => message.type)).toEqual([
				'connection.ready',
				'run.accepted',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'presentation.blocks',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'presentation.blocks',
				'run.finished',
			]);
			expect(runtimeEventMessages.map((message) => message.payload.event.event_type)).toEqual([
				'run.started',
				'state.entered',
				'model.completed',
				'state.entered',
				'state.entered',
				'state.entered',
				'model.completed',
				'state.entered',
				'run.completed',
			]);
			expect(executeSpy).toHaveBeenCalledTimes(1);
			expect(executeResult?.type).toBe('return');
			expect(persistEvents).toHaveBeenCalledTimes(1);
			expect(presentationMessages).toHaveLength(2);

			if (executeResult?.type !== 'return') {
				throw new Error('Expected search.codebase execution to return a tool result.');
			}

			const toolResult = await executeResult.value;

			expect(toolResult.status).toBe('success');

			if (toolResult.status !== 'success') {
				throw new Error('Expected search.codebase live integration to succeed.');
			}

			expect(toolResult.output).toEqual({
				is_truncated: false,
				matches: [
					{
						line_number: 1,
						line_text: `const marker = '${query}';`,
						path: filePath,
					},
				],
				searched_root: directory,
				total_matches: 1,
			});

			if (incrementalPresentationMessage?.type === 'presentation.blocks') {
				expect(incrementalPresentationMessage.payload.blocks.map((block) => block.type)).toEqual([
					'tool_result',
					'search_result_block',
				]);
			}

			if (presentationMessage?.type === 'presentation.blocks') {
				const workspaceContext = await composeWorkspaceContext({
					working_directory: getLiveWorkingDirectory(),
				});

				expect(workspaceContext.status).toBe('workspace_layer_created');

				if (workspaceContext.status !== 'workspace_layer_created') {
					throw new Error('Expected a workspace layer for live inspection visibility.');
				}

				expect(presentationMessage.payload.blocks.map((block) => block.type)).toEqual([
					'status',
					'text',
					'event_list',
					'tool_result',
					'search_result_block',
					'workspace_inspection_block',
					'run_timeline_block',
					'trace_debug_block',
				]);
				expect(presentationMessage.payload.blocks[3]).toMatchObject({
					payload: {
						call_id: 'call_ws_live_search_codebase_1',
						result_preview: {
							kind: 'object',
						},
						status: 'success',
						summary: 'search.codebase completed successfully.',
						tool_name: 'search.codebase',
					},
					type: 'tool_result',
				});
				expect(presentationMessage.payload.blocks[4]).toMatchObject({
					payload: {
						is_truncated: false,
						matches: [
							{
								line_number: 1,
								line_text: `const marker = '${query}';`,
								path: filePath,
							},
						],
						query,
						searched_root: directory,
						summary: `Found 1 codebase match for "${query}".`,
						title: 'Codebase Search Results',
						total_matches: 1,
					},
					type: 'search_result_block',
				});
				expect(presentationMessage.payload.blocks[5]).toMatchObject({
					payload: {
						last_search_summary: `Found 1 codebase match for "${query}".`,
						project_name: workspaceContext.workspace_layer.content.project_name,
						project_type_hints: workspaceContext.workspace_layer.content.project_type_hints.slice(
							0,
							6,
						),
						summary: workspaceContext.workspace_layer.content.summary,
						title: workspaceContext.workspace_layer.content.title,
						top_level_signals: workspaceContext.workspace_layer.content.top_level_signals.slice(
							0,
							6,
						),
					},
					type: 'workspace_inspection_block',
				});
				expect(presentationMessage.payload.blocks[6]).toMatchObject({
					payload: {
						summary: 'Timeline shows codebase search before assistant completion.',
						title: 'Run Timeline',
					},
					type: 'run_timeline_block',
				});
				expect(presentationMessage.payload.blocks[7]).toMatchObject({
					type: 'trace_debug_block',
				});
				expect(
					presentationMessage.payload.blocks[6]?.type === 'run_timeline_block'
						? presentationMessage.payload.blocks[6].payload.items
						: [],
				).toEqual([
					{
						kind: 'run_started',
						label: 'Run started',
					},
					{
						detail: 'groq / llama-3.3-70b-versatile',
						kind: 'model_completed',
						label: 'Model planned the next step',
						state: 'completed',
					},
					{
						call_id: 'call_ws_live_search_codebase_1',
						detail: `Found 1 codebase match for "${query}".`,
						kind: 'tool_completed',
						label: 'Searched the codebase',
						state: 'success',
						tool_name: 'search.codebase',
					},
					{
						kind: 'assistant_completed',
						label: 'Assistant finished the turn',
						state: 'completed',
					},
				]);
			}
		});
	});

	it('resolves web.search from the live default registry and emits tool_result plus web_search_result_block on run.request', async () => {
		const socket = new MockSocket();
		const policyWiring = await enableAutoContinueForSocket(socket);
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const executeSpy = vi.spyOn(webSearchTool, 'execute');
		const environment = process.env as NodeJS.ProcessEnv & {
			SERPER_API_KEY?: string;
			SERPER_ENDPOINT?: string;
		};
		const previousSerperApiKey = environment.SERPER_API_KEY;
		const previousSerperEndpoint = environment.SERPER_ENDPOINT;
		const query = 'latest runa release date';

		try {
			environment.SERPER_API_KEY = 'serper-test-key';
			environment.SERPER_ENDPOINT = 'https://serper.example/search';

			attachRuntimeWebSocketHandler(socket);

			vi.stubGlobal(
				'fetch',
				vi.fn(async (input: string | URL | Request) => {
					const url =
						typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

					if (url.includes('serper.example/search') || url.includes('serper.example/news')) {
						return new Response(
							JSON.stringify({
								news: [
									{
										date: '2 days ago',
										link: 'https://docs.example.com/releases',
										position: 1,
										snippet: 'Official release notes.',
										title: 'Release Notes',
									},
									{
										link: 'https://github.com/runa/repo/releases',
										position: 2,
										snippet: 'Repository releases.',
										title: 'GitHub Releases',
									},
								],
								organic: [
									{
										date: '2 days ago',
										link: 'https://docs.example.com/releases',
										position: 1,
										snippet: 'Official release notes.',
										title: 'Release Notes',
									},
									{
										link: 'https://github.com/runa/repo/releases',
										position: 2,
										snippet: 'Repository releases.',
										title: 'GitHub Releases',
									},
								],
							}),
							{
								headers: {
									'content-type': 'application/json',
								},
								status: 200,
							},
						);
					}

					return executeSpy.mock.calls.length === 0
						? new Response(
								JSON.stringify({
									choices: [
										{
											finish_reason: 'tool_calls',
											message: {
												role: 'assistant',
												tool_calls: [
													{
														function: {
															arguments: {
																freshness_required: true,
																query,
															},
															name: 'web.search',
														},
														id: 'call_ws_live_web_search_1',
														type: 'function',
													},
												],
											},
										},
									],
									id: 'chatcmpl_ws_live_web_search',
									model: 'llama-3.3-70b-versatile',
									usage: {
										completion_tokens: 12,
										prompt_tokens: 8,
										total_tokens: 20,
									},
								}),
								{
									headers: {
										'content-type': 'application/json',
									},
									status: 200,
								},
							)
						: createGroqAssistantResponse({
								content: 'Web search complete.',
								response_id: 'chatcmpl_ws_live_web_search_2',
							});
				}),
			);

			await handleWebSocketMessage(
				socket,
				JSON.stringify({
					payload: {
						include_presentation_blocks: true,
						provider: 'groq',
						provider_config: {
							apiKey: 'groq-key',
						},
						request: {
							max_output_tokens: 64,
							messages: [{ content: 'Find the latest public release info', role: 'user' }],
							model: 'llama-3.3-70b-versatile',
						},
						run_id: 'run_ws_live_web_search_1',
						trace_id: 'trace_ws_live_web_search_1',
					},
					type: 'run.request',
				}),
				{
					persistEvents,
					policy_wiring: policyWiring,
				},
			);

			const messages = parseMessages(socket);
			const presentationMessages = messages.filter(
				(
					message,
				): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
					message.type === 'presentation.blocks',
			);
			const incrementalPresentationMessage = presentationMessages[0];
			const presentationMessage = presentationMessages[presentationMessages.length - 1];
			const executeResult = executeSpy.mock.results[0];

			expect(messages.map((message) => message.type)).toEqual([
				'connection.ready',
				'run.accepted',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'presentation.blocks',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'presentation.blocks',
				'run.finished',
			]);
			expect(executeSpy).toHaveBeenCalledTimes(1);
			expect(executeResult?.type).toBe('return');
			expect(persistEvents).toHaveBeenCalledTimes(1);
			expect(presentationMessages).toHaveLength(2);

			if (executeResult?.type !== 'return') {
				throw new Error('Expected web.search execution to return a tool result.');
			}

			const toolResult = await executeResult.value;

			expect(toolResult.status).toBe('success');

			if (toolResult.status !== 'success') {
				throw new Error('Expected web.search live integration to succeed.');
			}

			expect(toolResult.output).toMatchObject({
				freshness_note:
					'News intent detected; recency ranking penalizes missing or stale provider dates.',
				is_truncated: false,
				search_provider: 'serper',
			});
			expect(toolResult.output.evidence).toMatchObject({
				query,
				results: 2,
				searches: 1,
				truncated: false,
			});
			expect(toolResult.output.results).toMatchObject([
				{
					canonical_url: 'https://docs.example.com/releases',
					freshness_hint: expect.any(String),
					snippet: 'Official release notes.',
					source: 'docs.example.com',
					title: 'Release Notes',
					trust_tier: 'vendor',
					url: 'https://docs.example.com/releases',
				},
				{
					freshness_hint: undefined,
					snippet: 'Repository releases.',
					source: 'github.com',
					title: 'GitHub Releases',
					trust_tier: 'vendor',
					url: 'https://github.com/runa/repo/releases',
				},
			]);

			if (incrementalPresentationMessage?.type === 'presentation.blocks') {
				expect(incrementalPresentationMessage.payload.blocks.map((block) => block.type)).toEqual([
					'tool_result',
					'web_search_result_block',
				]);
			}

			if (presentationMessage?.type === 'presentation.blocks') {
				expect(presentationMessage.payload.blocks.map((block) => block.type)).toEqual([
					'status',
					'text',
					'event_list',
					'tool_result',
					'web_search_result_block',
					'workspace_inspection_block',
					'run_timeline_block',
					'trace_debug_block',
				]);
				expect(presentationMessage.payload.blocks[3]).toMatchObject({
					payload: {
						call_id: 'call_ws_live_web_search_1',
						result_preview: {
							kind: 'object',
						},
						status: 'success',
						summary: 'web.search completed successfully.',
						tool_name: 'web.search',
					},
					type: 'tool_result',
				});
				expect(presentationMessage.payload.blocks[4]).toMatchObject({
					payload: {
						authority_note:
							'EvidenceCompiler normalized, deduplicated, trust-scored, and recency-ranked public sources before returning them to the model.',
						freshness_note:
							'News intent detected; recency ranking penalizes missing or stale provider dates.',
						evidence: {
							query,
							results: 2,
							searches: 1,
							truncated: false,
						},
						is_truncated: false,
						query,
						results: [
							{
								canonical_url: 'https://docs.example.com/releases',
								freshness_hint: expect.any(String),
								snippet: 'Official release notes.',
								source: 'docs.example.com',
								title: 'Release Notes',
								trust_tier: 'vendor',
								url: 'https://docs.example.com/releases',
							},
							{
								authority_note: 'Trust score: 0.55',
								snippet: 'Repository releases.',
								source: 'github.com',
								title: 'GitHub Releases',
								trust_tier: 'vendor',
								url: 'https://github.com/runa/repo/releases',
							},
						],
						searches: 1,
						search_provider: 'serper',
						sources: expect.any(Array),
						summary: `Found 2 web results for "${query}" from prioritized public sources.`,
						title: 'Web Search Results',
						truncated: false,
					},
					type: 'web_search_result_block',
				});
				expect(presentationMessage.payload.blocks[6]).toMatchObject({
					payload: {
						summary: 'Timeline shows public web search before assistant completion.',
					},
					type: 'run_timeline_block',
				});
				expect(presentationMessage.payload.blocks[7]).toMatchObject({
					type: 'trace_debug_block',
				});
			}
		} finally {
			if (previousSerperApiKey === undefined) {
				environment.SERPER_API_KEY = undefined;
			} else {
				environment.SERPER_API_KEY = previousSerperApiKey;
			}

			if (previousSerperEndpoint === undefined) {
				environment.SERPER_ENDPOINT = undefined;
			} else {
				environment.SERPER_ENDPOINT = previousSerperEndpoint;
			}
		}
	});

	it('adds routing and conflict notes when local and public search surfaces appear in the same run presentation', async () => {
		const socket = new MockSocket();
		const policyWiring = await enableAutoContinueForSocket(socket);
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const environment = process.env as NodeJS.ProcessEnv & {
			SERPER_API_KEY?: string;
			SERPER_ENDPOINT?: string;
		};
		const previousSerperApiKey = environment.SERPER_API_KEY;
		const previousSerperEndpoint = environment.SERPER_ENDPOINT;
		const query = 'latest runa release date';
		let modelFetchCount = 0;
		const additionalSearchBlock = mapSearchResultToBlock({
			call_id: 'call_ws_hooked_search_result_1',
			created_at: '2026-04-12T11:00:00.000Z',
			is_truncated: false,
			matches: [
				{
					line_number: 8,
					line_text: "export const lastReleaseTag = 'v0.1.0';",
					path: 'docs/releases.ts',
				},
			],
			query: 'runa release',
			searched_root: 'd:\\ai\\Runa',
			total_matches: 1,
		});

		try {
			environment.SERPER_API_KEY = 'serper-test-key';
			environment.SERPER_ENDPOINT = 'https://serper.example/search';

			attachRuntimeWebSocketHandler(socket);

			vi.stubGlobal(
				'fetch',
				vi.fn(async (input: string | URL | Request) => {
					const url =
						typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

					if (url.includes('serper.example/search')) {
						return new Response(
							JSON.stringify({
								organic: [
									{
										date: '2 days ago',
										link: 'https://docs.example.com/releases',
										position: 1,
										snippet: 'Official release notes.',
										title: 'Release Notes',
									},
								],
							}),
							{
								headers: {
									'content-type': 'application/json',
								},
								status: 200,
							},
						);
					}

					modelFetchCount += 1;

					if (modelFetchCount > 1) {
						return createGroqAssistantResponse({
							content: 'Public release notes checked against local notes.',
							response_id: 'chatcmpl_ws_live_web_search_conflict_2',
						});
					}

					return new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'tool_calls',
									message: {
										role: 'assistant',
										tool_calls: [
											{
												function: {
													arguments: {
														freshness_required: true,
														query,
													},
													name: 'web.search',
												},
												id: 'call_ws_live_web_search_conflict_1',
												type: 'function',
											},
										],
									},
								},
							],
							id: 'chatcmpl_ws_live_web_search_conflict',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					);
				}),
			);

			await handleWebSocketMessage(
				socket,
				JSON.stringify({
					payload: {
						include_presentation_blocks: true,
						provider: 'groq',
						provider_config: {
							apiKey: 'groq-key',
						},
						request: {
							max_output_tokens: 64,
							messages: [
								{ content: 'Check latest public release info against local notes', role: 'user' },
							],
							model: 'llama-3.3-70b-versatile',
						},
						run_id: 'run_ws_live_web_search_conflict_1',
						trace_id: 'trace_ws_live_web_search_conflict_1',
					},
					type: 'run.request',
				}),
				{
					getAdditionalPresentationBlocks: async () => [additionalSearchBlock],
					persistEvents,
					policy_wiring: policyWiring,
				},
			);

			const messages = parseMessages(socket);
			const presentationMessages = messages.filter(
				(
					message,
				): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
					message.type === 'presentation.blocks',
			);
			const presentationMessage = presentationMessages[presentationMessages.length - 1];

			expect(persistEvents).toHaveBeenCalledTimes(1);
			expect(presentationMessage).toBeDefined();

			if (presentationMessage?.type === 'presentation.blocks') {
				const blockTypes = presentationMessage.payload.blocks.map((block) => block.type);
				const webSearchBlockIndex = blockTypes.indexOf('web_search_result_block');
				const searchResultBlockIndex = blockTypes.indexOf('search_result_block');
				const runTimelineBlockIndex = blockTypes.indexOf('run_timeline_block');
				const traceDebugBlockIndex = blockTypes.indexOf('trace_debug_block');

				expect(blockTypes).toEqual(
					expect.arrayContaining([
						'status',
						'event_list',
						'tool_result',
						'web_search_result_block',
						'search_result_block',
						'workspace_inspection_block',
						'run_timeline_block',
						'trace_debug_block',
					]),
				);
				expect(webSearchBlockIndex).toBeGreaterThanOrEqual(0);
				expect(searchResultBlockIndex).toBeGreaterThanOrEqual(0);
				expect(runTimelineBlockIndex).toBeGreaterThanOrEqual(0);
				expect(traceDebugBlockIndex).toBeGreaterThanOrEqual(0);
				expect(presentationMessage.payload.blocks[webSearchBlockIndex]).toMatchObject({
					payload: {
						conflict_note:
							'Local and public sources were both consulted. Prefer workspace-local truth for implementation details; public results may be newer for latest or release details.',
						source_priority_note:
							'Public web results complement local truth for external docs, releases, vendor details, and latest verification.',
					},
					type: 'web_search_result_block',
				});
				expect(presentationMessage.payload.blocks[searchResultBlockIndex]).toMatchObject({
					payload: {
						conflict_note:
							'Local and public sources were both consulted. Prefer workspace-local truth for implementation details; public results may be newer for latest or release details.',
						source_priority_note:
							'Prefer workspace-local results for repo code, config, and implementation truth.',
					},
					type: 'search_result_block',
				});
				expect(presentationMessage.payload.blocks[runTimelineBlockIndex]).toMatchObject({
					type: 'run_timeline_block',
				});
				expect(presentationMessage.payload.blocks[traceDebugBlockIndex]).toMatchObject({
					type: 'trace_debug_block',
				});
				if (
					presentationMessage.payload.blocks[traceDebugBlockIndex]?.type !== 'trace_debug_block'
				) {
					throw new Error('Expected a trace_debug_block.');
				}
				expect(
					presentationMessage.payload.blocks[traceDebugBlockIndex].payload.debug_notes,
				).toEqual(expect.arrayContaining(['Workspace context prepared.']));
			}
		} finally {
			if (previousSerperApiKey === undefined) {
				environment.SERPER_API_KEY = undefined;
			} else {
				environment.SERPER_API_KEY = previousSerperApiKey;
			}

			if (previousSerperEndpoint === undefined) {
				environment.SERPER_ENDPOINT = undefined;
			} else {
				environment.SERPER_ENDPOINT = previousSerperEndpoint;
			}
		}
	});

	it('automates a narrow demo-style live chain across search, read, and approval-gated write on one workspace fixture', async () => {
		await withWorkspaceTempDirectory(async (directory) => {
			const socket = new MockSocket();
			const policyWiring = await enableAutoContinueForSocket(socket);
			const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
			const approvalStore = createApprovalStore();
			const requestBodies: string[] = [];
			const searchExecuteSpy = vi.spyOn(searchCodebaseTool, 'execute');
			const fileReadExecuteSpy = vi.spyOn(fileReadTool, 'execute');
			const fileWriteExecuteSpy = vi.spyOn(fileWriteTool, 'execute');
			const sourceDirectory = join(directory, 'src');
			const filePath = join(sourceDirectory, 'auth-middleware.ts');
			const relativeFilePath = relative(getLiveWorkingDirectory(), filePath);
			const workspaceRelativePath = relative(getLiveWorkingDirectory(), directory);
			const query = 'sprint5_demo_auth_bug_marker_91';
			const originalContent = [
				`// ${query}`,
				'export function allowAccess(token: string | null): boolean {',
				'\tif (!token) {',
				'\t\treturn true;',
				'\t}',
				'',
				'\treturn token.length > 0;',
				'}',
				'',
			].join('\n');
			const fixedContent = originalContent.replace('return true;', 'return false;');

			function createGroqToolCallResponse(input: {
				readonly call_id: string;
				readonly response_id: string;
				readonly tool_arguments: Record<string, unknown>;
				readonly tool_name: string;
			}): Response {
				return new Response(
					JSON.stringify({
						choices: [
							{
								finish_reason: 'tool_calls',
								message: {
									role: 'assistant',
									tool_calls: [
										{
											function: {
												arguments: input.tool_arguments,
												name: input.tool_name,
											},
											id: input.call_id,
											type: 'function',
										},
									],
								},
							},
						],
						id: input.response_id,
						model: 'llama-3.3-70b-versatile',
						usage: {
							completion_tokens: 12,
							prompt_tokens: 8,
							total_tokens: 20,
						},
					}),
					{
						headers: {
							'content-type': 'application/json',
						},
						status: 200,
					},
				);
			}

			function getPresentationMessagesForRun(
				runId: string,
			): readonly Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }>[] {
				return parseMessages(socket).filter(
					(
						message,
					): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
						message.type === 'presentation.blocks' && message.payload.run_id === runId,
				);
			}

			await mkdir(sourceDirectory, { recursive: true });
			await writeFile(filePath, originalContent, 'utf8');

			attachRuntimeWebSocketHandler(socket);

			const fetchResponses = [
				createGroqToolCallResponse({
					call_id: 'call_ws_demo_search_1',
					response_id: 'chatcmpl_ws_demo_search_1',
					tool_arguments: {
						query,
						working_directory: workspaceRelativePath,
					},
					tool_name: 'search.codebase',
				}),
				createGroqAssistantResponse({
					content: 'Found the auth middleware file.',
					response_id: 'chatcmpl_ws_demo_search_2',
				}),
				createGroqToolCallResponse({
					call_id: 'call_ws_demo_read_1',
					response_id: 'chatcmpl_ws_demo_read_1',
					tool_arguments: {
						path: relativeFilePath,
					},
					tool_name: 'file.read',
				}),
				createGroqAssistantResponse({
					content: 'Inspected the auth middleware bug.',
					response_id: 'chatcmpl_ws_demo_read_2',
				}),
				createGroqToolCallResponse({
					call_id: 'call_ws_demo_write_1',
					response_id: 'chatcmpl_ws_demo_write_1',
					tool_arguments: {
						content: fixedContent,
						overwrite: true,
						path: relativeFilePath,
					},
					tool_name: 'file.write',
				}),
				createGroqAssistantResponse({
					content: 'Auth middleware bug fixed.',
					response_id: 'chatcmpl_ws_demo_write_2',
				}),
			];

			vi.stubGlobal(
				'fetch',
				vi.fn(async (_input, init) => {
					if (init && typeof init === 'object' && 'body' in init && typeof init.body === 'string') {
						requestBodies.push(init.body);
					}

					const nextResponse = fetchResponses.shift();

					if (!nextResponse) {
						throw new Error('Unexpected fetch call in demo integration test.');
					}

					return nextResponse;
				}),
			);

			await handleWebSocketMessage(
				socket,
				JSON.stringify({
					payload: {
						include_presentation_blocks: true,
						provider: 'groq',
						provider_config: {
							apiKey: 'groq-key',
						},
						request: {
							max_output_tokens: 64,
							messages: [
								{ content: 'Find the auth middleware file with the bug marker.', role: 'user' },
							],
							model: 'llama-3.3-70b-versatile',
						},
						run_id: 'run_ws_demo_search_1',
						trace_id: 'trace_ws_demo_search_1',
					},
					type: 'run.request',
				}),
				{
					approvalStore: approvalStore.store,
					persistEvents,
					policy_wiring: policyWiring,
				},
			);

			await handleWebSocketMessage(
				socket,
				JSON.stringify({
					payload: {
						include_presentation_blocks: true,
						provider: 'groq',
						provider_config: {
							apiKey: 'groq-key',
						},
						request: {
							max_output_tokens: 64,
							messages: [
								{ content: 'Open the auth middleware file and inspect the bug.', role: 'user' },
							],
							model: 'llama-3.3-70b-versatile',
						},
						run_id: 'run_ws_demo_read_1',
						trace_id: 'trace_ws_demo_read_1',
					},
					type: 'run.request',
				}),
				{
					approvalStore: approvalStore.store,
					persistEvents,
					policy_wiring: policyWiring,
				},
			);

			await handleWebSocketMessage(
				socket,
				JSON.stringify({
					payload: {
						include_presentation_blocks: true,
						provider: 'groq',
						provider_config: {
							apiKey: 'groq-key',
						},
						request: {
							max_output_tokens: 64,
							messages: [
								{ content: 'Fix the auth middleware bug and apply the change.', role: 'user' },
							],
							model: 'llama-3.3-70b-versatile',
						},
						run_id: 'run_ws_demo_write_1',
						trace_id: 'trace_ws_demo_write_1',
					},
					type: 'run.request',
				}),
				{
					approvalStore: approvalStore.store,
					persistEvents,
					policy_wiring: policyWiring,
				},
			);

			const writeRunPresentationMessages = getPresentationMessagesForRun('run_ws_demo_write_1');
			const pendingWriteIncrementalPresentationMessage = writeRunPresentationMessages[0];
			const pendingWritePresentationMessage = writeRunPresentationMessages[1];

			expect(searchExecuteSpy).toHaveBeenCalledTimes(1);
			expect(fileReadExecuteSpy).toHaveBeenCalledTimes(1);
			expect(fileWriteExecuteSpy).not.toHaveBeenCalled();
			expect(approvalStore.persistApprovalRequestMock).toHaveBeenCalledTimes(1);
			expect(await readFile(filePath, 'utf8')).toBe(originalContent);

			if (pendingWriteIncrementalPresentationMessage?.type !== 'presentation.blocks') {
				throw new Error('Expected the write run to emit a pending approval presentation message.');
			}

			const pendingApprovalBlock = pendingWriteIncrementalPresentationMessage.payload.blocks.find(
				(block): block is Extract<RenderBlock, { type: 'approval_block' }> =>
					block.type === 'approval_block',
			);

			if (!pendingApprovalBlock) {
				throw new Error('Expected an approval block before approval.resolve.');
			}

			await handleWebSocketMessage(
				socket,
				JSON.stringify({
					payload: {
						approval_id: pendingApprovalBlock.payload.approval_id,
						decision: 'approved',
					},
					type: 'approval.resolve',
				}),
				{
					approvalStore: approvalStore.store,
					persistEvents,
				},
			);

			const searchRunPresentationMessages = getPresentationMessagesForRun('run_ws_demo_search_1');
			const readRunPresentationMessages = getPresentationMessagesForRun('run_ws_demo_read_1');
			const writePresentationMessages = getPresentationMessagesForRun('run_ws_demo_write_1');
			const searchPresentationMessage =
				searchRunPresentationMessages[searchRunPresentationMessages.length - 1];
			const readPresentationMessage =
				readRunPresentationMessages[readRunPresentationMessages.length - 1];
			const resolvedWritePresentationMessage = writePresentationMessages.find((message) =>
				message.payload.blocks.some(
					(block) =>
						block.type === 'approval_block' &&
						block.payload.approval_id === pendingApprovalBlock.payload.approval_id &&
						block.payload.status === 'approved',
				),
			);
			const writeFinishedMessage = parseMessages(socket)
				.filter((message) => message.type === 'run.finished')
				.find((message) => message.payload.run_id === 'run_ws_demo_write_1');

			expect(searchRunPresentationMessages).toHaveLength(2);
			expect(readRunPresentationMessages).toHaveLength(2);
			expect(writePresentationMessages).toHaveLength(5);
			expect(requestBodies).toHaveLength(6);
			expect(persistEvents).toHaveBeenCalledTimes(4);
			expect(approvalStore.getPendingApprovalByIdMock).toHaveBeenCalledWith(
				pendingApprovalBlock.payload.approval_id,
			);
			expect(approvalStore.persistApprovalResolutionMock).toHaveBeenCalledTimes(1);
			expect(fileWriteExecuteSpy).toHaveBeenCalledTimes(1);
			expect(await readFile(filePath, 'utf8')).toBe(fixedContent);
			expect(writeFinishedMessage).toMatchObject({
				payload: {
					final_state: 'COMPLETED',
					run_id: 'run_ws_demo_write_1',
					status: 'completed',
					trace_id: 'trace_ws_demo_write_1',
				},
				type: 'run.finished',
			});

			for (const requestBody of requestBodies) {
				expect(parseToolNamesFromRequestBody(requestBody)).toEqual(
					expect.arrayContaining(['file.read', 'file.write', 'search.codebase']),
				);

				const requestMessages = parseGroqMessagesFromRequestBody(requestBody);

				expect(requestMessages[0]?.content).toContain('[core_rules:instruction]');
				expect(requestMessages[0]?.content).toContain('[run_layer:runtime]');
				expect(requestMessages[0]?.content).toContain('[workspace_layer:workspace]');
			}

			expect(searchPresentationMessage).toBeDefined();
			expect(readPresentationMessage).toBeDefined();
			expect(pendingWritePresentationMessage).toBeDefined();
			expect(resolvedWritePresentationMessage).toBeDefined();

			if (
				searchPresentationMessage?.type !== 'presentation.blocks' ||
				readPresentationMessage?.type !== 'presentation.blocks' ||
				pendingWritePresentationMessage?.type !== 'presentation.blocks' ||
				resolvedWritePresentationMessage?.type !== 'presentation.blocks'
			) {
				throw new Error('Expected presentation blocks for search, read, and resolved write runs.');
			}

			expect(searchPresentationMessage.payload.blocks.map((block) => block.type)).toEqual([
				'status',
				'text',
				'event_list',
				'tool_result',
				'search_result_block',
				'workspace_inspection_block',
				'run_timeline_block',
				'trace_debug_block',
			]);
			expect(searchPresentationMessage.payload.blocks[4]).toMatchObject({
				payload: {
					matches: [
						{
							line_number: 1,
							line_text: `// ${query}`,
							path: filePath,
						},
					],
					query,
					searched_root: directory,
					summary: `Found 1 codebase match for "${query}".`,
				},
				type: 'search_result_block',
			});
			expect(searchPresentationMessage.payload.blocks[7]).toMatchObject({
				type: 'trace_debug_block',
			});

			expect(readPresentationMessage.payload.blocks.map((block) => block.type)).toEqual([
				'status',
				'text',
				'event_list',
				'tool_result',
				'code_block',
				'workspace_inspection_block',
				'run_timeline_block',
				'trace_debug_block',
			]);
			expect(readPresentationMessage.payload.blocks[4]).toMatchObject({
				payload: {
					content: originalContent,
					path: filePath,
				},
				type: 'code_block',
			});
			expect(readPresentationMessage.payload.blocks[7]).toMatchObject({
				type: 'trace_debug_block',
			});

			expect(
				pendingWriteIncrementalPresentationMessage.payload.blocks.map((block) => block.type),
			).toEqual(['approval_block']);

			expect(pendingWritePresentationMessage.payload.blocks.map((block) => block.type)).toEqual([
				'status',
				'event_list',
				'approval_block',
				'workspace_inspection_block',
				'run_timeline_block',
				'trace_debug_block',
			]);
			expect(pendingApprovalBlock).toMatchObject({
				payload: {
					action_kind: 'file_write',
					call_id: 'call_ws_demo_write_1',
					status: 'pending',
					tool_name: 'file.write',
				},
				type: 'approval_block',
			});

			expect(resolvedWritePresentationMessage.payload.blocks.map((block) => block.type)).toEqual([
				'approval_block',
				'tool_result',
				'trace_debug_block',
			]);
			expect(resolvedWritePresentationMessage.payload.blocks[0]).toMatchObject({
				payload: {
					action_kind: 'file_write',
					approval_id: pendingApprovalBlock.payload.approval_id,
					call_id: 'call_ws_demo_write_1',
					decision: 'approved',
					status: 'approved',
					tool_name: 'file.write',
				},
				type: 'approval_block',
			});
			expect(resolvedWritePresentationMessage.payload.blocks[1]).toMatchObject({
				payload: {
					call_id: 'call_ws_demo_write_1',
					status: 'success',
					summary: 'file.write completed successfully.',
					tool_name: 'file.write',
				},
				type: 'tool_result',
			});
			expect(resolvedWritePresentationMessage.payload.blocks[2]).toMatchObject({
				payload: {
					approval_summary: 'Approval granted; replay executed for file write.',
					run_state: 'TOOL_RESULT_INGESTING',
					summary: 'Run replayed file write after approval.',
					tool_chain_summary: 'Tool chain: File write.',
				},
				type: 'trace_debug_block',
			});
		});
	});

	it('writes explicit memory on a live run, discards duplicates, and injects memory into the next compiled_context', async () => {
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const memoryStore = createMemoryStore();
		const requestBodies: string[] = [];

		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(async (_input, init) => {
				if (init && typeof init === 'object' && 'body' in init && typeof init.body === 'string') {
					requestBodies.push(init.body);
				}

				return new Response(
					JSON.stringify({
						choices: [
							{
								finish_reason: 'stop',
								message: {
									content: 'Noted.',
									role: 'assistant',
								},
							},
						],
						id: 'chatcmpl_ws_live_memory',
						model: 'llama-3.3-70b-versatile',
						usage: {
							completion_tokens: 12,
							prompt_tokens: 8,
							total_tokens: 20,
						},
					}),
					{
						headers: {
							'content-type': 'application/json',
						},
						status: 200,
					},
				);
			}),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [
							{
								content: 'Remember that: the project theme is blue.',
								role: 'user',
							},
						],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_live_memory_write_1',
					trace_id: 'trace_ws_live_memory_write_1',
				},
				type: 'run.request',
			}),
			{
				memoryStore: memoryStore.store,
				persistEvents,
			},
		);

		expect(memoryStore.createMemoryMock).toHaveBeenCalledTimes(1);
		expect(memoryStore.records).toHaveLength(1);
		expect(memoryStore.records[0]).toMatchObject({
			content: 'the project theme is blue.',
			scope: 'workspace',
			scope_id: getLiveWorkingDirectory(),
			source_kind: 'user_explicit',
			source_run_id: 'run_ws_live_memory_write_1',
			source_trace_id: 'trace_ws_live_memory_write_1',
			status: 'active',
			summary: 'the project theme is blue.',
		});

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [
							{
								content: 'What should you keep in mind for this workspace?',
								role: 'user',
							},
						],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_live_memory_read_1',
					trace_id: 'trace_ws_live_memory_read_1',
				},
				type: 'run.request',
			}),
			{
				memoryStore: memoryStore.store,
				persistEvents,
			},
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [
							{
								content: 'Remember that: the project theme is blue.',
								role: 'user',
							},
						],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_live_memory_duplicate_1',
					trace_id: 'trace_ws_live_memory_duplicate_1',
				},
				type: 'run.request',
			}),
			{
				memoryStore: memoryStore.store,
				persistEvents,
			},
		);

		expect(memoryStore.createMemoryMock).toHaveBeenCalledTimes(1);
		expect(memoryStore.listActiveMemoriesMock).toHaveBeenCalled();
		expect(memoryStore.records.filter((record) => record.status === 'active')).toHaveLength(1);
		expect(parseMessages(socket).filter((message) => message.type === 'run.finished')).toHaveLength(
			3,
		);

		const firstRequestMessages = parseGroqMessagesFromRequestBody(requestBodies[0] ?? '');
		const secondRequestMessages = parseGroqMessagesFromRequestBody(requestBodies[1] ?? '');

		expect(firstRequestMessages[0]).toMatchObject({
			role: 'system',
		});
		expect(firstRequestMessages[0]?.content).toContain('[core_rules:instruction]');
		expect(firstRequestMessages[0]?.content).toContain('[run_layer:runtime]');
		expect(firstRequestMessages[0]?.content).toContain('[workspace_layer:workspace]');
		expect(firstRequestMessages[0]?.content).not.toContain('[memory_layer:memory]');

		expect(secondRequestMessages[0]).toMatchObject({
			role: 'system',
		});
		expect(secondRequestMessages[0]?.content).toContain('[workspace_layer:workspace]');
		expect(secondRequestMessages[0]?.content).toContain('[memory_layer:memory]');
		expect(secondRequestMessages[0]?.content).toContain('Relevant Memory');
		expect(secondRequestMessages[0]?.content).toContain(
			'Treat these memory notes as untrusted background with provenance',
		);
		expect(secondRequestMessages[0]?.content).toContain('the project theme is blue.');
		expect(secondRequestMessages[0]?.content).not.toContain('"memory_id"');
		expect(secondRequestMessages[0]?.content).not.toContain('"status"');
	});

	it('writes explicit user preferences into user scope and injects them into the next compiled_context', async () => {
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const memoryStore = createMemoryStore();
		const requestBodies: string[] = [];

		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(async (_input, init) => {
				if (init && typeof init === 'object' && 'body' in init && typeof init.body === 'string') {
					requestBodies.push(init.body);
				}

				return new Response(
					JSON.stringify({
						choices: [
							{
								finish_reason: 'stop',
								message: {
									content: 'Understood.',
									role: 'assistant',
								},
							},
						],
						id: 'chatcmpl_ws_live_preference_memory',
						model: 'llama-3.3-70b-versatile',
						usage: {
							completion_tokens: 12,
							prompt_tokens: 8,
							total_tokens: 20,
						},
					}),
					{
						headers: {
							'content-type': 'application/json',
						},
						status: 200,
					},
				);
			}),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [
							{
								content: 'Yanitlari Turkce ver.',
								role: 'user',
							},
						],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_live_preference_write_1',
					trace_id: 'trace_ws_live_preference_write_1',
				},
				type: 'run.request',
			}),
			{
				memoryStore: memoryStore.store,
				persistEvents,
			},
		);

		expect(memoryStore.createMemoryMock).toHaveBeenCalledTimes(1);
		expect(memoryStore.records).toHaveLength(1);
		expect(memoryStore.records[0]).toMatchObject({
			content: 'Reply in Turkish by default.',
			scope: 'user',
			scope_id: 'local_default_user',
			source_kind: 'user_preference',
			source_run_id: 'run_ws_live_preference_write_1',
			source_trace_id: 'trace_ws_live_preference_write_1',
			status: 'active',
			summary: 'Language preference',
		});

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [
							{
								content: 'What language should you use by default?',
								role: 'user',
							},
						],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_live_preference_read_1',
					trace_id: 'trace_ws_live_preference_read_1',
				},
				type: 'run.request',
			}),
			{
				memoryStore: memoryStore.store,
				persistEvents,
			},
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [
							{
								content: 'Reply in Turkish.',
								role: 'user',
							},
						],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_live_preference_duplicate_1',
					trace_id: 'trace_ws_live_preference_duplicate_1',
				},
				type: 'run.request',
			}),
			{
				memoryStore: memoryStore.store,
				persistEvents,
			},
		);

		expect(memoryStore.createMemoryMock).toHaveBeenCalledTimes(1);
		expect(memoryStore.records.filter((record) => record.status === 'active')).toHaveLength(1);

		const firstRequestMessages = parseGroqMessagesFromRequestBody(requestBodies[0] ?? '');
		const secondRequestMessages = parseGroqMessagesFromRequestBody(requestBodies[1] ?? '');

		expect(firstRequestMessages[0]?.content).not.toContain('[memory_layer:memory]');
		expect(secondRequestMessages[0]?.content).toContain('[memory_layer:memory]');
		expect(secondRequestMessages[0]?.content).toContain('Language preference');
		expect(secondRequestMessages[0]?.content).toContain('user_preference');
		expect(secondRequestMessages[0]?.content).toContain('Reply in Turkish by default.');
		expect(secondRequestMessages[0]?.content).not.toContain('"memory_id"');
		expect(secondRequestMessages[0]?.content).not.toContain('"status"');
	});

	it('routes policy-required capabilities into the existing approval flow without changing WS contracts', async () => {
		await withTempDirectory(async (directory) => {
			const socket = new MockSocket();
			const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
			const approvalStore = createApprovalStore();
			const registry = new ToolRegistry();
			const policyWiring = createWebSocketPolicyWiring({
				permission_engine: createPermissionEngine({
					approval_required_capability_ids: ['file.write'],
				}),
			});
			const filePath = join(directory, 'policy-required.txt');
			let executeCount = 0;

			registry.register(
				createFakeTool(
					'file.write',
					async () => {
						executeCount += 1;

						return {
							call_id: 'call_ws_policy_required_1',
							output: {
								path: filePath,
								written: true,
							},
							status: 'success',
							tool_name: 'file.write',
						};
					},
					{
						requires_approval: false,
						risk_level: 'medium',
						side_effect_level: 'write',
					},
				),
			);

			attachRuntimeWebSocketHandler(socket);

			vi.stubGlobal(
				'fetch',
				vi.fn(
					async () =>
						new Response(
							JSON.stringify({
								choices: [
									{
										finish_reason: 'tool_calls',
										message: {
											role: 'assistant',
											tool_calls: [
												{
													function: {
														arguments: {
															content: 'policy write',
															path: filePath,
														},
														name: 'file.write',
													},
													id: 'call_ws_policy_required_1',
													type: 'function',
												},
											],
										},
									},
								],
								id: 'chatcmpl_ws_policy_required_1',
								model: 'llama-3.3-70b-versatile',
								usage: {
									completion_tokens: 12,
									prompt_tokens: 8,
									total_tokens: 20,
								},
							}),
							{
								headers: {
									'content-type': 'application/json',
								},
								status: 200,
							},
						),
				),
			);

			await handleWebSocketMessage(
				socket,
				JSON.stringify({
					payload: {
						include_presentation_blocks: true,
						provider: 'groq',
						provider_config: {
							apiKey: 'groq-key',
						},
						request: {
							max_output_tokens: 64,
							messages: [{ content: 'Write the file after policy review.', role: 'user' }],
							model: 'llama-3.3-70b-versatile',
						},
						run_id: 'run_ws_policy_required_1',
						trace_id: 'trace_ws_policy_required_1',
					},
					type: 'run.request',
				}),
				{
					approvalStore: approvalStore.store,
					persistEvents,
					policy_wiring: policyWiring,
					toolRegistry: registry,
				},
			);

			const messages = parseMessages(socket);
			const presentationMessages = messages.filter(
				(
					message,
				): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
					message.type === 'presentation.blocks',
			);
			const runtimeEvents = messages.filter(
				(message): message is Extract<WebSocketServerBridgeMessage, { type: 'runtime.event' }> =>
					message.type === 'runtime.event',
			);
			const incrementalApprovalMessage = presentationMessages[0];
			const approvalMessage = presentationMessages[presentationMessages.length - 1];

			expect(messages.map((message) => message.type)).toEqual([
				'connection.ready',
				'run.accepted',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'presentation.blocks',
				'presentation.blocks',
			]);
			expect(runtimeEvents.map((message) => message.payload.event.event_type)).toEqual([
				'run.started',
				'state.entered',
				'model.completed',
				'state.entered',
			]);
			expect(approvalStore.persistApprovalRequestMock).toHaveBeenCalledTimes(1);
			expect(executeCount).toBe(0);
			expect((await policyWiring.getState(socket)).denial_tracking.consecutive_denials).toBe(0);
			expect(presentationMessages).toHaveLength(2);

			if (incrementalApprovalMessage?.type === 'presentation.blocks') {
				expect(incrementalApprovalMessage.payload.blocks.map((block) => block.type)).toEqual([
					'approval_block',
				]);
			}

			if (approvalMessage?.type !== 'presentation.blocks') {
				throw new Error('Expected policy-required tool call to emit approval presentation.');
			}

			expect(approvalMessage.payload.blocks.map((block) => block.type)).toEqual([
				'status',
				'event_list',
				'approval_block',
				'workspace_inspection_block',
				'run_timeline_block',
				'trace_debug_block',
			]);
			expect(approvalMessage.payload.blocks[2]).toMatchObject({
				payload: {
					action_kind: 'file_write',
					call_id: 'call_ws_policy_required_1',
					status: 'pending',
					tool_name: 'file.write',
				},
				type: 'approval_block',
			});
		});
	});

	it('returns a controlled failed WS result for hard-denied capabilities before tool execution', async () => {
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const registry = new ToolRegistry();
		const policyWiring = createWebSocketPolicyWiring({
			permission_engine: createPermissionEngine({
				hard_denied_capability_ids: ['shell.exec'],
			}),
		});
		let executeCount = 0;

		registry.register(
			createFakeTool(
				'shell.exec',
				async () => {
					executeCount += 1;

					return {
						call_id: 'call_ws_policy_deny_1',
						output: {
							stdout: 'should not execute',
						},
						status: 'success',
						tool_name: 'shell.exec',
					};
				},
				{
					requires_approval: false,
					risk_level: 'high',
					side_effect_level: 'execute',
				},
			),
		);

		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'tool_calls',
									message: {
										role: 'assistant',
										tool_calls: [
											{
												function: {
													arguments: {
														command: 'git status',
													},
													name: 'shell.exec',
												},
												id: 'call_ws_policy_deny_1',
												type: 'function',
											},
										],
									},
								},
							],
							id: 'chatcmpl_ws_policy_deny_1',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Run shell.exec', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_policy_deny_1',
					trace_id: 'trace_ws_policy_deny_1',
				},
				type: 'run.request',
			}),
			{
				persistEvents,
				policy_wiring: policyWiring,
				toolRegistry: registry,
			},
		);

		const messages = parseMessages(socket);
		const runtimeEvents = messages.filter(
			(message): message is Extract<WebSocketServerBridgeMessage, { type: 'runtime.event' }> =>
				message.type === 'runtime.event',
		);
		const finishedMessage = messages.find(
			(message): message is Extract<WebSocketServerBridgeMessage, { type: 'run.finished' }> =>
				message.type === 'run.finished',
		);

		expect(messages.map((message) => message.type)).toEqual([
			'connection.ready',
			'run.accepted',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'run.finished',
		]);
		expect(runtimeEvents.map((message) => message.payload.event.event_type)).toEqual([
			'run.started',
			'state.entered',
			'model.completed',
			'state.entered',
			'run.failed',
		]);
		expect(executeCount).toBe(0);
		expect((await policyWiring.getState(socket)).denial_tracking.consecutive_denials).toBe(1);
		expect(finishedMessage).toMatchObject({
			payload: {
				final_state: 'FAILED',
				status: 'failed',
			},
			type: 'run.finished',
		});

		if (finishedMessage?.type === 'run.finished') {
			expect(finishedMessage.payload.error_message).toContain('Permission denied');
		}
	});

	it('pauses a socket-scoped session after three consecutive approval rejections', async () => {
		await withTempDirectory(async (directory) => {
			const socket = new MockSocket();
			const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
			const approvalStore = createApprovalStore();
			const registry = new ToolRegistry();
			const policyWiring = createWebSocketPolicyWiring({
				permission_engine: createPermissionEngine({
					approval_required_capability_ids: ['file.write'],
				}),
			});
			const filePath = join(directory, 'pause-threshold.txt');
			let executeCount = 0;

			registry.register(
				createFakeTool(
					'file.write',
					async () => {
						executeCount += 1;

						return {
							call_id: 'call_ws_policy_pause_execute',
							output: {
								path: filePath,
								written: true,
							},
							status: 'success',
							tool_name: 'file.write',
						};
					},
					{
						requires_approval: false,
						risk_level: 'medium',
						side_effect_level: 'write',
					},
				),
			);

			attachRuntimeWebSocketHandler(socket);

			vi.stubGlobal(
				'fetch',
				vi.fn(async () => {
					const responseIndex =
						(await policyWiring.getState(socket)).denial_tracking.consecutive_denials + 1;

					return new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'tool_calls',
									message: {
										role: 'assistant',
										tool_calls: [
											{
												function: {
													arguments: {
														content: `attempt ${responseIndex}`,
														path: filePath,
													},
													name: 'file.write',
												},
												id: `call_ws_policy_pause_${responseIndex}`,
												type: 'function',
											},
										],
									},
								},
							],
							id: `chatcmpl_ws_policy_pause_${responseIndex}`,
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					);
				}),
			);

			for (let attempt = 1; attempt <= 3; attempt += 1) {
				await handleWebSocketMessage(
					socket,
					JSON.stringify({
						payload: {
							include_presentation_blocks: true,
							provider: 'groq',
							provider_config: {
								apiKey: 'groq-key',
							},
							request: {
								max_output_tokens: 64,
								messages: [{ content: `Attempt ${attempt}`, role: 'user' }],
								model: 'llama-3.3-70b-versatile',
							},
							run_id: `run_ws_policy_pause_${attempt}`,
							trace_id: `trace_ws_policy_pause_${attempt}`,
						},
						type: 'run.request',
					}),
					{
						approvalStore: approvalStore.store,
						persistEvents,
						policy_wiring: policyWiring,
						toolRegistry: registry,
					},
				);

				const presentationMessages = parseMessages(socket).filter(
					(
						message,
					): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
						message.type === 'presentation.blocks',
				);
				const latestPresentationMessage = presentationMessages[presentationMessages.length - 1];

				if (latestPresentationMessage?.type !== 'presentation.blocks') {
					throw new Error('Expected approval presentation before rejection.');
				}

				const approvalBlock = latestPresentationMessage.payload.blocks.find(
					(block): block is Extract<RenderBlock, { type: 'approval_block' }> =>
						block.type === 'approval_block',
				);

				if (!approvalBlock) {
					throw new Error('Expected approval block before rejection.');
				}

				await handleWebSocketMessage(
					socket,
					JSON.stringify({
						payload: {
							approval_id: approvalBlock.payload.approval_id,
							decision: 'rejected',
							note: `Rejected attempt ${attempt}`,
						},
						type: 'approval.resolve',
					}),
					{
						approvalStore: approvalStore.store,
						persistEvents,
						policy_wiring: policyWiring,
						toolRegistry: registry,
					},
				);
			}

			expect((await policyWiring.getState(socket)).denial_tracking.consecutive_denials).toBe(3);
			expect((await policyWiring.getState(socket)).session_pause).toEqual({
				active: true,
				paused_at: expect.any(String),
				reason: 'denial_threshold',
			});

			await handleWebSocketMessage(
				socket,
				JSON.stringify({
					payload: {
						provider: 'groq',
						provider_config: {
							apiKey: 'groq-key',
						},
						request: {
							max_output_tokens: 64,
							messages: [{ content: 'Attempt after pause', role: 'user' }],
							model: 'llama-3.3-70b-versatile',
						},
						run_id: 'run_ws_policy_pause_4',
						trace_id: 'trace_ws_policy_pause_4',
					},
					type: 'run.request',
				}),
				{
					approvalStore: approvalStore.store,
					persistEvents,
					policy_wiring: policyWiring,
					toolRegistry: registry,
				},
			);

			const allMessages = parseMessages(socket);
			const pauseRunMessages = allMessages.filter(
				(message) =>
					'payload' in message &&
					typeof message.payload === 'object' &&
					message.payload !== null &&
					'run_id' in message.payload &&
					message.payload.run_id === 'run_ws_policy_pause_4',
			);
			const pauseFinishedMessage = pauseRunMessages.find(
				(message): message is Extract<WebSocketServerBridgeMessage, { type: 'run.finished' }> =>
					message.type === 'run.finished',
			);

			expect(pauseRunMessages.map((message) => message.type)).toEqual([
				'run.accepted',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'run.finished',
			]);
			expect(executeCount).toBe(0);
			expect(pauseFinishedMessage).toMatchObject({
				payload: {
					final_state: 'FAILED',
					status: 'failed',
				},
				type: 'run.finished',
			});

			if (pauseFinishedMessage?.type === 'run.finished') {
				expect(pauseFinishedMessage.payload.error_message).toContain('Session is paused');
			}
		});
	});

	it('persists live approval-required run.request state and replays it after approval.resolve', async () => {
		await withTempDirectory(async (directory) => {
			const socket = new MockSocket();
			const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
			const approvalStore = createApprovalStore();
			const registry = new ToolRegistry();
			const filePath = join(directory, 'approved.txt');
			const requestBodies: Array<{
				readonly messages?: ReadonlyArray<{
					readonly content?: unknown;
					readonly role?: unknown;
				}>;
			}> = [];
			const fetchResponses = [
				new Response(
					JSON.stringify({
						choices: [
							{
								finish_reason: 'tool_calls',
								message: {
									role: 'assistant',
									tool_calls: [
										{
											function: {
												arguments: {
													content: 'approved content',
													overwrite: true,
													path: filePath,
												},
												name: 'file.write',
											},
											id: 'call_ws_live_approval_1',
											type: 'function',
										},
									],
								},
							},
						],
						id: 'chatcmpl_ws_live_approval',
						model: 'llama-3.3-70b-versatile',
						usage: {
							completion_tokens: 12,
							prompt_tokens: 8,
							total_tokens: 20,
						},
					}),
					{
						headers: {
							'content-type': 'application/json',
						},
						status: 200,
					},
				),
				createGroqAssistantResponse({
					content: 'approved.txt has been written.',
					response_id: 'chatcmpl_ws_live_approval_continued',
				}),
			];

			registry.register(fileWriteTool);

			attachRuntimeWebSocketHandler(socket);

			vi.stubGlobal(
				'fetch',
				vi.fn(async (_input, init) => {
					if (init && typeof init === 'object' && 'body' in init && typeof init.body === 'string') {
						requestBodies.push(JSON.parse(init.body) as (typeof requestBodies)[number]);
					}

					const nextResponse = fetchResponses.shift();

					if (!nextResponse) {
						throw new Error('Unexpected fetch call in approved file.write continuation test.');
					}

					return nextResponse;
				}),
			);

			await handleWebSocketMessage(
				socket,
				JSON.stringify({
					payload: {
						include_presentation_blocks: true,
						provider: 'groq',
						provider_config: {
							apiKey: 'groq-key',
						},
						request: {
							max_output_tokens: 64,
							messages: [{ content: 'Write the file', role: 'user' }],
							model: 'llama-3.3-70b-versatile',
						},
						run_id: 'run_ws_live_approval_1',
						trace_id: 'trace_ws_live_approval_1',
					},
					type: 'run.request',
				}),
				{
					approvalStore: approvalStore.store,
					persistEvents,
					toolRegistry: registry,
				},
			);

			const initialMessages = parseMessages(socket);
			const initialPresentationMessages = initialMessages.filter(
				(
					message,
				): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
					message.type === 'presentation.blocks',
			);
			const initialIncrementalPresentationMessage = initialPresentationMessages[0];
			const initialPresentationMessage =
				initialPresentationMessages[initialPresentationMessages.length - 1];
			const initialRuntimeEvents = initialMessages.filter(
				(message): message is Extract<WebSocketServerBridgeMessage, { type: 'runtime.event' }> =>
					message.type === 'runtime.event',
			);

			expect(initialMessages.map((message) => message.type)).toEqual([
				'connection.ready',
				'run.accepted',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'runtime.event',
				'presentation.blocks',
				'presentation.blocks',
			]);
			expect(initialRuntimeEvents.map((message) => message.payload.event.event_type)).toEqual([
				'run.started',
				'state.entered',
				'model.completed',
				'state.entered',
			]);
			expect(approvalStore.persistApprovalRequestMock).toHaveBeenCalledTimes(1);
			expect(approvalStore.persistApprovalRequestMock).toHaveBeenCalledWith(
				expect.objectContaining({
					auto_continue_context: expect.objectContaining({
						payload: expect.objectContaining({
							run_id: 'run_ws_live_approval_1',
							trace_id: 'trace_ws_live_approval_1',
						}),
						tool_result: undefined,
						turn_count: expect.any(Number),
						working_directory: getLiveWorkingDirectory(),
					}),
				}),
			);
			await expect(readFile(filePath, 'utf8')).rejects.toBeInstanceOf(Error);
			expect(initialPresentationMessages).toHaveLength(2);

			if (initialIncrementalPresentationMessage?.type === 'presentation.blocks') {
				expect(
					initialIncrementalPresentationMessage.payload.blocks.map((block) => block.type),
				).toEqual(['approval_block']);
			}

			if (initialPresentationMessage?.type !== 'presentation.blocks') {
				throw new Error('Expected live approval request to emit presentation blocks.');
			}

			expect(initialPresentationMessage.payload.blocks.map((block) => block.type)).toEqual([
				'status',
				'event_list',
				'approval_block',
				'workspace_inspection_block',
				'run_timeline_block',
				'trace_debug_block',
			]);
			expect(initialPresentationMessage.payload.blocks[2]).toMatchObject({
				payload: {
					action_kind: 'file_write',
					call_id: 'call_ws_live_approval_1',
					status: 'pending',
					tool_name: 'file.write',
				},
				type: 'approval_block',
			});
			expect(initialPresentationMessage.payload.blocks[4]).toMatchObject({
				payload: {
					summary: 'Timeline shows approval wait for file write.',
					title: 'Run Timeline',
				},
				type: 'run_timeline_block',
			});
			expect(
				initialPresentationMessage.payload.blocks[4]?.type === 'run_timeline_block'
					? initialPresentationMessage.payload.blocks[4].payload.items
					: [],
			).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						kind: 'approval_requested',
						label: 'Approval requested for file.write',
						state: 'pending',
						tool_name: 'file.write',
					}),
				]),
			);
			expect(initialPresentationMessage.payload.blocks[5]).toMatchObject({
				payload: {
					approval_summary: 'Approval gate active before file write.',
					run_state: 'WAITING_APPROVAL',
					summary: 'Run paused at approval gate before file write.',
					title: 'Trace / Debug',
					warning_notes: ['Pending approval is blocking file write.'],
				},
				type: 'trace_debug_block',
			});

			const approvalBlock = initialPresentationMessage.payload.blocks[2];

			if (!approvalBlock || approvalBlock.type !== 'approval_block') {
				throw new Error('Expected live approval block payload.');
			}

			await handleWebSocketMessage(
				socket,
				JSON.stringify({
					payload: {
						approval_id: approvalBlock.payload.approval_id,
						decision: 'approved',
					},
					type: 'approval.resolve',
				}),
				{
					approvalStore: approvalStore.store,
					persistEvents,
					toolRegistry: registry,
				},
			);

			const allMessages = parseMessages(socket);
			const presentationMessages = allMessages.filter(
				(
					message,
				): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
					message.type === 'presentation.blocks',
			);
			const resolvedMessage = presentationMessages.find((message) =>
				message.payload.blocks.some(
					(block) =>
						block.type === 'approval_block' &&
						block.payload.approval_id === approvalBlock.payload.approval_id &&
						block.payload.status === 'approved',
				),
			);
			const runtimeEventMessages = allMessages.filter(
				(message): message is Extract<WebSocketServerBridgeMessage, { type: 'runtime.event' }> =>
					message.type === 'runtime.event',
			);
			const finishedMessage = allMessages.at(-1);

			expect(resolvedMessage).toBeDefined();
			expect(requestBodies).toHaveLength(2);
			expect(
				requestBodies[1]?.messages?.some(
					(message) =>
						message.role === 'user' &&
						typeof message.content === 'string' &&
						message.content.includes('Do not repeat that same completed tool call'),
				),
			).toBe(true);
			expect(approvalStore.persistApprovalResolutionMock).toHaveBeenCalledTimes(1);
			expect(await readFile(filePath, 'utf8')).toBe('approved content');
			expect(runtimeEventMessages.map((message) => message.payload.event.event_type)).toContain(
				'run.completed',
			);
			expect(finishedMessage).toMatchObject({
				payload: {
					final_state: 'COMPLETED',
					run_id: 'run_ws_live_approval_1',
					status: 'completed',
					trace_id: 'trace_ws_live_approval_1',
				},
				type: 'run.finished',
			});

			if (resolvedMessage?.type === 'presentation.blocks') {
				expect(resolvedMessage.payload.blocks.map((block) => block.type)).toEqual([
					'approval_block',
					'tool_result',
					'trace_debug_block',
				]);
				expect(resolvedMessage.payload.blocks[0]).toMatchObject({
					payload: {
						action_kind: 'file_write',
						call_id: 'call_ws_live_approval_1',
						decision: 'approved',
						status: 'approved',
						tool_name: 'file.write',
					},
					type: 'approval_block',
				});
				expect(resolvedMessage.payload.blocks[1]).toMatchObject({
					payload: {
						call_id: 'call_ws_live_approval_1',
						status: 'success',
						summary: 'file.write completed successfully.',
						tool_name: 'file.write',
					},
					type: 'tool_result',
				});
				expect(resolvedMessage.payload.blocks[2]).toMatchObject({
					payload: {
						approval_summary: 'Approval granted; replay executed for file write.',
						run_state: 'TOOL_RESULT_INGESTING',
						summary: 'Run replayed file write after approval.',
						title: 'Trace / Debug',
						tool_chain_summary: 'Tool chain: File write.',
					},
					type: 'trace_debug_block',
				});
			}
		});
	});

	it('replays a persisted pending approval after a fresh websocket attachment and policy wiring instance', async () => {
		await withTempDirectory(async (directory) => {
			const authContext = {
				principal: {
					email: 'approval@runa.local',
					kind: 'authenticated',
					provider: 'supabase',
					role: 'authenticated',
					scope: {
						tenant_id: 'tenant_approval',
						workspace_id: 'workspace_approval',
					},
					session_id: 'session_approval',
					user_id: 'user_approval',
				},
				session: {
					identity_provider: 'email_password',
					provider: 'supabase',
					scope: {
						tenant_id: 'tenant_approval',
						workspace_id: 'workspace_approval',
					},
					session_id: 'session_approval',
					user_id: 'user_approval',
				},
				transport: 'websocket',
			} as const;
			const resumedSocket = new MockSocket();
			const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
			const sharedEntries = new Map<string, PendingApprovalEntry>();
			const resumedApprovalStore = createSharedApprovalStore(sharedEntries);
			const policyStateStore = createPolicyStateStore();
			const resumedPolicyWiring = createWebSocketPolicyWiring({
				policy_state_store: policyStateStore.store,
			});
			const registry = new ToolRegistry();
			const filePath = 'restart-approved.txt';
			const requestBodies: Array<{
				readonly messages?: ReadonlyArray<{
					readonly content?: unknown;
					readonly role?: unknown;
				}>;
			}> = [];

			registry.register(fileWriteTool);
			attachRuntimeWebSocketHandler(resumedSocket, {
				auth_context: authContext,
			});

			const pendingApprovalResult = await runToolStep({
				current_state: 'MODEL_THINKING',
				event_context: {
					sequence_start: 11,
				},
				execution_context: createExecutionContext({
					run_id: 'run_ws_restart_safe_approval_1',
					trace_id: 'trace_ws_restart_safe_approval_1',
					working_directory: directory,
				}),
				registry,
				run_id: 'run_ws_restart_safe_approval_1',
				tool_input: {
					arguments: {
						content: 'restart-safe content',
						overwrite: true,
						path: filePath,
					},
					call_id: 'call_ws_restart_safe_approval_1',
					tool_name: 'file.write',
				},
				tool_name: 'file.write',
				trace_id: 'trace_ws_restart_safe_approval_1',
			});

			expect(pendingApprovalResult.status).toBe('approval_required');

			if (pendingApprovalResult.status !== 'approval_required') {
				throw new Error('Expected a persisted pending approval before reconnect replay.');
			}

			sharedEntries.set(pendingApprovalResult.approval_request.approval_id, {
				approval_request: pendingApprovalResult.approval_request,
				auto_continue_context: {
					payload: {
						include_presentation_blocks: true,
						provider: 'groq',
						provider_config: {
							apiKey: 'groq-key',
						},
						request: {
							max_output_tokens: 64,
							messages: [{ content: 'Write restart-approved.txt', role: 'user' }],
							model: 'llama-3.3-70b-versatile',
						},
						run_id: 'run_ws_restart_safe_approval_1',
						trace_id: 'trace_ws_restart_safe_approval_1',
					},
					turn_count: 1,
					working_directory: directory,
				},
				next_sequence_no: 12,
				pending_tool_call: {
					tool_input: {
						content: 'restart-safe content',
						overwrite: true,
						path: filePath,
					},
					working_directory: directory,
				},
			});
			vi.stubGlobal(
				'fetch',
				vi.fn(async (_input, init) => {
					if (init && typeof init === 'object' && 'body' in init && typeof init.body === 'string') {
						requestBodies.push(JSON.parse(init.body) as (typeof requestBodies)[number]);
					}

					return createGroqAssistantResponse({
						content: 'restart-approved.txt has been written.',
						response_id: 'chatcmpl_ws_restart_safe_approval_continued',
					});
				}),
			);

			await handleWebSocketMessage(
				resumedSocket,
				JSON.stringify({
					payload: {
						approval_id: pendingApprovalResult.approval_request.approval_id,
						decision: 'approved',
					},
					type: 'approval.resolve',
				}),
				{
					approvalStore: resumedApprovalStore.store,
					auth_context: authContext,
					persistEvents,
					policy_wiring: resumedPolicyWiring,
					toolRegistry: registry,
				},
			);

			expect(resumedApprovalStore.getPendingApprovalByIdMock).toHaveBeenCalledWith(
				pendingApprovalResult.approval_request.approval_id,
			);
			expect(resumedApprovalStore.persistApprovalResolutionMock).toHaveBeenCalledTimes(1);
			expect(policyStateStore.getPolicyStateMock).toHaveBeenCalledWith({
				session_id: 'session_approval',
				tenant_id: 'tenant_approval',
				user_id: 'user_approval',
				workspace_id: 'workspace_approval',
			});
			expect(await readFile(join(directory, filePath), 'utf8')).toBe('restart-safe content');
			expect(sharedEntries.has(pendingApprovalResult.approval_request.approval_id)).toBe(false);
			expect(requestBodies).toHaveLength(1);
			expect(parseMessages(resumedSocket).at(-1)).toMatchObject({
				payload: {
					final_state: 'COMPLETED',
					run_id: 'run_ws_restart_safe_approval_1',
					status: 'completed',
					trace_id: 'trace_ws_restart_safe_approval_1',
				},
				type: 'run.finished',
			});
		});
	});

	it('automatically replays an approved pending tool call after approval.resolve', async () => {
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const approvalStore = createApprovalStore();
		const registry = new ToolRegistry();
		let executeCount = 0;

		registry.register(
			createFakeTool(
				'file.write',
				async () => {
					executeCount += 1;

					return {
						call_id: 'call_ws_bidirectional_approved_1',
						output: {
							path: 'src/example.ts',
							written: true,
						},
						status: 'success',
						tool_name: 'file.write',
					};
				},
				{
					requires_approval: true,
					risk_level: 'medium',
					side_effect_level: 'write',
				},
			),
		);

		const pendingApprovalResult = await runToolStep({
			current_state: 'MODEL_THINKING',
			event_context: {
				sequence_start: 11,
			},
			execution_context: createExecutionContext({
				run_id: 'run_ws_bidirectional_approved_1',
				trace_id: 'trace_ws_bidirectional_approved_1',
			}),
			registry,
			run_id: 'run_ws_bidirectional_approved_1',
			tool_input: {
				arguments: {
					content: 'hello',
					path: 'src/example.ts',
				},
				call_id: 'call_ws_bidirectional_approved_1',
				tool_name: 'file.write',
			},
			tool_name: 'file.write',
			trace_id: 'trace_ws_bidirectional_approved_1',
		});

		expect(pendingApprovalResult.status).toBe('approval_required');

		if (pendingApprovalResult.status !== 'approval_required') {
			throw new Error('Expected approval request for bidirectional approved test.');
		}

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'stop',
									message: {
										content: 'Hello over websocket',
										role: 'assistant',
									},
								},
							],
							id: 'chatcmpl_ws_approval_bidirectional_approved',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					include_presentation_blocks: true,
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Hello', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_bidirectional_approved_transport_1',
					trace_id: 'trace_ws_bidirectional_approved_transport_1',
				},
				type: 'run.request',
			}),
			{
				approvalStore: approvalStore.store,
				getApprovalPresentationInputs: async () => [
					{
						kind: 'request_result',
						pending_tool_call: {
							tool_input: {
								content: 'hello',
								path: 'src/example.ts',
							},
							working_directory: 'd:\\ai\\Runa',
						},
						result: pendingApprovalResult,
					},
				],
				persistEvents,
			},
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					approval_id: pendingApprovalResult.approval_request.approval_id,
					decision: 'approved',
				},
				type: 'approval.resolve',
			}),
			{
				approvalStore: approvalStore.store,
				persistEvents,
				toolRegistry: registry,
			},
		);

		const messages = parseMessages(socket);
		const presentationMessages = messages.filter(
			(
				message,
			): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
				message.type === 'presentation.blocks',
		);
		const resolvedMessage = presentationMessages[1];

		expect(resolvedMessage).toBeDefined();
		expect(approvalStore.persistApprovalRequestMock).toHaveBeenCalledTimes(1);
		expect(approvalStore.getPendingApprovalByIdMock).toHaveBeenCalledWith(
			pendingApprovalResult.approval_request.approval_id,
		);
		expect(approvalStore.persistApprovalResolutionMock).toHaveBeenCalledTimes(1);
		expect(executeCount).toBe(1);

		if (resolvedMessage?.type === 'presentation.blocks') {
			expect(resolvedMessage.payload.run_id).toBe('run_ws_bidirectional_approved_1');
			expect(resolvedMessage.payload.trace_id).toBe('trace_ws_bidirectional_approved_1');
			expect(resolvedMessage.payload.blocks.map((block) => block.type)).toEqual([
				'approval_block',
				'tool_result',
				'trace_debug_block',
			]);
			expect(resolvedMessage.payload.blocks[0]).toMatchObject({
				payload: {
					action_kind: 'file_write',
					approval_id: pendingApprovalResult.approval_request.approval_id,
					call_id: 'call_ws_bidirectional_approved_1',
					decision: 'approved',
					status: 'approved',
					summary: pendingApprovalResult.approval_request.summary,
					title: pendingApprovalResult.approval_request.title,
					tool_name: 'file.write',
				},
				type: 'approval_block',
			});
			expect(resolvedMessage.payload.blocks[1]).toMatchObject({
				payload: {
					call_id: 'call_ws_bidirectional_approved_1',
					result_preview: {
						kind: 'object',
						summary_text: 'Object{path, written}',
					},
					status: 'success',
					summary: 'file.write completed successfully.',
					tool_name: 'file.write',
				},
				type: 'tool_result',
			});
			expect(resolvedMessage.payload.blocks[2]).toMatchObject({
				payload: {
					approval_summary: 'Approval granted; replay executed for file write.',
					run_state: 'TOOL_RESULT_INGESTING',
					summary: 'Run replayed file write after approval.',
					title: 'Trace / Debug',
					tool_chain_summary: 'Tool chain: File write.',
				},
				type: 'trace_debug_block',
			});
		}
	});

	it('keeps desktop screenshot approval-gated until approval.resolve approves replay', async () => {
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const approvalStore = createApprovalStore();
		const captureMock = vi.fn(async () =>
			Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 100, 101, 115, 107, 116, 111, 112]),
		);
		const registry = new ToolRegistry();

		registry.register(
			createDesktopScreenshotTool({
				capture: captureMock,
			}),
		);

		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'tool_calls',
									message: {
										role: 'assistant',
										tool_calls: [
											{
												function: {
													arguments: {},
													name: 'desktop.screenshot',
												},
												id: 'call_ws_desktop_screenshot_1',
												type: 'function',
											},
										],
									},
								},
							],
							id: 'chatcmpl_ws_desktop_screenshot_1',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					include_presentation_blocks: true,
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Take a screenshot', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_desktop_screenshot_1',
					trace_id: 'trace_ws_desktop_screenshot_1',
				},
				type: 'run.request',
			}),
			{
				approvalStore: approvalStore.store,
				persistEvents,
				toolRegistry: registry,
			},
		);

		expect(captureMock).toHaveBeenCalledTimes(0);
		expect(approvalStore.persistApprovalRequestMock).toHaveBeenCalledTimes(1);

		const initialPresentationMessages = parseMessages(socket).filter(
			(
				message,
			): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
				message.type === 'presentation.blocks',
		);
		const initialPresentationMessage =
			initialPresentationMessages[initialPresentationMessages.length - 1];

		if (initialPresentationMessage?.type !== 'presentation.blocks') {
			throw new Error('Expected desktop screenshot approval presentation blocks.');
		}

		const approvalBlock = initialPresentationMessage.payload.blocks.find(
			(block): block is Extract<RenderBlock, { type: 'approval_block' }> =>
				block.type === 'approval_block',
		);

		if (!approvalBlock) {
			throw new Error('Expected desktop screenshot approval block.');
		}

		expect(approvalBlock).toMatchObject({
			payload: {
				action_kind: 'tool_execution',
				call_id: 'call_ws_desktop_screenshot_1',
				status: 'pending',
				tool_name: 'desktop.screenshot',
			},
			type: 'approval_block',
		});

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					approval_id: approvalBlock.payload.approval_id,
					decision: 'approved',
					note: 'Need visual confirmation',
				},
				type: 'approval.resolve',
			}),
			{
				approvalStore: approvalStore.store,
				persistEvents,
				toolRegistry: registry,
			},
		);

		expect(captureMock).toHaveBeenCalledTimes(1);
		expect(approvalStore.persistApprovalResolutionMock).toHaveBeenCalledTimes(1);

		const allPresentationMessages = parseMessages(socket).filter(
			(
				message,
			): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
				message.type === 'presentation.blocks',
		);
		const resolvedMessage = allPresentationMessages.find((message) =>
			message.payload.blocks.some(
				(block) =>
					block.type === 'approval_block' &&
					block.payload.approval_id === approvalBlock.payload.approval_id &&
					block.payload.status === 'approved',
			),
		);

		if (resolvedMessage?.type !== 'presentation.blocks') {
			throw new Error('Expected resolved desktop screenshot presentation blocks.');
		}

		expect(resolvedMessage.payload.blocks.map((block) => block.type)).toEqual([
			'approval_block',
			'tool_result',
			'trace_debug_block',
		]);
		expect(resolvedMessage.payload.blocks[0]).toMatchObject({
			payload: {
				action_kind: 'tool_execution',
				call_id: 'call_ws_desktop_screenshot_1',
				decision: 'approved',
				note: 'Need visual confirmation',
				status: 'approved',
				tool_name: 'desktop.screenshot',
			},
			type: 'approval_block',
		});
		expect(resolvedMessage.payload.blocks[1]).toMatchObject({
			payload: {
				call_id: 'call_ws_desktop_screenshot_1',
				status: 'success',
				tool_name: 'desktop.screenshot',
			},
			type: 'tool_result',
		});
	});

	it('replays an approved desktop screenshot through the desktop-agent bridge without breaking approval gating', async () => {
		const runtimeSocket = new MockSocket();
		const desktopAgentSocketA = new MockSocket();
		const desktopAgentSocketB = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const approvalStore = createApprovalStore();
		const desktopAgentBridgeRegistry = new DesktopAgentBridgeRegistry();
		const authContext = createAuthenticatedAuthContext();

		attachDesktopAgentWebSocketHandler(desktopAgentSocketA, {
			auth_context: authContext,
			desktopAgentBridgeRegistry,
		});
		desktopAgentSocketA.emitMessage(
			JSON.stringify({
				payload: {
					agent_id: 'desktop-agent-a',
					capabilities: [
						{
							tool_name: 'desktop.screenshot',
						},
					],
					machine_label: 'Dev Workstation',
					protocol_version: 1,
				},
				type: 'desktop-agent.hello',
			}),
		);
		attachDesktopAgentWebSocketHandler(desktopAgentSocketB, {
			auth_context: authContext,
			desktopAgentBridgeRegistry,
		});
		desktopAgentSocketB.emitMessage(
			JSON.stringify({
				payload: {
					agent_id: 'desktop-agent-b',
					capabilities: [
						{
							tool_name: 'desktop.screenshot',
						},
					],
					machine_label: 'Target Workstation',
					protocol_version: 1,
				},
				type: 'desktop-agent.hello',
			}),
		);
		const targetConnectionId = getLatestDesktopAgentConnectionId(desktopAgentSocketB);

		attachRuntimeWebSocketHandler(runtimeSocket, {
			auth_context: authContext,
			desktopAgentBridgeRegistry,
		});

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'tool_calls',
									message: {
										role: 'assistant',
										tool_calls: [
											{
												function: {
													arguments: {},
													name: 'desktop.screenshot',
												},
												id: 'call_ws_desktop_bridge_1',
												type: 'function',
											},
										],
									},
								},
							],
							id: 'chatcmpl_ws_desktop_bridge_1',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		await handleWebSocketMessage(
			runtimeSocket,
			JSON.stringify({
				payload: {
					desktop_target_connection_id: targetConnectionId,
					include_presentation_blocks: true,
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Take a screenshot from my desktop agent', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_desktop_bridge_1',
					trace_id: 'trace_ws_desktop_bridge_1',
				},
				type: 'run.request',
			}),
			{
				approvalStore: approvalStore.store,
				auth_context: authContext,
				desktopAgentBridgeRegistry,
				persistEvents,
			},
		);

		const initialApprovalMessage = parseMessages(runtimeSocket)
			.filter(
				(
					message,
				): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
					message.type === 'presentation.blocks',
			)
			.at(-1);

		if (initialApprovalMessage?.type !== 'presentation.blocks') {
			throw new Error('Expected desktop screenshot approval blocks before bridge replay.');
		}

		const approvalBlock = initialApprovalMessage.payload.blocks.find(
			(block): block is Extract<RenderBlock, { type: 'approval_block' }> =>
				block.type === 'approval_block',
		);

		if (!approvalBlock) {
			throw new Error('Expected a desktop screenshot approval block before bridge replay.');
		}

		expect(approvalBlock.payload).toMatchObject({
			target_kind: 'tool_call',
			target_label: 'Target Workstation',
		});

		expect(approvalStore.persistApprovalRequestMock).toHaveBeenCalledWith(
			expect.objectContaining({
				pending_tool_call: expect.objectContaining({
					desktop_target_connection_id: targetConnectionId,
				}),
			}),
		);
		expect(desktopAgentSocketA.sentMessages.map((message) => JSON.parse(message).type)).toEqual([
			'desktop-agent.connection.ready',
			'desktop-agent.session.accepted',
		]);
		expect(desktopAgentSocketB.sentMessages.map((message) => JSON.parse(message).type)).toEqual([
			'desktop-agent.connection.ready',
			'desktop-agent.session.accepted',
		]);

		const approvalReplayPromise = handleWebSocketMessage(
			runtimeSocket,
			JSON.stringify({
				payload: {
					approval_id: approvalBlock.payload.approval_id,
					decision: 'approved',
					note: 'Bridge replay approved',
				},
				type: 'approval.resolve',
			}),
			{
				approvalStore: approvalStore.store,
				auth_context: authContext,
				desktopAgentBridgeRegistry,
				persistEvents,
			},
		);

		let desktopAgentExecuteMessage:
			| {
					readonly payload?: {
						readonly request_id?: string;
						readonly [key: string]: unknown;
					};
					readonly type?: string;
			  }
			| undefined;

		for (let attempt = 0; attempt < 5; attempt += 1) {
			desktopAgentExecuteMessage = desktopAgentSocketB.sentMessages
				.map(
					(message) =>
						JSON.parse(message) as {
							readonly payload?: {
								readonly request_id?: string;
								readonly [key: string]: unknown;
							};
							readonly type?: string;
						},
				)
				.find((message) => message.type === 'desktop-agent.execute');

			if (desktopAgentExecuteMessage) {
				break;
			}

			await new Promise((resolve) => setTimeout(resolve, 0));
		}

		expect(desktopAgentExecuteMessage).toBeDefined();
		expect(desktopAgentExecuteMessage).toMatchObject({
			payload: {
				call_id: 'call_ws_desktop_bridge_1',
				run_id: 'run_ws_desktop_bridge_1',
				tool_name: 'desktop.screenshot',
				trace_id: 'trace_ws_desktop_bridge_1',
			},
			type: 'desktop-agent.execute',
		});
		expect(
			desktopAgentSocketA.sentMessages
				.map((message) => JSON.parse(message) as { readonly type?: string })
				.some((message) => message.type === 'desktop-agent.execute'),
		).toBe(false);

		const requestId = desktopAgentExecuteMessage?.payload?.request_id;

		if (typeof requestId !== 'string') {
			throw new Error('Expected desktop-agent.execute to carry a request_id.');
		}

		desktopAgentSocketB.emitMessage(
			JSON.stringify({
				payload: {
					call_id: 'call_ws_desktop_bridge_1',
					output: {
						base64_data: Buffer.from([
							137, 80, 78, 71, 13, 10, 26, 10, 98, 114, 105, 100, 103, 101,
						]).toString('base64'),
						byte_length: 14,
						format: 'png',
						mime_type: 'image/png',
					},
					request_id: requestId,
					status: 'success',
					tool_name: 'desktop.screenshot',
				},
				type: 'desktop-agent.result',
			}),
		);

		await approvalReplayPromise;

		const resolvedPresentationMessage = parseMessages(runtimeSocket)
			.filter(
				(
					message,
				): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
					message.type === 'presentation.blocks',
			)
			.at(-1);

		if (resolvedPresentationMessage?.type !== 'presentation.blocks') {
			throw new Error('Expected bridge-backed desktop screenshot presentation blocks.');
		}

		expect(resolvedPresentationMessage.payload.blocks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					payload: expect.objectContaining({
						target_kind: 'tool_call',
						target_label: 'Target Workstation',
					}),
					type: 'approval_block',
				}),
				expect.objectContaining({
					payload: expect.objectContaining({
						call_id: 'call_ws_desktop_bridge_1',
						status: 'success',
						tool_name: 'desktop.screenshot',
					}),
					type: 'tool_result',
				}),
			]),
		);
	});

	it('routes a targeted desktop click approval replay to the selected desktop agent session', async () => {
		const runtimeSocket = new MockSocket();
		const desktopAgentSocketA = new MockSocket();
		const desktopAgentSocketB = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const approvalStore = createApprovalStore();
		const desktopAgentBridgeRegistry = new DesktopAgentBridgeRegistry();
		const authContext = createAuthenticatedAuthContext();

		attachDesktopAgentWebSocketHandler(desktopAgentSocketA, {
			auth_context: authContext,
			desktopAgentBridgeRegistry,
		});
		desktopAgentSocketA.emitMessage(
			JSON.stringify({
				payload: {
					agent_id: 'desktop-agent-a',
					capabilities: [
						{
							tool_name: 'desktop.click',
						},
					],
					machine_label: 'Background Workstation',
					protocol_version: 1,
				},
				type: 'desktop-agent.hello',
			}),
		);

		attachDesktopAgentWebSocketHandler(desktopAgentSocketB, {
			auth_context: authContext,
			desktopAgentBridgeRegistry,
		});
		desktopAgentSocketB.emitMessage(
			JSON.stringify({
				payload: {
					agent_id: 'desktop-agent-b',
					capabilities: [
						{
							tool_name: 'desktop.click',
						},
					],
					machine_label: 'Target Workstation',
					protocol_version: 1,
				},
				type: 'desktop-agent.hello',
			}),
		);

		const targetConnectionId = getLatestDesktopAgentConnectionId(desktopAgentSocketB);

		attachRuntimeWebSocketHandler(runtimeSocket, {
			auth_context: authContext,
			desktopAgentBridgeRegistry,
		});

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'tool_calls',
									message: {
										role: 'assistant',
										tool_calls: [
											{
												function: {
													arguments: {
														x: 320,
														y: 240,
													},
													name: 'desktop.click',
												},
												id: 'call_ws_desktop_bridge_click_1',
												type: 'function',
											},
										],
									},
								},
							],
							id: 'chatcmpl_ws_desktop_bridge_click_1',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		await handleWebSocketMessage(
			runtimeSocket,
			JSON.stringify({
				payload: {
					desktop_target_connection_id: targetConnectionId,
					include_presentation_blocks: true,
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Click on my selected desktop', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_desktop_bridge_click_1',
					trace_id: 'trace_ws_desktop_bridge_click_1',
				},
				type: 'run.request',
			}),
			{
				approvalStore: approvalStore.store,
				auth_context: authContext,
				desktopAgentBridgeRegistry,
				persistEvents,
			},
		);

		const approvalMessage = parseMessages(runtimeSocket)
			.filter(
				(
					message,
				): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
					message.type === 'presentation.blocks',
			)
			.at(-1);

		if (approvalMessage?.type !== 'presentation.blocks') {
			throw new Error('Expected desktop click approval blocks before bridge replay.');
		}

		const approvalBlock = approvalMessage.payload.blocks.find(
			(block): block is Extract<RenderBlock, { type: 'approval_block' }> =>
				block.type === 'approval_block',
		);

		if (!approvalBlock) {
			throw new Error('Expected a desktop click approval block before bridge replay.');
		}

		expect(approvalBlock.payload).toMatchObject({
			target_kind: 'tool_call',
			target_label: 'Target Workstation',
		});

		const approvalReplayPromise = handleWebSocketMessage(
			runtimeSocket,
			JSON.stringify({
				payload: {
					approval_id: approvalBlock.payload.approval_id,
					decision: 'approved',
					note: 'Desktop click approved',
				},
				type: 'approval.resolve',
			}),
			{
				approvalStore: approvalStore.store,
				auth_context: authContext,
				desktopAgentBridgeRegistry,
				persistEvents,
			},
		);

		let desktopAgentExecuteMessage:
			| {
					readonly payload?: {
						readonly arguments?: unknown;
						readonly request_id?: string;
						readonly [key: string]: unknown;
					};
					readonly type?: string;
			  }
			| undefined;

		for (let attempt = 0; attempt < 5; attempt += 1) {
			desktopAgentExecuteMessage = desktopAgentSocketB.sentMessages
				.map(
					(message) =>
						JSON.parse(message) as {
							readonly payload?: {
								readonly arguments?: unknown;
								readonly request_id?: string;
								readonly [key: string]: unknown;
							};
							readonly type?: string;
						},
				)
				.find((message) => message.type === 'desktop-agent.execute');

			if (desktopAgentExecuteMessage) {
				break;
			}

			await new Promise((resolve) => setTimeout(resolve, 0));
		}

		expect(desktopAgentExecuteMessage).toBeDefined();
		expect(desktopAgentExecuteMessage).toMatchObject({
			payload: {
				arguments: {
					x: 320,
					y: 240,
				},
				call_id: 'call_ws_desktop_bridge_click_1',
				run_id: 'run_ws_desktop_bridge_click_1',
				tool_name: 'desktop.click',
				trace_id: 'trace_ws_desktop_bridge_click_1',
			},
			type: 'desktop-agent.execute',
		});
		expect(
			desktopAgentSocketA.sentMessages
				.map((message) => JSON.parse(message) as { readonly type?: string })
				.some((message) => message.type === 'desktop-agent.execute'),
		).toBe(false);

		const requestId = desktopAgentExecuteMessage?.payload?.request_id;

		if (typeof requestId !== 'string') {
			throw new Error('Expected desktop-agent.execute to carry a request_id.');
		}

		desktopAgentSocketB.emitMessage(
			JSON.stringify({
				payload: {
					call_id: 'call_ws_desktop_bridge_click_1',
					output: {
						button: 'left',
						click_count: 1,
						position: {
							x: 320,
							y: 240,
						},
					},
					request_id: requestId,
					status: 'success',
					tool_name: 'desktop.click',
				},
				type: 'desktop-agent.result',
			}),
		);

		await approvalReplayPromise;

		const resolvedPresentationMessage = parseMessages(runtimeSocket)
			.filter(
				(
					message,
				): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
					message.type === 'presentation.blocks',
			)
			.at(-1);

		if (resolvedPresentationMessage?.type !== 'presentation.blocks') {
			throw new Error('Expected bridge-backed desktop click presentation blocks.');
		}

		expect(resolvedPresentationMessage.payload.blocks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					payload: expect.objectContaining({
						target_kind: 'tool_call',
						target_label: 'Target Workstation',
					}),
					type: 'approval_block',
				}),
				expect.objectContaining({
					payload: expect.objectContaining({
						call_id: 'call_ws_desktop_bridge_click_1',
						status: 'success',
						tool_name: 'desktop.click',
					}),
					type: 'tool_result',
				}),
			]),
		);
	});

	it('keeps a desktop bridge target available when heartbeat ping receives a typed pong reply', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-24T14:00:00.000Z'));
		const desktopAgentSocket = new MockSocket();
		const desktopAgentBridgeRegistry = new DesktopAgentBridgeRegistry({
			heartbeat_interval_ms: 1_000,
			stale_timeout_ms: 2_500,
		});
		const authContext = createAuthenticatedAuthContext();

		attachDesktopAgentWebSocketHandler(desktopAgentSocket, {
			auth_context: authContext,
			desktopAgentBridgeRegistry,
		});
		desktopAgentSocket.emitMessage(
			JSON.stringify({
				payload: {
					agent_id: 'desktop-agent-1',
					capabilities: [
						{
							tool_name: 'desktop.screenshot',
						},
					],
					machine_label: 'Heartbeat Workstation',
					protocol_version: 1,
				},
				type: 'desktop-agent.hello',
			}),
		);

		await vi.advanceTimersByTimeAsync(1_000);
		sendDesktopAgentHeartbeatPong(
			desktopAgentSocket,
			getLatestDesktopAgentHeartbeatPing(desktopAgentSocket),
		);

		const targetConnectionId = getLatestDesktopAgentConnectionId(desktopAgentSocket);
		const targetedInvoker = desktopAgentBridgeRegistry.createInvoker(
			authContext,
			targetConnectionId,
		);

		const invokePromise = targetedInvoker?.invoke(
			{
				arguments: {},
				call_id: 'call_ws_desktop_heartbeat_1',
				tool_name: 'desktop.screenshot',
			},
			{
				run_id: 'run_ws_desktop_heartbeat_1',
				trace_id: 'trace_ws_desktop_heartbeat_1',
			},
		);

		const executeMessage = desktopAgentSocket.sentMessages
			.map(
				(message) =>
					JSON.parse(message) as {
						readonly payload?: {
							readonly request_id?: string;
						};
						readonly type?: string;
					},
			)
			.reverse()
			.find((message) => message.type === 'desktop-agent.execute');

		if (typeof executeMessage?.payload?.request_id !== 'string') {
			throw new Error('Expected desktop-agent.execute after heartbeat pong.');
		}

		desktopAgentSocket.emitMessage(
			JSON.stringify({
				payload: {
					call_id: 'call_ws_desktop_heartbeat_1',
					output: {
						base64_data: Buffer.from([
							137, 80, 78, 71, 13, 10, 26, 10, 112, 111, 110, 103,
						]).toString('base64'),
						byte_length: 12,
						format: 'png',
						mime_type: 'image/png',
					},
					request_id: executeMessage.payload.request_id,
					status: 'success',
					tool_name: 'desktop.screenshot',
				},
				type: 'desktop-agent.result',
			}),
		);

		await expect(invokePromise).resolves.toMatchObject({
			call_id: 'call_ws_desktop_heartbeat_1',
			status: 'success',
			tool_name: 'desktop.screenshot',
		});
		expect(desktopAgentBridgeRegistry.listPresenceSnapshotsForUserId('user_1')).toEqual([
			expect.objectContaining({
				agent_id: 'desktop-agent-1',
				machine_label: 'Heartbeat Workstation',
			}),
		]);
	});

	it('rejects desktop approval replay when desktop_target_connection_id does not match an active session', async () => {
		const runtimeSocket = new MockSocket();
		const desktopAgentSocket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const approvalStore = createApprovalStore();
		const desktopAgentBridgeRegistry = new DesktopAgentBridgeRegistry();
		const authContext = createAuthenticatedAuthContext();

		attachDesktopAgentWebSocketHandler(desktopAgentSocket, {
			auth_context: authContext,
			desktopAgentBridgeRegistry,
		});
		desktopAgentSocket.emitMessage(
			JSON.stringify({
				payload: {
					agent_id: 'desktop-agent-1',
					capabilities: [
						{
							tool_name: 'desktop.screenshot',
						},
					],
					machine_label: 'Only Workstation',
					protocol_version: 1,
				},
				type: 'desktop-agent.hello',
			}),
		);

		attachRuntimeWebSocketHandler(runtimeSocket, {
			auth_context: authContext,
			desktopAgentBridgeRegistry,
		});

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'tool_calls',
									message: {
										role: 'assistant',
										tool_calls: [
											{
												function: {
													arguments: {},
													name: 'desktop.screenshot',
												},
												id: 'call_ws_desktop_bridge_invalid_target_1',
												type: 'function',
											},
										],
									},
								},
							],
							id: 'chatcmpl_ws_desktop_bridge_invalid_target_1',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		await handleWebSocketMessage(
			runtimeSocket,
			JSON.stringify({
				payload: {
					desktop_target_connection_id: 'desktop-connection-missing',
					include_presentation_blocks: true,
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Take a screenshot from a missing desktop agent', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_desktop_bridge_invalid_target_1',
					trace_id: 'trace_ws_desktop_bridge_invalid_target_1',
				},
				type: 'run.request',
			}),
			{
				approvalStore: approvalStore.store,
				auth_context: authContext,
				desktopAgentBridgeRegistry,
				persistEvents,
			},
		);

		const approvalMessage = parseMessages(runtimeSocket)
			.filter(
				(
					message,
				): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
					message.type === 'presentation.blocks',
			)
			.at(-1);

		if (approvalMessage?.type !== 'presentation.blocks') {
			throw new Error('Expected desktop screenshot approval blocks before invalid target replay.');
		}

		const approvalBlock = approvalMessage.payload.blocks.find(
			(block): block is Extract<RenderBlock, { type: 'approval_block' }> =>
				block.type === 'approval_block',
		);

		if (!approvalBlock) {
			throw new Error('Expected a desktop screenshot approval block before invalid target replay.');
		}

		await handleWebSocketMessage(
			runtimeSocket,
			JSON.stringify({
				payload: {
					approval_id: approvalBlock.payload.approval_id,
					decision: 'approved',
				},
				type: 'approval.resolve',
			}),
			{
				approvalStore: approvalStore.store,
				auth_context: authContext,
				desktopAgentBridgeRegistry,
				persistEvents,
			},
		);

		expect(
			desktopAgentSocket.sentMessages
				.map((message) => JSON.parse(message) as { readonly type?: string })
				.some((message) => message.type === 'desktop-agent.execute'),
		).toBe(false);

		const resolvedPresentationMessage = parseMessages(runtimeSocket)
			.filter(
				(
					message,
				): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
					message.type === 'presentation.blocks',
			)
			.at(-1);

		if (resolvedPresentationMessage?.type !== 'presentation.blocks') {
			throw new Error('Expected desktop invalid target replay to emit presentation blocks.');
		}

		expect(resolvedPresentationMessage.payload.blocks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: 'approval_block',
				}),
				expect.objectContaining({
					payload: expect.objectContaining({
						call_id: 'call_ws_desktop_bridge_invalid_target_1',
						error_code: 'EXECUTION_FAILED',
						status: 'error',
						tool_name: 'desktop.screenshot',
					}),
					type: 'tool_result',
				}),
			]),
		);
	});

	it('does not replay a rejected pending tool call after approval.resolve', async () => {
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {});
		const approvalStore = createApprovalStore();
		const registry = new ToolRegistry();
		let executeCount = 0;

		registry.register(
			createFakeTool(
				'shell.exec',
				async () => {
					executeCount += 1;

					return {
						call_id: 'call_ws_bidirectional_rejected_1',
						output: {
							stdout: 'should not run',
						},
						status: 'success',
						tool_name: 'shell.exec',
					};
				},
				{
					requires_approval: true,
					risk_level: 'high',
					side_effect_level: 'execute',
				},
			),
		);

		const pendingApprovalResult = await runToolStep({
			current_state: 'MODEL_THINKING',
			event_context: {
				sequence_start: 21,
			},
			execution_context: createExecutionContext({
				run_id: 'run_ws_bidirectional_rejected_1',
				trace_id: 'trace_ws_bidirectional_rejected_1',
			}),
			registry,
			run_id: 'run_ws_bidirectional_rejected_1',
			tool_input: {
				arguments: {
					command: 'git status',
				},
				call_id: 'call_ws_bidirectional_rejected_1',
				tool_name: 'shell.exec',
			},
			tool_name: 'shell.exec',
			trace_id: 'trace_ws_bidirectional_rejected_1',
		});

		expect(pendingApprovalResult.status).toBe('approval_required');

		if (pendingApprovalResult.status !== 'approval_required') {
			throw new Error('Expected approval request for bidirectional rejected test.');
		}

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'stop',
									message: {
										content: 'Hello over websocket',
										role: 'assistant',
									},
								},
							],
							id: 'chatcmpl_ws_approval_bidirectional_rejected',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					include_presentation_blocks: true,
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Hello', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_bidirectional_rejected_transport_1',
					trace_id: 'trace_ws_bidirectional_rejected_transport_1',
				},
				type: 'run.request',
			}),
			{
				approvalStore: approvalStore.store,
				getApprovalPresentationInputs: async () => [
					{
						kind: 'request_result',
						pending_tool_call: {
							tool_input: {
								command: 'git status',
							},
							working_directory: 'd:\\ai\\Runa',
						},
						result: pendingApprovalResult,
					},
				],
				persistEvents,
			},
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					approval_id: pendingApprovalResult.approval_request.approval_id,
					decision: 'rejected',
					note: 'Risk too high',
				},
				type: 'approval.resolve',
			}),
			{
				approvalStore: approvalStore.store,
				persistEvents,
				toolRegistry: registry,
			},
		);

		const messages = parseMessages(socket);
		const presentationMessages = messages.filter(
			(
				message,
			): message is Extract<WebSocketServerBridgeMessage, { type: 'presentation.blocks' }> =>
				message.type === 'presentation.blocks',
		);
		const resolvedMessage = presentationMessages[1];
		const finishedMessage = messages.at(-1);

		expect(resolvedMessage).toBeDefined();
		expect(approvalStore.persistApprovalRequestMock).toHaveBeenCalledTimes(1);
		expect(approvalStore.getPendingApprovalByIdMock).toHaveBeenCalledWith(
			pendingApprovalResult.approval_request.approval_id,
		);
		expect(approvalStore.persistApprovalResolutionMock).toHaveBeenCalledTimes(1);
		expect(executeCount).toBe(0);
		expect(finishedMessage).toMatchObject({
			payload: {
				error_message: 'Approval rejected for shell.exec: Risk too high',
				final_state: 'FAILED',
				run_id: 'run_ws_bidirectional_rejected_1',
				status: 'failed',
				trace_id: 'trace_ws_bidirectional_rejected_1',
			},
			type: 'run.finished',
		});

		if (resolvedMessage?.type === 'presentation.blocks') {
			expect(resolvedMessage.payload.blocks.map((block) => block.type)).toEqual([
				'approval_block',
				'trace_debug_block',
			]);
			expect(resolvedMessage.payload.blocks[0]).toMatchObject({
				payload: {
					action_kind: 'shell_execution',
					approval_id: pendingApprovalResult.approval_request.approval_id,
					call_id: 'call_ws_bidirectional_rejected_1',
					decision: 'rejected',
					note: 'Risk too high',
					status: 'rejected',
					summary: pendingApprovalResult.approval_request.summary,
					title: pendingApprovalResult.approval_request.title,
					tool_name: 'shell.exec',
				},
				type: 'approval_block',
			});
			expect(resolvedMessage.payload.blocks[1]).toMatchObject({
				payload: {
					approval_summary: 'Approval rejected for shell execution.',
					run_state: 'FAILED',
					summary: 'Run stopped after approval rejection.',
					title: 'Trace / Debug',
					warning_notes: [
						'Approval was rejected; the requested action was not replayed.',
						'Risk too high',
					],
				},
				type: 'trace_debug_block',
			});
		}
	});

	it('rejects invalid run.request payloads before sending run.accepted', async () => {
		const socket = new MockSocket();

		attachRuntimeWebSocketHandler(socket);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						messages: [{ content: 'Hello', role: 'user' }],
					},
					run_id: 'run_invalid_request_1',
				},
				type: 'run.request',
			}),
		);

		const messages = parseMessages(socket);

		expect(messages.map((message) => message.type)).toEqual(['connection.ready', 'run.rejected']);

		if (messages[1]?.type === 'run.rejected') {
			expect(messages[1].payload.error_message).toBe('Unsupported or invalid WebSocket message.');
			expect(messages[1].payload.run_id).toBeUndefined();
			expect(messages[1].payload.trace_id).toBeUndefined();
		}
	});

	it('rejects invalid inspection.request payloads with run.rejected', async () => {
		const socket = new MockSocket();

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					run_id: 'run_invalid_inspection_1',
					target_kind: 'raw_event_viewer',
				},
				type: 'inspection.request',
			}),
		);

		expect(parseMessages(socket).map((message) => message.type)).toEqual(['run.rejected']);
	});

	it('rejects invalid approval.resolve payloads with run.rejected', async () => {
		const socket = new MockSocket();

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					approval_id: 'approval_invalid_1',
					decision: 'expired',
				},
				type: 'approval.resolve',
			}),
		);

		expect(parseMessages(socket).map((message) => message.type)).toEqual(['run.rejected']);
	});

	it('rejects approval.resolve when the pending approval is unknown', async () => {
		const socket = new MockSocket();
		const approvalStore = createApprovalStore();

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					approval_id: 'approval_missing_1',
					decision: 'approved',
				},
				type: 'approval.resolve',
			}),
			{
				approvalStore: approvalStore.store,
			},
		);

		const messages = parseMessages(socket);

		expect(messages.map((message) => message.type)).toEqual(['run.rejected']);

		if (messages[0]?.type === 'run.rejected') {
			expect(messages[0].payload.error_message).toContain('Pending approval not found');
		}
	});

	it('sends run.rejected for invalid JSON', async () => {
		const socket = new MockSocket();

		attachRuntimeWebSocketHandler(socket);

		await handleWebSocketMessage(socket, '{');

		expect(parseMessages(socket).map((message) => message.type)).toEqual([
			'connection.ready',
			'run.rejected',
		]);
	});

	it('sends run.rejected when orchestration throws', async () => {
		const socket = new MockSocket();

		attachRuntimeWebSocketHandler(socket);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					provider: 'groq',
					provider_config: {
						apiKey: '   ',
					},
					request: {
						messages: [{ content: 'Hello', role: 'user' }],
					},
					run_id: 'run_ws_error',
					trace_id: 'trace_ws_error',
				},
				type: 'run.request',
			}),
		);

		const messages = parseMessages(socket);

		expect(messages[0]?.type).toBe('connection.ready');
		expect(messages[1]?.type).toBe('run.accepted');
		expect(messages.at(-1)?.type).toBe('run.rejected');
		expect(messages.some((message) => message.type === 'runtime.event')).toBe(true);
	});

	it('sends run.rejected when persistence fails after runtime.event delivery starts', async () => {
		const socket = new MockSocket();
		const persistEvents = vi.fn(async (_events: readonly RuntimeEvent[]) => {
			throw new Error('db unavailable');
		});

		attachRuntimeWebSocketHandler(socket);

		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'stop',
									message: {
										content: 'Hello over websocket',
										role: 'assistant',
									},
								},
							],
							id: 'chatcmpl_ws_persist_error',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		await handleWebSocketMessage(
			socket,
			JSON.stringify({
				payload: {
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Hello', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_persist_error',
					trace_id: 'trace_ws_persist_error',
				},
				type: 'run.request',
			}),
			{
				persistEvents,
			},
		);

		expect(parseMessages(socket).map((message) => message.type)).toEqual([
			'connection.ready',
			'run.accepted',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'runtime.event',
			'run.rejected',
		]);
	});

	it('returns a typed run.rejected reason when the ws run-start rate limit is exceeded for the same user', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [
								{
									finish_reason: 'stop',
									message: {
										content: 'Hello over websocket',
										role: 'assistant',
									},
								},
							],
							id: 'chatcmpl_ws_rate_limit',
							model: 'llama-3.3-70b-versatile',
							usage: {
								completion_tokens: 12,
								prompt_tokens: 8,
								total_tokens: 20,
							},
						}),
						{
							headers: {
								'content-type': 'application/json',
							},
							status: 200,
						},
					),
			),
		);

		const authContext = {
			bearer_token_present: true,
			principal: {
				kind: 'authenticated',
				provider: 'supabase',
				role: 'authenticated',
				scope: {
					tenant_id: 'tenant_rate_limit',
					workspace_id: 'workspace_rate_limit',
					workspace_ids: ['workspace_rate_limit'],
				},
				session_id: 'session_rate_limit',
				user_id: 'user_rate_limit',
			},
			request_id: 'req_rate_limit',
			transport: 'websocket',
		} as const;
		const subscriptionContext = {
			entitlements: [],
			effective_tier: 'free',
			evaluated_at: '2026-04-23T12:00:00.000Z',
			quotas: [],
			scope: {
				kind: 'workspace',
				subject_id: 'workspace_rate_limit',
				tenant_id: 'tenant_rate_limit',
				user_id: 'user_rate_limit',
				workspace_id: 'workspace_rate_limit',
			},
			status: 'active',
		} as const;
		const conversationStore = {
			appendConversationMessage: vi.fn(async (input) => ({
				content: input.content,
				conversation_id: input.conversation_id,
				created_at: input.created_at ?? '2026-04-23T12:00:00.000Z',
				message_id: `message_${input.conversation_id}`,
				role: input.role,
				run_id: input.run_id,
				sequence_no: 1,
				trace_id: input.trace_id,
			})),
			ensureConversation: vi.fn(async (input) => ({
				access_role: 'owner' as const,
				conversation_id: input.conversation_id ?? 'conversation_rate_limit',
				created_at: input.created_at ?? '2026-04-23T12:00:00.000Z',
				last_message_at: input.created_at ?? '2026-04-23T12:00:00.000Z',
				last_message_preview: input.initial_preview ?? 'Hello',
				owner_user_id: 'user_rate_limit',
				title: 'Rate limit test',
				updated_at: input.created_at ?? '2026-04-23T12:00:00.000Z',
			})),
		};

		for (let attempt = 0; attempt < 5; attempt += 1) {
			const socket = new MockSocket();

			attachRuntimeWebSocketHandler(socket, {
				auth_context: authContext,
				subscription_context: subscriptionContext,
			});

			await handleWebSocketMessage(
				socket,
				JSON.stringify({
					payload: {
						provider: 'groq',
						provider_config: {
							apiKey: 'groq-key',
						},
						request: {
							max_output_tokens: 64,
							messages: [{ content: `Hello ${attempt}`, role: 'user' }],
							model: 'llama-3.3-70b-versatile',
						},
						run_id: `run_ws_rate_limit_${attempt}`,
						trace_id: `trace_ws_rate_limit_${attempt}`,
					},
					type: 'run.request',
				}),
				{
					auth_context: authContext,
					conversationStore,
					subscription_context: subscriptionContext,
				},
			);

			expect(parseMessages(socket).map((message) => message.type)).toContain('run.accepted');
		}

		const limitedSocket = new MockSocket();

		attachRuntimeWebSocketHandler(limitedSocket, {
			auth_context: authContext,
			subscription_context: subscriptionContext,
		});

		await handleWebSocketMessage(
			limitedSocket,
			JSON.stringify({
				payload: {
					provider: 'groq',
					provider_config: {
						apiKey: 'groq-key',
					},
					request: {
						max_output_tokens: 64,
						messages: [{ content: 'Hello overflow', role: 'user' }],
						model: 'llama-3.3-70b-versatile',
					},
					run_id: 'run_ws_rate_limit_overflow',
					trace_id: 'trace_ws_rate_limit_overflow',
				},
				type: 'run.request',
			}),
			{
				auth_context: authContext,
				conversationStore,
				subscription_context: subscriptionContext,
			},
		);

		const messages = parseMessages(limitedSocket);

		expect(messages.map((message) => message.type)).toEqual(['connection.ready', 'run.rejected']);

		if (messages[1]?.type === 'run.rejected') {
			expect(messages[1].payload).toMatchObject({
				error_name: 'UsageQuotaError',
				reject_reason: {
					kind: 'rate_limited',
					limit: 5,
					metric: 'monthly_turns',
					scope: 'ws_run_request',
					tier: 'free',
					window: 'minute',
				},
				run_id: 'run_ws_rate_limit_overflow',
				trace_id: 'trace_ws_rate_limit_overflow',
			});
			expect(messages[1].payload.error_message).toContain('Rate limit exhausted');
		}
	});
});
