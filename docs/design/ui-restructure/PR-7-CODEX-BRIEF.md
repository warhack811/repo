# PR-7 Codex Brief â€” Settings, Advanced View, Theme Picker, Stop Button, Migration Cleanup

> **Tarih:** 2026-05-13
> **Branch:** `codex/ui-restructure-pr-7-settings-stop`
> **Worktree:** `.claude/worktrees/runa-ui-pr-7-settings-stop`
> **Authority:** `docs/design/RUNA-DESIGN-BRIEF.md` v1.1
> **BaÄŸÄ±mlÄ±lÄ±k:** PR-6 merge edilmiÅŸ olmalÄ±.
> **Hedef:** Settings sayfasÄ±nÄ± yeniden Ã§iz, theme picker'Ä± ekle, Developer Mode â†’ "GeliÅŸmiÅŸ gÃ¶rÃ¼nÃ¼m" rebrand'i yap, composer Send â†’ Stop dÃ¶nÃ¼ÅŸÃ¼mÃ¼nÃ¼ implement et, PR-2'de ertelenen migration CSS cleanup'Ä± tamamla.

---

## 1. Tek cÃ¼mle hedef

Bu PR'dan sonra Settings sayfasÄ± 3 tab (Hesap, GÃ¶rÃ¼nÃ¼m, Ã‡alÄ±ÅŸma) ile Ã§alÄ±ÅŸÄ±r, tema deÄŸiÅŸimi anlÄ±k, `*-migration.css` dosyalarÄ± tamamen temizlenir, composer butonu Ã§alÄ±ÅŸma sÄ±rasÄ±nda Stop'a dÃ¶ner ve agent abort'u tek tÄ±kla Ã§alÄ±ÅŸÄ±r.

---

## 2. Kapsam â€” YapÄ±lacaklar

### 2.1 SettingsPage yeniden yazÄ±mÄ±

**Dosya:** `apps/web/src/pages/SettingsPage.tsx`

Mevcut 2 tab (Hesap, Tercihler) â†’ 3 tab:
- **Hesap** â€” profile, oturum, Ã§Ä±kÄ±ÅŸ (mevcut korunur)
- **GÃ¶rÃ¼nÃ¼m** â€” tema seÃ§ici, tipografi tercihi, geliÅŸmiÅŸ gÃ¶rÃ¼nÃ¼m toggle
- **Ã‡alÄ±ÅŸma** â€” workspace directory, approval mode, voice, runtime tercihleri

```tsx
const tabs: readonly { id: SettingsTab; label: string }[] = [
  { id: 'account', label: 'Hesap' },
  { id: 'appearance', label: 'GÃ¶rÃ¼nÃ¼m' },
  { id: 'workspace', label: 'Ã‡alÄ±ÅŸma' },
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

`apps/web/src/lib/theme.ts` zaten `Theme` type'Ä± export ediyor; bu PR'da yeni tema ID'lerini destekleyecek ÅŸekilde geniÅŸletilir:

```typescript
export type Theme = 'ember-dark' | 'ember-light' | 'rose-dark' | 'system';
```

Tema deÄŸiÅŸimi: `<html data-theme="...">` set edilir. `system` durumunda `prefers-color-scheme` listener'Ä± `ember-dark` / `ember-light` arasÄ±nda geÃ§iÅŸ yapar.

`localStorage` key: `runa.settings.theme`.

### 2.3 "GeliÅŸmiÅŸ gÃ¶rÃ¼nÃ¼m" toggle

**Dosya:** `apps/web/src/hooks/useDeveloperMode.ts` (mevcut)

Hook adÄ± korunur (internal), ama UI'da gÃ¶rÃ¼nen label "GeliÅŸmiÅŸ gÃ¶rÃ¼nÃ¼m". Settings â†’ GÃ¶rÃ¼nÃ¼m tab'inde:

```tsx
<RunaToggle
  label="GeliÅŸmiÅŸ gÃ¶rÃ¼nÃ¼m"
  description="Tool detaylarÄ±, hata kodlarÄ±, run id ve diÄŸer teknik bilgileri sohbet iÃ§inde gÃ¶ster."
  checked={isDeveloperMode}
  onChange={setDeveloperMode}
/>
```

`uiCopy.developer.*` string'leri `uiCopy.advancedView.*` olarak rename edilir (geriye uyumlu alias bÄ±rakÄ±lÄ±r, eski tÃ¼keticiler Ã§alÄ±ÅŸÄ±r).

### 2.4 Composer Send â†’ Stop dÃ¶nÃ¼ÅŸÃ¼mÃ¼

**Dosya:** `apps/web/src/components/chat/ChatComposerSurface.tsx`

Submit butonu durum-aware:

```tsx
const isRunning = isSubmitting || connectionState.activeRunId !== null;

<button
  type={isRunning ? 'button' : 'submit'}
  className={cx(styles.submitButton, isRunning && styles.submitButtonStop)}
  onClick={isRunning ? onAbortRun : undefined}
  disabled={!isRunning && !canSubmit}
  aria-label={isRunning ? 'Ã‡alÄ±ÅŸmayÄ± durdur' : 'Mesaj gÃ¶nder'}
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
  // WebSocket cancel mesajÄ± gÃ¶nder
  websocket.send(JSON.stringify({ type: 'cancel_run', run_id: activeRunId }));
  // Local state'i optimistik gÃ¼ncelle
  store.dispatch({ type: 'run_cancellation_requested', run_id: activeRunId });
}
```

`UseChatRuntimeResult` interface'i `abortCurrentRun: () => void` export eder. ChatPage prop chain'i ChatComposerSurface'e iletir.

Server'da mevcut `cancel-run` WebSocket message handler kullanÄ±lÄ±r; yeni endpoint gerekmez. Server kontratÄ±nÄ± doÄŸrula:
- `apps/server/src/ws/run-execution.ts` iÃ§inde `cancel_run` mesajÄ±nÄ±n handle edildiÄŸine emin ol.
- Yoksa minimal handler ekle: aktif run'Ä± abort eder, "Ã‡alÄ±ÅŸma durduruldu" mesajÄ± yayar.

### 2.6 "Ã‡alÄ±ÅŸma durduruldu" tek-satÄ±r feedback

Run abort sonrasÄ± sohbet'e tek satÄ±r eklenir:

```
[â€¢] Ã‡alÄ±ÅŸma durduruldu
```

`PresentationRunSurfaceCard` veya benzeri iÃ§inde, status `cancelled` durumunda inline rendering.

### 2.7 Migration CSS cleanup (PR-2'den ertelenmiÅŸti)

**Dosyalar (tÃ¼m `apps/web/src/styles/routes/*-migration.css`):**

- `app-shell-migration.css`
- `capability-migration.css`
- `chat-migration.css`
- `desktop-device-presence-migration.css`
- `developer-migration.css`
- `devices-migration.css`
- `history-migration.css`
- `login-migration.css`
- `settings-migration.css`

Her dosyanÄ±n iÃ§eriÄŸi:
1. AnlamlÄ± kurallar `components.css` veya ilgili `.module.css` dosyasÄ±na taÅŸÄ±nÄ±r.
2. `runa-migrated-components-*-N` boÅŸ `data-*` style sÄ±nÄ±flarÄ± silinir.
3. Migration dosyasÄ±nÄ±n kendisi silinir.
4. Ä°lgili sayfa/komponent'lerdeki `import '../styles/routes/*-migration.css'` satÄ±rlarÄ± kaldÄ±rÄ±lÄ±r.

**Test:** Bu iÅŸlemden sonra her route'un gÃ¶rsel snapshot'Ä± PR-1/PR-2/PR-3 sonrasÄ± baseline ile karÅŸÄ±laÅŸtÄ±rÄ±lÄ±r; **pixel diff â‰¤2%**.

### 2.8 Legacy token alias temizliÄŸi (PR-1'den ertelenmiÅŸti)

**Dosya:** `apps/web/src/styles/tokens.css`

PR-1'de alias forward olarak bÄ±rakÄ±lan eski token'lar silinir:
- `--page-background`, `--surface-canvas`, `--surface-panel`, `--surface-panel-strong`, `--surface-panel-muted`, `--surface-subtle`, `--surface-input`, `--surface-hover`, `--surface-selected`, `--surface-chip`
- `--border-hairline`, `--border-subtle`, `--border-default`, `--border-strong`, `--border-primary`, `--border-focus`, `--border-info`, `--border-success`, `--border-warning`, `--border-danger`
- `--text-primary`, `--text-strong`, `--text-muted`, `--text-soft`, `--text-on-primary`, `--text-link`
- `--status-info-bg`, `--status-info-text`, `--status-success-bg`, `--status-success-text`, `--status-warning-bg`, `--status-warning-text`, `--status-danger-bg`, `--status-danger-text`
- `--shadow-panel`, `--shadow-panel-soft`, `--shadow-glow`, `--shadow-inset`, `--shadow-soft`
- `--space-page-y`, `--space-page-x`, `--space-panel`, `--space-subcard`
- `--gradient-panel`, `--gradient-panel-strong`, `--gradient-subcard`, `--gradient-input`, `--gradient-primary-button`, `--gradient-secondary-button`, `--gradient-secondary-button-active`

`design-tokens.ts` bu silmeyi destekleyecek ÅŸekilde tamamen yeni token'lara map edilir:

```typescript
export const designTokens = {
  color: {
    background: { canvas: 'var(--surface-2)', input: 'var(--surface-2)', ... },
    foreground: { text: 'var(--ink-1)', muted: 'var(--ink-2)', ... },
    interactive: { primary: 'var(--accent)', secondary: 'var(--surface-2)', ... },
    status: {
      // status renkleri iÃ§in doÄŸrudan --status, --warn, --error kullanÄ±lÄ±r
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

PR-1'de geriye uyumluluk iÃ§in bÄ±rakÄ±lan duplicate type token'lar (`--text-base`, `--text-3xl`, `--text-4xl`) silinir. TÃ¼m `apps/web/src` tarama:

| Duplicate | Yenisi |
|---|---|
| `var(--text-base)` (14px) | `var(--text-md)` (14.5px) |
| `var(--text-3xl)` (36px) | `var(--text-2xl)` (32px) |
| `var(--text-4xl)` (44px) | manuel inline `font-size: 44px` (eÄŸer gerÃ§ekten kullanÄ±lÄ±yorsa, bu PR'da hero'lara Ã¶zel) |

---

## 3. Kapsam dÄ±ÅŸÄ±

- âŒ iOS visualViewport hook â†’ PR-8'de.
- âŒ Lighthouse a11y skor optimizasyonlarÄ± â†’ PR-8'de.
- âŒ `prefers-reduced-motion` audit â†’ PR-8'de.
- âŒ Final design language documentation update â†’ PR-8 sonrasÄ±.

---

## 4. Kabul Kriteri

### 4.1 Otomatik

- [ ] `lint + typecheck + test + build` PASS
- [ ] `apps/web/src/styles/routes/*-migration.css` dosyalarÄ± **0 dosya** (`ls` boÅŸ)
- [ ] `apps/web/src` iÃ§inde `import.*migration.css` referansÄ± **0**
- [ ] `apps/web/src` iÃ§inde `var(--page-background)`, `var(--gradient-panel)`, `var(--surface-canvas)`, `var(--border-subtle)` referansÄ± **0**
- [ ] `apps/web/src` iÃ§inde `var(--text-base)`, `var(--text-3xl)`, `var(--text-4xl)` referansÄ± **0**
- [ ] Stop button abort path'i e2e test PASS

### 4.2 Lock test gÃ¼ncellemesi

- `Theme` type union'Ä±nda `'ember-dark' | 'ember-light' | 'rose-dark' | 'system'` var.
- `ChatComposerSurface.tsx` iÃ§inde `Square` ikonu import edilmiÅŸ (stop ikonu).
- `useChatRuntime.ts` `abortCurrentRun` export ediyor.
- `apps/web/src/styles/tokens.css` iÃ§inde legacy token isimleri (`--page-background`, vb.) **yok**.

### 4.3 GÃ¶rsel kanÄ±t

`docs/design-audit/screenshots/`:

- [ ] `desktop-1440-settings-account.png` â€” Hesap tab
- [ ] `desktop-1440-settings-appearance.png` â€” GÃ¶rÃ¼nÃ¼m tab + theme picker
- [ ] `desktop-1440-settings-workspace.png` â€” Ã‡alÄ±ÅŸma tab
- [ ] `desktop-1440-theme-picker-ember-light-selected.png` â€” Light tema seÃ§ili
- [ ] `desktop-1440-chat-running-stop-button.png` â€” Ã‡alÄ±ÅŸma sÄ±rasÄ±nda stop butonu gÃ¶rÃ¼nÃ¼r
- [ ] `desktop-1440-chat-cancelled.png` â€” Stop sonrasÄ± "Ã‡alÄ±ÅŸma durduruldu"
- [ ] `mobile-390-settings-appearance.png` â€” Mobil
- [ ] `mobile-390-chat-running-stop.png` â€” Mobil stop

### 4.4 Ä°nsan-review

- [ ] Tema deÄŸiÅŸimi anÄ±nda uygulanÄ±r (reload gerektirmez).
- [ ] `system` tema seÃ§ildiÄŸinde OS prefers-color-scheme takip edilir.
- [ ] Composer Ã§alÄ±ÅŸma sÄ±rasÄ±nda butonu `â†‘` â†’ `â– ` dÃ¶ner; tÄ±klayÄ±nca abort.
- [ ] "GeliÅŸmiÅŸ gÃ¶rÃ¼nÃ¼m" toggle aÃ§Ä±kken developer yÃ¼zeyleri gÃ¶rÃ¼nÃ¼r.
- [ ] `*-migration.css` dosyalarÄ± **hiÃ§bir** import'ta yok.

### 4.5 Performans

- [ ] Lighthouse Performance â‰¥85.
- [ ] CSS bundle boyutu PR-6 baseline'Ä±ndan â‰¤%10 bÃ¼yÃ¼k (cleanup sonrasÄ± Ã¶nerilen: kÃ¼Ã§Ã¼k).

---

## 5. Risk ve geri-alma

| Risk | Etki | Mitigation |
|---|---|---|
| Migration CSS taÅŸÄ±ma sÄ±rasÄ±nda stil kaybÄ± | YÃ¼ksek | Her route iÃ§in screenshot diff test; pixel diff â‰¤2%. |
| Theme picker `system` modu prefers-color-scheme listener hatalÄ± | Orta | Birim test ile mock matchMedia. |
| Abort handler server'da yoksa client orphan run state'i taÅŸÄ±r | YÃ¼ksek | Server `cancel_run` handler PR-7'de eklenir veya doÄŸrulanÄ±r. |
| Legacy token silme bir component'Ä± bozar | YÃ¼ksek | Tarama Ã¶nce, fix sonra; CI'da grep guard. |

**Geri-alma:** Migration CSS cleanup ayrÄ± commit; revert kolay. Theme picker yeni komponent, geri-alma izole.

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

> Bu PR PR-1 ve PR-2'de ertelenen iki bÃ¼yÃ¼k teknik borcu (legacy token alias + migration CSS) kapatÄ±r. Diff bÃ¼yÃ¼klÃ¼ÄŸÃ¼ ortalama olabilir; gerekirse PR-7a (settings + stop) ve PR-7b (cleanup) olarak ikiye bÃ¶lÃ¼nebilir.


