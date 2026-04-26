# UI-PHASE-1 - Design System, Dependency Gate ve Tema Zemini

> Bu belge tek basina IDE LLM gorev prompt'udur. Baska bir UI faz belgesini okumadan uygulanabilir olmalidir.
> Gorev baslamadan once `AGENTS.md`, `implementation-blueprint.md`, `docs/TASK-TEMPLATE.md` ve `PROGRESS.md` okunmalidir.

## Urun Amaci

Bu faz Runa'nin chat-first ana yuzeyi icin guvenilir tasarim sistemi ve dependency zeminini kurar. Hedef, sadece koyu tema veya modern gorunum degil; Runa'nin "sakin ama guclu calisma ortagi" hissini tutarli hale getirmektir.

Bu faz tamamlandiginda sonraki fazlar ayni token, font, motion, syntax-highlight ve primitive dilini kullanarak ilerlemelidir. Bu faz runtime, auth, WS, desktop veya provider davranisini degistirmez.

## Rakip Citasi ve Runa Farki

Rakip urunlerden alinan dersler:

- ChatGPT Projects, uzun soluklu islerde dosya, talimat, sohbet ve proje bellegini ayni calisma alaninda topluyor: https://help.openai.com/en/articles/10169521
- ChatGPT Deep Research, kaynak secimi, calisma ilerlemesi, araya girip yonlendirme ve kaynakli rapor beklentisini yukseltti: https://help.openai.com/articles/10500283
- Claude Research, web ve kullanicinin is baglamini beraber arama iddiasini one cikariyor: https://www.anthropic.com/news/research
- Claude Computer Use, screenshot, mouse ve keyboard kontrolunu guvenlik onlemleriyle birlikte konumluyor: https://docs.anthropic.com/en/docs/build-with-claude/computer-use
- Manus Browser Operator, yerel tarayici oturumunu izinli ve durdurulabilir agent yuzeyi olarak sunuyor: https://manus.im/docs/features/browser-operator
- Perplexity Comet, tarayiciyi "calisan asistan" olarak konumlandiriyor ve kullaniciya e-posta, alisveris, planlama ve web isleri icin ilk ekran sinyali veriyor: https://www.perplexity.ai/comet/

Runa'nin farki: bu tasarim sistemi dashboard veya operator paneli hissine kaymadan chat, research, desktop companion, approval ve project memory yuzeylerini ayni sakin urun dilinde tasiyabilmelidir.

## Gorev Bilgileri

- **Sprint:** Core Hardening Phase 2 - Track C
- **Gorev:** Design system, dependency gate ve tema zeminini repo formatina uygun kur
- **Modul:** `apps/web`
- **KARAR.MD Maddesi:** Presentation, UI + Desktop companion yonu

## Baglam

- **Ilgili interface:** Bu faz `packages/types` kontratlarini degistirmez.
- **Referans dosyalar:** `apps/web/src/index.css`, `apps/web/src/lib/design-tokens.ts`, `apps/web/src/lib/chat-styles.ts`, `apps/web/src/components/ui/`
- **Mevcut repo gercegi:** `PROGRESS.md` icinde onceki UI foundation notlari olabilir. Uygulamadan once dosyalarin gercek durumunu `rg --files apps/web/src` ve `git status --short` ile kontrol et.

## Kural Esnetme Notu

Bu fazda dependency kullanimi yasak degildir. Ancak her dependency icin mini RFC yazmadan ekleme yapma:

- Neden gerekli?
- Mevcut dependency veya native API ile neden yetinilmiyor?
- Bundle, runtime, a11y, SSR/dev-server ve bakim riski nedir?
- Rollback plani nedir?
- Hangi dogrulama komutu dependency etkisini kanitlar?

Dependency zaten `apps/web/package.json` icinde varsa yeniden ekleme yapma. Versiyon degisikligi gerekiyorsa once mevcut versiyonu, gerekceyi ve riskleri raporla.

## Gorev 1A - Mevcut Durum Envanteri

Uygulamadan once su komutlari kos ve bulgulari not al:

```powershell
git status --short
rg --files apps/web/src | rg "index.css|design-tokens|chat-styles|components/ui|styles|MarkdownRenderer|PresentationBlockRenderer"
Get-Content -Raw apps/web/package.json
```

Beklenen ciktiyi uydurma. Dosya yoksa "yok" de; dependency zaten varsa "zaten mevcut" de.

## Gorev 1B - Dependency Gate

Asagidaki dependency'ler yalnizca eksikse ve mini RFC yazildiktan sonra eklenebilir:

```bash
pnpm add motion react-markdown remark-gfm rehype-highlight highlight.js lucide-react
```

Kurallar:

- Komutu repo kokunden `pnpm.cmd --filter @runa/web add ...` veya `apps/web` altinda `pnpm.cmd add ...` ile kos.
- `package.json` ve `pnpm-lock.yaml` disinda dependency kaynakli dosya degistirme.
- Dependency zaten varsa bu gorevi no-op olarak kaydet.
- Yeni dependency eklenirse `PROGRESS.md` kapanis notunda gerekcesini yaz.

## Gorev 1C - Font ve HTML Temeli

`apps/web/index.html` dosyasinda font yukleme stratejisini kontrol et.

Eger Google Fonts kullanilacaksa:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

Eger mevcut font stratejisi farkliysa veya network bagimliligi istenmiyorsa bunu raporla ve local/system fallback ile ilerle. Karar uydurma; mevcut `index.html` durumuna gore hareket et.

## Gorev 1D - CSS Token Sistemi

`apps/web/src/index.css` dosyasini "tamamen yeniden yaz" yaklasimiyla degil, kontrollu bir token migration olarak ele al.

Zorunlu token gruplari:

- Font: body ve code fontlari
- Background: primary, secondary, tertiary, hover, active
- Text: primary, secondary, tertiary, inverse
- Accent: primary, primary hover, secondary
- Border: primary, secondary, accent
- Status: success, warning, error ve ilgili soft background'lar
- Spacing: 4px tabanli `--space-1` ile `--space-8`
- Radius: sm, md, lg, xl, full
- Shadow: sm, md, lg
- Layout: sidebar width, header height, composer max height, chat max width, safe area top/bottom
- Transition: fast, normal, slow

Tasarim kurallari:

- Chat-first yuzeyi koru; dashboard-first veya operator panel hissi verme.
- Ana palette tek renk ailesine sikisma. Accent mor/mavi olabilir ama tum UI mor degradeye donmemeli.
- Dark mode varsayilan olabilir; future light-mode icin token isimleri tarafsiz kalmali.
- `body`, `#root`, focus ring, scrollbar, selection, form element resetleri ve utility class'lar tanimli olmali.
- `prefers-reduced-motion` icin global azaltma kuralini simdiden ekleyebilirsin.

## Gorev 1E - Design Tokens TypeScript Senkronizasyonu

`apps/web/src/lib/design-tokens.ts` dosyasini CSS custom properties ile senkronize et.

Beklenen yeni export:

```ts
export const tokens = {
  color: {
    bg: {
      primary: 'var(--bg-primary)',
      secondary: 'var(--bg-secondary)',
      tertiary: 'var(--bg-tertiary)',
      hover: 'var(--bg-hover)',
      active: 'var(--bg-active)',
    },
    text: {
      primary: 'var(--text-primary)',
      secondary: 'var(--text-secondary)',
      tertiary: 'var(--text-tertiary)',
      inverse: 'var(--text-inverse)',
    },
    accent: {
      primary: 'var(--accent-primary)',
      primaryHover: 'var(--accent-primary-hover)',
      secondary: 'var(--accent-secondary)',
    },
    border: {
      primary: 'var(--border-primary)',
      secondary: 'var(--border-secondary)',
      accent: 'var(--border-accent)',
    },
    status: {
      success: 'var(--success)',
      warning: 'var(--warning)',
      error: 'var(--error)',
      successBg: 'var(--success-bg)',
      warningBg: 'var(--warning-bg)',
      errorBg: 'var(--error-bg)',
    },
  },
  font: {
    body: 'var(--font-body)',
    code: 'var(--font-code)',
  },
  space: {
    1: 'var(--space-1)',
    2: 'var(--space-2)',
    3: 'var(--space-3)',
    4: 'var(--space-4)',
    5: 'var(--space-5)',
    6: 'var(--space-6)',
    7: 'var(--space-7)',
    8: 'var(--space-8)',
  },
  radius: {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)',
    full: 'var(--radius-full)',
  },
  shadow: {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
  },
  transition: {
    fast: 'var(--transition-fast)',
    normal: 'var(--transition-normal)',
    slow: 'var(--transition-slow)',
  },
  layout: {
    sidebarWidth: 'var(--sidebar-width)',
    headerHeight: 'var(--header-height)',
    chatMaxWidth: 'var(--chat-max-width)',
  },
} as const;

export type Tokens = typeof tokens;
```

Mevcut `designTokens` export'u kullaniliyorsa kirmadan koru. Gerekirse `/** @deprecated use tokens */` yorumu ekle. Eski export'u kaldirma.

## Gorev 1F - Syntax Highlight Tema

`apps/web/src/styles/highlight-theme.css` dosyasi yoksa olustur. Varsa genislet.

Gereksinimler:

- `.hljs` prefix'i kullan.
- Arka plan transparent olsun; code container parent background'dan gelsin.
- TypeScript, JavaScript, JSON, Bash, CSS, HTML icin okunabilir renkler sagla.
- Contrast dusukse tokenlari degil, highlight class renklerini ayarla.

`apps/web/src/styles/` klasoru yoksa bu fazda yalniz gerekli stil klasorunu acabilirsin.

## Sinirlar

- `packages/types/**`, `apps/server/**`, `apps/desktop-agent/**`, `packages/db/**` dosyalarina dokunma.
- Runtime, WS, auth, provider, persistence veya desktop bridge davranisi degistirme.
- `ChatPage.tsx` layout rewrite bu fazin isi degil.
- `RenderBlock` kontrati degistirme.
- `any`, `as any`, `@ts-ignore`, broad fallback hack kullanma.
- Mevcut dirty tree'deki gorev disi dosyalari stage etme veya revert etme.

## Degistirilebilecek Dosyalar

- `apps/web/package.json`
- `pnpm-lock.yaml`
- `apps/web/index.html`
- `apps/web/src/index.css`
- `apps/web/src/lib/design-tokens.ts`
- `apps/web/src/lib/chat-styles.ts` (yalniz token uyumu gerekiyorsa)
- `apps/web/src/styles/highlight-theme.css`
- `PROGRESS.md`

## Degistirilmeyecek Dosyalar

- `packages/types/**`
- `apps/server/**`
- `apps/desktop-agent/**`
- `packages/db/**`
- `apps/web/src/pages/ChatPage.tsx`
- `apps/web/src/hooks/**`

## Done Kriteri

- [ ] Dependency durumu gercek package.json uzerinden raporlandi.
- [ ] Yeni dependency eklendiyse mini RFC ve rollback notu yazildi.
- [ ] CSS custom properties eksiksiz ve chat-first urun diliyle uyumlu.
- [ ] `tokens` export'u eklendi, eski export kirilmadi.
- [ ] Syntax highlight tema dosyasi mevcut ve import yolu net.
- [ ] `pnpm.cmd --filter @runa/web typecheck` PASS.
- [ ] `pnpm.cmd --filter @runa/web build` PASS.
- [ ] `pnpm.cmd exec biome check apps/web/src/index.css apps/web/src/lib/design-tokens.ts apps/web/src/styles/highlight-theme.css apps/web/index.html` PASS veya gercek, dosya-bazli hata raporu.
- [ ] `PROGRESS.md` icinde ne kapandi, ne kaldi, hangi dependency karari alindi yazildi.

## Browser / QA Kaniti

Bu faz browser UI'yi tamamen degistirmese bile finalde en az su kontrol yapilmali:

- Dev server aciliyorsa `/` sayfasi blank screen vermiyor.
- Browser console'da yeni CSS/import kaynakli hata yok.
- 320px ve 1440px genislikte body/root yatay overflow uretmiyor.

Bu kontroller kosulamadiysa final raporda "kosulamadi" de ve nedenini yaz. Kanit uydurma.

## PROGRESS.md Kapanis Notu

Kapanis notunda su alanlar bulunmali:

- Degisen dosyalar
- Dependency karari
- Dogrulama komutlari ve PASS/FAIL sonucu
- Bilerek disarida birakilan alanlar
- Sonraki dar faz onerisi
