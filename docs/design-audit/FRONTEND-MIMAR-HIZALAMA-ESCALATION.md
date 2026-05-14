# FRONTEND MIMAR HIZALAMA ESCALATION (2026-05-14)

## Konu

`TASK-UI-HIZALAMA-FULL-01` icinde Faz 4 kalite kapisi ve kanit uretimi, yerel calisma ortamindaki process/file izin kisitlari nedeniyle tam kapanamadi.

## Kanit

1. `pnpm.cmd --filter @runa/web test`
- Sonuc: FAIL
- Hata: `failed to load config ... ReferenceError: require is not defined` (vitest startup)

2. `pnpm.cmd --filter @runa/web exec vitest run --config ./vitest.config.mjs --configLoader native`
- Sonuc: FAIL
- Hata: coklu `spawn EPERM` (fork worker baslatilamiyor)

3. `pnpm.cmd --filter @runa/web build`
- Sonuc: FAIL
- Hata: Vite/Tailwind native binding yukleme asamasinda `stream did not contain valid UTF-8` + bagli `UNLOADABLE_DEPENDENCY`

4. `pnpm.cmd exec playwright test apps/web/tests/visual/ui-overhaul-07-9-final-coherence.spec.ts --config playwright.config.ts --workers=1`
- Sonuc: FAIL
- Hata: `EPERM: operation not permitted, unlink ... test-results/playwright/.last-run.json`

5. `pnpm.cmd exec playwright test ... --output C:/tmp/pw-output`
- Sonuc: FAIL
- Hata: `spawn EPERM` ve `mkdir C:\tmp\pw-output` izin hatasi

## Etki

- Kod seviyesinde Faz 1, Faz 2 ve Faz 3 degisiklikleri uygulandi.
- Lint ve typecheck gecti.
- Ancak bu ortamda test/build/playwright/lighthouse adimlari kapanamadi.

## Talep Edilen Karar

1. Yerel ortamda `spawn EPERM` ve output path izin sorunu giderilsin.
2. Vitest config loader problemi (`runner`/`native`) yeniden calistirilabilir hale getirilsin.
3. Bu duzeltmelerden sonra Faz 4 goruntu seti + Lighthouse yeniden kosulsun.
