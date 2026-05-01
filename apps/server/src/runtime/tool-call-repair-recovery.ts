import type { ModelRequest, ModelResponse } from '@runa/types';

import type { ToolCallCandidateRejectionReason } from '../gateway/tool-call-candidate.js';

export const TOOL_CALL_REPAIR_RECOVERY_METADATA_KEY = 'tool_call_repair_recovery';

const TOOL_CALL_REPAIR_RECOVERY_MESSAGE =
	'Your previous tool_call was rejected because its arguments field was ' +
	'not valid JSON. Reissue the call with a strictly JSON-parseable ' +
	'arguments object. Use {} for tools with no parameters. Do not include ' +
	'prose, markdown, code fences, or commentary inside the arguments value.';

type ToolCallRepairReason = Extract<ToolCallCandidateRejectionReason, 'unparseable_tool_input'>;

export interface ToolCallRepairErrorDetails {
	readonly arguments_length?: number;
	readonly reason: ToolCallRepairReason;
	readonly tool_name_raw?: unknown;
	readonly tool_name_resolved?: unknown;
}

export interface ToolCallRepairRecoveryMetadata {
	readonly retry_count: number;
	readonly tool_call_repair_error: ToolCallRepairErrorDetails;
}

export interface EvaluateToolCallRepairRecoveryInput {
	readonly error: unknown;
	readonly max_retries?: number;
	readonly model_request: ModelRequest;
	readonly retry_count?: number;
}

export interface RecoverFromToolCallRepairInput extends EvaluateToolCallRepairRecoveryInput {
	readonly retry_executor: (request: ModelRequest) => Promise<ModelResponse>;
}

export interface NoToolCallRepairRecoveryDecision {
	readonly reason: 'not_repairable_error';
	readonly status: 'no_recovery';
}

export interface RepairRetryScheduledDecision {
	readonly recovery_metadata: ToolCallRepairRecoveryMetadata;
	readonly repaired_model_request: ModelRequest;
	readonly status: 'repair_retry_scheduled';
}

export interface UnrecoverableToolCallRepairRecoveryDecision {
	readonly cause?: unknown;
	readonly reason: 'retry_budget_exhausted';
	readonly recovery_metadata?: ToolCallRepairRecoveryMetadata;
	readonly status: 'unrecoverable';
}

export type ToolCallRepairRecoveryDecision =
	| NoToolCallRepairRecoveryDecision
	| RepairRetryScheduledDecision
	| UnrecoverableToolCallRepairRecoveryDecision;

export interface NoToolCallRepairRecoveryResult {
	readonly decision: NoToolCallRepairRecoveryDecision;
	readonly status: 'no_recovery';
}

export interface RecoveredToolCallRepairResult {
	readonly model_request: ModelRequest;
	readonly model_response: ModelResponse;
	readonly recovery_metadata: ToolCallRepairRecoveryMetadata;
	readonly retry_count: number;
	readonly status: 'recovered';
}

export interface UnrecoverableToolCallRepairResult {
	readonly cause?: unknown;
	readonly decision?: RepairRetryScheduledDecision | UnrecoverableToolCallRepairRecoveryDecision;
	readonly model_request?: ModelRequest;
	readonly reason: 'retry_budget_exhausted' | 'retry_failed' | 'retry_still_unparseable';
	readonly recovery_metadata?: ToolCallRepairRecoveryMetadata;
	readonly retry_count: number;
	readonly status: 'unrecoverable';
}

export type ToolCallRepairRecoveryResult =
	| NoToolCallRepairRecoveryResult
	| RecoveredToolCallRepairResult
	| UnrecoverableToolCallRepairResult;

export interface ToolCallRepairRecovery {
	evaluate(input: EvaluateToolCallRepairRecoveryInput): Promise<ToolCallRepairRecoveryDecision>;
	recover(input: RecoverFromToolCallRepairInput): Promise<ToolCallRepairRecoveryResult>;
}

export interface CreateToolCallRepairRecoveryOptions {
	readonly max_retries?: number;
}

interface ToolCallRepairErrorRecord {
	readonly details?: unknown;
	readonly name?: unknown;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRetryCount(retryCount: number | undefined): number {
	if (!Number.isFinite(retryCount) || retryCount === undefined || retryCount < 0) {
		return 0;
	}

	return Math.trunc(retryCount);
}

function normalizeMaxRetries(maxRetries: number | undefined): number {
	if (!Number.isFinite(maxRetries) || maxRetries === undefined || maxRetries < 1) {
		return 1;
	}

	return Math.trunc(maxRetries);
}

function readToolCallRepairErrorDetails(error: unknown): ToolCallRepairErrorDetails | undefined {
	if (!isRecord(error)) {
		return undefined;
	}

	const errorRecord = error as ToolCallRepairErrorRecord;

	if (errorRecord.name !== 'GatewayResponseError' || !isRecord(errorRecord.details)) {
		return undefined;
	}

	if (errorRecord.details['reason'] !== 'unparseable_tool_input') {
		return undefined;
	}

	const argumentsLength = errorRecord.details['arguments_length'];

	return {
		arguments_length:
			typeof argumentsLength === 'number' && Number.isFinite(argumentsLength)
				? argumentsLength
				: undefined,
		reason: 'unparseable_tool_input',
		tool_name_raw: errorRecord.details['tool_name_raw'],
		tool_name_resolved: errorRecord.details['tool_name_resolved'],
	};
}

function buildRecoveryMetadata(input: {
	readonly error_details: ToolCallRepairErrorDetails;
	readonly retry_count: number;
}): ToolCallRepairRecoveryMetadata {
	return {
		retry_count: input.retry_count,
		tool_call_repair_error: input.error_details,
	};
}

function withRecoveryMetadata(
	modelRequest: ModelRequest,
	recoveryMetadata: ToolCallRepairRecoveryMetadata,
): ModelRequest {
	return {
		...modelRequest,
		messages: [
			...modelRequest.messages,
			{
				content: TOOL_CALL_REPAIR_RECOVERY_MESSAGE,
				role: 'system',
			},
		],
		metadata: {
			...(modelRequest.metadata ?? {}),
			[TOOL_CALL_REPAIR_RECOVERY_METADATA_KEY]: recoveryMetadata,
		},
	};
}

export function isToolCallRepairableError(error: unknown): boolean {
	return readToolCallRepairErrorDetails(error) !== undefined;
}

export function createToolCallRepairRecovery(
	options: CreateToolCallRepairRecoveryOptions = {},
): ToolCallRepairRecovery {
	const maxRetries = normalizeMaxRetries(options.max_retries);

	return {
		async evaluate(
			input: EvaluateToolCallRepairRecoveryInput,
		): Promise<ToolCallRepairRecoveryDecision> {
			const errorDetails = readToolCallRepairErrorDetails(input.error);

			if (errorDetails === undefined) {
				return {
					reason: 'not_repairable_error',
					status: 'no_recovery',
				};
			}

			const retryCount = normalizeRetryCount(input.retry_count);

			if (retryCount >= normalizeMaxRetries(input.max_retries ?? maxRetries)) {
				return {
					reason: 'retry_budget_exhausted',
					status: 'unrecoverable',
				};
			}

			const recoveryMetadata = buildRecoveryMetadata({
				error_details: errorDetails,
				retry_count: retryCount + 1,
			});

			return {
				recovery_metadata: recoveryMetadata,
				repaired_model_request: withRecoveryMetadata(input.model_request, recoveryMetadata),
				status: 'repair_retry_scheduled',
			};
		},

		async recover(input: RecoverFromToolCallRepairInput): Promise<ToolCallRepairRecoveryResult> {
			const decision = await this.evaluate(input);

			if (decision.status === 'no_recovery') {
				return {
					decision,
					status: 'no_recovery',
				};
			}

			if (decision.status === 'unrecoverable') {
				return {
					cause: decision.cause,
					decision,
					reason: decision.reason,
					recovery_metadata: decision.recovery_metadata,
					retry_count: normalizeRetryCount(input.retry_count),
					status: 'unrecoverable',
				};
			}

			try {
				const modelResponse = await input.retry_executor(decision.repaired_model_request);

				return {
					model_request: decision.repaired_model_request,
					model_response: modelResponse,
					recovery_metadata: decision.recovery_metadata,
					retry_count: decision.recovery_metadata.retry_count,
					status: 'recovered',
				};
			} catch (error: unknown) {
				if (isToolCallRepairableError(error)) {
					return {
						cause: error,
						decision,
						model_request: decision.repaired_model_request,
						reason: 'retry_still_unparseable',
						recovery_metadata: decision.recovery_metadata,
						retry_count: decision.recovery_metadata.retry_count,
						status: 'unrecoverable',
					};
				}

				return {
					cause: error,
					decision,
					model_request: decision.repaired_model_request,
					reason: 'retry_failed',
					recovery_metadata: decision.recovery_metadata,
					retry_count: decision.recovery_metadata.retry_count,
					status: 'unrecoverable',
				};
			}
		},
	};
}
