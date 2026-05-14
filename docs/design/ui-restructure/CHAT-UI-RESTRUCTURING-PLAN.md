# Runa Frontend Restructuring Plan (May 2026)

## Goal
Transform Runa into a calm, consumer-grade AI work companion comparable to Claude Cowork and Codex. The current UI leaks technical runtime details into the main chat, suffers from card-in-card nesting, and lacks clear surface boundaries. This plan outlines a phased approach to achieve a premium, simple, and emotionally calm interaction discipline.

---

## 1. Current UI Architecture Map

Based on an inspection of `apps/web/src/components/chat/`:

1. **Main Chat Messages:** Rendered by `CurrentRunSurface.tsx`, which wraps `PersistedTranscript.tsx` (historical messages) and `StreamingMessageSurface.tsx` (active stream). These utilize `@assistant-ui/react` primitives (`ThreadPrimitive`) and `StreamdownMessage.tsx`.
2. **Tool Activity / Run Progress:** Handled primarily by `RunProgressPanel.tsx`, which delegates to `ThinkingBlock.tsx` and `ToolActivityIndicator.tsx`. `RunStatusChips.tsx` is used for technical phases.
3. **Approval Cards:** Rendered by `blocks/ApprovalBlock.tsx`.
4. **Right Rail / Context:** Managed by `ChatLayout.tsx` via the `insights` slot, populated by components like `WorkInsightPanel.tsx`. The left sidebar is `ConversationSidebar.tsx`.
5. **Desktop vs Mobile Layout:** Controlled centrally by `ChatLayout.tsx` (CSS grid/flex toggles based on media queries) and `ChatShell.tsx` which wraps the workspace in `RunaSurface`.
6. **Duplicate Agent-Run Info:** Found between `RunProgressPanel.tsx` (verbose headline/detail paragraphs) and `CurrentRunSurface.tsx`. Also, `ApprovalBlock.tsx` duplicates raw tool names and "Runa wants to..." intents across multiple nested `div`s.
7. **Raw Developer/Debug Leaks:** 
   - `RunProgressPanel.tsx` leaks `meta_items` and `phase_items` via `RunStatusChips` and explicit "Current surface context" text. 
   - `ToolActivityIndicator.tsx` leaks raw string statuses (`active`, `completed`, `failed`).
8. **CSS Card-in-Card Nesting:** Rampant in `ApprovalBlock.tsx` (5 levels: Header, Decision, State Feedback, Actions, MetaGrid) and exacerbated by `RunaSurface` boundaries within `ChatShell.tsx`.
9. **Mobile Layout Overlap:** `ChatComposerSurface.tsx` uses a `<details>` overlay (`moreTools`) and sticky/absolute positioning that competes with the `ChatLayout.tsx` viewport and mobile bottom navigation, causing clipping and overlap on smaller viewports.

---

## 2. Problem Areas

| Component / File | Problem |
| :--- | :--- |
| `RunProgressPanel.tsx` | Verbose 35-word fallback paragraphs. Lacks a compact mode. Developer-only gates hide core UX like `ThinkingBlock` from regular users. |
| `ToolActivityIndicator.tsx` | Uses literal English strings (`"active"`, `"completed"`) instead of calm, animated UI indicators. |
| `ApprovalBlock.tsx` | 5-layered nesting (`.approvalDecision`, `.approvalActions`, etc.) creating massive vertical height. Violates "More single flow, less panel stack". |
| `ChatComposerSurface.tsx` | The `.moreTools` dropdown and heavy prompt actions push content off-screen on mobile, causing overlaps with the bottom edge. |
| `CurrentRunSurface.tsx` | No clear chat bubbles (`PersistedTranscript` looks like a flat log). |

---

## 3. Proposed New Surface Model

The UI will be restructured into distinct, non-overlapping surfaces:

- **Main Chat:** Single-column narrative. Strict chat bubble typography (User vs Assistant). No diagnostic panels, no heavy borders. Generous whitespace.
- **Activity Summary (Slim):** Replaces `RunProgressPanel`. A single, collapsible `ThinkingBlock` (e.g., "Thinking... (4 steps)"). Auto-collapses on completion.
- **Approvals (Calm):** Single-line question ("Runa wants to read App.tsx") + 2 inline buttons (Approve/Reject). Details hidden under a native disclosure element.
- **Right Rail / Developer Mode:** All `meta_items`, `phase_items`, payload debugging, and network lifecycle events move strictly to the right rail or a bottom sheet. They do not render inline in the chat.
- **Mobile Sheets:** Composer secondary actions (file upload, voice, target selection) move to native mobile bottom sheets instead of inline dropdowns to prevent layout overlap.

---

## 4. UI Rules & Interaction Discipline

### Allowed in Main Chat (Default)
- User messages.
- Assistant final responses (markdown, code blocks).
- Slim, single-line tool activity indicators (auto-collapsing).
- Flat, 2-button approval requests.
- Lightweight artifacts (e.g., small images or inline code diffs ≤ 8 lines).

### Hidden (Moved to Details, Right Rail, or Dev Mode)
- Full prompt text, context payload, system instructions.
- Raw tool names (`file.read`, `desktop.screenshot`) and `call_id`s.
- `RunStatusChips`, `meta_items`, phase transitions.
- Large code artifacts (> 8 lines must be collapsed by default).
- Error stack traces (show a friendly toast instead).

---

## 5. Phased PR Plan

To ensure reviewable, safe diffs without regressions, implementation will follow these phases:

### PR 1: The "Calm Chat" Foundation
- **Goal:** Clean up the main chat transcript layout and remove raw strings.
- **Changes:** Add bubble styling to `PersistedTranscript`. Replace literal strings in `ToolActivityIndicator` with Lucide icons (Loader2, Check, X). Remove verbose fallback paragraphs in `RunProgressPanel`.
- **Acceptance:** Chat looks like a modern messenger. Tool activities are minimal icons + localized text.

### PR 2: Flat Approvals
- **Goal:** Destroy the card-in-card nesting for approvals.
- **Changes:** Refactor `ApprovalBlock.tsx` and its CSS module. Remove grid layouts. Convert to a single-line question with inline primary/secondary buttons. Hide metadata in a `RunaDisclosure`.
- **Acceptance:** Approval cards take up < 15% of vertical screen space on mobile. No nested borders.

### PR 3: Slim Activity & Thinking Isolation
- **Goal:** Bring `ThinkingBlock` to users, safely.
- **Changes:** Remove `isDeveloperMode` gate from `ThinkingBlock` in `RunProgressPanel`. Make it auto-collapse on run completion. Move `RunStatusChips` strictly to the right rail / developer view.
- **Acceptance:** Users see animated reasoning steps, but they take up minimal space and disappear when done. No technical tags visible.

### PR 4: Mobile Layout & Composer Cleanup
- **Goal:** Fix overlapping and responsive issues.
- **Changes:** Refactor `ChatComposerSurface.tsx`. Move `.moreTools` into a standard bottom sheet for mobile viewports. Adjust `ChatLayout` grid to ensure the composer sits above the safe area inset.
- **Acceptance:** Mobile view is clean; typing doesn't obscure the latest message; secondary tools open as an overlay sheet.

---

## 6. Risks & Regression Areas

- **Persistence Regression:** Removing `RunProgressPanel` state might interact poorly with `useChatRuntime`'s memoization loop. Ensure we don't break the WS state parsing.
- **Mobile Safari Keyboard:** Moving the composer around can trigger iOS Safari's infamous keyboard overlap bugs. Must use `dvh` and safe-area-insets rigorously.
- **Developer Blindness:** Moving logs to the right rail might frustrate power users if the rail state isn't preserved across reloads. 

*(Audit complete. No code changes have been applied yet.)*