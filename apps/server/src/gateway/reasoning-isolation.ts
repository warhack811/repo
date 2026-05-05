function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringField(value: unknown, field: string): string | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	const fieldValue = value[field];

	return typeof fieldValue === 'string' && fieldValue.length > 0 ? fieldValue : undefined;
}

export function extractReasoningContent(chunk: unknown): string | undefined {
	if (!isRecord(chunk)) {
		return undefined;
	}

	const choices = chunk['choices'];

	if (!Array.isArray(choices)) {
		return undefined;
	}

	const firstChoice = choices[0];

	if (!isRecord(firstChoice)) {
		return undefined;
	}

	return (
		readStringField(firstChoice['delta'], 'reasoning_content') ??
		readStringField(firstChoice['message'], 'reasoning_content')
	);
}

export function appendReasoningContent(
	buffer: string[],
	chunk: unknown,
): {
	readonly appended_length: number;
	readonly content?: string;
} {
	const content = extractReasoningContent(chunk);

	if (content === undefined) {
		return {
			appended_length: 0,
		};
	}

	buffer.push(content);

	return {
		appended_length: content.length,
		content,
	};
}

export function joinReasoningContent(buffer: readonly string[]): string | undefined {
	const content = buffer.join('');

	return content.length > 0 ? content : undefined;
}
