# EVIDENCE MAP

## Lock / Code
- `apps/web/src/test/design-language-lock.test.ts`
  - PR-3..PR-7, PR-9, Settings IA lock assert'leri
  - PR-11 memo discipline guard
  - `node scripts/audit-tokens.mjs` exit-code check
- `apps/web/src/components/chat/blocks/BlockRenderer.module.css`
  - Approval status/decision/state-feedback dead CSS temizligi
- `scripts/audit-dead-css.mjs`
  - Report-only dead CSS taramasi

## Design Language / Docs
- `docs/RUNA-DESIGN-LANGUAGE.md`
  - Settings Information Architecture (5 tab)
- `docs/design/ui-restructure/PR-7-CODEX-BRIEF.md`
  - PR-7 sonrasi Settings IA karar notu
- `docs/PROGRESS.md`
  - PR-3..PR-12 kronoloji kayitlari

## Accessibility / QA
- `docs/design-audit/screenshots/2026-05-14-ui-restructure-pr-12-final-polish/screen-reader-checklist.md`
  - Skip link, landmark, nav label, image alt otomatik kontrolleri
- `docs/design-audit/screenshots/2026-05-14-ui-restructure-pr-12-final-polish/lighthouse-desktop.json`
  - Performance 100, Accessibility 100, Best Practices 100
- `docs/design-audit/screenshots/2026-05-14-ui-restructure-pr-12-final-polish/lighthouse-mobile.json`
  - Performance 98, Accessibility 100, Best Practices 100

## Loading / Skeleton
- `apps/web/src/pages/ChatRuntimePage.tsx`
  - Loading skeleton eklandi
- `apps/web/src/pages/DeveloperRuntimePage.tsx`
  - Loading skeleton eklandi
- `apps/web/src/components/ui/RunaSkeleton.tsx`
  - Mevcut shared skeleton primitive

## Static routes without fetching
- `apps/web/src/pages/CapabilityPreviewPage.tsx`
- `apps/web/src/pages/NotificationsPage.tsx`
  - Fetching yok; skeleton gerektirmeyen statik/yerel state akislari
