# UI-PHASE-5 - Streaming, Markdown, Thinking ve Uzun Is Guveni

> Bu belge tek basina IDE LLM gorev prompt'udur. FAZ 1-4 tamamlanmis veya repo esdeger chat/block renderer zeminine sahip olmalidir.
> Baslamadan once `AGENTS.md`, `implementation-blueprint.md`, `docs/TASK-TEMPLATE.md`, `PROGRESS.md` ve onceki UI faz kapanis notlari okunmalidir.

## Urun Amaci

Bu faz Runa'nin "calisiyor, ilerliyor, kontrol bende" hissini kurar. Kullanici uzun bir is verdiginde bekletilmemeli; Runa'nin ne yaptigini sade dille gormeli, gerekirse durdurabilmeli, kaynakli/markdown ciktilari rahat okuyabilmelidir.

Hedef sadece markdown parser eklemek degil; streaming, thinking, tool activity, code readability, screenshot/artifact preview ve long-running task confidence yuzeyini birlikte guclendirmektir.

## Rakip Citasi ve Runa Farki

- Deep Research kullaniciya research planini gosterme, progress izleme, araya girip kaynak/fokus degistirme ve kaynakli rapor alma beklentisi veriyor.
- Claude Research ve Claude Computer Use gibi deneyimler tool/research surecinde modelin ne yaptigini daha gorunur hale getiriyor.
- Manus Browser Operator ve Comet gibi agentic urunler "asistan calisiyor" sinyalini aksiyon ve progress yuzeyleriyle veriyor.

Runa'nin farki: raw chain-of-thought gostermeden, kullanicinin anlayacagi calisma ozeti ve action progress sunmak.

Kaynakli referanslar:

- ChatGPT Projects: https://help.openai.com/en/articles/10169521
- ChatGPT Deep Research: https://help.openai.com/articles/10500283
- Claude Research: https://www.anthropic.com/news/research
- Claude Computer Use: https://docs.anthropic.com/en/docs/build-with-claude/computer-use
- Manus Browser Operator: https://manus.im/docs/features/browser-operator
- Perplexity Comet: https://www.perplexity.ai/comet/

## Gorev Bilgileri

- **Sprint:** Core Hardening Phase 2 - Track C
- **Gorev:** Markdown, streaming, thinking/tool activity ve artifact preview yuzeylerini kur
- **Modul:** `apps/web`
- **KARAR.MD Maddesi:** Presentation, Runtime visibility, Approval UX

## Baglam

- **Ilgili interface:** `RenderBlock`, `run_timeline_block`, `tool_result`, `text.delta` mevcutsa WS mesajlari
- **Referans dosyalar:** `apps/web/src/components/chat/MarkdownRenderer.tsx`, `StreamingMessageSurface.tsx`, `RunTimelinePanel.tsx`, `PresentationBlockRenderer.tsx`, `chat-presentation.tsx`, `useChatRuntime.ts`
- **Kritik kural:** Bu faz WS protocol veya server streaming davranisini yeniden tasarlamaz. Mevcut runtime sinyallerini daha iyi render eder.

## Kural Esnetme Notu

FAZ 1'de onaylanmis ise `react-markdown`, `remark-gfm`, `rehype-highlight`, `highlight.js`, `motion` kullanilabilir. Bu dependency'ler yoksa FAZ 1 mini RFC kapisi uygulanmadan eklenmez.

Streaming sirasinda incomplete markdown icin parser davranisi secilebilir:

- Basit text renderer + final markdown render
- Sanitized streaming markdown + react-markdown

Secim gerekcelendirilmeli. Flicker, XSS/link guvenligi, performance ve incomplete code fence davranisi not edilmeli.

## Gorev 5A - Mevcut Streaming/Markdown Envanteri

Uygulamadan once:

```powershell
rg -n "MarkdownRenderer|StreamingMessage|StreamingMessageSurface|text.delta|currentStreamingText|run_timeline_block|tool_result|RunTimeline" apps/web/src packages/types/src apps/server/src
Get-Content -Raw apps/web/src/components/chat/MarkdownRenderer.tsx
Get-Content -Raw apps/web/src/components/chat/StreamingMessageSurface.tsx
```

Mevcut seam'i bozmadan ilerle. Zaten iyi calisan parser varsa tamamen silmek yerine genislet.

## Gorev 5B - MarkdownRenderer

`apps/web/src/components/chat/MarkdownRenderer.tsx` dosyasini gelistir:

```ts
type MarkdownRendererProps = Readonly<{
  content: string;
  isStreaming?: boolean;
}>;
```

Gereksinimler:

- Heading, paragraph, bold, italic, list, checkbox, table, blockquote, link, inline code, fenced code block desteklenmeli.
- Linkler guvenli olmali: external linklerde `target="_blank"` ve `rel="noreferrer noopener"`.
- `javascript:` ve tehlikeli URL scheme'leri engellenmeli.
- Code block'lar copy action ve language label ile uyumlu olmali.
- Streaming sirasinda yarim kalan markdown UI'yi bozmamali.
- MarkdownRenderer raw HTML render etmemeli; gerekiyorsa explicit sanitize stratejisi yaz.

## Gorev 5C - StreamingMessage

`apps/web/src/components/chat/StreamingMessage.tsx` olustur veya `StreamingMessageSurface`'i buna yaklastir:

```ts
type StreamingMessageProps = Readonly<{
  streamingText: string;
  runId: string;
}>;
```

Gereksinimler:

- Assistant avatar + MarkdownRenderer `isStreaming`.
- `aria-live="polite"` kullan; her token icin agresif announce yapma.
- Caret animasyonu reduced-motion durumunda sade static indicator'a duser.
- Auto-scroll MessageList guard'i ile uyumlu.
- Streaming final response geldiginde duplicate assistant text olusmaz.

## Gorev 5D - ThinkingBlock

`apps/web/src/components/chat/ThinkingBlock.tsx` olustur:

```ts
type ThinkingBlockProps = Readonly<{
  steps: readonly ThinkingStep[];
  isActive?: boolean;
  duration?: number;
}>;

type ThinkingStep = Readonly<{
  id: string;
  label: string;
  detail?: string;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'paused';
  tool_name?: string;
  duration_ms?: number;
}>;
```

Kurallar:

- Bu block raw chain-of-thought gostermemeli.
- "Thinking..." dili yerine mumkunse "Runa calisiyor" / "Kaynaklar taraniyor" / "Dosyalar inceleniyor" gibi natural-language-first label kullan.
- Collapsible olabilir; default compact.
- `run_timeline_block` ve `tool_result` icin mapping helper yazilabilir.
- Mapping payload'da olmayan duration veya status uydurmaz.

## Gorev 5E - ToolActivityIndicator

`apps/web/src/components/chat/ToolActivityIndicator.tsx` olustur:

```ts
type ToolActivityIndicatorProps = Readonly<{
  items: readonly ToolActivityItem[];
}>;

type ToolActivityItem = Readonly<{
  id: string;
  label: string;
  status: 'active' | 'completed' | 'failed';
  detail?: string;
}>;
```

Gereksinimler:

- Compact, inline, chat akisini bolmeyen gosterim.
- "Searching workspace..." gibi Ingilizce placeholder yerine repo diline uygun sade copy kullan; urun dili TR/EN stratejisi mevcutsa ona uy.
- Basarisizlik durumunda kullaniciya ne oldugunu anlat; stack trace gosterme.

## Gorev 5F - ScreenshotCard ve Artifact Preview

`apps/web/src/components/chat/ScreenshotCard.tsx` olustur:

```ts
type ScreenshotCardProps = Readonly<{
  imageUrl: string;
  caption?: string;
  timestamp?: string;
}>;
```

Gereksinimler:

- Desktop screenshot veya image artifact icin kullanilabilir.
- Click ile modal preview.
- Caption ve timestamp varsa goster; yoksa uydurma.
- Lazy loading.
- Future desktop companion icin guven dili: screenshot kullanicinin izniyle/ilgili action sonucunda gorunmeli. Bu faz runtime izin akisini degistirmez.

## Gorev 5G - Research Report Readiness

Bu faz tam research mode implement etmez. Ancak MarkdownRenderer ve block/card yapisi su ciktilara hazir olmali:

- Kaynakli rapor
- Inline citation/source links
- Table
- Summary + details
- Long-form answer
- Export/copy action icin artifact action slot'u

Fake citation uretme. Kaynak payload'da yoksa citation UI gosterme.

## Gorev 5H - CSS

`apps/web/src/styles/markdown.css` ve gerekirse `apps/web/src/styles/streaming.css` olustur:

- Markdown spacing chat akisi icinde rahat.
- Code block mobile'da tasmaz.
- Table horizontal scroll ile tasar.
- Streaming caret ve active step animasyonu reduced-motion uyumlu.
- Thinking block teknik log gibi gorunmez.

## Gorev 5I - Entegrasyon

- `MessageBubble` assistant mesajlari MarkdownRenderer ile render eder.
- Streaming cevap StreamingMessage ile render edilir.
- Timeline/tool activity uygun yerde ThinkingBlock/ToolActivityIndicator olarak gorunebilir.
- Existing `RunProgressPanel` veya `RunTimelinePanel` davranisi kirilmadan kademeli adapter kullan.

## Sinirlar

- WS protocol degistirme.
- Server gateway/provider streaming koduna dokunma.
- Chain-of-thought veya gizli model reasoning gosterdigini iddia etme.
- Fake duration, fake source, fake screenshot, fake progress uretme.
- Full research pipeline acma.
- Full desktop vision/action loop acma.
- `any`, `as any`, `@ts-ignore` kullanma.

## Degistirilebilecek Dosyalar

- `apps/web/src/components/chat/MarkdownRenderer.tsx`
- `apps/web/src/components/chat/StreamingMessage.tsx`
- `apps/web/src/components/chat/StreamingMessageSurface.tsx`
- `apps/web/src/components/chat/ThinkingBlock.tsx`
- `apps/web/src/components/chat/ToolActivityIndicator.tsx`
- `apps/web/src/components/chat/ScreenshotCard.tsx`
- `apps/web/src/components/chat/MessageBubble.tsx`
- `apps/web/src/components/chat/MessageList.tsx`
- `apps/web/src/components/chat/PresentationBlockRenderer.tsx`
- `apps/web/src/components/chat/chat-presentation.tsx`
- `apps/web/src/styles/markdown.css`
- `apps/web/src/styles/streaming.css`
- `apps/web/src/index.css`
- `PROGRESS.md`

## Degistirilmeyecek Dosyalar

- `packages/types/**`
- `apps/server/**`
- `apps/desktop-agent/**`
- `apps/web/src/hooks/useChatRuntime.ts` (yalniz type import/adaptor zorunluysa once raporla)

## Done Kriteri

- [ ] Markdown heading, list, table, link, inline code, fenced code render edilir.
- [ ] Tehlikeli link scheme'leri engellenir.
- [ ] Streaming yarim markdown ile UI bozulmaz.
- [ ] ThinkingBlock raw reasoning degil, calisma ozeti gosterir.
- [ ] ToolActivityIndicator active/completed/failed durumlarini gosterir.
- [ ] ScreenshotCard modal preview ile calisir.
- [ ] `pnpm.cmd --filter @runa/web typecheck` PASS.
- [ ] `pnpm.cmd --filter @runa/web build` PASS.
- [ ] Targeted Biome touched files icin PASS veya gercek hata raporu.

## Browser / QA Kaniti

Minimum smoke:

- Markdown fixture: heading, table, code, link, list.
- Streaming fixture veya live run: caret ve no-duplicate final state.
- Mobile 320px: code/table horizontal overflow kontrollu.
- Console: markdown/render error yok.
- Keyboard: copy button, modal close, collapse toggle.

Kanit uydurma. Live provider yoksa fixture/browser-only smoke ile sinirini yaz.

## PROGRESS.md Kapanis Notu

Kapanis notunda:

- Markdown/streaming/thinking alaninda ne kapandi
- Hangi runtime sinyalleri kullanildi
- Hangi research/desktop artifact alanlari future kaldigi
- Browser QA kaniti
- Sonraki faz icin sidebar/auth/settings ve project memory notu
