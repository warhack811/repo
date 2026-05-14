# PR-5 Codex Brief â€” User-Safe Errors + Server `user_label_tr` KontratÄ±

> **Tarih:** 2026-05-13
> **Branch:** `codex/ui-restructure-pr-5-errors-user-label`
> **Worktree:** `.claude/worktrees/runa-ui-pr-5-errors`
> **Authority:** `docs/design/RUNA-DESIGN-BRIEF.md` v1.1 (BÃ¶lÃ¼m 12.5 Server KontratÄ±)
> **BaÄŸÄ±mlÄ±lÄ±k:** PR-3 merge edilmiÅŸ olmalÄ±. PR-4 ile paralel.
> **Hedef:** Server tool definition'a opsiyonel `user_label_tr` + `user_summary_tr` alanlarÄ± eklenir; frontend bu alanlarÄ± kullanarak Ä°ngilizce tool description sÄ±zÄ±ntÄ±sÄ±nÄ± sÄ±fÄ±rlar; error mesajlarÄ± kullanÄ±cÄ± dilinde TR'ye geÃ§er.

---

## 1. Tek cÃ¼mle hedef

Bu PR'dan sonra Developer Mode kapalÄ±yken sohbette **hiÃ§bir Ä°ngilizce tool description metni** gÃ¶rÃ¼nmez; `Hata kodu: NOT_FOUND` gibi raw error chip'leri yalnÄ±z Developer Mode'da; sÃ¶zlÃ¼k dÄ±ÅŸÄ± kalan tool aktivitesi detayÄ± boÅŸ kalÄ±r (false-positive sÄ±zÄ±ntÄ± sÄ±fÄ±r).

---

## 2. Kapsam â€” YapÄ±lacaklar

### 2.1 Server: `ToolDefinition` interface'ine opsiyonel alanlar

**Dosya:** `packages/types/src/tools.ts`

```typescript
export interface ToolDefinition<TName extends string = string, TArgs extends ToolArguments = ToolArguments, TData = unknown> {
  readonly name: TName;
  readonly description: string;          // mevcut â€” model-facing, EN
  readonly user_label_tr?: string;       // yeni â€” user-facing kÄ±sa etiket, â‰¤80 karakter, TR
  readonly user_summary_tr?: string;     // yeni â€” bir cÃ¼mlelik TR Ã¶zet, â‰¤140 karakter
  // ... mevcut alanlar (parameters, requires_approval, risk_level, vs.)
}
```

### 2.2 Built-in tool registry â€” TR etiket ekle

AÅŸaÄŸÄ±daki dosyalarÄ±n her birinde `user_label_tr` ve `user_summary_tr` alanlarÄ± eklenir:

| Dosya | `user_label_tr` | `user_summary_tr` |
|---|---|---|
| `apps/server/src/tools/shell-exec.ts` | "Terminal komutu" | "BaÄŸlÄ± oturumda komut Ã§alÄ±ÅŸtÄ±rÄ±lÄ±r, Ã§Ä±ktÄ±sÄ± sohbete eklenir." |
| `apps/server/src/tools/shell-session.ts` (start/read/stop) | "Terminal oturumu" | "EtkileÅŸimli komut oturumu aÃ§Ä±lÄ±r, Ã§Ä±ktÄ±lar parÃ§a parÃ§a sohbete akar." |
| `apps/server/src/tools/file-read.ts` | "Dosya okuma" | "Belirtilen dosyanÄ±n iÃ§eriÄŸi gÃ¼venli sÄ±nÄ±rlar iÃ§inde okunur." |
| `apps/server/src/tools/file-write.ts` | "Dosya yazma" | "Belirtilen dosyaya deÄŸiÅŸiklik yazÄ±lÄ±r." |
| `apps/server/src/tools/file-list.ts` | "Dizin listeleme" | "Bir klasÃ¶rdeki dosyalar listelenir." |
| `apps/server/src/tools/file-share.ts` | "Dosya paylaÅŸÄ±mÄ±" | "Ãœretilen dosya iÃ§in kÄ±sa sÃ¼reli indirme linki oluÅŸturulur." |
| `apps/server/src/tools/file-watch.ts` | "Dosya takibi" | "Bir dosyanÄ±n deÄŸiÅŸimi izlenir." |
| `apps/server/src/tools/desktop-screenshot.ts` | "Ekran gÃ¶rÃ¼ntÃ¼sÃ¼" | "BaÄŸlÄ± masaÃ¼stÃ¼nden ekran gÃ¶rÃ¼ntÃ¼sÃ¼ alÄ±nÄ±r." |
| `apps/server/src/tools/desktop-click.ts` | "MasaÃ¼stÃ¼ tÄ±klamasÄ±" | "BaÄŸlÄ± masaÃ¼stÃ¼nde belirtilen konuma tÄ±klanÄ±r." |
| `apps/server/src/tools/desktop-type.ts` | "MasaÃ¼stÃ¼ne yazma" | "BaÄŸlÄ± masaÃ¼stÃ¼ndeki aktif alana metin yazÄ±lÄ±r." |
| `apps/server/src/tools/desktop-keypress.ts` | "Klavye kÄ±sayolu" | "BaÄŸlÄ± masaÃ¼stÃ¼nde klavye kÄ±sayolu Ã§alÄ±ÅŸtÄ±rÄ±lÄ±r." |
| `apps/server/src/tools/desktop-launch.ts` | "Uygulama baÅŸlatma" | "BaÄŸlÄ± masaÃ¼stÃ¼nde belirtilen uygulama baÅŸlatÄ±lÄ±r." |
| `apps/server/src/tools/desktop-scroll.ts` | "MasaÃ¼stÃ¼ kaydÄ±rma" | "BaÄŸlÄ± masaÃ¼stÃ¼ ekranÄ± belirtilen yÃ¶nde kaydÄ±rÄ±lÄ±r." |
| `apps/server/src/tools/desktop-clipboard.ts` (read/write) | "Pano iÅŸlemi" | "BaÄŸlÄ± masaÃ¼stÃ¼nÃ¼n pano iÃ§eriÄŸi okunur veya yazÄ±lÄ±r." |
| `apps/server/src/tools/desktop-vision-analyze.ts` | "Ekran analizi" | "Ekrandaki gÃ¶rsel iÃ§erik analiz edilir." |
| `apps/server/src/tools/desktop-verify-state.ts` | "MasaÃ¼stÃ¼ doÄŸrulama" | "Beklenen ekran durumu doÄŸrulanÄ±r." |
| `apps/server/src/tools/browser-navigate.ts` | "TarayÄ±cÄ± gezintisi" | "TarayÄ±cÄ±da bir adrese gidilir." |
| `apps/server/src/tools/browser-click.ts` | "TarayÄ±cÄ± tÄ±klamasÄ±" | "Sayfada bir Ã¶ÄŸeye tÄ±klanÄ±r." |
| `apps/server/src/tools/browser-fill.ts` | "Form doldurma" | "Sayfa formuna metin doldurulur." |
| `apps/server/src/tools/browser-extract.ts` | "Sayfa okuma" | "Sayfadan istenen iÃ§erik Ã§Ä±karÄ±lÄ±r." |
| `apps/server/src/tools/memory-save.ts` | "BelleÄŸe kaydetme" | "Ã–nemli bir bilgi proje belleÄŸine kaydedilir." |
| `apps/server/src/tools/memory-search.ts` | "Bellek aramasÄ±" | "KaydedilmiÅŸ bilgiler arasÄ±nda arama yapÄ±lÄ±r." |
| `apps/server/src/tools/memory-list.ts` | "Bellek listeleme" | "KaydedilmiÅŸ bilgiler listelenir." |
| `apps/server/src/tools/memory-delete.ts` | "Bellek silme" | "Bir bellek kaydÄ± kalÄ±cÄ± olarak silinir." |
| `apps/server/src/tools/web-search.ts` | "Web arama" | "Web'de bir konu araÅŸtÄ±rÄ±lÄ±r." |
| `apps/server/src/tools/search-codebase.ts` | "Kod arama" | "Proje kodunda anahtar kelime aranÄ±r." |
| `apps/server/src/tools/search-grep.ts` | "Dosya arama" | "Proje dosyalarÄ±nda metin aranÄ±r." |
| `apps/server/src/tools/git-status.ts` | "Git durum kontrolÃ¼" | "Ã‡alÄ±ÅŸma kopyasÄ±nÄ±n deÄŸiÅŸiklik durumu okunur." |
| `apps/server/src/tools/git-diff.ts` | "DeÄŸiÅŸiklik inceleme" | "Bir deÄŸiÅŸikliÄŸin diff Ã§Ä±ktÄ±sÄ± alÄ±nÄ±r." |
| `apps/server/src/tools/edit-patch.ts` | "Kod deÄŸiÅŸikliÄŸi" | "Bir dosyaya yamayla deÄŸiÅŸiklik uygulanÄ±r." |
| `apps/server/src/tools/agent-delegate.ts` | "Alt gÃ¶rev" | "KarmaÅŸÄ±k iÅŸ iÃ§in alt agent Ã§alÄ±ÅŸtÄ±rÄ±lÄ±r." |

### 2.3 Test guard â€” coverage

**Yeni dosya:** `apps/server/src/tools/__tests__/user-label-coverage.test.ts`

```typescript
import { describe, expect, it } from 'vitest';
import { registry } from '../registry.js';

describe('Tool user_label_tr coverage', () => {
  it('every built-in tool exposes user_label_tr', () => {
    for (const tool of registry.all()) {
      expect(tool.user_label_tr, `tool ${tool.name} missing user_label_tr`).toBeTruthy();
      expect(tool.user_label_tr!.length).toBeLessThanOrEqual(80);
    }
  });

  it('user_summary_tr is present and bounded when set', () => {
    for (const tool of registry.all()) {
      if (tool.user_summary_tr !== undefined) {
        expect(tool.user_summary_tr.length).toBeLessThanOrEqual(140);
      }
    }
  });

  it('user_label_tr is Turkish (no raw English markers)', () => {
    const englishMarkers = ['execute', 'subprocess', 'argv', 'redaction', 'redacted', 'truncated'];
    for (const tool of registry.all()) {
      const lower = (tool.user_label_tr ?? '').toLowerCase();
      for (const marker of englishMarkers) {
        expect(lower).not.toContain(marker);
      }
    }
  });
});
```

### 2.4 Server presentation katmanÄ± â€” yeni alanlar tool result payload'una akar

**Dosya:** `apps/server/src/presentation/map-tool-result.ts` (veya benzeri)

Tool result block oluÅŸturulurken `user_label_tr` ve `user_summary_tr` payload'a eklenir:

```typescript
const toolDef = registry.get(toolName);
const block = {
  type: 'tool_result' as const,
  payload: {
    // ... mevcut alanlar
    tool_name: toolName,
    user_label_tr: toolDef?.user_label_tr,
    user_summary_tr: toolDef?.user_summary_tr,
  },
};
```

`approval_block` ve `tool_call` block tipleri iÃ§in de aynÄ± baÄŸlantÄ± yapÄ±lÄ±r.

**Frontend type geniÅŸletmesi:** `apps/web/src/ws-types.ts` (veya `packages/types`'ten gelen RenderBlock type) `user_label_tr?: string` ve `user_summary_tr?: string` alanlarÄ±nÄ± taÅŸÄ±r.

### 2.5 Frontend `formatWorkDetail` davranÄ±ÅŸ deÄŸiÅŸikliÄŸi

**Dosya:** `apps/web/src/components/chat/workNarrationFormat.ts:51-83`

`formatWorkDetail` artÄ±k **whitelist dÄ±ÅŸÄ± kalan metni dÃ¶ndÃ¼rmez**, `null` dÃ¶ner:

```typescript
export function formatWorkDetail(detail: string | undefined): string | null {
  if (!detail) return null;
  if (KNOWN_TR_PHRASES.has(detail)) return KNOWN_TR_PHRASES.get(detail)!;
  // Tool-name based replace'leri uygula
  let formatted = detail;
  for (const [en, tr] of workToolLabels) {
    if (formatted.includes(en)) formatted = formatted.replaceAll(en, tr);
  }
  // EÄŸer hÃ¢lÃ¢ Ä°ngilizce marker'lar varsa null dÃ¶n
  if (/\b(executes?|subprocess|argv|captured|redaction|truncated)\b/i.test(formatted)) {
    return null;
  }
  return formatted;
}
```

TÃ¼ketici taraflar (RunProgressPanel, ToolResultBlock, ToolActivityIndicator) `null` durumunda detay satÄ±rÄ± **hiÃ§ render etmez**.

### 2.6 Tool aktivitesi render Ã¶nceliÄŸi

**Dosya:** `apps/web/src/components/chat/blocks/ToolResultBlock.tsx`
**Dosya:** `apps/web/src/components/chat/RunProgressPanel.tsx` (Developer Mode tarafÄ±)

Render edilirken etiket Ã¶nceliÄŸi:

```typescript
function resolveToolLabel(block: ToolResultRenderBlock): string {
  return block.payload.user_label_tr           // server'dan TR etiket
    ?? formatWorkToolLabel(block.payload.tool_name)  // mevcut frontend sÃ¶zlÃ¼k
    ?? block.payload.tool_name                 // son fallback (Developer Mode iÃ§in)
    ?? 'Ä°ÅŸlem';                                // generic fallback
}
```

### 2.7 Error mesajlarÄ± TR'leÅŸir

**Dosya:** `apps/web/src/components/chat/blocks/ToolResultBlock.tsx`

User-facing modda raw error mesajÄ± **gizli**, yerine TR cÃ¼mle:

```tsx
if (block.payload.status === 'error') {
  const friendlyError = getFriendlyErrorMessage(block.payload);  // yeni helper
  return (
    <details className={styles.errorLine}>
      <summary>
        <AlertTriangle size={14} />
        <strong>{resolveToolLabel(block)} tamamlanamadÄ±</strong>
        <span className={styles.errorTail}>{friendlyError}</span>
      </summary>
      <div className={styles.errorDetail}>
        <button type="button" onClick={onRetry}>Yeniden dene</button>
        {isDeveloperMode && (
          <pre className={styles.errorRaw}>
            {block.payload.error_code}: {block.payload.error_message}
          </pre>
        )}
      </div>
    </details>
  );
}
```

`getFriendlyErrorMessage` mapping (yeni dosya: `apps/web/src/components/chat/blocks/errorCopy.ts`):

```typescript
const errorCopy: Record<string, string> = {
  NOT_FOUND: 'aranan kaynak bulunamadÄ±',
  PERMISSION_DENIED: 'eriÅŸim izni yok',
  TIMEOUT: 'iÅŸlem zaman aÅŸÄ±mÄ±na uÄŸradÄ±',
  RATE_LIMITED: 'Ã§ok hÄ±zlÄ± istek atÄ±ldÄ±, biraz bekle',
  NETWORK: 'baÄŸlantÄ± sorunu',
  UNAUTHORIZED: 'oturum aÃ§man gerekiyor',
  INVALID_INPUT: 'girilen deÄŸer geÃ§ersiz',
};

export function getFriendlyErrorMessage(payload: ToolResultErrorPayload): string {
  return errorCopy[payload.error_code ?? ''] ?? 'beklenmeyen bir sorun oldu';
}
```

`Hata kodu: NOT_FOUND` chip'i **Developer Mode dÄ±ÅŸÄ±nda render edilmez**.

---

## 3. Kapsam dÄ±ÅŸÄ±

- âŒ Approval kart yeniden yazÄ±mÄ± â†’ PR-4'te (paralel).
- âŒ Server side `risk_level` tool definition'a koyma â†’ bu PR (gerekirse).
   - **Karar:** Mevcut `risk_level` alanÄ± zaten var (`shell-exec.ts` line 885 Ã¶rneÄŸi gÃ¶rÃ¼ldÃ¼); ek iÅŸ yok. Frontend PR-4 bu alanÄ± tÃ¼ketir.
- âŒ Stop button + abort UI â†’ PR-7'de.
- âŒ Network offline banner â†’ PR-8'de.

---

## 4. Kabul Kriteri

### 4.1 Otomatik

- [ ] `pnpm --filter @runa/server typecheck` PASS
- [ ] `pnpm --filter @runa/server test -- user-label-coverage` PASS
- [ ] `pnpm --filter @runa/server lint` PASS
- [ ] `pnpm --filter @runa/web lint + typecheck + test + build` PASS
- [ ] `grep -rE "Hata kodu:" apps/web/src/components/chat/blocks/ToolResultBlock.tsx` â†’ user-facing modda yok (sadece `isDeveloperMode` koÅŸulu iÃ§inde).
- [ ] `grep -rE "(executes|subprocess|argv)" apps/web/src/components` â†’ 0 match (case-insensitive).

### 4.2 Lock test gÃ¼ncellemesi

- `workNarrationFormat.formatWorkDetail` artÄ±k `string | null` dÃ¶ner (eski `string | undefined` deÄŸil).
- `ToolResultBlock.tsx` user-facing dalÄ±nda `error_code` referansÄ± yok.
- Server tool registry'den Ã§ekilen tÃ¼m tool'lar `user_label_tr` taÅŸÄ±r (test guard).

### 4.3 GÃ¶rsel kanÄ±t

`docs/design-audit/screenshots/`:

- [ ] `desktop-1440-error-toolfail-shell.png` â€” shell.exec baÅŸarÄ±sÄ±z, TR cÃ¼mle
- [ ] `desktop-1440-error-toolfail-detail-open.png` â€” Detay aÃ§Ä±k, Developer Mode kapalÄ±, raw gÃ¶rÃ¼nmez
- [ ] `desktop-1440-error-toolfail-developer-mode.png` â€” Developer Mode aÃ§Ä±k, raw error pre iÃ§inde
- [ ] `desktop-1440-tool-success-tr-label.png` â€” baÅŸarÄ±lÄ± tool turu, `Terminal komutu â€º` (user_label_tr)
- [ ] `mobile-390-error-toolfail.png` â€” mobil

### 4.4 Ä°nsan-review

- [ ] HiÃ§bir user-facing ekran gÃ¶rÃ¼ntÃ¼sÃ¼nde "Executes a non-interactive..." metni yok.
- [ ] HiÃ§bir user-facing ekran gÃ¶rÃ¼ntÃ¼sÃ¼nde "Hata kodu: NOT_FOUND" chip'i yok.
- [ ] Tool Ã§aÄŸrÄ±sÄ± satÄ±rÄ± `user_label_tr` kullanÄ±r (TÃ¼rkÃ§e etiket).
- [ ] Error mesajÄ± kullanÄ±cÄ± dilinde tek cÃ¼mle.

---

## 5. Risk ve geri-alma

| Risk | Etki | Mitigation |
|---|---|---|
| Bir tool definition `user_label_tr` eklemede unutulur | YÃ¼ksek | Test guard FAIL eder, PR mergelenmez. |
| Server kontrat deÄŸiÅŸikliÄŸi client'Ä± bozar | DÃ¼ÅŸÃ¼k | Alan opsiyonel; eski client'lar `user_label_tr === undefined` ile Ã§alÄ±ÅŸÄ±r. |
| `formatWorkDetail` null dÃ¶ndÃ¼rmeye baÅŸlayÄ±nca eski tÃ¼keticiler undefined-render hatasÄ± verir | YÃ¼ksek | TÃ¼m tÃ¼keticiler PR-5 iÃ§inde null-check ile gÃ¼ncellenir; e2e test eski + yeni davranÄ±ÅŸÄ± kontrol eder. |
| `errorCopy` map'i kapsam dÄ±ÅŸÄ± error_code aldÄ±ÄŸÄ±nda "beklenmeyen bir sorun oldu" jenerikliÄŸi rahatsÄ±z eder | DÃ¼ÅŸÃ¼k | PR-8 polish'inde error_code listesi geniÅŸletilir. |

**Geri-alma:** Server + frontend ayrÄ± revert edilebilir; client geriye uyumlu olduÄŸu iÃ§in yalnÄ±z server revert client'Ä± bozmaz.

---

## 6. Komutlar

```bash
git worktree add .claude/worktrees/runa-ui-pr-5-errors codex/ui-restructure-pr-5-errors-user-label
cd .claude/worktrees/runa-ui-pr-5-errors
pnpm install

# Server check
pnpm --filter @runa/server typecheck
pnpm --filter @runa/server test -- user-label-coverage shell-exec
pnpm --filter @runa/server lint

# Frontend check
pnpm --filter @runa/web lint
pnpm --filter @runa/web typecheck
pnpm --filter @runa/web test
pnpm --filter @runa/web build

# SÄ±zÄ±ntÄ± kontrol
grep -rE "(executes a|argv-based|non-interactive)" apps/web/src/components || echo "PASS"
grep -rE "Hata kodu:" apps/web/src/components/chat/blocks/ToolResultBlock.tsx
```

---

> Server ve frontend aynÄ± PR'da; gÃ¶zden geÃ§irme server kÄ±smÄ± Ã¶nce review edilir. Type kontratÄ± `packages/types`'te gÃ¼ncellendiÄŸi iÃ§in `pnpm install` worktree aÃ§Ä±lÄ±ÅŸta zorunlu.


