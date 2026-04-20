import type {
	CheckpointBlobRef,
	CompiledContextArtifact,
	CompiledContextLayer,
	ModelGateway,
	ModelRequest,
} from '@runa/types';

import {
	type TextUsageEstimate,
	estimateTextUsage,
	formatCompiledContextArtifact,
	formatCompiledContextLayer,
	stableSerializeContextValue,
} from './compiled-context-text.js';

export const microcompactStrategyName = 'microcompact' as const;

const DEFAULT_TARGET_TOKEN_RANGE = {
	max: 1024,
	min: 512,
} as const;

const DEFAULT_PRESERVED_LAYER_NAMES = ['core_rules', 'run_layer'] as const;
const DEFAULT_SUMMARY_LAYER_NAME = 'microcompact_summary';
const DEFAULT_SUMMARY_LAYER_KIND = 'compaction';
const DEFAULT_SUMMARIZER_LABEL = 'deterministic';
const DEFAULT_LLM_SUMMARIZER_LABEL = 'llm';
const DEFAULT_LLM_SUMMARIZER_RUN_ID = 'run_context_compaction';
const DEFAULT_LLM_SUMMARIZER_TRACE_ID = 'trace_context_compaction';
const FALLBACK_SUMMARY_CHAR_BUDGET = 160;
const MIN_SOURCE_EXCERPT_CHAR_BUDGET = 48;
const MIN_LLM_SUMMARIZER_OUTPUT_TOKENS = 32;
const MIN_LLM_SUMMARIZER_SOURCE_TOKENS = 128;
const MAX_LLM_SUMMARIZER_SOURCE_TOKENS = 4_096;

export interface CompactionTokenRange {
	readonly max: number;
	readonly min: number;
}

export interface CompactionBudgetInfo {
	readonly input_tokens: number;
	readonly output_tokens: number;
	readonly target_tokens: number;
	readonly target_token_range: CompactionTokenRange;
	readonly within_target_range: boolean;
}

export interface ContextCompactionArtifactRef {
	readonly checkpoint_blob_ref?: CheckpointBlobRef;
	readonly kind: 'checkpoint_blob' | 'context_artifact' | 'tool_artifact' | 'custom';
	readonly layer_name?: string;
	readonly metadata?: Readonly<Record<string, unknown>>;
	readonly ref_id: string;
}

export interface CompactionSourceProvenance {
	readonly action: 'preserved' | 'summarized';
	readonly artifact_ref_ids: readonly string[];
	readonly estimated_tokens: number;
	readonly kind: string;
	readonly name: string;
}

export interface CompactionSummary {
	readonly estimated_usage: TextUsageEstimate;
	readonly source_layer_count: number;
	readonly source_token_count: number;
	readonly text: string;
}

export interface CompactionStrategyMetadata {
	readonly name: typeof microcompactStrategyName;
	readonly summarizer: string;
	readonly version: 1;
}

export interface CompactableLayerSource {
	readonly artifact_refs: readonly ContextCompactionArtifactRef[];
	readonly estimated_usage: TextUsageEstimate;
	readonly formatted_text: string;
	readonly layer: CompiledContextLayer;
}

export interface CompactionSummarizerInput {
	readonly sources: readonly CompactableLayerSource[];
	readonly target_tokens: number;
	readonly target_token_range: CompactionTokenRange;
}

export interface CompactionSummarizerOutput {
	readonly summary_text: string;
	readonly summarizer: string;
}

export type ContextCompactionSummarizer = (
	input: CompactionSummarizerInput,
) => Promise<CompactionSummarizerOutput> | CompactionSummarizerOutput;

export interface CompactionInput {
	readonly artifact_refs?: readonly ContextCompactionArtifactRef[];
	readonly compiled_context?: CompiledContextArtifact;
	readonly metadata?: Readonly<Record<string, unknown>>;
	readonly preserve_layer_kinds?: readonly string[];
	readonly preserve_layer_names?: readonly string[];
	readonly target_token_range?: CompactionTokenRange;
}

export interface CompactionResult {
	readonly budget: CompactionBudgetInfo;
	readonly compacted_context?: CompiledContextArtifact;
	readonly metadata?: Readonly<Record<string, unknown>>;
	readonly preserved_artifact_refs: readonly ContextCompactionArtifactRef[];
	readonly provenance: readonly CompactionSourceProvenance[];
	readonly status: 'compacted' | 'noop';
	readonly strategy: CompactionStrategyMetadata;
	readonly summary?: CompactionSummary;
}

export interface ContextCompactionStrategy {
	compact(input: CompactionInput): Promise<CompactionResult>;
}

export interface CreateMicrocompactStrategyOptions {
	readonly summarizer?: ContextCompactionSummarizer;
	readonly summary_layer_kind?: string;
	readonly summary_layer_name?: string;
}

export interface CreateLlmCompactionSummarizerOptions {
	readonly fallback_summarizer?: ContextCompactionSummarizer;
	readonly model?: string;
	readonly model_gateway: ModelGateway;
	readonly summarizer_label?: string;
	readonly temperature?: number;
}

export class ContextCompactionConfigurationError extends Error {
	override readonly cause?: unknown;
	readonly code = 'CONTEXT_COMPACTION_CONFIGURATION_ERROR';

	constructor(message: string, cause?: unknown) {
		super(message);
		this.cause = cause;
		this.name = 'ContextCompactionConfigurationError';
	}
}

export class ContextCompactionValidationError extends Error {
	override readonly cause?: unknown;
	readonly code = 'CONTEXT_COMPACTION_VALIDATION_ERROR';

	constructor(message: string, cause?: unknown) {
		super(message);
		this.cause = cause;
		this.name = 'ContextCompactionValidationError';
	}
}

export class ContextCompactionExecutionError extends Error {
	override readonly cause?: unknown;
	readonly code = 'CONTEXT_COMPACTION_EXECUTION_ERROR';

	constructor(message: string, cause?: unknown) {
		super(message);
		this.cause = cause;
		this.name = 'ContextCompactionExecutionError';
	}
}

interface ClassifiedLayer {
	readonly artifact_refs: readonly ContextCompactionArtifactRef[];
	readonly estimated_usage: TextUsageEstimate;
	readonly formatted_text: string;
	readonly layer: CompiledContextLayer;
	readonly preserve_reason?: 'default' | 'explicit';
}

function normalizePositiveInteger(value: number, label: string): number {
	if (!Number.isFinite(value) || value < 1) {
		throw new ContextCompactionValidationError(`${label} must be a positive finite number.`);
	}

	return Math.trunc(value);
}

function resolveTargetTokenRange(range: CompactionTokenRange | undefined): CompactionTokenRange {
	if (range === undefined) {
		return DEFAULT_TARGET_TOKEN_RANGE;
	}

	const min = normalizePositiveInteger(range.min, 'target_token_range.min');
	const max = normalizePositiveInteger(range.max, 'target_token_range.max');

	if (min > max) {
		throw new ContextCompactionValidationError(
			'target_token_range.min must be less than or equal to target_token_range.max.',
		);
	}

	return { max, min };
}

function buildArtifactRefMap(
	artifactRefs: readonly ContextCompactionArtifactRef[],
): ReadonlyMap<string, readonly ContextCompactionArtifactRef[]> {
	const refsByLayer = new Map<string, ContextCompactionArtifactRef[]>();

	for (const artifactRef of artifactRefs) {
		const layerName = artifactRef.layer_name?.trim();

		if (!layerName) {
			continue;
		}

		const currentLayerRefs = refsByLayer.get(layerName) ?? [];
		currentLayerRefs.push(artifactRef);
		refsByLayer.set(layerName, currentLayerRefs);
	}

	return refsByLayer;
}

function collectUsage(compiledContext?: CompiledContextArtifact): TextUsageEstimate {
	if (!compiledContext) {
		return {
			char_count: 0,
			token_count: 0,
		};
	}

	const formattedText = formatCompiledContextArtifact(compiledContext) ?? '';

	return estimateTextUsage(formattedText);
}

function classifyLayers(
	layers: readonly CompiledContextLayer[],
	artifactRefs: readonly ContextCompactionArtifactRef[],
	preserveLayerNames: readonly string[],
	preserveLayerKinds: readonly string[],
): readonly ClassifiedLayer[] {
	const artifactRefMap = buildArtifactRefMap(artifactRefs);
	const defaultPreservedNames = new Set<string>(DEFAULT_PRESERVED_LAYER_NAMES);
	const explicitPreservedNames = new Set<string>(preserveLayerNames);
	const explicitPreservedKinds = new Set<string>(preserveLayerKinds);

	return layers.map((layer) => {
		const formattedText = formatCompiledContextLayer(layer);
		const estimatedUsage = estimateTextUsage(formattedText);
		const explicitPreserve =
			explicitPreservedNames.has(layer.name) || explicitPreservedKinds.has(layer.kind);
		const defaultPreserve = defaultPreservedNames.has(layer.name);

		return {
			artifact_refs: artifactRefMap.get(layer.name) ?? [],
			estimated_usage: estimatedUsage,
			formatted_text: formattedText,
			layer,
			preserve_reason: explicitPreserve ? 'explicit' : defaultPreserve ? 'default' : undefined,
		};
	});
}

function defaultMicrocompactSummarizer(
	input: CompactionSummarizerInput,
): CompactionSummarizerOutput {
	const targetCharBudget = Math.max(
		input.target_tokens * 4,
		Math.min(FALLBACK_SUMMARY_CHAR_BUDGET, input.target_token_range.max * 4),
	);

	if (targetCharBudget <= 0 || input.sources.length === 0) {
		return {
			summary_text: '',
			summarizer: DEFAULT_SUMMARIZER_LABEL,
		};
	}

	const perSourceBudget = Math.max(
		MIN_SOURCE_EXCERPT_CHAR_BUDGET,
		Math.floor(targetCharBudget / input.sources.length),
	);
	const summaryLines = input.sources.map((source) => {
		const compactValue =
			typeof source.layer.content === 'string'
				? source.layer.content
				: stableSerializeContextValue(source.layer.content);
		const normalizedValue = compactValue.replace(/\s+/gu, ' ').trim();
		const maxExcerptLength = Math.max(perSourceBudget - 24, 12);
		const excerpt =
			normalizedValue.length <= maxExcerptLength
				? normalizedValue
				: `${normalizedValue.slice(0, maxExcerptLength - 3)}...`;

		return `- [${source.layer.name}:${source.layer.kind}] ${excerpt}`;
	});
	const summaryText = summaryLines.join('\n');

	return {
		summary_text:
			summaryText.length <= targetCharBudget
				? summaryText
				: `${summaryText.slice(0, targetCharBudget - 3)}...`,
		summarizer: DEFAULT_SUMMARIZER_LABEL,
	};
}

function normalizeOptionalTemperature(value: number | undefined): number | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (!Number.isFinite(value) || value < 0) {
		throw new ContextCompactionConfigurationError(
			'LLM compaction summarizer temperature must be a non-negative finite number.',
		);
	}

	return value;
}

function resolveLlmSummarizerOutputTokenBudget(input: CompactionSummarizerInput): number {
	return Math.max(
		MIN_LLM_SUMMARIZER_OUTPUT_TOKENS,
		Math.min(input.target_token_range.max, Math.max(input.target_tokens, 1)),
	);
}

function resolveLlmSummarizerSourceTokenBudget(input: CompactionSummarizerInput): number {
	const desiredBudget = Math.max(
		MIN_LLM_SUMMARIZER_SOURCE_TOKENS,
		input.target_token_range.max * 4,
		input.target_tokens * 6,
	);

	return Math.min(MAX_LLM_SUMMARIZER_SOURCE_TOKENS, desiredBudget);
}

function truncateTextToCharBudget(text: string, maxChars: number): string {
	if (maxChars <= 0) {
		return '';
	}

	if (text.length <= maxChars) {
		return text;
	}

	if (maxChars <= 3) {
		return text.slice(0, maxChars);
	}

	return `${text.slice(0, maxChars - 3)}...`;
}

function buildSummarizerSourceBlock(source: CompactableLayerSource, maxChars: number): string {
	const body = truncateTextToCharBudget(source.formatted_text, maxChars);

	return [
		`Source Layer: ${source.layer.name} (${source.layer.kind})`,
		`Estimated Tokens: ${source.estimated_usage.token_count}`,
		'Content:',
		body,
	].join('\n');
}

function buildSummarizerSourcePrompt(input: CompactionSummarizerInput): string {
	const maxSourceTokens = resolveLlmSummarizerSourceTokenBudget(input);
	const sourceCharBudget = maxSourceTokens * 4;
	const selectedBlocks: string[] = [];
	let consumedChars = 0;

	for (const source of input.sources) {
		const remainingChars = sourceCharBudget - consumedChars;

		if (remainingChars <= 0) {
			break;
		}

		const nextBlock = buildSummarizerSourceBlock(source, remainingChars);

		if (!nextBlock.trim()) {
			continue;
		}

		selectedBlocks.push(nextBlock);
		consumedChars += nextBlock.length + 2;
	}

	return selectedBlocks.join('\n\n---\n\n');
}

function buildLlmSummarizerRequest(
	input: CompactionSummarizerInput,
	options: Readonly<{
		readonly model?: string;
		readonly temperature?: number;
	}>,
): ModelRequest {
	const systemPrompt = [
		'You summarize compiled runtime context for a long-running AI agent.',
		`Produce a concise summary that fits within roughly ${input.target_tokens} tokens.`,
		`Never exceed the hard upper bound implied by ${input.target_token_range.max} target tokens.`,
		'Preserve task goals, current constraints, unresolved questions, explicit user instructions, and any facts needed for safe continuation.',
		'Omit boilerplate, duplicates, and low-signal detail.',
		'Return plain text only.',
	].join(' ');
	const userPrompt = [
		'Compact the following context layers into one continuation-ready summary.',
		`Target summary tokens: ${input.target_tokens}.`,
		`Allowed target range: ${input.target_token_range.min}-${input.target_token_range.max} tokens.`,
		`Source layer count: ${input.sources.length}.`,
		'Source material:',
		buildSummarizerSourcePrompt(input),
	].join('\n\n');

	return {
		max_output_tokens: resolveLlmSummarizerOutputTokenBudget(input),
		messages: [
			{
				content: systemPrompt,
				role: 'system',
			},
			{
				content: userPrompt,
				role: 'user',
			},
		],
		model: options.model,
		run_id: DEFAULT_LLM_SUMMARIZER_RUN_ID,
		temperature: options.temperature,
		trace_id: DEFAULT_LLM_SUMMARIZER_TRACE_ID,
	};
}

async function runFallbackSummarizer(
	fallbackSummarizer: ContextCompactionSummarizer,
	input: CompactionSummarizerInput,
	llmError: unknown,
): Promise<CompactionSummarizerOutput> {
	try {
		return await fallbackSummarizer(input);
	} catch (fallbackError: unknown) {
		throw new ContextCompactionExecutionError(
			'LLM compaction summarizer failed and fallback summarizer did not recover.',
			{
				fallback_error: fallbackError,
				llm_error: llmError,
			},
		);
	}
}

export function createLlmCompactionSummarizer(
	options: CreateLlmCompactionSummarizerOptions,
): ContextCompactionSummarizer {
	const summarizerLabel = options.summarizer_label?.trim() || DEFAULT_LLM_SUMMARIZER_LABEL;
	const fallbackSummarizer = options.fallback_summarizer ?? defaultMicrocompactSummarizer;
	const temperature = normalizeOptionalTemperature(options.temperature);

	return async function llmCompactionSummarizer(
		input: CompactionSummarizerInput,
	): Promise<CompactionSummarizerOutput> {
		if (input.sources.length === 0 || input.target_tokens <= 0) {
			return {
				summary_text: '',
				summarizer: summarizerLabel,
			};
		}

		const modelRequest = buildLlmSummarizerRequest(input, {
			model: options.model,
			temperature,
		});

		try {
			const response = await options.model_gateway.generate(modelRequest);
			const summaryText = response.message.content.trim();

			if (!summaryText) {
				return runFallbackSummarizer(
					fallbackSummarizer,
					input,
					new Error('LLM compaction summarizer returned an empty summary.'),
				);
			}

			if (response.finish_reason === 'error') {
				return runFallbackSummarizer(
					fallbackSummarizer,
					input,
					new Error('LLM compaction summarizer returned finish_reason=error.'),
				);
			}

			return {
				summary_text: summaryText,
				summarizer: `${summarizerLabel}:${response.provider}/${response.model}`,
			};
		} catch (error: unknown) {
			return runFallbackSummarizer(fallbackSummarizer, input, error);
		}
	};
}

function buildSummaryLayer(
	summaryText: string,
	sources: readonly CompactableLayerSource[],
	layerName: string,
	layerKind: string,
	targetTokenRange: CompactionTokenRange,
): CompiledContextLayer {
	return {
		content: {
			layer_type: 'microcompact_summary',
			source_layers: sources.map((source) => ({
				kind: source.layer.kind,
				name: source.layer.name,
			})),
			summary: summaryText,
			target_token_range: targetTokenRange,
		},
		kind: layerKind,
		name: layerName,
	};
}

function truncateSummaryTextToCharBudget(summaryText: string, maxCharCount: number): string {
	if (maxCharCount <= 0) {
		return '';
	}

	if (summaryText.length <= maxCharCount) {
		return summaryText;
	}

	if (maxCharCount <= 3) {
		return summaryText.slice(0, maxCharCount);
	}

	return `${summaryText.slice(0, maxCharCount - 3)}...`;
}

function buildProvenance(
	classifiedLayers: readonly ClassifiedLayer[],
	compactableLayerNames: ReadonlySet<string>,
): readonly CompactionSourceProvenance[] {
	return classifiedLayers.map((classifiedLayer) => ({
		action: compactableLayerNames.has(classifiedLayer.layer.name) ? 'summarized' : 'preserved',
		artifact_ref_ids: classifiedLayer.artifact_refs.map((artifactRef) => artifactRef.ref_id),
		estimated_tokens: classifiedLayer.estimated_usage.token_count,
		kind: classifiedLayer.layer.kind,
		name: classifiedLayer.layer.name,
	}));
}

function buildNoopResult(input: {
	readonly artifactRefs: readonly ContextCompactionArtifactRef[];
	readonly compiledContext?: CompiledContextArtifact;
	readonly metadata?: Readonly<Record<string, unknown>>;
	readonly strategy: CompactionStrategyMetadata;
	readonly targetTokenRange: CompactionTokenRange;
}): CompactionResult {
	const usage = collectUsage(input.compiledContext);

	return {
		budget: {
			input_tokens: usage.token_count,
			output_tokens: usage.token_count,
			target_token_range: input.targetTokenRange,
			target_tokens: input.targetTokenRange.max,
			within_target_range: usage.token_count <= input.targetTokenRange.max,
		},
		compacted_context: input.compiledContext,
		metadata: input.metadata,
		preserved_artifact_refs: input.artifactRefs,
		provenance: [],
		status: 'noop',
		strategy: input.strategy,
	};
}

export async function compactContext(
	input: CompactionInput,
	strategy: ContextCompactionStrategy,
): Promise<CompactionResult> {
	return strategy.compact(input);
}

export function createMicrocompactStrategy(
	options: CreateMicrocompactStrategyOptions = {},
): ContextCompactionStrategy {
	const summarizer = options.summarizer ?? defaultMicrocompactSummarizer;
	const summaryLayerKind = options.summary_layer_kind ?? DEFAULT_SUMMARY_LAYER_KIND;
	const summaryLayerName = options.summary_layer_name ?? DEFAULT_SUMMARY_LAYER_NAME;

	if (!summaryLayerKind.trim()) {
		throw new ContextCompactionConfigurationError('summary_layer_kind must be a non-empty string.');
	}

	if (!summaryLayerName.trim()) {
		throw new ContextCompactionConfigurationError('summary_layer_name must be a non-empty string.');
	}

	return {
		async compact(input: CompactionInput): Promise<CompactionResult> {
			const artifactRefs = input.artifact_refs ?? [];
			const targetTokenRange = resolveTargetTokenRange(input.target_token_range);
			const strategyMetadata: CompactionStrategyMetadata = {
				name: microcompactStrategyName,
				summarizer: DEFAULT_SUMMARIZER_LABEL,
				version: 1,
			};

			if (!input.compiled_context || input.compiled_context.layers.length === 0) {
				return buildNoopResult({
					artifactRefs,
					compiledContext: input.compiled_context,
					metadata: input.metadata,
					strategy: strategyMetadata,
					targetTokenRange,
				});
			}

			const compiledContext = input.compiled_context;

			const classifiedLayers = classifyLayers(
				compiledContext.layers,
				artifactRefs,
				input.preserve_layer_names ?? [],
				input.preserve_layer_kinds ?? [],
			);
			const totalInputTokens = classifiedLayers.reduce(
				(total, classifiedLayer) => total + classifiedLayer.estimated_usage.token_count,
				0,
			);

			if (totalInputTokens <= targetTokenRange.max) {
				return {
					...buildNoopResult({
						artifactRefs,
						compiledContext: input.compiled_context,
						metadata: input.metadata,
						strategy: strategyMetadata,
						targetTokenRange,
					}),
					provenance: buildProvenance(classifiedLayers, new Set<string>()),
				};
			}

			const preservedLayers = classifiedLayers.filter(
				(classifiedLayer) => classifiedLayer.preserve_reason !== undefined,
			);
			const compactableLayers = classifiedLayers.filter(
				(classifiedLayer) => classifiedLayer.preserve_reason === undefined,
			);

			if (compactableLayers.length === 0) {
				return {
					...buildNoopResult({
						artifactRefs,
						compiledContext: input.compiled_context,
						metadata: input.metadata,
						strategy: strategyMetadata,
						targetTokenRange,
					}),
					provenance: buildProvenance(classifiedLayers, new Set<string>()),
				};
			}

			const preservedTokenCount = preservedLayers.reduce(
				(total, classifiedLayer) => total + classifiedLayer.estimated_usage.token_count,
				0,
			);
			const targetSummaryTokens = Math.max(0, targetTokenRange.max - preservedTokenCount);
			const compactableSources: readonly CompactableLayerSource[] = compactableLayers.map(
				(classifiedLayer) => ({
					artifact_refs: classifiedLayer.artifact_refs,
					estimated_usage: classifiedLayer.estimated_usage,
					formatted_text: classifiedLayer.formatted_text,
					layer: classifiedLayer.layer,
				}),
			);

			let summarizerOutput: CompactionSummarizerOutput;

			try {
				summarizerOutput = await summarizer({
					sources: compactableSources,
					target_tokens: targetSummaryTokens,
					target_token_range: targetTokenRange,
				});
			} catch (error: unknown) {
				if (
					error instanceof ContextCompactionConfigurationError ||
					error instanceof ContextCompactionValidationError ||
					error instanceof ContextCompactionExecutionError
				) {
					throw error;
				}

				throw new ContextCompactionExecutionError(
					'Microcompact summarizer failed to produce a summary.',
					error,
				);
			}

			const compactableLayerNames = new Set(compactableLayers.map((layer) => layer.layer.name));
			const compactableTokenCount = compactableLayers.reduce(
				(total, classifiedLayer) => total + classifiedLayer.estimated_usage.token_count,
				0,
			);
			let normalizedSummaryText = summarizerOutput.summary_text.trim();
			let summaryLayer =
				normalizedSummaryText.length > 0
					? buildSummaryLayer(
							normalizedSummaryText,
							compactableSources,
							summaryLayerName,
							summaryLayerKind,
							targetTokenRange,
						)
					: undefined;
			let compactedContext: CompiledContextArtifact | undefined;
			let outputUsage: TextUsageEstimate = {
				char_count: 0,
				token_count: 0,
			};

			const buildCompactedContext = (
				currentSummaryLayer?: CompiledContextLayer,
			): CompiledContextArtifact => {
				const summaryInsertedLayers: CompiledContextLayer[] = [];
				let summaryInserted = false;

				for (const layer of compiledContext.layers) {
					if (!compactableLayerNames.has(layer.name)) {
						summaryInsertedLayers.push(layer);
						continue;
					}

					if (!summaryInserted) {
						if (currentSummaryLayer) {
							summaryInsertedLayers.push(currentSummaryLayer);
						}

						summaryInserted = true;
					}
				}

				return {
					layers: summaryInsertedLayers,
				};
			};

			if (summaryLayer) {
				compactedContext = buildCompactedContext(summaryLayer);
				outputUsage = collectUsage(compactedContext);

				while (outputUsage.token_count > targetTokenRange.max && normalizedSummaryText.length > 0) {
					const excessTokens = outputUsage.token_count - targetTokenRange.max;
					const nextCharBudget = Math.max(0, normalizedSummaryText.length - excessTokens * 4 - 8);
					const truncatedSummaryText = truncateSummaryTextToCharBudget(
						normalizedSummaryText,
						nextCharBudget,
					);

					if (truncatedSummaryText === normalizedSummaryText) {
						break;
					}

					normalizedSummaryText = truncatedSummaryText.trim();
					summaryLayer =
						normalizedSummaryText.length > 0
							? buildSummaryLayer(
									normalizedSummaryText,
									compactableSources,
									summaryLayerName,
									summaryLayerKind,
									targetTokenRange,
								)
							: undefined;
					compactedContext = buildCompactedContext(summaryLayer);
					outputUsage = collectUsage(compactedContext);
				}
			}

			if (!compactedContext || outputUsage.token_count > targetTokenRange.max) {
				summaryLayer = undefined;
				normalizedSummaryText = '';
				compactedContext = buildCompactedContext(undefined);
				outputUsage = collectUsage(compactedContext);
			}

			const summaryUsage = summaryLayer
				? estimateTextUsage(formatCompiledContextLayer(summaryLayer))
				: {
						char_count: 0,
						token_count: 0,
					};

			return {
				budget: {
					input_tokens: totalInputTokens,
					output_tokens: outputUsage.token_count,
					target_token_range: targetTokenRange,
					target_tokens: targetSummaryTokens,
					within_target_range:
						outputUsage.token_count >= targetTokenRange.min &&
						outputUsage.token_count <= targetTokenRange.max,
				},
				compacted_context: compactedContext,
				metadata: input.metadata,
				preserved_artifact_refs: artifactRefs,
				provenance: buildProvenance(classifiedLayers, compactableLayerNames),
				status: 'compacted',
				strategy: {
					...strategyMetadata,
					summarizer: summarizerOutput.summarizer,
				},
				summary: summaryLayer
					? {
							estimated_usage: summaryUsage,
							source_layer_count: compactableLayers.length,
							source_token_count: compactableTokenCount,
							text: normalizedSummaryText,
						}
					: undefined,
			};
		},
	};
}
