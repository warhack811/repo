const PROMPT_ROLE_TAG_PATTERN = /<\/?\s*(assistant|system|user)\b[^>]*>/giu;

function encodeHtmlBrackets(value: string): string {
	return value.replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
}

export function sanitizePromptContent(content: string): string {
	return content.replace(PROMPT_ROLE_TAG_PATTERN, (tag) => encodeHtmlBrackets(tag));
}

export function sanitizeOptionalPromptContent(content: string | undefined): string | undefined {
	if (content === undefined) {
		return undefined;
	}

	return sanitizePromptContent(content);
}
