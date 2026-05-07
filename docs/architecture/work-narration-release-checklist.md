# Work Narration Release Checklist

## Functional

- [x] Supported provider narration works through runtime events and WS messages.
- [x] Unsupported provider fallback remains legacy `text.delta`.
- [x] Final answer text is separate from narration.
- [x] Tool failure state maps to `tool_failed`.
- [x] Replay/F5 returns persisted narration blocks.
- [x] Superseded blocks are hidden/collapsed by the UI.
- [x] Duplicate prevention uses `id === narration_id`.

## Safety

- [x] `reasoning_content` is not user-visible.
- [x] `internal_reasoning` is redacted in logs.
- [x] Tool output is not quoted in narration.
- [x] High-confidence fallthrough is blocked.
- [x] Prompt does not request chain-of-thought.
- [x] Raw HTML is not rendered by the narration UI.

## Provider

- [x] Claude `native_blocks` is gated on.
- [x] OpenAI `temporal_stream` is gated on.
- [x] DeepSeek `temporal_stream` is gated on.
- [x] Gemini/Groq/SambaNova `unsupported` are gated off.
- [x] `synthetic_non_streaming` ordering suppresses narration emission.

## Persistence

- [x] Finalize-time persistence writes `work_narration` blocks.
- [x] Reload endpoint returns the persisted block shape.
- [x] Incremental persistence is deferred with race-safety rationale.

## UX

- [x] Mobile-friendly muted companion style.
- [x] No technical ids shown.
- [x] Replay is visually faded.
- [x] `tool_failed` is muted/warning-styled without duplicating error text.

## Tests

- [x] `pnpm.cmd typecheck`
- [x] Focused server narration, persistence, reload, and streaming tests
- [x] Focused web replay tests
- [x] Streaming regression
- [x] Replay regression
- [x] Redaction tests
- [x] Scoped Biome check

Final command evidence is recorded in the Faz 6 report.
