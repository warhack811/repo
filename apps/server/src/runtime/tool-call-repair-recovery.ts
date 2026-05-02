import type { ModelRequest, ModelResponse } from '@runa/types';

import type { ToolCallCandidateRejectionReason } from '../gateway/tool-call-candidate.js';

export const TOOL_CALL_REPAIR_RECOVERY_METADATA_KEY = 'tool_call_repair_recovery';

const TOOL_CALL_REPAIR_RECOVERY_MESSAGE =
	'Your previous tool_call was rejected because its arguments field was ' +
	'not valid JSON. Reissue the call with a strictly JSON-parseable ' +
	'arguments object. Use {} for tools with no parameters. Do not include ' +
	'prose, markdown, code fences, or commentary inside the arguments value.';

const TOOL_CALL_REPAIR_NO_TOOLS_MESSAGE =
	'The previous tool call arguments could not be repaired safely. Do not call any tools ' +
	'for this retry. Answer from the current conversation and compiled context only.';

type ToolCallRepairReason = Extract<ToolCallCandidateRejectionReason, 'unparseable_tool_input'>;

export type RepairStrategy = 'force_no_tools' | 'strict_reinforce' | 'tool_subset';

const defaultRepairStrategies: readonly RepairStrategy[] = ['strict_reinforce'];

export interface ToolCallRepairErrorDetails {
	readonly arguments_length?: number;
	readonly reason: ToolCallRepairReason;
	readonly tool_name_raw?: unknown;
	readonly tool_name_resolved?: unknown;
}

export interface ToolCallRepairRecoveryMetadata {
	readonly degraded?: boolean;
	readonly retry_count: number;
	readonly strategy_used: RepairStrategy;
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

export type ToolCallRepairRecoveryEvent =
	| {
			readonly recovery_type: 'tool_call_repair';
			readonly retry_count: number;
			readonly strategy: RepairStrategy;
			readonly trigger_error: ToolCallRepairErrorDetails;
			readonly type: 'recovery.attempted';
	  }
	| {
			readonly metadata: ToolCallRepairRecoveryMetadata;
			readonly recovery_type: 'tool_call_repair';
			readonly retry_count: number;
			readonly strategy_used: RepairStrategy;
			readonly type: 'recovery.succeeded';
	  }
	| {
			readonly next_strategy?: RepairStrategy;
			readonly reason: 'retry_budget_exhausted' | 'retry_failed' | 'retry_still_unparseable';
			readonly recovery_type: 'tool_call_repair';
			readonly retry_count: number;
			readonly strategy: RepairStrategy;
			readonly type: 'recovery.failed';
	  };

export interface ToolCallRepairRecovery {
	evaluate(input: EvaluateToolCallRepairRecoveryInput): Promise<ToolCallRepairRecoveryDecision>;
	recover(input: RecoverFromToolCallRepairInput): Promise<ToolCallRepairRecoveryResult>;
}

export interface CreateToolCallRepairRecoveryOptions {
	readonly max_retries?: number;
	readonly on_event?: (event: ToolCallRepairRecoveryEvent) => void;
	readonly strategies?: readonly RepairStrategy[];
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

function normalizeMaxRetries(maxRetries: number | undefined, fallback: number): number {
	if (!Number.isFinite(maxRetries) || maxRetries === undefined || maxRetries < 1) {
		return fallback;
	}

	return Math.trunc(maxRetries);
}

function normalizeStrategies(
	strategies: readonly RepairStrategy[] | undefined,
): readonly RepairStrategy[] {
	if (strategies === undefined || strategies.length === 0) {
		return defaultRepairStrategies;
	}

	return strategies;
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
	readonly strategy: RepairStrategy;
}): ToolCallRepairRecoveryMetadata {
	return {
		...(input.strategy === 'force_no_tools' ? { degraded: true } : {}),
		retry_count: input.retry_count,
		strategy_used: input.strategy,
		tool_call_repair_error: input.error_details,
	};
}

function withStrictReinforceRecoveryMetadata(
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

function withToolSubsetRecoveryMetadata(
	modelRequest: ModelRequest,
	recoveryMetadata: ToolCallRepairRecoveryMetadata,
	toolName: string,
): ModelRequest | undefined {
	const subsetTools = modelRequest.available_tools?.filter((tool) => tool.name === toolName);

	if (subsetTools === undefined || subsetTools.length === 0) {
		return undefined;
	}

	return {
		...withStrictReinforceRecoveryMetadata(modelRequest, recoveryMetadata),
		available_tools: subsetTools,
	};
}

function withNoToolsRecoveryMetadata(
	modelRequest: ModelRequest,
	recoveryMetadata: ToolCallRepairRecoveryMetadata,
): ModelRequest {
	return {
		...modelRequest,
		available_tools: undefined,
		messages: [
			...modelRequest.messages,
			{
				content: TOOL_CALL_REPAIR_NO_TOOLS_MESSAGE,
				role: 'system',
			},
		],
		metadata: {
			...(modelRequest.metadata ?? {}),
			[TOOL_CALL_REPAIR_RECOVERY_METADATA_KEY]: recoveryMetadata,
		},
	};
}

function buildRepairRequest(input: {
	readonly error_details: ToolCallRepairErrorDetails;
	readonly model_request: ModelRequest;
	readonly recovery_metadata: ToolCallRepairRecoveryMetadata;
	readonly strategy: RepairStrategy;
}): ModelRequest | undefined {
	switch (input.strategy) {
		case 'strict_reinforce':
			return withStrictReinforceRecoveryMetadata(input.model_request, input.recovery_metadata);
		case 'tool_subset':
			return typeof input.error_details.tool_name_resolved === 'string'
				? withToolSubsetRecoveryMetadata(
						input.model_request,
						input.recovery_metadata,
						input.error_details.tool_name_resolved,
					)
				: undefined;
		case 'force_no_tools':
			return withNoToolsRecoveryMetadata(input.model_request, input.recovery_metadata);
	}
}

function findNextRepairStrategy(input: {
	readonly error_details: ToolCallRepairErrorDetails;
	readonly max_attempts: number;
	readonly model_request: ModelRequest;
	readonly retry_count: number;
	readonly strategies: readonly RepairStrategy[];
}): { readonly retry_count: number; readonly strategy: RepairStrategy } | undefined {
	for (
		let strategyIndex = input.retry_count;
		strategyIndex < input.strategies.length && strategyIndex < input.max_attempts;
		strategyIndex += 1
	) {
		const strategy = input.strategies[strategyIndex];

		if (strategy === undefined) {
			continue;
		}

		if (
			strategy === 'tool_subset' &&
			(typeof input.error_details.tool_name_resolved !== 'string' ||
				!input.model_request.available_tools?.some(
					(tool) => tool.name === input.error_details.tool_name_resolved,
				))
		) {
			continue;
		}

		return {
			retry_count: strategyIndex + 1,
			strategy,
		};
	}

	return undefined;
}

export function isToolCallRepairableError(error: unknown): boolean {
	return readToolCallRepairErrorDetails(error) !== undefined;
}

export function createToolCallRepairRecovery(
	options: CreateToolCallRepairRecoveryOptions = {},
): ToolCallRepairRecovery {
	const strategies = normalizeStrategies(options.strategies);
	const maxRetries = normalizeMaxRetries(options.max_retries, strategies.length);
	const onEvent = options.on_event;

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
			const maxAttempts = normalizeMaxRetries(input.max_retries, maxRetries);
			const nextAttempt = findNextRepairStrategy({
				error_details: errorDetails,
				max_attempts: maxAttempts,
				model_request: input.model_request,
				retry_count: retryCount,
				strategies,
			});

			if (nextAttempt === undefined) {
				const lastStrategy =
					strategies[Math.min(retryCount, strategies.length - 1)] ?? 'strict_reinforce';
				onEvent?.({
					recovery_type: 'tool_call_repair',
					retry_count: retryCount,
					strategy: lastStrategy,
					trigger_error: errorDetails,
					type: 'recovery.attempted',
				});
				onEvent?.({
					reason: 'retry_budget_exhausted',
					recovery_type: 'tool_call_repair',
					retry_count: retryCount,
					strategy: lastStrategy,
					type: 'recovery.failed',
				});

				return {
					reason: 'retry_budget_exhausted',
					status: 'unrecoverable',
				};
			}

			onEvent?.({
				recovery_type: 'tool_call_repair',
				retry_count: nextAttempt.retry_count,
				strategy: nextAttempt.strategy,
				trigger_error: errorDetails,
				type: 'recovery.attempted',
			});

			const recoveryMetadata = buildRecoveryMetadata({
				error_details: errorDetails,
				retry_count: nextAttempt.retry_count,
				strategy: nextAttempt.strategy,
			});
			const repairedModelRequest = buildRepairRequest({
				error_details: errorDetails,
				model_request: input.model_request,
				recovery_metadata: recoveryMetadata,
				strategy: nextAttempt.strategy,
			});

			if (repairedModelRequest === undefined) {
				return {
					reason: 'retry_budget_exhausted',
					status: 'unrecoverable',
				};
			}

			return {
				recovery_metadata: recoveryMetadata,
				repaired_model_request: repairedModelRequest,
				status: 'repair_retry_scheduled',
			};
		},

		async recover(input: RecoverFromToolCallRepairInput): Promise<ToolCallRepairRecoveryResult> {
			let currentError = input.error;
			let retryCount = normalizeRetryCount(input.retry_count);
			let lastDecision: RepairRetryScheduledDecision | undefined;

			while (true) {
				const decision = await this.evaluate({
					...input,
					error: currentError,
					retry_count: retryCount,
				});

				if (decision.status === 'no_recovery') {
					return {
						decision,
						status: 'no_recovery',
					};
				}

				if (decision.status === 'unrecoverable') {
					return {
						cause: decision.cause ?? currentError,
						decision,
						model_request: lastDecision?.repaired_model_request,
						reason: decision.reason,
						recovery_metadata: decision.recovery_metadata ?? lastDecision?.recovery_metadata,
						retry_count: retryCount,
						status: 'unrecoverable',
					};
				}

				lastDecision = decision;

				try {
					const modelResponse = await input.retry_executor(decision.repaired_model_request);

					onEvent?.({
						metadata: decision.recovery_metadata,
						recovery_type: 'tool_call_repair',
						retry_count: decision.recovery_metadata.retry_count,
						strategy_used: decision.recovery_metadata.strategy_used,
						type: 'recovery.succeeded',
					});

					return {
						model_request: decision.repaired_model_request,
						model_response: modelResponse,
						recovery_metadata: decision.recovery_metadata,
						retry_count: decision.recovery_metadata.retry_count,
						status: 'recovered',
					};
				} catch (error: unknown) {
					if (isToolCallRepairableError(error)) {
						const retryErrorDetails = readToolCallRepairErrorDetails(error);
						const nextStrategy =
							retryErrorDetails === undefined
								? undefined
								: findNextRepairStrategy({
										error_details: retryErrorDetails,
										max_attempts: maxRetries,
										model_request: input.model_request,
										retry_count: decision.recovery_metadata.retry_count,
										strategies,
									})?.strategy;

						onEvent?.({
							...(nextStrategy === undefined ? {} : { next_strategy: nextStrategy }),
							reason: 'retry_still_unparseable',
							recovery_type: 'tool_call_repair',
							retry_count: decision.recovery_metadata.retry_count,
							strategy: decision.recovery_metadata.strategy_used,
							type: 'recovery.failed',
						});

						if (nextStrategy !== undefined) {
							currentError = error;
							retryCount = decision.recovery_metadata.retry_count;
							continue;
						}

						if (strategies.length === 1) {
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

						currentError = error;
						retryCount = decision.recovery_metadata.retry_count;
						continue;
					}

					onEvent?.({
						reason: 'retry_failed',
						recovery_type: 'tool_call_repair',
						retry_count: decision.recovery_metadata.retry_count,
						strategy: decision.recovery_metadata.strategy_used,
						type: 'recovery.failed',
					});

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
			}
		},
	};
}
