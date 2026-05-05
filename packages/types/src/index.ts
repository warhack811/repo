/**
 * @runa/types — Shared Type Definitions
 *
 * Bu paket Runa'nın tüm modülleri arasındaki sözleşmelerin (contracts) merkezidir.
 * KARAR.MD'deki her maddenin TypeScript karşılığı burada tanımlanır.
 *
 * Kurallar:
 * - Tüm modüller bu paketten import eder
 * - Implementation kodu buraya yazılmaz, sadece tipler
 * - Yeni tip eklerken ilgili dosyaya ekle, barrel export'u güncelle
 *
 * Dosya yapısı (Sprint 1'de doldurulacak):
 * - events.ts    → EventEnvelope, event tipleri
 * - state.ts     → Runtime state tipleri, geçiş kuralları
 * - gateway.ts   → ModelGateway interface
 * - blocks.ts    → RenderBlock union type
 * - tools.ts     → ToolDefinition, ToolResult
 * - context.ts   → ContextLayer, CompiledContext
 * - memory.ts    → Memory tipleri
 * - policy.ts    → Permission, Approval tipleri
 */

// Sprint 1, Görev 2'de doldurulacak — şu an boş barrel export
export * from './events.js';
export * from './gateway.js';
export * from './evidence.js';
export * from './locale.js';
export * from './state.js';
export * from './agent-loop.js';
export * from './checkpoint.js';
export * from './auth.js';
export * from './subscription.js';
export * from './blocks.js';
export * from './ws.js';
export * from './ws-guards.js';
export * from './tools.js';
export * from './mcp.js';
export * from './memory.js';
export * from './policy.js';
export * from './desktop.js';
