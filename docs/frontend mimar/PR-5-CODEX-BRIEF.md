# PR-5 Codex Brief — User-Safe Errors + Server `user_label_tr` Kontratı

> **Tarih:** 2026-05-13
> **Branch:** `codex/ui-restructure-pr-5-errors-user-label`
> **Worktree:** `.claude/worktrees/runa-ui-pr-5-errors`
> **Authority:** `docs/frontend mimar/RUNA-DESIGN-BRIEF.md` v1.1 (Bölüm 12.5 Server Kontratı)
> **Bağımlılık:** PR-3 merge edilmiş olmalı. PR-4 ile paralel.
> **Hedef:** Server tool definition'a opsiyonel `user_label_tr` + `user_summary_tr` alanları eklenir; frontend bu alanları kullanarak İngilizce tool description sızıntısını sıfırlar; error mesajları kullanıcı dilinde TR'ye geçer.

---

## 1. Tek cümle hedef

Bu PR'dan sonra Developer Mode kapalıyken sohbette **hiçbir İngilizce tool description metni** görünmez; `Hata kodu: NOT_FOUND` gibi raw error chip'leri yalnız Developer Mode'da; sözlük dışı kalan tool aktivitesi detayı boş kalır (false-positive sızıntı sıfır).

---

## 2. Kapsam — Yapılacaklar

### 2.1 Server: `ToolDefinition` interface'ine opsiyonel alanlar

**Dosya:** `packages/types/src/tools.ts`

```typescript
export interface ToolDefinition<TName extends string = string, TArgs extends ToolArguments = ToolArguments, TData = unknown> {
  readonly name: TName;
  readonly description: string;          // mevcut — model-facing, EN
  readonly user_label_tr?: string;       // yeni — user-facing kısa etiket, ≤80 karakter, TR
  readonly user_summary_tr?: string;     // yeni — bir cümlelik TR özet, ≤140 karakter
  // ... mevcut alanlar (parameters, requires_approval, risk_level, vs.)
}
```

### 2.2 Built-in tool registry — TR etiket ekle

Aşağıdaki dosyaların her birinde `user_label_tr` ve `user_summary_tr` alanları eklenir:

| Dosya | `user_label_tr` | `user_summary_tr` |
|---|---|---|
| `apps/server/src/tools/shell-exec.ts` | "Terminal komutu" | "Bağlı oturumda komut çalıştırılır, çıktısı sohbete eklenir." |
| `apps/server/src/tools/shell-session.ts` (start/read/stop) | "Terminal oturumu" | "Etkileşimli komut oturumu açılır, çıktılar parça parça sohbete akar." |
| `apps/server/src/tools/file-read.ts` | "Dosya okuma" | "Belirtilen dosyanın içeriği güvenli sınırlar içinde okunur." |
| `apps/server/src/tools/file-write.ts` | "Dosya yazma" | "Belirtilen dosyaya değişiklik yazılır." |
| `apps/server/src/tools/file-list.ts` | "Dizin listeleme" | "Bir klasördeki dosyalar listelenir." |
| `apps/server/src/tools/file-share.ts` | "Dosya paylaşımı" | "Üretilen dosya için kısa süreli indirme linki oluşturulur." |
| `apps/server/src/tools/file-watch.ts` | "Dosya takibi" | "Bir dosyanın değişimi izlenir." |
| `apps/server/src/tools/desktop-screenshot.ts` | "Ekran görüntüsü" | "Bağlı masaüstünden ekran görüntüsü alınır." |
| `apps/server/src/tools/desktop-click.ts` | "Masaüstü tıklaması" | "Bağlı masaüstünde belirtilen konuma tıklanır." |
| `apps/server/src/tools/desktop-type.ts` | "Masaüstüne yazma" | "Bağlı masaüstündeki aktif alana metin yazılır." |
| `apps/server/src/tools/desktop-keypress.ts` | "Klavye kısayolu" | "Bağlı masaüstünde klavye kısayolu çalıştırılır." |
| `apps/server/src/tools/desktop-launch.ts` | "Uygulama başlatma" | "Bağlı masaüstünde belirtilen uygulama başlatılır." |
| `apps/server/src/tools/desktop-scroll.ts` | "Masaüstü kaydırma" | "Bağlı masaüstü ekranı belirtilen yönde kaydırılır." |
| `apps/server/src/tools/desktop-clipboard.ts` (read/write) | "Pano işlemi" | "Bağlı masaüstünün pano içeriği okunur veya yazılır." |
| `apps/server/src/tools/desktop-vision-analyze.ts` | "Ekran analizi" | "Ekrandaki görsel içerik analiz edilir." |
| `apps/server/src/tools/desktop-verify-state.ts` | "Masaüstü doğrulama" | "Beklenen ekran durumu doğrulanır." |
| `apps/server/src/tools/browser-navigate.ts` | "Tarayıcı gezintisi" | "Tarayıcıda bir adrese gidilir." |
| `apps/server/src/tools/browser-click.ts` | "Tarayıcı tıklaması" | "Sayfada bir öğeye tıklanır." |
| `apps/server/src/tools/browser-fill.ts` | "Form doldurma" | "Sayfa formuna metin doldurulur." |
| `apps/server/src/tools/browser-extract.ts` | "Sayfa okuma" | "Sayfadan istenen içerik çıkarılır." |
| `apps/server/src/tools/memory-save.ts` | "Belleğe kaydetme" | "Önemli bir bilgi proje belleğine kaydedilir." |
| `apps/server/src/tools/memory-search.ts` | "Bellek araması" | "Kaydedilmiş bilgiler arasında arama yapılır." |
| `apps/server/src/tools/memory-list.ts` | "Bellek listeleme" | "Kaydedilmiş bilgiler listelenir." |
| `apps/server/src/tools/memory-delete.ts` | "Bellek silme" | "Bir bellek kaydı kalıcı olarak silinir." |
| `apps/server/src/tools/web-search.ts` | "Web arama" | "Web'de bir konu araştırılır." |
| `apps/server/src/tools/search-codebase.ts` | "Kod arama" | "Proje kodunda anahtar kelime aranır." |
| `apps/server/src/tools/search-grep.ts` | "Dosya arama" | "Proje dosyalarında metin aranır." |
| `apps/server/src/tools/git-status.ts` | "Git durum kontrolü" | "Çalışma kopyasının değişiklik durumu okunur." |
| `apps/server/src/tools/git-diff.ts` | "Değişiklik inceleme" | "Bir değişikliğin diff çıktısı alınır." |
| `apps/server/src/tools/edit-patch.ts` | "Kod değişikliği" | "Bir dosyaya yamayla değişiklik uygulanır." |
| `apps/server/src/tools/agent-delegate.ts` | "Alt görev" | "Karmaşık iş için alt agent çalıştırılır." |

### 2.3 Test guard — coverage

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

### 2.4 Server presentation katmanı — yeni alanlar tool result payload'una akar

**Dosya:** `apps/server/src/presentation/map-tool-result.ts` (veya benzeri)

Tool result block oluşturulurken `user_label_tr` ve `user_summary_tr` payload'a eklenir:

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

`approval_block` ve `tool_call` block tipleri için de aynı bağlantı yapılır.

**Frontend type genişletmesi:** `apps/web/src/ws-types.ts` (veya `packages/types`'ten gelen RenderBlock type) `user_label_tr?: string` ve `user_summary_tr?: string` alanlarını taşır.

### 2.5 Frontend `formatWorkDetail` davranış değişikliği

**Dosya:** `apps/web/src/components/chat/workNarrationFormat.ts:51-83`

`formatWorkDetail` artık **whitelist dışı kalan metni döndürmez**, `null` döner:

```typescript
export function formatWorkDetail(detail: string | undefined): string | null {
  if (!detail) return null;
  if (KNOWN_TR_PHRASES.has(detail)) return KNOWN_TR_PHRASES.get(detail)!;
  // Tool-name based replace'leri uygula
  let formatted = detail;
  for (const [en, tr] of workToolLabels) {
    if (formatted.includes(en)) formatted = formatted.replaceAll(en, tr);
  }
  // Eğer hâlâ İngilizce marker'lar varsa null dön
  if (/\b(executes?|subprocess|argv|captured|redaction|truncated)\b/i.test(formatted)) {
    return null;
  }
  return formatted;
}
```

Tüketici taraflar (RunProgressPanel, ToolResultBlock, ToolActivityIndicator) `null` durumunda detay satırı **hiç render etmez**.

### 2.6 Tool aktivitesi render önceliği

**Dosya:** `apps/web/src/components/chat/blocks/ToolResultBlock.tsx`
**Dosya:** `apps/web/src/components/chat/RunProgressPanel.tsx` (Developer Mode tarafı)

Render edilirken etiket önceliği:

```typescript
function resolveToolLabel(block: ToolResultRenderBlock): string {
  return block.payload.user_label_tr           // server'dan TR etiket
    ?? formatWorkToolLabel(block.payload.tool_name)  // mevcut frontend sözlük
    ?? block.payload.tool_name                 // son fallback (Developer Mode için)
    ?? 'İşlem';                                // generic fallback
}
```

### 2.7 Error mesajları TR'leşir

**Dosya:** `apps/web/src/components/chat/blocks/ToolResultBlock.tsx`

User-facing modda raw error mesajı **gizli**, yerine TR cümle:

```tsx
if (block.payload.status === 'error') {
  const friendlyError = getFriendlyErrorMessage(block.payload);  // yeni helper
  return (
    <details className={styles.errorLine}>
      <summary>
        <AlertTriangle size={14} />
        <strong>{resolveToolLabel(block)} tamamlanamadı</strong>
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
  NOT_FOUND: 'aranan kaynak bulunamadı',
  PERMISSION_DENIED: 'erişim izni yok',
  TIMEOUT: 'işlem zaman aşımına uğradı',
  RATE_LIMITED: 'çok hızlı istek atıldı, biraz bekle',
  NETWORK: 'bağlantı sorunu',
  UNAUTHORIZED: 'oturum açman gerekiyor',
  INVALID_INPUT: 'girilen değer geçersiz',
};

export function getFriendlyErrorMessage(payload: ToolResultErrorPayload): string {
  return errorCopy[payload.error_code ?? ''] ?? 'beklenmeyen bir sorun oldu';
}
```

`Hata kodu: NOT_FOUND` chip'i **Developer Mode dışında render edilmez**.

---

## 3. Kapsam dışı

- ❌ Approval kart yeniden yazımı → PR-4'te (paralel).
- ❌ Server side `risk_level` tool definition'a koyma → bu PR (gerekirse).
   - **Karar:** Mevcut `risk_level` alanı zaten var (`shell-exec.ts` line 885 örneği görüldü); ek iş yok. Frontend PR-4 bu alanı tüketir.
- ❌ Stop button + abort UI → PR-7'de.
- ❌ Network offline banner → PR-8'de.

---

## 4. Kabul Kriteri

### 4.1 Otomatik

- [ ] `pnpm --filter @runa/server typecheck` PASS
- [ ] `pnpm --filter @runa/server test -- user-label-coverage` PASS
- [ ] `pnpm --filter @runa/server lint` PASS
- [ ] `pnpm --filter @runa/web lint + typecheck + test + build` PASS
- [ ] `grep -rE "Hata kodu:" apps/web/src/components/chat/blocks/ToolResultBlock.tsx` → user-facing modda yok (sadece `isDeveloperMode` koşulu içinde).
- [ ] `grep -rE "(executes|subprocess|argv)" apps/web/src/components` → 0 match (case-insensitive).

### 4.2 Lock test güncellemesi

- `workNarrationFormat.formatWorkDetail` artık `string | null` döner (eski `string | undefined` değil).
- `ToolResultBlock.tsx` user-facing dalında `error_code` referansı yok.
- Server tool registry'den çekilen tüm tool'lar `user_label_tr` taşır (test guard).

### 4.3 Görsel kanıt

`docs/design-audit/screenshots/2026-05-XX-ui-restructure-pr-5-errors/`:

- [ ] `desktop-1440-error-toolfail-shell.png` — shell.exec başarısız, TR cümle
- [ ] `desktop-1440-error-toolfail-detail-open.png` — Detay açık, Developer Mode kapalı, raw görünmez
- [ ] `desktop-1440-error-toolfail-developer-mode.png` — Developer Mode açık, raw error pre içinde
- [ ] `desktop-1440-tool-success-tr-label.png` — başarılı tool turu, `Terminal komutu ›` (user_label_tr)
- [ ] `mobile-390-error-toolfail.png` — mobil

### 4.4 İnsan-review

- [ ] Hiçbir user-facing ekran görüntüsünde "Executes a non-interactive..." metni yok.
- [ ] Hiçbir user-facing ekran görüntüsünde "Hata kodu: NOT_FOUND" chip'i yok.
- [ ] Tool çağrısı satırı `user_label_tr` kullanır (Türkçe etiket).
- [ ] Error mesajı kullanıcı dilinde tek cümle.

---

## 5. Risk ve geri-alma

| Risk | Etki | Mitigation |
|---|---|---|
| Bir tool definition `user_label_tr` eklemede unutulur | Yüksek | Test guard FAIL eder, PR mergelenmez. |
| Server kontrat değişikliği client'ı bozar | Düşük | Alan opsiyonel; eski client'lar `user_label_tr === undefined` ile çalışır. |
| `formatWorkDetail` null döndürmeye başlayınca eski tüketiciler undefined-render hatası verir | Yüksek | Tüm tüketiciler PR-5 içinde null-check ile güncellenir; e2e test eski + yeni davranışı kontrol eder. |
| `errorCopy` map'i kapsam dışı error_code aldığında "beklenmeyen bir sorun oldu" jenerikliği rahatsız eder | Düşük | PR-8 polish'inde error_code listesi genişletilir. |

**Geri-alma:** Server + frontend ayrı revert edilebilir; client geriye uyumlu olduğu için yalnız server revert client'ı bozmaz.

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

# Sızıntı kontrol
grep -rE "(executes a|argv-based|non-interactive)" apps/web/src/components || echo "PASS"
grep -rE "Hata kodu:" apps/web/src/components/chat/blocks/ToolResultBlock.tsx
```

---

> Server ve frontend aynı PR'da; gözden geçirme server kısmı önce review edilir. Type kontratı `packages/types`'te güncellendiği için `pnpm install` worktree açılışta zorunlu.
