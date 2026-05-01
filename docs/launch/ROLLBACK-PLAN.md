# Rollback Plan

Date: 2026-05-01

Scope: production-lock UI + EvidenceCompiler.

## Fast Rollback

1. Revert the launch PR with a normal Git revert.
2. Trigger deploy rollback to the last known green production deployment.
3. Confirm the app shell, chat submit, approval flow, and web search route are back to the previous release behavior.

## Staged Rollout

If a production feature flag or traffic-splitting layer is available:

1. Start at 10 percent.
2. Hold and inspect error rate, transport error rate, TTFT, stream latency, and EvidencePack latency.
3. Move to 50 percent only if thresholds stay green.
4. Move to 100 percent only after another clean observation window.

Suggested rollback thresholds:

- Transport error rate above 2 percent for 10 minutes.
- `rate-limit` above 5 percent for 10 minutes.
- p95 time-to-first-token above the agreed production SLO.
- p95 EvidencePack latency above the agreed production SLO.
- Approval resolution failure above 1 percent.

## Data Rollback

EvidenceCompiler is read-oriented and normalizes search evidence before returning it to runtime. Direct data loss risk is low.

Conversation persistence still needs an explicit production migration/rollback check before launch. If persistence behavior regresses, rollback the deploy first, then inspect whether any conversation rows were written with incompatible shape.

## Communication

1. Announce rollback internally with release id, impact, and current user-visible state.
2. If users are affected, publish a short status update with the affected surfaces: chat, approvals, search/evidence, or persistence.
3. Post a recovery update after the previous deployment is verified.

Status page integration was not verified in this run.
