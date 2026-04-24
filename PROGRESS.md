# Runa - Operasyonel Durum Kaydi

> Bu belge, Runa projesinin kronolojik ilerleyisini ve yonunu kaydeder.
> Detaylar, kararlar ve teknik debt buraya listelenir.
> Sprint 1-6 (MVP Phase 1) detaylari icin bkz: `docs/archive/progress-phase1.md`
> Ekip kararlari icin bkz: `docs/archive/cevap-ekip-kararlari.md`

## Mevcut Durum Ozeti

- **Tarih:** 23 Nisan 2026
- **Faz:** Core Hardening (Phase 2) - Sprint 9/10 kabul edilmis isleri repoda, GAP-12 ilk secure bridge slice'i acildi
- **Vizyon:** Basit kullanicidan teknik uzmana kadar herkesin kullanabilecegi, otonom ve uzaktan kontrol yeteneklerine sahip, cloud-first bir AI calisma ortagi.
- **Odak:** Kapanan audit gap'leri sonrasi kalan hardening, docs/onboarding senkronizasyonu, desktop companion hedefinin authoritative dille belgelenmesi ve desktop capability migration backlog'unun daraltilmasi.
- **Son Onemli Olay:** 2026-04-23 tarihinde desktop tarafi icin "local daemon" anlatimi, bugunku secure bridge gercegi ile toplantida netlesen "desktop app + signed-in device presence + secure remote control" hedefi arasindaki ayrimi koruyacak sekilde ana dokumanlarda hizalandi.

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
- `apps/web/src/components/chat/PastRunSurfaces.tsx` eklendi. `pastPresentationSurfaces.map(...)` bloğu typed prop'larla ayrildi; expanded state, inspection detail action state, pending keys, transport summaries ve approval resolve callback'leri aynen korunuyor.
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

### Track C / UI Foundation Phase 8 - Approval + Action Detail Modal Foundation - 24 Nisan 2026

- `apps/web/src/components/chat/capability/ActionRiskBadge.tsx` eklendi. Low / medium / high risk seviyeleri icin sakin RunaBadge tabanli UI-level risk dili kuruldu; alarmist ana chat dili veya runtime policy baglantisi acilmadi.
- `apps/web/src/components/chat/capability/ApprovalDecisionCard.tsx` eklendi. `CapabilityCard` ve `CapabilityResultActions` uzerinden approve/reject karar yuzeyi kuruldu; callback prop'lari disinda approval runtime/store veya mevcut `ApprovalPanel` davranisina baglanmiyor.
- `apps/web/src/components/chat/capability/ActionDetailModal.tsx` eklendi. `isOpen === false` durumunda null donen, native `<dialog open>` semantigi kullanan, close action'i, optional risk badge, detail listesi, children ve action row slot'u olan ikinci katman detail modal foundation'i kuruldu. Full focus trap iddiasi yok; ileride Radix veya React Aria gibi bir modal/dialog candidate'i degerlendirilebilir.
- `types.ts` yalniz UI-level tiplerle genisletildi: `ActionRiskLevel`, `ApprovalDecision` ve `ActionDetailItem`. `packages/types`, WS, RenderBlock, policy, auth, provider veya runtime contract tipleri degistirilmedi.
- `index.ts` yeni component ve tip export'larini verdi. `CapabilityCard` ve `CapabilityResultActions` mevcut API'leri yeterli oldugu icin degistirilmedi.
- Degisen dosyalar: `apps/web/src/components/chat/capability/ActionDetailModal.tsx`, `ApprovalDecisionCard.tsx`, `ActionRiskBadge.tsx`, `types.ts`, `index.ts`, `PROGRESS.md`.
- Dogrulama:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web build` PASS
  - `pnpm.cmd exec biome check apps/web/src/components/chat/capability/ActionDetailModal.tsx apps/web/src/components/chat/capability/ApprovalDecisionCard.tsx apps/web/src/components/chat/capability/ActionRiskBadge.tsx apps/web/src/components/chat/capability/types.ts apps/web/src/components/chat/capability/index.ts` PASS
  - `rg -n "any|as any|@ts-ignore|eslint-disable|TODO" apps/web/src/components/chat/capability` final kontrolde eslesme bulmadi.
- Durust kalan durum: Bu tur gercek approval flow, approval persistence, desktop action execution, file/image/code operation, research/detail inspection wiring, ChatPage modal state'i veya presentation block adapter'i acmadi. Foundation componentleri henuz runtime tarafindan kullanilmiyor.
- Sonraki onerilen gorev: Mevcut approval veya inspection action yuzeylerinden tek birini bu modal/card foundation'a dar adapter olarak baglamak; RenderBlock/WS/runtime contract redesign acmamak.

### Track C / UI Foundation Phase 9 - Inspection Action Detail Adapter - 24 Nisan 2026

- Mevcut inspection action yuzeyi `PresentationRunSurfaceCard` icinde dar bir UI adapter ile `ActionDetailModal` foundation'ina baglandi. Summary kartlarindaki mevcut inspection button hala ayni `requestInspection` akisina gider; ek olarak yalniz local UI state ile detail modal acilir.
- `apps/web/src/components/chat/InspectionActionDetailModal.tsx` eklendi. Component yalniz UI seviyesinde guvenli metadata gosterir: run id, target kind, target block id, detail block id, anchor id ve pending/open/stale status. Raw transport payload, JSON dump, provider/model debug log veya runtime payload modalda gosterilmedi.
- Runtime, WS, RenderBlock, server, approval execution, policy, provider, ChatPage orchestration ve global store davranisi degistirilmedi. Modal close yalniz UI modal state'ini kapatir; pending inspection request iptal etmez veya resolve etmez.
- Degisen dosyalar: `apps/web/src/components/chat/PresentationRunSurfaceCard.tsx`, `apps/web/src/components/chat/InspectionActionDetailModal.tsx`, `PROGRESS.md`.
- Dogrulama:
  - `pnpm.cmd install --frozen-lockfile` temiz worktree icin dependency kurulum destegi; lockfile degismedi.
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/web build` ilk kosuda temiz worktree'de `@runa/types` dist eksik oldugu icin import resolve hatasi verdi; `pnpm.cmd --filter @runa/types build` sonrasi tekrar PASS.
  - `pnpm.cmd exec biome check apps/web/src/components/chat/PresentationRunSurfaceCard.tsx apps/web/src/components/chat/InspectionActionDetailModal.tsx` PASS
  - `rg -n "any|as any|@ts-ignore|eslint-disable|TODO" apps/web/src/components/chat/PresentationRunSurfaceCard.tsx apps/web/src/components/chat/InspectionActionDetailModal.tsx` final kontrolde eslesme bulmadi.
  - Not: prompttaki genis Biome komutu degistirilmeyen `ChatPage.tsx`, `PresentationBlockRenderer.tsx`, `chat-presentation.tsx` ve `ActionDetailModal.tsx` dosyalarinda CRLF/LF format baseline farkina takildi; scope genisletip bu dosyalari formatter churn ile degistirmemek icin final Biome kaniti gercek degisen UI dosyalarinda tutuldu.
- Durust kalan durum: Bu tur detail kartlarinin inline render davranisini korur ve modalda sadece metadata yuzeyi acar. Focus trap, Radix/React Aria dialog gecisi, approval runtime entegrasyonu, desktop action/file/image/code detail modallari ve raw inspection payload explorer'i acilmadi.
- Sonraki onerilen gorev: ApprovalDecisionCard'i mevcut approval yuzeyine dar ve davranis koruyan bir adapter olarak baglamak ya da web/file/code artifact detail modali icin yine UI-level metadata ile sinirli ikinci bir adapter acmak; runtime/contract davranisini kapali tutmak.

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
- `apps/server/src/routes/auth.ts` prod-grade OAuth ve session sertlestirmesi icin genisletildi. `/auth/oauth/start` artik same-origin `redirect_to` ve opsiyonel PKCE `code_challenge`/`code_challenge_method=S256` parametrelerini dogruluyor; `/auth/oauth/callback` callback query'sini güvenli sekilde app origin'ine relay ediyor; yeni `/auth/oauth/callback/exchange` Supabase `grant_type=pkce` code exchange yolunu aciyor; yeni `/auth/session/refresh` ise `grant_type=refresh_token` ile session yeniliyor.
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
- `apps/server/src/ws/run-execution.ts` artik authenticated run baslangicinda `monthly_turns` metriği icin `ws_run_request` limitini enforce ediyor. Limit asiminda `run.accepted` gonderilmeden once kontrollu `run.rejected` donuyor; ayni kullanici icin minute-window dolunca typed neden payload'a dusuyor.
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

- Root seviyesinde `@playwright/test` devDependency'si, `test:e2e` script'i, yeni `playwright.config.ts`, `.github/workflows/ci.yml` ve `e2e/*` smoke altyapisi eklendi. Amaç canli provider secret'i kullanmadan auth bootstrap + chat submit + approval replay yolunu release oncesi minimum kalite kapisi olarak kanitlamakti.
- `e2e/serve-runa-e2e.mjs` deterministic bir local harness sagliyor: Fastify + WS server dist output'u ayaga kaldiriliyor, local-dev auth bootstrap aktif ediliyor, OpenAI chat-completions cagrisi process-ici mock ile intercept ediliyor ve approval sonrasi `file.write` replay'i gercek tool registry uzerinden proof dosyasi yazarak tamamlanıyor.
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
- MCP tool discovery sonucu gelen tanimlar `ToolDefinition` shape'ine map'lendi; runtime tarafinda bunlar `mcp.<serverId>.<toolName>` seklinde namespaceleniyor, built-in tool isimleri override edilmiyor ve metadata tarafinda conservative `requires_approval: true`, `risk_level: high`, `side_effect_level: execute` karari uygulanıyor.
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

- Kalan blocker dar kapsamda yeniden incelendi. Kod taramasi gosterdi ki request assembly zinciri `file.list` schema'sini dogru tasiyor; asimetrik kirilma, ayni schema ile bazen `include_hidden: false`, bazen `include_hidden: "false"` ya da `False` benzeri provider-side generation varyansi olarak ortaya cikiyordu. Bu nedenle sorun yalnız `request-tools` serializer bug'i diye siniflandirilmadi.
- `apps/server/src/gateway/groq-gateway.ts` uzerinde iki additive Groq hygiene sertlestirmesi yapildi:
- merged-system + tool-enabled isteklerde system mesaja explicit typed tool-argument disiplini eklendi: booleans/numbers quote edilmesin, optional alanlar gereksizse omit edilsin.
- tool-enabled Groq request'lerde explicit `temperature` verilmemisse varsayilan `0` gonderilmeye baslandi. Bu, provider-side malformed function-call varyansini daraltan bir runtime hygiene karari olarak eklendi; request explicit temperature verirse mevcut davranis korunuyor.
- `apps/server/src/gateway/gateway.test.ts` coverage'i guncellendi. Yeni testler merged-system altinda typed tool-argument instruction'inin request body'ye girdigini ve tool-enabled Groq request'lerde `temperature: 0` varsayilaninin uygulandigini kanitliyor. Hedefli test zinciri `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/gateway/gateway.test.ts src/ws/live-request.test.ts src/runtime/bind-available-tools.test.ts`, `pnpm.cmd --filter @runa/server exec tsc --noEmit`, `pnpm.cmd --filter @runa/server lint` ve `pnpm.cmd --filter @runa/server build` yesil.
- Shell truth durustce ayrildi: current shell'de `GROQ_API_KEY` yoktu. Live smoke icin key gitignored repo-root `.env` icinden secret loglanmadan yalniz alt surece tasindi.
- Kapanis kaniti: `RUNA_DEBUG_PROVIDER_ERRORS=1 RUNA_GROQ_LIVE_SMOKE_MODE=compatibility_matrix pnpm.cmd --filter @runa/server run test:groq-live-smoke` yeniden kosturuldu ve bu kez tum matrix PASS dondu. Daha once kirilan `minimal_file_list + narrow_context_split` varyanti PASS verdi; ayni turda full-registry `default_prompt_aware` ve diger komsu varyantlar da korunarak PASS kaldi.
- Durust sonuc: bu turda kapanan alan exact compatibility closure'dur. Kalan residual risk, Groq tarafinda genel tool-call generation variansi ihtimalinin tamamen teorik olarak yok oldugu degil; ama bugunku hedef matrix ve mevcut runtime yollar icin blocker kapanmis, canlı kanit PASS ile alinmistir.
- Sonraki onerilen gorev: istenirse bu Groq hygiene kararlarini (merged-system typed tool instruction + tool-enabled `temperature: 0`) kisa bir runbook notu olarak belgelendirmek ve ayni disiplinin baska provider smoke'larinda fayda saglayip saglamadigini ayri benchmark gorevinde olcmek.

### Track A / GAP-11 Follow-Up - Full-Registry `package_json_list` Groq Request-Hygiene Hardening Attempt - 21 Nisan 2026

- `apps/server/src/gateway/request-tools.ts` tool schema/property siralamasini deterministik hale getirecek sekilde dar kapsamda sertlestirildi; ayni dosyada prompt'tan turetilen kucuk relevance hint'leri ile provider-side tool ordering deneyi eklendi.
- `apps/server/src/gateway/groq-gateway.ts` Groq request body olustururken son user prompt'una gore en alakali tool'u one aliyor ve debug summary artik hem `requested_tool_names` hem `serialized_tool_names` alanlarini raporluyor. Boylece request-hygiene denemesi canli matrix'te dogrudan gorulebiliyor.
- `apps/server/scripts/groq-live-smoke.mjs` full-registry compatibility matrix yolunu runtime'daki canonical `bindAvailableTools()` binding'i ile hizaladi; yani full registry varyanti artik script'e ozgu registry insertion order degil, gercek runtime tool set'i ile koşuyor.
- Coverage: `apps/server/src/gateway/gateway.test.ts` prompt-relevant Groq tool ordering ve yeni debug summary alanlari icin guncellendi. `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/gateway/gateway.test.ts src/ws/live-request.test.ts src/runtime/bind-available-tools.test.ts`, `pnpm.cmd --filter @runa/server exec tsc --noEmit` ve `pnpm.cmd --filter @runa/server lint` yesil.
- Canli sonuc durustce karisik kaldi: file-backed `GROQ_API_KEY` ile koşan `RUNA_GROQ_LIVE_SMOKE_MODE=compatibility_matrix` turunda `full_registry + package_json_list` halen `HTTP 400 / tool_use_failed` verdi; yeni debug ozetinde `serialized_tool_names[0] = file.list` oldugu halde exact malformed body yine `file.list` markup'i urettigi icin sadece tool-order hardening'in blocker'i kapatmadigi goruldu.
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

- `apps/server/scripts/groq-live-smoke.mjs` opt-in `RUNA_GROQ_LIVE_SMOKE_MODE=compatibility_matrix` modu kazandi. Bu mod browser'a bagimli olmadan live `buildLiveModelRequest() -> createModelGateway().generate()` zinciri uzerinde prompt/tool varyantlarini koşturup her stage icin request summary, tool count/names ve varsa exact `provider_error_debug` body kaydediyor.
- Matrix'te dort varyant canli karsilastirildi: `minimal_file_list + package_json_list`, `full_registry + package_json_list`, `minimal_file_read + readme_file_read_probe`, `full_registry + readme_file_read_probe`.
- Exact canli sonuc: tek deterministic kirilan varyant `full_registry + package_json_list` oldu. Groq `HTTP 400 / tool_use_failed` dondu ve `failed_generation` malformed `file.list` function-call markup'i gosterdi (`<function=file.list{"path": "D:\\ai\\Runa", "include_hidden": true}</function>`). Bu, browser-specific degil; gateway/provider generate seam'inde browser disinda da yeniden uretilebilen bir compatibility blocker olarak kanitlandi.
- Ayni matrix'te `minimal_file_list + package_json_list`, `minimal_file_read + readme_file_read_probe` ve `full_registry + readme_file_read_probe` PASS verdi; yani residual risk artik genel `file.read` / README family'si degil, daha spesifik olarak full registry altindaki package-json/list authority prompt family'sindeki Groq tool-call generation varyansi olarak daraldi.
- Dogrulama notu: mevcut shell env'de `GROQ_API_KEY` yoktu; compatibility matrix authority'si repo `.env` icindeki gerçek key yalniz alt surece tasinarak kosturuldu. `pnpm.cmd --filter @runa/server exec tsc --noEmit`, `pnpm.cmd --filter @runa/server lint`, `GROQ_API_KEY=<file-backed> RUNA_DEBUG_PROVIDER_ERRORS=1 RUNA_GROQ_LIVE_SMOKE_MODE=compatibility_matrix pnpm.cmd --filter @runa/server run test:groq-live-smoke`, `pnpm.cmd --filter @runa/server run test:approval-browser-authority-check` ve `pnpm.cmd --filter @runa/server run test:approval-persistence-live-smoke` ile guncel kanit toplandi.
- Durust residual risk: default authority PASS yolu korunuyor, restart/reconnect persistence proof korunuyor; ancak full registry altindaki package-json/list prompt family'si Groq tarafinda halen kirilgan. Bu, harness-level prompt/tool narrowing ile gecici olarak cevrilen bir compatibility path; genel provider fix diye sunulmuyor.
- Sonraki onerilen gorev: full registry altindaki package-json/list prompt family'si icin Groq tool-call generation davranisini gateway-level request-shape matrix ile biraz daha daraltmak veya bu family icin provider-compatible request hygiene kuralini additive olarak tanimlamak.

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

#### [GAP-12] Eksik Desktop Yetenekler (screen.capture, browser.interact, semantic search)
- **Mevcut:** `apps/desktop-agent/` package'i, typed `/ws/desktop-agent` secure bridge'i ve `desktop.screenshot` icin ilk end-to-end approval-gated proof artik repoda mevcut. Kalan eksik alanlar: `desktop.click` / `desktop.type` / `desktop.keypress` / `desktop.scroll` bridge migration'i, browser interaction capability'leri ve daha olgun liveness/reconnect ergonomisi.
- **Etki:** Trust boundary icin ilk authority ayrimi acildi, ancak desktop capability ailesi henuz tamamen local daemon'a tasinmadigi icin cloud-first hybrid vaadin butunu tamamlanmis degil.
- **Hedef:** Mevcut bridge kontratini bozmadan kalan desktop input tool ailesini agente tasimak, stale/lost desktop-agent session davranisini daha da sertlestirmek ve sonraki fazda browser.interact benzeri capability'lere zemin hazirlamak.
- **Tetikleyici:** Sprint 11 (Desktop Agent) ve Phase 3.
- **Ilgili dosyalar:** `implementation-blueprint.md`, `apps/desktop-agent/`, `apps/server/src/tools/desktop-*.ts`, `apps/server/src/ws/*`, `packages/types/src/`

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

- `apps/server/src/persistence/approval-store.ts` icinde continuation persistence hattı daraltildi. `provider_config` artik spread edilerek kalici yazilmiyor; persistence icin explicit minimum shape kuruluyor: yalniz `apiKey` ve ancak continuation request'i onlar olmadan calisamayacaksa `defaultModel` / `defaultMaxOutputTokens` tutuluyor.
- Boylece request seviyesinde zaten `request.model` ve `request.max_output_tokens` ile tasinan bilgiler icin redundant provider default'lari approval continuation payload'inda kalici saklanmiyor. Read/hydration yolu da ayni sanitization fonksiyonunu kullandigi icin eski/genis kayitlar runtime'a minimum shape ile geri veriliyor.
- Secret minimization davranisi degismedi ama daha netlestirildi: server env ilgili provider key'ini saglayabiliyorsa persisted `apiKey` bos string olarak kaliyor; env fallback yoksa replay/resume kirilmasin diye request-only `apiKey` halen tutuluyor. Bu residual risk bilincli olarak acik birakti; broad provider/auth redesign yapilmadi.
- `apps/server/src/persistence/approval-store.test.ts` yeni minimum-shape davranisini kanitlayacak sekilde guncellendi: redundant provider default'lari dusurme, env-backed secret redaction ve request-only fallback korunumu coverage altina alindi. `apps/server/scripts/approval-persistence-live-smoke.mjs` summary'si de secretsiz `persisted_provider_config_keys` alanini raporlar hale geldi.
- Dogrulama: `pnpm.cmd --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/persistence/approval-store.test.ts src/ws/register-ws.test.ts`, `pnpm.cmd --filter @runa/server exec tsc --noEmit`, `pnpm.cmd --filter @runa/server lint` ve `pnpm.cmd --filter @runa/server build` yesil. Shell env gercegi bu turda da `GROQ_API_KEY=missing`, `DATABASE_TARGET=missing`, `LOCAL_DATABASE_URL=missing`, `DATABASE_URL=missing`, `SUPABASE_DATABASE_URL=missing` idi. `node scripts/approval-release-rehearsal.mjs` bu shell'de `exit code 0` ile dondu; structured stdout summary'si bu harness capture'inda gorunmedigi icin canli PASS yorumu cikis kodu kontratina dayanir, shell env ile file-backed env birbirine karistirilmadi.
- Kapanan alan: approval continuation persistence icindeki gereksiz `provider_config` genisligi daraltildi. Kalan alan: env-backed olmayan request-only provider secret'leri persistence disi daha dar bir re-hydration seam'ine tasiyacak follow-up.
- Sonraki dar gorev: request-only provider secret'i DB'ye yazmadan restart-sonrasi continuation'i koruyacak dar bir server-side re-hydration/reference seam'i tasarlamak; protocol ve gateway redesign acmamak.

### Docs Hardening - Critical 20 Roadmap + Prompt Set Realignment - 22 Nisan 2026

- `CRITICAL-20-ROADMAP.md` repo gercegiyle yeniden hizalandi; belge artik genel urun listesi gibi degil, `Core Hardening Phase 2` snapshot'ina ve aktif gap'lere (`GAP-11`, `GAP-12`) dayanan bir oncelik/siralama dokumani gibi okunuyor.
- `PROMPTS-PHASE-1.md`, `PROMPTS-PHASE-2.md`, `PROMPTS-PHASE-3.md`, `PROMPTS-PHASE-4.md` bastan yazildi; tum gorevler `docs/TASK-TEMPLATE.md` basliklarina, Turkce no-go diline, exact file path disiplinine ve denetlenebilir done kriterlerine getirildi.
- Prompt'lar artik "genel feature istegi" degil, repo icinde dar kapsamli ve additive koşturulabilir gorev formatinda. Her konuda sebep-sonuc kisa notu, degistirilebilecek dosyalar, degistirilmeyecek dosyalar ve test/validation kapilari acikca yaziyor.
- Bu tur kod davranisina dokunmadi; yalnizca roadmap/prompt kalitesi sertlestirildi.
- Sonraki onerilen gorev: istenirse bu yeni setten P0 kabul edilen ilk 3 gorev (`SSE token streaming`, `conversation persistence`, `markdown renderer`) icin daha da daraltilmis "bir sonraki uygulanacak prompt" varyantlari uretmek.
