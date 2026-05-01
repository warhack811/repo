# Backend Evidence Compiler Plan

## Discovery Findings

### Existing `web.search` Path

- Tool definition: `apps/server/src/tools/web-search.ts`.
- Registry wiring: `apps/server/src/tools/registry.ts` imports `webSearchTool` and registers it in `builtInTools`.
- Provider today: Serper, called directly from the tool implementation through `fetch`.
- Endpoints today:
  - Organic: `https://google.serper.dev/search`
  - News: `https://google.serper.dev/news`
  - Optional override: `SERPER_ENDPOINT`
- Current payload shape:
  - Tool success output includes `search_provider`, `results`, `is_truncated`, `authority_note`, `freshness_note`, optional `answer_box`, optional `knowledge_graph`.
  - Each result includes `title`, `url`, `source`, `snippet`, `trust_tier`, optional `authority_note`, optional `freshness_hint`.
- Current shaping:
  - Trust tiering, noisy host filtering, snippet trimming, prompt tag sanitization, answer-box and knowledge-graph parsing all live inside `web-search.ts`.
  - This should move behind provider/evidence seams so provider replacement does not rewrite trust/dedup/ranking logic.

### Presentation Path

- Tool result presentation entrypoint: `apps/server/src/ws/presentation.ts`.
- `createToolResultPresentationBlocks()` always emits a generic `tool_result` block and conditionally adds specialized blocks.
- Web search specialized block mapper: `apps/server/src/presentation/map-web-search-result.ts`.
- Current block type: `web_search_result_block`, defined in `packages/types/src/blocks.ts`.
- Frontend adapter reads `web_search_result_block` and maps it to an `EvidencePack` shape. Backend should now emit enough canonical evidence fields for that contract instead of forcing frontend inference.

### Tool Dispatch And Context

- Tool registry exists: `ToolRegistry` in `apps/server/src/tools/registry.ts`.
- Dispatch path:
  - `apps/server/src/runtime/model-tool-dispatch.ts`
  - `apps/server/src/runtime/run-tool-step.ts`
  - `apps/server/src/runtime/ingest-tool-result.ts`
- Tool results are persisted/ingested as `ToolResult`.
- Model context sees compact tool-result content after dispatch; `web.search` output must stay small and source-oriented.
- The new layers must keep `web.search` registered through the existing registry and must not add a parallel dispatch path.

### Error And Transport Path

- Runtime events are typed in `packages/types/src/events.ts`.
- WS server messages are typed in `packages/types/src/ws.ts`.
- `run.rejected` is created by `apps/server/src/ws/transport.ts#createRejectedMessage`.
- `runtime.event` carries typed runtime events; `run.finished` is emitted for terminal completed/failed states.
- Current tool errors use `ToolErrorCode`: `INVALID_INPUT`, `NOT_FOUND`, `PERMISSION_DENIED`, `EXECUTION_FAILED`, `TIMEOUT`, `UNKNOWN`.
- Frontend catalog currently exposes kebab-case transport codes: `network-cut`, `rate-limit`, `server-error`, `timeout`, `unknown`, `ws-disconnect`.
- Backend should add compatible transport error metadata without breaking existing tool error codes.

### Test Infra

- Server test runner: Vitest.
- Package test command: `pnpm --filter @runa/server test`.
- Source-targeted runner is available through `vitest.src.config.mjs`.
- Existing examples:
  - Tool unit tests: `apps/server/src/tools/web-search.test.ts`
  - Presentation mapper tests: `apps/server/src/presentation/map-web-search-result.test.ts`
  - WS integration tests: `apps/server/src/ws/register-ws.test.ts`

## Proposed File Structure

```text
packages/types/src/evidence.ts
apps/server/src/transport/error-codes.ts
apps/server/src/search/provider.ts
apps/server/src/search/providers/serper.ts
apps/server/src/search/registry.ts
apps/server/src/search/intent.ts
apps/server/src/evidence/normalize.ts
apps/server/src/evidence/extract-date.ts
apps/server/src/evidence/extract-content.ts
apps/server/src/evidence/dedup.ts
apps/server/src/evidence/trust-score.ts
apps/server/src/evidence/recency-rank.ts
apps/server/src/evidence/compile.ts
apps/server/src/config/source-trust.json
```

## Integration Points

- `web.search` should normalize input, classify intent, call `compileEvidence()`, then return a `ToolResultSuccess` with an EvidencePack-compatible output.
- `map-web-search-result.ts` should accept the new EvidencePack-shaped output and preserve backward compatibility for older result shapes.
- `packages/types/src/blocks.ts` should expand `web_search_result_block` payload to include EvidencePack fields while keeping legacy fields available during transition.
- Provider-specific Serper parsing belongs in `apps/server/src/search/providers/serper.ts`; trust, recency, dedup, and canonicalization belong under `apps/server/src/evidence/`.
- Transport error code mapping should be additive in `apps/server/src/transport/error-codes.ts` and surfaced through tool error `details.transport_error_code` first, then through WS payloads when safe.

## Risks

- WS presentation tests are sensitive to block ordering and payload shape. Keep `tool_result` plus specialized `web_search_result_block` ordering unchanged.
- Frontend is production-locked. Do not edit `apps/web`; backend block fields must be additive/backward-compatible.
- No new dependency should be introduced unless absolutely necessary. Implement URL normalization, date parsing, and dedup with small local utilities for this pass.
- Serper live behavior can drift. Unit tests should use fixture-backed mock fetch and only final smoke should use live env if `SERPER_API_KEY` is available.
- Full HTML date/content extraction can add latency and network failure modes. Keep it config-gated and off by default.
- All-source-low-trust should be non-fatal: return EvidencePack with `unreliable: true` metadata/details and a compact instruction for the model, not a hard provider failure.
