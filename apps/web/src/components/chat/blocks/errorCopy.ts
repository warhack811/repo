import type { RenderBlock } from '../../../ws-types.js';

type ToolResultPayload = Extract<RenderBlock, { type: 'tool_result' }>['payload'];

const errorCopyByCode: Record<string, string> = {
	INVALID_INPUT: 'girilen deÄŸer geÃ§ersiz',
	NETWORK: 'baÄŸlantÄ± sorunu',
	NOT_FOUND: 'aranan kaynak bulunamadÄ±',
	PERMISSION_DENIED: 'eriÅŸim izni yok',
	RATE_LIMITED: 'Ã§ok hÄ±zlÄ± istek atÄ±ldÄ±, biraz bekle',
	TIMEOUT: 'iÅŸlem zaman aÅŸÄ±mÄ±na uÄŸradÄ±',
	UNAUTHORIZED: 'oturum aÃ§man gerekiyor',
};

export function getFriendlyErrorMessage(payload: ToolResultPayload): string {
	if (!payload.error_code) {
		return 'beklenmeyen bir sorun oldu';
	}

	return errorCopyByCode[payload.error_code] ?? 'beklenmeyen bir sorun oldu';
}
