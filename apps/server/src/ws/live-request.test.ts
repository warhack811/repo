import { describe, expect, it } from 'vitest';

import type { RunRequestPayload } from './messages.js';

import {
	INLINE_MAX_CHARS,
	TOOL_RESULT_TRUNCATED_NOTICE,
} from '../context/runtime-context-limits.js';
import { buildLiveModelRequest, buildToolResultContinuationUserTurn } from './live-request.js';

function createRunRequestPayload(): RunRequestPayload {
	return {
		include_presentation_blocks: true,
		provider: 'groq',
		provider_config: {
			apiKey: 'groq-key',
		},
		request: {
			messages: [
				{
					content:
						'You must use the file.read tool to read D:\\ai\\Runa\\README.md before answering. After reading it, answer with exactly Runa.',
					role: 'user',
				},
			],
			model: 'llama-3.3-70b-versatile',
		},
		run_id: 'run_live_request_test',
		trace_id: 'trace_live_request_test',
	};
}

describe('buildLiveModelRequest', () => {
	it('rewrites tool-result follow-up turns so the model continues from the ingested result', async () => {
		const request = await buildLiveModelRequest(createRunRequestPayload(), 'D:/ai/Runa', {
			current_state: 'TOOL_RESULT_INGESTING',
			latest_tool_result: {
				call_id: 'call_live_request_follow_up',
				output: {
					content: '# Runa\n\nREADME body',
					path: 'D:/ai/Runa/README.md',
				},
				status: 'success',
				tool_name: 'file.read',
			},
		});

		expect(request.messages).toEqual([
			{
				content: expect.stringContaining(
					'Continue the same user request using the latest ingested tool result from the runtime context.',
				),
				role: 'user',
			},
		]);
		expect(request.messages[0]?.content).toContain(
			'Original user request: You must use the file.read tool to read D:\\ai\\Runa\\README.md before answering. After reading it, answer with exactly Runa.',
		);
		expect(request.messages[0]?.content).toContain(
			'Do not repeat that same completed tool call just to satisfy the original instruction.',
		);
		expect(request.compiled_context?.layers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'run_layer',
				}),
			]),
		);
	});

	it('does not truncate a small tool result under the inline-full threshold', async () => {
		const content = `<html>${'x'.repeat(1500)}</html>`;
		const request = await buildLiveModelRequest(createRunRequestPayload(), 'D:/ai/Runa', {
			current_state: 'TOOL_RESULT_INGESTING',
			latest_tool_result: {
				call_id: 'call_small_file_read',
				output: {
					content,
					path: 'D:/ai/Runa/small.html',
					size_bytes: content.length,
				},
				status: 'success',
				tool_name: 'file.read',
			},
		});

		expect(request.messages[0]?.content).toContain(content);
		expect(request.messages[0]?.content).not.toContain(TOOL_RESULT_TRUNCATED_NOTICE);
	});

	it('truncates a very large tool result to the inline max preview', async () => {
		const content = 'x'.repeat(50_000);
		const request = await buildLiveModelRequest(createRunRequestPayload(), 'D:/ai/Runa', {
			current_state: 'TOOL_RESULT_INGESTING',
			latest_tool_result: {
				call_id: 'call_large_file_read',
				output: {
					content,
					path: 'D:/ai/Runa/large.html',
					size_bytes: content.length,
				},
				status: 'success',
				tool_name: 'file.read',
			},
		});
		const message = request.messages[0]?.content ?? '';

		expect(message).toContain(TOOL_RESULT_TRUNCATED_NOTICE);
		expect(message).not.toContain('x'.repeat(20_000));
		expect(message.length).toBeLessThan(INLINE_MAX_CHARS + 1000);
	});

	it('buildToolResultContinuationUserTurn injects recovery preamble when args_hash matches a recent call', () => {
		const message = buildToolResultContinuationUserTurn(
			'Read the file.',
			{
				call_id: 'call_second_read',
				output: {
					content: 'body',
					path: 'README.md',
				},
				status: 'success',
				tool_name: 'file.read',
			},
			[
				{ args_hash: 'same_hash', tool_name: 'file.read' },
				{ args_hash: 'same_hash', tool_name: 'file.read' },
			],
		);

		expect(message).toContain(
			'ATTENTION: You already called this exact tool with these arguments earlier in this run.',
		);
		expect(message).toContain('DO NOT call this tool again with the same arguments.');
	});

	it('buildToolResultContinuationUserTurn does not inject recovery preamble when no recent match exists', () => {
		const message = buildToolResultContinuationUserTurn(
			'Read the file.',
			{
				call_id: 'call_first_read',
				output: {
					content: 'body',
					path: 'README.md',
				},
				status: 'success',
				tool_name: 'file.read',
			},
			[{ args_hash: 'same_hash', tool_name: 'file.read' }],
		);

		expect(message).not.toContain('ATTENTION: You already called this exact tool');
	});

	it('keeps the original user turn for initial non-continuation live requests', async () => {
		const request = await buildLiveModelRequest(createRunRequestPayload(), 'D:/ai/Runa');

		expect(request.messages).toEqual([
			{
				content:
					'You must use the file.read tool to read D:\\ai\\Runa\\README.md before answering. After reading it, answer with exactly Runa.',
				role: 'user',
			},
		]);
	});

	it('preserves explicit available_tools from the live request payload', async () => {
		const request = await buildLiveModelRequest(
			{
				...createRunRequestPayload(),
				request: {
					...createRunRequestPayload().request,
					available_tools: [
						{
							description: 'Read a file.',
							name: 'file.read',
							parameters: {
								path: {
									required: true,
									type: 'string',
								},
							},
						},
					],
				},
			},
			'D:/ai/Runa',
		);

		expect(request.available_tools).toEqual([
			{
				description: 'Read a file.',
				name: 'file.read',
				parameters: {
					path: {
						required: true,
						type: 'string',
					},
				},
			},
		]);
	});

	it('preserves additive attachments while composing the live model request', async () => {
		const request = await buildLiveModelRequest(
			{
				...createRunRequestPayload(),
				attachments: [
					{
						blob_id: 'blob_text_1',
						filename: 'notes.txt',
						kind: 'text',
						media_type: 'text/plain',
						size_bytes: 12,
						text_content: 'Merhaba Runa',
					},
					{
						blob_id: 'blob_doc_1',
						filename: 'brief.pdf',
						kind: 'document',
						media_type: 'application/pdf',
						size_bytes: 4096,
						storage_ref: 'blob_doc_1',
					},
				],
			},
			'D:/ai/Runa',
		);

		expect(request.attachments).toEqual([
			{
				blob_id: 'blob_text_1',
				filename: 'notes.txt',
				kind: 'text',
				media_type: 'text/plain',
				size_bytes: 12,
				text_content: 'Merhaba Runa',
			},
			{
				blob_id: 'blob_doc_1',
				filename: 'brief.pdf',
				kind: 'document',
				media_type: 'application/pdf',
				size_bytes: 4096,
				storage_ref: 'blob_doc_1',
			},
		]);
	});

	it('injects semantically relevant memory instead of only the newest unrelated note', async () => {
		const request = await buildLiveModelRequest(
			{
				...createRunRequestPayload(),
				request: {
					...createRunRequestPayload().request,
					messages: [
						{
							content: 'What is the project theme color?',
							role: 'user',
						},
					],
				},
			},
			'D:/ai/Runa',
			{
				memoryStore: {
					async createMemory() {
						throw new Error('not used');
					},
					async listActiveMemories(scope, scope_id) {
						if (scope !== 'workspace' || scope_id !== 'D:/ai/Runa') {
							return [];
						}

						return [
							{
								content: 'The websocket transport supports approval flow.',
								created_at: '2026-04-11T12:20:00.000Z',
								memory_id: 'memory_live_request_newer',
								scope: 'workspace',
								scope_id: 'D:/ai/Runa',
								source_kind: 'tool_result',
								source_run_id: 'run_live_request_newer',
								source_trace_id: 'trace_live_request_newer',
								status: 'active',
								summary: 'Transport note',
								updated_at: '2026-04-11T12:30:00.000Z',
							},
							{
								content: 'The project theme is blue.',
								created_at: '2026-04-11T12:00:00.000Z',
								memory_id: 'memory_live_request_theme',
								scope: 'workspace',
								scope_id: 'D:/ai/Runa',
								source_kind: 'tool_result',
								source_run_id: 'run_live_request_theme',
								source_trace_id: 'trace_live_request_theme',
								status: 'active',
								summary: 'Project theme is blue',
								updated_at: '2026-04-11T12:10:00.000Z',
							},
						];
					},
					async supersedeMemory() {
						return null;
					},
				},
			},
		);

		const compiledContext = request.compiled_context;
		expect(compiledContext).toBeDefined();

		if (!compiledContext) {
			throw new Error('Expected compiled_context to be present.');
		}

		const memoryLayer = compiledContext.layers.find((layer) => layer.name === 'memory_layer');
		expect(memoryLayer).toBeDefined();

		if (!memoryLayer || memoryLayer.kind !== 'memory') {
			throw new Error('Expected memory layer in compiled_context.');
		}

		expect(memoryLayer).toMatchObject({
			content: {
				items: [
					expect.objectContaining({
						content: 'The project theme is blue.',
						summary: 'Project theme is blue',
					}),
				],
			},
		});
	});
});
