# PR-7 Codex Brief — Settings, Advanced View, Theme Picker, Stop Button, Migration Cleanup

> **Tarih:** 2026-05-13
> **Branch:** `codex/ui-restructure-pr-7-settings-stop`
> **Worktree:** `.claude/worktrees/runa-ui-pr-7-settings-stop`
> **Authority:** `docs/frontend mimar/RUNA-DESIGN-BRIEF.md` v1.1
> **Bağımlılık:** PR-6 merge edilmiş olmalı.
> **Hedef:** Settings sayfasını yeniden çiz, theme picker'ı ekle, Developer Mode → "Gelişmiş görünüm" rebrand'i yap, composer Send → Stop dönüşümünü implement et, PR-2'de ertelenen migration CSS cleanup'ı tamamla.

---

## 1. Tek cümle hedef

Bu PR'dan sonra Settings sayfası 3 tab (Hesap, Görünüm, Çalışma) ile çalışır, tema değişimi anlık, `*-migration.css` dosyaları tamamen temizlenir, composer butonu çalışma sırasında Stop'a döner ve agent abort'u tek tıkla çalışır.

---

## 2. Kapsam — Yapılacaklar

### 2.1 SettingsPage yeniden yazımı

**Dosya:** `apps/web/src/pages/SettingsPage.tsx`

Mevcut 2 tab (Hesap, Tercihler) → 3 tab:
- **Hesap** — profile, oturum, çıkış (mevcut korunur)
- **Görünüm** — tema seçici, tipografi tercihi, gelişmiş görünüm toggle
- **Çalışma** — workspace directory, approval mode, voice, runtime tercihleri

```tsx
const tabs: readonly { id: SettingsTab; label: string }[] = [
  { id: 'account', label: 'Hesap' },
  { id: 'appearance', label: 'Görünüm' },
  { id: 'workspace', label: 'Çalışma' },
];
```

### 2.2 Theme picker UI

**Dosya:** `apps/web/src/components/settings/ThemePicker.tsx` (yeni)

```tsx
const themes = [
  { id: 'ember-dark',  label: 'Ember Dark',  preview: '#14110D' },
  { id: 'ember-light', label: 'Ember Light', preview: '#F6F1E8' },
  { id: 'rose-dark',   label: 'Rose Dark',   preview: '#18110F' },
  { id: 'system',      label: 'Sistem',      preview: null },
];

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <fieldset className={styles.themePicker} aria-label="Tema">
      {themes.map((theme) => (
        <label key={theme.id} className={styles.themeOption}>
          <input
            type="radio"
            name="theme"
            value={theme.id}
            checked={value === theme.id}
            onChange={() => onChange(theme.id)}
            className={styles.themeRadio}
          />
          <span className={styles.themePreview} style={{ background: theme.preview ?? 'linear-gradient(...)' }} />
          <span className={styles.themeLabel}>{theme.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
```

`apps/web/src/lib/theme.ts` zaten `Theme` type'ı export ediyor; bu PR'da yeni tema ID'lerini destekleyecek şekilde genişletilir:

```typescript
export type Theme = 'ember-dark' | 'ember-light' | 'rose-dark' | 'system';
```

Tema değişimi: `<html data-theme="...">` set edilir. `system` durumunda `prefers-color-scheme` listener'ı `ember-dark` / `ember-light` arasında geçiş yapar.

`localStorage` key: `runa.settings.theme`.

### 2.3 "Gelişmiş görünüm" toggle

**Dosya:** `apps/web/src/hooks/useDeveloperMode.ts` (mevcut)

Hook adı korunur (internal), ama UI'da görünen label "Gelişmiş görünüm". Settings → Görünüm tab'inde:

```tsx
<RunaToggle
  label="Gelişmiş görünüm"
  description="Tool detayları, hata kodları, run id ve diğer teknik bilgileri sohbet içinde göster."
  checked={isDeveloperMode}
  onChange={setDeveloperMode}
/>
```

`uiCopy.developer.*` string'leri `uiCopy.advancedView.*` olarak rename edilir (geriye uyumlu alias bırakılır, eski tüketiciler çalışır).

### 2.4 Composer Send → Stop dönüşümü

**Dosya:** `apps/web/src/components/chat/ChatComposerSurface.tsx`

Submit butonu durum-aware:

```tsx
const isRunning = isSubmitting || connectionState.activeRunId !== null;

<button
  type={isRunning ? 'button' : 'submit'}
  className={cx(styles.submitButton, isRunning && styles.submitButtonStop)}
  onClick={isRunning ? onAbortRun : undefined}
  disabled={!isRunning && !canSubmit}
  aria-label={isRunning ? 'Çalışmayı durdur' : 'Mesaj gönder'}
>
  {isRunning ? <Square size={18} /> : <ArrowUp size={18} />}
</button>
```

CSS:
```css
.submitButton { background: var(--accent); color: var(--user-fg); }
.submitButtonStop {
  background: var(--surface-3);
  color: var(--ink-2);
  border: 1px solid var(--hairline);
}
.submitButtonStop:hover { color: var(--error); border-color: var(--error); }
```

### 2.5 `abortCurrentRun` hook metodu

**Dosya:** `apps/web/src/hooks/useChatRuntime.ts`

Yeni metod:

```typescript
function abortCurrentRun(): void {
  const activeRunId = store.getState().presentationState.currentStreamingRunId;
  if (!activeRunId) return;
  // WebSocket cancel mesajı gönder
  websocket.send(JSON.stringify({ type: 'cancel_run', run_id: activeRunId }));
  // Local state'i optimistik güncelle
  store.dispatch({ type: 'run_cancellation_requested', run_id: activeRunId });
}
```

`UseChatRuntimeResult` interface'i `abortCurrentRun: () => void` export eder. ChatPage prop chain'i ChatComposerSurface'e iletir.

Server'da mevcut `cancel-run` WebSocket message handler kullanılır; yeni endpoint gerekmez. Server kontratını doğrula:
- `apps/server/src/ws/run-execution.ts` içinde `cancel_run` mesajının handle edildiğine emin ol.
- Yoksa minimal handler ekle: aktif run'ı abort eder, "Çalışma durduruldu" mesajı yayar.

### 2.6 "Çalışma durduruldu" tek-satır feedback

Run abort sonrası sohbet'e tek satır eklenir:

```
[•] Çalışma durduruldu
```

`PresentationRunSurfaceCard` veya benzeri içinde, status `cancelled` durumunda inline rendering.

### 2.7 Migration CSS cleanup (PR-2'den ertelenmişti)

**Dosyalar (tüm `apps/web/src/styles/routes/*-migration.css`):**

- `app-shell-migration.css`
- `capability-migration.css`
- `chat-migration.css`
- `desktop-device-presence-migration.css`
- `developer-migration.css`
- `devices-migration.css`
- `history-migration.css`
- `login-migration.css`
- `settings-migration.css`

Her dosyanın içeriği:
1. Anlamlı kurallar `components.css` veya ilgili `.module.css` dosyasına taşınır.
2. `runa-migrated-components-*-N` boş `data-*` style sınıfları silinir.
3. Migration dosyasının kendisi silinir.
4. İlgili sayfa/komponent'lerdeki `import '../styles/routes/*-migration.css'` satırları kaldırılır.

**Test:** Bu işlemden sonra her route'un görsel snapshot'ı PR-1/PR-2/PR-3 sonrası baseline ile karşılaştırılır; **pixel diff ≤2%**.

### 2.8 Legacy token alias temizliği (PR-1'den ertelenmişti)

**Dosya:** `apps/web/src/styles/tokens.css`

PR-1'de alias forward olarak bırakılan eski token'lar silinir:
- `--page-background`, `--surface-canvas`, `--surface-panel`, `--surface-panel-strong`, `--surface-panel-muted`, `--surface-subtle`, `--surface-input`, `--surface-hover`, `--surface-selected`, `--surface-chip`
- `--border-hairline`, `--border-subtle`, `--border-default`, `--border-strong`, `--border-primary`, `--border-focus`, `--border-info`, `--border-success`, `--border-warning`, `--border-danger`
- `--text-primary`, `--text-strong`, `--text-muted`, `--text-soft`, `--text-on-primary`, `--text-link`
- `--status-info-bg`, `--status-info-text`, `--status-success-bg`, `--status-success-text`, `--status-warning-bg`, `--status-warning-text`, `--status-danger-bg`, `--status-danger-text`
- `--shadow-panel`, `--shadow-panel-soft`, `--shadow-glow`, `--shadow-inset`, `--shadow-soft`
- `--space-page-y`, `--space-page-x`, `--space-panel`, `--space-subcard`
- `--gradient-panel`, `--gradient-panel-strong`, `--gradient-subcard`, `--gradient-input`, `--gradient-primary-button`, `--gradient-secondary-button`, `--gradient-secondary-button-active`

`design-tokens.ts` bu silmeyi destekleyecek şekilde tamamen yeni token'lara map edilir:

```typescript
export const designTokens = {
  color: {
    background: { canvas: 'var(--surface-2)', input: 'var(--surface-2)', ... },
    foreground: { text: 'var(--ink-1)', muted: 'var(--ink-2)', ... },
    interactive: { primary: 'var(--accent)', secondary: 'var(--surface-2)', ... },
    status: {
      // status renkleri için doğrudan --status, --warn, --error kullanılır
      info: 'var(--status)',
      warning: 'var(--warn)',
      danger: 'var(--error)',
    },
  },
  motion: {
    duration: { fast: 'var(--duration-fast)', normal: 'var(--duration-normal)' },
    easing: { standard: 'var(--ease-standard)' },
  },
  radius: { panel: 'var(--radius-panel)', input: 'var(--radius-input)', pill: 'var(--radius-pill)' },
  shadow: { panel: 'var(--shadow)' },
  spacing: { /* clamp helper'lar inline veya yeni token'lar */ },
};
```

### 2.9 Type scale deduplication

**Dosya:** `apps/web/src/styles/tokens.css`

PR-1'de geriye uyumluluk için bırakılan duplicate type token'lar (`--text-base`, `--text-3xl`, `--text-4xl`) silinir. Tüm `apps/web/src` tarama:

| Duplicate | Yenisi |
|---|---|
| `var(--text-base)` (14px) | `var(--text-md)` (14.5px) |
| `var(--text-3xl)` (36px) | `var(--text-2xl)` (32px) |
| `var(--text-4xl)` (44px) | manuel inline `font-size: 44px` (eğer gerçekten kullanılıyorsa, bu PR'da hero'lara özel) |

---

## 3. Kapsam dışı

- ❌ iOS visualViewport hook → PR-8'de.
- ❌ Lighthouse a11y skor optimizasyonları → PR-8'de.
- ❌ `prefers-reduced-motion` audit → PR-8'de.
- ❌ Final design language documentation update → PR-8 sonrası.

---

## 4. Kabul Kriteri

### 4.1 Otomatik

- [ ] `lint + typecheck + test + build` PASS
- [ ] `apps/web/src/styles/routes/*-migration.css` dosyaları **0 dosya** (`ls` boş)
- [ ] `apps/web/src` içinde `import.*migration.css` referansı **0**
- [ ] `apps/web/src` içinde `var(--page-background)`, `var(--gradient-panel)`, `var(--surface-canvas)`, `var(--border-subtle)` referansı **0**
- [ ] `apps/web/src` içinde `var(--text-base)`, `var(--text-3xl)`, `var(--text-4xl)` referansı **0**
- [ ] Stop button abort path'i e2e test PASS

### 4.2 Lock test güncellemesi

- `Theme` type union'ında `'ember-dark' | 'ember-light' | 'rose-dark' | 'system'` var.
- `ChatComposerSurface.tsx` içinde `Square` ikonu import edilmiş (stop ikonu).
- `useChatRuntime.ts` `abortCurrentRun` export ediyor.
- `apps/web/src/styles/tokens.css` içinde legacy token isimleri (`--page-background`, vb.) **yok**.

### 4.3 Görsel kanıt

`docs/design-audit/screenshots/2026-05-XX-ui-restructure-pr-7-settings-stop/`:

- [ ] `desktop-1440-settings-account.png` — Hesap tab
- [ ] `desktop-1440-settings-appearance.png` — Görünüm tab + theme picker
- [ ] `desktop-1440-settings-workspace.png` — Çalışma tab
- [ ] `desktop-1440-theme-picker-ember-light-selected.png` — Light tema seçili
- [ ] `desktop-1440-chat-running-stop-button.png` — Çalışma sırasında stop butonu görünür
- [ ] `desktop-1440-chat-cancelled.png` — Stop sonrası "Çalışma durduruldu"
- [ ] `mobile-390-settings-appearance.png` — Mobil
- [ ] `mobile-390-chat-running-stop.png` — Mobil stop

### 4.4 İnsan-review

- [ ] Tema değişimi anında uygulanır (reload gerektirmez).
- [ ] `system` tema seçildiğinde OS prefers-color-scheme takip edilir.
- [ ] Composer çalışma sırasında butonu `↑` → `■` döner; tıklayınca abort.
- [ ] "Gelişmiş görünüm" toggle açıkken developer yüzeyleri görünür.
- [ ] `*-migration.css` dosyaları **hiçbir** import'ta yok.

### 4.5 Performans

- [ ] Lighthouse Performance ≥85.
- [ ] CSS bundle boyutu PR-6 baseline'ından ≤%10 büyük (cleanup sonrası önerilen: küçük).

---

## 5. Risk ve geri-alma

| Risk | Etki | Mitigation |
|---|---|---|
| Migration CSS taşıma sırasında stil kaybı | Yüksek | Her route için screenshot diff test; pixel diff ≤2%. |
| Theme picker `system` modu prefers-color-scheme listener hatalı | Orta | Birim test ile mock matchMedia. |
| Abort handler server'da yoksa client orphan run state'i taşır | Yüksek | Server `cancel_run` handler PR-7'de eklenir veya doğrulanır. |
| Legacy token silme bir component'ı bozar | Yüksek | Tarama önce, fix sonra; CI'da grep guard. |

**Geri-alma:** Migration CSS cleanup ayrı commit; revert kolay. Theme picker yeni komponent, geri-alma izole.

---

## 6. Komutlar

```bash
git worktree add .claude/worktrees/runa-ui-pr-7-settings-stop codex/ui-restructure-pr-7-settings-stop
cd .claude/worktrees/runa-ui-pr-7-settings-stop
pnpm install
pnpm --filter @runa/web dev

# Migration cleanup verification
find apps/web/src/styles/routes -name "*-migration.css" -type f || echo "PASS: no migration files"
grep -rE "import.*migration\\.css" apps/web/src || echo "PASS: no migration imports"
grep -rE "var\\(--(page-background|gradient-panel|surface-canvas|border-subtle|text-base|text-3xl|text-4xl)\\)" apps/web/src || echo "PASS"

# Server cancel handler check
grep -n "cancel_run" apps/server/src/ws/run-execution.ts

pnpm --filter @runa/web lint
pnpm --filter @runa/web typecheck
pnpm --filter @runa/web test
pnpm --filter @runa/web build
```

---

> Bu PR PR-1 ve PR-2'de ertelenen iki büyük teknik borcu (legacy token alias + migration CSS) kapatır. Diff büyüklüğü ortalama olabilir; gerekirse PR-7a (settings + stop) ve PR-7b (cleanup) olarak ikiye bölünebilir.
