# UI-OVERHAUL-03 — Inline Style Migration & Primitive Expansion

> Bu belge tek başına IDE LLM görev prompt'udur.
> UI-OVERHAUL-02 (tokens & CSS architecture) kapanmadan başlanmaz.

## Ürün Amacı

Bugün 51 web dosyasında inline `style={{...}}` ve `CSSProperties` blokları var; `chat-styles.ts` 392 satırlık TS-as-CSS object pattern'i kullanıyor. Bu görev tüm bu inline + TS-as-CSS yüzeyini UI-OVERHAUL-02'de kurulan token + CSS Modules sistemine taşır ve `Runa*` primitive setini consumer-grade UI için tamamlar.

Hedef:
- 51 dosyada `style={{` veya `CSSProperties` kullanımı **0**
- `chat-styles.ts` boşalır ve silinir
- `Runa*` primitive seti: `RunaButton`, `RunaCard`, `RunaSurface`, `RunaTextarea`, `RunaBadge` (mevcut) + `RunaInput`, `RunaModal`, `RunaSheet`, `RunaToast`, `RunaSkeleton`, `RunaSpinner`, `RunaIcon`, `RunaTooltip`, `RunaDisclosure` (yeni)

## Rakip Çıtası

Claude, ChatGPT, Linear, Vercel — hepsi tek bir tutarlı primitive seti üzerinden inşa edilmiş. Inline style consumer-grade ürün için "geçici, refactor zamanı gelmemiş" sinyali. Tek kanallı styling, tutarlı focus ring, tutarlı motion choreography ve tutarlı dark mode olmadan polish çalışmaları her component'te tekrar başlamak zorunda.

## Görev Bilgileri

- **Sprint:** UI Overhaul — **Track:** Track C
- **Görev:** Inline style migration + Runa* primitive expansion
- **Modül:** `apps/web/src/components`
- **KARAR.MD Maddesi:** Presentation, UI/UX manifesto

## Bağlam

- **Mevcut inline style kullanım sayısı:** 51 dosya (`grep CSSProperties\|style={{`)
- **Mevcut chat-styles.ts:** 392 satır TS-as-CSS export (panelStyle, eventCardStyle, eventListStyle, secondaryButtonStyle, secondaryLabelStyle, subcardStyle, emptyStateCardStyle)
- **Mevcut primitives:** [apps/web/src/components/ui/Runa*.tsx](../apps/web/src/components/ui/)

## Görev Detayı

### 1. Yeni primitive'ler

Her primitive yanına `*.module.css` dosyası gelir. Token kullanımı zorunlu.

#### `RunaInput.tsx`
- text, email, password, search variants
- size: sm, md, lg
- error state, helperText, label, leftIcon, rightIcon
- focus ring tokens

#### `RunaModal.tsx`
- backdrop fade + scale-in panel
- focus trap, Escape close, focus return
- aria attributes
- size: sm, md, lg, full

#### `RunaSheet.tsx` (mobile bottom sheet, desktop right drawer)
- responsive — `<768px` bottom sheet, `>=768px` right drawer
- swipe-to-dismiss (mobile)

#### `RunaToast.tsx` + `RunaToastProvider`
- info, success, warning, danger variants
- auto-dismiss + manual close
- stacking
- aria-live="polite" (info/success), "assertive" (warning/danger)

#### `RunaSkeleton.tsx`
- shimmer animation (animations.css'den)
- prefers-reduced-motion respect
- variants: text, circle, rect

#### `RunaSpinner.tsx`
- 3 size: sm/md/lg
- aria-label

#### `RunaIcon.tsx`
- lucide-react wrapper, consistent sizing
- aria-hidden default true (decorative); explicit `aria-label` ile interactive

#### `RunaTooltip.tsx`
- minimal hover/focus tooltip
- portal mount

#### `RunaDisclosure.tsx`
- "Show details" expandable section
- aria-expanded, aria-controls
- approval card için kritik ([UI-OVERHAUL-04](UI-OVERHAUL-04.md))

`apps/web/src/components/ui/index.ts`'i tüm primitive'leri re-export eder.

### 2. Inline style migration stratejisi

Her component için:
1. Inline style bloklarını component-yanı `*.module.css` dosyasına taşı
2. Token referansları kullan (hex/rgba doğrudan yazılmaz)
3. Primitive değiştirilebilir mi? `<button style={{...}}>` → `<RunaButton variant="...">`
4. Component test'leri varsa görsel parite koru

Kapsam (öncelik sırası):
- **Tier 1 (developer/):** OperatorControlsPanel, TransportMessagesPanel, RunTimelinePanel, InspectionActionDetailModal — UI-OVERHAUL-01'den sonra developer/'da
- **Tier 2 (chat surface):** RunProgressPanel, CurrentRunSurface, ScreenshotCard, PresentationRunSurfaceCard, ChatComposerSurface, ConversationSidebar, EmptyState, ChatHeader, ChatLayout
- **Tier 3 (auth/account):** LoginPage, SettingsPage, ProfileCard, SessionCard
- **Tier 4 (blocks):** PresentationBlockRenderer (UI-OVERHAUL-04'te split olacak; bu görev sadece inline style temizliği)

### 3. `chat-styles.ts` deprecation

- Tüm export'ları kullanan dosyalar göç ettikten sonra `chat-styles.ts` boşalır
- Dosya silinir; testler PASS

### 4. CI gate genişletme

`scripts/ci/manifesto-check.mjs` (UI-OVERHAUL-01'de eklendi) içine:
- `apps/web/src/components/**` ve `apps/web/src/pages/**` altında `style={{` veya `CSSProperties` regex araması
- Bulursa exit code 1
- Allowlist: `lib/motion.ts`, `lib/theme.ts`, `*.module.css.d.ts` muaf

`package.json` script:
```json
"style:check": "node scripts/ci/style-check.mjs"
```

veya manifesto:check içine birleştir.

### 5. Primitive coverage report

`scripts/ci/primitive-coverage.mjs`:
- Her component'te `Runa*` primitive kullanım sayısını raporlar
- Native HTML element (button, input, div with role) kullanım sayısını raporlar
- Native > Runa eşiği aşıldığında uyarı (fail değil)

## Sınırlar (Yapma Listesi)

- [ ] Görsel davranışı değiştirme; mevcut görünüm parite korunur
- [ ] Yeni feature açma
- [ ] Tailwind veya başka CSS-in-JS dependency ekleme
- [ ] `apps/server/**`, `packages/**`, `apps/desktop-agent/**` dokunma
- [ ] PresentationBlockRenderer monoliti split etme (UI-OVERHAUL-04)
- [ ] Approval inline UX değişikliği (UI-OVERHAUL-04)
- [ ] `any`, `as any`, `@ts-ignore` kullanma

## Değiştirilebilecek Dosyalar

- `apps/web/src/components/ui/RunaInput.tsx` ve `*.module.css` (yeni)
- `apps/web/src/components/ui/RunaModal.tsx` (yeni)
- `apps/web/src/components/ui/RunaSheet.tsx` (yeni)
- `apps/web/src/components/ui/RunaToast.tsx` (yeni)
- `apps/web/src/components/ui/RunaSkeleton.tsx` (yeni)
- `apps/web/src/components/ui/RunaSpinner.tsx` (yeni)
- `apps/web/src/components/ui/RunaIcon.tsx` (yeni)
- `apps/web/src/components/ui/RunaTooltip.tsx` (yeni)
- `apps/web/src/components/ui/RunaDisclosure.tsx` (yeni)
- `apps/web/src/components/ui/index.ts` (re-export)
- `apps/web/src/components/chat/**/*.tsx` (inline style → *.module.css)
- `apps/web/src/components/developer/**/*.tsx` (inline style → *.module.css)
- `apps/web/src/components/auth/**/*.tsx`
- `apps/web/src/components/settings/**/*.tsx`
- `apps/web/src/components/desktop/**/*.tsx`
- `apps/web/src/components/approval/**/*.tsx`
- `apps/web/src/pages/**/*.tsx`
- `apps/web/src/lib/chat-styles.ts` (silme)
- `scripts/ci/manifesto-check.mjs` (style-check'i içine ekleme veya ayrı dosya)
- `package.json` script
- `PROGRESS.md`

## Değiştirilmeyecek Dosyalar

- `apps/server/**`, `packages/**`, `apps/desktop-agent/**`
- `apps/web/src/styles/tokens.css` (UI-OVERHAUL-02 source-of-truth)
- `apps/web/src/components/chat/PresentationBlockRenderer.tsx` (UI-OVERHAUL-04 split)

## Done Kriteri

- [ ] `apps/web/src/components/**` ve `apps/web/src/pages/**` altında inline `style={{` veya `CSSProperties` kullanımı **0**
- [ ] `apps/web/src/lib/chat-styles.ts` silindi
- [ ] 9 yeni primitive (RunaInput, RunaModal, RunaSheet, RunaToast, RunaSkeleton, RunaSpinner, RunaIcon, RunaTooltip, RunaDisclosure) mevcut
- [ ] `manifesto:check` script style violation tarar; PASS
- [ ] `pnpm.cmd --filter @runa/web typecheck` PASS
- [ ] `pnpm.cmd --filter @runa/web lint` PASS
- [ ] `pnpm.cmd --filter @runa/web build` PASS
- [ ] `pnpm.cmd --filter @runa/web test` PASS
- [ ] Browser QA 320/768/1440: tüm yüzeylerde görsel parite korundu, dark mode regresyonu yok
- [ ] PROGRESS.md kapanış notu

## Notlar

- Migration adım adım PR'larda yapılabilir; bu prompt tek görev olarak yazılı ama çoklu PR olarak işlenebilir.
- Native HTML element + `*.module.css` kombinasyonu primitive'den önce gelmek zorunda değil; basit yüzeylerde primitive overhead'siz CSS Modules tercih edilebilir.
- Yeni primitive eklerken her birine bir `*.test.tsx` smoke test eklenir.
