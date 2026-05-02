import type { ModelRequest, ModelResponse } from '@runa/types';

import type {
	CompactionInput,
	CompactionResult,
	ContextCompactionArtifactRef,
	ContextCompactionStrategy,
} from '../context/compaction-strategies.js';

import {
	type TextUsageEstimate,
	measureCompiledContextUsage,
} from '../context/compiled-context-text.js';

export const TOKEN_LIMIT_RECOVERY_METADATA_KEY = 'token_limit_recovery';

const TOKEN_LIMIT_ERROR_CODES = new Set([
	'413',
	'CONTEXT_LENGTH_EXCEEDED',
	'CONTEXT_WINDOW_EXCEEDED',
	'MAX_INPUT_TOKENS_EXCEEDED',
	'REQUEST_TOO_LARGE',
	'TOKEN_LIMIT_EXCEEDED',
]);

const TOKEN_LIMIT_ERROR_MESSAGE_PATTERN =
	/(token limit|too many tokens|context limit|context length|context window|max context|request too large|payload too large|413)/iu;

export interface TokenLimitErrorDetails {
	readonly code?: string;
	readonly message?: string;
	readonly status_code?: number;
}

export interface TokenLimitRecoveryMetadata {
	readonly compacted_context_estimate?: TextUsageEstimate;
	readonly original_context_estimate?: TextUsageEstimate;
	readonly retry_count: number;
	readonly strategy_name: string;
	readonly token_limit_error: TokenLimitErrorDetails;
}

export interface TokenLimitRecoveryCompactionInput {
	readonly artifact_refs?: readonly ContextCompactionArtifactRef[];
	readonly preserve_layer_kinds?: readonly string[];
	readonly preserve_layer_names?: readonly string[];
	readonly target_token_range?: CompactionInput['target_token_range'];
}

export interface EvaluateTokenLimitRecoveryInput {
	readonly compaction_input?: TokenLimitRecoveryCompactionInput;
	readonly error: unknown;
	readonly max_retries?: number;
	readonly model_request: ModelRequest;
	readonly retry_count?: number;
}

export interface RecoverFromTokenLimitInput extends EvaluateTokenLimitRecoveryInput {
	readonly retry_executor: (request: ModelRequest) => Promise<ModelResponse>;
}

export interface NoRecoveryDecision {
	readonly reason: 'not_token_limit';
	readonly status: 'no_recovery';
}

export interface CompactedRetryScheduledDecision {
	readonly compacted_model_request: ModelRequest;
	readonly compaction_result: CompactionResult;
	readonly recovery_metadata: TokenLimitRecoveryMetadata;
	readonly status: 'compacted_retry_scheduled';
}

export interface UnrecoverableRecoveryDecision {
	readonly cause?: unknown;
	readonly compaction_result?: CompactionResult;
	readonly reason:
		| 'compaction_failed'
		| 'compaction_not_effective'
		| 'missing_compiled_context'
		| 'retry_budget_exhausted';
	readonly recovery_metadata?: TokenLimitRecoveryMetadata;
	readonly status: 'unrecoverable';
}

export type TokenLimitRecoveryDecision =
	| CompactedRetryScheduledDecision
	| NoRecoveryDecision
	| UnrecoverableRecoveryDecision;

export interface NoRecoveryResult {
	readonly decision: NoRecoveryDecision;
	readonly status: 'no_recovery';
}

export interface RecoveredTokenLimitResult {
	readonly compaction_result: CompactionResult;
	readonly model_request: ModelRequest;
	readonly model_response: ModelResponse;
	readonly recovery_metadata: TokenLimitRecoveryMetadata;
	readonly retry_count: number;
	readonly status: 'recovered';
}

export interface UnrecoverableTokenLimitResult {
	readonly cause?: unknown;
	readonly compaction_result?: CompactionResult;
	readonly decision?: CompactedRetryScheduledDecision | UnrecoverableRecoveryDecision;
	readonly model_request?: ModelRequest;
	readonly reason:
		| 'compaction_failed'
		| 'compaction_not_effective'
		| 'missing_compiled_context'
		| 'retry_budget_exhausted'
		| 'retry_failed'
		| 'retry_still_token_limited';
	readonly recovery_metadata?: TokenLimitRecoveryMetadata;
	readonly retry_count: number;
	readonly status: 'unrecoverable';
}

export type TokenLimitRecoveryResult =
	| NoRecoveryResult
	| RecoveredTokenLimitResult
	| UnrecoverableTokenLimitResult;

export type TokenLimitRecoveryEvent =
	| {
			readonly recovery_type: 'token_limit';
			readonly retry_count: number;
			readonly trigger_error: TokenLimitErrorDetails;
			readonly type: 'recovery.attempted';
	  }
	| {
			readonly metadata: TokenLimitRecoveryMetadata;
			readonly recovery_type: 'token_limit';
			readonly retry_count: number;
			readonly type: 'recovery.succeeded';
	  }
	| {
			readonly reason:
				| 'compaction_failed'
				| 'compaction_not_effective'
				| 'missing_compiled_context'
				| 'retry_budget_exhausted'
				| 'retry_failed'
				| 'retry_still_token_limited';
			readonly recovery_type: 'token_limit';
			readonly retry_count: number;
			readonly type: 'recovery.failed';
	  };

export interface TokenLimitRecovery {
	evaluate(input: EvaluateTokenLimitRecoveryInput): Promise<TokenLimitRecoveryDecision>;
	recover(input: RecoverFromTokenLimitInput): Promise<TokenLimitRecoveryResult>;
}

export interface CreateTokenLimitRecoveryOptions {
	readonly compaction_strategy: ContextCompactionStrategy;
	readonly max_retries?: number;
	readonly on_event?: (event: TokenLimitRecoveryEvent) => void;
}

interface TokenLimitErrorRecord {
	readonly code?: unknown;
	readonly http_status?: unknown;
	readonly message?: unknown;
	readonly status?: unknown;
	readonly statusCode?: unknown;
	readonly status_code?: unknown;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStatusCode(error: unknown): number | undefined {
	if (!isRecord(error)) {
		return undefined;
	}

	const errorRecord = error as TokenLimitErrorRecord;
	const statusCandidates = [
		errorRecord.status,
		errorRecord.statusCode,
		errorRecord.status_code,
		errorRecord.http_status,
	];

	for (const value of statusCandidates) {
		if (typeof value === 'number' && Number.isFinite(value)) {
			return value;
		}
	}

	return undefined;
}

function readCode(error: unknown): string | undefined {
	if (!isRecord(error)) {
		return undefined;
	}

	const errorRecord = error as TokenLimitErrorRecord;
	const value = errorRecord.code;

	if (typeof value === 'number' && Number.isFinite(value)) {
		return String(value);
	}

	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readMessage(error: unknown): string | undefined {
	if (error instanceof Error) {
		return error.message;
	}

	if (!isRecord(error)) {
		return undefined;
	}

	const errorRecord = error as TokenLimitErrorRecord;
	const value = errorRecord.message;

	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
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

function buildTokenLimitErrorDetails(error: unknown): TokenLimitErrorDetails {
	return {
		code: readCode(error),
		message: readMessage(error),
		status_code: readStatusCode(error),
	};
}

function buildRecoveryMetadata(input: {
	readonly compacted_context_estimate?: TextUsageEstimate;
	readonly error: unknown;
	readonly original_context_estimate?: TextUsageEstimate;
	readonly retry_count: number;
	readonly strategy_name: string;
}): TokenLimitRecoveryMetadata {
	return {
		compacted_context_estimate: input.compacted_context_estimate,
		original_context_estimate: input.original_context_estimate,
		retry_count: input.retry_count,
		strategy_name: input.strategy_name,
		token_limit_error: buildTokenLimitErrorDetails(input.error),
	};
}

function buildCompactionMetadata(
	recoveryMetadata: TokenLimitRecoveryMetadata,
): Readonly<Record<string, unknown>> {
	return {
		reason: '413_recovery_preflight',
		retry_count: recoveryMetadata.retry_count,
		strategy: recoveryMetadata.strategy_name,
		token_limit_error: recoveryMetadata.token_limit_error,
	};
}

function withRecoveryMetadata(
	modelRequest: ModelRequest,
	recoveryMetadata: TokenLimitRecoveryMetadata,
	compactionResult: CompactionResult,
): ModelRequest {
	return {
		...modelRequest,
		compiled_context: compactionResult.compacted_context,
		metadata: {
			...(modelRequest.metadata ?? {}),
			[TOKEN_LIMIT_RECOVERY_METADATA_KEY]: recoveryMetadata,
		},
	};
}

export function isTokenLimitError(error: unknown): boolean {
	const statusCode = readStatusCode(error);

	if (statusCode === 413) {
		return true;
	}

	const code = readCode(error)?.toUpperCase();

	if (code && TOKEN_LIMIT_ERROR_CODES.has(code)) {
		return true;
	}

	const message = readMessage(error);

	return message !== undefined && TOKEN_LIMIT_ERROR_MESSAGE_PATTERN.test(message);
}

export function createTokenLimitRecovery(
	options: CreateTokenLimitRecoveryOptions,
): TokenLimitRecovery {
	const maxRetries = normalizeMaxRetries(options.max_retries);
	const onEvent = options.on_event;

	return {
		async evaluate(input: EvaluateTokenLimitRecoveryInput): Promise<TokenLimitRecoveryDecision> {
			if (!isTokenLimitError(input.error)) {
				return {
					reason: 'not_token_limit',
					status: 'no_recovery',
				};
			}

			const retryCount = normalizeRetryCount(input.retry_count);
			const nextRetryCount = retryCount + 1;
			const triggerError = buildTokenLimitErrorDetails(input.error);

			if (retryCount >= normalizeMaxRetries(input.max_retries ?? maxRetries)) {
				onEvent?.({
					recovery_type: 'token_limit',
					retry_count: retryCount,
					trigger_error: triggerError,
					type: 'recovery.attempted',
				});
				onEvent?.({
					reason: 'retry_budget_exhausted',
					recovery_type: 'token_limit',
					retry_count: retryCount,
					type: 'recovery.failed',
				});

				return {
					reason: 'retry_budget_exhausted',
					status: 'unrecoverable',
				};
			}

			onEvent?.({
				recovery_type: 'token_limit',
				retry_count: nextRetryCount,
				trigger_error: triggerError,
				type: 'recovery.attempted',
			});

			if (
				input.model_request.compiled_context === undefined ||
				input.model_request.compiled_context.layers.length === 0
			) {
				onEvent?.({
					reason: 'missing_compiled_context',
					recovery_type: 'token_limit',
					retry_count: nextRetryCount,
					type: 'recovery.failed',
				});

				return {
					reason: 'missing_compiled_context',
					status: 'unrecoverable',
				};
			}

			const originalContextEstimate = measureCompiledContextUsage(
				input.model_request.compiled_context,
			)?.total;
			const baseRecoveryMetadata = buildRecoveryMetadata({
				error: input.error,
				original_context_estimate: originalContextEstimate,
				retry_count: nextRetryCount,
				strategy_name: 'unknown',
			});

			let compactionResult: CompactionResult;

			try {
				compactionResult = await options.compaction_strategy.compact({
					artifact_refs: input.compaction_input?.artifact_refs,
					compiled_context: input.model_request.compiled_context,
					metadata: buildCompactionMetadata(baseRecoveryMetadata),
					preserve_layer_kinds: input.compaction_input?.preserve_layer_kinds,
					preserve_layer_names: input.compaction_input?.preserve_layer_names,
					target_token_range: input.compaction_input?.target_token_range,
				});
			} catch (error: unknown) {
				onEvent?.({
					reason: 'compaction_failed',
					recovery_type: 'token_limit',
					retry_count: nextRetryCount,
					type: 'recovery.failed',
				});

				return {
					cause: error,
					reason: 'compaction_failed',
					status: 'unrecoverable',
				};
			}

			const compactedContextEstimate =
				compactionResult.compacted_context === undefined
					? undefined
					: measureCompiledContextUsage(compactionResult.compacted_context)?.total;
			const recoveryMetadata = buildRecoveryMetadata({
				compacted_context_estimate: compactedContextEstimate,
				error: input.error,
				original_context_estimate: originalContextEstimate,
				retry_count: nextRetryCount,
				strategy_name: compactionResult.strategy.name,
			});

			if (
				compactionResult.compacted_context === undefined ||
				compactionResult.status === 'noop' ||
				(compactedContextEstimate !== undefined &&
					originalContextEstimate !== undefined &&
					compactedContextEstimate.token_count >= originalContextEstimate.token_count)
			) {
				onEvent?.({
					reason: 'compaction_not_effective',
					recovery_type: 'token_limit',
					retry_count: nextRetryCount,
					type: 'recovery.failed',
				});

				return {
					compaction_result: compactionResult,
					reason: 'compaction_not_effective',
					recovery_metadata: recoveryMetadata,
					status: 'unrecoverable',
				};
			}

			return {
				compacted_model_request: withRecoveryMetadata(
					input.model_request,
					recoveryMetadata,
					compactionResult,
				),
				compaction_result: compactionResult,
				recovery_metadata: recoveryMetadata,
				status: 'compacted_retry_scheduled',
			};
		},

		async recover(input: RecoverFromTokenLimitInput): Promise<TokenLimitRecoveryResult> {
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
					compaction_result: decision.compaction_result,
					decision,
					reason: decision.reason,
					recovery_metadata: decision.recovery_metadata,
					retry_count: normalizeRetryCount(input.retry_count),
					status: 'unrecoverable',
				};
			}

			try {
				const modelResponse = await input.retry_executor(decision.compacted_model_request);

				onEvent?.({
					metadata: decision.recovery_metadata,
					recovery_type: 'token_limit',
					retry_count: decision.recovery_metadata.retry_count,
					type: 'recovery.succeeded',
				});

				return {
					compaction_result: decision.compaction_result,
					model_request: decision.compacted_model_request,
					model_response: modelResponse,
					recovery_metadata: decision.recovery_metadata,
					retry_count: decision.recovery_metadata.retry_count,
					status: 'recovered',
				};
			} catch (error: unknown) {
				if (isTokenLimitError(error)) {
					onEvent?.({
						reason: 'retry_still_token_limited',
						recovery_type: 'token_limit',
						retry_count: decision.recovery_metadata.retry_count,
						type: 'recovery.failed',
					});

					return {
						cause: error,
						compaction_result: decision.compaction_result,
						decision,
						model_request: decision.compacted_model_request,
						reason: 'retry_still_token_limited',
						recovery_metadata: decision.recovery_metadata,
						retry_count: decision.recovery_metadata.retry_count,
						status: 'unrecoverable',
					};
				}

				onEvent?.({
					reason: 'retry_failed',
					recovery_type: 'token_limit',
					retry_count: decision.recovery_metadata.retry_count,
					type: 'recovery.failed',
				});

				return {
					cause: error,
					compaction_result: decision.compaction_result,
					decision,
					model_request: decision.compacted_model_request,
					reason: 'retry_failed',
					recovery_metadata: decision.recovery_metadata,
					retry_count: decision.recovery_metadata.retry_count,
					status: 'unrecoverable',
				};
			}
		},
	};
}
