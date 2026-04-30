# Runa Design Language

This document locks the user-facing UI discipline after UI-OVERHAUL-07. It is a working checklist, not a brand manifesto. Use it before adding or changing normal product surfaces.

## Product Feel

Runa is calm, dark, chat-first, and trust-first. It should feel like a reliable AI work partner that knows the current work, asks before risky steps, and keeps technical machinery out of the normal user flow.

Normal users should understand what to do next from the interface itself. They should not need to read implementation strategy, runtime status, transport details, or debugging vocabulary.

## Surface Hierarchy

- Chat is the primary surface. Work starts and returns there.
- The composer is the main action anchor. It stays simple: message, attach, tools, send.
- Approval is the trust boundary. It explains the requested action, target when known, risk, and the user decision.
- History, Devices, and Account are secondary surfaces. They are quiet, scannable, and task-specific.
- Developer and internal QA surfaces are isolated. They do not appear in normal navigation or normal account settings.

## Layout Rules

- Keep the chat column readable and centered. Avoid turning the main chat into a stack of framed panels.
- Keep the composer bottom/sticky where the route needs it, with safe-area clearance on mobile.
- App shell headers should orient the user, not consume the first viewport.
- Top navigation intentionally uses compact route tiles, not flat competitor tabs. The tiles give each core surface a visible affordance while keeping chat as the first return point. Keep them light, one row on mobile, and never turn them into marketing cards.
- Mobile app nav stays one horizontal row.
- Do not create card-inside-card patterns. Use cards for repeated items, modals, and genuinely framed tools only.
- Page sections should be unframed layouts or full-width bands with constrained inner content.

## Color & Tone

- Dark base, muted surfaces, low-contrast borders, and one flat accent are the default.
- Primary actions use flat accent color, not gradients.
- Approval actions are risk-aware. Low-risk read-only approvals may use the primary accent; file writes, shell commands, screen capture, and unknown tools use calmer secondary confirmation styling so "approve" does not look like the same action as "send" or "sign in".
- Status color is semantic and sparse: success, warning, danger, info.
- Do not add decorative gradient orbs, bokeh, ambient blobs, or ornamental SVG backgrounds.
- Borders separate meaningfully; they should not make every area feel like a container.

## Typography

- User-facing CSS stays on the established scale: `12 / 14 / 16 / 20 / 28`.
- Font weights stay within `400 / 500 / 600`.
- Letter spacing is `0` by default. Small uppercase eyebrow labels may keep the existing established spacing.
- Use hero-scale type only for true hero contexts. Compact panels and tool surfaces need compact headings.
- Text must wrap or truncate intentionally; it must not overlap controls or overflow mobile widths.

## Motion & Microinteraction

- Motion is short, calm, and functional.
- `prefers-reduced-motion` must be respected.
- Hover is a mouse enhancement only. It does not replace focus-visible.
- Focus-visible must be clear but not aggressive.
- Active and pressed states should feel native and restrained.
- Expanded, collapsed, selected, current, disabled, and loading states need distinct visual treatment.

## Loading

- Use skeletons for route-level and content-level waiting.
- Keep spinners for small inline work only.
- Skeleton dimensions should resemble the final content to avoid layout shift.
- Loading copy is short and Turkish. It must not expose runtime, transport, auth internals, or debug details.

## Accessibility & Keyboard

- `Cmd+K` on macOS and `Ctrl+K` on Windows/Linux opens the command palette.
- Escape closes overlays, sheets, drawers, details panels, and the command palette when applicable.
- Tab order follows visual order.
- Enter and Space keep native button behavior.
- Icon-only controls must have an accessible name.
- Route navigation uses links or router navigation, not clickable divs.
- Dialogs and modal surfaces restore focus where possible.

## Mobile Rules

- Use `100dvh` and safe-area insets for mobile viewport-sensitive layout.
- Check `320`, `390`, and `414` pixel widths before shipping chat, nav, composer, or sheet changes.
- Composer controls must remain reachable when the textarea is focused.
- Bottom nav and composer must not cover approval actions.
- Long placeholders, upload text, voice status, attachment previews, and command labels must wrap or truncate cleanly.

## Copy Voice

Runa speaks in short, calm, inviting Turkish. Copy should describe the next useful action, not the UI strategy.

Avoid:

- self-narration such as "burada kalir", "burada gorunur", "bu fazda",
- internal terms such as "developer", "operator", "runtime", "transport", "raw", "debug", "troubleshooting", "metadata",
- implementation names such as "Web Speech API", raw tool names, raw connection ids, or capability preview language,
- mixed Turkish/English on normal user surfaces.

Developer-only routes and internal QA tools may use technical language, but that language must not leak into normal navigation, chat, history, devices, account, or command palette surfaces.

## Checklist For Future UI Tasks

Before editing:

- Read the local component and route CSS pattern first.
- Decide whether the change affects chat, approval, secondary surfaces, or internal tooling.
- Keep unrelated refactors out.

Before finishing:

- Check normal routes for forbidden internal copy.
- Check mobile widths `320`, `390`, and `414` when layout or composer behavior changes.
- Check keyboard flow: Tab, Escape, Enter, Arrow keys where relevant.
- Check icon-only controls for accessible names.
- Prefer skeletons over route/content spinners.
- Keep colors, type, radius, and motion within the locked scale.

Required proof for risky UI changes:

- Unit or render guardrail for copy/structure.
- Targeted Playwright smoke for route, mobile, or keyboard behavior.
- Screenshot evidence when visual hierarchy, mobile layout, or approval/composer behavior changes.
- `pnpm --filter @runa/web lint`
- `pnpm --filter @runa/web test`
- `pnpm --filter @runa/web typecheck`
