# Work Narration Runtime Notes

## Faz 2B.5: Pessimistic Streaming Strategy

### Architecture Decision: Real-Time Tool Flush Deferred

**Decision:** Real-time tool_use flush is deferred to Phase 6+. The current implementation buffers all narration text until `response.completed`, then emits flush from the classifier.

**Rationale:**
- Model stream types (`ModelStreamChunk`) only support `text.delta` and `response.completed`.
- No tool_use.start/delta types exist in the runtime type system.
- Animation UI compensates for the buffering delay visually.
- Classifier-based flush at turn end produces correct narration ordering.

**Implementation:**
- `PessimisticNarrationStreamingStrategy` buffers text pessimistically (until tool appears or timeout).
- `strategy.onTextDelta()` returns `buffered`, `narration_token`, or `final_answer_token` decisions.
- `strategy.onToolUseStart()` is reserved for future real-time flush (see Phase 6+).
- `strategy.finish()` flushes remaining text and delegates to classifier for tool-containing turns.

**UI Compensation:**
- Frontend animates buffered text with typewriter effect to mask the delay.
- `narration.token` events are emitted immediately during streaming.
- No user-visible delay in Faz 2B.5 production.

**Type System Extension:**
- Requires adding `ModelStreamChunk.tool_use_start`, `ModelStreamChunk.tool_use_delta` to `@runa/types`.
- Requires adding `streaming_strategy` option to `ModelGateway.stream()`.
- Deferred to Phase 6+ when native blocks streaming is prioritized.

### Provider Gate

Narration emission is enabled only when the active model gateway capability reports a
supported narration strategy. Providers with `narration_strategy: 'unsupported'` bypass
the streaming buffer, classifier emission, runtime events, and dedicated narration WS
messages.

## Reconnect During Narration

Reconnect during narration is intentionally minimal in Faz 2B. The streaming buffer is
turn-scoped, not run-scoped, so a WebSocket disconnect can lose in-flight narration
deltas. After the turn completes, persisted runtime events can still reconstruct the
final `work_narration` block on replay or refresh. Full in-flight recovery is deferred
to Faz 6 hardening.

## Faz 5: Persistence and Replay

Work narration blocks currently persist at run finalize. The finalize path writes the
canonical presentation block list built from runtime events plus deterministic
presentation blocks, so replay/F5 receives the same `work_narration` block ids and
status values that the live run emitted.

Incremental per-block persistence is deferred. The current durable store writes the
full `conversation_run_blocks.blocks` JSON payload per run; doing per-event
fetch-modify-write updates during active streaming would add race and partial-duplicate
risk without a versioned JSONB merge/upsert contract. Faz 6 or a dedicated persistence
follow-up should add a block-aware incremental write path before enabling durable
in-flight narration recovery.
