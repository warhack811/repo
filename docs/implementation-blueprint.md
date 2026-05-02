# Runa - Implementation Blueprint

## Temel Ilke

Bu belge, `karar.md` ile `vision.md` arasinda kopru kurar.
Amaci tek bir soruyu cevaplamaktir:

**"Yarin sabah hangi dosyayi acip hangi kodu yazacagiz?"**

### Kritik Tasarim Felsefesi

> **MVP = uzerine insa edilecek gercek temel.**

Bu demek ki:

- MVP'de yazilan kod production-grade kalitededir
- Moduller dogru soyutlamalarla ayrilir
- Interface ve contract'lar ilk gunden dogru tanimlanir
- MVP sonrasi plan "yeniden yaz" degil, "ustune ekle"dir
- Kapsam dar tutulur ama temeller saglamdir

### Operasyonel Cerceve

> **Production-grade core, intentionally incomplete surface.**

Cekirdek dogru ve temiz olmalidir:

- state machine
- event stream
- context composer
- tool registry
- gateway interface

Yuzey bilincli olarak dar tutulabilir:

- tool sayisi
- memory derinligi
- UI zenginligi
- provider cesitliligi

Bu iki katman birbirine karistirilmamalidir.

---

## 1. Stack Kararlari

### Kesinlesmis (MVP + Core Hardening)

| Karar | Secim | Neden |
| --- | --- | --- |
| Dil | TypeScript (strict mode) | Full-stack tip paylasimi ve contract modelleme gucu |
| Runtime | Node.js | Kararli, olgun, async orchestration icin uygun |
| Backend | Fastify | Plugin ekosistemi ve WebSocket olgunlugu |
| Frontend | React + Vite | Hizli dev dongusu, SPA yeterli |
| Veritabani | PostgreSQL + Drizzle ORM | Local dev: Docker, production: Supabase |
| Auth | Supabase Auth | JWT + RLS + OAuth, DB ile native entegrasyon |
| Object Storage | Supabase Storage | Screenshot, tool output blob'lari |
| Monorepo | Turborepo + pnpm | Shared contracts, tek CI, tek tip evreni |
| Test | Vitest | Hizli, TS-native, monorepo uyumlu |
| Lint/Format | Biome | Tek arac, hizli, TS-first |
| Realtime | WebSocket (Fastify native) | Render block streaming ve approval interaction |
| State Machine | Custom minimal + async generator | Agentic loop, checkpoint, stop conditions |
| LLM Entegrasyon | `ModelGateway` -> provider adapter | Provider-agnostic soyutlama, adapter eklemeyi kolaylastirir |
| Desktop Companion | Node.js-first local bridge/runtime, user-facing desktop shell asamali | Windows-first signed-in desktop app, online device presence ve remote control icin kontrollu rollout |
| Deployment | Cloud-first hybrid | Server + DB bulutta, desktop companion local'de |

### Provider Stratejisi

`ModelGateway` provider-agnostic omurgadir. Ortama gore provider secimi:

| Ortam | Provider | Gerekce |
| --- | --- | --- |
| Gelistirme / iterasyon | Groq | Hizli, dusuk surtunmeli, sirket politikasi |
| Yayin / production | Claude / Gemini (sabit) | Yayin oncesi belirlenir, kalite tutarliligi |
| Gecis | env + arayuz override | Provider-agnostic omurga recete degistirmeyi kolaylastirir |

Provider dili kural:

- Sistem `ModelGateway` uzerinden provider-agnostic kalir
- Gelistirme surecinde yalnizca Groq modelleri kullanilir (sirket politikasi)
- Yayin oncesinde Claude/Gemini sabit olarak belirlenir
- Provider claim'i ancak live credential + live smoke PASS varsa acilir

### Sirket API'leri - Entegrasyon Plani

| API | Durum | Giris |
| --- | --- | --- |
| Groq | Aktif - primary dev provider | Sprint 1 (MVP) |
| Supabase | Phase 2 - Auth + DB + Storage | Sprint 7B (Core Hardening) |
| Serper | Aktif - `web.search` tool | Phase 1.1 (tamamlandi) |
| DeepSeek | Aktif - primary production baseline | Faz 2.5 (tamamlandi) |
| Resilience | Aktif - Tool Call Repair Recovery | Faz 3 (tamamlandi) |
| Claude / Gemini | Phase 2 - secondary provider | Yayin oncesi |
| Qdrant | Phase 3 - semantic memory | Phase 3 |
| Neo4j | Phase 3+ - knowledge graph | Phase 3+ |

---

## 2. Monorepo Yapisi

```text
runa/
|- apps/
|  |- server/
|  |  |- src/
|  |  |  |- runtime/       <- agentic loop, state machine, checkpoint, run manager
|  |  |  |- context/       <- context composer, layer assembly, compaction
|  |  |  |- memory/        <- memory seam / boundary
|  |  |  |- gateway/       <- model gateway, provider adapters
|  |  |  |- tools/         <- tool executor, built-in tools
|  |  |  |- presentation/  <- canonical mapper, render block producer
|  |  |  |- policy/        <- permission engine, approval, capability gating
|  |  |  |- auth/          <- Supabase auth middleware, JWT validation
|  |  |  |- routes/        <- HTTP endpoints
|  |  |  `- ws/            <- WebSocket handlers (transport, orchestration, presentation)
|  |  `- ...
|  |- web/
|  |  |- src/
|  |  |  |- pages/         <- LoginPage, DashboardPage, ChatPage, SettingsPage
|  |  |  |- components/    <- chat/, agent/, approval/, desktop/, settings/
|  |  |  |- hooks/         <- useAgentLoop, useAuth, useSubscription
|  |  |  `- lib/           <- ws-client, auth-client
|  |  `- ...
|  `- desktop-agent/       <- bugunku local desktop bridge/runtime foundation; gelecekteki desktop companion shell ile ayni contract ailesinde
|     `- src/
|        |- screenshot.ts
|        |- input-injector.ts
|        |- ws-bridge.ts
|        |- auth.ts
|        `- index.ts
|- packages/
|  |- types/
|  |  `- src/
|  |     |- events.ts
|  |     |- state.ts
|  |     |- blocks.ts
|  |     |- tools.ts
|  |     |- memory.ts
|  |     |- policy.ts
|  |     |- gateway.ts
|  |     |- ws.ts
|  |     |- context.ts
|  |     |- agent-loop.ts      <- [NEW Phase 2] agentic loop contracts
|  |     |- checkpoint.ts      <- [NEW Phase 2] checkpoint/resume contracts
|  |     |- auth.ts            <- [NEW Phase 2] user/session types
|  |     `- subscription.ts   <- [NEW Phase 2] tier/feature gating
|  |- utils/
|  `- db/
|- turbo.json
|- package.json
|- tsconfig.base.json
|- biome.json
|- karar.md
|- vision.md
`- implementation-blueprint.md
```

### Neden bu yapi?

- `packages/types` = anayasal contract'larin TypeScript karsiligi
- `apps/server/src/` altindaki klasorler = karar maddelerinin implementasyon yuzleri
- `apps/desktop-agent/` = cloud server ile WSS uzerinden iletisim kuran local bridge/runtime foundation; signed-in desktop companion ve online device presence yolunun bugunku teknik zemini
- Moduller arasi iletisim typed interface'ler uzerinden kurulur
- Frontend, backend ve desktop runtime ayni shared contract'lari tuketir

---

## 3. MVP Scope - Karar Madde Eslesmesi

Her maddenin MVP'de aktif olan minimum ama dogru alt kumesi hedeflenir.

### Madde 1 - Runtime Kernel

| MVP'de var | MVP'de yok |
| --- | --- |
| Custom state machine | Full checkpointing |
| Basic event loop | Replay/resume engine'in tam hali |
| Event envelope standardi | Distributed execution |
| Run lifecycle | Multi-step planning |
| Idempotency seam'i | Full effect management |

### Madde 2 - Context Composer

| MVP'de var | MVP'de yok |
| --- | --- |
| Core Rules + Run + Memory katmanlari | Tum katmanlarin tam aktivasyonu |
| Ordered merge | Full fingerprint-based compilation |
| Basit token budgeting | Adaptive hierarchical budgeting'in tam hali |
| Provider-aware format cevirisi | Multi-provider cache optimization |
| Compiled context debug ciktisi | Compression ladder'in tam hali |

### Madde 3 - Memory

| MVP'de var | MVP'de yok |
| --- | --- |
| Working context | Workspace/project memory |
| Session/run memory | Full user preference memory |
| Basic artifact store | Semantic retrieval |
| Basit recall | Full candidate pipeline |

### Madde 4 - Tool Plane

| MVP'de var | MVP'de yok |
| --- | --- |
| Central registry | Full capability-rich registry |
| Semantic-first tool siniflamasi | Parallel scheduler |
| `file.*`, `search.*`, `edit.*`, `shell.*`, `git.*` | MCP / external tools |
| Basit sirali execution | Full policy engine integration |
| Risk tagging | Action-context permission matrix'in tam hali |

### Madde 5 - Presentation

| MVP'de var | MVP'de yok |
| --- | --- |
| Canonical presentation mapper | Block schema versioning |
| Temel render blocks | `table`, `tree`, `chart`, `image` |
| Block-aware streaming | Full back-pressure/coalescing |
| WebSocket transport | IPC / daemon transport |
| Basic error rendering | Full degraded/interrupted rendering |

### Madde 6-8 - Daemon, Observability, Release

| MVP'de var | MVP'de yok |
| --- | --- |
| Basit escalation hint | Full escalation engine |
| Run-level logging | Full daemon mode |
| Basic tracing | Golden task suite |
| Coverage / repeatability proof | Capability gating system'in tam hali |

### Madde 9-12 - Security, Data, Knowledge, Identity

| MVP'de var | MVP'de yok |
| --- | --- |
| Tek kullanici varsayimi | Multi-tenant principal model |
| Approval gate | Trust zones / sandbox izolasyonu |
| Basic data-class ve provider key disiplini | Full data governance |
| Local file search | Semantic retrieval |
| Repo-aware knowledge | Public-web retrieval varsayilan yol degil |

### Madde 13-14 - Extensions, Human Ops

| MVP'de var | MVP'de yok |
| --- | --- |
| Internal tool registration pattern | Marketplace / third-party extension |
| Run inspection | Full operational surfaces |
| Approval + intervention visibility | Full ops plane |

---

## 4. Sprint Plani

### Sprint 1 - Cekirdek Loop

**Hedef:** "Kullanici mesaj yazar -> model cevap verir" akisi calisir.

Yapilacaklar:

- Monorepo kurulumu
- `packages/types` event/state/gateway kontratlari
- Fastify + WebSocket scaffold
- Minimal runtime state machine
- `ModelGateway` interface + Groq adapter + ikincil provider adapter seam'i
- Event stream ve basit WS push
- React + Vite chat skeleton
- DB: `runs` ve `messages`

**Sprint 1 Demo:** Tarayicida mesaj yaz -> model cevap versin -> streaming gorunsun.

**Non-goals:**

- Tool calling yok
- Context composer yok
- Kullanici yonetimi yok

**Definition of Done:**

- Monorepo `pnpm dev` ile ayaga kalkar
- Streaming cevap gorunur
- Event stream persist edilir
- Groq primary adapter ve ikincil provider seam'i calisir
- Ortak event/state tipleri tanimlidir

---

### Sprint 2 - Tool Execution + Context

**Hedef:** "Runa bir dosyayi okuyup, duzenleyip, sonucu gosterebilir."

Yapilacaklar:

- Tool registry
- Ilk 5 tool
- `TOOL_EXECUTING` ve `TOOL_RESULT_INGESTING` state'leri
- Tool calling entegrasyonu
- Core Rules + Run Layer context composer
- `compiled_context` -> model request baglantisi
- `tool_result`, `code`, `status` benzeri temel blocks
- Tool execution gorunurlugu
- `tool_calls` persistence

**Sprint 2 Demo:** "Bu dosyadaki bug'i bul ve duzelt."

**Non-goals:**

- Approval yok
- Memory yok
- Web search yok
- Execution profile yok

**Definition of Done:**

- Model tool cagrisi yapabilir
- Dosya okuma/yazma calisir
- Shell komutu calistirilabilir
- Context composer modele baglam verir
- UI'da tool adimlari gorunur
- Tool cagrilari loglanir

---

### Sprint 3 - Approval + Memory

**Hedef:** "Runa onay ister ve oturumlar arasinda baglam tasir."

Yapilacaklar:

- Approval manager + approval block
- `WAITING_APPROVAL`
- Working context + session memory
- Memory layer'i context composer'a ekleme
- `edit.patch`, `git.status`, `git.diff`
- `diff` render surface

**Sprint 3 Demo:** "Bu fonksiyonu refactor et" -> analiz -> diff -> onay -> uygula -> sonraki run'da hatirla.

**Non-goals:**

- Web search yok
- Execution profile yok
- Workspace manifest okuma yok
- Provider routing yok

**Definition of Done:**

- Approval UI'da calisir
- Reddedilen islem calismaz
- Session memory yeni run'da erisilebilir
- Context composer 3 katmanla calisir
- Diff gorunurlugu vardir

---

### Sprint 4 - Proje Surekliligi + Hardening

**Hedef:** "Runa projeyi tanir ve hatirlar."

Yapilacaklar:

- Workspace/proje bilgisi okuma
- Proje baglami surekliligi
- Basit context fingerprinting
- Error handling ve run failure states
- Run inspection UI
- `search.codebase`
- Structured logging zemini
- Yuksek riskli mutasyonlar icin approval gate

**Sprint 4 Demo:** Ayni projeye donen kullanici icin "her seferinde sifirdan baslamaz" hissi olusur.

**Non-goals:**

- Full token accounting yok
- Full idempotency yok
- Web search yok
- Multi-provider routing yok

**Definition of Done:**

- Workspace acildiginda proje yapisi taranir
- Onceki session memory geri cagrilir
- Run inspection gorunur
- Hata durumlari anlamli gosterilir
- Log korelasyonu calisir

---

### Sprint 5 - Polish + Test + Dokumantasyon

**Hedef:** "MVP saglam, test edilmis ve kullanilabilir."

Yapilacaklar:

- UI polish
- Basit fast-path
- Idempotency key altyapisi
- Basic token accounting
- Core test suite
- Dar integration / repeatability senaryosu
- README ve gelistirici dokumantasyonu
- Performans review

**Sprint 5 Demo:** Tam MVP senaryosu tekrarlanabilir sekilde calisir.

**Non-goals:**

- Web search yok
- Execution profile sistemi yok
- Provider routing yok
- Daemon mode yok

**Definition of Done:**

- Demo senaryosu tekrar kosulabilir
- Core coverage esigi korunur
- Integration evidence vardir
- README ile repo ayaaga kaldirilabilir
- Known bugs / ops gaps dokumante edilir

---

## 5. MVP "Calisir" Tanimi

Sprint 5 sonunda su senaryo uctan uca calismalidir:

> Solo developer, reposunu Runa'ya baglar.
> Dogal dille gorev verir: "Bu projede auth middleware'de bir bug var, bul ve duzelt."
> Runa projeyi tarar, ilgili dosyalari bulur, sorunu tespit eder.
> Duzenleme onerir, onay ister, uygular ve sonucu gosterir.
> Ertesi gun ayni projeye dondugunde onceki calismayi hatirlar.

Bu cumle `vision.md` icindeki vaadi test eder:

**"Her seferinde sifirdan baslamaz."**

---

## 6. MVP'de Acikca Yapilmayacaklar

- Image generation / editing
- Local model inference
- Self-hosted media runtime
- Mobil uygulama
- Multi-user / ekip collaboration
- Full daemon mode
- MCP / external tool entegrasyonu
- Extension marketplace
- Multi-tenant / enterprise identity
- Broad consumer positioning
- Neo4j / graph database
- Qdrant / vector search
- Web search varsayilan core capability olarak
- Multi-provider execution routing
- Full execution profile sistemi

---

## 7. Phase 1.1 - Tamamlanan Capability Genislemesi

Phase 1.1'de asagidaki alanlar acildi ve defer edildi (Core Hardening onceligine alindi):

| Alan | Durum | Not |
| --- | --- | --- |
| Web search tool (Serper) | Tamamlandi | `web.search` tool + provenance-aware presentation |
| User preference memory (basit) | Tamamlandi | `source_kind = user_preference` + supersede lifecycle |
| Multi-provider routing | Defer edildi | Anthropic credential_missing; yayin oncesi Claude/Gemini ile acilacak |

Detaylar: `PROGRESS.md` Phase 1.1 gorev kayitlari.

---

## 8. Phase 2 - Core Hardening Sprint Plani

### Genel Bakis

Core Hardening, MVP omurgasini production-grade autonomous agent runtime'a tasir.
3 paralel track uzerinden yurutulur:

| Track | Odak | Bagimliliklari |
| --- | --- | --- |
| **A: Core Engine** | Agentic loop, checkpoint, compaction, permission, WS refactor | Bagimsiz; mevcut runtime uzerine insa |
| **B: Cloud Infra** | Supabase Auth, cloud DB, object storage, secure WS, subscription | Bagimsiz; mevcut persistence uzerine insa |
| **C: UI + Desktop** | UI decomposition, chat-first consumer surface, signed-in desktop companion + local bridge | Track A + B temellerine ihtiyac duyar |

### Track C Icin Baglayici UI Manifestosu

Bu bolum, Sprint 10/11 ve sonrasi icin baglayici urun/UI cercevesidir. Geriye donuk closure claim'i uretmez; bundan sonraki planlama dilini netlestirir.

- Dashboard-first urun kurgusuna gidilmez.
- Ana yuzey, mobil-oncelikli ve chat-first bir "calisma ortagi" akisidir.
- Tool/search/audit/background isler natural-language-first sekilde sunulur; teknik ham bloklar varsayilan anlatim olmaz.
- `Advanced`, `Raw Transport`, `Model Override` ve benzeri operator/dev-ops alanlari ana chat ekraninda panel veya accordion olarak bulunmaz.
- Bu alanlar yalniz izole bir `Developer Mode` veya gelistirici profiline ait ikinci katmanda yer alir.
- Approval UX, chat-native sade accept/reject akisidir; diff/log/ham detay kullanici istediginde ikinci katmanda acilir.
- Desktop agent planlamasi da ayni manifesto altinda sekillenir: arkada guclu capability, onde sade ve korkutmayan urun hissi.

Durust snapshot notu:

- Bugunku repo `DashboardPage`, `SettingsPage` ve bazi operator/debug affordance'lari icerir.
- Bunlar mevcut gecis durumunu gosterir; nihai ana urun yuzunu tarif eden baglayici hedef olarak okunmaz.

### Kilitlenmis Teknik Parametreler

Bu degerler ekip ile birlikte onaylandi:

| Parametre | Deger | Gerekce |
| --- | --- | --- |
| Agentic loop modeli | Async generator + typed stop conditions | Dogrudan control flow, kolay test, cancel/pause |
| max_turns (hard cap) | 200 | Sonsuz dongu korumasi |
| Auto-continue | Varsayilan kapali, kullanici tercihi ile acilir | Progressive trust modeli |
| Checkpoint persistence | PostgreSQL (metadata) + Object Storage (blob) | Hibrit: hizli query + buyuk veri ayrim |
| Context compaction | Microcompact (512-1024 token ozet) | Token recovery + baglam koruma dengesi |
| Token limit recovery | 413 -> otomatik compact + retry | Kullanici mudahalesi olmadan devam |
| Denial tracking | 3 ardisik red -> session pause | Kasitli kotu kullanim korumasi |
| Desktop platform | Windows-first, macOS-ready altyapi | Oncelikli pazar + genisleyebilirlik |
| Auth provider | Supabase Auth (JWT + RLS + OAuth) | DB ile native entegrasyon, tenant izolasyonu |
| Cloud DB | Supabase PostgreSQL | Managed, RLS destekli, auth ile entegre |
| Object storage | Supabase Storage | Screenshot, tool output blob'lari |
| Subscription tiers | Free / Pro / Business | Feature gating icin katmanli model |
| Dev provider | Groq | Sirket politikasi |
| Prod provider | Claude / Gemini (yayin oncesi sabit) | Kalite + guvenilirlik |

---

### Sprint 7 / Track A - Agentic Loop + Stop Conditions

**Hedef:** Mevcut tek-turlu `runModelTurn()` uzerine async generator tabanli cok-turlu agentic loop insa etmek.

Yapilacaklar:

- `packages/types/src/agent-loop.ts` — `AgentLoopConfig`, `TurnYield`, `StopReason`, `LoopState` tipleri
- `apps/server/src/runtime/agent-loop.ts` — async generator loop engine
- `apps/server/src/runtime/stop-conditions.ts` — typed stop condition evaluator
- Mevcut `runModelTurn()` zincirini loop icinden cagiracak adapter
- Turn sayaci, token limiti, tool failure, kullanici cancel, model stop sinyali
- WS uzerinden turn-by-turn progress stream
- Unit + integration testleri

Non-goals:

- Checkpoint/resume (Sprint 8)
- Context compaction (Sprint 8)
- Permission engine (Sprint 9)
- Auto-continue UI (Sprint 10)

Definition of Done:

- Cok-turlu tool zinciri tek `run.request` ile calisir
- max_turns=200 ve typed stop conditions enforce edilir
- WS uzerinden turn progress gorunur
- `pnpm typecheck`, `pnpm lint`, `pnpm test` yesil

---

### Sprint 7.1 / Track A — Realtime Streaming (P0 Audit Gap)

**Hedef:** Agentic loop yield'lerini gercek zamanli olarak WS uzerinden stream etmek. Mevcut toplu gonderim modelini incremental push modeline cevirmek.

**Baglam (Audit GAP-01):** `run-execution.ts` icindeki `executeLiveRun()` agentic loop yield'lerini `events[]` array'inde biriktirip, loop tamamlandiktan sonra toplu gonderiyor. Kullanici run tamamlanana kadar hicbir gorsel geri bildirim almiyor. Bu, demo ve kullanici deneyimi icin en kritik darbogazdir.

Yapilacaklar:

- `executeLiveRun()` icindeki `while(true)` loop'unda her `turn.started`, `turn.progress` ve `turn.completed` yield'i alindiginda ilgili runtime event'leri aninda `sendServerMessage()` ile WS'ye basmak
- Presentation block'larin turn bazinda incremental gonderilebilmesi icin `presentation.ts` icindeki block assembly mantigi uyarlamak
- Frontend `useChatRuntime` hook'unda gelen incremental mesajlari mevcut state'e append etmek (toplu update yerine incremental update)
- `run.finished` mesajinin loop tamamlandiktan sonra yalniz bir kere gonderilmesini garantilemek
- Mevcut WS protocol contract'inin korunmasi (breaking change yok — ayni mesaj tipleri, farkli zamanlama)
- Frontend'in ayni anda hem eski toplu modeli hem yeni incremental modeli tolere edebilmesi (graceful degradation)

Non-goals:

- Token-by-token LLM streaming (ayri bir calisma, su anki oncelik degil)
- Presentation block schema degisikligi
- Backend WS protocol'une yeni mesaj tipi ekleme

Definition of Done:

- Kullanici mesaj gonderdikten sonra ilk `turn.started` event'i 2 saniye icinde WS uzerinden gorunur
- Her tool cagrisinin sonucu (`turn.progress`) aninda WS'ye basiliyor
- Run tamamlandiginda `run.finished` mesaji dogru sekilde gonderiliyor
- Mevcut `pnpm typecheck`, `pnpm lint`, `pnpm test` yesil
- Frontend'de turn-by-turn progress gorunur

---

### Sprint 7B / Track B - Supabase Setup + DB Migration

**Hedef:** Cloud-first altyapiyi kurmak; Supabase projesi, DB schema migration ve RLS politikalarini uygulamak.

Yapilacaklar:

- Supabase projesi olusturma ve konfigurasyonu
- Mevcut Drizzle schema'sini Supabase PostgreSQL'e migration
- RLS (Row Level Security) politikalarinin tanimlanmasi
- `packages/db` altinda cloud/local cift mod destegi
- Object Storage bucket'larinin olusturulmasi
- Environment konfigurasyonu (Supabase URL, anon key, service role key)
- Smoke test: cloud DB uzerinden CRUD dogrulamasi

Non-goals:

- Auth API (Sprint 8B)
- Subscription gating (Sprint 9B)
- Frontend auth UI (Sprint 10)

Definition of Done:

- Supabase PostgreSQL uzerinden mevcut schema calisir
- RLS politikalari tanimli ve test edilmis
- Object Storage erisilebilir
- Local Docker DB ile cloud DB arasinda gecis env degiskeniyle yapilabilir

---

### Sprint 8 / Track A - Checkpoint + Context Compaction

**Hedef:** Uzun sureli calismalarin durdurulup devam ettirilebilmesini ve context window'un verimli yonetimini saglamak.

Yapilacaklar:

- `packages/types/src/checkpoint.ts` — `CheckpointRecord`, `CheckpointMeta`, `ResumeContext` tipleri
- `apps/server/src/runtime/checkpoint-manager.ts` — PostgreSQL (meta) + Object Storage (blob) hibrit persistence
- `apps/server/src/context/compaction-strategies.ts` — microcompact (512-1024 token ozet)
- 413 token limit recovery: otomatik compact + retry
- Agentic loop icinde turn-bazli checkpoint yazimi
- Resume: checkpoint'tan agentic loop'a geri donme
- Unit + integration testleri

Non-goals:

- Permission engine (Sprint 9)
- WS refactoring (Sprint 9)

Definition of Done:

- Uzun run durdurulup devam ettirilebilir
- Context compaction token limitine yaklastiginda otomatik devreye girer
- 413 recovery otomatik calisir
- Checkpoint verisi PostgreSQL + Object Storage'da kalici

---

### Sprint 8B / Track B - Auth API + Storage

**Hedef:** Supabase Auth entegrasyonu ile kullanici kimlik dogrulama, JWT validation ve storage API'sini kurmak.

Yapilacaklar:

- `packages/types/src/auth.ts` — `AuthUser`, `AuthSession`, `AuthToken` tipleri
- `apps/server/src/auth/supabase-auth.ts` — Supabase Auth middleware
- JWT validation ve Fastify hook entegrasyonu
- OAuth provider'lari konfigurasyonu (Google, GitHub)
- Storage API: screenshot ve tool output blob upload/download
- Authenticated WS baglantisi icin JWT handshake
- Unit + integration testleri

Non-goals:

- Subscription gating (Sprint 9B)
- Frontend login UI (Sprint 10)
- Desktop agent auth (Sprint 11)

Definition of Done:

- Kullanici signup/login/logout calisir
- JWT ile authenticated API erisilebilir
- WS baglantisi JWT ile guvenli
- Object Storage'a blob yazma/okuma calisir

---

### Sprint 9 / Track A - Permission Engine + WS Refactor

**Hedef:** Kapsamli permission engine kurmak ve monolitik `register-ws.ts`'yi sorumluluk bazinda parcalamak.

Yapilacaklar:

- `apps/server/src/policy/permission-engine.ts` — capability gating, denial tracking, progressive trust
- Denial tracking: 3 ardisik red -> session pause
- Auto-continue kontrolu: varsayilan kapali, kullanici tercihi ile acilir
- `register-ws.ts` parcalama:
  - `ws/transport.ts` — baglanti yonetimi, mesaj routing
  - `ws/orchestration.ts` — run lifecycle, agentic loop tetikleme
  - `ws/presentation.ts` — block assembly, inspection
- Mevcut WS contract'larinin korunmasi (breaking change yok)
- Unit + integration testleri

Non-goals:

- Subscription-based feature gating (Sprint 9B)
- UI decomposition (Sprint 10)

Definition of Done:

- Permission engine denial tracking ve progressive trust enforce eder
- `register-ws.ts` 3 sorumluluk dosyasina parcalanmis
- Mevcut WS testleri yesil (breaking change yok)
- `pnpm typecheck`, `pnpm lint`, `pnpm test` yesil

---

### Sprint 9B / Track B - Secure WS + Subscription

**Hedef:** WSS ile guvenli iletisim ve subscription tabanli feature gating kurmak.

Yapilacaklar:

- `packages/types/src/subscription.ts` — `SubscriptionTier`, `FeatureGate`, `UsageQuota` tipleri
- WSS (TLS) konfigurasyonu
- Subscription tier enforcement middleware
- Feature gating: Free / Pro / Business tier'lara gore capability erisimi
- Usage quota takibi (gunluk/aylik turn limitleri)
- Subscription durumuna gore WS baglanti kontrolu
- Unit + integration testleri

Non-goals:

- Odeme entegrasyonu (ayri proje)
- Admin paneli (Phase 3)

Definition of Done:

- WSS ile guvenli baglanti calisir
- Free / Pro / Business tier'lar enforce edilir
- Feature gating unit testlerle dogrulandi
- Usage quota takibi calisir

---

### Sprint 10 / Track C - UI Decomposition + Auth UI

**Hedef:** Monolitik `App.tsx`'i parcalamak ve chat-first consumer surface yonune hizali auth/UI temellerini kurmak.

**Onkosul:** Track A Sprint 7-8 ve Track B Sprint 7B-8B tamamlanmis olmali.

Yapilacaklar:

- `App.tsx` parcalama: pages/, components/, hooks/ yapisi
- LoginPage, DashboardPage, ChatPage, SettingsPage
- Auth UI: signup, login, OAuth, profile
- Chat-first shell: ana akis sohbet merkezli kalirken mevcut page/shell yapisini daha temiz sinirlara ayirmak
- Natural-language-first presentation ve developer/operator izolasyonu icin uygun yuzey sinirlari
- Agentic loop progress UI: turn-by-turn gorsel geri bildirim
- Approval UI: sade accept/reject akisina yaklastirma
- Dark mode, responsive layout
- Accessibility iyilestirmeleri

Non-goals:

- Desktop agent UI (Sprint 11)
- Mobil uygulama

Definition of Done:

- Auth akisi uctan uca calisir (signup -> login -> chat -> logout)
- UI component'leri ayrik ve test edilebilir
- Ana chat deneyimi dashboard-first okumayi guclendirmez; operator/dev-ops yuzeyleri varsayilan urun akisina daha fazla yayilmaz
- Responsive layout tum ekran boyutlarinda calisir

---

### Sprint 11 / Track C - Desktop Companion + Consumer Surface Alignment

**Hedef:** Windows desktop companion yolunu, chat-first consumer yuzeyi bozmadan planlamak; local bridge/runtime foundation'i user-facing desktop app, online device presence ve kontrollu remote execution hedefiyle hizalamak.

**Onkosul:** Track A Sprint 9 ve Track B Sprint 9B tamamlanmis olmali.

Yapilacaklar:

- `apps/desktop-agent/` package'inin local bridge/runtime zemini olarak olgunlastirilmasi
- Screenshot capture
- Input injection (klavye/mouse)
- WSS bridge: server ile guvenli iletisim
- Desktop companion auth: kullanici/device baglama ve guvenli oturum
- Desktop tool'lari: `desktop.screenshot`, `desktop.click`, `desktop.type`
- Tool metadata'larina desktop risk profilleri
- Web tarafinda online device presence ve desktop capability gorunurlugunu operator paneline donusturmeden urunlestirme
- Desktop companion status indicator (tray icon / system notification)

Non-goals:

- macOS destegi (yayin sonrasi, talebe gore)
- Full polished desktop app packaging / installer rollout
- Full remote desktop (yalnizca tool-tabanli kontrol)

Definition of Done:

- Desktop bridge/runtime Windows'ta calisir
- Screenshot alip server'a gonderebilir
- Klavye/mouse input inject edebilir
- WSS uzerinden server ile guvenli iletisim
- Desktop tool'lari registry'ye kayitli ve test edilmis
- User-facing desktop companion yolunun auth/device-presence kontrati netlesmistir
- Ana urun deneyimi chat-first kalir; desktop capability gorunurlugu manifesto ile uyumlu ikinci katman mantigina tasinabilir

---

## 9. Phase 3 - Derinlestirme (Post Core Hardening)

| Oncelik | Alan | Bagimlilik |
| --- | --- | --- |
| P1 | Qdrant semantic memory | Memory seam + embedding pipeline |
| P1 | MCP tool entegrasyonu | Tool registry + policy genisletme |
| P2 | Execution profiles | Runtime + provider routing |
| P2 | Multi-user / kucuk ekip | Principal model + tenant izolasyonu |
| P2 | macOS desktop companion | Desktop bridge/runtime altyapisi |
| P3 | Neo4j / knowledge graph | Memory + retrieval pipeline |
| P3 | Extension marketplace | Tool registry + capability packs |
| P3 | Full daemon mode | Runtime + policy seam'leri |
