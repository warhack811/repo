import type { RenderBlock } from '../../../ws-types.js';

type ToolResultPayload = Extract<RenderBlock, { type: 'tool_result' }>['payload'];

const errorCopyByCode: Record<string, string> = {
	INVALID_INPUT: 'girilen değer geçersiz',
	NETWORK: 'bağlantı sorunu',
	NOT_FOUND: 'aranan kaynak bulunamadı',
	PERMISSION_DENIED: 'erişim izni yok',
	RATE_LIMITED: 'Çok hızlı istek atıldı, biraz bekle',
	TIMEOUT: 'işlem zaman aşımına uğradı',
	UNAUTHORIZED: 'oturum açman gerekiyor',
};

export function getFriendlyErrorMessage(payload: ToolResultPayload): string {
	if (!payload.error_code) {
		return 'beklenmeyen bir sorun oldu';
	}

	return errorCopyByCode[payload.error_code] ?? 'beklenmeyen bir sorun oldu';
}
