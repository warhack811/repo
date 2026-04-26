# Runa — Task Template

## Görev Bilgileri

- **Sprint:** Phase 3 hazırlığı — **Track:** Track A
- **Görev:** Multi-Agent Orchestration — cancellation-safe, budgeted ve policy-aware sub-agent zemini
- **Modül:** runtime
- **KARAR.MD Maddesi:** Agentic loop modeli: async generator + typed stop conditions

## Bağlam

- **İlgili interface:** `packages/types/src/agent-loop.ts` → `AgentLoopConfig`, `AgentLoopSnapshot`, `StopReason`, `TurnYield`
- **Referans dosya:** `apps/server/src/runtime/agent-loop.ts`, `apps/server/src/runtime/stop-conditions.ts`, `apps/server/src/runtime/auto-continue-policy.ts`, `apps/server/src/ws/run-execution.ts`, `apps/server/src/ws/orchestration.ts`
- **Repo gerçeği:** Mevcut mimari tek ajan loop'u üzerine kuruludur. Multi-agent, cancellation/process lifecycle ve budget isolation olmadan açılırsa runtime güvenilirliğini düşürür.

## Rekabetçi Kalite Çıtası

Rakip seviyesinde multi-agent demek "birkaç ajanı aynı anda başlat" değildir. Runa için hedef kontrollü delegation'dır.

- Parent run cancel edildiğinde tüm sub-agent'lar ve tool'lar iptal olur.
- Sub-agent kendi budget, max_turns, tool allowlist ve audit trace'iyle çalışır.
- Sub-agent parent snapshot'ı mutate edemez.
- Approval propagation netleşmeden high-risk tool'lar sub-agent'a verilmez.
- Parallel sub-agent execution ilk faz değildir; sequential delegation ile başlanır.
- Zombie process bırakmama done kriteridir.

## Kaynaklı Endüstri Notları

- OpenAI Agents SDK handoff/delegation modelinde handoff araç gibi temsil edilir; guardrails ve trace görünürlüğü production ajanlarda kritik kabul edilir.
- Node child process API `AbortSignal` destekler; fakat process tree cleanup ve Windows davranışı ayrıca test edilmelidir.

## Görev Detayı

Bu belge doğrudan full multi-agent implementasyonu değildir. Önce lifecycle zemini kurulur.

### TASK-11A — Run-Scoped Cancellation Foundation

1. Parent run için `AbortController` lifecycle'ı netleştir.
2. Tool execution'a `AbortSignal` geçiş noktalarını haritala.
3. Child process başlatan tool'lar için process registry tasarla.
4. Timeout/heartbeat ve cleanup semantics yaz.
5. Windows process tree cleanup için gerçekçi test/fallback planı hazırla.

### TASK-11B — Sequential `agent.delegate`

1. Tool:
   ```json
   {
     "sub_agent_role": "researcher | reviewer | coder",
     "task": "string",
     "context": "string?"
   }
   ```
2. Sub-agent depth max 1.
3. Tool allowlist role bazlı ve conservative.
4. Auto-continue sub-agent için varsayılan açık yapılmaz; parent policy'den türetilir.
5. Parent result'a summary + evidence + turns_used döner.

### TASK-11C — Parallel Delegation

Yalnız 11A ve 11B yeşil olduktan sonra:

- Parallel sub-agent limit: max 2 başlangıç.
- Budget isolation.
- Cancellation fan-out.
- Deterministic result merge.
- Partial failure semantics.

## Sınırlar (Yapma Listesi)

- [ ] Cancellation foundation olmadan multi-agent başlatma.
- [ ] Sub-agent'a full tool registry verme.
- [ ] Sub-agent auto-continue'u varsayılan true yapma.
- [ ] İç içe sub-agent'a izin verme.
- [ ] Parent snapshot mutation'a izin verme.
- [ ] Approval-required desktop/browser/shell tools'u sub-agent'a otomatik açma.
- [ ] Gateway redesign açma.
- [ ] `any`, silent catch, unbounded parallelism kullanma.

## Değiştirilebilecek Dosyalar

### TASK-11A

- `packages/types/src/agent-loop.ts`
- `apps/server/src/runtime/run-cancellation.ts` (yeni)
- `apps/server/src/runtime/process-registry.ts` (yeni, gerekiyorsa)
- `apps/server/src/runtime/*cancellation*.test.ts`
- Tool execution entrypoint dosyaları yalnız abort signal threading için

### TASK-11B

- `apps/server/src/tools/agent-delegate.ts` (yeni)
- `apps/server/src/tools/agent-delegate.test.ts` (yeni)
- `apps/server/src/runtime/sub-agent-runner.ts` (yeni)
- `apps/server/src/tools/registry.ts`
- `packages/types/src/tools.ts`

### TASK-11C

- `apps/server/src/runtime/sub-agent-scheduler.ts` (yeni)
- `apps/server/src/runtime/sub-agent-scheduler.test.ts` (yeni)
- Narrow integration points in `run-execution.ts`

## Değiştirilmeyecek Dosyalar

- `apps/desktop-agent/**`
- `apps/web/**`
- Gateway provider implementations
- Existing stop condition semantics unless a typed additive field is required

## Done Kriteri

- [ ] Seçilen faz açıkça belirtilir.
- [ ] Parent cancel → sub-agent cancel → tool/process cleanup path test edilir.
- [ ] Sub-agent max_turns ve budget uygulanır.
- [ ] Tool allowlist ve depth limit test edilir.
- [ ] Approval-required tools default denied veya explicit gated kalır.
- [ ] Parallel fazda deterministic merge ve partial failure testleri vardır.
- [ ] Typecheck, targeted Vitest ve Biome PASS.

## Notlar

- Multi-agent sonradan büyük avantaj sağlar; erken ve kontrolsüz açılırsa Runa'nın çekirdek güvenilirliğini bozar.
- İlk kaliteli ürün etkisi sequential reviewer/researcher delegation olabilir; full parallel swarm hedef değildir.
