# PR-6 Codex Brief — Sheets + Modal + Command Palette

> **Tarih:** 2026-05-13
> **Branch:** `codex/ui-restructure-pr-6-sheets-palette`
> **Worktree:** `.claude/worktrees/runa-ui-pr-6-sheets-palette`
> **Authority:** `docs/frontend mimar/RUNA-DESIGN-BRIEF.md` v1.1
> **Bağımlılık:** PR-4 ve PR-5 merge edilmiş olmalı.
> **Hedef:** Mobil sekonder navigasyonu sheet sistemine taşı, command palette UI'sını implement et, modal pattern'ini kur.

---

## 1. Tek cümle hedef

Bu PR'dan sonra mobilde `‹` history sheet, `⋯` menü sheet, composer context chip'inden açılan Bağlam sheet'i, ve `Ctrl+K`/`⌘K` ile açılan command palette çalışır. Tüm sekonder işlemler sohbet sütununun üstüne çıkmaz, sheet/modal katmanlarında yaşar.

---

## 2. Kapsam — Yapılacaklar

### 2.1 `RunaSheet` komponenti

**Yeni dosya:** `apps/web/src/components/ui/RunaSheet.tsx`

```typescript
import { Dialog } from 'radix-ui-react-dialog'; // veya halihazırda kullanılan primitives
import type { ReactElement, ReactNode } from 'react';
import styles from './RunaSheet.module.css';

type RunaSheetProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  side?: 'bottom' | 'right';   // mobile bottom, desktop right opsiyonel
}>;

export function RunaSheet({ open, onOpenChange, title, description, children, side = 'bottom' }: RunaSheetProps): ReactElement {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={`${styles.sheet} ${styles[`sheet--${side}`]}`}
          aria-describedby={description ? 'sheet-desc' : undefined}
        >
          <header className={styles.header}>
            <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            <Dialog.Close className={styles.close} aria-label="Kapat">×</Dialog.Close>
          </header>
          {description && <p id="sheet-desc" className={styles.description}>{description}</p>}
          <div className={styles.body}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

CSS önemli noktalar:
- Bottom sheet: `transform: translateY(100%)` → `translateY(0)`, `--ease-emphasized` 220ms.
- Overlay: `var(--overlay)` background, `backdrop-filter: blur(6px)`.
- `max-height: calc(100dvh - 40px)`.
- Safe-area-inset-bottom padding.
- Escape ile kapanır, swipe-down ile kapanır (gerekirse `framer-motion` veya manual touch handler).

### 2.2 `RunaModal` komponenti

**Yeni dosya:** `apps/web/src/components/ui/RunaModal.tsx`

Sheet'in masaüstü/centered varyantı. Aynı `Dialog` primitive, farklı CSS:

- `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%)`
- `max-width: 480px; max-height: 80dvh`
- Klavye Esc + outside click ile kapanır
- Focus trap

### 2.3 Command Palette UI

**Mevcut dosya:** `apps/web/src/components/command/CommandPalette.tsx` (zaten var; AppShell'den çağrılıyor)
**Mevcut dosya:** `apps/web/src/components/command/useCommandPalette.ts` (state hook)

Bu PR'da:
- Mevcut CommandPalette `RunaModal` kullanacak şekilde refactor edilir.
- `useCommandPalette` hook'u global `Ctrl+K`/`⌘K` listener'ı kayıt eder (zaten var).
- Komut listesi `createAppCommands` (AppShell.tsx:46-107) genişletilir:
  - `Yeni sohbet başlat` (`Ctrl+N`)
  - `Bağlamı aç` (PR-6 ile gelen Bağlam sheet'i aç)
  - `Tema değiştir` (sub-menu: Ember Dark, Light, Rose, Sistem)
  - `Gelişmiş görünüm` toggle
  - `Bildirimleri göster`
  - `Geçmişi aç`
- Komut listesi fuzzy search ile filtrelenir (yeni helper veya `fuse.js`).
- Komut item'larda keyboard shortcut görünür.

### 2.4 History Sheet (mobil)

**Yeni dosya:** `apps/web/src/components/chat/HistorySheet.tsx`

ChatHeader'daki `‹` butonu açar. İçinde:
- `ConversationSidebar` komponentinin mevcut yapısı, sheet wrapper'a sarılı.
- Mobil için optimize: tek kolon, başına `+ Yeni sohbet` primary CTA.

ChatHeader'daki `‹` butonu sadece `<768px`'te görünür; desktop'ta sidebar zaten visible olduğu için `‹` gizli.

### 2.5 Menu Sheet (mobil)

**Yeni dosya:** `apps/web/src/components/app/MenuSheet.tsx`

ChatHeader'daki `⋯` butonu açar. İçinde dikey liste:
- Cihazlar
- Geçmiş
- Hesap
- Ayarlar
- Gelişmiş görünüm (toggle)
- Bildirimler
- Yardım & geri bildirim (yer tutucu)

### 2.6 Context Sheet (mobil + desktop popover)

**Yeni dosya:** `apps/web/src/components/chat/ContextSheet.tsx`

Composer context chip'i açar. İçeriği:
- "Çalışma klasörü" başlığı + path (truncate)
- "Ekler" listesi (`attachments` array)
- "Açık working files" listesi (PR-3'te eklenecek; şu an boş)
- "Bağlamı düzenle" butonu (PR-7'de)

Desktop'ta sheet yerine `<RunaPopover>` (yeni mini komponent — alternatif: aynı sheet ama side="right" 320px).

### 2.7 ChatHeader entegrasyonu

**Dosya:** `apps/web/src/components/chat/ChatHeader.tsx`

PR-2'de eklenen `‹` ve `⋯` placeholder butonları gerçek handler'larına bağlanır:

```tsx
<button onClick={() => setHistorySheetOpen(true)} className="runa-chat-header__back">
  <ChevronLeft size={20} aria-hidden />
</button>
// ...
<button onClick={() => setMenuSheetOpen(true)} className="runa-chat-header__menu">
  <MoreHorizontal size={20} aria-hidden />
</button>

{/* Sheet'ler ChatPage seviyesinde mount edilir */}
```

### 2.8 ChatPage sheet state yönetimi

**Dosya:** `apps/web/src/pages/ChatPage.tsx`

Yeni state'ler:

```tsx
const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);
const [isMenuSheetOpen, setIsMenuSheetOpen] = useState(false);
const [isContextSheetOpen, setIsContextSheetOpen] = useState(false);
```

Eski `isConversationSidebarOpen` mobil için bu state'lere bağlanır; desktop'ta sidebar zaten visible.

ChatPage render'ının sonuna sheet'ler eklenir:

```tsx
<HistorySheet open={isHistorySheetOpen} onOpenChange={setIsHistorySheetOpen} ... />
<MenuSheet open={isMenuSheetOpen} onOpenChange={setIsMenuSheetOpen} ... />
<ContextSheet open={isContextSheetOpen} onOpenChange={setIsContextSheetOpen} ... />
```

### 2.9 Composer context chip → sheet trigger

**Dosya:** `apps/web/src/components/chat/ChatComposerSurface.tsx`

PR-2'de placeholder kalan `onOpenContextSheet` callback artık `setIsContextSheetOpen(true)` çağırır. ChatPage'den prop olarak iletilir.

---

## 3. Kapsam dışı

- ❌ Stop button + abort UI → PR-7'de.
- ❌ Settings sayfası yeniden yazımı → PR-7'de.
- ❌ Theme picker UI → PR-7'de (command palette sub-menu placeholder olarak kalır).
- ❌ iOS visualViewport hook → PR-8'de.

---

## 4. Kabul Kriteri

### 4.1 Otomatik

- [ ] `lint + typecheck + test + build` PASS
- [ ] `RunaSheet`, `RunaModal`, `HistorySheet`, `MenuSheet`, `ContextSheet` komponentleri export ediliyor
- [ ] Command palette `Ctrl+K` (Win/Linux) + `Cmd+K` (Mac) ile açılıyor (klavye event listener test'i)

### 4.2 Lock test güncellemesi

- `RunaSheet` ve `RunaModal` `apps/web/src/components/ui/` altında.
- ChatHeader'daki `‹` butonu `aria-controls` ile history sheet'e bağlı.
- Mobile menu sheet `⋯` butonu Menu icon (`MoreHorizontal`) kullanıyor.

### 4.3 Görsel kanıt

`docs/design-audit/screenshots/2026-05-XX-ui-restructure-pr-6-sheets-palette/`:

- [ ] `desktop-1440-command-palette-open.png` — Ctrl+K ile palette açık
- [ ] `desktop-1440-command-palette-filtered.png` — "tema" yazılmış, filtrelenmiş liste
- [ ] `mobile-390-history-sheet-open.png` — `‹` tıklandı, history sheet aşağıdan açılmış
- [ ] `mobile-390-menu-sheet-open.png` — `⋯` tıklandı, menu sheet
- [ ] `mobile-390-context-sheet-open.png` — context chip tıklandı, bağlam sheet
- [ ] `desktop-1440-context-popover-open.png` — desktop'ta popover varyantı

### 4.4 İnsan-review

- [ ] Sheet açıkken altındaki sohbet **scrollable değil** (body lock).
- [ ] Sheet kapatma yolları: ×, ESC, overlay tıklama, swipe-down (mobil).
- [ ] Command palette focus trap: Tab içeride kalır.
- [ ] Klavye navigasyon palette'te: arrow up/down, enter, escape.

### 4.5 Performans + A11y

- [ ] Lighthouse A11y ≥90.
- [ ] Sheet açma animasyonu `prefers-reduced-motion: reduce` olan tarayıcıda animasyon olmadan açılır.

---

## 5. Risk ve geri-alma

| Risk | Etki | Mitigation |
|---|---|---|
| Sheet portal'ı body'ye eklenince z-index çatışması | Yüksek | `z-index: 70` overlay, `80` content; lock test bu değerleri sabitler. |
| Mobil swipe-down close gestür API'si | Orta | `framer-motion` veya basic touch handler; gestür olmazsa sadece ESC + × yeterli. |
| Command palette `Ctrl+K` ChatComposer textarea içinde tetiklenmez | Orta | `event.key === 'k' && (event.ctrlKey || event.metaKey)` yakalanır; preventDefault. |
| iOS Safari bottom sheet keyboard üst üste biner | Orta | PR-8 iOS polish'inde düzeltilir; PR-6'da bilinen sınır olarak kabul. |

**Geri-alma:** Sheet komponentleri yeni, mevcut komponentlere dokunmaz. Geri alındığında composer context chip placeholder durumuna döner.

---

## 6. Komutlar

```bash
git worktree add .claude/worktrees/runa-ui-pr-6-sheets-palette codex/ui-restructure-pr-6-sheets-palette
cd .claude/worktrees/runa-ui-pr-6-sheets-palette
pnpm install
pnpm --filter @runa/web dev

# Doğrulama
grep -n "RunaSheet" apps/web/src/components/ui/RunaSheet.tsx
grep -n "RunaModal" apps/web/src/components/ui/RunaModal.tsx
grep -n "useCommandPalette" apps/web/src/components/command/*.ts

pnpm --filter @runa/web lint
pnpm --filter @runa/web typecheck
pnpm --filter @runa/web test
pnpm --filter @runa/web build

# Görsel kanıt
pnpm --filter @runa/web exec playwright test e2e/sheets-palette.spec.ts
```

---

> Radix UI Dialog primitive zaten kullanılıyor mu (paket altındaki `Tooltip` import'lara bak); yoksa minimum bağımlılık ile kendi Dialog wrapper'ı yaz. Kararı Codex iş başlamadan kullanıcıya danışabilir.
