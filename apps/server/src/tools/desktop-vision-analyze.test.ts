import type {
	ModelGateway,
	ModelRequest,
	ModelResponse,
	ModelStreamChunk,
	ToolResult,
} from '@runa/types';
import { describe, expect, it, vi } from 'vitest';

import {
	createDesktopVisionAnalyzeTool,
	desktopVisionAnalyzeTool,
} from './desktop-vision-analyze.js';
import { ToolRegistry, createBuiltInToolRegistry } from './registry.js';

const PNG_BYTES = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 118, 105, 115, 105, 111, 110]);

class StubModelGateway implements ModelGateway {
	readonly generateMock;

	constructor(responseContent: string) {
		this.generateMock = vi.fn(
			async (request: ModelRequest): Promise<ModelResponse> => ({
				finish_reason: 'stop',
				message: {
					content: responseContent,
					role: 'assistant',
				},
				model: request.model ?? 'stub-vision-model',
				provider: 'stub',
			}),
		);
	}

	generate(request: ModelRequest): Promise<ModelResponse> {
		return this.generateMock(request);
	}

	stream(): AsyncIterable<ModelStreamChunk> {
		return {
			[Symbol.asyncIterator](): AsyncIterator<ModelStreamChunk> {
				return {
					next: async () =>
						({
							done: true,
							value: undefined,
						}) as IteratorResult<ModelStreamChunk>,
				};
			},
		};
	}
}

function createInput(argumentsValue: Record<string, unknown> = {}) {
	return {
		arguments: argumentsValue,
		call_id: 'call_desktop_vision_analyze',
		tool_name: 'desktop.vision_analyze' as const,
	};
}

function createContext() {
	return {
		run_id: 'run_desktop_vision_analyze',
		trace_id: 'trace_desktop_vision_analyze',
		working_directory: process.cwd(),
	};
}

function createScreenshotResult(callId = 'call_before'): ToolResult<'desktop.screenshot'> {
	return {
		call_id: callId,
		output: {
			base64_data: PNG_BYTES.toString('base64'),
			byte_length: PNG_BYTES.byteLength,
			format: 'png',
			mime_type: 'image/png',
		},
		status: 'success',
		tool_name: 'desktop.screenshot',
	};
}

describe('desktopVisionAnalyzeTool', () => {
	it('uses a prior screenshot result as a ModelImageAttachment through ModelGateway.generate()', async () => {
		const gateway = new StubModelGateway(
			JSON.stringify({
				confidence: 0.72,
				element_description: 'Submit button near the lower-right of the form.',
				reasoning_summary: 'The requested control is visible and centered at the proposed point.',
				requires_user_confirmation: false,
				visibility: 'visible',
				x: 420,
				y: 280,
			}),
		);
		const tool = createDesktopVisionAnalyzeTool({
			model_gateway: gateway,
			resolve_tool_result: () => createScreenshotResult('call_before'),
		});

		const result = await tool.execute(
			createInput({
				screenshot_call_id: 'call_before',
				task: 'Click the password form submit button',
			}),
			createContext(),
		);

		expect(result).toMatchObject({
			output: {
				confidence: 0.72,
				element_description: 'Submit button near the lower-right of the form.',
				reasoning_summary: 'The requested control is visible and centered at the proposed point.',
				requires_user_confirmation: true,
				visibility: 'visible',
				x: 420,
				y: 280,
			},
			status: 'success',
			tool_name: 'desktop.vision_analyze',
		});
		expect(gateway.generateMock).toHaveBeenCalledTimes(1);

		const request = gateway.generateMock.mock.calls[0]?.[0];

		expect(request?.run_id).toBe('run_desktop_vision_analyze');
		expect(request?.trace_id).toBe('trace_desktop_vision_analyze');
		expect(request?.attachments).toEqual([
			{
				blob_id: 'call_before',
				data_url: `data:image/png;base64,${PNG_BYTES.toString('base64')}`,
				filename: 'call_before.png',
				kind: 'image',
				media_type: 'image/png',
				size_bytes: PNG_BYTES.byteLength,
			},
		]);
	});

	it('returns a typed vision_model_unavailable error when no vision gateway is injected', async () => {
		const tool = createDesktopVisionAnalyzeTool({
			resolve_tool_result: () => createScreenshotResult('call_before'),
		});

		await expect(
			tool.execute(
				createInput({
					screenshot_call_id: 'call_before',
					task: 'Find the Settings button',
				}),
				createContext(),
			),
		).resolves.toMatchObject({
			details: {
				reason: 'vision_model_unavailable',
			},
			error_code: 'EXECUTION_FAILED',
			status: 'error',
			tool_name: 'desktop.vision_analyze',
		});
	});

	it('reports a blocker when screenshot call id artifact retrieval is unavailable', async () => {
		const gateway = new StubModelGateway('{}');
		const tool = createDesktopVisionAnalyzeTool({
			model_gateway: gateway,
		});

		await expect(
			tool.execute(
				createInput({
					screenshot_call_id: 'call_missing',
					task: 'Find the Settings button',
				}),
				createContext(),
			),
		).resolves.toMatchObject({
			details: {
				reason: 'screenshot_artifact_resolver_unavailable',
				screenshot_call_id: 'call_missing',
			},
			error_code: 'EXECUTION_FAILED',
			status: 'error',
			tool_name: 'desktop.vision_analyze',
		});
		expect(gateway.generateMock).not.toHaveBeenCalled();
	});

	it('does not fabricate image payloads when a screenshot result is missing or invalid', async () => {
		const gateway = new StubModelGateway('{}');
		const missingTool = createDesktopVisionAnalyzeTool({
			model_gateway: gateway,
			resolve_tool_result: () => undefined,
		});
		const invalidTool = createDesktopVisionAnalyzeTool({
			model_gateway: gateway,
			resolve_tool_result: (): ToolResult<'desktop.screenshot'> => ({
				call_id: 'call_invalid',
				output: {
					base64_data: Buffer.from('not-a-png').toString('base64'),
					byte_length: 9,
					format: 'png',
					mime_type: 'image/png',
				},
				status: 'success',
				tool_name: 'desktop.screenshot',
			}),
		});

		await expect(
			missingTool.execute(
				createInput({
					screenshot_call_id: 'call_missing',
					task: 'Find the Settings button',
				}),
				createContext(),
			),
		).resolves.toMatchObject({
			details: {
				reason: 'screenshot_tool_result_not_found',
			},
			status: 'error',
		});
		await expect(
			invalidTool.execute(
				createInput({
					screenshot_call_id: 'call_invalid',
					task: 'Find the Settings button',
				}),
				createContext(),
			),
		).resolves.toMatchObject({
			details: {
				reason: 'screenshot_artifact_invalid',
			},
			status: 'error',
		});
		expect(gateway.generateMock).not.toHaveBeenCalled();
	});

	it('wraps invalid model JSON into a typed error', async () => {
		const tool = createDesktopVisionAnalyzeTool({
			model_gateway: new StubModelGateway('not json'),
			resolve_tool_result: () => createScreenshotResult('call_before'),
		});

		await expect(
			tool.execute(
				createInput({
					screenshot_call_id: 'call_before',
					task: 'Find the Settings button',
				}),
				createContext(),
			),
		).resolves.toMatchObject({
			details: {
				reason: 'vision_model_invalid_response',
			},
			status: 'error',
			tool_name: 'desktop.vision_analyze',
		});
	});

	it('is registered with the built-in registry and documents HITL risk classes', () => {
		const registry = new ToolRegistry();

		registry.register(desktopVisionAnalyzeTool);

		expect(registry.has('desktop.vision_analyze')).toBe(true);
		expect(createBuiltInToolRegistry().has('desktop.vision_analyze')).toBe(true);
		expect(desktopVisionAnalyzeTool.metadata.tags).toEqual(
			expect.arrayContaining([
				'hitl-risk:credential',
				'hitl-risk:login',
				'hitl-risk:submit',
				'hitl-risk:delete',
				'hitl-risk:purchase',
			]),
		);
	});
});
