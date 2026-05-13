# PR-2 Codex Brief — Layout Shell

> **Tarih:** 2026-05-13
> **Branch:** `codex/ui-restructure-pr-2-layout-shell`
> **Worktree:** `.claude/worktrees/runa-ui-pr-2-layout-shell`
> **Authority:** `docs/frontend mimar/RUNA-DESIGN-BRIEF.md` v1.1 (yetki belgesi)
> **Bağımlılık:** PR-1 merge edilmiş olmalı.
> **Hedef:** Chat sayfasının layout iskeletini yeni dile geçir — sol sidebar, tek-satır top bar, sağ rail kaldırma, composer context chip, mobil sheet altyapısı.

---

## 1. Tek cümle hedef

Bu PR'dan sonra chat sayfasında **sağ rail tamamen kalkar**, **AppNav sol sidebar'a iner**, **floating Ctrl+K pill** ve **iç içe framed shell katmanları** ortadan kalkar. Sohbet sütunu tek odak hâline gelir.

## 2. Kapsam — Yapılacaklar

### 2.1 Floating Ctrl+K pilli kaldır

**Dosya:** `apps/web/src/components/app/AppShell.tsx:128-152`
**Dosya:** `apps/web/src/styles/routes/app-shell-migration.css:225-230` (`.runa-page--chat-product > .runa-command-palette-trigger` fixed-position kuralı)

Chat sayfası dalındaki `position: fixed; right:14px; top:14px; z-index:70` floating pill kaldırılır. Komut paleti tetikleyici **inline** olarak yeni top bar'a yerleşir. Diğer route'larda hero header içinde kalan tetikleyici de aynı top-bar pattern'ine taşınır.

### 2.2 AppNav'ı sol sidebar'a taşı

**Dosya:** `apps/web/src/components/app/AppNav.tsx` (mevcut tile-row layout, line 52-93)
**Dosya:** `apps/web/src/components/app/AppShell.tsx` (chat ve diğer route'lar)

Mevcut tile-row layout (`Sohbet / Geçmiş / Cihazlar / Hesap`) sol sidebar'a iner. Yeni komponent: `apps/web/src/components/app/AppSidebar.tsx`.

Sidebar yapısı (240px sabit genişlik, desktop ≥1024px):

```
┌────────────────────────┐
│ [Hafıza R] Runa        │  ← brand row (HafizaMark regular + serif "Runa")
│                        │
│ + Yeni sohbet          │  ← primary button
│                        │
│ ┌─ Bugün ────────────┐ │
│ │ Sohbet listesi     │ │  ← ConversationSidebar buradan içeri
│ │ ...                │ │
│ └────────────────────┘ │
│                        │
│ ─────────────────      │
│ Cihazlar               │  ← AppNav items
│ Geçmiş                 │
│ Hesap                  │
│ Ayarlar                │
└────────────────────────┘
```

- ChatHeader'daki menü butonu (`<Menu>`) sadece mobilde görünür (>1024px desktop'ta gizli).
- Sidebar `position: sticky; top: 0; height: 100dvh` ile sabit.
- Mobilde sidebar `display: contents` ile kapanır; AppNav tile-row da artık olmadığı için bottom tab bar kaldırılır.

### 2.3 Bottom tab bar kaldır (mobil)

**Dosya:** `apps/web/src/styles/components.css:1934-1953` (`.runa-app-nav` mobil fixed-position kuralı)

`@media (max-width: 768px)` altındaki `.runa-app-nav { position: fixed; bottom: 8px; }` kuralları **silinir**. AppNav komponenti mobilde tamamen render olmaz (sidebar pattern). Mobil navigasyon `‹` (history sheet) ve `⋯` (menü sheet) butonlarıyla yapılır.

`runa-page--chat-product` mobil `padding-bottom: 148px` kuralı (`components.css:1929-1932`) `padding-bottom: 0` olur — bottom nav yok artık.

### 2.4 ChatHeader yeniden çiz

**Dosya:** `apps/web/src/components/chat/ChatHeader.tsx:29-69`

Mevcut yapı: menü + brand + presence + ayarlar.
Yeni yapı: tek satır, **konuşma başlığı** + sağda **inline komut paleti pill** + bildirim ikon + ayarlar ikon.

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

- "Sohbet devam ediyor" alt başlığı **kaldırılır**.
- Presence chip kaldırılır (PR-3'te bağlantı durumu sidebar'da küçük dot olarak görünür).
- Mobilde sol-üstte `‹` (history sheet trigger) + sağ-üstte `⋯` (menu sheet trigger) butonları.

### 2.5 WorkInsightPanel'i kaldır

**Dosya:** `apps/web/src/components/chat/WorkInsightPanel.tsx` (tüm dosya silinir)
**Dosya:** `apps/web/src/components/chat/WorkInsightPanel.module.css` (tüm dosya silinir)
**Dosya:** `apps/web/src/pages/ChatPage.tsx:304-314` (insights slot'una verilen WorkInsightPanel mount kaldırılır)
**Dosya:** `apps/web/src/components/chat/ChatLayout.tsx:14-58` (insights slot tamamen kaldırılır)

ChatLayout slot'ları yeni hâliyle: `sidebar`, `messages`, `composer`. Insights yok.

CSS tarafında:
- `apps/web/src/styles/components.css:718-755` (`.runa-chat-layout` 3-kolon grid) → 2-kolon: `minmax(220px, 280px) minmax(0, 1fr)`.
- `apps/web/src/styles/components.css:727-733` (`.runa-chat-layout__insights` referansı) → silinir.
- `apps/web/src/styles/components.css:1801-1803, 1917-1919` (insights mobil order) → silinir.
- `apps/web/src/styles/primitives.css:525-547` duplicate `.runa-chat-layout` tanımı → silinir (component.css tek tanım kalır).

### 2.6 Composer context chip

**Dosya:** `apps/web/src/components/chat/ChatComposerSurface.tsx`

Composer sol-altına yeni inline chip:

```tsx
{contextCount > 0 && (
  <button
    type="button"
    className="runa-composer-context-chip"
    onClick={onOpenContextSheet}
    aria-label={`${contextCount} çalışma ögesi · Bağlamı aç`}
  >
    <Paperclip size={14} aria-hidden />
    <span>{contextCount} working files</span>
    <ChevronRight size={14} aria-hidden />
  </button>
)}
```

- `contextCount = attachmentCount + workingFileCount`. Geçici olarak yalnız `attachmentCount` kullanılır (`workingFileCount` PR-3'te eklenecek).
- `presentationRunSurfaceCount` artık chip'e dahil değil.
- Tıklayınca `onOpenContextSheet` callback (PR-6'da sheet implement edilene kadar `console.warn` veya disabled).
- Boş durumda chip render edilmez.

Yeni CSS sınıfı: `.runa-composer-context-chip` (`apps/web/src/styles/components.css`'e eklenir).

### 2.7 Layout primitives temizliği

**Dosya:** `apps/web/src/styles/primitives.css:525-547` (`.runa-chat-layout` duplicate tanımı)

Bu tanım silinir; `components.css:718-755` tek source of truth.

**Dosya:** `apps/web/src/components/chat/ChatShell.tsx:10-36`

`ChatShell` çift `RunaSurface` sarmal — `embedded` dalı korunur, default dal sadeleşir:

```tsx
return (
  <main id="chat-workspace-content" className={styles.standard}>
    {children}
  </main>
);
```

`runa-page` ve `runa-shell-frame` katmanları kaldırılır.

### 2.8 `*-migration.css` dosyalarını sandboxla

**Karar (kullanıcı onayı sonrası):**

`apps/web/src/styles/routes/*-migration.css` dosyaları **temizleme aşamasına alınır** ama **bu PR'da silinmez**. Sebep: birden çok route bu dosyalardaki sınıflara bağımlı; toptan silme risk.

Bu PR'da yapılacaklar:
- `chat-migration.css` boş bir comment dosyası (sadece header) hâline getirilir; içindeki kurallar `components.css`'e taşınır.
- Diğer migration dosyaları PR-7'de temizlenir; PR-2 brief'i bu kararı dokümante eder.
- Eklenen TODO: `apps/web/src/styles/routes/README.md` oluştur, "PR-7'de migration cleanup" notu düş.

### 2.9 ChatPage prop temizliği

**Dosya:** `apps/web/src/pages/ChatPage.tsx:280-330`

`insights` slot kaldırıldığı için:
- `WorkInsightPanel` import silinir
- `WorkInsightPanel` prop'larını besleyen `attachmentCount`, `presentationRunSurfaceCount`, `desktopDevices`, `isDesktopDevicesLoading`, `selectedDesktopTargetConnectionId` ChatLayout'a iletilmez.
- `desktopDevices` yine `ChatComposerSurface`'e gider (DesktopTargetSelector için), kullanım korunur.

---

## 3. Kapsam dışı — Bu PR'da YAPMA

- ❌ RunProgressPanel / PresentationRunSurfaceCard sohbet içinden kaldırma → PR-3'te.
- ❌ PersistedTranscript rol etiketi / timestamp temizliği → PR-3'te.
- ❌ ApprovalBlock yeniden yazımı → PR-4'te.
- ❌ ToolResultBlock error chip temizliği → PR-5'te.
- ❌ Sheet sistemi implementasyonu (`<RunaSheet>`) → PR-6'da. Bu PR'da context chip "tıklanır ama disabled" durumda kalır.
- ❌ Command palette UI implementasyonu → PR-6'da. Bu PR'da CommandPaletteButton placeholder.
- ❌ Settings sayfası yeniden yazımı → PR-7'de.
- ❌ Migration CSS dosyalarının toptan silinmesi → PR-7'de.

---

## 4. Kabul Kriteri

### 4.1 Otomatik (CI)

- [ ] `pnpm --filter @runa/web lint` → PASS (baseline istisna)
- [ ] `pnpm --filter @runa/web typecheck` → PASS
- [ ] `pnpm --filter @runa/web test` → PASS
- [ ] `pnpm --filter @runa/web build` → PASS
- [ ] `apps/web` içinde `WorkInsightPanel` referansı **0** (grep boş)
- [ ] `apps/web` içinde `.runa-chat-layout__insights` selektörü **0** (grep boş)
- [ ] `apps/web` içinde `runa-command-palette-trigger` `position: fixed` kuralı **yok**

### 4.2 Lock test güncellemesi

Yeni assertion'lar:
- `apps/web/src/components/chat/WorkInsightPanel.tsx` dosyası yok.
- `apps/web/src/components/chat/ChatLayout.tsx` içinde `insights` prop'u tanımlı değil.
- `components.css` içinde `runa-chat-layout` grid-template-columns değeri 2-kolon (`minmax(220px, 280px) minmax(0, 1fr)`).
- `AppShell.tsx` chat dalında `runa-command-palette-trigger` doğrudan render edilmiyor (sidebar veya top bar içinde).

### 4.3 Görsel kanıt

`docs/design-audit/screenshots/2026-05-XX-ui-restructure-pr-2-layout-shell/`:

- [ ] `desktop-1440-chat-empty.png` — sol sidebar görünür, sağ rail yok, üst bar tek satır
- [ ] `desktop-1440-chat-active.png` — aktif sohbet, layout 2-kolon
- [ ] `desktop-1920-chat-active.png` — geniş ekran
- [ ] `mobile-390-chat-empty.png` — bottom tab bar yok, top bar'da `‹` ve `⋯`
- [ ] `mobile-390-composer-focus.png` — composer focus
- [ ] `mobile-320-chat-empty.png` — dar viewport

### 4.4 İnsan-review

- [ ] Sağ rail (İlerleme / Masaüstü / Bağlam kartları) **hiçbir** ekran görüntüsünde yok.
- [ ] Floating "Komut ara Ctrl K" pilli **hiçbir** ekran görüntüsünde yok.
- [ ] AppNav sol sidebar'da, mobilde tamamen gizli.
- [ ] Bottom tab bar (Sohbet/Geçmiş/Cihazlar/Hesap) mobilde **yok**.
- [ ] ChatHeader tek satır: başlık + sağ ikonlar.
- [ ] Composer context chip sadece `attachmentCount > 0` durumda görünür.

### 4.5 Performans

- [ ] Lighthouse Performance ≥85 (mobile)
- [ ] CLS ≤0.1 (layout shift)

---

## 5. Risk ve geri-alma

| Risk | Etki | Mitigation |
|---|---|---|
| WorkInsightPanel silinince ChatPage prop chain bozulur | Yüksek | TypeScript zorlar; typecheck PASS olmadan PR açılmaz. |
| `*-migration.css` cleanup yarım kalır → görsel regression | Orta | Bu PR'da yalnız `chat-migration.css` taşınır; diğerleri PR-7'ye ertelenir. |
| Sidebar 240px desktop için fazla → chat dar kalır | Düşük | Sidebar genişliği `--sidebar-width` token'ı ile dışa açılır; ayarlanabilir. |
| Mobil bottom nav kaldırılınca discovery zayıflar | Orta | PR-6'da menu sheet (`⋯`) tüm route'ları gösterir; geçiş süresinde sidebar'a swipe access. |
| ChatHeader'dan presence chip kaldırılınca offline durumu görünmez | Orta | PR-3 brief'inde sidebar'a küçük "bağlı/çevrimdışı" dot eklemesi planlandı. |

**Geri-alma:** PR-2 tek commit veya küçük commit serisi olarak revert edilebilir. WorkInsightPanel restorasyonu git'ten alınır.

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

# Doğrulama
pnpm --filter @runa/web lint
pnpm --filter @runa/web typecheck
pnpm --filter @runa/web test
pnpm --filter @runa/web build
```

---

> Brief v1.1 ile çakışma olursa brief kazanır. Belirsizlik çıkarsa Codex iş başlamadan kullanıcıya sorar; tahmin yapmaz.
