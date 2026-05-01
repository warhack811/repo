# Runa UI Stack Production-Lock Migration Report

## GO / NO-GO

GO: Production-lock UI stack main Runa frontend'e merge edilebilir; backend WebSocket/runtime/auth kontratlari korunarak web doğrulama ve root kalite kapilari geçti.

## Quarantine Summary

- Branch: `quarantine/non-stack-work`
- Commit: `1fd8208 chore(quarantine): preserve non-stack-migration work`
- İçerik: backend runtime hardening, auth/request-payload polish, competitive chat UX doküman/testleri ve visual screenshot artefaktlari production-lock kapsamindan ayrildi.
- Geri dönüş yolu: bu branch ayri bir PR olarak incelenmeli; production-lock PR'ina karistirilmamali.

## Cherry-Pick Summary

- Spike renderer stack'i Runa web'e taşındi: Streamdown, lazy Shiki, lazy Mermaid, KaTeX CSS, ai-elements, shadcn primitives.
- `useChatRuntime` transport owner olarak kaldi; assistant-ui yalniz render shell seviyesinde `ThreadPrimitive.Root/Viewport` ile bağlandi.
- Eski `MarkdownRenderer` ve custom parser silindi; text/file/persisted/streaming transcript hatti `StreamdownMessage` kullaniyor.
- Web search and tool result bloklari ai-elements `Sources` ve `Tool` yüzeylerine taşındi.
- Approval block'a dokunulmadi; pre-existing visual/polish diff'i geri alindi.

## Patch Summary

- `apps/web/src/hooks/useVoiceInput.ts`: TypeScript 6 DOM speech declarations ile uyumlu olacak şekilde dar local type bridge eklendi.
- `biome.json`: `runa-spike/` ve `.codex-tmp/` root lint taramasindan çikarildi; spike dosyalarina dokunulmadi.
- `apps/web/vitest.config.mjs`: jsdom + `@` alias + setup file eklendi; kaynak-tarayan iki test node environment'a sabitlendi.
- `scripts/check-bundle-budget.mjs`: initial JS, Mermaid initial ve Shiki initial budget kapisi eklendi.

## New Files

- `apps/web/src/lib/streamdown/*`
- `apps/web/src/lib/assistant-ui/MessageRenderer.tsx`
- `apps/web/src/lib/transport/{error-catalog.ts,errors.tsx,runa-adapter.ts,runa-adapter.test.ts}`
- `apps/web/src/lib/evidence/types.ts`
- `apps/web/src/lib/media/{types.ts,README.md}`
- `apps/web/src/lib/i18n/strings.ts`
- `apps/web/src/components/ai-elements/*`
- `apps/web/src/components/ui/{badge,button,carousel,collapsible,hover-card,select}.tsx`
- `apps/web/src/__fixtures__/messages/*`
- `apps/web/src/styles/tailwind.css`
- `apps/web/src/test/setup.ts`
- `scripts/check-bundle-budget.mjs`

## Deleted Files

- `apps/web/src/components/chat/MarkdownRenderer.tsx`
- `apps/web/src/components/chat/markdown/{blocks.tsx,inline.tsx,parser.ts}`

## Backend Compatibility Decision

Adapter path seçildi. Runa backend mevcut WebSocket bridge protokolünü konuşmaya devam ediyor; `runa-adapter.ts` `text.delta`, `presentation.blocks`, `run.finished`, `run.rejected` ve `runtime.event` mesajlarini render part modeline çeviriyor. Backend runtime, auth ve WebSocket kayit dosyalarina bu branch'te dokunulmadi.

## Migration Commits

| SHA | Commit | Notes |
| --- | --- | --- |
| `bbc3731` | `chore(npmrc): pin save-exact for production lock` | Exact package discipline |
| `2183bf2` | `chore(config): wire vite alias vitest jsdom and bundle budget` | Vite/Vitest/budget wiring |
| `dcb9fd7` | `feat(streamdown): adopt spike production-lock renderer` | Lazy Streamdown/Shiki/Mermaid renderer |
| `aa8439c` | `feat(evidence): add EvidencePack contract` | Shared evidence contract |
| `be379e3` | `i18n(ui): localize ai-elements and ui primitives to turkish` | ai-elements + shadcn primitives |
| `1311b59` | `feat(transport): add error-catalog with localized UX states` | Transport error catalog |
| `db8325f` | `feat(transport): add runa-adapter to bridge ws to ui message parts` | WS bridge to UI parts |
| `26e9955` | `feat(media): scaffold forward-compat contracts and docs` | Image gen/edit future contracts |
| `0b1e67c` | `test(fixtures): lock message rendering behavior` | Fixture suite and assertions |
| `82041dd` | `refactor(chat): migrate transcript rendering to production stack` | Transcript/chat block migration |
| `1e9e867` | `ci(workflow): add bundle budget and fixture test gates` | CI budget step |
| `f6caa3a` | `feat(transport): add retry banner for stream errors` | Retry UX banner |

## Verification Numbers

| Gate | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm lint` | PASS, 652 files |
| `pnpm typecheck` | PASS, 9 turbo tasks |
| `pnpm test` | PASS, root test suite; web `56 passed / 1 skipped` |
| `pnpm build` | PASS, 6 turbo tasks |
| `node scripts/check-bundle-budget.mjs apps/web/dist` | PASS |
| Initial JS gzip | `71,413` bytes |
| Mermaid initial | `0` files |
| Shiki initial gzip | `0` bytes |

## Image Gen Forward-Compat

- `MediaJobStatus`, `MediaJobKind`, `MediaJob`, `MediaPack` tipleri eklendi.
- `src/lib/media/README.md` future `image-generation` message part, `MediaJobBlock`, lazy `ImageEditor.tsx` ve streamlenen `data-media-job-update` patch modelini belgeledi.
- Fixture suite'te `future-media.fixture.ts` skip'li placeholder olarak duruyor.

## UI Overhaul Alignment

- UI-OVERHAUL-02/03 no-Tailwind karari production-lock stack tarafindan supersede edildi.
- Runa token kaynagi korunarak shadcn semantic token bridge `tailwind.css` içinde tanimlandi.
- Existing runtime ownership, persisted conversation mapping, approval/inspection callback hatti korunuyor.

## Known Regressions / Open Work

- Manual browser smoke bu rapor commit'i öncesinde local olarak koşturulmadi; otomatik web/root validation geçti.
- Visual screenshot baseline güncellemesi quarantine branch'te tutuldu; bu PR'a alinmadi.
- PR henüz açilmadi/push edilmedi; local branch `feature/ui-stack-production-lock`.

## Approval / Inspection Preservation

Evet. Backend runtime ve WebSocket dosyalari production-lock branch'inde değiştirilmedi; `ApprovalBlock.tsx` ve approval visual diff'i HEAD'e geri alindi. Existing callback-based `onResolveApproval` hatti korunuyor.

## Repo

- Branch: `feature/ui-stack-production-lock`
- Final code commit before this report: `f6caa3a`
- Quarantine branch: `quarantine/non-stack-work`
