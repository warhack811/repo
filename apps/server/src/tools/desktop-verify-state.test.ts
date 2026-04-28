import type {
	ModelGateway,
	ModelRequest,
	ModelResponse,
	ModelStreamChunk,
	ToolResult,
} from '@runa/types';
import { describe, expect, it, vi } from 'vitest';

import { createDesktopVerifyStateTool, desktopVerifyStateTool } from './desktop-verify-state.js';
import { ToolRegistry, createBuiltInToolRegistry } from './registry.js';

const BEFORE_PNG_BYTES = Buffer.from([
	137, 80, 78, 71, 13, 10, 26, 10, 98, 101, 102, 111, 114, 101,
]);
const AFTER_PNG_BYTES = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 97, 102, 116, 101, 114]);

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
		call_id: 'call_desktop_verify_state',
		tool_name: 'desktop.verify_state' as const,
	};
}

function createContext() {
	return {
		run_id: 'run_desktop_verify_state',
		trace_id: 'trace_desktop_verify_state',
		working_directory: process.cwd(),
	};
}

function createScreenshotResult(callId: string, bytes: Buffer): ToolResult<'desktop.screenshot'> {
	return {
		call_id: callId,
		output: {
			base64_data: bytes.toString('base64'),
			byte_length: bytes.byteLength,
			format: 'png',
			mime_type: 'image/png',
		},
		status: 'success',
		tool_name: 'desktop.screenshot',
	};
}

function createResolver(): (callId: string) => ToolResult<'desktop.screenshot'> | undefined {
	const results = new Map<string, ToolResult<'desktop.screenshot'>>([
		['call_before', createScreenshotResult('call_before', BEFORE_PNG_BYTES)],
		['call_after', createScreenshotResult('call_after', AFTER_PNG_BYTES)],
	]);

	return (callId) => results.get(callId);
}

describe('desktopVerifyStateTool', () => {
	it('compares before and after screenshots through ModelGateway.generate()', async () => {
		const gateway = new StubModelGateway(
			JSON.stringify({
				needs_retry: false,
				needs_user_help: false,
				observed_change: 'The settings panel is now open.',
				verified: true,
			}),
		);
		const tool = createDesktopVerifyStateTool({
			model_gateway: gateway,
			resolve_tool_result: createResolver(),
		});

		const result = await tool.execute(
			createInput({
				after_screenshot_call_id: 'call_after',
				before_screenshot_call_id: 'call_before',
				expected_change: 'The settings panel opens',
			}),
			createContext(),
		);

		expect(result).toMatchObject({
			output: {
				needs_retry: false,
				needs_user_help: false,
				observed_change: 'The settings panel is now open.',
				verified: true,
			},
			status: 'success',
			tool_name: 'desktop.verify_state',
		});
		expect(gateway.generateMock).toHaveBeenCalledTimes(1);

		const request = gateway.generateMock.mock.calls[0]?.[0];

		expect(request?.run_id).toBe('run_desktop_verify_state');
		expect(request?.trace_id).toBe('trace_desktop_verify_state');
		expect(request?.attachments).toEqual([
			{
				blob_id: 'call_before',
				data_url: `data:image/png;base64,${BEFORE_PNG_BYTES.toString('base64')}`,
				filename: 'call_before.png',
				kind: 'image',
				media_type: 'image/png',
				size_bytes: BEFORE_PNG_BYTES.byteLength,
			},
			{
				blob_id: 'call_after',
				data_url: `data:image/png;base64,${AFTER_PNG_BYTES.toString('base64')}`,
				filename: 'call_after.png',
				kind: 'image',
				media_type: 'image/png',
				size_bytes: AFTER_PNG_BYTES.byteLength,
			},
		]);
	});

	it('returns an honest failed verification result without claiming success', async () => {
		const tool = createDesktopVerifyStateTool({
			model_gateway: new StubModelGateway(
				JSON.stringify({
					needs_retry: true,
					needs_user_help: false,
					observed_change: 'The original screen is still visible; no settings panel appeared.',
					verified: false,
				}),
			),
			resolve_tool_result: createResolver(),
		});

		await expect(
			tool.execute(
				createInput({
					after_screenshot_call_id: 'call_after',
					before_screenshot_call_id: 'call_before',
					expected_change: 'The settings panel opens',
				}),
				createContext(),
			),
		).resolves.toMatchObject({
			output: {
				needs_retry: true,
				needs_user_help: false,
				observed_change: 'The original screen is still visible; no settings panel appeared.',
				verified: false,
			},
			status: 'success',
		});
	});

	it('returns a typed vision_model_unavailable error when no vision gateway is injected', async () => {
		const tool = createDesktopVerifyStateTool({
			resolve_tool_result: createResolver(),
		});

		await expect(
			tool.execute(
				createInput({
					after_screenshot_call_id: 'call_after',
					before_screenshot_call_id: 'call_before',
					expected_change: 'The settings panel opens',
				}),
				createContext(),
			),
		).resolves.toMatchObject({
			details: {
				reason: 'vision_model_unavailable',
			},
			error_code: 'EXECUTION_FAILED',
			status: 'error',
			tool_name: 'desktop.verify_state',
		});
	});

	it('reports screenshot retrieval blockers instead of inventing image data', async () => {
		const gateway = new StubModelGateway('{}');
		const tool = createDesktopVerifyStateTool({
			model_gateway: gateway,
			resolve_tool_result: () => undefined,
		});

		await expect(
			tool.execute(
				createInput({
					after_screenshot_call_id: 'call_after',
					before_screenshot_call_id: 'call_before',
					expected_change: 'The settings panel opens',
				}),
				createContext(),
			),
		).resolves.toMatchObject({
			details: {
				reason: 'screenshot_tool_result_not_found',
			},
			status: 'error',
			tool_name: 'desktop.verify_state',
		});
		expect(gateway.generateMock).not.toHaveBeenCalled();
	});

	it('is registered with the built-in registry', () => {
		const registry = new ToolRegistry();

		registry.register(desktopVerifyStateTool);

		expect(registry.has('desktop.verify_state')).toBe(true);
		expect(createBuiltInToolRegistry().has('desktop.verify_state')).toBe(true);
	});
});
