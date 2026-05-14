# PR-10 Gap Audit Report

> Tarih: 2026-05-14
> Yontem: Kaynak kod taramasi + komut ciktisi. Her iddia dosya:satir veya komut sonucu ile yazildi.

## 1. CHAT-UI 14 Bug Durumu

### BUG-1 - Asistan cevabi bosluga dusuyor - HIGH
- Durum: KAPALI
- Kanit dosya:satir:
  - docs/CHAT-UI-AUDIT-2026-05.md:33
  - apps/web/src/hooks/useChatRuntime.ts:1100-1107
  - apps/web/src/hooks/useChatRuntime.ts:1131-1133
  - apps/web/src/hooks/useConversations.ts:790-804
- Mevcut kod:
```ts
const streamingTextSnapshot = chatStore.getState().presentation.currentStreamingText;
onRunFinishingRef.current?.({ conversationId, runId: parsedMessage.payload.run_id, streamingText: streamingTextSnapshot });
currentStreamingRunId: null, currentStreamingText: ''
```
- Yorum: `run.finished` sirasinda text snapshot `onRunFinishing` ile aktariliyor, sonra streaming temizleniyor; `handleRunFinished` blok+mesaj hydration yaptigi icin eski bosluk penceresi kapanmis gorunuyor.

### BUG-2 - F5 sonrasi render block'lar kayboluyor - HIGH
- Durum: KAPALI
- Kanit dosya:satir:
  - docs/CHAT-UI-AUDIT-2026-05.md:61
  - apps/server/src/routes/conversations.ts:225
  - apps/web/src/hooks/useConversations.ts:347-352
  - apps/web/src/hooks/useConversations.ts:792-804
- Mevcut kod:
```ts
'/conversations/:conversationId/blocks'
const response = await fetch(`/conversations/${encodeURIComponent(conversationId)}/blocks`, {
const [nextConversations, nextMessages, nextMembers, nextSurfaces] = await Promise.all([
```
- Yorum: Auditteki eksik `/blocks` endpointi artik var; frontend run-finish akisinda block hydration yapiyor.

### BUG-3 - "Calisma tamamlandi..." paragrafi kalicilasiyor - HIGH
- Durum: KAPALI
- Kanit dosya:satir:
  - docs/CHAT-UI-AUDIT-2026-05.md:81
  - apps/web/src/lib/chat-runtime/current-run-progress.ts:457-458
  - apps/web/src/pages/ChatPage.tsx:230-239
- Mevcut kod:
```ts
const isRunCompleted = currentRunProgress?.status_tone === 'success';
const currentRunProgressPanel = isDeveloperMode && currentRunProgress && !isRunCompleted ? (
```
- Yorum: Fallback detail string kodda dursa da panel normal kullanicida ve run tamamlandiginda render edilmiyor.

### BUG-4 - "Islem tamamlandi" generic tool result basligi - MED
- Durum: KAPALI
- Kanit dosya:satir:
  - docs/CHAT-UI-AUDIT-2026-05.md:102
  - apps/web/src/components/chat/blocks/ToolResultBlock.tsx:77
  - apps/web/src/components/chat/blocks/ToolResultBlock.tsx:96-107
- Mevcut kod:
```ts
const friendlyToolLabel = resolveToolLabel(block);
<span className={styles['toolLineLabel']}>{friendlyToolLabel}</span>
<p>{getFriendlyOutputSummary(block)}</p>
```
- Yorum: Non-dev satirinda generic "Islem tamamlandi" yerine arac-ozel etiket/ozet kullaniliyor.

### BUG-5 - ThinkingBlock developer-only gizli - HIGH
- Durum: KAPALI
- Kanit dosya:satir:
  - docs/CHAT-UI-AUDIT-2026-05.md:122
  - apps/web/src/components/chat/RunProgressPanel.tsx:99-116
- Mevcut kod:
```ts
if (!isDeveloperMode) {
  const thinkingSteps = createThinkingSteps(progress);
  <ThinkingBlock ... steps={thinkingSteps} />
}
```
- Yorum: ThinkingBlock artik non-dev dalinda da var; eski developer-only engeli kalkmis.

### BUG-6 - Approval karti 5-katmanli ve fazla buyuk - HIGH
- Durum: KISMEN
- Kanit dosya:satir:
  - docs/CHAT-UI-AUDIT-2026-05.md:143
  - apps/web/src/components/chat/blocks/ApprovalBlock.tsx:213-257
  - apps/web/src/components/chat/blocks/ApprovalBlock.tsx:259-315
  - apps/web/src/components/chat/blocks/BlockRenderer.module.css:324-425
- Mevcut kod:
```ts
<header className={styles['approvalHeader']}>
{resolvePendingApproval ? <div className={styles['approvalActions']}> ... </div> : <ResolvedSummary ... />}
{isDeveloperMode ? <RunaDisclosure ...> ... </RunaDisclosure> : null}
```
- Yorum: User-facing JSX sade (header + target + action/resolved). Ancak eski `approvalStatusChip/approvalDecision/approvalStateFeedback` CSS bloklari dosyada duruyor; stil debt devam ediyor.

### BUG-7 - runa-migrated-components-* CSS tech debt - MED
- Durum: KAPALI
- Kanit dosya:satir:
  - docs/CHAT-UI-AUDIT-2026-05.md:172
  - apps/web/src/styles/routes/README.md:5-6
- Mevcut kod:
```md
PR-2 only moves chat layout shell rules back into `components.css`; broad cleanup for
the remaining `*-migration.css` files is deferred to PR-7.
```
- Yorum: `apps/web/src/styles/routes/` altinda yalniz `README.md` var. `import .*migration.css` aramasi 0 sonuc.

### BUG-8 - CodeBlock <=20 satir her zaman acik - MED
- Durum: KAPALI
- Kanit dosya:satir:
  - docs/CHAT-UI-AUDIT-2026-05.md:190
  - apps/web/src/components/chat/blocks/CodeBlock.tsx:18
  - apps/web/src/components/chat/blocks/CodeBlock.tsx:43-45
- Mevcut kod:
```ts
const COLLAPSED_LINE_LIMIT = 8;
const isLongBlock = lines.length > COLLAPSED_LINE_LIMIT;
const [isExpanded, setIsExpanded] = useState(!isLongBlock);
```
- Yorum: Esik 20'den 8'e cekilmis; uzun bloklar default collapsed.

### BUG-9 - ToolActivityIndicator raw status string - LOW
- Durum: KAPALI
- Kanit dosya:satir:
  - docs/CHAT-UI-AUDIT-2026-05.md:212
  - apps/web/src/components/chat/ToolActivityIndicator.tsx:46-54
- Mevcut kod:
```ts
case 'active': return 'Calisiyor';
case 'completed': return 'Tamamlandi';
case 'failed': return 'Basarisiz';
```
- Yorum: Raw status yerine TR etiket + ikon render var.

### BUG-10 - PersistedTranscript chat balonu yok - MED
- Durum: KAPALI
- Kanit dosya:satir:
  - docs/CHAT-UI-AUDIT-2026-05.md:232
  - apps/web/src/components/chat/PersistedTranscript.tsx:41-57
  - apps/web/src/components/chat/PersistedTranscript.module.css:65-76
- Mevcut kod:
```ts
className={`${styles['message']} ... runa-transcript-message--${message.role}`}
<div className={styles['bubble']}>
  <StreamdownMessage>{message.content}</StreamdownMessage>
```
- Yorum: Role-aware transcript bubble yapisi var; asistan markasi da eklenmis.

### BUG-11 - useChatRuntime useMemo dependency patlamasi - HIGH
- Durum: ACIK
- Kanit dosya:satir:
  - docs/CHAT-UI-AUDIT-2026-05.md:250
  - apps/web/src/hooks/useChatRuntime.ts:1262-1269
  - apps/web/src/hooks/useChatRuntime.ts:1632-1708
- Mevcut kod:
```ts
const presentationSurfaceState = useMemo(() => derivePresentationSurfaceState(...), [expectedPresentationRunIds, presentationRunId, presentationRunSurfaces]);
return useMemo(() => ({ ... messages, presentationRunSurfaces, runTransportSummaries, ... }), [ ... messages, presentationRunSurfaces, runTransportSummaries, ... ]);
```
- Yorum: Cok genis dependency seti halen var; streaming ve surfaces degisimiyle memo invalidasyonu yuksek.

### BUG-12 - Reconnect zombie run - MED
- Durum: KAPALI
- Kanit dosya:satir:
  - docs/CHAT-UI-AUDIT-2026-05.md:274
  - apps/web/src/hooks/useChatRuntime.ts:1194-1207
- Mevcut kod:
```ts
const zombieCheckTimer = window.setTimeout(() => {
  if (stillSubmitting) { ... isSubmitting: false ... currentStreamingText: '' }
}, 12_000);
```
- Yorum: reconnect sonrasi 12sn zombie timeout guard var.

### BUG-13 - Hizli coklu submit matchesTrackedRun race - MED
- Durum: KAPALI
- Kanit dosya:satir:
  - docs/CHAT-UI-AUDIT-2026-05.md:293
  - apps/web/src/hooks/useChatRuntime.ts:379
  - apps/web/src/hooks/useChatRuntime.ts:1344
  - apps/web/src/hooks/useChatRuntime.ts:1050-1052
- Mevcut kod:
```ts
const expectedPresentationRunIdsRef = useRef<Set<string>>(new Set());
expectedPresentationRunIdsRef.current.add(payload.run_id);
if (expectedPresentationRunIdsRef.current.has(parsedMessage.payload.run_id)) { expectedPresentationRunIdsRef.current.delete(...) }
```
- Yorum: Tek run id yerine `Set` tabanli takip var; hizli coklu submit race'i icin dogrudan iyilestirme uygulanmis.

### BUG-14 - Memory write silent fail - LOW
- Durum: KAPALI
- Kanit dosya:satir:
  - docs/CHAT-UI-AUDIT-2026-05.md:320
  - apps/web/src/hooks/useChatRuntime.ts:1135-1144
- Mevcut kod:
```ts
if (memory_write_status === 'failed' || memory_write_status === 'partial') {
  chatStore.setConnectionState((s) => ({ ...s, lastError: 'Bilgi kaydedilemedi ...' }));
}
```
- Yorum: Silent fail yerine kullaniciya acik hata state'i set ediliyor.

## 2. PR-1..9 Kabul Kriteri Bos Kanit Listesi

### PR-1 (`docs/design/ui-restructure/PR-1-CODEX-BRIEF.md:368-407`)
- Dogrulananlar:
  - Gorsel dosyalar mevcut: `docs/design-audit/screenshots/2026-05-13-ui-restructure-pr-1-theme/*` (10 dosya).
  - Lighthouse JSON var: 2 adet (`lighthouse-mobile-4g-login.json`, `lighthouse-mobile-4g-login.preview.json`).
- BOS KANIT:
  - `lint/typecheck/test/build` toplu CI ciktisi bu auditte tekrar alinmadi.
  - `font payload <=220KB`, FCP/CLS olcum ciktisi bu worktreede yok.

### PR-2 (`docs/design/ui-restructure/PR-2-CODEX-BRIEF.md:185-229`)
- Dogrulananlar:
  - Gorsel klasor ve beklenen 6 ekran var.
  - Lock test PR-2 assertleri var: `apps/web/src/test/design-language-lock.test.ts:119-134`.
  - Chat dalinda direct trigger yok: `apps/web/src/components/app/AppShell.tsx:259-273`.
- BOS KANIT:
  - `lint/typecheck/test/build` toplu CI ciktisi bu auditte tekrar alinmadi.
  - Lighthouse skoru/CLS kaydi yok.

### PR-3 (`docs/design/ui-restructure/PR-3-CODEX-BRIEF.md:230-268`)
- Dogrulananlar:
  - Gorsel klasor ve beklenen 6 ekran + `EVIDENCE-MAP.md` var.
  - `PersistedTranscript` roleLabel/time izi yok: `apps/web/src/components/chat/PersistedTranscript.tsx:1-66`.
  - `groupMessagesByDay` export var: `apps/web/src/components/chat/transcriptGroup.ts:30`.
- BOS KANIT:
  - PR-3 lock test maddeleri `design-language-lock.test.ts` icinde yok (dosya daha cok PR-1/2/8 kurallarini kilitliyor).
  - "DOM'da ISLEM SONUCU 0 instance" icin test/komut kaydi yok.

### PR-4 (`docs/design/ui-restructure/PR-4-CODEX-BRIEF.md:274-309`)
- Dogrulananlar:
  - Gorsel klasor ve beklenen 7 ekran + `EVIDENCE-MAP.md` var.
  - `approvalRisk` export var: `apps/web/src/components/chat/blocks/approvalRisk.ts:39`.
  - `RunaButton` danger variant var: `apps/web/src/components/ui/RunaButton.tsx:6`.
- BOS KANIT:
  - Height siniri (`<=140px`, `<=36px`) icin olcum ciktisi yok.
  - PR-4 lock test maddeleri `design-language-lock.test.ts` icinde yok.

### PR-5 (`docs/design/ui-restructure/PR-5-CODEX-BRIEF.md:233-265`)
- Dogrulananlar:
  - Gorsel klasor ve beklenen 5 ekran + `EVIDENCE-MAP.md` var.
  - `pnpm --filter @runa/server test -- user-label-coverage` PASS (bu auditte tekrar calistirildi).
  - `user_label_tr` akisi server ve webde aktif: `apps/server/src/tools/user-label-coverage.test.ts:5-9`, `apps/web/src/components/chat/blocks/ToolResultBlock.tsx:37`.
- BOS KANIT:
  - PR-5 lock test maddeleri web lock test dosyasinda yok.
  - `lint/typecheck/build` tum seti bu auditte tekrar alinmadi.

### PR-6 (`docs/design/ui-restructure/PR-6-CODEX-BRIEF.md:188-223`)
- Dogrulananlar:
  - Gorsel klasor ve beklenen 6 ekran + `EVIDENCE-MAP.md` var.
  - `RunaSheet/RunaModal` export var: `apps/web/src/components/ui/index.ts:15-18`.
  - `HistorySheet/MenuSheet/ContextSheet` aktif kullaniliyor: `apps/web/src/pages/ChatPage.tsx:423-451`.
  - `aria-controls="history-sheet"` var: `apps/web/src/components/chat/ChatHeader.tsx:43`.
  - Mobil menu butonu `MoreHorizontal`: `apps/web/src/components/chat/ChatHeader.tsx:98`.
- BOS KANIT:
  - Focus trap / body lock / swipe-down / ESC davranislari icin bu auditte e2e calismasi yok.
  - Lighthouse A11y >=90 kaydi yok.

### PR-7 (`docs/design/ui-restructure/PR-7-CODEX-BRIEF.md:245-287`)
- Dogrulananlar:
  - Gorsel klasor ve beklenen 8 ekran + `EVIDENCE-MAP.md` var.
  - `styles/routes` altinda migration css dosyasi yok (yalniz `README.md`).
  - Yasak legacy token kaliplari 0 match (komut sonucu):
    - `var(--page-background) => 0`
    - `var(--gradient-panel) => 0`
    - `var(--surface-canvas) => 0`
    - `var(--border-subtle) => 0`
    - `var(--text-base) => 0`
    - `var(--text-3xl) => 0`
    - `var(--text-4xl) => 0`
  - Stop ikonu/import ve abort export var:
    - `apps/web/src/components/chat/ChatComposerSurface.tsx:2,294`
    - `apps/web/src/hooks/useChatRuntime.ts:1378,1665`
- BOS KANIT:
  - E2E stop path testi ciktisi yok.
  - Lighthouse performance + CSS bundle buyukluk kaydi yok.

### PR-8 (`docs/design/ui-restructure/PR-8-CODEX-BRIEF.md:193-231`)
- Dogrulananlar:
  - `useVisualViewport()` mount var: `apps/web/src/App.tsx:55`.
  - `SkipToContent` AppShell chat dalinda ilk oge: `apps/web/src/components/app/AppShell.tsx:261-264`.
  - Reduced-motion kapsama 47/47 module css (komut sonucu).
  - Lock testte `useVisualViewport`, `SkipToContent`, reduced-motion assertleri var: `apps/web/src/test/design-language-lock.test.ts:90-93,165-173`.
  - Gorsel klasor ve beklenen 5 ekran + `EVIDENCE-MAP.md` var.
- BOS KANIT:
  - PR-8 icin lighthouse skor JSON kaydi yok (repo genelinde sadece PR-1 klasorunde 2 json var).
  - Screen reader/NVDA/VoiceOver calisma logu yok.

### PR-9 (`docs/design/ui-restructure/PR-9-CODEX-BRIEF.md:194-220`)
- Dogrulananlar:
  - Brief mevcut.
  - `scripts/audit-tokens.mjs` dosyasi yok (`Test-Path` sonucu: `False`).
  - Token audit canli sayiminda halen `34` tanimsiz token tipi ve `149` kullanim bulundu.
  - Ornek tanimsiz token referanslari aktif:
    - `apps/web/src/components/chat/RunProgressPanel.module.css:19` (`var(--text-link)`)
    - `apps/web/src/styles/primitives.css:80` (`var(--border-default)`)
    - `apps/web/src/styles/components.css:2820` (`var(--ink-4)`)
- BOS KANIT:
  - PR-9 icin screenshot klasoru yok (`docs/design-audit/screenshots/*pr-9*` sonuc vermiyor).
  - PR-9 kabul kriterindeki `node scripts/audit-tokens.mjs PASS` kaniti yok.
  - PR-9 lock test genisletmesi kaniti yok.

## 3. Plan-Disi Kalan Alanlar

### 3.1 Markdown rendering kalitesi
- Kanit dosya:satir:
  - apps/web/src/lib/streamdown/StreamdownMessage.tsx:19-50
  - apps/web/src/components/chat/PersistedTranscript.tsx:55-57
- Gozlem:
  - `code` bloklari custom `CodeBlock`, `mermaid` custom `MermaidBlock`a gidiyor.
  - Inline code plain `<code>` (`StreamdownMessage.tsx:39-40`).
  - Table/list/blockquote icin ayri custom renderer yok; Streamdown defaultuna birakiliyor.
- Durum: KISMEN

### 3.2 Empty state oneri chip'leri
- Kanit dosya:satir: apps/web/src/components/chat/EmptyState.tsx:9-30,63-75
- Gozlem: Oneriler sabit dizi; 3 adet prompt statik. Kullanici/oturum bagimli personalization akisi yok.
- Durum: ACIK

### 3.3 Loading/skeleton state'leri
- Kanit dosya:satir:
  - apps/web/src/pages/ChatPage.tsx:396-431
  - apps/web/src/pages/SettingsPage.tsx:407-408
  - apps/web/src/pages/HistoryPage.tsx:154-178
  - apps/web/src/pages/DevicesPage.tsx:96-118
- Komut sonucu: `apps/web/src/pages` altinda 11 route dosyasinin 5'inde loading paterni var, 6'sinda yok.
- Loading paterni olmayanlar: `CapabilityPreviewPage.tsx`, `ChatRuntimePage.tsx`, `DeveloperPage.tsx`, `DeveloperRuntimePage.tsx`, `HistoryRoute.tsx`, `NotificationsPage.tsx`.
- Durum: KISMEN

### 3.4 Tool icon set
- Kanit dosya:satir:
  - apps/web/src/components/chat/ChatComposerSurface.tsx:2
  - apps/web/src/components/chat/ToolActivityIndicator.tsx:1
  - apps/web/src/components/onboarding/OnboardingWizard.tsx:1
- Komut sonucu: `lucide-react` importundan 50 farkli ikon kullaniliyor.
- Marka SVG varliklari:
  - apps/web/src/assets/runa-logo.svg
  - apps/web/public/favicon.svg
  - HafizaMark componenti: apps/web/src/components/ui/HafizaMark.tsx
- Durum: KISMEN

### 3.5 Voice composer
- Kanit dosya:satir:
  - apps/web/src/components/chat/VoiceComposerControls.tsx:27-68
  - apps/web/src/hooks/useVoiceInput.ts:74-76,100-121,144-179
- Gozlem:
  - `VoiceComposerControls` UI ve prop render katmani.
  - Recording state, permission denied, `onerror`, `onresult` ve start/stop akisi hook tarafinda.
- Durum: KISMEN

### 3.6 Settings sayfasi icerik derinligi
- Kanit dosya:satir:
  - apps/web/src/pages/SettingsPage.tsx:72-76
  - apps/web/src/pages/SettingsPage.tsx:441-691
- Gozlem:
  - 3 tab degil, 5 tab var: `appearance`, `conversation`, `notifications`, `privacy`, `advanced`.
  - Tab icerikleri:
    - appearance: 3 alan (Tema, Renk paleti, Tipografi)
    - conversation: 2 alan (Onay modu, Ses tercihleri)
    - notifications: 3 alan (Dil, Sessiz saatler, Veri saklama)
    - privacy: 3 alan (Aktif kok, Run klasoru, Klasor yenile)
    - advanced: 1 alan (Gelismis gorunum toggle)
- Durum: ACIK (beklenti ile mevcut bilgi mimarisi uyusmuyor)

### 3.7 Onboarding flow
- Kanit dosya:satir:
  - apps/web/src/components/onboarding/OnboardingWizard.tsx:90-95
  - apps/web/src/styles/fonts.css:10,36
  - apps/web/src/styles/components.css:1786-1798
- Gozlem:
  - `OnboardingPage.tsx` yok; aktif onboarding `OnboardingWizard.tsx`.
  - HafizaMark kullaniliyor; tipografide `Instrument Serif` global token tanimli.
- Durum: KISMEN

## 4. Dokumantasyon Aciklari

- `docs/PROGRESS.md` "Mevcut Durum Ozeti" tarihi: `2 Mayis 2026` (`docs/PROGRESS.md:8-11`).
- PR-3..PR-9 icin ayri kayit: Yok. Toplu kapanis var (`docs/PROGRESS.md:16-32`).
- `TASK-UI-RESTRUCTURE-COMPLETE` final entry: Var (`docs/PROGRESS.md:16`).
- `docs/INDEX.md` UI source-of-truth isareti:
  - `docs/RUNA-DESIGN-LANGUAGE.md` aktif tasarim kurali olarak listeli (`docs/INDEX.md:17,25`).
- `docs/RUNA-DESIGN-LANGUAGE.md` status:
  - `Last updated: 2026-05-14` (`docs/RUNA-DESIGN-LANGUAGE.md:3`)
  - `Status: Source of truth for web UI ...` (`docs/RUNA-DESIGN-LANGUAGE.md:4`)

## 5. Teknik Debt

- `RunProgressPanel` mount durumu:
  - `ChatPage` icinde developer mode + run-complete degilse render: `apps/web/src/pages/ChatPage.tsx:232-239`.
  - Sonuc: PR-3 notundaki "dev mode panelinde mount" hedefi gerceklesmis.
- Approval eski CSS artiklari:
  - `approvalStatusChip`, `approvalDecision`, `approvalStateFeedback` classlari halen dosyada (`apps/web/src/components/chat/blocks/BlockRenderer.module.css:324-425`) ama TSX tarafinda referans yok.
- `prefers-reduced-motion` kapsami:
  - Komut sonucu: `47 / 47` module css dosyasi kapsaniyor.
- TypeScript `any` / `@ts-ignore`:
  - Komut sonucu: `any-or-assert-any: 0`, `ts-ignore-or-expect-error: 0` (`apps/web/src` taramasi).
- Test coverage (`apps/web/src/test/`):
  - Komut sonucu: `1` dosya.
  - Dosya: `apps/web/src/test/design-language-lock.test.ts`.
  - Kapsam daha cok PR-1/2/8 lock; PR-3/4/5/6/7/9'a ait lock assertionlar tek dosyada gorunmuyor.

## 6. Oncelik Onerisi

HIGH: BUG-11 (runtime memo/dependency buyuklugu) ve PR-9 token cleanup kanit bosluklari once kapatilmali; cunku biri performans/regresyon riski, digeri tasarim dili tutarliliginda dogrudan undefined token riski uretmeye devam ediyor. MED: PR-8 screen reader + lighthouse kaniti ve plan-disi alanlarda EmptyState personalization ile loading parity eksikleri tamamlanmali. LOW: Kullanilmayan approval CSS artiklari temizlenerek teknik debt azaltilmali.
