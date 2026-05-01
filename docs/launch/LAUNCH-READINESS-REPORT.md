# Launch Readiness Report

Date: 2026-05-01

## Recommendation

NO-GO for full launch.

The production-lock UI and EvidenceCompiler code paths are merged and the core engineering verification is strong: build, visual baseline refresh, browser matrix, and targeted EvidenceCompiler tests passed. The remaining blocker is launch-gate performance/ops readiness: mobile Lighthouse performance is 84, below the >90 checklist threshold, and production env/DNS/on-call/migration gates were not verified.

## Scope Status

- `feature/ui-stack-production-lock`: merged to `main` via PR #12, merge commit `f4f091fc6cfe8e03799e4077348d31d013e7267c`.
- EvidenceCompiler: present on `main` through the EvidenceCompiler/search commits before PR #12.
- `origin/quarantine/non-stack-work`: still broad, separate, and not part of this launch. It contains non-stack backend/runtime/auth/test/UI drift and should become a separate triage PR.

## Verification Results

- Production build: PASS.
- Chromium e2e + visual baseline refresh: 22/22 PASS.
- Browser matrix: 88/88 PASS.
- Edge quick smoke: 6/6 PASS.
- EvidenceCompiler web-search target: 5/5 PASS.
- Lighthouse desktop: performance 100, accessibility 100, best practices 96, SEO 92.
- Lighthouse mobile: performance 84, accessibility 100, best practices 96, SEO 92.

Lighthouse CLI emitted a Windows temp cleanup EPERM after writing JSON reports; the report files were still produced and parsed.

## Browser Matrix

| Browser target | Result | Notes |
| --- | --- | --- |
| Chrome / Chromium | PASS | Full smoke and visual suite. |
| Firefox | PASS | 22/22 matrix tests. |
| Safari engine / WebKit | PASS | 22/22 matrix tests. |
| Mobile Chrome | PASS | 22/22 matrix tests. |
| Mobile Safari | PASS | 22/22 matrix tests. |
| Edge | PASS | Quick smoke 6/6. |

WebKit initially exposed two issues:

- BLOCKER fixed: mobile approval action buttons could sit under the fixed bottom nav. The approval actions are now sticky above mobile nav.
- Test harness fixed: service workers could intercept Playwright route mocks, causing empty history fixtures in WebKit. Playwright now blocks service workers during e2e runs.

## Performance Baseline

Desktop Lighthouse:

- Performance: 100
- Accessibility: 100
- LCP: 0.7 s
- CLS: 0.009
- TBT: 0 ms

Mobile Lighthouse:

- Performance: 84
- Accessibility: 100
- LCP: 3.5 s
- CLS: 0.061
- TBT: 0 ms

## Monitoring

Implemented web telemetry behind `VITE_RUNA_TELEMETRY_ENDPOINT`:

- Web Vitals: LCP, CLS, FID, INP, TTFB.
- Runtime metrics: time-to-first-token, stream latency, search/evidence latency, tool call duration.
- Error tracking: `TransportErrorCode` emission for network cut, WebSocket disconnect, server error, timeout, rate limit, and unknown.

Production endpoint provisioning and alert wiring still need ops confirmation.

## Accessibility

- Lighthouse accessibility: desktop 100, mobile 100.
- Approval state uses `aria-live` for state feedback.
- Browser matrix covered keyboard-visible UI surfaces such as command palette, navigation, approval controls, and chat routes.

Remaining manual screen-reader smoke with a real assistive technology stack was not executed.

## Known Launch Risks

- BLOCKER: mobile Lighthouse performance is 84, below the >90 gate.
- OPS: production env vars were not verified in this run.
- OPS: database migration/rollback status was not verified.
- OPS: DNS/CDN invalidation and on-call owner were not verified.
- MINOR: Lighthouse CLI exits non-zero on Windows temp cleanup even when JSON reports are written.

## Post-Launch Monitoring Plan

First 7 days:

- Watch transport error rate, rate-limit rate, TTFT, stream latency, EvidencePack latency, approval failures, and frontend Web Vitals daily.
- Review browser-specific Sentry/telemetry splits for Safari/WebKit.

First 30 days:

- Establish p50/p95/p99 baselines for TTFT, EvidencePack latency, and approval resolution.
- Turn launch thresholds into alert policy.

First 90 days:

- Use telemetry trends to decide whether Mermaid/KaTeX/Shiki chunks need deeper lazy-loading work.
- Revisit mobile performance budget after real-user data replaces lab-only Lighthouse numbers.
