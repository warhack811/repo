import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

function parseDotEnv(text) {
	const entries = {};

	for (const line of text.split(/\r?\n/u)) {
		const trimmed = line.trim();

		if (trimmed.length === 0 || trimmed.startsWith('#')) {
			continue;
		}

		const equalsIndex = trimmed.indexOf('=');

		if (equalsIndex < 0) {
			continue;
		}

		const key = trimmed.slice(0, equalsIndex).trim();
		let value = trimmed.slice(equalsIndex + 1).trim();

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		entries[key] = value;
	}

	return entries;
}

async function readApiKey() {
	if (process.env.DEEPSEEK_API_KEY?.trim()) {
		return {
			key: process.env.DEEPSEEK_API_KEY.trim(),
			source: 'shell',
		};
	}

	for (const filename of ['.env.local', '.env']) {
		try {
			const envText = await readFile(resolve(repoRoot, filename), 'utf8');
			const key = parseDotEnv(envText).DEEPSEEK_API_KEY;

			if (typeof key === 'string' && key.trim().length > 0) {
				return {
					key: key.trim(),
					source: filename,
				};
			}
		} catch (error) {
			if (error?.code !== 'ENOENT') {
				throw error;
			}
		}
	}

	return {
		key: null,
		source: 'missing',
	};
}

function timestamp() {
	return new Date().toISOString();
}

function buildRequest(prompt) {
	return {
		messages: [
			{
				content: "Cagiracagin tool'dan hemen once kullaniciya 1 cumle ile ne yapacagini soyle.",
				role: 'system',
			},
			{
				content: prompt,
				role: 'user',
			},
		],
		model: process.env.DEEPSEEK_SPIKE_MODEL ?? 'deepseek-chat',
		stream: true,
		temperature: 0,
		tool_choice: 'auto',
		tools: [
			{
				function: {
					description: 'Return the current time for a timezone.',
					name: 'get_current_time',
					parameters: {
						additionalProperties: false,
						properties: {
							timezone: {
								description: 'IANA timezone name, for example Europe/Istanbul.',
								type: 'string',
							},
						},
						required: ['timezone'],
						type: 'object',
					},
				},
				type: 'function',
			},
		],
	};
}

function summarizeChunk(chunk) {
	const choice = chunk?.choices?.[0];
	const delta = choice?.delta ?? {};

	return {
		timestamp: timestamp(),
		delta_content: typeof delta.content === 'string' ? delta.content : undefined,
		delta_reasoning_content:
			typeof delta.reasoning_content === 'string' ? delta.reasoning_content : undefined,
		delta_tool_calls: Array.isArray(delta.tool_calls)
			? delta.tool_calls.map((toolCall) => ({
					function_arguments: toolCall?.function?.arguments,
					function_name: toolCall?.function?.name,
					id: toolCall?.id,
					index: toolCall?.index,
					type: toolCall?.type,
				}))
			: undefined,
		finish_reason: choice?.finish_reason,
		raw: chunk,
	};
}

async function* parseSse(response) {
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	try {
		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				break;
			}

			buffer += decoder.decode(value, { stream: true });

			while (true) {
				const separatorIndex = buffer.indexOf('\n\n');

				if (separatorIndex < 0) {
					break;
				}

				const eventBlock = buffer.slice(0, separatorIndex);
				buffer = buffer.slice(separatorIndex + 2);
				const data = eventBlock
					.split(/\r?\n/u)
					.filter((line) => line.startsWith('data:'))
					.map((line) => line.slice(5).trim())
					.join('\n');

				if (data.length > 0) {
					yield data;
				}
			}
		}

		buffer += decoder.decode();
		const trailingData = buffer
			.split(/\r?\n/u)
			.filter((line) => line.startsWith('data:'))
			.map((line) => line.slice(5).trim())
			.join('\n');

		if (trailingData.length > 0) {
			yield trailingData;
		}
	} finally {
		reader.releaseLock();
	}
}

async function runPrompt({ apiKey, lines, prompt, runIndex }) {
	lines.push(
		JSON.stringify({
			api: 'deepseek-chat-completions',
			event: 'prompt.started',
			model: process.env.DEEPSEEK_SPIKE_MODEL ?? 'deepseek-chat',
			prompt,
			run_index: runIndex,
			timestamp: timestamp(),
		}),
	);

	const response = await fetch('https://api.deepseek.com/chat/completions', {
		body: JSON.stringify(buildRequest(prompt)),
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'content-type': 'application/json',
		},
		method: 'POST',
	});

	if (!response.ok) {
		const body = await response.text();
		lines.push(
			JSON.stringify({
				body,
				event: 'prompt.http_error',
				status: response.status,
				timestamp: timestamp(),
			}),
		);
		return;
	}

	for await (const eventData of parseSse(response)) {
		if (eventData === '[DONE]') {
			lines.push(
				JSON.stringify({
					event: 'done',
					timestamp: timestamp(),
				}),
			);
			break;
		}

		try {
			const chunk = JSON.parse(eventData);
			lines.push(JSON.stringify(summarizeChunk(chunk)));
		} catch (error) {
			lines.push(
				JSON.stringify({
					error: error instanceof Error ? error.message : String(error),
					event: 'invalid_json',
					raw: eventData,
					timestamp: timestamp(),
				}),
			);
		}
	}
}

async function main() {
	const apiKeyResult = await readApiKey();
	const logDirectory = resolve(repoRoot, 'docs/spikes');
	const logPath = resolve(
		logDirectory,
		`deepseek-wire-order-${new Date().toISOString().replace(/[:.]/gu, '-')}.log`,
	);
	const lines = [
		JSON.stringify({
			api_key_source: apiKeyResult.source,
			event: 'spike.started',
			timestamp: timestamp(),
		}),
	];

	await mkdir(logDirectory, { recursive: true });

	if (!apiKeyResult.key) {
		lines.push(
			JSON.stringify({
				event: 'DEEPSEEK_KEY_UNAVAILABLE',
				timestamp: timestamp(),
			}),
		);
		await writeFile(logPath, `${lines.join('\n')}\n`, 'utf8');
		console.log(`DEEPSEEK_KEY_UNAVAILABLE ${logPath}`);
		return;
	}

	const prompts = [
		'Su an saat kac Istanbulda?',
		'Istanbul ve UTC saatlerini karsilastir; once uygun toolu cagir.',
		'Istanbulda simdi mesai baslangicina ne kadar zaman var? Hesaplamak icin once saati al.',
	];

	for (const [index, prompt] of prompts.entries()) {
		await runPrompt({
			apiKey: apiKeyResult.key,
			lines,
			prompt,
			runIndex: index + 1,
		});
	}

	lines.push(
		JSON.stringify({
			event: 'spike.completed',
			timestamp: timestamp(),
		}),
	);
	await writeFile(logPath, `${lines.join('\n')}\n`, 'utf8');
	console.log(logPath);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
