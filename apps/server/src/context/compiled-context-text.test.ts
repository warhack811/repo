import { describe, expect, it } from 'vitest';

import { adaptContextToModelRequest } from './adapt-context-to-model-request.js';
import {
	estimateTokenCountFromCharCount,
	formatCompiledContextArtifact,
	measureCompiledContextUsage,
} from './compiled-context-text.js';
import { composeContext } from './compose-context.js';

describe('compiled-context-text', () => {
	it('measures compiled context layers deterministically and omits missing layers', () => {
		const composedContext = composeContext({
			current_state: 'MODEL_THINKING',
			run_id: 'run_context_usage',
			trace_id: 'trace_context_usage',
			working_directory: 'D:/ai/Runa',
		});
		const request = adaptContextToModelRequest({
			composed_context: composedContext,
			run_id: 'run_context_usage',
			trace_id: 'trace_context_usage',
			user_turn: 'Summarize the context.',
		});
		const usage = measureCompiledContextUsage(request.compiled_context);

		expect(usage?.layers.map((layer) => layer.name)).toEqual(['core_rules', 'run_layer']);
		expect(
			usage?.layers.every(
				(layer) => layer.token_count === estimateTokenCountFromCharCount(layer.char_count),
			),
		).toBe(true);
		expect(usage?.total).toEqual({
			char_count: (usage?.layers[0]?.char_count ?? 0) + (usage?.layers[1]?.char_count ?? 0),
			token_count: (usage?.layers[0]?.token_count ?? 0) + (usage?.layers[1]?.token_count ?? 0),
		});
	});

	it('keeps formatted compiled context text and usage stable for the same artifact', () => {
		const composedContext = composeContext({
			current_state: 'TOOL_RESULT_INGESTING',
			latest_tool_result: {
				call_id: 'call_context_usage_repeat',
				output: {
					path: 'README.md',
				},
				result_status: 'success',
				tool_name: 'file.read',
			},
			run_id: 'run_context_usage_repeat',
			trace_id: 'trace_context_usage_repeat',
			working_directory: 'D:/ai/Runa',
		});
		const request = adaptContextToModelRequest({
			composed_context: composedContext,
			run_id: 'run_context_usage_repeat',
			trace_id: 'trace_context_usage_repeat',
			user_turn: 'Use the tool context again.',
		});

		const firstFormatted = formatCompiledContextArtifact(request.compiled_context);
		const secondFormatted = formatCompiledContextArtifact(request.compiled_context);
		const firstUsage = measureCompiledContextUsage(request.compiled_context);
		const secondUsage = measureCompiledContextUsage(request.compiled_context);

		expect(firstFormatted).toBe(secondFormatted);
		expect(firstFormatted).toContain('[core_rules:instruction]');
		expect(firstFormatted).toContain('[run_layer:runtime]');
		expect(firstUsage).toEqual(secondUsage);
	});
});
