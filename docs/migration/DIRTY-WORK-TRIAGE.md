# Dirty Working Tree Triage

Tarih: 2026-05-01  
Branch: `feature/ui-stack-production-lock`  
Kapsam: production-lock migration başlamadan önce mevcut dirty/untracked çalışma ağacını değerlendirme. Bu rapor dışında fix yapılmadı.

## 1. Genel Kalite Değerlendirmesi

**%30 production-ready yakınlık.**

Dirty work içinde spike'tan kopyalanmış kullanılabilir parçalar var: Streamdown wrapper, Shiki lazy highlighter, Mermaid lazy renderer, assistant-ui message renderer, EvidencePack tipi, ai-elements Tool input guard. Ancak çalışma şu haliyle production migration sayılmaz:

- `pnpm install --frozen-lockfile` fail; `pnpm-lock.yaml` package değişiklikleriyle uyumlu değil.
- `pnpm build` fail; yeni Vite plugin paketleri lock/node_modules içinde yok.
- `pnpm typecheck` fail; eksik dependency, eksik `@` TS path alias, kayıp `error-catalog`, eksik test deps.
- Mevcut chat surface hâlâ `MarkdownRenderer` kullanıyor; Streamdown/assistant-ui stack gerçek transcript hattına bağlanmamış.
- Kritik `runa-adapter.ts` yok; Runa `/ws` protokolü UIMessage/assistant-ui part modeline çevrilmiyor.
- Server tarafında production-lock migration kapsamı dışı değişiklikler var.
- 58 screenshot değişmiş; bunlar production-lock stack kanıtı değil, ayrı "competitive chat UX" pass'inin artifact'leri.

## 2. Paket Triage

### `apps/web/package.json`

| Paket | Dirty sürüm | Spike uyumu | Not |
|---|---:|---|---|
| `ai` | `6.0.172` | ✅ | exact |
| `@ai-sdk/react` | `3.0.174` | ✅ | exact |
| `@assistant-ui/react` | `0.12.28` | ✅ | exact |
| `@assistant-ui/react-ai-sdk` | `1.3.21` | ✅ | exact |
| `streamdown` | `2.5.0` | ✅ | exact |
| `katex` | `0.16.45` | ✅ | exact |
| `normalize-url` | `9.0.0` | ✅ | exact |
| `chrono-node` | `2.9.0` | ✅ | exact |
| `shiki` | `4.0.2` | ✅ | spike final lock ile uyumlu |
| `ai-elements` | `1.9.0` | ✅ | exact |
| `tailwindcss` | `4.2.4` | ✅ | exact |
| `react` / `react-dom` | `19.2.5` | ✅ | spike final lock ile uyumlu |
| `react-router-dom` | `^7.14.1` | ⚠️ | exact değil; production-lock kuralına göre düzeltilmeli veya kapsam dışı bırakılmalı |
| `typescript` | `6.0.2` | ✅ | spike final lock ile uyumlu fakat root hâlâ `^5.7.0` |
| `vitest` | missing in web | ❌ | spike `4.1.5`; root `vitest ^3.0.0` var ama web fixture deps yok |
| `@testing-library/react` | missing | ❌ | tests import ediyor, typecheck kırıyor |
| `@testing-library/jest-dom` | missing | ❌ | `.toBeInTheDocument()` types yok |
| `jsdom` | missing | ❌ | RTL fixture için gerekli |
| `mermaid` | missing | ⚠️ | code direct `import('mermaid')` yapıyor; npm spike'ta hoist çalışmış olabilir, pnpm workspace için direct dep gerekebilir |
| `@shikijs/core` | missing | ⚠️ | code direct `@shikijs/core` import ediyor; pnpm direct dep olmadan kırılabilir |

Eski paketler dirty `package.json` içinde kaldırılmış:

| Eski paket | Durum |
|---|---|
| `react-markdown` | ✅ removed |
| `remark-gfm` | ✅ removed |
| `rehype-highlight` | ✅ removed |
| `highlight.js` | ✅ removed |

Kritik not: `pnpm-lock.yaml` güncellenmemiş. Bu yüzden package değişikliği tek başına kullanılamaz.

## 3. Kategori Tablosu

| Path | Durum | Spike uyumu | Aksiyon |
|---|---|---|---|
| `apps/web/package.json` | paketler büyük ölçüde doğru, lock yok | ✅/⚠️ | ⚠️ patch |
| `pnpm-lock.yaml` | package değişikliğine göre güncel değil | ❌ | ⚠️ patch |
| `.npmrc` | `save-exact=true` | ✅ | ✅ keep |
| `apps/web/vite.config.ts` | Tailwind plugin + visualizer + alias eklenmiş | ⚠️ | ⚠️ patch |
| `apps/web/vite.config.ts` bundle budget | yok | ❌ | ⚠️ patch |
| `apps/web/src/lib/streamdown/CodeBlock.tsx` | spike ile aynı | ✅ | ✅ keep |
| `apps/web/src/lib/streamdown/shiki-highlighter.ts` | spike ile aynı | ✅ | ⚠️ patch |
| `apps/web/src/lib/streamdown/MermaidBlock.tsx` | spike ile aynı | ✅ | ✅ keep |
| `apps/web/src/lib/streamdown/MermaidRenderer.tsx` | spike ile aynı | ✅ | ⚠️ patch |
| `apps/web/src/lib/streamdown/StreamdownMessage.tsx` | spike ile aynı | ✅ | ⚠️ patch |
| `apps/web/src/lib/streamdown/StreamdownMessage.test.tsx` | math smoke var | ⚠️ | ⚠️ patch |
| `apps/web/src/lib/assistant-ui/MessageRenderer.tsx` | spike ile aynı | ✅ | ⚠️ patch |
| `apps/web/src/lib/transport/errors.tsx` | spike ile aynı | ✅ | ⚠️ patch |
| `apps/web/src/lib/transport/error-catalog.ts` | yok | ❌ | ⚠️ patch |
| `apps/web/src/lib/transport/runa-adapter.ts` | yok | ❌ | ⚠️ patch |
| `apps/web/src/lib/evidence/types.ts` | plan EvidencePack ile uyumlu | ✅ | ✅ keep |
| `apps/web/src/lib/i18n/strings.ts` | yalnız transport retry stringleri | ⚠️ | ⚠️ patch |
| `apps/web/src/lib/media/types.ts` | yok | ❌ | ⚠️ patch |
| `apps/web/src/lib/media/README.md` | yok | ❌ | ⚠️ patch |
| `apps/web/src/components/ai-elements/inline-citation.tsx` | generated, Base UI/shadcn style | ⚠️ | ⚠️ patch |
| `apps/web/src/components/ai-elements/sources.tsx` | generated, İngilizce "Used sources" | ⚠️ | ⚠️ patch |
| `apps/web/src/components/ai-elements/reasoning.tsx` | generated, İngilizce copy | ⚠️ | ⚠️ patch |
| `apps/web/src/components/ai-elements/tool.tsx` | Tool input guard var | ✅/⚠️ | ⚠️ patch |
| `apps/web/src/components/ai-elements/tool.test.tsx` | edge guard smoke var | ⚠️ | ⚠️ patch |
| `apps/web/src/components/ai-elements/code-block.tsx` | spike generated code değil, Runa CodeBlock re-export | ✅ | ✅ keep |
| `apps/web/src/components/ui/badge.tsx` | default shadcn/Base UI token classları | ⚠️ | ⚠️ patch |
| `apps/web/src/components/ui/button.tsx` | default shadcn/Base UI token classları | ⚠️ | ⚠️ patch |
| `apps/web/src/components/ui/carousel.tsx` | default shadcn/Base UI; citation için gerekli | ⚠️ | ⚠️ patch |
| `apps/web/src/components/ui/collapsible.tsx` | default shadcn/Base UI | ⚠️ | ⚠️ patch |
| `apps/web/src/components/ui/hover-card.tsx` | Base UI PreviewCard; openDelay/closeDelay patch görünmüyor | ⚠️ | ⚠️ patch |
| `apps/web/src/components/ui/select.tsx` | default shadcn/Base UI | ⚠️ | ⚠️ patch |
| `apps/web/src/lib/utils.ts` | `cn` helper | ✅ | ✅ keep |
| `apps/web/src/styles/tailwind.css` | Tailwind v4 + shadcn + KaTeX import var | ⚠️ | ⚠️ patch |
| `apps/web/src/components/chat/CurrentRunSurface.tsx` | visual timeline polish, new stack değil | ❌ | ❓ needs decision |
| `apps/web/src/components/chat/PersistedTranscript.tsx` | hâlâ `MarkdownRenderer` | ❌ | ❓ needs decision |
| `apps/web/src/components/chat/StreamingMessageSurface.tsx` | hâlâ `MarkdownRenderer` | ❌ | ❓ needs decision |
| `apps/web/src/components/chat/PresentationRunSurfaceCard.tsx` | consumer/developer split polish | ⚠️ | ❓ needs decision |
| `apps/web/src/components/chat/RunProgressPanel.tsx` | compact activity line polish | ⚠️ | ❓ needs decision |
| `apps/web/src/components/chat/ChatComposerSurface.tsx` | Enter submit helper | ⚠️ | ✅ keep |
| `apps/web/src/components/chat/blocks/ApprovalBlock.tsx` | button order/CSS class polish | ⚠️ | ❓ needs decision |
| `apps/web/src/components/chat/blocks/BlockRenderer.module.css` | approval/card visual polish | ⚠️ | ❓ needs decision |
| `apps/web/src/hooks/useAuth.ts` | auth error copy polish | ❌ production-lock kapsamı dışı | ❓ needs decision |
| `apps/web/src/lib/auth-client.ts` | auth error formatter | ❌ production-lock kapsamı dışı | ❓ needs decision |
| `apps/web/src/lib/chat-runtime/request-payload.ts` | max tokens 256 -> 2048 | ❌ backend/runtime behavior change | ❓ needs decision |
| `apps/web/src/styles/index.css` | imports Tailwind | ⚠️ | ⚠️ patch |
| `apps/web/src/styles/routes/chat-migration.css` | competitive UX CSS pass | ❌ production-lock kapsamı dışı | ❓ needs decision |
| `apps/web/src/__fixtures__/messages/` | yok | ❌ | ⚠️ patch |
| `scripts/check-bundle-budget.mjs` | yok | ❌ | ⚠️ patch |
| `apps/web/tests/visual/competitive-chat-ux.spec.ts` | separate visual UX eforu | ❌ | ❓ needs decision |
| `docs/COMPETITIVE-CHAT-UX-IMPLEMENTATION-PROMPTS.md` | separate prompt plan | ❌ | ❓ needs decision |
| `docs/design-audit/screenshots/**` | 58 image modified | ❌ production-lock kanıtı değil | ❓ needs decision |
| `apps/server/src/runtime/run-model-turn.ts` | max_tokens failure behavior | ❌ backend change | ❓ needs decision |
| `apps/server/src/runtime/run-model-turn.test.ts` | max_tokens server test | ❌ backend change | ❓ needs decision |
| `apps/server/src/ws/register-ws.test.ts` | web.search continuation test change | ❌ backend test change | ❓ needs decision |

## 4. `apps/web/vite.config.ts`

Eklenmiş:

- ✅ `@tailwindcss/vite` plugin.
- ✅ `rollup-plugin-visualizer`.
- ✅ `@` alias: `@ -> apps/web/src`.
- ⚠️ Bundle analyzer var ama conditional değil; normal build'de de visualizer çalışacak.
- ❌ Bundle budget yok; `scripts/check-bundle-budget.mjs` yok.
- ❌ `tsconfig.json` içinde `paths` yok; Vite alias TypeScript typecheck için yeterli değil.

## 5. Untracked Implementation Değerlendirmesi

### `apps/web/src/lib/streamdown/`

Spike ile büyük ölçüde birebir:

- `CodeBlock.tsx`, `shiki-highlighter.ts`, `MermaidBlock.tsx`, `MermaidRenderer.tsx`, `StreamdownMessage.tsx` spike branch'teki production-lock dosyalarıyla aynı içerikte.
- `StreamdownMessage.tsx` KaTeX plugin'i kuruyor ve `apps/web/src/styles/tailwind.css` KaTeX CSS import ediyor.
- Mermaid lazy import var.
- Shiki lazy language/theme loading var.

Sorunlar:

- Runa main transcript hattına bağlı değil; `PersistedTranscript` ve `StreamingMessageSurface` hâlâ `MarkdownRenderer` kullanıyor.
- `StreamdownMessage.test.tsx` var ama web package test deps yok.
- `vitest.config.mjs` hâlâ `environment: 'node'`; RTL/DOM testleri için `jsdom` gerek.
- pnpm workspace'te direct subpath/transitive imports kırılabilir: `@shikijs/core`, `mermaid`.
- Unknown language fallback var; ancak style classları Runa CSS ile bağlanmamış.

### `apps/web/src/lib/assistant-ui/`

`MessageRenderer.tsx` var ve spike part registry pattern'iyle uyumlu görünüyor:

- `Text` -> `StreamdownMessage`
- `Reasoning` -> ai-elements `Reasoning`
- `Tool` override -> ai-elements `Tool`
- `Source` -> `InlineCitation`
- `Empty` -> thinking placeholder

Sorunlar:

- Hiçbir chat surface bu renderer'ı kullanmıyor.
- assistant-ui Thread/Composer shell entegrasyonu yok.
- `@` alias TypeScript'te tanımlı olmadığı için typecheck kırıyor.
- Tool state mapping `requires-action -> approval-requested` iyi, ancak Runa `approval_block` hâlâ eski block renderer üzerinden gidiyor.

### `apps/web/src/lib/transport/`

Mevcut:

- `errors.tsx` var.

Eksik:

- `error-catalog.ts` yok; `errors.tsx` bunu import ettiği için typecheck kırıyor.
- `runa-adapter.ts` yok.
- Spike'taki `errors.test.ts` yok.

Plan açısından en kritik açık burası. Runa backend `/api/chat` değil `/ws`; adapter olmadan production-lock stack gerçek Runa backend'e bağlanmış sayılmaz.

### `apps/web/src/lib/evidence/`

`types.ts` planla uyumlu. Contract yorumu var. Keep edilebilir.

### `apps/web/src/lib/i18n/`

`strings.ts` çok minimal:

- `transport.connectionLost`
- `transport.retry`

Eksik:

- Kaynaklar / arama / sonuç / truncated copy.
- Tool/reasoning/source Türkçe stringleri.
- ai-elements generated copy hâlâ İngilizce.

### `apps/web/src/components/ai-elements/`

Durum:

- Generated primitives var.
- Tool input undefined guard uygulanmış: `state === "input-streaming" || input === undefined ? <SkeletonInput /> : ...`.
- `tool.test.tsx` bu edge case'i test ediyor.

Sorunlar:

- `sources.tsx`: "Used {count} sources" İngilizce.
- `reasoning.tsx`: "Thinking...", "Thought for..." İngilizce.
- `tool.tsx`: status labels ve headings İngilizce: "Awaiting Approval", "Parameters", "Result", "Error".
- `hover-card.tsx` tarafında explicit `openDelay` / `closeDelay` React 19 patch'i görünmüyor.
- Runa brand token'ları yerine shadcn/Tailwind semantic token classları kullanıyor.
- `code-block.tsx` spike generated code-block değil; bilinçli re-export gibi görünüyor ve bundle açısından iyi.

### `apps/web/src/components/ui/`

shadcn/Base UI primitive'leri var. Genel olarak default shadcn-ish:

- `bg-primary`, `text-muted-foreground`, `rounded-lg`, `border-border`, `ring-ring` gibi semantic Tailwind token classları kullanıyor.
- Runa CSS variable'larına ancak `tailwind.css` theme bridge üzerinden bağlanıyor.
- Mevcut Runa `RunaButton`, `RunaModal`, `RunaSheet` primitives hâlâ duruyor; iki UI primitive sistemi oluşmuş.

Bu dosyalar discard edilmemeli, çünkü ai-elements bunlara bağlı. Ama Runa brand ve lint/TS standardına göre patch gerekiyor.

### `apps/web/src/styles/tailwind.css`

Var:

- Tailwind v4 import.
- `tw-animate-css`.
- `shadcn/tailwind.css`.
- `katex/dist/katex.min.css`.
- dark custom variant.
- theme token bridge.

Sorunlar:

- Runa renkleri yerine ağırlıklı nötr `oklch` shadcn tokenları var; Runa brand token'larıyla tam uyumlu değil.
- `--font-sans: "Geist Variable"` var, ancak font importu ayrıca package'a eklenmiş; mevcut Runa font stratejisiyle hizalanmalı.
- KaTeX CSS importu doğru yönde.

## 6. Modified Chat Components

| Dosya | Bulgular |
|---|---|
| `CurrentRunSurface.tsx` | Persisted transcript'i details altında gizlemek yerine direkt timeline'a alıyor; yeni stack entegrasyonu değil. |
| `PersistedTranscript.tsx` | Hâlâ `MarkdownRenderer`; sadece timestamp `tr-TR` olmuş. |
| `StreamingMessageSurface.tsx` | Hâlâ `MarkdownRenderer`; sadece görsel shell değişmiş. |
| `PresentationRunSurfaceCard.tsx` | Consumer mode'da "Canlı çalışma" chrome'unu gizliyor; approval/inspection callbackleri korunmuş görünüyor. |
| `RunProgressPanel.tsx` | Consumer mode için compact activity line eklenmiş; developer diagnostics korunuyor. |
| `ChatComposerSurface.tsx` | Enter submit helper eklenmiş; IME ve Shift+Enter korunuyor. Keep edilebilir. |
| `ApprovalBlock.tsx` | Reddet/Onayla sırası değişmiş, `runa-approval-card` class eklenmiş; callback korunuyor. |
| `BlockRenderer.module.css` | approval card compact CSS eklenmiş; production-lock stack değil, visual polish. |

Kritik sonuç: Eski `MarkdownRenderer` hâlâ aktif. Search sonuçları:

- `TextBlock.tsx`
- `FileReferenceBlock.tsx`
- `PersistedTranscript.tsx`
- `StreamingMessageSurface.tsx`
- `UIPhase5Surfaces.test.tsx`

Bu yüzden dirty work yeni markdown stack'e geçmemiş; yalnızca yeni stack dosyalarını yana koymuş.

Approval/inspection akışları:

- `PresentationRunSurfaceCard` içindeki `onRequestInspection` ve `onResolveApproval` callbackleri korunmuş.
- `ApprovalBlock` `onResolveApproval` çağrısını koruyor.
- Ancak assistant-ui renderer henüz bu block akışına bağlanmadığı için yeni stack bu davranışı devralmıyor.

## 7. Untracked Yeni Dosyalar

### `apps/web/tests/visual/competitive-chat-ux.spec.ts`

Bu production-lock migration değil, ayrı bir visual/product polish eforu:

- auth error screenshot
- desktop empty chat
- desktop pending approval
- mobile pending approval

Local dev auth bootstrap ve gerçek UI screenshot akışı kullanıyor. Tamamlayıcı olabilir, ama production-lock migration commit'lerine karıştırılırsa scope bulanır.

### `docs/COMPETITIVE-CHAT-UX-IMPLEMENTATION-PROMPTS.md`

Production-lock yaklaşımıyla doğrudan çakışmıyor, ama ayrı bir prompt zinciri:

- auth error copy
- composer Enter behavior
- chat shell timeline polish
- compact progress/approval
- visual proof

Bu belge UI polish kararları içeriyor, stack migration kararı değil. Production-lock migration'dan ayrı tutulmalı.

### Yeni test dosyaları

| Dosya | Değerlendirme |
|---|---|
| `ChatComposerSurface.test.tsx` | Dar ve iyi: Enter submit helper. Keep edilebilir. |
| `auth-client.test.ts` | Auth copy işi; production-lock kapsamı dışı. Mojibake görünen beklentiler var. |
| `request-payload.test.ts` | Runtime behavior değişikliği; production-lock kapsamı dışı. |
| `StreamdownMessage.test.tsx` | Gerekli ama eksik; yalnız math `.katex`, diğer fixtures yok. |
| `tool.test.tsx` | Tool input guard için iyi smoke; test infra eksik. |

## 8. Visual Regression Screenshot Değerlendirmesi

58 tracked PNG modified, ayrıca 11 competitive UX screenshot untracked. Dosya adlarına ve örnek görsel incelemeye göre bunlar:

- `ui-overhaul-05/06` mobile/desktop responsive ve brand polish baseline güncellemeleri.
- `ui-overhaul-07-*` chat empty, approval pending/approved/rejected, command palette, account/devices/history states.
- `competitive-chat-ux` ve `competitive-chat-ux-e2e` ayrı chat-native polish kanıtları.

Örnek görüntüler:

- Desktop empty chat daha sade, chat-first ve compact nav yönünde.
- Desktop pending approval daha iyi kompakt approval card gösteriyor.
- Mobile pending approval'da bottom nav composer üstüne biniyor/occlude ediyor; production-ready değil.

Bu screenshot'lar yeni Streamdown/assistant-ui stack kanıtı değil. Eski runtime + eski `MarkdownRenderer` hattı üzerinde alınmış görünüyor.

## 9. Server-Side Dirty Changes

| Dosya | Değişiklik | Migration için gerekli mi? |
|---|---|---|
| `apps/server/src/runtime/run-model-turn.ts` | `finish_reason === "max_tokens"` assistant response'u `MODEL_RESPONSE_TRUNCATED` ile failed yapıyor | ❌ Hayır |
| `apps/server/src/runtime/run-model-turn.test.ts` | max_tokens failure testi ekliyor | ❌ Hayır |
| `apps/server/src/ws/register-ws.test.ts` | web.search testinde ikinci model response / debug note beklentisi değişiyor | ❌ Hayır |

Bu değişiklikler mantıken faydalı olabilir, ama production-lock UI migration'ın backend'e dokunmama prensibiyle çakışıyor. Ayrı backend hardening branch'i olarak değerlendirilmeliler.

## 10. Çalışıyor Mu Kontrolü

Komutlar fix yapmadan çalıştırıldı.

| Komut | Sonuç | Kanıt |
|---|---|---|
| `pnpm install --frozen-lockfile` | ❌ FAIL | `ERR_PNPM_OUTDATED_LOCKFILE`; `apps/web/package.json` specifier'ları lockfile ile uyuşmuyor |
| `pnpm build` | ❌ FAIL | `@runa/web` Vite config load fail: `Cannot find package '@tailwindcss/vite'`; ayrıca `rollup-plugin-visualizer` unresolved |
| `pnpm typecheck` | ❌ FAIL | `@runa/web` çoklu TS2307: missing deps, missing `@` alias, missing `./error-catalog` |

`pnpm install --no-frozen-lockfile` çalıştırılmadı; no-modify triage kuralı nedeniyle lockfile güncellemesi yapılmadı.

Öne çıkan typecheck hata sınıfları:

- Missing installed deps: `ai`, `@assistant-ui/react`, `streamdown`, `@streamdown/*`, `@base-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@tailwindcss/vite`, `rollup-plugin-visualizer`.
- Missing test deps: `@testing-library/react`, jest-dom matcher types.
- Missing TS path alias: `@/components/...`, `@/lib/...`.
- Missing file: `src/lib/transport/error-catalog.ts`.
- Potential pnpm direct dependency issue: `mermaid`, `@shikijs/core`.

## 11. Kritik Bulgular

1. **Build şu an kırık.** Lockfile güncel değil; CI ilk install adımında fail eder.
2. **Transport adapter yok.** Bu dirty work Runa gerçek backend'e production-lock stack'i bağlamıyor.
3. **Eski MarkdownRenderer hâlâ aktif.** Yeni Streamdown stack yana eklenmiş ama transcript/streaming path değişmemiş.
4. **Fixture suite eksik.** Planlanan `src/__fixtures__/messages/` yok; sadece 2 dar smoke test var.
5. **Bundle budget yok.** Visualizer var, fail eden budget script yok.
6. **Image forward-compat yok.** `src/lib/media/types.ts`, README ve skipped fixture yok.
7. **UI string localization eksik.** ai-elements copy İngilizce ve merkezi string dosyasına taşınmamış.
8. **Runa brand entegrasyonu yarım.** shadcn tokens default nötr tema; Runa tokenlarıyla tam uyum yok.
9. **Server dirty changes unrelated.** UI migration commit'lerine alınmamalı.
10. **Visual screenshots scope dışı.** Faydalı UX kanıtı olabilir, ama stack migration kanıtı değil.

## 12. Üç Senaryo Karşılaştırması

### Senaryo A: ADOPT + COMPLETE

- Tahmini ek iş: 10-16 saat.
- Risk: yüksek.
- Avantaj:
  - Spike streamdown/assistant-ui/ai-elements dosyaları hazır.
  - Competitive UX polish içinde bazı iyi kullanıcı yüzeyi iyileştirmeleri var.
  - Composer Enter, ToolInput guard, EvidencePack tipi kullanılabilir.
- Dezavantaj:
  - Dirty work scope karışık: UI stack, auth copy, backend runtime, visual polish, screenshot baseline aynı anda.
  - Build/typecheck şu an kırık.
  - Adapter yok; en zor migration kısmı yapılmamış.
  - Yanlış dosyaları adopt etmek backend ve visual baseline borcunu migration PR'ına taşır.

### Senaryo B: CHERRY-PICK

- Tahmini ek iş: 8-12 saat.
- Risk: orta.
- Tutulacak dosyalar:
  - `.npmrc`
  - `apps/web/src/lib/streamdown/*`
  - `apps/web/src/lib/assistant-ui/MessageRenderer.tsx`
  - `apps/web/src/lib/evidence/types.ts`
  - `apps/web/src/components/ai-elements/*` patch ederek
  - `apps/web/src/components/ui/{badge,button,carousel,collapsible,hover-card,select}.tsx` patch ederek
  - `apps/web/src/lib/utils.ts`
  - `apps/web/src/styles/tailwind.css` patch ederek
  - `ChatComposerSurface.tsx` Enter helper ve testi, istenirse
  - `ToolInput` guard testi, `StreamdownMessage` math testi, patch ederek
- Ayrı tutulacak / şimdilik alınmayacak:
  - server runtime/test changes
  - auth copy changes
  - request max token behavior change
  - competitive UX screenshot baselines
  - `docs/COMPETITIVE-CHAT-UX-IMPLEMENTATION-PROMPTS.md`
  - chat visual CSS polish, production-lock sonrası ayrı PR olarak
- Gerekli patch işleri:
  - lockfile güncelle
  - web test deps ekle
  - `tsconfig` paths ekle veya `@` imports'u relative/Runa style'a çevir
  - `error-catalog.ts` ve `runa-adapter.ts` yaz
  - old `MarkdownRenderer` hattını Streamdown'a bağla
  - fixture suite + budget script ekle

### Senaryo C: HARD RESET

- Komut fikri: `git checkout .` + `git clean -fd`.
- Tahmini ek iş: 14-20 saat.
- Risk: orta/yüksek.
- Avantaj:
  - Temiz, atomic production-lock migration.
  - Scope karışıklığı sıfırlanır.
  - Server/auth/visual polish yan etkileri silinir.
- Dezavantaj:
  - Kullanılabilir spike kopyaları ve competitive UX emeği kaybolur.
  - 58 screenshot ve ek visual proof tamamen gider.
  - Eğer bu dirty work başka aktif işin parçasıysa veri kaybı riski var.

## 13. Codex Önerisi

**Senaryo B: CHERRY-PICK seçilmeli.** Çünkü dirty work içinde değerli spike kopyaları var, ama build kırık, adapter eksik ve scope dışı server/visual/auth değişiklikleri production-lock migration'a doğrudan alınamayacak kadar karışık.

