# UI-PHASE-7 - Animasyon, Polish, Accessibility ve Release-Grade UI QA

> Bu belge tek basina IDE LLM gorev prompt'udur. FAZ 1-6 tamamlanmis veya repo esdeger UI/product zeminine sahip olmalidir.
> Baslamadan once `AGENTS.md`, `implementation-blueprint.md`, `docs/TASK-TEMPLATE.md`, `PROGRESS.md` ve tum UI faz kapanis notlari okunmalidir.

## Urun Amaci

Bu faz Runa'nin UI deneyimini kapali testte utanmadan gosterilebilir seviyeye tasir. Hedef sadece animasyon eklemek degildir. Hedef ilk karsilasma, chat akisi, research/source yuzeyleri, approval, desktop device presence, settings ve long-running task progress icin olculur polish ve QA kapisi kurmaktir.

Bu faz tamamlanmadan "UI rakip seviyesine yaklasti" iddiasi acilmaz.

## Rakip Citasi ve Runa Farki

Rakip seviyesinde artik beklenenler:

- ChatGPT Projects: calisma alanini hatirlayan, dosya/talimat/sohbet baglamini toparlayan yuzey.
- Deep Research: plan, ilerleme, kaynak secimi, interrupt ve citation/report kalitesi.
- Claude Computer Use / Manus Browser Operator: izin, kontrol, log, durdurma ve desktop/browser aksiyon guveni.
- Comet: browser icinde anlasilir, delegasyon odakli, kullaniciya ne yapabilecegini ilk anda anlatan deneyim.

Runa'nin farki: tum bu kabiliyetleri dashboard karmasasina dusmeden chat-first, natural-language-first ve guvenli approval modeliyle sunmak.

Kaynakli referanslar:

- ChatGPT Projects: https://help.openai.com/en/articles/10169521
- ChatGPT Deep Research: https://help.openai.com/articles/10500283
- Claude Research: https://www.anthropic.com/news/research
- Claude Computer Use: https://docs.anthropic.com/en/docs/build-with-claude/computer-use
- Manus Browser Operator: https://manus.im/docs/features/browser-operator
- Perplexity Comet: https://www.perplexity.ai/comet/

## Gorev Bilgileri

- **Sprint:** Core Hardening Phase 2 - Track C
- **Gorev:** UI polish, motion, a11y, performance ve release-grade QA gate
- **Modul:** `apps/web`
- **KARAR.MD Maddesi:** Presentation, Human Ops, Release readiness

## Baglam

- **Ilgili interface:** UI fazlari boyunca eklenen componentler ve mevcut runtime/WS/auth yuzeyleri
- **Referans dosyalar:** `apps/web/src/components/chat/**`, `apps/web/src/components/ui/**`, `apps/web/src/pages/**`, `apps/web/src/App.tsx`, `apps/web/src/index.css`, `playwright.config.ts`
- **Kritik kural:** Bu faz davranis degistirmek icin degil, mevcut deneyimi dogrulamak ve polish etmek icindir. Yeni buyuk feature acma.

## Kural Esnetme Notu

FAZ 1'de onaylanmis ise `motion` kullanilabilir. Motion yoksa:

- Yeni dependency eklemek icin mini RFC kapisini uygula.
- Alternatif olarak CSS transition/animation ile ilerle.

Animasyonlar performans ve a11y'yi gecemez. `prefers-reduced-motion` zorunludur.

## Gorev 7A - UI QA Envanteri

Uygulamadan once:

```powershell
git status --short
rg --files apps/web/src | rg "ChatLayout|MessageList|MessageBubble|ChatComposer|BlockRenderer|ThinkingBlock|SettingsModal|ConversationSidebar|DevicePresence|MarkdownRenderer|styles"
rg -n "TODO|@deprecated|eslint-disable|@ts-ignore|as any|any" apps/web/src
```

Mevcut dirty tree ve task disi degisiklikleri raporla. Revert etme.

## Gorev 7B - Motion Setup

`apps/web/src/lib/motion.ts` olustur:

```ts
import { type Variants } from 'motion/react';

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const slideUp: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export const slideInLeft: Variants = {
  initial: { x: -16, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -16, opacity: 0 },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const staggerContainer: Variants = {
  animate: {
    transition: { staggerChildren: 0.05 },
  },
};

export const springConfig = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
};

export const smoothConfig = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1] as const,
};
```

Kurallar:

- Motion import'lari local helper uzerinden yap.
- Reduced motion icin CSS fallback kesin olsun.
- Layout shift yaratan agir animasyonlardan kacin.

## Gorev 7C - Message ve Block Animasyonlari

- Yeni mesajlar subtle slide/fade ile gelsin.
- Streaming text her token'da bounce etmesin.
- Block card'lar giriste minimal fade/slide kullansin.
- Collapsible block'lar height animation ile acilsin ama content overlap yaratmasin.
- Approval buttons hover/active state profesyonel ama sakin olsun.

Motion kullanilamiyorsa CSS transition ile ayni hissi kur.

## Gorev 7D - Sidebar, Modal ve Composer Micro-Interactions

- Mobile sidebar: backdrop fade + panel slide.
- Modal: backdrop fade + scale/slide panel.
- Composer: focus ring, submit hover/active, voice recording pulse, attachment chip entry.
- Error banner: slide/fade, `role="alert"`.
- Desktop device badge: status degisimi sakin ama fark edilir.

## Gorev 7E - Skeleton ve Loading States

Skeleton eklenecek alanlar:

- Conversation list loading.
- Message history loading.
- Settings/account loading.
- Device presence loading.
- Research/source result loading varsa.

Skeleton shimmer reduced-motion durumunda kapanir.

## Gorev 7F - Accessibility Hardening

Zorunlu kontroller:

- Landmarks:
  - ChatHeader: `header` / `role="banner"`
  - Sidebar: `nav` / `role="navigation"`
  - MessageList: `main` / `role="main"`
  - Composer: labelled region veya form
- Icon-only button'larda `aria-label`.
- Collapse controls: `aria-expanded`, `aria-controls`.
- Modal: focus trap, Escape close, focus return.
- Sidebar mobile: Escape close, backdrop click, focus order.
- Streaming: `aria-live="polite"`; token bazli gurultu yok.
- Loading: `aria-busy` veya `role="status"`.
- Error: `role="alert"`.
- Color contrast: normal text WCAG AA hedefi.
- Keyboard: Tab, Shift+Tab, Enter, Escape, Arrow Up/Down conversation list.

## Gorev 7G - Performance Hardening

Zorunlu:

- `React.memo` yalniz anlamli yerlerde: MessageBubble, BlockRenderer gibi prop-stable componentler.
- Settings modal ve developer panel lazy load edilebilir.
- Long list virtualization bu fazda dependency gerektiriyorsa ekleme yapma; future note yaz. Native/simple windowing yapilacaksa riskini raporla.
- CSS containment kullanirken layout/position bug'i yaratma.
- Font display stratejisi kontrol edilmeli.

## Gorev 7H - Eski Dosya Deprecation

Artik kullanilmayan dosyalar silinmez. Dosya basina uygun yorum eklenir:

```ts
// @deprecated - replaced by [new file]. Kept for backward compatibility during UI phase migration.
```

Kontrol edilecek adaylar:

- `apps/web/src/lib/chat-styles.ts`
- `apps/web/src/components/chat/ChatComposerSurface.tsx`
- `apps/web/src/components/chat/ChatWorkspaceHeader.tsx`
- `apps/web/src/components/chat/ChatShell.tsx`
- `apps/web/src/components/app/AppShell.tsx`
- `apps/web/src/components/app/AppNav.tsx`
- `apps/web/src/pages/DashboardPage.tsx`
- `apps/web/src/pages/SettingsPage.tsx`

Yalniz gercekten kullanilmayan dosyaya deprecation ekle. Import hala aktifse deprecate etme; once raporla.

## Gorev 7I - Final CSS Entry

`apps/web/src/index.css` import yapisini netlestir:

```css
@import './styles/primitives.css';
@import './styles/chat.css';
@import './styles/sidebar.css';
@import './styles/blocks.css';
@import './styles/markdown.css';
@import './styles/auth.css';
@import './styles/highlight-theme.css';
@import './styles/animations.css';
```

Yalniz var olan dosyalari import et. Olmayan dosya import'u ekleme. Import sirasini gercek dosya durumuna gore kur.

## Gorev 7J - Release-Grade Browser QA

Bu fazda browser QA zorunludur. Dev server ac ve Playwright veya mevcut browser automation ile kontrol et.

Minimum senaryolar:

1. Login page render.
2. Authenticated/dev-auth chat route render.
3. Empty state gorunur.
4. Sidebar mobile open/close.
5. Composer text input ve submit attempt.
6. Markdown fixture render.
7. Block fixture: tool_result, approval, source/search, code/diff.
8. Settings modal/page open/close.
9. Device presence empty veya real state.
10. Browser console error clean veya hatalar dosya-bazli raporlu.

Viewport:

- 320x700
- 768x900
- 1440x1000

Kanit:

- Screenshot path'leri veya Playwright assertion summary.
- Console error listesi.
- Hangi senaryo kosulamadiysa nedeni.

## Gorev 7K - Lighthouse / A11y Gate

Mumkunse Lighthouse veya Playwright accessibility smoke kos:

- Performance hedefi: 90+
- Accessibility hedefi: 95+

Bu hedefler kosulamadiysa veya dev-mode/auth sebebiyle temsil etmiyorsa bunu acik yaz. Skor uydurma.

## Sinirlar

- Yeni product feature acma.
- WS/server/runtime/provider/desktop-agent davranisi degistirme.
- Fake browser QA, fake screenshot, fake Lighthouse skoru yazma.
- Eski dosyalari silme.
- Ana chat'e raw developer/operator yuzeyi geri tasima.
- Reduced motion'i ihmal etme.
- `any`, `as any`, `@ts-ignore` kullanma.

## Degistirilebilecek Dosyalar

- `apps/web/src/lib/motion.ts`
- `apps/web/src/components/chat/**`
- `apps/web/src/components/ui/**`
- `apps/web/src/components/sidebar/**`
- `apps/web/src/components/settings/**`
- `apps/web/src/components/desktop/**`
- `apps/web/src/pages/**` (yalniz UI integration/polish)
- `apps/web/src/styles/**`
- `apps/web/src/index.css`
- `apps/web/src/App.tsx`
- `PROGRESS.md`

## Degistirilmeyecek Dosyalar

- `apps/server/**`
- `packages/types/**`
- `apps/desktop-agent/**`
- `packages/db/**`
- Provider/gateway/runtime files

## Done Kriteri

- [ ] Motion veya CSS animation reduced-motion uyumlu.
- [ ] Message, sidebar, modal, block, composer micro-interactions calisir.
- [ ] Skeleton states eklendi.
- [ ] A11y checklist tamamlandi.
- [ ] Kullanilmayan eski dosyalar silinmeden deprecate edildi veya neden aktif kaldigi raporlandi.
- [ ] `pnpm.cmd --filter @runa/web typecheck` PASS.
- [ ] `pnpm.cmd --filter @runa/web build` PASS.
- [ ] Targeted Biome touched files icin PASS veya gercek hata raporu.
- [ ] Browser QA 320/768/1440 icin kosuldu veya neden kosulamadigi yazildi.
- [ ] Console error raporu var.
- [ ] Lighthouse/a11y smoke kosuldu veya neden kosulamadigi yazildi.

## Browser / QA Kaniti

Final raporda su format kullan:

```text
Browser QA:
- Dev server: [url]
- 320x700: PASS/FAIL + screenshot/assertion
- 768x900: PASS/FAIL + screenshot/assertion
- 1440x1000: PASS/FAIL + screenshot/assertion
- Console errors: none / listed
- Login: PASS/FAIL
- Chat submit attempt: PASS/FAIL
- Sidebar: PASS/FAIL
- Settings: PASS/FAIL
- Block fixture: PASS/FAIL
- Device presence: real/empty/error state
- Lighthouse: score or not run with reason
```

Kanit uydurma.

## PROGRESS.md Kapanis Notu

Kapanis notunda:

- UI polish kapsaminda ne kapandi
- QA kanitlari
- Hangi eski dosyalar deprecate edildi
- Hangi hedefler kosulamadiysa nedeni
- Kapali test oncesi kalan UI/product riskleri
