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

### TASK-TERMINAL-SESSION-LIFECYCLE-03 - 6 Mayis 2026

- Kapsam: Backend-only terminal session lifecycle eklendi. `shell.session.start`, `shell.session.read` ve `shell.session.stop` built-in registry uzerinden kullanilabilir hale geldi; frontend, desktop-agent, auth ve provider runtime kontratlari degistirilmedi.
- Uygulama: Session manager in-memory ve bounded calisiyor; aktif session limiti, max runtime timeout, idle timeout, final-session TTL cleanup, process-exit cleanup ve son ciktiyi koruyan stdout/stderr ring buffer davranisi eklendi. Stop yolu idempotent ve Windows'ta force kill icin process-tree hedefli `taskkill` kullaniyor.
- Guvenlik: Start/read yuzeyleri mevcut `shell-output-redaction.ts` helper'ini kullaniyor; command/args/stdout/stderr ToolResult alanlari raw secret/token/env degeri dondurmuyor. Riskli komutlar `shell.exec` policy cizgisini reuse ederek session baslamadan bloklaniyor.
- Dogrulama: `pnpm.cmd --filter @runa/server test -- shell-session shell-exec shell-output-redaction registry` PASS (`41` test); `pnpm.cmd --filter @runa/server test -- run-tool-step ingest-tool-result map-tool-result` PASS (`21` test); `pnpm.cmd --filter @runa/server typecheck` PASS; `pnpm.cmd --filter @runa/server lint` PASS (`362` dosya); `pnpm.cmd --filter @runa/server run test:deepseek-live-smoke` PASS.
- Kalan not: Opsiyonel `pnpm.cmd --filter @runa/server run test:groq-live-smoke` bu kosuda provider HTTP 400 ile FAIL verdi; assistant/tool-schema stage'leri PASS olsa da browser-shape roundtrip basarisiz oldugu icin Groq sonucu yesil sayilmadi. PowerShell profile kaynakli `\` gurultusu command exit code'larini bozmadigi icin urun hatasi olarak ele alinmadi.

### TASK-TERMINAL-OUTPUT-REDACTION-02 - 6 Mayis 2026

- Kapsam: `shell.exec` ToolResult yuzeyi icin terminal kaynakli secret/env/token sizintisi kapatildi. Stdout, stderr, timeout details ve echo edilen command/args alani ToolResult olusmadan once redaction'dan geciyor.
- Uygulama: `apps/server/src/tools/shell-output-redaction.ts` eklendi. Process env ve repo-local `.env.local` / `.env` / `.env.compose` icindeki sensitive key/value corpus'u, yaygin `sk-`, `gsk_`, `sb_publishable_`, JWT ve Postgres URL password pattern'leriyle birlikte maskeleniyor. Kisa/low-signal env degerleri false-positive azaltmak icin corpus'a alinmiyor.
- Kanit modeli: Shell output metadata artik `redaction_applied`, `redacted_occurrence_count`, `redacted_source_kinds` ve `secret_values_exposed=false` alanlarini tasiyor; raw secret preview veya token degeri metadata'ya girmiyor.
- Dogrulama: `pnpm.cmd --filter @runa/server test -- shell-exec shell-output-redaction` PASS (`23` test); `pnpm.cmd --filter @runa/server test -- run-tool-step ingest-tool-result map-tool-result` PASS (`21` test); `pnpm.cmd --filter @runa/server typecheck` PASS; `pnpm.cmd --filter @runa/server lint` PASS (`360` dosya); `pnpm.cmd --filter @runa/server run test:deepseek-live-smoke` PASS; `pnpm.cmd --filter @runa/server run test:groq-live-smoke` PASS.
- Kalan not: PowerShell profile kaynakli `\` gurultusu komut exit code'larini bozmadigi icin urun hatasi olarak ele alinmadi. Existing dirty desktop/web/server dosyalari bu task kapsaminda degistirilmedi.

### TASK-TERMINAL-ENV-AUTHORITY-01 - 6 Mayis 2026

- Kapsam: Terminal/runtime env otoritesi netlestirildi; provider smoke ve persistence proof ozetleri artik shell env, `.env.local`, `.env`, `.env.compose`, `client_config`, `default` ve `missing` kaynaklarini ayrica raporluyor.
- Uygulama: TypeScript resolver `apps/server/src/config/env-authority.ts` ve script helper `apps/server/scripts/env-authority.mjs` eklendi. Precedence `client_config > process_env > .env.local > .env > .env.compose > default > missing`; secret degerleri yalnizca maskeli preview ile cikiyor.
- Gateway: `resolveGatewayConfigAuthority` eklendi; mevcut `resolveGatewayConfig` davranisi ve public kontrat bozulmadi. Client config ve env-backed provider key kaynaklari testlerle ayrildi.
- Smoke/proof: DeepSeek ve Groq live smoke summaryleri API key, model ve `DATABASE_URL` otoritesini maskeli ve kanitlanabilir sekilde raporluyor. Persistence/approval proof scriptleri file-backed env yuklemesini ayni authority ozetiyle yapiyor.
- Canli kanit: DeepSeek live smoke PASS; API key `.env`, DeepSeek model secimleri `.env`, `DATABASE_URL` `.env.local` olarak raporlandi. Groq live smoke PASS; API key `.env`, model `default`, `DATABASE_URL` `.env.local` olarak raporlandi.
- Dogrulama: `node --check apps/server/scripts/deepseek-live-smoke.mjs` PASS; `node --check apps/server/scripts/groq-live-smoke.mjs` PASS; `pnpm.cmd --filter @runa/server run test:deepseek-live-smoke` PASS; `pnpm.cmd --filter @runa/server run test:groq-live-smoke` PASS; `pnpm.cmd --filter @runa/server typecheck` PASS; `pnpm.cmd --filter @runa/server test -- env-authority gateway model-router` PASS (`164` test); `pnpm.cmd --filter @runa/server lint` PASS (`358` dosya).
- Not: Server lint baselineini kapatmak icin `apps/server/src/presentation/map-run-timeline.ts` uzerinde format-only duzeltme de dahil edildi. PowerShell profile kaynakli `\` gurultusu komut exit codelarini bozmadigi icin urun hatasi olarak ele alinmadi.

### TASK-WORK-NARRATION-PHASE-6 - 5 Mayis 2026

- Kapsam: Production hardening, observability, reasoning leakage denetimi, docs ve release checklist. Buyuk mimari refactor, yeni UI yuzeyi ve incremental persistence uygulanmadi.
- Audit: Prompt gate `native_blocks` / `temporal_stream`; unsupported provider'lar prompt ve narration emission disinda. DeepSeek `reasoning_content` normal assistant content'ten ayriliyor ve user-facing narration kaynagi degil.
- Edge cases: locale-aware deliberation guardrail guclendirildi; EN `I think` bug'i Turkce lowercasing kaynakli kaciyordu ve locale-aware normalize ile duzeltildi. Tool-output quote, long narration truncate, direct-tool/no-narration, synthetic_non_streaming suppression ve observability redaction testleri eklendi.
- Observability: `narration.started`, `narration.completed`, `narration.superseded`, `narration.guardrail.rejected`, `narration.tool_outcome_linked`, `narration.provider_unsupported` ve `narration.synthetic_ordering_suppressed` log metadata helper'i eklendi. Full narration text, tool output ve reasoning ham icerigi loglanmiyor.
- Metrics: General server metrics exporter bulunmadigi icin narration metrics kodda sahte counter olarak eklenmedi; future metrics `docs/architecture/work-narration.md` altinda belgelendi.
- DeepSeek smoke: Shell env'de `DEEPSEEK_API_KEY` yoksa canli smoke skip edilir; API key/log guvenligi geregi key degeri yazilmaz.
- Docs: `docs/architecture/work-narration.md`, `docs/architecture/reasoning-persistence.md` ve `docs/architecture/work-narration-release-checklist.md` guncellendi.
- Faz commit zinciri: `6a8548f`, `2ca55f5`, `79e741f`, `5a8add3`, `2f7ebcf`, `899e941`, `f41c4c4`, `fae6ce6`; Faz 6 final commit hash'i commit olustuktan sonra raporda verilir.

### TASK-WORK-NARRATION-PHASE-2B - 5 Mayis 2026

- Kapsam: Faz 2A/2A.5 altyapisi uzerine backend-only narration runtime emission eklendi. Classifier `ordered_content` pozisyonunu, `turn_intent`, `ordering_origin` ve provider `narration_strategy` gate'ini kullanarak final answer ile work narration adaylarini ayiriyor.
- Guardrails: bos metin, 240 karakter cap, duplicate, locale-aware deliberation ve tool-result quote filtreleri eklendi. Streaming strategy pessimistic buffer olarak testlendi; optimistic mode tipi var ama Faz 2B'de aktif degil.
- Runtime/WS: kabul edilen narration adaylari `narration.started`, `narration.token`, `narration.completed` runtime event'leri olarak runtime event hattina giriyor ve `narration.delta` / `narration.completed` WS mesajlari olarak akiyor. Unsupported provider'larda emission kapali.
- Presentation: `narration.completed` runtime event'i `work_narration` block'a map ediliyor; `narration.superseded` status'u `superseded`, failed tool outcome link'i `tool_failed` yapiyor. Frontend UI hala Faz 4'e kadar silent null.
- Reconnect: WS disconnect sirasinda in-flight narration buffer kaybi kabul edilen Faz 2B trade-off'u olarak `docs/architecture/work-narration.md` altinda belgelendi; replay/final block recovery persistence sonrasi calisir, tam in-flight recovery Faz 6'ya birakildi.

### TASK-WORK-NARRATION-PHASE-0 - 5 Mayis 2026

- Kapsam: canonical `ModelResponse.message` geriye donuk uyumlu bicimde `ordered_content` metadata'siyle genisletildi. Bu fazda narration event'i, classifier, prompt degisikligi veya frontend render farki eklenmedi.
- Provider davranisi: Claude response content block sirasi `text` / `tool_use` part'lari olarak korunuyor. OpenAI generate ve streaming yolunda text/tool sirasi korunuyor; streaming `text.delta` chunk'lari `content_part_index` tasiyor. DeepSeek, Gemini, Groq ve SambaNova guvenli fallback olarak mevcut text-first/tool-after sirasini `ordered_content` icinde yansitiyor.
- WS contract: `text.delta` server payload'i opsiyonel `content_part_index` alaniyla additive genisletildi; eski payload sekli gecerliligini koruyor.
- Dogrulama:
  - `pnpm.cmd exec biome check ...` PASS (degisen server/types dosyalari)
  - `pnpm.cmd typecheck` PASS (`9` task)
  - `pnpm.cmd --filter @runa/server test -- gateway` PASS (`5` dosya / `121` test)
  - `pnpm.cmd --filter @runa/server test` PASS (`138` dosya / `1029` test)
  - `pnpm.cmd test` RED: task disi web visual-discipline baseline kirmizisi devam ediyor (`apps/web/src/pages/VisualDiscipline.test.tsx`; `BlockRenderer.module.css:462/469/474`, `WorkInsightPanel.module.css:44/63/154`).
- Kapsam disi: narration domain event'leri, work_narration block tipi, system prompt kurallari, frontend narration UI, persistence/replay ve provider feature flag'leri Faz 1+ icin birakildi.

### TASK-WORK-NARRATION-PHASE-1 - 5 Mayis 2026

- Kapsam: work narration domain kontrati eklendi. `RenderBlock` union'i `work_narration` tipiyle genisletildi; locale kontrati `SupportedLocale = 'en' | 'tr'` olarak shared types'a tasindi. Bu fazda classifier, prompt degisikligi, runtime emission veya frontend narration UI eklenmedi.
- Runtime events: `narration.started`, `narration.token`, `narration.completed`, `narration.superseded` ve `narration.tool_outcome_linked` payload tipleri ile builder fonksiyonlari eklendi. Payload'lar `narration_id`, `run_id`, `turn_index`, `sequence_no`, `timestamp` ve gerekli text/tool outcome alanlarini tasiyor.
- WS contract: `narration.delta`, `narration.completed` ve `narration.superseded` server message tipleri ile guard fonksiyonlari eklendi. Bu mesajlar `text.delta` final-answer stream'inden ayri kontrat olarak duruyor; henuz emit edilmiyor.
- Tool metadata: built-in tool'lara explicit `narration_policy` islendi. `memory.list` ve `memory.search` trivial okuma/arama olarak `none`; dosya yazma, shell, edit ve host/browser input gibi riskli yan etkili araclar `required`; diger okuma/arama araclari `optional` olarak etiketlendi.
- Exhaustiveness: mevcut frontend block renderer `work_narration` bloklarini Faz 4'e kadar sessizce `null` donerek ignore edecek sekilde additive korundu; kullanici UI davranisi degismedi.
- Pre-Faz-1 sanity: Faz 0 oncesi web test baseline'i ayni VisualDiscipline kirmizisiydi, regression degil. Eksik ordered_content edge testleri ayri test-only commit ile eklendi: Claude 5-part interleave ve OpenAI streaming tool-before-text sirasi.
- Dogrulama:
  - `pnpm.cmd --filter @runa/server test -- gateway` PASS (`5` dosya / `123` test) - pre-Faz-1 test-only ekleme
  - `pnpm.cmd typecheck` PASS (`9` task)
  - `pnpm.cmd --filter @runa/server test -- runtime-events registry ws-guards work-narration-contracts` PASS (`6` dosya / `21` test)
  - `pnpm.cmd --filter @runa/server test` PASS (`140` dosya / `1038` test)
  - Biome check degisen dosyalarda PASS
- Faz 2 notu: capability flag'i ordered_content varligina degil, gateway'in native interleaved mi synthetic fallback mi urettiği bilgisine dayanacak. DeepSeek/Gemini/Groq/SambaNova synthetic text-first/tool-use sirasi urettigi icin narration emission bu provider'larda devre disi kalmali.

### TASK-WORK-NARRATION-PHASE-2A - 5 Mayis 2026

- Kapsam: Provider foundation kuruldu; henuz narration classifier, guardrail, WS narration emission veya frontend UI eklenmedi. DeepSeek streaming adapter'i `delta.content` ve `delta.tool_calls` SSE wire sirasini `ordered_content` icinde `ordering_origin: 'wire_streaming'` ile koruyor; non-streaming DeepSeek response'lari `synthetic_non_streaming` olarak isaretleniyor.
- Spike: `apps/server/scripts/deepseek-wire-spike.mjs` eklendi ve dogrudan DeepSeek API ile 3 prompt calistirildi. Cikti `docs/spikes/deepseek-wire-order-2026-05-05T11-35-38-175Z.log` dosyasina yazildi; `.log` repo ignore kapsaminda. Sonuc: content chunk'lari tool_call chunk'larindan once geliyor, iki tool-call senaryosunda temporal SSE sirasi korunuyor, `deepseek-chat` modunda `reasoning_content` gorulmedi, fallthrough gorulmedi.
- Capability matrix: Gateway adapter'lari kendi modul sabitleriyle `ProviderCapabilities` export ediyor. Claude `native_blocks`; OpenAI ve DeepSeek `temporal_stream`; Gemini/Groq/SambaNova `unsupported`. Factory bu capability'yi gateway instance'ina tasiyor ve `gateway.capability.loaded` log'u basiyor.
- Reasoning isolation: `internal_reasoning` model response metadata'si olarak eklendi, DeepSeek `reasoning_content` ayri buffer'da tutuluyor ve `ordered_content`/WS public model request kontratlarina karismiyor. `RUNA_PERSIST_REASONING=1` acik degilse reasoning trace DB'ye yazilmiyor.
- Persistence: `agent_reasoning_traces` tablosu, bootstrap SQL'i, Drizzle schema tipi, migration dosyasi ve `apps/server/src/persistence/reasoning-store.ts` eklendi. Varsayilan retention `debug_30d`, cleanup helper'i `expires_at` uzerinden calisiyor.
- Fallthrough: DeepSeek raw JSON/function-call gorunumlu text ciktilarini yakalayan `fallthrough-detector` eklendi. Streaming finalize sirasinda tespit edilen part `ordered_content`ten dusuyor, `fallthrough_detected` metadata'si ve `deepseek.fallthrough.detected` warning log'u uretiliyor.
- Dogrulama:
  - `pnpm.cmd typecheck` PASS (`9` task)
  - `pnpm.cmd --filter @runa/server test` PASS (`143` dosya / `1065` test)
  - `pnpm.cmd exec vitest run src/schema.test.ts --passWithNoTests` PASS (`packages/db`, `1` dosya / `3` test)
  - Scoped `pnpm.cmd exec biome check ...` PASS (`30` degisen dosya)
- Full `pnpm.cmd exec biome check` RED: task disi mevcut baseline devam ediyor (`.codex-temp/desktop-agent-live-smoke.mjs`, `apps/server/src/presentation/map-run-timeline.ts`, cok sayida `apps/web/src/components/chat/*.module.css` bos block/format diagnostigi).
- Faz 2B riski: classifier kesinlikle `ordering_origin` ayrimini kullanmali; `synthetic_non_streaming` veya `unsupported` kaynaklardan narration emit edilmemeli. DeepSeek fallthrough sinyali runtime retry/drop politikasina tasinmali.

### TASK-WORK-NARRATION-PHASE-2A.5 - 5 Mayis 2026

- Kapsam: Faz 2A altyapisi sertlestirildi; Faz 2B classifier/emission isine gecilmedi.
- Redaction: `Redacted<T>` opaque type eklendi ve `ModelMessage.internal_reasoning` artik raw `string` degil. DeepSeek provider replay ve reasoning persistence noktalari bilincli `unwrapRedacted()` karar noktalari olarak kaldi. Logger `internal_reasoning` ve `reasoning_content` alanlarini recursive redact ediyor.
- Telemetry: Server tarafinda analytics, Sentry, PostHog, Datadog veya trace span attribute entegrasyonu bulunmadi. `docs/architecture/reasoning-persistence.md` gelecekteki telemetry wrapper zorunlulugunu kaydediyor.
- Fallthrough: Detector high/medium/low confidence politikasina gecti. Sadece high confidence tool-call gorunumlu text `ordered_content`ten dusuyor; medium confidence part tutuluyor ama `narration_eligible:false`; low confidence sadece debug gozlem olarak kaliyor.
- Spike guvenligi: DeepSeek spike output yolu `.local/spikes/` oldu ve `.local/` gitignore kapsaminda. Script production'da calismaz, yalniz shell `DEEPSEEK_API_KEY` kabul eder, API key maskelenir, promptlar cap/hash ile loglanir, `reasoning_content` ham yazilmaz.
- Retention defer: `reasoning-store` basina Faz 6 cleanup TODO'su eklendi. `cleanupExpiredReasoningTraces` manuel helper'i var; scheduled job Faz 6'ya explicit ertelendi.
- Faz 2B hazirlik: Classifier high fallthrough sinyalini hard block olarak, medium sinyali narration suppression olarak yorumlamali; `narration_eligible:false` olan text final answer olabilir ama work narration olarak emit edilmemeli.

### TASK-TOOL-RESULT-PIPELINE - 3 Mayis 2026 (Dalga 1 + Dalga 2)

- Kapsam: tool result feedback pipeline sertlestirildi. Continuation inline preview limiti `8192/16384` sabitlerine tasindi; kucuk tool sonuclari tam gorunur, buyuk sonuclar kontrollu truncate edilir. RunLayer kucuk basarili tool sonuclarinda `inline_output` tasiyor, buyuk sonuclarda `output_truncated:true` ile prompt sismesini engelliyor.
- Runtime: `AgentLoopSnapshot` terminal `stop_reason` ve recent tool signature bilgisini tasiyor. Terminal hata mesajlari `repeated_tool_call`, `max_turns_reached`, `token_budget_reached`, `stagnation` ve `tool_failure` icin deterministik hale geldi; `run.failed.error_code` runtime termination kind'larindan turetiliyor.
- Multi-tool continuation: ordered tool result blogu JSON payload tekrarini birakti; artik call_id ve kisa metric referanslariyla tek sentinel blok olarak yenileniyor. Ayni user mesajinda eski blok stack edilmiyor.
- Recovery: ikinci ayni `tool_name + args_hash` tekrarindan sonra continuation mesajina guclu recovery preamble ekleniyor; `max_repeated_identical_calls=3` safety net olarak korunuyor.
- `file.read`: opsiyonel `start_line` / `end_line` eklendi. Range validasyonu `INVALID_INPUT` ile typed hata donuyor; CRLF korunuyor; range okumada `line_range` ve donen content byte uzunlugu raporlaniyor. Argumansiz tam okuma geriye donuk uyumlu kaldi.
- Escalation: `docs/escalation-tool-result-pipeline.md` icinde 12KB RunLayer matrisi ile M2 threshold kuralinin celiskisi kaydedildi; uygulanabilir kontrat olarak M2'nin `8192` inline threshold'u secildi.
- Register WS follow-up: full-suite sonrasi kalan F1/F2 kirmizilari ayrildi. F2 `web.search` izolasyonda gectigi icin kod/assertion degismedi; F1 `git.diff` izolasyonda base ve branch uzerinde gecti, live tool span dusuk kaldi ve full-suite Windows zamanlama hassasiyeti olarak 15s test timeout'u ile belgelendi.
- Dogrulama:
  - `pnpm.cmd biome check --write` PASS (`695` dosya)
  - `pnpm.cmd lint` PASS (`695` dosya)
  - `pnpm.cmd -r typecheck` PASS
  - `pnpm.cmd -r test` PASS (`apps/server`: `138` dosya / `999` test; `apps/web`: `25` dosya / `68` pass + `1` skipped; `packages/db`: `5` dosya / `26` test; `packages/utils`: no tests)
- Kapsam disi: frontend, provider adapter, artifact spill-to-disk, memory architecture, compactor sub-agent ve repeated-call threshold degisikligi yapilmadi.

### TASK-POLICY-APPROVAL-MODES-02 - 3 Mayis 2026

- Kapsam: `policy_states` semasi approval mode ve trusted-session state alanlariyla genisletildi: `approval_mode`, mode timestamp'i, trusted-session enabled/ttl/max-turn/counter alanlari idempotent bootstrap `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` hattina eklendi. DB upsert set'i yeni kolonlari yaziyor.
- Persistence: server policy-state hydrate/write mapping'i approval mode, trusted-session ttl ve counter state'ini DB-backed hale getirdi. Eski row'lar `standard` + trusted disabled olarak hydrate ediliyor; invalid mode `standard`'a clamp ediliyor; invalid/missing timestamp veya counter state auto-allow uretmeyecek sekilde safe disabled state'e dusuyor.
- Policy lifecycle: `run.request` approval mode'u server tarafinda normalize ediliyor. Mode degisimi trusted-session ve auto-continue state'ini sifirliyor; ayni trusted-session modunda turn counter persist ediliyor; progressive-trust allow sonrasi approved capability counter persist ediliyor.
- Security invariants: hard-deny/auth precedence korunuyor. Trusted-session high-risk execution, shell, desktop, write/execute side effect ve secret/env/token benzeri capability'leri auto-allow etmiyor. TTL, max turn ve max approved capability sinirlari persisted/hydrated state sonrasinda da approval boundary uretiyor.
- Dogrulama:
  - `pnpm.cmd --filter @runa/db typecheck` PASS
  - `pnpm.cmd --filter @runa/db test` PASS (`6` dosya / `28` test)
  - `pnpm.cmd --filter @runa/server typecheck` PASS
  - `pnpm.cmd --filter @runa/server lint` PASS
  - `pnpm.cmd --filter @runa/server test -- policy-state-store permission-engine policy-wiring register-ws` PASS (`4` dosya / `94` test)
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web test -- SettingsPage useChatRuntime.approval` PASS (`2` dosya / `3` test)
  - `pnpm.cmd lint` PASS (`699` dosya)
  - `pnpm.cmd build` PASS
  - `$env:DATABASE_TARGET='local'; pnpm.cmd --filter @runa/server run test:persistence-release-proof` PASS; `PERSISTENCE_RELEASE_PROOF_SUMMARY result=PASS`, local DB CRUD PASS, first-run conversation PASS, memory RLS PASS, approval persistence/reconnect PASS, auto-continue restart `run.finished(COMPLETED)`.
  - `$env:DATABASE_TARGET='cloud'; pnpm.cmd --filter @runa/server run test:persistence-release-proof` PASS; `PERSISTENCE_RELEASE_PROOF_SUMMARY result=PASS`, cloud approval persistence/reconnect PASS, auto-continue restart `run.finished(COMPLETED)`.
- Browser live QA: `pnpm.cmd exec playwright test e2e/approval-modes-capabilities-e2e.spec.ts --config playwright.config.ts` PASS (`12` Chromium test). Approval mode ve 10+ capability senaryosu canlı tarayıcıda doğrulandı: standard chat, standard `file.list`, ask-every-time `file.read`, trusted-session `file.read`, trusted-session `file.write`, `search.grep`, `search.codebase`, `git.status`, `git.diff`, `shell.exec` approval boundary ve `browser.navigate`. Screenshot kanitlari: `docs/design-audit/screenshots/2026-05-03-approval-modes-capability-live/`.
- Live QA bulgulari/fixler: ask-every-time modunda safe tool metadata'si approval request'e clone edilmedigi icin approval path fail ediyordu; `run-execution` approval tool definition resolve hattinda duzeltildi ve register-ws regresyon testi eklendi. E2E server'da scenario marker izolasyonu son kullanici prompt'una baglandi; `/desktop/devices` ve conversation members endpoint stub'lari eklenerek tarayici konsolundaki 404 hatalari temizlendi.
- Kalan risk: Bu turda kalan task-local risk yok. Playwright webServer log'unda service worker'in Playwright tarafindan bloklandigina dair beklenen Vite console.warn logu goruluyor; test icindeki page console/page/response hata assertion'lari temiz.

### TASK-RESILIENCE-05 - 2 Mayis 2026 (Tool Call Repair Hardening PR 1)

- Kapsam: `tool-call-candidate` parser'i provider-agnostic tolerant pipeline'a tasindi; strict/sanitized/fence-stripped/trailing-comma/wrapped/empty-default stratejileri ve `repair_strategy` observability alani eklendi. Dogrulama: targeted gateway parser testleri PASS, targeted parser Biome PASS, workspace typecheck PASS; workspace lint/test mevcut `apps/server/src/ws/*` baseline kirleri nedeniyle RED.

### TASK-RESILIENCE-06 - 2 Mayis 2026 (Tool Call Repair Hardening PR 2-6)

- Kapsam: repair recovery tek-shot olmaktan cikarildi; `strict_reinforce`, `tool_subset` ve `force_no_tools` strateji zinciri production default'u oldu. Streaming sirasinda `unparseable_tool_input` veya repairable tool-call hatasi gelirse WS `text.delta.discard` yayip non-streaming `generate()` fallback'e geciyor.
- Router/health: DeepSeek `tool_heavy` ve `deep_reasoning` intent'lerinde streaming bypass default acik (`RUNA_STREAMING_TOOL_HEAVY_BYPASS=1`); session-level provider health store ayni session/provider icin 10 dakikada 3 terminal tool-call failure sonrasi provider'i demote ediyor.
- Regression guard: historical payload fixture replay testleri, `tool_call_repair_terminal_failure_total` process-local metric/log counter'i, provider demotion telemetry ve `.env.example` flag dokumantasyonu eklendi.
- Dogrulama: targeted server repair/router/ws tests PASS (`8` dosya / `106` test), targeted web runtime tests PASS (`2` dosya / `6` test), `pnpm.cmd -w typecheck` PASS (`9` task), `pnpm.cmd -w lint` PASS (`693` dosya), `pnpm.cmd -w test` PASS (`7` task; server `137` dosya / `978` test, web `25` dosya / `68` test + `1` skipped, db `5` dosya / `26` test).

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

### TASK-TERMINAL-RUNTIME-INTEGRATION-04 - Shell Session Runtime Integration - 6 Mayis 2026

- `shell.session.start/read/stop` sonuclari runtime tarafinda okunabilir hale getirildi: `runtime_feedback`, `next_action_hint`, stdout/stderr byte durumlari ve redaction-aware `metadata.shell_session` eklendi. Secret redaction kontrati korunuyor; raw secret veya yeni provider/auth yuzeyi eklenmedi.
- Shell session sahipligi `run_id` ile baglandi. Session'i baslatan run disinda `shell.session.read` ve `shell.session.stop` cagrisina `PERMISSION_DENIED` donuyor; owner run id disari sizdirilmiyor.
- `runToolStep` tamamlanan tool event'lerine sadece kucuk shell-session lifecycle metadata'sini tasiyor. Ingestion path metadata/output'u model continuation icin koruyor; presentation summary de `runtime_feedback` metnini kullanarak kullaniciya "running / no buffered output / final buffer" durumunu gosteriyor.
- Polling guardrail'i dar kapsamda ayarlandi: `shell.session.read` uc kez ayni okununca erken `repeated_tool_call` ile kesilmiyor, fakat ayni verimsiz polling 6'lik stagnation penceresinde terminal stop almaya devam ediyor. Max-turn ve tool-failure guardrail'lari degismedi.
- Dogrulama:
  - `pnpm.cmd --filter @runa/server test -- shell-session run-tool-step ingest-tool-result presentation stop-conditions` PASS (`19` dosya / `127` test; komut `tsc` dahil calisti)
  - `pnpm.cmd --filter @runa/server test -- shell-session run-tool-step ingest-tool-result run-model-turn-loop-adapter agent-loop stop-conditions` PASS (`9` dosya / `94` test; komut `tsc` dahil calisti)
- Kapsam disi birakilanlar: web UI component redesign, desktop-agent bridge, auth/provider/model routing, yeni dependency, shell command policy redesign ve full E2E browser smoke. Worktree gorev basinda zaten genis dirty durumdaydi; task disi web/desktop/temp degisiklikleri geri alinmadi.

### Arsivlenen Kayitlar

- 29 Nisan 2026 ve onceki Core Hardening kayitlari `docs/archive/progress-2026-04-core-hardening.md` altina tasindi.
- Sprint 1-6 ve daha eski kayitlar icin `docs/archive/progress-phase1.md` ve `docs/archive/progress-sprint1-5.md` kullanilir.
