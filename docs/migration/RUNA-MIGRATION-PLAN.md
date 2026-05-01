# Runa UI Stack Production Lock Migration Plan

## Scope

Bu plan, `runa-spike/` içinde doğrulanmış production-lock UI stack'ini Runa ana kodbazına taşımadan önceki discovery sonucudur. Spike referans olarak kullanıldı; spike dosyalarına dokunulmadı.

Branch: `feature/ui-stack-production-lock`

Önemli çalışma ağacı notu: branch açıldığı anda repo zaten ciddi miktarda dirty durumdaydı. Özellikle `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/src/lib/streamdown/`, `apps/web/src/lib/assistant-ui/`, `apps/web/src/components/ai-elements/` gibi migration'a benzeyen değişiklikler uncommitted durumdaydı. Bu plan commit'i yalnızca bu dosyayı kapsamalı; mevcut dirty değişikliklerin sahipliği netleşmeden migration commit'lerine dahil edilmemeli.

## Discovery Findings

### Root Tooling

| Alan | Mevcut durum |
|---|---|
| Package manager | `pnpm@9.15.4` |
| Monorepo runner | `turbo` |
| Root build | `pnpm build` -> `turbo run build` |
| Root lint | `pnpm lint` -> `biome check .` |
| Root typecheck | `pnpm typecheck` -> `turbo run typecheck` |
| Root test | `pnpm test` -> `turbo run test` |
| E2E | `pnpm test:e2e` -> `pnpm build && playwright test` |
| CI | `.github/workflows/ci.yml`: install, typecheck, lint, unit tests, build, Playwright Chromium smoke |

`AGENTS.md`, `implementation-blueprint.md`, `PROGRESS.md` bu checkout'ta repo kökünde bulunamadı. `docs/TASK-TEMPLATE.md` okundu.

### Committed Web Stack Inventory

Committed `HEAD:apps/web/package.json` baseline:

| Paket | Sürüm |
|---|---|
| `react` | `^19.2.0` |
| `react-dom` | `^19.2.0` |
| `react-router-dom` | `^7.14.1` |
| `react-markdown` | `^10.1.0` |
| `remark-gfm` | `^4.0.1` |
| `rehype-highlight` | `^7.0.2` |
| `highlight.js` | `^11.11.1` |
| `lucide-react` | `^1.11.0` |
| `motion` | `^12.38.0` |
| `vite` | `^8.0.8` |
| `typescript` | `^5.7.0` |

Committed baseline'da AI SDK, assistant-ui, streamdown, KaTeX, normalize-url, chrono-node, shiki, ai-elements, Tailwind/shadcn yok.

Dirty working tree'de `apps/web/package.json` zaten spike stack'ine yaklaşmış görünüyor:

| Paket | Dirty working tree sürümü |
|---|---|
| `ai` | `6.0.172` |
| `@ai-sdk/react` | `3.0.174` |
| `@assistant-ui/react` | `0.12.28` |
| `@assistant-ui/react-ai-sdk` | `1.3.21` |
| `streamdown` | `2.5.0` |
| `katex` | `0.16.45` |
| `normalize-url` | `9.0.0` |
| `chrono-node` | `2.9.0` |
| `ai-elements` | `1.9.0` |
| `shiki` | `4.0.2` |
| `tailwindcss` | `4.2.4` |
| `@tailwindcss/vite` | `4.2.4` |
| `rollup-plugin-visualizer` | `7.0.1` |

Bu değişiklikler migration sırasında kullanılabilir adaylar, fakat şu an plan commit'ine dahil edilmemeli.

### Current Chat Surface Inventory

Ana chat route React Router üzerinden `/chat`:

| Alan | Dosya |
|---|---|
| Auth shell | `apps/web/src/App.tsx` |
| Authenticated routes | `apps/web/src/AuthenticatedApp.tsx` |
| Chat route | `apps/web/src/pages/ChatRuntimePage.tsx` |
| Main chat page | `apps/web/src/pages/ChatPage.tsx` |
| Runtime hook | `apps/web/src/hooks/useChatRuntime.ts` |
| Conversation-backed runtime | `apps/web/src/hooks/useConversationBackedChatRuntime.ts` |
| Conversation state/fetch | `apps/web/src/hooks/useConversations.ts` |
| Store | `apps/web/src/stores/chat-store.ts` |
| WS client helpers | `apps/web/src/lib/ws-client.ts` |

Mevcut transcript/render hattı:

| Bileşen | Rol |
|---|---|
| `apps/web/src/components/chat/CurrentRunSurface.tsx` | persisted transcript, streaming text, current presentation surface orchestration |
| `apps/web/src/components/chat/PersistedTranscript.tsx` | persisted conversation messages |
| `apps/web/src/components/chat/StreamingMessageSurface.tsx` | live `text.delta` render |
| `apps/web/src/components/chat/PresentationRunSurfaceCard.tsx` | current/past `presentation.blocks` card shell |
| `apps/web/src/components/chat/PresentationBlockRenderer.tsx` | block rendering helpers |
| `apps/web/src/components/chat/blocks/BlockRenderer.tsx` | `RenderBlock` union switch |
| `apps/web/src/components/chat/MarkdownRenderer.tsx` | current custom markdown renderer |
| `apps/web/src/components/chat/markdown/*` | custom markdown parser/inline/block renderer |
| `apps/web/src/components/chat/blocks/TextBlock.tsx` | `MarkdownRenderer` consumer |
| `apps/web/src/components/chat/blocks/FileReferenceBlock.tsx` | `MarkdownRenderer` consumer |
| `apps/web/src/components/chat/blocks/WebSearchResultBlock.tsx` | current web-search source card |
| `apps/web/src/components/chat/blocks/ToolResultBlock.tsx` | current tool result block |

Debug/user-surface leakage candidates found:

| Dosya | Not |
|---|---|
| `apps/web/src/components/chat/chat-presentation/transport-feedback.ts` | "Çalışma tamamlandı" feedback strings |
| `apps/web/src/lib/chat-runtime/current-run-progress.ts` | completed-state copy |
| `apps/web/src/lib/chat-runtime/runtime-feedback.ts` | run completed titles/copy |

Bu metinlerin tamamı debug leak değildir; migration sırasında user surface sözlüğüyle tekrar sınıflandırılmalı. Üretimde ham tool/runtime leakage görünmemeli.

### Backend / Transport Inventory

Committed Runa backend `/api/chat` konuşmuyor. Fastify server `apps/server/src/ws/register-ws.ts` içinde `/ws` ve `/ws/desktop-agent` WebSocket route'larını kayıt ediyor. Vite dev proxy de `/ws`, `/auth`, `/conversations`, `/desktop`, `/upload`, `/storage` endpoint'lerini `127.0.0.1:3000` server'a yönlendiriyor.

Mevcut chat runtime protokolü:

| Mesaj | Yön | Kaynak |
|---|---|---|
| `run.request` | web -> server | `apps/web/src/hooks/useChatRuntime.ts`, `packages/types/src/ws.ts` |
| `approval.resolve` | web -> server | `apps/web/src/hooks/useChatRuntime.ts` |
| `inspection.request` | web -> server | `apps/web/src/hooks/useChatRuntime.ts` |
| `connection.ready` | server -> web | `packages/types/src/ws.ts` |
| `run.accepted` | server -> web | `packages/types/src/ws.ts` |
| `text.delta` | server -> web | `packages/types/src/ws.ts` |
| `presentation.blocks` | server -> web | `packages/types/src/ws.ts` |
| `runtime.event` | server -> web | `packages/types/src/ws.ts` |
| `run.rejected` | server -> web | `packages/types/src/ws.ts` |
| `run.finished` | server -> web | `packages/types/src/ws.ts` |

Karar: mevcut backend AI SDK v6 `DefaultChatTransport` / UIMessage HTTP stream protokolüyle doğrudan uyumlu değil. Backend'e dokunmadan ilerlemek için frontend tarafında `apps/web/src/lib/transport/runa-adapter.ts` yazılmalı. Bu adapter Runa WS eventlerini assistant-ui/Streamdown render hattının beklediği mesaj/part modeline çevirmeli. Server kontratı korunur.

### Auth / Session / Persistence

Chat surface authenticated route altında çalışıyor. `useAuth` bearer token üretip `ChatRuntimePage` -> `useConversationBackedChatRuntime` -> `useChatRuntime` hattına geçiriyor. Conversation list/history `/conversations` HTTP endpointlerinden çekiliyor; live run `/ws` üzerinden ilerliyor.

Migration riskleri:

| Risk | Etki |
|---|---|
| `useChat` transport'a direkt geçmek | Existing auth, conversation persistence, approval, inspection ve desktop target contract'larını kırabilir |
| Assistant-ui Thread'i yanlış yerde state owner yapmak | Runa'nın conversation sync ve run lifecycle modelini iki state kaynağına bölebilir |
| Persisted history role/content mapping | UIMessage part modeline geçerken mevcut `ConversationMessage.content` düz string olarak korunmalı |
| Approval/inspection blocks | assistant-ui message renderer içine körlemesine gömülürse mevcut approval replay path bozulabilir |

## UI Overhaul Alignment

| Plan | Uyum | Not |
|---|---|---|
| UI-OVERHAUL-01 | Uyumlu | Developer-only debug surface izolasyonu production-lock migration'da korunmalı; ham transport paneli consumer chat'e sızmamalı |
| UI-OVERHAUL-02 | Çakışma var | Plan CSS variables + CSS Modules ve "Tailwind yok" çizgisinde; production-lock stack shadcn/Tailwind/ai-elements istiyor |
| UI-OVERHAUL-03 | Çakışma var | Runa primitives ve CSS Modules hedefi shadcn generated primitives ile karar gerektiriyor |
| UI-OVERHAUL-04 | Büyük ölçüde supersede | Eski `MarkdownRenderer`/`rehype-highlight` varsayımı Streamdown + custom Shiki/Mermaid ile değişiyor; visual hierarchy hedefleri geçerli kalıyor |
| UI-OVERHAUL-05 | Uyumlu | Mobile-first responsive audit Thread/composer migration sonrası yeniden doğrulanmalı |
| UI-OVERHAUL-06 | Kısmen uyumlu | Brand polish/onboarding hedefleri geçerli; typography/motion token kararı shadcn/Tailwind ile yeniden hizalanmalı |

Karar gerektiren ana çakışma: production-lock migration kabul edilirse UI-OVERHAUL-02/03'ün "Tailwind yok" kuralı bu stack için geçersiz sayılmalı ya da shadcn/ai-elements yalnızca minimum CSS adapter ile izole edilmelidir. Spike GO olduğu için öneri: production-lock stack bu kuralı supersede etsin, fakat Runa brand token'ları tek kaynak olarak kalsın.

## Files To Remove Or Replace

| Dosya/Paket | Aksiyon | Gerekçe |
|---|---|---|
| `react-markdown` | remove | Streamdown production stack'e geçilecek |
| `remark-gfm` | remove | Streamdown GFM davranışı fixture ile korunacak |
| `rehype-highlight` | remove | Custom Shiki lazy loader kullanılacak |
| `highlight.js` | remove | Shiki replacement |
| `apps/web/src/components/chat/MarkdownRenderer.tsx` | replace/delete | Custom parser yerine `StreamdownMessage` |
| `apps/web/src/components/chat/markdown/*` | delete | Custom markdown parser surface kapanacak |
| `apps/web/src/components/chat/blocks/CodeBlock.tsx` veya iç highlighter | replace | Shiki CodeBlock tek abstraction olacak |
| `apps/web/src/components/chat/blocks/WebSearchResultBlock.tsx` | replace/adapt | EvidencePack + ai-elements Sources/InlineCitation |
| `apps/web/src/components/chat/blocks/ToolResultBlock.tsx` | replace/adapt | ai-elements Tool state model |
| Debug-only completion/transport copy | classify/remove | Üretim chat'inde debug leakage olmamalı |

Silme işlemleri migration implementation fazında, testler green kaldıkça atomik commit'lerle yapılmalı.

## Files To Add Or Adapt

| Hedef | Kaynak / Not |
|---|---|
| `apps/web/src/lib/streamdown/CodeBlock.tsx` | Spike stable abstraction; Runa import/style düzenine adapte |
| `apps/web/src/lib/streamdown/MermaidBlock.tsx` | Spike lazy Mermaid abstraction |
| `apps/web/src/lib/streamdown/StreamdownMessage.tsx` | Streamdown wrapper; KaTeX CSS garanti |
| `apps/web/src/lib/assistant-ui/MessageRenderer.tsx` | text/tool/reasoning/citation part renderer registry |
| `apps/web/src/lib/transport/runa-adapter.ts` | Runa WS -> UI message/assistant render adapter |
| `apps/web/src/lib/transport/error-catalog.ts` | Network cut/rate limit/timeout/server error UX catalog |
| `apps/web/src/lib/evidence/types.ts` | EvidencePack single source of truth |
| `apps/web/src/lib/media/types.ts` | Image generation/editing forward-compat contracts |
| `apps/web/src/lib/media/README.md` | Future media part/editor architecture |
| `apps/web/src/components/ai-elements/` | Generated primitives, lint override scoped to this folder |
| `apps/web/src/__fixtures__/messages/` | Markdown/code/math/mermaid/citation/tool/reasoning/edge fixtures |
| `apps/web/src/__fixtures__/messages/future-media.fixture.ts` | skipped forward-compat fixture |
| `apps/web/src/lib/i18n/` veya mevcut `localization/copy.ts` | Turkish production strings, i18n-ready |
| `apps/web/scripts/check-bundle-budget.mjs` veya root `scripts/check-bundle-budget.mjs` | Initial JS gzip <350 KB CI guard |
| `apps/web/vitest.config.mjs` | jsdom/RTL fixture lane if needed |
| `.github/workflows/ci.yml` | add budget + fixture test lane |

## Migration Strategy

1. Commit this plan only.
2. Resolve/confirm ownership of pre-existing dirty migration-like changes.
3. Package migration commit:
   - remove old markdown/highlight packages;
   - add exact spike versions;
   - preserve pnpm lock;
   - avoid caret/tilde for production-lock packages.
4. Add Streamdown primitives:
   - `CodeBlock` with singleton Shiki + lazy language loading;
   - `MermaidBlock` dynamic import;
   - KaTeX CSS import and fixture assertion.
5. Add assistant-ui/ai-elements renderer registry without making it state owner yet.
6. Add Runa transport adapter:
   - keep existing `/ws` backend;
   - map `text.delta` and persisted conversation text to text parts;
   - map `presentation.blocks` to tool/source/reasoning/citation compatible parts where possible;
   - preserve approval/inspection actions through existing callbacks.
7. Replace old transcript rendering with assistant-ui Thread shell incrementally:
   - first persisted + streaming text;
   - then presentation blocks;
   - then sources/tool calls;
   - finally delete old markdown/parser code.
8. Add media forward-compat contracts only:
   - types, README, renderer comment, skipped fixture;
   - no image UI implementation.
9. Wire bundle budget and fixture tests in CI.
10. Produce `docs/migration/MIGRATION-REPORT.md` with final evidence.

## Backend Compatibility Decision

Decision: write an adapter, do not use `DefaultChatTransport` directly.

Why:

- Runa backend is a WebSocket runtime, not `/api/chat`.
- Runa server emits custom `WebSocketServerBridgeMessage` union, not AI SDK v6 UIMessage stream chunks.
- Existing auth/session/persistence/approval/inspection behavior is already encoded around `/ws` and `/conversations`.
- User explicitly requested not to break existing features; backend rewrite is unnecessary for UI stack migration.

Adapter acceptance criteria:

| Requirement | Done signal |
|---|---|
| Existing chat submit still uses `/ws` | `run.request` sent with same payload shape |
| Streaming text renders via Streamdown | `text.delta` accumulates without layout flicker |
| Persisted history renders via Streamdown | `/conversations/:id/messages` still loads |
| Tool/search/presentation blocks preserved | `presentation.blocks` render through new registry or compatible adapter |
| Approval/inspection actions preserved | current callbacks still reach `approval.resolve` / `inspection.request` |
| Network cut UX centralized | retry/copy comes from transport error catalog |

## Test And CI Plan

| Area | Command / Check |
|---|---|
| Package install | `pnpm install --frozen-lockfile` in CI |
| Typecheck | `pnpm typecheck` |
| Lint | `pnpm lint` with 0 errors/warnings where Biome supports warning-free output |
| Unit/fixtures | `pnpm --filter @runa/web test` including Streamdown fixtures |
| Root tests | `pnpm test` |
| Build | `pnpm build` |
| Bundle budget | build output + gzip initial JS <350 KB |
| E2E smoke | existing `pnpm test:e2e` |
| Manual smoke | chat route markdown/code/math/table/citation + network cut + 390px viewport |

Potential test config change: current web Vitest environment is `node`; React Testing Library fixtures need `jsdom`. Add either a dedicated fixture config or switch web tests carefully after checking existing tests.

## Risks

| Risk | Mitigation |
|---|---|
| Dirty worktree ownership unclear | Plan commit stages only this file; migration waits for review/confirmation |
| UI Overhaul CSS policy conflict | Explicit decision: production-lock stack supersedes "no Tailwind" for shadcn/ai-elements, while Runa tokens remain source of truth |
| Adapter double state | Keep existing `useChatRuntime` as transport owner until assistant-ui rendering is proven |
| Bundle regression from shadcn/Tailwind/Mermaid/Shiki | Reuse spike lazy abstractions and CI budget |
| KaTeX false-positive rendering | Add `.katex` DOM fixture test and screenshot evidence |
| Tool input partial state crash | Guard ai-elements Tool input/output states and fixture it |
| Existing approval/inspection regression | Do not replace action callbacks; wrap rendering only first |
| Conversation persistence drift | Keep `/conversations` as source of persisted history |
| React 19 generated component warnings | Use folder-level lint override only for generated ai-elements when strictly needed |
| Mobile regressions | Re-run UI-OVERHAUL-05 viewport matrix after Thread shell replacement |

## Review Questions Before Implementation

1. Should the existing dirty migration-like changes in the working tree be adopted as the starting point, or should migration be replayed cleanly from committed `HEAD`?
2. Is it acceptable that production-lock stack supersedes UI-OVERHAUL-02/03's "no Tailwind" rule for shadcn/ai-elements?
3. Should assistant-ui become only the render shell for now, while `useChatRuntime` remains the authoritative transport/session state owner?

