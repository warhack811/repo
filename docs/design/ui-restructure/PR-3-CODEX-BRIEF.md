# PR-3 Codex Brief â€” Chat Surface

> **Tarih:** 2026-05-13
> **Branch:** `codex/ui-restructure-pr-3-chat-surface`
> **Worktree:** `.claude/worktrees/runa-ui-pr-3-chat-surface`
> **Authority:** `docs/design/RUNA-DESIGN-BRIEF.md` v1.1
> **BaÄŸÄ±mlÄ±lÄ±k:** PR-2 merge edilmiÅŸ olmalÄ±.
> **Hedef:** Sohbet sÃ¼tununun ritmini deÄŸiÅŸtir â€” agent run'Ä±nÄ±n tekrar gÃ¶rÃ¼nÃ¼mÃ¼nÃ¼ kes, mesaj metadata gÃ¼rÃ¼ltÃ¼sÃ¼nÃ¼ kaldÄ±r, tool aktivitesini tek satÄ±ra katla, asistan mesajÄ±nÄ± HafizaMark ile anchor'la.

---

## 1. Tek cÃ¼mle hedef

Bu PR'dan sonra aynÄ± agent run'Ä± sohbette **tek yerde** Ã¶zetlenir, mesajlarÄ±n altÄ±nda saniye-doÄŸruluk tarih damgasÄ± yoktur, tool Ã§aÄŸrÄ±larÄ± `[â€¢] N adÄ±m Ã§alÄ±ÅŸtÄ±rÄ±ldÄ± â€º` tek satÄ±rÄ± olarak gÃ¶rÃ¼nÃ¼r ve uzun konuÅŸma scan edilebilir hÃ¢le gelir.

## 2. Kapsam â€” YapÄ±lacaklar

### 2.1 RunProgressPanel sohbet iÃ§inden kaldÄ±r

**Dosya:** `apps/web/src/pages/ChatPage.tsx:197-204` (`currentRunProgressPanel` deklarasyonu ve `<CurrentRunSurface currentRunProgressPanel={...} />`)

`RunProgressPanel` artÄ±k sohbet akÄ±ÅŸÄ± iÃ§inde render edilmez. `CurrentRunSurface.tsx`'in `currentRunProgressPanel` prop'u tamamen kaldÄ±rÄ±lÄ±r.

**Dosya:** `apps/web/src/components/chat/CurrentRunSurface.tsx:13, 27, 65`

```tsx
// Prop kaldÄ±rÄ±lÄ±r:
// currentRunProgressPanel: ReactNode;

// Render iÃ§inden kaldÄ±rÄ±lÄ±r:
// {currentRunProgressPanel}
```

**Dosya:** `apps/web/src/components/chat/RunProgressPanel.tsx` ve `.module.css`

Komponent dosyasÄ± **silinmez** â€” saÄŸ rail yok ama PR-6'da command palette'in "current run" gÃ¶rÃ¼nÃ¼mÃ¼nde veya GeliÅŸmiÅŸ gÃ¶rÃ¼nÃ¼mde yeniden kullanÄ±labilir. Åimdilik **Ã¶lÃ¼ kod statÃ¼sÃ¼nde** kalÄ±r. Bir sonraki PR'da ya silinir ya da Developer Mode panelinde yeniden mount edilir.

### 2.2 PresentationRunSurfaceCard sadeleÅŸtir

**Dosya:** `apps/web/src/components/chat/PresentationRunSurfaceCard.tsx:113-145`

`isCurrent && !isDeveloperMode` dalÄ± zaten flat â€” deÄŸiÅŸmez.
`isCurrent && isDeveloperMode` dalÄ± (line 125-145):
- "mevcut Ã§alÄ±ÅŸma" eyebrow + "CanlÄ± Ã§alÄ±ÅŸma" baÅŸlÄ±k + "ana akÄ±ÅŸ" chip + statik aÃ§Ä±klama metni **kaldÄ±rÄ±lÄ±r**.
- YalnÄ±zca Developer Mode aktifken gÃ¶rÃ¼nÃ¼r hÃ¢le gelir, statik aÃ§Ä±klama satÄ±rÄ± silinir.

`isCurrent === false` (geÃ§miÅŸ) dalÄ± (line 148-174):
- "geÃ§miÅŸ Ã§alÄ±ÅŸma" eyebrow + "Ã–nceki Ã§alÄ±ÅŸma Ã¶zeti" baÅŸlÄ±k + "CanlÄ± akÄ±ÅŸ Ã¶nde kalÄ±r..." aÃ§Ä±klama metni **kaldÄ±rÄ±lÄ±r**.
- `<details>` collapsed default kalÄ±r; summary yalnÄ±zca tool/run Ã¶zetini tek satÄ±r gÃ¶sterir: `Ã–nceki tool sonuÃ§larÄ± â€º`.

### 2.3 Tool aktivitesi tek satÄ±r collapsed

**Dosya:** `apps/web/src/components/chat/blocks/ToolResultBlock.tsx:85-160`

User-facing mod (`!isDeveloperMode`) tamamen yeniden yazÄ±lÄ±r:

```tsx
if (!isDeveloperMode) {
  return (
    <details className={styles.toolLine}>
      <summary className={styles.toolLineSummary}>
        <span className={styles.toolLineIcon} aria-hidden>{isSuccess ? 'â€¢' : '!'}</span>
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

Yeni CSS class'larÄ± (`BlockRenderer.module.css`):
- `.toolLine` â€” `display: flex; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--hairline);`
- `.toolLineSummary` â€” kart yok, sadece satÄ±r.
- `.toolLineDetail` â€” aÃ§Ä±ldÄ±ÄŸÄ±nda `padding-left: 22px; color: var(--ink-2);`

**Ã–nemli:** Mevcut `eyebrow` ("Ä°ÅŸlem sonucu"), `title`, `summary`, `chipRow`, `errorCode` block render'Ä± user-facing modda **kaldÄ±rÄ±lÄ±r**. Developer Mode aynÄ± kalÄ±r.

### 2.4 ToolActivityIndicator inline component

**Dosya:** `apps/web/src/components/chat/ToolActivityIndicator.tsx:57-75`

AynÄ± turda birden fazla tool Ã§aÄŸrÄ±sÄ± varsa **gruplandÄ±rma satÄ±rÄ±** ekle:

```tsx
// Yeni: birden fazla item varsa tek satÄ±rlÄ± gruplandÄ±rma
if (items.length > 1) {
  return (
    <details className={styles.toolGroup}>
      <summary className={styles.toolGroupSummary}>
        <span>{items.length} adÄ±m Ã§alÄ±ÅŸtÄ±rÄ±ldÄ±</span>
        <ChevronRight size={14} aria-hidden />
      </summary>
      <ul className={styles.toolGroupList}>
        {items.map((item) => <li key={item.id}>...</li>)}
      </ul>
    </details>
  );
}
```

ChatPage veya StreamingMessageSurface bu komponenti tool result block'larÄ±ndan **Ã¶nce** render etmemeli â€” block'lar zaten kendi baÅŸÄ±na satÄ±rdÄ±r. Bu gruplandÄ±rma yalnÄ±z streaming sÄ±rasÄ±nda (henÃ¼z block oluÅŸmamÄ±ÅŸ run state) kullanÄ±lÄ±r.

### 2.5 PersistedTranscript rol etiketi ve tarih damgasÄ± temizliÄŸi

**Dosya:** `apps/web/src/components/chat/PersistedTranscript.tsx:11-22, 36-57`

`getRoleLabel` fonksiyonu **silinir**.
`metaRow` div + `roleLabel` span + `time` span **silinir**.

Yeni render yapÄ±sÄ±:

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

### 2.6 GÃ¼n ayÄ±rÄ±cÄ± (`groupedMessages` helper)

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
      if (msgDay === today.getTime()) currentDivider = 'BugÃ¼n';
      else if (msgDay === yesterday.getTime()) currentDivider = 'DÃ¼n';
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

`PersistedTranscript.tsx` bu helper'Ä± kullanÄ±r; ilk grupta dayDivider null gÃ¶sterilmez (eski tasarÄ±mdaki "BugÃ¼n" Ã¼st banner kaybolmasÄ±n diye), sonraki gruplarda divider Ã§izilir.

### 2.7 EmptyState â€” PR-1 sonrasÄ± kalan minik ayar

**Dosya:** `apps/web/src/components/chat/EmptyState.tsx`

PR-1'de hero baÅŸlÄ±k + 4 Ã¶neri eklendi. Bu PR'da:
- `runa-chat-suggestion-grid` Ã¶neri sayÄ±sÄ± 4 â†’ 3 (en yaygÄ±n 3 Ã¶neri).
- Composer'a `BaÄŸlam` butonunun discoverable olmasÄ± iÃ§in empty state altÄ±na kÃ¼Ã§Ã¼k "Ä°pucu: `Ctrl+K` ile komut paleti aÃ§Ä±lÄ±r" satÄ±rÄ± eklenir (`var(--ink-3)` â‰¥14px+600).

### 2.8 ChatPage prop chain sadeleÅŸtirme

**Dosya:** `apps/web/src/pages/ChatPage.tsx`

- `currentRunProgressPanel` kaldÄ±rÄ±lÄ±r
- `currentRunProgress` artÄ±k sadece Developer Mode yÃ¼zeylerinde kullanÄ±lÄ±r
- `shouldShowRunFeedbackBanner` mantÄ±ÄŸÄ± korunur ama banner'Ä±n kendisi sohbet Ã¼stÃ¼ne Ã§Ä±kmaz; PR-5'te toast'a taÅŸÄ±nÄ±r

---

## 3. Kapsam dÄ±ÅŸÄ±

- âŒ ApprovalBlock yeniden yazÄ±mÄ± â†’ PR-4'te.
- âŒ Error message TR'leÅŸtirme â†’ PR-5'te.
- âŒ Sheet sistemi â†’ PR-6'da.
- âŒ Stop button + abort â†’ PR-7'de.
- âŒ Composer focus animasyonlarÄ± â†’ PR-8'de.

---

## 4. Kabul Kriteri

### 4.1 Otomatik

- [ ] `lint + typecheck + test + build` PASS
- [ ] `apps/web/src/components/chat/CurrentRunSurface.tsx` iÃ§inde `currentRunProgressPanel` prop yok
- [ ] `apps/web/src/components/chat/PersistedTranscript.tsx` iÃ§inde `getRoleLabel`, `roleLabel`, `metaRow`, `time` referansÄ± yok
- [ ] `apps/web/src/components/chat/transcriptGroup.ts` dosyasÄ± var ve `groupMessagesByDay` export ediyor
- [ ] Bir tool turunda render edilen DOM iÃ§inde `Ä°ÅLEM SONUCU` eyebrow metni **0 instance** (user-facing modda)

### 4.2 Lock test gÃ¼ncellemesi

- `PersistedTranscript.tsx` iÃ§inde "Sen" veya "Runa" string'i **yok**.
- `ToolResultBlock.tsx` user-facing dalÄ±nda `Hata kodu:` chip render'Ä± **yok**.
- `PersistedTranscript.tsx` `toLocaleString` Ã§aÄŸrÄ±sÄ± **yok** (saniye-doÄŸruluk timestamp).

### 4.3 GÃ¶rsel kanÄ±t

`docs/design-audit/screenshots/`:

- [ ] `desktop-1440-chat-active-long-transcript.png` â€” 10+ mesajlÄ± uzun konuÅŸma, gÃ¼n ayÄ±rÄ±cÄ± gÃ¶rÃ¼nÃ¼r
- [ ] `desktop-1440-chat-tool-run.png` â€” tek tool turu, tek satÄ±r `[â€¢] Dosya okundu â€º`
- [ ] `desktop-1440-chat-tool-run-expanded.png` â€” aynÄ± satÄ±r aÃ§Ä±k hÃ¢lde
- [ ] `desktop-1440-chat-multi-tool-run.png` â€” 3 tool turu, gruplandÄ±rma satÄ±rÄ± `3 adÄ±m Ã§alÄ±ÅŸtÄ±rÄ±ldÄ± â€º`
- [ ] `mobile-390-chat-active-long.png` â€” mobil scan
- [ ] `mobile-390-chat-tool-run.png` â€” mobil tool turu

### 4.4 Ä°nsan-review

- [ ] AynÄ± tool Ã§aÄŸrÄ±sÄ± sohbette **tek satÄ±r** gÃ¶rÃ¼nÃ¼r.
- [ ] Mesaj altÄ±nda saat damgasÄ± **yok**; gÃ¼n geÃ§iÅŸinde `BugÃ¼n` / `DÃ¼n` / `12 MayÄ±s` divider gÃ¶rÃ¼nÃ¼r.
- [ ] Asistan mesajÄ±nÄ±n solunda HafÄ±za mark (regular weight) gÃ¶rÃ¼nÃ¼r; aynÄ± asistan mesaj zincirinde yalnÄ±z ilk mesajda.
- [ ] "Ä°ÅLEM SONUCU / CANLI Ã‡ALIÅMA NOTLARI / GÃœVEN KARARI" eyebrow'larÄ± **hiÃ§bir** user-facing ekran gÃ¶rÃ¼ntÃ¼sÃ¼nde yok.

### 4.5 Performans

- [ ] Uzun konuÅŸma (50+ mesaj) render sÃ¼resi <100ms (DevTools profile).
- [ ] Lighthouse Performance â‰¥85.

---

## 5. Risk ve geri-alma

| Risk | Etki | Mitigation |
|---|---|---|
| GÃ¼n ayÄ±rÄ±cÄ± locale parse hatasÄ± â†’ mesaj sÄ±ralamasÄ± bozulur | YÃ¼ksek | Birim test: `groupMessagesByDay` iÃ§in 6+ vaka. |
| HafÄ±za mark her mesajda render edilince DOM ÅŸiÅŸer | Orta | Asistan mesaj zincirinde tek seferlik mark; helper test'i. |
| `RunProgressPanel` Ã¶lÃ¼ kod ileride dead-code lint hatasÄ± verir | DÃ¼ÅŸÃ¼k | Comment ile `// Used by Developer Mode panel (PR-7)` notu dÃ¼ÅŸÃ¼lÃ¼r. |
| ToolResultBlock `<details>` open-state senkronizasyonu sorun Ã§Ä±karÄ±r | Orta | Local state default closed; e2e test ile aÃ§ma/kapama. |

**Geri-alma:** PR-3 tek commit serisi olarak revert edilebilir. PersistedTranscript eski hÃ¢line `git revert` ile dÃ¶ner.

---

## 6. Komutlar

```bash
git worktree add .claude/worktrees/runa-ui-pr-3-chat-surface codex/ui-restructure-pr-3-chat-surface
cd .claude/worktrees/runa-ui-pr-3-chat-surface
pnpm install
pnpm --filter @runa/web dev

# DoÄŸrulama
grep -n "currentRunProgressPanel" apps/web/src/components/chat/CurrentRunSurface.tsx || echo "PASS"
grep -n "getRoleLabel\|metaRow" apps/web/src/components/chat/PersistedTranscript.tsx || echo "PASS"
grep -rn "toLocaleString" apps/web/src/components/chat/PersistedTranscript.tsx || echo "PASS"

pnpm --filter @runa/web lint
pnpm --filter @runa/web typecheck
pnpm --filter @runa/web test
pnpm --filter @runa/web build
```

---

> BaÄŸÄ±mlÄ±lÄ±k: PR-2'nin saÄŸ rail kaldÄ±rma ve sidebar shift'i bu PR'a girer girmez bu brief uygulanÄ±r.


