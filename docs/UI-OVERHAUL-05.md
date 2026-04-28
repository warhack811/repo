# UI-OVERHAUL-05 — Mobile-First Responsive Audit

> Bu belge tek başına IDE LLM görev prompt'udur.
> UI-OVERHAUL-04 (chat visual hierarchy) kapanmadan başlanmaz.

## Ürün Amacı

Manifesto "mobil-öncelikli, chat-first" diyor. Bugün repo desktop-merkezli görünüyor. Bu görev her surface'ı 320/414/768/1280 viewport matrisine sokar, composer/sidebar/modal mobile UX'lerini fix'ler ve Playwright screenshot kanıtı bırakır.

Hedef: rakip mobile (iOS/Android Safari/Chrome) deneyimine yakın akıcılık.

## Rakip Çıtası

- ChatGPT iOS/Android: composer sticky bottom, virtual keyboard occlusion handled, sidebar overlay
- Claude mobile: minimal header, swipe-to-sidebar, message list scroll preserved
- Linear mobile: bottom sheet patterns, touch target ≥44px

## Görev Bilgileri

- **Sprint:** UI Overhaul — **Track:** Track C
- **Görev:** Mobile-first responsive audit + composer/sidebar/modal mobile UX
- **Modül:** `apps/web`
- **KARAR.MD Maddesi:** Presentation, UI/UX manifesto

## Bağlam

- [ChatLayout.tsx](../apps/web/src/components/chat/ChatLayout.tsx) — sidebar `isSidebarOpen` prop var ama implementasyon hâlâ "sidebar her zaman görünür"
- [ChatComposerSurface.tsx](../apps/web/src/components/chat/ChatComposerSurface.tsx) 367 satır
- [ConversationSidebar.tsx](../apps/web/src/components/chat/ConversationSidebar.tsx) 460 satır
- Playwright config mevcut [playwright.config.ts](../playwright.config.ts)

## Görev Detayı

### 1. ChatLayout mobile

- `<768px` viewport: sidebar collapsed, hamburger menu açar overlay
- Backdrop click + Escape close
- Body scroll lock sidebar açıkken
- Composer sticky bottom; safe-area-inset (iOS notch)

### 2. ChatComposerSurface mobile

- Virtual keyboard occlusion: `100dvh`, `interactionEvent` listener
- Submit button mobile'de FAB-like (44px min touch target)
- Voice input mobile'de primary affordance
- Attachment chip wrap

### 3. ConversationSidebar mobile

- Overlay variant: full-height, slide-in left
- Search/filter sticky top
- New conversation CTA prominent
- Backdrop blur + tap-to-close

### 4. RunaModal/RunaSheet responsive

- `<768px` modal → bottom sheet (RunaSheet kullanır)
- `>=768px` modal merkezde, max-width 600px
- Drag handle (mobile bottom sheet)
- Swipe-down-to-dismiss

### 5. AppShell + AppNav mobile

- Top bar: brand + active page indicator + menu
- Bottom nav (mobile only): chat / account
- `/developer` mobile'de bottom nav'da yok; menu içinden erişilir

### 6. Touch target audit

- Minimum 44x44px tüm interactive element'ler için
- Icon-only butonlar 44px hedef alanı (visual icon 24px)
- Spacing: hover state'lerin yerine focus + active state'ler mobile için

### 7. Typography responsive

- `clamp()` veya breakpoint-based scale
- Body text mobile'de min 16px (iOS auto-zoom önleme)
- Heading scale küçük viewport'larda compress

### 8. Visual regression matrix

`apps/web/tests/visual/`:
- `chat-mobile.spec.ts` — 320, 414 viewport
- `chat-tablet.spec.ts` — 768
- `chat-desktop.spec.ts` — 1280, 1440
- Senaryolar: empty state, mid-conversation, streaming, approval pending, sidebar open

Screenshot baseline `tests/visual/__screenshots__/` altında. PR'da diff.

### 9. Lighthouse mobile audit

```powershell
pnpm.cmd --filter @runa/web exec lighthouse http://localhost:5173 --preset=mobile --output=html --output-path=./lighthouse-mobile.html
```

Hedef: Performance 90+, Accessibility 95+. Skor uydurma; gerçek skor raporlanır.

## Sınırlar (Yapma Listesi)

- [ ] `apps/server/**`, `packages/**`, `apps/desktop-agent/**` dokunma
- [ ] Yeni dependency ekleme (Lighthouse zaten Playwright veya CLI üzerinden çalışır)
- [ ] Mobile için ayrı route/layout açma — responsive single source
- [ ] Native app (Capacitor/PWA) eklemek
- [ ] Server-side device detection
- [ ] `any`, `as any`, `@ts-ignore` kullanma

## Değiştirilebilecek Dosyalar

- `apps/web/src/components/chat/ChatLayout.tsx`
- `apps/web/src/components/chat/ChatComposerSurface.tsx`
- `apps/web/src/components/chat/ConversationSidebar.tsx`
- `apps/web/src/components/app/AppShell.tsx`
- `apps/web/src/components/app/AppNav.tsx`
- `apps/web/src/components/ui/RunaModal.tsx` + `*.module.css`
- `apps/web/src/components/ui/RunaSheet.tsx` + `*.module.css`
- `apps/web/src/styles/primitives.css` (responsive typography)
- `apps/web/src/styles/tokens.css` (breakpoint variables)
- `apps/web/tests/visual/**` (yeni)
- `playwright.config.ts` (visual project)
- `PROGRESS.md`

## Değiştirilmeyecek Dosyalar

- `apps/server/**`, `packages/**`, `apps/desktop-agent/**`
- `apps/web/src/components/developer/**`
- `apps/web/src/components/chat/blocks/**` (UI-OVERHAUL-04 source)

## Done Kriteri

- [ ] 320, 414, 768, 1280 viewport screenshot baseline kaydedildi
- [ ] Mobile sidebar overlay + backdrop + Escape PASS
- [ ] Composer sticky bottom + safe-area-inset PASS
- [ ] Modal `<768px` bottom sheet, `>=768px` merkezi PASS
- [ ] Touch target ≥44px audit PASS
- [ ] Body text ≥16px mobile (iOS auto-zoom önleme) PASS
- [ ] Lighthouse mobile Performance 90+ veya neden raporlandı
- [ ] Lighthouse mobile Accessibility 95+ veya neden raporlandı
- [ ] `pnpm.cmd --filter @runa/web typecheck/lint/build/test` PASS
- [ ] `pnpm.cmd test:e2e` (Playwright visual) PASS
- [ ] PROGRESS.md kapanış notu

## Browser QA

```text
Browser QA:
- 320x568 (iPhone SE):  chat PASS, sidebar overlay PASS, composer sticky PASS
- 414x896 (iPhone 11):  chat PASS, modal bottom sheet PASS
- 768x1024 (iPad):      chat PASS, sidebar persistent PASS, modal centered PASS
- 1280x800:             chat PASS, all surfaces desktop layout PASS
- 1440x900:             chat PASS
Console errors: none
Lighthouse mobile: Perf=N, A11y=N (gerçek skor)
```

## Notlar

- Bu görev davranış değiştirmez; layout ve responsive yüzeyleri optimize eder.
- Visual regression baseline ilk PR'da çoktur; sonraki PR'larda diff bekleriz.
