# Work Narration Architecture

Work narration is the short, user-facing status text the assistant may write
immediately before a tool call. It is not chain-of-thought, not hidden
reasoning, and not a second model call.

## Goals

- Keep final answers separate from work narration.
- Show supported providers' natural assistant text before tool calls as compact
  `work_narration` presentation blocks.
- Preserve unsupported providers' legacy `text.delta` behavior.
- Prevent provider reasoning, tool output, prompt-injection text, and technical
  ids from becoming user-facing narration.
- Persist finalized narration blocks so F5/replay shows the same work notes.

## Non-Goals

- No separate LLM call is used to generate narration.
- No model-facing JSON field such as `user_visible_narration` is introduced.
- No UI debug panel, tool log surface, or provider transcript is exposed in the
  primary chat.
- Incremental durable persistence is not enabled until there is a race-safe
  block-aware write path.

## Source of Truth

The canonical render contract is `RenderBlock` in `packages/types`. The
`work_narration` block follows the repo's payload-based render-block shape:

```ts
{
  type: 'work_narration',
  id: narration_id,
  payload: {
    text,
    status,
    run_id,
    turn_index,
    sequence_no,
    linked_tool_call_id,
    locale,
    created_at
  }
}
```

`id === narration_id` is the canonical key for live upsert, persistence, and
replay duplicate prevention.

## Prompt and Provider Gate

Narration prompt rules are injected only when the active provider reports:

- `narration_strategy === 'native_blocks'`
- `narration_strategy === 'temporal_stream'`

Unsupported providers receive no narration prompt. Their normal assistant text
continues through the legacy final-answer `text.delta` path.

Provider matrix:

| Provider family | Strategy | Narration prompt | Runtime narration |
| --- | --- | --- | --- |
| Claude | `native_blocks` | enabled | enabled |
| OpenAI | `temporal_stream` | enabled | enabled |
| DeepSeek | `temporal_stream` | enabled | enabled |
| Gemini | `unsupported` | disabled | disabled |
| Groq | `unsupported` | disabled | disabled |
| SambaNova | `unsupported` | disabled | disabled |

Locale is propagated client/request/backend to prompt assembly. Missing locale
falls back to `tr`.

## Provider Notes

Claude can preserve native text/tool block order. OpenAI and DeepSeek use
temporal streaming order. DeepSeek may emit provider-internal
`reasoning_content`; this is isolated into redacted internal metadata and is
never used as a narration source.

DeepSeek fallthrough detection is intentionally three-tier:

- high confidence: raw tool-call-looking text is blocked from ordered content
  and repeated high signals fail the turn deterministically.
- medium confidence: content is retained but marked `narration_eligible:false`.
- low confidence: observed for diagnostics only.

## Runtime Flow

1. Provider adapters build `ModelResponse.message.ordered_content`.
2. `classifyNarration` examines content order, provider strategy, turn intent,
   ordering origin, and `narration_eligible`.
3. `buildNarrationEmissionEvents` applies guardrails and emits:
   - `narration.started`
   - `narration.token`
   - `narration.completed`
   - later `narration.tool_outcome_linked`
4. `run-execution` forwards runtime events to the WS layer:
   - `narration.delta`
   - `narration.completed`
   - `narration.superseded` when present in future flows
5. Frontend live state upserts one block by `narration_id`.
6. `mapRuntimeEventsToRenderBlocks` builds persisted `work_narration` blocks.
7. `finalizeLiveRunResult` writes blocks to `conversation_run_blocks`.
8. Conversation reload returns the persisted blocks to replay mode.

## Guardrails

Narration guardrails reject or sanitize:

- empty text
- near-duplicate narration
- deliberation phrases such as `sanirim`, `belki`, `maybe`, `I think`
- long text over the cap, truncated to the user-visible hard limit
- text that overlaps strongly with recent tool output

Tool output is untrusted. It must not be quoted, summarized, repeated, or
carried into narration.

## Observability

Structured logs are emitted for:

- `narration.started`
- `narration.completed`
- `narration.superseded`
- `narration.guardrail.rejected`
- `narration.tool_outcome_linked`
- `narration.provider_unsupported`
- `narration.synthetic_ordering_suppressed`

Logs do not include full narration text. They carry metadata such as length,
status, provider, strategy, locale, sequence number, and outcome. Logger
sanitization recursively redacts `internal_reasoning` and `reasoning_content`.

DeepSeek adapter logs additionally cover:

- `deepseek.reasoning.isolated`
- `deepseek.fallthrough.high.blocked`
- `deepseek.fallthrough.medium.suppressed_narration`
- `deepseek.fallthrough.low.observed`

## Metrics

Production metrics are deferred. The repo has local counters for narrow repair
paths, but no general server-side metrics backend or exporter for narration.

Future metrics should include:

- `narration_emitted_total`
- `narration_completed_total`
- `narration_rejected_total{reason}`
- `narration_superseded_total`
- `narration_tool_failed_total`
- `narration_provider_unsupported_total{provider}`
- `narration_fallthrough_detected_total{confidence}`
- `narration_avg_length`
- `narration_link_rate`

## Persistence and Replay

Narration blocks currently persist at run finalize. This is deliberate: the
current durable store writes the full `conversation_run_blocks.blocks` JSON
payload per run, and per-event fetch-modify-write would risk races and partial
duplicates without versioned JSONB merge/upsert support.

Policy:

- Persist `completed`, `tool_failed`, and `superseded` blocks.
- Keep superseded blocks in storage for replay/debug consistency; frontend hides
  or collapses them.
- Keep `tool_failed` as a muted visual state; deterministic tool error cards
  remain separate.
- Do not duplicate blocks with the same `narration_id`.

Incremental persistence is deferred to a follow-up with a block-aware atomic
upsert contract.

## UI Principles

The frontend renders narration as a small, muted companion note. It is not a
main assistant answer and not a technical log. The UI never shows run ids,
trace ids, tool call ids, provider JSON, or raw HTML. Replay mode is more faded
than live mode. `tool_failed` is visually muted/warning-styled without
duplicating error details. `superseded` blocks are hidden/collapsed.

## Known Limitations

- In-flight WS reconnect does not recover partial narration before run finalize.
- Live DeepSeek smoke depends on `DEEPSEEK_API_KEY` and network availability.
- Scheduled cleanup for reasoning traces is still operator-managed/manual.
- Metrics are documented but not wired to a production exporter.

## Future Work

- Race-safe incremental block persistence.
- Production metrics exporter and dashboard.
- Scheduled reasoning trace cleanup job.
- Live smoke automation for Claude, OpenAI, and DeepSeek narration-capable paths.
- Native tool-use streaming chunks if provider adapters expose them cleanly.
