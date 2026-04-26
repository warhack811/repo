import { deflateSync } from 'node:zlib';

import { OpenAiGateway } from '../dist/gateway/openai-gateway.js';
import { createDesktopVerifyStateTool } from '../dist/tools/desktop-verify-state.js';
import { createDesktopVisionAnalyzeTool } from '../dist/tools/desktop-vision-analyze.js';

const DEFAULT_BASE_URL = 'http://localhost:1234/v1';
const WIDTH = 320;
const HEIGHT = 200;

function crc32(buffer) {
	let crc = ~0;

	for (const byte of buffer) {
		crc ^= byte;

		for (let bit = 0; bit < 8; bit += 1) {
			crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
		}
	}

	return ~crc >>> 0;
}

function pngChunk(type, data) {
	const typeBuffer = Buffer.from(type, 'ascii');
	const lengthBuffer = Buffer.alloc(4);
	const crcBuffer = Buffer.alloc(4);

	lengthBuffer.writeUInt32BE(data.length);
	crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));

	return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function drawRect(pixels, rect, color) {
	for (let y = rect.y; y < rect.y + rect.height; y += 1) {
		for (let x = rect.x; x < rect.x + rect.width; x += 1) {
			const offset = (y * WIDTH + x) * 3;
			pixels[offset] = color[0];
			pixels[offset + 1] = color[1];
			pixels[offset + 2] = color[2];
		}
	}
}

function drawCircle(pixels, centerX, centerY, radius, color) {
	for (let y = centerY - radius; y <= centerY + radius; y += 1) {
		for (let x = centerX - radius; x <= centerX + radius; x += 1) {
			const dx = x - centerX;
			const dy = y - centerY;

			if (dx * dx + dy * dy > radius * radius || x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) {
				continue;
			}

			const offset = (y * WIDTH + x) * 3;
			pixels[offset] = color[0];
			pixels[offset + 1] = color[1];
			pixels[offset + 2] = color[2];
		}
	}
}

function drawLine(pixels, startX, startY, endX, endY, thickness, color) {
	const steps = Math.max(Math.abs(endX - startX), Math.abs(endY - startY));

	for (let step = 0; step <= steps; step += 1) {
		const ratio = steps === 0 ? 0 : step / steps;
		const x = Math.round(startX + (endX - startX) * ratio);
		const y = Math.round(startY + (endY - startY) * ratio);

		drawCircle(pixels, x, y, thickness, color);
	}
}

function createPngBase64(kind) {
	const pixels = Buffer.alloc(WIDTH * HEIGHT * 3, 255);

	drawRect(pixels, { height: 34, width: WIDTH, x: 0, y: 0 }, [232, 236, 241]);
	drawRect(pixels, { height: 18, width: 180, x: 70, y: 48 }, [237, 240, 244]);

	if (kind === 'before') {
		drawRect(pixels, { height: 44, width: 120, x: 100, y: 108 }, [220, 38, 38]);
		drawRect(pixels, { height: 8, width: 72, x: 124, y: 126 }, [255, 255, 255]);
	} else {
		drawRect(pixels, { height: 110, width: 250, x: 35, y: 54 }, [220, 252, 231]);
		drawRect(pixels, { height: 22, width: 250, x: 35, y: 54 }, [34, 197, 94]);
		drawCircle(pixels, 82, 110, 20, [34, 197, 94]);
		drawLine(pixels, 72, 110, 80, 118, 2, [255, 255, 255]);
		drawLine(pixels, 80, 118, 95, 100, 2, [255, 255, 255]);
		drawRect(pixels, { height: 10, width: 110, x: 118, y: 92 }, [22, 101, 52]);
		drawRect(pixels, { height: 8, width: 130, x: 118, y: 112 }, [74, 222, 128]);
		drawRect(pixels, { height: 8, width: 96, x: 118, y: 128 }, [134, 239, 172]);
	}

	const rows = [];

	for (let y = 0; y < HEIGHT; y += 1) {
		const row = Buffer.alloc(1 + WIDTH * 3);
		row[0] = 0;
		pixels.copy(row, 1, y * WIDTH * 3, (y + 1) * WIDTH * 3);
		rows.push(row);
	}

	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(WIDTH, 0);
	ihdr.writeUInt32BE(HEIGHT, 4);
	ihdr[8] = 8;
	ihdr[9] = 2;
	ihdr[10] = 0;
	ihdr[11] = 0;
	ihdr[12] = 0;

	return Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		pngChunk('IHDR', ihdr),
		pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
		pngChunk('IEND', Buffer.alloc(0)),
	]).toString('base64');
}

function normalizeBaseUrl(value) {
	const trimmedValue = value.trim();

	return trimmedValue.endsWith('/') ? trimmedValue : `${trimmedValue}/`;
}

function resolveModelsUrl(baseUrl) {
	return new URL('models', normalizeBaseUrl(baseUrl)).toString();
}

async function resolveModelId(baseUrl) {
	if (process.env.LMSTUDIO_MODEL?.trim()) {
		return process.env.LMSTUDIO_MODEL.trim();
	}

	const response = await fetch(resolveModelsUrl(baseUrl));

	if (!response.ok) {
		throw new Error(`LM Studio /v1/models returned HTTP ${response.status}.`);
	}

	const payload = await response.json();
	const modelIds = Array.isArray(payload.data)
		? payload.data
				.map((model) => (typeof model?.id === 'string' ? model.id : undefined))
				.filter(Boolean)
		: [];
	const qwenModel = modelIds.find((modelId) => modelId.toLowerCase().includes('qwen'));

	if (!qwenModel) {
		throw new Error('LM Studio did not report a loaded Qwen model. Set LMSTUDIO_MODEL explicitly.');
	}

	return qwenModel;
}

function createScreenshotResult(callId, base64Data) {
	return {
		call_id: callId,
		output: {
			base64_data: base64Data,
			byte_length: Buffer.from(base64Data, 'base64').byteLength,
			format: 'png',
			mime_type: 'image/png',
		},
		status: 'success',
		tool_name: 'desktop.screenshot',
	};
}

async function main() {
	const baseUrl = process.env.LMSTUDIO_BASE_URL?.trim() || DEFAULT_BASE_URL;
	const model = await resolveModelId(baseUrl);
	const beforeScreenshot = createScreenshotResult(
		'call_lmstudio_before_screenshot',
		createPngBase64('before'),
	);
	const afterScreenshot = createScreenshotResult(
		'call_lmstudio_after_screenshot',
		createPngBase64('after'),
	);
	const toolResults = new Map([
		[beforeScreenshot.call_id, beforeScreenshot],
		[afterScreenshot.call_id, afterScreenshot],
	]);
	const gateway = new OpenAiGateway({
		apiKey: process.env.LMSTUDIO_API_KEY?.trim() || 'lmstudio-local',
		baseUrl,
		defaultModel: model,
	});
	const context = {
		run_id: 'run_lmstudio_vision_smoke',
		trace_id: 'trace_lmstudio_vision_smoke',
		working_directory: process.cwd(),
	};
	const resolve_tool_result = (callId) => toolResults.get(callId);
	const analyzeTool = createDesktopVisionAnalyzeTool({
		model_gateway: gateway,
		resolve_tool_result,
	});
	const verifyTool = createDesktopVerifyStateTool({
		model_gateway: gateway,
		resolve_tool_result,
	});

	const analyzeResult = await analyzeTool.execute(
		{
			arguments: {
				screenshot_call_id: beforeScreenshot.call_id,
				task: 'Click the large red button in the screenshot. /no_think',
			},
			call_id: 'call_lmstudio_vision_analyze',
			tool_name: 'desktop.vision_analyze',
		},
		context,
	);

	if (analyzeResult.status !== 'success') {
		throw new Error(
			`desktop.vision_analyze failed: ${analyzeResult.error_message} ${JSON.stringify(
				analyzeResult.details,
			)}`,
		);
	}

	const verifyResult = await verifyTool.execute(
		{
			arguments: {
				after_screenshot_call_id: afterScreenshot.call_id,
				before_screenshot_call_id: beforeScreenshot.call_id,
				expected_change:
					'the red button is no longer visible and a large green success panel is visible. /no_think',
			},
			call_id: 'call_lmstudio_verify_state',
			tool_name: 'desktop.verify_state',
		},
		context,
	);

	if (verifyResult.status !== 'success') {
		throw new Error(
			`desktop.verify_state failed: ${verifyResult.error_message} ${JSON.stringify(
				verifyResult.details,
			)}`,
		);
	}

	if (verifyResult.output.verified !== true) {
		throw new Error(
			`desktop.verify_state did not verify the expected change: ${JSON.stringify(verifyResult.output)}`,
		);
	}

	console.log(
		JSON.stringify(
			{
				analyze: analyzeResult.output,
				base_url: baseUrl,
				model,
				result: 'PASS',
				verify: verifyResult.output,
			},
			null,
			2,
		),
	);
}

main().catch((error) => {
	console.error(
		JSON.stringify(
			{
				error: error instanceof Error ? error.message : String(error),
				result: 'FAIL',
			},
			null,
			2,
		),
	);
	process.exitCode = 1;
});
