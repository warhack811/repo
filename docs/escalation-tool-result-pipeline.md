# Tool Result Pipeline Escalation Note

Date: 2026-05-03

## Ambiguity

The task has one conflicting measurement row:

- M2 says RunLayer should include `inline_output` only when the JSON-serialized output is under `INLINE_FULL_THRESHOLD_CHARS` (`8192`), and should omit it with `output_truncated: true` above that threshold.
- Section 6's matrix says a `12KB` output should be full in RunLayer.

## Decision

Implement the explicit M2 contract:

- `INLINE_FULL_THRESHOLD_CHARS = 8192` controls whether RunLayer carries `inline_output`.
- Outputs above that threshold are omitted from RunLayer and marked with `output_truncated: true`.
- `INLINE_MAX_CHARS = 16384` controls the continuation user-message preview truncation.

This keeps large payloads out of prompt context and preserves the Phase 3 artifact-storage deferral.

## F1/F2 Register WS Resolution

After the initial full-suite run, two `register-ws.test.ts` failures remained:

- F1: `resolves git.diff from the live default registry` timed out at Vitest's default 5s test budget.
- F2: `resolves web.search from the live default registry` reported a shorter message sequence than the expected full runtime-event flow.

The `web.search` case passed when isolated with the server dist Vitest workflow, so no runtime code or assertion change was made for F2. The earlier sequence mismatch was treated as a cascade after the timed-out `git.diff` test interrupted the same file's run.

The `git.diff` case passed twice on the stashed base and once on this branch when isolated. The live `git.diff` tool span stayed small, so no M3/M4 runtime performance regression was found. The failure was narrowed to a full-suite, environment-sensitive timing budget issue on Windows. The test keeps its assertions unchanged and now uses a 15s per-test timeout, below the task's 60s ceiling.
