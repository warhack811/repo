# PR-1 Codex Brief â€” Tema, Tipografi, HafÄ±za Mark

> **Tarih:** 2026-05-13
> **Branch:** `codex/ui-restructure-pr-1-theme-typography-mark`
> **Worktree:** `.claude/worktrees/runa-ui-pr-1-theme`
> **Authority:** `docs/design/RUNA-DESIGN-BRIEF.md` v1.1 (yetki belgesi)
> **Hedef:** Tek PR ile Runa'nÄ±n gÃ¶rsel kimliÄŸini tamamen yeni dile geÃ§irmek. Layout aynÄ± kalÄ±r â€” kasÄ±tlÄ±.

---

## 1. Tek cÃ¼mle hedef

Bu PR'dan sonra chat sayfasÄ±nÄ± aÃ§an kullanÄ±cÄ±, **renk, font ve marka iÅŸaretinin** tamamen deÄŸiÅŸtiÄŸini hisseder. Layout, davranÄ±ÅŸ ve copy aynÄ± kalÄ±r; kuru gÃ¶rsel dÃ¶nÃ¼ÅŸÃ¼m.

## 2. Kapsam â€” YapÄ±lacaklar

### 2.1 Token swap (`apps/web/src/styles/tokens.css`)

Mevcut HSL-tabanlÄ± token'lar tamamen kaldÄ±rÄ±lÄ±yor; Ember Dark (default) + Ember Light (`[data-theme="light"]`) + Rose Dark (`[data-theme="rose-dark"]`) token aileleri eklenir.

Birebir kullanÄ±lacak token deÄŸerleri:

```css
:root, [data-theme="ember-dark"] {
  /* Surfaces */
  --surface-1: #14110D;
  --surface-2: #1E1A14;
  --surface-3: #2A241C;
  --surface-4: #332C22;
  --overlay: rgba(20, 17, 13, 0.82);

  /* Ink */
  --ink-1: #E8DFCD;
  --ink-2: #B9AE99;
  --ink-3: #9A8C76;   /* WCAG: yalnÄ±z â‰¥18px veya â‰¥14px+600 */

  /* Accents */
  --accent: #E0805C;
  --accent-2: #F4A876;
  --accent-bg: #2A1E15;

  /* Status */
  --status: #8FA277;
  --status-bg: #1D2618;
  --warn: #D4A055;
  --warn-bg: #2A2118;
  --error: #C97064;
  --error-bg: #2A1A18;

  /* User message */
  --user-bg: #E8DFCD;
  --user-fg: #14110D;

  /* Lines */
  --hairline: rgba(232, 223, 205, 0.08);

  /* Shadow */
  --shadow: 0 22px 56px rgba(0, 0, 0, 0.34);

  /* Radius â€” sadeleÅŸtirildi */
  --radius-panel: 14px;
  --radius-input: 12px;
  --radius-pill: 999px;

  /* Type scale */
  --text-xs: 11px;
  --text-sm: 13px;
  --text-md: 14.5px;
  --text-lg: 18px;
  --text-xl: 22px;
  --text-2xl: 32px;

  /* Motion */
  --duration-fast: 120ms;
  --duration-normal: 180ms;
  --duration-slow: 220ms;
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-emphasized: cubic-bezier(0.16, 1, 0.3, 1);
}

[data-theme="ember-light"] {
  --surface-1: #F6F1E8;
  --surface-2: #EDE6D6;
  --surface-3: #DFD5BE;
  --surface-4: #D0C8AD;
  --overlay: rgba(246, 241, 232, 0.82);
  --ink-1: #1F1B16;
  --ink-2: #3A332A;
  --ink-3: #5F564A;
  --accent: #B85A3C;
  --accent-2: #D97757;
  --accent-bg: #F0E0D2;
  --status: #6B7A5C;
  --status-bg: #E2E9D8;
  --warn: #9E6F2A;
  --warn-bg: #F2EAD7;
  --error: #A14638;
  --error-bg: #F2E0DC;
  --user-bg: #1F1B16;
  --user-fg: #F6F1E8;
  --hairline: rgba(31, 27, 22, 0.10);
  --shadow: 0 20px 48px rgba(45, 35, 23, 0.14);
}

[data-theme="rose-dark"] {
  --surface-1: #18110F;
  --surface-2: #211719;
  --surface-3: #2E2122;
  --surface-4: #3A292B;
  --overlay: rgba(24, 17, 15, 0.84);
  --ink-1: #EFDCD8;
  --ink-2: #C2A8A5;
  --ink-3: #8A7370;
  --accent: #D88C8C;
  --accent-2: #ECAAA8;
  --accent-bg: #2D1D1F;
  --status: #B5A87A;
  --status-bg: #282719;
  --warn: #D4A055;
  --warn-bg: #2A2118;
  --error: #C97064;
  --error-bg: #2A1A18;
  --user-bg: #EFDCD8;
  --user-fg: #18110F;
  --hairline: rgba(239, 220, 216, 0.08);
}

/* Sistem tema takibi */
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    /* ember-light token'larÄ±nÄ± inherit eder; opsiyonel: ayrÄ±ca `prefers-color-scheme` fallback */
  }
}
```

**Eski tokenlar:** TÃ¼m `--color-bg-*`, `--color-surface-*`, `--color-border-*`, `--color-text-*`, `--gradient-*`, `--color-accent`, `--color-action-*`, `--color-info-*` token'larÄ± **silinir**. AÅŸaÄŸÄ±daki migration adÄ±mÄ±yla referanslarÄ± temizle.

### 2.2 Token reference migration

Mevcut CSS dosyalarÄ±nda eski token referanslarÄ± yeni token'lara map edilir. Mappings:

| Eski | Yeni |
|---|---|
| `hsl(var(--color-bg))` | `var(--surface-1)` |
| `hsl(var(--color-bg-elevated) / *)` | `var(--surface-2)` |
| `hsl(var(--color-bg-soft))` / `var(--color-surface-overlay)` | `var(--surface-3)` |
| `hsl(var(--color-surface-strong))` | `var(--surface-4)` |
| `hsl(var(--color-text))` | `var(--ink-1)` |
| `hsl(var(--color-text-muted))` | `var(--ink-2)` |
| `hsl(var(--color-text-soft))` | `var(--ink-3)` |
| `hsl(var(--color-accent) / *)` | `var(--accent)` veya `var(--accent-bg)` |
| `hsl(var(--color-border) / *)` | `var(--surface-3)` veya `var(--hairline)` |
| `var(--gradient-panel)` ve diÄŸer gradient alias'larÄ± | flat `var(--surface-2)` |
| `var(--radius-soft)` | `var(--radius-input)` |
| `var(--radius-panel)` | (aynÄ±, deÄŸer 16â†’14) |

Etkilenen dosyalar (eksiksiz liste):
- `apps/web/src/styles/tokens.css` (yeniden yazÄ±lÄ±r)
- `apps/web/src/styles/primitives.css`
- `apps/web/src/styles/components.css`
- `apps/web/src/styles/animations.css`
- `apps/web/src/styles/routes/*.css` (10 dosya)
- `apps/web/src/components/**/*.module.css` (tÃ¼m modÃ¼ller)

**Sed yerine TypeScript codemod tercih edilir** (`scripts/migrate-tokens.mjs` â€” opsiyonel, ama hÄ±z iÃ§in Ã¶nerilir). Manuel grep+replace de kabul.

### 2.3 Tipografi (`apps/web/src/styles/fonts.css`)

Mevcut font dosyasÄ± **tamamen yeniden yazÄ±lÄ±r**:

```css
/* Inter â€” body, variable font tercih edilir */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400 800;
  font-display: swap;
  src: url('/fonts/Inter.var.woff2') format('woff2-variations');
}

/* Instrument Serif â€” karakter, agent ismi, hero */
@font-face {
  font-family: 'Instrument Serif';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/InstrumentSerif-Regular.woff2') format('woff2');
}

@font-face {
  font-family: 'Instrument Serif';
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/InstrumentSerif-Italic.woff2') format('woff2');
}

/* JetBrains Mono â€” kod, tool input/output */
@font-face {
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 400 600;
  font-display: swap;
  src: url('/fonts/JetBrainsMono.var.woff2') format('woff2-variations');
}

:root {
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-serif: 'Instrument Serif', Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
}

body {
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
```

**Font dosyalarÄ±:** `apps/web/public/fonts/` altÄ±na Inter.var.woff2, InstrumentSerif-Regular.woff2, InstrumentSerif-Italic.woff2, JetBrainsMono.var.woff2 yerleÅŸtir. Boyut hedefi: toplam â‰¤220 KB woff2.

**index.html gÃ¼ncellemesi:** `<link rel="preload">` yalnÄ±z Inter (kritik path) + Instrument Serif Regular iÃ§in.

### 2.4 Hafıza Mark component

Yeni dosya: `apps/web/src/components/ui/HafizaMark.tsx`

Path verisi `docs/design/logo-pack/` altındaki 6 SVG dosyasından çıkarılır ve component içine inline edilir (runtime fetch yok). Path setleri `docs/design/artifacts/runa-complete-product-mock.html:464-503` referans implementasyonundan birebir alınır.

```typescript
import type { ReactElement } from 'react';

export type HafizaMarkWeight = 'micro' | 'regular' | 'bold';
export type HafizaMarkVariant = 'brand' | 'mono';

type HafizaMarkProps = Readonly<{
  weight?: HafizaMarkWeight;
  variant?: HafizaMarkVariant;
  className?: string;
  'aria-label'?: string;
}>;

const markPaths: Record<HafizaMarkWeight, readonly string[]> = {
  micro: [
    'M24 5 C27.2 5 29.6 7.3 29.6 10.6 C29.6 13.7 27.3 16 24 16 C20.8 16 18.4 13.7 18.4 10.6 C18.4 7.3 20.8 5 24 5 Z',
    'M33.8 10.8 C36.9 11.1 39.1 13.9 38.8 17 C38.5 20 35.8 22.1 32.8 21.8 C29.7 21.5 27.6 18.9 27.9 15.8 C28.2 12.8 30.8 10.6 33.8 10.8 Z',
    'M35 27.1 C37.5 28.7 38.3 31.9 36.8 34.5 C35.2 37.2 32 38 29.4 36.5 C26.8 35 26 31.7 27.6 29.1 C29.1 26.5 32.4 25.6 35 27.1 Z',
    'M24.2 31.6 C27.3 31.7 29.7 34.2 29.6 37.2 C29.5 40.3 27 42.7 24 42.6 C20.9 42.5 18.5 40 18.6 37 C18.7 33.9 21.1 31.5 24.2 31.6 Z',
    'M12.9 27.3 C15.6 25.9 18.8 26.9 20.2 29.6 C21.6 32.3 20.6 35.5 17.9 36.9 C15.2 38.2 12 37.2 10.6 34.5 C9.2 31.8 10.2 28.7 12.9 27.3 Z',
    'M14.3 11 C17.4 10.8 20 13 20.3 16 C20.6 19.1 18.4 21.7 15.3 22 C12.3 22.3 9.6 20.1 9.3 17 C9 14 11.2 11.3 14.3 11 Z',
  ],
  regular: [
    'M24 4 C27.9 4 31 7.1 31 11 C31 14.8 27.9 18 24 18 C20.1 18 17 14.8 17 11 C17 7.1 20.1 4 24 4 Z',
    'M34 10 C37.8 10.2 40.6 13.3 40.3 17.2 C40.1 20.8 37 23.6 33.2 23.3 C29.3 23.1 26.5 20 26.8 16.2 C27 12.3 30.1 9.6 34 10 Z',
    'M35 27 C38.2 28.8 39.2 32.8 37.4 36 C35.6 39.2 31.7 40.2 28.5 38.4 C25.3 36.6 24.2 32.7 26 29.5 C27.8 26.3 31.8 25.2 35 27 Z',
    'M24 30 C27.9 30 31 33.1 31 37 C31 40.9 27.9 44 24 44 C20.1 44 17 40.9 17 37 C17 33.1 20.1 30 24 30 Z',
    'M13 27 C16.2 25.2 20.2 26.3 22 29.5 C23.8 32.7 22.7 36.6 19.5 38.4 C16.3 40.2 12.4 39.2 10.6 36 C8.8 32.8 9.8 28.8 13 27 Z',
    'M14 10 C17.9 9.6 21 12.3 21.4 16.2 C21.8 20 19 23.1 15.2 23.5 C11.3 23.9 8.2 21.2 7.8 17.4 C7.4 13.5 10.2 10.4 14 10 Z',
  ],
  bold: [
    'M24 3.5 C28.5 3.5 32 7.2 32 11.7 C32 16 28.5 19.6 24 19.6 C19.5 19.6 16 16 16 11.7 C16 7.2 19.5 3.5 24 3.5 Z',
    'M34.3 9.7 C38.6 10 41.8 13.6 41.5 17.9 C41.2 22 37.6 25.1 33.5 24.8 C29.2 24.5 26.1 20.9 26.4 16.6 C26.7 12.5 30.2 9.4 34.3 9.7 Z',
    'M35.6 26.4 C39.2 28.4 40.5 33 38.5 36.7 C36.5 40.3 32 41.5 28.3 39.5 C24.7 37.5 23.4 32.9 25.4 29.3 C27.4 25.6 31.9 24.4 35.6 26.4 Z',
    'M24 29.8 C28.5 29.8 32 33.4 32 37.9 C32 42.4 28.5 46 24 46 C19.5 46 16 42.4 16 37.9 C16 33.4 19.5 29.8 24 29.8 Z',
    'M12.4 26.4 C16.1 24.4 20.6 25.6 22.6 29.3 C24.6 32.9 23.3 37.5 19.7 39.5 C16 41.5 11.5 40.3 9.5 36.7 C7.5 33 8.8 28.4 12.4 26.4 Z',
    'M13.7 9.7 C17.8 9.3 21.3 12.2 21.8 16.4 C22.2 20.5 19.2 24.1 15.1 24.5 C10.9 24.9 7.4 21.9 7 17.8 C6.6 13.6 9.5 10.1 13.7 9.7 Z',
  ],
};

const brandPalette = [
  'var(--accent)',
  'var(--accent-2)',
  '#9A9273',
  'var(--accent)',
  'var(--accent-2)',
  '#8E896E',
] as const;

const brandOpacity = [1, 0.94, 0.92, 0.9, 0.88, 0.9] as const;

export function HafizaMark({
  weight = 'regular',
  variant = 'brand',
  className,
  'aria-label': ariaLabel,
}: HafizaMarkProps): ReactElement {
  const paths = markPaths[weight];
  const isMono = variant === 'mono';
  const ariaProps = ariaLabel
    ? { role: 'img' as const, 'aria-label': ariaLabel }
    : { 'aria-hidden': true as const };

  return (
    <span className={className ?? 'runa-mark'} {...ariaProps}>
      <svg viewBox="0 0 48 48" fill="none">
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill={isMono ? 'currentColor' : brandPalette[i]}
            opacity={isMono ? 1 : brandOpacity[i]}
          />
        ))}
      </svg>
    </span>
  );
}
```

Eski compass/sun SVG'sini silenecek yerler:
- `apps/web/src/components/auth/*` — login logo → `<HafizaMark weight="bold" variant="brand" aria-label="Runa" />`
- `apps/web/src/components/onboarding/*` — welcome mark → `<HafizaMark weight="bold" variant="brand" aria-label="Runa" />`
- `apps/web/src/components/chat/ChatHeader.tsx` — brand badge → `<HafizaMark weight="regular" variant="brand" />`
- `apps/web/src/components/chat/EmptyState.tsx` — hero mark (yeni) → `<HafizaMark weight="bold" variant="brand" aria-hidden="true" />`

Kaynak SVG dosyaları (`docs/design/logo-pack/*.svg`) referans olarak korunur; component runtime'da kullanmaz.


### 2.5 Empty state hero baÅŸlÄ±ÄŸÄ± (basit ekleme)

`apps/web/src/components/chat/EmptyState.tsx` â€” Instrument Serif hero baÅŸlÄ±k + HafÄ±za mark eklenir:

```tsx
<section className={styles.heroEmpty}>
  <HafizaMark weight="bold" variant="brand" className={styles.heroMark} />
  <h1 className={styles.heroTitle}>{getGreeting()}</h1>
  <p className={styles.heroLead}>BugÃ¼n neyi halledelim?</p>
  {/* Mevcut 4 Ã¶neri chip'i altta kalÄ±r */}
</section>
```

`getGreeting()` saate gÃ¶re TR string dÃ¶ner:
- 05:00-11:59 â†’ "GÃ¼naydÄ±n"
- 12:00-17:59 â†’ "Ä°yi gÃ¼nler"
- 18:00-22:59 â†’ "Ä°yi akÅŸamlar"
- 23:00-04:59 â†’ "GeÃ§ oldu"

### 2.6 `DesignLanguageLock.test.ts` yeniden yazÄ±mÄ±

**Mevcut lock test silinir; yeni dile gÃ¶re yeniden yazÄ±lÄ±r.** Yeni test ÅŸu kurallarÄ± kilitler:

- `tokens.css` iÃ§inde `--surface-1 #14110D`, `--accent #E0805C`, `--ink-3 #9A8C76` token'larÄ± var.
- `--font-serif: 'Instrument Serif'` tanÄ±mÄ± var.
- `HafizaMark` component'i `apps/web/src/components/ui/HafizaMark.tsx`'te export edilir, 3 weight Ã— 2 variant API'sÄ± taÅŸÄ±r.
- `apps/web/src/components/chat/EmptyState.tsx` import'unda `HafizaMark` referansÄ± vardÄ±r.
- Eski `--color-bg`, `--color-accent`, `--gradient-panel` token'larÄ± **artÄ±k yok**.
- `--ink-3` kullanÄ±mÄ± iÃ§in lint guard: kÃ¼Ã§Ã¼k metin (<18px ve <600 weight) iÃ§in izin verilmez (CSS regex ile dosya bazlÄ± tarama).

Yeni file: `apps/web/src/test/design-language-lock.test.ts` (mevcut `apps/web/src/pages/DesignLanguageLock.test.ts` yerine; lokasyon test stratejisini netleÅŸtirir).

---

## 3. Kapsam dÄ±ÅŸÄ± â€” Bu PR'da YAPMA

- âŒ Layout deÄŸiÅŸtirme (sidebar, top bar, right rail, composer pozisyonu) â†’ PR-2'de.
- âŒ ChatPage component'inde mount/unmount sÄ±rasÄ± deÄŸiÅŸikliÄŸi â†’ PR-3'te.
- âŒ Approval kart yapÄ±sÄ± deÄŸiÅŸikliÄŸi â†’ PR-4'te.
- âŒ ToolResult / error mesajlarÄ± kopya deÄŸiÅŸikliÄŸi â†’ PR-5'te.
- âŒ Sheet sistemi, command palette â†’ PR-6'da.
- âŒ Settings sayfasÄ± yeniden yazÄ±mÄ± â†’ PR-7'de.
- âŒ iOS `visualViewport` hook â†’ PR-8'de.
- âŒ Token deduplication (`--text-lg/xl/2xl` Ã¶lÃ§ek daraltma) â†’ PR-8'de.

**EÄŸer bir dosya deÄŸiÅŸikliÄŸi bu listeden bir kategoriye giriyorsa, PR-1'e DAHÄ°L ETMEYÄ°N. Disiplini koru.**

---

## 4. Kabul Kriteri

PR-1 merge edilmeden Ã¶nce ÅŸu ÅŸartlar PASS olmalÄ±:

### 4.1 Otomatik kontroller (CI)

- [ ] `pnpm --filter @runa/web lint` â†’ PASS
- [ ] `pnpm --filter @runa/web typecheck` â†’ PASS
- [ ] `pnpm --filter @runa/web test` â†’ PASS (yeni lock test dahil)
- [ ] `pnpm --filter @runa/web build` â†’ PASS, font payload â‰¤220 KB
- [ ] `apps/web` iÃ§inde eski token referansÄ± (`--color-bg`, `--gradient-panel`, vs.) **sÄ±fÄ±r** (grep sonucu boÅŸ)

### 4.2 GÃ¶rsel kanÄ±t (zorunlu)

`docs/design-audit/screenshots/` altÄ±na commit:

- [ ] `desktop-1440-chat-empty-ember-dark.png`
- [ ] `desktop-1440-chat-empty-ember-light.png`
- [ ] `desktop-1440-chat-empty-rose-dark.png`
- [ ] `desktop-1440-chat-active-transcript-ember-dark.png`
- [ ] `desktop-1440-login-ember-dark.png`
- [ ] `desktop-1440-onboarding-ember-dark.png`
- [ ] `mobile-390-chat-empty-ember-dark.png`
- [ ] `mobile-390-chat-empty-rose-dark.png`

### 4.3 Ä°nsan-review kabul

- [ ] Eski compass/sun SVG **hiÃ§bir** ekran gÃ¶rÃ¼ntÃ¼sÃ¼nde yok.
- [ ] HafÄ±za mark Ã¼Ã§ farklÄ± weight'ta gÃ¶rÃ¼nÃ¼r (auth bold, sidebar regular, mobile micro).
- [ ] Empty state hero baÅŸlÄ±ÄŸÄ± Instrument Serif rendering yapar (Inter deÄŸil).
- [ ] Inline code chip'i (composer'da `pnpm dev` yazÄ±nca veya markdown'da) JetBrains Mono rendering yapar.
- [ ] Rose Dark temasÄ± accent'i pembe-bal (`#D88C8C`) tonu verir.
- [ ] Ember Light temasÄ± beyaz deÄŸil **warm paper** (`#F6F1E8`) zemin verir.
- [ ] Tema swap'i `data-theme` attribute set'iyle anÄ±nda Ã§alÄ±ÅŸÄ±r (page reload gerektirmez).

### 4.4 Performans

- [ ] Lighthouse Performance â‰¥85 (mobile, 4G simulated).
- [ ] First Contentful Paint â‰¤1.5s (cached fonts).
- [ ] Cumulative Layout Shift â‰¤0.1 (font swap nedeniyle layout sÄ±Ã§ramasÄ± olmamalÄ±).

---

## 5. Risk ve geri-alma

### Riskler

| Risk | Etki | Mitigation |
|---|---|---|
| Token migration eksik kalÄ±r â†’ gÃ¶rsel bozuklar | YÃ¼ksek | Codemod kullan; CI'da eski token referansÄ± iÃ§in grep-fail step ekle. |
| Font yÃ¼kleme yavaÅŸ â†’ FOIT/FOUT | Orta | `font-display: swap`, kritik fontlarÄ± `<link rel="preload">`. |
| `DesignLanguageLock.test.ts` mevcut test'lerle Ã§akÄ±ÅŸÄ±r | DÃ¼ÅŸÃ¼k | Eski dosya silinir, yeni dosya farklÄ± path'te oluÅŸturulur. |
| `prefers-color-scheme` Ember Light otomatik geÃ§iÅŸi istenmeyen davranÄ±ÅŸ | DÃ¼ÅŸÃ¼k | Ä°lk versiyonda otomatik geÃ§iÅŸ kapalÄ±; Settings'ten manuel seÃ§im (PR-7). |

### Geri-alma planÄ±

PR-1 merge sonrasÄ± kritik bir gÃ¶rsel regression Ã§Ä±karsa:
1. `git revert <commit-sha>` ile token + font + mark deÄŸiÅŸiklikleri geri alÄ±nÄ±r.
2. CI yeÅŸil â†’ ana dal eski hÃ¢line dÃ¶ner.
3. DÃ¼zeltme ayrÄ± bir PR-1.1 olarak aÃ§Ä±lÄ±r.

Tek-PR yapÄ±sÄ± sayesinde geri-alma temiz; baÅŸka PR'a baÄŸÄ±mlÄ±lÄ±k yok.

---

## 6. Yetki ve doÄŸrulama

- **Yetki belgesi:** `docs/design/RUNA-DESIGN-BRIEF.md` v1.1. Bu dokÃ¼man Ã¶nceliklidir.
- **Bu brief ile brief arasÄ±nda Ã§akÄ±ÅŸma olursa:** Brief kazanÄ±r. Bu dokÃ¼man implementation rehberi, brief karar belgesidir.
- **Review akÄ±ÅŸÄ±:** PR aÃ§Ä±ldÄ±ÄŸÄ±nda Claude'a review iÃ§in linki gÃ¶nder. Claude gÃ¶rsel + kontrat + risk review yapar, kullanÄ±cÄ±ya raporlar. KullanÄ±cÄ± merge/revize kararÄ± verir.

---

## 7. Komutlar (Codex iÃ§in hÄ±zlÄ± referans)

```bash
# Worktree aÃ§Ä±lÄ±ÅŸÄ±
cd D:/ai/Runa
git worktree add .claude/worktrees/runa-ui-pr-1-theme codex/ui-restructure-pr-1-theme-typography-mark

# GeliÅŸtirme
cd .claude/worktrees/runa-ui-pr-1-theme
pnpm install
pnpm --filter @runa/web dev   # localhost:5173

# DoÄŸrulama
pnpm --filter @runa/web lint
pnpm --filter @runa/web typecheck
pnpm --filter @runa/web test
pnpm --filter @runa/web build

# Eski token kontrol (CI'da fail eden grep)
grep -r "var(--color-bg" apps/web/src/styles apps/web/src/components || echo "PASS: no legacy tokens"

# GÃ¶rsel kanÄ±t (Playwright smoke)
pnpm --filter @runa/web exec playwright test e2e/visual-pr-1-theme.spec.ts
```

---

> Bu brief Codex'e doÄŸrudan verilir. Soru / belirsizlik Ã§Ä±karsa Codex iÅŸ baÅŸlamadan kullanÄ±cÄ±ya sorar; tahmin yapmaz.



