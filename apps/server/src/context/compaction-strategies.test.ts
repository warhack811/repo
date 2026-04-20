import { describe, expect, it, vi } from 'vitest';

import type {
	CheckpointBlobRef,
	CompiledContextArtifact,
	ModelGateway,
	ModelRequest,
	ModelResponse,
	ModelStreamChunk,
} from '@runa/types';

import {
	ContextCompactionExecutionError,
	compactContext,
	createLlmCompactionSummarizer,
	createMicrocompactStrategy,
} from './compaction-strategies.js';
import { estimateTokenCountFromCharCount } from './compiled-context-text.js';

class StubModelGateway implements ModelGateway {
	readonly generateMock: ReturnType<
		typeof vi.fn<(request: ModelRequest) => Promise<ModelResponse>>
	>;

	constructor(implementation: (request: ModelRequest) => Promise<ModelResponse> | ModelResponse) {
		this.generateMock = vi.fn(implementation);
	}

	async generate(request: ModelRequest): Promise<ModelResponse> {
		return this.generateMock(request);
	}

	stream(): AsyncIterable<ModelStreamChunk> {
		const iterator: AsyncIterator<ModelStreamChunk> = {
			next: async () => {
				throw new Error('stream not implemented in StubModelGateway.');
			},
		};

		return {
			[Symbol.asyncIterator](): AsyncIterator<ModelStreamChunk> {
				return iterator;
			},
		};
	}
}

function createRepeatedText(label: string, repeats: number): string {
	return Array.from({ length: repeats }, (_, index) => `${label}-${index}`).join(' ');
}

function createCompiledContext(): CompiledContextArtifact {
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
					run_id: 'run_compaction_1',
					trace_id: 'trace_compaction_1',
				},
				kind: 'runtime',
				name: 'run_layer',
			},
			{
				content: {
					items: [
						{
							content: createRepeatedText('memory', 220),
							summary: 'Long memory context',
						},
					],
					layer_type: 'memory_layer',
				},
				kind: 'memory',
				name: 'memory_layer',
			},
			{
				content: {
					summary: createRepeatedText('workspace', 220),
					title: 'Workspace Overview',
				},
				kind: 'workspace',
				name: 'workspace_layer',
			},
		],
	};
}

function createCheckpointBlobRef(): CheckpointBlobRef {
	return {
		blob_id: 'blob_checkpoint_compaction_1',
		checkpoint_id: 'checkpoint_compaction_1',
		content_type: 'application/json',
		kind: 'context_snapshot',
		storage_kind: 'object_storage',
	};
}

describe('compaction-strategies', () => {
	it('produces a deterministic microcompact result against the target token range', async () => {
		const strategy = createMicrocompactStrategy();
		const compiledContext = createCompiledContext();

		const first = await compactContext(
			{
				compiled_context: compiledContext,
				target_token_range: {
					max: 320,
					min: 220,
				},
			},
			strategy,
		);
		const second = await compactContext(
			{
				compiled_context: compiledContext,
				target_token_range: {
					max: 320,
					min: 220,
				},
			},
			strategy,
		);

		expect(first).toEqual(second);
		expect(first.status).toBe('compacted');
		expect(first.budget.input_tokens).toBeGreaterThan(first.budget.output_tokens);
		expect(first.budget.output_tokens).toBeLessThanOrEqual(320);
		expect(first.compacted_context?.layers.map((layer) => layer.name)).toEqual([
			'core_rules',
			'run_layer',
			'microcompact_summary',
		]);
		expect(first.summary?.estimated_usage.token_count).toBe(
			estimateTokenCountFromCharCount(first.summary?.estimated_usage.char_count ?? 0),
		);
	});

	it('keeps preserved refs and preserved layers while compacting summarizable content', async () => {
		const strategy = createMicrocompactStrategy();
		const compiledContext = createCompiledContext();
		const checkpointBlobRef = createCheckpointBlobRef();

		const result = await compactContext(
			{
				artifact_refs: [
					{
						checkpoint_blob_ref: checkpointBlobRef,
						kind: 'checkpoint_blob',
						layer_name: 'memory_layer',
						ref_id: 'ref_memory_blob_1',
					},
					{
						kind: 'tool_artifact',
						layer_name: 'run_layer',
						ref_id: 'ref_run_tool_1',
					},
				],
				compiled_context: compiledContext,
				target_token_range: {
					max: 180,
					min: 90,
				},
			},
			strategy,
		);

		expect(result.compacted_context?.layers[0]?.name).toBe('core_rules');
		expect(result.compacted_context?.layers[1]?.name).toBe('run_layer');
		expect(result.preserved_artifact_refs.map((artifactRef) => artifactRef.ref_id)).toEqual([
			'ref_memory_blob_1',
			'ref_run_tool_1',
		]);
		expect(result.provenance).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					action: 'preserved',
					name: 'run_layer',
				}),
				expect.objectContaining({
					action: 'summarized',
					artifact_ref_ids: ['ref_memory_blob_1'],
					name: 'memory_layer',
				}),
			]),
		);
	});

	it('carries summary and provenance metadata through an injected summarizer seam', async () => {
		const summarizer = vi.fn().mockResolvedValue({
			summary_text: 'memory and workspace were compacted into a shorter checkpoint-friendly note.',
			summarizer: 'stub-summarizer',
		});
		const strategy = createMicrocompactStrategy({
			summarizer,
		});
		const compiledContext = createCompiledContext();

		const result = await strategy.compact({
			compiled_context: compiledContext,
			metadata: {
				reason: '413_recovery_preflight',
			},
			target_token_range: {
				max: 180,
				min: 90,
			},
		});

		expect(summarizer).toHaveBeenCalledTimes(1);
		expect(summarizer).toHaveBeenCalledWith(
			expect.objectContaining({
				sources: expect.arrayContaining([
					expect.objectContaining({
						layer: expect.objectContaining({
							name: 'memory_layer',
						}),
					}),
					expect.objectContaining({
						layer: expect.objectContaining({
							name: 'workspace_layer',
						}),
					}),
				]),
				target_token_range: {
					max: 180,
					min: 90,
				},
			}),
		);
		expect(result.strategy).toEqual({
			name: 'microcompact',
			summarizer: 'stub-summarizer',
			version: 1,
		});
		expect(result.metadata).toEqual({
			reason: '413_recovery_preflight',
		});
		expect(result.summary).toEqual({
			estimated_usage: expect.objectContaining({
				token_count: expect.any(Number),
			}),
			source_layer_count: 2,
			source_token_count: expect.any(Number),
			text: 'memory and workspace were compacted into a shorter checkpoint-friendly note.',
		});
	});

	it('handles empty or already-small input safely as a noop', async () => {
		const strategy = createMicrocompactStrategy();

		await expect(
			strategy.compact({
				compiled_context: {
					layers: [],
				},
			}),
		).resolves.toEqual({
			budget: {
				input_tokens: 0,
				output_tokens: 0,
				target_token_range: {
					max: 1024,
					min: 512,
				},
				target_tokens: 1024,
				within_target_range: true,
			},
			compacted_context: {
				layers: [],
			},
			metadata: undefined,
			preserved_artifact_refs: [],
			provenance: [],
			status: 'noop',
			strategy: {
				name: 'microcompact',
				summarizer: 'deterministic',
				version: 1,
			},
		});
	});

	it('wraps summarizer failures in a controlled typed error', async () => {
		const strategy = createMicrocompactStrategy({
			summarizer: async () => {
				throw new Error('summarizer unavailable');
			},
		});

		await expect(
			strategy.compact({
				compiled_context: createCompiledContext(),
				target_token_range: {
					max: 180,
					min: 90,
				},
			}),
		).rejects.toBeInstanceOf(ContextCompactionExecutionError);
	});

	it('creates an LLM-based summarizer that uses ModelGateway.generate()', async () => {
		const gateway = new StubModelGateway(async () => ({
			finish_reason: 'stop',
			message: {
				content: 'Condensed task, constraints, and open questions.',
				role: 'assistant',
			},
			model: 'test-compaction-model',
			provider: 'stub-provider',
		}));
		const summarizer = createLlmCompactionSummarizer({
			model: 'test-compaction-model',
			model_gateway: gateway,
			temperature: 0,
		});

		const output = await summarizer({
			sources: [
				{
					artifact_refs: [],
					estimated_usage: {
						char_count: 40,
						token_count: 10,
					},
					formatted_text: '[memory_layer:memory]\n{"summary":"Long memory details"}',
					layer: {
						content: {
							summary: 'Long memory details',
						},
						kind: 'memory',
						name: 'memory_layer',
					},
				},
			],
			target_tokens: 96,
			target_token_range: {
				max: 128,
				min: 64,
			},
		});

		expect(gateway.generateMock).toHaveBeenCalledTimes(1);
		expect(gateway.generateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				max_output_tokens: 96,
				messages: [
					expect.objectContaining({
						content: expect.stringContaining('fits within roughly 96 tokens'),
						role: 'system',
					}),
					expect.objectContaining({
						content: expect.stringContaining('Allowed target range: 64-128 tokens.'),
						role: 'user',
					}),
				],
				model: 'test-compaction-model',
				run_id: 'run_context_compaction',
				trace_id: 'trace_context_compaction',
			}),
		);
		expect(output).toEqual({
			summary_text: 'Condensed task, constraints, and open questions.',
			summarizer: 'llm:stub-provider/test-compaction-model',
		});
	});

	it('falls back to the deterministic summarizer when the LLM summarizer fails', async () => {
		const gateway = new StubModelGateway(async () => {
			throw new Error('gateway unavailable');
		});
		const summarizer = createLlmCompactionSummarizer({
			model_gateway: gateway,
		});

		const output = await summarizer({
			sources: [
				{
					artifact_refs: [],
					estimated_usage: {
						char_count: 120,
						token_count: 30,
					},
					formatted_text: '[workspace_layer:workspace]\n{"summary":"Workspace details"}',
					layer: {
						content: {
							summary: 'Workspace details',
						},
						kind: 'workspace',
						name: 'workspace_layer',
					},
				},
			],
			target_tokens: 80,
			target_token_range: {
				max: 120,
				min: 60,
			},
		});

		expect(output.summarizer).toBe('deterministic');
		expect(output.summary_text).toContain('[workspace_layer:workspace]');
	});

	it('can be injected into createMicrocompactStrategy as a custom summarizer', async () => {
		const gateway = new StubModelGateway(async () => ({
			finish_reason: 'stop',
			message: {
				content: 'LLM compacted memory and workspace into a continuation summary.',
				role: 'assistant',
			},
			model: 'test-compaction-model',
			provider: 'stub-provider',
		}));
		const strategy = createMicrocompactStrategy({
			summarizer: createLlmCompactionSummarizer({
				model: 'test-compaction-model',
				model_gateway: gateway,
			}),
		});

		const result = await strategy.compact({
			compiled_context: createCompiledContext(),
			target_token_range: {
				max: 180,
				min: 90,
			},
		});

		expect(result.status).toBe('compacted');
		expect(result.strategy).toEqual({
			name: 'microcompact',
			summarizer: 'llm:stub-provider/test-compaction-model',
			version: 1,
		});
		expect(result.summary?.text).toBe(
			'LLM compacted memory and workspace into a continuation summary.',
		);
	});
});
