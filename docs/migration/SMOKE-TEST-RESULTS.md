# Runa Production-Lock UI Stack Smoke Results

Date: 2026-05-01
Branch: `feature/ui-stack-production-lock`
Environment: `@runa/web` on `http://localhost:5173/chat`, `@runa/server` on `http://127.0.0.1:3000`
Persistence mode: `DATABASE_TARGET=local` with local PostgreSQL reachable on `127.0.0.1:5432`

## Smoke 3 Scope

Smoke 3 re-ran the three WAIT items from smoke 2 and checked for regression on the already-green gates.

| Scenario | Result | Evidence | Notes |
| --- | --- | --- | --- |
| A. Markdown render | PASS | smoke 2 baseline retained | No code change touched markdown parsing outside Streamdown component overrides. Fixture suite stayed green. |
| B. Code block / Shiki / copy | PASS | `docs/migration/screenshots/smoke-3/B-code-block-shiki-copy-final.png`, `docs/migration/screenshots/smoke-3/B-result.json` | Streamdown now overrides `pre`/`code`, renders `.runa-code-block`, emits `.shiki`, and shows the Turkish `Kopyala` button. Fixture coverage verifies TypeScript, JavaScript, Python, JSON, Bash, and an unknown language fallback. |
| C. Math / KaTeX | PASS | fixture suite | KaTeX fixture stayed green. |
| D. Mermaid | PASS | fixture suite | Mermaid fixture stayed render-safe. |
| E. Web search + citation copy | PASS | `docs/migration/screenshots/smoke-3/E-web-search-sources-turkish-open.png`, `docs/migration/screenshots/smoke-3/E-result-final.json` | Source trigger and expanded panel are fully Turkish: `KAYNAKLAR`, `Web arama sonuçları`, `5 web sonucu gösteriliyor`, `5 kaynak kullanıldı`. No `Web Search Results`, `Showing`, or `sources used` remains in `apps/web/src`. |
| F. Tool call | PASS | smoke 3 E live run | `web.search` rendered as a completed tool result before the source panel. |
| G. Approval flow | PASS | smoke 2 baseline retained | Critical approval gate was already PASS and was not changed. Smoke 3 E also showed the approval panel after web search continuation. |
| H. Streaming behavior | PASS | smoke 3 I live run | Long streaming prompt remained stable until the offline cut. |
| I. Network interruption / retry | PASS | `docs/migration/screenshots/smoke-3/I-network-offline-banner-final.png`, `docs/migration/screenshots/smoke-3/I-network-retry-final.png`, `docs/migration/screenshots/smoke-3/I-result-final.json` | DevTools/Playwright offline now surfaces the Turkish retry banner and button. Retry clears the banner after reconnect. |
| J. Mobile viewport 390px | PASS | smoke 2 baseline retained | No layout code touched the mobile shell. |
| K. Console error/warning | PASS WITH DEV NOISE | smoke 3 browser logs in JSON artifacts | No React/runtime stack trace from the fixes. Vite/dev WS startup noise remains local-dev-only and matches the prior smoke profile. |

## Fix Summary

- Streamdown code rendering now explicitly routes fenced code through the Runa `CodeBlock` override and `PreBlock` marker instead of falling back to Streamdown defaults.
- Shiki initializes the initial language set once and lazy-loads non-initial languages through a shared promise, with visible fallback and `console.error` on highlight failure.
- Code blocks now expose the Turkish copy affordance.
- Transport errors now carry `transportErrorCode` state through the chat runtime, mount a single composer-area retry banner, and respond to browser `offline` events as `network-cut`.
- Remaining English sources copy now comes from `i18n/strings.ts`.

## Validation

```text
pnpm.cmd --filter @runa/web exec vitest run --config ./vitest.config.mjs --configLoader runner src/__fixtures__/messages/message-fixtures.test.tsx src/lib/transport/error-catalog.test.ts src/components/chat/blocks/BlockRenderer.test.tsx --reporter verbose
PASS: 3 files, 14 passed, 1 skipped

pnpm.cmd --filter @runa/web test
PASS: 21 files, 60 passed, 1 skipped

pnpm.cmd --filter @runa/web typecheck
PASS

pnpm.cmd --filter @runa/web lint
PASS

git grep -n "Showing\|Web Search Results\|Used\|sources used" -- apps/web/src
PASS: no matches
```

## Merge Recommendation

**GO**

The smoke 2 blockers are closed, the sources copy issue is closed, and the critical approval gate remains green.
