import type {
	ModelCallableTool,
	ModelGateway,
	ModelRequest,
	ModelResponse,
	ModelStreamChunk,
	ToolCallInput,
	ToolCallableSchema,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
} from '@runa/types';

import { describe, expect, it } from 'vitest';

import { createMicrocompactStrategy } from '../context/compaction-strategies.js';
import type { RunRecordWriter } from '../persistence/run-store.js';
import { ToolRegistry } from '../tools/registry.js';

import { runModelTurn } from './run-model-turn.js';
import { createTokenLimitRecovery } from './token-limit-recovery.js';

class FakeModelGateway implements ModelGateway {
	#generate: (request: ModelRequest) => Promise<ModelResponse>;
	readonly requests: ModelRequest[] = [];

	constructor(generate: (request: ModelRequest) => Promise<ModelResponse>) {
		this.#generate = generate;
	}

	async generate(request: ModelRequest): Promise<ModelResponse> {
		this.requests.push(request);
		return this.#generate(request);
	}

	async *stream(_request: ModelRequest): AsyncIterable<ModelStreamChunk> {
		yield* [];
	}
}

function createToolDefinition(
	execute: (input: ToolCallInput, context: ToolExecutionContext) => Promise<ToolResult>,
	callableSchema?: ToolCallableSchema,
	metadataOverrides: Partial<ToolDefinition['metadata']> = {},
	name: ToolDefinition['name'] = 'file.read',
): ToolDefinition {
	return {
		callable_schema: callableSchema,
		description: 'Test tool for runModelTurn.',
		execute,
		metadata: {
			capability_class: 'file_system',
			requires_approval: false,
			risk_level: 'low',
			side_effect_level: 'read',
			...metadataOverrides,
		},
		name,
	};
}

const fileReadCallableSchema: ToolCallableSchema = {
	parameters: {
		path: {
			description: 'Path to read.',
			required: true,
			type: 'string',
		},
	},
};

const searchGrepCallableSchema: ToolCallableSchema = {
	parameters: {
		path: {
			description: 'Path to search.',
			required: true,
			type: 'string',
		},
		query: {
			description: 'Query to search for.',
			required: true,
			type: 'string',
		},
	},
};

const explicitAvailableTools: readonly ModelCallableTool[] = [
	{
		description: 'Explicit test tool.',
		name: 'shell.exec',
		parameters: {
			command: {
				description: 'Command to execute.',
				required: true,
				type: 'string',
			},
		},
	},
];

function createPersistenceRecorder(): {
	readonly runRecords: Parameters<RunRecordWriter['upsertRun']>[0][];
	readonly toolCallRecords: Parameters<RunRecordWriter['upsertToolCall']>[0][];
	readonly writer: RunRecordWriter;
} {
	const runRecords: Parameters<RunRecordWriter['upsertRun']>[0][] = [];
	const toolCallRecords: Parameters<RunRecordWriter['upsertToolCall']>[0][] = [];

	return {
		runRecords,
		toolCallRecords,
		writer: {
			async upsertRun(record) {
				runRecords.push(record);
			},
			async upsertToolCall(record) {
				toolCallRecords.push(record);
			},
		},
	};
}

function createModelRequest(overrides: Partial<ModelRequest> = {}): ModelRequest {
	return {
		messages: [
			{
				content: 'Hello',
				role: 'user',
			},
		],
		run_id: 'run_model_turn',
		trace_id: 'trace_model_turn',
		...overrides,
	};
}

describe('runModelTurn', () => {
	it('completes the assistant path from generate through adapter and continuation', async () => {
		const persistence = createPersistenceRecorder();
		const modelResponse: ModelResponse = {
			finish_reason: 'stop',
			message: {
				content: 'Assistant final answer.',
				role: 'assistant',
			},
			model: 'claude-3-7-sonnet',
			provider: 'claude',
		};
		const gateway = new FakeModelGateway(async () => modelResponse);

		const result = await runModelTurn({
			current_state: 'MODEL_THINKING',
			execution_context: {
				run_id: 'run_model_turn_assistant',
				trace_id: 'trace_model_turn_assistant',
			},
			model_gateway: gateway,
			model_request: createModelRequest({
				run_id: 'run_model_turn_assistant',
				trace_id: 'trace_model_turn_assistant',
			}),
			persistence_writer: persistence.writer,
			registry: new ToolRegistry(),
			run_id: 'run_model_turn_assistant',
			trace_id: 'trace_model_turn_assistant',
		});

		expect(result).toEqual({
			assistant_text: 'Assistant final answer.',
			continuation_result: {
				assistant_text: 'Assistant final answer.',
				events: [],
				final_state: 'COMPLETED',
				outcome_kind: 'assistant_response',
				state_transitions: [
					{
						from: 'MODEL_THINKING',
						to: 'COMPLETED',
					},
				],
				status: 'completed',
			},
			final_state: 'COMPLETED',
			model_response: modelResponse,
			model_turn_outcome: {
				kind: 'assistant_response',
				text: 'Assistant final answer.',
			},
			resolved_model_request: {
				messages: [
					{
						content: 'Hello',
						role: 'user',
					},
				],
				run_id: 'run_model_turn_assistant',
				trace_id: 'trace_model_turn_assistant',
			},
			status: 'completed',
		});
		expect(gateway.requests).toEqual([
			{
				messages: [
					{
						content: 'Hello',
						role: 'user',
					},
				],
				run_id: 'run_model_turn_assistant',
				trace_id: 'trace_model_turn_assistant',
			},
		]);
		expect(persistence.runRecords.map((record) => record.current_state)).toEqual([
			'MODEL_THINKING',
			'COMPLETED',
		]);
		expect(persistence.toolCallRecords).toEqual([]);
	});

	it('fails assistant responses truncated by max_tokens without marking the run complete', async () => {
		const persistence = createPersistenceRecorder();
		const modelResponse: ModelResponse = {
			finish_reason: 'max_tokens',
			message: {
				content: 'Partial answer that stops mid-sentence',
				role: 'assistant',
			},
			model: 'deepseek-v4-pro',
			provider: 'deepseek',
		};
		const gateway = new FakeModelGateway(async () => modelResponse);

		const result = await runModelTurn({
			current_state: 'MODEL_THINKING',
			execution_context: {
				run_id: 'run_model_turn_truncated',
				trace_id: 'trace_model_turn_truncated',
			},
			model_gateway: gateway,
			model_request: createModelRequest({
				max_output_tokens: 64,
				run_id: 'run_model_turn_truncated',
				trace_id: 'trace_model_turn_truncated',
			}),
			persistence_writer: persistence.writer,
			registry: new ToolRegistry(),
			run_id: 'run_model_turn_truncated',
			trace_id: 'trace_model_turn_truncated',
		});

		expect(result.status).toBe('failed');
		expect(result.final_state).toBe('FAILED');
		if (result.status !== 'failed') {
			throw new Error('Expected max_tokens assistant response to fail.');
		}
		expect(result.failure).toEqual({
			code: 'MODEL_RESPONSE_TRUNCATED',
			message:
				'Model response reached the max_output_tokens limit before a natural stop; partial assistant text was not marked complete.',
		});
		expect(result.model_response).toBe(modelResponse);
		expect(result.model_turn_outcome).toEqual({
			kind: 'assistant_response',
			text: 'Partial answer that stops mid-sentence',
		});
		expect(persistence.runRecords.map((record) => record.current_state)).toEqual([
			'MODEL_THINKING',
			'FAILED',
		]);
		expect(persistence.runRecords.at(-1)?.last_error_code).toBe('MODEL_RESPONSE_TRUNCATED');
	});

	it('completes the tool_call path from generate through adapter and continuation', async () => {
		const registry = new ToolRegistry();
		const persistence = createPersistenceRecorder();
		const gateway = new FakeModelGateway(async () => ({
			finish_reason: 'stop',
			message: {
				content: 'Calling file.read',
				role: 'assistant',
			},
			model: 'claude-3-7-sonnet',
			provider: 'claude',
			tool_call_candidate: {
				call_id: 'call_run_model_turn_tool',
				tool_input: {
					path: 'src/example.ts',
				},
				tool_name: 'file.read',
			},
		}));

		registry.register(
			createToolDefinition(
				async () => ({
					call_id: 'call_run_model_turn_tool',
					output: {
						content: 'file body',
						path: 'src/example.ts',
					},
					status: 'success',
					tool_name: 'file.read',
				}),
				fileReadCallableSchema,
			),
		);

		const result = await runModelTurn({
			current_state: 'MODEL_THINKING',
			execution_context: {
				run_id: 'run_model_turn_tool',
				trace_id: 'trace_model_turn_tool',
				working_directory: 'd:\\ai\\Runa',
			},
			model_gateway: gateway,
			model_request: createModelRequest({
				run_id: 'run_model_turn_tool',
				trace_id: 'trace_model_turn_tool',
			}),
			persistence_writer: persistence.writer,
			registry,
			run_id: 'run_model_turn_tool',
			trace_id: 'trace_model_turn_tool',
		});

		expect(result.status).toBe('completed');

		if (result.status !== 'completed' || result.final_state !== 'TOOL_RESULT_INGESTING') {
			throw new Error('Expected tool_call model turn to complete.');
		}

		expect(result.model_turn_outcome).toEqual({
			call_id: 'call_run_model_turn_tool',
			kind: 'tool_call',
			tool_input: {
				path: 'src/example.ts',
			},
			tool_name: 'file.read',
		});
		expect(result.tool_result).toEqual({
			call_id: 'call_run_model_turn_tool',
			output: {
				content: 'file body',
				path: 'src/example.ts',
			},
			status: 'success',
			tool_name: 'file.read',
		});
		expect(result.ingested_result).toEqual({
			call_id: 'call_run_model_turn_tool',
			kind: 'tool_result',
			output: {
				content: 'file body',
				path: 'src/example.ts',
			},
			result_status: 'success',
			tool_name: 'file.read',
		});
		expect(result.suggested_next_state).toBe('MODEL_THINKING');
		expect(result.continuation_result.status).toBe('completed');
		expect(gateway.requests).toEqual([
			{
				available_tools: [
					{
						description: 'Test tool for runModelTurn.',
						name: 'file.read',
						parameters: {
							path: {
								description: 'Path to read.',
								required: true,
								type: 'string',
							},
						},
					},
				],
				messages: [
					{
						content: 'Hello',
						role: 'user',
					},
				],
				run_id: 'run_model_turn_tool',
				trace_id: 'trace_model_turn_tool',
			},
		]);
		expect(persistence.runRecords.map((record) => record.current_state)).toEqual([
			'MODEL_THINKING',
			'TOOL_EXECUTING',
			'TOOL_RESULT_INGESTING',
			'TOOL_RESULT_INGESTING',
		]);
		expect(persistence.toolCallRecords.map((record) => record.status)).toEqual([
			'started',
			'completed',
		]);
		expect(persistence.toolCallRecords[1]).toMatchObject({
			call_id: 'call_run_model_turn_tool',
			state_after: 'TOOL_RESULT_INGESTING',
			tool_name: 'file.read',
		});
	});

	it('completes the tool_call_candidates array path through core adapter, scheduler, and continuation', async () => {
		const registry = new ToolRegistry();
		const persistence = createPersistenceRecorder();
		const gateway = new FakeModelGateway(async () => ({
			finish_reason: 'stop',
			message: {
				content: 'Calling multiple tools',
				role: 'assistant',
			},
			model: 'llama-3.3-70b-versatile',
			provider: 'groq',
			tool_call_candidates: [
				{
					call_id: 'call_run_model_turn_batch_read',
					tool_input: {
						path: 'src/example.ts',
					},
					tool_name: 'file.read',
				},
				{
					call_id: 'call_run_model_turn_batch_search',
					tool_input: {
						query: 'Runa',
					},
					tool_name: 'web.search',
				},
			],
		}));

		registry.register(
			createToolDefinition(
				async (input) => ({
					call_id: input.call_id,
					output: {
						content: 'file body',
					},
					status: 'success',
					tool_name: 'file.read',
				}),
				fileReadCallableSchema,
			),
		);
		registry.register(
			createToolDefinition(
				async (input) => ({
					call_id: input.call_id,
					output: {
						results: ['web result'],
					},
					status: 'success',
					tool_name: 'web.search',
				}),
				{
					parameters: {
						query: {
							required: true,
							type: 'string',
						},
					},
				},
				{
					capability_class: 'search',
				},
				'web.search',
			),
		);

		const result = await runModelTurn({
			current_state: 'MODEL_THINKING',
			execution_context: {
				run_id: 'run_model_turn_batch',
				trace_id: 'trace_model_turn_batch',
				working_directory: 'd:\\ai\\Runa',
			},
			model_gateway: gateway,
			model_request: createModelRequest({
				run_id: 'run_model_turn_batch',
				trace_id: 'trace_model_turn_batch',
			}),
			persistence_writer: persistence.writer,
			registry,
			run_id: 'run_model_turn_batch',
			trace_id: 'trace_model_turn_batch',
		});

		expect(result.status).toBe('completed');

		if (result.status !== 'completed' || result.final_state !== 'TOOL_RESULT_INGESTING') {
			throw new Error('Expected batched tool_call_candidates model turn to complete.');
		}

		expect(result.model_turn_outcome).toEqual({
			kind: 'tool_calls',
			tool_calls: [
				{
					call_id: 'call_run_model_turn_batch_read',
					kind: 'tool_call',
					tool_input: {
						path: 'src/example.ts',
					},
					tool_name: 'file.read',
				},
				{
					call_id: 'call_run_model_turn_batch_search',
					kind: 'tool_call',
					tool_input: {
						query: 'Runa',
					},
					tool_name: 'web.search',
				},
			],
		});
		expect(result.continuation_result.outcome_kind).toBe('tool_calls');
		expect(result.tool_result).toMatchObject({
			call_id: 'call_run_model_turn_batch_search',
			tool_name: 'web.search',
		});
		expect(result.tool_results).toEqual([
			{
				call_id: 'call_run_model_turn_batch_read',
				output: {
					content: 'file body',
				},
				status: 'success',
				tool_name: 'file.read',
			},
			{
				call_id: 'call_run_model_turn_batch_search',
				output: {
					results: ['web result'],
				},
				status: 'success',
				tool_name: 'web.search',
			},
		]);
		expect(persistence.toolCallRecords.map((record) => record.call_id)).toEqual([
			'call_run_model_turn_batch_read',
			'call_run_model_turn_batch_search',
			'call_run_model_turn_batch_read',
			'call_run_model_turn_batch_search',
		]);
	});

	it('preserves explicit available_tools on the model request', async () => {
		const gateway = new FakeModelGateway(async () => ({
			finish_reason: 'stop',
			message: {
				content: 'Assistant final answer.',
				role: 'assistant',
			},
			model: 'claude-3-7-sonnet',
			provider: 'claude',
		}));
		const registry = new ToolRegistry();

		registry.register(
			createToolDefinition(
				async () => ({
					call_id: 'call_explicit_tools',
					output: {
						content: 'unused',
						path: 'unused',
					},
					status: 'success',
					tool_name: 'file.read',
				}),
				fileReadCallableSchema,
			),
		);

		const result = await runModelTurn({
			current_state: 'MODEL_THINKING',
			execution_context: {
				run_id: 'run_explicit_tools',
				trace_id: 'trace_explicit_tools',
			},
			model_gateway: gateway,
			model_request: createModelRequest({
				available_tools: explicitAvailableTools,
				run_id: 'run_explicit_tools',
				trace_id: 'trace_explicit_tools',
			}),
			registry,
			run_id: 'run_explicit_tools',
			trace_id: 'trace_explicit_tools',
		});

		expect(result.status).toBe('completed');
		expect(gateway.requests).toEqual([
			{
				available_tools: explicitAvailableTools,
				messages: [
					{
						content: 'Hello',
						role: 'user',
					},
				],
				run_id: 'run_explicit_tools',
				trace_id: 'trace_explicit_tools',
			},
		]);
	});

	it('binds a deterministic tool subset when explicit tool_names are provided', async () => {
		const gateway = new FakeModelGateway(async () => ({
			finish_reason: 'stop',
			message: {
				content: 'Assistant final answer.',
				role: 'assistant',
			},
			model: 'claude-3-7-sonnet',
			provider: 'claude',
		}));
		const registry = new ToolRegistry();

		registry.register(
			createToolDefinition(
				async () => ({
					call_id: 'call_subset_read',
					output: {
						content: 'unused',
						path: 'unused',
					},
					status: 'success',
					tool_name: 'file.read',
				}),
				fileReadCallableSchema,
			),
		);
		registry.register({
			callable_schema: searchGrepCallableSchema,
			description: 'Search inside files.',
			async execute() {
				return {
					call_id: 'call_subset_search',
					output: {
						matches: [],
					},
					status: 'success',
					tool_name: 'search.grep',
				};
			},
			metadata: {
				capability_class: 'search',
				requires_approval: false,
				risk_level: 'low',
				side_effect_level: 'read',
			},
			name: 'search.grep',
		} satisfies ToolDefinition);

		const result = await runModelTurn({
			current_state: 'MODEL_THINKING',
			execution_context: {
				run_id: 'run_subset_tools',
				trace_id: 'trace_subset_tools',
			},
			model_gateway: gateway,
			model_request: createModelRequest({
				run_id: 'run_subset_tools',
				trace_id: 'trace_subset_tools',
			}),
			registry,
			run_id: 'run_subset_tools',
			tool_names: ['search.grep'],
			trace_id: 'trace_subset_tools',
		});

		expect(result.status).toBe('completed');
		expect(gateway.requests).toEqual([
			{
				available_tools: [
					{
						description: 'Search inside files.',
						name: 'search.grep',
						parameters: {
							path: {
								description: 'Path to search.',
								required: true,
								type: 'string',
							},
							query: {
								description: 'Query to search for.',
								required: true,
								type: 'string',
							},
						},
					},
				],
				messages: [
					{
						content: 'Hello',
						role: 'user',
					},
				],
				run_id: 'run_subset_tools',
				trace_id: 'trace_subset_tools',
			},
		]);
	});

	it('returns approval_required for gated tool calls without executing the tool', async () => {
		const registry = new ToolRegistry();
		const persistence = createPersistenceRecorder();
		let executeCount = 0;
		const gateway = new FakeModelGateway(async () => ({
			finish_reason: 'stop',
			message: {
				content: 'Calling file.write',
				role: 'assistant',
			},
			model: 'claude-3-7-sonnet',
			provider: 'claude',
			tool_call_candidate: {
				call_id: 'call_run_model_turn_approval',
				tool_input: {
					path: 'src/example.ts',
				},
				tool_name: 'file.write',
			},
		}));

		registry.register({
			...createToolDefinition(
				async () => {
					executeCount += 1;

					return {
						call_id: 'call_run_model_turn_approval',
						output: {
							written: true,
						},
						status: 'success',
						tool_name: 'file.write',
					};
				},
				fileReadCallableSchema,
				{
					requires_approval: true,
					risk_level: 'medium',
					side_effect_level: 'write',
				},
			),
			name: 'file.write',
		} satisfies ToolDefinition);

		const result = await runModelTurn({
			current_state: 'MODEL_THINKING',
			execution_context: {
				run_id: 'run_model_turn_approval',
				trace_id: 'trace_model_turn_approval',
				working_directory: 'd:\\ai\\Runa',
			},
			model_gateway: gateway,
			model_request: createModelRequest({
				run_id: 'run_model_turn_approval',
				trace_id: 'trace_model_turn_approval',
			}),
			persistence_writer: persistence.writer,
			registry,
			run_id: 'run_model_turn_approval',
			trace_id: 'trace_model_turn_approval',
		});

		expect(result.status).toBe('approval_required');

		if (result.status !== 'approval_required') {
			throw new Error('Expected approval-required model turn result.');
		}

		expect(result.final_state).toBe('WAITING_APPROVAL');
		expect(result.model_turn_outcome).toEqual({
			call_id: 'call_run_model_turn_approval',
			kind: 'tool_call',
			tool_input: {
				path: 'src/example.ts',
			},
			tool_name: 'file.write',
		});
		expect(result.approval_request).toMatchObject({
			action_kind: 'file_write',
			call_id: 'call_run_model_turn_approval',
			run_id: 'run_model_turn_approval',
			tool_name: 'file.write',
		});
		expect(result.continuation_result).toMatchObject({
			final_state: 'WAITING_APPROVAL',
			outcome_kind: 'tool_call',
			status: 'approval_required',
		});
		expect(executeCount).toBe(0);
		expect(persistence.runRecords.map((record) => record.current_state)).toEqual([
			'MODEL_THINKING',
			'WAITING_APPROVAL',
			'WAITING_APPROVAL',
		]);
		expect(persistence.toolCallRecords).toEqual([]);
	});

	it('fails clearly for invalid starting state', async () => {
		const gateway = new FakeModelGateway(async () => {
			throw new Error('generate should not be called');
		});

		const result = await runModelTurn({
			current_state: 'INIT',
			execution_context: {
				run_id: 'run_model_turn_invalid_state',
				trace_id: 'trace_model_turn_invalid_state',
			},
			model_gateway: gateway,
			model_request: createModelRequest({
				run_id: 'run_model_turn_invalid_state',
				trace_id: 'trace_model_turn_invalid_state',
			}),
			registry: new ToolRegistry(),
			run_id: 'run_model_turn_invalid_state',
			trace_id: 'trace_model_turn_invalid_state',
		});

		expect(result).toEqual({
			continuation_result: undefined,
			failure: {
				cause: undefined,
				code: 'INVALID_CURRENT_STATE',
				message: 'runModelTurn expects MODEL_THINKING but received INIT',
			},
			final_state: 'FAILED',
			model_response: undefined,
			model_turn_outcome: undefined,
			resolved_model_request: undefined,
			status: 'failed',
		});
	});

	it('fails clearly when gateway.generate throws', async () => {
		const persistence = createPersistenceRecorder();
		const result = await runModelTurn({
			current_state: 'MODEL_THINKING',
			execution_context: {
				run_id: 'run_model_turn_generate_failure',
				trace_id: 'trace_model_turn_generate_failure',
			},
			model_gateway: new FakeModelGateway(async () => {
				throw new Error('gateway unavailable');
			}),
			model_request: createModelRequest({
				run_id: 'run_model_turn_generate_failure',
				trace_id: 'trace_model_turn_generate_failure',
			}),
			persistence_writer: persistence.writer,
			registry: new ToolRegistry(),
			run_id: 'run_model_turn_generate_failure',
			trace_id: 'trace_model_turn_generate_failure',
		});

		expect(result.status).toBe('failed');

		if (result.status !== 'failed') {
			throw new Error('Expected generate failure result.');
		}

		expect(result.final_state).toBe('FAILED');
		expect(result.failure.code).toBe('MODEL_GENERATE_FAILED');
		expect(result.failure.message).toBe('Model generate failed: gateway unavailable');
		expect(result.failure.cause).toBeInstanceOf(Error);

		if (!(result.failure.cause instanceof Error)) {
			throw new Error('Expected generate failure cause to be an Error instance.');
		}

		expect(result.failure.cause.message).toBe('gateway unavailable');
		expect(persistence.runRecords.map((record) => record.current_state)).toEqual([
			'MODEL_THINKING',
			'FAILED',
		]);
	});

	it('recovers from a token limit generate failure by compacting context and retrying in the same turn', async () => {
		const persistence = createPersistenceRecorder();
		const gateway = new FakeModelGateway(async (request) => {
			const layerNames = request.compiled_context?.layers.map((layer) => layer.name) ?? [];

			if (!layerNames.includes('microcompact_summary')) {
				const error = new Error('context window exceeded');

				throw Object.assign(error, {
					code: 'CONTEXT_LENGTH_EXCEEDED',
					status: 413,
				});
			}

			return {
				finish_reason: 'stop',
				message: {
					content: 'Recovered after compaction.',
					role: 'assistant',
				},
				model: 'claude-3-7-sonnet',
				provider: 'claude',
			};
		});
		const tokenLimitRecovery = createTokenLimitRecovery({
			compaction_strategy: createMicrocompactStrategy(),
		});

		const result = await runModelTurn({
			current_state: 'MODEL_THINKING',
			execution_context: {
				run_id: 'run_model_turn_token_recovery',
				trace_id: 'trace_model_turn_token_recovery',
			},
			model_gateway: gateway,
			model_request: createModelRequest({
				compiled_context: {
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
								run_id: 'run_model_turn_token_recovery',
								trace_id: 'trace_model_turn_token_recovery',
							},
							kind: 'runtime',
							name: 'run_layer',
						},
						{
							content: {
								items: [
									{
										content: Array.from({ length: 240 }, (_, index) => `memory-${index}`).join(' '),
										summary: 'Long memory layer',
									},
								],
								layer_type: 'memory_layer',
							},
							kind: 'memory',
							name: 'memory_layer',
						},
						{
							content: {
								summary: Array.from({ length: 240 }, (_, index) => `workspace-${index}`).join(' '),
								title: 'Workspace Overview',
							},
							kind: 'workspace',
							name: 'workspace_layer',
						},
					],
				},
				run_id: 'run_model_turn_token_recovery',
				trace_id: 'trace_model_turn_token_recovery',
			}),
			persistence_writer: persistence.writer,
			registry: new ToolRegistry(),
			run_id: 'run_model_turn_token_recovery',
			token_limit_recovery: tokenLimitRecovery,
			trace_id: 'trace_model_turn_token_recovery',
		});

		expect(result.status).toBe('completed');

		if (result.status !== 'completed' || result.final_state !== 'COMPLETED') {
			throw new Error('Expected token-limit recovery path to complete.');
		}

		expect(result.assistant_text).toBe('Recovered after compaction.');
		expect(
			result.resolved_model_request.compiled_context?.layers.map((layer) => layer.name),
		).toEqual(['core_rules', 'run_layer', 'microcompact_summary']);
		expect(gateway.requests).toHaveLength(2);
		expect(gateway.requests[1]?.compiled_context?.layers.map((layer) => layer.name)).toEqual([
			'core_rules',
			'run_layer',
			'microcompact_summary',
		]);
		expect(persistence.runRecords.map((record) => record.current_state)).toEqual([
			'MODEL_THINKING',
			'COMPLETED',
		]);
	});

	it('fails clearly when registry-to-request binding fails for an unknown tool name', async () => {
		const gateway = new FakeModelGateway(async () => ({
			finish_reason: 'stop',
			message: {
				content: 'Assistant final answer.',
				role: 'assistant',
			},
			model: 'claude-3-7-sonnet',
			provider: 'claude',
		}));
		const persistence = createPersistenceRecorder();

		const result = await runModelTurn({
			current_state: 'MODEL_THINKING',
			execution_context: {
				run_id: 'run_model_turn_binding_failure',
				trace_id: 'trace_model_turn_binding_failure',
			},
			model_gateway: gateway,
			model_request: createModelRequest({
				run_id: 'run_model_turn_binding_failure',
				trace_id: 'trace_model_turn_binding_failure',
			}),
			persistence_writer: persistence.writer,
			registry: new ToolRegistry(),
			run_id: 'run_model_turn_binding_failure',
			tool_names: ['file.read'],
			trace_id: 'trace_model_turn_binding_failure',
		});

		expect(result).toEqual({
			continuation_result: undefined,
			failure: {
				cause: {
					code: 'TOOL_NOT_FOUND',
					message: 'Tool registry does not contain file.read.',
					tool_name: 'file.read',
				},
				code: 'AVAILABLE_TOOLS_BINDING_FAILED',
				message: 'Tool registry does not contain file.read.',
			},
			final_state: 'FAILED',
			model_response: undefined,
			model_turn_outcome: undefined,
			resolved_model_request: undefined,
			status: 'failed',
		});
		expect(gateway.requests).toEqual([]);
		expect(persistence.runRecords.map((record) => record.current_state)).toEqual([
			'MODEL_THINKING',
			'FAILED',
		]);
	});
});
