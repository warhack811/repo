# Reasoning Persistence

`agent_reasoning_traces` stores provider-internal reasoning traces for debugging and audit-only workflows when `RUNA_PERSIST_REASONING=1` is enabled.

The table is not part of the public WebSocket or presentation contract. Runtime code must keep `internal_reasoning` redacted by default and unwrap it only at explicit persistence or provider replay decision points.

Work narration must never be populated from `internal_reasoning` or provider
`reasoning_content`. Narration uses normal assistant text only, after provider
capability gates and runtime guardrails.

## Retention

Rows carry `expires_at` and `retention_policy`. The default policy is `debug_30d`; `permanent_audit` is reserved for explicit operator use.

There is no scheduled cleanup job yet. Faz 6 will add an automated cleanup path, either cron, `pg_cron`, or an application-level scheduler. Until then, operators who enable `RUNA_PERSIST_REASONING=1` must plan manual cleanup with `cleanupExpiredReasoningTraces`.

Operator warning: enabling `RUNA_PERSIST_REASONING=1` increases retention
responsibility. Treat the table as sensitive debug data, keep retention short,
and run cleanup manually until a scheduled job exists.

## Telemetry

Server logs redact `internal_reasoning` and `reasoning_content`. This repository does not currently contain a server analytics, Sentry, PostHog, Datadog, or trace-span attribute integration. Future telemetry integrations must route structured payloads through the same redaction wrapper before export.

Narration observability logs metadata only, such as length, status, provider
strategy, and outcome. They must not export raw reasoning text, raw tool output,
or complete narration transcripts.
