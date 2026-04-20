# Runtime Module

## Bu modul nedir?

Bu modul, run lifecycle'ini, state machine gecislerini, model-turn orchestration'ini ve approval/tool/memory yan akislari bir araya getirir.
Runa'nin cekirdegi burada calisir: run baslar, state degisir, event'ler uretilir ve effectful aksiyonlar kontrollu sekilde yonetilir.
Tekil bir "runtime interface" yerine, birden fazla shared contract bu klasorde birlikte orkestre edilir.

## KARAR.MD karsiligi

- Madde 1 - Runtime Kernel, State Machine, Checkpointing ve Event Stream

## Implement ettigi interface'ler

Dogrudan `packages/types` altinda tek bir `Runtime` interface'i yoktur.
Bu modul su shared contract'lar uzerinden calisir:

- `RuntimeState` - `packages/types/src/state.ts`
- `EventEnvelope` - `packages/types/src/events.ts`
- `ModelRequest` / `ModelResponse` - `packages/types/src/gateway.ts`
- `ApprovalRequest` / `ApprovalResolution` - `packages/types/src/policy.ts`
- `ToolCallInput` / `ToolResult` - `packages/types/src/tools.ts`
- `MemoryWriteCandidate` - `packages/types/src/memory.ts`

## Yeni eleman eklerken takip edilecek pattern

- yeni state gerekiyorsa once `packages/types/src/state.ts` tarafini guncelle
- yeni runtime event gerekiyorsa `packages/types/src/events.ts` kontratini ac
- orchestration helper'ini dar tut; bir helper tek bir gecis veya tek bir phase'e odaklansin
- approval, tool, memory ve gateway baglantilarini helper zinciri uzerinden kur
- sibling `*.test.ts` ile davranisi kilitle

## Bu modul ne DEGILDIR

- prompt assembly modulu degildir; `context/` katmanina ait isi burada buyutme
- provider adapter modulu degildir; `gateway/` tarafindaki HTTP/protocol ayrintilarini buraya tasima
- raw UI render katmani degildir; `presentation/` disiplini olmadan block uretme
- rastgele utility coplugu degildir; state transition veya orchestration baglamindan kopuk yardimcilari yigmayi engelle
- policy bypass noktasi degildir; approval gereken aksiyonu burada sessizce gecirme

## Aktif dosyalar

- `adapt-model-response-to-turn-outcome.ts`
- `approval-events.ts`
- `bind-available-tools.ts`
- `build-memory-write-candidate.ts`
- `continue-model-turn.ts`
- `index.ts`
- `ingest-tool-result.ts`
- `model-tool-dispatch.ts`
- `model-usage-accounting.ts`
- `orchestrate-memory-write.ts`
- `refine-memory-lifecycle.ts`
- `request-approval.ts`
- `resolve-approval.ts`
- `resume-approved-tool-call.ts`
- `run-model-step.ts`
- `run-model-turn.ts`
- `run-tool-step.ts`
- `run-with-provider.ts`
- `runtime-events.ts`
- `select-memory-candidate.ts`
- `state-machine.ts`
- `tool-events.ts`
- `write-memory-candidate.ts`
