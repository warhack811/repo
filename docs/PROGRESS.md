# Runa - Operasyonel Durum Kaydi

> Bu belge, Runa projesinin kronolojik ilerleyisini ve yonunu kaydeder.
> Detaylar, kararlar ve teknik debt buraya listelenir.
> Sprint 1-6 (MVP Phase 1) detaylari icin bkz: `docs/archive/progress-phase1.md`
> Ekip kararlari icin bkz: `docs/archive/cevap-ekip-kararlari.md`

## Mevcut Durum Ozeti

- **Tarih:** 14 Mayis 2026
- **Faz:** Core Hardening (Phase 2) + UI Restructure tamamlandi (PR-1..PR-12).
- **Vizyon:** Basit kullanicidan teknik uzmana kadar herkesin kullanabilecegi, otonom ve uzaktan kontrol yeteneklerine sahip, cloud-first bir AI calisma ortagi.
- **Odak:** UI restructure kapandi; sirada provider/runtime baseline genisletmesi ve plan-disi UI bosluklari (empty state personalization, markdown rendering).
- **Son Onemli Olay:** 2026-05-14 tarihinde "UI Restructure PR-1..PR-12" sureci kapatildi; tasarim dili `docs/RUNA-DESIGN-LANGUAGE.md` icinde tek otoriteye kilitlendi, design-language lock test PR-1..9 + Settings IA + PR-11 memo discipline kurallarini kapsayacak sekilde genisletildi, Lighthouse + screen reader + dead-css kanitlari arsivlendi.

### TASK-UI-RESTRUCTURE-PR-14-RUN-ACTIVITY-FEED-INLINE-APPROVAL - 15 Mayis 2026

- Kapsam: `run_timeline_block`, `tool_result`, `approval_block` yuzeyleri ortak activity feed diline tasindi; backend contract/protocol degistirilmedi.
- Uygulama:
  - Yeni activity seam eklendi: `apps/web/src/components/chat/activity/RunActivityFeed.tsx`, `RunActivityRow.tsx`, `TerminalDetails.tsx`, `ApprovalActivityRow.tsx`, `runActivityAdapter.ts`, `RunActivityFeed.module.css`.
  - `RunTimelineBlock.tsx`, `ToolResultBlock.tsx`, `ApprovalBlock.tsx` yeni adapter + feed katmanina baglandi.
  - Tool satirlari varsayilan kapali detay (Ayrintilar) ile render ediliyor; terminal detay paneli `stdout/stderr/exit code/duration/command` alanlarini varsa acilir alanda gosteriyor.
  - Approval artik feed icinde inline risk satiri olarak geliyor; pending durumda `Reddet/Onayla`, resolved durumda kompakt durum satiri (`Izin verildi/Reddedildi/Suresi doldu/Vazgecildi`) gorunuyor.
  - Developer mode teknik alanlari ana satira tasimadan acilir detay altinda koruyor; non-dev modda `call_id`, `tool_name`, raw id/payload gizli.
- Test:
  - Yeni unit: `apps/web/src/components/chat/activity/runActivityAdapter.test.ts`
  - Guncellenen render/lock testleri: `apps/web/src/components/chat/blocks/BlockRenderer.test.tsx`, `apps/web/src/test/design-language-lock.test.ts`
  - Guncellenen visual smoke: `apps/web/tests/visual/ui-overhaul-07-3-smoke.spec.ts` (activity feed locator/semantik + pending/resolved/mobile/details/non-dev leakage contract)
  - Komut sonuclari:
    - `pnpm.cmd --filter @runa/web lint` PASS
    - `pnpm.cmd --filter @runa/web typecheck` PASS
    - `pnpm.cmd --filter @runa/web test` PASS (`42` dosya / `160` test PASS, `1` skipped)
    - `pnpm.cmd --filter @runa/web build` PASS
    - `pnpm.cmd --filter @runa/web test -- src/components/chat/activity/runActivityAdapter.test.ts src/components/chat/blocks/BlockRenderer.test.tsx src/test/design-language-lock.test.ts src/pages/OperatorDeveloperIsolation.test.tsx` PASS
- Manual smoke:
  - `pnpm.cmd exec playwright test apps/web/tests/visual/ui-overhaul-07-3-smoke.spec.ts --config playwright.config.ts --workers=1` PASS (`2` test)
  - Pending approval satiri yeni contract ile dogrulandi: activity-feed list aria (`Calisma etkinlik akisi`), `data-activity-kind="approval"`, `Izin gerekiyor`, target chip, `Reddet` + `Onayla|Yine de devam et`.
  - Approved/resolved contract dogrulandi: `Izin verildi`, pending CTA'lar geri gelmiyor, tool/result akis satirlari devam ediyor.
  - Mobile 390/320 contract dogrulandi: horizontal overflow yok, approval CTA'lari composer/bottom nav altinda kalmiyor, row viewport'a sigiyor.
  - Detail behavior dogrulandi: en az bir activity row'da `Ayrintilar` toggle aciliyor, detay alani gorunuyor ve non-dev modda raw `call_` / raw tool id sizmiyor.
- Acik risk:
  - Tool output tarafinda buyuk bir redaction utility henuz eklenmedi; risk azaltimi icin terminal/raw detaylar varsayilan kapali tutuluyor ve non-dev smoke assert'iyle dogrulaniyor.

### TASK-UI-RESTRUCTURE-PR-15-TERMINAL-DETAIL-OUTPUT-POLISH - 15 Mayis 2026

- Kapsam: PR-14 activity feed sistemi korunarak tool terminal detayinin okunabilirlik, truncation, targeted redaction, preview, copy UX ve mobile overflow davranislari iyilestirildi; backend schema/protocol degistirilmedi.
- Uygulama:
  - Yeni utility seam eklendi: `apps/web/src/components/chat/activity/terminalOutput.ts`.
    - `redactTerminalText`: `access_token`, `refresh_token`, `ws_ticket`, `Authorization: Bearer`, JWT-like ve `sk-/gsk_` key patternleri presentation katmaninda maskeleniyor.
    - `formatTerminalOutputSection`: CRLF normalize + redaction + line/char truncation + metadata (`truncated`, `originalLineCount`, `visibleLineCount`).
    - `formatDurationLabel`: `ms` / `yaklasik X.X sn` formatlama.
  - `runActivityAdapter.ts` typed `result_preview.summary_text` alanini tool row `preview` alanina tasiyor; `summary`/`detail` ile ayniysa duplicate etmiyor.
  - `TerminalDetails.tsx` section bazli render modeline tasindi: `Komut`, `Komut bilgisi`, `Sonuc onizlemesi`, `stdout`, `stderr` yalniz doluysa gosteriliyor.
  - `stdout/stderr/preview` icin truncation notu ve section bazli `Tamamini goster` / `Kisalt` davranisi eklendi.
  - Komut copy butonu yalniz komut varsa render ediliyor; `Kopyalandi` / `Kopyalanamadi` state'i 1 saniyede idle'a donuyor.
  - Teknik alanlarin tamami bossa terminal detayinda acik empty state mesaji gosteriliyor: `Bu arac icin gosterilecek teknik cikti yok.`
  - `RunActivityRow.tsx` detail toggle artik yalniz anlamli detay varsa render ediliyor; bos tool row icin anlamsiz toggle uretilmiyor.
  - `RunActivityFeed.module.css` terminal detay odakli minimal token-tabanli siniflarla genisletildi (`terminalEmpty`, `terminalSectionHeader`, `terminalTruncationNote`, `terminalShowMore`, `data-terminal-kind=\"stderr\"`, `data-terminal-truncated=\"true\"`).
  - PR-14 visual smoke kontrati terminal detail davranisina gore guncellendi: copy butonu komut varsa zorunlu, yoksa beklenmez; detail acildiginda output/preview section varligi assert ediliyor.
- Test:
  - Yeni unit/component testleri:
    - `apps/web/src/components/chat/activity/terminalOutput.test.ts`
    - `apps/web/src/components/chat/activity/RunActivityRow.test.tsx`
  - Guncellenen testler:
    - `apps/web/src/components/chat/activity/runActivityAdapter.test.ts`
    - `apps/web/tests/visual/ui-overhaul-07-3-smoke.spec.ts`
  - Komut sonuclari:
    - `pnpm.cmd --filter @runa/web lint` PASS
    - `pnpm.cmd --filter @runa/web typecheck` PASS
    - `pnpm.cmd --filter @runa/web test` PASS (`44` dosya / `177` test PASS, `1` skipped)
    - `pnpm.cmd --filter @runa/web build` PASS
    - `pnpm.cmd --filter @runa/web test -- src/components/chat/activity/terminalOutput.test.ts src/components/chat/activity/runActivityAdapter.test.ts src/components/chat/blocks/BlockRenderer.test.tsx src/test/design-language-lock.test.ts src/pages/OperatorDeveloperIsolation.test.tsx` PASS
    - `pnpm.cmd exec playwright test apps/web/tests/visual/ui-overhaul-07-3-smoke.spec.ts --config playwright.config.ts --workers=1` PASS (`2` test)
- Kalan risk:
  - Terminal presentation layer icin targeted redaction eklendi; server-side secret prevention ayri guvenlik katmani olarak kalir.
  - Client-side redaction presentation odaklidir; upstream tool/server output policy enforcement ihtiyacini ortadan kaldirmaz.

### TASK-UI-RESTRUCTURE-PR-3-CHAT-SURFACE - 14 Mayis 2026

- Kapsam: Chat transcript ritmi, day divider akisi, tool-result yuzeyi ve tekrarli run panel yogunlugu azaltma hedefleri.
- Uygulama: `PersistedTranscript.tsx` icinde role label/timestamp gosterimi kaldirildi, `DayDivider` ile gun ritmi korundu; `ToolResultBlock.tsx` user-facing satir dili sadeleştirildi.
- Lock/guard: `apps/web/src/test/design-language-lock.test.ts` icine PR-3 chat surface lock assert'leri eklendi.
- Gorsel kanit: `docs/design-audit/screenshots/2026-05-13-ui-restructure-pr-3-chat-surface/`
- Dogrulama: `lint/typecheck/test/build` zinciri PR-3 kapanisinda calisti; PR-12'de lock kapsam dogrulamasi tekrarlandi.
- Kalan not: Bu PR ile chat ritmi kapandi; daha derin transcript personalization kapsam disi kaldı.

### TASK-UI-RESTRUCTURE-PR-4-APPROVAL-CALM - 14 Mayis 2026

- Kapsam: Approval kartini kullanici tarafinda daha sakin/tek odakli hale getirmek, risk seviyesine gore karar aksiyonu korumak.
- Uygulama: `ApprovalBlock.tsx` user-facing akista sade header/target/actions modeline indirildi; risk hesaplamasi `approvalRisk` modulu uzerinden stabil hale getirildi.
- Lock/guard: PR-4 icin `ApprovalBlock` eski katman siniflari render etmeme + `approvalRisk` export + `RunaButton` danger variant lock assert'leri eklendi.
- Gorsel kanit: `docs/design-audit/screenshots/2026-05-13-ui-restructure-pr-4-approval-calm/`
- Dogrulama: PR-4 kapanisinda web kalite kapilari yesildi; PR-12'de lock + dead CSS temizligi ile audit debt kapatildi.
- Kalan not: Height/pixel metrikleri sonraki gorsel regresyon review turlerinde manuel izlenir.

### TASK-UI-RESTRUCTURE-PR-5-ERRORS-USER-LABEL-TR - 14 Mayis 2026

- Kapsam: Tool sonuc metninde TR odakli user label kontratini (`user_label_tr`) kullanmak, hata dili ve fallback satirlarini sade tutmak.
- Uygulama: `ToolResultBlock.tsx`, `RunTimelineBlock.tsx` ve server label coverage hattinda `user_label_tr` fallback zinciri netlestirildi.
- Lock/guard: PR-5 icin `user_label_tr` kullanim assert'leri lock test dosyasina eklendi.
- Gorsel kanit: `docs/design-audit/screenshots/2026-05-13-ui-restructure-pr-5-errors-user-label/`
- Dogrulama: PR-5 kapanisinda `user-label-coverage` testleri ve web kalite kapilari calisti.
- Kalan not: Dil/copy ince ayarlari plan-disi copy polish sprint'ine tasinabilir.

### TASK-UI-RESTRUCTURE-PR-6-SHEETS-PALETTE - 14 Mayis 2026

- Kapsam: History/Menu/Context sheet davranislarini ortak UI primitive'leriyle birlestirmek.
- Uygulama: `RunaSheet`/`RunaModal` export zinciri netlestirildi; `ChatHeader` history trigger semantigi ve `ChatPage` sheet mount yuzeyleri sabitlendi.
- Lock/guard: PR-6 icin sheet export + aria-controls + page mount assert'leri eklendi.
- Gorsel kanit: `docs/design-audit/screenshots/2026-05-13-ui-restructure-pr-6-sheets-palette/`
- Dogrulama: PR-6 kapanisinda lint/typecheck/test/build + visual smoke pass raporlandi.
- Kalan not: Tam focus-trap edge-case regresyonlari manuel a11y turlerinde izlenir.

### TASK-UI-RESTRUCTURE-PR-7-SETTINGS-STOP - 14 Mayis 2026

- Kapsam: Settings IA, composer stop aksiyonu, migration-cleanup kapanisi.
- Uygulama: `ChatComposerSurface.tsx` stop ikon/davranis destekleri ve `useChatRuntime.ts` abort aksiyonu korunarak ilerletildi; `ThemePicker.tsx` varligi ve route migration temizligi kilitlendi.
- Lock/guard: PR-7 lock assert'leri (Square importu, abort exportu, ThemePicker varligi, migration CSS yoklugu) eklendi.
- Gorsel kanit: `docs/design-audit/screenshots/2026-05-13-ui-restructure-pr-7-settings-stop/`
- Dogrulama: PR-7 kapanisinda kalite kapilari ve stop davranisi visual kanitlari kayit altina alindi.
- Kalan not: PR-7 brief'teki 3-tab plani PR-12 karariyla 5-tab IA olarak resmi otoriteye tasindi.

### TASK-UI-RESTRUCTURE-PR-8-A11Y-POLISH - 14 Mayis 2026

- Kapsam: Skip link, reduced-motion, mobile keyboard davranisi ve temel a11y polish kapanisi.
- Uygulama: `useVisualViewport` + `SkipToContent` kontrati korunarak ilerletildi; PR-12'de ek olarak `role=\"main\"` landmarklari guclendirildi.
- Lock/guard: PR-8 lock kapsamı (skip-to-content, reduced-motion, visual-viewport) korunmaya devam ediyor.
- Gorsel kanit: `docs/design-audit/screenshots/2026-05-13-ui-restructure-pr-8-a11y-polish/`
- Dogrulama: PR-12'de Lighthouse desktop/mobile raporlari ve screen-reader checklist dosyalandi.
- Kalan not: Gercek NVDA/VoiceOver kosumu manuel QA adimi olarak acik.

### TASK-UI-RESTRUCTURE-PR-9-TOKEN-CLEANUP - 14 Mayis 2026

- Kapsam: Undefined/legacy token borcunu kapatmak ve token audit guard'ini CI seviyesinde korumak.
- Uygulama: `tokens.css` icinde `--ink-4` dahil tema bloklari sabitlendi; `scripts/audit-tokens.mjs` ile undefined token denetimi otomasyona baglandi.
- Lock/guard: PR-9 icin `--ink-4` varligi + `audit-tokens.mjs` exit-code lock assert'i eklendi.
- Gorsel kanit: `docs/design-audit/screenshots/2026-05-14-ui-restructure-pr-12-final-polish/` altinda PR-9 lock kapanis kanitlari.
- Dogrulama: `node scripts/audit-tokens.mjs` PASS; PR-12 lock testleri bu guard'i dogruluyor.
- Kalan not: Genis global CSS dead-candidate listesi rapor-only tutuldu, otomatik silinmedi.

### TASK-UI-RESTRUCTURE-PR-11-RUNTIME-MEMO-DISCIPLINE - 14 Mayis 2026

- Kapsam: `useChatRuntime` memo dependency patlamasini azaltip API yuzeyini guvenli sekilde parcalamak.
- Uygulama: Config/state/actions memo gruplarina ayrilan runtime donusu ve mega-memo dusurme calismasi yapildi.
- Lock/guard: `design-language-lock.test.ts` icindeki memo discipline assert'leri PR-11 invariants olarak korunuyor.
- Gorsel kanit: Davranis odakli PR; gorsel kanit yerine lock/perf guard kayitlari kullanildi.
- Dogrulama: PR-11 kapanisinda kalite kapilari + targeted testler calistirildi.
- Kalan not: Streaming kaynakli jank takibi runtime/perf backlog'unda izlenmeye devam eder.

### TASK-UI-RESTRUCTURE-PR-12-FINAL-POLISH - 14 Mayis 2026

- Kapsam: PR-10 audit raporundaki BOS KANIT ve KISMEN maddelerini kapatmak; lock coverage, IA karari, Lighthouse/screen-reader kaniti, dead CSS raporu ve PROGRESS senkronu.
- Uygulama: `design-language-lock.test.ts` PR-3/4/5/6/7/9 + Settings IA bloklariyla genisletildi; `docs/RUNA-DESIGN-LANGUAGE.md` icine Settings 5-tab IA eklendi; `PR-7-CODEX-BRIEF.md` sonuna history-preserving karar notu dusuldu; `BlockRenderer.module.css` icinde kullanilmayan approval status/decision/state feedback siniflari temizlendi; `scripts/audit-dead-css.mjs` eklendi; `ChatRuntimePage.tsx` ve `DeveloperRuntimePage.tsx` icine minimal loading skeleton eklendi.
- Lock/guard: PR-12 kapsamindaki tum yeni lock assert'leri `apps/web/src/test/design-language-lock.test.ts` icinde.
- Gorsel kanit: `docs/design-audit/screenshots/2026-05-14-ui-restructure-pr-12-final-polish/`
- Dogrulama: Lighthouse desktop/mobile raporlari + dead CSS report + screen-reader checklist ayni klasore kaydedildi; full kalite komut sonucu bu kaydin sonundaki PR-12 raporunda tutulur.
- Kalan not: Lighthouse calisimi sonunda gecici `EPERM` tmp-cleanup gurultusu goruldu; rapor dosyalari basariyla uretildi.

### TASK-UI-RESTRUCTURE-COMPLETE - 14 Mayis 2026

- 12 PR ile UI restructure sureci kapandi.
- Brief'lerin tamami: `docs/design/ui-restructure/PR-1..PR-12-CODEX-BRIEF.md`.
- Tek source of truth: `docs/RUNA-DESIGN-LANGUAGE.md` (Settings IA dahil).
- Audit + gap raporu: `docs/design/ui-restructure/PR-10-GAP-AUDIT-REPORT.md`.
- Lock test: `apps/web/src/test/design-language-lock.test.ts` PR-1..9 + Settings + PR-11 invariants.
- Lighthouse: `docs/design-audit/screenshots/2026-05-14-ui-restructure-pr-12-final-polish/lighthouse-{desktop,mobile}.{json,html}`.
- Screen reader checklist: `docs/design-audit/screenshots/2026-05-14-ui-restructure-pr-12-final-polish/screen-reader-checklist.md`.
- Dead CSS report: `docs/design-audit/screenshots/2026-05-14-ui-restructure-pr-12-final-polish/dead-css-report.md`.
- Kalan plan-disi alanlar (ayri sprint): Empty state personalization, markdown rendering kalitesi, voice composer derinlik, loading skeleton parity.

### TASK-UI-HIZALAMA-FULL-01 - 14 Mayis 2026

- Kapsam: Frontend mimar belgeleri + HTML mock artefaktlarina tam hizalama icin Faz 0-3 kod implementasyonu yapildi; Faz 4 kalite kapisi ortam kisitlarina takildi.
- Faz 0:
  - `docs/design-audit/FRONTEND-MIMAR-HIZALAMA-GAP-MATRIX-2026-05-14.md` olusturuldu.
  - Sapmalar kanitli sekilde listelendi (onboarding adim sayisi, header aktif cihaz subtitle, transcript timestamp, notifications route/surface, settings IA, migration class debt).
- Faz 1:
  - Onboarding 3 adima indirildi ve her adimda `Atla` akisi korundu (`apps/web/src/components/onboarding/OnboardingWizard.tsx`).
  - Chat header'a aktif cihaz subtitle eklendi; mobile/desktop varyanti tanimlandi (`apps/web/src/components/chat/ChatHeader.tsx`, `apps/web/src/pages/ChatPage.tsx`, `apps/web/src/styles/components.css`).
  - Per-message timestamp kaldirildi, day divider korundu (`apps/web/src/components/chat/PersistedTranscript.tsx`).
  - Notifications placeholder akisi gercek route/surface'e tasindi (`/notifications` + `NotificationsPage`) ve header/menu/command aksiyonlari buraya baglandi (`apps/web/src/AuthenticatedApp.tsx`, `apps/web/src/components/app/*`, `apps/web/src/pages/NotificationsPage.tsx`).
- Faz 2:
  - Settings IA `Appearance / Conversation / Notifications / Privacy / Advanced` sekmelerine tasindi.
  - Dil, sessiz saatler, veri saklama suresi, gelismis gorunum ayarlari eklendi; mevcut approval/workspace akislari korundu (`apps/web/src/pages/SettingsPage.tsx`).
- Faz 3:
  - `runa-migrated-components-*` ve `runa-migrated-pages-*` gecici sinif adlari uygulama ve stil katmaninda temizlendi (`apps/web/src/components/**`, `apps/web/src/pages/**`, `apps/web/src/styles/components.css`).
- Dogrulama:
  - `pnpm.cmd --filter @runa/web lint` PASS
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web test` FAIL (vitest config/startup + spawn EPERM)
  - `pnpm.cmd --filter @runa/web build` FAIL (tailwind oxide native binding yukleme / UTF-8)
  - Playwright visual run FAIL (EPERM unlink/mkdir + spawn EPERM)
- Faz 4 notu:
  - Hedef klasor olusturuldu: `docs/design-audit/screenshots/2026-05-14-frontend-mimar-full-alignment/`
  - `EVIDENCE-MAP.md` olusturuldu ancak tum capture girdileri `BLOCKED` durumunda.
  - Ayrintili blokaj kaydi: `docs/design-audit/FRONTEND-MIMAR-HIZALAMA-ESCALATION.md`
- Kalan risk:
  - Ortam izin/kisitlari (spawn/mkdir/unlink EPERM) giderilmeden test-gate, visual regression ve Lighthouse kapanisi kanitlanamiyor.

### TASK-UI-RESTRUCTURE-BRIEF-V11-LOCK - 13 Mayis 2026

- Kapsam: Sadece planlama / kilitleme. Kod degisikligi yapilmadi. `docs/design/RUNA-DESIGN-BRIEF.md` v1.0 -> v1.1 yukseltildi; PR-1 icin Codex brief'i yazildi.
- Cikti: (1) Brief v1.1 â€” WCAG ink-3 fix (#9A8C76 + kullanim kurali), composer context chip, iOS visualViewport pattern + useVisualViewport hook spec, yuksek-risk approval tek-kurali + tool risk listesi (low/medium/high), composer Send -> Stop donusumu, server `user_label_tr` + `user_summary_tr` kontrati, yeni 8-PR sirasi (PR-1 tema once), branching + review + lock-test stratejisi, anti-pattern listesi guncellendi. (2) `docs/design/ui-restructure/PR-1-CODEX-BRIEF.md` â€” PR-1 icin Codex'in dogrudan acip uygulayacagi implementation rehberi: token swap (Ember Dark/Light/Rose Dark birebir hex degerleri), eski token migration mapping, tipografi (Inter + Instrument Serif + JetBrains Mono) yukleme, HafÄ±za Mark component API, empty state hero baslik (saat-uyumlu TR greeting), DesignLanguageLock test yeniden yazimi, kapsam disi liste (layout / approval / sheet sistemleri sonraki PR'lara birakildi), kabul kriteri checklist'i, risk + geri-alma plani.
- Anahtar kararlar: (a) Risk listesi onaylandi â€” `low`: file.read, desktop.screenshot, web.search; `medium`: file.write, desktop.click, desktop.type; `high`: file.delete, shell.exec, memory.delete, desktop.launch. (b) Server kontrat yolu B secildi: `user_label_tr` opsiyonel alani server tool definition'a eklenir, frontend whitelist genisletmek yerine tek source of truth olarak server kullanir. (c) PR sirasi: PR-1 (tema/font/mark) -> PR-2 (layout) -> PR-3 (chat surface) -> [PR-4 approval || PR-5 errors+server] paralel -> PR-6 (sheets) -> PR-7 (settings+advanced view) -> PR-8 (a11y+iOS+polish). (d) Branching: PR-1/2/3 lineer, PR-4/5 paralel, PR-6/7/8 lineer; her PR ayri worktree (.claude/worktrees/runa-ui-pr-N-*). (e) Lock test stratejisi: PR-1'de DesignLanguageLock.test.ts toptan yeniden yazilir, sonraki PR'lar bunu bozmadan ilerler. Lock test bypass yasak. (f) Review akisi: Codex PR'i acar -> CI yesil -> link Claude'a review icin gonderilir -> Claude raporu kullaniciya iletilir -> kullanici merge/revize karari verir.
- Dogrulama: Plan-only oturum, calistirma kaniti yok. Brief v1.1'deki tum yeni bolumler (Kontrast kurali, Context chip, iOS Safari klavye, Approval risk tablosu, Send->Stop, 12.5 Server Kontrati, 14.5 PR Operasyonu) bagimsiz inceleme icin hazir.
- Kalan not: HafÄ±za Mark final SVG path'leri kullaniciya birakildi; PR-1 baslangicinda kullanicidan onayli mark dosyasi alinacak, placeholder mark ile PR-1 merge edilmez. Codex'i baslatma yetkisi kullanicida; gelecek aksiyonu kullanici tetikleyecek.

### TASK-UI-RESTRUCTURE-PR-2-LAYOUT-SHELL - 13 Mayis 2026

- Kapsam: PR-1 tema/font/mark baseline'i hedef worktree'ye tasindi ve `codex/ui-restructure-pr-2-layout` uzerinde PR-2 layout shell uygulandi. Legacy token alias katmanina dokunulmadi; `tokens.css` alias temizligi PR-7'ye birakildi.
- Uygulama: Chat sag rail'i kaldirildi; `WorkInsightPanel.tsx` ve module CSS silindi. `ChatLayout` insights slot'u olmadan iki kolonlu hale geldi. AppNav sol sidebar icine tasindi; yeni `AppSidebar` brand, yeni sohbet, conversation listesi ve nav bolumlerini topluyor. Floating command palette pilli kaldirildi; ChatHeader tek satir baslik + inline command palette + bildirim/hesap ikonlari olarak sadeledi. Mobilde bottom tab bar kaldirildi, header `geri/history` ve `menu` ikonlariyla kaldi. Composer attachment sayisina bagli context chip eklendi; sheet davranisi PR-6'ya disabled/warn placeholder olarak birakildi.
- Lock/guard: `design-language-lock.test.ts` PR-2 layout kontratini kilitliyor: WorkInsightPanel dosyasi yok, ChatLayout `insights` prop'u yok, `components.css` 2 kolon grid degeri korunuyor, AppShell chat dalinda direct command palette trigger yok. `apps/web/src/styles/routes/README.md` migration CSS temizliginin PR-7'ye ertelendigini kaydediyor.
- Gorsel kanit: `apps/web/tests/visual/pr-2-layout-shell.spec.ts` eklendi ve `docs/design-audit/screenshots/2026-05-13-ui-restructure-pr-2-layout-shell/` altina desktop 1440 empty/active, desktop 1920 active, mobile 390 empty/focus ve mobile 320 empty screenshot'lari uretildi.
- Dogrulama: `pnpm.cmd --filter @runa/web lint` PASS; `pnpm.cmd --filter @runa/web typecheck` PASS; `pnpm.cmd --filter @runa/web test` PASS (`36` dosya, `117` test PASS, `1` skipped); `pnpm.cmd --filter @runa/web build` PASS. Ek gorsel smoke: `RUNA_E2E_SERVER_PORT=4312 RUNA_E2E_WEB_PORT=4313 RUNA_E2E_STRICT_SERVER=1 pnpm.cmd exec playwright test --config playwright.pr2.config.ts --workers=1` PASS (`1` Chromium test); gecici config, `.claude` worktree ignore kisiti nedeniyle yalniz lokal dogrulama icin kullanilip kaldirildi.
- Kalan not: Lighthouse Performance/CLS ayrica kosulmadi; bu PR'da goruntu ve layout-regression kaniti Playwright screenshot smoke ile kapatildi. PR-6 sheet/command palette implementasyonu ve PR-7 migration cleanup kapsam disi kaldi.

### TASK-UI-RESTRUCTURE-PLAN-01 - 11 Mayis 2026

- Kapsam: Sadece planlama / audit. Kod degisikligi yapilmadi. Mevcut Runa chat arayuzunun 9 ekran goruntusu (5 desktop + 4 mobile) ile rakip referans klasoru (`C:\Users\admin\OneDrive\Desktop\ornekler` altinda Claude Cowork, Claude Code, Codex'in 10 ekran goruntusu) yan yana incelendi; `apps/web` kaynak kodu uzerinden 9 soruluk frontend audit dogrudan dosya:satir kanitlariyla tamamlandi.
- Cikti: `docs/design/ui-restructure/FRONTEND-RESTRUCTURING-PLAN.md` olusturuldu. Belge sunlari icerir: (1) mevcut UI mimari haritasi (shell, chat, tool aktivitesi, approval, right rail, layout); (2) komponent/dosya bazli sorun bolgeleri; (3) yeni yuzey modeli (tek birincil yuzey, slim tool activity, sakin approval, etiket-baslikli right rail, mobil sheet, Developer Mode izolasyonu); (4) ana sohbette varsayilanda izinli/yasak liste; (5) PR-A'dan PR-H'ye kadar 8 asamali kucuk-diff PR plani; (6) risk ve regresyon bolgeleri; (7) her PR icin gorsel kabul kriteri.
- Anahtar bulgular: (a) Ayni agent run'i sohbet icinde `RunProgressPanel`, `PresentationRunSurfaceCard` ve sag rail `WorkInsightPanel` olmak uzere uc yerde tekrar render ediliyor (`ChatPage.tsx:197-204, 214-227, 304-314`). (b) Chat sayfasinin ust kismi uc bagimsiz floating ogeden olusuyor: `runa-command-palette-trigger` (fixed top:14px, `app-shell-migration.css:225-230`) + `AppNav` tile-row + `ChatHeader` strip. (c) `WorkInsightPanel.module.css:9-18, 165-176` net card-in-card patolojisi (`.panel` icinde `.metric`). (d) Approval karti 5+ katman: eyebrow + title + status chip + inline target + state feedback banner + actions + developer disclosure (`ApprovalBlock.tsx:280-388`). (e) Raw debug dili sizintilari: shell-exec tool description English metni `formatWorkDetail` whitelist'inde olmadigi icin dogrudan kullaniciya cikiyor (`shell-exec.ts:677-678`, `workNarrationFormat.ts:51-83`); `Hata kodu: NOT_FOUND` chip'i user-facing modda gorunuyor (`ToolResultBlock.tsx:124-130`); `Bu onayda net hedef bilgisi gonderilmedi.` self-narration (`ApprovalBlock.tsx:241`); her mesajda saniye-doÄŸruluk tarih damgasi + `Sen` / `Runa` rumuzu (`PersistedTranscript.tsx:11-22, 48-52`). (f) Mobilde composer + bottom AppNav + sayfa padding-bottom katmanlari 138px+ olu alan yaratiyor; insights `order: 3` ile composer'dan sonra geliyor (`components.css:1801-1803, 1911-1953`). (g) `runa-chat-layout` iki ayri yerde tanimlanmis (`primitives.css:525-547` 2-kolon, `components.css:718-755` 3-kolon) â€” olu kod.
- Karar: PR-A "tekrar kesimi" en yuksek gorsel etkili adim olarak isaretlendi. PR sirasi: A (run tekrar kesimi) â†’ B (card-in-card cleanup) â†’ C (approval minimize) â†’ D (raw debug pruning) â†’ E (top-nav unification) â†’ F (message rhythm + empty hero) â†’ G (mobile sheet + composer opaqueness) â†’ H (token polish).
- Dogrulama: Bu task plan-only oldugundan calistirma kaniti yok. Plan belgesinin dogrudan-kaynak referanslari (file:line) tek tek kod tabaninda dogrulandi.
- Kalan not: `RUNA-DESIGN-LANGUAGE.md` mevcut hali plani buyuk olcude destekliyor; PR-A oncesinde "ayni run bilgisi tek yerde ozetlenir" maddesi belgeye eklenmeli. Server tarafinda tool definition'larin `user_label` opsiyonel alanini PR-D ile beraber tartismaya acilacak; bu task kapsami uzerinde anlasilana kadar server kontrati degismeyecek.

### TASK-DEEPSEEK-LIVE-USER-JOURNEY-QA - 6 Mayis 2026

- Kapsam: DeepSeek `.env` credential'i ile 5 kullanici tipi ve 15 gercek hayat senaryosu canli provider testine eklendi. Kullanicilar: ogrenci, yazilimci, arastirmaci, kucuk isletme sahibi ve urun yoneticisi. Test `ModelGateway` uzerinden gider, provider fallback'i kapatir, her senaryoda provider/model/finish_reason/public content/latency kaniti uretir.
- Bulgu/fix: Mevcut DeepSeek live smoke reasoning stage'i `max_output_tokens=128` ile `deepseek-v4-pro` reasoning_content icinde butceyi tuketip public cevabi bos veya kesik birakabiliyordu; smoke artik daha dar cikti kontrati, 768 token butcesi ve `finish_reason=stop` + public content validasyonu istiyor. Tool schema stage'i de artik sadece "provider dondu" demiyor; tool-call veya gorunur assistant content yoksa fail ediyor.
- Browser QA fixleri: Playwright/Vite E2E hatti port-parametrik hale getirildi (`RUNA_E2E_SERVER_PORT`, `RUNA_E2E_WEB_PORT`, `RUNA_E2E_STRICT_SERVER`) ve Vite proxy hardcoded `3000` yerine ayni server portunu izliyor. Boylece baska checkout'tan calisan eski dev server'a baglanip sahte gorsel/protocol sonucu uretme riski kapatildi. E2E stub'i conversation list/blocks kontratina hizalandi; stale UI selector'lari guncel chat-native metinlerle duzeltildi.
- Canli kanit: `pnpm.cmd --filter @runa/server run test:deepseek-user-journey-live-suite` PASS; `DEEPSEEK_USER_JOURNEY_LIVE_SUMMARY result="PASS"`, `persona_count=5`, `scenario_count=15`, API key source `.env`, fast/reasoning model source `.env`, `DATABASE_URL` source `.env.local`.
- Tekrar dogrulama: `pnpm.cmd --filter @runa/server run test:deepseek-live-smoke` PASS; reasoning stage `finish_reason="stop"`, tool schema stage `tool_name="file.read"`. `RUNA_E2E_SERVER_PORT=4310 RUNA_E2E_WEB_PORT=4311 RUNA_E2E_STRICT_SERVER=1 pnpm.cmd exec playwright test e2e/chat-e2e.spec.ts e2e/approval-modes-capabilities-e2e.spec.ts --config playwright.config.ts --workers=1` PASS (`14` Chromium test). `pnpm.cmd --filter @runa/server typecheck` PASS; `pnpm.cmd --filter @runa/web typecheck` PASS; scoped Biome check for touched smoke/E2E/config files PASS.
- Kalan not: Full `pnpm.cmd lint` bu kosuda task-disindaki mevcut format driftleri nedeniyle RED kaldi (`.local/spikes`, `.codex-temp`, Groq/terminal/desktop smoke scriptleri). Bu task kapsaminda degisen dosyalar scoped Biome'da yesil.

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
- Smoke/proof: DeepSeek ve Groq live smoke summary'leri API key, model ve `DATABASE_URL` otoritesini maskeli ve kanitlanabilir sekilde raporluyor. Persistence/approval proof scriptleri file-backed env yuklemesini ayni authority ozetiyle yapiyor.
- Canli kanit: DeepSeek live smoke PASS; API key `.env`, DeepSeek model secimleri `.env`, `DATABASE_URL` `.env.local` olarak raporlandi. Groq live smoke PASS; API key `.env`, model `default`, `DATABASE_URL` `.env.local` olarak raporlandi.
- Dogrulama: `node --check apps/server/scripts/deepseek-live-smoke.mjs` PASS; `node --check apps/server/scripts/groq-live-smoke.mjs` PASS; `pnpm.cmd --filter @runa/server run test:deepseek-live-smoke` PASS; `pnpm.cmd --filter @runa/server run test:groq-live-smoke` PASS; `pnpm.cmd --filter @runa/server typecheck` PASS; `pnpm.cmd --filter @runa/server test -- env-authority gateway model-router` PASS (`164` test); `pnpm.cmd --filter @runa/server lint` PASS (`358` dosya).
- Not: Server lint baseline'i kapatmak icin `apps/server/src/presentation/map-run-timeline.ts` uzerinde format-only duzeltme de dahil edildi. PowerShell profile kaynakli `\` gurultusu komut exit code'larini bozmadigi icin urun hatasi olarak ele alinmadi.

### TASK-DESKTOP-INSTALLER-RELEASE-HARDENING-OFFLINE-CONFIG-UX - 6 Mayis 2026

- Kapsam: Server live olmadan desktop companion'in Windows installer/unpacked release riskleri, offline/config failure state'i, token/log redaction ve artifact metadata gate'i kapatildi.
- Uygulama: Electron shell explicit web URL yoksa veya invalid URL verilirse internal renderer fallback ile guvenli hata state'i gosteriyor; external web load fail olursa Chromium error/blank screen yerine internal fallback'e donuyor. Desktop web URL yuklenmeden once sensitive auth query/hash parametreleri temizleniyor.
- Distribution gate: `smoke:distribution` eklendi. Gate unpacked exe, setup artifact, appId/productName/asar/protocol/shortcut metadata, ASAR, Electron fuses, packaged app start/shutdown, missing/invalid/unreachable config UX ve sentinel token redaction alanlarini `DESKTOP_DISTRIBUTION_SMOKE_SUMMARY` ile raporluyor.
- Guvenlik: Logger query/hash token parametrelerini bearer/JWT redaction'a ek olarak redakte ediyor; smoke sentinel access/refresh/query token'in stdout/stderr/main.log/summary icinde ham gorunmedigini dogruluyor.
- Dogrulama: `typecheck`, `typecheck:electron`, `typecheck:renderer`, `test`, `build`, `build:renderer`, `dist:win`, `smoke:packaged`, `smoke:distribution` ve `git diff --check` PASS. `smoke:distribution` icindeki nested packaged proof da PASS.
- Kalan risk: Authenticode code signing mevcut lokal artifact'ta `unsigned_blocker`; production update provider/channel henuz configured olmadigi icin `auto_update_status="disabled_until_release_channel"`. Silent installer install/uninstall sistem geneline dokunmadan test edilmedi; live auth gate server canli olunca tekrar kosulmali.

### TASK-STAGING-PRODUCTION-AUTH-DESKTOP-COMPANION-LIVE-E2E-GATE - 6 Mayis 2026

- Kapsam: Local packaged desktop companion proof sonrasi acik kalan gercek staging/production auth, live domain, desktop device visibility ve remote target protection kaniti icin ayri bir release gate eklendi.
- Uygulama: `@runa/desktop-agent` icine `smoke:live-auth` script'i eklendi. Script staging/live server URL, web URL, iki farkli kullanici access token'i ve explicit provider smoke key'i ister; token degerlerini summary/log icine yazmaz.
- Kanit modeli: Canli `/auth/context`, `/desktop/devices`, `/ws/desktop-agent` ve `/ws` hatlarini kullanir; primary user altinda synthetic desktop bridge presence olusturur, secondary user cihaz gizliligini kontrol eder, invalid token'in presence yaratmadigini dogrular ve provider key varsa approval-gated `desktop.screenshot` ile cross-account target rejection proof kosar.
- Guvenlik: Localhost canli kanit olarak varsayilan kabul edilmez; sadece `RUNA_DESKTOP_COMPANION_E2E_ALLOW_LOCALHOST=1` ile acilir. Missing credential veya provider key durumunda PASS maskelenmez, `DESKTOP_COMPANION_LIVE_AUTH_E2E_SUMMARY status="blocked"` ve eksik alanlar raporlanir.
- Mevcut lokal dogrulama: `node --check apps/desktop-agent/scripts/live-auth-companion-smoke.mjs` PASS. `pnpm.cmd --filter @runa/desktop-agent smoke:live-auth` lokal shell'de staging/live credential olmadigi icin beklenen sekilde BLOCKED/exit 1; eksikler `primaryAccessToken`, `secondaryAccessToken`, `serverUrl`, `webUrl` ve explicit provider smoke key'i.
- Kalan risk: Gercek staging/production PASS icin dedicated iki test kullanicisi, live web/server URL'leri ve `RUNA_DESKTOP_COMPANION_E2E_PROVIDER_API_KEY` ile bu gate tekrar kosulmali.

### TASK-PRODUCTION-AUTH-DESKTOP-COMPANION-LIFECYCLE-E2E - 6 Mayis 2026

- Kapsam: Signed-in desktop companion proof'u production-style session handoff, invalid/expired token, logout/session clear, restart-after-logout ve cross-account target protection risklerine genisletildi.
- Uygulama: Web companion bind token-only/session restore yollarinda `submitSession` kacirmiyor ve auth clear path'i desktop sign-out cagiriyor. Desktop expired stored session refresh token yoksa storage'i temizleyip bridge baslatmiyor. Smoke-only sign-out control seam'i packaged lifecycle kaniti icin eklendi.
- Server hardening: WebSocket handshake explicit header/query token'i pre-authenticated request context'e tercih ediyor; pending approval replay desktop target connection id'yi persistence/presentation hattinda koruyor. Cross-user desktop target denemesi registry seviyesinde `desktop_agent_target_unavailable` ile testlendi.
- Packaged proof: `smoke:packaged` PASS; summary `production_style_session_bound=true`, `invalid_token_did_not_create_presence=true`, `logout_or_session_clear_removed_device=true`, `restart_after_logout_stayed_offline=true`, `cross_account_device_hidden=true`, `cross_account_target_rejected=true`, `approval_target_label_present=true`, `screenshot_succeeded=true`, `final_message_type="run.finished"`, `run_status="completed"` raporladi.
- Dogrulama: Server typecheck/test, desktop typecheck/electron/renderer/test/build/build:renderer/smoke, web typecheck/test/build PASS. Ek olarak `dist:win` PASS ile paketli exe guncellendi; PowerShell profile kaynakli `\` gurultusu command exit code'unu bozmadi.
- Kalan risk: Gercek staging/production Supabase OAuth redirect allowlist ve canli domain uzerinde manuel/browser E2E henuz bu local packaged smoke disinda ayrica kosulmali.

### TASK-WEB-LINT-BASELINE-CLOSURE - 6 Mayis 2026

- Kapsam: `@runa/web` Biome lint baseline kapatildi. Runtime/server/desktop kontratlari degistirilmedi; task disi mevcut dirty desktop/server dosyalarina dokunulmadi.
- Uygulama: Biome safe write ile web format/import-order diagnostikleri duzeltildi. `apps/web/src/components/chat/*.module.css` ve `apps/web/src/components/chat/capability/*.module.css` icindeki placeholder bos class bloklari token tabanli, dar ve gercek layout stilleriyle kapatildi.
- Capability preview/chat yuzeyleri: modal, asset preview, before/after, task queue, progress list, screenshot, desktop target selector, workspace header ve conversation sidebar class export'lari korunarak bos bloklar kaldirildi; yeni dependency, yeni public API veya runtime davranis degisikligi eklenmedi.
- Dogrulama:
  - `pnpm.cmd --filter @runa/web lint` PASS (`276` dosya)
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd run style:check` PASS
  - `pnpm.cmd run manifesto:check` PASS
  - `pnpm.cmd --filter @runa/web exec vitest run src/pages/VisualDiscipline.test.tsx --config ./vitest.config.mjs --configLoader native` PASS (`4` test)
  - `pnpm.cmd --filter @runa/web build` PASS
  - Full `apps/web/src` source inventory scan PASS: `#hex`, `rgba(`, `hsla(` sayisi `0`
  - `git diff --check` PASS

### TASK-WEB-THEME-SELECTOR-VISUAL-QA - 6 Mayis 2026

- Kapsam: Mevcut token/brand theme altyapisi urun ayarina donusturuldu. Yeni tema sistemi, yeni dependency, backend preference sistemi, auth/WS/runtime/provider degisikligi veya token mimarisi rewrite'i eklenmedi.
- Uygulama: `apps/web/src/lib/theme.ts` icinde `teal`, `indigo`, `graphite`, `plum`, `amber` tek typed brand-theme constant/union haline getirildi; gecersiz localStorage degeri guvenli sekilde `teal` default'una donuyor. `theme-bootstrap.ts` ile ilk yuklemede root `data-theme` ve `data-brand-theme` CSS yuklenmeden once uygulanir hale getirildi.
- UI: `App.tsx` root state sahibi oldu ve tema secimi `AuthenticatedApp` uzerinden `SettingsPage`'e controlled props olarak tasindi. Settings > Tercihler icinde mevcut Sistem/Koyu/Acik gorunum kontrolu korundu; ayri Renk kontrolu swatch'li, secili durumu belirgin ve mobil grid-safe olarak eklendi.
- Browser QA: `pnpm dev` ile lokal server/web hatti calistirildi; Playwright ile login, chat, settings, capability preview, history/devices ve 390px mobile settings yuzeyleri kontrol edildi. Tum yuzeylerde horizontal overflow temizdi, console error yoktu, invalid stored theme ilk yuklemede `teal` oldu, bes brand theme Settings uzerinden root `data-brand-theme` olarak uygulandi ve refresh sonrasi `amber` korunarak persistence dogrulandi. QA screenshot'lari `.codex-temp/theme-qa-*.png` altinda.
- Ek test: `apps/web/src/lib/theme.test.ts` marka tema fallback, store ve root apply davranisini kapsiyor; `SettingsPage.test.tsx` brand theme seciminin controlled callback ile aktigini dogruluyor.
- Dogrulama:
  - `pnpm.cmd --filter @runa/web lint` PASS (`278` dosya)
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd run style:check` PASS (`violations=0`)
  - `pnpm.cmd run manifesto:check` PASS (`violations=0`)
  - `pnpm.cmd --filter @runa/web exec vitest run src/pages/VisualDiscipline.test.tsx --config ./vitest.config.mjs --configLoader native` PASS (`4` test)
  - `pnpm.cmd --filter @runa/web build` PASS
  - Source scan PASS: `Get-ChildItem -Path apps\web\src -Recurse -File | Select-String -Pattern '#[0-9A-Fa-f]{3,8}|rgba\(|hsla\(' | Measure-Object` sonucu `Count: 0`
- Kapsam disi birakilanlar: `apps/server/**`, `apps/desktop-agent/**`, `packages/types/**`, auth/WS/runtime/provider/persistence katmanlari, backend-backed user preferences, yeni dependency ve mevcut token sistemini yeniden yazma.

### TASK-WORK-NARRATION-PHASE-6 - 5 Mayis 2026

- Kapsam: Production hardening, observability, reasoning leakage denetimi, docs ve release checklist. Buyuk mimari refactor, yeni UI yuzeyi ve incremental persistence uygulanmadi.
- Audit: Prompt gate `native_blocks` / `temporal_stream`; unsupported provider'lar prompt ve narration emission disinda. DeepSeek `reasoning_content` normal assistant content'ten ayriliyor ve user-facing narration kaynagi degil.
- Edge cases: locale-aware deliberation guardrail guclendirildi; EN `I think` bug'i Turkce lowercasing kaynakli kaciyordu ve locale-aware normalize ile duzeltildi. Tool-output quote, long narration truncate, direct-tool/no-narration, synthetic_non_streaming suppression ve observability redaction testleri eklendi.
- Observability: `narration.started`, `narration.completed`, `narration.superseded`, `narration.guardrail.rejected`, `narration.tool_outcome_linked`, `narration.provider_unsupported` ve `narration.synthetic_ordering_suppressed` log metadata helper'i eklendi. Full narration text, tool output ve reasoning ham icerigi loglanmiyor.
- Metrics: General server metrics exporter bulunmadigi icin narration metrics kodda sahte counter olarak eklenmedi; future metrics `docs/architecture/work-narration.md` altinda belgelendi.
- DeepSeek smoke: Shell env'de `DEEPSEEK_API_KEY` yoksa canli smoke skip edilir; API key/log guvenligi geregi key degeri yazilmaz.
- Docs: `docs/architecture/work-narration.md`, `docs/architecture/reasoning-persistence.md` ve `docs/architecture/work-narration-release-checklist.md` guncellendi.
- Faz commit zinciri: `6a8548f`, `2ca55f5`, `79e741f`, `5a8add3`, `2f7ebcf`, `899e941`, `f41c4c4`, `fae6ce6`; Faz 6 final commit hash'i commit olustuktan sonra raporda verilir.

### TASK-WEB-THEME-TOKENIZATION-FOUNDATION - 5 Mayis 2026

- Kapsam: Web UI renk zemini profesyonel tema/token mimarisine tasindi. `apps/web/src/styles/tokens.css` varsayilan teal marka temasi ve `teal`, `indigo`, `graphite`, `plum`, `amber` brand theme varyantlariyla genisletildi; yuzey, border, metin, aksiyon ve status rolleri semantik CSS token'lari olarak ayrildi.
- Uygulama: `apps/web/src/styles`, `apps/web/src/components/ui`, `apps/web/src/components/chat`, `apps/web/src/pages/CapabilityPreviewPage.*`, `apps/web/src/assets/runa-logo.svg`, `apps/web/src/components/ai-elements/shimmer.tsx` ve `apps/web/src/lib/design-tokens.ts` altindaki hard-coded `#hex`, `rgba(...)`, `hsla(...)`, dekoratif gradient ve 600 uzeri font-weight kullanimi token temelli hale getirildi. `components.css` icindeki eski duplicate `:root` renk override'i kaldirildi.
- UI davranisi: Renk dili tek flat aksan, semantic status renkleri ve trust-first chat yuzeyiyle uyumlu hale getirildi. `PersistedTranscript` kullanici balonu icin CSS Modules `:global(...)` selector'u standard module class + `data-role` selector'una tasindi.
- Dogrulama:
  - `pnpm.cmd run style:check` PASS
  - `pnpm.cmd run manifesto:check` PASS
  - `pnpm.cmd --filter @runa/web exec vitest run src/pages/VisualDiscipline.test.tsx --config ./vitest.config.mjs --configLoader native` PASS (`4` test) onceki tokenization turunda; son TSX/SVG residual cleanup sonrasi tekrar kosu escalation tarafinda kullanim limitiyle reddedildi.
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - Scoped `pnpm.cmd exec biome check ...` PASS (`44` dosya)
  - Full `apps/web/src` source inventory scan PASS: `#hex`, `rgba(`, `hsla(` sayisi `0`
  - CSS inventory scan PASS: `#hex`, `rgba(`, `hsla(`, `linear-gradient/radial-gradient background`, `font-weight > 600` sayisi `0`
  - `git diff --check` PASS
- Kalan baseline: Full `pnpm.cmd --filter @runa/web lint` RED (`138` mevcut hata); gorunen ornekler `ChatShell.module.css`, `ChatWorkspaceHeader.module.css` ve `ConversationSidebar.module.css` icindeki task disi empty block/format diagnostikleri. Bu task kapsamindaki degisen dosyalar scoped Biome'da yesil.

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
- Faz 2 notu: capability flag'i ordered_content varligina degil, gateway'in native interleaved mi synthetic fallback mi urettiÄŸi bilgisine dayanacak. DeepSeek/Gemini/Groq/SambaNova synthetic text-first/tool-use sirasi urettigi icin narration emission bu provider'larda devre disi kalmali.

### TASK-WORK-NARRATION-PHASE-2A - 5 Mayis 2026

- Kapsam: Provider foundation kuruldu; henuz narration classifier, guardrail, WS narration emission veya frontend UI eklenmedi. DeepSeek streaming adapter'i `delta.content` ve `delta.tool_calls` SSE wire sirasini `ordered_content` icinde `ordering_origin: 'wire_streaming'` ile koruyor; non-streaming DeepSeek response'lari `synthetic_non_streaming` olarak isaretleniyor.
- Spike: `apps/server/scripts/deepseek-wire-spike.mjs` eklendi ve dogrudan DeepSeek API ile 3 prompt calistirildi. Cikti local spike `.log` artifact'ina yazildi (repoya alinmadi). Sonuc: content chunk'lari tool_call chunk'larindan once geliyor, iki tool-call senaryosunda temporal SSE sirasi korunuyor, `deepseek-chat` modunda `reasoning_content` gorulmedi, fallthrough gorulmedi.
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
- Browser live QA: `pnpm.cmd exec playwright test e2e/approval-modes-capabilities-e2e.spec.ts --config playwright.config.ts` PASS (`12` Chromium test). Approval mode ve 10+ capability senaryosu canlÄ± tarayÄ±cÄ±da doÄŸrulandÄ±: standard chat, standard `file.list`, ask-every-time `file.read`, trusted-session `file.read`, trusted-session `file.write`, `search.grep`, `search.codebase`, `git.status`, `git.diff`, `shell.exec` approval boundary ve `browser.navigate`. Screenshot kanitlari: `docs/design-audit/screenshots/2026-05-03-approval-modes-capability-live/`.
- Live QA bulgulari/fixler: ask-every-time modunda safe tool metadata'si approval request'e clone edilmedigi icin approval path fail ediyordu; `run-execution` approval tool definition resolve hattinda duzeltildi ve register-ws regresyon testi eklendi. E2E server'da scenario marker izolasyonu son kullanici prompt'una baglandi; `/desktop/devices` ve conversation members endpoint stub'lari eklenerek tarayici konsolundaki 404 hatalari temizlendi.
- Kalan risk: Bu turda kalan task-local risk yok. Playwright webServer log'unda service worker'in Playwright tarafindan bloklandigina dair beklenen Vite console.warn logu goruluyor; test icindeki page console/page/response hata assertion'lari temiz.

### TASK-RESILIENCE-05 - 2 Mayis 2026 (Tool Call Repair Hardening PR 1)

- Kapsam: `tool-call-candidate` parser'i provider-agnostic tolerant pipeline'a tasindi; strict/sanitized/fence-stripped/trailing-comma/wrapped/empty-default stratejileri ve `repair_strategy` observability alani eklendi. Dogrulama: targeted gateway parser testleri PASS, targeted parser Biome PASS, workspace typecheck PASS; workspace lint/test mevcut `apps/server/src/ws/*` baseline kirleri nedeniyle RED.

### TASK-RESILIENCE-06 - 2 Mayis 2026 (Tool Call Repair Hardening PR 2-6)

- Kapsam: repair recovery tek-shot olmaktan cikarildi; `strict_reinforce`, `tool_subset` ve `force_no_tools` strateji zinciri production default'u oldu. Streaming sirasinda `unparseable_tool_input` veya repairable tool-call hatasi gelirse WS `text.delta.discard` yayip non-streaming `generate()` fallback'e geciyor.
- Router/health: DeepSeek `tool_heavy` ve `deep_reasoning` intent'lerinde streaming bypass default acik (`RUNA_STREAMING_TOOL_HEAVY_BYPASS=1`); session-level provider health store ayni session/provider icin 10 dakikada 3 terminal tool-call failure sonrasi provider'i demote ediyor.
- Regression guard: historical payload fixture replay testleri, `tool_call_repair_terminal_failure_total` process-local metric/log counter'i, provider demotion telemetry ve `.env.example` flag dokumantasyonu eklendi.
- Dogrulama: targeted server repair/router/ws tests PASS (`8` dosya / `106` test), targeted web runtime tests PASS (`2` dosya / `6` test), `pnpm.cmd -w typecheck` PASS (`9` task), `pnpm.cmd -w lint` PASS (`693` dosya), `pnpm.cmd -w test` PASS (`7` task; server `137` dosya / `978` test, web `25` dosya / `68` test + `1` skipped, db `5` dosya / `26` test).

### TASK-RESILIENCE-04 - 2 MayÄ±s 2026 (Faz 4)

- Kapsam: `token-limit-recovery` agent-loop adapter yolunda three-way field deseniyle wire edildi (`undefined` default, `null` opt-out, instance pass-through).
- Default KararÄ±: `createMicrocompactStrategy()` iÃ§indeki default summarizer heuristik olduÄŸu, LLM veya external dependency Ã§aÄŸÄ±rmadÄ±ÄŸÄ± iÃ§in token-limit recovery default aÃ§Ä±k bÄ±rakÄ±ldÄ±.
- Telemetry: `token-limit-recovery` ve `tool-call-repair-recovery` iÃ§in yapÄ±landÄ±rÄ±lmÄ±ÅŸ `on_event` callback'leri eklendi; `model.completed` metadata'sÄ±na recovery stamp'i iÅŸlendi. Yeni runtime event tipi eklenmedi.
- DoÄŸrulama:
  - `pnpm.cmd --filter @runa/server typecheck` PASS
  - `pnpm.cmd --filter @runa/server lint` PASS
  - `pnpm.cmd --filter @runa/server test` PASS
- SonuÃ§: Repair recovery, token-limit recovery ve recovery telemetry aynÄ± agent-loop adapter yÃ¼zeyinde default davranÄ±ÅŸla kapanmÄ±ÅŸ oldu.

### TASK-RESILIENCE-03 - 2 MayÄ±s 2026 (Faz 3)

- Kapsam: `tool-call-repair-recovery` mekanizmasÄ± agent-loop yolunda (`run-model-turn-loop-adapter.ts`) varsayÄ±lan (default) hale getirildi ve tÃ¼m ana gateway'ler (Claude, Gemini, Groq, OpenAI, SambaNova) "structured rejection details" sistemine taÅŸÄ±ndÄ±.
- Default Wiring: `createRunModelTurnLoopExecutor` artÄ±k `tool_call_repair_recovery` parametresi verilmezse otomatik olarak bir instance oluÅŸturup enjekte ediyor. `null` geÃ§ilerek aÃ§Ä±kÃ§a devre dÄ±ÅŸÄ± bÄ±rakÄ±labilir (opt-out).
- Universal Migration: TÃ¼m gateway'ler `parseToolCallCandidatePartsDetailed` kullanacak ÅŸekilde gÃ¼ncellendi. ArtÄ±k her saÄŸlayÄ±cÄ± hata anÄ±nda `reason`, `arguments_length`, `tool_name_raw` vb. iÃ§eren yapÄ±landÄ±rÄ±lmÄ±ÅŸ detaylar Ã¼retiyor.
- Groq Ã–zel: Ã‡oklu tool call adaylarÄ±nda "all-unparseable" durumu iÃ§in toplu kurtarma desteÄŸi eklendi; karma hatalarda (mixed) gÃ¼venlik gereÄŸi kurtarma tetiklenmiyor.
- DoÄŸrulama:
  - `pnpm.cmd --filter @runa/server typecheck` PASS
  - `pnpm.cmd --filter @runa/server lint` PASS
  - `pnpm.cmd --filter @runa/server test -- tool-call-repair-recovery gateway run-model-turn-loop-adapter` PASS (`941` toplam test iÃ§inde ilgili tÃ¼m testler yeÅŸil).
- SonuÃ§: Runa'nÄ±n "self-repair" yeteneÄŸi tÃ¼m modeller iÃ§in evrensel hale getirildi ve Ã¼retim yolunda (production path) aktifleÅŸti.

### TASK-RESILIENCE-02 - 2 MayÄ±s 2026 (Faz 2)

- Kapsam: Runtime katmanÄ±na, modelin bozuk JSON Ã§Ä±ktÄ±larÄ±nÄ± tek seferlik uyarÄ±yla dÃ¼zeltmesini saÄŸlayan `Tool Call Repair Recovery` mekanizmasÄ± eklendi.
- Mimari: `token-limit-recovery` deseni birebir taklit edilerek `apps/server/src/runtime/tool-call-repair-recovery.ts` dosyasÄ± oluÅŸturuldu. MantÄ±k tamamen runtime katmanÄ±nda izole edildi (gateway baÄŸÄ±msÄ±z).
- Recovery AkÄ±ÅŸÄ±: `unparseable_tool_input` hatasÄ± alÄ±ndÄ±ÄŸÄ±nda, model request'ine Ã¶zel bir system mesajÄ± eklenerek tek seferlik (`max_retries: 1`) yeniden deneme (retry) baÅŸlatÄ±lÄ±yor.
- GÃ¼venlik: `missing_call_id` veya `invalid_tool_name` gibi yapÄ±sal hatalar "gÃ¼venli liman" ilkesi gereÄŸi kurtarma kapsamÄ± dÄ±ÅŸÄ±nda tutuldu.
- DoÄŸrulama:
  - `apps/server/src/runtime/tool-call-repair-recovery.test.ts` eklendi (Unit testler PASS).
  - `run-model-turn.ts` entegrasyonu tamamlandÄ± ve test edildi.

### TASK-RESILIENCE-01 - 2 MayÄ±s 2026 (Faz 1)

- Kapsam: DeepSeek gateway'inde streaming sÄ±rasÄ±nda yaÅŸanan "invalid tool call candidate" hatasÄ±nÄ± Ã§Ã¶zmek iÃ§in "Structured Rejection Details" sistemi kuruldu.
- Parser GÃ¼Ã§lendirme: `tool-call-candidate.ts` iÃ§inde boÅŸ argÃ¼manlarÄ±n (`undefined`/`null`/whitespace) otomatik olarak `{}` olarak kabul edilmesi saÄŸlandÄ±.
- Hata DetaylarÄ±: `GatewayResponseError` fÄ±rlatÄ±lÄ±rken Ã¼Ã§Ã¼ncÃ¼ argÃ¼man (`details`) iÃ§ine hatanÄ±n teknik nedeni (`reason`), argÃ¼man uzunluÄŸu ve ham isimler eklendi.
- Alias DayanÄ±klÄ±lÄ±ÄŸÄ±: DeepSeek'in `_` ve `-` karakterlerini karÄ±ÅŸtÄ±rmasÄ±na karÅŸÄ± "conservative fallback" (tek eÅŸleÅŸme varsa kurtar) mantÄ±ÄŸÄ± eklendi.
- DoÄŸrulama: DeepSeek streaming testleri ve parametresiz tool call senaryolarÄ± doÄŸrulandÄ±.

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

- `docs/archive/ui-overhaul/prompts/UI-OVERHAUL-07-APPROVAL-UX-STATE-FEEDBACK-PROMPT.md` eklendi. Prompt, `Approval UX & State Feedback` kapsamÃ„Â±nÃ„Â±n `docs/archive/ui-overhaul/UI-OVERHAUL-07.md` icinde gercekte 7.3 oldugunu ve 7.4'un `Operator/Developer Hard Isolation` oldugunu acikca kaydediyor; approval kapsaminda kalinmasi ve hedef/path uydurulmamasi guardrail olarak yazildi.
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

### TASK-TERMINAL-E2E-LIVE-AGENT-PROOF-05 - Shell Session Live Agent Proof - 6 Mayis 2026

- Backend-only live proof eklendi: `apps/server/scripts/terminal-session-live-proof.mjs` DeepSeek env otoritesini maskeli raporluyor, dist runtime modullerini yukluyor ve `ToolRegistry` uzerinden `shell.session.start -> shell.session.read -> shell.session.stop` zincirini calistiriyor.
- Proof summary `TERMINAL_SESSION_LIVE_PROOF_SUMMARY` alanlariyla PASS/FAIL/BLOCKED, provider/model, API key authority, run/trace id, final `run.finished`, start/read/stop gorulme durumu, runtime feedback, presentation feedback, tool event metadata, secret leak ve polling guardrail sonucunu tek satir JSON olarak raporluyor.
- Secret kaniti: proof komutu intentionally sentinel secret'i child stdout/stderr ve start args yuzeyine sokuyor; tool result, ingestion, presentation block, runtime event ve final message yuzeyleri taranarak `raw_secret_leak_detected=false` ve `secret_values_exposed=false` dogrulaniyor.
- Guardrail kaniti: `shell.session.read` polling uc tekrar ile erken `repeated_tool_call` stop almiyor, fakat 6'lik stagnation penceresinde terminal stop uretmeye devam ediyor. Bu proof unit testlerin yaninda live summary icinde de `polling_guardrail_observed=true` olarak raporlaniyor.
- Dogrulama:
  - `pnpm.cmd --filter @runa/server test -- shell-session run-tool-step ingest-tool-result presentation stop-conditions` PASS (`19` dosya / `127` test; komut `tsc` dahil calisti)
  - `pnpm.cmd --filter @runa/server test -- run-model-turn-loop-adapter agent-loop` PASS (`5` dosya / `45` test; komut `tsc` dahil calisti)
  - `pnpm.cmd --filter @runa/server run test:terminal-session-live-proof` PASS (`result="PASS"`, DeepSeek API key `.env`, model `.env`, `start_seen/read_seen/stop_seen=true`, `raw_secret_leak_detected=false`)
  - `pnpm.cmd --filter @runa/server typecheck` PASS
  - `pnpm.cmd --filter @runa/server lint` PASS (`362` dosya)
- Kapsam disi birakilanlar: `apps/web/**`, `apps/desktop-agent/**`, auth/subscription/router/provider public contracts, yeni dependency, `.env*` editleri ve public type contract degisikligi. Not: DeepSeek tool schema denemesi provider tarafinda `unparseable_tool_input` sapmasi verdiginde script bunu summary'de `tool_schema_fallback` olarak raporlayip ayri DeepSeek text roundtrip ile ModelGateway canli kanitini koruyor.

### Arsivlenen Kayitlar

- 29 Nisan 2026 ve onceki Core Hardening kayitlari `docs/archive/progress-2026-04-core-hardening.md` altina tasindi.
- Sprint 1-6 ve daha eski kayitlar icin `docs/archive/progress-phase1.md` ve `docs/archive/progress-sprint1-5.md` kullanilir.

### TASK-EDIT-PATCH-TARGET-HARDENING - 10 Mayis 2026

- Problem: `edit.patch` cok adimli dosya senaryolarinda yanlis hedefe kayma ve corrupt patch durumunda guvenilirlik riski uretiyordu.
- Degisiklik:
  - `edit.patch` contract'ina optional `target_path` eklendi ve explicit target identity dogrulamasi getirildi.
  - Preflight fail-closed kontrolleri eklendi: `target_path` workspace disi, patch header workspace disi, single-target mismatch ve ambiguous target durumlari apply oncesi bloklaniyor.
  - Approval target cozumleme `edit.patch` icin guclendirildi (`run-tool-step` + `run-execution`): explicit `target_path` varsa file path gosteriliyor, yoksa patch header'dan cozuluyor, multi-file patch'te ambiguity etiketi donuyor.
  - Regression testleri genisletildi: mismatch fail-closed, same filename farkli klasor izolasyonu, backslash target normalize davranisi, approval target propagation ve multi-file ambiguity.
  - Minimal context hardening: core tool strategy kurallarina `edit.patch` + `target_path` hizalama kurali eklendi.
- Dogrulama komutlari:
  - `pnpm.cmd --filter @runa/server test -- edit-patch` PASS
  - `pnpm.cmd --filter @runa/server test -- run-tool-step` PASS
  - `pnpm.cmd --filter @runa/server test -- run-execution` PASS
  - `pnpm.cmd --filter @runa/server test -- live-request` PASS
  - `pnpm.cmd --filter @runa/server typecheck` PASS
  - `pnpm.cmd --filter @runa/server lint` PASS
  - `pnpm.cmd --filter @runa/server test` FAIL (task-disi mevcut baseline kirmizi: `shell-exec`, `shell-session`, `ws/register-ws` testlerinde var olan ortam/baseline kaynakli hatalar)
- Kalan risk: legacy patch-only cagri yolu geriye donuk uyum nedeniyle acik; `target_path` model tarafinda her zaman uretilmedigi surece header-derived fallback devam eder (approval'da gorunur ambiguity sinyali veriliyor).

### UI Audit and Restructuring Plan - May 2026

- Kapsam: Completed a read-only audit of the frontend UI architecture to prepare for a consumer-grade, chat-first redesign.
- Yapi: Mapped components responsible for chat, run progress, approvals, and mobile layout.
- Plan: Created \docs/CHAT-UI-RESTRUCTURING-PLAN.md\ detailing the new surface model, strict rules for the main chat vs developer mode, and a 4-phase PR plan to eliminate card-in-card nesting and raw debug leaks.
- Sonuc: Audit only, no implementation code touched.

### TASK-FRONTEND-RESTRUCTURING-PLAN-CHAT-FIRST-AUDIT - 11 Mayis 2026

- Kapsam: Kod degisikligi yapmadan, mevcut Runa frontend mimarisi ve ekran goruntusu denetim artefaktlari uzerinden chat-first yeniden yapilanma plani hazirlandi.
- Inceleme: `apps/web/src/pages/ChatPage.tsx`, `apps/web/src/components/chat/*`, `apps/web/src/components/chat/blocks/*`, `apps/web/src/components/developer/RunTimelinePanel.tsx`, `apps/web/src/components/app/AppShell.tsx`, `apps/web/src/styles/primitives.css`, `apps/web/src/styles/components.css`, `apps/web/src/styles/routes/app-shell-migration.css`, `docs/design-audit/screenshots/*/manifest.json`.
- Cikti: `docs/design/ui-restructure/CHAT-FRONTEND-RESTRUCTURING-PLAN-2026-05-11.md` olusturuldu.
- Dokuman icerigi: mevcut UI architecture map, component bazli problem alanlari, ana chat/default gorunum kurallari, details/developer mode ayrim kurallari, phased PR plani (kucuk diff odakli), risk/regression listesi ve PR bazli gorsel kabul kriterleri.
- Kritik bulgu basliklari: run bilgisi tekrarli render yuzeyleri, teknik/debug dilin user-facing akis riskleri, card-in-card yogunlugu ureten CSS module seams, mobile sticky/fixed katmanlar arasinda overlap riski.
- Sonuc: Yalniz plan/audit tamamlandi; implementasyon degisikligi yapilmadi.

### PR-16-MARKDOWN-RENDERING-POLISH - 15 Mayis 2026

- Hedef: Markdown renderer'i sifirdan yazmadan, mevcut `TextBlock -> StreamdownMessage -> Streamdown` pipeline'ini koruyarak chat mesajlarindaki markdown gorunumunu semantic class contract, link security, mobile overflow ve test kapsamiyla guclendirmek.
- Degisiklikler:
  - `StreamdownMessage.tsx`:
    - Root container'a default `runa-markdown` class'i eklendi; `className` prop ile birlestiriliyor.
    - Components map genisletildi: `p`, `h1`/`h2`/`h3`, `ul`/`ol`/`li`, `blockquote`, `a`, `table`/`thead`/`tbody`/`tr`/`th`/`td`, `hr` override'lari eklendi.
    - Her ogede Runa class contract kullaniliyor (`runa-markdown__paragraph`, `runa-markdown__heading`, `runa-markdown__list`, `runa-markdown__list-item`, `runa-markdown__blockquote`, `runa-markdown__link`, `runa-markdown__table-wrap`, `runa-markdown__table`, `runa-markdown__inline-code`, `runa-markdown__rule`).
    - Heading `data-level` ve list `data-list-kind` attribute'lari eklendi.
    - Link security: `getSafeHref` / `isExternalHref` helper'lari ile `javascript:`, `data:`, `vbscript:` bloklaniyor; external linklerde `target="_blank"` ve `rel="noreferrer noopener"` ekleniyor.
    - Inline code override `runa-markdown__inline-code` class'i ile guclendirildi.
  - `markdownLinks.ts`: Yeni dosya — unsafe protocol denylist, `getSafeHref`, `isExternalHref`.
  - `MermaidBlock.tsx` / `MermaidRenderer.tsx`: User-facing metinler Turkcelestirildi (`Diyagram yukleniyor...`, `Diyagram render edilemedi.`); `securityLevel: 'strict'` korunuyor.
  - `components.css`: Markdown class ailesi (.blockquote, .rule, .list-item, .diagram-skeleton, .mermaid-diagram, .mermaid-fallback) eklendi; heading size varyantlari (h1=20px, h2=16px, h3=14px) ve inline-code pilI olmayan inline gorunum.
- Sozlesme korunanlar: Mevcut `CodeBlock` copy/highlight, Mermaid lazy loading, Shiki `dangerouslySetInnerHTML` izolasyonu, `streaming`/`static` mode prop'u, CJK/math plugin'leri.
- Kapsam disi: yeni dependency, backend contract degisikligi, Streamdown library degisikligi, activity/approval/terminal mimari degisikligi.
- Yeni test dosyasi: `StreamdownMessage.test.tsx` (22 test — semantic render, inline/fenced code, table, link security, mojibake, root class).
- Varolan test genisletmesi: `BlockRenderer.test.tsx` — text block semantic HTML, raw markdown syntax gorunmezligi, safe/unsafe link, inline+fenced code.
- Mojibake guard: `design-language-lock.test.ts` streamdown dosyalarini da kapsayacak sekilde genisletildi.
- Dogrulama:
  - `pnpm.cmd --filter @runa/web lint` PASS
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web test` PASS (44 dosya, 207 test)
  - `pnpm.cmd --filter @runa/web build` PASS
- Kalan risk: Mevcut smoke spec markdown rendering icin ozel fixture icermiyor; terminal detail/output goruntusu bu PR'a dahil degil. Markdown visual regression takibi ayri smoke/gorsel PR ile eklenebilir.

### TASK-WS-AUTH-TRANSPORT-HARDENING-01 - 14 Mayis 2026

- Kapsam: WebSocket auth transport hardening tamamlandi; hedef sadece warning temizligi degil, gercek bearer/Supabase JWT'nin URL query, browser/network URL ve log yuzeylerinden kaldirilmasiydi.
- Guvenlik modeli:
  - Browser runtime artik `access_token` ile WS URL kurmuyor; `/auth/ws-ticket` uzerinden kisa omurlu, tek kullanimlik, path-bound `ws_ticket` alip WS'e bununla baglaniyor.
  - Server default/prod davranista query `?access_token=` reddediyor; sadece explicit backward-compat flag (`RUNA_WS_ALLOW_QUERY_ACCESS_TOKEN=1`) aciksa legacy path kabul ediliyor.
  - `ws_ticket` modeli: TTL clamp (30-60s), one-time consume, path audience ayrimi (`/ws` vs `/ws/desktop-agent`), digest/hash tabanli saklama, reuse/expired/path mismatch rejection.
  - `/ws` ve `/ws/desktop-agent` handshake'lerinde ticket resolver wiring aktif.
  - Origin ve transport guvenligi: exact origin allowlist + production secure transport enforcement (localhost/dev explicit istisna).
  - Logout sonrasi aktif WS session kapatma (session registry invalidation) aktif.
  - Logger redaction katmani genisletildi: `access_token`, `refresh_token`, `ws_ticket`, bearer/jwt pattern ve query/hash secret alanlari maskeleniyor.
- Lifecycle/root-cause:
  - `useChatRuntime` WS lifecycle'i reconnect/attempt id + stale event ignore + controlled CONNECTING close ile merkezi hale getirildi.
  - Ticket fetch abort/cancel ve stale socket event izolasyonu eklendi; hizli navigation churn'de beklenmeyen close path'leri kontrol altina alindi.
- Degisen ana dosyalar:
  - Server: `apps/server/src/ws/ws-ticket.ts`, `apps/server/src/ws/ws-session-registry.ts`, `apps/server/src/ws/ws-security.ts`, `apps/server/src/ws/ws-auth.ts`, `apps/server/src/ws/register-ws.ts`, `apps/server/src/routes/auth.ts`, `apps/server/src/app.ts`, `apps/server/src/utils/logger.ts` ve ilgili test dosyalari.
  - Web: `apps/web/src/lib/ws-client.ts`, `apps/web/src/lib/auth-client.ts`, `apps/web/src/hooks/useChatRuntime.ts`, `apps/web/src/lib/ws-client.test.ts`, `apps/web/src/hooks/useChatRuntime.approval.test.tsx`, `apps/web/src/hooks/useChatRuntime.narration.test.tsx`.
  - Desktop/smoke: `apps/desktop-agent/src/auth.ts`, `apps/desktop-agent/src/ws-bridge.ts`, `apps/desktop-agent/src/session.ts`, `apps/desktop-agent/src/logger.ts`, smoke scriptleri (`live-auth-companion-smoke.mjs`, `packaged-runtime-smoke.mjs`) ve E2E harness `e2e/serve-runa-e2e.mjs`, yeni `e2e/ws-auth-transport-hardening.spec.ts`.
- Dogrulama:
  - `pnpm.cmd --filter @runa/web lint` PASS
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/server typecheck` PASS
  - `pnpm.cmd --filter @runa/server test -- ws-auth.test.js ws-subscription-gate.test.js ws-ticket.test.js ws-security.test.js workspace-attestation.test.js logger.test.js app.test.js` PASS (`7` dosya / `71` test)
  - `pnpm.cmd --filter @runa/web test -- src/lib/ws-client.test.ts src/hooks/useChatRuntime.approval.test.tsx src/hooks/useChatRuntime.narration.test.tsx` PASS (`3` dosya / `8` test)
  - `pnpm.cmd exec playwright test e2e/ws-auth-transport-hardening.spec.ts --config playwright.config.ts --project=chromium --workers=1` PASS (`1` test)
    - Senaryo: login bootstrap + hizli route gecisleri (`/history`, `/settings`, `/devices`, `/chat`) + chat send.
    - Assertion: runtime WS URL'lerinde `access_token`/`refresh_token` yok, `/ws` baglantilarinda `ws_ticket` var; `pageErrors=[]`, `badResponses=[]`, warning signal yok.
  - `pnpm.cmd --filter @runa/desktop-agent test` PASS (`14` dosya / `35` test)
  - `pnpm.cmd --filter @runa/desktop-agent dist:win` PASS
  - `pnpm.cmd --filter @runa/desktop-agent smoke:packaged` PASS (`DESKTOP_PACKAGED_RUNTIME_SMOKE_SUMMARY`)
  - `pnpm.cmd --filter @runa/desktop-agent smoke:live-auth` BLOCKED (beklenen: canli environment credential eksik; summary'de `missing_env` ve `status=blocked` acik)
- Deprecated/backward-compat notu:
  - Legacy query-token yolu sadece explicit flag ile acilabilir, default kapali ve deprecated.
### PR-16: Markdown rendering polish (15 Mayis 2026)

**Amac:** Markdown rendering kalitesi, link guvenligi, CSS duzgunlugu, encoding dogrulugu ve visual coverage.

**Degisiklikler:**
- **Link safety:** `getSafeHref()` allowlist mantigina gecti (`http:`, `https:`, `mailto:` allowed; `javascript:`, `data:`, `vbscript:`, `file:`, `ftp:`, `chrome:` ve unknown absolute protocol'ler blocked). Protocol-relative URL'ler (`//...`) external kabul edilir. `isExternalHref()` protocol-relative destekler. Attribute sirasi guvenceye alindi (`...props` once, sanitized `target/rel/href/className` sonra).
- **CSS:** Stray `.runa-markdown__list &` nesting selector kaldirildi (dead selector; zaten `.runa-markdown__list .runa-markdown__list` ile karsilaniyor).
- **BOM fix:** `BlockRenderer.test.tsx`'ten UTF-8 BOM (`U+FEFF`) kaldirildi.
- **Guard testler:** `design-language-lock.test.ts`'e stray `&` selector guard'i ve UTF-8 BOM guard'i eklendi. Mojibake guard kapsami korunuyor.
- **Visual smoke:** Yeni Playwright spec (`ui-overhaul-16-markdown-rendering-smoke`) — heading, list, blockquote, inline code, table, code block, external link, mojibake, page-level horizontal overflow (390/320px) dogrulaniyor.
- **Streamdown fenced code riski:** Valid mixed markdown (inline + fenced) icin test eklendi, raw backtick leak yok. Invalid same-line fence normalization kapsam disi.

**Sonuclar:**
- `pnpm.cmd --filter @runa/web lint` PASS
- `pnpm.cmd --filter @runa/web typecheck` PASS
- `pnpm.cmd --filter @runa/web test` PASS (`44` dosya / `217` test / `1` skipped)
- `pnpm.cmd --filter @runa/web build` PASS
- `pnpm.cmd exec playwright test apps/web/tests/visual/ui-overhaul-16-markdown-rendering-smoke.spec.ts` PASS (`2` test)
- Yeni smoke artefact degisikligi olusmadi (screenshot/manifest yok).

- Kalan risk:
  - Kod ve local/package smoke seviyesinde kalan kritik risk gorulmedi.
  - Gercek staging/production credential ile `smoke:live-auth` yeniden kosulmadan canli ortam kaniti tamamlanmis sayilmaz (operasyonel/environment blocker).

