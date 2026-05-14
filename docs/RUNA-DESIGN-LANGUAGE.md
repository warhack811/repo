# RUNA Design Language (Post UI-Restructure PR-1 to PR-8)

Last updated: 2026-05-14
Status: Source of truth for web UI after UI restructure completion.

## Scope and Authority

This document is the single-page UI contract for the Runa web surface after PR-8.
Implementation details live in the PR briefs and code. This page defines the final user-facing language.

Reference briefs:
- `docs/design/ui-restructure/PR-1-CODEX-BRIEF.md`
- `docs/design/ui-restructure/PR-2-CODEX-BRIEF.md`
- `docs/design/ui-restructure/PR-3-CODEX-BRIEF.md`
- `docs/design/ui-restructure/PR-4-CODEX-BRIEF.md`
- `docs/design/ui-restructure/PR-5-CODEX-BRIEF.md`
- `docs/design/ui-restructure/PR-6-CODEX-BRIEF.md`
- `docs/design/ui-restructure/PR-7-CODEX-BRIEF.md`
- `docs/design/ui-restructure/PR-8-CODEX-BRIEF.md`

## Surface Model

Primary model:
- Left conversation sidebar
- Central chat column
- Bottom composer
- Optional overlays (sheet, modal, command palette)

No persistent right rail is allowed in normal chat flow.

## Card Discipline

- Card-in-card patterns are disallowed.
- The only explicit exception is the approval card, where risk and decision controls must stay visually grouped.
- Supporting information should prefer lightweight separators, inline sections, or subtle surfaces over nested framed panels.

## Message and Activity Rules

- Do not show per-message clock timestamps in the normal transcript flow.
- Keep day separators for chronology.
- Tool activity uses one summary line plus an expand/collapse chevron.

## Approval Language and Risk

Approval UI must map to three risk levels:
- Low risk
- Medium risk
- High risk

Button treatment must stay risk-aware and visually distinct from standard send/confirm actions.

## Server Contract Dependency

Frontend must consume server-provided Turkish user labels through `user_label_tr` and should not hardcode alternative labels where server contract exists.

## Settings Information Architecture

Settings is organized into 5 tabs:
- **appearance** - Theme, brand palette, typography preference
- **conversation** - Approval mode, voice defaults, runtime preferences
- **notifications** - Language, quiet hours, data retention
- **privacy** - Active root, working directory, directory refresh controls
- **advanced** - Advanced view toggle and developer-oriented options

The original PR-7 3-tab plan was expanded to 5 tabs. This section is the authority for Settings IA.

## Mobile and Keyboard Behavior

- Composer must remain reachable with safe-area aware spacing.
- On iOS Safari and Android Chrome, keyboard-open behavior must keep composer visible.
- `useVisualViewport` drives `--keyboard-offset` and composer compensation.

## Accessibility Contract

Required baseline:
- Skip link exists and targets `#main-content`.
- A visible, tokenized focus indicator is applied through global `*:focus-visible` rule.
- Interactive controls are keyboard reachable and have accessible names.
- Landmark structure remains present (`header`, `nav`, `main`, etc.).

## Motion Contract

- `prefers-reduced-motion` must be honored globally.
- `animations.css` provides `.respect-reduced-motion` helper.
- `.force-motion` exists for rare, explicit opt-out cases.
- Every `*.module.css` file includes a reduced-motion media query marker.

## Visual Tokens and Rhythm

- Use tokenized surfaces, text, borders, spacing, and motion from `apps/web/src/styles/tokens.css`.
- Focus ring token pair is mandatory:
  - `--focus-ring`
  - `--focus-ring-offset`
- New UI work should extend tokens first, then components.

## QA and Lighthouse Gate

Minimum mobile Lighthouse targets for this phase closure:
- Performance >= 85
- Accessibility >= 95
- Best Practices >= 90

PR-8 closes the UI restructure only when these gates are met together with lint/typecheck/test/build pass.

