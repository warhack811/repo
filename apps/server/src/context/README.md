# Context Module

## Bu modul nedir?

Bu modul, model cagrilarina gidecek baglami katmanli bicimde toplar, derler ve provider-agnostic bir artifact'e donusturur.
Memory, workspace ve run bilgisi burada bir araya gelir; daha sonra gateway tarafina uyarlanir.
Context assembly agir retrieval motoru degil, kontrollu assembly ve adaptation katmanidir.

## KARAR.MD karsiligi

- Madde 2 - Context Composer, Layer Assembly, Budgeting ve Compilation

## Implement ettigi interface'ler

Dogrudan `packages/types` altinda ayri bir `ContextComposer` veya `context.ts` interface dosyasi yoktur.
Bu modul su shared contract'lar uzerinden calisir:

- `CompiledContextLayer` - `packages/types/src/gateway.ts`
- `CompiledContextArtifact` - `packages/types/src/gateway.ts`
- `ModelRequest` - `packages/types/src/gateway.ts`
- `MemoryRecord` - `packages/types/src/memory.ts`
- `MemoryScope` / `MemorySourceKind` - `packages/types/src/memory.ts`

## Yeni eleman eklerken takip edilecek pattern

- yeni bir context katmani eklemeden once mevcut artifact yapisini (`CompiledContextArtifact`) kullan
- memory veya workspace bilgisi gerekiyorsa ilgili secimi ayri helper'da yap
- provider-specific prompt yazma mantigini burada buyutme; adaptation siniri korunmali
- composed artifact'i test edilebilir, deterministic metin/katman ciktisiyla tut
- sibling `*.test.ts` ile hem katman assembly hem request adaptation davranisini dogrula

## Bu modul ne DEGILDIR

- raw memory store degildir; persistence burada tutulmaz
- provider adapter degildir; HTTP/protocol seviyesi `gateway/` tarafindadir
- tool execution modulu degildir; `tools/` veya `runtime/` sorumlulugunu alma
- prompt engineering coplugu degildir; rastgele string biriktirme mantigi kurma
- truth authority karar motorunun tam hali degildir; retrieval/source governance ile karistirma

## Aktif dosyalar

- `adapt-context-to-model-request.ts`
- `build-memory-prompt-layer.ts`
- `compiled-context-text.ts`
- `compose-context.ts`
- `compose-memory-context.ts`
- `compose-workspace-context.ts`
- `orchestrate-memory-read.ts`
