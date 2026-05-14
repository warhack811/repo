# PR-8 Codex Brief â€” A11y, iOS visualViewport, Reduced Motion, Final Polish

> **Tarih:** 2026-05-13
> **Branch:** `codex/ui-restructure-pr-8-a11y-polish`
> **Worktree:** `.claude/worktrees/runa-ui-pr-8-a11y-polish`
> **Authority:** `docs/design/RUNA-DESIGN-BRIEF.md` v1.1 (BÃ¶lÃ¼m 6.5 iOS Safari, BÃ¶lÃ¼m 11 A11y)
> **BaÄŸÄ±mlÄ±lÄ±k:** PR-7 merge edilmiÅŸ olmalÄ±.
> **Hedef:** iOS Safari klavye davranÄ±ÅŸÄ±nÄ± Ã§Ã¶z, prefers-reduced-motion audit'ini bitir, A11y Lighthouse skoru â‰¥95'e Ã§Ä±kar, son polish.

---

## 1. Tek cÃ¼mle hedef

Bu PR'dan sonra iOS Safari + Android Chrome'da klavye aÃ§Ä±kken composer kenarÄ± gÃ¶rÃ¼nÃ¼r kalÄ±r, `prefers-reduced-motion` tÃ¼m animasyonlarda saygÄ± gÃ¶rÃ¼r, A11y skoru â‰¥95 olur ve UI restructure sÃ¼reci kapanÄ±r.

---

## 2. Kapsam â€” YapÄ±lacaklar

### 2.1 `useVisualViewport` hook

**Yeni dosya:** `apps/web/src/hooks/useVisualViewport.ts`

```typescript
import { useEffect } from 'react';

export function useVisualViewport(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = (): void => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--keyboard-offset', `${offset}px`);
    };

    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    onResize();

    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, []);
}
```

`apps/web/src/App.tsx` veya `AuthenticatedApp.tsx` root seviyesinde mount edilir.

### 2.2 Composer keyboard-aware CSS

**Dosya:** `apps/web/src/styles/components.css` (composer kurallarÄ±)

```css
.runa-chat-layout__composer {
  position: sticky;
  bottom: calc(var(--safe-area-bottom) + 12px);
  transform: translateY(calc(-1 * var(--keyboard-offset, 0px)));
  transition: transform 120ms var(--ease-standard);
  z-index: 30;
}

@media (max-width: 768px) {
  .runa-chat-layout__composer {
    /* Bottom tab bar yok artÄ±k (PR-2), yalnÄ±z safe-area kaldÄ± */
    bottom: var(--safe-area-bottom);
  }
}
```

`@media (prefers-reduced-motion: reduce)` durumunda `transition: none`.

### 2.3 `prefers-reduced-motion` audit

Mevcut animasyonlarÄ±n tÃ¼mÃ¼ taranÄ±r; aÅŸaÄŸÄ±daki kural her birinin sonuna eklenir:

```css
@media (prefers-reduced-motion: reduce) {
  .runa-XYZ {
    animation: none !important;
    transition: none !important;
  }
}
```

**Taranacak dosyalar (audit list):**
- `apps/web/src/styles/animations.css` (mevcut)
- `apps/web/src/styles/components.css` (sticky, sheet, modal, button hover'lar)
- `apps/web/src/components/chat/blocks/BlockRenderer.module.css`
- `apps/web/src/components/ui/RunaSheet.module.css`
- `apps/web/src/components/ui/RunaModal.module.css`
- TÃ¼m `*.module.css` dosyalarÄ±

Global helper class: `.respect-reduced-motion` (animations.css). Kullanmak istemeyen yer iÃ§in `.force-motion` opt-out (rare).

### 2.4 A11y audit + fixes

**Kontrol listesi (Lighthouse + manual):**

| Hedef | Mevcut durum | Aksiyon |
|---|---|---|
| TÃ¼m interaktif elementlerin focus-visible outline'Ä± | KarÄ±ÅŸÄ±k | `--focus-ring` token'Ä± (`2px solid var(--accent)`) tÃ¼m `:focus-visible` kurallarÄ± iÃ§in. |
| ARIA landmark'lar (header, nav, main, complementary) | KÄ±smen | `<main role="main">`, `<nav aria-label="...">` her route'ta. |
| Renk kontrastÄ± | PR-1'de fix'lendi | Final WCAG AA pass. |
| Icon button'larda accessible name | Ã‡oÄŸu OK | `aria-label="..."` audit. |
| Klavye-only navigasyon | KarÄ±ÅŸÄ±k | Sheet'lerde tab trap, command palette arrow keys, kart `<button>` veya `<a>`. |
| Heading hiyerarÅŸisi (h1 â†’ h2 â†’ h3) | KarÄ±ÅŸÄ±k | Her route'ta tek `<h1>` (sayfa baÅŸlÄ±ÄŸÄ±), sonra h2 â†’ h3 sÄ±ralÄ±. |
| Image alt text | OK | HafizaMark dahil aria-label veya aria-hidden. |
| Form label'larÄ± | Ã‡oÄŸu OK | Composer textarea `aria-label`, Settings input'larÄ± `<label htmlFor>`. |
| Skip-to-content link | Yok | `<a href="#main-content" className="sr-only">Ä°Ã§eriÄŸe atla</a>` AppShell baÅŸÄ±. |

**Yeni dosya:** `apps/web/src/components/ui/SkipToContent.tsx`

```tsx
export function SkipToContent(): ReactElement {
  return (
    <a href="#main-content" className="runa-skip-link">
      Ana iÃ§eriÄŸe atla
    </a>
  );
}
```

CSS: `.runa-skip-link { position: absolute; left: -9999px; }` + `:focus { left: 0; top: 0; ... }`.

### 2.5 Focus ring token

**Dosya:** `apps/web/src/styles/tokens.css`

Yeni token:
```css
--focus-ring: 0 0 0 2px var(--accent);
--focus-ring-offset: 2px;
```

Global rule:
```css
*:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}
```

### 2.6 Lighthouse target'lara eriÅŸim

| Skor | Hedef | Ã–nemli aksiyonlar |
|---|---|---|
| Performance | â‰¥85 | Font preload optimize, image lazy, route code-split (zaten `lazy(() => import(...))` mevcut). |
| Accessibility | â‰¥95 | YukarÄ±daki audit + skip link + focus ring + ARIA landmark'lar. |
| Best Practices | â‰¥90 | `crossorigin` font tag'larÄ±, `rel="noopener"` external link'ler, CSP basic header. |
| SEO | N/A | Ä°Ã§ Ã¼rÃ¼n, public SEO gerekmez. |

### 2.7 Final design language documentation update

**Dosya:** `docs/RUNA-DESIGN-LANGUAGE.md`

Bu dosya PR-1 Ã¶ncesi mevcut "UI-OVERHAUL-07 sonrasÄ±" kurallarÄ± taÅŸÄ±yor. PR-1 â†’ PR-8 sonrasÄ± yeni kurallar:

- Surface model (sol sidebar + chat sÃ¼tun + composer; saÄŸ rail yok)
- Card-in-card yasak (tek istisna: approval kart)
- Mesaj baÅŸÄ±na saat damgasÄ± yok; gÃ¼n ayÄ±rÄ±cÄ± var
- Tool aktivitesi tek satÄ±r + chevron
- Approval risk 3 seviye + buton renkleri
- Server `user_label_tr` kontratÄ±
- iOS visualViewport requirement
- prefers-reduced-motion requirement

Bu dosya **tek sayfa** olarak yeniden yazÄ±lÄ±r; tÃ¼m PR-N brief'lerine referans verir.

### 2.8 Test guard gÃ¼ncellemeleri

**Dosya:** `apps/web/src/test/design-language-lock.test.ts`

Yeni assertion'lar:
- `useVisualViewport.ts` export ediliyor.
- `--focus-ring` token'Ä± `tokens.css`'te var.
- `SkipToContent` `apps/web/src/components/ui/`'da export ediliyor.
- TÃ¼m `.module.css` dosyalarÄ±nda `prefers-reduced-motion` query'si **en az bir kez** var (komponent'in animasyon kullanÄ±p kullanmadÄ±ÄŸÄ±na bakmaksÄ±zÄ±n; opt-in marker olarak).

---

## 3. Kapsam dÄ±ÅŸÄ±

Bu PR son adÄ±m â€” kapsam dÄ±ÅŸÄ± yok. AÃ§Ä±k olarak:
- Son polish niteliÄŸinde yeni feature **yok**.
- Yeni komponent **yok** (sadece SkipToContent + useVisualViewport).
- Server tarafÄ± dokunulmaz.

---

## 4. Kabul Kriteri

### 4.1 Otomatik

- [ ] `lint + typecheck + test + build` PASS
- [ ] `useVisualViewport` hook export edilmiÅŸ ve `App.tsx`/`AuthenticatedApp.tsx`'te mount edilmiÅŸ
- [ ] `SkipToContent` AppShell'in ilk Ã¶ÄŸesi
- [ ] `--focus-ring` token tÃ¼m `:focus-visible` kurallarÄ±nda kullanÄ±lÄ±yor (grep audit)
- [ ] `prefers-reduced-motion` query her `*.module.css` dosyasÄ±nda en az bir kez

### 4.2 Lock test gÃ¼ncellemesi

- `useVisualViewport.ts` export'u var.
- `tokens.css` `--focus-ring` tanÄ±mlÄ±.
- `App.tsx` veya `AuthenticatedApp.tsx` iÃ§inde `useVisualViewport()` Ã§aÄŸrÄ±sÄ± var.

### 4.3 GÃ¶rsel kanÄ±t

`docs/design-audit/screenshots/`:

- [ ] `mobile-iphone-safari-keyboard-open.png` â€” iOS Safari klavye aÃ§Ä±k, composer kenarÄ± gÃ¶rÃ¼nÃ¼r
- [ ] `mobile-android-keyboard-open.png` â€” Android Chrome aynÄ± test
- [ ] `desktop-1440-focus-ring-on-button.png` â€” Tab ile focus, ring gÃ¶rÃ¼nÃ¼r
- [ ] `desktop-1440-skip-to-content-focused.png` â€” Tab basÄ±ldÄ±ÄŸÄ±nda skip link gÃ¶rÃ¼nÃ¼r
- [ ] `desktop-1440-reduced-motion-on.png` â€” Browser reduced-motion aÃ§Ä±k, animasyonsuz UI

### 4.4 Ä°nsan-review (cihaz QA)

- [ ] iPhone Safari (gerÃ§ek cihaz veya Browserstack): composer focus â†’ klavye aÃ§Ä±lÄ±r â†’ composer Ã¼st kenarÄ± gÃ¶rÃ¼nÃ¼r (â‰¥8px Ã¼stte).
- [ ] Android Chrome: aynÄ± test PASS.
- [ ] Klavye-only navigation (Tab, Shift+Tab, Enter, Esc): tÃ¼m primary akÄ±ÅŸlar eriÅŸilebilir.
- [ ] Screen reader (NVDA + macOS VoiceOver): chat akÄ±ÅŸÄ± okunur, approval kartÄ± eriÅŸilebilir, sheet aÃ§Ä±lÄ±ÅŸ/kapanÄ±ÅŸ anons edilir.

### 4.5 Lighthouse skorlarÄ± (zorunlu)

- [ ] Performance â‰¥85 (mobile, 4G)
- [ ] Accessibility â‰¥95
- [ ] Best Practices â‰¥90
- [ ] SonuÃ§lar PR description'a screenshot olarak eklenmiÅŸ

---

## 5. Risk ve geri-alma

| Risk | Etki | Mitigation |
|---|---|---|
| `visualViewport` Safari < 16'da undefined | DÃ¼ÅŸÃ¼k | Hook `if (!vv) return` ile graceful degrade. |
| `prefers-reduced-motion` audit kapsamÄ± bÃ¼yÃ¼k; sÄ±zÄ±ntÄ± kalÄ±r | Orta | Lock test her `.module.css`'te query varlÄ±ÄŸÄ±nÄ± kontrol eder. |
| Focus ring tÃ¼m tarayÄ±cÄ±larda farklÄ± gÃ¶rÃ¼nÃ¼r | DÃ¼ÅŸÃ¼k | `box-shadow` kullanÄ±mÄ± tutarlÄ±; `outline: none` ile ayrÄ±lÄ±r. |
| Skip-to-content link tasarÄ±mla Ã§akÄ±ÅŸÄ±r | DÃ¼ÅŸÃ¼k | Sadece `:focus` durumunda gÃ¶rÃ¼nÃ¼r; default gizli. |
| Lighthouse skorlarÄ± farklÄ± koÅŸullarda dalgalanÄ±r | Orta | Three-run ortalamasÄ±, en kÃ¶tÃ¼ skor raporlanÄ±r. |

**Geri-alma:** PR-8 final polish; minimum risk. Geri alma neredeyse her zaman izole revert ile mÃ¼mkÃ¼n.

---

## 6. Komutlar

```bash
git worktree add .claude/worktrees/runa-ui-pr-8-a11y-polish codex/ui-restructure-pr-8-a11y-polish
cd .claude/worktrees/runa-ui-pr-8-a11y-polish
pnpm install
pnpm --filter @runa/web dev

# A11y audit
grep -rE "prefers-reduced-motion" apps/web/src/**/*.module.css | wc -l
grep -rE "--focus-ring" apps/web/src/styles
grep -rE "useVisualViewport" apps/web/src

# Lighthouse koÅŸusu (CLI)
pnpm --filter @runa/web build
pnpm --filter @runa/web preview &
npx lighthouse http://localhost:4173 --preset=desktop --output=html --output-path=./lighthouse-desktop.html
npx lighthouse http://localhost:4173 --preset=mobile --output=html --output-path=./lighthouse-mobile.html

# Test
pnpm --filter @runa/web lint
pnpm --filter @runa/web typecheck
pnpm --filter @runa/web test
```

---

## 7. PR-8 sonrasÄ±

PR-8 merge edildiÄŸinde:

1. **TÃ¼m 8 PR tamamlandÄ±.** Global kabul kriterleri (PR-IMPLEMENTATION-INDEX bÃ¶lÃ¼m 5) doÄŸrulanÄ±r.
2. `docs/PROGRESS.md` final entry: `TASK-UI-RESTRUCTURE-COMPLETE - <tarih>`.
3. `docs/design/ui-restructure/FRONTEND-RESTRUCTURING-PLAN.md` "COMPLETED" damgasÄ± alÄ±r.
4. `docs/RUNA-DESIGN-LANGUAGE.md` yeni dilin tek source of truth'u olur.
5. PR-1 â†’ PR-8 brief'leri `docs/archive/frontend-mimar/2026-05-ui-restructure/` altÄ±na taÅŸÄ±nÄ±r.

UI restructure sÃ¼reci bÃ¶ylece kapanÄ±r.

---

> Bu son brief'tir. Tek bir cÃ¼mle hedefi var: Runa'yÄ± tÃ¼ketici-grade AI Ã¼rÃ¼n seviyesine getirmek iÃ§in son rÃ¶tuÅŸ.


