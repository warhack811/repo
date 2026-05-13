# Runa Frontend Restructuring Plan (2026-05-11)

## Kapsam ve girdi

Bu dokuman yalnizca plan/audit calismasidir; kod degisikligi onerir ama implement etmez.

Incelenen kaynaklar:
- `apps/web/src/pages/ChatPage.tsx`
- `apps/web/src/components/chat/*`
- `apps/web/src/components/chat/blocks/*`
- `apps/web/src/components/developer/RunTimelinePanel.tsx`
- `apps/web/src/components/app/AppShell.tsx`
- `apps/web/src/styles/primitives.css`
- `apps/web/src/styles/components.css`
- `apps/web/src/styles/routes/app-shell-migration.css`
- `docs/design-audit/screenshots/*/manifest.json`

Rekabetten alinacak disiplin (kopya degil):
- Tek bir birincil yuzey (chat)
- Tekrarsiz metadata
- Kisa ve sakin activity dili
- Onayin sakin, kolay karar veren bir akisa inmesi
- Ham debug dilinin varsayilan yuzeyden cikmasi
- Mobilde ayri yerlesim, desktop'un sikistirilmis hali degil

## Mevcut UI architecture map

```text
App.tsx
  -> AuthenticatedApp.tsx
    -> AppShell.tsx
      -> ChatRuntimePage.tsx
        -> ChatPage.tsx
          -> ChatLayout.tsx
            -> Sidebar: ConversationSidebar.tsx
            -> Main Work: CurrentRunSurface.tsx
               -> PersistedTranscript.tsx
               -> RunProgressPanel.tsx
               -> StreamingMessageSurface.tsx
               -> PresentationRunSurfaceCard.tsx
                 -> chat-presentation/rendering.tsx
                   -> BlockRenderer.tsx
                     -> TextBlock / WorkNarrationBlock / ToolResultBlock / ApprovalBlock / RunTimelineBlock / ...
            -> Composer: ChatComposerSurface.tsx
            -> Insights (Right rail): WorkInsightPanel.tsx
          -> (Developer mode) RunTimelinePanel.tsx
```

## Soru bazli component eslestirmesi

1) Ana chat mesajlarini render edenler:
- `apps/web/src/components/chat/CurrentRunSurface.tsx`
- `apps/web/src/components/chat/PersistedTranscript.tsx`
- `apps/web/src/components/chat/StreamingMessageSurface.tsx`
- `apps/web/src/components/chat/PresentationRunSurfaceCard.tsx`
- `apps/web/src/components/chat/blocks/BlockRenderer.tsx` ve `TextBlock` / `WorkNarrationBlock`

2) Tool activity / run progress / live notlar:
- `apps/web/src/components/chat/RunProgressPanel.tsx`
- `apps/web/src/components/chat/ThinkingBlock.tsx`
- `apps/web/src/components/chat/ToolActivityIndicator.tsx`
- `apps/web/src/components/chat/blocks/RunTimelineBlock.tsx`
- `apps/web/src/lib/chat-runtime/current-run-progress.ts`
- `apps/web/src/components/chat/WorkInsightPanel.tsx`

3) Approval cardlari:
- `apps/web/src/components/chat/blocks/ApprovalBlock.tsx`
- `apps/web/src/components/chat/blocks/BlockRenderer.tsx` (`approval_block` switch)
- `apps/web/src/components/chat/PresentationRunSurfaceCard.tsx` (approval'u run surface icinde host eder)

4) Right rail context/progress panelleri:
- Non-developer right rail: `apps/web/src/components/chat/WorkInsightPanel.tsx`
- Developer secondary panel: `apps/web/src/components/developer/RunTimelinePanel.tsx`

5) Desktop vs mobile layout kontrolu:
- Shell ve nav: `apps/web/src/components/app/AppShell.tsx`, `AppNav.tsx`
- Layout iskeleti: `apps/web/src/components/chat/ChatLayout.tsx`
- Breakpoint ve sticky/fixed davranislar: `apps/web/src/styles/components.css`, `apps/web/src/styles/primitives.css`, `apps/web/src/styles/routes/app-shell-migration.css`

6) Ayni agent-run bilgisinin tekrarlandigi yerler:
- `current-run-progress.ts` -> `RunProgressPanel` (headline/detail/steps)
- Ayni run timeline item'lari -> `RunTimelineBlock`
- Ayni adimlarin son parcasi -> `WorkInsightPanel` (`visibleSteps`)
- Developer mode'da `RunTimelinePanel`, main chat'teki `currentRunProgressPanel` ve `currentPresentationContent`'i tekrar render ediyor

7) Ham developer/debug copy sizintisi olan noktalar:
- `apps/web/src/lib/chat-runtime/runtime-feedback.ts` icindeki teknik dil:
  - "presentation blocks kapali"
  - "gorunur yuzey koprusu"
  - "canli runtime"
  Bu metinler `RunProgressPanel` detail/headline uzerinden ana chat akisina cikabiliyor.
- `apps/web/src/components/chat/blocks/RunFeedbackBlock.tsx` icindeki teknik/ingilizce copy:
  - "Run feedback"
  - "detail pending"
  (developer agirlikli dil, urun dili degil)

8) Card-in-card hissi ureten CSS module'ler:
- `apps/web/src/components/chat/blocks/BlockRenderer.module.css`
  - `.block` + `.approvalCard` + `.approvalStateFeedback` + `.metaBox` + `.toolResultCard`
- `apps/web/src/components/chat/RunProgressPanel.module.css`
  - `.root` ve `.activityLine` ayri kart katmanlari
- `apps/web/src/components/chat/PresentationRunSurfaceCard.module.css`
  - `.card`, `.pastCard`, `.summary` yapisi
- `apps/web/src/components/chat/WorkInsightPanel.module.css`
  - right-rail icinde birden fazla panel karti
- `apps/web/src/components/chat/ChatComposerSurface.module.css`
  - composer icinde panelimsi `moreContent` ve `attachmentsList`

9) Mobile header/composer/bottom-nav overlap riski ureten kurallar:
- `apps/web/src/styles/components.css`
  - `.runa-chat-layout__composer { position: sticky; bottom: calc(... + 78px); }`
  - `.runa-app-nav { position: fixed; bottom: calc(... + 8px); }`
  - `.runa-page--chat-product { padding-bottom: calc(148px + ...); }`
- `apps/web/src/components/chat/ChatComposerSurface.module.css`
  - mobile `moreContent` fixed bottom `84px`
- `apps/web/src/components/chat/blocks/BlockRenderer.module.css`
  - mobile `approvalActions` sticky bottom `92px`

Bu uc farkli sticky/fixed tabaka (composer, approval actions, bottom nav) ayni viewport'ta birbirini itiyor veya tiklama/okunurluk cakis masi riski olusturuyor.

## Ekran goruntusu audit bulgulari ile durum

`docs/design-audit/screenshots/*/manifest.json` verileri su anki iyilesmeleri dogruluyor:
- Forbidden/dev copy'nin buyuk bolumu ana yuzeyden cikmis
- Mobilde yatay overflow buyuk oranda kontrol altinda
- Approval buton clear-space kontrolleri bircok senaryoda PASS

Ama ayni manifest notlari ve CSS tabakasi, layout'in hala "kuralli ama kirilgan" oldugunu gosteriyor:
- Pointer interception/overlay riski gecmiste gorulmus
- Ayni anda birden fazla sticky/fixed katman var
- Tekrarlayan run ozeti farkli kutularda tekrar ediliyor

## Yeni surface modeli (chat-first)

### 1) Main chat (birincil yuzey)
Sadece su ogeler varsayilan gorunur olur:
- User mesaji
- Assistant cevap
- Kisa canli durum satiri (tek satir/tek ritim)
- Approval karar karti (inline, sakin)
- Tool sonucu (kisa, anlamli ozet)

### 2) Activity summary (ince katman)
- Ayrica panel degil
- Mevcut cevabin altinda tek ritimli mini durum satiri
- En fazla 1-2 satir, tekrar yok

### 3) Details (istege bagli)
- Run timeline tam detaylari
- Inspection/detail card'lar
- Teknik run metadata
- "Detaylari goster" ile acilan drawer/accordion/sheet

### 4) Approval
- Ana chat akisinda kalir
- Tek karar sorusu + iki buton
- Risk notu tek satir
- Ham payload / call_id / raw target yalniz details/developer katmaninda

### 5) Right rail (desktop)
- Varsayilan kapali veya minimum
- Chat'i ikinci plana itmez
- Sadece ozet metrikler, run adimlarini tekrar etmez

### 6) Mobile sheets
- Right rail yerine bottom sheet
- Tek aktif sheet kuralý
- Composer/nav ile katman cakis masi yasamaz

### 7) Developer Mode
- Raw transport
- Trace/debug
- Inspection action detaylari
- Provider/runtime teknikleri
Hepsi yalniz Developer Mode'da.

## Ana chat icin kesin kural (default whitelist)

Ana chat'te varsayilan olarak sadece su bilgi tipleri olabilir:
- Kullanici niyeti/mesaji
- Asistanin insan-dili cevabi
- Kisa calisma ilerleme ozeti
- Onay gerektiren karar noktasi
- Sonucun kullaniciya etkisi

Ayni run_id/trace_id/call_id/tool ham kimlikleri, state machine adlari ve transport teknik terimleri varsayilan gorunumde yer alamaz.

## Details / Developer Mode icin kesin kural (default blacklist)

Asagidaki icerik default chat'ten cikarilir, sadece Details veya Developer Mode'a gider:
- `run_id`, `trace_id`, `call_id`
- raw runtime event adlari (`MODEL_THINKING`, `TOOL_RESULT_INGESTING` gibi)
- ham tool adlari (`file.write`, `desktop.screenshot`) dogrudan teknik formatta
- raw transport / websocket payload
- trace/debug aciklamalari
- inspection internal metadata

## Phased PR plani (kucuk ve reviewable)

### PR-1: Surface contract temizlik (davranis degistirmeden)
Hedef:
- Main chat whitelist / details blacklist kuralini kod seviyesinde netlestirmek
- "Neresi user-facing, neresi developer-facing" boundary'sini sabitlemek
Dosyalar:
- `ChatPage.tsx`
- `RunProgressPanel.tsx`
- `runtime-feedback.ts`
- `RunFeedbackBlock.tsx`
Cikti:
- Teknik dili normalize eden mapping seam'i
- Main chat'e debug copy sizmasini engelleyen tek giris kapisi

### PR-2: Duplicate run bilgisini tekilleþtirme
Hedef:
- Ayni run adiminin 2-3 yerde tekrarini kaldirmak
- Main chat + right rail rollerini ayrýþtýrmak
Dosyalar:
- `RunProgressPanel.tsx`
- `WorkInsightPanel.tsx`
- `RunTimelineBlock.tsx`
- `RunTimelinePanel.tsx`
Cikti:
- "Tek run, tek ana ozet" kurali
- Right rail sadece tamamlayici baglam

### PR-3: Approval + tool-result sadeleþtirme
Hedef:
- Approval'i tek karar satirina indirmek
- Tool-result kartlarini sohbet ritmine yaklastirmak
Dosyalar:
- `ApprovalBlock.tsx`
- `ToolResultBlock.tsx`
- `BlockRenderer.module.css`
Cikti:
- Card-in-card azalmasi
- Daha sakin, daha hizli taranabilir akis

### PR-4: Mobile layout katman reformu
Hedef:
- Header/composer/nav/approval sticky cakis masini tek katman modeline indirmek
Dosyalar:
- `components.css`
- `primitives.css`
- `ChatComposerSurface.module.css`
- `BlockRenderer.module.css`
Cikti:
- Mobilde tek anchor (composer+nav) stratejisi
- Approval action ve sheet davranislarinda overlap-siz kural

### PR-5: Right rail -> responsive secondary surface
Hedef:
- Desktop right rail sade ozet
- Mobile'da sheet/drawer tabanli ikinci katman
Dosyalar:
- `ChatLayout.tsx`
- `WorkInsightPanel.tsx` + module
- gerekli route-level css
Cikti:
- Desktop ve mobile farkli, amac odakli secondary surface

## Riskler ve regression alanlari

- Approval akisi regression riski (onay butonlari, pending->resolved gecisi)
- Streaming sirasinda layout jump riski
- Sticky/fixed katman degisiminde pointer/tap regression riski
- Developer Mode izolasyonunun bozulmasi riski
- E2E selector'lerinin (visual tests) degisen DOM hiyerarsisinden etkilenmesi
- Accessibility riski: focus-order ve aria-live mesaj sirasinin bozulmasi

## PR bazli gorsel kabul kriterleri

### PR-1 kabul kriteri
- Main chat'te "runtime, trace, raw, call_id" gibi teknik terim gorunmez
- Runtime feedback metinleri urun dilinde ve tek satir odakli

### PR-2 kabul kriteri
- Ayni run adimi bir ekranda en fazla bir kez gorunur
- Right rail kapali olsa bile ana chat tum kritik bilgiyi verir

### PR-3 kabul kriteri
- Approval karti mobile 390 ve 320'de tek bakista karar verdirir
- Tool-result karti birincil mesaj akisindan kopuk ikinci panel gibi hissettirmez

### PR-4 kabul kriteri
- 320 / 390 / 414 viewport'ta:
  - header, composer, bottom-nav ust uste binmez
  - approval aksiyonlari tiklanabilir kalir
  - yatay overflow yok

### PR-5 kabul kriteri
- Desktop: right rail ana chat'i daraltmadan sakin ozet verir
- Mobile: right rail icerigi sheet uzerinden acilir, varsayilan gorunum chat-first kalir

## Sonuc

Runa'nin mevcut yapi tasi dogru: chat merkezli bir omurga var.
Fakat urun kalitesi hedefi icin bir sonraki adim, "daha fazla component" degil "daha kesin surface disiplini".
Bu planin odagi tam olarak budur:
- Tek bir birincil yuzey
- Tekrarsiz bilgi
- Sakin karar akisi
- Mobilde dogru katman modeli
- Teknik gucun Developer Mode'da korunmasi
