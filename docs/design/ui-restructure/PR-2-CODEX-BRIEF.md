# PR-2 Codex Brief â€” Layout Shell

> **Tarih:** 2026-05-13
> **Branch:** `codex/ui-restructure-pr-2-layout-shell`
> **Worktree:** `.claude/worktrees/runa-ui-pr-2-layout-shell`
> **Authority:** `docs/design/RUNA-DESIGN-BRIEF.md` v1.1 (yetki belgesi)
> **BaÄŸÄ±mlÄ±lÄ±k:** PR-1 merge edilmiÅŸ olmalÄ±.
> **Hedef:** Chat sayfasÄ±nÄ±n layout iskeletini yeni dile geÃ§ir â€” sol sidebar, tek-satÄ±r top bar, saÄŸ rail kaldÄ±rma, composer context chip, mobil sheet altyapÄ±sÄ±.

---

## 1. Tek cÃ¼mle hedef

Bu PR'dan sonra chat sayfasÄ±nda **saÄŸ rail tamamen kalkar**, **AppNav sol sidebar'a iner**, **floating Ctrl+K pill** ve **iÃ§ iÃ§e framed shell katmanlarÄ±** ortadan kalkar. Sohbet sÃ¼tunu tek odak hÃ¢line gelir.

## 2. Kapsam â€” YapÄ±lacaklar

### 2.1 Floating Ctrl+K pilli kaldÄ±r

**Dosya:** `apps/web/src/components/app/AppShell.tsx:128-152`
**Dosya:** `apps/web/src/styles/routes/app-shell-migration.css:225-230` (`.runa-page--chat-product > .runa-command-palette-trigger` fixed-position kuralÄ±)

Chat sayfasÄ± dalÄ±ndaki `position: fixed; right:14px; top:14px; z-index:70` floating pill kaldÄ±rÄ±lÄ±r. Komut paleti tetikleyici **inline** olarak yeni top bar'a yerleÅŸir. DiÄŸer route'larda hero header iÃ§inde kalan tetikleyici de aynÄ± top-bar pattern'ine taÅŸÄ±nÄ±r.

### 2.2 AppNav'Ä± sol sidebar'a taÅŸÄ±

**Dosya:** `apps/web/src/components/app/AppNav.tsx` (mevcut tile-row layout, line 52-93)
**Dosya:** `apps/web/src/components/app/AppShell.tsx` (chat ve diÄŸer route'lar)

Mevcut tile-row layout (`Sohbet / GeÃ§miÅŸ / Cihazlar / Hesap`) sol sidebar'a iner. Yeni komponent: `apps/web/src/components/app/AppSidebar.tsx`.

Sidebar yapÄ±sÄ± (240px sabit geniÅŸlik, desktop â‰¥1024px):

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ [HafÄ±za R] Runa        â”‚  â† brand row (HafizaMark regular + serif "Runa")
â”‚                        â”‚
â”‚ + Yeni sohbet          â”‚  â† primary button
â”‚                        â”‚
â”‚ â”Œâ”€ BugÃ¼n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚ â”‚ Sohbet listesi     â”‚ â”‚  â† ConversationSidebar buradan iÃ§eri
â”‚ â”‚ ...                â”‚ â”‚
â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚                        â”‚
â”‚ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€      â”‚
â”‚ Cihazlar               â”‚  â† AppNav items
â”‚ GeÃ§miÅŸ                 â”‚
â”‚ Hesap                  â”‚
â”‚ Ayarlar                â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

- ChatHeader'daki menÃ¼ butonu (`<Menu>`) sadece mobilde gÃ¶rÃ¼nÃ¼r (>1024px desktop'ta gizli).
- Sidebar `position: sticky; top: 0; height: 100dvh` ile sabit.
- Mobilde sidebar `display: contents` ile kapanÄ±r; AppNav tile-row da artÄ±k olmadÄ±ÄŸÄ± iÃ§in bottom tab bar kaldÄ±rÄ±lÄ±r.

### 2.3 Bottom tab bar kaldÄ±r (mobil)

**Dosya:** `apps/web/src/styles/components.css:1934-1953` (`.runa-app-nav` mobil fixed-position kuralÄ±)

`@media (max-width: 768px)` altÄ±ndaki `.runa-app-nav { position: fixed; bottom: 8px; }` kurallarÄ± **silinir**. AppNav komponenti mobilde tamamen render olmaz (sidebar pattern). Mobil navigasyon `â€¹` (history sheet) ve `â‹¯` (menÃ¼ sheet) butonlarÄ±yla yapÄ±lÄ±r.

`runa-page--chat-product` mobil `padding-bottom: 148px` kuralÄ± (`components.css:1929-1932`) `padding-bottom: 0` olur â€” bottom nav yok artÄ±k.

### 2.4 ChatHeader yeniden Ã§iz

**Dosya:** `apps/web/src/components/chat/ChatHeader.tsx:29-69`

Mevcut yapÄ±: menÃ¼ + brand + presence + ayarlar.
Yeni yapÄ±: tek satÄ±r, **konuÅŸma baÅŸlÄ±ÄŸÄ±** + saÄŸda **inline komut paleti pill** + bildirim ikon + ayarlar ikon.

```tsx
<header className="runa-chat-header">
  <h1 className="runa-chat-header__title">{conversationTitle ?? 'Yeni sohbet'}</h1>
  <div className="runa-chat-header__actions">
    <CommandPaletteButton />   {/* Yeni: PR-6'da implement edilecek */}
    <button aria-label="Bildirimler">...</button>
    <Link to="/account" aria-label="Hesap">...</Link>
  </div>
</header>
```

- "Sohbet devam ediyor" alt baÅŸlÄ±ÄŸÄ± **kaldÄ±rÄ±lÄ±r**.
- Presence chip kaldÄ±rÄ±lÄ±r (PR-3'te baÄŸlantÄ± durumu sidebar'da kÃ¼Ã§Ã¼k dot olarak gÃ¶rÃ¼nÃ¼r).
- Mobilde sol-Ã¼stte `â€¹` (history sheet trigger) + saÄŸ-Ã¼stte `â‹¯` (menu sheet trigger) butonlarÄ±.

### 2.5 WorkInsightPanel'i kaldÄ±r

**Dosya:** `apps/web/src/components/chat/WorkInsightPanel.tsx` (tÃ¼m dosya silinir)
**Dosya:** `apps/web/src/components/chat/WorkInsightPanel.module.css` (tÃ¼m dosya silinir)
**Dosya:** `apps/web/src/pages/ChatPage.tsx:304-314` (insights slot'una verilen WorkInsightPanel mount kaldÄ±rÄ±lÄ±r)
**Dosya:** `apps/web/src/components/chat/ChatLayout.tsx:14-58` (insights slot tamamen kaldÄ±rÄ±lÄ±r)

ChatLayout slot'larÄ± yeni hÃ¢liyle: `sidebar`, `messages`, `composer`. Insights yok.

CSS tarafÄ±nda:
- `apps/web/src/styles/components.css:718-755` (`.runa-chat-layout` 3-kolon grid) â†’ 2-kolon: `minmax(220px, 280px) minmax(0, 1fr)`.
- `apps/web/src/styles/components.css:727-733` (`.runa-chat-layout__insights` referansÄ±) â†’ silinir.
- `apps/web/src/styles/components.css:1801-1803, 1917-1919` (insights mobil order) â†’ silinir.
- `apps/web/src/styles/primitives.css:525-547` duplicate `.runa-chat-layout` tanÄ±mÄ± â†’ silinir (component.css tek tanÄ±m kalÄ±r).

### 2.6 Composer context chip

**Dosya:** `apps/web/src/components/chat/ChatComposerSurface.tsx`

Composer sol-altÄ±na yeni inline chip:

```tsx
{contextCount > 0 && (
  <button
    type="button"
    className="runa-composer-context-chip"
    onClick={onOpenContextSheet}
    aria-label={`${contextCount} Ã§alÄ±ÅŸma Ã¶gesi Â· BaÄŸlamÄ± aÃ§`}
  >
    <Paperclip size={14} aria-hidden />
    <span>{contextCount} working files</span>
    <ChevronRight size={14} aria-hidden />
  </button>
)}
```

- `contextCount = attachmentCount + workingFileCount`. GeÃ§ici olarak yalnÄ±z `attachmentCount` kullanÄ±lÄ±r (`workingFileCount` PR-3'te eklenecek).
- `presentationRunSurfaceCount` artÄ±k chip'e dahil deÄŸil.
- TÄ±klayÄ±nca `onOpenContextSheet` callback (PR-6'da sheet implement edilene kadar `console.warn` veya disabled).
- BoÅŸ durumda chip render edilmez.

Yeni CSS sÄ±nÄ±fÄ±: `.runa-composer-context-chip` (`apps/web/src/styles/components.css`'e eklenir).

### 2.7 Layout primitives temizliÄŸi

**Dosya:** `apps/web/src/styles/primitives.css:525-547` (`.runa-chat-layout` duplicate tanÄ±mÄ±)

Bu tanÄ±m silinir; `components.css:718-755` tek source of truth.

**Dosya:** `apps/web/src/components/chat/ChatShell.tsx:10-36`

`ChatShell` Ã§ift `RunaSurface` sarmal â€” `embedded` dalÄ± korunur, default dal sadeleÅŸir:

```tsx
return (
  <main id="chat-workspace-content" className={styles.standard}>
    {children}
  </main>
);
```

`runa-page` ve `runa-shell-frame` katmanlarÄ± kaldÄ±rÄ±lÄ±r.

### 2.8 `*-migration.css` dosyalarÄ±nÄ± sandboxla

**Karar (kullanÄ±cÄ± onayÄ± sonrasÄ±):**

`apps/web/src/styles/routes/*-migration.css` dosyalarÄ± **temizleme aÅŸamasÄ±na alÄ±nÄ±r** ama **bu PR'da silinmez**. Sebep: birden Ã§ok route bu dosyalardaki sÄ±nÄ±flara baÄŸÄ±mlÄ±; toptan silme risk.

Bu PR'da yapÄ±lacaklar:
- `chat-migration.css` boÅŸ bir comment dosyasÄ± (sadece header) hÃ¢line getirilir; iÃ§indeki kurallar `components.css`'e taÅŸÄ±nÄ±r.
- DiÄŸer migration dosyalarÄ± PR-7'de temizlenir; PR-2 brief'i bu kararÄ± dokÃ¼mante eder.
- Eklenen TODO: `apps/web/src/styles/routes/README.md` oluÅŸtur, "PR-7'de migration cleanup" notu dÃ¼ÅŸ.

### 2.9 ChatPage prop temizliÄŸi

**Dosya:** `apps/web/src/pages/ChatPage.tsx:280-330`

`insights` slot kaldÄ±rÄ±ldÄ±ÄŸÄ± iÃ§in:
- `WorkInsightPanel` import silinir
- `WorkInsightPanel` prop'larÄ±nÄ± besleyen `attachmentCount`, `presentationRunSurfaceCount`, `desktopDevices`, `isDesktopDevicesLoading`, `selectedDesktopTargetConnectionId` ChatLayout'a iletilmez.
- `desktopDevices` yine `ChatComposerSurface`'e gider (DesktopTargetSelector iÃ§in), kullanÄ±m korunur.

---

## 3. Kapsam dÄ±ÅŸÄ± â€” Bu PR'da YAPMA

- âŒ RunProgressPanel / PresentationRunSurfaceCard sohbet iÃ§inden kaldÄ±rma â†’ PR-3'te.
- âŒ PersistedTranscript rol etiketi / timestamp temizliÄŸi â†’ PR-3'te.
- âŒ ApprovalBlock yeniden yazÄ±mÄ± â†’ PR-4'te.
- âŒ ToolResultBlock error chip temizliÄŸi â†’ PR-5'te.
- âŒ Sheet sistemi implementasyonu (`<RunaSheet>`) â†’ PR-6'da. Bu PR'da context chip "tÄ±klanÄ±r ama disabled" durumda kalÄ±r.
- âŒ Command palette UI implementasyonu â†’ PR-6'da. Bu PR'da CommandPaletteButton placeholder.
- âŒ Settings sayfasÄ± yeniden yazÄ±mÄ± â†’ PR-7'de.
- âŒ Migration CSS dosyalarÄ±nÄ±n toptan silinmesi â†’ PR-7'de.

---

## 4. Kabul Kriteri

### 4.1 Otomatik (CI)

- [ ] `pnpm --filter @runa/web lint` â†’ PASS (baseline istisna)
- [ ] `pnpm --filter @runa/web typecheck` â†’ PASS
- [ ] `pnpm --filter @runa/web test` â†’ PASS
- [ ] `pnpm --filter @runa/web build` â†’ PASS
- [ ] `apps/web` iÃ§inde `WorkInsightPanel` referansÄ± **0** (grep boÅŸ)
- [ ] `apps/web` iÃ§inde `.runa-chat-layout__insights` selektÃ¶rÃ¼ **0** (grep boÅŸ)
- [ ] `apps/web` iÃ§inde `runa-command-palette-trigger` `position: fixed` kuralÄ± **yok**

### 4.2 Lock test gÃ¼ncellemesi

Yeni assertion'lar:
- `apps/web/src/components/chat/WorkInsightPanel.tsx` dosyasÄ± yok.
- `apps/web/src/components/chat/ChatLayout.tsx` iÃ§inde `insights` prop'u tanÄ±mlÄ± deÄŸil.
- `components.css` iÃ§inde `runa-chat-layout` grid-template-columns deÄŸeri 2-kolon (`minmax(220px, 280px) minmax(0, 1fr)`).
- `AppShell.tsx` chat dalÄ±nda `runa-command-palette-trigger` doÄŸrudan render edilmiyor (sidebar veya top bar iÃ§inde).

### 4.3 GÃ¶rsel kanÄ±t

`docs/design-audit/screenshots/`:

- [ ] `desktop-1440-chat-empty.png` â€” sol sidebar gÃ¶rÃ¼nÃ¼r, saÄŸ rail yok, Ã¼st bar tek satÄ±r
- [ ] `desktop-1440-chat-active.png` â€” aktif sohbet, layout 2-kolon
- [ ] `desktop-1920-chat-active.png` â€” geniÅŸ ekran
- [ ] `mobile-390-chat-empty.png` â€” bottom tab bar yok, top bar'da `â€¹` ve `â‹¯`
- [ ] `mobile-390-composer-focus.png` â€” composer focus
- [ ] `mobile-320-chat-empty.png` â€” dar viewport

### 4.4 Ä°nsan-review

- [ ] SaÄŸ rail (Ä°lerleme / MasaÃ¼stÃ¼ / BaÄŸlam kartlarÄ±) **hiÃ§bir** ekran gÃ¶rÃ¼ntÃ¼sÃ¼nde yok.
- [ ] Floating "Komut ara Ctrl K" pilli **hiÃ§bir** ekran gÃ¶rÃ¼ntÃ¼sÃ¼nde yok.
- [ ] AppNav sol sidebar'da, mobilde tamamen gizli.
- [ ] Bottom tab bar (Sohbet/GeÃ§miÅŸ/Cihazlar/Hesap) mobilde **yok**.
- [ ] ChatHeader tek satÄ±r: baÅŸlÄ±k + saÄŸ ikonlar.
- [ ] Composer context chip sadece `attachmentCount > 0` durumda gÃ¶rÃ¼nÃ¼r.

### 4.5 Performans

- [ ] Lighthouse Performance â‰¥85 (mobile)
- [ ] CLS â‰¤0.1 (layout shift)

---

## 5. Risk ve geri-alma

| Risk | Etki | Mitigation |
|---|---|---|
| WorkInsightPanel silinince ChatPage prop chain bozulur | YÃ¼ksek | TypeScript zorlar; typecheck PASS olmadan PR aÃ§Ä±lmaz. |
| `*-migration.css` cleanup yarÄ±m kalÄ±r â†’ gÃ¶rsel regression | Orta | Bu PR'da yalnÄ±z `chat-migration.css` taÅŸÄ±nÄ±r; diÄŸerleri PR-7'ye ertelenir. |
| Sidebar 240px desktop iÃ§in fazla â†’ chat dar kalÄ±r | DÃ¼ÅŸÃ¼k | Sidebar geniÅŸliÄŸi `--sidebar-width` token'Ä± ile dÄ±ÅŸa aÃ§Ä±lÄ±r; ayarlanabilir. |
| Mobil bottom nav kaldÄ±rÄ±lÄ±nca discovery zayÄ±flar | Orta | PR-6'da menu sheet (`â‹¯`) tÃ¼m route'larÄ± gÃ¶sterir; geÃ§iÅŸ sÃ¼resinde sidebar'a swipe access. |
| ChatHeader'dan presence chip kaldÄ±rÄ±lÄ±nca offline durumu gÃ¶rÃ¼nmez | Orta | PR-3 brief'inde sidebar'a kÃ¼Ã§Ã¼k "baÄŸlÄ±/Ã§evrimdÄ±ÅŸÄ±" dot eklemesi planlandÄ±. |

**Geri-alma:** PR-2 tek commit veya kÃ¼Ã§Ã¼k commit serisi olarak revert edilebilir. WorkInsightPanel restorasyonu git'ten alÄ±nÄ±r.

---

## 6. Komutlar (Codex)

```bash
cd D:/ai/Runa
git worktree add .claude/worktrees/runa-ui-pr-2-layout-shell codex/ui-restructure-pr-2-layout-shell
cd .claude/worktrees/runa-ui-pr-2-layout-shell
pnpm install
pnpm --filter @runa/web dev

# Migration check
grep -r "WorkInsightPanel" apps/web/src || echo "PASS: no references"
grep -r "runa-chat-layout__insights" apps/web || echo "PASS: no references"
grep -rE "position:\s*fixed[^}]*runa-command-palette-trigger" apps/web/src/styles || echo "PASS: no floating trigger"

# DoÄŸrulama
pnpm --filter @runa/web lint
pnpm --filter @runa/web typecheck
pnpm --filter @runa/web test
pnpm --filter @runa/web build
```

---

> Brief v1.1 ile Ã§akÄ±ÅŸma olursa brief kazanÄ±r. Belirsizlik Ã§Ä±karsa Codex iÅŸ baÅŸlamadan kullanÄ±cÄ±ya sorar; tahmin yapmaz.


