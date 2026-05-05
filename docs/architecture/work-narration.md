# Work Narration Runtime Notes

## Faz 2B Runtime Emission

Work narration emission is backend-only in Faz 2B. The runtime classifies
`ordered_content`, applies narration guardrails, persists narration runtime events, and
sends `narration.delta` / `narration.completed` WebSocket messages. The frontend still
renders `work_narration` blocks as silent `null` until Faz 4.

## Provider Gate

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
