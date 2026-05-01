# UI-OVERHAUL-04 — Chat Visual Hierarchy & Block Decomposition

> Bu belge tek başına IDE LLM görev prompt'udur.
> UI-OVERHAUL-03 (inline style + primitive) kapanmadan başlanmaz.

## Ürün Amacı

Chat ekranı bugün üç büyük dosyaya sıkışmış: `PresentationBlockRenderer.tsx` 1434 satır, `chat-presentation.tsx` 682 satır, `ChatPage.tsx` 467 satır. Bu görev:

1. `PresentationBlockRenderer.tsx`'i block-tipi başına dosyaya böler
2. Chat surface'da approval UX'i chat-native (inline accept/reject + "Show details" disclosure) haline getirir
3. Code block presentation'ı consumer-grade yapar (copy button, language badge, line numbers, collapsible long blocks)
4. Streaming animation polish, thinking block, tool-call collapsed-by-default kart
5. EmptyState'i onboarding-like yapar (4-6 suggested prompt kartı)

Hedef: chat ekranının "ürün hissi" rakip seviyesine yaklaşır. Hiçbir dosya 500 satırı aşmaz.

## Rakip Çıtası

- **Claude:** thinking collapsed by default, tool calls tek satırlık summary + expand, code blocks copy/language/wrap toggle
- **ChatGPT:** message arrival smooth, streaming text bounce-free, code blocks polished
- **Cursor:** inline accept/reject for diffs, no modal interruption
- **Linear:** typography hiyerarşisi consumer-grade

## Görev Bilgileri

- **Sprint:** UI Overhaul — **Track:** Track C
- **Görev:** Chat visual hierarchy + block decomposition + approval inline + code block polish
- **Modül:** `apps/web/src/components/chat`, `apps/web/src/components/approval`
- **KARAR.MD Maddesi:** Presentation, UI/UX manifesto, Approval gate

## Bağlam

- **Monolit dosyalar:**
  - [PresentationBlockRenderer.tsx](../apps/web/src/components/chat/PresentationBlockRenderer.tsx) 1434 satır — tüm RenderBlock tipleri tek dosyada
  - [chat-presentation.tsx](../apps/web/src/components/chat/chat-presentation.tsx) 682 satır — block helper'lar
  - [ChatPage.tsx](../apps/web/src/pages/ChatPage.tsx) 467 satır
  - [MarkdownRenderer.tsx](../apps/web/src/components/chat/MarkdownRenderer.tsx) 445 satır
- **Mevcut blocks klasörü:** [apps/web/src/components/chat/blocks/](../apps/web/src/components/chat/blocks/) — bazı block dosyaları zaten var
- **Approval mevcut:** [ApprovalPanel.tsx](../apps/web/src/components/approval/ApprovalPanel.tsx), [ApprovalSummaryCard.tsx](../apps/web/src/components/approval/ApprovalSummaryCard.tsx)

## Görev Detayı

### 1. PresentationBlockRenderer split

`apps/web/src/components/chat/blocks/` altında her RenderBlock tipi için ayrı dosya:

```
blocks/
  TextBlock.tsx
  MarkdownBlock.tsx
  ToolCallBlock.tsx
  ToolResultBlock.tsx
  ApprovalBlock.tsx
  ScreenshotBlock.tsx
  CodeBlock.tsx
  DiffBlock.tsx
  SearchResultBlock.tsx
  CitationBlock.tsx
  ThinkingBlock.tsx (mevcut, polish)
  FileDownloadBlock.tsx
  InspectionBlock.tsx
  RunFeedbackBlock.tsx
  ErrorBlock.tsx
  BlockRenderer.tsx (mevcut, dispatcher)
  index.ts (re-export)
```

`PresentationBlockRenderer.tsx` 1434 satırdan ~150 satıra düşer; sadece dispatcher + helper.

### 2. `chat-presentation.tsx` decomposition

682 satırlık helper dosyası 3-4 küçük dosyaya bölünür:
- `chat-presentation/inspection-meta.ts`
- `chat-presentation/block-helpers.ts`
- `chat-presentation/types.ts`

### 3. Approval inline UX

Bugün approval modal-like yüzey gösterebilir. Manifesto'ya göre chat-native sade accept/reject + detay "Show details" disclosure'da.

`ApprovalBlock.tsx` (yeni):
- Inline kart (mesaj akışı içinde)
- Action özeti tek cümle
- 2 büyük buton: Accept (primary) / Reject (secondary)
- `<RunaDisclosure>` ile "Show details" → diff/log/raw payload
- Approval bekliyor durumu için subtle pulse
- Resolved state (accepted/rejected) için kart kompakt görünüm + timestamp

### 4. Code block polish

Yeni `CodeBlock.tsx`:
- Top bar: language badge (sol) + line count (orta) + copy button (sağ)
- Long blocks (>20 lines) collapsed by default, "Show all (N lines)" expand
- Line numbers (opt-in via prop)
- Soft wrap toggle
- `react-markdown` + `rehype-highlight` zaten var; CodeBlock bunu yapılandırır
- Mobile horizontal scroll, focus ring keyboard erişiminde

### 5. ToolCallBlock collapsed-by-default

- Tek satır: `[icon] tool_name • status • duration`
- Click → expand → input/output payload
- Resolved state için subtle muted background

### 6. ThinkingBlock polish

- Streaming sırasında: typing indicator + "Düşünüyor..." metin
- Tamamlandığında: collapsed kart, "Düşünme süreci" başlık, expand detay
- Hover'da preview tooltip

### 7. Streaming animation

- Token bazında bounce yok
- Mesaj arrival: subtle fade + slide-up (motion variants UI-PHASE-7'de var)
- Reduced motion respect

### 8. EmptyState onboarding

[apps/web/src/components/chat/EmptyState.tsx](../apps/web/src/components/chat/EmptyState.tsx) güncellenir:
- Hero: "Bugün ne yapmak istersin?"
- 4-6 segment kartı:
  - "Kod yaz veya gözden geçir" (örnek prompt)
  - "Araştır ve özetle"
  - "Doküman hazırla"
  - "Masaüstümde bir görev başlat" (desktop companion bağlı değilse "Cihazını bağla" CTA)
  - "Bir dosyayı analiz et"
  - "Önceki konuşmadan devam et"
- Her kart click'inde prompt input'a dolar

### 9. ChatPage decomposition

[ChatPage.tsx](../apps/web/src/pages/ChatPage.tsx) 467 satırdan ~250 satıra düşer:
- `useChatPageOrchestration` hook'una taşınır (state + effects)
- `useDesktopDevices` hook'u ayrılır
- `useTextToSpeechIntegration` hook'u ayrılır

### 10. MarkdownRenderer split

445 satır → tip başına render config'lere bölünür (heading, link, list, code, blockquote, table). 200 satır altı.

## Sınırlar (Yapma Listesi)

- [ ] `apps/server/**`, `packages/**`, `apps/desktop-agent/**` dokunma
- [ ] `packages/types/src/blocks.ts` sözleşmesini değiştirme
- [ ] Yeni RenderBlock tipi eklemek (sözleşme değişikliği)
- [ ] WS event akışını değiştirme
- [ ] Approval karar mantığını değiştirme; sadece UX yüzeyi değişir
- [ ] Code block için yeni dependency ekleme — `react-markdown`, `rehype-highlight`, `highlight.js` zaten yeterli
- [ ] EmptyState için backend call eklemek; sadece front-end suggested prompts
- [ ] `any`, `as any`, `@ts-ignore` kullanma

## Değiştirilebilecek Dosyalar

- `apps/web/src/components/chat/blocks/**` (yeni dosyalar)
- `apps/web/src/components/chat/PresentationBlockRenderer.tsx` (küçültme)
- `apps/web/src/components/chat/chat-presentation.tsx` (split)
- `apps/web/src/components/chat/chat-presentation/**` (yeni)
- `apps/web/src/components/chat/MarkdownRenderer.tsx` (split)
- `apps/web/src/components/chat/markdown/**` (yeni)
- `apps/web/src/components/chat/EmptyState.tsx`
- `apps/web/src/components/chat/ThinkingBlock.tsx`
- `apps/web/src/components/approval/ApprovalPanel.tsx`
- `apps/web/src/components/approval/ApprovalSummaryCard.tsx`
- `apps/web/src/pages/ChatPage.tsx` (küçültme)
- `apps/web/src/hooks/useChatPageOrchestration.ts` (yeni)
- `apps/web/src/hooks/useDesktopDevices.ts` (yeni)
- `apps/web/src/hooks/useTextToSpeechIntegration.ts` (yeni)
- Mevcut block test dosyaları + yeni block testleri
- `PROGRESS.md`

## Değiştirilmeyecek Dosyalar

- `apps/server/**`, `packages/**`, `apps/desktop-agent/**`
- `apps/web/src/components/developer/**` (UI-OVERHAUL-01 sorumluluğu)
- `apps/web/src/styles/tokens.css` (UI-OVERHAUL-02 source-of-truth)

## Done Kriteri

- [ ] Hiçbir TS/TSX dosyası 500 satırı aşmıyor (`apps/web/src/components/**`, `apps/web/src/pages/**`)
- [ ] `PresentationBlockRenderer.tsx` < 200 satır (sadece dispatcher)
- [ ] Tüm RenderBlock tipleri ayrı dosyada `blocks/` altında
- [ ] Approval inline kart + Disclosure ile detay; modal interruption yok (default flow)
- [ ] Code block: copy button, language badge, collapsible long block
- [ ] EmptyState 4-6 suggested prompt kartı
- [ ] Tool call collapsed-by-default
- [ ] Streaming animation polish, prefers-reduced-motion respect
- [ ] `pnpm.cmd --filter @runa/web typecheck` PASS
- [ ] `pnpm.cmd --filter @runa/web lint` PASS
- [ ] `pnpm.cmd --filter @runa/web build` PASS
- [ ] `pnpm.cmd --filter @runa/web test` PASS (yeni block testleri + güncellemeler)
- [ ] Browser QA 320/768/1440: chat akışı PASS, code block fixture PASS, approval fixture PASS, empty state PASS
- [ ] PROGRESS.md kapanış notu

## Notlar

- Bu görev en yüksek görsel impact'i taşır; user'ın "rakip seviyesi" yorumunu burada vereceği görsel parite kararı belirler.
- Block tip sözleşmesi `packages/types/src/blocks.ts` değişmez; sadece presentation katmanı yeniden organize.
- Approval inline UX, server-side approval karar mantığını değiştirmez; aynı `resolveApproval` çağrısı.
