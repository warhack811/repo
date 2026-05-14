# Runa UI Restructure â€” Master Implementation Index

> **Tarih:** 2026-05-13
> **Yetki belgesi:** `docs/design/RUNA-DESIGN-BRIEF.md` v1.1
> **Stratejik plan:** `docs/design/ui-restructure/FRONTEND-RESTRUCTURING-PLAN.md`
> **Kapsam:** PR-1 â†’ PR-8, frontend gÃ¶rsel ve mimari yeniden yapÄ±landÄ±rma
> **Hedef seviye:** Claude Cowork, Claude Code, Codex, ChatGPT, Linear, Raycast kalitesi

Bu dokÃ¼man 8 PR'Ä± tek bir sÃ¼recin parÃ§alarÄ± olarak yÃ¶netir. Her PR iÃ§in ayrÄ± `PR-N-CODEX-BRIEF.md` mevcuttur; Codex doÄŸrudan o belgeyi aÃ§Ä±p uygular. Master index burada **baÄŸÄ±mlÄ±lÄ±k, sÄ±ra, durum ve kabul matrisi** taÅŸÄ±r.

---

## 1. SÃ¼recin tek-cÃ¼mle hedefi

Mevcut Runa arayÃ¼zÃ¼nÃ¼ 8 kÃ¼Ã§Ã¼k-diff PR'da, Claude Cowork ve Codex seviyesinde tÃ¼ketici-grade bir AI Ã§alÄ±ÅŸma ortaÄŸÄ± arayÃ¼zÃ¼ne dÃ¶nÃ¼ÅŸtÃ¼rmek. Her PR baÄŸÄ±msÄ±z olarak revertable, gÃ¶zden geÃ§irilebilir ve gÃ¶rsel kanÄ±tla kapatÄ±lÄ±r.

## 2. PR sÄ±rasÄ± ve baÄŸÄ±mlÄ±lÄ±klar

```
PR-1 (tema/font/mark)         [GÃ–RSEL TRANSFORMASYON]
  â”‚
  â–¼
PR-2 (layout shell)            [SAÄ RAIL KALDIRMA, SOL SIDEBAR]
  â”‚
  â–¼
PR-3 (chat surface)            [TEKRAR KESÄ°MÄ°, MESAJ RÄ°TMÄ°]
  â”‚
  â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
  â–¼          â–¼             â”‚
PR-4    PR-5             (paralel)
(approval) (errors+server)
  â”‚          â”‚
  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â†’  PR-6 (sheets + command palette)
                    â”‚
                    â–¼
                  PR-7 (settings + advanced view + stop button)
                    â”‚
                    â–¼
                  PR-8 (a11y + iOS + reduced motion + polish)
```

**Lineer zorunlu:** PR-1 â†’ PR-2 â†’ PR-3, PR-6 â†’ PR-7 â†’ PR-8.
**Paralel izinli:** PR-4 ve PR-5 (PR-3 sonrasÄ± baÄŸÄ±msÄ±z modÃ¼ller).

## 3. PR durum matrisi (canlÄ±)

| PR | Kod adÄ± | Brief | Durum | Branch |
|---|---|---|---|---|
| PR-1 | Tema, Tipografi, HafÄ±za Mark | [PR-1-CODEX-BRIEF.md](./PR-1-CODEX-BRIEF.md) | Final tour devam ediyor | `codex/ui-restructure-pr-1-theme-typography-mark` |
| PR-2 | Layout Shell | [PR-2-CODEX-BRIEF.md](./PR-2-CODEX-BRIEF.md) | HazÄ±r, PR-1 merge sonrasÄ± baÅŸlar | `codex/ui-restructure-pr-2-layout-shell` |
| PR-3 | Chat Surface | [PR-3-CODEX-BRIEF.md](./PR-3-CODEX-BRIEF.md) | HazÄ±r, PR-2 sonrasÄ± | `codex/ui-restructure-pr-3-chat-surface` |
| PR-4 | Approval Calm | [PR-4-CODEX-BRIEF.md](./PR-4-CODEX-BRIEF.md) | HazÄ±r, PR-3 sonrasÄ± (paralel) | `codex/ui-restructure-pr-4-approval-calm` |
| PR-5 | Errors + Server `user_label_tr` | [PR-5-CODEX-BRIEF.md](./PR-5-CODEX-BRIEF.md) | HazÄ±r, PR-3 sonrasÄ± (paralel) | `codex/ui-restructure-pr-5-errors-user-label` |
| PR-6 | Sheets + Modal + Command Palette | [PR-6-CODEX-BRIEF.md](./PR-6-CODEX-BRIEF.md) | HazÄ±r, PR-4 + PR-5 merge sonrasÄ± | `codex/ui-restructure-pr-6-sheets-palette` |
| PR-7 | Settings + Advanced View + Stop | [PR-7-CODEX-BRIEF.md](./PR-7-CODEX-BRIEF.md) | HazÄ±r, PR-6 sonrasÄ± | `codex/ui-restructure-pr-7-settings-stop` |
| PR-8 | A11y + iOS + Polish | [PR-8-CODEX-BRIEF.md](./PR-8-CODEX-BRIEF.md) | HazÄ±r, PR-7 sonrasÄ± | `codex/ui-restructure-pr-8-a11y-polish` |

## 4. Branching ve review akÄ±ÅŸÄ±

### Branching

- Her PR ayrÄ± worktree: `.claude/worktrees/runa-ui-pr-N-<short-desc>/`
- Branch naming: `codex/ui-restructure-pr-N-<slug>`
- Lineer PR'lar bir Ã¶ncekinin merge'i beklenmeden aÃ§Ä±lmaz.
- Paralel PR'lar (PR-4 + PR-5) ayrÄ± worktree'lerde aynÄ± anda yÃ¼rÃ¼r; merge sÄ±rasÄ± serbest, conflict Ã§Ä±karsa ikinci PR rebase eder.

### Review akÄ±ÅŸÄ±

1. Codex worktree aÃ§ar, PR brief'indeki kapsamÄ± uygular.
2. Codex doÄŸrulamayÄ± koÅŸar: `lint + typecheck + test + build`.
3. Codex PR aÃ§ar; description'a kabul kriteri checklist'i ve gÃ¶rsel kanÄ±tlarÄ± ekler.
4. PR linki Claude'a (planlama ortaÄŸÄ±) gÃ¶nderilir.
5. Claude **gerÃ§ek kanÄ±tlarla** (file:line, grep Ã§Ä±ktÄ±sÄ±, screenshot) review eder; tahmin yapmaz.
6. Review sonucu kullanÄ±cÄ±ya raporlanÄ±r â†’ kullanÄ±cÄ± `merge` veya `revize` kararÄ± verir.
7. Merge sonrasÄ± `docs/PROGRESS.md`'de `TASK-UI-RESTRUCTURE-PR-N` entry kapanÄ±r.

### Lock test stratejisi

- `apps/web/src/test/design-language-lock.test.ts` PR-1'de kuruldu.
- Sonraki PR'lar bu test'i **bozmadan** ilerler.
- Her PR kendi alanÄ±nÄ± da kilitler (Ã¶rn. PR-2 layout shell yapÄ±sÄ±nÄ±, PR-4 approval kart yapÄ±sÄ±nÄ±).
- Lock test bypass yasak: `.skip()` veya silme yok. Test gÃ¼ncellenir, atlanmaz.
- Her PR brief'i "Lock test gÃ¼ncellemesi: ne, neden" satÄ±rÄ±nÄ± PR description'a koyar.

## 5. Global kabul kriteri (PR-1 â†’ PR-8 tamamlandÄ±ÄŸÄ±nda)

1. **GÃ¶rsel karÅŸÄ±laÅŸtÄ±rma testi:** Runa ile rastgele bir rakip ekran gÃ¶rÃ¼ntÃ¼sÃ¼ (Claude Cowork, Codex) yan yana konduÄŸunda "hangisi tÃ¼ketici Ã¼rÃ¼nÃ¼" testi geÃ§er.
2. **Ekran kaplamasÄ±:** AynÄ± agent run'Ä± eski tasarÄ±ma gÃ¶re en az %40 daha az piksel kaplar.
3. **Design Language Lock test PASS:** PR-1'de kurulan testin tÃ¼m assertion'larÄ± yeÅŸil.
4. **Debug copy lint:** Developer Mode kapalÄ±yken `apps/web` iÃ§inde hiÃ§bir Ä°ngilizce tool description user-facing ekrana Ã§Ä±kmaz (regex guard).
5. **Mobil 320/390/414 boyutlarÄ±nda** composer focus altÄ±nda hiÃ§bir overlap yok; klavye aÃ§Ä±kken composer Ã¼st kenarÄ± gÃ¶rÃ¼nÃ¼r.
6. **Lighthouse:** Performance â‰¥85, A11y â‰¥95, Best Practices â‰¥90.
7. **WCAG AA:** TÃ¼m metin/zemin kombinasyonlarÄ± kontrast geÃ§er; `--ink-3` kÃ¼Ã§Ã¼k metinde kullanÄ±lmÄ±yor.

## 6. Risk havuzu (proje genelinde)

| Risk | Etki | Mitigation |
|---|---|---|
| Lineer PR'larÄ±n biri uzun sÃ¼rerse paralel olmayan PR'lar bekler | Orta | Her PR â‰¤3 gÃ¼nde tamamlanacak boyutta kurgulandÄ±; uzarsa scope'tan kÄ±rp. |
| Lock test her PR'da deÄŸiÅŸmek zorunda kalÄ±rsa stratejide zayÄ±flama | Orta | Her PR brief'inde "Lock test'e eklenecek/deÄŸiÅŸecek assertion" satÄ±rÄ± var. |
| Server kontrat deÄŸiÅŸikliÄŸi (PR-5 `user_label_tr`) breaking olur | Orta | Opsiyonel alan; eski tÃ¼keticiler `user_label_tr === undefined` ile Ã§alÄ±ÅŸÄ±r. |
| Sheet sistemi (PR-6) iOS Safari'de bozar | Orta | PR-8'de iOS visualViewport polish'lenir; PR-6 brief'inde minimum cihaz testi ÅŸart. |
| Migration CSS dosyalarÄ± (PR-2 kapsamÄ±) cleanup PR-3 testlerini bozar | YÃ¼ksek | PR-2 brief'i lock test gÃ¼ncellemesini bir adÄ±m Ã¶nce yapar. |
| AynÄ± anda Codex'in Ã§oklu worktree'de paralel Ã§alÄ±ÅŸmasÄ± conflict yaratÄ±r | DÃ¼ÅŸÃ¼k | Paralel sadece PR-4 + PR-5; farklÄ± dosyalara dokunurlar. |
| Brief v1.1 ile gerÃ§ek implementation arasÄ±nda sapma birikir | Orta | Her PR review'da brief sapmasÄ± aÃ§Ä±kÃ§a raporlanÄ±r; sapma kabul edilirse v1.2/v1.3 olarak gÃ¼ncellenir. |

## 7. PR'lar arasÄ± ortak kabul kriteri (her PR'da)

Her PR aÅŸaÄŸÄ±daki minimum kontrolleri geÃ§meli:

### Otomatik (CI)
- [ ] `pnpm --filter @runa/web lint` â†’ PASS (baseline `SettingsPage.tsx:204` istisna)
- [ ] `pnpm --filter @runa/web typecheck` â†’ PASS
- [ ] `pnpm --filter @runa/web test` â†’ PASS
- [ ] `pnpm --filter @runa/web build` â†’ PASS

### GÃ¶rsel kanÄ±t (zorunlu)
- [ ] PR brief'inde listelenen ekran gÃ¶rÃ¼ntÃ¼leri `docs/design-audit/screenshots/<tarih>-ui-restructure-pr-N-<slug>/` altÄ±na commit edilmiÅŸ

### Ä°nsan-review
- [ ] Brief'teki kapsam dÄ±ÅŸÄ± (DO NOT) listesindeki hiÃ§bir dosya bu PR'da deÄŸiÅŸmemiÅŸ
- [ ] Lock test PASS, varsa yeni assertion eklenmiÅŸ
- [ ] PR description'da kabul kriteri checklist'i doldurulmuÅŸ

### Performans (PR-1 ve PR-8)
- [ ] Lighthouse Performance / A11y / Best Practices skorlarÄ± rapor edildi

## 8. Belgeler arasÄ± baÄŸlantÄ±

- `RUNA-DESIGN-BRIEF.md` v1.1 â†’ tek yetki belgesi (renkler, kurallar, tool risk listesi, server kontratÄ±)
- `FRONTEND-RESTRUCTURING-PLAN.md` â†’ ilk strateji belgesi (planlama referansÄ±, history)
- `PR-N-CODEX-BRIEF.md` â†’ her PR iÃ§in implementation rehberi (Codex aÃ§Ä±p uygular)
- `PR-IMPLEMENTATION-INDEX.md` â†’ bu dokÃ¼man (canlÄ± durum, sÄ±ralama, baÄŸÄ±mlÄ±lÄ±k, ortak kabul)
- `docs/PROGRESS.md` â†’ kronolojik task log, merge sonrasÄ± entry'ler buraya dÃ¼ÅŸer
- `docs/RUNA-DESIGN-LANGUAGE.md` â†’ uzun-vadeli locked design rules (PR-1 sonrasÄ± gÃ¼ncellenir)

## 9. Komut paleti (Codex referansÄ±)

```bash
# Yeni worktree aÃ§ma
git worktree add .claude/worktrees/runa-ui-pr-N-<slug> codex/ui-restructure-pr-N-<slug>

# Ã‡alÄ±ÅŸma
cd .claude/worktrees/runa-ui-pr-N-<slug>
pnpm install
pnpm --filter @runa/web dev      # localhost:5173

# DoÄŸrulama (her PR'da)
pnpm --filter @runa/web lint
pnpm --filter @runa/web typecheck
pnpm --filter @runa/web test
pnpm --filter @runa/web build

# GÃ¶rsel kanÄ±t
pnpm --filter @runa/web exec playwright test e2e/visual-pr-N.spec.ts

# Worktree kapatma (merge sonrasÄ±)
cd D:/ai/Runa
git worktree remove .claude/worktrees/runa-ui-pr-N-<slug>
git branch -d codex/ui-restructure-pr-N-<slug>
```

## 10. Esneklik notu

Bu plan **esnek**. AÅŸaÄŸÄ±daki durumlar plan revizyonu tetikler:

- **PR sÄ±rasÄ± deÄŸiÅŸir** â†’ Index gÃ¼ncelle, baÄŸÄ±mlÄ±lÄ±k grafiÄŸi yeniden Ã§iz.
- **Yeni PR eklenir (Ã¶rn. PR-5.5)** â†’ Yeni `PR-5.5-CODEX-BRIEF.md` yaz, index'e ekle.
- **Bir PR bÃ¶lÃ¼nÃ¼r (Ã¶rn. PR-6 ikiye ayrÄ±lÄ±r)** â†’ Ä°ki yeni brief, eski brief deprecated edilir.
- **Brief v1.1 â†’ v1.2** â†’ AnlamlÄ± bir karar deÄŸiÅŸtiyse brief gÃ¼ncellenir, ilgili PR brief'leri etkilenirse `references brief v1.2` notu eklenir.

Plan deÄŸiÅŸiklikleri Claude (planlama ortaÄŸÄ±) ile birlikte yapÄ±lÄ±r, Codex tek baÅŸÄ±na index'i deÄŸiÅŸtirmez.

