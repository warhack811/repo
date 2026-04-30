# UI-OVERHAUL-07 - Approval UX & State Feedback Implementation Prompt

## Source Of Truth

- Primary plan: `docs/UI-OVERHAUL-07.md`
- Progress evidence: `docs/PROGRESS.md`, section `Track C / UI Overhaul 07.3 - Approval UX & State Feedback - 30 Nisan 2026`
- Current implementation: `apps/web/src/components/chat/blocks/ApprovalBlock.tsx`
- Current styles: `apps/web/src/components/chat/blocks/BlockRenderer.module.css`
- Current tests: `apps/web/src/components/chat/blocks/BlockRenderer.test.tsx`, `apps/web/tests/visual/ui-overhaul-07-3-smoke.spec.ts`

Important naming note: in `docs/UI-OVERHAUL-07.md`, `Approval UX & State Feedback` is section `7.3`. Section `7.4` is `Operator/Developer Hard Isolation`. If a request says `07.4 - Approval UX & State Feedback`, keep the title scope as approval UX and do not silently implement operator/developer isolation.

## Goal

Make the approval moment prove Runa's trust-first promise without changing server contracts, WebSocket message shapes, provider behavior, persistence, or desktop-agent code.

The user must be able to understand:

- what Runa wants to do,
- what target or fallback target information is available,
- what risk or attention note applies,
- what decision buttons are available while pending,
- what state the card moved into after a decision.

## Non-Negotiables

- Do not invent target paths, command text, filenames, devices, approval ids, or tool names.
- If `target_label` is missing, empty, or only repeats the tool/action kind, show the existing no-target fallback.
- Keep technical details behind the disclosure.
- Keep pending, approved, rejected, cancelled, and expired visually and semantically distinct.
- Do not add a new dependency.
- Do not change `@runa/types`, server approval logic, runtime state machine, WebSocket contracts, or E2E provider fixtures unless a verified bug requires it.
- Do not open the broader visual discipline, secondary surface, or developer isolation tasks in this pass.

## Implementation Steps

1. Read the source-of-truth files listed above before editing.
2. Verify whether the current chat approval component already satisfies the 7.3 acceptance criteria.
3. Patch only proven gaps in the active chat approval path.
4. If legacy approval components exist outside the active path, remove them only after proving they have no imports.
5. Add focused unit coverage for any semantic/state feedback behavior changed in `ApprovalBlock`.
6. Run at least:
   - `pnpm.cmd --filter @runa/web test`
   - `pnpm.cmd --filter @runa/web typecheck`
   - `pnpm.cmd run style:check`
   - `pnpm.cmd run manifesto:check`
7. Update `docs/PROGRESS.md` only with facts that actually happened in this pass.

## Done Criteria

- Pending approval exposes `Runa sunu yapmak istiyor`, a user-facing action, target/fallback target, risk note, and `Onayla` / `Reddet`.
- Resolved approval states do not show pending decision buttons.
- State feedback is visible and accessible as status feedback.
- Technical metadata remains available only in the disclosure.
- Tests and checks above pass, or any failure is reported with exact command and reason.
