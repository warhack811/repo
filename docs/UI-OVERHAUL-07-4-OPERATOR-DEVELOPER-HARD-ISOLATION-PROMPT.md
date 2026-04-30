# UI-OVERHAUL-07.4 - Operator/Developer Hard Isolation Implementation Prompt

## Source Of Truth

- Primary plan: `docs/UI-OVERHAUL-07.md`, section `7.4 - Operator/Developer Hard Isolation`
- Previous completed scope: `docs/PROGRESS.md`, sections for `UI Overhaul 07.2`, `UI Overhaul 07.3`, and `07.3 Follow-up`
- Current route shell: `apps/web/src/AuthenticatedApp.tsx`
- Current app navigation: `apps/web/src/components/app/AppNav.tsx`
- Current shell copy/page mapping: `apps/web/src/components/app/AppShell.tsx`
- Current developer flag hook: `apps/web/src/hooks/useDeveloperMode.ts`
- Current account/settings surface: `apps/web/src/pages/SettingsPage.tsx`
- Current developer route surface: `apps/web/src/pages/DeveloperPage.tsx`
- Current capability QA surface: `apps/web/src/pages/CapabilityPreviewPage.tsx`
- Current chat developer-dependent surface: `apps/web/src/pages/ChatPage.tsx`, `apps/web/src/components/chat/ChatComposerSurface.tsx`

## Current Verified Facts

- `docs/UI-OVERHAUL-07.md` defines real `7.4` as `Operator/Developer Hard Isolation`.
- `AppNav.tsx` currently exposes normal nav items for chat, history, devices, and account. It still keeps `developer` in the `AuthenticatedPageId` type.
- `AuthenticatedApp.tsx` currently resolves `/developer*` to active page `developer` and gates `/developer` behind `useDeveloperMode`.
- `useDeveloperMode.ts` stores the flag in browser localStorage key `runa_dev_mode`.
- `SettingsPage.tsx` currently defines hidden-but-renderable tab branches for `developer`, `devices`, and `memory`, while the visible `tabs` array only includes `account` and `preferences`.
- `CapabilityPreviewPage.tsx` is already a developer-mode-gated internal visual QA page, but its disabled state includes an `Enable Developer Mode` button.
- `ChatPage.tsx` still carries developer-mode state and renders developer-only runtime timeline/debug surfaces only when `isDeveloperMode` is true.
- `ChatComposerSurface.tsx` can render developer setup controls only when `showDeveloperControls` is true.

Do not treat the facts above as proof that the task is complete. They are the starting map for implementation.

## Goal

Make a clean normal user session unable to discover, enter, or enable developer/operator surfaces from the primary product UI.

Normal user surfaces must not show:

- developer/operator nav entries,
- account developer tab or developer enable controls,
- capability preview entry points,
- raw transport/debug/runtime troubleshooting controls,
- placeholder identities such as `dev@runa.local`,
- status/operator badges that explain internal runtime mechanics instead of product state.

Developer and capability QA surfaces may remain in the codebase, but only behind an explicit dev-mode mechanism that is not advertised or activatable from normal user flows.

## Non-Negotiables

- Do not remove server/runtime/debug capability from the codebase if it is still needed for development.
- Do not change auth, WebSocket, provider, approval, persistence, or desktop-agent contracts.
- Do not invent a new role/permission system unless the current code already exposes one and you verify it.
- Do not add a new dependency.
- Do not move this into 7.5 secondary-surface redesign, 7.6 visual discipline, or 7.7 copy voice pass.
- Do not claim `/developer*` is protected unless a browser-level route test proves a clean normal session is redirected away.
- Do not claim Capability Preview is hidden unless it has no normal nav/user-flow entry and a clean session cannot enable it from the preview page itself.

## Implementation Plan

1. Baseline the current leak map.
   - Search `apps/web/src` for `developer`, `Developer Mode`, `operator`, `CapabilityPreview`, `capability-preview`, `dev@runa.local`, `Raw Transport`, `stored token`, `bearer token`, and status/debug badge copy.
   - Classify each hit as either allowed internal code, normal user leak, or test/documentation.

2. Make developer mode explicit and non-self-service from normal UI.
   - Keep `useDeveloperMode` as the central flag unless a better existing project mechanism is verified.
   - Remove any normal user control that turns developer mode on.
   - `/developer*` should redirect to `/chat` or another normal surface when `runa_dev_mode` is not already explicitly enabled.
   - Capability Preview must not offer a button that enables Developer Mode from a clean session.

3. Remove normal user entry points.
   - Ensure `AppNav` has no Developer item.
   - Ensure account/settings visible tabs do not include developer controls.
   - Remove dead or unreachable developer tab branches from `SettingsPage.tsx` if they are not needed.
   - Keep `/developer/capability-preview` as internal QA only, behind the same explicit dev-mode gate.

4. Isolate chat developer/operator state.
   - Keep developer-only `RunTimelinePanel`, raw transport blocks, correlation labels, and developer composer controls gated by `isDeveloperMode`.
   - Verify normal chat does not render `Developer Mode`, `operator`, raw transport, correlation ids, runtime phase copy, or debug counters.
   - If developer-only imports increase normal-route bundle cost, defer bundle optimization unless a direct leak or test failure requires it.

5. Clean placeholder/user-facing copy.
   - Remove or hide `dev@runa.local` and similar placeholder identities from normal surfaces if present.
   - Keep technical copy in developer-only surfaces.
   - Do not rewrite unrelated secondary surfaces beyond leak removal.

6. Add focused tests.
   - Unit/component tests should assert normal app nav and account/settings do not expose Developer Mode.
   - Route/browser test should prove a clean session cannot enter `/developer` or `/developer/capability-preview` without the explicit dev-mode flag.
   - If existing visual smoke tests cover chat/account/devices/history, extend them with text assertions for no normal-surface developer/operator leaks.

7. Verify.
   - Run `pnpm.cmd --filter @runa/web test`
   - Run `pnpm.cmd --filter @runa/web typecheck`
   - Run `pnpm.cmd --filter @runa/web lint`
   - Run `pnpm.cmd run style:check`
   - Run `pnpm.cmd run manifesto:check`
   - Run the smallest relevant Playwright route/smoke spec that proves `/developer*` redirect and normal nav isolation. If a new spec is added, run that spec directly.

8. Document honestly.
   - Add a `docs/PROGRESS.md` entry only after implementation and verification.
   - Record exact commands and pass/fail results.
   - Record any remaining allowed developer strings that exist only in internal routes/tests.

## Likely Files To Edit

- `apps/web/src/AuthenticatedApp.tsx`
- `apps/web/src/components/app/AppNav.tsx`
- `apps/web/src/components/app/AppShell.tsx`
- `apps/web/src/pages/SettingsPage.tsx`
- `apps/web/src/pages/CapabilityPreviewPage.tsx`
- `apps/web/src/pages/ChatPage.tsx`
- `apps/web/src/components/chat/ChatComposerSurface.tsx`
- `apps/web/src/localization/copy.ts`
- Focused tests under `apps/web/src/**/*.test.tsx` and/or `apps/web/tests/visual/*.spec.ts`
- `docs/PROGRESS.md` after verified implementation

This list is not permission to edit every file. Edit only files proven necessary by the leak map.

## Files/Areas To Avoid Unless A Verified Bug Requires Them

- `apps/server/**`
- `apps/desktop-agent/**`
- `packages/**`
- WebSocket message types and approval/runtime state machine code
- Provider configuration semantics
- New auth or permission backends
- Broad secondary surface redesign for history/devices/account
- Full color/type/radius design pass

## Done Criteria

- A clean normal session sees no developer/operator nav entry.
- Account/settings has no visible Developer tab, Developer Mode toggle, or link to `/developer`.
- `/developer` redirects away or otherwise denies normal access when explicit dev mode is not already enabled.
- `/developer/capability-preview` is not reachable from normal flow and cannot self-enable Developer Mode from its own disabled state.
- Normal chat surface does not show developer/operator/debug language or raw runtime metadata.
- Developer-only tooling remains available when the explicit dev-mode flag is already enabled.
- All verification commands listed above pass, or failures are reported with exact command output and no fake pass claim.
