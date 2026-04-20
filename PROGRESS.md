# Runa - Operasyonel Durum Kaydi

> Bu belge, Runa projesinin kronolojik ilerleyisini ve yonunu kaydeder.
> Detaylar, kararlar ve teknik debt buraya listelenir.
> Sprint 1-6 (MVP Phase 1) detaylari icin bkz: `docs/archive/progress-phase1.md`
> Ekip kararlari icin bkz: `docs/archive/cevap-ekip-kararlari.md`

## Mevcut Durum Ozeti

- **Tarih:** 19 Nisan 2026
- **Faz:** Core Hardening (Phase 2) - Sprint 9/10 kabul edilmis isleri repoda, acik ana gap'ler GAP-11 ve GAP-12
- **Vizyon:** Basit kullanicidan teknik uzmana kadar herkesin kullanabilecegi, otonom ve uzaktan kontrol yeteneklerine sahip, cloud-first bir AI calisma ortagi.
- **Odak:** Kapanan audit gap'leri sonrasi kalan hardening, docs/onboarding senkronizasyonu ve desktop-agent oncesi net backlog ayrimi.
- **Son Onemli Olay:** 2026-04-19 tarihinde ust seviye UI/UX manifesto belgelere baglayici cerceve olarak eklendi; chat-first consumer surface, Developer Mode izolasyonu ve natural-language-first presentation sonraki planlama icin netlestirildi.

### Track A / GAP-11 - Browser + Real Provider Approval Authority Check - 21 Nisan 2026

- `apps/server/scripts/approval-browser-authority-check.mjs` eklendi ve `apps/server/package.json` icine `test:approval-browser-authority-check` komutu baglandi; harness built server + Vite dev + headless Edge CDP uzerinden gercek tarayici akisini koşturuyor.
- Script local dev auth bootstrap'i tarayici icinden baslatiyor, `runa.developer.runtime_config` localStorage kaydina gercek provider config'ini yaziyor, exact browser `run.request` payload shape'ini WebSocket monkey-patch log'u ile yakaliyor ve ayni sayfa uzerinden approval butonuna tiklayarak continuation zincirini takip ediyor.
- Authority sonucu PASS: browser tarafinda `run.request -> auto-continue approval boundary -> approval.resolve -> continuation -> run.finished(COMPLETED)` zinciri gercek provider ile gecti. Yakalanan browser WS log'unda `run_request_provider=groq`, runtime config model'i `llama-3.3-70b-versatile`, approval kimligi `run_*:approval:auto-continue:1` ve terminal `run.finished(COMPLETED)` net goruldu.
- Env durumu durust ayrildi: mevcut shell'de `GROQ_API_KEY` yoktu; authority check file-backed env uzerinden gercek Groq key ile kosuldu. Summary bunu `groq_api_key_source=file_backed_env` olarak raporluyor.
- Dogrulama: `pnpm.cmd --filter @runa/server exec tsc --noEmit`, `pnpm.cmd --filter @runa/server lint` yesil. Authority komutu kontrollu process polling ile `EXIT_CODE=0` ve `APPROVAL_BROWSER_AUTHORITY_SUMMARY.result=PASS` verdi.
- Durust kalan not: bu gorev browser + gercek provider authority'sini kapatiyor; restart/reconnect proof ayri `approval-persistence-live-smoke` harness'inde kalmaya devam ediyor. Iki kanitin birlestirilmesi istenirse ileride tek super-rehearsal turu dusunulebilir.
- Sonraki onerilen gorev: `provider_config` persistence minimization icin dar bir security-hardening turu acmak veya isterse authority smoke ile restart smoke'u tek raporda birlestiren kompakt bir release-rehearsal helper yazmak.

### Track A / GAP-11 - Approval Persistence Restart-Reconnect Live Smoke - 21 Nisan 2026

- `apps/server/scripts/approval-persistence-live-smoke.mjs` ve `approval-persistence-live-smoke-server.mjs` eklendi; focused smoke artik gercek local DB + gercek Fastify/WebSocket server uzerinde iki ayri process turuyle pending approval replay ve auto-continue replay zincirini dogrulayabiliyor.
- Smoke harness local dev auth token ile authenticated `/ws` baglantisi kuruyor, ilk process'te approval boundary uretiyor, server'i tamamen kapatip ikinci process'te `approval.resolve` gonderiyor; boylece proof ayni Node process icinde sahte "restart" degil, process-memory sifirlanmis restart/reconnect akisi oluyor.
- Kapsanan iki senaryo: normal `file.write` approval replay'i restart sonrasi persisted approval kaydindan yeniden oynatiyor; `file.read` -> auto-continue approval senaryosu ise persisted `continuation_context` ile ikinci process'te continuation'a donup `run.finished(COMPLETED)` ve `runs.current_state=COMPLETED` uretiyor.
- Dar harness dersi: policy state persistence'i smoke seanslari arasinda yan etki yaratmasin diye script artik unique `session_id` ile local dev token uretip `policy_states` kaydini cleanup ediyor; aksi halde eski progressive-trust state'i auto-continue approval boundary'sini gizleyebiliyordu.
- Dogrulama: `pnpm.cmd --filter @runa/server run test:approval-persistence-live-smoke`, `pnpm.cmd --filter @runa/server lint`, `pnpm.cmd --filter @runa/server exec tsc --noEmit`, `pnpm.cmd --filter @runa/db exec tsc --noEmit` yesil.
- Durust kalan not: bu harness provider tarafini gercek network yerine deterministic process-local fetch stub ile sabitliyor; kanitlanan alan persistence/restart/WS zinciri, provider canliligi veya browser UI degil.
- Sonraki onerilen gorev: istenirse bu smoke'u CI-uygun hale getirmek icin log/token'lari biraz daha kompaktlastirip failure summary'sine daha dar DB snapshot ipuclari eklemek.

### Track A / GAP-11 - Approval Persistence + Auto-Continue Context Hardening - 21 Nisan 2026

- `apps/server/src/persistence/approval-store.ts` ve `packages/db/src/schema.ts` uzerinden approval kaydina `continuation_context` persistence seam'i eklendi; auto-continue approval'lari artik follow-up turn icin gereken `RunRequestPayload + tool_result + turn_count + working_directory` baglamini process-disina yazabiliyor.
- `apps/server/src/ws/run-execution.ts` icindeki socket-WeakMap auto-continue cache'i kaldirildi; `approval.resolve` sonrasi continuation persisted approval context'ten resume ediliyor. Boylece reconnect/new socket uzerinden approval verildiginde ayni run zinciri devam edebiliyor.
- `apps/server/src/ws/policy-wiring.ts` icindeki approval-decision WeakMap bagimliligi kaldirildi; resolve zamani karar, persisted approval metadata + mevcut tool definition uzerinden deterministic fallback ile yeniden kuruluyor.
- Hedefli dogrulama: `pnpm.cmd --filter @runa/db exec vitest run src/schema.test.ts`, `pnpm.cmd exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/persistence/approval-store.test.ts src/ws/policy-wiring.test.ts src/ws/register-ws.test.ts` (`apps/server` cwd), `pnpm.cmd --filter @runa/server exec tsc --noEmit`, `pnpm.cmd --filter @runa/db exec tsc --noEmit`, `pnpm.cmd --filter @runa/server lint` yesil.
- Durust kalan not: auto-continue resume icin `provider_config` approval continuation context'i icinde persist ediliyor; bu, browser-supplied runtime config ile reconnect sonrasi continuation'i koruyor ama secret persistence minimizasyonu istenirse ayri bir security-hardening gorevi olarak tekrar ele alinmali.
- Sonraki onerilen gorev: ayni persistence cizgisiyle approval/policy state restart davranisini local DB + gercek server uzerinde focused live smoke script'i ile kalicilastirmak.

### Dokumantasyon / UI-UX Manifesto Hizalamasi - 19 Nisan 2026

- `AGENTS.md`, `README.md`, `implementation-blueprint.md`, `docs/post-mvp-strategy.md`, `docs/technical-architecture.md` ve `docs/AI-DEVELOPMENT-GUIDE.md` yeni UI/UX manifesto cizgisine gore dar kapsamda guncellendi.
- Baglayici cerceve netlestirildi: dashboard-first gidilmeyecek; ana urun hissi chat-first, mobil-oncelikli, natural-language-first bir calisma ortagi olacak; operator/dev-ops yuzeyleri ana chat ekranindan ayrilacak ve `Developer Mode` benzeri izole ikinci katmana ait olacak.
- Durust sinir kaydi korundu: bugunku repo halen onceki operator/demo agirlikli surface'ler ve `DashboardPage`/`SettingsPage` gibi gecis izleri tasiyor; bu kayit yapilmamis UI polish'i yapilmis gibi claim etmez.
- Kod davranisi degismedi; bu kayit yalniz belge ve planlama cercevesi guncellemesidir.

### Track C / Sprint 10.6 - Premium UI Foundation + Developer Mode Isolation - 20 Nisan 2026

- `apps/web/src/index.css` eklendi ve `apps/web/src/main.tsx` uzerinden baglandi; global reset, focus-visible a11y stili, premium slate + amber/gold palette ve `Inter` / `Outfit` font temeli kuruldu. `apps/web/index.html` Google Fonts preconnect + stylesheet ile guncellendi.
- `apps/web/src/hooks/useDeveloperMode.ts` eklendi; `runa_dev_mode` localStorage anahtari uzerinden tarayici-bazli kalici Developer Mode state'i saglandi.
- `apps/web/src/components/app/AppNav.tsx` chat-first navigation mantigina cekildi; Developer Mode toggle nav icine tasindi ve developer route linki varsayilan yuzden saklanip yalniz Developer Mode acikken veya aktif sayfada gorunur hale geldi.
- `apps/web/src/pages/ChatPage.tsx` sade/premium bir sohbet kompozisyonuna guncellendi; composer ve aktif sohbet akisi birincil katmanda tutuldu, `RunTimelinePanel` varsayilan gorunumden cikarilip sadece Developer Mode acikken ikinci katmanda render edildi.
- Teknik izolasyonun URL bypass ile delinmemesi icin `apps/web/src/pages/DashboardPage.tsx` dar kapsamda gate'lendi; `OperatorControlsPanel` ve `TransportMessagesPanel` de yalniz Developer Mode acikken gorunur kaldı.
- Dogrulama: `pnpm.cmd --filter @runa/web typecheck`, `pnpm.cmd --filter @runa/web lint`, `pnpm.cmd --filter @runa/web build` ve repo-seviyesi `pnpm.cmd typecheck` yesil.
- Durust not: repo-seviyesi `pnpm.cmd lint` bu gorevin disindaki onceden var olan Biome format farklari nedeniyle kiriliyor (`apps/server/scripts/groq-live-smoke.mjs`, `apps/server/src/ws/live-request.ts`, `apps/server/src/ws/run-execution.ts`, `apps/server/src/ws/register-ws.test.ts`).
- Sonraki onerilen gorev: yeni premium temel uzerine `AppShell`, `SettingsPage` ve login/auth yuzeylerini ayni tasarim diline tasiyan dar bir Track C polish turu.

### Track C / Sprint 10.6 - Premium UI Refactor Asama 2 (Component Polishing + Decomposition) - 20 Nisan 2026

- `apps/web/src/pages/ChatPage.tsx` buyuk olcude sadeleştirildi ve 462 satira indirildi; presentation orchestration ve run-surface rendering yukunun ana kismi yeni `apps/web/src/components/chat/chat-presentation.tsx` ve `apps/web/src/components/chat/PresentationRunSurfaceCard.tsx` dosyalarina tasindi.
- `apps/web/src/components/approval/ApprovalSummaryCard.tsx` ve `ApprovalPanel.tsx` premium glassmorphism cizgisine cekildi; onay yuzeyi daha sakin ama belirgin hale getirildi, kabul/red aksiyonlari hover-state destekli daha net CTA kartlarina donusturuldu.
- `apps/web/src/components/chat/PresentationBlockRenderer.tsx` ile `apps/web/src/lib/chat-styles.ts` uzerinde code/diff/web-search/tool-result yuzeyleri daha okunakli premium kartlara cekildi; paylasilan stil objeleri CSS variable tabanli renkler ve yumusak transition'larla sadeleştirildi.
- Yeni/polished kart yuzeylerine `opacity` / `transform` / `border-color` bazli yumusak gecisler eklendi; acilan run surface, approval ve presentation kartlari onceki sert gorunume gore daha akici his veriyor.
- Dogrulama: `pnpm.cmd --filter @runa/web typecheck`, `pnpm.cmd --filter @runa/web lint` ve `pnpm.cmd --filter @runa/web build` yesil.
- Sonraki onerilen gorev: ayni premium component dili ile `RunTimelinePanel`, `TransportMessagesPanel` ve account/auth yuzeylerini de ikinci katman / ana katman ayrimini bozmayacak sekilde hizalamak.

### Track C / Sprint 10.6 - Premium UI Refactor Asama 3 (Kalan Panellerin ve AppShell'in Glassmorphism Hizalamasi) - 20 Nisan 2026

- `apps/web/src/lib/chat-styles.ts` genisletildi; sayfa, hero, pill, secondary button, subcard ve empty-state varyantlari ortak premium slate/amber/glass dili icin yeniden kullanilabilir hale getirildi.
- `apps/web/src/components/app/AppShell.tsx` ve `AppNav.tsx` premium shell cizgisine cekildi; header/route kartlari daha yumusak glass katmanlari ve amber vurgu ile hizalandi, Developer Mode ikinci katman mantigi korunarak navigation daha sakinlestirildi.
- `apps/web/src/components/chat/RunTimelinePanel.tsx` ile `TransportMessagesPanel.tsx` teknik detaylari ikinci katmanda tutan ama premium kart/modul hissi veren surfaces'e guncellendi; raw transport ve timeline gorunumu daha okunakli, daha az operator-demo hissi veren kartlar halinde sunuluyor.
- `apps/web/src/pages/SettingsPage.tsx`, `apps/web/src/components/auth/ProfileCard.tsx`, `SessionCard.tsx`, `AuthModeTabs.tsx`, `OAuthButtons.tsx` ve `pages/LoginPage.tsx` ayni premium tasarim diline cekildi; account ve auth yuzeyleri AppShell ile ayni palette ve yumusak gecislerle hizalandi.
- Dogrulama: `pnpm.cmd --filter @runa/web typecheck` ve `pnpm.cmd --filter @runa/web build` yesil. `pnpm.cmd --filter @runa/web lint` bu gorevde dokunulmayan, scope disi `apps/web/src/lib/chat-runtime/request-payload.ts` icindeki pre-existing Biome format farki nedeniyle halen kirik.
- Sonraki onerilen gorev: scope onayi varsa `apps/web/src/lib/chat-runtime/request-payload.ts` icindeki tek satirlik Biome format farkini temizleyip web lint zincirini yeniden tamamen yesile dondurmek.

### Track A / Sprint 10.5 - Groq Live Smoke Primary Gate Rerun - 19 Nisan 2026

- Current shell icinde `GROQ_API_KEY` yoktu; gitignored repo-root `.env` icindeki authoritative key secret loglamadan yalniz alt surece tasinarak `pnpm.cmd --dir apps/server run test:groq-live-smoke` kosturuldu.
- Ilk kosu provider yerine smoke helper icindeki `runModelTurn()` persistence denemesinde kirildi; dar fix olarak `apps/server/scripts/groq-live-smoke.mjs` icinde smoke stage'leri icin no-op persistence writer enjekte edildi. Production runtime, auth contract'i ve websocket schema degismedi.
- Ayni komut bu dar helper fix sonrasi `GROQ_LIVE_SMOKE_SUMMARY.result = PASS` verdi. `assistant_roundtrip`, `tool_schema_roundtrip` ve `browser_shape_roundtrip` stage'lerinin ucu de `PASS` oldu.
- Non-fatal not: rerun stderr'inde `memory.integration.failed / MEMORY_STORE_READ_FAILED` goruldu; bu tur live smoke sonucunu kirmadi ve rehearsal bu kaydin kapsamina alinmadi.
- Sonraki ayrik gorev: `test:groq-demo-rehearsal` authority'sini ayri turda kosturup baseline closure dilini ancak o zaman guncellemek.

### Track A / Sprint 10.5 - Groq Demo Rehearsal Authority Rerun - 19 Nisan 2026

- Current shell icinde `GROQ_API_KEY` yoktu; rehearsal authority icin key `.env` icinden secret loglamadan yalniz alt surece tasindi.
- Ilk rehearsal denemesinde `.env` kaynakli DB env'leri de alt surece tasindigi icin formal repeatability 5/5 ayni noktada kirildi: `register-ws` demo senaryosunda `approval.resolve` sonrasi replay yolu persistence denemesine girip tool execute oncesinde durdu ve `expected "execute" to be called 1 times, but got 0 times` assertion'i alindi.
- Dar operasyonel triage sonucu bunun runtime/provider regression degil, rehearsal subprocess env drift'i oldugu goruldu; current shell zaten DB env tasimadigi icin ikinci kosu yalniz `GROQ_API_KEY` ve opsiyonel `GROQ_MODEL` ile, file-backed `DATABASE_*` / `SUPABASE_DATABASE_URL` env'leri alt surece tasinmadan yapildi.
- `pnpm.cmd --dir apps/server run test:groq-demo-rehearsal` bu temiz authority kosusunda `GROQ_DEMO_REHEARSAL_SUMMARY.result = PASS` verdi. Alt ozetler: `FORMAL_REPEATABILITY_SUMMARY.result = PASS (5/5)` ve `CORE_COVERAGE_SUMMARY.threshold_passed = true`.
- Kod degisikligi yapilmadi; bu kayit rehearsal authority sonucunu ve env handling notunu belgelemek icindir.

### Track A / Sprint 10.5 - Credential-Enabled Groq Repro Follow-Up Probe - 19 Nisan 2026

- Gitignored repo-root `.env` dosyasinda `GROQ_API_KEY` bulundu; mevcut shell'de bos oldugu icin live komutlar secret loglamadan alt surec env'ine tasinarak kosturuldu.
- Dar direct Groq generate probe'u ve `browser_shape_roundtrip`e esit request-shape generate probe'u bugunku kod snapshot'inda `HTTP 400` uretmedi; browser-shape istek Groq tarafinda kabul edildi ve `file.read` tool-call adayi dondu.
- `pnpm.cmd --dir apps/server run test:groq-live-smoke` bu shell/env kombinasyonunda exact provider 400 yerine once `RUN_STATE_PERSISTENCE_FAILED` ile kirildi; yani smoke helper burada provider body yakalamadan persistence write-path'te durdu.
- Canli local dev auth + websocket loopback probe'unda zincir `connection.ready -> run.accepted -> model.completed -> WAITING_APPROVAL -> approval_block` seviyesine kadar gercek server uzerinde dogrulandi; Groq provider bu akista da `400` vermedi.
- Durust blocker: bu tur tam `approval.resolve -> continuation -> run.finished` kaniti alinamadi. Browser automation CLI bu ortamda yoktu ve loopback harness'te approval resolve sonrasi terminal continuation kapanisi deterministik sekilde yakalanamadi.
- Sonuc siniflandirmasi: bugunku evidence ile exact `groq returned HTTP 400` root cause'i request shape / unsupported field / tool schema olarak kanitlanmadi. En guclu kalan ihtimal browser/runtime-config mismatch veya onceki transient provider durumu; exact body bu turda yeniden uretilmedi.
- Kod degisikligi yapilmadi. Sonraki onerilen gorev: browser tarafindaki persisted runtime config (api key/provider/model) ile ayni anda server stderr provider/persistence debug loglarini toplayan dar bir browser-forensics turu.

### Track A / Sprint 10.5 - Credential-Enabled Groq Repro Rerun + Live Approval Continuation Check - 19 Nisan 2026

- Current shell icinde `GROQ_API_KEY` yoktu; bu nedenle canli repro mevcut shell env'e guvenerek degil, repo kokundeki gitignored `.env` dosyasindan authoritative `GROQ_API_KEY` sadece alt surec env'ine tasinarak kosturuldu. Secret loglanmadi.
- `pnpm.cmd --dir apps/server run test:groq-live-smoke` credential-enabled olarak yeniden calistirildi ve `assistant_roundtrip`, `tool_schema_roundtrip` ve `browser_shape_roundtrip` stage'lerinin ucu de `PASS` verdi. Bu tur exact `groq returned HTTP 400` yeniden uretilmedi.
- `RUNA_DEBUG_PROVIDER_ERRORS=1` ile ayri bir local server instance uzerinden canli loopback auth + websocket repro yapildi. `run.accepted -> tool_result -> approval_block -> approval.resolve(approved) -> continuation -> run.finished(COMPLETED)` zinciri gercek runtime hattinda gecti; server stderr icinde yeni bir `[provider.error.debug]` veya exact 400 body uretilemedi.
- Dar root-cause sonucu: bugunku kod snapshot'inda Groq provider request shape / tool payload / default model icin deterministik bir bad-request reproduksiyon kaniti yok. En guclu kalan ihtimal onceki browser-oturumuna ait runtime-config mismatch'i veya provider-side transient durumudur; exact body bu turda kanitlanamadigi icin daha ileri claim acilmadi.
- Kod degisikligi yapilmadi. Approval E2E browser otomasyonu mevcut ortamda kullanilabilir bir browser CLI olmadigi icin tam browser olarak degil, ayni auth + WS contract'ini kullanan canli loopback harness ile dogrulandi.
- Sonraki onerilen gorev: eger browser tarafinda ayni 400 tekrar gorulurse, o oturumdaki local runtime config (persisted model/api key/provider) ile ayni anda server provider debug logunu birlikte yakalayan dar bir browser-forensics turu acmak.

### Track C / Sprint 10.5 - Chat-First Surface Reset + TR-First Localization Foundation - 19 Nisan 2026

- Authenticated varsayilan giris `/chat` olarak guncellendi; `/dashboard` primary flow'dan cikarildi ve shell/navigation chat-first IA cizgisine cekildi.
- Chat runtime config sahipligi operator panel gorunumunden ayrildi; `apiKey`, `provider`, `model` ve `includePresentationBlocks` local browser persistence ile korunup `/chat` ve `/developer` arasinda paylasilan app-level runtime state uzerinden beslendi.
- Ana `/chat` yuzeyinden operator/demo agirligi cikarildi: API key, provider/model override ve raw transport paneli ana sohbetten tasindi; sohbet akisi composer + current-run + approval omurgasina indirildi.
- Ayrik `/developer` route'u acildi; runtime config, raw transport gorunurlugu, auth troubleshooting ve raw scope/claims/metadata buraya tasindi. `SettingsPage` sade `Account` yuzeyine indirildi.
- Approval kartlari ve current-run copy'leri chat-native / natural-language-first cizgiye cekildi; agir metadata varsayilan katmandan cikartilip on-demand detay mantigina yaklastirildi.
- Hafif dictionary tabanli i18n foundation kuruldu; varsayilan locale `tr` secildi, `en` ikinci dil olarak yapida tutuldu. Primary flow ve ilgili hook/lib notice/error copy'leri bu katmana tasindi.
- Dogrulama: `pnpm.cmd --filter @runa/web typecheck`, `pnpm.cmd --filter @runa/web lint`, `pnpm.cmd --filter @runa/web build`, `pnpm.cmd --filter @runa/server typecheck`, `pnpm.cmd --filter @runa/server lint` yesil. `pnpm.cmd --filter @runa/server test` bu turda mevcut repo-disisi degil ama pre-existing gorunen `dist/tools/git-status.test.js` timeout'u yuzunden kirmizi kaldi.
- Sonraki onerilen gorev: browser tabanli authenticated `/chat` + `/developer` smoke ve TR-first string kacagi icin odakli bir UI regression turu.

### Sprint 9-10 Closure Review - 18 Nisan 2026

- **Sprint 9 karari:** `SPRINT 9 COMPLETE`
- Gerekce: blueprint'teki Sprint 9 DoD maddeleri bugunku repo gerceginde karsilaniyor. Permission engine denial tracking + progressive trust repoda, `register-ws.ts` sorumluluk bazli split katmanina indirgenmis, mevcut WS contract'i korunmus ve repo-health zinciri (`typecheck` / `lint` / `test`) yesil kayitlarla desteklenmis durumda.
- Not: GAP-11 ve kalan WS/runtime cleanup ihtiyaclari vardir; bunlar Sprint 9 closure blocker'i degil, sonraki hardening backlog'udur.
- **Sprint 10 karari:** `SPRINT 10 NOT READY TO CLOSE`
- Gerekce: UI decomposition, auth shell, Login/Dashboard/Chat/Settings yuzeyleri, signup/login/chat/logout akisi, responsive/a11y ve current-run progress + approval polish repoda bulunuyor; ancak blueprint DoD'seki `premium gorsel standart saglanmis` maddesi bugun durustce claim edilemiyor. README ve teknik mimari de premium consumer UI closure claim'ini acik tutmuyor.
- Not: GAP-12 (desktop agent / desktop capabilities) Sprint 10 closure blocker'i degildir; Sprint 11 / sonraki faz isidir. Sprint 10 closure'i bugun premium visual standard / higher-level polish dili yuzunden erken olur.

### Track A / Sprint 9 - runs.current_state Terminal Sync Fix - 18 Nisan 2026

- `apps/server/src/ws/run-execution.ts` icinde live finalization artik `run.finished` oncesinde `runs.current_state` satirini da `final_state` ile persist ediyor; boylece assistant-only ve post-tool follow-up tamamlama sonrasi run row event/final state'ten geri kalmiyor.
- `apps/server/src/ws/orchestration-types.ts` uzerinden dar `persistRunState` injection seam'i korundu; `apps/server/src/ws/register-ws.test.ts` icinde WS harness default run-store write'i izole edilerek explicit persistence beklentileri deterministic tutuldu.
- Local authoritative PostgreSQL smoke'unda assistant-only run `COMPLETED` state ile `runs.current_state=COMPLETED` yazdi; tool + approval akisi approval boundary'de `WAITING_APPROVAL`, approve sonrasi ise `COMPLETED` olarak satira yansidi ve `run.finished(COMPLETED)` ile senkron kaldi.
- `pnpm.cmd --filter @runa/server typecheck`, `pnpm.cmd --filter @runa/server lint` ve `pnpm.cmd --filter @runa/server test` yesil.
- Sonraki onerilen gorev: dev smoke output'unda tekrarli `ensureDatabaseSchema` NOTICE gurultusunu ayri bir temizlik goreviyle azaltmak.

### Track B / Sprint 10 - Dev Auth Seam Security Hardening Audit - 18 Nisan 2026

- Local dev auth seam dar kapsamda audit edildi ve `apps/server/src/auth/supabase-auth.ts` icindeki enable karari `RUNA_DEV_AUTH_ENABLED=1` yanina `NODE_ENV=development` guard'i eklenerek sertlestirildi; boylece flag tek basina non-dev/prod path'te verifier veya bootstrap route acmiyor.
- `apps/server/src/routes/auth.ts` icinde `/auth/dev/bootstrap` artik yalniz dev seam gercekten aktifse register ediliyor; route icinde ise hem `redirect_to` loopback origin (`localhost` / `127.0.0.1`) hem de gelen request host/ip loopback-local olmak zorunda.
- `apps/server/src/app.test.ts` uzerine non-dev `404`, malformed redirect `400`, loopback disi host `403`, dev token ile `/auth/context` authenticated gecisi ve dev token ile `/ws` authenticated handshake coverage'i eklendi.
- `apps/web` tarafinda dev session aksiyonu yalniz `import.meta.env.DEV` gorunumunde kalmaya devam ediyor; production build smoke'u gecti. Durust kalan not: dev-auth string/helper izleri bundle icinde gorunebiliyor, ancak route non-dev'de kayitli olmadigi icin prod trust boundary acilmiyor.
- `pnpm.cmd --filter @runa/server typecheck`, `pnpm.cmd --filter @runa/server lint`, `pnpm.cmd --filter @runa/server test`, `pnpm.cmd --filter @runa/web typecheck`, `pnpm.cmd --filter @runa/web lint` ve `pnpm.cmd --filter @runa/web build` yesil.
- Sonraki onerilen gorev: istenirse ayrik bir frontend hardening gorevinde dev-auth affordance'in production bundle gorunurlugunu da code-splitting seviyesinde azaltmak.

### Track B / Sprint 10 - Local Authenticated Browser Live-Run Stabilization - 18 Nisan 2026

- `apps/server/scripts/dev.mjs` dev bootstrap'i artik loopback-local browser oturumlari icin imzali local dev auth env'ini (`RUNA_DEV_AUTH_ENABLED`, ephemeral `RUNA_DEV_AUTH_SECRET`, varsayilan `RUNA_DEV_AUTH_EMAIL`) otomatik hazirliyor; production start path ve Supabase-first auth modeli degismedi.
- `apps/server/src/auth/supabase-auth.ts`, `apps/server/src/app.ts` ve `apps/server/src/routes/auth.ts` uzerinde dar bir local-dev verifier + `/auth/dev/bootstrap` redirect seam'i eklendi. Bu seam yalniz loopback `redirect_to` hedeflerine izin veriyor ve mevcut hash/session bootstrap akisini kullanarak browser'a gercek authenticated session token veriyor.
- `apps/web/src/lib/auth-client.ts`, `apps/web/src/hooks/useAuth.ts`, `apps/web/src/App.tsx` ve `apps/web/src/pages/LoginPage.tsx` local dev build'de bu bootstrap'i baslatan kucuk bir butonla guncellendi; mevcut login/signup/token ve WS contract'i korunuyor.
- Gercek headless Edge browser smoke'unda local dev auth bootstrap -> authenticated `/auth/context` -> authenticated `/ws` (`OPEN WS`) -> assistant-only live run -> low-risk `file.read` tool run -> approval -> continuation -> `run.finished(COMPLETED)` zinciri dogrulandi.
- Durust kalan limit: `pnpm.cmd --filter @runa/web dev` bu makinede tekrar `EPERM` uretmedi; bu turda Vite config degisikligi gerekmedi. Ilk tool prompt ise modelin goreli path varsayimi yuzunden `apps/server/README.md` denemesiyle `NOT_FOUND` verdi; mutlak path ile tool path ve approval continuation zinciri dogrulandi.

### Track B / Sprint 10 - Persistence DB Config Resolution + Supabase Pooler Readiness - 18 Nisan 2026

- Runtime event, run, memory ve approval persistence store'lari artik ham `process.env.DATABASE_URL` okumak yerine ortak typed DB config yolunu kullaniyor; boylece cloud target'ta `SUPABASE_DATABASE_URL` verildiginde tum write-path ayni kararla dogru endpoint'e gidiyor.
- `packages/db/src/config.ts` icinde DB URL precedence target-aware hale getirildi: local target `DATABASE_URL` -> `LOCAL_DATABASE_URL`, cloud target `SUPABASE_DATABASE_URL` -> `DATABASE_URL`. Bu davranis `packages/db/src/config.test.ts` ile dogrulandi.
- `apps/server/src/persistence/database-config.ts` eklendi; store-level config error yuzeyi korunurken tamamen bos env durumunda mevcut `DATABASE_URL is required ...` mesajlari gereksiz yere kirilmadi.
- Onceki turda denenen Windows-ozel DNS/socket workaround'u kalici cozum standardini karsilamadigi icin kaldirildi; shared DB client tekrar sade ve platform-notr hale getirildi.
- `pnpm.cmd --filter @runa/db typecheck`, `pnpm.cmd --filter @runa/db test`, `pnpm.cmd --filter @runa/db build`, `pnpm.cmd --filter @runa/server typecheck`, `pnpm.cmd --filter @runa/server lint` ve `pnpm.cmd --filter @runa/server test` yesil.
- Durust durum: mevcut `.env` yalnizca Supabase direct IPv6 host'unu iceriyor; bu nedenle canli schema bootstrap halen `getaddrinfo ENOENT db.<project-ref>.supabase.co` ile kiriliyor. Uygulama kodu artik dogru pooler URL'yi kullanabilecek durumda, ancak exact Session pooler connection string env'e eklenmeden live DB write-path tam acilamiyor.
- Sonraki onerilen gorev: Supabase dashboard `Connect` panelinden exact Session pooler string'ini `SUPABASE_DATABASE_URL` olarak ekleyip live persistence smoke'unu tekrar kosturmak.

### Sprint 10.5 - Browser Verification + Kucuk Follow-Up Fix'ler - 19 Nisan 2026

- Web tarafinda `pnpm.cmd --filter @runa/web typecheck`, `pnpm.cmd --filter @runa/web lint` ve `pnpm.cmd --filter @runa/web build` tekrar yesil alindi.
- Gercek browser render ile `/chat`, `/developer`, `/account`, `/dashboard` -> `/chat` ve `/settings` -> `/account` akisleri dogrulandi; chat-first nav ve Developer Mode izolasyonu canli yuzeyde kontrol edildi.
- Browser verification sonucu hesap yuzeyinin hala fazla teknik gorundugu tespit edildi; `ProfileCard`, `SessionCard` ve `SettingsPage` sadelestirilerek raw/session-debug agirligi `Developer Mode` katmaninda birakildi.
- `TransportMessagesPanel` icindeki gorunur mojibake metni temizlendi ve auth/lib tarafindaki kullaniciya dokunabilen Ingilizce notice/error kacagi dar kapsamda Turkcelestirildi.
- Etkilesimli browser harness ile chat submit zinciri gercekten tetiklendi: run kabul edildi ve mevcut calisma yuzeyi olustu; ancak provider cagrisi `groq returned HTTP 400` ile dustugu icin approval akisi bu turda gercek kullanimda sonuna kadar dogrulanamadi.
- Bu tur apps/server, websocket schema, auth backend contract veya runtime semantics degistirilmedi.

### Track A / Sprint 10.5 - Groq 400 Debug Visibility + Browser-Shape Smoke Hazirligi - 19 Nisan 2026

- `apps/server/src/gateway/provider-http.ts` ve `apps/server/src/gateway/groq-gateway.ts` uzerinde env-gated provider debug gorunurlugu dar kapsamda genisletildi; `RUNA_DEBUG_PROVIDER_ERRORS=1` iken artik status code ve response body yaninda `compiled_context_chars`, `message_roles`, `max_output_tokens`, `tool_count` ve `tool_names` gibi secret icermeyen request summary alanlari da gorulebiliyor.
- `apps/server/scripts/groq-live-smoke.mjs` icine browser submit yoluna daha yakin yeni `browser_shape_roundtrip` stage'i eklendi; bu stage `buildLiveModelRequest()` + full default tool registry binding ile compiled context ve 10-tool request shape'ini dogrudan Groq generate hattina tasiyor.
- Bugunku shell/env durumunda authoritative `GROQ_API_KEY` mevcut olmadigi icin live Groq smoke halen `credential_missing` olarak bloklu; bu nedenle `groq returned HTTP 400` icin exact provider response body bugun bu makinede yeniden alinip kanitlanamadi.
- Durust durum: approval E2E bu turda gecmis sayilmadi. Browser/storage tarafinda kalici bir Groq key bulunamadigi ve current shell env de bos oldugu icin gerçek provider repro ve `Kabul Et / Reddet -> continuation -> terminal result` zinciri yeniden kosturulamadi.

---

### Track B / Sprint 10 - Local Docker PostgreSQL Authoritative Dev Path - 18 Nisan 2026

- Gunluk gelistirme/debug icin authoritative DB yolu local Docker PostgreSQL olarak netlestirildi; repo kokundeki gitignored `.env.local` dosyasi `DATABASE_TARGET=local` ve local `DATABASE_URL` / `LOCAL_DATABASE_URL` kombinasyonunu tasiyor.
- `apps/server/scripts/dev.mjs` dev bootstrap'i artik `.env` sonrasinda `.env.local` dosyasini da yukluyor; `.env.local` yalniz onceki file-backed env anahtarlarini override ediyor, shell/IDE tarafindan enjekte edilmis env degerlerini ezmiyor.
- Bu duzenleme cloud-first Phase 2 yonunu geri almiyor: Supabase auth/storage env'leri korunuyor, yalnizca dev runtime persistence write-path'i local Postgres'e sabitleniyor.
- Local Docker Postgres uzerinde DB config resolve, schema bootstrap, CRUD smoke ve focused `run-store` / `event-store` / `memory-store` verification akislari gecti.
- Canli server + web akisinda local DB ile `connection.ready`, `run.accepted`, incremental `runtime.event` akisi ve run sonu persistence zinciri browser uzerinden dogrulanacak/veya bu kayitla birlikte dogrulandi.
- Sonraki onerilen gorev: approval-store ve checkpoint metadata yolu icin de ayni local dev smoke derinligini ayri bir focused regression script ile kalicilastirmak.

---

### Track A / Sprint 9 - Live Post-Tool Continuation Stabilization - 18 Nisan 2026

- Local Docker PostgreSQL uzerindeki canli `run.request` akisinda kalan post-tool continuation gap'i dar kapsamda duzeltildi; tool failure terminal path'i artik `run.finished` uretmeden sessizce `TOOL_RESULT_INGESTING`te kalmiyor.
- `apps/server/src/ws/run-execution.ts` icinde terminal loop `FAILED` snapshot'lari `FAILED` final_state'e maplenip eksik `run.failed` runtime event'i append edilir hale getirildi; boylece tool-result sonrasi terminal failure durumda WS/UI kapanis sinyali geliyor.
- `apps/server/src/ws/live-request.ts` icinde tool-result follow-up turn user prompt'u, son tool sonucunun truncate'li ozetini tasiyacak ve ayni tool'u gereksiz tekrar cagirmamayi acikca soyleyecek sekilde sertlestirildi; Groq canli follow-up artik ayni `file.read` cagrisina donmek yerine assistant cevabina inebiliyor.
- Gercek browser dogrulamasinda local DB + live server/web ile `connection.ready`, `run.accepted`, assistant-only `run.finished(COMPLETED)` ve `file.read` tool run'inda beklenen `auto-continue-approval-required` boundary sonrasi approve edilince follow-up `run.finished(COMPLETED)` akisi goruldu.
- Durust kalan limit: bu snapshot'ta `runtime_events` / `tool_calls` / WS kapanis davranisi dogru olsa da `runs.current_state` satiri terminal completion ile tam senkron degil (`assistant-only` icin `null`, tool-follow-up run icin `TOOL_RESULT_INGESTING` kalabiliyor). Bu ayri bir persistence follow-up'i olarak ele alinmali.
- Sonraki onerilen gorev: `runs` tablosundaki terminal state senkronizasyonunu mevcut event-store zincirini bozmadan ayri bir dar kapsamli persistence gorevi olarak kapatmak.

---

## Faz Kayitlari

### Phase 2 (Core Hardening) Baslangici - 15 Nisan 2026

**Baglam:** Ekip ile yapilan degerlendirmeler sonucunda, MVP vizyonundan post-MVP state'ine (Core Hardening) cloud-first yaklasim ve otonom agent ozellikleri ile gecis yapilmasina karar verildi.

**Alinan Kritik Kararlar (Ozet):**
- **Cloud-First Hybrid Mimari:** Tum auth ve veritabani islemleri Supabase'e tasinacak. Local desktop islemleri icin WSS tabanli bir daemon gelistirilecek.
- **Agentic Loop:** Tek-turlu `runModelTurn()` yerine, async generator tabanli cok-turlu otonom bir yapiya gecilecek (max 200 turn limiti ve typed stop conditions).
- **Yurutme:** 3 paralel track uzerinden ilerlenecek:
  - Track A (Core Engine): Agentic loop, checkpoint, compaction, ws refactor
  - Track B (Cloud Infra): Supabase Auth, PostgreSQL, Storage, Subscription
  - Track C (UI + Desktop): UI decomposition, premium UX, Windows desktop agent
- **Provider:** Development sirasina Groq kullanilmaya devam edecek; yayin asamasinda Claude / Gemini kullanilacak.

**Yapilanlar:**
- Tum yonetim belgeleri (`AGENTS.md`, `implementation-blueprint.md`, `vision.md`, `TASK-TEMPLATE.md`, `AI-DEVELOPMENT-GUIDE.md`) yeni Phase 2 paradigmalarini yansitacak sekilde yenilendi.
- Eski MVP kayitlari `docs/archive/progress-phase1.md` icine, ekip kararlari `docs/archive/cevap-ekip-kararlari.md` icine tasindi.

**Siradaki Adimlar:**
- Track A (Sprint 7): Agent-loop tiplerini olustur ve temel async generator state makinesini kur.
- Track B (Sprint 7B): Supabase cloud projesini kur, local schema'yi cloud uzerine tasi ve RLS (Row Level Security) belirle.

### Track B / Sprint 7B - 16 Nisan 2026

- `packages/types/src/auth.ts` icin types-first auth contract'lari eklendi.
- Auth provider, user, session, JWT claims, principal ve request-facing auth context yuzeyleri tanimlandi.
- Middleware, JWT validation, Supabase client ve WS auth implementasyonu bu kaydin kapsami disinda tutuldu.
- `packages/types/src/subscription.ts` icin types-first subscription contract'lari eklendi.
- Free / Pro / Business tier, status, cadence, entitlement, feature gate ve usage quota seam'leri tanimlandi.
- `packages/db` altinda cloud/local dual-mode config seam'i eklendi.
- `DATABASE_TARGET`, `DATABASE_URL` ve Supabase env alanlari icin typed resolve/normalize yuzeyi tanimlandi; migration ve RLS bu kaydin kapsamina alinmadi.
- `packages/db` icin config seam ile uyumlu migration/bootstrap runner eklendi.
- Schema bootstrap giris noktasi local veya cloud target'a ayni resolve edilen DB config uzerinden baglanacak sekilde netlestirildi; RLS ve object storage bu kaydin disinda tutuldu.
- `packages/db` altinda initial RLS scaffolding seam'i eklendi.
- Mevcut tablo seti icin deterministic RLS plan/runner yuzeyi kuruldu; gercek policy SQL'i, auth claims ve storage policy calismalari bu kaydin disinda tutuldu.
- Core tablolara gelecekteki claim-based RLS icin `tenant_id`, `workspace_id` ve gerekli yerlerde `user_id` scope kolonlari eklendi.
- Scope kolonlari bootstrap SQL hattina non-breaking sekilde baglandi; app-layer write-path ve auth middleware calismalari bu kaydin disinda tutuldu.
- `packages/db` altinda local/cloud hedefte ayni seam ile calisacak DB CRUD smoke runner eklendi.
- Smoke path config resolve, schema bootstrap ve `runs` + `runtime_events` uzerinde temel CRUD/cleanup akisini dogrulayacak sekilde kuruldu; auth ve RLS correctness bu kaydin disinda tutuldu.

### Track B / Sprint 8B - 16 Nisan 2026

- `apps/server/src/auth/supabase-auth.ts` icin Supabase auth middleware seam'i eklendi.
- Authorization header okuma, injected verifier ile JWT dogrulama sonucu normalize etme ve `request.auth` typed auth context baglama yuzeyi tanimlandi.
- Signup/login, storage API, authenticated WS handshake ve subscription gating bu kaydin kapsami disinda tutuldu.
- Supabase auth seam'i Fastify app wiring'e baglandi ve app-seviyesinde `request.auth` tutarliligi saglandi.
- Minimal `/auth/context` ve `/auth/protected` HTTP surface'i ile anonymous/authenticated/protected davranislari dogrulandi; signup/login, storage ve WS handshake halen bu kapsamin disinda tutuldu.
- Authenticated storage API seam'i service + route ayrimiyla eklendi.
- `/storage/upload` ve `/storage/blob/:id` surface'leri auth-aware blob metadata normalization ve scope/ownership kontrolu ile kuruldu; gercek provider implementasyonu, frontend upload UI ve desktop capture bu kapsamin disinda tutuldu.
- Authenticated WS JWT handshake seam'i eklendi.
- `/ws` handshake'i Authorization header onceligi ve kontrollu query-token fallback ile dogrulanacak sekilde guvenlendirildi; mevcut WS message contract'i korunurken invalid/no-token baglantilar kontrollu sekilde kapatildi.
- Supabase storage adapter'i eklendi.
- `StorageProviderAdapter` seam'i fetch tabanli bir Supabase Storage backend adapter ile gercek upload/download akisina baglandi; custom adapter onceligi, env tabanli wiring ve not-configured fallback korunurken signed URL ve bucket policy calismalari bu kaydin disinda tutuldu.

### Track B / Sprint 9B - 16 Nisan 2026

- Subscription context ve feature gating seam'i eklendi.
- Auth context ile hizali subscription scope resolution, default free-tier fallback ve typed feature access guard'lari kuruldu; gercek billing backend ve usage quota enforcement bu kaydin disinda tutuldu.
- Subscription-aware WS connection control seam'i eklendi.
- `/ws` handshake'i auth sonrasinda injected subscription resolver ve typed feature gate ile kontrol edilir hale getirildi; active/tier uygun baglantilar `connection.ready` alirken missing, inactive ve plan-restricted baglantilar kontrollu sekilde kapatildi.
- WSS/TLS configuration seam'i eklendi.
- TLS env cozumleme, plain HTTP/WS fallback, tam cert/key konfigurasyonunda HTTPS/WSS transport secimi ve eksik TLS env durumunda kontrollu config error davranisi bootstrap hattina baglandi.
- Usage quota tracking seam'i eklendi.
- Subscription context quota alanlari ve opsiyonel injected resolver uzerinden typed usage evaluation/guard yuzeyi kuruldu; gercek billing counter persistence, analytics ve UI gorunurlugu bu kaydin disinda tutuldu.

### Track A / Sprint 8 - 17 Nisan 2026

- Types-first checkpoint contracts eklendi.
- `packages/types/src/checkpoint.ts` altinda checkpoint metadata, blob reference ve resume context yuzeyleri tanimlandi; runtime persistence manager, compaction stratejileri ve storage implementasyonu bu kaydin disinda tutuldu.
- Checkpoint manager seam'i eklendi.
- `apps/server/src/runtime/checkpoint-manager.ts` altinda injected metadata store + blob store ile metadata-only ve hybrid checkpoint save/read/resolve yuzeyleri kuruldu; gercek PostgreSQL/Object Storage adapter implementasyonu ve compaction mantigi bu kaydin disinda tutuldu.
- Microcompact compaction seam'i eklendi.
- `apps/server/src/context/compaction-strategies.ts` altinda deterministic microcompact strategy, injected summarizer seam'i, token budget/provenance yuzeyi ve preserved artifact ref tasima davranisi kuruldu; 413 retry orchestration ve checkpoint entegrasyonunun son hali bu kaydin disinda tutuldu.
- 413 token limit recovery seam'i eklendi.
- `apps/server/src/runtime/token-limit-recovery.ts` altinda token-limit failure detection, compaction uzerinden controlled retry ve retry metadata yuzeyi kuruldu; loop-wide checkpoint entegrasyonu ve tam orchestration bu kaydin disinda tutuldu.
- Turn-based checkpoint writing seam'i eklendi.
- `apps/server/src/runtime/agent-loop-checkpointing.ts` altinda agentic loop yield observer uzerinden `turn.completed` ve `loop.boundary` anlarinda metadata-only checkpoint record uretimi ve checkpoint manager write wiring'i kuruldu; tam resume orchestration ve hybrid blob persistence bu kaydin disinda tutuldu.
- Checkpoint resume seam'i eklendi.
- `apps/server/src/runtime/resume-agent-loop.ts` altinda checkpoint manager resolve sonucu agent loop baslangic input'una cevrildi; resumable, terminal ve missing checkpoint durumlari typed sekilde ayrildi, metadata-only baseline restore desteklenirken full blob hydration bu kaydin disinda tutuldu.
- Concrete checkpoint persistence adapter'lari eklendi.
- `apps/server/src/runtime/checkpoint-metadata-store.ts`, `checkpoint-blob-store.ts` ve `persistent-checkpoint-manager.ts` altinda PostgreSQL-backed checkpoint metadata store, object storage-backed checkpoint blob manifest/payload store ve gercek persistence wiring'i kuruldu; metadata-only baseline korunurken hybrid checkpoint blob ref/payload yolu concrete adapter'larla desteklendi.

### Track A / Sprint 9 - 17 Nisan 2026

- WS transport/orchestration/presentation split baslatildi.
- `apps/server/src/ws/transport.ts`, `orchestration.ts` ve `presentation.ts` altinda `register-ws.ts` icindeki socket transport, run lifecycle ve presentation/inspection block assembly mantigi ayrildi; mevcut WS contract korunarak `register-ws.ts` ince composition/wiring katmanina indirildi.
- Permission engine seam'i eklendi.
- `apps/server/src/policy/permission-engine.ts` altinda capability evaluation, approval-required vs hard-deny ayrimi, denial tracking ve 3 ardisik red -> session pause yuzeyi kuruldu; auto-continue varsayilan kapali kalirken progressive trust enablement seam'i eklendi.
- Permission engine live WS orchestration hattina baglandi.
- `apps/server/src/ws/orchestration.ts` ve `apps/server/src/ws/policy-wiring.ts` uzerinden tool execution oncesi permission evaluation, mevcut approval flow'a bridge, hard deny / paused session handling ve socket-scope in-memory denial tracking baglandi; mevcut WS contract korunurken ilgili WS testleri guncellendi.
- WS orchestration helper split devam etti.
- `apps/server/src/ws/live-request.ts`, `run-execution.ts`, `approval-handlers.ts` ve `inspection-handlers.ts` ile live request hazirlama, run execution/post-processing, approval resolve ve inspection handling mantigi `orchestration.ts` disina ayrildi; coordinator katmani inceltilirken mevcut WS contract ve permission wiring korunmaya devam edildi.
- Auto-continue policy live runtime entrypoint'ine baglandi.
- `apps/server/src/runtime/auto-continue-policy.ts`, `run-agent-loop.ts` ve `apps/server/src/ws/run-execution.ts` uzerinden tool-result sonrasi follow-up turn oncesi auto-continue/progressive trust gate'i eklendi; varsayilan kapali davranis korunurken explicit approval sonrasi continuation ve paused-session blokajlari testlerle dogrulandi.
- Sprint 9 closure icin repo-health cleanup turu tamamlandi.
- `pnpm typecheck`, `pnpm lint` ve `pnpm test` zinciri mevcut workspace snapshot'inda tekrar yesile tasindi; release-demo checklist'indeki repo-health blocker'i bu snapshot icin temizlendi.
- Cleanup kapsami capability genisletmeden kacinarak persistence/storage typing uyumu, schema-genisleme sonrasi test fixture hizalamasi, TLS/config ve checkpoint helper lint hardening'i ile sinirli tutuldu; accepted WS/policy/runtime davranisi degistirilmedi.

### Track C / Sprint 10 - 17 Nisan 2026

- UI decomposition icin ilk guvenli extraction adimi atildi.
- `apps/web/src/App.tsx` root entry seviyesine indirildi; mevcut chat/runtime ekran mantigi `apps/web/src/pages/ChatPage.tsx` altina tasinarak Track C icin ilk page siniri acildi.
- `apps/web/src/components/chat/ChatShell.tsx` ile dis sayfa kabugu ayrildi; mevcut WS/chat/runtime davranisi korunurken layout shell ile ekran orchestration'i arasinda ilk component siniri netlestirildi.
- `apps/web/src/hooks/useChatRuntimeView.ts` ile davranis degistirmeden turetilmis view-label/status mantigi ayri bir hook sinirina alindi; socket/runtime effect'leri bilincli olarak bu turda yerinde birakildi.
- Bu adim bilincli olarak capability genisletmeden kacinip auth UI, dashboard/settings ayrimi ve runtime hook extraction'ini sonraki Sprint 10 adimlarina birakti.
- `pnpm --filter @runa/web typecheck`, `pnpm --filter @runa/web lint` ve `pnpm --filter @runa/web build` dogrulamalari bu extraction sonrasi yesil kaldi.
- Sprint 10 icin ikinci guvenli UI decomposition adimi tamamlandi.
- `apps/web/src/components/chat/OperatorControlsPanel.tsx`, `RunTimelinePanel.tsx` ve `TransportMessagesPanel.tsx` ile `ChatPage.tsx` icindeki buyuk panel render bolgeleri mostly-presentational component sinirlarina ayrildi.
- `apps/web/src/components/approval/ApprovalPanel.tsx` ile approval render yolu `ChatPage.tsx` disina alindi; page orchestration sahibi kalirken approval UI ayrik bir component yuzeyine tasindi.
- Bu tur bilincli olarak websocket/runtime effect mantigina dokunmadi; yalniz panel-level render sorumluluklarini ayirip sonraki `useChatRuntime` extraction'i icin daha temiz bir UI agaci birakti.
- `pnpm --filter @runa/web typecheck`, `pnpm --filter @runa/web lint` ve `pnpm --filter @runa/web build` panel extraction sonrasi da yesil kaldi.
- Sprint 10 icin ucuncu guvenli UI decomposition adimi tamamlandi.
- `apps/web/src/hooks/useChatRuntime.ts` ile websocket connection lifecycle, incoming message accumulation, run submit, approval resolve, inspection request ve presentation surface tracking mantigi `ChatPage.tsx` disina alindi.
- `apps/web/src/pages/ChatPage.tsx` artik runtime orchestration yerine hook'tan gelen state/action yuzeyi ile composition ve render sahibi kalacak sekilde inceltildi; `useChatRuntimeView` yalniz view-label/status turetiminde kalmaya devam etti.
- Bu tur bilincli olarak auth UI, server contract veya WS protocol degisikligi acmadi; davranis korunurken page / hook / presentational component sinirlari daha net hale getirildi.
- `pnpm --filter @runa/web typecheck`, `pnpm --filter @runa/web lint` ve `pnpm --filter @runa/web build` runtime hook extraction sonrasi da yesil kaldi.
- Sprint 10 icin dorduncu guvenli UI decomposition adimi tamamlandi.
- `apps/web/src/lib/chat-runtime/` altinda saf inspection identity/key helper'lari, presentation surface merge/prune turetimleri, transport summary + runtime feedback hesaplari ve run request payload uretileri ayri lib sinirlarina tasindi.
- `apps/web/src/hooks/useChatRuntime.ts` state/ref, WebSocket lifecycle, event handler/action wiring ve DOM odak/scroll davranisini koruyan orchestration hook olarak inceltildi; `presentation.blocks` update akisi saf `derivePresentationBlocksUpdate(...)` yardimcisi uzerinden okunabilir hale getirildi.
- Bu tur bilincli olarak auth UI, page auth akislari, server contract, WS protocol veya global state yapisi degistirmedi; davranis korunurken sonraki auth UI ve page split adimlari icin hook/lib siniri temizlendi.
- `pnpm --filter @runa/web typecheck`, `pnpm --filter @runa/web lint` ve `pnpm --filter @runa/web build` bu helper extraction sonrasi da yesil kaldi.
- Sprint 10 icin auth UI baslangic seam'i acildi.
- `apps/web/src/lib/auth-client.ts` ve `apps/web/src/hooks/useAuth.ts` ile frontend tarafinda `/auth/context` bootstrap/read yuzeyi kuruldu; anonymous, authenticated ve service principal ayrimi additive sekilde okunur hale getirildi.
- `apps/web/src/pages/LoginPage.tsx` ile minimal ama gercek backend surface'ine baglanan login entry page eklendi; tam signup/OAuth akislari bu turda bilincli olarak acilmadi, ancak session token validation + clear + refresh seam'i bir sonraki adimlara zemin birakti.
- `apps/web/src/App.tsx` artik auth durumuna gore ilk page kompozisyon kararini veriyor; anonymous/bootstrap durumlari `LoginPage` uzerinden kalirken authenticated/service principal durumlari mevcut `ChatPage`'e yonleniyor.
- Browser tarafinda mevcut server contract'ini degistirmeden WebSocket `access_token` query fallback yolu kullanildi; auth token `sessionStorage` seam'i ile tutulurken chat runtime auth hook icine gomulmedi.
- Dev proxy'ye `/auth` hatti eklendi ve `pnpm --filter @runa/web typecheck`, `pnpm --filter @runa/web lint` ve `pnpm --filter @runa/web build` bu auth UI baslangic turu sonrasi da yesil kaldi.
- Sprint 10 icin authenticated app shell'in ilk additive iskeleti acildi.
- `apps/web/src/components/app/AppShell.tsx` ve `AppNav.tsx` ile authenticated/session-bearing yuzeyler icin Dashboard / Chat / Settings ayrimini tasiyan hafif bir shell/navigation siniri kuruldu; buyuk router veya global state rewrite acilmadi.
- `apps/web/src/pages/DashboardPage.tsx` ve `SettingsPage.tsx` ile authenticated principal'lar icin ilk page iskeletleri eklendi; dashboard current session overview + quick entry surface'i sunarken settings auth context, transport, provider, scope ve clear/refresh logout seam'ini gorunur kildi.
- `apps/web/src/App.tsx` anonymous/bootstrap durumlari icin `LoginPage` gate'i olarak kalirken authenticated/service durumlari icin authenticated shell altinda local page switch sahibi oldu; mevcut `ChatPage` davranisi korunarak shell icine `embedded` seam'i uzerinden yerlestirildi.
- `pnpm --filter @runa/web typecheck`, `pnpm --filter @runa/web lint` ve `pnpm --filter @runa/web build` authenticated shell extraction sonrasi da yesil kaldi.
- Sprint 10 auth UI hattinda token-paste seam'inden gercek action baslangicina gecildi.
- `packages/types/src/auth.ts`, `apps/server/src/routes/auth.ts`, `apps/web/src/lib/auth-client.ts` ve `apps/web/src/hooks/useAuth.ts` uzerinden additive email/password `login` + `signup` action contract'lari ve minimal `oauth/start` redirect seam'i eklendi; mevcut `/auth/context` bootstrap siniri korunurken sahte success akisi yazilmadi.
- `LoginPage` artik login, signup, token validation ve OAuth start modlarini ayni auth boundary icinde tasiyor; Supabase email confirmation acik oldugunda signup yaniti `verification_required` olarak durustce anonymous yuzeyde kalirken basarili login/signup mevcut auth gate uzerinden authenticated shell'e geciyor.
- OAuth tarafinda tam callback/profile/account management bu turda acilmadi, ancak Supabase implicit-flow redirect hash tokenlari frontend bootstrap sirasinda okunup mevcut bearer-token seam'ine baglandi; boylece Google/GitHub start butonlari sonraki tam auth dilimleri icin gercekci bir temel kazandi.
- `pnpm --filter @runa/web typecheck`, `pnpm --filter @runa/web lint` ve `pnpm --filter @runa/web build` ile birlikte focused `apps/server/src/app.test.ts` auth route senaryolari bu genisleme sonrasi da yesil kaldi.
- Sprint 10 auth UI hatti logout ve profile/account surface tarafinda sertlestirildi.
- `packages/types/src/auth.ts`, `apps/server/src/routes/auth.ts`, `apps/web/src/lib/auth-client.ts` ve `apps/web/src/hooks/useAuth.ts` uzerinden gercek `logout` seam'i eklendi; frontend local token clear'dan ayri bir action ile `/auth/logout` uzerinden Supabase remote sign-out denemesi yaparken remote hata durumlari sahte success uretilmeden anonymous fallback + durust error mesaji ile modellendi.
- `SettingsPage` artik yalniz debug/auth seam paneli degil; `ProfileCard` ve `SessionCard` ile current profile/account summary, provider/identity listesi, scope, claims/session metadata ve gercek sign-out aksiyonu gosteren anlamli authenticated account surface'ine donustu.
- Logout davranisi bilincli olarak Supabase'in refresh-token revoke modeline hizalandi: remote sign-out basarili olsa bile mevcut access token'in expiry'e kadar gecerliligini koruyabilecegi UI kopyasi ve route yanitlari uzerinden acikca ifade edildi.
- `pnpm --filter @runa/web typecheck`, `pnpm --filter @runa/web lint`, `pnpm --filter @runa/web build`, `pnpm --filter @runa/server typecheck` ve `pnpm --filter @runa/server test` bu logout/profile hardening turu sonrasi da yesil kaldi.
- Sprint 10 icin responsive layout + accessibility hardening turu tamamlandi.
- `AppShell`, `AppNav`, `LoginPage`, `DashboardPage`, `SettingsPage` ve ilgili auth/chat component'leri uzerinde dar ekran davranisi sertlestirildi; buton satirlari auto-fit grid akisina cekildi, kartlarin min-width/overflow davranisi iyilestirildi ve nav/shell/chat yuzeyleri mobil/tablet genisliklerde daha guvenli sikismaya basladi.
- Authenticated shell ve auth page'lerde landmark/heading yapisi netlestirildi; `header` / `main` ayrimi, form panel/tabpanel iliskileri, toggle `aria-expanded`/`aria-controls` baglantilari ve status/error live semantics ile keyboard/screen-reader akisi daha tutarli hale getirildi.
- Chat tarafinda primary vs operator hiyerarsisi korunarak operator controls ve transport messages panelleri daha secondary bir gorunum/agirlik kazandi; raw transport panel yuksekligi daraltildi, advanced toggles a11y attribute'lariyla baglandi ve hero surface'in yanlis heading reference'i duzeltildi.
- Bu tur bilincli olarak backend/auth logic, WS/runtime davranisi, protocol veya global state yapisini degistirmedi; yalniz mevcut inline-style sistemi icinde additive responsive ve accessibility hardening uygulandi.
- `pnpm --filter @runa/web typecheck`, `pnpm --filter @runa/web lint` ve `pnpm --filter @runa/web build` bu responsive/a11y hardening sonrasi da yesil kaldi.
- Sprint 10 icin current-run progress ve approval UX polish turu tamamlandi.
- `apps/web/src/lib/chat-runtime/current-run-progress.ts` ile mevcut `run.accepted`, `runtime.event`, `run.finished`, `run_timeline_block` ve `approval_block` yuzeylerinden sahte step uretmeden current run progress ozeti turetildi.
- `RunProgressPanel`, `RunStatusChips` ve `ApprovalSummaryCard` ile current run icin daha belirgin bir primary surface eklendi; runtime fazlari, gozlenen son adimlar ve approval boundary ayni panelde toplanirken operator/debug yuzeyleri secondary kaldi.
- `ApprovalPanel` daha acik aksiyon dili ve karar baglami ile sertlestirildi; pending durumunda run'in durdugu nokta daha gorunur hale gelirken approved/rejected sonucunda karar etkisi ayni kart icinde okunur oldu.
- Bu tur bilincli olarak WS/server protocol, auth flow, global state yapisi veya backend capability genisletmesi acmadi; yalnizca mevcut frontend presentation/runtime verisini additive sekilde yeniden kullandi.
- `pnpm --filter @runa/web typecheck`, `pnpm --filter @runa/web lint` ve `pnpm --filter @runa/web build` bu polish turu sonrasi yesil kaldi.

### Track A / Sprint 7.1 - Realtime Streaming (P0 Audit Gap) - 18 Nisan 2026

- `apps/server/src/ws/run-execution.ts` icindeki `executeLiveRun()` fonksiyonunda realtime streaming eklendi.
- `appendAndSendRuntimeEvent()` helper'i ile her runtime event hem accumulation array'ine ekleniyor hem aninda `sendServerMessage()` ile WS'ye basiliyor.
- `turn.started` yield'inde `createLoopTurnStartedEvents()` ile uretilen event'ler aninda stream ediliyor.
- `turn.progress` yield'inde `isRuntimeEvent()` guard'ini gecen event'ler aninda stream ediliyor; non-runtime event'ler yalniz persistence icin accumulate ediliyor.
- Post-loop bloktaki eski toplu `for (const event of result.runtime_events)` gonderim loop'u kaldirildi; duplicate gonderim onlendi.
- Persistence akisi (`persistEvents`, `persistLiveMemoryWrite`) ve presentation block assembly korundu - bunlar hala run sonunda calisiyor.
- `run.finished` mesaji yalniz bir kez, loop tamamlandiktan sonra gonderiliyor.
- WS protocol contract'i degistirilmedi - ayni mesaj tipleri, farkli zamanlama (incremental vs toplu).
- Frontend `useChatRuntime` hook'undaki mevcut incremental message merge mantigi yeterli goruldu, degisiklik gerekmedi.
- Test dosyalarindaki WS mesaj sirasi beklentileri incremental streaming'e gore guncellendi.
- `pnpm typecheck`, `pnpm lint` ve `pnpm test` yesil.
- **GAP-01 (P0) kapatildi.**

### Track C / Sprint 10 - ChatPage Block Renderer + Style Extraction (P0 Audit Gap) - 18 Nisan 2026

- `apps/web/src/lib/chat-styles.ts` ile 40+ paylasilan CSSProperties objesi tek dosyaya toplandi.
- `apps/web/src/components/chat/PresentationBlockRenderer.tsx` ile 10+ block render fonksiyonu ve yardimcilari ChatPage.tsx disina cikarildi.
- ChatPage.tsx satir sayisi ~3359'dan 1625'e dustu.
- Davranis degisikligi yok; yalniz modul siniri cizildi.
- `pnpm --filter @runa/web typecheck`, `pnpm --filter @runa/web lint` ve `pnpm --filter @runa/web build` yesil.
- **GAP-02 (P0) kapatildi.**

### Track A / Sprint 7.2 - Repeated Tool Call + Stagnation Detection (P1 Audit Gap) - 18 Nisan 2026

- `packages/types/src/agent-loop.ts` icinde `RepeatedToolCallStopReason` ve `StagnationStopReason` tipleri `StopReason` union'a eklendi.
- `AgentLoopStopConditionConfig` icine `max_repeated_identical_calls` (varsayilan: 3) ve `stagnation_window_size` (varsayilan: 6) opsiyonel alanlari eklendi.
- `apps/server/src/runtime/stop-conditions.ts` icinde `ToolCallSignature` tipi, `evaluateRepeatedToolCall` ve `evaluateStagnation` kurallari eklendi; kural sirasi: cancellation > max_turns > repeated_tool_call > stagnation > tool_failure > ...
- `apps/server/src/runtime/agent-loop.ts` icinde session-scope son 20 tool call buffer'i eklendi; her turn sonrasi `updateRecentToolCalls()` ile guncelleniyor, `buildStopConditionsSnapshot()`'a parametre olarak geciriliyor.
- Arg hash icin Node.js built-in `crypto.createHash('sha256')` kullanildi; ek dependency eklenmedi.
- History in-memory ve session-scope kaldi; disariya expose edilmedi.
- Stop condition ve agent loop testleri eklendi; 538 test gecti.
- `pnpm typecheck`, `pnpm lint` ve `pnpm test` yesil.
- **GAP-03 (P1) kapatildi.**

### Track A / Sprint 7.3 - Shell Exec Argument Risk Scoring (P1 Audit Gap) - 18 Nisan 2026

- `apps/server/src/tools/shell-exec.ts` icinde tehlikeli komut pattern tespiti eklendi; `data_destruction`, `system_control`, `network_exfiltration` ve `privilege_escalation` kategorilerinde bilinen yikici komutlar execution oncesi bloke ediliyor.
- Workspace path boundary kontrolu eklendi; working_directory workspace siniri disina cikamaz.
- `evaluateCommandRisk()` ve `CommandRiskAssessment` export edildi; ileride permission engine entegrasyonu icin hazir.
- `ToolErrorCode` yuzeyindeki `PERMISSION_DENIED` yolu shell safety bloklari icin kullanildi.
- Shell exec testleri genisletildi; tehlikeli komut bloklama, guvenli komut gecisi ve workspace boundary senaryolari dogrulandi.
- `pnpm typecheck`, `pnpm lint` ve `pnpm test` yesil.
- **GAP-04 (P1) kapatildi.**

### Track A / Sprint 7.4 - Proactive Token Budget Guard (P1 Audit Gap) - 18 Nisan 2026

- `packages/types/src/agent-loop.ts` icinde kumulatif token usage yuzeyi ve `token_budget_reached` stop reason tipi eklendi.
- `apps/server/src/runtime/agent-loop.ts` icinde model response `usage` alanlari session-scope biriktirilir hale getirildi; token usage snapshot'a tasiniyor.
- `apps/server/src/runtime/stop-conditions.ts` icine proaktif token budget guard kurali eklendi; config'teki input, output ve total token limitleri %90 esiginde provider reddinden once terminal stop uretiyor.
- Token limitleri tanimli degilse guard pasif kaliyor; mevcut loop davranisi korunuyor.
- `apps/server/src/runtime/token-limit-recovery.ts` korunarak reactive 413 compact+retry mekanizmasi ile complementer calisacak sekilde birakildi.
- Stop condition ve agent loop testleri genisletildi; input/output/total limit asimi, limit yokken devam ve kumulatif usage snapshot senaryolari dogrulandi.
- `pnpm typecheck`, `pnpm lint` ve `pnpm test` yesil.
- **GAP-05 (P1) kapatildi.**

### Track A / Sprint 7.5 - LLM-Based Context Compaction Summarizer (P2 Audit Gap) - 18 Nisan 2026

- `apps/server/src/context/compaction-strategies.ts` icine `ModelGateway.generate()` kullanan LLM tabanli summarizer factory eklendi.
- Yeni summarizer `ContextCompactionSummarizer` kontratina uyuyor ve `createMicrocompactStrategy({ summarizer: llmSummarizer })` ile enjekte edilebiliyor.
- Summarizer prompt'u `target_tokens` ve `target_token_range` bilgisini kullanarak output token butcesini ve source prompt boyutunu kontrollu sekilde yonetiyor.
- `defaultMicrocompactSummarizer` korunarak deterministic fallback olarak birakildi; LLM cagrisi bos veya hatali sonuc donerse fallback devreye giriyor.
- Mock gateway ile LLM summarizer cagrisi, fallback davranisi ve strategy injection akisi testlerle dogrulandi.
- `pnpm typecheck`, `pnpm lint` ve `pnpm test` yesil.
- **GAP-06 (P2) kapatildi.**

### Track A / Sprint 7.6 - Incremental Presentation Block Assembly (P2 Audit Gap) - 18 Nisan 2026

- `apps/server/src/ws/run-execution.ts` icinde agentic loop `turn.completed` anlarina baglanan additive presentation observer eklendi; yeni tool result ve approval block'lari run bitmeden aninda `presentation.blocks` mesaji ile WS'ye gidiyor.
- `apps/server/src/ws/presentation.ts` icine `createAutomaticTurnPresentationBlocks(...)` eklendi; `tool_result`, `code_block`, `diff_block`, `search_result_block`, `web_search_result_block` ve `approval_block` turn-bazli incremental akista reuse edilir hale geldi.
- Incremental akista carry-forward snapshot tekrarlarina karsi tool result `call_id` ve approval `approval_id` tabanli tekrar-yayin engeli eklendi; ayni block ayni turn-sonrasi ikinci kez push edilmiyor.
- Run sonu `createAdditionalPresentationBlocks()` korunarak final reconciliation yolu acik birakildi; `workspace_inspection_block`, `run_timeline_block` ve `trace_debug_block` halen run sonunda tek reconciliation yuzeyi olarak gonderiliyor.
- WS integration testleri genisletildi; canli tool-result, git diff, search.codebase, web.search ve approval-required akislarda incremental `presentation.blocks` sirasi ve final reconciliation davranisi dogrulandi.
- `pnpm typecheck`, `pnpm lint` ve `pnpm test` yesil.
- **GAP-07 (P2) kapatildi.**

### Track A / Sprint 7.7 - Prompt Injection Guardrails + .runaignore (P2 Audit Gap) - 18 Nisan 2026

- `apps/server/src/utils/sanitize-prompt-content.ts` ile role-tag prompt injection guardrail seam'i eklendi; `<system>`, `<user>`, `<assistant>` ve kapanis tag'lari encode edilerek prompt-level kontrol marker'larinin dogrudan yorumlanmasi engellendi.
- `apps/server/src/utils/runa-ignore.ts` ile workspace-root tabanli `.runaignore` matcher eklendi; default olarak `/.git/` ve `/node_modules/` her zaman ignore edilirken proje icindeki `.runaignore` pattern'leri (glob benzeri `*`, `**`, `?`) additive olarak uygulaniyor.
- `apps/server/src/context/compose-workspace-context.ts` `.runaignore` aware hale getirildi; top-level signal taramasi ignore kurallarini uygular, ignore edilen `README`/`package.json` sinyalleri context'e dahil edilmez, README kaynakli metinler sanitize edilir.
- `apps/server/src/tools/file-read.ts` ignored path icin typed `PERMISSION_DENIED` dondurecek sekilde sertlestirildi (`Ignored by .runaignore`); basarili read output'u sanitize katmanindan gecirilir.
- `apps/server/src/tools/search-codebase.ts` `.runaignore` ile entegre edildi; ignored root ve ignored path'ler search yuzeyinden cikartildi, matched line snippet'lari sanitize edilir hale getirildi.
- `apps/server/src/tools/web-search.ts` provider kaynakli title/snippet/freshness metinleri sanitize katmanindan gecirilir hale getirildi.
- Yeni/gelistirilmis testler: `compose-workspace-context.test.ts`, `file-read.test.ts`, `search-codebase.test.ts`, `web-search.test.ts`, `utils/sanitize-prompt-content.test.ts`, `utils/runa-ignore.test.ts`.
- `pnpm typecheck`, `pnpm lint` ve `pnpm test` yesil.
- **GAP-08 (P2) kapatildi.**

### Track C / Sprint 10 - React Router Entegrasyonu (P2 Audit Gap) - 18 Nisan 2026

- `apps/web/package.json` altina `react-router-dom` bagimliligi eklendi; authenticated shell icin URL-driven navigation zemini acildi.
- `apps/web/src/App.tsx` icinde `useState` tabanli local page switch kaldirildi; authenticated durumda `BrowserRouter + Routes` ile `/dashboard`, `/chat` ve `/settings` route'lari tanimlandi.
- Root path (`/`) authenticated shell altinda `dashboard` route'una yonlendirilir hale getirildi; bilinmeyen path'ler icin de kontrollu fallback eklendi.
- `AppShell` layout katmani korunarak route cocuklarini `Outlet` uzerinden render eder hale getirildi; auth gate davranisi (`LoginPage` vs authenticated shell) korunmaya devam etti.
- `apps/web/src/components/app/AppNav.tsx` icinde `onNavigate` callback tabanli butonlar `NavLink` tabanli URL navigation'a cevrildi; menu sekmeleri artik browser history ile dogal sekilde senkron.
- `DashboardPage` quick action butonlari route-aware `navigate('/chat')` ve `navigate('/settings')` davranisina baglandi; gorsel davranis degismeden URL senkronizasyonu saglandi.
- `pnpm --filter @runa/web typecheck`, `pnpm --filter @runa/web lint` ve `pnpm --filter @runa/web build` yesil.
- **GAP-09 (P2) kapatildi.**

### Track A / Sprint 11 - WS Guard Consolidation (P3 Audit Gap) - 18 Nisan 2026

- `packages/types/src/ws-guards.ts` eklendi; daha once web (`ws-client.ts`) ve server (`transport.ts`) tarafinda ayri duran websocket payload guard mantigi tek shared seam altinda toplandi.
- `packages/types/src/index.ts` guncellendi; `ws-guards` export edilerek `@runa/types` uzerinden her iki tarafa da ortak guard import yolu acildi.
- `apps/web/src/lib/ws-client.ts` icindeki server-message candidate + guard zinciri kaldirildi; `isConnectionReadyServerMessage`, `isRunAcceptedServerMessage`, `isRuntimeEventServerMessage`, `isRunRejectedServerMessage`, `isRunFinishedServerMessage`, `isPresentationBlocksServerMessage` dogrudan `@runa/types` uzerinden kullanilir hale getirildi.
- `apps/server/src/ws/transport.ts` icindeki client-message candidate + guard zinciri kaldirildi; parse hattinda `isRunRequestClientMessage`, `isApprovalResolveClientMessage`, `isInspectionRequestClientMessage` shared guard'lari kullanildi.
- Bu tur bilincli olarak WS protocol contract'ini degistirmedi; yalnizca validation kodu tek kaynaga tasindi ve duplicative guard mantigi temizlendi.
- `pnpm --filter @runa/types typecheck` ve `pnpm --filter @runa/web typecheck` yesil.
- `pnpm --filter @runa/server typecheck` bu snapshot'ta pre-existing ambient type/env baseline nedeniyle (Node globals ve `node:*` module typings eksikligi) kirmizi kaldi; GAP-10 degisikligi disinda repo-wide bir blocker olarak not edildi.
- **GAP-10 (P3) kod tekrarini giderme implementasyonu tamamlandi; formal closure repo-wide server typecheck blocker'i temizlendikten sonra kesinlestirilecek.**

### Track A / Sprint 11 - Ambient Typings Blocker Resolution (GAP-10.1) - 18 Nisan 2026

- `apps/server/package.json` icine `@types/node` devDependency eklendi ve lockfile guncellendi.
- `apps/server/tsconfig.json` icine `compilerOptions.types = [\"node\"]` eklendi; `Buffer`, `process`, `fetch`, `AbortController`, `Response`, `Request` ve `node:*` module typings eksikligi nedeniyle kirilan ambient typecheck hatti duzeltildi.
- `pnpm --filter @runa/server typecheck` tekrar yesile dondu.
- Dogrulama kapsaminda `pnpm --filter @runa/types typecheck`, `pnpm --filter @runa/utils typecheck`, `pnpm --filter @runa/db typecheck`, `pnpm --filter @runa/web typecheck` ve `pnpm --filter @runa/server typecheck` komutlari birlikte yesil kaldi.
- **GAP-10 typecheck blocker resolved.**

### Docs Hardening - Onboarding Authority Refresh - 18 Nisan 2026

- `AGENTS.md` aktif faz, track durumu ve bugunku kod giris noktalari ile yeniden hizalandi; Sprint 9/10 gercegi ve planli ama henuz repoda olmayan alanlar net ayrildi.
- `README.md` onboarding giris kapisi olarak guncellendi; eski monolit odak yerine WS split, auth shell, pages/hooks ve shared guard yuzeyleri one cekildi.
- `docs/technical-architecture.md` ve `docs/AI-DEVELOPMENT-GUIDE.md` icinde mevcut repo gercegiyle catisan ust seviye onboarding notlari dar kapsamda duzeltildi.
- Bu tur kod davranisi degistirmedi; yalnizca belge setinin guvenilirligi ve ilk-okuma otoritesi sertlestirildi.

### Track B / Sprint 10 - Supabase Default Auth Verifier Hardening - 18 Nisan 2026

- Login ekraninda anonymous durumda kalmaya yol acan eksik runtime verifier yolu kapatildi.
- `apps/server/src/auth/supabase-auth.ts` icine env-backed default Supabase token verifier seam'i eklendi; access token payload'i JWT claim'lerine normalize edilirken kullanici token'i `/auth/v1/user` uzerinden dogrulaniyor, service-role token ise mevcut env key ile eslesirse network cagrisi olmadan typed service principal'a donusebiliyor.
- `apps/server/src/app.ts` artik custom `verify_token` inject edilmediginde mevcut `SUPABASE_URL` + `SUPABASE_ANON_KEY` env'i ile bu default verifier'i otomatik bagliyor; boylece `/auth/login`, `/auth/context`, protected HTTP ve WS auth yollarinda stub verifier yerine gercek runtime yol kullaniliyor.
- Fokus testler genisletildi: `apps/server/src/auth/supabase-auth.test.ts` env-backed verifier davranisini, `apps/server/src/app.test.ts` ise default verifier ile login action yolunu dogruluyor.
- `pnpm.cmd --filter @runa/server typecheck`, `pnpm.cmd --filter @runa/server lint` ve `pnpm.cmd --filter @runa/server test` yesil.
- Non-goal hatirlatmasi: repo'nun `.env` dosyasini otomatik shell env'ine yukleme davranisi bu turda degistirilmedi; yerel calistirmada mevcut shell/env config otoritesi korunuyor.
- Sonraki onerilen gorev: local onboarding icin `.env` -> shell yukleme adimini README/dev runbook'ta Supabase auth ornegiyle daha gorunur hale getirmek ya da istenirse ayri bir docs/dev-bootstrap gorevi acmak.

### Track C / Sprint 10 - Auth Bootstrap Loop Guard - 18 Nisan 2026

- Login ekraninda backend gecici olarak ulasilamazken `useAuth` bootstrap effect'i tekrarli sekilde kendi kendini tetikleyip `Maximum update depth exceeded` render loop'una giriyordu.
- `apps/web/src/hooks/useAuth.ts` icinde bootstrap effect'ine `useRef` tabanli tek-sefer guard eklendi; effect dependency disiplini korunurken ilk mount sonrasi auth bootstrap yeniden tetiklenmez hale getirildi.
- Bu tur auth/server contract'ina, `/auth/context` fetch surface'ine veya login/signup davranisina dokunmadi; yalnizca frontend bootstrap orchestration'inin loop'a girmesi engellendi.
- `pnpm.cmd --filter @runa/web typecheck`, `pnpm.cmd --filter @runa/web lint` ve `pnpm.cmd --filter @runa/web build` yesil.
- Sonraki onerilen gorev: dev runtime icin stale port/process cleanup adimini README veya runbook'a kisa bir troubleshooting notu olarak eklemek.

### Track B / Sprint 10 - Server Dev .env Autoload Seam - 18 Nisan 2026

- `apps/server/scripts/dev.mjs` icine dependency eklemeden repo-root `.env` autoload seam'i eklendi.
- Dev bootstrap artik `pnpm dev` sirasinda `D:\ai\Runa\.env` dosyasini okuyup yalniz eksik process env alanlarini dolduruyor; mevcut shell/IDE env degerleri override edilmiyor.
- Parser bos satirlari, `#` / `//` yorumlarini ve basit tek-cift tirnakli degerleri tolere edecek kadar dar tutuldu; yalnizca gelistirme bootstrap'ine dokunuldu, production/runtime env otoritesi degistirilmedi.
- `README.md` onboarding notu guncellendi; repo-geneli env authority korunurken `@runa/server` dev bootstrap'inin additive `.env` yukleme davranisi acikca yazildi.
- `node --check apps/server/scripts/dev.mjs` ve `pnpm.cmd --filter @runa/server test` ile degisiklik sonrasi syntax ve mevcut server davranisi dogrulandi.
- Sonraki onerilen gorev: stale port/process cleanup adimini de ayni dev runbook notuna ekleyerek ilk kurulum sorunlarini tek yerde toplamak.

### Track C / Sprint 10 - WebSocket Reconnect + Visible Submit Connection State - 18 Nisan 2026

- `apps/web/src/hooks/useChatRuntime.ts` icinde live WebSocket baglantisi icin additive reconnect seam'i eklendi; gecici close/error sonrasi frontend backoff ile tekrar baglanmayi deniyor, auth-rejected `1008` close durumu ise durustce hata olarak tutuluyor.
- `submitRunRequest()` baglanti hazir degilken artik daha anlasilir kullanici-mesaji uretiyor; yalnizca `WebSocket is not open.` yerine bekleme/reconnect baglami gorunur hale getirildi.
- `apps/web/src/components/chat/OperatorControlsPanel.tsx` ve `apps/web/src/hooks/useChatRuntimeView.ts` uzerinden butonun neden tepkisiz/pasif kaldigi form icinde gorunur hale getirildi; connecting ve unavailable durumlari icin inline notice ve daha durust submit label'lari eklendi.
- Bu tur WS/server contract'ina, auth flow'una veya runtime davranisina dokunmadi; yalnizca frontend connection orchestration ve gorunurluk sertlestirildi.
- `pnpm.cmd --filter @runa/web typecheck`, `pnpm.cmd --filter @runa/web lint` ve `pnpm.cmd --filter @runa/web build` ile dogrulama hedeflendi.
- Sonraki onerilen gorev: chat giris panelindeki operator dili/copy'sini urun diliyle sadeleştirip teknik panelleri varsayilan yuzeyden daha da geri cekmek.

### Track B / Sprint 10 - WebSocket Subscription Default Baseline Fix - 18 Nisan 2026

- Canli chat yuzeyinde `ERROR WS` ve `Subscription context is unavailable for this feature.` blokaji yaratan WS gate sirasi duzeltildi.
- `apps/server/src/ws/ws-subscription-gate.ts` artik HTTP auth surface ile uyumlu sekilde missing subscription resolver/context durumunda default active free-tier baseline'a dusuyor; boylece free websocket erisimi resolver inject edilmedigi icin gereksiz yere reddedilmiyor.
- Custom resolver aktif oldugunda gelen gercek subscription context halen kullaniliyor; inactive subscription ve tier-restricted gate davranisi korunuyor.
- `apps/server/src/ws/ws-subscription-gate.test.ts` beklentileri yeni baseline davranisina gore guncellendi; missing context senaryosu `connection.ready` alirken inactive ve pro-gated free-tier baglantilar kapanmaya devam ediyor.
- `pnpm.cmd --filter @runa/server typecheck`, `pnpm.cmd --filter @runa/server lint`, `pnpm.cmd exec tsc` ve `pnpm.cmd exec vitest run dist/ws/ws-subscription-gate.test.js --config ./vitest.config.mjs --configLoader runner` yesil.
- Non-goal hatirlatmasi: subscription billing backend'i, quota enforcement ve WS protocol sekli bu turda degistirilmedi.
- Sonraki onerilen gorev: chat page icin product-first copy sadeleştirmesi ve operator/debug yuzeylerini varsayilan deneyimden daha da geriye cekmek.

---

## Teknik Borc (Tech Debt) & Known Gaps

> **Kaynak:** 2026-04-18 tarihli kapsamli mimari denetim (Architectural Audit).
> Bu bolum yalnizca acik kalan gap'leri listeler. Kapanan gap'ler asagida arsive tasinmistir.

### P3 - Acik Gaplar

#### [GAP-11] In-Memory Store'larin Kalicilastirilmasi
- **Mevcut:** `approval-store.ts` ve `policy-wiring.ts` WeakMap uzerinden in-memory state tutuyor. Server restart = state kaybi.
- **Etki:** Restart veya deploy sonrasi pending approval/policy baglami kaybolabiliyor; uzun oturumlarda operasyonel risk olusuyor.
- **Hedef:** Session/policy/approval state'ini process-disina tasiyan kalici persistence seam'i (DB veya uygun persistent store) eklemek.
- **Tetikleyici:** Cloud deployment sirasinda.
- **Ilgili dosyalar:** `apps/server/src/persistence/approval-store.ts`, `apps/server/src/ws/policy-wiring.ts`, `apps/server/src/ws/transport.ts`

#### [GAP-12] Eksik Desktop Yetenekler (screen.capture, browser.interact, semantic search)
- **Mevcut:** Sprint 11 blueprint'inde tanimli `apps/desktop-agent/` package'i ve desktop tool yuzeyleri repoda henuz yok.
- **Etki:** Desktop kabuk, uzaktan etkilesim ve semantic search odakli Phase 3 capabilities devreye alinamiyor.
- **Hedef:** `apps/desktop-agent` kurulumu, `desktop.screenshot` / `desktop.click` / `desktop.type` tool'lari ve secure WSS bridge/auth akisinin eklenmesi.
- **Tetikleyici:** Sprint 11 (Desktop Agent) ve Phase 3.
- **Ilgili dosyalar:** `implementation-blueprint.md`, `apps/desktop-agent/` (planlanan), `apps/server/src/tools/`, `packages/types/src/`

### Arsivlenen Audit Gaplari (18 Nisan 2026)

- GAP-01: Realtime Streaming (kapatildi)
- GAP-02: ChatPage Block Renderer + Style Extraction (kapatildi)
- GAP-03: Repeated Tool Call + Stagnation Detection (kapatildi)
- GAP-04: Shell Exec Argument Risk Scoring (kapatildi)
- GAP-05: Proactive Token Budget Guard (kapatildi)
- GAP-06: LLM-Based Context Compaction Summarizer (kapatildi)
- GAP-07: Incremental Presentation Block Assembly (kapatildi)
- GAP-08: Prompt Injection Guardrails + `.runaignore` (kapatildi)
- GAP-09: React Router Entegrasyonu (kapatildi)
- GAP-10: WS Guard Consolidation (kapatildi; GAP-10.1 ile typecheck blocker temizlendi)

### Arsivlenmis Onceki Notlar

1. **WS Cleanup Gaps:** `register-ws.ts` Sprint 9'da parcalandi. Orchestration/presentation akisinda daha derin cleanup ihtiyaci suruyor.
2. **Memory Seams:** Semantic search kapasitesi henuz yok. (Phase 3)
3. **Cloud / Local Ayrimi:** Persist path'i local DB'ye bagimli. Hybrid WSS token uzerinden cloud'a acilmali.
