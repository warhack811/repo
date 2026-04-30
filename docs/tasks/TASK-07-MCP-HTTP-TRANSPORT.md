# Runa — Task Template

## Görev Bilgileri

- **Sprint:** Core Hardening Phase 2 — **Track:** Track A
- **Görev:** MCP Streamable HTTP Transport — uzak MCP server bağlantısını ToolRegistry'yi bozmadan eklemek
- **Modül:** mcp
- **KARAR.MD Maddesi:** Modüller arası iletişim `packages/types` kontratları üzerinden kurulur

## Bağlam

- **İlgili interface:** `packages/types/src/mcp.ts` → `McpServerConfig`, `McpCallToolRequest`, `McpCallToolResult`, `McpToolDefinition`
- **Referans dosya:** `apps/server/src/mcp/client.ts`, `apps/server/src/mcp/stdio-transport.ts`, `apps/server/src/mcp/client.test.ts`
- **Repo gerçeği:** Mevcut MCP stdio bridge, external tools'u mevcut `ToolRegistry` plane'ine additive kayıt etmek için kullanılmalıdır. MCP için ikinci bir execution plane kurulmaz.

## Rekabetçi Kalite Çıtası

MCP desteği Runa'nın entegrasyon gücünü artırır. Rakip seviyesine yaklaşmak için transport güncel standarda uygun, güvenli ve denetlenebilir olmalıdır.

- `stdio` davranışı bozulmaz.
- Streamable HTTP desteği additive gelir.
- Remote URL ve headers güvenlik politikası ile sınırlanır.
- Authorization headers log'lanmaz.
- MCP tools yine `mcp.<serverId>.<toolName>` isimlendirmesiyle ToolRegistry'ye girer.
- Remote MCP tool'lar varsayılan approval-gated/high-risk kabul edilir.

## Kaynaklı Endüstri Notları

- MCP resmi transport dokümanında güncel standart transport'lar `stdio` ve `Streamable HTTP` olarak tanımlanır; eski HTTP+SSE anlatımıyla karıştırılmamalıdır.
- Streamable HTTP server JSON response veya event-stream döndürebilir; client ikisini de kontrollü parse etmelidir.

## Görev Detayı

### TASK-07A — Type + Config Validation

`McpServerConfig` additive genişlet:

```typescript
interface McpServerConfig {
  readonly id: string;
  readonly transport?: 'stdio' | 'http';
  readonly command?: string;
  readonly args?: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  readonly url?: string;
  readonly headers?: Readonly<Record<string, string>>;
}
```

Kurallar:

- `transport` yoksa default `stdio`.
- `http` için `url` zorunlu.
- `stdio` için `command` zorunlu.
- `headers` secret redaction helper ile log'lanır.

### TASK-07B — HTTP Transport

`apps/server/src/mcp/http-transport.ts` ekle.

- JSON-RPC messages POST edilir.
- `Content-Type: application/json`
- `Accept: application/json, text/event-stream`
- JSON response parse edilir.
- SSE/event-stream response parse edilir.
- Timeout: request 30s, stream 60s.
- AbortSignal desteklenir.
- Result shape mevcut `McpStdioSessionResult` ile uyumlu kalır.

### TASK-07C — Client Integration

- `McpClient.callTool()` transport'a göre yönlendirir.
- HTTP için async `listTools()` eklenebilir.
- `listToolsSync()` stdio-only kalabilir; HTTP'de typed unsupported error döner.

## Sınırlar (Yapma Listesi)

- [ ] `stdio-transport.ts` davranışını bozma.
- [ ] MCP tools için ikinci registry/execution sistemi kurma.
- [ ] Remote URL için `file://`, private network, localhost veya metadata IP erişimini default açma; gerekiyorsa explicit allowlist.
- [ ] Authorization/API key headers'ı log'lama.
- [ ] Sync HTTP listTools uydurma.
- [ ] Gateway, desktop, web modüllerine girme.
- [ ] `any`, loose index access, silent catch kullanma.

## Değiştirilebilecek Dosyalar

- `packages/types/src/mcp.ts`
- `apps/server/src/mcp/http-transport.ts` (yeni)
- `apps/server/src/mcp/http-transport.test.ts` (yeni)
- `apps/server/src/mcp/client.ts`
- `apps/server/src/mcp/client.test.ts`

## Değiştirilmeyecek Dosyalar

- `apps/server/src/mcp/stdio-transport.ts`
- `packages/types/src/tools.ts`
- `apps/server/src/tools/registry.ts`
- `apps/server/src/ws/runtime-dependencies.ts` unless HTTP config parsing already lives there and change is unavoidable

## Done Kriteri

- [ ] Existing stdio MCP tests PASS.
- [ ] HTTP config validation testleri vardır.
- [ ] JSON response ve SSE/event-stream parse testleri vardır.
- [ ] Header redaction test edilir.
- [ ] Private/local URL policy negative testleri vardır.
- [ ] `McpClient.callTool()` HTTP transport ile mock fetch üzerinden çalışır.
- [ ] Typecheck, targeted Vitest ve Biome PASS.

## Notlar

- Remote MCP genişleme stratejiktir ama trust boundary büyütür. Conservative exposure: approval required, high risk, execute side effect.
- Bu görev MCP'i Runa runtime'ına yaklaştırır; Runa'nın tool authority düzenini MCP'e teslim etmez.
