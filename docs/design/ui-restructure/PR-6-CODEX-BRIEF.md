# PR-6 Codex Brief â€” Sheets + Modal + Command Palette

> **Tarih:** 2026-05-13
> **Branch:** `codex/ui-restructure-pr-6-sheets-palette`
> **Worktree:** `.claude/worktrees/runa-ui-pr-6-sheets-palette`
> **Authority:** `docs/design/RUNA-DESIGN-BRIEF.md` v1.1
> **BaÄŸÄ±mlÄ±lÄ±k:** PR-4 ve PR-5 merge edilmiÅŸ olmalÄ±.
> **Hedef:** Mobil sekonder navigasyonu sheet sistemine taÅŸÄ±, command palette UI'sÄ±nÄ± implement et, modal pattern'ini kur.

---

## 1. Tek cÃ¼mle hedef

Bu PR'dan sonra mobilde `â€¹` history sheet, `â‹¯` menÃ¼ sheet, composer context chip'inden aÃ§Ä±lan BaÄŸlam sheet'i, ve `Ctrl+K`/`âŒ˜K` ile aÃ§Ä±lan command palette Ã§alÄ±ÅŸÄ±r. TÃ¼m sekonder iÅŸlemler sohbet sÃ¼tununun Ã¼stÃ¼ne Ã§Ä±kmaz, sheet/modal katmanlarÄ±nda yaÅŸar.

---

## 2. Kapsam â€” YapÄ±lacaklar

### 2.1 `RunaSheet` komponenti

**Yeni dosya:** `apps/web/src/components/ui/RunaSheet.tsx`

```typescript
import { Dialog } from 'radix-ui-react-dialog'; // veya halihazÄ±rda kullanÄ±lan primitives
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
            <Dialog.Close className={styles.close} aria-label="Kapat">Ã—</Dialog.Close>
          </header>
          {description && <p id="sheet-desc" className={styles.description}>{description}</p>}
          <div className={styles.body}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

CSS Ã¶nemli noktalar:
- Bottom sheet: `transform: translateY(100%)` â†’ `translateY(0)`, `--ease-emphasized` 220ms.
- Overlay: `var(--overlay)` background, `backdrop-filter: blur(6px)`.
- `max-height: calc(100dvh - 40px)`.
- Safe-area-inset-bottom padding.
- Escape ile kapanÄ±r, swipe-down ile kapanÄ±r (gerekirse `framer-motion` veya manual touch handler).

### 2.2 `RunaModal` komponenti

**Yeni dosya:** `apps/web/src/components/ui/RunaModal.tsx`

Sheet'in masaÃ¼stÃ¼/centered varyantÄ±. AynÄ± `Dialog` primitive, farklÄ± CSS:

- `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%)`
- `max-width: 480px; max-height: 80dvh`
- Klavye Esc + outside click ile kapanÄ±r
- Focus trap

### 2.3 Command Palette UI

**Mevcut dosya:** `apps/web/src/components/command/CommandPalette.tsx` (zaten var; AppShell'den Ã§aÄŸrÄ±lÄ±yor)
**Mevcut dosya:** `apps/web/src/components/command/useCommandPalette.ts` (state hook)

Bu PR'da:
- Mevcut CommandPalette `RunaModal` kullanacak ÅŸekilde refactor edilir.
- `useCommandPalette` hook'u global `Ctrl+K`/`âŒ˜K` listener'Ä± kayÄ±t eder (zaten var).
- Komut listesi `createAppCommands` (AppShell.tsx:46-107) geniÅŸletilir:
  - `Yeni sohbet baÅŸlat` (`Ctrl+N`)
  - `BaÄŸlamÄ± aÃ§` (PR-6 ile gelen BaÄŸlam sheet'i aÃ§)
  - `Tema deÄŸiÅŸtir` (sub-menu: Ember Dark, Light, Rose, Sistem)
  - `GeliÅŸmiÅŸ gÃ¶rÃ¼nÃ¼m` toggle
  - `Bildirimleri gÃ¶ster`
  - `GeÃ§miÅŸi aÃ§`
- Komut listesi fuzzy search ile filtrelenir (yeni helper veya `fuse.js`).
- Komut item'larda keyboard shortcut gÃ¶rÃ¼nÃ¼r.

### 2.4 History Sheet (mobil)

**Yeni dosya:** `apps/web/src/components/chat/HistorySheet.tsx`

ChatHeader'daki `â€¹` butonu aÃ§ar. Ä°Ã§inde:
- `ConversationSidebar` komponentinin mevcut yapÄ±sÄ±, sheet wrapper'a sarÄ±lÄ±.
- Mobil iÃ§in optimize: tek kolon, baÅŸÄ±na `+ Yeni sohbet` primary CTA.

ChatHeader'daki `â€¹` butonu sadece `<768px`'te gÃ¶rÃ¼nÃ¼r; desktop'ta sidebar zaten visible olduÄŸu iÃ§in `â€¹` gizli.

### 2.5 Menu Sheet (mobil)

**Yeni dosya:** `apps/web/src/components/app/MenuSheet.tsx`

ChatHeader'daki `â‹¯` butonu aÃ§ar. Ä°Ã§inde dikey liste:
- Cihazlar
- GeÃ§miÅŸ
- Hesap
- Ayarlar
- GeliÅŸmiÅŸ gÃ¶rÃ¼nÃ¼m (toggle)
- Bildirimler
- YardÄ±m & geri bildirim (yer tutucu)

### 2.6 Context Sheet (mobil + desktop popover)

**Yeni dosya:** `apps/web/src/components/chat/ContextSheet.tsx`

Composer context chip'i aÃ§ar. Ä°Ã§eriÄŸi:
- "Ã‡alÄ±ÅŸma klasÃ¶rÃ¼" baÅŸlÄ±ÄŸÄ± + path (truncate)
- "Ekler" listesi (`attachments` array)
- "AÃ§Ä±k working files" listesi (PR-3'te eklenecek; ÅŸu an boÅŸ)
- "BaÄŸlamÄ± dÃ¼zenle" butonu (PR-7'de)

Desktop'ta sheet yerine `<RunaPopover>` (yeni mini komponent â€” alternatif: aynÄ± sheet ama side="right" 320px).

### 2.7 ChatHeader entegrasyonu

**Dosya:** `apps/web/src/components/chat/ChatHeader.tsx`

PR-2'de eklenen `â€¹` ve `â‹¯` placeholder butonlarÄ± gerÃ§ek handler'larÄ±na baÄŸlanÄ±r:

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

### 2.8 ChatPage sheet state yÃ¶netimi

**Dosya:** `apps/web/src/pages/ChatPage.tsx`

Yeni state'ler:

```tsx
const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);
const [isMenuSheetOpen, setIsMenuSheetOpen] = useState(false);
const [isContextSheetOpen, setIsContextSheetOpen] = useState(false);
```

Eski `isConversationSidebarOpen` mobil iÃ§in bu state'lere baÄŸlanÄ±r; desktop'ta sidebar zaten visible.

ChatPage render'Ä±nÄ±n sonuna sheet'ler eklenir:

```tsx
<HistorySheet open={isHistorySheetOpen} onOpenChange={setIsHistorySheetOpen} ... />
<MenuSheet open={isMenuSheetOpen} onOpenChange={setIsMenuSheetOpen} ... />
<ContextSheet open={isContextSheetOpen} onOpenChange={setIsContextSheetOpen} ... />
```

### 2.9 Composer context chip â†’ sheet trigger

**Dosya:** `apps/web/src/components/chat/ChatComposerSurface.tsx`

PR-2'de placeholder kalan `onOpenContextSheet` callback artÄ±k `setIsContextSheetOpen(true)` Ã§aÄŸÄ±rÄ±r. ChatPage'den prop olarak iletilir.

---

## 3. Kapsam dÄ±ÅŸÄ±

- âŒ Stop button + abort UI â†’ PR-7'de.
- âŒ Settings sayfasÄ± yeniden yazÄ±mÄ± â†’ PR-7'de.
- âŒ Theme picker UI â†’ PR-7'de (command palette sub-menu placeholder olarak kalÄ±r).
- âŒ iOS visualViewport hook â†’ PR-8'de.

---

## 4. Kabul Kriteri

### 4.1 Otomatik

- [ ] `lint + typecheck + test + build` PASS
- [ ] `RunaSheet`, `RunaModal`, `HistorySheet`, `MenuSheet`, `ContextSheet` komponentleri export ediliyor
- [ ] Command palette `Ctrl+K` (Win/Linux) + `Cmd+K` (Mac) ile aÃ§Ä±lÄ±yor (klavye event listener test'i)

### 4.2 Lock test gÃ¼ncellemesi

- `RunaSheet` ve `RunaModal` `apps/web/src/components/ui/` altÄ±nda.
- ChatHeader'daki `â€¹` butonu `aria-controls` ile history sheet'e baÄŸlÄ±.
- Mobile menu sheet `â‹¯` butonu Menu icon (`MoreHorizontal`) kullanÄ±yor.

### 4.3 GÃ¶rsel kanÄ±t

`docs/design-audit/screenshots/`:

- [ ] `desktop-1440-command-palette-open.png` â€” Ctrl+K ile palette aÃ§Ä±k
- [ ] `desktop-1440-command-palette-filtered.png` â€” "tema" yazÄ±lmÄ±ÅŸ, filtrelenmiÅŸ liste
- [ ] `mobile-390-history-sheet-open.png` â€” `â€¹` tÄ±klandÄ±, history sheet aÅŸaÄŸÄ±dan aÃ§Ä±lmÄ±ÅŸ
- [ ] `mobile-390-menu-sheet-open.png` â€” `â‹¯` tÄ±klandÄ±, menu sheet
- [ ] `mobile-390-context-sheet-open.png` â€” context chip tÄ±klandÄ±, baÄŸlam sheet
- [ ] `desktop-1440-context-popover-open.png` â€” desktop'ta popover varyantÄ±

### 4.4 Ä°nsan-review

- [ ] Sheet aÃ§Ä±kken altÄ±ndaki sohbet **scrollable deÄŸil** (body lock).
- [ ] Sheet kapatma yollarÄ±: Ã—, ESC, overlay tÄ±klama, swipe-down (mobil).
- [ ] Command palette focus trap: Tab iÃ§eride kalÄ±r.
- [ ] Klavye navigasyon palette'te: arrow up/down, enter, escape.

### 4.5 Performans + A11y

- [ ] Lighthouse A11y â‰¥90.
- [ ] Sheet aÃ§ma animasyonu `prefers-reduced-motion: reduce` olan tarayÄ±cÄ±da animasyon olmadan aÃ§Ä±lÄ±r.

---

## 5. Risk ve geri-alma

| Risk | Etki | Mitigation |
|---|---|---|
| Sheet portal'Ä± body'ye eklenince z-index Ã§atÄ±ÅŸmasÄ± | YÃ¼ksek | `z-index: 70` overlay, `80` content; lock test bu deÄŸerleri sabitler. |
| Mobil swipe-down close gestÃ¼r API'si | Orta | `framer-motion` veya basic touch handler; gestÃ¼r olmazsa sadece ESC + Ã— yeterli. |
| Command palette `Ctrl+K` ChatComposer textarea iÃ§inde tetiklenmez | Orta | `event.key === 'k' && (event.ctrlKey || event.metaKey)` yakalanÄ±r; preventDefault. |
| iOS Safari bottom sheet keyboard Ã¼st Ã¼ste biner | Orta | PR-8 iOS polish'inde dÃ¼zeltilir; PR-6'da bilinen sÄ±nÄ±r olarak kabul. |

**Geri-alma:** Sheet komponentleri yeni, mevcut komponentlere dokunmaz. Geri alÄ±ndÄ±ÄŸÄ±nda composer context chip placeholder durumuna dÃ¶ner.

---

## 6. Komutlar

```bash
git worktree add .claude/worktrees/runa-ui-pr-6-sheets-palette codex/ui-restructure-pr-6-sheets-palette
cd .claude/worktrees/runa-ui-pr-6-sheets-palette
pnpm install
pnpm --filter @runa/web dev

# DoÄŸrulama
grep -n "RunaSheet" apps/web/src/components/ui/RunaSheet.tsx
grep -n "RunaModal" apps/web/src/components/ui/RunaModal.tsx
grep -n "useCommandPalette" apps/web/src/components/command/*.ts

pnpm --filter @runa/web lint
pnpm --filter @runa/web typecheck
pnpm --filter @runa/web test
pnpm --filter @runa/web build

# GÃ¶rsel kanÄ±t
pnpm --filter @runa/web exec playwright test e2e/sheets-palette.spec.ts
```

---

> Radix UI Dialog primitive zaten kullanÄ±lÄ±yor mu (paket altÄ±ndaki `Tooltip` import'lara bak); yoksa minimum baÄŸÄ±mlÄ±lÄ±k ile kendi Dialog wrapper'Ä± yaz. KararÄ± Codex iÅŸ baÅŸlamadan kullanÄ±cÄ±ya danÄ±ÅŸabilir.


