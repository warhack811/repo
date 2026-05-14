# PR-9 Codex Brief — Token Migration Cleanup (PR-1/PR-7 follow-up)

> **Tarih:** 2026-05-14
> **Branch:** `codex/ui-restructure-pr-9-token-cleanup`
> **Worktree:** `.claude/worktrees/runa-ui-pr-9-token-cleanup`
> **Authority:** `docs/RUNA-DESIGN-LANGUAGE.md` (source of truth) + `docs/design/RUNA-DESIGN-BRIEF.md` v1.2
> **Bağımlılık:** PR-1..PR-8 merge edilmiş olmalı.
> **Hedef:** PR-1 token swap'ında ve PR-7 legacy alias temizliğinde gözden kaçan **162 tanımsız token referansını** yeni token diline taşı.

---

## 1. Tek cümle hedef

Bu PR'dan sonra `apps/web/src` içinde `tokens.css`'te tanımı olmayan tek bir `var(--...)` referansı kalmaz; özellikle `PersistedTranscript`, `BlockRenderer`, `primitives.css` ve `RunProgressPanel` dosyalarındaki sohbet ve durum kartı renkleri doğru render olur.

---

## 2. Bulunan problem — kanıt

PR-1 brief Bölüm 2.2 "Token reference migration" tablosu eksikti. Codex brief'te listelenen 12 eski token'ı doğru migrate etti, ancak aşağıdaki tokenlar listede yoktu ve referansları silinmedi:

```bash
$ grep -rhoE "var\(--[a-z][a-z0-9-]+" apps/web/src --include="*.css" --include="*.tsx" --include="*.ts" \
    | sed 's/var(//' | sort -u > /tmp/used.txt
$ grep -hoE "^\s*--[a-z][a-z0-9-]+" apps/web/src/styles/tokens.css | sort -u > /tmp/defined.txt
$ comm -23 /tmp/used.txt /tmp/defined.txt | wc -l
34
```

Toplam **162 kullanım**, **34 farklı tanımsız token**. CSS engine `var(--undefined)` gördüğünde:
- `color:`, `background:` → `unset` davranışı; metin inherit edilir, arka plan transparan olur
- `border:` → `border-color: currentColor` fallback
- Sonuç: WCAG kontrast hedefi tutmaz, mesaj balonu renkleri ve durum kartları beklenmedik görünür.

**Görsel kanıt:** Açık herhangi bir `var(--color-text-soft)` referansı (örn. `PersistedTranscript.module.css:10`) inceleme tool'unda computed value `inherit`/`unset` döner.

---

## 3. Kapsam — Yapılacaklar

### 3.1 `--ink-4` token'ını tokens.css'e ekle

`ChatComposerSurface.module.css`, `VoiceComposerControls.module.css` ve `components.css` ink scale'i 4 seviyeli kullanıyor ama tokens.css'te yalnız `--ink-3`'e kadar tanım var.

**Dosya:** `apps/web/src/styles/tokens.css`

Her tema bloğuna ekle:

```css
:root, [data-theme="ember-dark"] {
  /* ... mevcut ... */
  --ink-4: #7A6D5A;  /* placeholder (decoration-only metinler, ≥600 weight veya ≥18px) */
}

[data-theme="ember-light"] {
  --ink-4: #7A6F5F;
}

[data-theme="rose-dark"] {
  --ink-4: #6E5B58;
}
```

WCAG kuralı: `--ink-4` yalnızca ≥18px veya ≥14px+600 weight ile kullanılır. ESLint/CSS scan ile küçük metin kontrolü PR-1 lock test'te zaten var; aynı kural `--ink-4`'e de uygulanır.

### 3.2 Token migration tablosu — birebir uygula

Aşağıdaki **34 token**, **162 kullanım yeri** olduğu gibi map edilir. `hsl(var(--token))` wrapper'ları **kaldırılır** (yeni tokenlar düz hex/rgb, hsl wrapper gerekmiyor):

#### Text/color (8 token, 25 kullanım)

| Eski | Yeni | Notu |
|---|---|---|
| `hsl(var(--color-text))` | `var(--ink-1)` | 1 kullanım, `BlockRenderer.module.css` |
| `hsl(var(--color-text-muted))` | `var(--ink-2)` | 1, `BlockRenderer.module.css` |
| `hsl(var(--color-text-soft))` | `var(--ink-3)` | 5, `PersistedTranscript.module.css`, `BlockRenderer.module.css`, `components.css` |
| `var(--text-primary)` | `var(--ink-1)` | 1 |
| `var(--text-strong)` | `var(--ink-1)` | 8 |
| `var(--text-muted)` | `var(--ink-2)` | 1 |
| `var(--text-soft)` | `var(--ink-3)` | 2 |
| `var(--text-link)` | `var(--accent)` | 7, çoğu `RunProgressPanel.module.css` (Developer Mode) |

#### Surface (5 token, 30 kullanım)

| Eski | Yeni | Notu |
|---|---|---|
| `var(--surface-panel)` | `var(--surface-2)` | 6 |
| `var(--surface-panel-muted)` | `var(--surface-3)` | 5 |
| `var(--surface-subtle)` | `var(--surface-2)` | 5 |
| `var(--surface-chip)` | `var(--surface-3)` | 8 |
| `var(--surface-hover)` | `color-mix(in srgb, var(--ink-1) 6%, transparent)` | 6 |

#### Border (8 token, 36 kullanım)

| Eski | Yeni | Notu |
|---|---|---|
| `var(--border-default)` | `var(--hairline)` | 7 |
| `var(--border-hairline)` | `var(--hairline)` | 1 |
| `var(--border-strong)` | `color-mix(in srgb, var(--ink-1) 18%, transparent)` | 5 |
| `var(--border-primary)` | `var(--accent)` | 7 |
| `var(--border-info)` | `var(--status)` | 6 |
| `var(--border-success)` | `var(--status)` | 1 |
| `var(--border-warning)` | `var(--warn)` | 5 |
| `var(--border-danger)` | `var(--error)` | 4 |

#### Status (8 token, 39 kullanım — durum kartları)

| Eski | Yeni | Notu |
|---|---|---|
| `var(--status-info-bg)` | `var(--status-bg)` | 4 |
| `var(--status-info-text)` | `var(--status)` | 9 |
| `var(--status-success-bg)` | `var(--status-bg)` | 2 |
| `var(--status-success-text)` | `var(--status)` | 2 |
| `var(--status-warning-bg)` | `var(--warn-bg)` | 6 |
| `var(--status-warning-text)` | `var(--warn)` | 10 |
| `var(--status-danger-bg)` | `var(--error-bg)` | 2 |
| `var(--status-danger-text)` | `var(--error)` | 4 |

#### Spacing (4 token, 11 kullanım)

Bu tokenlar mevcut yeni token sisteminde **karşılığı olmayan** layout helper'larıydı. Inline değerlere açılır:

| Eski | Yeni |
|---|---|
| `var(--space-page-y)` | `clamp(20px, 3vw, 32px)` (kullanım yerinde) |
| `var(--space-page-x)` | `clamp(20px, 4vw, 40px)` (kullanım yerinde) |
| `var(--space-panel)` | `20px` |
| `var(--space-subcard)` | `12px` |

### 3.3 Etkilenen dosyalar (eksiksiz)

```
apps/web/src/styles/tokens.css                                  (--ink-4 eklenir)
apps/web/src/styles/primitives.css                              (~60 değişiklik — en büyük yük)
apps/web/src/styles/components.css                              (~5)
apps/web/src/components/chat/PersistedTranscript.module.css     (2)
apps/web/src/components/chat/blocks/BlockRenderer.module.css    (4)
apps/web/src/components/chat/RunProgressPanel.module.css        (8)
```

Her dosyada exact-match sed/replace güvenli (token isimleri benzersiz). `hsl()` wrapper'larını silmek için ekstra dikkat:

```
hsl(var(--color-text-soft))   →   var(--ink-3)
hsl(var(--color-text))        →   var(--ink-1)
hsl(var(--color-text-muted))  →   var(--ink-2)
```

### 3.4 Lock test güncellemesi

**Dosya:** `apps/web/src/test/design-language-lock.test.ts`

Mevcut "legacy token yok" testi **genişletilir**: tüm 34 token'ın artık 0 referansı olduğu doğrulanır. Pseudo-test:

```typescript
it('apps/web/src icinde tanimsiz legacy token referansi yok', async () => {
  const used = await collectVarReferences('apps/web/src');     // her var(--X) X seti
  const definedInTokens = await collectDefinitions('apps/web/src/styles/tokens.css');
  const definedInFonts = await collectDefinitions('apps/web/src/styles/fonts.css');
  const runtimeAllowed = new Set([
    'keyboard-offset', 'bg', 'spread', // useVisualViewport + shimmer local CSS vars
  ]);

  const undefined = [...used].filter(
    (t) => !definedInTokens.has(t) && !definedInFonts.has(t) && !runtimeAllowed.has(t),
  );
  expect(undefined, `Undefined tokens: ${undefined.join(', ')}`).toEqual([]);
});
```

### 3.5 CI grep guard

`.github/workflows/web-ci.yml` veya `package.json` script'inde audit step:

```bash
# Tanımsız token referansı kontrolü
node scripts/audit-tokens.mjs  # exit 1 if any undefined var(--*) found
```

`scripts/audit-tokens.mjs` (yeni dosya) basit: yukarıdaki test mantığını CLI'da çalıştırır.

---

## 4. Kapsam dışı

- ❌ Yeni token ekleme (`--ink-4` hariç — o zorunlu).
- ❌ Mevcut tokenların hex değerini değiştirme.
- ❌ Yeni component / yeni route.
- ❌ TypeScript / TSX dosyalarındaki inline style props'ları (yalnız CSS dosyaları kapsam içinde).
- ❌ `design-tokens.ts` (`apps/web/src/styles/design-tokens.ts`) mevcut map'i bozmaz; orada eski isimler hala alias olarak kalabilir (downstream zarar yok). PR-9'da yalnız CSS referansları temizlenir.

---

## 5. Kabul Kriteri

### 5.1 Otomatik (CI)

- [ ] `pnpm --filter @runa/web lint` PASS
- [ ] `pnpm --filter @runa/web typecheck` PASS
- [ ] `pnpm --filter @runa/web test` PASS (yeni lock assertion dahil)
- [ ] `pnpm --filter @runa/web build` PASS
- [ ] `node scripts/audit-tokens.mjs` PASS (0 tanımsız token)
- [ ] Grep kontrolü: `grep -rE "var\(--(color-text|text-link|text-primary|text-muted|text-strong|text-soft|surface-panel|surface-subtle|surface-chip|surface-hover|border-default|border-hairline|border-strong|border-primary|border-info|border-success|border-warning|border-danger|status-info|status-success|status-warning|status-danger|space-page|space-panel|space-subcard)" apps/web/src` → **0 sonuç**

### 5.2 Görsel kanıt

`docs/design-audit/screenshots/2026-05-XX-ui-restructure-pr-9-token-cleanup/`:

- [ ] `desktop-1440-chat-active-transcript.png` — mesaj balonu metinleri `--ink-3` rengini doğru render
- [ ] `desktop-1440-approval-warning.png` — uyarı durumlu approval kartı arka plan + border doğru
- [ ] `desktop-1440-devices-error-state.png` — hata durumu kartı (`--status-danger-*`)
- [ ] `desktop-1440-developer-mode-run-progress.png` — Developer Mode RunProgressPanel renkleri (text-link → accent)
- [ ] PR-1'de üretilmiş baseline ekran görüntüleri ile diff: **pixel diff ≥%0** beklenir (renkler değişiyor çünkü daha önce bozuktu). Renk farkı kullanıcı-kabul testiyle onaylanır.

### 5.3 İnsan-review

- [ ] Sohbette asistan mesajı altında ikinci satır (varsa) net `--ink-3` rengiyle görünür, transparan/siyah değil.
- [ ] Onay kartında "low/medium/high" risk seviyeleri doğru renk veriyor.
- [ ] Developer Mode açıkken RunProgressPanel link'leri turuncu (accent) görünür.
- [ ] Durum kartları (success/warn/error) için bg + text karşıtlığı WCAG AA geçer.

---

## 6. Risk ve geri-alma

| Risk | Etki | Mitigation |
|---|---|---|
| Bir migration map'i yanlış renk verir | Orta | Tablo manuel onaylı; renk benzerliği için yeni token semantik eşleşmeli. Hatalı bulunursa PR-9.1 ile düzeltilir. |
| `hsl()` wrapper'ı bir yerde unutulur → invalid CSS | Düşük | Build sırasında PostCSS uyarı verir; lint guard PostCSS warning'i fail eder. |
| Lock test çok sıkı → gelecekte yeni token eklemek zorlaşır | Düşük | Test "tokens.css veya fonts.css'te tanımlı olmalı" şeklinde; yeni token eklemek yeterli. |
| Spacing token'ları (`--space-page-*`) inline edildi → responsive bozulabilir | Orta | Etkilenen 11 satır PR'da görsel kanıtla doğrulanır. |

**Geri-alma:** Tek commit veya küçük commit serisi olarak revert edilebilir. Tüm değişiklik mekanik (CSS find-replace), iş mantığı dokunmaz.

---

## 7. Komutlar (Codex)

```bash
cd D:/ai/Runa
git worktree add .claude/worktrees/runa-ui-pr-9-token-cleanup codex/ui-restructure-pr-9-token-cleanup
cd .claude/worktrees/runa-ui-pr-9-token-cleanup
pnpm install
pnpm --filter @runa/web dev

# Audit öncesi sayım
grep -rhoE "var\(--[a-z][a-z0-9-]+" apps/web/src --include="*.css" --include="*.tsx" --include="*.ts" \
  | sed 's/var(//' | sort -u > /tmp/used.txt
grep -hoE "^\s*--[a-z][a-z0-9-]+" apps/web/src/styles/tokens.css apps/web/src/styles/fonts.css \
  | sort -u > /tmp/defined.txt
comm -23 /tmp/used.txt /tmp/defined.txt
# Beklenen baseline: 34 tanımsız token

# Migration yapıldıktan sonra
# Beklenen: yalnız --keyboard-offset, --bg, --spread (runtime-allowed)

# Doğrulama
pnpm --filter @runa/web lint
pnpm --filter @runa/web typecheck
pnpm --filter @runa/web test
pnpm --filter @runa/web build
```

---

## 8. Yetki ve doğrulama notu

- Bu brief Claude'un PR-1 ve PR-7 brief'lerinde **eksik bıraktığı kısmı** kapatır. Hata Codex'in değil, brief'in tam liste vermemiş olmasındaydı.
- Codex bu PR'da brief'teki tabloyu birebir uygular, ek token oluşturmaz, ek migration yapmaz.
- Belirsizlik çıkarsa Codex iş başlamadan kullanıcıya sorar; tahmin yapmaz.

---

> Bu PR, UI restructure'ın **son rötuşunu** kapatır. PR-9 merge edildiğinde:
> 1. `docs/PROGRESS.md`'ye `TASK-UI-RESTRUCTURE-PR-9-TOKEN-CLEANUP - <tarih>` kaydı düşülür.
> 2. RUNA-DESIGN-LANGUAGE.md "completed" durumunda kalır (değişmez).
> 3. UI restructure süreci gerçek anlamda kapanır.
