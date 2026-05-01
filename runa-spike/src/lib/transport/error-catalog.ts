import { uiText } from '@/lib/i18n/strings'

export type TransportErrorKind = 'network-cut' | 'rate-limit' | 'timeout' | 'server-error' | 'unknown'

export type TransportErrorState = {
  kind: TransportErrorKind
  label: string
}

export function classifyTransportError(error: Error): TransportErrorState {
  const message = error.message.toLowerCase()

  if (message.includes('network') || message.includes('fetch') || message.includes('terminated')) {
    return { kind: 'network-cut', label: uiText.transport.connectionLost }
  }

  if (message.includes('429') || message.includes('rate')) {
    return { kind: 'rate-limit', label: 'Rate limit aşıldı — Tekrar dene' }
  }

  if (message.includes('timeout')) {
    return { kind: 'timeout', label: 'İstek zaman aşımına uğradı — Tekrar dene' }
  }

  if (message.includes('500') || message.includes('server')) {
    return { kind: 'server-error', label: 'Sunucu hatası — Tekrar dene' }
  }

  return { kind: 'unknown', label: uiText.transport.connectionLost }
}
