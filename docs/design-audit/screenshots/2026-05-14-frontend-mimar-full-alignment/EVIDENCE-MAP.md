# EVIDENCE MAP - FRONTEND MIMAR FULL ALIGNMENT (2026-05-14)

Bu klasor, `TASK-UI-HIZALAMA-FULL-01` icin hedeflenen ekran kanitlarini listeler.

## Hedef Ekranlar

| Hedef | Durum | Not |
|---|---|---|
| login | BLOCKED | Playwright `spawn EPERM` nedeniyle capture uretilemedi |
| onboarding | BLOCKED | Playwright `spawn EPERM` nedeniyle capture uretilemedi |
| chat-empty | BLOCKED | Playwright `spawn EPERM` nedeniyle capture uretilemedi |
| chat-active | BLOCKED | Playwright `spawn EPERM` nedeniyle capture uretilemedi |
| approvals (low/medium/high + resolved) | BLOCKED | Playwright `spawn EPERM` nedeniyle capture uretilemedi |
| devices | BLOCKED | Playwright `spawn EPERM` nedeniyle capture uretilemedi |
| notifications | BLOCKED | Playwright `spawn EPERM` nedeniyle capture uretilemedi |
| settings (appearance/conversation/notifications/privacy/advanced) | BLOCKED | Playwright `spawn EPERM` nedeniyle capture uretilemedi |
| mobile menu/history/context sheet | BLOCKED | Playwright `spawn EPERM` nedeniyle capture uretilemedi |

## Komut Kaniti

- `pnpm.cmd exec playwright test apps/web/tests/visual/ui-overhaul-07-9-final-coherence.spec.ts --config playwright.config.ts --workers=1`
  - Sonuc: FAIL (`EPERM unlink ... .last-run.json`)
- `pnpm.cmd exec playwright test ... --output C:/tmp/pw-output`
  - Sonuc: FAIL (`spawn EPERM`, `mkdir EPERM`)

Detaylar: `docs/design-audit/FRONTEND-MIMAR-HIZALAMA-ESCALATION.md`
