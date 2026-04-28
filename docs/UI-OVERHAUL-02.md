# UI-OVERHAUL-02 — Design Tokens & CSS Architecture Foundation

> Bu belge tek başına IDE LLM görev prompt'udur.
> UI-OVERHAUL-01 kapanmadan başlanmaz.
> Başlamadan önce `apps/web/src/index.css` (1272 satır), `apps/web/src/lib/chat-styles.ts` (392 satır) ve `apps/web/src/components/ui/Runa*.tsx` okunmalıdır.

## Ürün Amacı

Bugün üç paralel styling kanalı çalışıyor: 51 dosyada inline `style={{}}`, 392 satır `chat-styles.ts` (TS-as-CSS), 1272 satır `index.css`. Bir component'i değiştirmek için "hangisine bakacağım?" sorusu yanıtsız. Bu görev tek kararlı yapı kurar: **CSS variables (tokens) + CSS Modules**. Hiçbir runtime CSS-in-JS dependency eklenmez.

Hedef: tüm renk, spacing, radius, shadow, motion ve typography değerleri tek `tokens.css` dosyasından gelir. Tema light/dark `data-theme` attribute'u ile switch'lenir. Mevcut görünüm korunur — sadece kaynağı tek noktaya çekilir.

## Rakip Çıtası

Linear, Vercel, Claude, Notion — hepsi token-driven theming kullanır. Renk paleti, spacing scale (4/8/12/16/24/32), radius scale (4/8/12/16/24), motion duration (fast/medium/slow) standart. Runa için token kataloğu olmadan polish çalışması her component'te tekrar tartışmaya açılır. Token'lar bu tartışmayı tek dosyaya kapatır.

## Görev Bilgileri

- **Sprint:** UI Overhaul — **Track:** Track C
- **Görev:** Design tokens + CSS architecture foundation
- **Modül:** `apps/web/src/styles/`
- **KARAR.MD Maddesi:** Presentation, UI/UX manifesto

## Bağlam

- **Mevcut CSS:**
  - [apps/web/src/index.css](../apps/web/src/index.css) 1272 satır, hem reset hem tema hem component
  - [apps/web/src/lib/chat-styles.ts](../apps/web/src/lib/chat-styles.ts) 392 satır TS-as-CSS object
  - 51 dosyada inline `style={{}}` ve `CSSProperties`
- **Mevcut primitives:** [apps/web/src/components/ui/Runa*.tsx](../apps/web/src/components/ui/) — RunaButton, RunaCard, RunaSurface, RunaTextarea, RunaBadge

## Görev Detayı

### 1. `apps/web/src/styles/` klasör yapısı

```
apps/web/src/styles/
  tokens.css           — tüm CSS variables (light + dark)
  reset.css            — modern CSS reset (Josh Comeau benzeri minimal)
  primitives.css       — typography baseline, focus ring, semantic defaults
  animations.css       — keyframes ve global animation utilities
  index.css            — yalnız @import sırası (eski apps/web/src/index.css yerine)
```

`apps/web/src/index.css` artık sadece `@import './styles/index.css'` veya tamamen `apps/web/src/styles/index.css` olur. Build entry uyumlu kalır.

### 2. `tokens.css` içeriği

```css
:root {
  /* Color — neutral */
  --color-bg-base: #ffffff;
  --color-bg-subtle: #f8fafc;
  --color-bg-elevated: #ffffff;
  --color-bg-overlay: rgba(0, 0, 0, 0.5);

  --color-fg-primary: #0f172a;
  --color-fg-secondary: #475569;
  --color-fg-muted: #94a3b8;
  --color-fg-disabled: #cbd5e1;
  --color-fg-inverse: #ffffff;

  --color-border-subtle: #e2e8f0;
  --color-border-default: #cbd5e1;
  --color-border-strong: #94a3b8;

  /* Color — brand & accent */
  --color-brand-primary: #3b82f6;
  --color-brand-hover: #2563eb;
  --color-brand-active: #1d4ed8;
  --color-brand-subtle: #eff6ff;

  /* Color — semantic */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-info: #06b6d4;

  /* Spacing — 4px base */
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;

  /* Typography */
  --font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', monospace;

  --text-xs: 12px;
  --text-sm: 14px;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 30px;
  --text-4xl: 36px;

  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;

  /* Shadow */
  --shadow-xs: 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow-md: 0 4px 12px rgba(15, 23, 42, 0.08);
  --shadow-lg: 0 12px 32px rgba(15, 23, 42, 0.12);
  --shadow-focus: 0 0 0 3px rgba(59, 130, 246, 0.4);

  /* Motion */
  --duration-fast: 120ms;
  --duration-medium: 220ms;
  --duration-slow: 360ms;
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-emphasized: cubic-bezier(0.2, 0, 0, 1);

  /* Z-index */
  --z-base: 0;
  --z-overlay: 100;
  --z-modal: 200;
  --z-toast: 300;
}

[data-theme='dark'] {
  --color-bg-base: #0a0f1c;
  --color-bg-subtle: #0f172a;
  --color-bg-elevated: #1e293b;
  --color-bg-overlay: rgba(0, 0, 0, 0.72);

  --color-fg-primary: #f8fafc;
  --color-fg-secondary: #cbd5e1;
  --color-fg-muted: #94a3b8;
  --color-fg-disabled: #475569;
  --color-fg-inverse: #0f172a;

  --color-border-subtle: rgba(148, 163, 184, 0.12);
  --color-border-default: rgba(148, 163, 184, 0.24);
  --color-border-strong: rgba(148, 163, 184, 0.48);

  --color-brand-subtle: rgba(59, 130, 246, 0.12);

  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.6);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    /* dark fallback — same as [data-theme='dark'] */
  }
}
```

### 3. `reset.css` (minimal modern)

Box-sizing, margin reset, line-height, image responsive, form inheritance, prefers-reduced-motion fallback.

### 4. `primitives.css`

Body typography baseline, focus-visible ring, semantic element defaults (h1-h6, p, ul, ol, blockquote, code, pre, table). Token referansları kullanır.

### 5. `animations.css`

Global keyframes: `fadeIn`, `slideUp`, `pulse`, `shimmer`. `prefers-reduced-motion` respect zorunlu.

### 6. CSS Modules etkinleştirme

Vite default olarak `*.module.css` algılar. Yeni component CSS'leri `*.module.css` olur (UI-OVERHAUL-03'te kullanılacak).

### 7. Mevcut `index.css` migration

- Tema değişkenleri → `tokens.css`
- Reset bloku → `reset.css`
- Component-specific blocklar (chat, sidebar, blocks, markdown, auth) → ilgili `*.css` dosyalarına ayrı ayrı
- Eski `index.css` kapsam küçülür; sonunda 200 satır altında

### 8. Theme toggle

`apps/web/src/lib/theme.ts`:
```ts
export type Theme = 'light' | 'dark' | 'system';

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function getStoredTheme(): Theme { /* localStorage */ }
export function storeTheme(theme: Theme): void { /* localStorage */ }
```

Settings sayfasında theme toggle eklenir (light/dark/system).

## Sınırlar (Yapma Listesi)

- [ ] CSS-in-JS runtime dependency ekleme (styled-components, emotion vs.)
- [ ] Tailwind ekleme — bu kararı vermek başka bir RFC ister; bu görev CSS variables + CSS Modules
- [ ] Mevcut componentlerin görsel davranışını değiştirme — sadece kaynak migration
- [ ] Inline style migration'ı bu görevde yapma — UI-OVERHAUL-03 kapsamı
- [ ] Tüm renkleri yeni paletle değiştirme; mevcut renkleri token isimleriyle haritala
- [ ] `chat-styles.ts` dosyasını silme — UI-OVERHAUL-03'te boşalacak ve silinecek
- [ ] `apps/server/**`, `packages/**`, `apps/desktop-agent/**` dokunma

## Değiştirilebilecek Dosyalar

- `apps/web/src/styles/tokens.css` (yeni)
- `apps/web/src/styles/reset.css` (yeni)
- `apps/web/src/styles/primitives.css` (yeni)
- `apps/web/src/styles/animations.css` (yeni)
- `apps/web/src/styles/index.css` (yeni — yalnız import sırası)
- `apps/web/src/index.css` (kapsam küçültme — bölündü)
- `apps/web/src/main.tsx` (CSS entry path güncelleme gerekebilir)
- `apps/web/src/lib/theme.ts` (yeni)
- `apps/web/src/components/ui/Runa*.tsx` (token referanslarını kullanacak şekilde minimal güncelleme)
- `apps/web/src/pages/SettingsPage.tsx` (theme toggle)
- `PROGRESS.md`

## Değiştirilmeyecek Dosyalar

- `apps/server/**`, `packages/**`, `apps/desktop-agent/**`
- Inline style kullanan 51 dosya (UI-OVERHAUL-03 kapsamı)
- `apps/web/src/lib/chat-styles.ts` (UI-OVERHAUL-03 kapsamında boşalacak)

## Done Kriteri

- [ ] `apps/web/src/styles/tokens.css` mevcut, light + dark tema tam
- [ ] `apps/web/src/styles/reset.css`, `primitives.css`, `animations.css` mevcut
- [ ] `index.css` kapsam altında, 200 satır altı
- [ ] Theme toggle SettingsPage'de çalışıyor
- [ ] `prefers-reduced-motion` respect ediliyor
- [ ] `pnpm.cmd --filter @runa/web typecheck` PASS
- [ ] `pnpm.cmd --filter @runa/web lint` PASS
- [ ] `pnpm.cmd --filter @runa/web build` PASS
- [ ] `pnpm.cmd --filter @runa/web test` PASS
- [ ] Browser QA 320/768/1440: light + dark theme PASS, görünüm regresyonu yok
- [ ] PROGRESS.md kapanış notu

## Notlar

- Token isimleri Linear/Radix Themes/Vercel design system konvansiyonuna yakın tutuldu (semantic naming, scale ölçeği).
- `--color-brand-primary` mevcut Runa renk paletine göre ayarlanır; hex değerleri placeholder.
- Bu görev sadece foundation kurar. Görsel polish UI-OVERHAUL-04 ve UI-OVERHAUL-06'da gelir.
