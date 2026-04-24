# UI Foundation Phase 10 Smoke Review - 2026-04-24

## Scope

Report-only manual/browser smoke for UI Foundation Phase 1-9 after PR #3. No runtime, UI logic, server, package, lockfile, desktop-agent, or shared package source changes were made.

PR #3 precondition was checked against `origin/main` because the original checkout at `D:\ai\Runa` was dirty and `git checkout main` could not complete without overwriting local `PROGRESS.md` changes. `origin/main` includes `88b710f Merge pull request #3 from warhack811/ui-inspection-action-detail-adapter` and `5294287 Add inspection action detail modal adapter`.

## Environment

- Date: 2026-04-24
- Smoke worktree: `D:\ai\Runa-ui-smoke`
- Branch: `ui-foundation-smoke-review`
- Base commit: `88b710f`
- Node: `v24.14.1`
- pnpm: `9.15.4`
- Web dev server: `http://localhost:5173`
- Server dev process: `http://127.0.0.1:3000`
- Browser automation: Playwright inline script. `agent-browser` CLI was not installed on this machine.
- Screenshots were written outside the repo at `D:\ai\runa-ui-smoke-screenshots\2026-04-24-phase-10`.

## Commands Run

- `git status --short` in original worktree: pre-existing dirty tree with `PROGRESS.md`, deleted prompt/roadmap docs, and `apps/desktop-agent/src/auth.ts` / `apps/desktop-agent/src/launch-controller.ts`.
- `git checkout main`: blocked by dirty `PROGRESS.md`.
- `git pull`: fetched `origin/main`.
- `git log origin/main --oneline -15`: confirmed PR #3 merge and `Add inspection action detail modal adapter`.
- `git worktree add -b ui-foundation-smoke-review ..\Runa-ui-smoke origin/main`: PASS.
- `pnpm.cmd install --frozen-lockfile`: PASS; lockfile unchanged.
- `pnpm.cmd --filter @runa/types build`: PASS.
- `pnpm.cmd --filter @runa/web typecheck`: PASS.
- `pnpm.cmd --filter @runa/web build`: PASS.
- `pnpm.cmd --filter @runa/web dev -- --host 127.0.0.1 --port 5173 --strictPort`: Vite available at `http://localhost:5173`.
- `pnpm.cmd --filter @runa/server dev`: first start failed because `@runa/db/dist/index.js` was missing.
- `pnpm.cmd --filter @runa/db build`: PASS, used only to create local build artifacts for server smoke.
- `pnpm.cmd --filter @runa/server dev`: PASS after db build; server listened on `127.0.0.1:3000`.
- `agent-browser --version`: failed, command not found.
- Playwright inline route/viewport smoke: PASS with findings below.
- `rg -n <requested mojibake pattern> apps/web/src PROGRESS.md`: no matches.
- `rg -n "kapali|gecmis|calismalar|Ihtiyac|oldugunda|icinden|acabilirsin|henuz|kalici|gonderdiginde|gorunecek|paylas|basarisiz|guncelle|yukleniyor|Kaldir|Secilen|dusunuyor|yuzeyi|hazirliyor" apps/web/src/components/chat apps/web/src/pages apps/web/src/localization`: found user-visible ASCII Turkish candidates.

## Routes Checked

- `/`: opened login/bootstrap surface, then local dev auth button reached authenticated shell.
- `/chat`: opened authenticated chat surface.
- `/developer`: opened Developer Mode route.
- `/dashboard`: redirected to `/chat`.
- `/settings`: redirected to `/account`.
- `/account`: opened account route.

## Viewports Checked

- `1440x900`: chat surface rendered, textarea usable, submit button enabled, no horizontal body overflow.
- `1024x768`: chat surface rendered, textarea usable, submit button enabled, no horizontal body overflow.
- `390x844`: chat surface rendered, textarea usable, submit button enabled, no horizontal body overflow.

## Screenshots / Visual Notes

- `D:\ai\runa-ui-smoke-screenshots\2026-04-24-phase-10\chat-1440x900.png`
- `D:\ai\runa-ui-smoke-screenshots\2026-04-24-phase-10\chat-1024x768.png`
- `D:\ai\runa-ui-smoke-screenshots\2026-04-24-phase-10\chat-390x844.png`
- `D:\ai\runa-ui-smoke-screenshots\2026-04-24-phase-10\route-developer-1440.png`
- `D:\ai\runa-ui-smoke-screenshots\2026-04-24-phase-10\route-settings-1440.png`

The core layout is not blank and does not horizontally overflow in the checked widths. The chat composer is usable and the mobile layout stacks cleanly. Visual first impression is still harmed by visible endpoint failures and mixed copy quality on the primary chat surface.

## Interaction Checks

- Local dev auth: PASS. The login surface exposed the local dev session button and reached the authenticated app shell.
- Textarea: PASS in all checked viewports.
- Submit state: enabled in all checked viewports after local dev auth, label `Gonder`.
- Attachment row: visible and stable; no upload was performed.
- Voice controls: visible; no microphone permission flow was exercised.
- Conversation sidebar: visible, but shows a 404 error.
- Developer route: available; Developer Mode toggle remained off by default.
- Legacy redirects: `/dashboard -> /chat`, `/settings -> /account` both worked.
- Presentation/capability data surfaces: not available without live run/presentation data. No fixture or temporary harness was added.
- Inspection action detail modal: not browser-smoked because no inspection action button was present without live presentation data.
- ActionDetailModal / AssetModal: code-level inspection only in this task; no existing permanent story/harness was present.

## Copy / Encoding Checks

- Mojibake scan: no matches in `apps/web/src` or `PROGRESS.md`.
- Targeted ASCII Turkish scan found user-visible strings including:
  - `Baglanti kapali`
  - `Gecmis calismalar`
  - `Developer Mode kapali`
  - `Upload basarisiz oldu.`
- Browser screenshots also show half-ASCII user-visible copy on the main chat surface, for example `CALISMA ORTAGI`, `KIMLIGI DOGRULANMIS OTURUM`, `Gonder`, `Masaustu hedefi`, and `Istersen sonraki istegi acik...`.
- English technical terms such as `Developer Mode`, `Conversation`, `Attachments`, and `Run` were not counted as encoding defects.

## Findings

### Blockers

- Browser console reports `Maximum update depth exceeded` while route cycling through authenticated `/chat`, `/settings`, and `/account`. The UI still renders, but this is a React render-loop warning on core authenticated surfaces and should block release-quality acceptance until isolated.

### High Priority

- Authenticated chat shell requests `GET /conversations` and receives 404. This is visible in the first-run chat surface as `Conversation request failed with status 404.`
- Authenticated chat shell requests `GET /desktop/devices` and receives 404. The UI degrades gracefully, but the browser console records repeated 404 resource errors and the desktop target area cannot verify a normal empty-device state.
- Main chat surface has visible half-ASCII Turkish copy in new/foundation-adjacent UI text. This violates the Phase 10 copy smoke requirement even though mojibake was not found.

### Medium Priority

- Modal smoke could not be completed from the current app state because no live presentation/capability surface existed and no permanent story/harness was available. The modal foundations remain code-inspected but not visually verified in browser.
- The authenticated first viewport still spends substantial space on app-shell hero/navigation before the composer. This is not a regression proof by itself, but it weakens the chat-first first impression.

### Low Priority

- `agent-browser` CLI was unavailable, so Playwright inline automation was used instead.
- Server dev needed `pnpm.cmd --filter @runa/db build` before it could start. This was build-artifact setup, not a source change.

## Recommendation

Do not accept Phase 1-9 UI foundation as release-polished yet. The report-only branch should merge as QA evidence, then the next patch should isolate the React maximum update depth warning and the `/conversations` / `/desktop/devices` 404 behavior before doing copy polish.

## Follow-up Tasks

1. Fix the authenticated React maximum update depth warning with a narrow route-smoke repro.
2. Fix or intentionally normalize `/conversations` and `/desktop/devices` empty/dev responses so the first chat surface does not show 404 errors.
3. Run a copy-only patch for visible ASCII Turkish in `apps/web/src/localization/copy.ts`, `DashboardPage.tsx`, `FileUploadButton.tsx`, and related chat labels.
4. Add a permanent, dependency-free visual route/story only if the team wants modal smoke for capability foundations without live provider data.
