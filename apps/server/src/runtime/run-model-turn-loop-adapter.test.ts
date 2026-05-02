import type { ModelGateway, ModelRequest, ModelResponse, ModelStreamChunk } from '@runa/types';

import { describe, expect, it, vi } from 'vitest';

import type { AgentLoopTurnInput } from './agent-loop.js';
import type {
	RunModelTurnApprovalRequiredResult,
	RunModelTurnAssistantResponseResult,
	RunModelTurnFailureResult,
	RunModelTurnInput,
	RunModelTurnResult,
	RunModelTurnToolCallResult,
} from './run-model-turn.js';
import type { TokenLimitRecovery } from './token-limit-recovery.js';
import type { ToolCallRepairRecovery } from './tool-call-repair-recovery.js';

import { GatewayResponseError } from '../gateway/errors.js';
import { ToolRegistry } from '../tools/registry.js';
import {
	createRunModelTurnLoopExecutor,
	mapRunModelTurnResultToAgentLoopTurnResult,
} from './run-model-turn-loop-adapter.js';
import { TOKEN_LIMIT_RECOVERY_METADATA_KEY } from './token-limit-recovery.js';

class StubModelGateway implements ModelGateway {
	async generate(_request: ModelRequest): Promise<ModelResponse> {
		throw new Error('generate should not be called directly in adapter tests');
	}

	async *stream(_request: ModelRequest): AsyncIterable<ModelStreamChunk> {
		yield* [];
	}
}

class RepairableThenSuccessGateway implements ModelGateway {
	readonly #failuresBeforeSuccess: number;
	generate_calls = 0;

	constructor(failuresBeforeSuccess: number) {
		this.#failuresBeforeSuccess = failuresBeforeSuccess;
	}

	async generate(_request: ModelRequest): Promise<ModelResponse> {
		this.generate_calls += 1;

		if (this.generate_calls <= this.#failuresBeforeSuccess) {
			throw new GatewayResponseError(
				'openai',
				'OpenAI response contained an invalid tool call candidate (unparseable_tool_input).',
				{
					arguments_length: 8,
					call_id_present: true,
					reason: 'unparseable_tool_input',
					tool_name_raw: 'file.read',
					tool_name_resolved: 'file.read',
				},
			);
		}

		return {
			finish_reason: 'stop',
			message: {
				content: 'Recovered final answer.',
				role: 'assistant',
			},
			model: 'gpt-4.1-mini',
			provider: 'openai',
		};
	}

	async *stream(_request: ModelRequest): AsyncIterable<ModelStreamChunk> {
		yield* [];
	}
}

class TokenLimitThenSuccessGateway implements ModelGateway {
	readonly #failuresBeforeSuccess: number;
	generate_calls = 0;

	constructor(failuresBeforeSuccess: number) {
		this.#failuresBeforeSuccess = failuresBeforeSuccess;
	}

	async generate(request: ModelRequest): Promise<ModelResponse> {
		this.generate_calls += 1;

		if (this.generate_calls <= this.#failuresBeforeSuccess) {
			throw createTokenLimitError();
		}

		return {
			finish_reason: 'stop',
			message: {
				content: `Recovered with ${request.compiled_context?.layers.length ?? 0} layers.`,
				role: 'assistant',
			},
			model: 'claude-recovered',
			provider: 'claude',
		};
	}

	async *stream(_request: ModelRequest): AsyncIterable<ModelStreamChunk> {
		yield* [];
	}
}

function createLoopTurnInput(overrides: Partial<AgentLoopTurnInput> = {}): AgentLoopTurnInput {
	return {
		config: {
			max_turns: 5,
			stop_conditions: {},
		},
		run_id: 'run_loop_adapter',
		snapshot: {
			config: {
				max_turns: 5,
				stop_conditions: {},
			},
			current_loop_state: 'RUNNING',
			current_runtime_state: 'MODEL_THINKING',
			run_id: 'run_loop_adapter',
			trace_id: 'trace_loop_adapter',
			turn_count: 0,
		},
		trace_id: 'trace_loop_adapter',
		turn_index: 1,
		...overrides,
	};
}

function createCompiledContext(): ModelRequest['compiled_context'] {
	return {
		layers: [
			{
				content: {
					principles: ['Use typed contracts.', 'Prefer deterministic behavior.'],
				},
				kind: 'instruction',
				name: 'core_rules',
			},
			{
				content: {
					current_state: 'MODEL_THINKING',
					run_id: 'run_loop_adapter',
					trace_id: 'trace_loop_adapter',
				},
				kind: 'runtime',
				name: 'run_layer',
			},
			{
				content: {
					items: Array.from({ length: 220 }, (_, index) => ({
						content: `memory-${index}`,
					})),
				},
				kind: 'memory',
				name: 'memory_layer',
			},
			{
				content: {
					summary: Array.from({ length: 220 }, (_, index) => `workspace-${index}`).join(' '),
				},
				kind: 'workspace',
				name: 'workspace_layer',
			},
		],
	};
}

function createModelRequest(overrides: Partial<ModelRequest> = {}): ModelRequest {
	return {
		messages: [
			{
				content: 'Hello from adapter test.',
				role: 'user',
			},
		],
		run_id: 'builder_run_id',
		trace_id: 'builder_trace_id',
		...overrides,
	};
}

function createTokenLimitError(): Error & { readonly code: string; readonly status: number } {
	const error = new Error('context window exceeded');

	return Object.assign(error, {
		code: 'CONTEXT_LENGTH_EXCEEDED',
		status: 413,
	});
}

function createAssistantCompletionResult(): RunModelTurnAssistantResponseResult {
	return {
		assistant_text: 'Assistant final answer.',
		continuation_result: {
			assistant_text: 'Assistant final answer.',
			events: [],
			final_state: 'COMPLETED',
			outcome_kind: 'assistant_response',
			state_transitions: [{ from: 'MODEL_THINKING', to: 'COMPLETED' }],
			status: 'completed',
		},
		final_state: 'COMPLETED',
		model_response: {
			finish_reason: 'stop',
			message: {
				content: 'Assistant final answer.',
				role: 'assistant',
			},
			model: 'claude-3-7-sonnet',
			provider: 'claude',
		},
		model_turn_outcome: {
			kind: 'assistant_response',
			text: 'Assistant final answer.',
		},
		resolved_model_request: createModelRequest(),
		status: 'completed',
	};
}

function createApprovalRequiredResult(): RunModelTurnApprovalRequiredResult {
	return {
		approval_event: {
			event_id: 'event_adapter_approval_1',
			event_type: 'approval.requested',
			event_version: 1,
			payload: {
				action_kind: 'file_write',
				approval_id: 'approval_adapter_1',
				call_id: 'call_adapter_approval_1',
				summary: 'Write changes to src/app.ts',
				title: 'Approve file write',
				tool_name: 'file.write',
			},
			run_id: 'run_loop_adapter',
			timestamp: '2026-04-16T12:00:00.000Z',
			trace_id: 'trace_loop_adapter',
		},
		approval_request: {
			action_kind: 'file_write',
			approval_id: 'approval_adapter_1',
			call_id: 'call_adapter_approval_1',
			requested_at: '2026-04-16T12:00:00.000Z',
			run_id: 'run_loop_adapter',
			status: 'pending',
			summary: 'Write changes to src/app.ts',
			target: {
				call_id: 'call_adapter_approval_1',
				kind: 'tool_call',
				label: 'file.write',
				tool_name: 'file.write',
			},
			title: 'Approve file write',
			tool_name: 'file.write',
			trace_id: 'trace_loop_adapter',
		},
		continuation_result: {
			approval_event: {
				event_id: 'event_adapter_approval_1',
				event_type: 'approval.requested',
				event_version: 1,
				payload: {
					action_kind: 'file_write',
					approval_id: 'approval_adapter_1',
					call_id: 'call_adapter_approval_1',
					summary: 'Write changes to src/app.ts',
					title: 'Approve file write',
					tool_name: 'file.write',
				},
				run_id: 'run_loop_adapter',
				timestamp: '2026-04-16T12:00:00.000Z',
				trace_id: 'trace_loop_adapter',
			},
			approval_request: {
				action_kind: 'file_write',
				approval_id: 'approval_adapter_1',
				call_id: 'call_adapter_approval_1',
				requested_at: '2026-04-16T12:00:00.000Z',
				run_id: 'run_loop_adapter',
				status: 'pending',
				summary: 'Write changes to src/app.ts',
				target: {
					call_id: 'call_adapter_approval_1',
					kind: 'tool_call',
					label: 'file.write',
					tool_name: 'file.write',
				},
				title: 'Approve file write',
				tool_name: 'file.write',
				trace_id: 'trace_loop_adapter',
			},
			call_id: 'call_adapter_approval_1',
			events: [],
			final_state: 'WAITING_APPROVAL',
			outcome_kind: 'tool_call',
			state_transitions: [{ from: 'MODEL_THINKING', to: 'WAITING_APPROVAL' }],
			status: 'approval_required',
			tool_name: 'file.write',
		},
		final_state: 'WAITING_APPROVAL',
		model_response: {
			finish_reason: 'stop',
			message: {
				content: 'Calling file.write',
				role: 'assistant',
			},
			model: 'claude-3-7-sonnet',
			provider: 'claude',
			tool_call_candidate: {
				call_id: 'call_adapter_approval_1',
				tool_input: {
					path: 'src/app.ts',
				},
				tool_name: 'file.write',
			},
		},
		model_turn_outcome: {
			call_id: 'call_adapter_approval_1',
			kind: 'tool_call',
			tool_input: {
				path: 'src/app.ts',
			},
			tool_name: 'file.write',
		},
		resolved_model_request: createModelRequest(),
		status: 'approval_required',
		tool_results: [
			{
				call_id: 'call_adapter_read_1',
				output: {
					content: 'prefetched context',
				},
				status: 'success',
				tool_name: 'file.read',
			},
		],
	};
}

function createFailureResult(): RunModelTurnFailureResult {
	return {
		continuation_result: undefined,
		failure: {
			code: 'MODEL_GENERATE_FAILED',
			message: 'Model generate failed: gateway unavailable',
		},
		final_state: 'FAILED',
		model_response: undefined,
		model_turn_outcome: undefined,
		resolved_model_request: createModelRequest(),
		status: 'failed',
		tool_results: [
			{
				call_id: 'call_adapter_failed_1',
				error_code: 'EXECUTION_FAILED',
				error_message: 'tool exploded',
				status: 'error',
				tool_name: 'file.read',
			},
		],
	};
}

function createToolContinuationResult(): RunModelTurnToolCallResult {
	return {
		continuation_result: {
			call_id: 'call_adapter_tool_1',
			events: [
				{
					event_id: 'event_adapter_tool_started_1',
					event_type: 'tool.call.started',
					event_version: 1,
					payload: {
						call_id: 'call_adapter_tool_1',
						tool_name: 'file.read',
					},
					run_id: 'run_loop_adapter',
					timestamp: '2026-04-16T12:05:00.000Z',
					trace_id: 'trace_loop_adapter',
				},
			],
			final_state: 'TOOL_RESULT_INGESTING',
			ingested_result: {
				call_id: 'call_adapter_tool_1',
				kind: 'tool_result',
				output: {
					content: 'file body',
				},
				result_status: 'success',
				tool_name: 'file.read',
			},
			outcome_kind: 'tool_call',
			state_transitions: [
				{ from: 'MODEL_THINKING', to: 'TOOL_EXECUTING' },
				{ from: 'TOOL_EXECUTING', to: 'TOOL_RESULT_INGESTING' },
			],
			status: 'completed',
			suggested_next_state: 'MODEL_THINKING',
			tool_name: 'file.read',
			tool_result: {
				call_id: 'call_adapter_tool_1',
				output: {
					content: 'file body',
				},
				status: 'success',
				tool_name: 'file.read',
			},
		},
		final_state: 'TOOL_RESULT_INGESTING',
		ingested_result: {
			call_id: 'call_adapter_tool_1',
			kind: 'tool_result',
			output: {
				content: 'file body',
			},
			result_status: 'success',
			tool_name: 'file.read',
		},
		model_response: {
			finish_reason: 'stop',
			message: {
				content: 'Calling file.read',
				role: 'assistant',
			},
			model: 'claude-3-7-sonnet',
			provider: 'claude',
			tool_call_candidate: {
				call_id: 'call_adapter_tool_1',
				tool_input: {
					path: 'src/example.ts',
				},
				tool_name: 'file.read',
			},
		},
		model_turn_outcome: {
			call_id: 'call_adapter_tool_1',
			kind: 'tool_call',
			tool_input: {
				path: 'src/example.ts',
			},
			tool_name: 'file.read',
		},
		resolved_model_request: createModelRequest(),
		status: 'completed',
		suggested_next_state: 'MODEL_THINKING',
		tool_result: {
			call_id: 'call_adapter_tool_1',
			output: {
				content: 'file body',
			},
			status: 'success',
			tool_name: 'file.read',
		},
		tool_results: [
			{
				call_id: 'call_adapter_tool_1',
				output: {
					content: 'file body',
				},
				status: 'success',
				tool_name: 'file.read',
			},
			{
				call_id: 'call_adapter_tool_2',
				error_code: 'EXECUTION_FAILED',
				error_message: 'secondary lookup failed',
				status: 'error',
				tool_name: 'web.search',
			},
		],
	};
}

describe('run-model-turn-loop-adapter', () => {
	it('maps assistant-style completion into a loop-friendly completed result', () => {
		const result = mapRunModelTurnResultToAgentLoopTurnResult(
			createLoopTurnInput(),
			createAssistantCompletionResult(),
		);

		expect(result).toMatchObject({
			assistant_text: 'Assistant final answer.',
			current_loop_state: 'COMPLETED',
			current_runtime_state: 'COMPLETED',
			model: {
				finish_reason: 'stop',
				outcome_kind: 'assistant_response',
			},
		});
		expect(result.progress_events?.map((event) => event.event_type)).toEqual([
			'model.completed',
			'state.entered',
			'run.completed',
		]);
	});

	it('surfaces approval-required outcomes as a human boundary', () => {
		const result = mapRunModelTurnResultToAgentLoopTurnResult(
			createLoopTurnInput(),
			createApprovalRequiredResult(),
			{
				working_directory: 'd:\\ai\\Runa',
			},
		);

		expect(result).toMatchObject({
			approval_request: {
				approval_id: 'approval_adapter_1',
			},
			current_loop_state: 'WAITING',
			current_runtime_state: 'WAITING_APPROVAL',
			human_boundary: {
				action_kind: 'file_write',
				approval_id: 'approval_adapter_1',
				boundary: 'approval',
				loop_state: 'WAITING',
			},
			model: {
				finish_reason: 'stop',
				outcome_kind: 'tool_call',
			},
			pending_tool_call: {
				tool_input: {
					path: 'src/app.ts',
				},
				working_directory: 'd:\\ai\\Runa',
			},
			tool_results: [
				{
					call_id: 'call_adapter_read_1',
					output: {
						content: 'prefetched context',
					},
					status: 'success',
					tool_name: 'file.read',
				},
			],
		});
		expect(result.progress_events?.map((event) => event.event_type)).toEqual([
			'model.completed',
			'state.entered',
			'approval.requested',
		]);
	});

	it('maps failure outcomes into a typed loop failure surface', () => {
		const result = mapRunModelTurnResultToAgentLoopTurnResult(
			createLoopTurnInput(),
			createFailureResult(),
		);

		expect(result).toMatchObject({
			current_loop_state: 'FAILED',
			current_runtime_state: 'FAILED',
			failure: {
				error_code: 'MODEL_GENERATE_FAILED',
				error_message: 'Model generate failed: gateway unavailable',
				retryable: false,
			},
			model: undefined,
			tool_results: [
				{
					call_id: 'call_adapter_failed_1',
					error_code: 'EXECUTION_FAILED',
					error_message: 'tool exploded',
					status: 'error',
					tool_name: 'file.read',
				},
			],
		});
		expect(result.progress_events?.map((event) => event.event_type)).toEqual(['run.failed']);
	});

	it('carries tool-driven non-terminal results into the loop executor surface', () => {
		const result = mapRunModelTurnResultToAgentLoopTurnResult(
			createLoopTurnInput(),
			createToolContinuationResult(),
		);

		expect(result).toMatchObject({
			current_loop_state: 'RUNNING',
			current_runtime_state: 'TOOL_RESULT_INGESTING',
			model: {
				finish_reason: 'stop',
				outcome_kind: 'tool_call',
			},
			tool_arguments: {
				path: 'src/example.ts',
			},
			tool_result: createToolContinuationResult().tool_result,
			tool_results: createToolContinuationResult().tool_results,
		});
		expect(result.progress_events?.map((event) => event.event_type)).toEqual([
			'model.completed',
			'state.entered',
			'state.entered',
			'tool.call.started',
		]);
	});

	it('passes run_id, trace_id, turn_index, and snapshot through the adapter seams deterministically', async () => {
		let capturedLoopInput: AgentLoopTurnInput | undefined;
		let capturedRunModelTurnInput: RunModelTurnInput | undefined;

		const loopInput = createLoopTurnInput({
			run_id: 'run_loop_adapter_forwarded',
			snapshot: {
				config: {
					max_turns: 5,
					stop_conditions: {},
				},
				current_loop_state: 'RUNNING',
				current_runtime_state: 'TOOL_RESULT_INGESTING',
				run_id: 'run_loop_adapter_forwarded',
				tool_result: {
					call_id: 'call_snapshot_tool_result',
					output: {
						content: 'snapshot artifact',
					},
					status: 'success',
					tool_name: 'file.read',
				},
				trace_id: 'trace_loop_adapter_forwarded',
				turn_count: 2,
			},
			trace_id: 'trace_loop_adapter_forwarded',
			turn_index: 3,
		});
		const executor = createRunModelTurnLoopExecutor({
			async build_model_request(input) {
				capturedLoopInput = input;

				return createModelRequest({
					run_id: 'builder_should_be_overridden',
					trace_id: 'builder_should_be_overridden',
				});
			},
			execution_context: {
				working_directory: 'd:\\ai\\Runa',
			},
			model_gateway: new StubModelGateway(),
			registry: new ToolRegistry(),
			async run_model_turn(input) {
				capturedRunModelTurnInput = input;
				return createAssistantCompletionResult();
			},
			tool_names: ['file.read'],
		});

		const result = await executor(loopInput);

		expect(result.current_runtime_state).toBe('COMPLETED');
		expect(capturedLoopInput).toBe(loopInput);
		expect(capturedLoopInput?.turn_index).toBe(3);
		expect(capturedLoopInput?.snapshot.tool_result).toEqual({
			call_id: 'call_snapshot_tool_result',
			output: {
				content: 'snapshot artifact',
			},
			status: 'success',
			tool_name: 'file.read',
		});
		expect(capturedRunModelTurnInput).toEqual({
			current_state: 'MODEL_THINKING',
			execution_context: {
				run_id: 'run_loop_adapter_forwarded',
				trace_id: 'trace_loop_adapter_forwarded',
				working_directory: 'd:\\ai\\Runa',
			},
			model_gateway: expect.any(StubModelGateway),
			model_request: {
				messages: [
					{
						content: 'Hello from adapter test.',
						role: 'user',
					},
				],
				run_id: 'run_loop_adapter_forwarded',
				trace_id: 'trace_loop_adapter_forwarded',
			},
			persistence_writer: undefined,
			registry: expect.any(ToolRegistry),
			run_id: 'run_loop_adapter_forwarded',
			token_limit_recovery: expect.any(Object),
			tool_call_repair_recovery: expect.any(Object),
			tool_names: ['file.read'],
			trace_id: 'trace_loop_adapter_forwarded',
		});
	});

	it('keeps mapping deterministic when invoked through the executor factory', async () => {
		const runModelTurnResult: RunModelTurnResult = createToolContinuationResult();
		const executor = createRunModelTurnLoopExecutor({
			async build_model_request() {
				return createModelRequest();
			},
			model_gateway: new StubModelGateway(),
			registry: new ToolRegistry(),
			async run_model_turn() {
				return runModelTurnResult;
			},
		});

		const result = await executor(createLoopTurnInput());

		expect(result).toMatchObject({
			current_loop_state: 'RUNNING',
			current_runtime_state: 'TOOL_RESULT_INGESTING',
			model: {
				finish_reason: 'stop',
				outcome_kind: 'tool_call',
			},
			tool_result: createToolContinuationResult().tool_result,
		});
		expect(result).toMatchObject({
			progress_events: expect.arrayContaining([
				...createToolContinuationResult().continuation_result.events,
			]),
		});
	});

	it('enables tool call repair recovery by default for real runModelTurn execution', async () => {
		const gateway = new RepairableThenSuccessGateway(1);
		const executor = createRunModelTurnLoopExecutor({
			async build_model_request() {
				return createModelRequest();
			},
			model_gateway: gateway,
			registry: new ToolRegistry(),
		});

		const result = await executor(createLoopTurnInput());
		const modelCompletedEvent = result.progress_events?.find(
			(event) => event.event_type === 'model.completed',
		);

		expect(gateway.generate_calls).toBe(2);
		expect(result).toMatchObject({
			assistant_text: 'Recovered final answer.',
			current_loop_state: 'COMPLETED',
			current_runtime_state: 'COMPLETED',
		});
		expect(modelCompletedEvent?.metadata?.['recovery']).toEqual({
			outcome: 'recovered',
			retry_count: 1,
			type: 'tool_call_repair',
		});
	});

	it('keeps tool call repair recovery disabled when explicitly opted out with null', async () => {
		const gateway = new RepairableThenSuccessGateway(1);
		const executor = createRunModelTurnLoopExecutor({
			async build_model_request() {
				return createModelRequest();
			},
			model_gateway: gateway,
			registry: new ToolRegistry(),
			tool_call_repair_recovery: null,
		});

		const result = await executor(createLoopTurnInput());

		expect(gateway.generate_calls).toBe(1);
		expect(result).toMatchObject({
			current_loop_state: 'FAILED',
			current_runtime_state: 'FAILED',
			failure: {
				error_code: 'MODEL_GENERATE_FAILED',
				error_message:
					'Model generate failed: OpenAI response contained an invalid tool call candidate (unparseable_tool_input).',
			},
		});
	});

	it('uses an explicit tool call repair recovery instance when provided', async () => {
		const gateway = new RepairableThenSuccessGateway(2);
		const recoveredResponse: ModelResponse = {
			finish_reason: 'stop',
			message: {
				content: 'Custom recovery final answer.',
				role: 'assistant',
			},
			model: 'gpt-4.1-mini',
			provider: 'openai',
		};
		const customRecovery: ToolCallRepairRecovery = {
			evaluate: vi.fn(async () => ({
				reason: 'not_repairable_error' as const,
				status: 'no_recovery' as const,
			})),
			recover: vi.fn(async (input: Parameters<ToolCallRepairRecovery['recover']>[0]) => ({
				model_request: input.model_request,
				model_response: recoveredResponse,
				recovery_metadata: {
					retry_count: 1,
					tool_call_repair_error: {
						arguments_length: 8,
						reason: 'unparseable_tool_input' as const,
						tool_name_raw: 'file.read',
						tool_name_resolved: 'file.read',
					},
				},
				retry_count: 1,
				status: 'recovered' as const,
			})),
		};
		const executor = createRunModelTurnLoopExecutor({
			async build_model_request() {
				return createModelRequest();
			},
			model_gateway: gateway,
			registry: new ToolRegistry(),
			tool_call_repair_recovery: customRecovery,
		});

		const result = await executor(createLoopTurnInput());

		expect(customRecovery.recover).toHaveBeenCalledTimes(1);
		expect(gateway.generate_calls).toBe(1);
		expect(result).toMatchObject({
			assistant_text: 'Custom recovery final answer.',
			current_loop_state: 'COMPLETED',
			current_runtime_state: 'COMPLETED',
		});
	});

	it('enables token-limit recovery by default for real runModelTurn execution', async () => {
		const gateway = new TokenLimitThenSuccessGateway(1);
		const executor = createRunModelTurnLoopExecutor({
			async build_model_request() {
				return createModelRequest({
					compiled_context: createCompiledContext(),
				});
			},
			model_gateway: gateway,
			registry: new ToolRegistry(),
		});

		const result = await executor(createLoopTurnInput());
		const modelCompletedEvent = result.progress_events?.find(
			(event) => event.event_type === 'model.completed',
		);

		expect(gateway.generate_calls).toBe(2);
		expect(result).toMatchObject({
			assistant_text: 'Recovered with 3 layers.',
			current_loop_state: 'COMPLETED',
			current_runtime_state: 'COMPLETED',
		});
		expect(modelCompletedEvent?.metadata?.['recovery']).toEqual({
			outcome: 'recovered',
			retry_count: 1,
			type: 'token_limit',
		});
	});

	it('keeps token-limit recovery disabled when explicitly opted out with null', async () => {
		const gateway = new TokenLimitThenSuccessGateway(1);
		const executor = createRunModelTurnLoopExecutor({
			async build_model_request() {
				return createModelRequest({
					compiled_context: createCompiledContext(),
				});
			},
			model_gateway: gateway,
			registry: new ToolRegistry(),
			token_limit_recovery: null,
		});

		const result = await executor(createLoopTurnInput());

		expect(gateway.generate_calls).toBe(1);
		expect(result).toMatchObject({
			current_loop_state: 'FAILED',
			current_runtime_state: 'FAILED',
			failure: {
				error_code: 'MODEL_GENERATE_FAILED',
				error_message: 'Model generate failed: context window exceeded',
			},
		});
	});

	it('uses an explicit token-limit recovery instance when provided', async () => {
		const gateway = new TokenLimitThenSuccessGateway(1);
		const recoveredResponse: ModelResponse = {
			finish_reason: 'stop',
			message: {
				content: 'Custom token-limit recovery final answer.',
				role: 'assistant',
			},
			model: 'claude-recovered',
			provider: 'claude',
		};
		const evaluate = vi.fn(async (_input: Parameters<TokenLimitRecovery['evaluate']>[0]) => ({
			reason: 'not_token_limit' as const,
			status: 'no_recovery' as const,
		}));
		const customRecovery: TokenLimitRecovery = {
			evaluate,
			recover: vi.fn(async (input: Parameters<TokenLimitRecovery['recover']>[0]) => {
				await evaluate(input);

				return {
					compaction_result: {
						budget: {
							input_tokens: 10,
							output_tokens: 5,
							target_token_range: {
								max: 10,
								min: 5,
							},
							target_tokens: 10,
							within_target_range: true,
						},
						compacted_context: input.model_request.compiled_context,
						preserved_artifact_refs: [],
						provenance: [],
						status: 'compacted' as const,
						strategy: {
							name: 'microcompact' as const,
							summarizer: 'custom',
							version: 1 as const,
						},
					},
					model_request: {
						...input.model_request,
						metadata: {
							...(input.model_request.metadata ?? {}),
							[TOKEN_LIMIT_RECOVERY_METADATA_KEY]: {
								retry_count: 1,
								strategy_name: 'microcompact',
								token_limit_error: {
									code: 'CONTEXT_LENGTH_EXCEEDED',
								},
							},
						},
					},
					model_response: recoveredResponse,
					recovery_metadata: {
						retry_count: 1,
						strategy_name: 'microcompact',
						token_limit_error: {
							code: 'CONTEXT_LENGTH_EXCEEDED',
						},
					},
					retry_count: 1,
					status: 'recovered' as const,
				};
			}),
		};
		const executor = createRunModelTurnLoopExecutor({
			async build_model_request() {
				return createModelRequest({
					compiled_context: createCompiledContext(),
				});
			},
			model_gateway: gateway,
			registry: new ToolRegistry(),
			token_limit_recovery: customRecovery,
		});

		const result = await executor(createLoopTurnInput());

		expect(customRecovery.recover).toHaveBeenCalledTimes(1);
		expect(evaluate).toHaveBeenCalledTimes(1);
		expect(gateway.generate_calls).toBe(1);
		expect(result).toMatchObject({
			assistant_text: 'Custom token-limit recovery final answer.',
			current_loop_state: 'COMPLETED',
			current_runtime_state: 'COMPLETED',
		});
	});

	it('leaves model.completed recovery metadata undefined without recovery', () => {
		const result = mapRunModelTurnResultToAgentLoopTurnResult(
			createLoopTurnInput(),
			createAssistantCompletionResult(),
		);
		const modelCompletedEvent = result.progress_events?.find(
			(event) => event.event_type === 'model.completed',
		);

		expect(modelCompletedEvent?.metadata?.['recovery']).toBeUndefined();
	});
});
