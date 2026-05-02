import {
	type ApprovalRecord,
	type NewApprovalRecord,
	approvalsTable,
	createDatabaseConnection,
	ensureDatabaseSchema,
} from '@runa/db';
import type {
	ApprovalRequest,
	ApprovalResolution,
	ApprovalTarget,
	AuthContext,
	RunRequestPayload,
	ToolCallInput,
	ToolResult,
} from '@runa/types';
import { isRunRequestPayload } from '@runa/types';

import { resolvePersistenceDatabaseUrl } from './database-config.js';

export class ApprovalStoreConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ApprovalStoreConfigurationError';
	}
}

export class ApprovalStoreReadError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'ApprovalStoreReadError';
	}
}

export class ApprovalStoreWriteError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'ApprovalStoreWriteError';
	}
}

export interface PendingApprovalEntry {
	readonly approval_request: ApprovalRequest;
	readonly auto_continue_context?: PendingApprovalContinuationContext;
	readonly next_sequence_no: number;
	readonly pending_tool_call?: PendingApprovalToolCall;
}

export interface PendingApprovalToolCall {
	readonly desktop_target_connection_id?: string;
	readonly tool_input: ToolCallInput['arguments'];
	readonly working_directory?: string;
}

export interface PendingApprovalContinuationContext {
	readonly payload: RunRequestPayload;
	readonly tool_result?: ToolResult;
	readonly tool_result_history?: readonly ToolResult[];
	readonly turn_count: number;
	readonly working_directory: string;
}

export interface ApprovalPersistenceScope {
	readonly session_id?: string;
	readonly tenant_id?: string;
	readonly user_id?: string;
	readonly workspace_id?: string;
}

export interface ApprovalRecordWriter {
	getPendingApprovalById(approval_id: string): Promise<ApprovalRecord | null>;
	upsertApproval(record: NewApprovalRecord): Promise<void>;
}

export interface PersistApprovalRequestInput {
	readonly approval_request: ApprovalRequest;
	readonly auto_continue_context?: PendingApprovalContinuationContext;
	readonly next_sequence_no?: number;
	readonly pending_tool_call?: PendingApprovalToolCall;
	readonly scope?: ApprovalPersistenceScope;
}

export interface PersistApprovalResolutionInput {
	readonly approval_request: ApprovalRequest;
	readonly approval_resolution: ApprovalResolution;
	readonly auto_continue_context?: PendingApprovalContinuationContext;
	readonly next_sequence_no?: number;
	readonly pending_tool_call?: PendingApprovalToolCall;
	readonly scope?: ApprovalPersistenceScope;
}

export interface ApprovalStore {
	getPendingApprovalById(approval_id: string): Promise<PendingApprovalEntry | null>;
	persistApprovalRequest(input: PersistApprovalRequestInput): Promise<void>;
	persistApprovalResolution(input: PersistApprovalResolutionInput): Promise<void>;
}

interface PersistOptions {
	readonly writer?: ApprovalRecordWriter;
}

interface PersistedDesktopTargetMetadata {
	readonly desktop_target_connection_id?: unknown;
}

class DatabaseApprovalRecordWriter implements ApprovalRecordWriter {
	#client: ReturnType<typeof createDatabaseConnection>['client'];
	#db: ReturnType<typeof createDatabaseConnection>['db'];
	#ready: Promise<void>;

	constructor(databaseUrl: string) {
		const connection = createDatabaseConnection(databaseUrl);
		this.#client = connection.client;
		this.#db = connection.db;
		this.#ready = ensureDatabaseSchema(connection);
	}

	async getPendingApprovalById(approval_id: string): Promise<ApprovalRecord | null> {
		await this.#ready;

		const records = await this.#client<ApprovalRecord[]>`
			SELECT
				approval_id,
				run_id,
				trace_id,
				tenant_id,
				workspace_id,
				user_id,
				action_kind,
				status,
				title,
				summary,
				tool_name,
				call_id,
				continuation_context,
				risk_level,
				requires_reason,
				target_kind,
				target_label,
				tool_input,
				requested_at,
				next_sequence_no,
				decision,
				note,
				resolved_at,
				session_id,
				working_directory,
				created_at,
				updated_at
			FROM approvals
			WHERE approval_id = ${approval_id}
				AND status = 'pending'
			LIMIT 1
		`;

		return records[0] ?? null;
	}

	async upsertApproval(record: NewApprovalRecord): Promise<void> {
		await this.#ready;
		await this.#db
			.insert(approvalsTable)
			.values(record)
			.onConflictDoUpdate({
				set: {
					action_kind: record.action_kind,
					call_id: record.call_id,
					continuation_context: record.continuation_context,
					decision: record.decision,
					next_sequence_no: record.next_sequence_no,
					note: record.note,
					requested_at: record.requested_at,
					requires_reason: record.requires_reason,
					resolved_at: record.resolved_at,
					risk_level: record.risk_level,
					run_id: record.run_id,
					session_id: record.session_id,
					status: record.status,
					summary: record.summary,
					target_kind: record.target_kind,
					target_label: record.target_label,
					title: record.title,
					tool_input: record.tool_input,
					tool_name: record.tool_name,
					trace_id: record.trace_id,
					updated_at: record.updated_at,
					working_directory: record.working_directory,
				},
				target: approvalsTable.approval_id,
			});
	}
}

let defaultWriterPromise: Promise<ApprovalRecordWriter> | null = null;

function getDatabaseUrl(): string {
	return resolvePersistenceDatabaseUrl(
		(message) => new ApprovalStoreConfigurationError(message),
		'DATABASE_URL is required for approval persistence.',
	);
}

async function getDefaultWriter(): Promise<ApprovalRecordWriter> {
	if (!defaultWriterPromise) {
		defaultWriterPromise = Promise.resolve(new DatabaseApprovalRecordWriter(getDatabaseUrl()));
	}

	try {
		return await defaultWriterPromise;
	} catch (error) {
		defaultWriterPromise = null;
		throw error;
	}
}

function normalizeNextSequenceNo(nextSequenceNo: number | undefined): number {
	return typeof nextSequenceNo === 'number' && nextSequenceNo > 0 ? nextSequenceNo : 1;
}

function toApprovalTarget(record: ApprovalRecord): ApprovalTarget | undefined {
	if (!record.target_kind || !record.target_label) {
		return undefined;
	}

	return {
		call_id: record.call_id ?? undefined,
		kind: record.target_kind,
		label: record.target_label,
		tool_name: record.tool_name ?? undefined,
	};
}

function toNullableScopeValue(value: string | undefined): string | null {
	return value?.trim() ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeDesktopTargetConnectionId(value: string | undefined): string | undefined {
	const trimmedValue = value?.trim();

	return trimmedValue && trimmedValue.length > 0 ? trimmedValue : undefined;
}

function isToolResult(value: unknown): value is ToolResult {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const candidate = value as {
		readonly call_id?: unknown;
		readonly status?: unknown;
		readonly tool_name?: unknown;
	};

	return (
		typeof candidate.call_id === 'string' &&
		typeof candidate.tool_name === 'string' &&
		(candidate.status === 'success' || candidate.status === 'error')
	);
}

function isPendingApprovalContinuationContext(
	value: unknown,
): value is PendingApprovalContinuationContext {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const candidate = value as {
		readonly payload?: unknown;
		readonly tool_result?: unknown;
		readonly tool_result_history?: unknown;
		readonly turn_count?: unknown;
		readonly working_directory?: unknown;
	};
	const hasValidToolResultHistory =
		candidate.tool_result_history === undefined ||
		(Array.isArray(candidate.tool_result_history) &&
			candidate.tool_result_history.every((toolResult) => isToolResult(toolResult)));

	return (
		isRunRequestPayload(candidate.payload) &&
		(candidate.tool_result === undefined || isToolResult(candidate.tool_result)) &&
		hasValidToolResultHistory &&
		typeof candidate.turn_count === 'number' &&
		Number.isInteger(candidate.turn_count) &&
		candidate.turn_count >= 0 &&
		typeof candidate.working_directory === 'string' &&
		candidate.working_directory.trim().length > 0
	);
}

function isPersistedDesktopTargetMetadata(value: unknown): value is PersistedDesktopTargetMetadata {
	return isRecord(value);
}

function extractDesktopTargetConnectionId(
	value: unknown,
): PendingApprovalToolCall['desktop_target_connection_id'] {
	if (isPendingApprovalContinuationContext(value)) {
		return sanitizeDesktopTargetConnectionId(value.payload.desktop_target_connection_id);
	}

	if (!isPersistedDesktopTargetMetadata(value)) {
		return undefined;
	}

	return typeof value.desktop_target_connection_id === 'string'
		? sanitizeDesktopTargetConnectionId(value.desktop_target_connection_id)
		: undefined;
}

function getProviderApiKeyEnvironmentVariableName(provider: RunRequestPayload['provider']): string {
	switch (provider) {
		case 'claude':
			return 'ANTHROPIC_API_KEY';
		case 'deepseek':
			return 'DEEPSEEK_API_KEY';
		case 'gemini':
			return 'GEMINI_API_KEY';
		case 'groq':
			return 'GROQ_API_KEY';
		case 'openai':
			return 'OPENAI_API_KEY';
		case 'sambanova':
			return 'SAMBANOVA_API_KEY';
	}
}

function resolveProviderApiKeyFromEnvironment(
	provider: RunRequestPayload['provider'],
): string | undefined {
	const envKeyName = getProviderApiKeyEnvironmentVariableName(provider);
	const resolvedValue = process.env[envKeyName];

	return typeof resolvedValue === 'string' && resolvedValue.trim().length > 0
		? resolvedValue
		: undefined;
}

function buildPersistedProviderConfig(
	payload: RunRequestPayload,
): RunRequestPayload['provider_config'] {
	return {
		apiKey:
			resolveProviderApiKeyFromEnvironment(payload.provider) === undefined
				? payload.provider_config.apiKey
				: '',
		...(typeof payload.provider_config.baseUrl === 'string' &&
		payload.provider_config.baseUrl.trim().length > 0
			? {
					baseUrl: payload.provider_config.baseUrl.trim(),
				}
			: {}),
		...(payload.request.model === undefined &&
		typeof payload.provider_config.defaultModel === 'string'
			? {
					defaultModel: payload.provider_config.defaultModel,
				}
			: {}),
		...(payload.request.max_output_tokens === undefined &&
		typeof payload.provider_config.defaultMaxOutputTokens === 'number'
			? {
					defaultMaxOutputTokens: payload.provider_config.defaultMaxOutputTokens,
				}
			: {}),
	};
}

function sanitizeRunRequestPayloadForPersistence(payload: RunRequestPayload): RunRequestPayload {
	return {
		...payload,
		provider_config: buildPersistedProviderConfig(payload),
	};
}

function sanitizeContinuationContextForPersistence(
	context: PendingApprovalContinuationContext | undefined,
): PendingApprovalContinuationContext | undefined {
	if (context === undefined) {
		return undefined;
	}

	return {
		...context,
		payload: sanitizeRunRequestPayloadForPersistence(context.payload),
	};
}

function buildContinuationContextForPersistence(
	context: PendingApprovalContinuationContext | undefined,
	pendingToolCall: PendingApprovalToolCall | undefined,
):
	| PendingApprovalContinuationContext
	| Readonly<{ desktop_target_connection_id: string }>
	| undefined {
	const sanitizedContext = sanitizeContinuationContextForPersistence(context);

	if (sanitizedContext !== undefined) {
		return sanitizedContext;
	}

	const desktopTargetConnectionId = sanitizeDesktopTargetConnectionId(
		pendingToolCall?.desktop_target_connection_id,
	);

	return desktopTargetConnectionId === undefined
		? undefined
		: {
				desktop_target_connection_id: desktopTargetConnectionId,
			};
}

function getPrincipalSessionId(authContext: AuthContext): string | undefined {
	if (authContext.session?.session_id) {
		return authContext.session.session_id;
	}

	if (authContext.principal.kind === 'authenticated' || authContext.principal.kind === 'service') {
		return authContext.principal.session_id;
	}

	return authContext.claims?.session_id;
}

export function approvalPersistenceScopeFromAuthContext(
	authContext: AuthContext | undefined,
): ApprovalPersistenceScope | undefined {
	if (!authContext) {
		return undefined;
	}

	const principal = authContext.principal;
	const sessionId =
		getPrincipalSessionId(authContext) ??
		(principal.kind === 'authenticated'
			? `user:${principal.user_id}`
			: principal.kind === 'service'
				? `service:${principal.service_name}`
				: undefined);

	return {
		session_id: sessionId,
		tenant_id: principal.scope.tenant_id,
		user_id:
			principal.kind === 'authenticated'
				? principal.user_id
				: (authContext.session?.user_id ?? authContext.user?.user_id),
		workspace_id: principal.scope.workspace_id,
	};
}

function toPendingApprovalEntry(record: ApprovalRecord): PendingApprovalEntry {
	const continuationContext = isPendingApprovalContinuationContext(record.continuation_context)
		? sanitizeContinuationContextForPersistence(record.continuation_context)
		: undefined;
	const desktopTargetConnectionId = extractDesktopTargetConnectionId(record.continuation_context);

	return {
		approval_request: {
			action_kind: record.action_kind,
			approval_id: record.approval_id,
			call_id: record.call_id ?? undefined,
			requested_at: record.requested_at,
			requires_reason: record.requires_reason ?? undefined,
			risk_level: record.risk_level ?? undefined,
			run_id: record.run_id,
			status: 'pending',
			summary: record.summary,
			target: toApprovalTarget(record),
			title: record.title,
			tool_name: record.tool_name ?? undefined,
			trace_id: record.trace_id,
		},
		auto_continue_context: continuationContext,
		next_sequence_no: record.next_sequence_no,
		pending_tool_call:
			record.tool_input !== null
				? {
						desktop_target_connection_id: desktopTargetConnectionId,
						tool_input: record.tool_input,
						working_directory: record.working_directory ?? undefined,
					}
				: undefined,
	};
}

function toApprovalRequestRecord(input: PersistApprovalRequestInput): NewApprovalRecord {
	const requestedAt = input.approval_request.requested_at;
	const sanitizedContinuationContext = buildContinuationContextForPersistence(
		input.auto_continue_context,
		input.pending_tool_call,
	);

	return {
		action_kind: input.approval_request.action_kind,
		approval_id: input.approval_request.approval_id,
		call_id: input.approval_request.call_id ?? null,
		created_at: requestedAt,
		decision: null,
		next_sequence_no: normalizeNextSequenceNo(input.next_sequence_no),
		note: null,
		requested_at: requestedAt,
		requires_reason: input.approval_request.requires_reason ?? null,
		resolved_at: null,
		risk_level: input.approval_request.risk_level ?? null,
		run_id: input.approval_request.run_id,
		session_id: toNullableScopeValue(input.scope?.session_id),
		status: input.approval_request.status,
		summary: input.approval_request.summary,
		target_kind: input.approval_request.target?.kind ?? null,
		target_label: input.approval_request.target?.label ?? null,
		tenant_id: toNullableScopeValue(input.scope?.tenant_id),
		title: input.approval_request.title,
		continuation_context: sanitizedContinuationContext ?? null,
		tool_input: input.pending_tool_call?.tool_input ?? null,
		tool_name: input.approval_request.tool_name ?? null,
		trace_id: input.approval_request.trace_id,
		updated_at: requestedAt,
		user_id: toNullableScopeValue(input.scope?.user_id),
		workspace_id: toNullableScopeValue(input.scope?.workspace_id),
		working_directory: input.pending_tool_call?.working_directory ?? null,
	};
}

function toApprovalResolutionRecord(input: PersistApprovalResolutionInput): NewApprovalRecord {
	const resolvedAt = input.approval_resolution.decision.resolved_at;
	const sanitizedContinuationContext = buildContinuationContextForPersistence(
		input.auto_continue_context,
		input.pending_tool_call,
	);

	return {
		action_kind: input.approval_request.action_kind,
		approval_id: input.approval_request.approval_id,
		call_id: input.approval_request.call_id ?? null,
		created_at: input.approval_request.requested_at,
		decision: input.approval_resolution.decision.decision,
		next_sequence_no: normalizeNextSequenceNo(input.next_sequence_no),
		note:
			input.approval_resolution.decision.note ?? input.approval_resolution.decision.reason ?? null,
		requested_at: input.approval_request.requested_at,
		requires_reason: input.approval_request.requires_reason ?? null,
		resolved_at: resolvedAt,
		risk_level: input.approval_request.risk_level ?? null,
		run_id: input.approval_request.run_id,
		session_id: toNullableScopeValue(input.scope?.session_id),
		status: input.approval_resolution.final_status,
		summary: input.approval_request.summary,
		target_kind: input.approval_request.target?.kind ?? null,
		target_label: input.approval_request.target?.label ?? null,
		tenant_id: toNullableScopeValue(input.scope?.tenant_id),
		title: input.approval_request.title,
		continuation_context: sanitizedContinuationContext ?? null,
		tool_input: input.pending_tool_call?.tool_input ?? null,
		tool_name: input.approval_request.tool_name ?? null,
		trace_id: input.approval_request.trace_id,
		updated_at: resolvedAt,
		user_id: toNullableScopeValue(input.scope?.user_id),
		workspace_id: toNullableScopeValue(input.scope?.workspace_id),
		working_directory: input.pending_tool_call?.working_directory ?? null,
	};
}

export class DatabaseApprovalStore implements ApprovalStore {
	readonly #writer: ApprovalRecordWriter;

	constructor(writer?: ApprovalRecordWriter) {
		this.#writer = writer ?? new DatabaseApprovalRecordWriter(getDatabaseUrl());
	}

	getPendingApprovalById(approval_id: string): Promise<PendingApprovalEntry | null> {
		return getPendingApprovalById(approval_id, { writer: this.#writer });
	}

	persistApprovalRequest(input: PersistApprovalRequestInput): Promise<void> {
		return persistApprovalRequest(input, { writer: this.#writer });
	}

	persistApprovalResolution(input: PersistApprovalResolutionInput): Promise<void> {
		return persistApprovalResolution(input, { writer: this.#writer });
	}
}

export async function persistApprovalRequest(
	input: PersistApprovalRequestInput,
	options: PersistOptions = {},
): Promise<void> {
	const writer = options.writer ?? (await getDefaultWriter());

	try {
		await writer.upsertApproval(toApprovalRequestRecord(input));
	} catch (error) {
		if (
			error instanceof ApprovalStoreConfigurationError ||
			error instanceof ApprovalStoreWriteError
		) {
			throw error;
		}

		throw new ApprovalStoreWriteError('Failed to persist approval request.', {
			cause: error,
		});
	}
}

export async function persistApprovalResolution(
	input: PersistApprovalResolutionInput,
	options: PersistOptions = {},
): Promise<void> {
	const writer = options.writer ?? (await getDefaultWriter());

	try {
		await writer.upsertApproval(toApprovalResolutionRecord(input));
	} catch (error) {
		if (
			error instanceof ApprovalStoreConfigurationError ||
			error instanceof ApprovalStoreWriteError
		) {
			throw error;
		}

		throw new ApprovalStoreWriteError('Failed to persist approval resolution.', {
			cause: error,
		});
	}
}

export async function getPendingApprovalById(
	approval_id: string,
	options: PersistOptions = {},
): Promise<PendingApprovalEntry | null> {
	const writer = options.writer ?? (await getDefaultWriter());

	try {
		const record = await writer.getPendingApprovalById(approval_id);
		return record ? toPendingApprovalEntry(record) : null;
	} catch (error) {
		if (
			error instanceof ApprovalStoreConfigurationError ||
			error instanceof ApprovalStoreReadError
		) {
			throw error;
		}

		throw new ApprovalStoreReadError('Failed to read pending approval.', {
			cause: error,
		});
	}
}

export const defaultApprovalStore: ApprovalStore = {
	getPendingApprovalById(approval_id) {
		return getPendingApprovalById(approval_id);
	},
	persistApprovalRequest(input) {
		return persistApprovalRequest(input);
	},
	persistApprovalResolution(input) {
		return persistApprovalResolution(input);
	},
};
