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

## E2E Regression Resolution

`resolveRuntimeTerminationCode` initially mapped non-failure stop kinds (`completed`, `cancelled`, `model_stop`) to termination codes. The `run.finished` transport message does not currently serialize `error_code`, but the result-level code could still leak into persistence or collaboration surfaces and break the success/failure contract.

Fix: restricted the function to terminal-failure kinds only. Success paths now keep the result-level `error_code` undefined as before. `RuntimeTerminationCode` union remains additive; only the mapping narrowed.

Follow-up CI evidence showed the same e2e failures after that mapping fix. The downloaded Playwright artifact showed the approved run completed successfully and wrote the proof file, but the final presentation snapshot replaced the standalone approved approval block before the tests could observe `Onaylandı` / `Kabul edildi`.

Second fix: carry sanitized resolved approval blocks into final presentation snapshots for both approved auto-continue and rejected auto-continue paths. This keeps the trust-boundary decision visible after completion without changing frontend merge behavior or replaying tool/trace presentation blocks, while omitting raw tool names from the final user-facing block.

Third fix: the remaining PR #30 e2e failure came from the non-developer current-run activity line, which still rendered the technical tool id as `completed file.write` after the approved final state became visible. The activity and timeline labels now format known tool ids into user-facing labels before rendering, including tooltip/detail text, without changing the underlying runtime payload.
