# Evidence Compiler Report

## GO / NO-GO

**GO for backend merge.** SearchProvider, Serper adapter, EvidenceCompiler, intent classifier, transport-code metadata, and `web.search` wiring are implemented and covered by unit plus WS integration tests.

**NO-GO for full product release proof.** Browser-level Sources panel verification was not run in this pass. Backend emits additive EvidencePack-shaped data on `web_search_result_block`, but frontend visual confirmation remains a separate UI smoke.

## Added Files

- `packages/types/src/evidence.ts`
- `apps/server/src/transport/error-codes.ts`
- `apps/server/src/search/provider.ts`
- `apps/server/src/search/providers/serper.ts`
- `apps/server/src/search/providers/serper.test.ts`
- `apps/server/src/search/registry.ts`
- `apps/server/src/search/intent.ts`
- `apps/server/src/search/intent.test.ts`
- `apps/server/src/evidence/compile.ts`
- `apps/server/src/evidence/compile.test.ts`
- `apps/server/src/evidence/normalize.ts`
- `apps/server/src/evidence/extract-date.ts`
- `apps/server/src/evidence/extract-content.ts`
- `apps/server/src/evidence/dedup.ts`
- `apps/server/src/evidence/trust-score.ts`
- `apps/server/src/evidence/recency-rank.ts`
- `apps/server/src/evidence/source-trust.ts`
- `apps/server/src/evidence/strings.ts`
- `apps/server/src/config/source-trust.json`

## Changed Code Summary

- `web.search` now routes through `compileEvidence()` instead of embedding provider/trust logic directly in the tool.
- Serper is now a provider adapter behind `SearchProvider`.
- Evidence normalization removes common tracker params and emits canonical URL, domain, favicon, publish date, snippet, and trust score.
- Dedup runs first by canonical URL, then by title/snippet trigram Jaccard similarity.
- Trust scoring is static allowlist/denylist based with HTTPS boost.
- News intent uses recency ranking; general/research intent keeps relevance and trust dominant.
- `web_search_result_block` remains backward-compatible while adding `evidence`, `sources`, `searches`, `result_count`, `truncated`, and `unreliable`.
- `run.rejected` payload can now carry frontend catalog-compatible `error_code`; tool errors carry `details.transport_error_code`.

## Validation

- `pnpm.cmd --filter @runa/server typecheck` PASS
- `pnpm.cmd --filter @runa/server lint` PASS
- Targeted Vitest PASS: `src/search/providers/serper.test.ts`, `src/search/intent.test.ts`, `src/evidence/compile.test.ts`, `src/tools/web-search.test.ts`, `src/presentation/map-web-search-result.test.ts`
- WS targeted PASS: `src/ws/register-ws.test.ts -t "resolves web.search"`
- `pnpm.cmd --filter @runa/server test` PASS: 132 files, 899 tests

## Live Serper Smoke

Env truth:

- Shell `SERPER_API_KEY`: missing
- `.env` fallback `SERPER_API_KEY`: present
- Live smoke used `.env` fallback; key was not printed.

Result:

```json
{
  "result": "PASS",
  "total_latency_ms": 8305,
  "queries": [
    {"query":"bugün Türkiye ekonomi haberleri","intent":"news","latency_ms":793,"results":3,"truncated":true,"domains":["gzt.com","sabah.com.tr","bloomberght.com"],"trust_scores":[0.55,0.55,0.55]},
    {"query":"son dakika yapay zeka regülasyonu","intent":"news","latency_ms":1411,"results":2,"truncated":false,"domains":["trthaber.com","kibrismanset.com"],"trust_scores":[0.55,0.55]},
    {"query":"bugün hava İstanbul","intent":"news","latency_ms":777,"results":3,"truncated":true,"domains":["cnnturk.com","hurriyet.com.tr","gazeteoksijen.com"],"trust_scores":[0.55,0.55,0.55]},
    {"query":"Python nedir","intent":"research","latency_ms":657,"results":3,"truncated":true,"domains":["tr.wikipedia.org","aws.amazon.com","bilginc.com"],"trust_scores":[0.95,0.55,0.55]},
    {"query":"TypeScript nasıl çalışır","intent":"research","latency_ms":668,"results":3,"truncated":true,"domains":["medium.com","youtube.com","patika.dev"],"trust_scores":[0.55,0.55,0.55]},
    {"query":"Osmanlı tarihçe kısa","intent":"research","latency_ms":989,"results":3,"truncated":true,"domains":["tr.wikipedia.org","kulturportali.gov.tr","ttk.gov.tr"],"trust_scores":[0.95,0.95,0.95]},
    {"query":"Serper API examples","intent":"general","latency_ms":823,"results":3,"truncated":true,"domains":["serper.dev","github.com","docs.crewai.com"],"trust_scores":[0.55,0.55,0.55]},
    {"query":"PostgreSQL index tuning","intent":"general","latency_ms":791,"results":3,"truncated":true,"domains":["tigerdata.com","medium.com","postgresql.org"],"trust_scores":[0.55,0.55,0.55]},
    {"query":"React Vite setup","intent":"general","latency_ms":676,"results":3,"truncated":true,"domains":["vite.dev","react.dev","youtube.com"],"trust_scores":[0.55,0.55,0.55]},
    {"query":"zzzxqv güvenilir kaynak yok edge case","intent":"general","latency_ms":716,"results":1,"truncated":false,"domains":["reddit.com"],"trust_scores":[0.55]}
  ]
}
```

Latency target: PASS. Every query was under 2 seconds.

## Known Limitations

- HTML meta-date extraction and full content extraction are stubbed/off by default to avoid adding slow network fan-out.
- Static trust config is intentionally small; several real sources remain neutral `0.55`.
- The unreliable edge case did not trigger in live Serper because Serper returned Reddit with neutral score. Unit coverage verifies the all-denylist path.
- Frontend browser Sources panel verification was not run.
- PR link: not created in this local pass.

## Roadmap

- Add Exa as `SearchProvider` without changing EvidenceCompiler.
- Add config-gated HTML date extraction.
- Add cost-aware Jina Reader / Readability extraction for top-N research sources.
- Add optional LLM intent classifier behind a config flag.
- Replace static trust config with MBFC/NewsGuard or a maintained source reputation adapter.
