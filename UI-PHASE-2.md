# UI-PHASE-2 - UI Primitive Bilesenler ve Agentic Product Primitives

> Bu belge tek basina IDE LLM gorev prompt'udur. FAZ 1 uygulanmis veya mevcut repo bu zemine esdeger hale gelmis olmalidir.
> Baslamadan once `AGENTS.md`, `implementation-blueprint.md`, `docs/TASK-TEMPLATE.md`, `PROGRESS.md` ve `UI-PHASE-1.md` icindeki kapanis notlari okunmalidir.

## Urun Amaci

Bu faz Runa'nin temel UI bilesen kutuphanesini kurar veya mevcut `Runa*` primitive'lerini yeni chat-first urun diline tasir. Hedef sadece Button/Input/Modal yazmak degildir. Hedef, Runa'nin agentic yuzeyleri icin guven, kaynak, cihaz, approval, artifact ve ilerleme primitive'lerini hazirlamaktir.

Bu faz tamamlandiginda sonraki Chat, Research, Desktop Companion, Approval ve Project Memory yuzeyleri ayni temel bilesenleri kullanarak ilerlemelidir.

## Rakip Citasi ve Runa Farki

Rakip urunlerde ortak beklenti:

- ChatGPT Projects gibi uzun sureli calisma alanlari kaynak, talimat, dosya ve sohbetleri ayni dilde tasir.
- Deep Research ve Claude Research gibi research yuzeyleri kaynak guveni, plan, ilerleme ve sonuc raporu icin ayri presentation ihtiyaci dogurur.
- Claude Computer Use ve Manus Browser Operator gibi bilgisayar kullanan ajan yuzeyleri izin, kontrol, aksiyon log'u ve durdurma dilini sade ama guven verici gostermek zorundadir.
- Comet gibi browser-first asistanlar ilk bakista "bu asistan ne yapabilir?" sinyalini UI primitive seviyesinde verir.

Runa'nin farki: primitive seti yalniz genel SaaS componentleri degil, calisan ajan davranisini insansi ve guvenilir gosteren product primitives icermelidir.

Kaynakli referanslar:

- ChatGPT Projects: https://help.openai.com/en/articles/10169521
- ChatGPT Deep Research: https://help.openai.com/articles/10500283
- Claude Research: https://www.anthropic.com/news/research
- Claude Computer Use: https://docs.anthropic.com/en/docs/build-with-claude/computer-use
- Manus Browser Operator: https://manus.im/docs/features/browser-operator
- Perplexity Comet: https://www.perplexity.ai/comet/

## Gorev Bilgileri

- **Sprint:** Core Hardening Phase 2 - Track C
- **Gorev:** Web primitive bilesenlerini ve Runa agentic primitive temelini kur
- **Modul:** `apps/web`
- **KARAR.MD Maddesi:** Presentation, Human Ops, Desktop companion

## Baglam

- **Ilgili interface:** Bu faz shared runtime kontrati degistirmez.
- **Referans dosyalar:** `apps/web/src/components/ui/`, `apps/web/src/components/chat/capability/`, `apps/web/src/lib/design-tokens.ts`, `apps/web/src/index.css`
- **Mevcut repo gercegi:** Repo halihazirda `RunaButton`, `RunaCard`, `RunaBadge`, `RunaTextarea`, `RunaSurface` icerebilir. Bunlari yok sayma; gerekirse yeni adli componentleri backward-compatible export ile ekle.

## Kural Esnetme Notu

Bu fazda lucide veya motion gibi FAZ 1'de onaylanmis dependency'ler kullanilabilir. Yeni dependency ekleme gerekiyorsa FAZ 1'deki mini RFC kapisini uygula.

Component API'leri modernlestirilebilir, ancak mevcut kullanimlari kirmamak icin:

- Eski `Runa*` export'lari korunmali.
- Yeni componentler `Button`, `Input`, `Textarea`, `Badge`, `Avatar`, `Modal`, `Skeleton`, `Tooltip` gibi sade isimlerle export edilebilir.
- Eski ve yeni export ayni component'i sarabilir.

## Gorev 2A - Primitive Envanteri

Uygulamadan once su dosyalari ve export'lari kontrol et:

```powershell
rg --files apps/web/src/components/ui apps/web/src/components/chat/capability
Get-Content -Raw apps/web/src/components/ui/index.ts
rg -n "RunaButton|RunaCard|RunaBadge|RunaTextarea|RunaSurface|CapabilityCard|AssetPreviewCard" apps/web/src
```

Sonuca gore karar ver:

- Component zaten varsa kirmadan genislet.
- Component yoksa yeni dosya ekle.
- Ayni isi yapan iki component varsa adapter/alias kullan; rastgele silme.

## Gorev 2B - Core Primitive Set

Asagidaki componentleri `apps/web/src/components/ui/` altinda kur veya mevcut componentleri bu API'ye yaklastir:

### Button

```ts
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';
type ButtonProps = Readonly<{
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children?: ReactNode;
}> & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  className?: string;
};
```

Gereksinimler:

- `type="button"` default olsun; form submit gereken yerde explicit `type="submit"` kullanilsin.
- Loading durumunda disabled ve spinner goster.
- Icon-only button `aria-label` olmadan kullanilamaz; runtime uyarisi veya typed prop ayrimi tercih edilir.
- Hover lift sadece pointer device icin kullanilsin.

### Input

```ts
type InputProps = Readonly<{
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
}> & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  className?: string;
};
```

### Textarea

```ts
type TextareaProps = Readonly<{
  label?: string;
  error?: string;
  autoExpand?: boolean;
  maxHeight?: number;
}> & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & {
  className?: string;
};
```

Auto-expand icin:

- Scroll height hesaplari layout thrash yaratmayacak kadar dar tutulmali.
- `maxHeight` sonrasi textarea scroll olabilmeli.

### Badge

```ts
type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';
type BadgeProps = Readonly<{
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  dot?: boolean;
  children: ReactNode;
  className?: string;
}>;
```

### Avatar

```ts
type AvatarProps = Readonly<{
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'user' | 'assistant' | 'system';
}>;
```

### Modal

```ts
type ModalProps = Readonly<{
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}>;
```

Modal gereksinimleri:

- `document.body` portal kullan.
- Escape ile kapanir.
- Backdrop click ile kapanir.
- Ilk focusable elemana focus atar.
- Kapaninca onceki focus'a geri doner.
- `aria-modal`, `role="dialog"`, `aria-labelledby` ve `aria-describedby` kullanir.

### Skeleton

Text, circle ve rect varyantlari olmali; shimmer reduced-motion durumunda kapanmali.

### Tooltip

Tooltip keyboard focus ile de calismali. Yalniz hover'a baglama. Icon-only actionlarda tooltip metni `aria-label` ile celismemeli.

## Gorev 2C - Agentic Product Primitives

Asagidaki Runa'ya ozgu primitive'leri `apps/web/src/components/chat/capability/` veya uygun `components/ui/` altinda kur:

### TrustBadge

Kullanim amaci: source, action, device veya approval yuzeylerinde guven seviyesini gostermek.

```ts
type TrustTone = 'verified' | 'caution' | 'unverified' | 'blocked';
type TrustBadgeProps = Readonly<{
  tone: TrustTone;
  label: string;
  detail?: string;
}>;
```

### SourceBadge

Kullanim amaci: research ve web search yuzeylerinde kaynak tipini gostermek.

```ts
type SourceKind = 'web' | 'workspace' | 'project_file' | 'connected_app' | 'user_provided';
type SourceBadgeProps = Readonly<{
  kind: SourceKind;
  label: string;
  href?: string;
}>;
```

### DeviceBadge

Kullanim amaci: desktop companion device presence yuzeyleri.

```ts
type DeviceBadgeProps = Readonly<{
  label: string;
  status: 'online' | 'offline' | 'stale' | 'unknown';
  lastSeenLabel?: string;
}>;
```

### ApprovalAction

Kullanim amaci: approval accept/reject buton dilini tutarli yapmak.

```ts
type ApprovalActionProps = Readonly<{
  status: 'pending' | 'approved' | 'rejected';
  approveLabel?: string;
  rejectLabel?: string;
  onApprove?: () => void;
  onReject?: () => void;
}>;
```

### ProgressStep

Kullanim amaci: thinking, research, desktop ve tool progress yuzeyleri.

```ts
type ProgressStepStatus = 'pending' | 'active' | 'completed' | 'failed' | 'paused';
type ProgressStepProps = Readonly<{
  status: ProgressStepStatus;
  label: string;
  detail?: string;
  durationLabel?: string;
}>;
```

### ArtifactAction

Kullanim amaci: rapor, dosya, screenshot, image veya code artifact action row'lari.

```ts
type ArtifactActionKind = 'open' | 'copy' | 'download' | 'preview' | 'retry' | 'refine' | 'details';
type ArtifactActionProps = Readonly<{
  kind: ArtifactActionKind;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}>;
```

Bu primitive'ler runtime'a baglanmayacak; yalniz UI-level reusable foundation olacak.

## Gorev 2D - CSS Organizasyonu

`apps/web/src/styles/primitives.css` dosyasi olustur veya mevcut CSS icinde temiz bir primitive bolumu ac.

Kurallar:

- Class isimleri `runa-` prefix'i tasimali.
- Inline style yalniz dinamik numeric/position degerleri icin kullanilmali.
- Bilesenler token kullanmali; hard-coded renkler sinirli olmali.
- Text button yerine icon button kullanilan yerlerde `aria-label` zorunlu.

## Gorev 2E - Export Uyumlulugu

`apps/web/src/components/ui/index.ts` ve varsa `apps/web/src/components/chat/capability/index.ts` guncellenmeli.

Kurallar:

- Eski export'lari kaldirma.
- Yeni export'lari ekle.
- `RunaButton` gibi eski isimler yeni `Button`'a alias olabilir.
- Import path churn'u minimum tut.

## Sinirlar

- `packages/types/**`, `apps/server/**`, `apps/desktop-agent/**`, `packages/db/**` dosyalarina dokunma.
- `ChatPage.tsx` veya route davranisini bu fazda yeniden kurma.
- Component API'sini guncellerken mevcut kullanimlari kirmadan adapter kullan.
- Yeni design library kurma; gerekirse once mini RFC ve kullanici onayi gerekir.
- `any`, `as any`, `@ts-ignore` kullanma.

## Degistirilebilecek Dosyalar

- `apps/web/src/components/ui/**`
- `apps/web/src/components/chat/capability/**`
- `apps/web/src/styles/primitives.css`
- `apps/web/src/index.css`
- `apps/web/src/lib/design-tokens.ts` (yalniz eksik token gerekiyorsa)
- `PROGRESS.md`

## Degistirilmeyecek Dosyalar

- `packages/types/**`
- `apps/server/**`
- `apps/desktop-agent/**`
- `apps/web/src/hooks/**`
- `apps/web/src/pages/ChatPage.tsx`
- `apps/web/src/App.tsx`

## Done Kriteri

- [ ] Core primitive set derleniyor ve export ediliyor.
- [ ] Eski `Runa*` export'lari kirilmadi.
- [ ] Agentic product primitive seti UI-level olarak eklendi.
- [ ] Tum component prop'lari `Readonly` veya immutable pattern ile tanimli.
- [ ] `any`, `as any`, `@ts-ignore`, `eslint-disable` yok.
- [ ] `pnpm.cmd --filter @runa/web typecheck` PASS.
- [ ] `pnpm.cmd --filter @runa/web build` PASS.
- [ ] `pnpm.cmd exec biome check apps/web/src/components/ui apps/web/src/components/chat/capability apps/web/src/styles/primitives.css apps/web/src/index.css` PASS veya dosya-bazli gercek hata raporu.

## Browser / QA Kaniti

Bu fazda tam UI wiring olmayabilir. Yine de:

- Import hatasi veya blank screen yok.
- Dev console yeni primitive import hatasi vermiyor.
- Modal, button focus ring ve keyboard tab sirasi bir test/demo yuzeyinde veya Story-like local kullanımda kontrol edildi; kontrol edilemediyse raporlandi.

Kanit uydurma. Browser smoke kosulamadiysa nedenini yaz.

## PROGRESS.md Kapanis Notu

Kapanis notunda sunlar olmali:

- Degisen dosyalar
- Hangi primitive'ler eklendi veya genisletildi
- Hangi eski export'lar korundu
- Dogrulama komutlari
- Sonraki fazda hangi componentlerin kullanilacagi
