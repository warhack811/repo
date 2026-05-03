# Runa - Agent Context

> Bu dosya her IDE LLM oturumunun basinda okunmalidir.
> Projenin kimligini, sinirlarini ve bugunku calisma baglamini ozetler.

## Proje nedir?

Runa, projeyi taniyan ve hatirlayan bir AI calisma ortagidir.
Her seferinde sifirdan baslamaz.

- Tam vizyon: `vision.md`
- Mimari anayasa: `architecture/constitution.md`
- Uygulama plani: `implementation-blueprint.md`
- Stratejik yon: `post-mvp-strategy.md`
- Teknik mimari rehber: `technical-architecture.md`
- Guvenlik modeli: `security-model.md`
- Operasyonel ilerleme kaydi: `PROGRESS.md`

## Tech Stack

- Dil: TypeScript (strict mode)
- Runtime: Node.js
- Backend: Fastify + WebSocket
- Frontend: React + Vite SPA
- DB: PostgreSQL + Drizzle ORM
- Auth: Supabase Auth (JWT + RLS + OAuth)
- Object Storage: Supabase Storage
- Monorepo: Turborepo + pnpm
- Test: Vitest
- Lint: Biome
- LLM: `ModelGateway` -> provider adapters
- Runtime modeli: async generator agentic loop
- Desktop tarafi: Windows-first signed-in desktop companion hedefi; bugun repoda secure bridge foundation var, tam desktop app shell ve online device surface henuz yok

## Klasor Yapisi

```text
runa/
|- apps/
|  |- server/src/
|  |  |- auth/          <- Supabase auth middleware ve WS auth
|  |  |- context/       <- context assembly ve compaction
|  |  |- gateway/       <- model gateway ve provider adapters
|  |  |- persistence/   <- approval/checkpoint persistence seams
|  |  |- policy/        <- permission engine ve capability gating
|  |  |- presentation/  <- render block uretimi
|  |  |- runtime/       <- agent loop, stop conditions, approvals
|  |  |- tools/         <- built-in tools
|  |  `- ws/            <- transport, orchestration, presentation split
|  `- web/src/
|     |- components/    <- app/, auth/, approval/, chat/
|     |- hooks/         <- useAuth, useChatRuntime, useChatRuntimeView
|     |- lib/           <- ws client, auth client, chat-runtime helpers
|     `- pages/         <- LoginPage, DashboardPage, ChatPage, SettingsPage
|  `- desktop-agent/    <- local desktop bridge/runtime foundation; bugunku repo snapshot'inda user-facing desktop app shell henuz yok
`- packages/
   |- types/            <- ws, blocks, auth, subscription, agent-loop contracts
   |- db/               <- Drizzle schema ve DB helpers
   `- utils/            <- paylasilan utility katmani
```

Not: `apps/desktop-agent/` artik repodadir; bugun secure desktop bridge/runtime foundation'i temsil eder. Son kullaniciya gorunen tam desktop app shell, online device presence ve release-grade deployment ise henuz tamamlanmamis durumdadir.

## Kirmizi Cizgiler

1. Model cagrisi dogrudan yapilmaz; her zaman `ModelGateway` uzerinden gider.
2. Tool registry bypass edilmez; her tool `ToolDefinition` implement eder.
3. `RenderBlock` tipi `packages/types/src/blocks.ts`'e eklenmeden frontend yazilmaz.
4. State transition if/else zinciriyle yazilmaz; typed transition mantigi korunur.
5. Buyuk payload block icine gomulmez; artifact reference kullanilir.
6. Unknown error swallow edilmez; typed error/log yolu korunur.
7. `any` kullanilmaz; `unknown` + type guard tercih edilir.
8. Yeni dependency eklemeden once onay alinir.
9. Moduller arasi iletisim `packages/types` kontratlari uzerinden kurulur.
10. Mevcut interface degisikligi gerekiyorsa once architecture escalation note yazilir.

## Gelistirme Kurallari

### Type-first siralama

```text
1. packages/types/
2. apps/server/
3. apps/web/
4. test
```

### Event standardi

- Tum event'ler `EventEnvelope` formatindadir.
- Her event en az `run_id`, `trace_id`, `timestamp`, `type`, `payload` tasir.

### Tool ekleme

- `packages/types/src/tools.ts` kontratini kullan
- `apps/server/src/tools/` altina ekle
- registry wiring ve test ekle

### Render block ekleme

- `packages/types/src/blocks.ts` union'ina ekle
- backend mapper'i ekle
- frontend renderer karsiligini ekle

## Baglayici Urun/UI Manifestosu

Bu manifesto Sprint 10/11 ve sonrasi icin baglayicidir. Frontend, UI polish ve bugunku `apps/desktop-agent/` foundation'i uzerine insa edilecek desktop companion planlamasi bu cerceveyi ihlal etmez.

- Dashboard-first urun mantigina gidilmez; hedef yuzey consumer-grade, chat-first bir "calisma ortagi" deneyimidir.
- Referans hissi: Claude Cowork / Dispatch / sade ChatGPT benzeri sakin, korkutmayan, esnek ama guclu bir sohbet yuzeyi.
- Natural-language-first presentation esastir. Tool call, search, audit, background isler ve benzeri teknik akislar once insansi calisma diliyle gorunur; teknik ham detay varsayilan anlatim olmaz.
- `Advanced`, `Raw Transport`, `Model Override` ve benzeri operator/dev-ops kontrolleri ana chat ekraninda default, panel veya accordion olarak bulunmaz.
- Bu yuzeyler yalniz izole bir `Developer Mode` veya acikca gelistirici profiline ait ikinci katmanda konumlanir.
- Mobil-oncelikli chat akisi varsayilan urun yoludur; masaustu yerlesimi bunun uzerine kurulur.
- Approval deneyimi chat-native, sade accept/reject akisi olarak dusunulur; diff/log/ham detay yalniz kullanici isterse modal/popup/ikinci katmanda acilir.
- Sistem arkada guclu olabilir; on tarafta sade, kaliteli ve esnek bir calisma ortagi hissi korunur.
- Gerekce: kullanici segment farklari, benzer urun arastirmalari, gelecekte capability sayisi artarken spaghetti UI riskini onleme ihtiyaci.

Durust repo notu:

- Bugunku repo hala onceki operator/demo agirlikli yuzeylerden izler tasir.
- `DashboardPage`, `SettingsPage` ve bazi operator/debug affordance'lari repoda bulunabilir; bunlar hedef ana urun yuzunun son hali olarak yorumlanmaz.

## Aktif Faz

**Durum:** Core Hardening Phase 2 aktif. MVP (Sprint 1-6) kapandi; Sprint 9 ve Sprint 10 kabul edilmis isleri repoda.

**Bugun implement edilmis ana ilerleme:**
- **Track A:** agentic loop, stop conditions, realtime streaming, incremental presentation, prompt-injection guardrails, WS split, permission engine, auto-continue gate
- **Track B:** Supabase auth seams, authenticated storage, secure WS handshake, subscription gating, WSS/TLS config
- **Track C:** App/page decomposition, auth UI, authenticated shell, mevcut Dashboard/Chat/Settings ayrimi, responsive/a11y hardening, current-run progress polish, React Router entegrasyonu ve ilk secure desktop bridge foundation

**Henuz planli ama closure seviyesinde olmayan ana alanlar:**
- user-facing desktop app shell, signed-in device presence surface'i ve web tarafinda online cihaz gorunurlugu
- desktop capability ailesinin tamaminin release-grade local bridge/runtime uzerine tasinmasi
- GAP-11 kapsamindaki approval/policy state persistence hardening'i

**Uzun vadeli yon:** cloud-first hybrid mimari uzerinde otonom runtime + consumer-grade chat-first UI + desktop kontrol.

## Sprint Durumu

- Sprint 1-5: tamamlandi
- Sprint 6: MVP closure tamamlandi
- Phase 1.1: defer edildi
- Aktif: Core Hardening Phase 2

### Track Durumu

| Track | Snapshot | Durum | Not |
|---|---|---|---|
| A: Core Engine | Sprint 11 bandi | Ilerliyor | WS/runtime hardening ve kalan persistence gap'leri |
| B: Cloud Infra | Sprint 9B bandi | Temel implementasyon repoda | Auth, storage, secure WS ve subscription seams mevcut |
| C: UI + Desktop | Sprint 11 bandi | Ilerliyor | Mevcut web shell repoda; secure desktop bridge foundation var, ancak user-facing desktop app shell ve online device surface henuz tamamlanmadi |

## Kilitlenmis Teknik Kararlar

| Karar | Deger |
|---|---|
| Agentic loop modeli | Async generator + typed stop conditions |
| max_turns | 200 |
| Auto-continue | Varsayilan acik (max_turns, approval gate ve denial threshold guardrail'lari korunur) |
| Checkpoint persistence | PostgreSQL metadata + Object Storage blob |
| Context compaction | Microcompact |
| Token limit recovery | 413 -> compact + retry |
| Denial tracking | 3 ardisik red -> session pause |
| Auth provider | Supabase Auth |
| Cloud DB | Supabase PostgreSQL |
| Object storage | Supabase Storage |
| Subscription tiers | Free / Pro / Business |
| Dev provider | DeepSeek (deepseek-v4-flash / deepseek-v4-pro); Groq fallback zincirinde |
| Prod provider | Claude / Gemini (yayin oncesi sabitlenecek) |
| UI framework | React + Vite |
| Desktop platform | Windows-first, signed-in desktop companion + local bridge hedefi |

## Kod Giris Noktalari

- Runtime loop: `apps/server/src/runtime/agent-loop.ts`, `run-agent-loop.ts`, `run-model-turn-loop-adapter.ts`, `stop-conditions.ts`, `auto-continue-policy.ts`
- Resilience & Recovery: `apps/server/src/runtime/tool-call-repair-recovery.ts`, `token-limit-recovery.ts`
- WS composition root: `apps/server/src/ws/register-ws.ts`
- WS split yuzeyi: `apps/server/src/ws/transport.ts`, `orchestration.ts`, `presentation.ts`, `run-execution.ts`
- Auth ve subscription seams: `apps/server/src/auth/supabase-auth.ts`, `apps/server/src/ws/ws-auth.ts`, `apps/server/src/ws/ws-subscription-gate.ts`
- Shared WS contracts: `packages/types/src/ws.ts`, `packages/types/src/ws-guards.ts`
- Web entry: `apps/web/src/App.tsx`
- App shell ve pages: `apps/web/src/components/app/AppShell.tsx`, `apps/web/src/pages/*.tsx`
- Frontend orchestration: `apps/web/src/hooks/useAuth.ts`, `apps/web/src/hooks/useChatRuntime.ts`
- Desktop bridge foundation: `apps/desktop-agent/src/auth.ts`, `apps/desktop-agent/src/ws-bridge.ts`, `apps/desktop-agent/src/screenshot.ts`
- Shared render contracts: `packages/types/src/blocks.ts`

## Core Hardening Notlari

- Mevcut omurga yeniden yazilmaz; ustune additive gidilir.
- `register-ws.ts` artik ince composition katmanidir; yeni WS davranisini once split dosyalarda konumlandir.
- Agent loop artik gercek koddadir; yeni isler mevcut stop-condition ve policy sinirlarini korumali.
- Cloud migration additive ilerler; local/dev seams korunur.
- Desktop companion hedefi gecerlidir; bugun repoda local bridge/runtime foundation vardir, ancak tam desktop app shell ve online device presence henuz yoktur.
- Track C isleri Track A/B kontratlarini bypass etmeden ilerlemelidir.
- Ana chat yuzeyi operator/debug yuzeyleriyle doldurulmaz; gerekiyorsa ayri `Developer Mode` dusunulur.
- Approval, heavy diff/log ve benzeri detaylar varsayilan ekran yogunlugu yaratmadan, talep-uzerine ikinci katmanda sunulur.
- Web search varsayilan truth kaynagi degildir; mevcut guardrail'lar korunur.

## Gorev Alma Sablonu

Her gorev icin `docs/TASK-TEMPLATE.md` sablonunu kullan.
