# Runa — Task Template

## Görev Bilgileri

- **Sprint:** Core Hardening Phase 2 — **Track:** Track A / Track C
- **Görev:** Structured Output & Artifact Rendering — model çıktısını typed bloklara dönüştürme
- **Modül:** presentation
- **KARAR.MD Maddesi:** `RenderBlock` tipi `packages/types/src/blocks.ts`'e eklenmeden frontend yazılmaz

## Bağlam

- **İlgili interface:** `packages/types/src/blocks.ts` → `RenderBlock`; `apps/server/src/presentation/**`; `apps/web/src/components/chat/PresentationBlockRenderer.tsx`
- **Referans dosya:** `apps/server/src/ws/presentation.ts`, `apps/server/src/presentation/**`, `apps/web/src/components/chat/MarkdownRenderer.tsx`
- **Repo gerçeği:** Web tarafında markdown renderer ve capability card foundation vardır. Yeni block tipi eklemek backend-only kalırsa UI boş/bozuk görünebilir; typed contract + renderer + fallback birlikte düşünülmelidir.

## Rekabetçi Kalite Çıtası

Rakip ürünlerde code, table, plan ve file references zengin görünür. Runa'da hedef, ham text'i kırılgan regex ile parçalamak değil, typed presentation contract'ı ve streaming-safe fallback üretmektir.

- Parser hata yapsa bile kullanıcı cevabı kaybetmez.
- Yeni RenderBlock tipi frontend renderer olmadan varsayılan akışa verilmez.
- Model structured output destekliyorsa schema-first yol tercih edilir; regex fallback kontrollüdür.
- Large artifacts block içine gömülmez; artifact reference kullanılır.
- Markdown renderer ile çakışma değil, tamamlayıcı katman hedeflenir.

## Kaynaklı Endüstri Notları

- OpenAI Structured Outputs, schema uyumu için güçlü bir pattern sunar; parallel tool calls ve structured output kombinasyonu dikkat gerektirir.
- Runa provider-agnostic olduğundan schema-first yol provider capability gate ile kullanılmalı; destek yoksa parser fallback devreye girmelidir.

## Görev Detayı

Bu görev iki fazdır.

### TASK-10A — Parser + Existing Text Fallback

1. `apps/server/src/presentation/output-parser.ts` ekle.
2. İlk fazda yeni `RenderBlock` tipi eklemeden parse helper test edilebilir.
3. Parser şunları tanır:
   - fenced code block
   - markdown table
   - checklist/numbered plan
   - file path/reference
4. Parser confidence düşükse raw text fallback döner.
5. Large code/artifact için inline limit uygulanır.

### TASK-10B — Typed RenderBlock + Frontend Renderer

Yeni tipler ancak frontend renderer ile birlikte açılır:

```typescript
interface CodeArtifactBlock {
  type: 'code_artifact';
  language: string;
  filename?: string;
  content: string;
  line_count: number;
}

interface PlanBlock {
  type: 'plan';
  title: string;
  steps: readonly { text: string; status: 'pending' | 'done' | 'skipped' }[];
}

interface TableBlock {
  type: 'table';
  headers: readonly string[];
  rows: readonly (readonly string[])[];
  caption?: string;
}

interface FileReferenceBlock {
  type: 'file_reference';
  path: string;
  line_start?: number;
  line_end?: number;
  snippet?: string;
}
```

Frontend:

- `PresentationBlockRenderer` her yeni block'u render eder.
- Unknown block fallback korunur.
- Mobile/responsive layout bozulmaz.

## Sınırlar (Yapma Listesi)

- [ ] Frontend renderer eklemeden production presentation path'e yeni block tipi verme.
- [ ] Large payload'ları block içine gömme.
- [ ] Markdown renderer'ı kaldırma.
- [ ] Gateway provider'larını yeniden yazma.
- [ ] Regex parser'ı model truth kaynağı gibi kullanma.
- [ ] Parser hatasında boş output döndürme.
- [ ] `any`, `@ts-ignore`, silent catch kullanma.

## Değiştirilebilecek Dosyalar

### TASK-10A

- `apps/server/src/presentation/output-parser.ts` (yeni)
- `apps/server/src/presentation/output-parser.test.ts` (yeni)

### TASK-10B

- `packages/types/src/blocks.ts`
- `apps/server/src/ws/presentation.ts`
- `apps/web/src/components/chat/PresentationBlockRenderer.tsx`
- `apps/web/src/components/chat/capability/**` only if existing primitives fit
- İlgili tests

## Değiştirilmeyecek Dosyalar

- `apps/server/src/gateway/**`
- `apps/desktop-agent/**`
- Runtime loop, unless presentation integration requires a narrow adapter

## Done Kriteri

- [ ] Parser raw text loss olmadan çalışır.
- [ ] Code/table/plan/file reference testleri vardır.
- [ ] Yeni block tipi açıldıysa frontend renderer da aynı PR'da vardır.
- [ ] Unknown/fallback render path test edilir.
- [ ] Large content limitleri test edilir.
- [ ] Typecheck, targeted Vitest, web typecheck/build ve Biome PASS.

## Notlar

- Bu görev UI-PHASE presentation polish ile uyumludur; hedef daha zengin ama chat-first kalan cevap yüzeyidir.
- Provider-native structured output ileride ayrı capability gate ile eklenebilir.
