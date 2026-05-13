# PR-4 Codex Brief — Approval Calm

> **Tarih:** 2026-05-13
> **Branch:** `codex/ui-restructure-pr-4-approval-calm`
> **Worktree:** `.claude/worktrees/runa-ui-pr-4-approval-calm`
> **Authority:** `docs/frontend mimar/RUNA-DESIGN-BRIEF.md` v1.1 (Bölüm 9 Approval risk tablosu)
> **Bağımlılık:** PR-3 merge edilmiş olmalı. PR-5 ile paralel.
> **Hedef:** Approval kartını 5+ katmandan 3 elemana indir (başlık + hedef satırı + 2 buton), risk seviyesi yalnızca sol border + buton rengiyle ifade edilsin, resolved kartı shrink olsun.

---

## 1. Tek cümle hedef

Bu PR'dan sonra pending approval kartı **≤140px (desktop) / ≤180px (mobile)** yüksekliğinde, resolved approval kartı **≤36px** yüksekliğinde olur. Eyebrow, status chip, açıklama banner'ı görünmez.

## 2. Kapsam — Yapılacaklar

### 2.1 ApprovalBlock yeniden yazımı

**Dosya:** `apps/web/src/components/chat/blocks/ApprovalBlock.tsx:265-389`

Mevcut yapı tamamen yeniden yazılır. User-facing modda **kaldırılacak elemanlar**:

- `eyebrow` div — `:289-294` (Güven kararı)
- `approvalStatusChip` span — `:294`
- `approvalStateFeedback` `<output>` — `:307-309` ("İzin verildi. Akış devam ediyor." vb.)
- `createdAtLabel` paragrafı — `:333-336`
- `targetLabel` fallback metni (`'Bu onayda net hedef bilgisi gönderilmedi.'`) — `:241`
- `decisionCopy.risk` paragrafı — `:301, 304`
- `RunaDisclosure` Developer Mode kalır ama default kapalı.

**Yeni user-facing yapı:**

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
  // Server-tarafı risk_level alanı varsa öncelik onun.
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

Brief v1.1 Bölüm 9'daki tool listesi birebir uygulanır.

### 2.3 CSS — risk-bazlı görsel ayrım

**Dosya:** `apps/web/src/components/chat/blocks/BlockRenderer.module.css`

Yeni sınıflar:

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
  /* shrink — sadece title kalır, mark + ek metin gizli */
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
    status === 'approved' ? 'İzin verildi'
    : status === 'rejected' ? 'Reddedildi'
    : status === 'cancelled' ? 'Vazgeçildi'
    : 'Süresi doldu';

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

Geri al butonu yalnızca approved status'ünde ve son 5 saniye içinde tıklanabilir (server idempotency policy). PR-4 kapsamında **UI hazır, geri-al handler stub** (`console.warn`); gerçek "undo" PR-7'de eklenir.

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

Mevcut `<RunaDisclosure>` blok korunur, ama default `<details>` kapalı. Content içine ek olarak `risk_level` ham değeri ve `getApprovalRiskLevel` sonucu (transparency için) eklenir.

### 2.7 Copy hijyeni

`apps/web/src/localization/copy.ts` içinde:
- `uiCopy.approval.approved` → "İzin verildi"
- `uiCopy.approval.rejected` → "Reddedildi"
- `uiCopy.approval.cancelled` → "Vazgeçildi"
- `uiCopy.approval.expired` → "Süresi doldu"
- `uiCopy.approval.approve` → "Onayla"
- `uiCopy.approval.reject` → "Reddet"
- "Yine de devam et" yüksek-risk butonu için yeni key: `uiCopy.approval.proceedDanger` → "Yine de devam et"

---

## 3. Kapsam dışı

- ❌ Server tarafında `risk_level` alanını tool definition'a eklemek → PR-5'te (zaten bağımsız iş).
- ❌ ToolResult error refactoru → PR-5'te.
- ❌ Geri-al server endpoint'i → PR-7'de.
- ❌ Approval'ın command palette'te listelenmesi → PR-6'da.

---

## 4. Kabul Kriteri

### 4.1 Otomatik

- [ ] `lint + typecheck + test + build` PASS
- [ ] `apps/web/src/components/chat/blocks/ApprovalBlock.tsx` içinde `eyebrow`, `Güven kararı`, `approvalStatusChip`, `approvalStateFeedback` string'leri **yok** (user-facing kod yolunda).
- [ ] `approvalRisk.ts` exists ve `getApprovalRiskLevel` export ediyor.
- [ ] Yüksek-risk tool listesi brief v1.1 ile birebir aynı.

### 4.2 Lock test güncellemesi

- `ApprovalBlock.tsx` user-facing dalında `Güven kararı` string'i yok.
- `ApprovalBlock.tsx` user-facing dalında `İzin verildi. Akış devam ediyor.` string'i yok.
- `RunaButton.tsx` `'danger'` variant'ını destekler.

### 4.3 Görsel kanıt

`docs/design-audit/screenshots/2026-05-XX-ui-restructure-pr-4-approval-calm/`:

- [ ] `desktop-1440-approval-low-pending.png` — file.read approval, accent border, primary buton
- [ ] `desktop-1440-approval-medium-pending.png` — file.write approval, warn border, warn renkli başlık
- [ ] `desktop-1440-approval-high-pending.png` — shell.exec approval, error border, danger buton
- [ ] `desktop-1440-approval-resolved-approved.png` — onaylandı sonrası shrink (≤36px)
- [ ] `desktop-1440-approval-resolved-rejected.png` — reddedildi sonrası shrink
- [ ] `mobile-390-approval-medium-pending.png` — mobil
- [ ] `mobile-390-approval-high-pending.png` — mobil yüksek risk

### 4.4 İnsan-review

- [ ] Pending approval kartı yüksekliği ≤140px (desktop), ≤180px (mobile) — DevTools ile ölç.
- [ ] Resolved approval kartı yüksekliği ≤36px.
- [ ] "Güven kararı" eyebrow **hiçbir** ekran görüntüsünde yok.
- [ ] "İzin verildi. Akış devam ediyor." metni **hiçbir** ekran görüntüsünde yok.
- [ ] Yüksek-risk approval butonu kırmızı (`--error` rengi).
- [ ] Approve butonu `autoFocus` (Enter ile onaylanır).

---

## 5. Risk ve geri-alma

| Risk | Etki | Mitigation |
|---|---|---|
| Server `risk_level` alanı henüz yok → frontend fallback'e düşer | Düşük | `getApprovalRiskLevel` tool name listesinden çalışır; PR-5 ile uyumlu. |
| Resolved shrink CSS state'i aria-live ile çakışır | Orta | `aria-live` `polite` kalır; transition animasyonu reduce-motion respected. |
| Geri-al stub'ı kullanıcıyı yanıltır | Orta | "Geri al" şimdilik **gizli** kalır; yalnızca PR-7'de açılır. PR-4'te ResolvedSummary onUndo undefined döner. |
| approval-modes-capabilities-e2e.spec.ts e2e testi mevcut copy'lere bağlı | Yüksek | E2E selector'lar `data-testid` veya `data-status` kullanacak şekilde güncellenir. |

**Geri-alma:** Approval block tek dosya değişikliği; git revert temiz.

---

## 6. Komutlar

```bash
git worktree add .claude/worktrees/runa-ui-pr-4-approval-calm codex/ui-restructure-pr-4-approval-calm
cd .claude/worktrees/runa-ui-pr-4-approval-calm
pnpm install
pnpm --filter @runa/web dev

# Doğrulama
grep -n "Güven kararı" apps/web/src/components/chat/blocks/ApprovalBlock.tsx || echo "PASS"
grep -n "İzin verildi. Akış devam ediyor" apps/web/src/components/chat/blocks/ApprovalBlock.tsx || echo "PASS"

# E2E test güncellemesi
pnpm --filter @runa/web exec playwright test e2e/approval-modes-capabilities-e2e.spec.ts
```

---

> PR-5 ile aynı anda yürür; ortak dosya yok (PR-5 server + ToolResult, PR-4 sadece ApprovalBlock). Merge sırası serbest.
