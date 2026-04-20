# Presentation Module

## Bu modul nedir?

Bu modul, runtime ve tool tarafindan uretilen olaylari kullaniciya gidecek canonical render block'lara cevirir.
Backend-side presentation mapper disiplini burada tutulur; web uygulamasi bu ciktiyi tuketir.
Amaç, runtime detayi ile UI arasina typed ve dar bir gorunurluk katmani koymaktir.

## KARAR.MD karsiligi

- Madde 5 - Canonical Presentation Mapper, Render Blocks

## Implement ettigi interface'ler

Dogrudan `packages/types` altinda tek bir `PresentationMapper` interface'i yoktur.
Bu modul su shared contract'lar uzerinden calisir:

- `RenderBlock` - `packages/types/src/blocks.ts`
- runtime event payload'lari - `packages/types/src/events.ts`
- approval kontratlari - `packages/types/src/policy.ts`
- tool result kontratlari - `packages/types/src/tools.ts`

## Yeni eleman eklerken takip edilecek pattern

- yeni block gerekiyorsa once `packages/types/src/blocks.ts` union type'ina ekle
- server tarafinda dar mapper helper'i yaz
- ws tarafinda block gorunurlugu zincirini kontrol et
- web tarafinda ayni block tipine renderer ekle
- mapping'i summary-first tut; raw payload'i block icine gommemeye dikkat et

## Bu modul ne DEGILDIR

- frontend component klasoru degildir
- gateway veya model cagrisi modulu degildir
- tool execution modulu degildir
- state machine modulu degildir
- raw log dump katmani degildir; kullaniciya karar-verilebilir gorunurluk uretmelidir

## Aktif dosyalar

- `harden-search-routing-notes.ts`
- `map-approval-result.ts`
- `map-code-result.ts`
- `map-diff-result.ts`
- `map-inspection-detail.ts`
- `map-run-timeline.ts`
- `map-runtime-events.ts`
- `map-search-result.ts`
- `map-tool-result.ts`
- `map-trace-debug.ts`
- `map-web-search-result.ts`
- `map-workspace-inspection.ts`
