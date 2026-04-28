# UI-OVERHAUL-06 — Brand Polish & Onboarding

> Bu belge tek başına IDE LLM görev prompt'udur.
> UI-OVERHAUL-05 (mobile responsive) kapanmadan başlanmaz.

## Ürün Amacı

Bu görev "rakip seviyesi UI" iddiasının görünür kapanışıdır. Custom font, motion choreography, skeleton loading states, post-signup onboarding wizard ve LoginPage'in 487→200 satır küçültülmesiyle Runa "ciddi ürün" hissini taşır.

Hedef: yeni kullanıcı login → onboarding → ilk run akışı 60 saniye altında, akıcı, marka hisli ve memnun edici.

## Rakip Çıtası

- **Linear:** Inter font, motion choreography, skeleton states
- **Notion:** post-signup wizard (workspace, ilk sayfa, ekip davet)
- **Claude:** sade login, hero copy + 1 primary CTA
- **Vercel:** typography hierarchy, brand polish

## Görev Bilgileri

- **Sprint:** UI Overhaul — **Track:** Track C
- **Görev:** Brand polish + onboarding wizard + LoginPage simplification
- **Modül:** `apps/web`
- **KARAR.MD Maddesi:** Presentation, UI/UX manifesto, First-impression

## Bağlam

- [LoginPage.tsx](../apps/web/src/pages/LoginPage.tsx) 487 satır
- [AGENTS.md](../AGENTS.md) ve manifesto consumer-grade hissi vurguluyor
- [motion](../apps/web/package.json) paketi mevcut
- UI-OVERHAUL-04'te EmptyState onboarding-like oldu; bu görev pre-empty state'i (post-signup) kapsar

## Görev Detayı

### 1. Custom font (Inter)

- `apps/web/public/fonts/inter/` altında Inter variable font (Inter-Variable.woff2)
- `apps/web/src/styles/fonts.css`:
```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter/Inter-Variable.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-display: swap;
  font-style: normal;
}
```
- `tokens.css` `--font-sans` Inter
- JetBrains Mono (mono) opsiyonel; bu turda system mono yeter

### 2. Typography scale

- Heading scale: `clamp()` ile responsive
- Line-height tuning: heading `--leading-tight`, body `--leading-normal`
- Letter-spacing: heading hafif negative tracking
- `primitives.css` global type stack güncellenir

### 3. Motion choreography

- Page transition: route change'de subtle fade
- Message arrival: slide-up 220ms, ease-emphasized
- Approval reveal: scale 0.95→1 + fade
- Sidebar/modal: motion.ts variants kullanılır
- Streaming text: token-bazında bounce yok; cursor caret blink
- Reduced motion: tüm bunlar opacity-only fallback

### 4. Skeleton loading states

UI-OVERHAUL-03'te `RunaSkeleton` eklenmişti. Bu görev kullanım yerlerini aktif eder:
- Conversation list loading
- Message history loading
- Settings/account loading
- Device presence loading
- Memory summary loading

`aria-busy` + `role="status"` zorunlu.

### 5. Post-signup onboarding wizard

`apps/web/src/components/onboarding/OnboardingWizard.tsx`:
- 3-4 step modal/sheet:
  1. **Welcome:** brand cümle + "Hadi başlayalım"
  2. **Workspace:** workspace adı + amaç (kişisel/iş/araştırma)
  3. **Connect computer (opt-in):** "Masaüstü companion'ını şimdi kur" CTA + skip
  4. **First prompt:** segment kartları (UI-OVERHAUL-04 EmptyState ile aynı set)

State: localStorage `runa.onboarding.completed=true` veya backend user metadata.

### 6. LoginPage küçültme

[LoginPage.tsx](../apps/web/src/pages/LoginPage.tsx) 487 satırdan ~200 satıra:
- Hero: brand logo + tek cümle + 1 primary CTA (e-posta giriş)
- OAuth butonları (Google, GitHub) compact
- "Diğer giriş yöntemleri" disclosure → token-based dev login burada
- Auth notice/error inline, banner-like
- Loading state → RunaSpinner
- Mobile-first

### 7. Brand asset

- Logo SVG: `apps/web/src/assets/runa-logo.svg`
- Favicon update
- App icon (PWA-ready manifest opsiyonel)
- Brand colors `tokens.css` `--color-brand-*` finalize

### 8. Empty state ikonografi

- EmptyState segment kartlarında lucide-react veya custom SVG icon
- Hover state, focus state polished

### 9. Settings polish

- Settings sayfası tabs: Account / Preferences / Devices / Project Memory / Developer
- Theme toggle (UI-OVERHAUL-02'den)
- Voice preferences
- Account / sign out

### 10. Final QA pass

- Lighthouse desktop + mobile
- Visual regression baseline güncellenir
- Browser console error 0
- a11y smoke (axe-core)

## Sınırlar (Yapma Listesi)

- [ ] `apps/server/**`, `packages/**`, `apps/desktop-agent/**` dokunma
- [ ] Yeni feature açma (onboarding wizard sadece UI; backend metadata write opsiyonel ve UI-OVERHAUL kapsamı dışı kalabilir)
- [ ] Yeni dependency ekleme (lucide-react ve motion zaten var)
- [ ] Backend onboarding state için API kontratı tanımlamak — bu kapsam dışı; localStorage yeterli
- [ ] `any`, `as any`, `@ts-ignore` kullanma
- [ ] Custom font için CDN bağımlılığı (CSP açısından local self-host tercih)

## Değiştirilebilecek Dosyalar

- `apps/web/public/fonts/**`
- `apps/web/src/styles/fonts.css` (yeni)
- `apps/web/src/styles/tokens.css`
- `apps/web/src/styles/primitives.css`
- `apps/web/src/styles/animations.css`
- `apps/web/src/lib/motion.ts`
- `apps/web/src/components/onboarding/**` (yeni)
- `apps/web/src/components/chat/EmptyState.tsx`
- `apps/web/src/components/ui/RunaSkeleton.tsx` (kullanım yerlerini aktive et)
- `apps/web/src/pages/LoginPage.tsx` (küçültme)
- `apps/web/src/pages/SettingsPage.tsx` (tabs)
- `apps/web/src/assets/runa-logo.svg` (yeni)
- `apps/web/index.html` (favicon, meta)
- `PROGRESS.md`

## Değiştirilmeyecek Dosyalar

- `apps/server/**`, `packages/**`, `apps/desktop-agent/**`
- `apps/web/src/components/developer/**`
- `apps/web/src/components/chat/blocks/**` (UI-OVERHAUL-04 source)

## Done Kriteri

- [ ] Inter font self-host, font-display swap PASS
- [ ] Typography scale token-driven, responsive
- [ ] Motion choreography prefers-reduced-motion respect
- [ ] Skeleton loading state'leri 5+ yerde aktif
- [ ] Onboarding wizard post-signup ilk açılışta render
- [ ] LoginPage <250 satır
- [ ] Brand assets (logo SVG, favicon) yerinde
- [ ] Settings tabs polished
- [ ] Lighthouse desktop Perf 90+, A11y 95+
- [ ] Lighthouse mobile Perf 90+, A11y 95+
- [ ] axe-core a11y smoke PASS
- [ ] `pnpm.cmd --filter @runa/web typecheck/lint/build/test` PASS
- [ ] Visual regression PASS
- [ ] PROGRESS.md kapanış notu — UI overhaul series tamamlandı

## Browser QA

```text
Browser QA (final):
- 320x568:  login PASS, onboarding PASS, chat PASS, settings PASS
- 768x1024: full surface PASS
- 1440x900: full surface PASS, brand polish gözle PASS
Console errors: 0
Lighthouse desktop: Perf/A11y/BP/SEO scores
Lighthouse mobile:  Perf/A11y/BP/SEO scores
axe-core: 0 violations
```

## Notlar

- Bu görev tamamlandığında `UI-OVERHAUL` serisi kapanır.
- Lighthouse skoru uydurma; gerçek skor raporlanır. <90 ise neden raporlanır ve takip görevi açılır.
- Custom font yüklemesi flash-of-unstyled-text yaratmamalı; `font-display: swap` + system fallback.
