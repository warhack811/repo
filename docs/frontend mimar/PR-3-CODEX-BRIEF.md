# PR-3 Codex Brief — Chat Surface

> **Tarih:** 2026-05-13
> **Branch:** `codex/ui-restructure-pr-3-chat-surface`
> **Worktree:** `.claude/worktrees/runa-ui-pr-3-chat-surface`
> **Authority:** `docs/frontend mimar/RUNA-DESIGN-BRIEF.md` v1.1
> **Bağımlılık:** PR-2 merge edilmiş olmalı.
> **Hedef:** Sohbet sütununun ritmini değiştir — agent run'ının tekrar görünümünü kes, mesaj metadata gürültüsünü kaldır, tool aktivitesini tek satıra katla, asistan mesajını HafizaMark ile anchor'la.

---

## 1. Tek cümle hedef

Bu PR'dan sonra aynı agent run'ı sohbette **tek yerde** özetlenir, mesajların altında saniye-doğruluk tarih damgası yoktur, tool çağrıları `[•] N adım çalıştırıldı ›` tek satırı olarak görünür ve uzun konuşma scan edilebilir hâle gelir.

## 2. Kapsam — Yapılacaklar

### 2.1 RunProgressPanel sohbet içinden kaldır

**Dosya:** `apps/web/src/pages/ChatPage.tsx:197-204` (`currentRunProgressPanel` deklarasyonu ve `<CurrentRunSurface currentRunProgressPanel={...} />`)

`RunProgressPanel` artık sohbet akışı içinde render edilmez. `CurrentRunSurface.tsx`'in `currentRunProgressPanel` prop'u tamamen kaldırılır.

**Dosya:** `apps/web/src/components/chat/CurrentRunSurface.tsx:13, 27, 65`

```tsx
// Prop kaldırılır:
// currentRunProgressPanel: ReactNode;

// Render içinden kaldırılır:
// {currentRunProgressPanel}
```

**Dosya:** `apps/web/src/components/chat/RunProgressPanel.tsx` ve `.module.css`

Komponent dosyası **silinmez** — sağ rail yok ama PR-6'da command palette'in "current run" görünümünde veya Gelişmiş görünümde yeniden kullanılabilir. Şimdilik **ölü kod statüsünde** kalır. Bir sonraki PR'da ya silinir ya da Developer Mode panelinde yeniden mount edilir.

### 2.2 PresentationRunSurfaceCard sadeleştir

**Dosya:** `apps/web/src/components/chat/PresentationRunSurfaceCard.tsx:113-145`

`isCurrent && !isDeveloperMode` dalı zaten flat — değişmez.
`isCurrent && isDeveloperMode` dalı (line 125-145):
- "mevcut çalışma" eyebrow + "Canlı çalışma" başlık + "ana akış" chip + statik açıklama metni **kaldırılır**.
- Yalnızca Developer Mode aktifken görünür hâle gelir, statik açıklama satırı silinir.

`isCurrent === false` (geçmiş) dalı (line 148-174):
- "geçmiş çalışma" eyebrow + "Önceki çalışma özeti" başlık + "Canlı akış önde kalır..." açıklama metni **kaldırılır**.
- `<details>` collapsed default kalır; summary yalnızca tool/run özetini tek satır gösterir: `Önceki tool sonuçları ›`.

### 2.3 Tool aktivitesi tek satır collapsed

**Dosya:** `apps/web/src/components/chat/blocks/ToolResultBlock.tsx:85-160`

User-facing mod (`!isDeveloperMode`) tamamen yeniden yazılır:

```tsx
if (!isDeveloperMode) {
  return (
    <details className={styles.toolLine}>
      <summary className={styles.toolLineSummary}>
        <span className={styles.toolLineIcon} aria-hidden>{isSuccess ? '•' : '!'}</span>
        <span className={styles.toolLineLabel}>{friendlyToolLabel}</span>
        <ChevronRight size={14} aria-hidden className={styles.toolLineChevron} />
      </summary>
      <div className={styles.toolLineDetail}>
        <p>{friendlySummary}</p>
      </div>
    </details>
  );
}
```

Yeni CSS class'ları (`BlockRenderer.module.css`):
- `.toolLine` — `display: flex; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--hairline);`
- `.toolLineSummary` — kart yok, sadece satır.
- `.toolLineDetail` — açıldığında `padding-left: 22px; color: var(--ink-2);`

**Önemli:** Mevcut `eyebrow` ("İşlem sonucu"), `title`, `summary`, `chipRow`, `errorCode` block render'ı user-facing modda **kaldırılır**. Developer Mode aynı kalır.

### 2.4 ToolActivityIndicator inline component

**Dosya:** `apps/web/src/components/chat/ToolActivityIndicator.tsx:57-75`

Aynı turda birden fazla tool çağrısı varsa **gruplandırma satırı** ekle:

```tsx
// Yeni: birden fazla item varsa tek satırlı gruplandırma
if (items.length > 1) {
  return (
    <details className={styles.toolGroup}>
      <summary className={styles.toolGroupSummary}>
        <span>{items.length} adım çalıştırıldı</span>
        <ChevronRight size={14} aria-hidden />
      </summary>
      <ul className={styles.toolGroupList}>
        {items.map((item) => <li key={item.id}>...</li>)}
      </ul>
    </details>
  );
}
```

ChatPage veya StreamingMessageSurface bu komponenti tool result block'larından **önce** render etmemeli — block'lar zaten kendi başına satırdır. Bu gruplandırma yalnız streaming sırasında (henüz block oluşmamış run state) kullanılır.

### 2.5 PersistedTranscript rol etiketi ve tarih damgası temizliği

**Dosya:** `apps/web/src/components/chat/PersistedTranscript.tsx:11-22, 36-57`

`getRoleLabel` fonksiyonu **silinir**.
`metaRow` div + `roleLabel` span + `time` span **silinir**.

Yeni render yapısı:

```tsx
return (
  <div className={styles.root} aria-live="polite">
    {groupedMessages.map((group, idx) => (
      <Fragment key={group.key}>
        {group.dayDivider && (
          <div className={styles.dayDivider} role="presentation">
            {group.dayDivider}
          </div>
        )}
        {group.messages.map((message, mIdx) => (
          <div
            key={message.message_id}
            className={`${styles.message} runa-transcript-message--${message.role}`}
            data-role={message.role}
          >
            {message.role === 'assistant' && mIdx === 0 && (
              <HafizaMark
                weight="regular"
                variant="brand"
                aria-hidden
                className={styles.assistantMark}
              />
            )}
            <div className={styles.bubble}>
              <StreamdownMessage>{message.content}</StreamdownMessage>
            </div>
          </div>
        ))}
      </Fragment>
    ))}
  </div>
);
```

### 2.6 Gün ayırıcı (`groupedMessages` helper)

**Yeni dosya:** `apps/web/src/components/chat/transcriptGroup.ts`

```typescript
import type { ConversationMessage } from '../../hooks/useConversations.js';

type MessageGroup = Readonly<{
  key: string;
  dayDivider: string | null;
  messages: readonly ConversationMessage[];
}>;

export function groupMessagesByDay(
  messages: readonly ConversationMessage[],
  now: Date = new Date(),
): readonly MessageGroup[] {
  const groups: MessageGroup[] = [];
  const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(now);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  let currentDay: number | null = null;
  let currentBucket: ConversationMessage[] = [];
  let currentDivider: string | null = null;

  for (const msg of messages) {
    const msgDay = startOfDay(new Date(msg.created_at)).getTime();
    if (msgDay !== currentDay) {
      if (currentBucket.length > 0) {
        groups.push({ key: String(currentDay), dayDivider: currentDivider, messages: currentBucket });
      }
      currentDay = msgDay;
      const msgDate = new Date(msg.created_at);
      if (msgDay === today.getTime()) currentDivider = 'Bugün';
      else if (msgDay === yesterday.getTime()) currentDivider = 'Dün';
      else {
        currentDivider = msgDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
      }
      currentBucket = [];
    }
    currentBucket.push(msg);
  }
  if (currentBucket.length > 0) {
    groups.push({ key: String(currentDay), dayDivider: currentDivider, messages: currentBucket });
  }
  return groups;
}
```

`PersistedTranscript.tsx` bu helper'ı kullanır; ilk grupta dayDivider null gösterilmez (eski tasarımdaki "Bugün" üst banner kaybolmasın diye), sonraki gruplarda divider çizilir.

### 2.7 EmptyState — PR-1 sonrası kalan minik ayar

**Dosya:** `apps/web/src/components/chat/EmptyState.tsx`

PR-1'de hero başlık + 4 öneri eklendi. Bu PR'da:
- `runa-chat-suggestion-grid` öneri sayısı 4 → 3 (en yaygın 3 öneri).
- Composer'a `Bağlam` butonunun discoverable olması için empty state altına küçük "İpucu: `Ctrl+K` ile komut paleti açılır" satırı eklenir (`var(--ink-3)` ≥14px+600).

### 2.8 ChatPage prop chain sadeleştirme

**Dosya:** `apps/web/src/pages/ChatPage.tsx`

- `currentRunProgressPanel` kaldırılır
- `currentRunProgress` artık sadece Developer Mode yüzeylerinde kullanılır
- `shouldShowRunFeedbackBanner` mantığı korunur ama banner'ın kendisi sohbet üstüne çıkmaz; PR-5'te toast'a taşınır

---

## 3. Kapsam dışı

- ❌ ApprovalBlock yeniden yazımı → PR-4'te.
- ❌ Error message TR'leştirme → PR-5'te.
- ❌ Sheet sistemi → PR-6'da.
- ❌ Stop button + abort → PR-7'de.
- ❌ Composer focus animasyonları → PR-8'de.

---

## 4. Kabul Kriteri

### 4.1 Otomatik

- [ ] `lint + typecheck + test + build` PASS
- [ ] `apps/web/src/components/chat/CurrentRunSurface.tsx` içinde `currentRunProgressPanel` prop yok
- [ ] `apps/web/src/components/chat/PersistedTranscript.tsx` içinde `getRoleLabel`, `roleLabel`, `metaRow`, `time` referansı yok
- [ ] `apps/web/src/components/chat/transcriptGroup.ts` dosyası var ve `groupMessagesByDay` export ediyor
- [ ] Bir tool turunda render edilen DOM içinde `İŞLEM SONUCU` eyebrow metni **0 instance** (user-facing modda)

### 4.2 Lock test güncellemesi

- `PersistedTranscript.tsx` içinde "Sen" veya "Runa" string'i **yok**.
- `ToolResultBlock.tsx` user-facing dalında `Hata kodu:` chip render'ı **yok**.
- `PersistedTranscript.tsx` `toLocaleString` çağrısı **yok** (saniye-doğruluk timestamp).

### 4.3 Görsel kanıt

`docs/design-audit/screenshots/2026-05-XX-ui-restructure-pr-3-chat-surface/`:

- [ ] `desktop-1440-chat-active-long-transcript.png` — 10+ mesajlı uzun konuşma, gün ayırıcı görünür
- [ ] `desktop-1440-chat-tool-run.png` — tek tool turu, tek satır `[•] Dosya okundu ›`
- [ ] `desktop-1440-chat-tool-run-expanded.png` — aynı satır açık hâlde
- [ ] `desktop-1440-chat-multi-tool-run.png` — 3 tool turu, gruplandırma satırı `3 adım çalıştırıldı ›`
- [ ] `mobile-390-chat-active-long.png` — mobil scan
- [ ] `mobile-390-chat-tool-run.png` — mobil tool turu

### 4.4 İnsan-review

- [ ] Aynı tool çağrısı sohbette **tek satır** görünür.
- [ ] Mesaj altında saat damgası **yok**; gün geçişinde `Bugün` / `Dün` / `12 Mayıs` divider görünür.
- [ ] Asistan mesajının solunda Hafıza mark (regular weight) görünür; aynı asistan mesaj zincirinde yalnız ilk mesajda.
- [ ] "İŞLEM SONUCU / CANLI ÇALIŞMA NOTLARI / GÜVEN KARARI" eyebrow'ları **hiçbir** user-facing ekran görüntüsünde yok.

### 4.5 Performans

- [ ] Uzun konuşma (50+ mesaj) render süresi <100ms (DevTools profile).
- [ ] Lighthouse Performance ≥85.

---

## 5. Risk ve geri-alma

| Risk | Etki | Mitigation |
|---|---|---|
| Gün ayırıcı locale parse hatası → mesaj sıralaması bozulur | Yüksek | Birim test: `groupMessagesByDay` için 6+ vaka. |
| Hafıza mark her mesajda render edilince DOM şişer | Orta | Asistan mesaj zincirinde tek seferlik mark; helper test'i. |
| `RunProgressPanel` ölü kod ileride dead-code lint hatası verir | Düşük | Comment ile `// Used by Developer Mode panel (PR-7)` notu düşülür. |
| ToolResultBlock `<details>` open-state senkronizasyonu sorun çıkarır | Orta | Local state default closed; e2e test ile açma/kapama. |

**Geri-alma:** PR-3 tek commit serisi olarak revert edilebilir. PersistedTranscript eski hâline `git revert` ile döner.

---

## 6. Komutlar

```bash
git worktree add .claude/worktrees/runa-ui-pr-3-chat-surface codex/ui-restructure-pr-3-chat-surface
cd .claude/worktrees/runa-ui-pr-3-chat-surface
pnpm install
pnpm --filter @runa/web dev

# Doğrulama
grep -n "currentRunProgressPanel" apps/web/src/components/chat/CurrentRunSurface.tsx || echo "PASS"
grep -n "getRoleLabel\|metaRow" apps/web/src/components/chat/PersistedTranscript.tsx || echo "PASS"
grep -rn "toLocaleString" apps/web/src/components/chat/PersistedTranscript.tsx || echo "PASS"

pnpm --filter @runa/web lint
pnpm --filter @runa/web typecheck
pnpm --filter @runa/web test
pnpm --filter @runa/web build
```

---

> Bağımlılık: PR-2'nin sağ rail kaldırma ve sidebar shift'i bu PR'a girer girmez bu brief uygulanır.
