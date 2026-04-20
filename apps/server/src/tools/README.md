# Tools Module

## Bu modul nedir?

Bu modul, Runa'nin semantic-first tool plane'ini tasir.
Tool implementasyonlari, metadata tabanli risk siniflari ve merkezi registry burada bulunur.
Runtime tarafinin cagiracagi concrete tool davranisi bu klasorde tanimlanir.

## KARAR.MD karsiligi

- Madde 4 - Tool Plane, Tool Registry, Semantic-first Tool Classification

## Implement ettigi interface'ler

- `ToolDefinition` - `packages/types/src/tools.ts`
- `ToolRegistryLike` - `packages/types/src/tools.ts`
- `ToolCallInput` - `packages/types/src/tools.ts`
- `ToolExecutionContext` - `packages/types/src/tools.ts`
- `ToolResult` - `packages/types/src/tools.ts`

## Yeni eleman eklerken takip edilecek pattern

- once shared tool input/output tipi gerekiyorsa `packages/types/src/tools.ts` tarafini kontrol et
- yeni tool'u `ToolDefinition` olarak implement et
- `metadata` icinde `risk_level`, `requires_approval` ve `side_effect_level` alanlarini durustce tanimla
- registry'ye kayit ekle
- sibling `*.test.ts` dosyasi yaz
- gerekiyorsa presentation tarafinda ilgili `tool_result` veya ozel block gorunurlugunu kontrol et

## Bu modul ne DEGILDIR

- policy engine degildir; approval kararinin motoru `runtime/` ve `policy/` tarafindadir
- model cagrisi yapan katman degildir; `gateway/` modulu degildir
- render block ureten katman degildir; `presentation/` modulu degildir
- memory yazma/okuma sistemi degildir; `context/`, `runtime/` ve `persistence/` taraflarina karismamalidir
- shell-first kacis noktasi degildir; semantic tool yolu ana yoldur

## Aktif dosyalar

- `edit-patch.ts`
- `file-list.ts`
- `file-read.ts`
- `file-write.ts`
- `git-diff.ts`
- `git-status.ts`
- `registry.ts`
- `search-codebase.ts`
- `search-grep.ts`
- `shell-exec.ts`
- `tool-idempotency.ts`
- `web-search.ts`
