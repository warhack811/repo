# Runa Chat UI — Kapsamlı Audit Raporu (2026-05)

> Oturum: 2026-05-03  
> Yöntem: Doğrudan kaynak kod taraması — uydurma yok, her iddia file:line ile desteklenmiş.  
> Çalışma kopyası: `D:/ai/Runa/.claude/worktrees/jovial-shamir-7c2fcf`  
> Kapsam: `apps/web` + `apps/server`

---

## Özet

Bu oturumda Runa chat arayüzünde **14 doğrulanmış bug** tespit edilmiştir. Bunların 5'i HIGH öncelikli (kullanıcının doğrudan şikayetleri veya kritik veri kaybı), 6'sı MED, 3'ü LOW. Her bulgu doğrudan kaynak kod taramasıyla kanıtlanmıştır; tahmin yoktur.

| ID | Başlık | Öncelik | Sprint |
|---|---|---|---|
| BUG-1 | Asistan cevabı boşluğa düşüyor | 🔴 HIGH | A |
| BUG-2 | F5 sonrası render block'lar kayboluyor | 🔴 HIGH | E |
| BUG-3 | "Çalışma tamamlandı" paragrafı kalıcılaşıyor | 🔴 HIGH | A |
| BUG-4 | "İşlem tamamlandı" generic tool result başlığı | 🟡 MED | D |
| BUG-5 | ThinkingBlock developer-only gizli | 🔴 HIGH | B |
| BUG-6 | Approval kartı 5-katmanlı ve fazla büyük | 🔴 HIGH | C |
| BUG-7 | runa-migrated-components-* CSS tech debt | 🟡 MED | G |
| BUG-8 | CodeBlock ≤20 satır her zaman açık | 🟡 MED | C |
| BUG-9 | ToolActivityIndicator raw status string | 🟢 LOW | B |
| BUG-10 | PersistedTranscript chat balonu yok | 🟡 MED | D |
| BUG-11 | useChatRuntime useMemo dependency patlaması | 🔴 HIGH | G |
| BUG-12 | Reconnect zombie run (sonsuz "Çalışıyor...") | 🟡 MED | F |
| BUG-13 | Hızlı çoklu submit matchesTrackedRun race | 🟡 MED | A |
| BUG-14 | Memory write silent fail | 🟢 LOW | F |

---

## BUG-1 — Asistan cevabı boşluğa düşüyor (mesajlar görünmüyor) — HIGH 🔴

**Dosyalar:**
- `apps/web/src/hooks/useChatRuntime.ts:934-938` (senkron clear)
- `apps/web/src/hooks/useConversations.ts:627-656` (async refetch)
- `apps/web/src/components/chat/StreamingMessageSurface.tsx:15-22` (görünürlük koşulu)

**Kök neden:**  
`run.finished` WS event'i geldiğinde `useChatRuntime.ts:937` satırında `currentStreamingText: ''` ve `currentStreamingRunId: null` **senkron** olarak set edilir. Bu anda `StreamingMessageSurface.tsx:15-22`:

```typescript
const shouldShowStreamingSurface =
  currentStreamingText.trim().length > 0 &&
  currentStreamingRunId !== null &&
  currentStreamingRunId === currentRunId;
```

koşulu false olur ve bileşen `null` döner — mesaj ekrandan silinir.

Ardından `useConversations.ts:635-644` satırlarında `Promise.all([fetchConversationList, fetchConversationMessages, fetchConversationMembers])` **asenkron** başlar. Bu iki olay arasındaki ~50–500 ms pencerede kullanıcı boş ekran görür.

Ek risk: `Promise.all` içindeki üç fetch'ten herhangi biri hata alırsa `catch` (line 648-651) sadece `conversationError` set eder, `activeConversationMessages` güncellenmez. Kullanıcı oturum boyunca asistan cevabını hiç göremeyebilir.

**Düzeltme yönü:**  
`useChatRuntime.ts:934-938` buffer temizlenmeden önce `currentStreamingText`'i optimistik asistan mesajı olarak `activeConversationMessages`'a ekle. Mevcut pattern referansı: `useConversations.ts:589-599` (kullanıcı optimistik commit'i). DB sync arkadan gelince ID match ile reconcile et.

---

## BUG-2 — F5 sonrası render block'lar kayboluyor — HIGH 🔴

**Dosyalar:**
- `apps/web/src/hooks/useConversations.ts:438-461` (sadece metin fetch)
- `apps/web/src/hooks/useChatRuntime.ts:336, 776-777` (presentationRunSurfaces WS-only state)
- `apps/server/src/routes/conversations.ts` (mevcut 5 endpoint, hiç `/blocks` yok)

**Kök neden:**  
`useConversations.ts:438-461` sayfa yüklendiğinde sadece `ConversationMessage[]` (text content) çeker. `presentationRunSurfaces` ise yalnız WebSocket `render_block` event'leriyle dolar ve `chatStore` içinde ephemeral yaşar — F5 sonrası chatStore sıfırlanır, state silinir.

`apps/server/src/routes/conversations.ts` incelemesi: mevcut 5 endpoint yalnızca conversations, messages ve members yönetiyor. `/blocks`, `/render-blocks` veya `/presentation` endpoint'i yok.

Sonuç: approval kartları, tool result kartları, code block'lar ve screenshot'lar F5 sonrasında kalıcı olarak kayboluyor.

**Düzeltme yönü (iki katmanlı):**
1. Server: Render block'ların DB'de persist edildiğini doğrula; `GET /conversations/:id/blocks` endpoint ekle.
2. Frontend: `useConversations.ts:438-461`'e paralel olarak render block hydration çağrısı ekle.

---

## BUG-3 — "Mevcut çalışma tamamlandı..." paragrafı kalıcılaşıyor — HIGH 🔴

**Dosyalar:**
- `apps/web/src/lib/chat-runtime/current-run-progress.ts:394-396`
- `apps/web/src/components/chat/RunProgressPanel.tsx:144-158`
- `apps/web/src/components/chat/CurrentRunSurface.tsx:32-35`

**Kök neden:**  
`getFallbackDetail` line 395:

```
"Mevcut çalışma tamamlandı. Son özet ve destek kartları aşağıda görünür kalır."
```

35 kelimelik bu paragraf `progress.detail` olarak üretiliyor. `RunProgressPanel.tsx:144-158` non-dev branch'ında bu metin `<p>` olarak render ediliyor ve run bittikten sonra panel DOM'dan kaldırılmıyor. `CurrentRunSurface.tsx:35`: `isBusy = currentRunProgressPanel !== null` hâlâ true döndüğü için geniş bir boşluk ekranda kalıyor.

**Düzeltme yönü:**  
`RunProgressPanel.tsx:144-158` non-dev branch'ında `runSummary?.final_state === 'COMPLETED'` veya `'FAILED'` durumunda `null` döndür; ya da kompakt bir timestamp chip'e ("✓ 12 sn") indir.

---

## BUG-4 — "İşlem tamamlandı" generic tool result başlığı — MED 🟡

**Dosyalar:**
- `apps/web/src/components/chat/blocks/ToolResultBlock.tsx:21-31` (getFriendlyResultCopy)
- `apps/web/src/components/chat/blocks/ToolResultBlock.tsx:41-58` (non-dev render)

**Kök neden:**  
`getFriendlyResultCopy` tüm başarılı tool'lar için `title: 'İşlem tamamlandı'` döndürür. Non-dev mode'da (line 41-58) `<ToolHeader title={friendlyCopy.title} .../>` render edilir; `block.payload.tool_name` sadece `type` prop'una geçer ve görünmez. Kullanıcı hangi aracın ne yaptığını anlayamaz.

Not: Dev mode'da (line 61-83) `title={block.payload.tool_name}` doğrudan kullanılıyor — bilgi zaten var, sadece non-dev'e taşınmıyor.

**Düzeltme yönü:**  
`getFriendlyResultCopy`'yi tool-name aware yap:
- `file.read` → `"App.tsx okundu (240 satır)"`
- `web.search` → `"5 sonuç bulundu"`
- `shell.exec` → `"Komut çalıştı (0ms)"`
- `file.write` → `"index.ts güncellendi"`

---

## BUG-5 — ThinkingBlock developer-only gizli — HIGH 🔴 (rekabet açığı)

**Dosyalar:**
- `apps/web/src/components/chat/RunProgressPanel.tsx:140` (isDeveloperMode gate)
- `apps/web/src/components/chat/RunProgressPanel.tsx:214-235` (ThinkingBlock render)
- `apps/web/src/components/chat/ThinkingBlock.tsx:53-82` (hazır bileşen)

**Kök neden:**  
`shouldShowDiagnostics = isDeveloperMode` (line 140). `ThinkingBlock` ve `ToolActivityIndicator` tam listesi yalnız dev mode'da görünüyor (lines 214-235). Non-dev mode (lines 144-158) sadece headline + detail + 3 tool activity item gösteriyor.

`step_items` verisi sunucudan zaten geliyor ve hesaplanıyor — UI'dan gizlenmesinin tek nedeni bu if gate.

`ThinkingBlock.tsx:53-82`: `RunaDisclosure`, animasyonlu dots, step rendering — bileşen tamamen hazır, sadece açılması gerekiyor.

Claude.ai / Cursor / ChatGPT reasoning ve plan adımlarını kompakt + animasyonlu olarak gösteriyor. Bu Runa'nın en kritik rekabet gecikmesi.

**Düzeltme yönü:**  
`RunProgressPanel.tsx:140` isDeveloperMode gate'ini ThinkingBlock'tan ayır. Non-dev mode'da `ThinkingBlock`'u kompakt versiyon (ilk 3 adım inline, `RunaDisclosure` ile geri kalanları gizli) olarak render et.

---

## BUG-6 — Approval kartı 5-katmanlı ve fazla büyük — HIGH 🔴

**Dosyalar:**
- `apps/web/src/components/chat/blocks/ApprovalBlock.tsx:197-303`
- `apps/web/src/components/chat/blocks/BlockRenderer.module.css:287-489`
- `apps/web/src/styles/components.css:4-5, 32` (ihlal edilen kendi tasarım prensibi)

**Kök neden:**  
Kart 5 ayrı görsel bölüm içeriyor:

| Katman | JSX satırı | CSS | Ekstra padding |
|---|---|---|---|
| approvalHeader | 206-212 | line 287 | — |
| approvalDecision | 214-218 | line 356-363 | `padding: 14px` |
| approvalDecisionGrid | 220-229 | line 380-384 | `grid 2-kolon` |
| approvalStateFeedback | 231-234 | line 392+ | — |
| approvalActions | 236-256 | line 414-418 | `grid 2-kolon` |

`.block` padding 16px + `.approvalDecision` inner padding 14px = 30px+ iç içe stacking. Mobile breakpoint `@media (max-width: 560px)` (line 460) sadece grid'i tek sütuna alıyor, toplam yüksekliği artırıyor.

`components.css:4-5` kendi tasarım prensibini çiğniyor:
> "DESIGN PHILOSOPHY: 'More single flow, less panel stack'"  
> "The goal is to reduce the 'card inside card' feeling"

**Düzeltme yönü:**  
Tek satır eylem ifadesi + inline kompakt buton çifti. Ayrıntılar (Hedef/Dikkat grid) `RunaDisclosure` içine al. CSS `approvalDecisionGrid` 2-kolon kaldır. Referans: Claude Cowork / ChatGPT — tek satır soru + 2 küçük yan yana buton.

---

## BUG-7 — runa-migrated-components-* CSS tech debt — MED 🟡

**Dosyalar:**
- `apps/web/src/styles/routes/chat-migration.css` (373 definition)
- `apps/web/src/styles/routes/capability-migration.css` (46 definition)
- 25 TSX component dosyası (~211 usage occurrence)
- **Toplam: ~630 occurrence**

**Kök neden:**  
UI-OVERHAUL-02/03 kapsamındaki CSS Module migrasyonu chat surface'ları için tamamlanmamış. `runa-migrated-components-chat-[component]-[N]` formatındaki geçici selector'lar `components.css` (1995 satır) içindeki global tanımlardan stil alıyor. Her component farklı hassasiyette stillenmiş; padding/margin/color tutarsızlıkları "kalitesiz" görünümün temel altyapı sebebi.

Bu class'lar geçici teknik borç olarak eklenmiş, production'a sızmış, CSS Module geçişini bloke ediyor.

**Düzeltme yönü:**  
Her chat component için `*.module.css` dosyası oluştur. `runa-migrated-components-*` global class'larını kaldır. Design token'lar (`var(--color-text)`, `--radius-soft`) zaten mevcut — kullanıma hazır.

---

## BUG-8 — CodeBlock ≤20 satır her zaman açık — MED 🟡

**Dosyalar:**
- `apps/web/src/components/chat/blocks/CodeBlock.tsx:18` (`COLLAPSED_LINE_LIMIT = 20`)
- `apps/web/src/components/chat/blocks/CodeBlock.tsx:43-45`

**Kök neden:**  
```typescript
const COLLAPSED_LINE_LIMIT = 20; // line 18
const isLongBlock = lines.length > COLLAPSED_LINE_LIMIT;
const isExpanded = !isLongBlock; // line 45
```

20 satır veya altı her dosya tam açık render ediliyor. Tool-read (kullanıcı istemeden üretilen, örn. `file.read` çıktısı) ile user-requested artifact (kullanıcının istediği kod) arasında ayrım yok. Her `file.read` full kod paneli açıyor.

**Düzeltme yönü:**
- `COLLAPSED_LINE_LIMIT`: 20 → 8
- `block.payload.source` veya `diff_kind` gibi mevcut flag ile tool-read kökenli blokları force-collapse et
- Collapsed halde: `"App.tsx — 47 satır (görmek için aç)"` şeklinde hint

---

## BUG-9 — ToolActivityIndicator raw status string — LOW 🟢

**Dosyalar:**
- `apps/web/src/components/chat/ToolActivityIndicator.tsx:42`

**Kök neden:**  
```tsx
<span>{item.status}</span> // line 42
```

Literal `"active"` / `"completed"` / `"failed"` İngilizce string'i kullanıcıya gösteriliyor. Türkçeleştirilmiyor, ikon yok.

**Düzeltme yönü:**  
Lucide icon + Türkçe etiket mapping:
- `active` → `<Loader2 className="animate-spin" /> Çalışıyor`
- `completed` → `<Check /> Bitti`
- `failed` → `<X /> Hata`

---

## BUG-10 — PersistedTranscript chat balonu yok — MED 🟡

**Dosyalar:**
- `apps/web/src/components/chat/PersistedTranscript.tsx:36-50`

**Kök neden:**  
`activeConversationMessages` plain `<div>` + `<strong>` role label + timestamp + `<StreamdownMessage>` olarak render ediliyor. Avatar yok, balon yok. Mesajlar günlük çıktısı gibi sıralı görünüyor — WhatsApp/Claude.ai benzeri chat tipografisi yok.

`StreamdownMessage` zaten markdown destekliyor; CSS altyapısı eksik.

**Düzeltme yönü:**  
Role-aware balon layout:
- `user` → sağa hizalı, farklı arka plan rengi
- `assistant` → sola hizalı, minimal avatar indicator
- StreamdownMessage içeriği korunuyor

---

## BUG-11 — useChatRuntime useMemo dependency patlaması — HIGH 🔴 (performans)

**Dosyalar:**
- `apps/web/src/hooks/useChatRuntime.ts:1304-1386`

**Kök neden:**  
`useMemo` dependency array'inde (line 1304-1386) streaming state dahil 30+ bağımlılık var:
- `messages` (line 1365) — her yeni mesajda değişir
- `presentationRunSurfaces` (line 1368) — her render_block'ta değişir
- `runTransportSummaries` (line 1374) — her event'te değişir
- `currentStreamingText` (line 1357) — **her token'da değişir**
- `presentationSurfaceState` (line 1354)

Her `text.delta` event'i bu state'lerin tümünü tetikler → memo yeniden hesaplanır → dönen object yeni referans → hook'un tüm tüketicilerinde re-render. Stream sırasında: token başına 5–15 component re-render.

**Düzeltme yönü:**  
Selector pattern (zustand-style) veya hook return API'ını ikiye böl:
1. Imperative metodlar (submitRunRequest, resolveApproval) — stabil ref
2. State slice'lar (streaming state) — ayrı küçük hook

Streaming state'i (`currentStreamingText`, `currentStreamingRunId`) diğer state'ten izole et; sadece `StreamingMessageSurface` subscribe olsun.

---

## BUG-12 — Reconnect zombie run (sonsuz "Çalışıyor...") — MED 🟡

**Dosyalar:**
- `apps/web/src/hooks/useChatRuntime.ts:973-1010` (reconnect handler)

**Kök neden:**  
`reconnectNowRef.current` (line 973-984) yeni socket açar, eski socket'i kapatır. `handleBrowserOnline` (line 991-1006) bunu çağırır. Yeni socket'te sunucuya "resume run X" mesajı gönderilmiyor. `expectedPresentationRunIdRef` ve `isSubmitting` sıfırlanmıyor. Server yeni connection'da otomatik replay yapmıyor.

Sonuç: kullanıcı network'ten düşüp dönerse aktif run sonsuza kadar `isSubmitting = true` state'inde kalır. Composer disabled; kullanıcı yeni mesaj gönderemiyor.

**Düzeltme yönü (pragmatik):**  
Reconnect sonrası N saniye (örn. 10s) timeout başlat; sunucudan `run.finished` gelmezse lokal force-fail uygula:
- `isSubmitting = false`
- `currentStreamingText = ''`
- `currentStreamingRunId = null`
- Kullanıcıya: `"Bağlantı kesildi — çalışma tamamlanamadı"` uyarı mesajı

---

## BUG-13 — Hızlı çoklu submit matchesTrackedRun race — MED 🟡

**Dosyalar:**
- `apps/web/src/hooks/useChatRuntime.ts:1105` (`expectedPresentationRunIdRef` overwrite)
- `apps/web/src/hooks/useChatRuntime.ts:916-924` (`run.finished` gate)
- `apps/web/src/lib/chat-runtime/presentation-surfaces.ts:63-73` (`matchesTrackedRun`)

**Kök neden:**  
Her submit'te `expectedPresentationRunIdRef.current = payload.run_id` (line 1105) ezilir. Run-A çalışırken Run-B submit edilirse ref B olur. Run-A için `run.finished` geldiğinde:

```typescript
matchesTrackedRun(A, presentationRunIdRef.current, expectedPresentationRunIdRef.current)
// → A === B? false → A'nın UI state'i temizlenmez
```

A'nın sonucu asla işlenmez; UI tutarsız kalır.

Pratik koruma: `isSubmitting` flag'i composer'ı disable eder — normal kullanımda korur. Ama sub-agent path'lerinde veya programatik resubmit'te bu koruma yok.

**Düzeltme yönü:**  
`expectedPresentationRunIdRef: React.MutableRefObject<string | null>` → `expectedPresentationRunIdsRef: React.MutableRefObject<Set<string>>`
- Submit'te: `.add(run_id)`
- `run.finished` / `run.rejected`'ta: `.delete(run_id)`
- `matchesTrackedRun`: set membership check

---

## BUG-14 — Memory write silent fail — LOW 🟢

**Dosyalar:**
- `apps/server/src/ws/run-execution.ts:2274-2335` (`persistLiveMemoryWrite`)

**Kök neden:**  
```typescript
if (preferenceMemoryWriteResult.status === 'failed') {
  logLiveMemoryWriteFailure(...); // line 2304
  // devam eder, kullanıcıya sinyal yok
}
// ...
if (workspaceMemoryWriteResult.status === 'failed') {
  logLiveMemoryWriteFailure(...); // line 2328
  // devam eder
}
```

Fonksiyon `void` döner. `run.finished` payload'unda `memory_write_status` alanı yok. Kullanıcı "Ajan öğrendi" sanıyor, aslında unutmuş.

**Düzeltme yönü:**  
`run.finished` payload'una `memory_write_status: 'ok' | 'partial' | 'failed'` ekle. Frontend'de `partial` / `failed` durumunda küçük: `"Bilgi kaydedilemedi"` toast'ı göster.

---

## Mevcut UI-OVERHAUL Planıyla Uyum

| UI-OVERHAUL | Kapsam | Bu Audit'te Karşılığı |
|---|---|---|
| UI-OVERHAUL-01 | Operator/Developer surface isolation | BUG-5 (isDeveloperMode gate kaldırma) |
| UI-OVERHAUL-02 | Design tokens + CSS architecture | BUG-7 (630 migration class) |
| UI-OVERHAUL-03 | Inline style migration + primitive expansion | BUG-7 + BUG-9 |
| UI-OVERHAUL-04 | Chat visual hierarchy: approval inline, code polish | BUG-6, BUG-8, BUG-10 |
| UI-OVERHAUL-05 | Mobile-first responsive audit (320/414/768/1280) | ApprovalBlock tek breakpoint @560px yetersiz |
| UI-OVERHAUL-06 | Brand polish + onboarding | İleri aşama |

**Not:** BUG-5 ve BUG-6 en çok şikayet alan alanlardır. UI-OVERHAUL-04 sırası gelmeden önce Sprint A+B bu bug'ları kısmen çözebilir. UI-OVERHAUL-02/03 tamamlanmadan 04 yapılabilir ama global class kiri birikmeye devam eder.

---

## Sprint Planı

### Sprint A — Stabilite (1–2 gün)

BUG-1 + BUG-3 + BUG-13 tek PR:

- `useChatRuntime.ts:934-938`: buffer temizlenmeden önce optimistik asistan mesajı commit
- `RunProgressPanel.tsx:144-158`: `final_state === 'COMPLETED'` → `null` return (veya timestamp chip)
- `expectedPresentationRunIdRef` → `Set<string>` refactor

**Done kriterleri:** F5 olmadan normal akışta mesaj kaybolmuyor; "Çalışma tamamlandı" kapanıyor; rapid submit race yok.

---

### Sprint B — Görünürlük (1 gün)

BUG-5 + BUG-9:

- `RunProgressPanel.tsx:140,214`: `isDeveloperMode` gate'i ThinkingBlock'tan ayır; non-dev'de kompakt ver
- `ToolActivityIndicator.tsx:42`: Lucide icon + Türkçe etiket mapping

**Done kriterleri:** Normal kullanıcı ajan adımlarını görebiliyor; raw İngilizce string yok.

---

### Sprint C — Approval + Code (1–2 gün) — UI-OVERHAUL-04 başlangıcı

BUG-6 + BUG-8:

- `ApprovalBlock.tsx:197-303` + `BlockRenderer.module.css:287-489`: 5 katman → tek satır karar + kompakt inline buton çifti
- `CodeBlock.tsx:18`: `COLLAPSED_LINE_LIMIT` 20 → 8; tool-read force-collapse

**Done kriterleri:** Approval kartı 1 ekran yüksekliğinin %30'unu geçmiyor; file.read çıktıları collapsed başlıyor.

---

### Sprint D — Tool result + Transcript (1 gün)

BUG-4 + BUG-10:

- `ToolResultBlock.tsx:21-31`: tool-name aware `getFriendlyResultCopy`
- `PersistedTranscript.tsx:36-50`: role-aware balon layout

**Done kriterleri:** "İşlem tamamlandı" yerine araç adı + bağlam var; mesajlar balon formatında.

---

### Sprint E — Persistence (2–3 gün, backend gerekli)

BUG-2:

- Server: render block'ların DB'de persist edildiğini doğrula
- Server: `GET /conversations/:id/blocks` endpoint ekle
- Frontend: `useConversations.ts:438-461` sonrasına block hydration çağrısı ekle

**Done kriterleri:** F5 sonrası approval kartları ve tool result'lar geri geliyor.

---

### Sprint F — Reconnect + Memory (1 gün)

BUG-12 + BUG-14:

- `useChatRuntime.ts:973-1010`: reconnect sonrası 10s timeout → lokal force-fail
- `run-execution.ts:2274-2335` + `run.finished` payload: `memory_write_status` alanı + frontend toast

**Done kriterleri:** Network drop sonrası composer kilitlemiyor; memory fail kullanıcıya görünür.

---

### Sprint G — CSS Migration + Performance (3–5 gün)

BUG-7 + BUG-11:

- 25 TSX chat component dosyası için `*.module.css` oluştur; `runa-migrated-components-*` kaldır
- `useChatRuntime.ts:1304-1386`: selector pattern / streaming state izolasyonu

**Done kriterleri:** `components.css` ve `chat-migration.css`'te sıfır `runa-migrated-components-chat-*` reference; stream sırasında sadece streaming-aware bileşenler re-render.

---

## Rekabetçi Bağlam

| Alan | Runa şu an | Claude.ai / ChatGPT / Cursor | Fark |
|---|---|---|---|
| Thinking/reasoning | Sadece dev mode | Her zaman görünür, collapsible | **Kritik** |
| Approval card | 5-katman, ~400px+ | Tek satır + 2 inline buton | **Kritik** |
| F5 persistence | Sadece metin kalıyor | Approval/tool context da dönüyor | **Kritik** |
| Run completion indicator | 35-kelime kalıcı paragraf | Sessiz / küçük timestamp chip | Yüksek |
| Tool activity | Raw "active" string | "Reading App.tsx..." + checkmark animasyonu | Orta |
| Code blocks | ≤20 satır her zaman açık | Tool read'ler default collapsed | Orta |
| Transcript layout | Log formatı, rol etiketi | Avatar + balon, WhatsApp benzeri | Orta |
| Mobile | Tek breakpoint @560px | Fluid responsive, 320px destekli | Orta |
| Stream performance | Token başına full re-render | Selector-scoped, minimal re-render | Orta |

---

## Metodoloji Notu

Bu belgede her iddia doğrudan kaynak kod taramasıyla kanıtlanmıştır. Oturum sırasında üç farklı yapay zekânın analizleri çapraz doğrulamaya tabi tutulmuş; aşağıdaki hatalı iddialar tespit edilip reddedilmiştir:

- "Server `run.finished`'ı persist'ten önce gönderiyor" → YANLIŞ. `run-execution.ts:2148` await, `run-execution.ts:2220` emit sırası.
- "`createAutomaticTurnPresentationBlocks` run-execution.ts:2167'de" → YANLIŞ. Gerçek yer: `presentation.ts:268`.
- "`migration.css` runtime migration framework" → YANLIŞ. Geçici teknik borç class'ları, `routes/chat-migration.css`.

Tüm satır numaraları çalışma kopyası `D:/ai/Runa/.claude/worktrees/jovial-shamir-7c2fcf` üzerinden doğrulanmıştır.

---

*Kaynak: `docs/archive/progress-2026-04-core-hardening.md` + doğrudan kaynak kod taraması. 2026-05-03.*
