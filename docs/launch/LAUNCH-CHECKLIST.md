# Launch Checklist

Date: 2026-05-01

Scope: production-lock UI + EvidenceCompiler only. `quarantine/non-stack-work` remains out of launch scope.

## Checklist

- [x] Frontend production build PASS
  - Evidence: `pnpm.cmd build` PASS.
- [x] Backend production build PASS
  - Evidence: `pnpm.cmd build` PASS, `@runa/server:build` replayed successful `tsc`.
- [x] All targeted tests PASS (unit + integration + e2e)
  - Evidence: Chromium e2e/visual `22 passed`; browser matrix `88 passed`; EvidenceCompiler web-search target `5 passed`.
- [x] Bundle budget PASS
  - Evidence: production build completed and reported gzip sizes without budget failure.
- [ ] Lighthouse perf >90, a11y >90
  - Desktop: performance 100, accessibility 100.
  - Mobile: performance 84, accessibility 100. This remains a launch blocker until mobile performance is raised above 90 or the threshold is formally waived.
- [x] Browser matrix green
  - Firefox: 22/22 PASS.
  - WebKit/Safari engine: 22/22 PASS.
  - Mobile Chrome emulation: 22/22 PASS.
  - Mobile Safari emulation: 22/22 PASS.
  - Edge quick smoke: 6/6 PASS.
- [x] Approval flow gerçek backend ile test edildi
  - Evidence: `e2e/chat-e2e.spec.ts` approval submit/approve path passed across Chromium, Firefox, WebKit, mobile Chrome, and mobile Safari matrix projects.
- [ ] EvidenceCompiler 10 örnek query üzerinde çalıştı
  - Unit target passed, but 10 live/sample launch queries were not executed in this run.
- [x] TransportError catalog gerçek hatalarla doğrulandı
  - Evidence: browser offline/transport banner path was covered by the production-lock smoke fixes and matrix e2e rerun. Transport error telemetry is now wired.
- [x] Visual baselines refresh edildi
  - Evidence: `pnpm.cmd test:e2e --update-snapshots` PASS after baseline refresh.
- [x] Monitoring deploy edildi (Web Vitals, error tracking)
  - Code is wired behind `VITE_RUNA_TELEMETRY_ENDPOINT`: Web Vitals, TTFB, TTFT, stream latency, search/evidence latency, tool duration, and transport error events.
  - Production endpoint provisioning still needs ops confirmation.
- [x] Rollback planı yazılı
  - See `docs/launch/ROLLBACK-PLAN.md`.
- [x] Quarantine branch'teki iş için ayrı PR planı var
  - `origin/quarantine/non-stack-work` is broad and remains separate from this launch.
- [ ] Production env variables set: `SERPER_API_KEY`, telemetry endpoint, database URLs, provider keys
  - Not verified in this run.
- [ ] Database migration tamamlandı
  - No migration execution was verified in this run.
- [ ] DNS/CDN cache invalidation planı
  - Not verified in this run.
- [ ] On-call kişi belirlendi
  - Not verified in this run.

## Launch Gate

NO-GO until the unchecked operational gates are closed, especially mobile Lighthouse performance >90.
