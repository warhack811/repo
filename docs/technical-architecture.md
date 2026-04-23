# Runa Teknik Mimari Rehberi

> Bu belge repo kodu okunarak hazirlanmistir.
> Amaci, okuyan kisinin Runa'nin teknik olarak nasil calistigini tek belge uzerinden anlayabilmesidir.
> Burada yer alan her ifade mevcut kodla desteklenir. Kodda olmayan bir yetenek veya akis varmis gibi anlatilmaz.

> Snapshot notu (2026-04-23):
> Sprint 9 ile WS akisinin ana sorumluluklari `register-ws.ts` disina tasinmis, Sprint 10 ile web UI `App.tsx` tek dosya modelinden page/shell/hook ayrimina gecmistir.
> `apps/desktop-agent/` artik repodadir; ancak bugunku hali user-facing desktop app shell degil, secure desktop bridge/runtime foundation'idir.
>
> UI manifesto sinir notu (2026-04-19):
> Bu belge bugunku repo snapshot'ini anlatir; hedef urun yuzunu normatif olarak tanimlayan belge degildir.
> Mevcut web surface'te operator/detail/debug odakli alanlar bulunabilir. Yeni baglayici hedef, bu yuzeylerin ana chat deneyiminden ayrilip yalniz `Developer Mode` benzeri ikinci katmana tasinmasidir.

## 1. Bu belge neyi kapsar?

Bu belge su alanlari kapsar:

- monorepo yapisi
- backend calisma akisi
- WebSocket protokolu
- runtime state machine
- context ve memory akisi
- gateway / provider katmani
- tool sistemi
- approval ve persistence akislari
- presentation / render block sistemi
- web istemcisi ve UI davranisi
- rehearsal / smoke / validation scriptleri

Bu belge sunlari yapmaz:

- yeni mimari karar uretmez
- closure claim'ini genisletmez
- gelecekteki capability'leri bugun varmis gibi anlatmaz
- eksik alanlari uydurmaz

## 2. Sistem ozeti

Runa, ayni proje baglamini tekrar tekrar kurmak yerine o baglamla calisan bir AI calisma ortagi cekirdegi kurar.
Bugunku repo, bir model cagrisi etrafinda su zinciri birlestirir:

1. istemci `run.request` gonderir
2. server request'i dogrular
3. workspace ve memory baglami toplanir
4. bu baglam `compiled_context` olarak modele verilir
5. model ya metin cevabi verir ya da tool call onerir
6. tool call varsa registry uzerinden dispatch edilir
7. riskli tool'lar approval gate'e takilir
8. runtime event'leri uretilir ve DB'ye yazilir
9. presentation block'lari uretilir
10. web istemcisi bugunku snapshot'ta canli run yuzeyini, detail kartlarini ve acilabilir ham teknik yuzeyleri gosterebilir

Onemli sinir:

- Canli WS yolu bugun recursive bir "sonsuz agent loop" degildir.
- `apps/server/src/ws/register-ws.ts` canli path'i tek bir `runModelTurn` cagirir.
- Bu tur sonucunda sistem su noktalardan birinde durur:
  - `COMPLETED`
  - `FAILED`
  - `WAITING_APPROVAL`
  - `TOOL_RESULT_INGESTING`
- Bu bolum Sprint 9 oncesi MVP snapshot'ini anlatir; guncel repoda auto-continue gate ve continuation seams mevcuttur.
- Ayrintinin guncel hali icin asagidaki Snapshot notu ile `PROGRESS.md` kayitlari birlikte okunmalidir.

Bu nedenle bu ilk ozet bolumu, MVP kapanis snapshot'indaki "baglamli tek tur + tool dispatch + approval + presentation" omurgasini tarif eder; guncel continuation davranisi icin asagidaki bolumler ve `PROGRESS.md` birlikte okunmalidir.

### 2.1 Phase 2 Snapshot (Core Hardening)

Mimarinin guncel (Phase 2) durumu assagidaki gibidir:
- **Buluta gecis:** Auth, PostgreSQL ve Storage seams'leri Supabase hizasina alinmistir; local/dev yollar additive korunur.
- **Desktop Runtime:** `apps/desktop-agent` repodadir; secure `/ws/desktop-agent` bridge'i ve bugunku `desktop.screenshot` proof'unu tasiyan local bridge/runtime foundation'i olarak durur. User-facing desktop app shell ve online device presence henuz tamamlanmis degildir.
- **Agentic Loop:** Async generator loop, stop conditions ve auto-continue gate repodadir.
- **WS Parcalanma:** `register-ws.ts` ince composition katmanidir; asil akis split dosyalara dagilmistir.

## 3. Monorepo yapisi

Runa bir `pnpm` + `Turborepo` monorepo'sudur.

### 3.1 Kok dizin

- `package.json`
  - kok seviye `dev`, `build`, `lint`, `typecheck`, `test`
- `turbo.json`
  - workspace task bagimliliklari
- `pnpm-workspace.yaml`
  - `apps/*` ve `packages/*`

### 3.2 Uygulamalar

- `apps/server`
  - Fastify + WebSocket backend
- `apps/web`
  - React + Vite SPA istemcisi

- `apps/desktop-agent`
  - secure desktop bridge/runtime foundation
  - bugunku snapshot'ta user-facing desktop app shell degil, local handshake + execute/result dongusu ve screenshot capability zemini

### 3.3 Paylasilan paketler

- `packages/types`
  - sistemin omurgasi olan runtime ve transport tipleri
- `packages/db`
  - Drizzle schema ve DB baglanti yardimcilari
- `packages/utils`
  - paylasilan yardimcilar

## 4. Paylasilan tip kontratlari

Runa'da modul sinirlari once `packages/types` ile cizilir.
Backend, frontend ve persistence katmanlari ayni dili buradan konusur.

### 4.1 Gateway kontrati

Dosya: `packages/types/src/gateway.ts`

Ana tipler:

- `ModelGateway`
  - `generate(request): Promise<ModelResponse>`
  - `stream(request): AsyncIterable<ModelStreamChunk>`
- `ModelRequest`
  - `messages`
  - `available_tools`
  - `compiled_context`
  - `model`
  - `temperature`
  - `max_output_tokens`
- `ModelResponse`
  - `provider`
  - `model`
  - `message`
  - `finish_reason`
  - opsiyonel `tool_call_candidate`
  - opsiyonel `usage`

Bu kontrat sayesinde runtime provider'a dogrudan degil, interface'e baglidir.

### 4.2 Tool kontrati

Dosya: `packages/types/src/tools.ts`

Ana tipler:

- `ToolDefinition`
  - `name`
  - `description`
  - `metadata`
  - `callable_schema`
  - `execute(input, context)`
- `ToolMetadata`
  - `capability_class`
  - `requires_approval`
  - `risk_level`
  - `side_effect_level`
- `ToolRegistryLike`
  - `register`, `get`, `list`, `has`

Bu kontrat, tool'larin registry uzerinden modellenmesini zorunlu kilar.

### 4.3 Runtime event kontrati

Dosya: `packages/types/src/events.ts`

Ana event aileleri:

- `run.started`
- `state.entered`
- `model.completed`
- `run.completed`
- `run.failed`
- `tool.call.started`
- `tool.call.completed`
- `tool.call.failed`
- `approval.requested`
- `approval.resolved`

Tum event'ler `EventEnvelope` formatindadir ve `run_id`, `trace_id`, `timestamp`, `event_type`, `payload` tasir.

### 4.4 Runtime state kontrati

Dosya: `packages/types/src/state.ts`

State'ler:

- `INIT`
- `MODEL_THINKING`
- `WAITING_APPROVAL`
- `TOOL_EXECUTING`
- `TOOL_RESULT_INGESTING`
- `COMPLETED`
- `FAILED`

Gecisler typed ve sinirlidir; keyfi `if/else` zinciri beklenmez.

### 4.5 Presentation kontrati

Dosya: `packages/types/src/blocks.ts`

Ana render block tipleri:

- `text`
- `status`
- `event_list`
- `tool_result`
- `code_block`
- `diff_block`
- `search_result_block`
- `web_search_result_block`
- `workspace_inspection_block`
- `run_timeline_block`
- `trace_debug_block`
- `approval_block`
- `inspection_detail_block`

Frontend yalniz bu union tiplerini render eder.

### 4.6 Approval kontrati

Dosya: `packages/types/src/policy.ts`

Ana yapilar:

- `ApprovalRequest`
- `ApprovalDecision`
- `ApprovalResolution`

Status akisi:

- `pending`
- `approved`
- `rejected`
- `expired`
- `cancelled`

### 4.7 Memory kontrati

Dosya: `packages/types/src/memory.ts`

Ana yapilar:

- `MemoryRecord`
- `MemoryWriteCandidate`
- `UserPreferenceMemory`

Scope'lar:

- `user`
- `workspace`

Source kind'ler:

- `conversation`
- `tool_result`
- `user_explicit`
- `user_preference`
- `system_inferred`

### 4.8 WebSocket kontrati

Dosya: `packages/types/src/ws.ts`

Client mesajlari:

- `run.request`
- `approval.resolve`
- `inspection.request`

Server mesajlari:

- `connection.ready`
- `run.accepted`
- `runtime.event`
- `run.rejected`
- `presentation.blocks`
- `run.finished`

Not:

- `GatewayProvider` tipi bugun kod seviyesinde `groq | claude`
- resmi urun/readiness claim'i ise `Groq-only validated baseline`

## 5. Backend mimarisi

Backend `apps/server` altinda calisir.
Server tarafi Fastify uzerine kuruludur ve canli kullanimin ana giris noktasi WebSocket hattidir.

### 5.1 Server bootstrap

Temel dosyalar:

- `apps/server/src/index.ts`
- `apps/server/src/app.ts`
- `apps/server/src/routes/health.ts`
- `apps/server/src/ws/register-ws.ts`
- `apps/server/src/ws/transport.ts`
- `apps/server/src/ws/orchestration.ts`
- `apps/server/src/ws/presentation.ts`

Calisma sekli:

1. `index.ts`, `buildApp()` ile Fastify instance'i kurar
2. `app.ts`, `@fastify/websocket` kaydeder
3. `/health` route'u eklenir
4. `/ws` WebSocket route'u `registerWebsocketRoutes()` ile kaydedilir
5. Server varsayilan olarak `127.0.0.1:3000` uzerinde dinler

### 5.2 Canli workspace koku nasil belirlenir?

Canli request'lerde workspace kokunu `register-ws.ts` icindeki `getLiveWorkingDirectory()` belirler.
Bu fonksiyon bugun `process.cwd()` kullanir.

Bu ayrinti onemlidir:

- `apps/server/scripts/dev.mjs` server'i `apps/server` klasorunden calistirir
- bu nedenle canli dev oturumunda working directory pratikte cogu zaman `apps/server` olur
- sistem bugun repo kokunu otomatik kesfetmeye calismaz

Tool path kontrolu, workspace memory scope'u ve approval persistence bu working directory uzerinden hesaplanir.

### 5.3 WebSocket protokolu

Canli uygulama akisinda ana protokol WebSocket'tir.

Client -> server mesajlari:

- `run.request`
- `approval.resolve`
- `inspection.request`

Server -> client mesajlari:

- `connection.ready`
- `run.accepted`
- `runtime.event`
- `presentation.blocks`
- `run.finished`
- `run.rejected`

Socket acildiginda server once `connection.ready` gonderir.
Sonraki tum mesajlar runtime event'leri ve presentation block'lari etrafinda akar.

### 5.4 `run.request` uc uca nasil calisir?

Canli run akisinin composition root'u `apps/server/src/ws/register-ws.ts` olsa da asil sorumluluklar split dosyalara dagilmistir.
Bir `run.request` geldiginde pratik zincir su sekildedir:

1. `transport.ts` client payload'ini dogrular
2. `orchestration.ts` run kabul, context hazirlama ve dependency wiring isini kurar
3. `run-execution.ts` agent loop'u calistirir
4. runtime event'leri anlik `runtime.event` mesajlari olarak akar
5. incremental ve final `presentation.blocks` mesajlari uretilir
6. approval, persistence ve memory yazilari ilgili seams uzerinden kaydedilir
7. uygun terminal durumda `run.finished` gonderilir

Bu akisin kritik noktasi su:

- canli request artik tek bir `runModelTurn()` wrapper'ina indirgenmez
- loop davranisi stop conditions, permission engine ve auto-continue gate ile birlikte calisir
- approval ve tool-result sinirlari operator/policy baglamina gore duraklayabilir

### 5.5 Runtime state modeli

Runtime state davranisi `packages/types/src/state.ts` ve runtime fonksiyonlarina dagitilmistir.

Aktif durumlar:

- `INIT`
- `MODEL_THINKING`
- `WAITING_APPROVAL`
- `TOOL_EXECUTING`
- `TOOL_RESULT_INGESTING`
- `COMPLETED`
- `FAILED`

Bu state'ler presentation tarafinda da kullanilir; UI current run'i bu state/event kombine ozetinden anlar.

### 5.6 `runModelTurn()` gercekte ne yapar?

Ana dosya: `apps/server/src/runtime/run-model-turn.ts`

Bu fonksiyon bir model turunu asagidaki adimlarla yurutur:

1. state'i `MODEL_THINKING` olarak girer
2. provider uzerinden model yaniti alir
3. model text mi dondu, tool mu onerdi ayrimini yapar
4. text ise `COMPLETED` sonucuna gider
5. tool call candidate varsa tool-aware dispatch yoluna girer

Bu katmanda yardimci fonksiyonlar vardir:

- `run-model-step.ts`
- `run-with-provider.ts`
- `adapt-model-response-to-turn-outcome.ts`
- `model-tool-dispatch.ts`
- `continue-model-turn.ts`

`continue-model-turn.ts` dosyasi isim olarak dongu hissi verse de bugunku canli WS path'i recursive ajan dongusu sunmaz.
Canli path'te sonuc yine tek bir tur ciktisina indirgenir.

### 5.7 Model yaniti: metin mi tool mu?

Gateway katmani ortak `ModelResponse` dondurur.
Runtime bu yapiya bakarak iki temel yol secer:

- salt assistant mesaji
- tool call candidate

Tool ayrimi provider'a gore gateway adapter'inda normalize edilir:

- Groq adapter'i `tool_calls` alanindan okur
- Claude adapter'i `tool_use` alanindan okur

Runtime tarafi ise provider-ozel JSON yerine ortak `tool_call_candidate` alanina baglidir.

### 5.8 Tool dispatch akisi

Temel dosyalar:

- `apps/server/src/runtime/model-tool-dispatch.ts`
- `apps/server/src/runtime/run-tool-step.ts`
- `apps/server/src/runtime/bind-available-tools.ts`
- `apps/server/src/runtime/ingest-tool-result.ts`

Akis:

1. modelin istedigi tool registry'den bulunur
2. tool metadata'si okunur
3. approval gerekiyorsa approval akisi baslar
4. gerekmiyorsa tool `execute()` edilir
5. sonuc normalize edilir
6. tool sonucu event ve presentation block'larina beslenir

Tool calistiktan sonra devam davranisi artik policy ve auto-continue gate tarafindan belirlenir.
Varsayilan davranis ihtiyatlidir; yine de bugunku mimari "tek turden ibaret" olarak okunmamalidir.

### 5.9 Approval gate nasil calisir?

Temel dosyalar:

- `apps/server/src/runtime/request-approval.ts`
- `apps/server/src/runtime/resolve-approval.ts`
- `apps/server/src/runtime/resume-approved-tool-call.ts`
- `apps/server/src/persistence/approval-store.ts`

Akis:

1. riskli tool metadata'si `requires_approval: true` ise runtime `WAITING_APPROVAL` durumuna girer
2. `approval.requested` event'i uretilir
3. approval girdisi DB'ye kaydedilir
4. UI approval block'u uzerinden kullanici karari beklenir
5. client `approval.resolve` gonderir
6. server karari persist eder
7. karar `approved` ise pending tool tekrar oynatilir
8. replay sonucu tekrar modele degil, presentation block'larina baglanir

Onemli ayrinti:

- approval resolve path'i yalniz replay UI'si degildir; follow-up continuation karari mevcut policy ve loop sinirlariyla birlikte ele alinir
- approval sonucu current-run ve presentation yuzeylerine additive olarak yansitilir

### 5.10 `run.finished` her durumda gelir mi?

Hayir.

`register-ws.ts` icindeki `createFinishedMessage()` her sonuc icin `run.finished` uretmez.
Ozellikle su durumlarda `run.finished` gonderilmez:

- `approval_required`
- `TOOL_RESULT_INGESTING`

Bu da UI tarafinda "bitmis run" ile "ek operator karari veya inspection bekleyen run" ayrimini mumkun kilar.

### 5.11 Context katmani

Temel dosyalar:

- `apps/server/src/context/compose-context.ts`
- `apps/server/src/context/compose-workspace-context.ts`
- `apps/server/src/context/compose-memory-context.ts`
- `apps/server/src/context/orchestrate-memory-read.ts`
- `apps/server/src/context/build-memory-prompt-layer.ts`
- `apps/server/src/context/adapt-context-to-model-request.ts`
- `apps/server/src/context/compiled-context-text.ts`

Context katmani birden fazla layer'i birlestirir:

- `core_rules`
- `run_layer`
- opsiyonel `workspace_layer`
- opsiyonel `memory_layer`

#### Workspace context

`composeWorkspaceContext()` bugun hafif ve deterministic bir ozet toplar.
Koddan gorulen temel kaynaklar:

- `package.json`
- `README.md`
- ust seviye klasor girdileri

Bu katman amac olarak tam repo indekslemesi degil, canli tur oncesi hizli baglam kurulumudur.

#### Memory context

`orchestrateMemoryRead()` memory store'dan aktif kayitlari okur.
`buildMemoryPromptLayer()` bunlari modele yardimci baglam olarak sunar.

Bu memory prompt katmaninin onemli tonu sudur:

- memory sert talimat gibi degil, yardimci arka plan bilgisi gibi yazilir
- prompt sisirmemek icin normalize ve truncate edilir

#### Compiled context

`compiled-context-text.ts` tum katmanlari stabil bir text artefact'ina cevirir.
Bu artefact:

- provider request'ine eklenir
- `char_count / 4` yaklasimi ile kaba token tahmini tutar
- layer adlarini ve tiplerini korur

### 5.12 Memory sistemi bugun nasil calisiyor?

Memory ile ilgili tipler `packages/types` altindadir, fakat somut mantik bugun farkli katmanlara dagilmistir.
`apps/server/src/memory` klasorunde henuz somut TS implementasyonlari yoktur; bu klasor daha cok moduler hedefi temsil eder.

Canli memory read akisi `register-ws.ts` uzerinden iki scope ile calisir:

- `user` scope id: `local_default_user`
- `workspace` scope id: current working directory

Write akisi `persistLiveMemoryWrite()` icinde yapilir.
Bu write yalniz su kosullarda denenir:

- run failed degilse
- son user mesaji bos degilse

Memory adayi secimi su yardimcilarla yapilir:

- `build-memory-write-candidate.ts`
- `select-memory-candidate.ts`
- `refine-memory-lifecycle.ts`

Bugunku memory davranisinin ozeti:

- kural tabanli cikarim vardir
- kullanici tercihi ve workspace baglami kaydedilebilir
- duplicate ve generic adaylar elenir
- onceki kayit supersede edilebilir

Bugun olmayanlar:

- semantic retrieval
- embedding tabanli arama
- vector DB / Qdrant
- uzun planlama icin agentic episodic memory sistemi

### 5.13 Gateway / provider katmani

Temel dosyalar:

- `apps/server/src/gateway/factory.ts`
- `apps/server/src/gateway/groq-gateway.ts`
- `apps/server/src/gateway/claude-gateway.ts`
- `apps/server/src/gateway/provider-http.ts`
- `apps/server/src/gateway/request-tools.ts`

`createModelGateway()` bugun provider secimine gore adapter olusturur.
Kod seviyesi provider secenekleri:

- `groq`
- `claude`

Fakat resmi urun/readiness claim'i daha dardir ve Groq-first cizgidedir.
Bu katman bugun Vercel AI SDK adapter zinciri degil, provider API'lerine dogrudan `fetch` ile giden custom HTTP adapter'lar kullanir.

#### Groq adapter'i

`groq-gateway.ts` su sekilde calisir:

- endpoint: `https://api.groq.com/openai/v1/chat/completions`
- compiled context'i `system` mesaji olarak ekler
- available tool'lari OpenAI uyumlu `tools` dizisine cevirir
- tool call candidate'i `tool_calls` alanindan normalize eder

#### Claude adapter'i

`claude-gateway.ts` su sekilde calisir:

- endpoint: `https://api.anthropic.com/v1/messages`
- system / compiled context katmanlarini tek system string'inde toplar
- tool call candidate'i `tool_use` alanindan normalize eder

#### Ortak sinir

Her iki adapter icin de `stream()` bugun implement edilmemistir.
Canli akista temel yol request/response `generate()` davranisidir.

### 5.14 Tool sistemi

Tool registry ve built-in tool'lar `apps/server/src/tools` altindadir.
Canli WS path'te kaydedilen temel tool seti sunlardir:

- `file.read`
- `file.write`
- `file.list`
- `search.codebase`
- `search.grep`
- `web.search`
- `shell.exec`
- `git.status`
- `git.diff`
- `edit.patch`

#### Tool registry

Ana dosya: `apps/server/src/tools/registry.ts`

Runtime, modelin istedigi tool'u bu registry uzerinden bulur.
Bu sayede tool implementasyonu ile runtime dispatch mantigi gevsek bagli kalir.

#### Built-in tool siniflari

Okuma/arama odakli tool'lar:

- `file-read.ts`
- `file-list.ts`
- `search-codebase.ts`
- `search-grep.ts`
- `git-status.ts`
- `git-diff.ts`
- `web-search.ts`

Yazma / execute odakli tool'lar:

- `file-write.ts`
- `shell-exec.ts`
- `edit-patch.ts`

#### Risk profili

Kod seviyesinde gorulen genel ayrim su sekildedir:

- read-only dusuk risk tool'lar genelde approval istemez
- write / execute etkili tool'lar approval ister

Ozellikle:

- `file.write`: medium / write / approval gerekli
- `shell.exec`: high / execute / approval gerekli
- `edit.patch`: repoya degisim uygulayan yazma etkili tool

#### Web search tool'u

`web-search.ts` public web sorgusu icin Serper tabanli bir tool'dur.
Gereken env:

- `SERPER_API_KEY`

Bu tool varsayilan olarak local code search'in yerine gecmez.
Presentation katmaninda local/public kaynak ayrimi notu sertlestirilir.

#### Idempotency

`tool-idempotency.ts` bugun SHA-256 tabanli anahtarlar ve varsayilan in-memory store kullanir.
Bu, ayni yan etkili tool talebinin tekrar edilmesini azaltmaya yarar.

### 5.15 Persistence ve veritabani

Kalici veri yapisi `packages/db` ve `apps/server/src/persistence` altindadir.

Temel schema dosyasi:

- `packages/db/src/schema.ts`

Ana tablolar:

- `runs`
- `runtime_events`
- `tool_calls`
- `approvals`
- `memories`

Baglanti yardimcilari:

- `packages/db/src/client.ts`

Server persistence katmani:

- `apps/server/src/persistence/run-store.ts`
- `apps/server/src/persistence/event-store.ts`
- `apps/server/src/persistence/approval-store.ts`
- `apps/server/src/persistence/memory-store.ts`

Bu katmanlar `DATABASE_URL` bekler.

Onemli teknik sonuc:

- canli WS yolu bugun efektif olarak DB-backed persistence varsayar
- cunku request tamamlandiktan sonra event persistence zinciri kosulsuz calistirilir
- `DATABASE_URL` yoksa model yaniti uretilmis olsa bile run server tarafinda reject/fail olur

Yani DB bugun opsiyonel bir analytics eklentisi degil, live runtime akisinin pratik bagimliliklarindan biridir.

### 5.16 Presentation sistemi

Presentation katmani runtime event'lerini ve tool ciktilarini UI'nin okuyacagi render block'lara cevirir.

Temel dosyalar:

- `map-runtime-events.ts`
- `map-tool-result.ts`
- `map-code-result.ts`
- `map-diff-result.ts`
- `map-search-result.ts`
- `map-web-search-result.ts`
- `map-run-timeline.ts`
- `map-workspace-inspection.ts`
- `map-trace-debug.ts`
- `map-inspection-detail.ts`
- `map-approval-result.ts`
- `harden-search-routing-notes.ts`

Bu katmanin gorevi ham runtime ciktisini birebir UI'ye akitmak degil, onu okunabilir bloklara donusturmektir.

#### Temel bloklar

- `status`
- `text`
- `event_list`

#### Tool sonuc bloklari

- genel `tool_result`
- kod odakli preview
- diff preview
- local search sonucu
- web search sonucu

#### Inspection bloklari

- workspace inspection
- run timeline
- trace debug
- inspection detail

`map-inspection-detail.ts` yeni veri uretmez.
Daha once uretilmis event ve block'lar uzerinden detay kartlari cikarir.

#### Search routing notlari

`harden-search-routing-notes.ts` ayni run icinde hem local search hem web search gorulurse su ayrimi aciklastirir:

- local truth ile public web ayni sey degildir
- kaynak catismasi olabilir
- local/public ayrimi operator ve kullanici tarafinda gorulebilir olmalidir

## 6. Frontend mimarisi

Frontend `apps/web` altinda React + Vite SPA olarak calisir.
Sprint 10 sonrasi sorumluluklar page / shell / hook / lib sinirlarina dagitilmistir.

### 6.1 Boot ve dev server

Temel dosyalar:

- `apps/web/src/main.tsx`
- `apps/web/vite.config.ts`

`main.tsx` yalnizca `<App />` mount eder.
Vite dev server varsayilan olarak `127.0.0.1:5173` uzerindedir.

Proxy davranisi:

- `/ws` istegi `ws://127.0.0.1:3000` backend'ine proxy edilir

Bu nedenle local dev senaryosunda frontend ve backend ayri process'ler olsa da tek uygulama gibi gorunur.

### 6.2 WebSocket client

Temel dosya:

- `apps/web/src/lib/ws-client.ts`

Bu katman:

- WebSocket URL olusturur
- outgoing message builder'lari saglar
- server mesajlarinin sekil dogrulamasini yapar

`createWebSocketUrl()` mevcut host + `/ws` mantigini kullanir.
Boylece istemci environment'a gore ayri URL hardcode etmez.

### 6.3 Client-side message validation

`ws-client.ts` server'dan gelen mesajlari runtime seviyesinde kontrol eder.
Ozellikle render block payload'lari sekil olarak filtrelenir.

Bu sayede UI:

- bilinmeyen mesaj tipini sessizce kabul etmez
- beklenmeyen payload ile state'i bozmaz

### 6.4 UI composition modeli

Guncel ana dosyalar:

- `apps/web/src/App.tsx`
- `apps/web/src/components/app/AppShell.tsx`
- `apps/web/src/hooks/useAuth.ts`
- `apps/web/src/hooks/useChatRuntime.ts`
- `apps/web/src/pages/LoginPage.tsx`
- `apps/web/src/pages/ChatPage.tsx`
- `apps/web/src/pages/DashboardPage.tsx`
- `apps/web/src/pages/SettingsPage.tsx`

Sorumluluk dagilimi:

- `App.tsx`: auth gate ve router composition root
- `useAuth.ts`: auth bootstrap, login/signup/logout ve token seams
- `AppShell.tsx`: authenticated layout ve nav shell
- `useChatRuntime.ts`: websocket lifecycle, run submit, approval resolve, inspection request ve presentation surface orchestration
- `ChatPage.tsx`: composition ve render sahibi

### 6.5 UI yuzey hiyerarsisi

Mevcut UI, Sprint 6 sonrasi daha demo-safe hale getirilmistir ama hala kokunde operator/presentation odakli bir SPA'dir.

Manifesto uyari notu:

- Asagidaki bolum bugunku kodu tarif eder; hedef urun yuzunu onaylamaz.
- `advanced operator controls`, `Transport Messages` ve benzeri alanlar bugun repoda bulunmasi nedeniyle anlatilir.
- Bunlar sonraki UI islerinde ana chat ekraninda kalici urun kurali olarak ele alinmamalidir.

Gorulen ana bolumler:

1. hero / stance panel
2. run form
3. resmi demo stance banner'i
4. `advanced operator controls`
5. `Live Demo Surface`
6. `Recent session runs`
7. `Transport Messages`

#### Hero ve stance

UI ustunde acikca gorulen metinler:

- `SPRINT 6 DEMO`
- `Runa Groq-Only MVP Surface`

Bu, bugunku urun claim'inin teknik yuzde de saklanmadigini gosterir.

#### Operator controls

`showOperatorControls` toggle'i ile acilan ikincil bolum sunlari barindirir:

- provider secimi
- model override
- presentation bridge secenegi

Bu yuzey birincil urun akisindan ziyade operator/debug odaklidir.
Yeni baglayici manifesto ise bu tur kontrollerin ana chat yuzeyinden ayrilmasini ve yalniz ikinci katmanda acilmasini ister.

#### Current run / live surface

`Live Demo Surface`, o anki run icin ana yuzeydir.
Presentation block'lari, ozetler ve detail kartlari burada okunur.

#### Recent runs ve transport

- `showRecentSessionRuns`: gecmis run'lari ikincil gorunumde acar
- `showTransportMessages`: ham server mesajlarini operator gorunumu olarak acar

Bu iki alan varsayilan birincil kullanici akisina degil, inspection ve demo ihtiyacina hizmet eder.
Bu nedenle bugunku teknik snapshot ile hedef urun/UI manifestosu ayni sey degildir.

### 6.6 UI'dan run akisi nasil baslar?

`App.tsx` icindeki `handleSubmit()` kullanici prompt'unu alir ve bir `RunRequestPayload` uretir.
Bu payload'in pratik ozellikleri:

- tek user mesajiyla baslar
- `provider_config.apiKey` formdan gelir
- `model` form state'inden gelir
- `max_output_tokens: 256` olarak set edilir

Submit yalnizca WebSocket aciksa gonderilir.

Run basladiginda UI:

- local bekleme state'i kurar
- beklenen presentation run id'sini resetler
- server mesajlarini `messages` koleksiyonuna alir
- gelen `presentation.blocks` ile run surface uzerinde ozet gorunum kurar

Not:

- `messages` daha cok server'dan gelen transport akisidir
- outgoing client payload'lari ayni log'a birebir eklenmez

### 6.7 Inspection detail akisi

Client, `inspection.request` ile daha once saklanmis bir run icin detail isteyebilir.
Bu akis yeni model cagrisi yapmaz.

Server tarafinda:

- her socket icin bir `WeakMap` store vardir
- her socket'te en fazla `6` run inspection baglami tutulur

Inspection detail bu saklanan run baglamindan turetilir:

- event'ler
- mevcut block'lar
- workspace layer ozeti

Bu sayede detay acmak, canli runtime'i tekrar calistirmadan olur.

### 6.8 Frontend'in bugunku teknik sinirlari

Koddan gorulen sinirlar:

- user-facing desktop app surface'i yoktur
- UI halen inline-style agirlikli ve daha ileri design-system katmanina tasinmamistir
- operator/detail yuzeyleri tamamen kaybolmus degildir; premium consumer polish tamamlanmamis durumdadir
- ana chat deneyimi manifesto ile tam hizali hale gelmemistir; operator/debug yuzeylerinin izolasyonu halen eksiktir
- web tarafinda online device presence surface'i ve daha genis desktop capabilities yoktur

## 7. Validation, rehearsal ve smoke scriptleri

Server tarafinda release/readiness icin birkac script vardir.

### 7.1 Groq live smoke

Dosya:

- `apps/server/scripts/groq-live-smoke.mjs`

Amac:

- Groq icin authoritative canli smoke otoritesi olmak

Authority:

- API key env: `GROQ_API_KEY`
- model env: `GROQ_MODEL`
- varsayilan model: `llama-3.3-70b-versatile`

Stage'ler:

- `assistant_roundtrip`
- `tool_schema_roundtrip`

### 7.2 Groq demo rehearsal

Dosya:

- `apps/server/scripts/groq-demo-rehearsal.mjs`

Amac:

- demo oncesi proof zincirini tek komutta toplamak

Bu script esasen sunlari bir araya getirir:

- formal repeatability
- core coverage capture

### 7.3 Formal repeatability

Dosya:

- `apps/server/scripts/formal-demo-repeatability.mjs`

Amac:

- belirli bir WS test senaryosunu arka arkaya coklu kez kosup deterministik davranis kontrolu yapmak

Kod seviyesi akis:

1. TypeScript compile
2. test fixture kopyalama
3. secili WS testini birden fazla kez kosturma

### 7.4 Core coverage capture

Dosya:

- `apps/server/scripts/capture-core-coverage.mjs`

Amac:

- runtime, context, tools, presentation ve ws alanlarinda davranis dosyalarinin test eslesmesini toplamak

Bu script klasik statement coverage yerine "aktif cekirdek dosya - kardes test dosyasi" mantiginda kanit toplar.

## 8. Mevcut teknik sinirlar ve bilerek eksik birakilan alanlar

Asagidaki maddeler koddan acikca gorulen bugunku sinirlardir:

- canli runtime recursive multi-step ajan dongusu degildir
- tool sonucu ayni request icinde otomatik ikinci model turu acmaz
- approval replay otomatik ikinci model turune donmez
- provider adapter'larinda `stream()` implement degildir
- live path DB persistence'e pratik olarak baglidir
- semantic retrieval / vector memory yoktur
- consumer-grade auth, tenancy ve profile modeli yoktur
- UI hala inspection/operator agirliklidir
- kod seviyesi provider enum'u `groq | claude` iken resmi urun/readiness claim'i daha dardir

Bu sinirlarin bir kismi bilerek birakilmis post-MVP alanlardir; belge bunlari bugun varmis gibi anlatmaz.

## 9. Bir alani degistireceksem nereye bakarim?

### 9.1 Yeni provider ekleyeceksem

- `packages/types/src/gateway.ts`
- `apps/server/src/gateway/*.ts`
- `apps/server/src/gateway/factory.ts`
- smoke script authority belgeleri

### 9.2 Yeni tool ekleyeceksem

- `packages/types/src/tools.ts`
- `apps/server/src/tools/`
- `apps/server/src/tools/registry.ts`
- ilgili presentation mapper gerekirse `apps/server/src/presentation/`

### 9.3 Yeni render block ekleyeceksem

- `packages/types/src/blocks.ts`
- `apps/server/src/presentation/`
- `apps/web/src/App.tsx` veya ilgili renderer alani

### 9.4 Context veya memory davranisini degistireceksem

- `apps/server/src/context/`
- `apps/server/src/runtime/build-memory-write-candidate.ts`
- `apps/server/src/runtime/select-memory-candidate.ts`
- `apps/server/src/runtime/refine-memory-lifecycle.ts`
- `apps/server/src/persistence/memory-store.ts`

### 9.5 Approval veya risk davranisini degistireceksem

- tool metadata'lari
- `apps/server/src/runtime/request-approval.ts`
- `apps/server/src/runtime/resolve-approval.ts`
- `apps/server/src/runtime/resume-approved-tool-call.ts`
- `apps/server/src/persistence/approval-store.ts`

### 9.6 UI akisini degistireceksem

- `apps/web/src/App.tsx`
- `apps/web/src/lib/ws-client.ts`
- `packages/types/src/ws.ts`
- `packages/types/src/blocks.ts`

## 10. Aktif dosya haritasi

### 10.1 Server cekirdegi

- `apps/server/src/app.ts`
- `apps/server/src/index.ts`
- `apps/server/src/ws/register-ws.ts`

### 10.2 Runtime

- `apps/server/src/runtime/*.ts`

Bu klasor model turu, tool dispatch, approval, memory write ve state gecis davranislarini tasir.

### 10.3 Context

- `apps/server/src/context/*.ts`

Bu klasor workspace + memory + run layer birlesimini modele hazirlar.

### 10.4 Gateway

- `apps/server/src/gateway/*.ts`

Bu klasor provider adapter'larini ve ortak request normalize katmanini tasir.

### 10.5 Tools

- `apps/server/src/tools/*.ts`

Bu klasor built-in local tools'u ve registry'yi tasir.

### 10.6 Presentation

- `apps/server/src/presentation/*.ts`

Bu klasor runtime event'lerini ve tool sonuclarini UI block'larina cevirir.

### 10.7 Persistence

- `apps/server/src/persistence/*.ts`
- `packages/db/src/*.ts`

Bu alan run/event/approval/memory verilerini kalici hale getirir.

### 10.8 Hedef ama henuz ince modul kalan alanlar

- `apps/server/src/memory/`
- `apps/server/src/policy/`

Bu klasorler repo icinde bulunur, ancak bugun somut davranisin buyuk kismi buralarda degil runtime/context/persistence tarafina dagilmistir.
Yani klasor varligi, o modulun tamamen ayrik ve dolu bir implementasyona sahip oldugu anlamina gelmez.

### 10.9 Frontend

- `apps/web/src/App.tsx`
- `apps/web/src/components/app/AppShell.tsx`
- `apps/web/src/hooks/useAuth.ts`
- `apps/web/src/hooks/useChatRuntime.ts`
- `apps/web/src/pages/*.tsx`
- `apps/web/src/lib/ws-client.ts`
- `apps/web/src/lib/chat-runtime/*.ts`
- `apps/web/src/ws-types.ts`

### 10.10 Shared contracts

- `packages/types/src/*.ts`

Bu klasor tum sistemin dilini belirler; modul sinirlari once burada cizilir.

## 11. Kisa teknik sonuc

Runa'nin bugunku teknik gercegi sunudur:

- monorepo icinde calisan bir Fastify + WebSocket backend ve React SPA frontend vardir
- backend, context + memory + provider gateway + tool dispatch + approval + persistence + presentation zinciri kurar
- frontend bu zincirin sonucunu auth-aware shell, current-run surface ve operator/detail gorunumleri olarak gosterir
- sistem Core Hardening snapshot'indadir; Sprint 9/10 sonrasi loop, WS split ve UI split repoda, `apps/desktop-agent` secure bridge/runtime foundation'i de mevcuttur; ancak tam desktop app shell ve online device presence henuz yoktur
- Groq canli smoke ile dogrulanmis ana development/readiness provider cizgisidir

Bu belgeyi okuyan bir LLM veya gelistirici, kodu acmadan once su resmi gormelidir:

- Runa'nin cekirdek modulleri nelerdir
- bu moduller arasi veri ve kontrol akisi nasil ilerler
- bugun ne calisiyor
- bugun hangi sinirlar bilincli olarak vardir
- bir degisiklik yaparken hangi dosya ve interface setine bakmak gerekir
