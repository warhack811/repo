# Gateway Module

## Bu modul nedir?

Bu modul, `ModelGateway` kontratini concrete provider adapter'lariyla hayata gecirir.
Tum model cagrilari bu sinir uzerinden gecer; request/response mapping, provider secimi ve adapter factory disiplini burada tutulur.
Bugunku strateji provider-agnostic'tir: Groq primary, secondary provider ise claim-scoped ve `TBD` durumundadir.

## KARAR.MD karsiligi

- Madde 1 - ModelGateway ve provider-agnostic model erisimi

## Implement ettigi interface'ler

- `ModelGateway` - `packages/types/src/gateway.ts`
- `ModelRequest` - `packages/types/src/gateway.ts`
- `ModelResponse` - `packages/types/src/gateway.ts`
- `CompiledContextArtifact` - `packages/types/src/gateway.ts`
- `ModelCallableTool` - `packages/types/src/gateway.ts`

## Yeni eleman eklerken takip edilecek pattern

- yeni provider icin `ModelGateway` implement eden ayri adapter yaz
- request-side tool schema, compiled context ve response parsing davranisini adapter icinde tut
- factory / provider registry kaydini tek yerde guncelle
- live smoke claim'i acilacaksa helper + command + docs authority ucunu birlikte ekle
- sibling `*.test.ts` ve gerekiyorsa ayrik smoke script ile davranisi kilitle

## Bu modul ne DEGILDIR

- runtime state machine degildir; state gecislerini burada yonetme
- prompt assembly modulu degildir; raw context derleme isini `context/` tarafindan ayir
- tool registry veya tool executor degildir
- provider-ozel urun stratejisi merkezi degildir; aktif claim'i docs/runbook/checklist belirler
- UI-facing copy veya presentation katmani degildir

## Aktif dosyalar

- `claude-gateway.ts`
- `compiled-context.ts`
- `errors.ts`
- `factory.ts`
- `groq-gateway.ts`
- `index.ts`
- `provider-http.ts`
- `providers.ts`
- `request-tools.ts`
- `tool-call-candidate.ts`
