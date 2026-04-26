# UI-PHASE-4 - Block Renderer Sistemi, Research Trust ve Capability Presentation

> Bu belge tek basina IDE LLM gorev prompt'udur. FAZ 1-3 tamamlanmis veya repo esdeger chat-first layout zeminine sahip olmalidir.
> Baslamadan once `AGENTS.md`, `implementation-blueprint.md`, `docs/TASK-TEMPLATE.md`, `PROGRESS.md` ve onceki UI faz kapanis notlari okunmalidir.

## Urun Amaci

Bu faz Runa'nin model/tool/runtime ciktisini kullaniciya dogal, guvenilir ve eyleme donuk sekilde gosteren block renderer sistemini kurar. Hedef sadece `PresentationBlockRenderer.tsx` dosyasini parcalamak degildir. Hedef, kullanicinin "Runa ne yapti, neden onemli, simdi ne yapabilirim?" sorularina teknik log okumadan cevap alabilmesidir.

Research, source, diff, code, approval, timeline ve desktop/action yuzeyleri ayni presentation standardina yaklasmalidir.

## Rakip Citasi ve Runa Farki

- Deep Research kullaniciya plan, progress, interrupt ve kaynakli rapor beklentisi veriyor.
- Claude Research web ve is baglami arasinda kaynak guvenini one cikariyor.
- Claude Computer Use ve Manus Browser Operator gibi capability'ler kullanicinin aksiyonlari izlemesini, izin vermesini ve durdurabilmesini beklenir hale getirdi.

Runa'nin farki: teknik block'lari raw log gibi degil, calisma arkadasi diliyle sunmak. Raw detaylar Developer Mode veya expand detail icinde kalmali.

Kaynakli referanslar:

- ChatGPT Projects: https://help.openai.com/en/articles/10169521
- ChatGPT Deep Research: https://help.openai.com/articles/10500283
- Claude Research: https://www.anthropic.com/news/research
- Claude Computer Use: https://docs.anthropic.com/en/docs/build-with-claude/computer-use
- Manus Browser Operator: https://manus.im/docs/features/browser-operator
- Perplexity Comet: https://www.perplexity.ai/comet/

## Gorev Bilgileri

- **Sprint:** Core Hardening Phase 2 - Track C
- **Gorev:** Render block sistemini modular, trust-aware ve natural-language-first hale getir
- **Modul:** `apps/web`
- **KARAR.MD Maddesi:** Presentation, Tool Plane visibility, Human Ops

## Baglam

- **Ilgili interface:** `packages/types/src/blocks.ts` -> `RenderBlock`
- **Referans dosyalar:** `apps/web/src/components/chat/PresentationBlockRenderer.tsx`, `apps/web/src/components/chat/chat-presentation.tsx`, `apps/web/src/components/chat/PresentationRunSurfaceCard.tsx`, `apps/web/src/components/chat/capability/**`
- **Mevcut block tipleri:** `text`, `status`, `event_list`, `code_block`, `diff_block`, `inspection_detail_block`, `run_timeline_block`, `search_result_block`, `trace_debug_block`, `tool_result`, `web_search_result_block`, `workspace_inspection_block`, `approval_block`

## Kural Esnetme Notu

Bu fazda `RenderBlock` union'i degistirilmez. Yeni block gerekiyormus gibi gorunurse implementasyonu durdur:

1. Neden mevcut block yetmiyor?
2. Hangi payload eksik?
3. Backend mapper gerekir mi?
4. Architecture escalation note gerektirir mi?

Bu fazin varsayilan yolu mevcut block'lari daha iyi render etmektir.

## Gorev 4A - Aktif Renderer Envanteri

Uygulamadan once:

```powershell
rg -n "case '|block.type|render.*Block|approval_block|tool_result|web_search_result_block|search_result_block|run_timeline_block" apps/web/src/components/chat
(Get-Content apps/web/src/components/chat/PresentationBlockRenderer.tsx).Count
Get-Content -Raw packages/types/src/blocks.ts
```

Canli dispatch nerede ise orayi hedefle. Sadece dosya adina bakarak karar verme.

## Gorev 4B - BlockRenderer Registry

`apps/web/src/components/chat/blocks/BlockRenderer.tsx` olustur:

```ts
import type { RenderBlock } from '@runa/types';

type BlockRendererProps = Readonly<{
  block: RenderBlock;
  isInsideStream?: boolean;
  isDeveloperMode?: boolean;
  onResolveApproval?: (approvalId: string, decision: 'approved' | 'rejected') => void;
  onRequestInspection?: (targetKind: InspectionTargetKind, targetId?: string) => void;
}>;
```

Registry kurallari:

- Exhaustive switch kullan.
- `default` branch sadece impossible fallback icin typed helper'a gitmeli.
- Unknown block icin kullaniciya panik yaratmayan, dev'e debug bilgisi veren safe renderer kullan.
- Developer-only block'lar `isDeveloperMode` false iken ana akista raw gorunmez.

## Gorev 4C - Natural-Language Block Standardi

Her block karti su sorularin en az ikisine cevap vermeli:

- Ne oldu?
- Neden onemli?
- Kullanici simdi ne yapabilir?
- Risk veya guven seviyesi nedir?

Teknik alanlar `call_id`, trace id, raw payload gibi bilgiler varsayilan gorunumde one cikmaz; details/expand icine gider.

## Gorev 4D - Core Block Kartlari

Asagidaki kartlari parca parca olustur. Buyuk tek PR gibi davranma; IDE LLM tek oturumda zorlanirsa gorevi burada bol:

### 4D-1 TextBlockCard

- MarkdownRenderer ile uyumlu.
- Mesaj akisi icinde ekstra kart hissi vermemeli.
- `line-height` rahat, max-width chat akisiyle uyumlu.

### 4D-2 CodeBlockCard

- Header: language, path, copy action.
- Copy feedback 2 saniye gorunur.
- Line number destekli.
- Horizontal scroll; text wrap zorunlu degil.
- `diff_kind`, `path`, `summary` varsa goster.

### 4D-3 DiffBlockCard

- Varsayilan collapsed olabilir; summary gorunmeli.
- Added/removed/context satirlari renkli.
- Mobile unified diff.
- Desktop split diff future note olabilir ama fake split implementasyonu yazma.
- Changed paths ve truncated badge goster.

### 4D-4 ToolResultCard

- Compact natural-language row.
- Success: "Dosya aramasi tamamlandi - 3 eslesme bulundu" gibi summary.
- Error: kullaniciya ne yapabilecegini anlat.
- Expand detail: tool name, status, call_id, error_code, result_preview.

### 4D-5 ApprovalCard

- Pending: risk/action summary + approve/reject.
- Approved/rejected: terminal status.
- Diff/log raw detay varsayilan degil; details action ile acilir.
- Approval aksiyonlari chat-native olmali.

## Gorev 4E - Research ve Source Block'lari

`search_result_block` ve `web_search_result_block` rakip seviyesine yaklasmak icin ozel onem tasir.

Gereksinimler:

- SourceBadge / TrustBadge kullan.
- Query, source count, visible window, truncated state durust gorunmeli.
- Link varsa guvenli external link davranisi: `target="_blank"`, `rel="noreferrer noopener"`.
- Snippet veya match yoksa "sonuc yok" de; fake snippet uretme.
- Kaynaklar "verified" gibi iddialarla etiketlenmeden once payload'da gercek sinyal olmali. Yoksa `unverified` veya neutral kullan.
- Research card final rapor gibi davranmamalidir; o FAZ 5/sonrasi artifact yuzeyi olabilir.

## Gorev 4F - Timeline / Thinking Mapping Hazirligi

`run_timeline_block` icin `TimelineCard` kur:

- Kullaniciya "Runa su adimlari atti" dilinde goster.
- Developer raw event listesi degil.
- Active/completed/failed statuslari ayrilsin.
- FAZ 5 ThinkingBlock entegrasyonu icin mapping helper ayrilabilir.

## Gorev 4G - Workspace / Inspection / Dev Blocks

- `workspace_inspection_block`: proje / dosya / workspace bilgisini sakin kart olarak goster.
- `inspection_detail_block`: Developer Mode veya explicit detail action disinda raw buyumesin.
- `event_list` ve `trace_debug_block`: Developer-only collapsed block.
- Ana chat akisini operator/debug yuzeyine cevirmeyin.

## Gorev 4H - CSS

`apps/web/src/styles/blocks.css` olustur veya mevcut CSS'e block bolumu ekle.

Gereksinimler:

- Mobile responsive.
- Card icinde card yiginlama yapma.
- Long path, long URL, long code satiri tasmasin.
- Focus states gorunur.
- Reduced motion uyumlu.

## Gorev 4I - Incremental Migration Stratejisi

Bu faz tek seferde tum renderer'i parcalamakta zorlanirsa gorevi su sirayla bol:

1. Registry + text/status/tool_result
2. Search/web_search/source trust
3. Code/diff
4. Approval/timeline
5. Workspace/dev-only blocks

Her alt prompt sonunda typecheck/build/Biome kos.

## Sinirlar

- `packages/types/src/blocks.ts` degistirme.
- Server presentation mapper degistirme.
- Runtime/WS event zamanlamasina dokunma.
- Fake citation/source/trust metadata uretme.
- Developer-only raw details'i ana chat'e tasima.
- `any`, `as any`, `@ts-ignore` kullanma.

## Degistirilebilecek Dosyalar

- `apps/web/src/components/chat/PresentationBlockRenderer.tsx`
- `apps/web/src/components/chat/chat-presentation.tsx`
- `apps/web/src/components/chat/blocks/**`
- `apps/web/src/components/chat/capability/**`
- `apps/web/src/styles/blocks.css`
- `apps/web/src/index.css`
- `PROGRESS.md`

## Degistirilmeyecek Dosyalar

- `packages/types/**`
- `apps/server/**`
- `apps/desktop-agent/**`
- `apps/web/src/hooks/**`
- `apps/web/src/stores/**`

## Done Kriteri

- [ ] Tum mevcut RenderBlock tipleri render ediliyor.
- [ ] Developer-only block'lar ana chat'te raw gorunmuyor.
- [ ] Research/source block'lari kaynak ve guven sinyalini durust gosteriyor.
- [ ] Approval block approve/reject davranisi bozulmadi.
- [ ] Code copy calisiyor.
- [ ] Diff collapse/expand calisiyor.
- [ ] `pnpm.cmd --filter @runa/web typecheck` PASS.
- [ ] `pnpm.cmd --filter @runa/web build` PASS.
- [ ] Targeted Biome touched files icin PASS veya gercek hata raporu.

## Browser / QA Kaniti

Minimum smoke:

- Bir sayfada veya fixture'da text, tool_result, approval_block, search_result_block, code_block, diff_block gorunur.
- 320px ve 1440px viewport'ta block'lar tasmaz.
- Approval butonlari keyboard ile focus/activate edilebilir.
- Console'da render error yok.

Kanit uydurma. Fixture yoksa hangi block'lar browser'da dogrulanamadi yaz.

## PROGRESS.md Kapanis Notu

Kapanis notunda:

- Hangi block tipleri tasindi
- Hangi block tipleri eski renderer'da kaldiysa neden
- Source/trust UX karari
- Dogrulama kaniti
- Sonraki faz icin streaming/thinking/markdown takip notu
