# Runa — Task Template

## Görev Bilgileri

- **Sprint:** Core Hardening Phase 2 — **Track:** Track A
- **Görev:** Parallel Tool Calling — resource-aware, approval-aware çoklu tool çağrısı desteği
- **Modül:** gateway / runtime / policy
- **KARAR.MD Maddesi:** Agentic loop modeli: async generator + typed stop conditions

## Bağlam

- **İlgili interface:** `packages/types/src/gateway.ts` → `ModelResponse`, `ModelToolCallCandidate`; `packages/types/src/agent-loop.ts` → `AgentLoopTurnResult`
- **Referans dosya:** `apps/server/src/gateway/groq-gateway.ts`, `apps/server/src/ws/run-execution.ts`, `apps/server/src/runtime/agent-loop.ts`, `apps/server/src/runtime/stop-conditions.ts`
- **Repo gerçeği:** Runa bugün tek tool candidate/result akışına göre çalışır. Paralellik latency kazanımı sağlar ama state, approval ve event ordering riskini artırır.

## Rekabetçi Kalite Çıtası

Rakip seviyesine yaklaşmak için sadece `Promise.allSettled()` eklemek yetmez. Runa'nın paralel tool calling'i resource-aware olmalıdır.

- Read-only tool'lar paralel çalışabilir.
- Write/execute/desktop/browser/clipboard gibi side-effect tool'lar aynı turn içinde varsayılan sequential çalışır.
- Aynı resource'a dokunan tool'lar kilitlenir.
- Approval gerektiren tool, approval alınmadan batch içinde yürütülmez.
- Event ordering deterministik ve test edilebilir kalır.
- Partial failure modeli açıkça tanımlanır.

## Kaynaklı Endüstri Notları

- Anthropic tool-use dokümanları paralel tool kullanımını destekler ama uygulama katmanında tool result yönetimi geliştirici sorumluluğundadır.
- OpenAI structured output notları, parallel tool calls ile strict schema kombinasyonlarının dikkat gerektirdiğini belirtir; Runa schema/validation kapılarını korumalıdır.

## Görev Detayı

Bu görev üç faza bölünür. Tek IDE LLM run'ında en fazla bir faz uygulanmalıdır.

### TASK-04A — Type + Gateway Additive Parse

1. `ModelResponse` içine additive alan ekle:
   ```typescript
   readonly tool_call_candidates?: readonly ModelToolCallCandidate[];
   ```
2. Mevcut `tool_call_candidate` alanı korunur.
3. `AgentLoopTurnResult` içine additive alan ekle:
   ```typescript
   readonly tool_results?: readonly ToolResult[];
   ```
4. Groq gateway tüm `tool_calls` dizisini parse eder ama maksimum 5 candidate üretir.
5. Parse error'ları typed ve candidate bazlı raporlanır; bütün response swallow edilmez.

### TASK-04B — Tool Classification + Scheduler

Yeni küçük scheduler katmanı ekle:

```typescript
type ToolEffectClass = 'read' | 'write' | 'execute' | 'desktop' | 'browser' | 'clipboard';
type ToolResourceKey = 'workspace' | 'filesystem' | 'browser_session' | 'desktop_input' | 'clipboard' | 'network' | 'memory';
```

Kurallar:

- `read` + farklı resource → paralel.
- `write` / `execute` / `desktop` / `browser` / `clipboard` → sequential unless explicit safe.
- Aynı `ToolResourceKey` → sequential.
- Approval-required tool → approval gate tamamlanmadan execution'a girmez.
- Unknown tool effect → conservative sequential.

### TASK-04C — Runtime Integration

1. `run-execution.ts` candidate listesini scheduler'a verir.
2. Scheduler batch plan üretir.
3. Read batch'leri `Promise.allSettled()` ile çalışır.
4. Sequential batch'ler sırayla çalışır.
5. `tool_results` model continuation'a deterministik sırayla iletilir.
6. `consecutive_tool_failure_count`: hepsi başarısızsa artar, en az biri başarılıysa sıfırlanır.

## Sınırlar (Yapma Listesi)

- [ ] `tool_call_candidate` ve `tool_result` alanlarını silme.
- [ ] İlk fazda 5'ten fazla parallel candidate çalıştırma.
- [ ] Approval-required tool'u approval almadan yürütme.
- [ ] Desktop/browser/input/file write tool'larını kör paralelleştirme.
- [ ] Stop condition mantığını okumadan failure semantics değiştirme.
- [ ] Gateway dışındaki provider'ları aynı anda yeniden yazma.
- [ ] `any`, silent catch, unordered result append kullanma.

## Değiştirilebilecek Dosyalar

- `packages/types/src/gateway.ts`
- `packages/types/src/agent-loop.ts`
- `apps/server/src/gateway/groq-gateway.ts`
- `apps/server/src/runtime/tool-scheduler.ts` (yeni)
- `apps/server/src/runtime/tool-scheduler.test.ts` (yeni)
- `apps/server/src/ws/run-execution.ts`
- `apps/server/src/runtime/agent-loop.ts`
- İlgili test dosyaları

## Değiştirilmeyecek Dosyalar

- `apps/desktop-agent/**`
- `apps/web/**`
- Auth/subscription modülleri
- Mevcut single-tool alanları

## Done Kriteri

- [ ] Single-tool flow geriye dönük çalışır.
- [ ] Multi-tool response'ta candidate listesi parse edilir.
- [ ] Scheduler read-only tool'ları paralel, side-effect tool'ları sequential planlar.
- [ ] Approval-required tool batch'e alınmadan bekletilir.
- [ ] Partial failure ve all-failure testleri vardır.
- [ ] Runtime event/result ordering deterministik test edilir.
- [ ] Typecheck, targeted Vitest ve Biome PASS.

## Notlar

- Dependency graph ileri faz hedefidir; ilk kaliteli çözüm R/W lock + resource lock + approval gate'tir.
- Bu görev Runa'yı hızlandırır ama yanlış uygulanırsa güveni azaltır. Speed, safety'den sonra gelir.
