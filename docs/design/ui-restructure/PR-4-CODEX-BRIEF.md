# PR-4 Codex Brief â€” Approval Calm

> **Tarih:** 2026-05-13
> **Branch:** `codex/ui-restructure-pr-4-approval-calm`
> **Worktree:** `.claude/worktrees/runa-ui-pr-4-approval-calm`
> **Authority:** `docs/design/RUNA-DESIGN-BRIEF.md` v1.1 (BÃ¶lÃ¼m 9 Approval risk tablosu)
> **BaÄŸÄ±mlÄ±lÄ±k:** PR-3 merge edilmiÅŸ olmalÄ±. PR-5 ile paralel.
> **Hedef:** Approval kartÄ±nÄ± 5+ katmandan 3 elemana indir (baÅŸlÄ±k + hedef satÄ±rÄ± + 2 buton), risk seviyesi yalnÄ±zca sol border + buton rengiyle ifade edilsin, resolved kartÄ± shrink olsun.

---

## 1. Tek cÃ¼mle hedef

Bu PR'dan sonra pending approval kartÄ± **â‰¤140px (desktop) / â‰¤180px (mobile)** yÃ¼ksekliÄŸinde, resolved approval kartÄ± **â‰¤36px** yÃ¼ksekliÄŸinde olur. Eyebrow, status chip, aÃ§Ä±klama banner'Ä± gÃ¶rÃ¼nmez.

## 2. Kapsam â€” YapÄ±lacaklar

### 2.1 ApprovalBlock yeniden yazÄ±mÄ±

**Dosya:** `apps/web/src/components/chat/blocks/ApprovalBlock.tsx:265-389`

Mevcut yapÄ± tamamen yeniden yazÄ±lÄ±r. User-facing modda **kaldÄ±rÄ±lacak elemanlar**:

- `eyebrow` div â€” `:289-294` (GÃ¼ven kararÄ±)
- `approvalStatusChip` span â€” `:294`
- `approvalStateFeedback` `<output>` â€” `:307-309` ("Ä°zin verildi. AkÄ±ÅŸ devam ediyor." vb.)
- `createdAtLabel` paragrafÄ± â€” `:333-336`
- `targetLabel` fallback metni (`'Bu onayda net hedef bilgisi gÃ¶nderilmedi.'`) â€” `:241`
- `decisionCopy.risk` paragrafÄ± â€” `:301, 304`
- `RunaDisclosure` Developer Mode kalÄ±r ama default kapalÄ±.

**Yeni user-facing yapÄ±:**

```tsx
return (
  <article
    className={cx(styles.approvalCard, styles[`approvalCard--${riskLevel}`])}
    aria-busy={canResolvePendingApproval}
    data-status={block.payload.status}
  >
    <header className={styles.approvalHeader}>
      <HafizaMark weight="regular" variant="brand" aria-hidden className={styles.approvalMark} />
      <h3 className={styles.approvalTitle}>{decisionCopy.action}</h3>
    </header>

    {targetLabel && (
      <div className={styles.approvalTarget}>
        <code className={styles.approvalTargetChip}>{targetLabel}</code>
      </div>
    )}

    {resolvePendingApproval ? (
      <div className={styles.approvalActions}>
        <RunaButton variant="secondary" onClick={() => resolvePendingApproval(approvalId, 'rejected')}>
          {uiCopy.approval.reject}
        </RunaButton>
        <RunaButton
          variant={riskLevel === 'high' ? 'danger' : 'primary'}
          onClick={() => resolvePendingApproval(approvalId, 'approved')}
          autoFocus
        >
          {riskLevel === 'high' ? 'Yine de devam et' : uiCopy.approval.approve}
        </RunaButton>
      </div>
    ) : (
      <ResolvedSummary status={block.payload.status} onUndo={...} />
    )}

    {isDeveloperMode && (
      <RunaDisclosure title={uiCopy.approval.details}>
        {/* Developer meta-grid: orijinal istek, ham hedef, tool name, call_id */}
      </RunaDisclosure>
    )}
  </article>
);
```

### 2.2 Risk seviyesi mapping

**Yeni dosya:** `apps/web/src/components/chat/blocks/approvalRisk.ts`

```typescript
import type { RenderBlock } from '../../../ws-types.js';

export type ApprovalRiskLevel = 'low' | 'medium' | 'high';

const HIGH_RISK_TOOLS = new Set([
  'file.delete',
  'memory.delete',
  'shell.exec',
  'shell.session.start',
  'desktop.launch',
  'desktop.keypress',
  'desktop.verify_state',
]);

const MEDIUM_RISK_TOOLS = new Set([
  'file.write',
  'desktop.click',
  'desktop.type',
  'desktop.scroll',
  'desktop.clipboard.write',
  'browser.click',
  'browser.fill',
  'browser.navigate',
  'browser.extract',
  'memory.save',
  'edit.patch',
]);

export function getApprovalRiskLevel(
  block: Extract<RenderBlock, { type: 'approval_block' }>,
): ApprovalRiskLevel {
  // Server-tarafÄ± risk_level alanÄ± varsa Ã¶ncelik onun.
  const serverLevel = block.payload.risk_level;
  if (serverLevel === 'high' || serverLevel === 'medium' || serverLevel === 'low') {
    return serverLevel;
  }
  const toolName = block.payload.tool_name;
  if (toolName && HIGH_RISK_TOOLS.has(toolName)) return 'high';
  if (toolName && MEDIUM_RISK_TOOLS.has(toolName)) return 'medium';
  return 'low';
}
```

Brief v1.1 BÃ¶lÃ¼m 9'daki tool listesi birebir uygulanÄ±r.

### 2.3 CSS â€” risk-bazlÄ± gÃ¶rsel ayrÄ±m

**Dosya:** `apps/web/src/components/chat/blocks/BlockRenderer.module.css`

Yeni sÄ±nÄ±flar:

```css
.approvalCard {
  --approval-border: var(--accent);
  --approval-title-color: var(--ink-1);
  padding: 14px 16px 14px 18px;
  background: var(--surface-2);
  border: 1px solid var(--hairline);
  border-left: 2px solid var(--approval-border);
  border-radius: var(--radius-panel);
  display: grid;
  gap: 10px;
}

.approvalCard--medium {
  --approval-border: var(--warn);
  --approval-title-color: var(--warn);
}

.approvalCard--high {
  --approval-border: var(--error);
  --approval-title-color: var(--error);
  background: var(--error-bg);
}

.approvalCard[data-status="approved"],
.approvalCard[data-status="rejected"],
.approvalCard[data-status="cancelled"],
.approvalCard[data-status="expired"] {
  /* resolved shrink */
  padding: 6px 12px;
  border-left-width: 2px;
  grid-template-columns: auto 1fr auto;
  align-items: center;
}

.approvalCard[data-status="approved"] .approvalHeader,
.approvalCard[data-status="rejected"] .approvalHeader {
  /* shrink â€” sadece title kalÄ±r, mark + ek metin gizli */
}

.approvalTitle {
  color: var(--approval-title-color);
  font-size: var(--text-md);
  font-weight: 600;
  margin: 0;
}

.approvalTarget {
  display: flex;
}

.approvalTargetChip {
  font-family: var(--font-mono);
  font-size: 13px;
  padding: 4px 8px;
  background: var(--surface-3);
  border-radius: var(--radius-input);
  color: var(--ink-2);
}

.approvalActions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
```

### 2.4 Resolved approval shrink

**Yeni komponent (inline):** `ResolvedSummary`

```tsx
function ResolvedSummary({ status, onUndo }: { status: ApprovalStatus; onUndo?: () => void }) {
  const label =
    status === 'approved' ? 'Ä°zin verildi'
    : status === 'rejected' ? 'Reddedildi'
    : status === 'cancelled' ? 'VazgeÃ§ildi'
    : 'SÃ¼resi doldu';

  return (
    <div className={styles.approvalResolved}>
      <span>{label}</span>
      {onUndo && status === 'approved' && (
        <button type="button" className={styles.approvalUndo} onClick={onUndo}>
          Geri al
        </button>
      )}
    </div>
  );
}
```

Geri al butonu yalnÄ±zca approved status'Ã¼nde ve son 5 saniye iÃ§inde tÄ±klanabilir (server idempotency policy). PR-4 kapsamÄ±nda **UI hazÄ±r, geri-al handler stub** (`console.warn`); gerÃ§ek "undo" PR-7'de eklenir.

### 2.5 RunaButton `danger` variant

**Dosya:** `apps/web/src/components/ui/RunaButton.tsx`

Mevcut variant set'i muhtemelen `primary | secondary | ghost`. `danger` eklenir:

```typescript
export type RunaButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
```

CSS (`RunaButton.module.css` veya inline):
```css
.danger {
  background: var(--error);
  color: var(--surface-1);
}
.danger:hover { background: color-mix(in srgb, var(--error) 88%, white); }
.danger:focus-visible { outline: 2px solid var(--error); outline-offset: 2px; }
```

### 2.6 Developer Mode disclosure korunur

Mevcut `<RunaDisclosure>` blok korunur, ama default `<details>` kapalÄ±. Content iÃ§ine ek olarak `risk_level` ham deÄŸeri ve `getApprovalRiskLevel` sonucu (transparency iÃ§in) eklenir.

### 2.7 Copy hijyeni

`apps/web/src/localization/copy.ts` iÃ§inde:
- `uiCopy.approval.approved` â†’ "Ä°zin verildi"
- `uiCopy.approval.rejected` â†’ "Reddedildi"
- `uiCopy.approval.cancelled` â†’ "VazgeÃ§ildi"
- `uiCopy.approval.expired` â†’ "SÃ¼resi doldu"
- `uiCopy.approval.approve` â†’ "Onayla"
- `uiCopy.approval.reject` â†’ "Reddet"
- "Yine de devam et" yÃ¼ksek-risk butonu iÃ§in yeni key: `uiCopy.approval.proceedDanger` â†’ "Yine de devam et"

---

## 3. Kapsam dÄ±ÅŸÄ±

- âŒ Server tarafÄ±nda `risk_level` alanÄ±nÄ± tool definition'a eklemek â†’ PR-5'te (zaten baÄŸÄ±msÄ±z iÅŸ).
- âŒ ToolResult error refactoru â†’ PR-5'te.
- âŒ Geri-al server endpoint'i â†’ PR-7'de.
- âŒ Approval'Ä±n command palette'te listelenmesi â†’ PR-6'da.

---

## 4. Kabul Kriteri

### 4.1 Otomatik

- [ ] `lint + typecheck + test + build` PASS
- [ ] `apps/web/src/components/chat/blocks/ApprovalBlock.tsx` iÃ§inde `eyebrow`, `GÃ¼ven kararÄ±`, `approvalStatusChip`, `approvalStateFeedback` string'leri **yok** (user-facing kod yolunda).
- [ ] `approvalRisk.ts` exists ve `getApprovalRiskLevel` export ediyor.
- [ ] YÃ¼ksek-risk tool listesi brief v1.1 ile birebir aynÄ±.

### 4.2 Lock test gÃ¼ncellemesi

- `ApprovalBlock.tsx` user-facing dalÄ±nda `GÃ¼ven kararÄ±` string'i yok.
- `ApprovalBlock.tsx` user-facing dalÄ±nda `Ä°zin verildi. AkÄ±ÅŸ devam ediyor.` string'i yok.
- `RunaButton.tsx` `'danger'` variant'Ä±nÄ± destekler.

### 4.3 GÃ¶rsel kanÄ±t

`docs/design-audit/screenshots/`:

- [ ] `desktop-1440-approval-low-pending.png` â€” file.read approval, accent border, primary buton
- [ ] `desktop-1440-approval-medium-pending.png` â€” file.write approval, warn border, warn renkli baÅŸlÄ±k
- [ ] `desktop-1440-approval-high-pending.png` â€” shell.exec approval, error border, danger buton
- [ ] `desktop-1440-approval-resolved-approved.png` â€” onaylandÄ± sonrasÄ± shrink (â‰¤36px)
- [ ] `desktop-1440-approval-resolved-rejected.png` â€” reddedildi sonrasÄ± shrink
- [ ] `mobile-390-approval-medium-pending.png` â€” mobil
- [ ] `mobile-390-approval-high-pending.png` â€” mobil yÃ¼ksek risk

### 4.4 Ä°nsan-review

- [ ] Pending approval kartÄ± yÃ¼ksekliÄŸi â‰¤140px (desktop), â‰¤180px (mobile) â€” DevTools ile Ã¶lÃ§.
- [ ] Resolved approval kartÄ± yÃ¼ksekliÄŸi â‰¤36px.
- [ ] "GÃ¼ven kararÄ±" eyebrow **hiÃ§bir** ekran gÃ¶rÃ¼ntÃ¼sÃ¼nde yok.
- [ ] "Ä°zin verildi. AkÄ±ÅŸ devam ediyor." metni **hiÃ§bir** ekran gÃ¶rÃ¼ntÃ¼sÃ¼nde yok.
- [ ] YÃ¼ksek-risk approval butonu kÄ±rmÄ±zÄ± (`--error` rengi).
- [ ] Approve butonu `autoFocus` (Enter ile onaylanÄ±r).

---

## 5. Risk ve geri-alma

| Risk | Etki | Mitigation |
|---|---|---|
| Server `risk_level` alanÄ± henÃ¼z yok â†’ frontend fallback'e dÃ¼ÅŸer | DÃ¼ÅŸÃ¼k | `getApprovalRiskLevel` tool name listesinden Ã§alÄ±ÅŸÄ±r; PR-5 ile uyumlu. |
| Resolved shrink CSS state'i aria-live ile Ã§akÄ±ÅŸÄ±r | Orta | `aria-live` `polite` kalÄ±r; transition animasyonu reduce-motion respected. |
| Geri-al stub'Ä± kullanÄ±cÄ±yÄ± yanÄ±ltÄ±r | Orta | "Geri al" ÅŸimdilik **gizli** kalÄ±r; yalnÄ±zca PR-7'de aÃ§Ä±lÄ±r. PR-4'te ResolvedSummary onUndo undefined dÃ¶ner. |
| approval-modes-capabilities-e2e.spec.ts e2e testi mevcut copy'lere baÄŸlÄ± | YÃ¼ksek | E2E selector'lar `data-testid` veya `data-status` kullanacak ÅŸekilde gÃ¼ncellenir. |

**Geri-alma:** Approval block tek dosya deÄŸiÅŸikliÄŸi; git revert temiz.

---

## 6. Komutlar

```bash
git worktree add .claude/worktrees/runa-ui-pr-4-approval-calm codex/ui-restructure-pr-4-approval-calm
cd .claude/worktrees/runa-ui-pr-4-approval-calm
pnpm install
pnpm --filter @runa/web dev

# DoÄŸrulama
grep -n "GÃ¼ven kararÄ±" apps/web/src/components/chat/blocks/ApprovalBlock.tsx || echo "PASS"
grep -n "Ä°zin verildi. AkÄ±ÅŸ devam ediyor" apps/web/src/components/chat/blocks/ApprovalBlock.tsx || echo "PASS"

# E2E test gÃ¼ncellemesi
pnpm --filter @runa/web exec playwright test e2e/approval-modes-capabilities-e2e.spec.ts
```

---

> PR-5 ile aynÄ± anda yÃ¼rÃ¼r; ortak dosya yok (PR-5 server + ToolResult, PR-4 sadece ApprovalBlock). Merge sÄ±rasÄ± serbest.


