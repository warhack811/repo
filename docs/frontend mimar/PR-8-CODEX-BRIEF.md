# PR-8 Codex Brief — A11y, iOS visualViewport, Reduced Motion, Final Polish

> **Tarih:** 2026-05-13
> **Branch:** `codex/ui-restructure-pr-8-a11y-polish`
> **Worktree:** `.claude/worktrees/runa-ui-pr-8-a11y-polish`
> **Authority:** `docs/frontend mimar/RUNA-DESIGN-BRIEF.md` v1.1 (Bölüm 6.5 iOS Safari, Bölüm 11 A11y)
> **Bağımlılık:** PR-7 merge edilmiş olmalı.
> **Hedef:** iOS Safari klavye davranışını çöz, prefers-reduced-motion audit'ini bitir, A11y Lighthouse skoru ≥95'e çıkar, son polish.

---

## 1. Tek cümle hedef

Bu PR'dan sonra iOS Safari + Android Chrome'da klavye açıkken composer kenarı görünür kalır, `prefers-reduced-motion` tüm animasyonlarda saygı görür, A11y skoru ≥95 olur ve UI restructure süreci kapanır.

---

## 2. Kapsam — Yapılacaklar

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

**Dosya:** `apps/web/src/styles/components.css` (composer kuralları)

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
    /* Bottom tab bar yok artık (PR-2), yalnız safe-area kaldı */
    bottom: var(--safe-area-bottom);
  }
}
```

`@media (prefers-reduced-motion: reduce)` durumunda `transition: none`.

### 2.3 `prefers-reduced-motion` audit

Mevcut animasyonların tümü taranır; aşağıdaki kural her birinin sonuna eklenir:

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
- Tüm `*.module.css` dosyaları

Global helper class: `.respect-reduced-motion` (animations.css). Kullanmak istemeyen yer için `.force-motion` opt-out (rare).

### 2.4 A11y audit + fixes

**Kontrol listesi (Lighthouse + manual):**

| Hedef | Mevcut durum | Aksiyon |
|---|---|---|
| Tüm interaktif elementlerin focus-visible outline'ı | Karışık | `--focus-ring` token'ı (`2px solid var(--accent)`) tüm `:focus-visible` kuralları için. |
| ARIA landmark'lar (header, nav, main, complementary) | Kısmen | `<main role="main">`, `<nav aria-label="...">` her route'ta. |
| Renk kontrastı | PR-1'de fix'lendi | Final WCAG AA pass. |
| Icon button'larda accessible name | Çoğu OK | `aria-label="..."` audit. |
| Klavye-only navigasyon | Karışık | Sheet'lerde tab trap, command palette arrow keys, kart `<button>` veya `<a>`. |
| Heading hiyerarşisi (h1 → h2 → h3) | Karışık | Her route'ta tek `<h1>` (sayfa başlığı), sonra h2 → h3 sıralı. |
| Image alt text | OK | HafizaMark dahil aria-label veya aria-hidden. |
| Form label'ları | Çoğu OK | Composer textarea `aria-label`, Settings input'ları `<label htmlFor>`. |
| Skip-to-content link | Yok | `<a href="#main-content" className="sr-only">İçeriğe atla</a>` AppShell başı. |

**Yeni dosya:** `apps/web/src/components/ui/SkipToContent.tsx`

```tsx
export function SkipToContent(): ReactElement {
  return (
    <a href="#main-content" className="runa-skip-link">
      Ana içeriğe atla
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

### 2.6 Lighthouse target'lara erişim

| Skor | Hedef | Önemli aksiyonlar |
|---|---|---|
| Performance | ≥85 | Font preload optimize, image lazy, route code-split (zaten `lazy(() => import(...))` mevcut). |
| Accessibility | ≥95 | Yukarıdaki audit + skip link + focus ring + ARIA landmark'lar. |
| Best Practices | ≥90 | `crossorigin` font tag'ları, `rel="noopener"` external link'ler, CSP basic header. |
| SEO | N/A | İç ürün, public SEO gerekmez. |

### 2.7 Final design language documentation update

**Dosya:** `docs/RUNA-DESIGN-LANGUAGE.md`

Bu dosya PR-1 öncesi mevcut "UI-OVERHAUL-07 sonrası" kuralları taşıyor. PR-1 → PR-8 sonrası yeni kurallar:

- Surface model (sol sidebar + chat sütun + composer; sağ rail yok)
- Card-in-card yasak (tek istisna: approval kart)
- Mesaj başına saat damgası yok; gün ayırıcı var
- Tool aktivitesi tek satır + chevron
- Approval risk 3 seviye + buton renkleri
- Server `user_label_tr` kontratı
- iOS visualViewport requirement
- prefers-reduced-motion requirement

Bu dosya **tek sayfa** olarak yeniden yazılır; tüm PR-N brief'lerine referans verir.

### 2.8 Test guard güncellemeleri

**Dosya:** `apps/web/src/test/design-language-lock.test.ts`

Yeni assertion'lar:
- `useVisualViewport.ts` export ediliyor.
- `--focus-ring` token'ı `tokens.css`'te var.
- `SkipToContent` `apps/web/src/components/ui/`'da export ediliyor.
- Tüm `.module.css` dosyalarında `prefers-reduced-motion` query'si **en az bir kez** var (komponent'in animasyon kullanıp kullanmadığına bakmaksızın; opt-in marker olarak).

---

## 3. Kapsam dışı

Bu PR son adım — kapsam dışı yok. Açık olarak:
- Son polish niteliğinde yeni feature **yok**.
- Yeni komponent **yok** (sadece SkipToContent + useVisualViewport).
- Server tarafı dokunulmaz.

---

## 4. Kabul Kriteri

### 4.1 Otomatik

- [ ] `lint + typecheck + test + build` PASS
- [ ] `useVisualViewport` hook export edilmiş ve `App.tsx`/`AuthenticatedApp.tsx`'te mount edilmiş
- [ ] `SkipToContent` AppShell'in ilk öğesi
- [ ] `--focus-ring` token tüm `:focus-visible` kurallarında kullanılıyor (grep audit)
- [ ] `prefers-reduced-motion` query her `*.module.css` dosyasında en az bir kez

### 4.2 Lock test güncellemesi

- `useVisualViewport.ts` export'u var.
- `tokens.css` `--focus-ring` tanımlı.
- `App.tsx` veya `AuthenticatedApp.tsx` içinde `useVisualViewport()` çağrısı var.

### 4.3 Görsel kanıt

`docs/design-audit/screenshots/2026-05-XX-ui-restructure-pr-8-a11y-polish/`:

- [ ] `mobile-iphone-safari-keyboard-open.png` — iOS Safari klavye açık, composer kenarı görünür
- [ ] `mobile-android-keyboard-open.png` — Android Chrome aynı test
- [ ] `desktop-1440-focus-ring-on-button.png` — Tab ile focus, ring görünür
- [ ] `desktop-1440-skip-to-content-focused.png` — Tab basıldığında skip link görünür
- [ ] `desktop-1440-reduced-motion-on.png` — Browser reduced-motion açık, animasyonsuz UI

### 4.4 İnsan-review (cihaz QA)

- [ ] iPhone Safari (gerçek cihaz veya Browserstack): composer focus → klavye açılır → composer üst kenarı görünür (≥8px üstte).
- [ ] Android Chrome: aynı test PASS.
- [ ] Klavye-only navigation (Tab, Shift+Tab, Enter, Esc): tüm primary akışlar erişilebilir.
- [ ] Screen reader (NVDA + macOS VoiceOver): chat akışı okunur, approval kartı erişilebilir, sheet açılış/kapanış anons edilir.

### 4.5 Lighthouse skorları (zorunlu)

- [ ] Performance ≥85 (mobile, 4G)
- [ ] Accessibility ≥95
- [ ] Best Practices ≥90
- [ ] Sonuçlar PR description'a screenshot olarak eklenmiş

---

## 5. Risk ve geri-alma

| Risk | Etki | Mitigation |
|---|---|---|
| `visualViewport` Safari < 16'da undefined | Düşük | Hook `if (!vv) return` ile graceful degrade. |
| `prefers-reduced-motion` audit kapsamı büyük; sızıntı kalır | Orta | Lock test her `.module.css`'te query varlığını kontrol eder. |
| Focus ring tüm tarayıcılarda farklı görünür | Düşük | `box-shadow` kullanımı tutarlı; `outline: none` ile ayrılır. |
| Skip-to-content link tasarımla çakışır | Düşük | Sadece `:focus` durumunda görünür; default gizli. |
| Lighthouse skorları farklı koşullarda dalgalanır | Orta | Three-run ortalaması, en kötü skor raporlanır. |

**Geri-alma:** PR-8 final polish; minimum risk. Geri alma neredeyse her zaman izole revert ile mümkün.

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

# Lighthouse koşusu (CLI)
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

## 7. PR-8 sonrası

PR-8 merge edildiğinde:

1. **Tüm 8 PR tamamlandı.** Global kabul kriterleri (PR-IMPLEMENTATION-INDEX bölüm 5) doğrulanır.
2. `docs/PROGRESS.md` final entry: `TASK-UI-RESTRUCTURE-COMPLETE - <tarih>`.
3. `docs/FRONTEND-RESTRUCTURING-PLAN.md` "COMPLETED" damgası alır.
4. `docs/RUNA-DESIGN-LANGUAGE.md` yeni dilin tek source of truth'u olur.
5. PR-1 → PR-8 brief'leri `docs/frontend mimar/archive/2026-05-ui-restructure/` altına taşınır.

UI restructure süreci böylece kapanır.

---

> Bu son brief'tir. Tek bir cümle hedefi var: Runa'yı tüketici-grade AI ürün seviyesine getirmek için son rötuş.
