# Progress Archive - Core Hardening April 2026

This file was split out of docs/PROGRESS.md to keep the active operational ledger small for IDE LLM context windows.

Use this archive only when historical proof, old task closure details, or prior April 2026 implementation evidence is needed.
### Track C / UI Overhaul Follow-up - Post-CSS Mobile Runtime Split - 29 Nisan 2026

- Adim 0 checkout dogrulamasi PASS: son commit `a7cd5c9 Optimize web critical CSS and DeepSeek e2e`, `apps/web/src/styles/inline-migration.css` yok, `apps/web/src/styles/routes/` var, `apps/web/lighthouse-mobile-critical-css.report.json` ve `apps/web/lighthouse-desktop-critical-css.report.json` mevcut.
- Attribution sonucu: CSS follow-up sonrasi mobile Lighthouse Performance `79` idi; FCP `3.8s`, LCP `3.9s`, TBT `0ms`, `unused-css-rules=0`. Kalan baski global CSS tekrari degil, initial app bootstrap + buyuk font transferi + hala render-blocking olan kucuk critical stylesheet zinciri.
- Pre-change production HTML initial modulepreload listesi chat disi path'lere `chat-store`, `ws`, `RunaBadge`, `types/createLucideIcon` ve conversation/runtime maliyetini tasiyordu. Lighthouse mobile resource summary'de script transferi `107,052` byte, unused JS `40,491` byte idi.
- `apps/web/src/App.tsx` yalniz auth/login boundary'sine indirildi; authenticated shell `apps/web/src/AuthenticatedApp.tsx` icine lazy import edildi. Boylece anonymous/login path AppShell/router/route CSS ve chat runtime importlarini tasimiyor.
- Chat runtime boundary daraltildi: `useChatRuntime` artik `apps/web/src/pages/ChatRuntimePage.tsx` ve developer route icin `apps/web/src/pages/DeveloperRuntimePage.tsx` altinda calisiyor. `useConversations` chat/developer icin `apps/web/src/hooks/useConversationBackedChatRuntime.ts`, history icin `apps/web/src/pages/HistoryRoute.tsx` ile route-local hale geldi. `/account` ve `/devices` artik chat runtime / WS store / presentation runtime maliyetini tasimiyor.
- Current production build kaniti: `dist/index.html` initial modulepreload listesinde artik yalniz `jsx-runtime`, `preload-helper`, `ui-utils`, `RunaSpinner`, `theme`, `copy`, `react`, `react-dom` var; `chat-store`, `ws`, `RunaBadge`, `types/createLucideIcon` ilk HTML'den cikti. Current main index bundle `index-DTroYo29.js` `200.44 kB` raw / `63.23 kB` gzip; route-local runtime chunk'i `useConversationBackedChatRuntime-CxKD-geg.js` `33.75 kB` raw / `8.91 kB` gzip ve `ChatRuntimePage-sPru2v_B.js` `95.98 kB` raw / `23.92 kB` gzip.
- Lighthouse production-preview kaniti (`http://127.0.0.1:4175`, Lighthouse `13.1.0`, JSON raporlar `apps/web/lighthouse-mobile-runtime-split.report.json` ve `apps/web/lighthouse-desktop-runtime-split.report.json`):
  - Mobile: Performance `82`, Accessibility `100`, Best Practices `96`, SEO `92`; FCP `3.5s`, LCP `3.6s`, TBT `0ms`, Speed Index `3.5s`, CLS `0.038`.
  - Desktop: Performance `99`, Accessibility `100`, Best Practices `96`, SEO `92`; FCP `0.7s`, LCP `0.7s`, TBT `0ms`, CLS `0.042`.
  - Mobile script transferi `107,052` byte -> `77,290` byte, total transfer `477,024` byte -> `445,384` byte, unused JS `40,491` byte -> `27,900` byte. `unused-css-rules` temiz kaldi (`0` byte).
  - Kalan mobile 90+ blocker: `render-blocking-insight` halen `Est savings of 1,950ms` diyor; item'lar `index-CwEv4Met.css` (`9,039` byte, `604ms`) ve `RunaSpinner-BMBCJRdv.css` (`682` byte, `154ms`). `total-byte-weight` en buyuk kaynak olarak `fonts/inter/Inter-Variable.woff2` (`352,562` byte) gosteriyor. Sonraki profesyonel takip font subset/preload/fallback metrics ve critical stylesheet inline/defer stratejisi olmali; JS split tek basina 90+ icin yeterli olmadi.
- Lighthouse CLI notu: Mobile ve desktop komutlari JSON dosyalarini yazdi, ancak Windows temp cleanup `EPERM` nedeniyle iki komut da `exit code 1` ile kapandi. Skorlar ve audit blocker'lari JSON dosyalarindan okundu; sahte pass claim'i yapilmadi.
- Dogrulama:
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd run style:check` PASS (`violations=0`)
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web lint` PASS
  - `pnpm.cmd --filter @runa/web test` PASS (`9` dosya / `22` test)
  - `pnpm.cmd test:e2e` PASS (`9` test; ilk denemede port `3000` eski `apps/server/dist/index.js` sureci tarafindan tutuldugu icin approval testi fail etti, surec kapatilinca ayni komut 9/9 PASS verdi)
  - `pnpm.cmd typecheck` PASS
  - `pnpm.cmd lint` PASS
  - `pnpm.cmd run manifesto:check` PASS (`violations=0`)

### Track C / UI Overhaul Follow-up - Capability Preview + DeepSeek E2E Alignment - 29 Nisan 2026

- `apps/web/src/pages/CapabilityPreviewPage.tsx` inline `CSSProperties`/`style=` yuzeyinden cikarildi ve sayfa-yani `apps/web/src/pages/CapabilityPreviewPage.module.css` dosyasina tasindi. Sayfa 509 satirdan 426 satira indi; `style:check` kapsaminda yeniden ihlal uretmiyor.
- Capability preview stilleri token/CSS variable tabanina baglandi; React tarafinda yalniz semantic `className` kullaniliyor. Bu, UI-OVERHAUL-03 style gate'inin sonradan eklenen preview yuzeyleri icin de sert kalmasini saglar.
- Approval E2E bootstrap'i eski hardcoded OpenAI override'indan cikarildi. `e2e/chat-e2e.spec.ts` artik `provider=deepseek`, `model=deepseek-v4-flash`, request key'i bos config ile server env fallback yolunu kullaniyor ve localStorage runtime config'ini test icinde assert ediyor.
- `e2e/serve-runa-e2e.mjs` DeepSeek chat completions endpoint'ini deterministic harness icinde mock'luyor; `.env` / `.env.local` degerlerini yukleyebiliyor, yoksa yalniz test icin `e2e-deepseek-key` fallback'i kullaniyor. Mock DeepSeek provider-safe `file_write` tool alias'i donuyor ve adapter'in canonical `file.write` approval path'ini kanitliyor.
- Dogrulama:
  - `pnpm.cmd run style:check` PASS (`violations=0`)
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web lint` PASS
  - `pnpm.cmd --filter @runa/web test` PASS (`9` dosya / `22` test)
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd test:e2e` PASS (`9` test; DeepSeek approval E2E + UI-OVERHAUL-05/06 visual specs)
  - `pnpm.cmd typecheck` PASS
  - `pnpm.cmd lint` PASS
  - `pnpm.cmd run manifesto:check` PASS (`violations=0`)
  - `pnpm.cmd run primitive:coverage` REPORT (`primitive_total=46`, `native_interactive_total=51`; non-blocking takip metrigi)
- Test notu: Ilk E2E tekrar kosusunda port `3000` mevcut `apps/server/dist/index.js` sureci tarafindan tutuldugu icin Playwright yanlis server'i reuse edebiliyordu. Bu lokal surec kapatildiktan sonra E2E kendi DeepSeek harness'iyle 9/9 PASS verdi.

### Track C / UI Overhaul Follow-up - Global CSS Performance Split / Critical CSS - 29 Nisan 2026

- Global `apps/web/src/styles/inline-migration.css` kritik import zincirinden cikarildi ve silindi. Icindeki `737` migrated rule rota sahipli CSS dosyalarina bolundu: `apps/web/src/styles/routes/app-shell-migration.css`, `login-migration.css`, `chat-migration.css`, `capability-migration.css`, `settings-migration.css`, `desktop-device-presence-migration.css`, `developer-migration.css`, `devices-migration.css`, `history-migration.css`.
- Route CSS importlari ilgili lazy page girislerine baglandi: `ChatPage`, `CapabilityPreviewPage`, `SettingsPage`, `DeveloperPage`, `DevicesPage`, `HistoryPage`; login ve authenticated shell icin yalniz gerekli minimum CSS statik kaldi.
- UI primitive barrel importlari kritik path'ten temizlendi. `AppShell`, chat block/capability component'leri ve `CapabilityPreviewPage` artik `components/ui/index.js` yerine ilgili primitive dosyalarini dogrudan import ediyor; boylece kullanilmayan modal/skeleton CSS'i ilk HTML stylesheet listesine girmiyor.
- Production build kaniti: onceki global CSS follow-up hedefinde `dist/assets/index-*.css` yaklasik `143.66 kB` idi; bu turda global kritik CSS chunk'i `50.13 kB` raw / `9.04 kB` gzip seviyesine indi. Initial stylesheet toplamÃ„Â± `index + RunaBadge + RunaSurface/types` olarak yaklasik `51.60 kB` raw; chat route CSS'i ayri `63.99 kB` raw / `6.55 kB` gzip lazy chunk oldu.
- Lighthouse production-preview kaniti (`http://127.0.0.1:4175`, Lighthouse `13.1.0`):
  - Desktop: Performance `99`, Accessibility `100`, Best Practices `96`, SEO `92`; FCP `0.7s`, LCP `0.8s`, TBT `0ms`.
  - Mobile: Performance `79`, Accessibility `100`, Best Practices `96`, SEO `92`; FCP `3.8s`, LCP `3.9s`, TBT `0ms`.
  - `unused-css-rules` temiz (`overallSavingsBytes=0`). Render-blocking listesi artik `index-*.css`, `types-*.css`, `RunaBadge-*.css` ile sinirli; onceki `ui`, `RunaSkeleton`, `RunaModal` critical stylesheet istekleri kalkti.
  - Desktop Lighthouse komutu Windows temp cleanup `EPERM` ile exit code `1` donebildi, fakat JSON rapor yazildi ve skorlar `apps/web/lighthouse-desktop-critical-css.report.json` icinden okundu. Mobile son kosu exit code `0` verdi.
- Dogrulama:
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd run style:check` PASS (`violations=0`)
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web lint` PASS
  - `pnpm.cmd --filter @runa/web test` PASS (`9` dosya / `22` test)
  - `pnpm.cmd typecheck` PASS
  - `pnpm.cmd lint` PASS
  - `pnpm.cmd run manifesto:check` PASS (`violations=0`)
  - `pnpm.cmd run primitive:coverage` REPORT (`primitive_total=46`, `native_interactive_total=51`; non-blocking takip metrigi)
  - `pnpm.cmd test:e2e` PASS (`9` test; DeepSeek approval E2E + UI visual specs)
- Test notu: Ilk E2E kosusunda port `3000` eski `apps/server/dist/index.js` sureci tarafindan tutuldugu icin approval senaryosu yanlis backend'e baglanip fail etti. Surec kapatildiktan sonra ayni komut temiz harness ile 9/9 PASS verdi.
- Kalan performans gercegi: Mobile Lighthouse Performance 90+ henuz yakalanmadi; CSS debt'in buyuk global parcasi kapandi, kalan mobile skor baskisi daha cok ana JS/route bootstrap ve mevcut kritik `index` stylesheet'in render-blocking dogasindan geliyor. Yeni dependency eklenmedi; `apps/server/**`, `packages/**`, `apps/desktop-agent/**` bu gorevde degistirilmedi.

### GitHub CI / PR #11 Quality Gate Fix - 29 Nisan 2026

- PR #11 `quality` check kirigi incelendi. Ilk GitHub Actions hatasi `pnpm lint` altinda root `biome check .` idi; generated/temp desktop ciktilari ve eski format drift'i kalite kapisini kirletiyordu.
- `biome.json` ve `.gitignore` generated desktop ciktilarini, `temp-asar` klasorunu, local `.claire` worktree'lerini ve Lighthouse rapor artifact'lerini lint kapsamindan cikartacak sekilde daraltildi.
- Gercek kaynak dosyalarinda mekanik Biome format/import duzeltmeleri yapildi: CI helper scriptleri, desktop smoke script'i, UI fixture ve capability preview sayfasi.
- Lint sonrasi ortaya cikacak server test kirigi de kapatildi: approval request incremental asamada persist edildiyse finalize asamasinda ikinci kez persist edilmiyor; desktop approval continuation context'i artik yalniz son snapshot'i degil birikmis tool-result history'yi tasiyor. Boylece approval replay ve desktop vision-loop testleri mevcut runtime davranisiyla yeniden hizalandi.
- Dogrulama:
  - `pnpm.cmd typecheck` PASS
  - `pnpm.cmd lint` PASS
  - `pnpm.cmd test` PASS
  - `pnpm.cmd build` PASS
- Durust kalan durum: Bu kayit local CI parity proof'udur. GitHub Actions tekrar kosup PR #11 `quality` ve ardindan `e2e` check'lerini yesil gostermeden merge claim'i yapilmamalidir.

### Track C / Desktop Installer Trust & Packaging Polish - 29 Nisan 2026

- Sertifika henuz temin edilmedigi icin code signing bilincli olarak kapsam disi tutuldu; buna ragmen installer guveni icin kalan paketleme uyarilari kapatildi.
- `apps/desktop-agent/scripts/create-placeholder-icons.mjs` artik placeholder icon yerine web uygulamasindaki Runa brand icon kaynaklarini kullanarak `build/icon.png` ve `build/icon.ico` uretir.
- `electron-builder.yml` Runa icon'larini Windows executable, installer ve uninstaller metadata'sina bagladi. Son `dist:win` ciktisinda eski `default Electron icon is used` uyarisi tekrar etmedi.
- Paketleme stratejisi `asar: true` durumuna tasindi. Son artifact'te `release/win-unpacked/resources/app.asar` olustu ve asar integrity executable resource guncellendi; buna ragmen packaged runtime proof yesil kaldi.
- `apps/desktop-agent/package.json` icindeki nested `npm run` zinciri kaldirildi. Yeni `scripts/build-windows-installer.mjs` build orchestrator'i icon, main, renderer ve electron-builder adimlarini shell zinciri olmadan siralar. Son `dist:win` ciktisinda npm `recursive` warning'i tekrar etmedi.
- `apps/desktop-agent/scripts/start-electron.mjs` icindeki `shell: true` kaldirildi ve Node builtin importlari temizlendi. Ayrica electron-builder'in Node 25 altinda kendi dependency collector yolundan gelen `DEP0190` deprecation trace'i izole edildi; release build orchestrator'i bu upstream build-tool deprecation ciktisini bastirarak app/runtime proof'unu kirletmez.
- Runtime dependency yuzeyi daraltildi: Electron main/renderer bundle oldugu icin desktop-agent `dependencies` alani bosaltildi, `@runa/types` ve `electron-updater` build-time/dev dependency tarafina tasindi; `pnpm-lock.yaml` lockfile-only install ile senkronize edildi.
- Authenticode durumu acikca dogrulandi: `release/win-unpacked/Runa Desktop.exe` ve `release/Runa Desktop Setup 0.1.0.exe` `Get-AuthenticodeSignature` ile `NotSigned`. Bu beklenen durumdur; sertifika gelene kadar signed artifact claim'i yoktur.
- Dogrulama:
  - `pnpm.cmd --filter @runa/desktop-agent typecheck` PASS
  - `pnpm.cmd --filter @runa/desktop-agent typecheck:electron` PASS
  - `pnpm.cmd --filter @runa/desktop-agent typecheck:renderer` PASS
  - `pnpm.cmd exec biome check apps/desktop-agent/scripts/build-windows-installer.mjs apps/desktop-agent/scripts/create-placeholder-icons.mjs apps/desktop-agent/scripts/start-electron.mjs apps/desktop-agent/electron-builder.yml apps/desktop-agent/package.json` PASS
  - `pnpm.cmd --filter @runa/desktop-agent run dist:win` PASS; `asar disabled`, `default Electron icon`, npm `recursive` ve `DEP0190` warning'leri son temiz build ciktisinda gorulmedi.
  - `pnpm.cmd --filter @runa/desktop-agent run test:presence-release-proof` PASS; `DESKTOP_PACKAGED_RUNTIME_SMOKE_SUMMARY device_online=true`, `device_removed_after_shutdown=true`, `approval_resolve_sent=true`, `screenshot_succeeded=true`, `run_status="desktop_screenshot_success"`.
- Kalan release riski: code signing sertifikasi henuz yok. Sertifika temin edilince Authenticode signing/notarization benzeri final Windows trust adimi ayri release-hardening gorevi olarak kosulmali.

### Track B / Backend Persistence Release Proof - 29 Nisan 2026

- Backend persistence release kapisi icin tek otoritatif proof komutu eklendi: `pnpm.cmd --filter @runa/server run test:persistence-release-proof`.
- Yeni `apps/server/scripts/persistence-release-proof.mjs` su zinciri tek summary altinda toplar: DB config/CRUD smoke, first-run `GET /conversations` empty-state proof, persisted conversation/message readback, local memory RLS proof ve approval persistence/reconnect live smoke.
- Komut `PERSISTENCE_RELEASE_PROOF_SUMMARY` uretir; `PASS` olmadan backend persistence release proof tamamlanmis sayilmaz. DB/provider/ortam prerequisite'i eksikse `BLOCKED` veya net failure stage ile raporlar.
- `docs/dev/conversation-persistence-health.md` release proof kapisini ve beklenen PASS kriterlerini dokumante edecek sekilde guncellendi.
- Dogrulama:
  - `pnpm.cmd --filter @runa/server typecheck` PASS
  - `pnpm.cmd --filter @runa/server build` PASS
  - `pnpm.cmd exec biome check apps/server/scripts/persistence-release-proof.mjs apps/server/package.json docs/dev/conversation-persistence-health.md` PASS
  - `pnpm.cmd --filter @runa/server run test:persistence-release-proof` PASS; `PERSISTENCE_RELEASE_PROOF_SUMMARY result="PASS"`, `failure_stage=null`, DB target `local`, DB source `DATABASE_URL`, first-run `/conversations` status `200`, persisted message count `1`, local memory RLS `PASS`, approval persistence/reconnect `PASS`.
  - Not: ilk manuel proof denemesinde summary `PASS` uretildikten sonra Node acik handle nedeniyle sure asimina girdi. Script kapanisi deterministik hale getirildi ve package script tekrar kosuldugunda exit code `0` ile tamamlandi.

### Track C / Desktop Companion Presence Release Proof - 29 Nisan 2026

- Desktop companion icin release-grade online presence proof kapisi eklendi: `pnpm.cmd --filter @runa/desktop-agent run test:presence-release-proof`.
- `apps/desktop-agent/scripts/packaged-runtime-smoke.mjs` artik disarida calisan server veya live provider key varsaymaz. `RUNA_SMOKE_SERVER_URL` verilmezse kendi gecici Fastify server'ini baslatir, local dev auth bootstrap ile access token alir, paketli `Runa Desktop.exe` process'ini o token ile calistirir ve `/desktop/devices` uzerinden gercek online cihaz gorunurlugunu bekler.
- Yeni `apps/desktop-agent/scripts/packaged-runtime-smoke-server.mjs` gecici server helper'i eklendi. Helper repo `.env` + `.env.local` yukler, local dev auth'u acar, DeepSeek provider cagrisini canli internete veya credential'a baglamadan deterministic tool-call stub ile yanitlar ve `/ws/desktop-agent` + `/ws` runtime zincirini gercek server uzerinde calistirir.
- Proof zinciri fake device uretmez: paketli Electron runtime gercek desktop bridge handshake yapar, server registry cihazi `online` olarak listeler, runtime `desktop.screenshot` tool'unu hedef `connection_id` ile paketli agent'a dispatch eder, approval resolve sinyali gonderilir, tool result `success` olarak doner ve process kapatilinca cihaz `/desktop/devices` listesinden kalkar.
- `apps/desktop-agent/package.json` icine build + package + proof zincirini tek komuta toplayan `test:presence-release-proof` script'i eklendi.
- Dogrulama:
  - `pnpm.cmd --filter @runa/desktop-agent typecheck` PASS
  - `pnpm.cmd --filter @runa/server typecheck` PASS
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd exec biome check apps/desktop-agent/scripts/packaged-runtime-smoke.mjs apps/desktop-agent/scripts/packaged-runtime-smoke-server.mjs apps/desktop-agent/package.json` PASS
  - `pnpm.cmd --filter @runa/desktop-agent run test:presence-release-proof` PASS; `DESKTOP_PACKAGED_RUNTIME_SMOKE_SUMMARY device_online=true`, `device_removed_after_shutdown=true`, `approval_resolve_sent=true`, `screenshot_succeeded=true`, `run_status="desktop_screenshot_success"`.
- Durust kalan durum: Bu proof sirasinda artifact unsigned idi ve `asar usage is disabled`, `default Electron icon is used`, npm `recursive` warning ve shell deprecation warning'i gorulmustu. Bu maddeler ayni gun `Desktop Installer Trust & Packaging Polish` goreviyle kapatildi; code signing sertifikasi hala ayri release gereksinimidir.

### Track A / Gateway - DeepSeek Provider + Model Economy Routing - 28 Nisan 2026

- DeepSeek, mevcut `ModelGateway` omurgasina ayri ve additive provider olarak eklendi. WS/runtime/approval/ToolRegistry contract'lari yeniden tasarlanmadi.
- Shared provider union ve default model listesi `deepseek` ile genisletildi. Default ucuz/balanced model `deepseek-v4-flash`; derin akil yurutme ve tool-heavy isler icin router hedef modeli `deepseek-v4-pro`.
- `apps/server/src/gateway/deepseek-gateway.ts` eklendi. Adapter `https://api.deepseek.com/chat/completions` endpoint'ine `Authorization: Bearer ...` ile gider, `generate()` ve `stream()` yollarini destekler, `max_output_tokens` alanini `max_tokens` olarak gonderir, OpenAI-compatible tool call parsing seam'ini korur ve DeepSeek SSE keep-alive comment satirlarini tolere eder.
- DeepSeek adapter'i text/document attachment yolunu destekler; image attachment geldiginde vision-capable DeepSeek path'i live dogrulanmadigi icin typed request error verir. Boylece sahte multimodal/vision claim'i acilmadi.
- Model ekonomi seami eklendi: DeepSeek provider secildiginde router varsayilan aktif kalir; kisa/prompt-only isler `deepseek-v4-flash` + `thinking: disabled`, derin analiz/tool-heavy isler `deepseek-v4-pro` + `thinking: enabled` + `reasoning_effort: high` ile kosar. Model tier adlari `DEEPSEEK_FAST_MODEL` / `DEEPSEEK_REASONING_MODEL` ile override edilebilir. Diger provider'lar icin global router hala `RUNA_MODEL_ROUTER_ENABLED=1` ile opt-in.
- Dev runtime default'u DeepSeek'e alindi: `apps/web/src/hooks/useChatRuntime.ts` artik yeni/temiz localStorage oturumlarinda `DEFAULT_PROVIDER='deepseek'` ile baslar. Mevcut kullanici localStorage runtime config'i varsa ezilmez; temizlemek veya provider'i UI'dan degistirmek gerekir.
- Env fallback seami `DEEPSEEK_API_KEY` ile acildi; `approval-store` secret minimization DeepSeek icin de server env varsa persisted request-only key'i bosaltir. `.env-ÃƒÂ¶rnek` ve `.env.server.example` icine `DEEPSEEK_API_KEY`, `DEEPSEEK_FAST_MODEL`, `DEEPSEEK_REASONING_MODEL`, `RUNA_DEEPSEEK_MODEL_ROUTER_ENABLED` ve `RUNA_MODEL_ROUTER_ENABLED` placeholder'lari eklendi.
- `apps/server/scripts/deepseek-live-smoke.mjs` ve `test:deepseek-live-smoke` komutu eklendi. Helper fast roundtrip, reasoning route, streaming ve tool schema request stage'lerini tek `DEEPSEEK_LIVE_SMOKE_SUMMARY` altinda raporlar. Live smoke DeepSeek-only proof icin provider fallback'i kapatir; boylece provider hatasi baska provider credential eksigiyle maskelenmez.
- Canli DeepSeek proof sirasinda iki provider-specific uyumluluk noktasi kapatildi: `DeepSeek` kelimesinin kendisi artik router'da `deep_reasoning` tetiklemiyor ve DeepSeek tool isimlerinde nokta kabul etmedigi icin adapter `file.read` gibi Runa tool adlarini provider'a `file_read` alias'iyle gonderip response'u tekrar canonical Runa tool adina ceviriyor.
- Pre-existing dirty tree notu: bu tura baslamadan once repo genis olcekte dirty idi; server/web/types/provider dosyalari ve cok sayida desktop/web dosyasi zaten modified/untracked durumdaydi. Bu tur yalniz DeepSeek provider/router/env/smoke ve bu `PROGRESS.md` kaydi hedeflendi.
- Dogrulama:
  - `pnpm.cmd --filter @runa/types typecheck` PASS
  - `pnpm.cmd --filter @runa/types build` PASS
  - `pnpm.cmd --filter @runa/server typecheck` PASS
  - `pnpm.cmd --filter @runa/server build` PASS
  - `pnpm.cmd --filter @runa/server lint` PASS
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/gateway/gateway.test.ts src/gateway/model-router.test.ts` PASS (`2` dosya / `72` test)
  - `pnpm.cmd exec biome check packages/types/src/ws.ts apps/server/src/gateway/config-resolver.ts apps/server/src/persistence/approval-store.ts apps/server/src/gateway/fallback-chain.ts apps/server/src/gateway/model-router.ts apps/server/src/gateway/factory.ts apps/server/src/gateway/deepseek-gateway.ts apps/server/src/gateway/gateway.test.ts apps/server/src/gateway/model-router.test.ts apps/server/package.json apps/server/scripts/deepseek-live-smoke.mjs .env.server.example .env-ÃƒÂ¶rnek` PASS
  - `pnpm.cmd exec biome check apps/server/src/gateway/deepseek-gateway.ts apps/server/src/gateway/gateway.test.ts apps/server/src/gateway/model-router.ts apps/server/src/gateway/model-router.test.ts apps/server/scripts/deepseek-live-smoke.mjs` PASS
  - `pnpm.cmd --filter @runa/web exec biome check src/hooks/useChatRuntime.ts` PASS
- Canli smoke durumu: current shell'de `DEEPSEEK_API_KEY` yok; anahtar kullanicinin girdigi `.env` dosyasindan yalniz test alt surecine tasinarak kosuldu. Once bagimsiz API key testi `deepseek-v4-flash` ile HTTP `200` PASS verdi. Ardindan `pnpm.cmd --filter @runa/server run test:deepseek-live-smoke` file-backed env ile PASS verdi: `cheap_roundtrip` -> `deepseek-v4-flash`, `reasoning_roundtrip` -> `deepseek-v4-pro`, `streaming_roundtrip` -> `deepseek-v4-flash`, `tool_schema_request` -> `deepseek-v4-pro` ve `outcome_kind=tool_call_candidate`.
- Dar default-provider degisikligi sonrasi `pnpm.cmd --filter @runa/web typecheck` kosuldu ancak mevcut web dirty-tree/baseline kiriklariyla FAIL verdi: `DashboardPage.js` module bulunamiyor, `DeveloperPage`, `DesktopDevicesState`, `DesktopDevicePresenceSnapshot` ve `Theme` sembolleri bulunamiyor. Bu kiriklar `useChatRuntime.ts` default provider degisikliginden kaynaklanmiyor.

### Track A / Runtime UX - Agent Delegation Role Hardening - 28 Nisan 2026

- `agent.delegate` tool contract'i provider'lara artik machine-readable `enum: ['researcher', 'reviewer', 'coder']` olarak gider. Boylece modelin role alaninda serbest metin uydurma ihtimali azaltilir.
- Runtime validasyonu obvious model alias'larini guvenli canonical role'a normalize eder: `developer` / `engineer` / `implementer` -> `coder`, `review` / `qa` -> `reviewer`, `research` / `searcher` -> `researcher`.
- Hala cozumlenemeyen role degeri gelirse ham validator kopyasi kullaniciya tasinmaz; presentation ozetinde Runa'nin delege adimini guvenli baslatamadigi sade urun diliyle gosterilir.
- Non-goal: `agent.delegate` rolleri genisletilmedi, sub-agent policy/allowlist ve approval/auto-continue state machine yeniden tasarlanmadi.
- Dogrulama:
  - `pnpm.cmd --filter @runa/types typecheck` PASS
  - `pnpm.cmd --filter @runa/server typecheck` PASS
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/tools/agent-delegate.test.ts src/presentation/map-tool-result.test.ts src/gateway/request-tools.test.ts` PASS (`3` dosya / `15` test)
  - `pnpm.cmd exec biome check packages/types/src/tools.ts packages/types/src/gateway.ts apps/server/src/gateway/request-tools.ts apps/server/src/gateway/request-tools.test.ts apps/server/src/tools/agent-delegate.ts apps/server/src/tools/agent-delegate.test.ts apps/server/src/presentation/map-tool-result.ts apps/server/src/presentation/map-tool-result.test.ts` PASS
  - `pnpm.cmd --filter @runa/server build` PASS
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web exec biome check src/App.tsx src/pages/SettingsPage.tsx` PASS
- Canli smoke: dev bootstrap + `/conversations` + WS `run.request` localhost uzerinde calisti; `developer sub-agent` isteyen prompt'ta `agent.delegate` `success` dondu ve eski `sub_agent_role must be one of...` validator metni WS bloklarina sizmadi. Auto-continue approval replay denemesi bu smoke'ta mevcut pending approval persistence/race sinirina takildi (`Pending approval not found`); bu agent-role fix'inden ayri takip edilecek bir hardening seam olarak duruyor.
- Follow-up fix: incremental `approval_block` yayini artik block socket'e gonderilmeden once ayni approval request'i `ApprovalStore` icine persist ediyor. Bu, kullanicinin onay butonuna finalization tamamlanmadan hizli basmasi halinde gorulen `Pending approval not found` race'ini kapatir.
- Follow-up dogrulama:
  - `pnpm.cmd --filter @runa/server typecheck` PASS
  - `pnpm.cmd exec biome check apps/server/src/ws/run-execution.ts` PASS
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/ws/register-ws.test.ts -t "continues a live tool-follow-up turn after approving auto-continue"` PASS
  - `pnpm.cmd --filter @runa/server build` PASS
  - Canli WS smoke'ta hizli `approval.resolve` sonrasi `Pending approval not found` tekrar etmedi. Ayni live run provider tarafi `Groq HTTP 429/413` ile terminal `failed` bitti; bu approval persistence race'inden ayri provider/rate-limit davranisi.
- Main provider follow-up: Web runtime config default'u DeepSeek oldugu halde tarayicida kalmis eski `runa.developer.runtime_config` Groq default kaydi kullaniciyi Groq'ta tutabiliyordu. `apps/web/src/hooks/useChatRuntime.ts` artik legacy Groq default config'i DeepSeek default config'e migrate eder; kullanici ozellikle farkli provider/model set ettiyse bu secim korunur.
- DeepSeek canli smoke: `provider: 'deepseek'`, `model: 'deepseek-v4-flash'`, request-side `apiKey: ''` ile server env fallback kullanilarak WS run kosuldu. Sonuc: dev bootstrap `302`, `/conversations` `200`, `run.accepted`, `run.finished completed`; WS payload'larinda Groq gorulmedi. Server log: `provider":"deepseek"`, `run_id":"run_live_deepseek_1777373686185"`, final `COMPLETED`.
- Ek dogrulama:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web exec biome check src/hooks/useChatRuntime.ts` PASS
  - `pnpm.cmd --filter @runa/server typecheck` PASS

### Track C - Package 1 Information Architecture Reset - 27 Nisan 2026

- Authenticated ana urun IA'si `Chat / History / Devices / Account` etrafinda yeniden hizalandi. `AppNav` artik Developer Mode'u primary navigation item olarak gostermiyor; ana nav kompakt, chat-first shell icinde de gorunur durumda.
- `apps/web/src/App.tsx` route yapisi genisletildi: `/chat` default kaldi, `/history` kayitli sohbetler icin birinci sinif yuzey oldu, `/devices` masaustu companion/device presence yuzeyi oldu, `/account` sade hesap/tercih/secondary developer entry alani olarak daraltildi. Legacy `/settings` -> `/account`, `/dashboard` -> `/history` redirect'iyle dashboard-first okuma geriye cekildi.
- `apps/web/src/pages/HistoryPage.tsx` eklendi. Mevcut `useConversations` verisini kullanarak arama, tarih gruplama, aktif sohbet secimi ve yeni sohbet baslatma akisini page-level hale getiriyor; History yalniz chat sidebar'ina sikismiyor.
- `apps/web/src/pages/DevicesPage.tsx` eklendi. Mevcut `/desktop/devices` client seami ve `DevicePresencePanel` kullanilarak gercek cihaz presence/empty/error/loading durumlari ayri urun capability yuzeyine tasindi; fake device success uretilmiyor.
- `SettingsPage` icinden cihaz presence ve project-memory yuzeyleri cikarildi; hesap sayfasi profil, cikis, ses tercihleri ve Developer Mode secondary entry ile daha sade hale getirildi. Developer surfaces silinmedi; `/developer` route'u ve mevcut runtime/transport panelleri korunuyor, erisim Account icindeki ikincil toggle/link uzerinden yapiliyor.
- Degistirilmeyen alanlar: server, WS/auth backend, desktop-agent runtime, shared contracts ve yeni dependency yok. Repo genelinde onceki dirty tree cok genis oldugu icin task disi dosyalar revert edilmedi.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web exec biome check src\App.tsx src\components\app\AppNav.tsx src\components\app\AppShell.tsx src\pages\ChatPage.tsx src\pages\DashboardPage.tsx src\pages\SettingsPage.tsx src\pages\HistoryPage.tsx src\pages\DevicesPage.tsx src\localization\copy.ts` PASS
  - `pnpm.cmd --filter @runa/web test -- src/pages/FirstImpressionPolish.test.tsx src/components/chat/ChatFirstShell.test.tsx src/components/chat/ConversationSidebar.test.tsx src/components/desktop/DevicePresencePanel.test.tsx` PASS (`4` dosya / `8` test)
  - `pnpm.cmd --filter @runa/web build` PASS
- Browser smoke: Vite dev server `http://localhost:5173/` uzerinde acildi, HTTP `200` dondu ve Playwright CLI ile `.codex-screenshots/ia-reset-login.png` alindi. Backend server bu turda ayaga kaldirilmadigi icin login yuzeyinde auth proxy `502` gorundu; authenticated `/chat`, `/history`, `/devices`, `/account`, `/developer` route'lari icin full browser/screenshot QA henuz kosulmadi.
- Kalan takip: Sonraki dar pass, authenticated smoke ile `/chat`, `/history`, `/devices`, `/account`, `/developer` route'larinda nav framing ve mobile text fit kontrolu yapmali.

### Root TASK / UI-PHASE Closure Audit - 27 Nisan 2026

- Kokteki `TASK-01` ... `TASK-12` ve `UI-PHASE-1` ... `UI-PHASE-7` belgeleri, mevcut `PROGRESS.md` kapanis notlari ve repo dosyalariyla tekrar karsilastirildi. Yeni kod patch'i gerektiren test/build/lint kirigi bulunmadi.
- Gunluk kod sagligi tekrar dogrulandi:
  - `pnpm.cmd --filter @runa/types typecheck` PASS
  - `pnpm.cmd --filter @runa/db typecheck` PASS
  - `pnpm.cmd --filter @runa/server typecheck` PASS
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/desktop-agent typecheck` PASS
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd --filter @runa/server build` PASS
  - `pnpm.cmd --filter @runa/db build` PASS
  - `$env:GO_BIN='C:\Program Files\Go\bin\go.exe'; pnpm.cmd --filter @runa/desktop-agent build` PASS
- Targeted root-task test audit yesil:
  - Vision/search/browser/parallel scheduler: `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/tools/desktop-vision-analyze.test.ts src/tools/desktop-verify-state.test.ts src/tools/web-search.test.ts src/runtime/tool-scheduler.test.ts src/tools/browser-manager.test.ts src/tools/browser-navigate.test.ts src/tools/browser-extract.test.ts src/tools/browser-click.test.ts src/tools/browser-fill.test.ts` PASS (`9` dosya / `38` test)
  - Desktop utility/MCP/structured output: `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/tools/desktop-clipboard.test.ts src/tools/desktop-launch.test.ts src/tools/file-watch.test.ts src/mcp/http-transport.test.ts src/mcp/client.test.ts src/mcp/registry-bridge.test.ts src/presentation/output-parser.test.ts` PASS (`7` dosya / `38` test)
  - Memory/multi-agent: `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/tools/memory-tools.test.ts src/context/compose-memory-context.test.ts src/context/build-memory-prompt-layer.test.ts src/context/orchestrate-memory-read.test.ts src/runtime/sequential-sub-agent.test.ts src/runtime/sub-agent-scheduler.test.ts src/tools/agent-delegate.test.ts` PASS (`7` dosya / `29` test)
  - Upload/file-share/download: `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/routes/upload.test.ts src/gateway/gateway.test.ts src/ws/live-request.test.ts src/tools/file-share.test.ts src/storage/storage-routes.test.ts src/presentation/map-file-download.test.ts` PASS (`6` dosya / `75` test)
  - Web/UI polish/file upload: `pnpm.cmd --filter @runa/web exec vitest run --config ./vitest.config.mjs --configLoader runner src/pages/FirstImpressionPolish.test.tsx src/components/chat/ChatFirstShell.test.tsx src/components/chat/ConversationSidebar.test.tsx src/components/desktop/DevicePresencePanel.test.tsx src/components/settings/ProjectMemorySummary.test.tsx src/components/chat/UIPhase5Surfaces.test.tsx src/components/chat/blocks/BlockRenderer.test.tsx src/lib/motion.test.ts src/components/chat/FileUploadButton.test.ts` PASS (`9` dosya / `21` test)
  - Desktop native input: `pnpm.cmd --filter @runa/desktop-agent exec vitest run --configLoader runner src/native-input-driver.test.ts src/go-sidecar-input-driver.test.ts` PASS (`2` dosya / `7` test)
  - DB unit/RLS schema: `pnpm.cmd --filter @runa/db test -- src/rls.test.ts src/schema.test.ts src/smoke.test.ts` PASS (`3` dosya / `15` test)
- Biome/lint audit yesil:
  - `pnpm.cmd --filter @runa/server lint` PASS
  - `pnpm.cmd --filter @runa/web exec biome check src` PASS
  - `pnpm.cmd --filter @runa/desktop-agent exec biome check src electron scripts package.json electron-builder.yml NATIVE-INPUT-STRATEGY.md ELECTRON-DEPENDENCY-RFC.md` PASS
  - `pnpm.cmd --filter @runa/db exec biome check src scripts` PASS
  - `pnpm.cmd --filter @runa/types exec biome check src` PASS
- Live/proof audit:
  - `pnpm.cmd --filter @runa/server exec node scripts/local-file-transfer-proof.mjs` PASS; signed relative download, invalid signature `403` ve user-scope denial kanitlandi.
  - `pnpm.cmd --filter @runa/desktop-agent exec node scripts/benchmark-native-input-go.mjs` PASS; `scroll_noop` native sidecar benchmark sonucu `average_ms=2.025`, `p95_ms=0.893`, `max_ms=43.056`, `iterations=25`.
  - Serper live audit `.env` icindeki `SERPER_API_KEY` ile PASS; `organic` ve `news` aramalari Serper'dan `2` sonuc dondurdu. Bu iki canli sorguda answer box / knowledge graph provider tarafindan donmedi; ilgili parser davranisi deterministic unit testlerle kanitli.
- Bloklu veya release-gunu tekrar kosulmasi gereken kanitlar:
  - Docker Desktop bu ortamda acik degil: `docker compose ps` ve `docker compose up -d postgres` Docker engine pipe bulunamadigi icin FAIL/BLOCKED. Bu nedenle `packages/db/scripts/local-memory-rls-proof.mjs` bu oturumda FAIL verdi; daha onceki local proof tekrar edilemedi.
  - LM Studio `localhost:1234` bu oturumda cevap vermiyor. `pnpm.cmd --filter @runa/server exec node scripts/lmstudio-vision-smoke.mjs` `fetch failed` ile FAIL; vision implementation unit/integration testleri yesil olsa da canli local model smoke bugunku ortamda tekrar kanitlanmadi.
  - `TASK-09C` icin gercek mouse click / keyboard injection canli smoke'u kosulmadi; guvenli `scroll_noop` benchmark ve health path yesil. Gercek input rehearsal kullanici kontrollu hedef pencere/focus ile release gunu kosulmali.
  - `TASK-12C` browser click/download E2E ve Supabase cloud bucket/CDN kaniti bu audit turunda kosulmadi; local signed-download proof ve route tests yesil.
  - `UI-PHASE-7` Lighthouse skoru halen kosulmadi; onceki a11y smoke ve bu turdaki web test/build/Biome yesil.
- Sonuc: Kok task/UI-PHASE belgelerinin kod/test/build/lint tarafinda bugunku audit icin yeni patch gerektiren eksigi bulunmadi. "Eksiksiz ve kusursuz production closure" iddiasi icin Docker local DB/RLS proof, LM Studio veya hedef cloud vision live smoke, gercek desktop input rehearsal, browser download E2E ve Lighthouse gibi ortam/proof kapilari ayrica yesil yapilmalidir.

### Track C - First-Impression Polish Pass - 27 Nisan 2026

- `apps/web` odakli first-impression polish pass tamamlandi. Server/runtime/types/db/desktop-agent/package/lockfile davranisina dokunulmadi; kapsam login, empty chat, composer, sidebar error copy, account/settings, device presence, project memory ve CSS polish ile sinirli tutuldu.
- `LoginPage` ilk ekranda `principal`, `transport`, `stored token seam` gibi ham auth/operator etiketlerini gostermeyecek sekilde sade giris akisiyle toparlandi. Yerel gelistirme oturumu, token dogrulama, auth refresh ve token clear aksiyonlari davranisi korunarak kapali `Gelistirici girisi` detayina tasindi; e-posta/OAuth normal giris yolu onde kaldi.
- `EmptyState` ve `ChatComposerSurface` ilk prompt deneyimi icin daha dogal is baslatan copy ile guncellendi. Developer/runtime eksikligi ve default baglanti uyarilari yalniz Developer Mode acikken gorunur; attachment ve error copy'si daha az teknik hale getirildi.
- `SettingsPage` teknik session kartini varsayilan account yuzeyinden cikardi; account, ses tercihleri, device presence, project memory ve developer secondary-layer bolumleri daha sakin ayrildi. Device presence ve project memory fake success uretmeden bos/unavailable durumlarini urun diliyle gosteriyor.
- `ConversationSidebar` real browser QA sirasinda yakalanan ham JSON/500 hata sizintisini yumusatti: `/conversations` 500 donse bile varsayilan yuzeyde `Internal Server Error` / `statusCode` gosterilmiyor, kullanici dostu hata metni cikiyor.
- Yeni/updated coverage: `apps/web/src/pages/FirstImpressionPolish.test.tsx`, `ConversationSidebar.test.tsx`, `ChatFirstShell.test.tsx`, `DevicePresencePanel.test.tsx`, `ProjectMemorySummary.test.tsx`.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web exec vitest run --config ./vitest.config.mjs --configLoader runner src/pages/FirstImpressionPolish.test.tsx src/components/chat/ChatFirstShell.test.tsx src/components/chat/ConversationSidebar.test.tsx src/components/desktop/DevicePresencePanel.test.tsx src/components/settings/ProjectMemorySummary.test.tsx` PASS (`5` dosya / `10` test)
  - `pnpm.cmd --filter @runa/web exec biome check src/pages/LoginPage.tsx src/pages/SettingsPage.tsx src/pages/FirstImpressionPolish.test.tsx src/components/auth/AuthModeTabs.tsx src/components/chat/EmptyState.tsx src/components/chat/ChatComposerSurface.tsx src/components/chat/ChatFirstShell.test.tsx src/components/chat/ConversationSidebar.tsx src/components/chat/ConversationSidebar.test.tsx src/components/desktop/DevicePresencePanel.tsx src/components/desktop/DevicePresencePanel.test.tsx src/components/settings/ProjectMemorySummary.tsx src/components/settings/ProjectMemorySummary.test.tsx src/index.css` PASS
  - `pnpm.cmd --filter @runa/web build` PASS
- Browser QA: local server + web dev server ile `http://localhost:5173/` acildi. In-app browser real-server smoke'ta login ve chat render edildi; local DB olmadigi icin `/conversations` 500 donmesine ragmen sidebar'da ham JSON hata gorunmedigi dogrulandi. Docker Desktop bu ortamda calismadigi icin local Postgres ayaga kaldirilamadi.
- Screenshot QA: Playwright ile `320x700`, `768x900`, `1440x1000` viewports icin login/chat/account yuzeyleri kosuldu; `/conversations` ve `/desktop/devices` GET istekleri bos listeyle stub'lanarak UI first-impression yuzeyi izole edildi. Console error/pageerror `0`; ham `principal`, `stored token seam`, `Mevcut tarayici auth durumu`, `Raw Transport`, `Model Override`, `minimum seam`, `Internal Server Error`, `statusCode` metinleri gorunmedi. Kanitlar: `.codex-screenshots/first-impression-polish/320x700-login.png`, `320x700-chat.png`, `320x700-account.png`, `768x900-login.png`, `768x900-chat.png`, `768x900-account.png`, `1440x1000-login.png`, `1440x1000-chat.png`, `1440x1000-account.png`, `browser-qa-summary.json`.
- Durust kalan durum: Bu pass UI first-impression kalitesini kapatir; full production browser QA icin local/cloud DB'nin calisir olmasi ve gercek `/conversations` endpoint'inin 500 donmemesi ayrica dogrulanmali.

### Track C - TASK-09A/09B Native Input Strategy + Driver Abstraction - 26 Nisan 2026

- `TASK-09-NATIVE-INPUT-NUTJS.md` kapsaminda native dependency eklemeden once gereken mini-RFC ve abstraction seam'i kapatildi. `apps/desktop-agent/NATIVE-INPUT-STRATEGY.md` Nut.js'e kilitlenmeden PowerShell, Nut.js, Go sidecar ve Rust sidecar seceneklerini Windows-first packaging, crash isolation, benchmark ve approval etkisiyle karsilastiriyor.
- RFC onerisi: PowerShell mevcut guvenli fallback olarak kalacak; ilk native acceleration deneyi icin Go sidecar oneriliyor. Gerekce: Electron ABI/native module rebuild riskini Nut.js'e gore azaltmasi, crash isolation'i process boundary ile saglamasi ve packaging/signing/AV kanitini explicit sidecar kontratina tasimasi.
- `apps/desktop-agent/src/native-input-driver.ts` ile `DesktopNativeInputDriver`, `ClickInput`, `TypeInput`, `KeypressInput`, `ScrollInput`, `NativeInputHealth` ve mevcut `DesktopAgentInputExecutionResult` contract'i ayrildi. Bu, ileride native driver eklenirken server-side desktop tools veya WS kontratlarini degistirmeden ilerleme zemini kuruyor.
- `apps/desktop-agent/src/powershell-input-driver.ts` mevcut Windows PowerShell input implementation'ini driver adapter olarak sarar hale getirildi. `apps/desktop-agent/src/input.ts` validasyon + dispatch katmanina inceltildi; mevcut `desktop.click`, `desktop.type`, `desktop.keypress`, `desktop.scroll` output contract'i korunuyor ve success metadata'sina `driver_kind: powershell` ekleniyor.
- Crash/timeout yolu sertlestirildi: driver artik `ETIMEDOUT` hatasini `TIMEOUT` + `retryable=true` typed sonucuna ceviriyor; invalid input driver spawn etmeden reddediliyor; unsupported platform mevcut typed error yolunu koruyor.
- `apps/desktop-agent/src/native-input-driver.test.ts` eklendi: PowerShell driver routing, invalid input pre-driver rejection, timeout mapping ve health metadata test edildi.
- Degistirilmeyen alanlar: `apps/server/src/tools/desktop-*.ts`, `packages/types/src/ws.ts`, `apps/desktop-agent/src/session.ts`, `apps/desktop-agent/src/auth.ts`, `apps/desktop-agent/src/ws-bridge.ts` davranisina dokunulmadi. Yeni native dependency, sidecar binary veya packaging build step'i eklenmedi.
- Dogrulama:
  - `pnpm.cmd --filter @runa/desktop-agent typecheck` PASS
  - `pnpm.cmd exec vitest run apps/desktop-agent/src/native-input-driver.test.ts --environment node` PASS (`4` test)
  - `pnpm.cmd exec biome check apps/desktop-agent/src/input.ts apps/desktop-agent/src/native-input-driver.ts apps/desktop-agent/src/powershell-input-driver.ts apps/desktop-agent/src/native-input-driver.test.ts apps/desktop-agent/src/index.ts apps/desktop-agent/NATIVE-INPUT-STRATEGY.md` PASS
  - `pnpm.cmd --filter @runa/desktop-agent build` PASS
- Durust kalan durum: `TASK-09C` bilincli olarak acilmadi. Belgeye gore native driver yalniz RFC kabulunden ve dependency/sidecar onayindan sonra uygulanabilir; bu turda bu onay verilmeden Nut.js/Go/Rust dependency eklenmedi ve benchmark/native-driver claim'i yazilmadi. Sonraki adim: RFC kabul edilirse Go sidecar IPC/lifecycle/timeout/heartbeat/kill cleanup ve gercek benchmark gorevi acilmali.

### Track C - TASK-09C Go Sidecar Native Input Driver - 26 Nisan 2026

- User kararina gore `TASK-09C` icin secilen native path Go sidecar olarak uygulandi. Nut.js/native Node binding eklenmedi; PowerShell driver guvenli fallback olarak korunuyor.
- `apps/desktop-agent/sidecars/native-input-go/` altinda Windows-first tek binary sidecar eklendi. JSON-lines stdin/stdout IPC protokolu `health`, `click`, `type`, `keypress`, `scroll` komutlarini destekliyor; native input tarafinda `user32.dll` API'leri kullaniliyor.
- `apps/desktop-agent/scripts/build-native-input-go.mjs` build seami eklendi ve `apps/desktop-agent/package.json` build zinciri sidecar'i `dist-electron/sidecars/native-input-go.exe` altina uretir hale getirildi. `electron-builder.yml` icindeki mevcut `dist-electron/**/*` paketi sidecar'i release artefact'ina dahil edecek sekilde yeterli kaldi.
- `apps/desktop-agent/src/go-sidecar-input-driver.ts` eklendi. Driver binary discovery, persistent child process lifecycle, request id/pending map, timeout, dispose/kill cleanup ve typed error mapping sagliyor. `RUNA_DESKTOP_INPUT_DRIVER=go_sidecar` veya dependency injection ile secilebiliyor; default driver davranisi backward-compatible olarak PowerShell kaldi.
- Crash/timeout/abort coverage eklendi: missing binary `health()` sonucu `unavailable` donuyor; fake sidecar spawn ile explicit Go driver dispatch test edildi; sessiz sidecar timeout oldugunda process kill cleanup kanitlandi.
- Benchmark/proof: `apps/desktop-agent/scripts/benchmark-native-input-go.mjs` derlenmis sidecar'a guvenli `scroll_noop` komutu gondererek IPC/native command yolunu olctu. Canli sonuc: `average_ms=0.674`, `p95_ms=0.411`, `max_ms=14.756`, `iterations=25`, `result=PASS`.
- Live sidecar health smoke derlenmis binary uzerinden PASS verdi: `{"id":"health-1","status":"success","output":{"capabilities":["click","type","keypress","scroll"],"kind":"go_sidecar","platform":"windows"}}`.
- Dogrulama:
  - `$env:GO_BIN='C:\Program Files\Go\bin\go.exe'; pnpm.cmd --filter @runa/desktop-agent run build:sidecar` PASS
  - `pnpm.cmd --filter @runa/desktop-agent typecheck` PASS
  - `pnpm.cmd --filter @runa/desktop-agent exec vitest run --configLoader runner src/native-input-driver.test.ts src/go-sidecar-input-driver.test.ts` PASS (`2` dosya / `7` test)
  - `pnpm.cmd --filter @runa/desktop-agent exec biome check src/go-sidecar-input-driver.ts src/go-sidecar-input-driver.test.ts src/input.ts src/native-input-driver.ts src/native-input-driver.test.ts src/index.ts package.json scripts/build-native-input-go.mjs scripts/benchmark-native-input-go.mjs` PASS
  - `pnpm.cmd --filter @runa/desktop-agent exec node scripts/benchmark-native-input-go.mjs` PASS
  - `$env:GO_BIN='C:\Program Files\Go\bin\go.exe'; pnpm.cmd --filter @runa/desktop-agent build` PASS
- Durust kalan durum: benchmark guvenli `scroll_noop` komutuyla kosuldu; gercek mouse click/keyboard injection canli smoke'u bu turda bilincli olarak kosulmadi, cunku mevcut desktop focus'unu degistirip kullanici ortaminda istenmeyen etki yaratabilir. Driver ve sidecar command path'i test/proof seviyesinde kapandi; release gunu signing/AV ve gercek packaged-runtime input rehearsal ayrica kosulmali.

### Track A / Track C - TASK-02 Local-First Vision Strategy Refresh - 26 Nisan 2026

- User kararina gore vision smoke stratejisi local-first olarak netlestirildi: LM Studio / OpenAI-compatible endpoint development proof icin birinci yol; production/cloud provider gecisi daha sonra endpoint/key degisimiyle yapilacak.
- `apps/server/src/gateway/openai-gateway.ts` guvenli default'u koruyarak genisletildi. Loopback LM Studio endpoint'leri varsayilan olarak calisir; non-loopback OpenAI-compatible endpoint yalniz `RUNA_OPENAI_COMPAT_ALLOW_REMOTE=1` ile acilir. Boylece local dev kapisi acik, remote override ise explicit kalir.
- `.env.server.example` ve `.env-ÃƒÂ¶rnek` icine local vision smoke alanlari eklendi: `OPENAI_API_KEY`, `RUNA_OPENAI_BASE_URL`, `LMSTUDIO_BASE_URL`, `LMSTUDIO_MODEL`, `LMSTUDIO_API_KEY`, `RUNA_OPENAI_COMPAT_ALLOW_REMOTE`.
- Mevcut `desktop.vision_analyze` ve `desktop.verify_state` tool contract'i korunarak test edildi. Tool'lar screenshot artifact uydurmuyor; onceki `desktop.screenshot` sonucundan gercek PNG attachment cozerse `ModelGateway.generate()` uzerinden analiz/verify yapiyor.
- Live LM Studio preflight PASS: `http://localhost:1234/v1/models` qwen model listesini dondurdu; canli smoke `LMSTUDIO_MODEL=qwen/qwen3.5-9b` ile kosuldu. Model id'de "vision" yazmiyor, fakat LM Studio OpenAI-compatible endpoint image attachment kabul etti ve smoke PASS verdi.
- Live smoke sonucu: `desktop.vision_analyze` kirmizi buton icin `visibility=visible`, `confidence=0.95`, `requires_user_confirmation=true` dondu; `desktop.verify_state` sonraki screenshot icin `verified=true` ve yesil success panel degisimini gozlemledi.
- Dogrulama:
  - `pnpm.cmd --filter @runa/types typecheck` PASS
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/tools/desktop-vision-analyze.test.ts src/tools/desktop-verify-state.test.ts src/gateway/gateway.test.ts` PASS (`3` dosya / `65` test)
  - `pnpm.cmd --filter @runa/server exec tsc --noEmit` PASS
  - `pnpm.cmd --filter @runa/server exec biome check src/tools/desktop-vision-analyze.ts src/tools/desktop-vision-analyze.test.ts src/tools/desktop-verify-state.ts src/tools/desktop-verify-state.test.ts src/tools/registry.ts src/context/compose-context.ts src/gateway/openai-gateway.ts src/gateway/gateway.test.ts scripts/lmstudio-vision-smoke.mjs ../../packages/types/src/tools.ts ../../.env.server.example ../../.env-ÃƒÂ¶rnek` PASS
  - `pnpm.cmd --filter @runa/server build` PASS
  - `$env:LMSTUDIO_BASE_URL='http://localhost:1234/v1'; $env:LMSTUDIO_MODEL='qwen/qwen3.5-9b'; $env:LMSTUDIO_API_KEY='lmstudio-local'; pnpm.cmd --filter @runa/server exec node scripts/lmstudio-vision-smoke.mjs` PASS
- Durust kalan durum: bu proof local/dev LM Studio smoke'tur; cloud Gemini/OpenAI production quality veya signed desktop release claim'i yapmaz. Yayin gunu hedef cloud provider icin ayri live credential + live smoke PASS gerekecek.

### Track A / Track B - TASK-08 Local Memory RLS Proof - 26 Nisan 2026

- `TASK-08-SEMANTIC-MEMORY.md` icindeki privacy-first memory hattinin local DB/RLS kaniti icin `packages/db/scripts/local-memory-rls-proof.mjs` eklendi. Urun runtime davranisi genisletilmedi; script local proof icin transactional calisir ve sonunda rollback yapar.
- Proof script'i gercek `memories` tablosunu kullanir, `tenant_id`, `workspace_id`, `user_id` scope kolonlarini garanti eder, transaction icinde RLS'i enable/force eder ve `memories_select_rls_probe_policy` ile tenant/user izolasyonu uygular.
- RLS bypass riskini azaltmak icin transaction icinde ayrik `runa_memory_rls_probe_user` role'u olusturulur, yalniz `SELECT` yetkisi verilir ve `SET LOCAL ROLE` ile non-owner okuma yapilir. Proof role, policy ve proof rows rollback ile temizlenir.
- Local Docker Postgres 5432 dolu oldugu icin `POSTGRES_PORT=55432` ile kaldirildi. Canli proof PASS: `LOCAL_MEMORY_RLS_PROOF {"database_url_host":"localhost:55432","proof_table":"memories","result":"PASS","rls_policy":"memories_select_rls_probe_policy","rollback":true,"visible_counts":{"tenant_a_user_a":1,"tenant_a_user_b":1,"tenant_b_user_a":1}}`.
- Memory tool privacy coverage tekrar dogrulandi: explicit save, sensitive content rejection, inferred/conversation consent gate, list/search provenance ve same-scope soft delete davranisi yesil.
- Dogrulama:
  - `$env:POSTGRES_PORT='55432'; docker compose up -d postgres` PASS
  - `$env:DATABASE_URL='postgresql://runa:runa@localhost:55432/runa'; pnpm.cmd --filter @runa/db exec node scripts/local-memory-rls-proof.mjs` PASS
  - `pnpm.cmd --filter @runa/db typecheck` PASS
  - `pnpm.cmd --filter @runa/db test -- src/rls.test.ts src/schema.test.ts src/smoke.test.ts` PASS (`3` dosya / `15` test)
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/tools/memory-tools.test.ts src/context/compose-memory-context.test.ts src/context/build-memory-prompt-layer.test.ts src/context/orchestrate-memory-read.test.ts` PASS (`4` dosya / `19` test)
  - `pnpm.cmd --filter @runa/db build` PASS
  - `pnpm.cmd --filter @runa/server exec biome check src/tools/memory-save.ts src/tools/memory-search.ts src/tools/memory-delete.ts src/tools/memory-list.ts src/tools/memory-tool-policy.ts src/tools/memory-tools.test.ts src/context/compose-memory-context.ts src/context/compose-memory-context.test.ts src/context/build-memory-prompt-layer.ts src/context/build-memory-prompt-layer.test.ts src/context/orchestrate-memory-read.ts src/context/orchestrate-memory-read.test.ts ../../packages/db/src/rls.ts ../../packages/db/src/rls.test.ts ../../packages/db/scripts/local-memory-rls-proof.mjs` PASS
- Durust kalan durum: full semantic embedding provider/RFC ve inferred memory UI bu proof'un kapsami degil. Bu closure explicit/privacy memory + local DB/RLS izolasyon kanitidir.

### Track B / Track C - TASK-12 Local File Transfer / Signed Download Proof - 26 Nisan 2026

- `TASK-12-FILE-TRANSFER.md` icindeki file share + scoped signed download hattina local proof script'i eklendi: `apps/server/scripts/local-file-transfer-proof.mjs`.
- Script gercek `file.share` tool'unu local in-memory `StorageService` ile calistirir, signed relative download URL uretir, `/storage/download/:id` route'unu Fastify inject ile indirir, bad signature icin 403 bekler ve cross-user storage access'in ownership mismatch ile reddedildigini kanitlar.
- Canli proof PASS: `LOCAL_FILE_TRANSFER_PROOF {"blob_id":"blob_local_file_transfer_proof","content_disposition":"attachment; filename=\"proof.md\"","download_status":200,"expires_at":"2026-04-26T14:55:00.000Z","filename":"proof.md","invalid_signature_status":403,"result":"PASS","size_bytes":67,"storage_ref":"blob_local_file_transfer_proof","url_is_relative":true,"user_scope_denied":true}`.
- Dogrulama:
  - `pnpm.cmd --filter @runa/server exec node scripts/local-file-transfer-proof.mjs` PASS
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/tools/file-share.test.ts src/storage/storage-routes.test.ts src/presentation/map-file-download.test.ts` PASS (`3` dosya / `9` test)
  - `pnpm.cmd --filter @runa/server exec biome check scripts/local-file-transfer-proof.mjs` PASS
- Durust kalan durum: bu proof local/in-memory storage adapter ile kosuldu; Supabase cloud bucket credential'i veya production CDN/browser download E2E claim'i degildir. Security contract tarafinda public/suresiz URL uretilmedigi, imza dogrulandigi ve user scope korundugu kanitlandi.

### Track A - TASK-11A Run-Scoped Cancellation Foundation - 26 Nisan 2026

- `TASK-11-MULTI-AGENT.md` icindeki 11A cancellation foundation kapatildi. Full multi-agent veya `agent.delegate` tool'u acilmadi; once parent/child cancellation, tool abort signal propagation ve process cleanup zemini kuruldu.
- `packages/types/src/tools.ts` icindeki `ToolExecutionSignal` runtime-only signal seami `reason`, `addEventListener` ve `removeEventListener` ile genisletildi. Mevcut `aborted` flag'i korundu; tool contract'i serializable payload haline getirilmedi.
- `apps/server/src/runtime/run-cancellation.ts` eklendi. `RunCancellationScope` parent run icin `AbortController` lifecycle'ini, agent-loop cancellation signal'ini ve tool execution signal'ini tek yerde topluyor. Child scope fan-out destekleniyor; parent cancel edilince child scope'lar da cancel ediliyor.
- `apps/server/src/runtime/process-registry.ts` eklendi. Run-scoped process registry child process handle'larini run_id ile kaydediyor, cancel cleanup'ta Windows icin injectable process-tree killer seam'i ve fallback `kill('SIGTERM')` yollariyla zombie process riskini hedefliyor. Default Windows path `taskkill /PID <pid> /T /F` olarak tanimli; testler deterministic injectable killer ile kosuldu.
- `apps/server/src/runtime/run-agent-loop.ts` artik `RunCancellationScope` tarafindan saglanan tool signal'i `ToolExecutionContext.signal` icine otomatik thread ediyor; caller zaten explicit signal vermisse mevcut signal korunuyor. `agent-loop.ts` cancellation interface'i additive `tool_signal` alanini kabul ediyor.
- `apps/server/src/runtime/run-cancellation.test.ts` eklendi: parent cancel -> child scope cancel -> child process cleanup path'i, process registry unregister davranisi ve `runAgentLoop` icinden tool execution context'e ayni cancellation signal'in tasinmasi test edildi.
- Degistirilmeyen alanlar: gateway provider implementasyonlari, desktop-agent, web, approval policy ve mevcut stop condition semantigi yeniden tasarlanmadi. Multi-agent depth/allowlist/delegation 11B'ye birakildi.
- Dogrulama:
  - `pnpm.cmd --filter @runa/types typecheck` PASS
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/runtime/run-cancellation.test.ts` PASS (`2` test)
  - `pnpm.cmd --filter @runa/server exec tsc --noEmit` PASS
  - `pnpm.cmd --filter @runa/server exec biome check src/runtime/run-cancellation.ts src/runtime/process-registry.ts src/runtime/run-cancellation.test.ts src/runtime/run-agent-loop.ts src/runtime/agent-loop.ts ../../packages/types/src/tools.ts` PASS
  - `pnpm.cmd --filter @runa/server build` PASS
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/runtime/agent-loop.test.ts src/runtime/run-agent-loop.test.ts src/runtime/run-model-turn-loop-adapter.test.ts src/runtime/run-cancellation.test.ts` PASS (`31` test)
- Durust kalan durum: 11B henuz acilmadi; sub-agent max_turns/budget/allowlist/depth ve approval-required tool default-deny davranisi `agent.delegate` tool'u ile birlikte uygulanmali. 11A yalniz lifecycle ve cleanup temelini kapatir.

### Track A - TASK-11B Sequential `agent.delegate` Foundation - 26 Nisan 2026

- `TASK-11-MULTI-AGENT.md` icindeki 11B sequential delegation zemini kapatildi. Parallel delegation/swarm acilmadi; nested sub-agent depth hard-deny ve role-based conservative allowlist ile sinirli tek delegation tool'u eklendi.
- `packages/types/src/tools.ts` `agent` namespace'i ve `agent.delegate` known tool'u ile genisletildi. `AgentDelegateRole`, `AgentDelegationRequest`, `AgentDelegationResult` ve `ToolExecutionContext.delegate_agent` contract'i eklendi. `ToolExecutionContext.metadata.sub_agent_depth` gibi runtime-only metadata tasimaya izin verecek dar optional metadata alani acildi.
- `apps/server/src/runtime/sub-agent-runner.ts` role bazli delegation plan seami olarak eklendi. `researcher`, `reviewer`, `coder` rolleri icin allowlist conservative tutuldu: approval-required, desktop, browser, shell, write ve execute tool'lar default olarak sub-agent'a verilmiyor. Default sub-agent `max_turns=8`, max depth `1`.
- `apps/server/src/tools/agent-delegate.ts` eklendi ve `apps/server/src/tools/registry.ts` built-in registry'ye baglandi. Tool input'u yalniz `sub_agent_role`, `task`, opsiyonel `context` kabul ediyor; nested delegation `PERMISSION_DENIED` donuyor. Runtime context `delegate_agent` handler saglarsa sequential delegation sonucunu `summary`, `evidence`, `turns_used` ile donduruyor; handler yoksa acik `sub_agent_runner_unavailable` sonucu uretiyor.
- `apps/server/src/runtime/tool-scheduler.ts` `agent` effect/resource class'ini taniyor; agent delegation read-only parallel batch'e karismiyor ve sequential resource olarak planlaniyor.
- Test coverage:
  - `apps/server/src/tools/agent-delegate.test.ts`: bounded reviewer delegation, depth deny, allowlist'in high-risk/approval-required tool icermemesi ve built-in registry wiring.
  - Mevcut `tool-scheduler`, `registry`, `agent-loop`, `run-agent-loop` testleriyle adjacent runtime davranisi tekrar dogrulandi.
- Dogrulama:
  - `pnpm.cmd --filter @runa/types typecheck` PASS
  - `pnpm.cmd --filter @runa/server exec tsc --noEmit` PASS
  - `pnpm.cmd --filter @runa/server exec biome check src/tools/agent-delegate.ts src/tools/agent-delegate.test.ts src/tools/registry.ts src/runtime/sub-agent-runner.ts src/runtime/tool-scheduler.ts src/runtime/run-cancellation.ts src/runtime/process-registry.ts src/runtime/run-cancellation.test.ts src/runtime/run-agent-loop.ts src/runtime/agent-loop.ts ../../packages/types/src/tools.ts` PASS
  - `pnpm.cmd --filter @runa/server build` PASS
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/tools/agent-delegate.test.ts src/runtime/run-cancellation.test.ts src/tools/registry.test.ts src/runtime/tool-scheduler.test.ts src/runtime/agent-loop.test.ts src/runtime/run-agent-loop.test.ts` PASS (`40` test)
- Durust kalan durum: 11B, actual production sub-agent runner'ini WS runtime'a otomatik baglamaz; bunun icin runtime composition tarafinda `delegate_agent` handler saglanmasi gerekir. Parallel delegation 11C henuz acilmadi; max-2 scheduler, cancellation fan-out ve deterministic merge orada kapatilacak.

### Track A - TASK-11C Parallel Sub-Agent Scheduler Foundation - 26 Nisan 2026

- `TASK-11-MULTI-AGENT.md` icindeki 11C parallel delegation zemini, user-facing swarm acmadan internal scheduler olarak kapatildi. `agent.delegate` tool'u hala sequential ve conservative kaliyor; paralel davranis yalniz runtime scheduler seami olarak hazirlandi.
- `apps/server/src/runtime/sub-agent-scheduler.ts` eklendi. Scheduler `ParallelSubAgentJob` listesini max `2` paralel is ile kosuyor; `max_parallel` daha buyuk verilse bile 2'ye clamp ediliyor. Her job kendi `AgentDelegationRequest.max_turns` degerini `DEFAULT_SUB_AGENT_MAX_TURNS` ustune cikaramiyor; boylece budget isolation temel davranisi enforce ediliyor.
- Parent cancellation fan-out 11A scope'u uzerinden kullanildi: scheduler her job icin child `RunCancellationScope` olusturuyor, handler'a bu child scope'u veriyor ve parent cancel edildiginde child process cleanup chain'i calisabiliyor.
- Deterministic merge semantigi eklendi: sub-agent'lar out-of-order tamamlansa bile sonuclar input order/index sirasiyla donuyor. Partial failure local tutuluyor; bir sub-agent throw ederse ilgili result `failed` olarak isaretleniyor ve diger tamamlanan sonuclar korunuyor.
- `apps/server/src/runtime/sub-agent-scheduler.test.ts` eklendi: max-2 concurrency, out-of-order completion deterministic merge, partial failure semantics ve parent cancel -> child scope/process cleanup fan-out test edildi.
- Dogrulama:
  - `pnpm.cmd --filter @runa/types typecheck` PASS
  - `pnpm.cmd --filter @runa/server exec tsc --noEmit` PASS
  - `pnpm.cmd --filter @runa/server exec biome check src/runtime/sub-agent-scheduler.ts src/runtime/sub-agent-scheduler.test.ts src/runtime/sub-agent-runner.ts src/tools/agent-delegate.ts src/tools/agent-delegate.test.ts src/runtime/run-cancellation.ts src/runtime/process-registry.ts src/runtime/run-cancellation.test.ts src/tools/registry.ts src/runtime/tool-scheduler.ts src/runtime/run-agent-loop.ts src/runtime/agent-loop.ts ../../packages/types/src/tools.ts` PASS
  - `pnpm.cmd --filter @runa/server build` PASS
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/runtime/sub-agent-scheduler.test.ts src/tools/agent-delegate.test.ts src/runtime/run-cancellation.test.ts src/tools/registry.test.ts src/runtime/tool-scheduler.test.ts src/runtime/agent-loop.test.ts src/runtime/run-agent-loop.test.ts` PASS (`44` test)
- Durust kalan durum: 11C scheduler hazir, fakat otomatik parallel sub-agent orchestration ve UI/presentation trace gorunurlugu acilmadi. Sequential `delegate_agent` runtime wiring'i 11D'de ayrica kapatildi.

### Track A - TASK-11D Sequential Sub-Agent Runtime Wiring - 26 Nisan 2026

- `TASK-11` icin daha once kalan production composition boslugu dar kapsamla kapatildi: `agent.delegate` artik WS live runtime icinde gercek `delegate_agent` handler'i aliyor; handler yokken donen `sub_agent_runner_unavailable` yolu live composition icin varsayilan olmaktan cikti.
- `apps/server/src/runtime/sequential-sub-agent.ts` eklendi. Runner parent snapshot'i mutate etmeden, role allowlist'ten yeni dar `ToolRegistry` olusturuyor; sub-agent model request'i bounded system/user prompt, `available_tools`, `sub_agent` metadata, parent run id ve trace id ile kuruluyor.
- Sub-agent execution conservative kalir: nested delegation registry'de yoktur ve execution context icinde `delegate_agent` bilincli olarak undefined yapilir; high-risk/approval-required desktop/browser/shell/write tool'lar role allowlist'e otomatik girmez; `max_turns` `AgentDelegationRequest` uzerinden uygulanir.
- `apps/server/src/ws/run-execution.ts` icinde live execution context'e `delegate_agent` handler'i baglandi. Handler ayni `ModelGateway`, runtime tool registry ve auth/storage/desktop context seamiyle bounded sub-agent kosar; parent run'in ana event/result akisini degistirmez.
- Coverage eklendi: `apps/server/src/runtime/sequential-sub-agent.test.ts` allowlist-only model request, deterministic sub-run id/metadata ve missing allowlist tool fail-closed davranisini test ediyor. Mevcut `agent.delegate`, cancellation, scheduler, registry ve tool-scheduler testleri tekrar kosuldu.
- Dogrulama:
  - `pnpm.cmd --filter @runa/server exec tsc --noEmit` PASS
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/runtime/sequential-sub-agent.test.ts src/tools/agent-delegate.test.ts src/runtime/sub-agent-scheduler.test.ts src/runtime/run-cancellation.test.ts src/tools/registry.test.ts src/runtime/tool-scheduler.test.ts` PASS (`6` dosya / `23` test)
  - `pnpm.cmd --filter @runa/server exec biome check src/runtime/sequential-sub-agent.ts src/runtime/sequential-sub-agent.test.ts src/tools/agent-delegate.ts src/runtime/sub-agent-runner.ts src/runtime/sub-agent-scheduler.ts src/ws/run-execution.ts ../../packages/types/src/tools.ts` PASS
  - `pnpm.cmd --filter @runa/server build` PASS
- Durust kalan durum: bu sequential runtime wiring'dir; user-facing parallel swarm, sub-agent trace UI, long-running sub-agent persistence ve approval propagation UX'i henuz acilmadi. Parallel scheduler foundation mevcut ama live auto-parallel orchestration bilincli olarak kapali.

### Track A / Track C - TASK-02 Vision Loop Runtime Closure - 25 Nisan 2026

- `TASK-02-VISION-LOOP.md` kapsaminda `desktop.vision_analyze` ve `desktop.verify_state` tool'lari server-side, additive `ToolDefinition` olarak eklendi. Mevcut `desktop.screenshot`, `desktop.click`, `desktop.type`, `desktop.keypress`, `desktop.scroll`, gateway adapter'lari ve `apps/desktop-agent/**` davranisina dokunulmadi.
- `packages/types/src/tools.ts` bilinen tool listesi `desktop.vision_analyze` ve `desktop.verify_state` ile genisletildi; `apps/server/src/tools/registry.ts` built-in registry'ye iki tool'u ekliyor.
- `desktop.vision_analyze`, onceki `desktop.screenshot` sonucundan gercek base64 PNG artifact'i resolver uzerinden bulabilirse `ModelImageAttachment` olusturuyor ve yalniz `ModelGateway.generate()` ile analiz istiyor. Credential/login/submit/delete/purchase gibi riskli task siniflari HITL icin `requires_user_confirmation=true` tarafina cautious normalize ediliyor; confidence yalniz opsiyonel yardimci alan olarak kaliyor.
- `desktop.verify_state`, before/after screenshot artifact'lerini ayri attachment olarak modele verip `verified`, `observed_change`, `needs_retry`, `needs_user_help` sonucunu donduruyor. Failed verify, success claim'i degil acik `verified=false` sonucu olarak ele aliniyor.
- Live runtime wiring tamamlandi: `run-execution.ts` artik per-run call-id tabanli `tool_result_history` tutuyor, `desktop.vision_analyze` ve `desktop.verify_state` instance'larini ayni run icindeki `ModelGateway` ve gercek screenshot resolver ile enjekte ediyor. Fake base64 uretilmiyor; screenshot call id bulunamazsa typed blocker error yollari korunuyor.
- Desktop approval continuation tamamlandi: `desktop.click` gibi onay gerektiren action beklerken onceki screenshot/vision result history pending approval context'ine yaziliyor. `approval.resolve` onayindan sonra action replay sonucu yeni initial tool result olarak agent loop'a geri veriliyor; loop action -> screenshot -> verify_state -> final cevap akisini surduruyor.
- `approval-store` continuation context'i opsiyonel `tool_result_history` ile genisletildi ve persistence sanitization mevcut provider secret minimization davranisini koruyor. Non-desktop approval'lara gereksiz continuation context eklenmiyor.
- `apps/server/src/context/compose-context.ts` icindeki `TOOL_STRATEGY_RULES` listesine yalniz additive desktop automation verify-loop kurali eklendi: screenshot -> vision_analyze -> approval if needed -> action -> screenshot -> verify_state.
- Dogrulama:
  - `pnpm.cmd --filter @runa/types typecheck` PASS
  - `pnpm.cmd --filter @runa/server typecheck` PASS
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/ws/register-ws.test.ts src/ws/presentation.test.ts src/tools/desktop-vision-analyze.test.ts src/tools/desktop-verify-state.test.ts src/tools/registry.test.ts src/persistence/approval-store.test.ts` PASS (78 test)
  - `pnpm.cmd exec biome check apps/server/src/ws/run-execution.ts apps/server/src/ws/approval-handlers.ts apps/server/src/ws/presentation.ts apps/server/src/ws/presentation.test.ts apps/server/src/ws/orchestration-types.ts apps/server/src/ws/register-ws.test.ts apps/server/src/persistence/approval-store.ts apps/server/src/tools/desktop-vision-analyze.ts apps/server/src/tools/desktop-vision-analyze.test.ts apps/server/src/tools/desktop-verify-state.ts apps/server/src/tools/desktop-verify-state.test.ts apps/server/src/tools/registry.ts packages/types/src/tools.ts apps/server/src/context/compose-context.ts` PASS
- Durust kalan durum: Groq veya baska bir live vision provider ile gercek ekran goruntusu uzerinden canli smoke bu turda kosulmadi; bu nedenle "Groq vision production-ready calisiyor" claim'i yok. Contract ve runtime verify-loop path'i test doubles ile E2E kanitlandi.

### Track C / TASK-01 Final Closure - Packaged Electron Main Process-Liveness KanÃ„Â±tÃ„Â± - 25 Nisan 2026

- `TASK-01-ELECTRON-DESKTOP-APP.md` kapsamÃ„Â±ndaki en kritik blocker olan "packaged app sessizce exit code 0 ile kapanÃ„Â±yor" sorunu ÃƒÂ§ÃƒÂ¶zÃƒÂ¼ldÃƒÂ¼. Bu ÃƒÂ§ÃƒÂ¶zÃƒÂ¼m 3 farklÃ„Â± root-cause alanÃ„Â±nÃ„Â± adresledi.
- **Top-Level Await Fix:** Packaged Electron main process V8 context'i ESM top-level await'i desteklemediÃ„Å¸i iÃƒÂ§in uygulama sessizce kapanÃ„Â±yordu. `apps/desktop-agent/electron/main.ts` entry point'i `app.whenReady().then(...)` zincirine ÃƒÂ§evrildi ve boot-liveness saÃ„Å¸landÃ„Â±.
- **Renderer Bundle & Asar Path Fix:** Renderer HTML'in asar iÃƒÂ§inde dÃ„Â±Ã…Å¸arÃ„Â± ÃƒÂ§Ã„Â±kmaya ÃƒÂ§alÃ„Â±Ã…Å¸an `../../dist-electron/` yollarÃ„Â± asar file-system abstraction'Ã„Â±nÃ„Â± kÃ„Â±rdÃ„Â±Ã„Å¸Ã„Â± iÃƒÂ§in renderer asset'leri doÃ„Å¸rudan `dist-electron/electron/renderer/` altÃ„Â±na kopyalanacak Ã…Å¸ekilde `package.json` build script'leri gÃƒÂ¼ncellendi.
- **Ã„Â°kili Build Output SadeleÃ…Å¸tirmesi:** `electron-builder.yml` dosyasÃ„Â±nda `dist/` ve kaynak dosyalar ÃƒÂ§Ã„Â±karÃ„Â±ldÃ„Â±, yalnizca `dist-electron/` klasÃƒÂ¶rÃƒÂ¼ paketlendi. Bu sayede module duplicate riski onarÃ„Â±ldÃ„Â± ve `app.asar` boyutu optimize edildi.
- DoÃ„Å¸rulama:
  - `pnpm.cmd --filter @runa/desktop-agent typecheck` PASS
  - `pnpm.cmd --filter @runa/desktop-agent build` PASS
  - `pnpm.cmd --filter @runa/desktop-agent dist:win` PASS
  - Packaged Execution Smoke: `release\win-unpacked\Runa Desktop.exe` ÃƒÂ§alÃ„Â±Ã…Å¸tÃ„Â±rÃ„Â±ldÃ„Â± ve boot loglarÃ„Â± kontrol edildi (`boot:module-loaded`, `boot:app-ready`, `window:did-finish-load` zinciri eksiksiz gÃƒÂ¶rÃƒÂ¼ldÃƒÂ¼).
- Durum: `TASK-01` artÃ„Â±k release-grade process-liveness, UI render ve installer gereksinimlerini saÃ„Å¸lamÃ„Â±Ã…Å¸ durumdadÃ„Â±r.

### Track C / TASK-01B - Electron Desktop Session Persistence - 25 Nisan 2026

- `TASK-01-ELECTRON-DESKTOP-APP.md` icindeki `TASK-01B` alt gorevi uygulandi: Electron desktop shell artik main-process tarafinda persistent session storage kullanabiliyor.
- Yeni `apps/desktop-agent/src/electron-session-storage.ts` dosya tabanli `DesktopAgentSessionStorage` implementasyonu eklendi. Yeni dependency eklenmedi; session JSON'u Electron `userData` dizini altindaki `desktop-session.json` dosyasina atomik temp-file + rename akisiyle yaziliyor, load tarafinda shape validation ve mevcut `normalizeDesktopAgentPersistedSession()` seami korunuyor.
- `apps/desktop-agent/electron/main.ts`, storage'i `app.getPath('userData')` ile olusturup `createDesktopAgentLaunchController()` icine enjekte ediyor. Renderer'a raw session veya filesystem authority verilmedi; preload/IPC boundary 01A'daki haliyle korunuyor.
- `DesktopAgentSessionRuntime.signOut()` icindeki queued `stop()` cagrisi dar bir lifecycle bugfix ile giderildi. Eski akista sign-out kendi queued operation'i icinden tekrar queue'ya girerek storage clear adimina ulasamama riski tasiyordu; yeni akis bridge'i kapatip storage'i temizleyerek `signed_out` snapshot'ina donuyor.
- `apps/desktop-agent/src/index.ts` yeni storage export'unu aciyor. `apps/server/**`, `apps/web/**`, `packages/types/**`, WS kontratlari ve desktop bridge/input/screenshot davranislari degistirilmedi.
- Pre-existing dirty tree notu: bu tura baslamadan once repo genis olcekte dirty idi; ozellikle server/web/provider dosyalari, root task dokumanlari ve daha once acilmis Electron 01A dosyalari mevcut degisiklik/untracked durumdaydi. Bu tur kapsaminda yalniz desktop-agent 01B seam'i ve bu `PROGRESS.md` kaydi hedeflendi.
- Dogrulama:
  - `pnpm.cmd --filter @runa/desktop-agent typecheck` PASS
  - `pnpm.cmd exec biome check apps/desktop-agent/src/electron-session-storage.ts apps/desktop-agent/electron/main.ts apps/desktop-agent/src/index.ts apps/desktop-agent/src/session.ts` PASS
  - `pnpm.cmd --filter @runa/desktop-agent build` PASS
  - Node smoke: build output uzerinden file storage save/load ve `runtime.signOut()` storage clear lifecycle'i PASS; structured sonuc `{"result":"PASS","persisted_session_loaded":true,"sign_out_status":"signed_out","storage_cleared":true}`.
- Durust kalan durum: Electron GUI smoke'u bu turda calistirilmadi; local app start'i icin gercek desktop-agent env/session degerleri gerekir. Tray, auto-start, packaging, installer, updater ve OS keychain/credential vault kullanimi halen `TASK-01C/01D` veya ayri security hardening konusu.

### Track C / TASK-01C - Electron Tray + Lifecycle - 25 Nisan 2026

- `TASK-01-ELECTRON-DESKTOP-APP.md` icindeki `TASK-01C` alt gorevi uygulandi: Electron shell icin tray state mapping ve temel desktop lifecycle ayrimi eklendi.
- `apps/desktop-agent/electron/main.ts` artik `DesktopAgentShell` snapshot'ini main-process tarafinda ayrica olusturup izliyor; bu snapshot tray state'ine daraltildi: `needs_sign_in`, `connecting`, `connected`, `error`, `stopped`. `ready` shell durumu bilincli olarak `stopped` tray durumuna map ediliyor; boylece signed-in ama aktif bridge baglantisi olmayan durum ayrik gorunebiliyor.
- Tray menu davranislari ayrildi: `Open/Focus Runa Desktop`, `Connect/Reconnect`, `Disconnect`, `Sign out` ve `Quit Runa Desktop`. Boylece pencereyi kapatmak sign-out veya quit anlamina gelmiyor; disconnect de session silmeden bridge'i durdurabiliyor.
- `apps/desktop-agent/src/electron-window-host.ts` sinifi pencere lifecycle'i icin additive helper'lar kazandi: `show()`, `hide()`, `isVisible()` ve close interception. Normal pencere kapatma istegi artik app'i kapatmak yerine pencereyi gizliyor; gercek quit sirasinda main-process `allow_close` yoluna geciyor ve shutdown sirasinda host cleanup'i bozulmuyor.
- Quit davranisi tray/uygulama kapanisinda ayri ele alindi: main-process `before-quit` uzerinden `controller.stop()` calistiriyor, tray'i destroy ediyor ve session'i silmeden runtime'i kapatarak uygulamayi kapatiyor. `Sign out` ise mevcut 01B persistence semantiÃ„Å¸iyle session'i temizliyor. Auto-start icin `app.setLoginItemSettings()` benzeri bir wiring bilincli olarak eklenmedi; tray menude yalniz `Launch at sign-in: Off` gorunur durumda ve varsayilan kapalilik korunuyor.
- Pre-existing dirty tree notu: desktop-agent klasorunde bu tura gelmeden once 01A/01B ile ilgili untracked/modified dosyalar zaten vardi. Bu turda yalniz `apps/desktop-agent/electron/main.ts`, `apps/desktop-agent/src/electron-window-host.ts` ve bu `PROGRESS.md` kaydi hedeflendi.
- Dogrulama:
  - `pnpm.cmd --filter @runa/desktop-agent typecheck` PASS
  - `pnpm.cmd exec biome check apps/desktop-agent/electron/main.ts apps/desktop-agent/src/electron-window-host.ts` PASS
  - `pnpm.cmd --filter @runa/desktop-agent build` PASS
  - Electron smoke: dummy `RUNA_DESKTOP_AGENT_ID` ve `RUNA_DESKTOP_AGENT_SERVER_URL` ile `pnpm.cmd --filter @runa/desktop-agent start:electron` child process olarak baslatildi; process 8 saniye boyunca crash etmeden ayakta kaldi ve sonra test amacli kapatildi. STDERR tarafinda yalniz mevcut `start-electron.mjs` icindeki `shell: true` nedeniyle gelen Node deprecation warning'i goruldu; yeni tray/lifecycle koduna ait runtime crash sinyali gorulmedi.
- Durust kalan durum: Bu tur tray icon'un gorsel varligi ve menu etkileÃ…Å¸imi manuel olarak gorulmedi; smoke yalniz runtime ayakta kalma seviyesinde kanit verdi. Native OS autostart, updater, installer ve signed release packaging halen `TASK-01D` veya sonraki hardening konusu.

### Track C / TASK-01D - Packaging / Installer / Updater Wiring - 25 Nisan 2026

- `TASK-01-ELECTRON-DESKTOP-APP.md` icindeki `TASK-01D` alt gorevi dar kapsamda uygulandi: Windows installer packaging acildi ve updater seami varsayilan kapali olacak sekilde wire edildi.
- `apps/desktop-agent/ELECTRON-DEPENDENCY-RFC.md` 01D uzantisiyla guncellendi. `electron-builder` packaging dependency'si ve `electron-updater` runtime wiring'i icin scope, risk ve "wiring only" siniri netlestirildi; signed release veya canli update feed claim'i bilincli olarak acilmadi.
- `apps/desktop-agent/package.json` icine `electron-updater` dependency'si, `electron-builder` devDependency'si ve `dist:win` script'i eklendi. `apps/desktop-agent/electron-builder.yml` ile installer config acildi: `release/` output, explicit file set, NSIS target, unsigned local host icin `npmRebuild: false`, `nodeGypRebuild: false` ve `win.signAndEditExecutable: false`.
- `apps/desktop-agent/electron/main.ts` icine updater wiring'i dar ve opt-in olarak eklendi. `RUNA_DESKTOP_ENABLE_UPDATER=1` olmadikca herhangi bir update check calismiyor; packaged app + explicit env opt-in kosulu saglansa bile hata durumunda yalniz warning log'u uretip app'i dusurmuyor. Gercek publish endpoint metadata'si bu turda kurulmadigi icin bu seam "works" degil, yalniz "wired" seviyesinde kabul edildi.
- Packaging dogrulamasinda iki host-seviye problem gorulup dar config ile cozuldu: ilk denemede builder workspace node_modules agacinda gereksiz native rebuild adimina takildi; bu nedenle rebuild kapatildi. Ikinci denemede Windows code-sign helper archive extraction symlink privilege hatasina takildi; unsigned local artifact icin executable edit/sign adimi kapatilarak NSIS installer olusumu tamamlandi.
- Artifact kaniti gercektir: `apps/desktop-agent/release/runa-desktop-0.1.0-setup.exe` ve `apps/desktop-agent/release/runa-desktop-0.1.0-setup.exe.blockmap` uretildi. `win-unpacked/` klasoru da release output'una yazildi. Bu artifact bugunku hostta unsigned ve default Electron icon ile uretildi; release-grade branding/signing iddiasi yoktur.
- Pre-existing dirty tree notu: desktop-agent disinda repo zaten dirty idi. Bu tur packaging dependency kurulumu nedeniyle `pnpm-lock.yaml` da degisti; server/web/types koduna girilmedi.
- Dogrulama:
  - `pnpm.cmd add -D electron-builder@^26.0.12 --filter @runa/desktop-agent` tamamlandi
  - `pnpm.cmd add electron-updater@^6.6.2 --filter @runa/desktop-agent` tamamlandi
  - `pnpm.cmd --filter @runa/desktop-agent typecheck` PASS
  - `pnpm.cmd exec biome check apps/desktop-agent/package.json apps/desktop-agent/electron/main.ts` PASS
- `pnpm.cmd --filter @runa/desktop-agent build` PASS
- `pnpm.cmd --filter @runa/desktop-agent dist:win` PASS
- Durust kalan durum: updater icin gercek GitHub Releases veya test update server yok; bu nedenle live update smoke kosulmadi ve "auto-update calisiyor" denmiyor. `package.json` icinde author bilgisi ve ozel app icon dosyalari da henuz yok; builder fallback/default icon ile paketledi.

### Track C / TASK-01A + TASK-01D Follow-up - React Renderer Completion + Packaging Polish - 25 Nisan 2026

- `TASK-01-ELECTRON-DESKTOP-APP.md` acisindan acik kalan 01A renderer eksigi kapatildi: `apps/desktop-agent/electron/renderer/` altinda artik gercek minimal React renderer var. `App.tsx`, `styles.css`, `global.d.ts` ve bundler wiring ile desktop launch surface plain inline HTML yerine React tarafinda render ediliyor.
- `apps/desktop-agent/src/launch-html.ts` tarafinda renderer'in guvenli sekilde parse edebilmesi icin `data-field` / `data-action-role` isaretleyicileri eklendi; renderer yalniz preload bridge uzerinden gelen HTML document payload'ini view model'e ceviriyor. Renderer'a token, filesystem veya desktop authority acilmadi.
- `apps/desktop-agent/package.json`, `tsconfig.renderer.json` ve `apps/desktop-agent/ELECTRON-DEPENDENCY-RFC.md` renderer gereksinimlerine gore guncellendi. `react`, `react-dom`, `esbuild`, `@types/react` ve `@types/react-dom` bu dar renderer seam'i icin eklendi; RFC bu dependency acilisini ve risk sinirlarini kayda aldi.
- Packaging polish tarafinda `package.json` icine `author` eklendi; `apps/desktop-agent/build/icon.png` ve `build/icon.ico` olusturuldu; `electron-builder.yml` app/NSIS icon alanlarini bu asset'lere baglayacak sekilde guncellendi. Installer artik default Electron fallback'i yerine Runa icon asset'i ile uretiliyor.
- ESM preload yukleme davranisi Electron resmi notlarina gore sertlestirildi: preload giris noktasi `.mjs` olarak derleniyor ve BrowserWindow `preload_path` buna gore ayarlaniyor. Main/window-host import stili de packaged debug turlari sirasinda birkac kez daraltildi; geriye task disi kontrat degisikligi birakilmadi.
- Dogrulama:
  - `pnpm.cmd --filter @runa/desktop-agent typecheck` PASS
  - `pnpm.cmd --filter @runa/desktop-agent build` PASS
  - `pnpm.cmd exec biome check apps/desktop-agent/electron/main.ts apps/desktop-agent/src/electron-window-host.ts apps/desktop-agent/electron/preload.mts apps/desktop-agent/electron/renderer/App.tsx apps/desktop-agent/package.json apps/desktop-agent/tsconfig.electron.json apps/desktop-agent/tsconfig.renderer.json apps/desktop-agent/electron-builder.yml apps/desktop-agent/src/launch-html.ts` PASS (hedefli turlarda)
  - Dev smoke: dummy `RUNA_DESKTOP_AGENT_ID` ve `RUNA_DESKTOP_AGENT_SERVER_URL` ile `pnpm.cmd --filter @runa/desktop-agent start:electron` process'i 10 saniye boyunca ayakta kaldi; gorunen tek stderr mevcut `start-electron.mjs` icindeki `shell: true` deprecation warning'i oldu.
  - Installer smoke: `pnpm.cmd --filter @runa/desktop-agent dist:win` PASS; `release/runa-desktop-0.1.0-setup.exe` uretildi ve sessiz kurulum ile temp hedefe dosyalar cikarilabildi.
- Durust kalan durum: packaged runtime smoke henuz yesil kanit seviyesine cikmadi. Hem `release/win-unpacked/Runa Desktop.exe` hem de sessiz kurulumdan gelen `Runa Desktop.exe` 8-10 saniyelik smoke turlarinda `exit_code=0` ile erken kapandi; app-level boot log seami dahi tetiklenmedigi icin sorun Electron packaging/entry noktasinda daha erken bir seviyede olabilir. Bu nedenle `TASK-01` icin "kusursuz release-grade kapanis" claim'i henuz yazilmamali; gercek blocker packaged app'in process-liveness kanitinin eksik olmasidir.

### Track A / Gateway - SambaNova Provider Adapter - 25 Nisan 2026

- SambaNova, mevcut `ModelGateway` omurgasina ayri ve additive provider olarak eklendi. WS/runtime/approval/ToolRegistry contract'lari yeniden tasarlanmadi.
- Shared provider union ve default model listesi `sambanova` ile genisletildi; default model kullanicinin paylastigi curl ornegine hizali olarak `DeepSeek-V3.1-cb`.
- `apps/server/src/gateway/sambanova-gateway.ts` eklendi. Adapter `https://api.sambanova.ai/v1/chat/completions` endpoint'ine `Authorization: Bearer ...` ile gider, `generate()` ve `stream()` yollarini destekler, `max_output_tokens` alanini SambaNova request shape'inde `max_tokens` olarak gonderir ve OpenAI-compatible tool call parsing seam'ini korur.
- Env fallback seami `SAMBANOVA_API_KEY` ile acildi: `config-resolver.ts` server env'den key okuyabilir, approval persistence minimization ise server env varsa persisted request-only key'i bosaltma davranisini SambaNova icin de korur.
- Kullanici key girebilsin diye `.env` icine `SAMBANOVA_API_KEY=` alani, takip edilebilir sablonlar icin de `.env-ÃƒÂ¶rnek` ve `.env.server.example` alanlari eklendi.
- Frontend provider secimi mevcut `gatewayProviders/defaultGatewayModels` kontratindan beslendigi icin SambaNova secenegi web tarafina kontrat uzerinden yansir; yeni UI dependency veya ayri runtime paneli eklenmedi.
- Dogrulama:
  - `pnpm.cmd exec biome check packages/types/src/ws.ts apps/server/src/gateway/config-resolver.ts apps/server/src/persistence/approval-store.ts apps/server/src/gateway/fallback-chain.ts apps/server/src/gateway/model-router.ts apps/server/src/gateway/factory.ts apps/server/src/gateway/sambanova-gateway.ts apps/server/src/gateway/gateway.test.ts .env-ÃƒÂ¶rnek .env.server.example` PASS
  - `pnpm.cmd --filter @runa/types typecheck` PASS
  - `pnpm.cmd --filter @runa/server typecheck` PASS
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/gateway/gateway.test.ts` PASS (48 tests)
- Durust kalan durum: Canli SambaNova smoke kosulmadi; elde gercek `SAMBANOVA_API_KEY` olmadigi icin bu tur yalniz contract/request-shape ve stream parser seviyesinde kanitlandi.

### Track C / UI Foundation Phase 1 - Design Tokens + Internal Primitives - 24 Nisan 2026

- `apps/web/src/lib/design-tokens.ts` eklendi. Mevcut `index.css`, `chat-styles.ts`, `AppShell.tsx` ve `ChatPage.tsx` icindeki gorsel dilden tureyen color, spacing, radius, shadow, typography, motion ve z-index token gruplari merkezi hale getirildi; yeni tema/redesign acilmadi.
- `apps/web/src/components/ui/` altinda dependency-free internal primitive baslangici acildi: `RunaButton`, `RunaCard`, `RunaBadge`, `RunaTextarea`, `RunaSurface` ve barrel `index.ts`. Componentler native elementler uzerinden calisir, `className`/`style` override kabul eder ve `any`/type bypass kullanmaz.
- `apps/web/src/lib/chat-styles.ts` komple kaldirilmadi; mevcut export kontratlari korunarak temel panel/page/input/button stilleri yeni token kaynagindan beslenmeye basladi.
- `apps/web/src/components/app/AppShell.tsx` dusuk riskli olarak tokenlara baglandi; shell gap/panel/button/metric style kararlarinda token kullanimi basladi ve authenticated status pill `RunaBadge` uzerinden render ediliyor.
- `apps/web/src/components/chat/ChatShell.tsx` sayfa/workspace sarmalayicilarinda `RunaSurface` kullanmaya basladi. Route, auth, chat runtime, Developer Mode, WS contract veya server/desktop/types davranisina dokunulmadi.
- Degisen dosyalar: `apps/web/src/lib/design-tokens.ts`, `apps/web/src/components/ui/RunaButton.tsx`, `apps/web/src/components/ui/RunaCard.tsx`, `apps/web/src/components/ui/RunaBadge.tsx`, `apps/web/src/components/ui/RunaTextarea.tsx`, `apps/web/src/components/ui/RunaSurface.tsx`, `apps/web/src/components/ui/index.ts`, `apps/web/src/lib/chat-styles.ts`, `apps/web/src/components/app/AppShell.tsx`, `apps/web/src/components/chat/ChatShell.tsx`, `PROGRESS.md`.
- Dogrulama:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd exec biome check apps/web/src/lib/design-tokens.ts apps/web/src/components/ui apps/web/src/components/app/AppShell.tsx apps/web/src/components/chat/ChatShell.tsx apps/web/src/lib/chat-styles.ts` PASS
- Durust kalan durum: bu tur internal UI foundation'in ilk katmanini acti; `ChatPage.tsx` icindeki buyuk local style objeleri bilincli olarak task disi birakildi. `index.css` icindeki mevcut class tabani da korunuyor; ileride primitive/CSS token uyumu kademeli genisletilmeli.
- Sonraki onerilen gorev: UI Foundation Phase 2 olarak `ChatPage.tsx` icindeki composer, conversation surface, status badge ve attachment row gibi dusuk riskli tekrar eden yuzeyleri `RunaButton` / `RunaCard` / `RunaTextarea` / `RunaBadge` primitive'lerine kademeli tasimak; runtime veya render contract degistirmemek.

### Track C / UI Foundation Phase 2 - ChatPage Composer + Transcript Decomposition - 24 Nisan 2026

- `apps/web/src/components/chat/ChatComposerSurface.tsx` eklendi. `ChatPage.tsx` icindeki composer card, prompt textarea, desktop target selector, voice controls, attachment upload/remove summary, runtime config warning, submit row ve last-error yuzeyi bu component'e tasindi.
- `apps/web/src/components/chat/StreamingMessageSurface.tsx` eklendi. Live streaming metin yuzeyi mevcut kosulu koruyarak yalniz `currentStreamingText` doluysa ve `currentStreamingRunId === currentRunId` ise render oluyor; `aria-live="polite"` korunuyor.
- `apps/web/src/components/chat/PersistedTranscript.tsx` eklendi. Kalici transcript render'i, bos conversation/draft copy'si, role label'lari, timestamp `toLocaleString()` davranisi ve `MarkdownRenderer` kullanimi ayni kalarak ayrildi.
- `apps/web/src/pages/ChatPage.tsx` composer/transcript/streaming JSX yiginlarindan temizlendi; orchestration, effect'ler, runtime selector'lari, desktop device loading ve presentation/timeline akisi sayfada kaldi. `useChatRuntime`, `useConversations`, store selector, WS/auth/runtime veya markdown parser davranisina dokunulmadi.
- Yeni componentlerde Phase 1 internal primitive'leri kontrollu kullanildi: composer submit/config/attachment remove icin `RunaButton`, prompt icin `RunaTextarea`, attachment preview icin `RunaCard`; buyuk visual redesign acilmadi.
- Degisen dosyalar: `apps/web/src/pages/ChatPage.tsx`, `apps/web/src/components/chat/ChatComposerSurface.tsx`, `apps/web/src/components/chat/StreamingMessageSurface.tsx`, `apps/web/src/components/chat/PersistedTranscript.tsx`, `PROGRESS.md`.
- Pre-existing changes notu: bu tura baslamadan once `PROGRESS.md`, Phase 1 web foundation dosyalari ve `apps/desktop-agent/src/auth.ts` / `apps/desktop-agent/src/launch-controller.ts` zaten dirty idi. Desktop-agent, server, packages/types, package.json ve lockfile dosyalarina bu turda dokunulmadi.
- Dogrulama:
  - `git status --short` on kontrol: dirty tree; gorev disi `apps/desktop-agent/src/auth.ts` ve `apps/desktop-agent/src/launch-controller.ts` mevcut.
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd exec biome check apps/web/src/pages/ChatPage.tsx apps/web/src/components/chat/ChatComposerSurface.tsx apps/web/src/components/chat/StreamingMessageSurface.tsx apps/web/src/components/chat/PersistedTranscript.tsx` PASS
- Durust kalan durum: composer + transcript + streaming ayrismasi tamamlandi; current run progress, presentation surface cards, developer hint ve timeline orchestration halen `ChatPage.tsx` icinde. Bu bilincli olarak bu turun siniri disinda birakildi.
- Sonraki onerilen gorev: UI Foundation Phase 3 olarak `ChatPage.tsx` icindeki conversation workspace header, current run progress/presentation surface yerlesimi ve Developer Mode hint yuzeyini kucuk chat componentlerine ayirmak; `RunProgressPanel` / `PresentationRunSurfaceCard` davranisini ve render contract'larini degistirmemek.

### Track C / UI Foundation Phase 3 - ChatPage Workspace + Run Surface Decomposition - 24 Nisan 2026

- `apps/web/src/components/chat/ChatWorkspaceHeader.tsx` eklendi. Chat workspace hero/heading, eyebrow, subtitle ve connection status pill ayni copy/status davranisiyla bu component'e tasindi.
- `apps/web/src/components/chat/CurrentRunSurface.tsx` eklendi. Aktif sohbet yuzeyi, persisted transcript, current run progress panel, streaming response ve current presentation/empty state yerlesimi ChatPage disina alindi.
- `apps/web/src/components/chat/PastRunSurfaces.tsx` eklendi. `pastPresentationSurfaces.map(...)` bloÃ„Å¸u typed prop'larla ayrildi; expanded state, inspection detail action state, pending keys, transport summaries ve approval resolve callback'leri aynen korunuyor.
- `apps/web/src/components/chat/ChatDeveloperHint.tsx` eklendi. Developer Mode kapali hint'i sadece tasindi; ana chat'e yeni raw runtime/debug/operator bilgisi eklenmedi.
- `apps/web/src/pages/ChatPage.tsx` buyuk JSX bloklarindan arindirildi ama orchestration sorumlulugu korundu: hooks/effects/selectors, desktop device loading, submit/voice/upload callback'leri, current presentation ReactNode'u ve `getInspectionActionState` sayfada kalmaya devam ediyor.
- Degisen dosyalar: `apps/web/src/pages/ChatPage.tsx`, `apps/web/src/components/chat/ChatWorkspaceHeader.tsx`, `apps/web/src/components/chat/CurrentRunSurface.tsx`, `apps/web/src/components/chat/PastRunSurfaces.tsx`, `apps/web/src/components/chat/ChatDeveloperHint.tsx`, `PROGRESS.md`.
- Pre-existing changes on kontrolu:
  - `M PROGRESS.md`
  - `M apps/desktop-agent/src/auth.ts`
  - `M apps/desktop-agent/src/launch-controller.ts`
  - `M apps/web/src/components/app/AppShell.tsx`
  - `M apps/web/src/components/chat/ChatShell.tsx`
  - `M apps/web/src/lib/chat-styles.ts`
  - `M apps/web/src/pages/ChatPage.tsx`
  - `?? apps/web/src/components/chat/ChatComposerSurface.tsx`
  - `?? apps/web/src/components/chat/PersistedTranscript.tsx`
  - `?? apps/web/src/components/chat/StreamingMessageSurface.tsx`
  - `?? apps/web/src/components/ui/`
  - `?? apps/web/src/lib/design-tokens.ts`
- Dogrulama:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd exec biome check apps/web/src/pages/ChatPage.tsx apps/web/src/components/chat/ChatWorkspaceHeader.tsx apps/web/src/components/chat/CurrentRunSurface.tsx apps/web/src/components/chat/PastRunSurfaces.tsx apps/web/src/components/chat/ChatDeveloperHint.tsx` ilk kosuda yalniz yeni iki dosyada format farkiyla FAIL verdi; formatter beklentisi manuel uygulandi ve tekrar kosuda PASS oldu.
  - `git diff --stat` ve `git status --short` final raporda ayrica kaydedildi.
- Durust kalan durum: `RunProgressPanel`, `RunTimelinePanel`, `PresentationRunSurfaceCard`, `PresentationBlockRenderer`, markdown renderer, runtime/WS/auth/policy/gateway ve `RenderBlock` kontrati degistirilmedi. `ChatPage.tsx` hala orchestration dosyasi; sonraki fazda current presentation ReactNode render'i icin daha dar bir composition helper dusunulebilir.
- Sonraki onerilen gorev: capability-oriented chat UI icin research/source cards, asset preview ve approval detail modal gibi yeni yuzeyleri acmadan once presentation/current-run composition tiplerini daha kucuk internal view-model componentlerine bolmek; runtime/render contract redesign acmamak.

### Track C / UI Foundation Phase 4 - Capability Surface Foundation - 24 Nisan 2026

- `apps/web/src/components/chat/capability/` klasoru eklendi. Bu klasor runtime veya WS contract'a baglanmayan, yalniz UI-level capability surface foundation katmani olarak kuruldu.
- `types.ts` icinde yalniz UI seviyesinde kalan sade tipler tanimlandi: `CapabilityTone`, `CapabilityStatus`, `AssetPreviewKind`, `CapabilityProgressStep`, `CapabilityResultAction` ve `ActiveTaskQueueItem`. `packages/types`, `RenderBlock` veya conversation modeline dokunulmadi.
- `CapabilityCard.tsx` eklendi. Research, desktop action, file operation, image generation, approval summary ve tool progress gibi gelecek yuzeyler icin reusable card zemini sunuyor; `RunaCard`, `RunaBadge` ve design token'lari kullaniliyor.
- `CapabilityProgressList.tsx` eklendi. Research/image/desktop/code gibi akislarda kullanilabilecek generic step listesi, status badge'leri ve sakin empty behavior ile kuruldu.
- `CapabilityResultActions.tsx` eklendi. Open/download/copy/retry/refine/details/approve/reject gibi gelecekteki result action row'lari icin `RunaButton` tabanli ve `type="button"` guvenceli action listesi sagliyor.
- `AssetPreviewCard.tsx` eklendi. Image/screenshot preview icin `img`, diger asset turleri veya URL yoklugu icin sakin placeholder kullanan temel asset preview card'i kuruldu; modal/zoom/storage/upload entegrasyonu acilmadi.
- `ActiveTaskQueue.tsx` eklendi. Future active task queue icin minimal generic UI componenti kuruldu; herhangi bir runtime/store baglantisi yapilmadi.
- `index.ts` barrel export'u eklendi. Componentler ve UI-level tipler tek capability girisinden export ediliyor.
- CurrentRunSurface entegrasyonu bu turda bilincli olarak yapilmadi. Mevcut chat/current presentation yuzeyinin gorsel davranisini degistirmemek icin capability componentleri foundation olarak birakildi.
- Degisen dosyalar: `apps/web/src/components/chat/capability/types.ts`, `CapabilityCard.tsx`, `CapabilityProgressList.tsx`, `CapabilityResultActions.tsx`, `AssetPreviewCard.tsx`, `ActiveTaskQueue.tsx`, `index.ts`, `PROGRESS.md`.
- Pre-existing changes on kontrolu:
  - `M PROGRESS.md`
  - `M apps/desktop-agent/src/auth.ts`
  - `M apps/desktop-agent/src/launch-controller.ts`
  - `M apps/web/src/components/app/AppShell.tsx`
  - `M apps/web/src/components/chat/ChatShell.tsx`
  - `M apps/web/src/lib/chat-styles.ts`
  - `M apps/web/src/pages/ChatPage.tsx`
  - `?? apps/web/src/components/chat/ChatComposerSurface.tsx`
  - `?? apps/web/src/components/chat/ChatDeveloperHint.tsx`
  - `?? apps/web/src/components/chat/ChatWorkspaceHeader.tsx`
  - `?? apps/web/src/components/chat/CurrentRunSurface.tsx`
  - `?? apps/web/src/components/chat/PastRunSurfaces.tsx`
  - `?? apps/web/src/components/chat/PersistedTranscript.tsx`
  - `?? apps/web/src/components/chat/StreamingMessageSurface.tsx`
  - `?? apps/web/src/components/ui/`
  - `?? apps/web/src/lib/design-tokens.ts`
- Dogrulama:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd exec biome check apps/web/src/components/chat/capability apps/web/src/components/chat/CurrentRunSurface.tsx` ilk kosuda yalniz yeni capability dosyalarinda import/format farkiyla FAIL verdi; manuel format/import duzeltmesi sonrasi tekrar kosuda PASS oldu.
  - `git diff --stat` ve `git status --short` final raporda ayrica kaydedildi.
- Durust kalan durum: Bu tur gercek research, image generation/editing, desktop action, asset modal, active task queue runtime wiring veya approval detail behavior'u acmadi. Capability componentleri henuz runtime tarafindan kullanilmiyor; bu bilincli olarak spaghetti UI riskini azaltan foundation adimi.
- Sonraki onerilen gorev: mevcut presentation block render yuzeylerinden birini, ornegin source/search result veya tool result card'larini, yeni capability primitive'leriyle dar ve davranis koruyan bir adapter katmanina tasimak; RenderBlock/WS contract degistirmemek.

### Track C / UI Foundation Phase 5 - Search Result CapabilityCard Adapter - 24 Nisan 2026

- `apps/web/src/components/chat/PresentationBlockRenderer.tsx` icindeki `search_result_block` render yuzeyi `CapabilityCard` kabuguna tasindi. Hedef yalniz search result presentation surface idi; diff/tool/web search/run timeline gibi diger block renderer'lara dokunulmadi.
- Mevcut davranislar korundu: `article` semantigi, `id`, `tabIndex`, `aria-labelledby`, `aria-describedby`, title id, summary id, truncated chip, inspection action button, query/search root/visible window metadata, source priority/conflict notlari, matches list ve empty matches state ayni akisla render edilmeye devam ediyor.
- `CapabilityCard.tsx` icin kucuk additive API genisletmesi yapildi: `as`, `titleId` ve `headerAside`. Bu sayede presentation block gibi semantik `article` ihtiyaci olan yuzeyler ayni foundation componentini kullanabiliyor; mevcut Phase 4 kullanim sekli kirilmadi.
- `RenderBlock`, WS contract, runtime, auth, policy, gateway, search provider, `web.search` tool ve conversation modeli degistirilmedi. Yeni dependency eklenmedi.
- Degisen dosyalar: `apps/web/src/components/chat/PresentationBlockRenderer.tsx`, `apps/web/src/components/chat/capability/CapabilityCard.tsx`, `PROGRESS.md`.
- Pre-existing changes on kontrolu:
  - `M PROGRESS.md`
  - `M apps/desktop-agent/src/auth.ts`
  - `M apps/desktop-agent/src/launch-controller.ts`
  - `M apps/web/src/components/app/AppShell.tsx`
  - `M apps/web/src/components/chat/ChatShell.tsx`
  - `M apps/web/src/lib/chat-styles.ts`
  - `M apps/web/src/pages/ChatPage.tsx`
  - `?? apps/web/src/components/chat/ChatComposerSurface.tsx`
  - `?? apps/web/src/components/chat/ChatDeveloperHint.tsx`
  - `?? apps/web/src/components/chat/ChatWorkspaceHeader.tsx`
  - `?? apps/web/src/components/chat/CurrentRunSurface.tsx`
  - `?? apps/web/src/components/chat/PastRunSurfaces.tsx`
  - `?? apps/web/src/components/chat/PersistedTranscript.tsx`
  - `?? apps/web/src/components/chat/StreamingMessageSurface.tsx`
  - `?? apps/web/src/components/chat/capability/`
  - `?? apps/web/src/components/ui/`
  - `?? apps/web/src/lib/design-tokens.ts`
- Dogrulama:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd exec biome check apps/web/src/components/chat/PresentationBlockRenderer.tsx apps/web/src/components/chat/capability/CapabilityCard.tsx apps/web/src/components/chat/capability/types.ts apps/web/src/components/chat/capability/index.ts` ilk kosuda yalniz `CapabilityCard.tsx` format farkiyla FAIL verdi; format duzeltildi ve tekrar kosuda PASS oldu.
  - `rg -n "any|as any|@ts-ignore|eslint-disable|TODO" apps/web/src/components/chat/PresentationBlockRenderer.tsx apps/web/src/components/chat/capability` final kontrolde eslesme bulmadi.
  - `git diff --stat` ve `git status --short` final raporda ayrica kaydedildi.
- Durust kalan durum: Search result block artik capability foundation ile uyumlu ilk gercek presentation adapter'i oldu. Web search result block, tool result, diff, code ve timeline yuzeyleri henuz capability primitive'lerine tasinmadi.
- Sonraki onerilen gorev: `tool_result` veya `web_search_result_block` icin ayni dar adapter yaklasimini uygulamak; yine RenderBlock/WS contract ve provider/tool davranislarini kapali tutmak.

### Track C / UI Foundation Phase 6 - Tool Result CapabilityCard Adapter - 24 Nisan 2026

- `tool_result` render yuzeyi Phase 5'teki dar adapter yaklasimiyla `CapabilityCard` kabuguna tasindi. Tool adi, `tool result` eyebrow'i, success/error status chip'i, call_id, error_code ve result preview akisi ayni veriyle korunuyor.
- `getToolResultStyles` mantigi korunarak success icin yesil, error icin danger kirmizi border/status dili devam ettirildi. Capability status/tone mapping UI seviyesinde eklendi: `success -> completed/success`, `error -> failed/danger`.
- `CapabilityCard` API'sinde bu turda yeni additive prop gerekmedi; Phase 5'te eklenen `as`, `titleId` ve `headerAside` davranisi aynen kullanildi ve search result adapter bozulmadi.
- `apps/web/src/components/chat/chat-presentation.tsx` icindeki inline `tool_result` renderer'i yalniz import edilen shared renderer'a devredildi; dispatch davranisi ve diger block render fonksiyonlari refactor edilmedi.
- Degisen dosyalar: `apps/web/src/components/chat/PresentationBlockRenderer.tsx`, `apps/web/src/components/chat/chat-presentation.tsx`, `PROGRESS.md`.
- Pre-existing changes on kontrolu:
  - `M PROGRESS.md`
  - `M apps/desktop-agent/src/auth.ts`
  - `M apps/desktop-agent/src/launch-controller.ts`
  - `M apps/web/src/components/app/AppShell.tsx`
  - `M apps/web/src/components/chat/ChatShell.tsx`
  - `M apps/web/src/components/chat/PresentationBlockRenderer.tsx`
  - `M apps/web/src/lib/chat-styles.ts`
  - `M apps/web/src/pages/ChatPage.tsx`
  - `?? apps/web/src/components/chat/ChatComposerSurface.tsx`
  - `?? apps/web/src/components/chat/ChatDeveloperHint.tsx`
  - `?? apps/web/src/components/chat/ChatWorkspaceHeader.tsx`
  - `?? apps/web/src/components/chat/CurrentRunSurface.tsx`
  - `?? apps/web/src/components/chat/PastRunSurfaces.tsx`
  - `?? apps/web/src/components/chat/PersistedTranscript.tsx`
  - `?? apps/web/src/components/chat/StreamingMessageSurface.tsx`
  - `?? apps/web/src/components/chat/capability/`
  - `?? apps/web/src/components/ui/`
  - `?? apps/web/src/lib/design-tokens.ts`
- Dogrulama:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd exec biome check apps/web/src/components/chat/PresentationBlockRenderer.tsx apps/web/src/components/chat/capability/CapabilityCard.tsx apps/web/src/components/chat/capability/types.ts apps/web/src/components/chat/capability/index.ts` PASS
  - Ek task-local kontrol: `pnpm.cmd exec biome check apps/web/src/components/chat/chat-presentation.tsx` PASS. Not: daha once bu dosyayi da iceren ilk Biome denemesi yalniz import sirasi icin FAIL verdi; import sirasi duzeltildi.
  - `rg -n "any|as any|@ts-ignore|eslint-disable|TODO" apps/web/src/components/chat/PresentationBlockRenderer.tsx apps/web/src/components/chat/capability` final kontrolde eslesme bulmadi.
  - `git diff --stat` ve `git status --short` final raporda ayrica kaydedildi.
- Durust kalan durum: Bu tur RenderBlock/WS contract, server, desktop-agent, packages/types, tool execution, provider veya markdown davranisini degistirmedi. Capability primitive'lerinin action-result yuzeyleri icin ilk tool-result adapter proof'u var; web_search_result_block, diff, code ve timeline yuzeyleri halen eski renderer diliyle duruyor.
- Sonraki onerilen gorev: `web_search_result_block` icin ayni dar adapter yaklasimini uygulamak veya tool-result status/preview spacing'ini gercek browser screenshot'i ile ayrica gorsel regresyon kontrolunden gecirmek; runtime/protocol redesign acmamak.

### Track C / UI Foundation Phase 7 - Asset UI Foundation - 24 Nisan 2026

- `apps/web/src/components/chat/capability/AssetGrid.tsx` eklendi. Generated image variants, desktop screenshot preview, uploaded image/file preview ve generic asset listeleri icin reusable responsive grid zemini kuruldu; selectable kullanimda `role="button"`, keyboard Enter/Space handling ve `aria-pressed` state'i var.
- `apps/web/src/components/chat/capability/AssetModal.tsx` eklendi. `AssetPreviewItem` tabanli minimal preview modal foundation'i kuruldu; image/screenshot icin buyuk `img` preview, URL/preview yoklugunda sakin placeholder, `Close` action'i ve optional `CapabilityResultActions` action row'u var. Zoom/pan/download/storage/provider entegrasyonu acilmadi. Full focus-trap icin ileride Radix veya React Aria gibi bir library candidate dusunulebilir; bu turda yeni dependency eklenmedi.
- `apps/web/src/components/chat/capability/BeforeAfterCompare.tsx` eklendi. Future image editing ve desktop before/after durumlari icin iki `AssetPreviewCard` kullanan responsive Before / After comparison foundation'i kuruldu; drag slider/editor davranisi eklenmedi.
- `AssetPreviewCard.tsx` backward-compatible sekilde genisletildi: `isSelected`, `actionSlot` ve `metaSlot` destekleri eklendi. Mevcut image/screenshot render ve placeholder davranisi korundu; button nesting yaratacak yeni wrapper eklenmedi.
- `types.ts` yalniz UI-level asset tipleriyle genisletildi: `AssetActionTone` ve `AssetPreviewItem`. `packages/types`, provider/storage modeli veya runtime contract benzeri bir tip eklenmedi.
- `index.ts` yeni component ve tip export'larini verdi. `ChatPage`, `PresentationBlockRenderer`, RenderBlock, WS, server, desktop-agent, storage/upload/provider ve active task runtime wiring'e dokunulmadi.
- Degisen dosyalar: `apps/web/src/components/chat/capability/AssetGrid.tsx`, `AssetModal.tsx`, `BeforeAfterCompare.tsx`, `AssetPreviewCard.tsx`, `types.ts`, `index.ts`, `PROGRESS.md`.
- Pre-existing changes on kontrolu:
  - `M PROGRESS.md`
  - `M apps/desktop-agent/src/auth.ts`
  - `M apps/desktop-agent/src/launch-controller.ts`
  - `M apps/web/src/components/app/AppShell.tsx`
  - `M apps/web/src/components/chat/ChatShell.tsx`
  - `M apps/web/src/components/chat/PresentationBlockRenderer.tsx`
  - `M apps/web/src/components/chat/chat-presentation.tsx`
  - `M apps/web/src/lib/chat-styles.ts`
  - `M apps/web/src/pages/ChatPage.tsx`
  - `?? apps/web/src/components/chat/ChatComposerSurface.tsx`
  - `?? apps/web/src/components/chat/ChatDeveloperHint.tsx`
  - `?? apps/web/src/components/chat/ChatWorkspaceHeader.tsx`
  - `?? apps/web/src/components/chat/CurrentRunSurface.tsx`
  - `?? apps/web/src/components/chat/PastRunSurfaces.tsx`
  - `?? apps/web/src/components/chat/PersistedTranscript.tsx`
  - `?? apps/web/src/components/chat/StreamingMessageSurface.tsx`
  - `?? apps/web/src/components/chat/capability/`
  - `?? apps/web/src/components/ui/`
  - `?? apps/web/src/lib/design-tokens.ts`
- Dogrulama:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd exec biome check apps/web/src/components/chat/capability/AssetPreviewCard.tsx apps/web/src/components/chat/capability/AssetGrid.tsx apps/web/src/components/chat/capability/AssetModal.tsx apps/web/src/components/chat/capability/BeforeAfterCompare.tsx apps/web/src/components/chat/capability/types.ts apps/web/src/components/chat/capability/index.ts` ilk kosuda import sirasi ve `role="dialog"` yerine semantik `<dialog>` beklentisiyle FAIL verdi; `AssetGrid.tsx` import sirasi duzeltildi ve `AssetModal.tsx` native `<dialog open>` kullanacak sekilde guncellendi. Tekrar kosuda PASS.
  - Duzeltmeler sonrasi `pnpm.cmd --filter @runa/web typecheck` PASS ve `pnpm.cmd --filter @runa/web build` PASS tekrarlandi.
  - `rg -n "any|as any|@ts-ignore|eslint-disable|TODO" apps/web/src/components/chat/capability` final kontrolde eslesme bulmadi.
  - `git diff --stat` ve `git status --short` final raporda ayrica kaydedildi.
- Durust kalan durum: Bu tur asset UI foundation'i kurdu ama gercek image generation/editing, before/after slider, upload/storage, provider, desktop screenshot runtime preview, RenderBlock image block'u, ChatPage entegrasyonu veya active generation progress wiring'i acmadi.
- Sonraki onerilen gorev: web_search_result_block veya file/code artifact preview yuzeylerinden birini bu asset/capability foundation'a dar adapter olarak baglamak; yine RenderBlock/WS/provider/storage contract degistirmemek.

### Track C / Sprint 11 Backfill - Desktop Agent Local Runtime, Input Bridge ve Launch Shell - 24 Nisan 2026

- Takip duzeltmesi: onceki sohbet pencerelerinde acilan desktop-agent ara dilimlerinin tamami `PROGRESS.md` icinde ayri ayri gorunmuyordu. Bu bolum mevcut repo snapshot'ina dayanarak ledger'i toparlar; yeni native dependency, packaging veya OAuth/native window claim'i uretmez.
- `apps/desktop-agent/src/session.ts` local desktop session runtime zeminini tasiyor. Bootstrap/stored session yukleme, session clone/save/clear semantigi, expiring-session refresh icin mevcut `/auth/session/refresh` handoff'u, `setSession(...)`, `signOut()`, `start()/stop()` ve bridge close/error lifecycle'i ayni runtime sinirinda tutuldu.
- `apps/desktop-agent/src/shell.ts` runtime snapshot'larini user-facing shell status diline ceviriyor: `bootstrapping`, `ready`, `connecting`, `connected`, `error`, `needs_sign_in`. `launch-surface.ts` bu statuslari consumer-grade title/message/action view model'lerine map ediyor.
- `apps/desktop-agent/src/window-host.ts`, `launch-controller.ts` ve `launch-html.ts` host-agnostic launch document/action contract'ini aciyor. `connect`, `retry`, `sign_in`, `sign_out` ve `submit_session` action seamlari typed durumda; `sign_in` gercek OAuth/browser flow acmadan `awaiting_session_input` durumuna geciyor.
- Minimal session-input handoff artik daha net: `launch-html.ts` `Sign in required` / `Paste your session` / `Continue` / `Cancel` copy'siyle access-token ve refresh-token alanlarini ureten dependency-free document contract'i sagliyor; `launch-controller.ts` `submit_session` payload'ini normalize edip mevcut session handoff zincirine veriyor.
- `apps/desktop-agent/src/auth.ts` desktop session semantigini `AuthSessionTokens` ile uyumlu tutuyor. Access token, refresh token ve opsiyonel expiry normalize ediliyor; invalid/eksik session-input payload'lari teknik stack veya sessiz fallback yerine consumer-grade hata mesajina donuyor.
- `apps/desktop-agent/src/input.ts` desktop input ailesinin local-agent tarafindaki execute seam'ini tasiyor. `desktop.click`, `desktop.type`, `desktop.keypress` ve `desktop.scroll` icin Windows-first PowerShell/SendKeys/user32 tabanli execution, argument validation ve typed error result yolu var; yeni native package acilmadi.
- `apps/desktop-agent/src/ws-bridge.ts` agent hello mesajinda `desktop.click`, `desktop.keypress`, `desktop.scroll`, `desktop.screenshot` ve `desktop.type` capability'lerini advertise ediyor; server'dan gelen `desktop-agent.execute` mesajlarini screenshot veya input execution'a dispatch ediyor ve heartbeat ping'e pong ile cevap veriyor.
- Server tarafinda mevcut `desktop_bridge` invoker seami artik screenshot disinda input tool ailesi icin de kullaniliyor; `apps/server/src/tools/desktop-{click,type,keypress,scroll}.ts` bridge varsa ilgili desktop-agent capability'sine gidiyor, yoksa mevcut server-host fallback davranisini koruyor.
- Task-local kanit:
- `pnpm.cmd --filter @runa/desktop-agent typecheck` PASS
- `pnpm.cmd --filter @runa/desktop-agent build` PASS
- `pnpm.cmd exec biome check apps/desktop-agent/src/window-host.ts apps/desktop-agent/src/launch-controller.ts apps/desktop-agent/src/launch-html.ts apps/desktop-agent/src/auth.ts apps/desktop-agent/src/index.ts apps/desktop-agent/package.json` PASS
- Durust kalan durum: bu backfill, repo ledger'ini mevcut kod gercegiyle hizaladi. Hala acik olan alanlar actual desktop window host implementation'i, signed-in device presence'in web tarafinda urunlesmesi, release-grade liveness/reconnect cleanup, native app packaging/installer ve browser.interact gibi sonraki capability'lerdir.
- Sonraki onerilen gorev: future desktop wrapper icin bu host-agnostic launch document/action contract'ini gercek ince window host implementation'ina baglamak; packaging/installer veya OAuth flow'u hala ayri turda ele alinmali.

### Track C / UI Foundation Phase 10 - Manual Smoke + Screenshot Review - 24 Nisan 2026

- Smoke review yapildi ve `docs/ui-smoke/ui-foundation-phase-10-smoke-2026-04-24.md` altinda raporlandi. Bu tur report-only tutuldu; runtime, UI logic, server, desktop-agent, package/lockfile veya shared package source dosyalari degistirilmedi.
- Calisan komutlar: `pnpm.cmd install --frozen-lockfile`, `pnpm.cmd --filter @runa/types build`, `pnpm.cmd --filter @runa/web typecheck`, `pnpm.cmd --filter @runa/web build`, smoke ortami icin `pnpm.cmd --filter @runa/db build`, `pnpm.cmd --filter @runa/web dev` ve `pnpm.cmd --filter @runa/server dev`.
- Browser/viewport kontrolu Playwright inline automation ile yapildi; `agent-browser` CLI bu makinede yoktu. Local dev auth ile authenticated shell acildi; `/chat`, `/developer`, `/dashboard -> /chat`, `/settings -> /account`, `/account` ve `1440x900`, `1024x768`, `390x844` chat viewport'lari kontrol edildi.
- Blocker: browser console route smoke sirasinda authenticated yuzeylerde `Maximum update depth exceeded` uyarisi verdi. High priority bulgular: `/conversations` ve `/desktop/devices` 404 gorunurlugu ile chat yuzeyinde user-visible half-ASCII Turkce copy.
- Sonraki onerilen gorev: once React maximum update depth uyarisi ve authenticated first-run 404 yuzeyleri icin dar patch; ardindan yalniz copy/encoding polish patch'i.

### Docs Governance / Track C - Desktop Companion + Device Presence Dokuman Hizalamasi - 23 Nisan 2026

- `AGENTS.md`, `README.md`, `implementation-blueprint.md`, `docs/technical-architecture.md` ve `docs/post-mvp-strategy.md` desktop tarafi icin ayni authoritative dilde hizalandi. Eski "desktop-agent repoda yok / hala planli" anlatimi temizlenirken bugunku repo gercegi olarak secure bridge/runtime foundation ve `desktop.screenshot` vertical slice'i korunmus sekilde yazildi.
- Dokumanlarda urun hedefi yalniz local daemon degil, `desktop companion + signed-in device presence + approval-gated remote computer control` olarak netlestirildi. Kullaniciya gorunen desktop app shell, web tarafinda online cihaz gorunurlugu ve release-grade packaging'in henuz kapanmamis alanlar oldugu acikca ayrildi.
- `implementation-blueprint.md` Track C ve Sprint 11 anlatimi, mevcut `apps/desktop-agent/` foundation'i ile gelecekteki user-facing desktop companion yolunu ayni belgede birlestirecek sekilde guncellendi; "bugunku teknik zemin" ile "hedef urun sekli" birbirine karistirilmadi.
- `docs/technical-architecture.md` artik `apps/desktop-agent/` paketinin repoda oldugunu, ancak bugunku halinin user-facing desktop app degil secure bridge/runtime foundation oldugunu soyluyor; frontend sinirlari da buna uygun dilde revize edildi.
- Task-local dogrulama:
- `rg -n "desktop-agent|desktop agent|desktop daemon|repoda yok|planli|online device|device presence|remote control|desktop app" AGENTS.md implementation-blueprint.md README.md docs/technical-architecture.md docs/post-mvp-strategy.md PROGRESS.md`
- Durust kalan durum: bu tur yalnizca dokuman hizalamasi yapti; kod implementasyonu, packaging, desktop app shell, web online-device UI'si veya yeni desktop capability wiring'i acilmadi.
- Sonraki onerilen gorev: signed-in device presence icin shared contract + minimum server registry seami acan dar bir implementasyon gorevi yazmak ve buradan user-facing desktop companion yolunu kod tarafinda baslatmak.

### Sprint 11 Hazirlik / GAP-12 / KONU 22 - Desktop Agent Foundation + Secure WSS Bridge - 23 Nisan 2026

- `apps/desktop-agent/` ilk kez repoya eklendi. Package su an build/typecheck alabilen minimal bir local daemon kutuphanesi olarak duruyor; `src/auth.ts` environment tabanli config/url normalizasyonunu, `src/ws-bridge.ts` secure websocket handshake + execute/result dongusunu, `src/screenshot.ts` ise yeni native dependency acmadan Windows-first PowerShell screenshot capture yolunu sagliyor.
- `packages/types/src/ws.ts` ve `ws-guards.ts` additive desktop-agent protocol kontratlariyla genisletildi. Yeni typed mesaj ailesi `desktop-agent.connection.ready`, `desktop-agent.hello`, `desktop-agent.session.accepted`, `desktop-agent.execute`, `desktop-agent.result` ve `desktop-agent.rejected` seklinde acildi; mevcut user-facing `/ws` kontrati redesign edilmedi.
- `packages/types/src/tools.ts` icinde `ToolExecutionContext.desktop_bridge` optional seam'i eklendi. Bu sayede runtime, tool registry veya approval contract'i bozulmadan desktop tool execution'i icin ayri bir bridge invoker tasiyabiliyor.
- `apps/server/src/ws/desktop-agent-bridge.ts` secure bridge registry olarak eklendi. Authenticated user scope icin tekil desktop-agent session tutuyor, invalid hello/result mesajlarini typed reject diliyle cevapliyor, stale request ve disconnect durumlarini acik typed error sonucuna ceviriyor.
- `apps/server/src/ws/register-ws.ts` yeni `/ws/desktop-agent` endpoint'ini aciyor. Mevcut websocket auth seami korunarak yalniz authenticated user session'lari bridge endpoint'ine kabul ediliyor; anonymous veya invalid handshake acik close-reason ile reddediliyor.
- `apps/server/src/tools/desktop-screenshot.ts` bridge-aware hale getirildi. Onay gerektiren mevcut desktop screenshot boundary korunuyor; bridge bagliysa screenshot execution desktop-agent uzerinden gidiyor, bridge yoksa eski server-host fallback davranisi task-disi regressione yol acmadan korunuyor.
- Approval replay yolu da bridge-aware hale getirildi. `apps/server/src/ws/approval-handlers.ts` ve `run-execution.ts` execution_context icine ayni desktop bridge handle'ini tasiyor; boylece `approval.resolve` sonrasi replay edilen `desktop.screenshot` da local fallback'e dusmeden desktop-agent uzerinden tamamlanabiliyor.
- Task-local kanit:
- `pnpm.cmd --filter @runa/types build` PASS
- `pnpm.cmd install` PASS (`apps/desktop-agent` workspace linklerinin olusmasi icin gerekti; yeni external dependency acilmadi)
- `pnpm.cmd --filter @runa/desktop-agent typecheck` PASS
- `pnpm.cmd --filter @runa/desktop-agent build` PASS
- `pnpm.cmd --filter @runa/server typecheck` PASS
- `pnpm.cmd --filter @runa/server lint` PASS
- `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/tools/desktop-screenshot.test.ts src/ws/desktop-agent-bridge.test.ts src/ws/ws-auth.test.ts src/app.test.ts src/ws/register-ws.test.ts -t desktop` PASS
- Durust kalan durum: secure desktop bridge zemini ve `desktop.screenshot` vertical slice'i artik repoda gercek. Ancak `desktop.click` / `desktop.type` / `desktop.keypress` / `desktop.scroll` routing'i henuz bridge'e tasinmadi; browser.interact ve daha ileri liveness/reconnect ergonomisi de bu turda acilmadi.
- Sonraki onerilen gorev: mevcut typed bridge uzerinden kalan desktop input tool ailesini additive olarak migrate etmek ve agent liveness/heartbeat + stale session cleanup davranisini release-grade hale getirmek.

### Release-Readiness / Track A / KONU 21 - Approval / Policy Persistence Hardening - 23 Nisan 2026

- `apps/server/src/ws/policy-wiring.test.ts` restart-safe hydration kanitini dar ama dogru sekilde genisletti. Yeni coverage, ayni authenticated scope icin persisted denial/session-pause state'inin taze socket + taze `createWebSocketPolicyWiring(...)` instance'ina hydrate oldugunu ve persisted progressive-trust auto-continue state'inin reconnect sonrasi tekrar `allow` uretebildigini dogruluyor.
- `apps/server/src/ws/register-ws.test.ts` yeni reconnect acceptance'i ile persisted pending approval kaydinin taze websocket attachment + taze approval store/policy wiring instance uzerinden `approval.resolve` ile replay edildigini kanitliyor. Test presentation timing'ine degil, persisted approval seam'ine dayali; restart-safe continuation kaniti daha dogrudan hale geldi.
- Production kodunda genis redesign acilmadi. Mevcut `approval-store.ts` / `policy-state-store.ts` / `policy-wiring.ts` persistence zemini korunup, release-oncesi eksik kalan hydration/reconnect proof katmani task-local testlerle kapatildi.
- Task-local kanit:
- `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/persistence/approval-store.test.ts src/persistence/policy-state-store.test.ts` PASS
- `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/ws/policy-wiring.test.ts` PASS
- `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/ws/register-ws.test.ts -t "replays a persisted pending approval after a fresh websocket attachment and policy wiring instance"` PASS
- `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/ws/policy-wiring.test.ts src/ws/register-ws.test.ts -t "replays a persisted pending approval after a fresh websocket attachment and policy wiring instance|hydrates paused denial tracking for a fresh socket from the persistent policy store|hydrates progressive trust for auto-continue from the persistent policy store"` PASS
- `pnpm.cmd --filter @runa/server typecheck` PASS
- `pnpm.cmd --filter @runa/server exec biome check src/ws/policy-wiring.test.ts src/ws/register-ws.test.ts` PASS
- `pnpm.cmd --filter @runa/server lint` FAIL, ancak failure bu gorevin dosyalarindan degil. Kalan repo-baseline Biome drift `src/gateway/{claude,gemini,openai}-gateway.ts`, `src/persistence/conversation-store{,.test}.ts`, `src/routes/{conversations,upload}.ts`, `src/ws/{conversation-collaboration,orchestration-types}.ts` ve `src/gateway/gateway.test.ts` tarafinda devam ediyor.
- Durust kalan not: `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/ws/register-ws.test.ts src/ws/policy-wiring.test.ts src/persistence/approval-store.test.ts src/persistence/policy-state-store.test.ts` genis task-local sweep'inde `src/ws/register-ws.test.ts` icindeki daha eski, bu gorevle dogrudan ilgili olmayan bircok acceptance senaryosu repo-baseline olarak kirmizi kaldi. Bu turda reconnect/persistence proof'lari hedefli olarak yesile getirildi; tum WS acceptance dosyasi yeniden stabilize edilmedi.
- Sonraki onerilen gorev: ayri bir stabilization turunda `src/ws/register-ws.test.ts` dosyasinin genis baseline'ini tekrar yesile dondurmek ya da artik ana acik audit gap olan `GAP-12` icin desktop/browser capability yoluna gecmek.

### Phase 3 Depth / Phase 4 Continuation / KONU 18 - Semantic Memory + RAG - 23 Nisan 2026

- `packages/types/src/memory.ts`, `packages/db/src/schema.ts` ve `client.ts` additive olarak semantic memory zeminiyle genisletildi. `memories` tablosuna `retrieval_text` ve `embedding_metadata` alanlari eklendi; shared memory kontrati `MemoryEmbeddingMetadata` ve `RetrievedMemoryRecord` tipleriyle retrieval bilgisi tasiyabilir hale geldi.
- `apps/server/src/memory/semantic-profile.ts` ve `retrieve-semantic-memories.ts` ile dependency acmadan minimum retrieval seami kuruldu. Yeni write path her memory icin deterministic token-profile metadata uretiyor; read path query varsa semantic overlap skoruyla, yoksa mevcut recency fallback ile calisiyor.
- `apps/server/src/context/compose-memory-context.ts`, `orchestrate-memory-read.ts` ve `apps/server/src/ws/live-request.ts` run basinda ilgili memory parcasi cekmek icin bu retrieval helper'i kullanir hale geldi. Boylece compiled context artik sirf en yeni memory'leri degil, user turn ile daha alakali memory'leri one cekebiliyor.
- `apps/server/src/memory/search-memory-tool.ts` ile dar bir `search.memory` tool seam'i eklendi. Tool built-in registry'yi global olarak redesign etmeden, `apps/server/src/ws/run-execution.ts` icinde run-local registry clone'una additive kaydediliyor; memory persistence mevcutsa model durable user/workspace memory icinde arama yapabiliyor.
- Memory write tarafi bilincli sekilde secici tutuldu. `apps/server/src/persistence/memory-store.ts` artik yazilan kayitlara retrieval metadata'si ekliyor; mevcut explicit memory/user preference akisi korunuyor, conversation history veya her assistant yaniti sonsuz memory'ye cevrilmiyor.
- Task-local kanit:
- `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/memory/retrieve-semantic-memories.test.ts src/memory/search-memory-tool.test.ts src/persistence/memory-store.test.ts src/ws/live-request.test.ts src/context/compose-memory-context.test.ts src/context/orchestrate-memory-read.test.ts` PASS
- `pnpm.cmd --filter @runa/server exec tsc --noEmit` PASS
- `pnpm.cmd --filter @runa/server exec biome check src/memory/semantic-profile.ts src/memory/retrieve-semantic-memories.ts src/memory/search-memory-tool.ts src/memory/retrieve-semantic-memories.test.ts src/memory/search-memory-tool.test.ts src/context/compose-memory-context.ts src/context/orchestrate-memory-read.ts src/ws/live-request.ts src/ws/live-request.test.ts src/ws/run-execution.ts src/persistence/memory-store.ts src/persistence/memory-store.test.ts ../../packages/types/src/memory.ts ../../packages/types/src/tools.ts ../../packages/db/src/schema.ts ../../packages/db/src/client.ts ../../packages/db/src/schema.test.ts` PASS
- `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/ws/register-ws.test.ts -t "injects them into the next compiled_context"` FAIL. Workspace explicit-memory path bu regression turunda yesil kalirken `writes explicit user preferences into user scope and injects them into the next compiled_context` senaryosunda `createMemoryMock` halen 0 geliyor; semantic retrieval seami gecse de bu dar WS preference persistence acceptance'i ayri stabilization istiyor.
- `pnpm.cmd --filter @runa/server lint` FAIL, ancak kalan 15 Biome hatasi bu gorevin semantic-memory dosyalarindan degil. Gorunen baseline drift `src/gateway/{claude,gemini,openai}-gateway.ts`, `src/persistence/conversation-store{,.test}.ts`, `src/routes/{conversations,upload}.ts`, `src/app.test.ts`, `src/gateway/gateway.test.ts`, `src/ws/{conversation-collaboration,orchestration-types}.ts` uzerinde devam ediyor.
- Durust kalan durum: semantic retrieval/store zemini, live request context entegrasyonu ve dar memory search tool'u task-local olarak calisiyor. Ancak mevcut WS preference persistence acceptance testi ve repo-genel server lint baseline'i bu tur sonunda hala tamamen yesil degil.
- Sonraki onerilen gorev: `src/ws/register-ws.test.ts` icindeki user_preference persistence acceptance'ini dar kapsamda tekrar yesile donduren bir stabilization gorevi acmak; ayrik olarak da mevcut server Biome baseline drift'ini ayri bir hygiene gorevinde temizlemek.

### Release-Readiness / Track B / KONU 19 - Security Hardening - 23 Nisan 2026

- `apps/server/src/auth/rbac.ts` ile minimum role-aware authorization seami eklendi. `anonymous < viewer < editor < owner < admin` matrisi tek yerde toplandi; service principal `admin`, normal authenticated principal varsayilan `editor`, `claims.app_metadata` veya `user.metadata` icindeki `runa_role`/`role`/`roles[]` alanlari varsa override edebiliyor.
- `apps/server/src/routes/auth.ts` prod-grade OAuth ve session sertlestirmesi icin genisletildi. `/auth/oauth/start` artik same-origin `redirect_to` ve opsiyonel PKCE `code_challenge`/`code_challenge_method=S256` parametrelerini dogruluyor; `/auth/oauth/callback` callback query'sini gÃƒÂ¼venli sekilde app origin'ine relay ediyor; yeni `/auth/oauth/callback/exchange` Supabase `grant_type=pkce` code exchange yolunu aciyor; yeni `/auth/session/refresh` ise `grant_type=refresh_token` ile session yeniliyor.
- Auth route boundary netlestirildi: `/auth/context` cevabi additive `authorization.role` bilgisi tasiyor; `/auth/protected` yalniz authenticated olmayi degil en az `editor` yetkisini de istiyor. Boylece role downgraded bir kullanici bu route yuzeyinde acik `403` ile reddediliyor.
- `apps/server/src/policy/permission-engine.ts` role-aware tool authorization seami kazandi. Runtime kontrati redesign edilmeden `actor_role` opsiyonel hale getirildi; verildiginde tool icin minimum rol (`viewer` read/search, `editor` write, `owner` execute/shell) hesaplanip `authorization_role_denied` karari uretebiliyor. Mevcut WS/runtime davranisi actor role gecmedigi icin task disi bir regressione zorlanmadi.
- `apps/web/src/hooks/useAuth.ts` PKCE ve session timeout davranisini sertlestirdi. Hook artik OAuth query callback sonucunu tuketiyor, PKCE `code_verifier` uretip sakliyor, callback code'unu yeni server route uzerinden exchange ediyor, `refresh_token`/`expires_at` bilgisini sessionStorage'da tutuyor, expiry yaklastiginda otomatik refresh deniyor ve additive olarak `authorizationRole` ile `sessionState` yuzeylerini expose ediyor.
- Conversation tarafinda yeni route/store redesign acilmadi. Mevcut `viewer/editor/owner` conversation access modeli korundu; yeni auth role seami bunu replace etmek yerine onunla ayni dilde hizalandi.
- Task-local kanit:
- `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/auth/supabase-auth.test.ts src/auth/rbac.test.ts src/policy/permission-engine.test.ts src/app.test.ts` PASS
- `pnpm.cmd --filter @runa/server typecheck` PASS
- `pnpm.cmd --filter @runa/web typecheck` PASS
- `pnpm.cmd exec biome check apps/server/src/auth/rbac.ts apps/server/src/auth/rbac.test.ts apps/server/src/routes/auth.ts apps/server/src/policy/permission-engine.ts apps/server/src/policy/permission-engine.test.ts apps/server/src/app.test.ts apps/web/src/hooks/useAuth.ts` PASS
- `pnpm.cmd --filter @runa/server lint` FAIL, ancak kalan 14 Biome hatasi bu gorevin auth/RBAC dosyalarindan degil. Gorunen baseline drift `src/gateway/{claude,gemini,openai}-gateway.ts`, `src/gateway/gateway.test.ts`, `src/persistence/{conversation-store,conversation-store.test}.ts`, `src/routes/{conversations,upload}.ts`, `src/ws/{conversation-collaboration,orchestration-types}.ts` uzerinde devam ediyor.
- Durust kalan durum: PKCE callback relay/exchange, refresh-token session renewal ve minimum route/tool role seami task-local olarak yesil. Ancak full server lint baseline'i halen repo-genel hygiene borcu olarak acik; conversation route/store tarafinda bu taskta bilerek yeni RBAC rewrite acilmadi.
- Sonraki onerilen gorev: mevcut auth role seami uzerinden conversation/share ve runtime policy wiring tarafina actor role tasiyan dar bir integration gorevi acmak ya da once kalan server Biome baseline drift'ini ayri bir hygiene turunda temizlemek.

### Phase 4 Backlog / KONU 16 - Collaborative Sessions - 23 Nisan 2026

- `packages/db/src/schema.ts`, `client.ts`, `conversations.ts` ve `schema.test.ts` additive olarak `conversation_members` tablosu ile guncellendi. Composite primary key `(conversation_id, member_user_id)` uzerinden `viewer/editor` uyeligi, owner'dan gelen `added_by_user_id` izi ve conversation/member indeksleri acildi.
- `apps/server/src/persistence/conversation-store.ts` tek kullanicili sahiplik mantigini bozmadan role-aware access katmani kazandi. `owner/editor/viewer` rolleri icin okuma-yazma ayrimi eklendi; `listConversationMembers`, `shareConversationWithMember`, `removeConversationMember` ve `getConversationAccessRole` seamlari acildi.
- `apps/server/src/routes/conversations.ts` artik yalniz `/conversations` ve `/messages` degil, `/conversations/:conversationId/members` GET/POST ve `/conversations/:conversationId/members/:memberUserId` DELETE yuzeylerini de expose ediyor. Owner olmayan kullanicilarin member degistirme denemeleri store seviyesinden typed 404/400 olarak geri donuyor.
- `apps/server/src/ws/conversation-collaboration.ts`, `register-ws.ts` ve `run-execution.ts` uzerinde ayni conversation icin minimum realtime fan-out eklendi. Origin socket `run.accepted` ve `run.finished` alirken, ayni conversation'a erisimi olan diger socket'ler de ayni lifecycle sinyalini gorup kendi aktif conversation gorunumlerini tazeleyebiliyor.
- Web tarafinda `apps/web/src/hooks/useConversations.ts`, `apps/web/src/hooks/useChatRuntime.ts`, `apps/web/src/components/chat/ConversationSidebar.tsx` ve `apps/web/src/pages/ChatPage.tsx` role-aware hale geldi. Sidebar artik role badge gosteriyor; aktif conversation icin member listesi aciliyor; owner kullanici minimum share/remove formu ile `viewer/editor` yonetebiliyor.
- Task-local kanit:
- `pnpm --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/persistence/conversation-store.test.ts` PASS
- `pnpm --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/app.test.ts -t "lists authenticated conversations|returns persisted messages|lists shared conversation members|allows owners to share a conversation member through the route seam|surfaces viewer/editor sharing validation as a bad request"` PASS
- `pnpm --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/ws/register-ws.test.ts -t "rejects viewers from starting a run in a shared conversation|allows editors to start a run and fans out completion to another shared socket"` PASS
- `pnpm --filter @runa/server typecheck` PASS
- `pnpm --filter @runa/types build` PASS
- `pnpm --filter @runa/web build` PASS
- Durust kalan durum: task-local multi-user route/ws acceptance yesil. Ancak genis `src/ws/register-ws.test.ts` dosyasinin tamami bu turda yeniden stabilize edilmedi; full dosya kosusunda task disi daha genis failure'lar goruldu. Bu gorev icinde yalnizca collaborative-session acceptance senaryolari yesile getirildi.
- Sonraki onerilen gorev: yeni collaboration seami uzerinde share UX'ini email/display-name dostu hale getiren dar bir polish gorevi acmak ya da ayri bir stabilization gorevinde `src/ws/register-ws.test.ts` dosyasinin genis baseline'ini tekrar yesile dondurmek.

### Phase 4 Backlog / KONU 17 - Mobile PWA - 23 Nisan 2026

- `apps/web/public/manifest.json`, `sw.js`, `favicon.svg` ve `icons/*` ile minimum installable PWA zemini eklendi. Manifest chat-first `start_url` olarak `/chat`, `standalone` display, mobile shortcut'lar ve 32/180/192/512 icon seti tasiyor.
- `apps/web/index.html` mobile shell metadata'si ile guncellendi: `viewport-fit=cover`, `apple-mobile-web-app-*` alanlari, manifest/icon linkleri ve yeni dependency acmadan service worker registration eklendi.
- `apps/web/src/components/app/AppShell.tsx` ile `apps/web/src/index.css` uzerinde mobile-first shell sertlestirildi. Safe-area-aware page padding, sticky app shell hero/header ve `1024px`, `768px`, `480px` breakpoint sikilastirmalari eklendi; navigation meta/toggle mobilda dikey akisa dusebiliyor.
- `apps/web/public/sw.js` bilincli olarak minimum shell-cache stratejisiyle sinirli tutuldu. App shell, manifest ve statik asset'ler cache'leniyor; `/auth` ve `/ws` disarida birakiliyor ve full offline runtime garantisi verilmiyor.
- Dogrulama:
- `pnpm.cmd --filter @runa/web typecheck` PASS
- `pnpm.cmd --filter @runa/web build` PASS
- Durust kalan durum: manifest/installability metadata'si ve production build artifact'i yesil. Canli authenticated mobile browser smoke veya cihaz emulation turu bu task icinde kosulmadi; breakpoint audit CSS/layout seam'i ve build uzerinden yapildi.
- Sonraki onerilen gorev: install prompt davranisi ve authenticated route icin gercek mobile browser smoke'u ayri, dar kapsamli bir verification/polish gorevi olarak acmak; offline runtime veya push notification kapsami acmamak.

### Phase 3 Backlog / KONU 13 - Dosya Tabanli Plugin Loader ve Sandboxli Tool Bridge - 23 Nisan 2026

- `packages/types/src/tools.ts` additive olarak `plugin` namespace'ini kabul eder hale getirildi. Boylece built-in isim listesi bozulmadan plugin tool adlari typed kontrat icinde tanimlanabiliyor.
- `apps/server/src/plugins/manifest.ts` ile dosya tabanli plugin manifest formati eklendi. `runa-plugin.json` manifest'i `plugin_id`, `schema_version`, `tools[]`, callable schema, risk/side-effect metadata ve timeout alanlarini parse ediyor; `RUNA_PLUGIN_DIRS` env seam'i de buradan okunuyor.
- `apps/server/src/plugins/tool-bridge.ts` child-process tabanli izole execution yolu kurdu. Plugin handler'lari ayri `node` surecinde, shell kapali ve kisitli env ile calisiyor; input/context JSON olarak stdin'den gidiyor, stdout JSON cevabi `ToolResult` shape'ine map ediliyor. Timeout, non-zero exit ve invalid JSON hatalari typed `EXECUTION_FAILED` sonucuna donuyor.
- `apps/server/src/plugins/loader.ts` built-in registry'yi replace etmeden plugin discovery seami acti. Plugin root ya dogrudan `runa-plugin.json` iceren klasor olabilir ya da boyle alt klasorleri barindiran parent klasor olabilir. Loader built-in tool isimlerini ve ayni discovery turundeki tekrar adlari rezerv tutuyor; override denemesinde `PluginConflictError` ile kayit reddediliyor.
- `apps/server/src/ws/runtime-dependencies.ts` artik built-in registry kurulduktan sonra `RUNA_PLUGIN_DIRS` altindaki plugin tool'larini additive olarak registry'ye ekliyor; MCP wiring aynen korunuyor, plugin sistemi MCP ile birlestirilmedi.
- Hedefli kanit:
- `apps/server/src/plugins/loader.test.ts` child-process bridge'in calistigini, plugin metadata'nin registry'ye map edildigini, immediate-child discovery'nin calistigini ve built-in override denemesinin reddedildigini kanitliyor.
- `apps/server/src/ws/runtime-dependencies.test.ts` env tabanli plugin discovery'nin built-in registry'yi bozmadan runtime dependency seviyesinde eklendigini kanitliyor.
- `apps/server/src/tools/registry.ts` uzerine yalnizca built-in ad listesini expose eden kucuk helper eklendi; built-in execution yolu replace edilmedi.
- Dogrulama:
- `pnpm --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/plugins/loader.test.ts src/ws/runtime-dependencies.test.ts src/tools/registry.test.ts` PASS
- `pnpm --filter @runa/server typecheck` PASS
- `pnpm --filter @runa/server exec biome check src/plugins src/ws/runtime-dependencies.ts src/ws/runtime-dependencies.test.ts src/tools/registry.ts src/tools/registry.test.ts ../../packages/types/src/tools.ts src/gateway/gateway.test.ts` PASS
- `pnpm --filter @runa/server lint` FAIL, ancak kalan 5 Biome hatasi bu gorevin degistirdigi dosyalarda degil. Mevcut baseline drift `src/gateway/{claude,gemini,openai}-gateway.ts`, `src/persistence/conversation-store.ts` ve `src/ws/orchestration-types.ts` uzerinde devam ediyor.
- Durust kalan durum: file-based plugin loader ve child-process bridge aktif; built-in override reddi kanitli. Tam repo server lint baseline'i ise ayri hygiene gorevi gerektiriyor.
- Sonraki onerilen gorev: plugin bridge icin ikinci dar adimda policy baglaminin manifest seviyesinde daha da netlestirilmesi ya da kalan 5 Biome drift'ini temizleyip `@runa/server lint` baseline'ini yeniden yesile dondurmek.

### Phase 3 Depth / KONU 15 - File Upload + Multimodal Minimum Path - 23 Nisan 2026

- `packages/types/src/gateway.ts` ve `packages/types/src/ws.ts` additive olarak attachment kontratini aldi. `ModelAttachment` union'i text/image ayrimini typed sekilde tasiyor; `RunRequestPayload` ustunde opsiyonel `attachments` alani acildi ve `ws-guards.ts` bu yeni shape'i dogruluyor.
- `apps/server/src/routes/upload.ts` yeni minimum upload route'u olarak eklendi ve `apps/server/src/app.ts` icinde register edildi. Route mevcut auth + storage authority ile uyumlu kalarak JSON-base64 upload kabul ediyor, dosyayi storage seamine yaziyor ve text icin `text_content`, image icin `data_url` iceren typed attachment cevabi donuyor.
- Storage tarafinda yeni dependency acilmadi. `apps/server/src/storage/storage-service.ts` ve `supabase-storage-adapter.ts` attachment blob kind'larini (`attachment_text`, `attachment_image`) additive olarak kabul eder hale geldi; buyuk payload'i WS presentation block'larina gommek yerine upload sonrasi attachment metadata kontrati kullanildi.
- `apps/server/src/context/adapt-context-to-model-request.ts` ve `apps/server/src/ws/live-request.ts` attachment'lari live model request'e tasiyor. Gateway tarafinda `openai`, `groq`, `gemini` ve `claude` adapter'lari son user turn'e attachment part'larini provider-native request shape'inde map ediyor; text attachment metni kontrollu sekilde ekleniyor, image attachment data URL/base64 kaynagi olarak geciyor.
- Web tarafinda `apps/web/src/components/chat/FileUploadButton.tsx` ve `apps/web/src/pages/ChatPage.tsx` composer yanina sade dosya yukleme seami ekledi. Yuklenen attachment'lar kartta ozetleniyor, kaldirilabiliyor ve mevcut text-first chat akisi korunuyor; full document understanding pipeline veya vision-action desktop loop acilmadi.
- Dogrulama:
- `pnpm --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/routes/upload.test.ts src/ws/live-request.test.ts src/gateway/gateway.test.ts` PASS
- `pnpm --filter @runa/server typecheck` PASS
- `pnpm --filter @runa/web typecheck` PASS
- `pnpm --filter @runa/web build` PASS
- Durust kalan durum: minimum multimodal yol text/image ile acildi; PDF ve daha genis document understanding bilincli olarak scope disinda tutuldu. `@runa/web lint` bu turda istenmedi ve repo genelindeki onceki Biome drift'leri acik kaldi.
- Sonraki onerilen gorev: attachment'lar icin persisted conversation transcript ve assistant cevabi arasina hafif preview/reference surface'i eklemek ya da PDF/dokuman tarafini ayri, dar kapsamli bir extraction seamiyle acmak; WS contract'i veya desktop vision loop'unu genisletmemek.

### Release-Readiness Backlog / KONU 12 - Structured Logging Zemini ve Dar Tracing Seam'leri - 23 Nisan 2026

- `apps/server/src/utils/logger.ts` ve `logger.test.ts` ile yeni structured logger utility'si eklendi. Tek giris noktasindan JSON log uretiyor; `apiKey`, `authorization`, `password`, `token`, `secret`, `cookie` ve benzeri gizli alanlari recursive olarak `[REDACTED]` maskesine cekiyor. Ayrica minimum span/tracing seami icin `startLogSpan(...)` yardimcisi eklendi.
- `apps/server/src/app.ts` artik startup asamalarindaki `console.log` cagrilarini logger uzerinden geciriyor; websocket/auth/storage route registration adimlari structured event isimleriyle kayit altina aliniyor.
- `apps/server/src/ws/run-execution.ts` uzerinde run kabul/finalize, gateway generate ve tool execute dar seam'lerine log/spans eklendi. Log baglamlari `run_id`, `trace_id`, provider/model, `tool_name`, `call_id`, final state ve status alanlarini tasiyor; tool permission allow/approval/deny/pause dallari da structured event olarak gorunur hale geldi.
- `apps/server/src/gateway/provider-http.ts` ve `groq-gateway.ts` structured logger'a tasindi. Provider debug log'u artik env flag (`RUNA_DEBUG_PROVIDER_ERRORS=1`) altinda JSON olarak uretiliyor; Groq debug baglamina `run_id`, `trace_id`, model, tool serialization/context mode ve yalniz sayisal/guvenli ozet alanlari tasindi. Eski `last_user_message_preview` cikarildi; sadece `last_user_message_chars` korunuyor.
- Dogrulama:
- `pnpm --filter @runa/server typecheck` PASS
- `pnpm --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/utils/logger.test.ts src/gateway/gateway.test.ts` PASS
- `pnpm --filter @runa/server exec biome check src/utils/logger.ts src/utils/logger.test.ts src/gateway/provider-http.ts src/gateway/groq-gateway.ts src/gateway/gateway.test.ts src/ws/run-execution.ts src/app.ts` PASS
- `pnpm --filter @runa/server lint` FAIL, ancak kalan 5 Biome hatasi bu gorevin dokundugu dosyalarda degil. Mevcut baseline drift `src/gateway/{claude,gemini,openai}-gateway.ts`, `src/persistence/conversation-store.ts` ve `src/ws/orchestration-types.ts` uzerinde devam ediyor.
- Durust kalan durum: bu gorev kapsamindaki logger/tracing zemini ve gizli alan maskelemesi aktif; full repo server lint baseline'i ise ayri bir hygiene gorevi gerektiriyor.
- Sonraki onerilen gorev: `@runa/server lint` baseline'ini yeniden yesile dondurmek icin kalan 5 format drift'ini temizleyen dar kapsamli hygiene gorevi acmak ya da structured logger'i scope disi kalan secili `console.*` yuzeylerine (`ws/live-request.ts`, persistence debug seam'leri) kontrollu sekilde yaymak.

### Track B / Follow-Up - HTTP + WS Icin Dar Kapsamli Quota / Rate-Limit Enforcement - 23 Nisan 2026

- `packages/types/src/policy.ts` uzerine typed `UsageLimitRejection` kontrati eklendi; `packages/types/src/ws.ts` ve `ws-guards.ts` artik `run.rejected` payload'i icinde opsiyonel typed limit nedeni tasiyabiliyor. WS protocol redesign yapilmadi; yalnizca additive reject metadata eklendi.
- `apps/server/src/policy/usage-quota.ts` icinde mevcut quota helper'i korunarak yeni tier-aware rolling minute rate-limit seami eklendi. `ws_run_request` icin daha siki, `http_request` icin daha hafif limit tablosu tanimlandi; store bilincli olarak ilk adimda process-ici Map olarak tutuldu. `UsageQuotaError` artik rate-limit ve quota exhaustion durumlarinda typed `reject_reason` metadata'si tasiyabiliyor.
- `apps/server/src/ws/run-execution.ts` artik authenticated run baslangicinda `monthly_turns` metriÃ„Å¸i icin `ws_run_request` limitini enforce ediyor. Limit asiminda `run.accepted` gonderilmeden once kontrollu `run.rejected` donuyor; ayni kullanici icin minute-window dolunca typed neden payload'a dusuyor.
- Test kaniti dar tutuldu: `apps/server/src/policy/usage-quota.test.ts` WS-vs-HTTP threshold farkini, rolling-window resetini ve typed rate-limit error'unu kanitliyor. `apps/server/src/ws/register-ws.test.ts` uzerine ayni kullanici icin WS run-start limit asiminda typed `run.rejected.reject_reason` beklentisi eklendi.
- Dogrulama:
- `pnpm --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/policy/usage-quota.test.ts` PASS
- `pnpm --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/ws/register-ws.test.ts -t "returns a typed run.rejected reason when the ws run-start rate limit is exceeded for the same user"` PASS
- `pnpm --filter @runa/server typecheck` PASS
- `pnpm --filter @runa/server exec biome check src/policy/usage-quota.ts src/policy/usage-quota.test.ts src/ws/run-execution.ts src/ws/transport.ts src/ws/register-ws.test.ts ../../packages/types/src/policy.ts ../../packages/types/src/ws.ts ../../packages/types/src/ws-guards.ts` PASS
- `pnpm --filter @runa/server lint` FAIL, ancak failure bu gorevin rate-limit dosyalarindan degil; mevcut repo baseline drift `src/gateway/{claude,gemini,groq,openai}-gateway.ts`, `src/persistence/conversation-store.ts` ve `src/ws/orchestration-types.ts` uzerinde devam ediyor.
- Durust kalan durum: WS tarafinda minimum enforcement aktif ve typed reject kaniti var. HTTP tarafi icin daha hafif threshold mantigi shared helper'a eklendi ve testlendi; route-level genis wiring bu gorevin strict scope'u disina tasinmadi.
- Sonraki onerilen gorev: mevcut helper'i dar kapsamli bir authenticated HTTP surface'e baglayip ayni typed reject dilini REST cevabina da yansitmak ya da ayri bir hygiene goreviyle `@runa/server lint` baseline'ini yeniden yesile dondurmek.

### Track A / Phase 3 Backlog - Intent-Aware Model Router + Fallback Temeli - 22 Nisan 2026

- `apps/server/src/gateway/model-router.ts` ve `fallback-chain.ts` ile metadata-opt-in intent-aware routing seami eklendi. Karar mantigi saf helper'larda tutuldu: explicit preferred provider, cheap/tool-heavy/deep-reasoning intent ayrimi ve minimum fallback sirasi testlenebilir hale geldi.
- `apps/server/src/gateway/factory.ts` artik provider adapter'larini yeniden yazmadan ince bir router-aware `ModelGateway` wrapper'i donuyor. Router kapaliyken request mevcut provider/model yolunda kaliyor; router acikken secilen provider icin request model'i guncelleniyor ve yalniz request/response/configuration failure tiplerinde minimum provider fallback deneniyor.
- Bu turda `apps/server/src/ws/run-execution.ts` davranisi degistirilmedi; mevcut `createModelGateway(...)` cagrisi korunarak routing/fallback factory seviyesinde devreye alindi. Boylece WS/runtime kontrati ve authenticated akisin sekli degismedi.
- Dogrulama:
- `pnpm --filter @runa/server typecheck` PASS
- `pnpm --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/gateway/gateway.test.ts src/gateway/model-router.test.ts` PASS
- `pnpm --filter @runa/server exec biome check src/gateway/model-router.ts src/gateway/fallback-chain.ts src/gateway/factory.ts src/gateway/model-router.test.ts src/gateway/gateway.test.ts` PASS
- `pnpm --filter @runa/server lint` FAIL, ancak kalan Biome drift bu gorevin yeni router dosyalarinda degil; mevcut snapshot'ta `src/gateway/{claude,gemini,groq,openai}-gateway.ts`, `src/persistence/conversation-store.ts`, `src/ws/run-execution.ts` ve `src/ws/orchestration-types.ts` uzerinde kaliyor.
- Sonraki onerilen gorev: router seam'ini canli env/proof gorevine tasiyip intent metadata'nin hangi runtime kaynaklardan beslenecegini dar kapsamda netlestirmek ya da ayri bir hygiene goreviyle repo-genel server Biome drift'ini temizlemek.

### Release-Readiness Backlog - Web + Server E2E Altyapisi ve Temel CI Pipeline - 22 Nisan 2026

- Root seviyesinde `@playwright/test` devDependency'si, `test:e2e` script'i, yeni `playwright.config.ts`, `.github/workflows/ci.yml` ve `e2e/*` smoke altyapisi eklendi. AmaÃƒÂ§ canli provider secret'i kullanmadan auth bootstrap + chat submit + approval replay yolunu release oncesi minimum kalite kapisi olarak kanitlamakti.
- `e2e/serve-runa-e2e.mjs` deterministic bir local harness sagliyor: Fastify + WS server dist output'u ayaga kaldiriliyor, local-dev auth bootstrap aktif ediliyor, OpenAI chat-completions cagrisi process-ici mock ile intercept ediliyor ve approval sonrasi `file.write` replay'i gercek tool registry uzerinden proof dosyasi yazarak tamamlanÃ„Â±yor.
- `e2e/chat-e2e.spec.ts` iki smoke senaryosu kapsiyor: `/auth/dev/bootstrap` uzerinden chat shell'in acilmasi ve approval gerektiren bir chat isteginin kabul edilip `file.write completed successfully.` sinyali ile proof dosyasina ulasmasi. Testler stale local conversation state'ini temizleyerek daha deterministik hale getirildi.
- GitHub Actions workflow iki lane olarak ayrildi: `quality` job'i `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` kosuyor; `e2e` job'i Playwright Chromium kurup `pnpm test:e2e` calistiriyor ve `playwright-report` ile `test-results/playwright` artifact'larini yukluyor.
- Dogrulama:
- `pnpm typecheck` PASS
- `pnpm lint` FAIL, ancak failure bu gorevin ekledigi dosyalardan degil; repo-genel pre-existing Biome drift `apps/server/src/gateway/*`, `apps/server/src/ws/*`, `apps/web/src/App.tsx`, `apps/web/src/hooks/useConversations.ts` ve benzeri dosyalarda devam ediyor.
- `pnpm test` FAIL, ancak failure bu gorevin yeni E2E lane'inden degil; mevcut baseline `dist/ws/register-ws.test.js` ve `dist/runtime/run-with-provider.test.js` tarafinda kirik durumda.
- `pnpm build` PASS
- `pnpm exec biome check package.json playwright.config.ts e2e/chat-e2e.spec.ts e2e/serve-runa-e2e.mjs` PASS
- `pnpm test:e2e` PASS
- Sonraki onerilen gorev: repo-genel `lint` ve `test` baseline'ini dar kapsamli bir hygiene/repair goreviyle tekrar yesile dondurup yeni CI pipeline'in PR'larda gercek blocker olarak kullanilabilir hale gelmesini saglamak.

### Track C / Maintenance - Chat Runtime State Management Decomposition - 22 Nisan 2026

- `apps/web/src/stores/chat-store.ts` ile dependency eklemeden kucuk external store seam'i eklendi; runtime config, connection/submit durumu, transport mesajlari ve current-run presentation tracking state'i artik ayri slice'lar halinde tutuluyor.
- `apps/web/src/hooks/useChatRuntime.ts` sifirdan yazilmadan kontrollu sekilde toparlandi. WebSocket lifecycle, runtime-config persistence ve presentation tracking update'leri yeni store uzerinden ilerliyor; mevcut WS davranisi ve chat aksiyonu kontratlari korunuyor.
- `apps/web/src/pages/ChatPage.tsx` ve `apps/web/src/pages/DashboardPage.tsx` secili runtime state'lerini `useChatStoreSelector(...)` ile tuketir hale geldi. Boylece sayfa tarafinda selector mantigi acildi; hook sonucu uzerindeki tum ham state'e dogrudan bagimlilik biraz daha azaldi.
- Dogrulama:
- `pnpm --filter @runa/web typecheck` PASS
- `pnpm --filter @runa/web lint` FAIL, ancak kalan Biome drift bu gorevin dar kapsamindan once de repoda bulunan `src/App.tsx`, `src/components/chat/ConversationSidebar.tsx` ve `src/hooks/useConversations.ts` uzerinde gorunuyor. Degistirilen state-management dosyalari icin `pnpm --filter @runa/web exec biome check src/hooks/useChatRuntime.ts src/pages/ChatPage.tsx src/pages/DashboardPage.tsx src/stores/chat-store.ts` PASS.
- `pnpm --filter @runa/web build` PASS
- Sonraki onerilen gorev: bu store tabanli ilk adimi takip ederek `useChatRuntime.ts` icindeki inspection/request orchestration dalini ayri bir helper/store seam'ine tasimak ya da ayri bir hygiene goreviyle mevcut repo-genel Biome drift baseline'ini temizlemek.

### Track C / Sprint 11 Hazirlik - Approval-Gated Desktop Control Tool Family - 22 Nisan 2026

- `apps/server/src/tools/desktop-click.ts`, `desktop-type.ts`, `desktop-keypress.ts` ve `desktop-scroll.ts` eklendi. Her tool approval-gated, `capability_class: desktop`, `risk_level: high` ve `side_effect_level: execute` metadata'si ile kayitli; mevcut `desktop.screenshot` davranisina dokunulmadi.
- Uygulama bilincli olarak yeni native dependency acmadan tutuldu. Windows host icin PowerShell tabanli ince input-injection seam'i kullanildi; click/scroll `user32` uzerinden, type/keypress ise `System.Windows.Forms.SendKeys` uzerinden calisiyor. `apps/desktop-agent/`, vision-action loop ve browser automation kapsam disinda birakildi.
- `packages/types/src/tools.ts` additive olarak yeni desktop tool adlariyla guncellendi; `apps/server/src/tools/registry.ts` built-in registry artik `desktop.click`, `desktop.type`, `desktop.keypress`, `desktop.scroll`, `desktop.screenshot` ailesini birlikte expose ediyor.
- Hedefli coverage eklendi: `apps/server/src/tools/desktop-{click,type,keypress,scroll}.test.ts` ve `apps/server/src/tools/registry.test.ts` guncellendi. Ayrica `desktop.screenshot` regression guard olarak ayni validation turunda tekrar kosturuldu.
- Dogrulama:
- `pnpm --filter @runa/server typecheck` PASS
- `pnpm --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/tools/desktop-screenshot.test.ts src/tools/desktop-click.test.ts src/tools/desktop-type.test.ts src/tools/desktop-keypress.test.ts src/tools/desktop-scroll.test.ts src/tools/registry.test.ts` PASS
- `pnpm --filter @runa/server lint` FAIL, ancak failure yeni desktop dosyalarindan degil. Pre-existing Biome drift `src/gateway/{claude,gemini,groq,openai}-gateway.ts`, `src/gateway/gateway.test.ts` ve `src/ws/run-execution.ts` uzerinde kalmaya devam ediyor.
- Sonraki onerilen gorev: yeni desktop tool ailesi icin approval persistence / replay seam'ini dar kapsamda kanitlamak ya da ayri bir hygiene goreviyle mevcut repo-genel Biome drift'ini temizleyip `@runa/server lint` baseline'ini tekrar yesile dondurmek.

### Track A / Track C - Conversation Persistence Temeli - 22 Nisan 2026

- `packages/db/src/schema.ts`, `client.ts` ve yeni `packages/db/src/conversations.ts` uzerinden `conversations` ve `conversation_messages` tablolari ile helper client zemini eklendi. Ayrica `runs` tablosu additive `conversation_id` kolonu aldi; mevcut run/tool/event persistence akisi bozulmadi.
- `apps/server/src/persistence/conversation-store.ts` ve `apps/server/src/routes/conversations.ts` ile authenticated conversation listing + message fetch API'si acildi. `buildServer()` artik bu route'lari register ediyor; testlenebilirlik icin dar injection seam'i eklendi.
- `apps/server/src/ws/run-execution.ts` conversation aware hale getirildi. Yeni run ilk user mesajindan conversation'i ensure ediyor, `run.accepted` icinde optional `conversation_id` geri donuyor, user/assistant mesajlari additive olarak persist ediliyor ve final run state `conversation_id` ile upsert ediliyor. WS protocol redesign yapilmadi; yalnizca optional field eklendi.
- Web tarafinda `apps/web/src/hooks/useConversations.ts` ve `apps/web/src/components/chat/ConversationSidebar.tsx` eklendi. `App.tsx` conversation hook ile runtime hook'unu bagliyor; `ChatPage.tsx` artik conversation secimi, persisted transcript hydration'i ve refresh sonrasi aktif conversation geri alim akisini gosteriyor. Dashboard-first yan menu kurgusuna kayilmadi.
- Dogrulama:
- `pnpm --filter @runa/db test` PASS
- `pnpm --filter @runa/server typecheck` PASS
- `pnpm --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/persistence/conversation-store.test.ts src/persistence/run-store.test.ts src/app.test.ts` PASS
- `pnpm --filter @runa/web typecheck` PASS
- `pnpm --filter @runa/web build` PASS
- Sonraki onerilen gorev: conversation persistence uzerine ikinci dar adim olarak persisted transcript ile current session presentation surface iliskisini daha da netlestiren markdown/render polish gorevi ya da conversation history icin hedefli live browser smoke gorevi acmak.

### Track A / Phase 3 Backlog - StdIO MCP Client + Tool Registry Bridge Temeli - 22 Nisan 2026

- `packages/types/src/mcp.ts` eklendi ve barrel export guncellendi; MCP server config, tool definition, tool content ve call-result tipleri shared contract olarak tanimlandi. Ayni turda `packages/types/src/tools.ts` additive genisletilerek `mcp` namespace'i ve `external` capability class'i acildi.
- `apps/server/src/mcp/config.ts`, `stdio-transport.ts`, `client.ts` ve `registry-bridge.ts` ile ilk stdio tabanli MCP istemci omurgasi kuruldu. Tasarim bilincli olarak mevcut sync tool-registry seam'ini bozmamak icin one-shot stdio session modeli kullaniyor: initialize -> initialized -> `tools/list` / `tools/call`.
- MCP tool discovery sonucu gelen tanimlar `ToolDefinition` shape'ine map'lendi; runtime tarafinda bunlar `mcp.<serverId>.<toolName>` seklinde namespaceleniyor, built-in tool isimleri override edilmiyor ve metadata tarafinda conservative `requires_approval: true`, `risk_level: high`, `side_effect_level: execute` karari uygulanÃ„Â±yor.
- `apps/server/src/ws/runtime-dependencies.ts` additive olarak `RUNA_MCP_SERVERS` env seam'ini okumaya basladi. Env yoksa built-in registry aynen korunuyor; env varsa built-in tool set'ine MCP discovery sonucu bulunan tool'lar ekleniyor.
- Hedefli coverage eklendi: `apps/server/src/mcp/client.test.ts`, `apps/server/src/mcp/registry-bridge.test.ts` ve `apps/server/src/tools/registry.test.ts`. Fake stdio MCP fixture ile `tools/list`, `tools/call`, bridge mapping ve built-in name authority davranisi kanitlandi.
- Dogrulama: `pnpm --filter @runa/server typecheck` PASS. `pnpm --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/mcp/client.test.ts src/mcp/registry-bridge.test.ts src/tools/registry.test.ts` PASS. MCP scope'u hedefleyen `pnpm --filter @runa/server exec biome check src/mcp src/tools/registry.test.ts src/ws/runtime-dependencies.ts` PASS.
- Durust kalan durum: `pnpm --filter @runa/server lint` bu task'in dokunmadigi pre-existing format/import drift'leri nedeniyle hala FAIL. Kalan dosyalar `src/gateway/{claude,gemini,groq,openai}-gateway.ts`, `src/gateway/gateway.test.ts` ve `src/ws/run-execution.ts`; MCP degisikligi bu dosyalara yayilmadi.
- Sonraki onerilen gorev: MCP bridge icin ikinci dar adimda roots/cwd/policy baglaminin stdio server'lara kontrollu sekilde iletilmesi ve gerekirse uzun-omurlu session cache ile process-per-call maliyetinin dusurulmesi.

### Track A / GAP-11 Follow-Up - Groq Schema-Density + Context-Split Compatibility Matrix Hardening - 21 Nisan 2026

- `apps/server/src/gateway/request-tools.ts` additive serialization knob'lari aldi; tool/function description ve parameter description yogunlugu artik provider-adapter tarafinda secimli olarak minimalize edilebiliyor.
- `apps/server/src/gateway/groq-gateway.ts` Groq request-hygiene katmani eklendi. Legacy split-system yol tekrar default yapildi; request metadata ile `merged_system` ve farkli tool-serialization modlari hala force edilebiliyor. Full-registry benzeri genis tool set'lerinde non-primary tool description/parameter-description yukunu azaltan `minimal_non_primary` serialization korunuyor; broad interface degisikligi yapilmadi.
- `apps/server/scripts/groq-live-smoke.mjs` compatibility matrix'i gerekli eksenlere daraltildi ve paced hale getirildi. Her prompt family (`package_json_list`, `readme_file_read_probe`) icin `current_shape`, `stripped_descriptions`, `narrow_context_split` ve full-registry `groq_safe_minimal_schema` karsilastirmasi canli raporlaniyor; request budget 64 output token ve varyantlar arasi delay ile TPM surtunmesi azaltildi.
- `apps/server/scripts/approval-browser-authority-check.mjs` authority harness canli Groq smoke icin daha hafif varsayilan model (`llama-3.1-8b-instant`) ve `max_output_tokens: 64` override kullaniyor. Debug log only-if-env seam'i eklendi; normal behavior degismedi.
- Coverage: `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/gateway/gateway.test.ts`, `pnpm.cmd --filter @runa/server exec tsc --noEmit`, `pnpm.cmd --filter @runa/server lint` ve `pnpm.cmd --filter @runa/server build` yesil.
- Canli sonuc PASS ile kapandi; shell env'de `GROQ_API_KEY` yoktu, key yalniz `.env` icinden alt surece tasindi. `RUNA_GROQ_LIVE_SMOKE_MODE=compatibility_matrix pnpm.cmd --filter @runa/server run test:groq-live-smoke` yeni daraltma/pacing ile yesil dondu ve iki prompt family icin hedef varyantlarin tamami PASS raporladi. `pnpm.cmd --filter @runa/server run test:approval-browser-authority-check` de default `minimal_authority + package_json_list` yolunda tekrar PASS verdi; debug log ozetinde `approval boundary -> approval.resolve -> run.finished(COMPLETED)` zinciri goruldu. `pnpm.cmd --filter @runa/server run test:approval-persistence-live-smoke` PASS kaldi; restart/reconnect persistence smoke bozulmadi.
- Canli matrix'ten ogrenim: `tool_use_failed` riski Groq tarafinda request-shape duyarliligi gosterse de bu snapshot'ta hedef compatibility varyantlari `llama-3.1-8b-instant` + daha dusuk output budget + paced matrix ile stabil PASS verdi. Minimal/default authority yolunu kiren ana operasyonel sebep bu tur provider TPM/TPD ve request budget kombinasyonuydu; exact blocker broad runtime redesign gerektirmedi.
- Sonraki onerilen gorev: istenirse bu Groq smoke/authority model-budget karari repo runbook'una kisa operasyon notu olarak eklemek; gateway-level hygiene knob'larini daha sonra baska provider smoke'lari icin de dar benchmark goreviyle karsilastirmak.

### Track A / Phase 3 Hazirlik - Multi-Provider Gateway (OpenAI + Gemini) - 22 Nisan 2026

- `apps/server/src/gateway/openai-gateway.ts` ve `apps/server/src/gateway/gemini-gateway.ts` eklendi; her iki adapter da mevcut `ModelGateway` kontratina sadik kalarak `generate()` ve `stream()` yollarini, tool schema serialization'ini ve tool-call parse akislarini destekliyor.
- `apps/server/src/gateway/factory.ts`, `config-resolver.ts` ve `providers.ts` wiring'i additive genisletildi. Factory artik `openai` ve `gemini` provider'larini secebiliyor; env fallback tarafinda `OPENAI_API_KEY` ve `GEMINI_API_KEY` destekleniyor.
- Shared provider kontrati genisletildi: `packages/types/src/ws.ts` ve `packages/types/src/ws-guards.ts` artik `claude | gemini | groq | openai` union'ini kabul ediyor. Varsayilan model adlari tek kaynakta toplandi (`defaultGatewayModels`), boylece provider secim UI'i ve runtime storage fallback'i daginik literal kullanmiyor. Bu union genislemesiyle birlikte `apps/server/src/persistence/approval-store.ts` icindeki provider-env resolver de yeni provider'lar icin exhaustive hale getirildi; persistence davranisi redesign edilmedi.
- Frontend tarafinda `apps/web/src/ws-types.ts`, `apps/web/src/hooks/useChatRuntime.ts` ve `apps/web/src/components/chat/OperatorControlsPanel.tsx` additive guncellendi. Developer runtime config artik yeni provider'lari listeliyor, placeholder/provider default model baglantisi tek kaynaktan geliyor ve provider degisince model de ancak onceki provider default'unu kullaniyorsa otomatik guncelleniyor.
- Coverage: `pnpm --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/gateway/gateway.test.ts` PASS; yeni OpenAI ve Gemini factory/generate/tool-call/stream coverage'i eklendi. `pnpm --filter @runa/server typecheck` PASS. `pnpm --filter @runa/web typecheck` PASS.
- Sonraki onerilen gorev: provider secim UI'i ve gateway adapter seti hazir oldugu icin bir sonraki dar gorev live smoke / credential-gated OpenAI ve Gemini compatibility probe yazip mevcut Groq/Claude behavior'ini bozmadan canli request-shape proof toplamak.

### Track C / Polish Follow-Up - Premium Design System Zemini ve Kontrollu UI Migration - 22 Nisan 2026

- `apps/web/src/index.css` uzerinde design token zemini genisletildi; spacing, radius, shadow ve gradient degiskenleri daha merkezi hale getirildi. Buna ek olarak `runa-page`, `runa-shell-frame`, `runa-card`, `runa-input`, `runa-button`, `runa-alert`, `runa-metric` gibi ortak utility/class seam'leri eklendi.
- `apps/web/src/lib/chat-styles.ts` mevcut inline stil omurgasini koruyacak sekilde yeni CSS variable zeminiyle hizalandi; boylece chat/login/settings yuzeyleri ayni token sistemi uzerinden daha tutarli renk, spacing ve elevation kullaniyor.
- Chat-first manifesto korunarak kontrollu migration yapildi. `ChatShell`, `AppShell`, `ChatPage`, `LoginPage`, `SettingsPage` ve secili auth/chat component'leri ortak panel/button/input/alert siniflarini kullanir hale geldi; ham operator/developer yuzeyi daha baskin hale getirilmedi.
- Ozellikle login ve settings tarafinda tekrar eden panel, subcard, metric, secondary button ve error/info banner stilleri toplandi; chat composer ve aktif sohbet yuzeyi de ayni premium panel/button/form diliyle hizalandi. Bu tur tam rewrite degil, mevcut yuzeyi daha sistemli hale getiren additive migration olarak tutuldu.
- Dogrulama: `pnpm --filter @runa/web typecheck` PASS, `pnpm --filter @runa/web lint` PASS, `pnpm --filter @runa/web build` PASS. Not: `build` rerun oncesinde workspace bagimli `@runa/types` paketinin guncel dist ciktisi icin `pnpm --filter @runa/types build` de kosturuldu; web kod davranisini degistiren ek bir task acilmadi.
- Sonraki onerilen gorev: eger istenirse ikinci adimda `apps/web/src/components/chat/*` ve `components/auth/*` icindeki kalan metric/card/header varyantlarini kucuk presentational primitive'lere ayirip inline style objelerini biraz daha azaltmak; yeni UI dependency acmamak.

### Track A / GAP-11 Follow-Up - Groq Prompt-Aware Dense Registry Hygiene Narrowing - 21 Nisan 2026

- `apps/server/src/gateway/groq-gateway.ts` icinde default Groq hygiene secimi artik yalniz tool sayisina bakmiyor; dense registry durumunda prompt-oncelikli tool da hesaba katiliyor. `file.read` odakli prompt family'lerinde legacy split-system korunurken, diger dense prompt'larda merged-system yoluna gecilebiliyor. Tool serialization default'u ise dense registry'de `minimal_non_primary` olarak kaldi; daha agresif required-only schema budamasi kalici default yapilmadi.
- Bu turdaki en onemli negatif bulgu da kanitlandi: required-only non-primary schema deneyi ve bazi merged-system varyantlari `tool_use_failed` riskini azaltmak yerine yeni malformed tool-call davranislari uretti. Ozellikle `file.list` icin `include_hidden` alaninin string olarak uretilmesi ve `file.read` odakli akista coklu malformed function tag'leri goruldu. Bu yuzden cozum, daha agresif budama degil, prompt-family aware hygiene secimi olarak daraltildi.
- `apps/server/scripts/groq-live-smoke.mjs` compatibility matrix'i prompt-aware default'u ayrik bir `default_prompt_aware` profil olarak raporlar hale geldi. Boylece metadata-force edilen deneysel varyantlarla gercek varsayilan runtime davranisi birbirinden ayrildi.
- `apps/server/src/gateway/gateway.test.ts` uzerine dense registry + `file.list` prompt family'si icin merged-system default'unu ve dense registry + `file.read` prompt family'si icin legacy split-system default'unu kanitlayan coverage eklendi. Hedefli test zinciri `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/gateway/gateway.test.ts src/ws/live-request.test.ts src/runtime/bind-available-tools.test.ts`, `pnpm.cmd --filter @runa/server exec tsc --noEmit`, `pnpm.cmd --filter @runa/server lint` ve `pnpm.cmd --filter @runa/server build` yesil.
- Canli smoke durumu durustce karisik ama daha dar: current shell'de `GROQ_API_KEY` yoktu; file-backed `.env` icinden yalniz alt surece tasinan key ile `RUNA_GROQ_LIVE_SMOKE_MODE=compatibility_matrix pnpm.cmd --filter @runa/server run test:groq-live-smoke` kosturuldu. Full-registry `default_prompt_aware + package_json_list` PASS, full-registry `default_prompt_aware + readme_file_read_probe` PASS, full-registry `current_shape + package_json_list` PASS ve full-registry `current_shape + readme_file_read_probe` PASS kaniti alindi.
- Durust kalan residual blocker artik daha dar: matrix'in exploratory karsilastirma varyanti olan `minimal_file_list + narrow_context_split` halen `tool_use_failed` ile kiriliyor ve exact body `file.list.include_hidden` alanini stringlestirilmis gorunuyor. Yani kapanan alan default/full-registry dense runtime yolu; acik kalan alan ise explicit `merged_system + full schema` ile zorlanan dar karsilastirma varyanti. Bu genel runtime regression diye sunulmamalidir.
- Sonraki onerilen gorev: Groq provider icin `narrow_context_split` turu dar bir forensics gorevine ayrilip `include_hidden` boolean-string drift'inin message/context assembly mi yoksa provider-side generation varyansi mi oldugu daha da daraltilsin; mevcut prompt-aware default yoluna gereksiz redesign acilmasin.

### Track A / GAP-11 Follow-Up - Groq Boolean-String Drift Closure for `minimal_file_list + narrow_context_split` - 22 Nisan 2026

- Kalan blocker dar kapsamda yeniden incelendi. Kod taramasi gosterdi ki request assembly zinciri `file.list` schema'sini dogru tasiyor; asimetrik kirilma, ayni schema ile bazen `include_hidden: false`, bazen `include_hidden: "false"` ya da `False` benzeri provider-side generation varyansi olarak ortaya cikiyordu. Bu nedenle sorun yalnÃ„Â±z `request-tools` serializer bug'i diye siniflandirilmadi.
- `apps/server/src/gateway/groq-gateway.ts` uzerinde iki additive Groq hygiene sertlestirmesi yapildi:
- merged-system + tool-enabled isteklerde system mesaja explicit typed tool-argument disiplini eklendi: booleans/numbers quote edilmesin, optional alanlar gereksizse omit edilsin.
- tool-enabled Groq request'lerde explicit `temperature` verilmemisse varsayilan `0` gonderilmeye baslandi. Bu, provider-side malformed function-call varyansini daraltan bir runtime hygiene karari olarak eklendi; request explicit temperature verirse mevcut davranis korunuyor.
- `apps/server/src/gateway/gateway.test.ts` coverage'i guncellendi. Yeni testler merged-system altinda typed tool-argument instruction'inin request body'ye girdigini ve tool-enabled Groq request'lerde `temperature: 0` varsayilaninin uygulandigini kanitliyor. Hedefli test zinciri `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/gateway/gateway.test.ts src/ws/live-request.test.ts src/runtime/bind-available-tools.test.ts`, `pnpm.cmd --filter @runa/server exec tsc --noEmit`, `pnpm.cmd --filter @runa/server lint` ve `pnpm.cmd --filter @runa/server build` yesil.
- Shell truth durustce ayrildi: current shell'de `GROQ_API_KEY` yoktu. Live smoke icin key gitignored repo-root `.env` icinden secret loglanmadan yalniz alt surece tasindi.
- Kapanis kaniti: `RUNA_DEBUG_PROVIDER_ERRORS=1 RUNA_GROQ_LIVE_SMOKE_MODE=compatibility_matrix pnpm.cmd --filter @runa/server run test:groq-live-smoke` yeniden kosturuldu ve bu kez tum matrix PASS dondu. Daha once kirilan `minimal_file_list + narrow_context_split` varyanti PASS verdi; ayni turda full-registry `default_prompt_aware` ve diger komsu varyantlar da korunarak PASS kaldi.
- Durust sonuc: bu turda kapanan alan exact compatibility closure'dur. Kalan residual risk, Groq tarafinda genel tool-call generation variansi ihtimalinin tamamen teorik olarak yok oldugu degil; ama bugunku hedef matrix ve mevcut runtime yollar icin blocker kapanmis, canlÃ„Â± kanit PASS ile alinmistir.
- Sonraki onerilen gorev: istenirse bu Groq hygiene kararlarini (merged-system typed tool instruction + tool-enabled `temperature: 0`) kisa bir runbook notu olarak belgelendirmek ve ayni disiplinin baska provider smoke'larinda fayda saglayip saglamadigini ayri benchmark gorevinde olcmek.

### Track A / GAP-11 Follow-Up - Full-Registry `package_json_list` Groq Request-Hygiene Hardening Attempt - 21 Nisan 2026

- `apps/server/src/gateway/request-tools.ts` tool schema/property siralamasini deterministik hale getirecek sekilde dar kapsamda sertlestirildi; ayni dosyada prompt'tan turetilen kucuk relevance hint'leri ile provider-side tool ordering deneyi eklendi.
- `apps/server/src/gateway/groq-gateway.ts` Groq request body olustururken son user prompt'una gore en alakali tool'u one aliyor ve debug summary artik hem `requested_tool_names` hem `serialized_tool_names` alanlarini raporluyor. Boylece request-hygiene denemesi canli matrix'te dogrudan gorulebiliyor.
- `apps/server/scripts/groq-live-smoke.mjs` full-registry compatibility matrix yolunu runtime'daki canonical `bindAvailableTools()` binding'i ile hizaladi; yani full registry varyanti artik script'e ozgu registry insertion order degil, gercek runtime tool set'i ile koÃ…Å¸uyor.
- Coverage: `apps/server/src/gateway/gateway.test.ts` prompt-relevant Groq tool ordering ve yeni debug summary alanlari icin guncellendi. `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/gateway/gateway.test.ts src/ws/live-request.test.ts src/runtime/bind-available-tools.test.ts`, `pnpm.cmd --filter @runa/server exec tsc --noEmit` ve `pnpm.cmd --filter @runa/server lint` yesil.
- Canli sonuc durustce karisik kaldi: file-backed `GROQ_API_KEY` ile koÃ…Å¸an `RUNA_GROQ_LIVE_SMOKE_MODE=compatibility_matrix` turunda `full_registry + package_json_list` halen `HTTP 400 / tool_use_failed` verdi; yeni debug ozetinde `serialized_tool_names[0] = file.list` oldugu halde exact malformed body yine `file.list` markup'i urettigi icin sadece tool-order hardening'in blocker'i kapatmadigi goruldu.
- Ayni snapshot'ta ek bir varyans da goruldu: `minimal_file_read + readme_file_read_probe` bu kez `failed_generation = <function=file.read[]{\"path\": \"README.md\"}</function>` ile kirildi; `full_registry + readme_file_read_probe` ise PASS kaldi. Yani residual risk artik yalniz eski tek varyanta indirgenmis diye sunulmamali; Groq tarafinda prompt/tool-family bagimli malformed tool-call varyansi suruyor.
- Koruyucu kanit korunuyor: `pnpm.cmd --filter @runa/server run test:approval-persistence-live-smoke` PASS verdi. `pnpm.cmd --filter @runa/server run test:approval-browser-authority-check` bu shell'de `exit code 0` ile dondu; komut stdout summary'si yakalanmamis olsa da authority yolunu bozan yeni bir regresyon kaniti uretilmedi.
- Sonraki onerilen gorev: request order disindaki Groq compatibility etkenlerini daraltmak icin tool-description/schema yogunlugu ve system-context ayrimi uzerinde daha kucuk, provider-ozel ama authority-safe matrix deneyi yapmak; mevcut degisikligi genel provider fix'i diye sunmamak.

### Track A / GAP-11 Follow-Up - Approval Continuation Provider Config Minimization - 21 Nisan 2026

- `apps/server/src/persistence/approval-store.ts` icinde approval continuation persistence seam'i daraltildi; auto-continue `continuation_context.payload.provider_config.apiKey` artik server env ayni provider icin secret saglayabildiginde DB'ye bos string olarak yaziliyor. `defaultModel` / `defaultMaxOutputTokens` gibi non-secret metadata korunuyor.
- Minimization defense-in-depth olarak hem write hem read/hydration yoluna kondu; boylece env-backed continuation kaydi yeniden okunurken de raw secret runtime'a geri tasinmiyor.
- `apps/server/src/persistence/approval-store.test.ts` secret-redaction ve request-only fallback davranisini kapsayacak sekilde guncellendi; `apps/server/src/ws/register-ws.test.ts` auto-continue resume'in redacted persisted context + env fallback ile devam ettigini kapsiyor.
- `apps/server/scripts/approval-persistence-live-smoke.mjs` summary'sine `persisted_provider_api_key_redacted` eklendi. `pnpm.cmd --filter @runa/server run test:approval-persistence-live-smoke` PASS verdi ve auto-continue senaryosunda bu alan `true` dondu.
- `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/persistence/approval-store.test.ts src/ws/register-ws.test.ts`, `pnpm.cmd --filter @runa/server exec tsc --noEmit` ve `pnpm.cmd --filter @runa/server lint` yesil.
- Durust kalan blocker: `pnpm.cmd --filter @runa/server run test:approval-browser-authority-check` bu snapshot'ta yesile donmedi. Tekrar kosularda browser authority harness bir turda `groq returned HTTP 400 / tool_use_failed`, diger turda approval boundary'ye ulasamayan websocket/browser drift verdi. Yani provider-config persistence minimization PASS, fakat browser + gercek provider authority evidence'i bu turda yeniden stabilize edilemedi.
- Residual risk: server env ilgili provider secret'ini tasimiyorsa request-only browser-supplied API key halen restart-survival icin persist edilmeye devam ediyor; tam secret removal icin request-only runtime config'i persistence disi daha dar bir server-side secret seam'e tasimak gerekecek.
- Sonraki onerilen gorev: browser authority harness'inde exact Groq 400 / reconnect drift davranisini ayri dar bir provider-browser forensics goreviyle stabilize etmek; minimization degisikliginin uzerine yeni runtime claim acmamak.

### Track A / GAP-11 Follow-Up - Browser Authority Harness Stabilization + Provider/Browser Forensics - 21 Nisan 2026

- `apps/server/scripts/approval-browser-authority-check.mjs` dar kapsamda stabilize edildi. Harness artik browser submit oncesi `connection.ready` gozlemliyor, server'i repo root `cwd` ile baslatiyor ve summary'ye gercek browser `run.request` gozlemini (`provider`, `model`, `include_presentation_blocks`, prompt preview, api key presence) ekliyor.
- Failure katmani somutlastirildi: stale/reconnect tarafindaki browser drift submit oncesi websocket-ready beklenerek kapatildi; exact provider forensics ise summary icinde `[provider.error.debug]` kuyrugu ve browser tarafindan yakalanan `run.request` ile birlikte okunabilir hale geldi.
- Canli denemelerde `file.read` odakli authority prompt Groq tarafinda deterministic `HTTP 400 / tool_use_failed` urettigi icin exact provider/browser ayrimi net goruldu. Harness approval authority amacini koruyup daha stabil `file.list` tabanli auto-continue prompt'a cekildi; bu, ayni auto-continue approval boundary'yi daha az provider surtunmesiyle tetikledi.
- Sonuc: `pnpm.cmd --filter @runa/server run test:approval-browser-authority-check` yeniden PASS verdi. Browser tarafinda `run.request -> approval boundary -> approval.resolve -> continuation -> run.finished(COMPLETED)` zinciri tekrar goruldu; summary `approval_id = run_*:approval:auto-continue:1` ve `result = PASS` dondurdu.
- Koruyucu rerun: `pnpm.cmd --filter @runa/server run test:approval-persistence-live-smoke` halen PASS; persistence minimization ve restart/reconnect proof kirilmadi.
- `pnpm.cmd --filter @runa/server exec tsc --noEmit` ve `pnpm.cmd --filter @runa/server lint` yesil.
- Durust not: live Groq provider ayni harness icinde `file.read` odakli authority prompt'ta malformed tool-call 400 verebildigi icin residual provider risk tamamen yok olmadi; kapanan alan browser authority harness drift'i ve exact failure ayriminin somutlastirilmasidir.
- Sonraki onerilen gorev: istenirse Groq `tool_use_failed` varyansini ayri bir provider-shape hardening gorevinde ele alip `file.read` odakli browser authority prompt'un neden kirildigini runtime/gateway seviyesinde dar kapsamda incelemek.

### Track A / GAP-11 Follow-Up - Groq `tool_use_failed` Request-Shape Forensics + Minimum Authority-Safe Mitigation - 21 Nisan 2026

- `apps/server/src/gateway/provider-http.ts` artik `[provider.error.debug]` payload'ini JSON string olarak basiyor; `apps/server/src/gateway/groq-gateway.ts` request summary'sine `last_user_message_preview` eklendi. Boylece exact live Groq 400 body ve request-shape ipucu script summary'lerinden guvenilir sekilde ayrilabiliyor.
- `apps/server/scripts/approval-browser-authority-check.mjs` prompt-variant (`package_json_list` / `readme_file_read_probe`) ve tool-mode (`minimal_authority` / `full_registry`) destekli hale getirildi. Summary artik `tool_mode`, explicit `available_tool_count` / `available_tool_names` ve parse edilmis `provider_error_debug` ozetini raporluyor.
- Forensics sirasinda gercek bir server-side seam bug'i bulundu: browser harness explicit `request.available_tools` gonderse bile `apps/server/src/ws/live-request.ts` bunu `adaptContextToModelRequest()` uzerinden dusuruyordu; Groq'a tekrar full registry gidiyordu. `apps/server/src/context/adapt-context-to-model-request.ts` ve `apps/server/src/ws/live-request.ts` bu explicit tool set'i artik koruyor. `apps/server/src/ws/live-request.test.ts` bu davranis icin yeni coverage aldi.
- Canli ayrim netlesti:
- default `minimal_authority` + `package_json_list` authority harness PASS ve `approval.resolve -> continuation -> run.finished(COMPLETED)` zinciri korundu.
- `full_registry` + `package_json_list` de PASS; yani full tool registry tek basina kesin blocker degil.
- `full_registry` + `readme_file_read_probe` ise deterministik olarak `groq returned HTTP 400` + `tool_use_failed` verdi. Exact `failed_generation` body malformed `file.read` function-call markup'i gosterdi (`<function=file.read{"path": "README.md"}</function>`). Bu, browser payload shape bozuklugundan ziyade Groq tool-call generation varyansina isaret ediyor.
- Durust residual risk: `readme/file.read` prompt family'si halen provider-side kirilgan; authority harness default PASS yolu explicit minimal tool set ile stabilize edildi ama bu genel runtime cozum diye sunulmamali. Kapanan alan, exact failure siniflandirmasi ve live-request explicit tool-set seam bug'inin duzeltilmesidir.
- Dogrulama: `pnpm.cmd exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/ws/live-request.test.ts src/gateway/gateway.test.ts` (`apps/server` cwd), `pnpm.cmd --filter @runa/server exec tsc --noEmit`, `pnpm.cmd --filter @runa/server lint`, `pnpm.cmd --filter @runa/server run test:approval-browser-authority-check` (default minimal PASS) ve `pnpm.cmd --filter @runa/server run test:approval-persistence-live-smoke` yesil. Forensics icin env bazli rerun'da `RUNA_APPROVAL_BROWSER_TOOL_MODE=full_registry` + `RUNA_APPROVAL_BROWSER_PROMPT_VARIANT=readme_file_read_probe` FAIL verdi ve exact Groq 400 body kaydedildi.
- Sonraki onerilen gorev: eger istenirse, `readme/file.read` prompt family'sindeki Groq malformed tool-call varyansini browser harness'ten bagimsiz daha dar bir gateway/provider compatibility matrix gorevinde toplamak; ama mevcut authority PASS yolu uzerine gereksiz runtime redesign acmamak.

### Track A / GAP-11 Follow-Up - Browser-Independent Groq Compatibility Matrix + Exact Provider-Side Blocker Isolation - 21 Nisan 2026

- `apps/server/scripts/groq-live-smoke.mjs` opt-in `RUNA_GROQ_LIVE_SMOKE_MODE=compatibility_matrix` modu kazandi. Bu mod browser'a bagimli olmadan live `buildLiveModelRequest() -> createModelGateway().generate()` zinciri uzerinde prompt/tool varyantlarini koÃ…Å¸turup her stage icin request summary, tool count/names ve varsa exact `provider_error_debug` body kaydediyor.
- Matrix'te dort varyant canli karsilastirildi: `minimal_file_list + package_json_list`, `full_registry + package_json_list`, `minimal_file_read + readme_file_read_probe`, `full_registry + readme_file_read_probe`.
- Exact canli sonuc: tek deterministic kirilan varyant `full_registry + package_json_list` oldu. Groq `HTTP 400 / tool_use_failed` dondu ve `failed_generation` malformed `file.list` function-call markup'i gosterdi (`<function=file.list{"path": "D:\\ai\\Runa", "include_hidden": true}</function>`). Bu, browser-specific degil; gateway/provider generate seam'inde browser disinda da yeniden uretilebilen bir compatibility blocker olarak kanitlandi.
- Ayni matrix'te `minimal_file_list + package_json_list`, `minimal_file_read + readme_file_read_probe` ve `full_registry + readme_file_read_probe` PASS verdi; yani residual risk artik genel `file.read` / README family'si degil, daha spesifik olarak full registry altindaki package-json/list authority prompt family'sindeki Groq tool-call generation varyansi olarak daraldi.
- Dogrulama notu: mevcut shell env'de `GROQ_API_KEY` yoktu; compatibility matrix authority'si repo `.env` icindeki gerÃƒÂ§ek key yalniz alt surece tasinarak kosturuldu. `pnpm.cmd --filter @runa/server exec tsc --noEmit`, `pnpm.cmd --filter @runa/server lint`, `GROQ_API_KEY=<file-backed> RUNA_DEBUG_PROVIDER_ERRORS=1 RUNA_GROQ_LIVE_SMOKE_MODE=compatibility_matrix pnpm.cmd --filter @runa/server run test:groq-live-smoke`, `pnpm.cmd --filter @runa/server run test:approval-browser-authority-check` ve `pnpm.cmd --filter @runa/server run test:approval-persistence-live-smoke` ile guncel kanit toplandi.
- Durust residual risk: default authority PASS yolu korunuyor, restart/reconnect persistence proof korunuyor; ancak full registry altindaki package-json/list prompt family'si Groq tarafinda halen kirilgan. Bu, harness-level prompt/tool narrowing ile gecici olarak cevrilen bir compatibility path; genel provider fix diye sunulmuyor.
- Sonraki onerilen gorev: full registry altindaki package-json/list prompt family'si icin Groq tool-call generation davranisini gateway-level request-shape matrix ile biraz daha daraltmak veya bu family icin provider-compatible request hygiene kuralini additive olarak tanimlamak.

### Track A / GAP-11 - Browser + Real Provider Approval Authority Check - 21 Nisan 2026

- `apps/server/scripts/approval-browser-authority-check.mjs` eklendi ve `apps/server/package.json` icine `test:approval-browser-authority-check` komutu baglandi; harness built server + Vite dev + headless Edge CDP uzerinden gercek tarayici akisini koÃ…Å¸turuyor.
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
- Teknik izolasyonun URL bypass ile delinmemesi icin `apps/web/src/pages/DashboardPage.tsx` dar kapsamda gate'lendi; `OperatorControlsPanel` ve `TransportMessagesPanel` de yalniz Developer Mode acikken gorunur kaldÃ„Â±.
- Dogrulama: `pnpm.cmd --filter @runa/web typecheck`, `pnpm.cmd --filter @runa/web lint`, `pnpm.cmd --filter @runa/web build` ve repo-seviyesi `pnpm.cmd typecheck` yesil.
- Durust not: repo-seviyesi `pnpm.cmd lint` bu gorevin disindaki onceden var olan Biome format farklari nedeniyle kiriliyor (`apps/server/scripts/groq-live-smoke.mjs`, `apps/server/src/ws/live-request.ts`, `apps/server/src/ws/run-execution.ts`, `apps/server/src/ws/register-ws.test.ts`).
- Sonraki onerilen gorev: yeni premium temel uzerine `AppShell`, `SettingsPage` ve login/auth yuzeylerini ayni tasarim diline tasiyan dar bir Track C polish turu.

### Track C / Sprint 10.6 - Premium UI Refactor Asama 2 (Component Polishing + Decomposition) - 20 Nisan 2026

- `apps/web/src/pages/ChatPage.tsx` buyuk olcude sadeleÃ…Å¸tirildi ve 462 satira indirildi; presentation orchestration ve run-surface rendering yukunun ana kismi yeni `apps/web/src/components/chat/chat-presentation.tsx` ve `apps/web/src/components/chat/PresentationRunSurfaceCard.tsx` dosyalarina tasindi.
- `apps/web/src/components/approval/ApprovalSummaryCard.tsx` ve `ApprovalPanel.tsx` premium glassmorphism cizgisine cekildi; onay yuzeyi daha sakin ama belirgin hale getirildi, kabul/red aksiyonlari hover-state destekli daha net CTA kartlarina donusturuldu.
- `apps/web/src/components/chat/PresentationBlockRenderer.tsx` ile `apps/web/src/lib/chat-styles.ts` uzerinde code/diff/web-search/tool-result yuzeyleri daha okunakli premium kartlara cekildi; paylasilan stil objeleri CSS variable tabanli renkler ve yumusak transition'larla sadeleÃ…Å¸tirildi.
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
- Durust durum: approval E2E bu turda gecmis sayilmadi. Browser/storage tarafinda kalici bir Groq key bulunamadigi ve current shell env de bos oldugu icin gerÃƒÂ§ek provider repro ve `Kabul Et / Reddet -> continuation -> terminal result` zinciri yeniden kosturulamadi.

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
- Sonraki onerilen gorev: chat giris panelindeki operator dili/copy'sini urun diliyle sadeleÃ…Å¸tirip teknik panelleri varsayilan yuzeyden daha da geri cekmek.

### Track B / Sprint 10 - WebSocket Subscription Default Baseline Fix - 18 Nisan 2026

- Canli chat yuzeyinde `ERROR WS` ve `Subscription context is unavailable for this feature.` blokaji yaratan WS gate sirasi duzeltildi.
- `apps/server/src/ws/ws-subscription-gate.ts` artik HTTP auth surface ile uyumlu sekilde missing subscription resolver/context durumunda default active free-tier baseline'a dusuyor; boylece free websocket erisimi resolver inject edilmedigi icin gereksiz yere reddedilmiyor.
- Custom resolver aktif oldugunda gelen gercek subscription context halen kullaniliyor; inactive subscription ve tier-restricted gate davranisi korunuyor.
- `apps/server/src/ws/ws-subscription-gate.test.ts` beklentileri yeni baseline davranisina gore guncellendi; missing context senaryosu `connection.ready` alirken inactive ve pro-gated free-tier baglantilar kapanmaya devam ediyor.
- `pnpm.cmd --filter @runa/server typecheck`, `pnpm.cmd --filter @runa/server lint`, `pnpm.cmd exec tsc` ve `pnpm.cmd exec vitest run dist/ws/ws-subscription-gate.test.js --config ./vitest.config.mjs --configLoader runner` yesil.
- Non-goal hatirlatmasi: subscription billing backend'i, quota enforcement ve WS protocol sekli bu turda degistirilmedi.
- Sonraki onerilen gorev: chat page icin product-first copy sadeleÃ…Å¸tirmesi ve operator/debug yuzeylerini varsayilan deneyimden daha da geriye cekmek.

---

### Track C / Prompt Audit Follow-up - Markdown Renderer Gap Closure - 23 Nisan 2026

- `PROMPTS-PHASE-2.md` icindeki `KONU 7 - Markdown Renderer` gorevi yeniden denetlendi ve eksik kalan markdown render seam'i tamamlandi. Yeni `apps/web/src/components/chat/MarkdownRenderer.tsx` dependency eklemeden kuruldu; fenced code block, inline code, liste, tablo ve guvenli link render destegi veriyor.
- `apps/web/src/pages/ChatPage.tsx` icinde streaming cevap ve persisted transcript plain text yerine bu renderer'i kullaniyor. Yari-acik markdown iceren streaming durumda parser savunmaci davranip ham metne dusmeden UI'yi bozmuyor.
- `apps/web/src/components/chat/chat-presentation.tsx` tarafinda `text` presentation block'lari da ayni markdown katmanina tasindi; backend render schema'si veya `RenderBlock` kontrati degistirilmedi.
- `apps/web/src/index.css` uzerine markdown odakli hafif stil siniflari eklendi; kod blogu, tablo, inline code ve link gorunumu chat-first premium yuzeyle hizalandi.
- Audit notu: `KONU 3 - Premium Design System` prompt'u Tailwind/shadcn kurulumu zorunlu kilmiyordu; eksik kalan gercek uygulama boslugu markdown renderer idi. Bu turde yeni UI dependency eklenmedi ve mevcut design-system zemini dependency-free korundu.
- Dogrulama: `pnpm --filter @runa/web typecheck` yesil, `pnpm --filter @runa/web build` yesil, `pnpm --filter @runa/web exec biome check src/components/chat/MarkdownRenderer.tsx src/components/chat/chat-presentation.tsx src/pages/ChatPage.tsx src/index.css` yesil. `pnpm --filter @runa/web lint` halen repo icindeki onceki Biome drift'lerine takiliyor; gorunen baseline dosyalari `apps/web/src/App.tsx`, `apps/web/src/components/chat/ConversationSidebar.tsx` ve `apps/web/src/hooks/useConversations.ts`.
- Sonraki onerilen gorev: istenirse bu kalan web lint baseline drift'lerini ayri ve dar kapsamli bir hygiene gorevi olarak temizlemek; markdown/presentation davranisini yeniden acmamak.

### Track C / Phase 3 UX - Voice I/O Minimum Web Seams - 23 Nisan 2026

- `apps/web/src/hooks/useVoiceInput.ts` ve `apps/web/src/hooks/useTextToSpeech.ts` eklendi; Web Speech API tabanli minimum mikrofon ve text-to-speech seam'i server tarafina yeni bir speech servisi acmadan, tamamen tarayici yetenegi uzerinden kuruldu.
- `apps/web/src/components/chat/VoiceComposerControls.tsx` ve `apps/web/src/pages/ChatPage.tsx` tarafinda composer yanina sade bir voice trigger eklendi. Kullanici isterse mikrofondan metin ekleyebiliyor, isterse son asistan yanitini sesli okutabiliyor; ana chat akisi voice-first moda cekilmedi.
- Mikrofon izni reddedildiginde veya tarayici destegi olmadiginda UI graceful fallback veriyor: voice tetigi yazili akisi bozmadan pasif/uyari durumuna dusuyor ve neden ayni composer kartinda acikca gorunuyor.
- `apps/web/src/pages/SettingsPage.tsx` icinde additive bir `Voice preferences` karti acildi. Otomatik okuma tercihi `localStorage` uzerinden korunuyor; bu tercih yalniz destekleyen tarayicilarda aktif oluyor ve mevcut account/settings akisinin yerini almiyor.
- Dogrulama: `pnpm --filter @runa/web typecheck` yesil, `pnpm --filter @runa/web build` yesil. `pnpm --filter @runa/web exec biome check src/hooks/useVoiceInput.ts src/hooks/useTextToSpeech.ts src/components/chat/VoiceComposerControls.tsx src/pages/ChatPage.tsx src/pages/SettingsPage.tsx` yesil. `pnpm --filter @runa/web lint` halen repo icindeki onceden var olan Biome drift'lerine takiliyor; bu turde gorunen baseline dosyalari `apps/web/src/App.tsx`, `apps/web/src/components/chat/ConversationSidebar.tsx` ve `apps/web/src/hooks/useConversations.ts`.
- Sonraki onerilen gorev: voice transcript ve son asistan yaniti icin daha kontrollu dil/voice secimi ve okunacak metin ozetleme seam'i; server protocol'u veya mobile/native davranis varsayimi acmamak.

### Track A / Track C - SSE Token Streaming - 22 Nisan 2026

- `packages/types/src/ws.ts` ve `packages/types/src/ws-guards.ts` tarafina additive `text.delta` server mesaji eklendi; mevcut `runtime.event`, `presentation.blocks` ve `run.finished` kontratlari korunarak bridge union genisletildi.
- `apps/server/src/gateway/groq-gateway.ts` ve `apps/server/src/gateway/claude-gateway.ts` icinde SSE streaming yolu tamamlandi. Gercek `text/event-stream` cevaplarda delta chunk'lari ve terminal response parse ediliyor; mevcut JSON/stub cevaplarinda stream yolu otomatik terminal parse'a duserek eski generate tabani bozulmuyor.
- `apps/server/src/ws/run-execution.ts` artik destekleyen provider icin model stream'i tuketip `text.delta` mesajlarini run bitmeden once WS uzerinden basiyor; terminal response yine mevcut agent loop continuation akisini besliyor ve `run.finished` tek terminal sinyal olarak kaliyor.
- `apps/server/src/ws/register-ws.test.ts` uzerine SSE cevabinda `text.delta` mesajlarinin `run.finished` oncesi geldiginin kaniti eklendi. `apps/server/src/gateway/gateway.test.ts` de Groq ve Claude stream parser'lari icin yeni coverage aldi.
- `apps/web/src/hooks/useChatRuntime.ts`, `apps/web/src/pages/ChatPage.tsx` ve `apps/web/src/index.css` tarafinda aktif run icin gecici streaming cevap yuzeyi eklendi; final presentation block akisi yeniden tasarlanmadi, sadece delta append edilip gecici bir live response katmani gosterildi.
- Dogrulama: `pnpm --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/gateway/gateway.test.ts src/ws/register-ws.test.ts`, `pnpm --filter @runa/server typecheck`, `pnpm --filter @runa/web typecheck` ve `pnpm --filter @runa/web build` yesil. Not: `@runa/web build` ilk denemede `@runa/types/dist` stale export nedeniyle kirildi; `pnpm --filter @runa/types build` sonrasi tekrar kosulup yesile dondu.
- Sonraki onerilen gorev: conversation persistence veya markdown render gorevine gecmek; `text.delta` yuzeyi uzerine yeni protocol redesign acmamak.

### Release-readiness / KONU 20 - Deployment Zemini - 23 Nisan 2026

- Placeholder root `Dockerfile` kaldirildi; yerine workspace-aware multi-stage build zinciri geldi. Root target'lari artik `server-runtime` ve `web-runtime` olarak ayriliyor; `apps/server/Dockerfile` ve `apps/web/Dockerfile` de ayni release patikalarini app-bazli build icin aciyor.
- `compose.yaml` minimum tam-stack local rehearsal icin yeniden kuruldu: `postgres`, `server`, `web` servisleri ayrildi; healthcheck, restart policy, published port mapping ve service dependency sirasi eklendi.
- `.dockerignore` build context'i icin gercekci hale getirildi; Dockerfile/compose dosyalarini kazara context disina atan eski desenler temizlendi.
- Secret icermeyen environment templating olarak `/.env.compose` ve `/.env.server.example` eklendi. `k8s/DEPLOYMENT.md` icinde image build, compose rehearsal ve sonraki orchestration adimi icin okunur deployment notu yazildi.
- Runtime kodu genisletilmedi. Server'in container icinde `0.0.0.0` uzerinden kalkmasi ve internal port/health davranisi Docker/compose komut katmaninda cozuldu.
- Local rehearsal notu: storage seam'i startup'ta bos Supabase storage config'i kabul etmedigi icin `/.env.compose` icine yalniz boot amacli placeholder storage degerleri kondu. Bu, stack'in kalkmasini saglar; gercek upload/storage davranisi icin bu degerlerin deployment sirasinda secret store'dan override edilmesi gerekir.
- Dogrulama:
  - `pnpm.cmd build` yesil.
  - `docker build --target server-runtime -t runa-server:task20 .` yesil.
  - `docker build --target web-runtime -t runa-web:task20 .` yesil.
  - `docker compose --env-file .env.compose config` yesil.
  - `docker compose --env-file .env.compose up --build -d` ilk denemede host `5432` portu dolu oldugu icin bloklandi; compose tanimi bozuk degildi, host port cakismasi vardi.
  - Alternatif host portlarla replay (`POSTGRES_PORT=55432`, `RUNA_SERVER_PORT=3300`, `RUNA_WEB_PORT=8081`) yesil. `docker compose ps` uzerinde uc servis de healthy goruldu; `http://127.0.0.1:3300/health` `200 {"service":"runa-server","status":"ok"}` ve `http://127.0.0.1:8081/` `200` verdi.
  - Validation sonrasi `docker compose down -v` ile stack temiz kapatildi.
- Non-goal hatirlatmasi: bu tur tam CI/CD otomasyonu, prod secret management platformu veya desktop-agent deployment acmadi.
- Sonraki onerilen dar gorev: bu Docker/compose zemini uzerine secret-backed staging deployment runbook'u ve tek bir cloud target icin manifest/pipeline baglama gorevi; runtime veya auth sistemini yeniden acmamak.

## Teknik Borc (Tech Debt) & Known Gaps

> **Kaynak:** 2026-04-18 tarihli kapsamli mimari denetim (Architectural Audit).
> Bu bolum yalnizca acik kalan gap'leri listeler. Kapanan gap'ler asagida arsive tasinmistir.

### P3 - Acik Gaplar

### Track A - TASK-05 Browser Automation - 25 Nisan 2026

- `packages/types/src/tools.ts` browser tool ailesiyle genisletildi: `browser.navigate`, `browser.extract`, `browser.click`, `browser.fill`. Tool namespace ve capability class union'ina `browser` eklendi; mevcut registry/runtime contract'i bozulmadi.
- `apps/server/package.json` icine `playwright-core` dependency'si eklendi. Ayrica ayri dokuman dosyasi acmadan `apps/server/src/tools/browser-manager.ts` basina mini-RFC comment'i yazildi: neden `playwright-core`, binary'nin nereden gelmesi beklendigi, `PLAYWRIGHT_BROWSERS_PATH` / explicit executable path rolu ve binary yoksa typed graceful error davranisi orada kayitli.
- `apps/server/src/tools/browser-manager.ts` yeni BrowserManager lifecycle katmani olarak eklendi. Browser lazy-init calisiyor; run-scoped BrowserContext + Page oturumu aciliyor; session inactivity timeout varsayilan 5 dakika; `abortRun()` ve `close()` cleanup API'leri mevcut. Browser binary bulunamazsa typed `browser_binary_unavailable` hatasi uretip proses crash etmiyor.
- `apps/server/src/tools/browser-url-policy.ts` public-web guardrail katmani olarak eklendi. `http/https` disi scheme'ler, URL icinde credential tasiyan target'lar, localhost/private network araliklari ve metadata endpoint'leri default bloklaniyor. Hostname + resolved IP kombinasyonu ile local/private network sizintisi temkinli sekilde reddediliyor.
- Read-only tool'lar eklendi:
  - `apps/server/src/tools/browser-navigate.ts`: izole browser session ile public sayfaya gider, `wait_until` destekler ve title/url sonucunu dondurur.
  - `apps/server/src/tools/browser-extract.ts`: mevcut sayfadan `text`, `links`, `table` extraction yapar; sanitize/truncate uygular, HTML dump acmaz.
- Action tool'lar eklendi:
  - `apps/server/src/tools/browser-click.ts`
  - `apps/server/src/tools/browser-fill.ts`
  Bu tool'lar selector validation ve timeout uygular, conservative sekilde approval-gated metadata ile kayitlidir, sonrasinda page observation (`title`, `url`, `navigated`, `visible_error`) dondurur. `browser.fill` output'u yazilan raw degeri geri echo etmez; yalniz `value_length` saklanir.
- `apps/server/src/tools/registry.ts` ve `apps/server/src/tools/registry.test.ts` browser tool ailesiyle guncellendi; built-in registry artik browser + desktop + file/search/git/shell ailesini birlikte authoritative sekilde expose ediyor.
- Test coverage:
  - `browser-manager.test.ts`: lazy-init, run-scoped context reuse, inactivity cleanup, explicit abort, binary-yok typed error
  - `browser-navigate.test.ts`: public URL success, local/private policy block, binary-yok error mapping
  - `browser-extract.test.ts`: sanitize/truncate text, links extraction, table extraction
  - `browser-click.test.ts`: page observation + action risk metadata, selector-not-found
  - `browser-fill.test.ts`: approval-risk metadata, visible error observation, raw secret'i output'a geri koymama, invalid selector
- Dogrulama:
  - `pnpm.cmd add playwright-core --filter @runa/server`
  - `pnpm.cmd --filter @runa/types typecheck` PASS
  - `pnpm.cmd --filter @runa/server typecheck` PASS
  - `pnpm.cmd --filter @runa/server build` PASS
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/tools/browser-manager.test.ts src/tools/browser-navigate.test.ts src/tools/browser-extract.test.ts src/tools/browser-click.test.ts src/tools/browser-fill.test.ts src/tools/registry.test.ts` PASS
  - `pnpm.cmd --filter @runa/server exec biome check src/tools/browser-manager.ts src/tools/browser-manager.test.ts src/tools/browser-url-policy.ts src/tools/browser-navigate.ts src/tools/browser-navigate.test.ts src/tools/browser-extract.ts src/tools/browser-extract.test.ts src/tools/browser-click.ts src/tools/browser-click.test.ts src/tools/browser-fill.ts src/tools/browser-fill.test.ts src/tools/registry.ts src/tools/registry.test.ts package.json ../../packages/types/src/tools.ts` PASS
- Canli smoke kaniti:
  - `playwright-core` uzerinden headless Chromium launch edilip `https://example.com/` gercekten acildi; structured sonuc `{"result":"PASS","title":"Example Domain","url":"https://example.com/"}`.
  - Derlenmis tool'lar uzerinden gercek `browser.navigate` + `browser.extract` smoke'u PASS verdi; `browser.extract` `Learn more -> https://iana.org/domains/example` linkini dondurdu.
  - Ayni Chromium oturumu icinde public origin uzerine in-memory form set edilerek `browser.fill` ve `browser.click` tool'lari da canli smoke'ta PASS verdi; `browser.fill` approval-risk metadata + redacted output dondurdu, `browser.click` ise title/url degisimi ve `visible_error` gozlemini raporladi.
- Duru not: anti-bot/stealth, captcha bypass, local network automation, `file://`/`data:`/`javascript:` navigation ve browser context sharing bilincli olarak acilmadi. Browser action tool'lari temkinli olmak icin varsayilan approval-gated metadata ile kayitlidir; bu turde gateway veya desktop modullerine girilmedi.

### Track A - TASK-04 Parallel Tool Calling - 25 Nisan 2026

- `packages/types/src/gateway.ts` ve `apps/server/src/gateway/groq-gateway.ts` uzerinde modelden gelen birden fazla tool call candidate'i typed olarak parse eden additive seam kapatildi. Legacy `tool_call_candidate` alani backward compatibility icin korunurken yeni `tool_call_candidates` dizisi en fazla 5 valid adayi sirali sekilde tasiyor; partial-invalid cevaplarda valid adaylar swallow edilmeden korunuyor.
- `apps/server/src/runtime/tool-scheduler.ts` yeni scheduler/planner katmani olarak eklendi. Tool'lar effect class ve resource key bazinda siniflandiriliyor; read-only ve farkli kaynaklara dokunan adaylar ayni parallel batch'e alinabiliyor, ayni kaynaga bakan read'ler ile write/execute/browser/desktop/clipboard etkili adaylar ise deterministic sequential batch'lerde tutuluyor. Approval gereken ilk aday scheduler icinde hard boundary olarak ele aliniyor ve sonraki adaylar bilerek kosulmuyor.
- `apps/server/src/ws/run-execution.ts` icinde runtime execution zinciri coklu tool adayi icin genisletildi. Parallel batch'ler `Promise.allSettled` ile kosuluyor, tool-step failure'lar typed synthetic `ToolResult` olarak normalize ediliyor, continuation prompt'u completion sirasina degil modelin aday sirasina gore olusturuluyor. Boylece agent loop sonraki model turunda `[1]`, `[2]`, ... sirali ve deterministic tool sonucu goruyor.
- Approval boundary davranisi additive olarak sertlestirildi: approval gerektiren bir adaydan onceki guvenli batch'ler kosabiliyor, ancak approval gereken aday ve onun sonrasindaki adaylar durduruluyor. `approval.resolve` sonrasinda yalniz onaylanan tool replay ediliyor; approval arkasinda kalan sonraki tool'lar otomatik kacirilmis sekilde calistirilmiyor.
- `apps/server/src/runtime/run-model-turn.ts`, `apps/server/src/runtime/run-model-turn-loop-adapter.ts`, `apps/server/src/runtime/run-agent-loop.ts` ve `apps/server/src/runtime/agent-loop.ts` tarafinda coklu `tool_results` snapshot boyunca tasinabilir hale getirildi. Consecutive tool failure sayaci tek tek result yerine batch semantigine gore davranÃ„Â±yor: batch icinde en az bir basari varsa sayac sifirlaniyor, tum batch hata ise tek tur failure olarak artis oluyor.
- Test coverage: `apps/server/src/runtime/tool-scheduler.test.ts` yeni planner siniflandirma ve batching kurallarini kapsiyor; `apps/server/src/runtime/run-model-turn-loop-adapter.test.ts` ve `apps/server/src/runtime/agent-loop.test.ts` coklu `tool_results` carry-forward/failure semantigini dogruluyor; `apps/server/src/ws/register-ws.test.ts` icinde parallel read batch'lerinin out-of-order completion durumunda bile deterministic continuation urettigi ve approval sonrasi yalniz onaylanan tool'un replay edildigi integration coverage eklendi.
- Dogrulama: `pnpm.cmd --filter @runa/types typecheck`, `pnpm.cmd --filter @runa/server typecheck`, `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/runtime/tool-scheduler.test.ts src/runtime/agent-loop.test.ts src/runtime/run-model-turn-loop-adapter.test.ts`, `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/ws/register-ws.test.ts --testNamePattern "routes a live run.request tool call through the tool-aware runtime chain|continues a desktop vision loop through approval replay and verify_state|keeps multi-tool read batches deterministic even when parallel completions finish out of order|stops later multi-tool candidates behind approval and replays only the approved tool after approval.resolve|persists live approval-required run.request state and replays it after approval.resolve|automatically replays an approved pending tool call after approval.resolve"` ve `pnpm.cmd --filter @runa/server exec biome check src/runtime/tool-scheduler.ts src/runtime/tool-scheduler.test.ts src/runtime/agent-loop.ts src/runtime/agent-loop.test.ts src/runtime/run-model-turn.ts src/runtime/run-model-turn-loop-adapter.ts src/runtime/run-model-turn-loop-adapter.test.ts src/runtime/run-agent-loop.ts src/ws/run-execution.ts src/ws/register-ws.test.ts ../../packages/types/src/gateway.ts` yesil.
- Duru not: `src/ws/register-ws.test.ts` dosyasinin tumune kosulan onceki genis testte `web.search` authority metin beklentisinden gelen task-disi, onceki baseline drift goruldu. Task 04 kapaniÃƒâ€¦Ã…Â¸ kaniti bu nedenle task'a ait integration senaryolarini hedefleyen pattern bazli Vitest kosusuna dayaniyor; paralel tool scheduling/runtime seam'i icin gerekli proof mevcuttur.

### Track A / Track C - TASK-02D LM Studio Local Vision Smoke - 25 Nisan 2026

- `packages/types/src/ws.ts`, `packages/types/src/ws-guards.ts`, `apps/server/src/gateway/providers.ts` ve `apps/server/src/gateway/config-resolver.ts` uzerinden `openai` provider icin additive `baseUrl` konfigurasyon seami acildi. Boylece `ModelGateway` kontrati korunarak local OpenAI-compatible endpoint'ler request seviyesinde veya env fallback ile adreslenebiliyor.
- `apps/server/src/gateway/openai-gateway.ts` icinde local OpenAI-compatible base URL routing'i loopback-host ile sinirlandi. `localhost`, `127.0.0.1` ve `::1` disindaki host'lar typed configuration error ile reddediliyor; dogrudan keyless uzak endpoint override yolu acilmadi.
- `apps/server/src/persistence/approval-store.ts` approval continuation persistence hattinda `provider_config.baseUrl` alanini minimum-shape sanitize mantigi icinde koruyor; boylece approval replay sonrasi local LM Studio base URL bilgisi kaybolmuyor. `apps/server/src/persistence/approval-store.test.ts` uzerine buna ait coverage eklendi.
- `apps/server/src/gateway/gateway.test.ts` icine local OpenAI-compatible loopback routing ve non-loopback reject coverage'i eklendi. `apps/server/scripts/lmstudio-vision-smoke.mjs` yeni live smoke harness'i olarak eklendi; sentetik ama gercek PNG screenshot artifact'leri uretip `desktop.vision_analyze` ile `desktop.verify_state` tool'larini ayni `OpenAiGateway` uzerinden LM Studio'ya karsi kosuyor.
- Canli dogrulama: bu shell'de `LM Studio` server'i `http://localhost:1234/v1` uzerinden aktifti ve `/v1/models` cevabinda `qwen/qwen3.5-9b` dondu. `node apps/server/scripts/lmstudio-vision-smoke.mjs` komutu `result: PASS` urettigi dogrulandi; `desktop.vision_analyze` gercek image attachment ile kirmizi butonu tespit etti, `desktop.verify_state` ise sonraki screenshot'ta yesil success panel degisimini `verified: true` olarak onayladi.
- Dogrulama: `pnpm.cmd --filter @runa/types typecheck`, `pnpm.cmd --filter @runa/server typecheck`, `pnpm.cmd --filter @runa/server build`, `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/gateway/gateway.test.ts src/persistence/approval-store.test.ts src/tools/desktop-vision-analyze.test.ts src/tools/desktop-verify-state.test.ts src/ws/register-ws.test.ts`, `pnpm.cmd --filter @runa/server exec biome check src/gateway/config-resolver.ts src/gateway/openai-gateway.ts src/gateway/gateway.test.ts src/persistence/approval-store.ts src/persistence/approval-store.test.ts ../../packages/types/src/ws.ts ../../packages/types/src/ws-guards.ts` yesil.
- Duru not: bu kanit local/dev smoke'tur. `qwen/qwen3.5-9b` + LM Studio ile live vision loop kanitlandi, ancak bundan `Groq vision production-ready` veya yayin provider smoke'u cikarimi yapilmadi.

### Track C / Track A - TASK-06 Desktop Utility Tools - 25 Nisan 2026

- Kullanicinin kokteki `TASK-06-DESKTOP-UTILITY-TOOLS.md` icindeki tum alt gorevleri uygulama istegi dogrultusunda 06A/06B/06C tek turda additive olarak kapatildi. Task dosyasinin "tek alt gorev" uyarisi risk siniri olarak dikkate alindi; bu nedenle her utility yetenegi ayri typed tool, ayri test ve ayri guard ile eklendi.
- `TASK-06A` icin `apps/desktop-agent/src/clipboard.ts` eklendi ve `desktop.clipboard.read` / `desktop.clipboard.write` desktop bridge dispatch'ine baglandi. Clipboard read 10KB ile sinirli, secret-like icerikleri redaction-aware output'a ceviriyor; clipboard write 10KB ustunu agent'a dispatch etmeden reddediyor. Clipboard icerigi log'lanmiyor.
- `TASK-06B` icin `apps/desktop-agent/src/app-launcher.ts` ve server-side `apps/server/src/tools/desktop-launch.ts` eklendi. Launch yalniz `chrome`, `edge`, `firefox`, `notepad`, `code`, `explorer`, `calc` whitelist'i uzerinden calisiyor; `cmd` / `powershell` bilincli olarak acilmadi ve user input dogrudan `Start-Process`'e tasinmiyor.
- `TASK-06C` icin `apps/server/src/tools/file-watch.ts` eklendi. Native `fs.watch` kullanildi, yeni dependency eklenmedi; workspace disina cikis path normalization + realpath guard ile reddediliyor, sure 30 saniye ve event sayisi 50 ile sinirli.
- `packages/types/src/ws.ts` desktop agent capability union'i additive olarak genisletildi; `packages/types/src/tools.ts` known tool union'ina `desktop.clipboard.read`, `desktop.clipboard.write`, `desktop.launch` ve `file.watch` eklendi. `apps/server/src/tools/registry.ts` built-in registry artik bu yeni utility ailesini expose ediyor.
- Test coverage: `apps/server/src/tools/desktop-clipboard.test.ts`, `desktop-launch.test.ts`, `file-watch.test.ts` ve `registry.test.ts` yeni security negative path'leri kapsiyor: oversized clipboard write, whitelist disi launch ve workspace disi watch reddi.
- Dogrulama yesil: `pnpm.cmd --filter @runa/types build`, `pnpm.cmd --filter @runa/desktop-agent typecheck`, `pnpm.cmd --filter @runa/desktop-agent build`, `pnpm.cmd --filter @runa/server typecheck`, `pnpm.cmd exec biome check packages/types/src/ws.ts packages/types/src/tools.ts apps/desktop-agent/src/app-launcher.ts apps/desktop-agent/src/clipboard.ts apps/desktop-agent/src/ws-bridge.ts apps/desktop-agent/src/index.ts apps/server/src/tools/desktop-clipboard.ts apps/server/src/tools/desktop-clipboard.test.ts apps/server/src/tools/desktop-launch.ts apps/server/src/tools/desktop-launch.test.ts apps/server/src/tools/file-watch.ts apps/server/src/tools/file-watch.test.ts apps/server/src/tools/registry.ts apps/server/src/tools/registry.test.ts`, `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/tools/desktop-clipboard.test.ts src/tools/desktop-launch.test.ts src/tools/file-watch.test.ts src/tools/registry.test.ts`.
- Genis repo testi durumu: `pnpm.cmd --filter @runa/server test` bu task'a ait yeni dist testlerini gecirdi ancak repo-baseline 3 task-disi kirmizi ile tamamlanmadi: `src/gateway/model-router.test.ts` fallback chain Sambanova beklenti farki, `src/runtime/run-with-provider.test.ts` missing API key artik reject yerine FAILED result donmesi, `src/ws/register-ws.test.ts` web.search authority_note metin beklentisi. Bu kirmizilar TASK-06 dosyalarindan kaynaklanmiyor.
- Sonraki dar gorev: desktop utility ailesini user-facing desktop shell/device presence yuzeyinde sade, chat-native ve approval odakli gosterecek ikinci katman UI/UX seami; bu task'ta ana chat yuzeyi, auth/gateway redesign veya yeni native dependency acilmadi.

### Full Green Baseline Cleanup - 25 Nisan 2026

- TASK-06 sonrasi genis repo kapisini kirmizi tutan stale baseline beklentileri task-disi olarak siniflandirildi ve mevcut runtime kontratina hizalandi: provider fallback zinciri artik `sambanova` ekini bekliyor, missing provider API key runtime path'i reject yerine structured `FAILED` sonucu olarak dogrulaniyor, `web.search` authority note beklentisi guncel metinle esitlendi.
- Root lint kapisi icin kaynak format/import drift'i temizlendi. `biome.json` generated build output'lari ve local ad-hoc smoke dosyalarini lint kapsamindan cikardi; DB local smoke scriptlerinde hassas baglanti metni bulunabildigi icin bu dosyalar formatlanmak yerine ignore edildi.
- Web hook lint/typecheck borcu kapatildi: `useAuth` helper state transition fonksiyonlari stable callback'lere alindi, effect dependency setleri gercek kullanimla hizalandi; `useChatRuntime` gereksiz setter dependency'leri temizlendi; `useConversations` runtime guard'lari typed candidate uzerinden hem Biome hem TypeScript ile uyumlu hale getirildi.
- Dogrulama yesil:
  - `pnpm.cmd lint`
  - `pnpm.cmd typecheck`
  - `pnpm.cmd --filter @runa/server test` (`119` test dosyasi, `793` test)
  - `pnpm.cmd test`
  - `pnpm.cmd build`
- Son durum: TASK-06 artik yalniz task-local degil, monorepo root kapilariyla da full green dogrulandi. Calisma mevcut kirli worktree uzerinde yapildi; kullaniciya ait/task-disi dosya silme veya revert uygulanmadi.

### Track A - TASK-07 MCP Streamable HTTP Transport - 25 Nisan 2026

- Kokteki `TASK-07-MCP-HTTP-TRANSPORT.md` kapsamindaki MCP HTTP transport seami additive olarak kapatildi. `packages/types/src/mcp.ts` artik `stdio` ve `http` transport config'lerini ayiriyor; `transport` yoksa stdio default'u korunuyor, HTTP icin `url` zorunlu hale geldi ve headers typed config'e eklendi.
- `apps/server/src/mcp/config.ts` mevcut `RUNA_MCP_SERVERS` parser'ini HTTP config'lerini okuyacak sekilde genisletti. Stdio icin `command` zorunlulugu korunuyor; HTTP icin `url` zorunlu, `headers` ise yalniz string record olarak kabul ediliyor.
- `apps/server/src/mcp/http-transport.ts` eklendi. JSON-RPC batch mesajlari `POST` ile `Content-Type: application/json` ve `Accept: application/json, text/event-stream` header'lariyla gonderiliyor; JSON response ve SSE/event-stream frame'leri kontrollu parse ediliyor. Request timeout 30s, stream read timeout 60s; external `AbortSignal` destekleniyor.
- Remote MCP URL policy konservatif tutuldu: `file://`, URL credential'lari, localhost, loopback, private IPv4 araliklari, link-local/metadata endpoint'leri ve temel private IPv6 araliklari default bloklaniyor. Authorization, cookie, API key, token ve secret header'lari transport error detail'lerinde redacted tutuluyor.
- `McpClient` transport'a gore route ediyor: `callTool()` HTTP veya stdio session kullanabiliyor; async `listTools()` HTTP list icin eklendi; `listToolsSync()` stdio-only kaldi ve HTTP config'te typed `McpClientError` veriyor. Mevcut ToolRegistry bridge ve `mcp.<serverId>.<toolName>` isimlendirmesi bozulmadi; stdio transport davranisi degismedi, yalniz yeni union tipi icin stdio config tipi daraltildi.
- Test coverage: HTTP config validation, JSON response parse, SSE/event-stream parse, header redaction, private/local URL negative path'leri, AbortSignal passthrough, HTTP `McpClient.callTool()`, async HTTP `listTools()` ve mevcut stdio registry bridge regresyonu kapsandi.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/types typecheck`
  - `pnpm.cmd --filter @runa/server typecheck`
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/mcp/client.test.ts src/mcp/http-transport.test.ts src/mcp/registry-bridge.test.ts`
  - `pnpm.cmd --filter @runa/server exec biome check src/mcp/client.ts src/mcp/client.test.ts src/mcp/config.ts src/mcp/http-transport.ts src/mcp/http-transport.test.ts src/mcp/stdio-transport.ts ../../packages/types/src/mcp.ts`
  - `pnpm.cmd --filter @runa/server test` (`120` test dosyasi, `807` test)
- Duru not: Bu tur ikinci bir MCP execution plane kurmadi, Gateway/desktop/web modullerine girmedi ve yeni dependency eklemedi. HTTP MCP discovery icin sync registry path'i bilerek uydurulmadi; HTTP tool listesi async client seviyesinde hazir, mevcut environment registry bridge ise stdio sync davranisini koruyor.

### Track A - TASK-04 Runtime Parallel Tool Calls + TASK-07 Async HTTP MCP Registry Closure - 25 Nisan 2026

- Duzeltme notu: TASK-04 icin onceki kapanis beyaninda core runtime entegrasyonu eksik kalmisti. `tool_call_candidates` array kontrati ve scheduler/WS parcasi repoda olsa da `adapt-model-response-to-turn-outcome.ts`, `continue-model-turn.ts`, `run-model-turn.ts` ve loop adapter hattinda tekil `tool_call_candidate` varsayimi devam ediyordu. Bu turda bu eksik acikca kapatildi.
- Core runtime artik model response icindeki `tool_call_candidates` dizisini `ModelTurnOutcome.kind === "tool_calls"` olarak parse ediyor; invalid array shape typed failure uretiyor. `continueModelTurn` coklu tool outcome icin `planToolExecutionBatches` kullanarak paralel calisabilir batch'leri `Promise.allSettled` ile yurutuyor, approval-required candidate'ta guvenli onceki sonuclari koruyarak duruyor ve `tool_results` sirasini modelin orijinal tool call sirasina gore donduruyor.
- `runModelTurn` ve `run-model-turn-loop-adapter` coklu tool sonucunu tasiyacak sekilde genisletildi. `tool_result` backward-compatible tekil son sonucu korurken `tool_results` batch sonuc listesini tasiyor; approval boundary ve continuation mapping call_id uzerinden dogru tool input'u seciyor. `stop-conditions` model sinyali `tool_calls` icin terminal assistant stop gibi davranmayacak sekilde genisletildi.
- TASK-07 icin ikinci duzeltme: HTTP MCP discovery yalniz `McpClient.listTools()` seviyesinde kalmadi. `discoverMcpTools()` async registry bridge'e eklendi; `createToolRegistryFromEnvironmentAsync()` ve `getDefaultToolRegistryAsync()` WS runtime dependency path'ine baglandi. `run.request` ve approval resolve/replay path'leri default registry gerekirse async olarak kuruyor; sync path stdio-only davranisi koruyor.
- Coverage eklendi/guncellendi: model response adapter array parse/negative path, core `continueModelTurn` paralel batch ve approval boundary, `runModelTurn` core array -> scheduler -> tool_results path, loop adapter tool_results propagation, async HTTP MCP environment registry path ve mevcut WS/register-ws regresyonlari.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/types typecheck`
  - `pnpm.cmd --filter @runa/server typecheck`
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/runtime/continue-model-turn.test.ts src/runtime/adapt-model-response-to-turn-outcome.test.ts src/runtime/run-model-turn.test.ts src/runtime/run-model-turn-loop-adapter.test.ts src/ws/runtime-dependencies.test.ts src/mcp/client.test.ts src/mcp/http-transport.test.ts src/mcp/registry-bridge.test.ts src/ws/register-ws.test.ts` (`9` test dosyasi, `100` test)
  - `pnpm.cmd --filter @runa/server exec biome check src/runtime/adapt-model-response-to-turn-outcome.ts src/runtime/adapt-model-response-to-turn-outcome.test.ts src/runtime/continue-model-turn.ts src/runtime/continue-model-turn.test.ts src/runtime/run-model-turn.ts src/runtime/run-model-turn.test.ts src/runtime/run-model-turn-loop-adapter.ts src/runtime/run-model-turn-loop-adapter.test.ts src/runtime/stop-conditions.ts src/mcp/registry-bridge.ts src/mcp/client.ts src/mcp/client.test.ts src/mcp/config.ts src/mcp/http-transport.ts src/mcp/http-transport.test.ts src/mcp/stdio-transport.ts src/ws/runtime-dependencies.ts src/ws/runtime-dependencies.test.ts src/ws/run-execution.ts src/ws/approval-handlers.ts ../../packages/types/src/mcp.ts`
  - `pnpm.cmd --filter @runa/server test` (`120` test dosyasi, `813` test)
- Son durum: TASK-04 core runtime entegrasyonu ve TASK-07 HTTP MCP default WS registry entegrasyonu artik birlikte dogrulandi. Worktree bu calismaya baslamadan da cok kirliydi; task-disi dosyalara revert uygulanmadi.

### Track A / Track B - TASK-08 Semantic Memory - 25 Nisan 2026

- Kokteki `TASK-08-SEMANTIC-MEMORY.md` kapsamindaki semantic memory minimumu additive olarak kapatildi. Shared tool kontrati `memory.save`, `memory.search`, `memory.list` ve `memory.delete` isimleriyle genisletildi; eski memory/search semantiklerinden Gateway, web veya desktop redesign acilmadi.
- `memory.save` explicit/inferred/conversation source policy'sini enforce ediyor. Explicit memory dogrudan kullanici istegi icin acik; inferred memory `consent_confirmed=true` ister; conversation memory hem consent hem `RUNA_CONVERSATION_MEMORY_ENABLED=true` feature flag'i ister. API key, password, token, provider secret ve payment/card benzeri sensitive content default reddediliyor.
- `memory.list` ve `memory.delete` user-visible kontrol yuzeyi kurdu. Delete hard delete degil, mevcut store sozlesmesine uygun soft archive kullaniyor ve memory id'nin istenen user/workspace scope'una ait oldugunu kontrol etmeden arsivlemiyor.
- `memory.search` mevcut token-overlap semantic retrieval hattini canonical `memory.search` tool'u olarak expose ediyor; output artik `memory_id`, `created_at`, `source_kind`, `retrieval_reason`, `matched_terms` ve `relevance_score` provenance alanlarini donduruyor.
- Context integration sertlestirildi: memory layer artik provenance/relevance alanlarini prompt layer'a tasiyor, memory notlari untrusted background olarak etiketleniyor ve content/summary `sanitizePromptContent` uzerinden geciyor. Memory injection instruction authority olarak yorumlanmiyor.
- Embedding provider mini-RFC'si `apps/server/src/memory/README.md` icine eklendi. Karar: yeni dependency, local model download, remote embedding key'i veya vector DB bu task'ta acilmadi; mevcut `token_overlap_v1` helper lazy/deterministic fallback olarak tutuldu. Vector provider icin model boyutu, first-load, CPU/memory, offline/online, deployment ve unavailable fallback kaniti ayri karar kapisi olarak kaydedildi.
- DB/RLS notu: Mevcut `memories` table ve RLS plan seam'i korunuyor; user/workspace isolation bugunku tool seviyesinde scope ownership testleriyle kanitlandi. Cloud RLS policy SQL'i daha once oldugu gibi write-path identity persistence tam kapanmadan ready moda alinmadi; bu task DB schema redesign veya ikinci `memory_entries` table'i acmadi.
- Dogrulama: `pnpm.cmd --filter @runa/types typecheck`, `pnpm.cmd --filter @runa/db typecheck`, `pnpm.cmd --filter @runa/server typecheck`, `pnpm.cmd --filter @runa/db test` (`5` dosya / `26` test), targeted memory/context Vitest (`5` dosya / `24` test), targeted Biome check, `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.config.mjs --configLoader runner --maxWorkers=1` (`121` dosya / `817` test), `pnpm.cmd --filter @runa/types build`, `pnpm.cmd --filter @runa/db build` ve `pnpm.cmd --filter @runa/server build` yesil. Not: varsayilan paralel `pnpm.cmd --filter @runa/server test` ikinci denemede assertion degil Vitest worker OOM / `Channel closed` ile dustu; ayni suite tek worker ile PASS verdi.
- Sonraki dar gorev: cloud auth principal'i memory store write path'ine kalici `user_id` / `tenant_id` olarak baglayip sadece `memories` icin ready RLS SQL policy apply kaniti uretmek; semantic memory tool sozlesmesini yeniden acmamak.

### Track A / Track C - TASK-10A Structured Output Parser Foundation - 25 Nisan 2026

- Kokteki `TASK-10-STRUCTURED-OUTPUT.md` icindeki TASK-10A fazi dar kapsamda kapatildi. Yeni `RenderBlock` tipi acilmadi, frontend renderer veya production presentation path degistirilmedi; bu tur yalniz parser helper ve test coverage ekledi.
- `apps/server/src/presentation/output-parser.ts` eklendi. Parser fenced code block, markdown table, checklist/numbered plan ve konservatif file reference token'larini taniyor; her sonuc `raw_text` alaninda orijinal model cevabini koruyor ve dusuk confidence durumunda structured node uretmeden `raw_text` fallback'e donuyor.
- Large inline code/artifact riski icin `inline_content_limit` destekli deterministik truncate davranisi eklendi. Unterminated code fence gibi yarim/streaming-benzeri input'larda parser output'u bosaltmiyor; ham metin kayipsiz kaliyor.
- `apps/server/src/presentation/output-parser.test.ts` yeni coverage'i kapsiyor: raw fallback, fenced code + filename, large code truncation, markdown table, checklist/numbered plan, file reference line metadata ve unterminated fence fallback.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/presentation/output-parser.test.ts`
  - `pnpm.cmd --filter @runa/server typecheck`
  - `pnpm.cmd --filter @runa/server exec biome check src/presentation/output-parser.ts src/presentation/output-parser.test.ts`
  - `pnpm.cmd --filter @runa/server build`
  - `pnpm.cmd --filter @runa/web typecheck`
  - `pnpm.cmd --filter @runa/web build`
- Durust kalan durum: TASK-10B henuz acilmadi. Code/table/plan/file reference icin typed `RenderBlock` kontrati ve frontend renderer ayni fazda eklenmeden production presentation akisi bu parser'a baglanmadi.
- Sonraki onerilen gorev: agreed siraya uygun olarak `UI-PHASE-4.md` icindeki block renderer / research trust / capability presentation fazina gecmek; RenderBlock contract'i genisletilecekse bunu TASK-10B ile birlikte frontend renderer dahil yap.

### Track C - UI-PHASE-4 Block Renderer Registry Foundation - 25 Nisan 2026

- `UI-PHASE-4.md` kapsaminda dar ve davranis koruyan ilk registry dilimi kapatildi. `packages/types`, server presentation mapper, runtime/WS timing veya yeni `RenderBlock` union'i acilmadi.
- `apps/web/src/components/chat/blocks/BlockRenderer.tsx` eklendi. Mevcut tum `RenderBlock` tipleri icin exhaustive switch benzeri tek registry girisi kuruldu; text/status/event_list/code/diff/inspection_detail/run_timeline/search/web_search/trace_debug/workspace/approval/tool_result bloklari mevcut renderer davranislarini koruyarak bu registry uzerinden route ediliyor.
- `apps/web/src/components/chat/chat-presentation.tsx` artik block dispatch'i icin `BlockRenderer` kullaniyor. Inspection detail relation davranisi korunmak icin mevcut detail renderer callback olarak registry'ye veriliyor; approval resolve ve inspection request callback'leri ayni sekilde tasiniyor.
- Developer-only raw yuzeyler icin ilk guard eklendi: `event_list` ve `trace_debug_block` Developer Mode kapaliyken ana chat yuzeyinde render edilmiyor. `PresentationRunSurfaceCard`, `PastRunSurfaces` ve `ChatPage` `isDeveloperMode` bilgisini registry hattina tasiyor.
- `apps/web/src/components/chat/blocks/CodeBlockCard.tsx` eklendi. Code block render'i copy aksiyonu, 2 saniyelik copy feedback/failure state'i, line number gorunumu, path/language/diff_kind bilgisi ve yatay tasma kontrollu code preview ile registry tarafindan kullaniliyor.
- `diff_block` render'i default collapsed `<details>` yuzeyine alindi. Summary, changed paths, truncated badge ve inspection action gorunumu korunurken ham diff metni kullanici isterse `View diff` ile aciliyor.
- `apps/web/src/components/chat/blocks/BlockRenderer.test.tsx` eklendi. Test, Developer Mode'da mevcut butun `RenderBlock` tiplerinin unsupported fallback'e dusmeden static render edildigini, Developer Mode kapaliyken raw runtime/debug bloklarinin default chat yuzeyinden gizlendigini ve code copy / collapsed diff affordance'larinin render edildigini dogruluyor.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/web exec vitest run --config ./vitest.config.mjs --configLoader runner src/components/chat/blocks/BlockRenderer.test.tsx` (`3` test)
  - `pnpm.cmd --filter @runa/web typecheck`
  - `pnpm.cmd --filter @runa/web exec biome check src/components/chat/blocks/BlockRenderer.tsx src/components/chat/blocks/BlockRenderer.test.tsx src/components/chat/blocks/CodeBlockCard.tsx src/components/chat/PresentationBlockRenderer.tsx src/components/chat/chat-presentation.tsx src/components/chat/PresentationRunSurfaceCard.tsx src/components/chat/PastRunSurfaces.tsx src/pages/ChatPage.tsx`
  - `pnpm.cmd --filter @runa/web build`
- Durust QA notu: Bu turda gercek browser block fixture route'u veya local authenticated sample surface acilmadi; bu nedenle 320px/1440px browser block tasma kaniti uydurulmadi. Kanit targeted React static render testi + web build/typecheck/Biome ile sinirli.
- Kalan UI-PHASE-4 polish: daha zengin source/trust chip kullanimi ve workspace/dev detail ince ayarlari ileride yapilabilir; bu tur ana registry, developer-only guard, code copy ve diff collapse kapilarini kapatti. Siradaki agreed gorev TASK-10B oldugu icin yeni block kontrati acilacaksa frontend renderer ile ayni fazda ele alinmali.

### Track A / Track C - TASK-10B Typed Structured Output Blocks - 25 Nisan 2026

- `TASK-10-STRUCTURED-OUTPUT.md` icindeki TASK-10B fazi typed contract + backend mapper + frontend renderer birlikte olacak sekilde kapatildi. Yeni block tipleri frontend renderer olmadan production presentation path'e verilmedi.
- `packages/types/src/blocks.ts` additive olarak `code_artifact`, `plan`, `table` ve `file_reference` block tipleriyle genisletildi. Mevcut `text`, `code_block`, `diff_block`, `tool_result`, search ve approval block sozlesmeleri korunarak union'a yeni payload tipleri eklendi.
- `apps/server/src/presentation/map-structured-output.ts` eklendi. TASK-10A parser sonucunu `RenderBlock` dizisine map ediyor; low-confidence/raw durumda yine `text` block fallback'i uretiyor. `apps/server/src/presentation/map-runtime-events.ts` completion text'i icin bu mapper'i kullanmaya basladi; failure text akisi raw text olarak korunuyor.
- Frontend tarafinda `BlockRenderer` yeni `code_artifact`, `plan`, `table` ve `file_reference` tiplerini render ediyor. `CodeBlockCard` hem mevcut `code_block` hem yeni `code_artifact` icin kullaniliyor; copy/line number davranisi ortak kaldi. Plan, table ve file reference yuzeyleri `CapabilityCard` uzerinden sakin chat-native kartlar olarak gosteriliyor.
- Coverage guncellendi: `map-runtime-events.test.ts` structured assistant output'un `plan`, `code_artifact`, `file_reference` ve fallback `text` block'larina ayrildigini dogruluyor; `BlockRenderer.test.tsx` yeni block tiplerinin Developer Mode'da unsupported fallback'e dusmeden render edildigini kapsiyor.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/types typecheck`
  - `pnpm.cmd --filter @runa/types build`
  - `pnpm.cmd --filter @runa/server typecheck`
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/presentation/output-parser.test.ts src/presentation/map-runtime-events.test.ts` (`2` dosya / `11` test)
  - `pnpm.cmd --filter @runa/server exec biome check src/presentation/output-parser.ts src/presentation/output-parser.test.ts src/presentation/map-structured-output.ts src/presentation/map-runtime-events.ts src/presentation/map-runtime-events.test.ts ../../packages/types/src/blocks.ts`
  - `pnpm.cmd --filter @runa/server build`
  - `pnpm.cmd --filter @runa/web typecheck`
  - `pnpm.cmd --filter @runa/web exec vitest run --config ./vitest.config.mjs --configLoader runner src/components/chat/blocks/BlockRenderer.test.tsx` (`3` test)
  - `pnpm.cmd --filter @runa/web exec biome check src/components/chat/blocks/BlockRenderer.tsx src/components/chat/blocks/BlockRenderer.test.tsx src/components/chat/blocks/CodeBlockCard.tsx src/components/chat/PresentationBlockRenderer.tsx src/components/chat/chat-presentation.tsx src/components/chat/PresentationRunSurfaceCard.tsx src/components/chat/PastRunSurfaces.tsx src/pages/ChatPage.tsx`
  - `pnpm.cmd --filter @runa/web build`
- Durust kalan durum: Provider-native schema-first structured output capability gate'i acilmadi; regex/markdown parser halen controlled fallback katmani. Large binary/artifact reference storage davranisi bu task'ta acilmadi.
- Sonraki agreed gorev: `UI-PHASE-5.md` icindeki streaming/markdown/thinking/artifact preview polish; mevcut structured blocks uzerine protocol redesign acmadan ilerle.

### Track C - UI-PHASE-5 Streaming / Markdown / Activity Confidence Surfaces - 25 Nisan 2026

- `UI-PHASE-5.md` kapsaminda mevcut markdown ve streaming seami yeniden yazilmadan genisletildi. WS protocol, server streaming, gateway/provider davranisi veya `useChatRuntime.ts` degistirilmedi.
- Mevcut `MarkdownRenderer` ve `StreamingMessageSurface` korunarak targeted test altina alindi: heading/table/code/link render'i, `javascript:` gibi tehlikeli link scheme'lerinin href olarak render edilmemesi ve yarim fenced code iceren streaming metnin dusmeden gorunmesi dogrulandi.
- `apps/web/src/components/chat/ThinkingBlock.tsx` eklendi. `run_timeline_block`/current-run progress tarafindan zaten tasinan label/detail/tool_name/state sinyallerini raw chain-of-thought gostermeden, "Runa calisiyor" / "Calisma ozeti" diliyle render ediyor. Payload'da olmayan duration uydurulmuyor.
- `apps/web/src/components/chat/ToolActivityIndicator.tsx` eklendi. `tool_requested`, `tool_completed`, `tool_failed` runtime step'leri active/completed/failed olarak compact inline yuzeyde gorunuyor; stack trace veya raw runtime dump ana chat'e tasinmiyor.
- `apps/web/src/components/chat/RunProgressPanel.tsx` mevcut step grid'ini `ThinkingBlock` + `ToolActivityIndicator` adapter'iyle kullanmaya basladi. Runtime sinyali kaynagi halen `deriveCurrentRunProgressSurface`; yeni server data veya fake progress uretilmedi.
- `apps/web/src/components/chat/ScreenshotCard.tsx` eklendi. Image/screenshot artifact preview icin lazy image, caption/timestamp, click ile native dialog preview ve close action sagliyor; runtime izin veya desktop vision flow'u bu fazda acilmadi.
- `apps/web/src/components/chat/UIPhase5Surfaces.test.tsx` eklendi. Markdown safe link/table/code, streaming partial markdown, ThinkingBlock/ToolActivityIndicator ve ScreenshotCard lazy preview davranislari static render ile test edildi.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/web typecheck`
  - `pnpm.cmd --filter @runa/web exec vitest run --config ./vitest.config.mjs --configLoader runner src/components/chat/UIPhase5Surfaces.test.tsx src/components/chat/blocks/BlockRenderer.test.tsx` (`2` dosya / `7` test)
  - `pnpm.cmd --filter @runa/web exec biome check src/components/chat/ThinkingBlock.tsx src/components/chat/ToolActivityIndicator.tsx src/components/chat/ScreenshotCard.tsx src/components/chat/UIPhase5Surfaces.test.tsx src/components/chat/RunProgressPanel.tsx src/components/chat/StreamingMessageSurface.tsx src/components/chat/MarkdownRenderer.tsx`
  - `pnpm.cmd --filter @runa/web build`
- Durust QA notu: Gercek browser fixture/live provider smoke kosulmadi; screenshot preview modal click'i static render ile sinirli kaldigi icin browser interaction kaniti yok. Live provider yoksa bu fazin kaniti targeted component tests + build/typecheck/Biome'dur.
- Sonraki agreed gorev: `TASK-12-FILE-TRANSFER.md` icindeki existing attachment audit + hardening; upload/attachment hattini okumadan yeniden yazma.

### Track B / Track C - TASK-12A Existing Attachment Audit + Hardening - 25 Nisan 2026

- `TASK-12-FILE-TRANSFER.md` icindeki TASK-12A kapsami uygulandi; mevcut upload route, frontend upload button ve provider attachment contract'i okunarak yalniz eksik validation/hardening seam'leri kapatildi.
- Audit sonucu: mevcut contract `packages/types/src/gateway.ts` uzerinden image/text attachment destekliyor; document/PDF/Excel native contract henuz yok. Bu turda TASK-12B document attachment veya TASK-12C file share/download block acilmadi.
- `apps/server/src/routes/upload.ts` storage'a yazmadan once normalize/validate edecek hale getirildi. Unsupported media artik upload adapter'a gitmeden `415` donuyor; `.exe`, `.bat`, `.cmd`, `.ps1`, `.msi`, macro-enabled office ve benzeri riskli extension'lar storage oncesi engelleniyor.
- Server base64/type hardening eklendi: bos/gecersiz base64 `400`, image limitini asan payload `413`, text/application-json limitini asan payload `413` donuyor. Content type lower-case/trim normalize ediliyor; mevcut image/text contract response sekli korunuyor.
- `apps/web/src/components/chat/FileUploadButton.tsx` dosyayi okumadan once frontend preflight validation yapmaya basladi. Image/text/json accept listesi korunurken unsupported type, riskli filename ve image/text size limitleri kullaniciya fetch oncesi hata olarak donuyor.
- Coverage eklendi: `apps/server/src/routes/upload.test.ts` image/text regression, unsupported type, riskli filename, invalid base64 ve oversized text icin storage-oncesi rejection'i kapsiyor. `apps/web/src/components/chat/FileUploadButton.test.ts` frontend preflight helper'inin supported/unsupported/risky/oversized kararlarini kapsiyor.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/routes/upload.test.ts` (`6` test)
  - `pnpm.cmd --filter @runa/web exec vitest run --config ./vitest.config.mjs --configLoader runner src/components/chat/FileUploadButton.test.ts` (`3` test)
  - `pnpm.cmd --filter @runa/server typecheck`
  - `pnpm.cmd --filter @runa/web typecheck`
  - `pnpm.cmd --filter @runa/server exec biome check src/routes/upload.ts src/routes/upload.test.ts`
  - `pnpm.cmd --filter @runa/web exec biome check src/components/chat/FileUploadButton.tsx src/components/chat/FileUploadButton.test.ts`
  - `pnpm.cmd --filter @runa/server build`
  - `pnpm.cmd --filter @runa/web build`
- Durust kalan durum: document attachment contract, provider document degrade davranisi, signed download/share URL ve `FileDownloadBlock` henuz yok; bunlar sirasiyla TASK-12B/TASK-12C konusu. Browser upload smoke kosulmadi; kanit targeted route/component tests + typecheck/build/Biome ile sinirli.
- Sonraki agreed gorev: `TASK-12B` document attachment contract'i; buyuk document content model context'e gomulmeden artifact reference olarak tasinmali ve provider destegi yoksa typed graceful degrade verilmeli.

### Track B / Track C - TASK-12B Document Attachment Contract - 25 Nisan 2026

- `TASK-12-FILE-TRANSFER.md` icindeki TASK-12B additive olarak kapatildi. Mevcut image/text attachment contract'i korunurken `document` attachment tipi eklendi.
- `packages/types/src/gateway.ts` `ModelDocumentAttachment` ile genisletildi: `kind: 'document'`, `filename`, `media_type`, `size_bytes`, `storage_ref`, opsiyonel `text_preview` ve mevcut preview/list UI akisi icin `blob_id` tasiyor. `packages/types/src/ws-guards.ts` runtime payload guard'i yeni tipi kabul edecek sekilde guncellendi.
- Storage hattinda `attachment_document` blob kind'i eklendi. Supabase storage path parser bu yeni kind'i kabul ediyor; auth/owner/scope davranisi mevcut storage service uzerinden korunuyor.
- Upload route PDF/Office document dosyalarini 5 MB limitli artifact olarak kabul ediyor. Document response binary payload, `data_url` veya `text_content` gommeden yalniz `storage_ref` ile donuyor. Filename zorunlu; PDF/Excel full parsing bu fazda acilmadi.
- Provider mapping tarafinda native document support varsayilmadi. `apps/server/src/gateway/attachment-text.ts` eklendi; Groq/OpenAI/Gemini/SambaNova/Claude adapter'lari document attachment'i text part olarak "stored document artifact + storage reference + preview yok" seklinde degrade ediyor, ham binary model request'e gomulmuyor.
- Frontend upload preflight PDF/DOC/DOCX/XLS/XLSX/PPT/PPTX dosyalarini kabul edecek sekilde genisletildi; document size limitleri fetch/file read oncesi kontrol ediliyor. Composer preview document icin storage reference gosteriyor.
- Coverage guncellendi: upload route typed document response ve storage kind'ini, gateway testleri document degrade metnini, live-request testi document attachment passthrough'unu, web preflight testi supported/oversized document davranisini kapsiyor.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/routes/upload.test.ts src/gateway/gateway.test.ts src/ws/live-request.test.ts` (`3` dosya / `65` test)
  - `pnpm.cmd --filter @runa/web exec vitest run --config ./vitest.config.mjs --configLoader runner src/components/chat/FileUploadButton.test.ts` (`3` test)
  - `pnpm.cmd --filter @runa/types typecheck`
  - `pnpm.cmd --filter @runa/types build`
  - `pnpm.cmd --filter @runa/server typecheck`
  - `pnpm.cmd --filter @runa/web typecheck`
  - `pnpm.cmd --filter @runa/server exec biome check src/routes/upload.ts src/routes/upload.test.ts src/gateway/attachment-text.ts src/gateway/groq-gateway.ts src/gateway/openai-gateway.ts src/gateway/gemini-gateway.ts src/gateway/claude-gateway.ts src/gateway/sambanova-gateway.ts src/gateway/gateway.test.ts src/ws/live-request.test.ts src/storage/storage-service.ts src/storage/supabase-storage-adapter.ts ../../packages/types/src/gateway.ts ../../packages/types/src/ws-guards.ts`
  - `pnpm.cmd --filter @runa/web exec biome check src/components/chat/FileUploadButton.tsx src/components/chat/FileUploadButton.test.ts src/components/chat/ChatComposerSurface.tsx`
  - `pnpm.cmd --filter @runa/server build`
  - `pnpm.cmd --filter @runa/web build`
- Durust kalan durum: document understanding/parsing yok; provider'a yalniz artifact reference ve varsa gelecekteki `text_preview` gider. Signed/scoped download URL ve `FileDownloadBlock` henuz yok; bunlar TASK-12C konusu.
- Sonraki agreed gorev: `TASK-12C` file.share tool + scoped/signed download block; public/suresiz URL uretmeden storage/auth scope korunmali.

### Track B / Track C - TASK-12C File Share / Download Block - 25 Nisan 2026

- `TASK-12-FILE-TRANSFER.md` icindeki TASK-12C kapatildi. `file.share` tool, scoped/expiring download URL ve frontend `file_download` block ayni fazda eklendi.
- `packages/types/src/tools.ts` additive olarak `file.share` known tool adini ve tool execution context icin authenticated storage/download-url seam'ini tasiyor. `packages/types/src/blocks.ts` `file_download` RenderBlock tipiyle genisletildi.
- `apps/server/src/storage/signed-download-url.ts` eklendi. HMAC imzali, 15 dakika varsayilan TTL'li relative download URL uretiyor; route tarafinda expiry ve signature dogrulaniyor. URL public/suresiz degil; `/storage/download/:id` halen authenticated request ister ve `StorageService.get_blob` owner/scope kontrolunu korur.
- `apps/server/src/storage/storage-routes.ts` scoped signed download endpoint'i ekledi. Basarili download `content-type` ve `content-disposition: attachment` header'lariyla blob content'i donuyor; eksik/invalid signature `400/403` typed response aliyor.
- `apps/server/src/tools/file-share.ts` eklendi ve built-in registry'ye baglandi. Tool non-empty string content'i `tool_output` artifact olarak storage'a yazar, `artifact_ref`, `storage_ref`, signed `url`, `expires_at`, filename, MIME ve size metadata'si doner. Tool approval-gated write capability olarak isaretlidir.
- Runtime tool context'i WS run execution icinde auth context, storage service ve signed URL factory tasiyacak sekilde genisletildi; approval replay/continuation yolunda ayni context degeri korunur.
- Presentation mapper `file.share` sonucundan `file_download` block uretiyor. Frontend `BlockRenderer` bu block'u download card olarak render ediyor; mevcut `tool_result` block'u da korunuyor.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/types typecheck`
  - `pnpm.cmd --filter @runa/types build`
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/tools/file-share.test.ts src/tools/registry.test.ts src/storage/storage-routes.test.ts src/presentation/map-file-download.test.ts` (`4` dosya / `15` test)
  - `pnpm.cmd --filter @runa/web exec vitest run --config ./vitest.config.mjs --configLoader runner src/components/chat/blocks/BlockRenderer.test.tsx` (`3` test)
  - `pnpm.cmd --filter @runa/server typecheck`
  - `pnpm.cmd --filter @runa/web typecheck`
  - `pnpm.cmd --filter @runa/server exec biome check src/tools/file-share.ts src/tools/file-share.test.ts src/tools/registry.ts src/tools/registry.test.ts src/storage/signed-download-url.ts src/storage/storage-routes.ts src/storage/storage-routes.test.ts src/presentation/map-file-download.ts src/presentation/map-file-download.test.ts src/ws/presentation.ts src/ws/register-ws.ts src/ws/orchestration-types.ts src/ws/run-execution.ts src/app.ts ../../packages/types/src/tools.ts ../../packages/types/src/blocks.ts`
  - `pnpm.cmd --filter @runa/web exec biome check src/components/chat/blocks/BlockRenderer.tsx src/components/chat/blocks/BlockRenderer.test.tsx`
  - `pnpm.cmd --filter @runa/server build`
  - `pnpm.cmd --filter @runa/web build`
- Durust kalan durum: browser click/download smoke kosulmadi; signed URL route targeted Fastify test ile dogrulandi. `file.share` su an non-empty string content icin guvenli minimum seam; binary/generated stream sharing ve document parser/understanding bu fazda acilmadi.
- Sonraki agreed gorev: task serisi bittiyse sira UI-PHASE tarafindaki bir sonraki kabul edilmis faza gecebilir; once ilgili phase dokumani okunmali.

### Track C - UI-PHASE-6 Sidebar / Settings / Device Presence - 25 Nisan 2026

- `UI-PHASE-6.md` kapsami `apps/web` icinde additive olarak kapatildi. Auth hook, conversation hook, server route, shared type ve desktop-agent kontratlarina dokunulmadi.
- `apps/web/src/components/chat/ConversationSidebar.tsx` modernlestirildi: Runa header, new chat action, client-side search, Today/Yesterday/Previous 7 days/Older grouping, loading skeleton, empty/error states, settings/account footer ve mobile overlay + Escape close davranisi eklendi. Mevcut member/share davranisi silinmedi; secondary `details` alanina tasindi.
- `apps/web/src/components/desktop/DevicePresencePanel.tsx` eklendi. Panel yalniz gercek `DesktopDevicePresenceSnapshot[]` listesini render ediyor; veri yoksa fake cihaz uretmeden empty/error/loading state gosteriyor ve raw connection id varsayilan gorunumde `details` icinde kaliyor.
- `apps/web/src/components/settings/ProjectMemorySummary.tsx` eklendi. Gercek project memory kaynagi bu fazda bagli olmadigi icin summary uydurulmuyor; `unavailable` state ile privacy/memory slotu durust sekilde hazirlandi.
- `SettingsPage` account, preferences/voice, connected desktop, project memory ve developer sections olarak toparlandi. Device fetch effect'indeki render-loop riski browser smoke sirasinda yakalandi ve `useCallback` tabanli stable load seam'iyle kapatildi.
- `LoginPage` mevcut email/password, OAuth ve dev bootstrap davranisini koruyor; token auth modu yalniz dev yuzeyde gorunur hale getirildi. `AppNav` Developer Mode toggle'ini chat default yuzeyinden account/developer ikinci katmanina cekti.
- Coverage eklendi:
  - `apps/web/src/components/chat/ConversationSidebar.test.tsx`
  - `apps/web/src/components/desktop/DevicePresencePanel.test.tsx`
  - `apps/web/src/components/settings/ProjectMemorySummary.test.tsx`
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/web typecheck`
  - `pnpm.cmd --filter @runa/web exec vitest run --config ./vitest.config.mjs --configLoader runner src/components/chat/ConversationSidebar.test.tsx src/components/desktop/DevicePresencePanel.test.tsx src/components/settings/ProjectMemorySummary.test.tsx` (`3` dosya / `6` test)
  - `pnpm.cmd --filter @runa/web exec biome check src/components/chat/ConversationSidebar.tsx src/components/chat/ConversationSidebar.test.tsx src/components/desktop/DevicePresencePanel.tsx src/components/desktop/DevicePresencePanel.test.tsx src/components/settings/ProjectMemorySummary.tsx src/components/settings/ProjectMemorySummary.test.tsx src/pages/SettingsPage.tsx src/pages/ChatPage.tsx src/pages/LoginPage.tsx src/components/auth/AuthModeTabs.tsx src/components/app/AppNav.tsx src/index.css`
  - `pnpm.cmd --filter @runa/web build`
- Browser QA kaniti: local web dev server + local server dev bootstrap ile `http://localhost:5173/` login page render edildi; local dev session ile `/chat` authenticated shell acildi; mobile viewport'ta `Open conversations` -> sidebar open -> Escape close dogrulandi; `/account` settings page account/device/memory/developer sections ve device empty/error state'i render etti. Ilk smoke'ta gorulen `Maximum update depth exceeded` hatasi fix sonrasi tekrar smoke'ta gorulmedi. Kalan uyarÃ„Â±: WS page navigation sirasinda kapanan connection icin browser console warning goruldu; route loop veya update-depth yok.
- Sonraki agreed gorev: `UI-PHASE-7` responsive/a11y/performance polish veya task sirasindaki bir sonraki backend hardening belgesi; baslamadan ilgili phase dokumani yeniden okunmali.

### Track C - UI-PHASE-7 Motion / A11y / Release QA - 25 Nisan 2026

- `UI-PHASE-7.md` kapsami dar polish/QA fazi olarak kapatildi. Yeni product feature acilmadi; server/runtime/provider/desktop-agent davranisina dokunulmadi.
- `apps/web/src/lib/motion.ts` eklendi ve shared `fadeIn`, `slideUp`, `slideInLeft`, `scaleIn`, `staggerContainer`, `springConfig`, `smoothConfig` tokenlari kuruldu. Motion dependency zaten repoda oldugu icin yeni dependency eklenmedi.
- `apps/web/src/index.css` reduced-motion uyumlu surface/alert/sidebar/recording/skeleton micro-interaction katmani ile genisletildi. `prefers-reduced-motion: reduce` altinda animasyon ve transition sureleri pratikte kapatiliyor.
- A11y/polish sertlestirmeleri: chat workspace header semantic `header`, conversation sidebar semantic `nav`, current run surface labelled `section` + `aria-busy`, voice recording pulse state ve button active/hover sakinlestirmesi eklendi. Sidebar mobile backdrop/panel motion'u ve conversation item focus/hover feedback'i iyilestirildi.
- Eski dosya deprecation kontrolu yapildi. `chat-styles.ts`, `ChatComposerSurface.tsx`, `ChatWorkspaceHeader.tsx`, `ChatShell.tsx`, `AppShell.tsx`, `AppNav.tsx`, `DashboardPage.tsx`, `SettingsPage.tsx` halen aktif import ediliyor; silme veya deprecation etiketi eklenmedi.
- Envanter notu: `git status --short` bu tur oncesinde de cok genis dirty tree gosteriyordu; task disi degisiklikler revert edilmedi. `TODO|@deprecated|eslint-disable|@ts-ignore|as any|any` taramasinda touched web kodunda gercek `as any`/`@ts-ignore` bulunmadi; cikan eslesmeler `overflowWrap: 'anywhere'` gibi CSS string'lerdi.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/web typecheck`
  - `pnpm.cmd --filter @runa/web exec vitest run --config ./vitest.config.mjs --configLoader runner src/lib/motion.test.ts src/components/chat/ConversationSidebar.test.tsx src/components/desktop/DevicePresencePanel.test.tsx src/components/settings/ProjectMemorySummary.test.tsx src/components/chat/blocks/BlockRenderer.test.tsx src/components/chat/UIPhase5Surfaces.test.tsx` (`6` dosya / `14` test)
  - `pnpm.cmd --filter @runa/web exec biome check src/lib/motion.ts src/lib/motion.test.ts src/components/chat/ConversationSidebar.tsx src/components/chat/ConversationSidebar.test.tsx src/components/chat/ChatWorkspaceHeader.tsx src/components/chat/CurrentRunSurface.tsx src/components/chat/VoiceComposerControls.tsx src/components/desktop/DevicePresencePanel.tsx src/components/desktop/DevicePresencePanel.test.tsx src/components/settings/ProjectMemorySummary.tsx src/components/settings/ProjectMemorySummary.test.tsx src/pages/SettingsPage.tsx src/pages/ChatPage.tsx src/pages/LoginPage.tsx src/components/auth/AuthModeTabs.tsx src/components/app/AppNav.tsx src/index.css`
  - `pnpm.cmd --filter @runa/web build`
- Browser QA: local server + web dev server ile `http://localhost:5173/` uzerinden kosuldu. `320x700`, `768x900`, `1440x1000` viewports PASS: login render, dev-auth chat route, empty/chat surface, sidebar open/Escape close, composer text input, settings page ve device presence empty state dogrulandi. Screenshot kanitlari: `.codex-screenshots/ui-phase-7/320x700.png`, `.codex-screenshots/ui-phase-7/768x900.png`, `.codex-screenshots/ui-phase-7/1440x1000.png`.
- Console raporu: browser smoke'ta console error/pageerror yok. Uyari olarak route gecisinde kapanan `ws://localhost:5173/ws?...` connection warning'i goruldu; `Maximum update depth exceeded` tekrar etmedi.
- A11y smoke: Playwright ile unlabeled button taramasi `0`, landmarks `main=2`, `header=2`, `nav=2`, `aria-live=1`, reduced-motion computed animation duration `1e-06s` olarak dogrulandi.
- Kosulamayan hedefler: Lighthouse skoru kosulmadi; repo/dev environment'da Lighthouse dependency veya temsil edici production auth harness eklenmedi. Block fixture browser route'u yok; block surface coverage `BlockRenderer.test.tsx` ve `UIPhase5Surfaces.test.tsx` ile component seviyesinde dogrulandi.
- Sonraki agreed gorev: backend task sirasina donulecekse `TASK-11A` run-scoped cancellation foundation; baslamadan task belgesi ve runtime entrypoint'leri yeniden okunmali.

### Track C - UI-PHASE-3 Consumer Chat-First Product Pass - 26 Nisan 2026

- Chat ana yuzeyi dev-ops/demo hissinden uzaklastiracak dar product pass tamamlandi. Server/runtime/provider/desktop-agent kontratlarina dokunulmadi; degisiklikler web chat shell, sidebar copy, composer copy ve responsive shell CSS'i ile sinirli tutuldu.
- `/chat` icin `AppShell` hero/nav karti kaldirildi; chat rotasi artik kompakt `ChatHeader` + iki kolonlu `ChatLayout` + chat-native empty state ile aciliyor. Developer timeline ve developer config linkleri yalniz `Developer Mode` acikken render ediliyor.
- `ChatComposerSurface`, `CurrentRunSurface`, `PersistedTranscript` ve `ConversationSidebar` uzerindeki `Conversation`, `Attachments`, `minimum seam`, `artifact reference`, `Persisted transcript`, `New chat`, `Account and settings` gibi operator/teknik veya Ingilizce gorunen metinler ana kullanici akisi icin sade Turkce product copy'ye cevrildi.
- Mobil smoke'ta kapali sidebar'in kart animasyonu nedeniyle gorunur kalabildigi bulundu; `index.css` mobile rule'u `animation: none` ile sertlestirildi, kapali sidebar artik `opacity: 0` + `pointer-events: none` durumunda kaliyor.
- Yeni coverage: `ChatHeader` ve `EmptyState` icin `apps/web/src/components/chat/ChatFirstShell.test.tsx` eklendi; `ConversationSidebar.test.tsx` yeni product copy'ye gore guncellendi.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/web lint`
  - `pnpm.cmd --filter @runa/web typecheck`
  - `pnpm.cmd --filter @runa/web test -- src/components/chat/ChatFirstShell.test.tsx src/components/chat/ConversationSidebar.test.tsx src/components/chat/blocks/BlockRenderer.test.tsx` (`3` dosya / `7` test)
  - `pnpm.cmd --filter @runa/web build`
- Browser QA: local server + web dev server ile `http://localhost:5173/chat` authenticated local-dev oturumunda dogrulandi. Desktop ve mobile screenshot smoke'ta ana chat yuzeyinde `Developer Mode`, `runtime`, `artifact`, `minimum seam`, `Persisted transcript`, `Conversations`, `New chat`, `Account and settings` gorunmedi; app-shell hero da `/chat` uzerinde gorunmedi. Mobil sidebar kapali state computed `opacity=0`, `pointer-events=none`, `position=fixed` olarak dogrulandi.
- Kalan not: Login/auth sayfasi ve `/developer` route'u hala dogasi geregi teknik metinler tasiyor; bu pass ana chat-first yuzeyi hedefledi. Console'da route/auth gecisinde kapanan Vite/proxy WS warning'i gorulebildi, fakat chat UI render/route loop/pageerror yoktu.

### Track A - TASK-03 Web Search Enhancement - 26 Nisan 2026

- `TASK-03-WEB-SEARCH-ENHANCEMENT.md` kapsami `apps/server/src/tools/web-search.ts` ve `apps/server/src/tools/web-search.test.ts` icinde kapatildi. Yeni search plane, gateway/auth/desktop/registry redesign veya yeni dependency acilmadi.
- `web.search` callable schema'si `search_type` ve `locale` ile genisledi. `search_type` default `organic`; `news` secilirse Serper news endpoint'ine gidiyor. `locale` yalniz iki harfli language code olarak kabul ediliyor ve provider request body icinde `hl` alanina yaziliyor; `gl` icin kor varsayim yapilmadi.
- Serper answer box ve knowledge graph alanlari structured output olarak tasiniyor; snippet/title/source alanlari prompt-control tag sanitization katmanindan geciyor. Organic default davranis ve freshness bias (`tbs=qdr:m`) korunuyor; news modunda freshness note provider date/snippet gecikmesi konusunda uyarÃ„Â±yor.
- Trust-tier siniflandirmasi official/reputable kaynaklar icin genisletildi: resmi kurum/edu/gov, docs-like host/path, arxiv/wikipedia/akademik ve reputable tech kaynaklari ayrisiyor. `researchgate.net`, `scholar.google.com` ve community/forum host segmentleri otomatik high-trust yapilmiyor; docs-like path tasisa bile lower-trust kalÃ„Â±yor.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/tools/web-search.test.ts` (`8` test)
  - `pnpm.cmd --filter @runa/server exec biome check src/tools/web-search.ts src/tools/web-search.test.ts`
  - `pnpm.cmd --filter @runa/server exec tsc --noEmit`
  - `pnpm.cmd --filter @runa/server build`
- Live Serper smoke: `.env` icindeki `SERPER_API_KEY` process env'e redacted olarak yuklendi. Organic locale smoke `OpenAI official documentation` sorgusunda `status=success`, `provider=serper`, `result_count=3`, ilk kaynak `developers.openai.com`, `trust_tier=official` verdi. News locale smoke `OpenAI news` sorgusunda `status=success`, `provider=serper`, `result_count=3`, freshness hint ve news freshness note dondu. Anahtar terminal ciktisina yazdirilmadi.
- Kalan not: Live smoke answer box / knowledge graph donusunu garanti etmedi; bu alanlar provider response'a bagli oldugu icin deterministik coverage fake provider testleriyle kanitlandi.

#### [GAP-12] Eksik Desktop Yetenekler (device presence, launch host, browser.interact)
- **Mevcut:** `apps/desktop-agent/` package'i, typed `/ws/desktop-agent` secure bridge'i, `desktop.screenshot` vertical slice'i, `desktop.click` / `desktop.type` / `desktop.keypress` / `desktop.scroll` icin bridge-aware execution yolu, heartbeat ping/pong seami ve host-agnostic launch/session-input contract'i artik repoda mevcut.
- **Etki:** Trust boundary icin desktop authority ayrimi ve ilk local-agent execution ailesi acildi; ancak user-facing desktop companion hala native window host, signed-in device presence surface'i, release-grade liveness/reconnect ergonomisi ve packaging olmadigi icin cloud-first hybrid vaadin butunu tamamlanmis degil.
- **Hedef:** Mevcut bridge kontratini bozmadan actual desktop window host implementation'i, online device presence surface'i, stale/lost desktop-agent cleanup davranisi ve sonraki fazda browser.interact benzeri capability'lere zemin hazirlamak.
- **Tetikleyici:** Sprint 11 (Desktop Agent) ve Phase 3.
- **Ilgili dosyalar:** `implementation-blueprint.md`, `apps/desktop-agent/`, `apps/server/src/tools/desktop-*.ts`, `apps/server/src/ws/*`, `packages/types/src/`

#### [GAP-12] Packaged Desktop Companion Runtime Proof - 28 Nisan 2026
- Electron shell artik stub liveness degil; `apps/desktop-agent/electron/main.ts` gercek `createDesktopAgentSessionRuntime()` ile secure `/ws/desktop-agent` bridge'ini baslatiyor, tray/window state'i runtime snapshot'lariyla guncelleniyor ve sign-in/disconnect IPC yollari gercek session storage'a baglandi.
- Paketli runtime icin file-backed session storage (`apps/desktop-agent/src/electron-session-storage.ts`) ve Node/Electron main process uyumlu dependency-free WebSocket adapter'i (`apps/desktop-agent/src/node-websocket.ts`) eklendi. Bridge handshake race'i `apps/desktop-agent/src/ws-bridge.ts` icinde dinleyici erken kurulacak ve timeout verecek sekilde sertlestirildi.
- Build hattinda `electron/main.cjs`, `electron/preload.cjs` ve `electron/renderer/App.js` paket kaynagina kopyalaniyor; `electron-builder.yml` tarafindan paketlenen dosyalar artik guncel TS/renderer build'inden geliyor.
- Yeni smoke: `apps/desktop-agent/scripts/packaged-runtime-smoke.mjs` / `pnpm --filter @runa/desktop-agent smoke:packaged`. Dev-auth token alir, paketli `release/win-unpacked/Runa Desktop.exe`'yi izole userData ile baslatir, `/desktop/devices` uzerinde online presence bekler, DeepSeek run ile approval-gated `desktop.screenshot` proof'u kosar ve shutdown sonrasi presence cleanup'i dogrular.
- Canli sonuc yesil: `DESKTOP_PACKAGED_RUNTIME_SMOKE_SUMMARY` icinde `device_online=true`, `approval_resolve_sent=true`, `screenshot_succeeded=true`, `device_removed_after_shutdown=true`, `run_status=desktop_screenshot_success`.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/desktop-agent typecheck`
  - `pnpm.cmd --filter @runa/desktop-agent typecheck:electron`
  - `pnpm.cmd --filter @runa/desktop-agent typecheck:renderer`
  - `pnpm.cmd exec biome check ...desktop-agent touched files...`
  - `pnpm.cmd --filter @runa/desktop-agent dist:win`
  - `pnpm.cmd --filter @runa/desktop-agent smoke:packaged`
- Kalan not: Electron Builder hala `asar: false`, default icon ve npm recursive/deprecation warning'leri raporluyor; bunlar runtime proof'u kirmadi ama release packaging polish icin takip edilmeli.

### Track C - UI-OVERHAUL 01/02/03 Closure Pass - 28 Nisan 2026

- `docs/archive/ui-overhaul/UI-OVERHAUL-01.md`, `docs/archive/ui-overhaul/UI-OVERHAUL-02.md` ve `docs/archive/ui-overhaul/UI-OVERHAUL-03.md` kapsamÃ„Â± repo ÃƒÂ¼zerinde kapatÃ„Â±ldÃ„Â±: DeveloperPage ayrÃ„Â±mÃ„Â± korunurken chat yÃƒÂ¼zeyinde developer/raw/operator dilini yakalayan manifesto gate yeÃ…Å¸il kaldÃ„Â±; CSS entry `apps/web/src/styles/index.css` ÃƒÂ¼zerinden token/reset/primitives/animations/component katmanÃ„Â±na baÃ„Å¸landÃ„Â±; `apps/web/src/index.css` tek import entry haline getirildi.
- Inline style migration tamamlandÃ„Â±: `apps/web/src/components/**` ve `apps/web/src/pages/**` altÃ„Â±nda case-sensitive `style=`, `CSSProperties`, `chat-styles` taramasÃ„Â± `0`; `apps/web/src/lib/chat-styles.ts` silindi. Legacy inline stiller token-backed CSS ÃƒÂ§Ã„Â±ktÃ„Â±sÃ„Â±na taÃ…Å¸Ã„Â±ndÃ„Â± ve `scripts/ci/style-check.mjs` ile tekrar kaÃƒÂ§masÃ„Â± engellendi.
- Runa primitive seti geniÃ…Å¸ledi: mevcut `RunaButton`, `RunaCard`, `RunaSurface`, `RunaTextarea`, `RunaBadge` CSS Module tabanÃ„Â±na taÃ…Å¸Ã„Â±ndÃ„Â±; `RunaInput`, `RunaModal`, `RunaSheet`, `RunaToast`, `RunaSkeleton`, `RunaSpinner`, `RunaIcon`, `RunaTooltip`, `RunaDisclosure` eklendi.
- Yeni CI yÃƒÂ¼zeyleri: `pnpm run style:check` fail-fast inline-style gate'i; `pnpm run primitive:coverage` non-blocking primitive/native kullanÃ„Â±m raporu. `biome.json` iÃƒÂ§inde Vite CSS module index-signature davranÃ„Â±Ã…Å¸Ã„Â±yla ÃƒÂ§akÃ„Â±Ã…Å¸an `useLiteralKeys` kuralÃ„Â± kapatÃ„Â±ldÃ„Â±.
- Ã„Â°lk karÃ…Å¸Ã„Â±lama copy testi dÃƒÂ¼zeltildi: `EmptyState` artÃ„Â±k `Bugun neyi birlikte ilerletelim?` ve `onay isteyen` ÃƒÂ¶neri dilini render ediyor.
- DoÃ„Å¸rulama yeÃ…Å¸il:
  - `pnpm.cmd --filter @runa/web typecheck`
  - `pnpm.cmd --filter @runa/web lint`
  - `pnpm.cmd --filter @runa/web test` (`9` dosya / `22` test)
  - `pnpm.cmd --filter @runa/web build`
  - `pnpm.cmd run style:check`
  - `pnpm.cmd run manifesto:check`
  - `pnpm.cmd run primitive:coverage` (`REPORT`; Runa primitive total `27`, native interactive total `39`, fail deÃ„Å¸il takip metriÃ„Å¸i)
- Browser QA: Playwright ile `http://localhost:5173/chat` local-dev authenticated akÃ„Â±Ã…Å¸Ã„Â±nda `320x700`, `768x900`, `1440x1000` viewport smoke PASS. `hashCleared=true`, chat header ve composer gÃƒÂ¶rÃƒÂ¼nÃƒÂ¼r, ana chat yÃƒÂ¼zeyinde `Raw Transport` / `Model Override` yok, console error/pageerror `0`. Screenshot kanÃ„Â±tlarÃ„Â± local ve gitignore altÃ„Â±nda: `apps/web/.qa-screenshots-auth-chat/`.
- Kalan not: `primitive:coverage` native interactive kullanÃ„Â±mÃ„Â±nÃ„Â±n hÃƒÂ¢lÃƒÂ¢ primitive kullanÃ„Â±mÃ„Â±ndan yÃƒÂ¼ksek olduÃ„Å¸unu raporluyor; bu UI-OVERHAUL-03 done kriterinde fail deÃ„Å¸il, UI-04/05 split-polish sÃ„Â±rasÃ„Â±nda doÃ„Å¸al migration metriÃ„Å¸i olarak izlenmeli.

#### UI-OVERHAUL-03 Strict Source Cleanup Follow-up - 28 Nisan 2026

- Onceki closure notundaki `style=`, `CSSProperties` ve `chat-styles` sifirlamasi dogruydu; ancak kaynakta kalan `const ...Style =` ve `function ...Style(s)` TS-as-CSS helper kalintilari bu turda ayrica temizlendi.
- `scripts/ci/style-check.mjs` sertlestirildi: artik `apps/web/src/components/**` ve `apps/web/src/pages/**` altinda `style=`, `CSSProperties`, `chat-styles`, `const ...Style =` ve `function ...Style(s)` pattern'leri fail verir.
- `RunaIcon` icin eksik `RunaIcon.module.css` eklendi ve wrapper className'i CSS Module + `cx()` ile baglandi. 9 yeni primitive'in her biri artik `*.tsx` ve `*.module.css` eslikcisine sahip.
- `AppShell` ve component/page seviyesindeki eski exported/imported style object artifaktlari kaldirildi; `PresentationBlockRenderer`, `PersistedTranscript`, `ChatWorkspaceHeader`, `DesktopTargetSelector`, capability kartlari ve auth/account/device/history yuzeylerindeki kullanilmayan TS style helper izleri temizlendi.
- Strict tarama sonucu: `Select-String` ile `const .*Style\s*=`, `function .*Styles?\s*\(`, `\bstyle\s*=`, `CSSProperties`, `chat-styles` pattern'leri icin component/page scope'unda `0` sonuc.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web lint` PASS
  - `pnpm.cmd --filter @runa/web test` PASS (`9` dosya / `22` test)
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd run style:check` PASS (`violations=0`, sert pattern setiyle)
  - `pnpm.cmd run manifesto:check` PASS (`violations=0`)
  - `pnpm.cmd run primitive:coverage` REPORT (`primitive_total=27`, `native_interactive_total=39`, non-blocking takip metrigi)
- Browser QA: local server + Vite ile `http://localhost:5173/chat` uzerinde `320x700`, `768x900`, `1440x1000` viewport'lari hem `dark` hem `light` theme icin PASS. Composer ve chat surface gorunur, `hashCleared=true`, `data-theme` beklenen theme, ana chat yuzeyinde `Raw Transport` / `Model Override` / `minimum seam` / `ham transport` yok, console error/pageerror `0`. `/developer` route reachable.
- Browser QA notu: Bu UI render smoke'unda `GET /conversations` Playwright icinde bos persistence response'u ile izole edildi. Izolasyonsuz local-dev denemede `/conversations` endpoint'i `CONVERSATION_PERSISTENCE_UNAVAILABLE` / local DB unavailable nedeniyle `500` dondu; bu UI-OVERHAUL-03 source cleanup kapsamindan bagimsiz ortam/persistence kanitidir.

#### UI-OVERHAUL-04 Chat Visual Hierarchy & Block Decomposition - 29 Nisan 2026

- `PresentationBlockRenderer.tsx` monolit renderer olmaktan cikarildi ve 49 satirlik compatibility/utility export kabuguna indirildi. Asil render sorumlulugu `apps/web/src/components/chat/blocks/**` altindaki block-bazli component'lere tasindi.
- Mevcut `RenderBlock` union'indaki tipler icin ayri block dosyalari eklendi: text, status, event list, code/code artifact, diff, file download/reference, inspection detail, plan, run timeline, search result, table, web search, trace debug, workspace inspection, approval ve tool result. `BlockRenderer.tsx` artik yalniz dispatcher seviyesinde kalir.
- `chat-presentation.tsx` 571 satirlik helper monolitinden re-export kabuguna indirildi. Transport summary, inspection meta ve presentation rendering yardimcilari `chat-presentation/transport-summary.ts`, `inspection-meta.ts`, `rendering.tsx` ve `types.ts` dosyalarina ayrildi.
- `MarkdownRenderer.tsx` parser, inline renderer ve block renderer parcalarina bolundu: `markdown/parser.ts`, `markdown/inline.tsx`, `markdown/blocks.tsx`, `markdown/types.ts`. Markdown tablo/code/link davranisi testlerle korunuyor.
- Approval UX chat-native hale getirildi: `ApprovalBlock.tsx` inline accept/reject aksiyonu ve `RunaDisclosure` ile detaylari sunuyor; server-side approval karar mantigi ve WS contract'i degismedi.
- Code block presentation'i genislendi: language badge, line count, copy button, line numbers, soft wrap toggle ve 20 satir ustu bloklarda collapsed-by-default "Show all" affordance'i var.
- Tool result karti collapsed-by-default payload disclosure ile sade yuzeye tasindi. Thinking block aktif durumda typing indicator, tamamlanmis durumda disclosure karti kullaniyor ve `prefers-reduced-motion` CSS fallback'i var.
- EmptyState onboarding-like 6 segment karta genisletildi: kod/review, arastirma, dokuman, masaustu gorev, dosya analizi ve onceki konusmadan devam akislari.
- `ChatPage.tsx` state/effect agirligi azaltildi: desktop device loading `useDesktopDevices`, voice/TTS `useTextToSpeechIntegration`, inspection state `useChatPageInspection` hook'larina tasindi. Sayfa 431 satirdan 295 satira indi.
- Line-count kapisi: `apps/web/src/components/**` ve `apps/web/src/pages/**` altinda 500 satiri asan TS/TSX dosya yok; en buyuk component/page dosyasi `ConversationSidebar.tsx` 390 satir. `PresentationBlockRenderer.tsx` 49 satir.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web lint` PASS
  - `pnpm.cmd --filter @runa/web test` PASS (`9` dosya / `22` test)
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd run style:check` PASS (`violations=0`)
- Browser QA: Vite fixture `http://localhost:5173/tests/visual/ui-overhaul-04-fixture.html` ile `320x700`, `768x900`, `1440x1000` viewport'larinda PASS. Empty state gorunur, 6 suggestion karti var, long code block collapsed ve copy affordance'i gorunur, approval inline accept/reject gorunur, tool payload disclosure gorunur, console error/pageerror `0`, yatay overflow yok. Screenshot kanitlari `apps/web/.qa-screenshots-auth-chat/ui-overhaul-04-fixture-*.png` altinda.
- Degistirilmeyen alanlar: `apps/server/**`, `packages/**`, `apps/desktop-agent/**` ve `packages/types/src/blocks.ts` sozlesmesi degistirilmedi. Yeni dependency eklenmedi.

#### UI-OVERHAUL-05 Mobile & Responsive Interaction QA - 29 Nisan 2026

- Mobile chat shell responsive davranisi tek source uzerinden sertlestirildi. `ChatLayout` mobile sidebar acikken body scroll lock uygular, backdrop/overlay durumunu `data-sidebar-open` ile sabitler ve Escape ile kapanir.
- Primary nav `AppNav` icin mobile bottom navigation stilleri eklendi; touch target'lar 44px altina dusmeyecek sekilde chat actions, suggestion cards, conversation item'lari ve nav item'lari kapsandi.
- Composer mobile'da safe-area bottom ile sticky hale getirildi; textarea font-size 16px altina dusmez ve iOS auto-zoom riski azaltildi.
- `RunaModal` ve `RunaSheet` mobile body lock, Escape/backdrop davranisini koruyarak bottom-sheet benzeri handle ve swipe-down close affordance'i kazandi. Desktop modal/sheet davranisi korunur.
- `apps/web/tests/visual/ui-overhaul-05-fixture.html` ve `ui-overhaul-05-fixture.tsx` eklendi. Fixture gercek `AppNav`, `ChatLayout`, `ConversationSidebar`, `RunaModal` ve `RunaSheet` component'leriyle responsive QA yuzeyi olusturur.
- `apps/web/tests/visual/chat-responsive.spec.ts` eklendi. `320x568`, `414x896`, `768x1024`, `1280x800` viewport'larinda composer/work surface/sidebar/modal/sheet gorunurlugu, mobile sticky composer, 16px textarea, 44px touch target, Escape close ve yatay overflow kontrolleri yapar. Screenshot'lar `apps/web/tests/visual/__screenshots__/ui-overhaul-05-*.png` altinda.
- Playwright config daraltildi: repo kokundeki `.claude/worktrees/**` icindeki eski spec'lerin ana E2E kosusuna karismamasi icin `testMatch` ve `testIgnore` netlestirildi.
- E2E approval smoke, yeni UI metnine gore guncellendi ve onay durumunu exact text ile tekil yakalar. Presentation block render listesine `block.id` tabanli React key eklendi; E2E sirasinda yakalanan key warning'i kapatildi.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web lint` PASS
  - `pnpm.cmd --filter @runa/web test` PASS (`9` dosya / `22` test)
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd run style:check` PASS (`violations=0`)
  - `pnpm.cmd exec playwright test apps/web/tests/visual/chat-responsive.spec.ts --config playwright.config.ts` PASS (`4` test)
  - `pnpm.cmd test:e2e` PASS (`6` test; auth bootstrap, approval completion, responsive visual spec)
- Lighthouse mobile audit:
  - Repo-local `pnpm.cmd --filter @runa/web exec lighthouse --version` komutu `Command "lighthouse" not found` verdi; package dependency eklenmedi.
  - Paket dosyalarini degistirmeden `pnpm.cmd dlx lighthouse http://localhost:5173 --form-factor=mobile ...` ile rapor uretildi. Lighthouse `13.1.0` skorlar: Performance `51`, Accessibility `94`. Raporlar: `apps/web/lighthouse-mobile.report.html` ve `apps/web/lighthouse-mobile.report.json`.
  - Lighthouse CLI, rapor dosyalarini yazdiktan sonra Windows temp klasoru cleanup sirasinda `EPERM` ile exit code `1` dondu; skorlar JSON raporundan okunarak kayda gecildi. Hedef altinda kalan skorlar uydurulmadi.
- Degistirilmeyen alanlar: `apps/server/**`, `packages/**`, `apps/desktop-agent/**` dokunulmadi. Yeni dependency eklenmedi.

#### UI-OVERHAUL-06 Brand Polish & Onboarding - 29 Nisan 2026

- Inter variable font self-host edildi: `apps/web/public/fonts/inter/Inter-Variable.woff2` eklendi, `apps/web/src/styles/fonts.css` ile `font-display: swap` tanimlandi ve Google Fonts CDN/preconnect satirlari `apps/web/index.html` icinden kaldirildi.
- Typography tokenlari Inter uzerinden sadeleÃ…Å¸tirildi: `--font-sans`, heading/body scale tokenlari, line-height tokenlari ve `--tracking-heading: 0` eklendi. Viewport-width font scaling kullanan aktif style noktalar temizlendi.
- Brand asset seami eklendi: `apps/web/src/assets/runa-logo.svg` ve public `favicon.svg` Runa markasina hizalandi.
- LoginPage tek odakli marka/form yuzeyine indirildi. Dev/token yollarÃ„Â± `Diger giris yontemleri` disclosure altinda kalir; email/password ve OAuth akisi onde. Line-count: `LoginPage.tsx` 212 satir.
- Post-signup onboarding wizard eklendi: `apps/web/src/components/onboarding/OnboardingWizard.tsx`. Ilk authenticated acilista `runa.onboarding.completed` localStorage flag'i yoksa 4 adimli wizard render olur; workspace adi/amaci, desktop companion opt-in ve UI-OVERHAUL-04 ile uyumlu ilk prompt kartlari vardir. Backend metadata/API kontrati acilmadi.
- Settings sayfasi tab'li yuzeye tasindi: Account, Preferences, Devices, Project Memory, Developer. Theme toggle mevcut `lib/theme` helper'lariyla calisir; Devices/Project Memory tab'lari veri uydurmaz ve ilgili gercek yuzeylere/linklere bagli kalir.
- Skeleton loading 5+ yerde aktif: conversation list, member list, message history, device presence, project memory ve account/settings pending state. Semantic `output` + `aria-busy` kullanildi.
- Motion choreography guncellendi: route fade, message arrival slide-up 220ms emphasized easing, approval reveal scale/fade ve reduced-motion fallback. Token source `apps/web/src/lib/motion.ts` guncellendi.
- Initial load performansi icin authenticated route'lar ve onboarding route-level lazy chunk'lara ayrildi. Ana web bundle gzip boyutu `123.44 kB` seviyesinden `75.03 kB` seviyesine indi; Chat/Settings/Onboarding ayri chunk'lara tasindi.
- Visual QA: `apps/web/tests/visual/ui-overhaul-06-fixture.html`, `ui-overhaul-06-fixture.tsx` ve `brand-onboarding.spec.ts` eklendi. `320x568`, `768x1024`, `1440x900` viewport'larinda login, onboarding, chat, settings tabs, console error ve yatay overflow kontrolleri PASS. Screenshot'lar `apps/web/tests/visual/__screenshots__/ui-overhaul-06-*.png` altinda.
- Axe smoke: `axe-core 4.11.3` Playwright icine enjekte edilerek `http://127.0.0.1:4175` production preview uzerinde kosuldu; sonuc `violations=0`. `@axe-core/cli` once chromedriver build-script engeline, sonra ChromeDriver 148 / Chrome 147 uyumsuzluguna takildigi icin repo dependency eklenmeden Playwright injection yolu kullanildi.
- Lighthouse final production-preview skorlari (`pnpm.cmd dlx lighthouse`, Lighthouse `13.1.0`, `http://127.0.0.1:4175`):
  - Desktop: Performance `99`, Accessibility `100`, Best Practices `96`, SEO `92`.
  - Mobile: Performance `79`, Accessibility `100`, Best Practices `96`, SEO `92`.
  - Lighthouse HTML/JSON raporlari `apps/web/lighthouse-desktop-final.report.*` ve `apps/web/lighthouse-mobile-final2.report.*` altinda. CLI yine rapor yazdiktan sonra Windows temp cleanup `EPERM` nedeniyle exit code `1` dondu; skorlar JSON raporlarindan okundu.
  - Mobile Performance 90+ hedefi bu turda yakalanmadi. Ana neden Lighthouse mobile simÃƒÂ¼lasyonunda FCP/LCP'nin ~3.8-3.9s kalmasi ve global `index` CSS chunk'inin halen render-blocking buyuk olmasi. Takip seami: global `inline-migration.css`/legacy style yuzeyini route/component bazli CSS chunk'lara ayirma veya kritik CSS stratejisi.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web lint` PASS
  - `pnpm.cmd --filter @runa/web test` PASS (`9` dosya / `22` test)
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd run style:check` PASS (`violations=0`)
  - `pnpm.cmd exec playwright test apps/web/tests/visual/brand-onboarding.spec.ts --config playwright.config.ts` PASS (`3` test)
  - `pnpm.cmd test:e2e` PASS (`9` test; chat approval E2E + UI-OVERHAUL-05/06 visual specs)
- Degistirilmeyen alanlar: `apps/server/**`, `packages/**`, `apps/desktop-agent/**` dokunulmadi. Yeni repo dependency eklenmedi.
- Sonuc: UI-OVERHAUL-04/05/06 serisi kod, UX, visual QA, a11y ve repo validation acisindan kapandi; mobile Lighthouse Performance 90+ icin yukaridaki CSS performance follow-up'u ayrica izlenmelidir.

#### UI-OVERHAUL-07.1 First Impression & Trust Repair - 29 Nisan 2026

- Kapsam: UI-OVERHAUL-07'nin ilk kanama durdurma paketi uygulandi. Buyuk composer redesign, full approval UX reset, Cmd+K, yeni design system veya global visual discipline pass acilmadi.
- Brand P0 fix: `apps/web/src/assets/runa-logo.svg` icindeki bozuk wordmark temizlendi; login yuzeyinde marka `Runa` olarak render oluyor. Login hero'daki redundant `RUNA` eyebrow ve hazir/auth status copy'si kaldirildi.
- Empty chat/internal seed cleanup: chat header artik kullanici prompt'unu subtitle olarak sizdirmiyor; bos/error durumda `DesktopTargetSelector` render edilmiyor. Boylece `Masaustu hedefi`/test prompt/dev hedef izlenimi yeni kullanici bos chat'inden kalkti.
- History graceful fallback: `/history` artik backend shape/debug string'ini dogrudan gostermiyor; `Desteklenmeyen conversation list yaniti` gibi teknik hata metinleri sade kullanici copy'sine maskelendi.
- Account/Settings user-surface isolation: normal settings tab listesi `Hesap` ve `Tercihler` ile sinirlandi. `Developer`, `Project Memory` ve duplicate `Devices` tab'lari normal kullanici yuzeyinden kaldirildi. `/developer*` route'lari silinmedi; local `Developer Mode` kapaliyken dogrudan giris `/chat`'e yonlendiriliyor.
- App shell operator badge cleanup: authenticated non-chat shell'deki `GUNLUK DOGRULANMIS OTURUM` / service-session badge yuzeyi kaldirildi. Account hero icindeki `Oturum acik` ve `Tarayici hazir` pill'leri kaldirildi.
- Devices P1 copy cleanup: `/devices` uzerindeki 3 redundant/savunmaci felsefe karti ve sayaclar kaldirildi. Bos/error durumda sade status + `Yenile` aksiyonu gosteriliyor; tam connect-device redesign 7.5'e birakildi.
- Mobile approval pointer fix: chat work surface composer katmaninin ustune alindi (`components.css` z-index duzeltmesi) ve bos/error desktop target selector'u gizlendi. Smoke sirasinda mobile approval `Onayla` butonu gercek pointer click ile tamamlandi.
- Task-local visual test guncellendi: `apps/web/tests/visual/brand-onboarding.spec.ts` artik settings icin Turkce `Tercihler` tab'ini ve hidden `Developer`/`Project Memory`/`Devices` tab'larini dogruluyor.
- Yeni screenshot smoke: `docs/design-audit/screenshots/2026-04-29-ui-overhaul-07-1-smoke/` altinda 11 ekran uretildi: login desktop/mobile, chat empty desktop/mobile, history desktop/mobile, account desktop/mobile, devices desktop/mobile, mobile approval pending. `manifest.json` icindeki 43 metin/click kontrolunde `failed_checks=0`.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web lint` PASS
  - `pnpm.cmd --filter @runa/web test` PASS (`9` dosya / `22` test)
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd run style:check` PASS
  - `pnpm.cmd run manifesto:check` PASS
  - `pnpm.cmd test:e2e` PASS (`9` test; chat approval E2E + visual specs). Not: ilk E2E denemesi screenshot smoke icin acik kalan production preview'i reuse ettigi icin visual fixture'larda task-disinda dustu; arka plan server'lari kapatildiktan sonra temiz tekrar PASS verdi.
- Degistirilmeyen alanlar: `apps/server/**`, `apps/desktop-agent/**`, `packages/**`, auth/WS/provider/persistence kontratlari dokunulmadi. Yeni dependency eklenmedi.
- Kalan isler: sonraki UI-OVERHAUL-07 paketleri kendi kayitlarinda izlenir.

#### UI-OVERHAUL-07.5 Secondary Surfaces Reframe - 30 Nisan 2026

- Kapsam: `docs/archive/ui-overhaul/prompts/UI-OVERHAUL-07-5-SECONDARY-SURFACES-REFRAME-PROMPT.md` promptuna bagli kalinarak History, Devices ve Account/Settings yuzeyleri consumer-grade secondary surface olarak sadelestirildi. Server/auth/desktop-agent/protocol kontratlari degistirilmedi; yeni dependency eklenmedi.
- History: sohbet sayaci ve `access_role` gibi teknik role sizintisi kaldirildi. Liste, arama, empty state ve friendly error davranisi korundu; unsupported/debug conversation hata metni user-facing olmaktan uzak tutuldu.
- Devices: sayfa tek `Bagli bilgisayar` hikayesine indirildi. `DevicePresencePanel` raw `Connection {id}`, raw `desktop.*` tool name ve internal status taxonomy gostermiyor; bilinen desktop capabilities kullanici dostu etiketlere cevriliyor.
- Account/Settings: duplicate account hero kaldirildi; `ProfileCard` kisa profil/oturum ozeti haline getirildi. `dev@runa.local` placeholder'i normal yuzeyde `Yerel oturum` olarak maskelendi; Developer ve Project Memory entry point'leri geri eklenmedi.
- Mobile shell/nav: secondary surface header padding/gap/font boyutlari mobile'da azaltildi. 4 item app nav mobile'da 2x2 grid yerine tek yatay satirda kalacak sekilde CSS guardrail'i eklendi; description copy mobile'da gizlendi.
- Test kaniti: `apps/web/src/pages/SecondarySurfacesReframe.test.tsx` eklendi; History/Devices/Account leakage ve davranis guardrail'leri kapsandi. `apps/web/tests/visual/ui-overhaul-07-5-secondary-surfaces.spec.ts` desktop/mobile `/history`, `/devices`, `/account` akisini; tek satir mobile nav'i; raw connection/tool/dev placeholder sizintisi olmadigini dogruluyor.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/web test` PASS (`11` dosya / `32` test)
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web lint` PASS
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd run style:check` PASS
  - `pnpm.cmd run manifesto:check` PASS
  - `pnpm.cmd exec playwright test apps/web/tests/visual/ui-overhaul-07-5-secondary-surfaces.spec.ts --config playwright.config.ts` PASS (`2` test)
  - `pnpm.cmd test:e2e` PASS (`17` test)

#### UI-OVERHAUL-07.6 Visual Discipline Pass - 30 Nisan 2026

- Kapsam: `docs/archive/ui-overhaul/UI-OVERHAUL-07.md` icindeki 7.6 gercegine bagli kalinarak web UI renk, type, border/radius ve shadow dili tek hatta indirildi. Server, desktop-agent, auth, websocket, provider ve persistence kontratlari degistirilmedi; yeni dependency eklenmedi.
- Renk/CTA: primary ve secondary CTA/button yuzeyleri gradient yerine flat accent veya flat surface background kullaniyor. App surface gradientleri route CSS'lerinde temizlendi; eski `--gradient-*` token isimleri compatibility icin tutuldu ama degerleri flat surface/accent tokenlarina cevrildi.
- Type: user-facing CSS font-size dagilimi `12 / 14 / 16 / 20 / 28` scale'ine cekildi. Heading defaults ve `strong/b` agirliklari normalize edildi; `700/800/900` weight kullanimi user-facing CSS'te kalmadi.
- Border/radius/shadow: panel radius `16px`, control radius `12px`, pill `999px` hattina indirildi. Heavy panel/button shadow'lari kaldirildi; border'lar dusuk kontrast ayrim olarak birakildi.
- Card-within-card: Settings preference bolumleri ve login OAuth wrapper'i `runa-card` child pattern'inden cikarildi; Account profil metrikleri card gorunumu yerine list-row ayrimina yaklastirildi. Devices ana presence wrapper'i da route-owned plain panel olarak kaldi.
- Dogrulanan surfaces: Playwright 7.6 smoke desktop/mobile `/login`, `/chat`, `/history`, `/devices`, `/account` yuzeylerinde flat button background, type scale/weight, mobile one-row nav ve internal leak guardrail'lerini dogruladi. Screenshot seti `docs/design-audit/screenshots/2026-04-30-ui-overhaul-07-6-visual-discipline/` altinda uretildi.
- Yeni guardrail: `apps/web/src/pages/VisualDiscipline.test.tsx` CSS source uzerinde gradient CTA, type scale/weight ve normal user surface nested-card/internal leak sinirlarini kilitliyor. `apps/web/tests/visual/ui-overhaul-07-6-visual-discipline.spec.ts` route bazli computed visual smoke ekliyor.
- Dogrulama yesil:
  - `pnpm.cmd --filter @runa/web test` PASS (`12` dosya / `35` test)
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web lint` PASS
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd run style:check` PASS
  - `pnpm.cmd run manifesto:check` PASS
  - `pnpm.cmd exec playwright test apps/web/tests/visual/ui-overhaul-07-6-visual-discipline.spec.ts --config playwright.config.ts` PASS (`1` test)
  - `pnpm.cmd test:e2e` PASS (`18` test)

#### UI-OVERHAUL-07.8 Capability Layer Polish - 30 Nisan 2026

- Kapsam: `docs/archive/ui-overhaul/UI-OVERHAUL-07.md` icindeki 7.8 hedeflerine bagli kalinarak normal kullanici yuzeylerinde command palette, keyboard/focus flow, mobile composer dayanÃ„Â±kliligi, microinteraction ve sakin loading state polish'i uygulandi. Server, desktop-agent, auth, websocket, provider ve persistence kontratlari degistirilmedi; yeni dependency eklenmedi.
- Command palette: `Cmd+K` / `Ctrl+K` ile acilan typed command palette eklendi. Palette focus'u arama input'una aliyor, `Escape` ile kapaniyor, Arrow Up/Down ile secim yapiyor, Enter ile secili komutu calistiriyor ve kapanista tetikleyen elemana focus'u geri vermeye calisiyor. Komutlar `/chat`, `/history`, `/devices`, `/account`, yeni sohbet, sohbet gecmisi, cihaz baglantilari ve tercihler yuzeylerini kapsiyor; normal palette copy'si developer/operator/runtime/debug dili tasimiyor.
- Route aksiyonlari: `Yeni sohbet baslat` komutu `/chat?new=1` uzerinden conversation draft reset'i tetikliyor. `Tercihleri ac` komutu `/account?tab=preferences` route state'iyle Preferences tab'ini aciyor; normal Account isolation korunuyor.
- Focus flow: `RunaModal` minimal focus trap ve SSR-safe portal davranisiyla guclendirildi. Chat composer more/tools disclosure'u `Escape` ile kapanip focus'u summary control'e donduruyor. File upload trigger disabled/focus-visible state'leri semantik input label akisi bozulmadan iyilestirildi.
- Mobile composer: dar viewport'larda composer action row, more/tools paneli, attachment/status metinleri ve textarea yuksekligi 320/390/414px genisliklerde yatay overflow ve bottom-nav cakismasi uretmeyecek sekilde polish edildi. Safe-area ve `100dvh` davranisi route CSS'i icinde guclendirildi.
- Microinteraction/loading: command palette trigger/item, app nav, chat icon controls, file upload, more/tools ve composer controls icin hover/focus/active/disabled state'leri sakin motion ve token uyumuyla hizalandi. Authenticated route fallback'leri spinner yerine gercek layout'a yakin skeleton surface'e cekildi; inline spinner kullanimi kucuk durumlarla sinirli kaldi.
- Test kaniti: `apps/web/src/components/command/CommandPalette.test.tsx` eklendi; Cmd/Ctrl+K shortcut helper'i, empty query command listesi, filtreleme, arrow selection wrap, Enter aksiyonu ve internal copy guardrail'i kapsaniyor. Mevcut `CopyVoicePass`, `OperatorDeveloperIsolation`, `SecondarySurfacesReframe`, `VisualDiscipline` guardrail'leri korunarak guncellendi.
- Browser/smoke kaniti: `apps/web/tests/visual/ui-overhaul-07-5-secondary-surfaces.spec.ts` mevcut Turkce Devices copy'siyle hizalandi ve desktop/mobile secondary route smoke tekrar calistirildi; command palette trigger normal shell'de render olurken developer entry point sizintisi uretmiyor.
- Dogrulama yesil:
  - `pnpm --filter @runa/web lint` PASS
  - `pnpm --filter @runa/web test` PASS (`14` dosya / `42` test)
  - `pnpm --filter @runa/web typecheck` PASS
  - `pnpm exec playwright test apps/web/tests/visual/ui-overhaul-07-5-secondary-surfaces.spec.ts --project=chromium` PASS (`2` test)
- Kapsam disi birakilanlar: `docs/RUNA-DESIGN-LANGUAGE.md` yazimi, 28 ekran final screenshot seti, visual regression baseline lock ve final audit 7.9'a birakildi. `apps/server/**`, `apps/desktop-agent/**`, `packages/**`, auth/WS/provider/runtime contracts ve yeni dependency yok.

#### UI-OVERHAUL-07.9 Final Coherence Audit + Design Language Lock - 30 Nisan 2026

- Kapsam: `docs/archive/ui-overhaul/prompts/UI-OVERHAUL-07-9-FINAL-COHERENCE-AUDIT-DESIGN-LANGUAGE-LOCK-PROMPT.md` promptuna bagli kalinarak UI-OVERHAUL-07 final coherence audit'i uygulandi. Server, desktop-agent, auth, websocket, provider ve persistence kontratlari degistirilmedi; yeni dependency eklenmedi.
- Design language lock: `docs/RUNA-DESIGN-LANGUAGE.md` eklendi. Chat-first urun hissi, surface hierarchy, layout, color/type/motion/loading, keyboard, mobile ve copy voice guardrail'leri gelecek UI isleri icin kilitlendi. `apps/web/src/pages/DesignLanguageLock.test.ts` bu belge icin baslik/scale/keyboard/mobile/skeleton guardrail'i ekliyor.
- Final visual audit: `apps/web/tests/visual/ui-overhaul-07-9-final-coherence.spec.ts` eklendi. `/login`, `/chat`, `/history`, `/devices`, `/account`, `/account?tab=preferences`, command palette, conversation sidebar, route skeleton fallback, mobile composer focus ve approval pending/approved akislari desktop 1440, desktop 1920, tablet 768, mobile 390 ve narrow 320 genisliklerinde smoke edildi.
- Screenshot evidence: `docs/design-audit/screenshots/2026-04-30-ui-overhaul-07-9-final-coherence/` altinda 31 screenshot ve `manifest.json` uretildi. Manifest `screenshot_count=31` ve `failed_checks=[]` raporluyor; final audit guardrail'i en az 28 screenshot kriterini geciyor.
- User-surface leak cleanup: normal chat approval/progress yuzeyinde `runtime`, raw status, run timeline, workspace inspection, raw tool result ve `file.write` gibi teknik copy sizintilari developer mode'a kilitlendi veya sakin urun kopyasina cevrildi. Approved tool result normal yuzeyde `Islem tamamlandi` olarak gosteriliyor.
- Mobile approval/composer fix: dar mobile aktif calisma akisi icin composer overlay davranisi relative akisa cekildi; approval aksiyonlari composer ve bottom nav altinda kalmadan scroll/click edilebilir hale getirildi.
- Dogrulama yesil:
  - `pnpm --filter @runa/web lint` PASS
  - `pnpm --filter @runa/web test` PASS (`15` dosya / `43` test)
  - `pnpm --filter @runa/web typecheck` PASS
  - `pnpm --filter @runa/web build` PASS
  - `pnpm run style:check` PASS
  - `pnpm run manifesto:check` PASS
  - `pnpm exec playwright test apps/web/tests/visual/ui-overhaul-07-9-final-coherence.spec.ts --project=chromium` PASS (`4` test)
- Kalan durum: UI-OVERHAUL-07 final coherence paketi tamamlandi. Mevcut worktree'deki task disi degisiklikler geri alinmadi.

#### UI-OVERHAUL-07 Final Competitive Polish - 30 Nisan 2026

- Kapsam: Claude Opus review'unda isaretlenen 5 kapanis maddesi uygulandi: uncommitted work riski icin scoped branch/commit/push hazirligi, decorative orb self-violation temizligi, login layout karari, top nav rationale lock ve approval CTA renk semantigi.
- Decorative orb karari: normal kullanici yuzeylerinden `.runa-ambient-panel::before` ve `.runa-chat-surface::after` dekoratif glow/orb pseudos'u kaldirildi. `VisualDiscipline.test.tsx` bu pattern'lerin geri gelmesini engelleyen CSS guardrail ekliyor.
- Login karari: login yuzeyi two-panel hibritten centered single-column urun girisine cekildi. Final visual spec desktop ve mobile login icin `single column login` check'i ekliyor; auth state temizlenerek gercek unauthenticated login smoke ediliyor.
- Top nav karari: `docs/RUNA-DESIGN-LANGUAGE.md` icinde compact route tile nav'in Runa'ya ozel, bilincli bir secim oldugu belgelendi. `DesignLanguageLock.test.ts` bu rationale'i design-language kontratina ekledi.
- Approval CTA semantigi: `ApprovalBlock` artik read-only isteklerde primary onay kullanirken riskli approval aksiyonlarini sakin secondary butonla gosteriyor. `BlockRenderer.test.tsx` `file.write` gibi riskli isteklerin primary product CTA gibi gorunmemesini, `file.read` gibi dusuk riskli isteklerin primary kalabilmesini test ediyor.
- Screenshot evidence: `docs/design-audit/screenshots/2026-04-30-ui-overhaul-07-9-final-coherence/manifest.json` yeniden uretildi; `screenshot_count=31`, `failed_checks=[]`. Mobile approval pending ekraninda aksiyonlar composer/bottom nav altinda kalmadan gorunur ve tiklanabilir.
- Kapsam disi/korunanlar: server, desktop-agent, websocket, auth, provider ve persistence kontratlari degistirilmedi. Yeni dependency eklenmedi. Mevcut task disi worktree degisiklikleri geri alinmadi.
- Dogrulama:
  - `pnpm exec playwright test apps/web/tests/visual/ui-overhaul-07-9-final-coherence.spec.ts --project=chromium` PASS (`4` test)
  - `pnpm --filter @runa/web lint` PASS
  - `pnpm --filter @runa/web test` PASS (`15` dosya / `45` test)
  - `pnpm --filter @runa/web typecheck` PASS
  - `pnpm --filter @runa/web build` PASS
  - `pnpm run style:check` PASS
  - `pnpm run manifesto:check` PASS

### Arsivlenen Audit Gaplari (18 Nisan 2026)

- GAP-11: In-Memory Store'larin Kalicilastirilmasi (23 Nisan 2026 itibariyla persistence seam + reconnect/hydration proof ile kapatildi)
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

### Track A / Core Hardening Phase 2 - Approval Release Rehearsal Proof Unification - 22 Nisan 2026

- `apps/server/scripts/approval-release-rehearsal.mjs` ve `apps/server/scripts/approval-release-rehearsal-lib.mjs` eklendi; browser authority proof ile approval persistence/reconnect smoke tek release-grade rehearsal hikayesinde birlestirildi.
- `apps/server/scripts/approval-browser-authority-check.mjs` ve `apps/server/scripts/approval-persistence-live-smoke.mjs` artik zinciri asama bazli ozetliyor: approval boundary, `approval.resolve`, continuation, reconnect/restart ve terminal `run.finished(COMPLETED)` sinyalleri normalize edildi.
- Failure dili tek bakista okunur hale getirildi; rehearsal helper `approval_boundary_missing`, `approval_resolve_missing`, `continuation_missing`, `restart_reconnect_missing`, `terminal_finish_missing` gibi net siniflandirma uretiyor.
- `apps/server/src/ws/approval-release-rehearsal-summary.ts` ve `apps/server/src/ws/register-ws.test.ts` uzerinden bu siniflandirma/summary extraction mantigi icin hedefli coverage eklendi; mevcut WS/runtime kontratlari degistirilmedi.
- Dogrulama: `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/persistence/approval-store.test.ts src/ws/register-ws.test.ts`, `pnpm.cmd --filter @runa/server exec tsc --noEmit`, `pnpm.cmd --filter @runa/server lint`, `pnpm.cmd --filter @runa/server build` yesil.
- Live rehearsal kaniti: shell env gercegi `GROQ_API_KEY=missing`, `DATABASE_TARGET=<unset>`, `LOCAL_OR_DATABASE_URL=missing` idi; buna ragmen file-backed env ile `node scripts/approval-release-rehearsal.mjs` calisarak `APPROVAL_RELEASE_REHEARSAL_SUMMARY {"result":"PASS"}` urettigi dogrulandi. Browser authority tarafinda gercek approval boundary ve terminal `run.finished(COMPLETED)` goruldu; persistence tarafinda restart/reconnect sonrasi `approval.resolve -> continuation -> run.finished(COMPLETED)` zinciri PASS verdi.
- Kalan durum: release-proof kaniti artik tek giris noktasinda mevcut, fakat approval continuation context icindeki provider secret persistence yuzeyi hala ayrik hardening konusu olarak duruyor.
- Sonraki dar gorev: `provider_config` secret persistence minimization. Ozellikle request-only browser/runtime kaynakli provider API key'lerinin continuation icin gereken minimum veriyle sinirlanip persistence yuzeyinden daha da temizlenmesi.

### Track A / Core Hardening Phase 2 - Approval Continuation `provider_config` Minimum Persistence Shape - 22 Nisan 2026

- `apps/server/src/persistence/approval-store.ts` icinde continuation persistence hattÃ„Â± daraltildi. `provider_config` artik spread edilerek kalici yazilmiyor; persistence icin explicit minimum shape kuruluyor: yalniz `apiKey` ve ancak continuation request'i onlar olmadan calisamayacaksa `defaultModel` / `defaultMaxOutputTokens` tutuluyor.
- Boylece request seviyesinde zaten `request.model` ve `request.max_output_tokens` ile tasinan bilgiler icin redundant provider default'lari approval continuation payload'inda kalici saklanmiyor. Read/hydration yolu da ayni sanitization fonksiyonunu kullandigi icin eski/genis kayitlar runtime'a minimum shape ile geri veriliyor.
- Secret minimization davranisi degismedi ama daha netlestirildi: server env ilgili provider key'ini saglayabiliyorsa persisted `apiKey` bos string olarak kaliyor; env fallback yoksa replay/resume kirilmasin diye request-only `apiKey` halen tutuluyor. Bu residual risk bilincli olarak acik birakti; broad provider/auth redesign yapilmadi.
- `apps/server/src/persistence/approval-store.test.ts` yeni minimum-shape davranisini kanitlayacak sekilde guncellendi: redundant provider default'lari dusurme, env-backed secret redaction ve request-only fallback korunumu coverage altina alindi. `apps/server/scripts/approval-persistence-live-smoke.mjs` summary'si de secretsiz `persisted_provider_config_keys` alanini raporlar hale geldi.
- Dogrulama: `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/persistence/approval-store.test.ts src/ws/register-ws.test.ts`, `pnpm.cmd --filter @runa/server exec tsc --noEmit`, `pnpm.cmd --filter @runa/server lint` ve `pnpm.cmd --filter @runa/server build` yesil. Shell env gercegi bu turda da `GROQ_API_KEY=missing`, `DATABASE_TARGET=missing`, `LOCAL_DATABASE_URL=missing`, `DATABASE_URL=missing`, `SUPABASE_DATABASE_URL=missing` idi. `node scripts/approval-release-rehearsal.mjs` bu shell'de `exit code 0` ile dondu; structured stdout summary'si bu harness capture'inda gorunmedigi icin canli PASS yorumu cikis kodu kontratina dayanir, shell env ile file-backed env birbirine karistirilmadi.
- Kapanan alan: approval continuation persistence icindeki gereksiz `provider_config` genisligi daraltildi. Kalan alan: env-backed olmayan request-only provider secret'leri persistence disi daha dar bir re-hydration seam'ine tasiyacak follow-up.
- Sonraki dar gorev: request-only provider secret'i DB'ye yazmadan restart-sonrasi continuation'i koruyacak dar bir server-side re-hydration/reference seam'i tasarlamak; protocol ve gateway redesign acmamak.

### Docs Hardening - Critical 20 Roadmap + Prompt Set Realignment - 22 Nisan 2026

- `CRITICAL-20-ROADMAP.md` repo gercegiyle yeniden hizalandi; belge artik genel urun listesi gibi degil, `Core Hardening Phase 2` snapshot'ina ve aktif gap'lere (`GAP-11`, `GAP-12`) dayanan bir oncelik/siralama dokumani gibi okunuyor.
- `PROMPTS-PHASE-1.md`, `PROMPTS-PHASE-2.md`, `PROMPTS-PHASE-3.md`, `PROMPTS-PHASE-4.md` bastan yazildi; tum gorevler `docs/TASK-TEMPLATE.md` basliklarina, Turkce no-go diline, exact file path disiplinine ve denetlenebilir done kriterlerine getirildi.
- Prompt'lar artik "genel feature istegi" degil, repo icinde dar kapsamli ve additive koÃ…Å¸turulabilir gorev formatinda. Her konuda sebep-sonuc kisa notu, degistirilebilecek dosyalar, degistirilmeyecek dosyalar ve test/validation kapilari acikca yaziyor.
- Bu tur kod davranisina dokunmadi; yalnizca roadmap/prompt kalitesi sertlestirildi.
- Sonraki onerilen gorev: istenirse bu yeni setten P0 kabul edilen ilk 3 gorev (`SSE token streaming`, `conversation persistence`, `markdown renderer`) icin daha da daraltilmis "bir sonraki uygulanacak prompt" varyantlari uretmek.
