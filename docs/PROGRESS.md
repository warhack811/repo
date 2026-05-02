# Runa - Operasyonel Durum Kaydi

> Bu belge, Runa projesinin kronolojik ilerleyisini ve yonunu kaydeder.
> Detaylar, kararlar ve teknik debt buraya listelenir.
> Sprint 1-6 (MVP Phase 1) detaylari icin bkz: `docs/archive/progress-phase1.md`
> Ekip kararlari icin bkz: `docs/archive/cevap-ekip-kararlari.md`

## Mevcut Durum Ozeti

- **Tarih:** 2 Mayıs 2026
- **Faz:** Core Hardening (Phase 2) - Sprint 9/10 kabul edilmiş işleri repoda, DeepSeek Tool Call Recovery (Faz 1-4) tamamlandı.
- **Vizyon:** Basit kullanıcıdan teknik uzmana kadar herkesin kullanabileceği, otonom ve uzaktan kontrol yeteneklerine sahip, cloud-first bir AI çalışma ortağı.
- **Odak:** DeepSeek + Groq dual-baseline stabilitesi, tool-call resilience, otonom agent-loop hardening ve desktop companion rollout.
- **Son Önemli Olay:** 2026-05-02 tarihinde "DeepSeek Tool Call Recovery" (Faz 1-4) başarıyla tamamlandı; Runa artık bozuk model çıktılarını kendi kendine onarabiliyor, token-limit recovery yolunu agent-loop adapter içinde kullanabiliyor ve DeepSeek ana üretim yolu (primary baseline) olarak onaylandı.

### TASK-RESILIENCE-04 - 2 Mayıs 2026 (Faz 4)

- Kapsam: `token-limit-recovery` agent-loop adapter yolunda three-way field deseniyle wire edildi (`undefined` default, `null` opt-out, instance pass-through).
- Default Kararı: `createMicrocompactStrategy()` içindeki default summarizer heuristik olduğu, LLM veya external dependency çağırmadığı için token-limit recovery default açık bırakıldı.
- Telemetry: `token-limit-recovery` ve `tool-call-repair-recovery` için yapılandırılmış `on_event` callback'leri eklendi; `model.completed` metadata'sına recovery stamp'i işlendi. Yeni runtime event tipi eklenmedi.
- Doğrulama:
  - `pnpm.cmd --filter @runa/server typecheck` PASS
  - `pnpm.cmd --filter @runa/server lint` PASS
  - `pnpm.cmd --filter @runa/server test` PASS
- Sonuç: Repair recovery, token-limit recovery ve recovery telemetry aynı agent-loop adapter yüzeyinde default davranışla kapanmış oldu.

### TASK-RESILIENCE-03 - 2 Mayıs 2026 (Faz 3)

- Kapsam: `tool-call-repair-recovery` mekanizması agent-loop yolunda (`run-model-turn-loop-adapter.ts`) varsayılan (default) hale getirildi ve tüm ana gateway'ler (Claude, Gemini, Groq, OpenAI, SambaNova) "structured rejection details" sistemine taşındı.
- Default Wiring: `createRunModelTurnLoopExecutor` artık `tool_call_repair_recovery` parametresi verilmezse otomatik olarak bir instance oluşturup enjekte ediyor. `null` geçilerek açıkça devre dışı bırakılabilir (opt-out).
- Universal Migration: Tüm gateway'ler `parseToolCallCandidatePartsDetailed` kullanacak şekilde güncellendi. Artık her sağlayıcı hata anında `reason`, `arguments_length`, `tool_name_raw` vb. içeren yapılandırılmış detaylar üretiyor.
- Groq Özel: Çoklu tool call adaylarında "all-unparseable" durumu için toplu kurtarma desteği eklendi; karma hatalarda (mixed) güvenlik gereği kurtarma tetiklenmiyor.
- Doğrulama:
  - `pnpm.cmd --filter @runa/server typecheck` PASS
  - `pnpm.cmd --filter @runa/server lint` PASS
  - `pnpm.cmd --filter @runa/server test -- tool-call-repair-recovery gateway run-model-turn-loop-adapter` PASS (`941` toplam test içinde ilgili tüm testler yeşil).
- Sonuç: Runa'nın "self-repair" yeteneği tüm modeller için evrensel hale getirildi ve üretim yolunda (production path) aktifleşti.

### TASK-RESILIENCE-02 - 2 Mayıs 2026 (Faz 2)

- Kapsam: Runtime katmanına, modelin bozuk JSON çıktılarını tek seferlik uyarıyla düzeltmesini sağlayan `Tool Call Repair Recovery` mekanizması eklendi.
- Mimari: `token-limit-recovery` deseni birebir taklit edilerek `apps/server/src/runtime/tool-call-repair-recovery.ts` dosyası oluşturuldu. Mantık tamamen runtime katmanında izole edildi (gateway bağımsız).
- Recovery Akışı: `unparseable_tool_input` hatası alındığında, model request'ine özel bir system mesajı eklenerek tek seferlik (`max_retries: 1`) yeniden deneme (retry) başlatılıyor.
- Güvenlik: `missing_call_id` veya `invalid_tool_name` gibi yapısal hatalar "güvenli liman" ilkesi gereği kurtarma kapsamı dışında tutuldu.
- Doğrulama:
  - `apps/server/src/runtime/tool-call-repair-recovery.test.ts` eklendi (Unit testler PASS).
  - `run-model-turn.ts` entegrasyonu tamamlandı ve test edildi.

### TASK-RESILIENCE-01 - 2 Mayıs 2026 (Faz 1)

- Kapsam: DeepSeek gateway'inde streaming sırasında yaşanan "invalid tool call candidate" hatasını çözmek için "Structured Rejection Details" sistemi kuruldu.
- Parser Güçlendirme: `tool-call-candidate.ts` içinde boş argümanların (`undefined`/`null`/whitespace) otomatik olarak `{}` olarak kabul edilmesi sağlandı.
- Hata Detayları: `GatewayResponseError` fırlatılırken üçüncü argüman (`details`) içine hatanın teknik nedeni (`reason`), argüman uzunluğu ve ham isimler eklendi.
- Alias Dayanıklılığı: DeepSeek'in `_` ve `-` karakterlerini karıştırmasına karşı "conservative fallback" (tek eşleşme varsa kurtar) mantığı eklendi.
- Doğrulama: DeepSeek streaming testleri ve parametresiz tool call senaryoları doğrulandı.

### Backend EvidenceCompiler + SearchProvider Foundation - 1 Mayis 2026

- Kapsam: frontend production-lock sonrasi backend `EvidencePack` ve transport error sozlesmesini besleyecek provider-agnostic arama/evidence katmani kuruldu. Frontend dosyalarina dokunulmadi.
- `SearchProvider` arayuzu ve Serper adapter eklendi; Serper HTTP/rate-limit/timeout/network hatalari frontend catalog uyumlu transport kodlarina map ediliyor.
- `EvidenceCompiler` pipeline eklendi: URL canonicalization, tracker param temizligi, provider date parse, canonical/text dedup, statik source trust score, recency ranking ve compact model context.
- `web.search` mevcut registry/dispatch hattinda kalacak sekilde EvidenceCompiler'a baglandi. `web_search_result_block` backward-compatible kaldi ve additive `evidence`, `sources`, `searches`, `result_count`, `truncated`, `unreliable` alanlariyla genisletildi.
- Intent classifier Turkce/Ingizlice news/research/general keyword setleriyle eklendi.
- Dogrulama:
  - `pnpm.cmd --filter @runa/server typecheck` PASS
  - `pnpm.cmd --filter @runa/server lint` PASS
  - Targeted Vitest PASS: Serper provider, intent classifier, EvidenceCompiler, web.search, web-search presentation mapper
  - WS targeted PASS: `src/ws/register-ws.test.ts -t "resolves web.search"`
  - `pnpm.cmd --filter @runa/server test` PASS (`132` dosya / `899` test)
- Live Serper smoke: shell `SERPER_API_KEY` missing, `.env` fallback present; `.env` fallback ile 10 sorgu PASS, toplam latency `8305ms`, tum tekil sorgular `<2s`.
- Kalan sinirlar: browser-level frontend Sources panel smoke kosulmadi; HTML meta-date/full-content extraction config-gated follow-up olarak birakildi; statik trust config henuz dar ve neutral score fazlasi var.

### Evidence Sources Panel Browser Proof - 1 Mayis 2026

- Kapsam: Backend EvidenceCompiler ciktilarinin frontend `web_search_result_block` Sources panelinde gorunur oldugu browser seviyesinde kanitlandi. Backend provider, runtime, WS, auth, desktop-agent ve persistence kontratlari degistirilmedi.
- `WebSearchResultBlock` artik legacy `results` fallback'ini korurken `evidence`, `sources`, `searches`, `result_count`, `truncated` ve `unreliable` alanlarini oncelikli okuyor.
- Sources panelde canonical evidence source basligi, domain, canonical URL, published date ve trust score gorunur hale geldi; legacy result yalniz evidence source yoksa fallback olarak kullaniliyor.
- Browser proof icin `apps/web/tests/visual/evidence-sources-fixture.*` ve `evidence-sources-panel.spec.ts` eklendi. Desktop 1440 ve mobile 390 smoke, Sources paneli acip canonical source metadata'sini ve yatay overflow olmadigini dogruluyor.
- Dogrulama:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web lint` PASS
  - `pnpm.cmd --filter @runa/web test -- BlockRenderer` PASS (`7` test)
  - `pnpm.cmd exec playwright test apps/web/tests/visual/evidence-sources-panel.spec.ts --config playwright.config.ts` PASS (`2` test)
- Kalan sinirlar: HTML meta-date/full-content extraction henuz uygulanmadi; bu config-gated backend enrichment follow-up olarak kaldi. Statik trust config dar ve neutral score fazlasi ayrica ele alinacak.

### Docs Context Governance - 1 Mayis 2026

- docs/INDEX.md ve docs/LLM-CONTEXT.md eklendi. Amac, IDE LLM oturumlarinda tum docs/ klasorunu context'e yuklemek yerine bootstrap + gorev bazli okuma rotasi kullanmak.
- docs/PROGRESS.md aktif ledger olarak daraltildi; 29 Nisan 2026 ve onceki uzun Core Hardening kayitlari docs/archive/progress-2026-04-core-hardening.md altina tasindi.
- Tamamlanmis UI overhaul ve UI phase plan/prompt belgeleri arsivlendi: docs/archive/ui-overhaul/, docs/archive/ui-overhaul/prompts/, docs/archive/ui-phases/.
- Screenshot/evidence klasorleri LLM default context'i degildir; sadece gorsel audit veya migration kaniti gerekiyorsa tek tek acilir.
### Docs Reorg - Root Docs to `docs/` Migration - 30 Nisan 2026

- UI-OVERHAUL-07 final polish commit'i sonrasi kalan dirty root-doc reorganization ayri branch/commit kapsaminda toplandi.
- Kok onboarding ve roadmap belgeleri `docs/` altina tasindi: `AGENTS.md`, `implementation-blueprint.md`, `COWORK-GAP-ANALYSIS.md`, `karar.md`, `TASK-01...12` ve `UI-PHASE-1...7`.
- Yeni hedefler: `docs/AGENTS.md`, `docs/implementation-blueprint.md`, `docs/architecture/constitution.md`, `docs/tasks/`, `docs/archive/ui-phases/`.
- Eski `.env-ornek` / `.env.server.example` yerine tek `env.example` yuzeyi birakildi ve README ilk okuma notlari yeni `docs/` path'leriyle hizalandi.
- UI audit screenshot evidence klasorleri `docs/design-audit/screenshots/` altinda kalici kanit olarak takip altina alindi.
- Kapsam disi birakilanlar: `apps/web/vite.config.ts`, eski `apps/web/tests/visual/__screenshots__` baseline drift'i, `apps/server/approval-e2e-temp.txt` silinmesi ve `test.txt` silinmesi bu doc reorg commit'ine alinmadi.

### Cloud Production User Journey Proof Check - 30 Nisan 2026

- Kapsam: UI-OVERHAUL-07 kapanisi sonrasi production-readiness tarafina gecmek icin mevcut cloud/live proof kapilari yeniden kosuldu. Yeni runtime kodu yazilmadi.
- Shell env gercegi: `GROQ_API_KEY`, `DATABASE_TARGET`, `DATABASE_URL`, `LOCAL_DATABASE_URL`, `SUPABASE_DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RUNA_DEV_AUTH_ENABLED`, `RUNA_DEV_AUTH_SECRET` current shell icinde `missing` idi. File-backed env kontrolunde `.env` icinde Supabase/cloud DB anahtarlari, `.env.local` icinde local DB anahtarlari, `.env.compose` icinde compose/dev auth anahtarlari goruldu; secret degerleri loglanmadi.
- Repo/server sagligi: `pnpm --filter @runa/server typecheck` PASS, `pnpm --filter @runa/server lint` PASS, `pnpm --filter @runa/server test` PASS (`129` dosya / `866` test).
- Demo rehearsal: `pnpm --dir apps/server run test:groq-demo-rehearsal` PASS. `FORMAL_REPEATABILITY_SUMMARY result=PASS`, `passed_runs=5`; `CORE_COVERAGE_SUMMARY threshold_passed=true`, file coverage `%85.09`, LOC-weighted coverage `%86.78`; `GROQ_DEMO_REHEARSAL_SUMMARY result=PASS`.
- Primary provider gate: `pnpm --dir apps/server run test:groq-live-smoke` current shell'de `GROQ_LIVE_SMOKE_SUMMARY result=BLOCKED`, `blocker_kind=credential_missing`, `authoritative_env=GROQ_API_KEY`. Bu nedenle Groq live provider claim'i bugun acilmadi.
- Cloud persistence proof: `DATABASE_TARGET=cloud pnpm --filter @runa/server run test:persistence-release-proof` kismen gecti ama genel sonuc `BLOCKED`. Cloud DB CRUD `PASS`, first-run conversation proof `PASS`, `database_url_source=SUPABASE_DATABASE_URL`, `target=cloud`; fakat approval persistence/reconnect helper `database_target_not_local` nedeniyle `BLOCKED` dondu. Bu, cloud DB temel user journey yazma/okuma hattinin calistigini, fakat release-grade approval persistence proof'unun cloud target icin henuz tamamlanmadigini gosterir.
- Sonuc: production cloud user journey icin temel cloud DB + first-run conversation proof yesil, formal demo rehearsal yesil; tam production/live release claim'i ise iki nedenle acik degil: authoritative `GROQ_API_KEY` shell/env yok ve approval persistence proof cloud target'ta bloklu.

### Cloud Production User Journey Proof Closure - 30 Nisan 2026

- Kapsam: onceki cloud proof check'te kalan iki production blocker kapatildi: approval persistence/reconnect helper'in cloud target blokaji ve Groq live smoke icin tek komut credential authority akisi. UI, desktop, auth, websocket protocol ve runtime contract'lari yeniden tasarlanmadi.
- Approval persistence: `apps/server/scripts/approval-persistence-live-smoke.mjs` icindeki local-only target guard kaldirildi. Smoke artik random run/session id'leri ve mevcut cleanup adimlariyla hem local hem cloud database target uzerinde calisabiliyor; summary `database_target_supported=true` alanini raporluyor.
- Provider env authority: `apps/server/scripts/groq-live-smoke.mjs` yalniz `GROQ_API_KEY` ve opsiyonel `GROQ_MODEL` icin explicit local smoke env-file kaynagi okuyabilir hale geldi. Shell env halen birinci otorite; file-backed kullanim summary'de `source=".env"` veya `.env.local` olarak gorunuyor. DB env'leri Groq smoke subprocess'ine tasinmadi.
- Dirty worktree hijyeni: bu gorevle ilgisiz eski visual baseline drift'leri, gecici txt silmeleri ve unrelated `apps/web/vite.config.ts` diff'i geri alindi. Kalan diff yalniz cloud/live proof script'leri ve bu progress kaydi.
- GitHub PR/auth durumu: `gh auth status` halen `warhack811` icin invalid token raporluyor. Kod/push isi bundan bagimsiz ilerleyebilir; GitHub UI veya tazelenmis `gh auth login` gerektiren PR olusturma adimi operasyonel blocker olarak ayrildi.
- Dogrulama yesil:
  - `DATABASE_TARGET=cloud pnpm.cmd --filter @runa/server run test:persistence-release-proof` PASS. `PERSISTENCE_RELEASE_PROOF_SUMMARY result=PASS`, `failure_stage=null`, cloud DB CRUD PASS, first-run conversation PASS, approval persistence PASS, auto-continue restart `run.finished(COMPLETED)`.
  - `pnpm.cmd --dir apps/server run test:groq-live-smoke` PASS. `GROQ_LIVE_SMOKE_SUMMARY result=PASS`, `api_key_authority.source=".env"`, assistant/tool-schema/browser-shape stages PASS.
  - `pnpm.cmd --dir apps/server run test:groq-demo-rehearsal` PASS. Formal repeatability `passed_runs=5`; core coverage threshold PASS.
  - `pnpm.cmd --filter @runa/server typecheck` PASS.
  - `pnpm.cmd --filter @runa/server lint` PASS.
  - `pnpm.cmd --filter @runa/server test` PASS (`129` dosya / `866` test).

### Track C / UI Overhaul 07.4 - Operator/Developer Hard Isolation - 30 Nisan 2026

- `docs/archive/ui-overhaul/prompts/UI-OVERHAUL-07-4-OPERATOR-DEVELOPER-HARD-ISOLATION-PROMPT.md` kapsamindaki hard isolation uygulandi. Normal app shell artik `/developer*` path'lerini active page olarak `developer` basligiyla render etmiyor; clean session `/developer` ve `/developer/capability-preview` istekleri route gate uzerinden `/chat` yuzeyine donuyor.
- Normal user navigation Developer entry point tasimiyor. `AuthenticatedPageId` normal yuzeylerle sinirlandi (`account`, `chat`, `devices`, `history`) ve `AppShell` developer header copy mapping'i normal shell'den cikarildi. Developer tooling route olarak kaldi, ama nav/user flow icinden kesildi.
- Account/Settings hard isolation yapildi: Settings tab modeli yalniz `Hesap` ve `Tercihler` olarak daraltildi; daha once render edilebilir durumda duran `developer`, `devices`, `memory` panel branch'leri ve `useDeveloperMode` toggle/link baglantisi kaldirildi. Normal account yuzeyi Developer Mode toggle'i veya `/developer` link'i uretmiyor.
- Capability Preview internal QA araci olarak tutuldu, fakat disabled state artik kendi icinden Developer Mode etkinlestiremiyor. Explicit `runa_dev_mode=true` varsa `/developer/capability-preview` calisir; clean session ayni route'a user flow'dan erisemez.
- Chat composer normal yuzeyden dev mode self-enable callback'ini kaldirdi. Developer-only timeline, raw transport ve correlation visibility `isDeveloperMode` arkasinda kalmaya devam ediyor; normal composer `Developer Mode'u etkinlestir` veya `/developer` link'i render etmiyor.
- Yeni coverage:
  - `apps/web/src/pages/OperatorDeveloperIsolation.test.tsx`: normal nav, settings, capability preview disabled state ve normal composer isolation unit coverage.
  - `apps/web/tests/visual/ui-overhaul-07-4-isolation.spec.ts`: clean session `/developer*` redirect ve explicit developer flag ile internal tooling erisimi browser coverage.
- Dogrulama:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web lint` PASS
  - `pnpm.cmd --filter @runa/web test` PASS (`10` dosya / `28` test)
  - `pnpm.cmd run style:check` PASS (`violations=0`)
  - `pnpm.cmd run manifesto:check` PASS (`violations=0`)
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd exec playwright test apps/web/tests/visual/ui-overhaul-07-4-isolation.spec.ts --config playwright.config.ts` PASS (`2` test)
  - `pnpm.cmd test:e2e` PASS (`15` Playwright test; build dahil). Not: Playwright kapanisinda Vite WS proxy `write ECONNABORTED` loglari tekrar goruldu, fakat komut exit code `0` ve test sonucu PASS.
- Kapsam disi birakilanlar: `apps/server/**`, `apps/desktop-agent/**`, `packages/**`, auth/WS/provider/runtime/approval persistence contracts, yeni dependency, 7.5 secondary surface redesign, 7.6 visual discipline ve 7.7 copy voice pass. Developer-only route icerisindeki `dev@runa.local`, raw claims ve transport copy'leri internal tooling kapsaminda kaldigi icin normal user yuzeyi temizligi kapsaminda silinmedi.

### Track C / UI Overhaul 07.3 Follow-up - Approval Prompt & State Feedback - 30 Nisan 2026

- `docs/archive/ui-overhaul/prompts/UI-OVERHAUL-07-APPROVAL-UX-STATE-FEEDBACK-PROMPT.md` eklendi. Prompt, `Approval UX & State Feedback` kapsamÄ±nÄ±n `docs/archive/ui-overhaul/UI-OVERHAUL-07.md` icinde gercekte 7.3 oldugunu ve 7.4'un `Operator/Developer Hard Isolation` oldugunu acikca kaydediyor; approval kapsaminda kalinmasi ve hedef/path uydurulmamasi guardrail olarak yazildi.
- Aktif chat approval kartinda state feedback bolumu semantik `<output aria-live="polite">` ile erisilebilir durum geri bildirimi haline getirildi. Server, WebSocket, provider, approval persistence veya desktop-agent contract'i degismedi.
- Import aramasi ile kullanilmadigi dogrulanan legacy `apps/web/src/components/approval/ApprovalPanel.tsx` ve `ApprovalSummaryCard.tsx` kaldirildi; aktif approval path `apps/web/src/components/chat/blocks/ApprovalBlock.tsx` olarak kaldi.
- `BlockRenderer.test.tsx` approval coverage'i `24` toplam teste cikti: resolved approved/rejected kartlarda pending karar butonlarinin kayboldugu ve state feedback'in status olarak render edildigi dogrulaniyor.
- Dogrulama:
  - `pnpm.cmd --filter @runa/web test` PASS (`9` dosya / `24` test)
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web lint` PASS
  - `pnpm.cmd run style:check` PASS (`violations=0`)
  - `pnpm.cmd run manifesto:check` PASS (`violations=0`)
- Kapsam disi birakilanlar: `apps/server/**`, `apps/desktop-agent/**`, `packages/**`, auth/WS/provider/runtime/approval persistence contracts, yeni dependency ve 7.4 operator/developer isolation isi.

### Track C / UI Overhaul 07.2 - Chat Composer & Surface Reset - 30 Nisan 2026

- `/chat` ana yuzeyi chat-first kategori ritmine tasindi: empty durumda ayri work/runtime surface render edilmiyor, chat/work akisi composer'in ustunde kaliyor ve composer desktop/mobile icin ana alt eylem anchor'i olarak davraniyor.
- Empty chat yapisi tek baslik, kisa yardimci metin, composer ve 4 prompt suggestion pill'e indirildi. `Masaustu hedefi`, dev/test prompt'lari ve self-narrating `burada gorunur/kalir`, `Calisma akisi`, `Mevcut calisma` copy'leri empty ilk ekrandan temizlendi.
- Composer chrome'u daraltildi: gorunur primary yuzeyde textarea, attach affordance, overflow/settings disclosure ve send button kaliyor. Voice, last-response readout ve desktop target gibi ikincil kontroller korunarak disclosure altina alindi; file upload ve voice capability kaldirilmadi.
- Message/current-surface ritmi dar scope'ta hizalandi: user/assistant transcript class'lari ayrildi, persisted transcript empty copy'si sadeledi, current run/presentation surface sadece gercek aktif calisma veya transcript oldugunda gorunur hale geldi. Approval card/state tasarimi bilincli olarak 7.3'e birakildi.
- Mobile ergonomi: 390x844, 414x896 ve 320x568 smoke'larda composer bottom nav ile cakismiyor, yatay overflow uretmiyor, aktif run/approval content composer'in altinda kalmiyor ve mobile approval `Kabul Et` butonu gercek pointer click ile tamamlandi.
- Visual/test alignment: eski fixture'larda composer'in work surface'ten once ve mobilde daima sticky olacagi varsayimi 7.2 sozlesmesine gore guncellendi. Empty state testleri baslik/kopya yerine task-local suggestion pill sozlesmesini dogruluyor.
- Screenshot smoke klasoru: `docs/design-audit/screenshots/2026-04-29-ui-overhaul-07-2-smoke/`
  - `desktop-1440-01-chat-empty.png`
  - `desktop-1920-02-chat-empty.png`
  - `mobile-390-03-chat-empty.png`
  - `mobile-414-04-chat-empty.png`
  - `mobile-320-05-chat-empty.png`
  - `desktop-1440-06-active-run-approval-pending.png`
  - `mobile-390-07-active-run-approval-pending.png`
  - `manifest.json` (`failed_checks=[]`, composer action count `3`, horizontal overflow temiz, mobile approval pointer click PASS)
- Dogrulama:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web lint` PASS
  - `pnpm.cmd --filter @runa/web test` PASS (`9` dosya / `22` test)
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd run style:check` PASS (`violations=0`)
  - `pnpm.cmd run manifesto:check` PASS (`violations=0`)
  - `pnpm.cmd exec playwright test apps/web/tests/visual/ui-overhaul-07-2-smoke.spec.ts --config playwright.config.ts` PASS (`2` test)
  - `pnpm.cmd exec playwright test apps/web/tests/visual/chat-responsive.spec.ts --config playwright.config.ts` PASS (`4` test)
  - `pnpm.cmd test:e2e` PASS (`11` Playwright test; build dahil). Not: Playwright kapanisinda Vite WS proxy `write ECONNABORTED` loglari goruldu, fakat komut exit code `0` ve test sonucu PASS.
- Kapsam disi birakilanlar: `apps/server/**`, `apps/desktop-agent/**`, `packages/**`, auth/WS/provider/runtime contracts ve yeni dependency yok. Approval trust-first card/state reset'i 7.3'e, secondary surfaces/mobile bottom nav redesign 7.5'e, full visual discipline pass 7.6'ya, copy voice pass 7.7'ye birakildi.

### Track C / UI Overhaul 07.3 - Approval UX & State Feedback - 30 Nisan 2026

- Approval card teknik tool event'i olmaktan cikarilip trust-first karar kartina tasindi. Ana baslik `Runa sunu yapmak istiyor`; birincil yuzeyde eylem, hedef bilgisi, dikkat/risk notu ve onay sonrasi beklenti okunuyor. `file.write`, call id ve ham hedef gibi teknik detaylar `Teknik detaylar` disclosure altinda kaliyor.
- Dar user-facing mapping eklendi: `file.write` dosyaya yazma, `file.read` dosya okuma, `desktop.screenshot` ekran goruntusu alma olarak okunuyor. Payload'da gercek hedef path yoksa dosya hedefi uydurulmuyor; card `Bu onayda net hedef bilgisi gonderilmedi.` fallback'ini kullaniyor.
- Pending / approved / rejected / closed state'leri ayrildi. Pending kart aksiyonlari belirgin ve tiklanabilir; approved/rejected kartlarda tekrar onay butonu gorunmuyor. Ayni `approval_id` icin resolved block geldiyse eski pending approval block'u gorunur current-run yuzeyinden filtreleniyor; backend approval contract/state machine degismedi.
- Mobile ergonomi 390x844 ve 320x568 smoke ile kanitlandi: `Onayla` / `Reddet` pointer click calisiyor, composer veya bottom nav butonlari ortmuyor, yatay overflow yok. 7.2 empty chat/composer davranisi desktop/mobile regression screenshot'lariyla korunuyor.
- Yeni screenshot smoke klasoru: `docs/design-audit/screenshots/2026-04-30-ui-overhaul-07-3-smoke/`
  - `desktop-1440-01-approval-pending.png`
  - `desktop-1920-02-approval-pending.png`
  - `mobile-390-03-approval-pending.png`
  - `mobile-320-04-approval-pending.png`
  - `desktop-1440-05-approval-approved.png`
  - `mobile-390-06-approval-approved.png`
  - `mobile-390-07-approval-rejected.png`
  - `desktop-1440-08-continued-completed.png`
  - `desktop-1440-09-chat-empty.png`
  - `mobile-390-10-chat-empty.png`
  - `manifest.json` (`failed_checks=[]`; trust-first heading, no invented path, mobile button clearance and horizontal overflow checks PASS)
- Dogrulama:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web lint` PASS
  - `pnpm.cmd --filter @runa/web test` PASS (`9` dosya / `23` test)
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd run style:check` PASS (`violations=0`)
  - `pnpm.cmd run manifesto:check` PASS (`violations=0`)
  - `pnpm.cmd exec playwright test apps/web/tests/visual/ui-overhaul-07-3-smoke.spec.ts --config playwright.config.ts` PASS (`2` test; screenshot klasoru guncellendi)
  - `pnpm.cmd test:e2e` PASS (`13` Playwright test; build dahil). Not: Playwright kapanisinda Vite WS proxy `write ECONNABORTED` / `read ECONNRESET` loglari goruldu, fakat komut exit code `0` ve test sonucu PASS.
- Kapsam disi birakilanlar: `apps/server/**`, `apps/desktop-agent/**`, `packages/**`, auth/WS/provider/runtime/approval persistence contracts ve yeni dependency yok. Secondary surfaces 7.5'e, operator/developer hard isolation 7.4'e, full visual discipline pass 7.6'ya, copy voice pass 7.7'ye birakildi.
- Worktree notu: gorev basinda checkout zaten genis dirty durumdaydi; task disi silinmis/tasinmis kok dokumanlar, mevcut web UI degisiklikleri, screenshot baseline drift'leri ve `apps/server/approval-e2e-temp.txt` silinmesi geri alinmadi. Bu tur yalniz approval/chat web yuzeyi, task-local visual smoke ve `docs/PROGRESS.md` kaydi icin gerekli dosyalara dokundu.
### Arsivlenen Kayitlar

- 29 Nisan 2026 ve onceki Core Hardening kayitlari `docs/archive/progress-2026-04-core-hardening.md` altina tasindi.
- Sprint 1-6 ve daha eski kayitlar icin `docs/archive/progress-phase1.md` ve `docs/archive/progress-sprint1-5.md` kullanilir.
