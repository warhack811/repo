# PR-12 Codex Brief — Final Polish: Lock Test Coverage, Settings Kararı, Doğrulama Kanıtları, Ölü Kod Temizliği

> **Tarih:** 2026-05-14
> **Branch:** `codex/ui-restructure-pr-12-final-polish`
> **Worktree:** `.claude/worktrees/runa-ui-pr-12-final-polish`
> **Authority:** `docs/RUNA-DESIGN-LANGUAGE.md` + `docs/design/RUNA-DESIGN-BRIEF.md` v1.2 + `docs/design/ui-restructure/PR-10-GAP-AUDIT-REPORT.md`
> **Bağımlılık:** PR-9 ve PR-11 merge edilmiş olmalı.
> **Hedef:** PR-10 audit raporunun "BOŞ KANIT" ve "KISMEN" maddelerini kapat; lock test'i PR-3..7'yi de kilitleyecek şekilde genişlet; Settings 3-tab vs 5-tab kararını belgele; Lighthouse + screen reader kanıtı üret; ölü CSS sınıflarını sil; PROGRESS.md'yi güncel hâle getir.

---

## 1. Tek cümle hedef

Bu PR'dan sonra UI restructure süreci **gerçek anlamda kapanır**: tüm 8 PR brief'inin kabul kriterleri lock test'le kilitlenmiş, Lighthouse + screen reader kanıtı dosyalanmış, RUNA-DESIGN-LANGUAGE.md ile gerçek Settings IA uyumlu, ölü CSS sıfırlanmış, PROGRESS.md UI restructure süreciyle senkron olur.

---

## 2. Kapsam — Yapılacaklar

### 2.1 Lock test coverage genişletme

**Dosya:** `apps/web/src/test/design-language-lock.test.ts`

Mevcut dosya PR-1, PR-2, PR-8 kurallarını kilitliyor. PR-3, PR-4, PR-5, PR-6, PR-7, PR-9 assertion'ları ekle:

#### PR-3 (Chat Surface)
```ts
describe('PR-3 chat surface lock', () => {
  it('PersistedTranscript icinde rol etiketi veya saniye-tarihli timestamp yok', async () => {
    const src = await fs.readFile('apps/web/src/components/chat/PersistedTranscript.tsx', 'utf8');
    expect(src).not.toMatch(/['"]Sen['"]|['"]Runa['"]/);
    expect(src).not.toMatch(/toLocaleTimeString|formatDate.*Long/);
  });

  it('CurrentRunSurface currentRunProgressPanel prop tanimlamiyor', async () => {
    const src = await fs.readFile('apps/web/src/components/chat/CurrentRunSurface.tsx', 'utf8');
    expect(src).not.toMatch(/currentRunProgressPanel\s*[:?]/);
  });

  it('ToolResultBlock user-facing modda toolLine details kullaniyor', async () => {
    const src = await fs.readFile('apps/web/src/components/chat/blocks/ToolResultBlock.tsx', 'utf8');
    expect(src).toMatch(/toolLine/);
    expect(src).not.toMatch(/['"]Islem sonucu['"]/);  // eski eyebrow
  });

  it('DayDivider export ediliyor', async () => {
    const path = 'apps/web/src/components/chat/DayDivider.tsx';
    await expect(fs.access(path)).resolves.toBeUndefined();
  });
});
```

#### PR-4 (Approval Calm)
```ts
describe('PR-4 approval calm lock', () => {
  it('ApprovalBlock eyebrow/approvalStatusChip/approvalStateFeedback render etmiyor', async () => {
    const src = await fs.readFile('apps/web/src/components/chat/blocks/ApprovalBlock.tsx', 'utf8');
    expect(src).not.toMatch(/approvalStatusChip|approvalStateFeedback/);
    expect(src).not.toMatch(/className=\{[^}]*eyebrow[^}]*\}/);
  });

  it('approvalRisk modul ApprovalRiskLevel ve getApprovalRiskLevel export ediyor', async () => {
    const mod = await import('../components/chat/blocks/approvalRisk.js');
    expect(typeof mod.getApprovalRiskLevel).toBe('function');
  });

  it('RunaButton danger variant tanimi var', async () => {
    const src = await fs.readFile('apps/web/src/components/ui/RunaButton.tsx', 'utf8');
    expect(src).toMatch(/['"]danger['"]/);
  });
});
```

#### PR-5 (Errors + user_label_tr)
```ts
describe('PR-5 user_label_tr lock', () => {
  it('Frontend tool result render`inde user_label_tr okunuyor', async () => {
    const src = await fs.readFile('apps/web/src/components/chat/blocks/ToolResultBlock.tsx', 'utf8');
    expect(src).toMatch(/user_label_tr/);
  });

  it('RunTimelineBlock user_label_tr fallback kullaniyor', async () => {
    const src = await fs.readFile('apps/web/src/components/chat/blocks/RunTimelineBlock.tsx', 'utf8');
    expect(src).toMatch(/user_label_tr\s*\?\?/);
  });
});
```

#### PR-6 (Sheets + Palette)
```ts
describe('PR-6 sheets + palette lock', () => {
  it('RunaSheet ve RunaModal export var', async () => {
    const mod = await import('../components/ui/index.js');
    expect(mod.RunaSheet).toBeTruthy();
    expect(mod.RunaModal).toBeTruthy();
  });

  it('ChatHeader history sheet aria-controls`a sahip', async () => {
    const src = await fs.readFile('apps/web/src/components/chat/ChatHeader.tsx', 'utf8');
    expect(src).toMatch(/aria-controls=['"]history-sheet['"]/);
  });

  it('ChatPage HistorySheet/MenuSheet/ContextSheet mount ediyor', async () => {
    const src = await fs.readFile('apps/web/src/pages/ChatPage.tsx', 'utf8');
    expect(src).toMatch(/<HistorySheet\b/);
    expect(src).toMatch(/<MenuSheet\b/);
    expect(src).toMatch(/<ContextSheet\b/);
  });
});
```

#### PR-7 (Settings + Stop)
```ts
describe('PR-7 settings + stop lock', () => {
  it('Composer Stop ikonu (Square) ve aria-label icin destegi var', async () => {
    const src = await fs.readFile('apps/web/src/components/chat/ChatComposerSurface.tsx', 'utf8');
    expect(src).toMatch(/import\s*\{[^}]*\bSquare\b[^}]*\}\s*from\s*['"]lucide-react['"]/);
    expect(src).toMatch(/Calismayi durdur|abortCurrentRun/);
  });

  it('useChatRuntime abortCurrentRun export ediyor', async () => {
    const src = await fs.readFile('apps/web/src/hooks/useChatRuntime.ts', 'utf8');
    expect(src).toMatch(/abortCurrentRun\s*[:,]/);
  });

  it('ThemePicker komponenti var', async () => {
    const path = 'apps/web/src/components/settings/ThemePicker.tsx';
    await expect(fs.access(path)).resolves.toBeUndefined();
  });

  it('apps/web/src/styles/routes altinda migration.css dosyasi yok', async () => {
    const dir = await fs.readdir('apps/web/src/styles/routes');
    const offenders = dir.filter((f) => f.endsWith('-migration.css'));
    expect(offenders).toEqual([]);
  });
});
```

#### PR-9 (Token cleanup)
```ts
describe('PR-9 token cleanup lock', () => {
  it('apps/web/src/styles/tokens.css icinde --ink-4 tanimi var', async () => {
    const src = await fs.readFile('apps/web/src/styles/tokens.css', 'utf8');
    expect(src).toMatch(/--ink-4\s*:/);
  });

  it('Tanimsiz token referansi yok (audit-tokens.mjs PASS)', async () => {
    const { spawnSync } = await import('node:child_process');
    const result = spawnSync('node', ['scripts/audit-tokens.mjs'], { encoding: 'utf8' });
    expect(result.status, result.stderr || result.stdout).toBe(0);
  });
});
```

### 2.2 Settings 3-tab vs 5-tab Kararı

**Mevcut durum:** `apps/web/src/pages/SettingsPage.tsx:72-76` — 5 tab: `appearance`, `conversation`, `notifications`, `privacy`, `advanced`.

**PR-7 brief:** 3 tab: `Hesap`, `Görünüm`, `Çalışma`.

**Karar (kullanıcı onayı sonrası — eğer Codex'in bu bilgisi yoksa kullanıcıya sor):**

Plan **5 tab kabul edilir** çünkü:
- `notifications` ve `privacy` Hesap tab'ında alt bölüm olarak sığmıyordu
- `advanced` ayrı tab olmadığında "Gelişmiş görünüm" Görünüm sekmesiyle çakışıyordu

**Yapılacak:**

1. **`docs/RUNA-DESIGN-LANGUAGE.md`'ye yeni bölüm ekle:**

```md
## Settings Information Architecture

Settings 5 tab altında düzenlenir:
- **appearance** — Tema, renk paleti, tipografi
- **conversation** — Onay modu, ses tercihleri, runtime
- **notifications** — Dil, sessiz saatler, veri saklama
- **privacy** — Aktif kök, çalışma klasörü, klasör yenileme
- **advanced** — Gelişmiş görünüm, geliştirici opsiyonları

PR-7 brief'inde belirtilen 3-tab planı 5-tab'a genişletildi; bu IA RUNA-DESIGN-LANGUAGE'in tek otorite kaynağıdır.
```

2. **PR-7 brief'ine notu (history-preserving) ekle:**

`docs/design/ui-restructure/PR-7-CODEX-BRIEF.md` sonuna ek:

```md
---

## 8. PR-7 sonrası karar — Settings IA güncellemesi (2026-05-14)

PR-7 uygulanırken Settings için 3 yerine 5 tab tercih edildi (`appearance`, `conversation`,
`notifications`, `privacy`, `advanced`). Bu karar `docs/RUNA-DESIGN-LANGUAGE.md` "Settings
Information Architecture" bölümünde otorite hâlinde tutulur.
```

3. **Lock test'e Settings tab kontrolü ekle:**

```ts
it('SettingsPage 5 tab gosteriyor', async () => {
  const src = await fs.readFile('apps/web/src/pages/SettingsPage.tsx', 'utf8');
  for (const tab of ['appearance', 'conversation', 'notifications', 'privacy', 'advanced']) {
    expect(src).toContain(`'${tab}'`);
  }
});
```

### 2.3 Lighthouse koşumu — PR-8 boş kanıtı kapat

**Komut akışı:**

```bash
pnpm --filter @runa/web build
pnpm --filter @runa/web preview &
PREVIEW_PID=$!
sleep 3  # vite preview ısınması; daha temizi `wait-on http://localhost:4173`

npx lighthouse http://localhost:4173 \
  --preset=desktop \
  --output=json --output=html \
  --output-path=./docs/design-audit/screenshots/2026-05-14-ui-restructure-pr-12-final-polish/lighthouse-desktop \
  --quiet --chrome-flags="--headless"

npx lighthouse http://localhost:4173 \
  --preset=mobile \
  --output=json --output=html \
  --output-path=./docs/design-audit/screenshots/2026-05-14-ui-restructure-pr-12-final-polish/lighthouse-mobile \
  --quiet --chrome-flags="--headless"

kill $PREVIEW_PID
```

**Kayıt yeri:** `docs/design-audit/screenshots/2026-05-14-ui-restructure-pr-12-final-polish/lighthouse-{desktop,mobile}.{json,html}`.

**Hedef skorlar (PR-8 brief Bölüm 2.6):**
- Performance ≥85 (mobile)
- Accessibility ≥95
- Best Practices ≥90

**Eğer skor düşerse:** Düzeltme bu PR'ın değil; Codex sadece **kanıt üretir** ve raporlar. Düşük skor varsa PR description'da açık olarak yazar; PR yine merge edilir, eksiklik bilinçli kabul edilir.

### 2.4 Screen reader doğrulama notu

**Yeni dosya:** `docs/design-audit/screenshots/2026-05-14-ui-restructure-pr-12-final-polish/screen-reader-checklist.md`

Codex bir gerçek screen reader (NVDA/VoiceOver) koşumu yapamaz. Onun yerine **statik kontrol listesi** üretir:

```md
# Screen Reader Erişilebilirlik Kontrol Listesi

> Bu dosya, kullanıcının/QA'in manuel NVDA + VoiceOver koşumu için checklist'tir.
> Codex bu kanıtı **manuel** koşumdan sonra doldurur (PR'a kullanıcı onayı bekler).

## Otomatik kontroller (Codex doldurdu)

- [ ] SkipToContent component'i AppShell'in ilk öğesi (`apps/web/src/components/app/AppShell.tsx:LINE`)
- [ ] Tüm interaktif öğelerde `aria-label` veya text content var (grep sonucu eklenir)
- [ ] `<main role="main">` her route'ta tek (grep sonucu eklenir)
- [ ] `<nav aria-label="...">` AppSidebar'da tanımlı
- [ ] Heading hiyerarşi: her route'ta tek `<h1>` (grep sonucu eklenir)
- [ ] Image alt text: tüm `<img>` ve `<svg role="img">` (grep sonucu eklenir)

## Manuel kontroller (kullanıcı dolduracak)

- [ ] NVDA: ChatPage'i aç, agent mesajı oku — okunabilir mi?
- [ ] NVDA: Approval kartı geldiğinde anons ediliyor mu?
- [ ] NVDA: Sheet açıldığında focus trap çalışıyor mu?
- [ ] VoiceOver (macOS): aynı 3 senaryo
- [ ] Klavye-only: Tab ile tüm route'lar erişilebilir mi?
```

Codex otomatik kısmı doldurur; manuel kısım kullanıcıya kalır (kanıt PR onayı için zorunlu **değil**; sonradan tamamlanabilir).

### 2.5 Ölü CSS temizliği — BUG-6 KISMEN durumunu kapat

**Dosya:** `apps/web/src/components/chat/blocks/BlockRenderer.module.css`

Audit raporu (line 391-392): `approvalStatusChip`, `approvalDecision`, `approvalStateFeedback` sınıfları line 324-425'te duruyor, TSX'te kullanılmıyor.

**Doğrulama:** 
```bash
grep -rn "approvalStatusChip\|approvalDecision\|approvalStateFeedback" apps/web/src --include="*.tsx" --include="*.ts"
```

Sonuç 0 olmalı. Olduğunu doğrula, sonra CSS'ten 324-425 aralığını sil.

**Diğer ölü CSS adayları:** Aynı yöntemi `BlockRenderer.module.css`, `PersistedTranscript.module.css`, `components.css` dosyalarında uygula:

```bash
# Bir class tanımı var ama TSX/TS'te kullanım yok
# Codex bir küçük script yazar:
node scripts/audit-dead-css.mjs
```

**Yeni dosya:** `scripts/audit-dead-css.mjs`

CSS Modules class adlarını topla, `.tsx`/`.ts` dosyalarında `styles['X']` veya `styles.X` kullanımını ara. Eşleşmeyen class'ları "dead" olarak listele. Sadece **rapor üretir**; otomatik silmez (false positive riski).

Listede 5'ten az aday varsa Codex elle siler; daha fazlaysa raporu PR description'a koyar, manuel review ister.

### 2.6 6 Route'ta Loading State eksiği

**Audit notu:** `CapabilityPreviewPage.tsx`, `ChatRuntimePage.tsx`, `DeveloperPage.tsx`, `DeveloperRuntimePage.tsx`, `HistoryRoute.tsx`, `NotificationsPage.tsx` loading paterni yok.

**Yapılacak (kapsam minimal — PR-12 final polish):**

Her route'ta data fetching var mı kontrol et. Eğer fetching varsa **basit `Skeleton` veya `RunaSpinner` ekle**. Fetching yoksa (statik route), bu maddeyi atla; PR description'a not düş ("X route'unda fetching yok, skeleton gereksiz").

**Yeni komponent (zorunlu değil — eğer hâlâ yoksa):** `apps/web/src/components/ui/RunaSkeleton.tsx`

```tsx
import { cx } from '../../lib/utils.js';
import styles from './RunaSkeleton.module.css';

export function RunaSkeleton({ className, width, height }: {
  className?: string;
  width?: number | string;
  height?: number | string;
}): ReactElement {
  return <div className={cx(styles.skeleton, className)} style={{ width, height }} />;
}
```

CSS: `--surface-3` background, subtle shimmer animation (prefers-reduced-motion uyumlu).

### 2.7 PROGRESS.md Güncellemesi

**Dosya:** `docs/PROGRESS.md`

#### A. "Mevcut Durum Özeti" güncelle (line 7-13):

```md
## Mevcut Durum Ozeti

- **Tarih:** 14 Mayis 2026
- **Faz:** Core Hardening (Phase 2) + UI Restructure tamamlandi (PR-1..PR-12).
- **Vizyon:** Basit kullanicidan teknik uzmana kadar herkesin kullanabilecegi, otonom ve uzaktan kontrol yeteneklerine sahip, cloud-first bir AI calisma ortagi.
- **Odak:** UI restructure kapandi; sirada provider/runtime baseline genisletmesi ve plan-disi UI boşluklari (empty state personalization, markdown rendering).
- **Son Onemli Olay:** 2026-05-14 tarihinde "UI Restructure PR-1..PR-12" sureci basariyla kapatildi; tasarim dili `docs/RUNA-DESIGN-LANGUAGE.md`'de tek otorite olarak kilitlendi, design language lock test PR-1..9 + Settings IA + PR-11 memo discipline'ini kilitliyor, Lighthouse + screen reader kanitlari arsivlendi.
```

#### B. PR-3..PR-9, PR-11, PR-12 için ayrı kayıtlar ekle (toplu kapanış yerine detaylı tarihçe):

PR-3'ten PR-12'ye kadar her PR için **2026-05-14 tarihli** kayıt düş. Her kayıt şu format:

```md
### TASK-UI-RESTRUCTURE-PR-N-<kebab-baslik> - 14 Mayis 2026

- Kapsam: <PR-N brief'inin 1. bolumu ozeti>
- Uygulama: <yapilan ana degisiklikler, dosya seviyesinde 2-3 cumle>
- Lock/guard: <eklenen lock test assertion'lari>
- Gorsel kanit: `docs/design-audit/screenshots/2026-05-XX-ui-restructure-pr-N-*/`
- Dogrulama: `lint/typecheck/test/build` PASS; ek (lighthouse, e2e) varsa not.
- Kalan not: <varsa>
```

Codex her PR'ın brief'ini açıp özet çıkarır. Kayıt sırası: PR-3, PR-4 (paralel PR-5), PR-5, PR-6, PR-7, PR-8, PR-9, PR-11, PR-12.

#### C. Final `TASK-UI-RESTRUCTURE-COMPLETE-2026-05-14` kaydı:

Mevcut bir entry varsa **güncellenir**; yoksa eklenir:

```md
### TASK-UI-RESTRUCTURE-COMPLETE - 14 Mayis 2026

- 12 PR ile UI restructure suresi kapandi.
- Brief'lerin tamami: `docs/design/ui-restructure/PR-1..PR-12-CODEX-BRIEF.md`.
- Tek source of truth: `docs/RUNA-DESIGN-LANGUAGE.md` (Settings IA dahil).
- Audit + gap raporu: `docs/design/ui-restructure/PR-10-GAP-AUDIT-REPORT.md`.
- Lock test: `apps/web/src/test/design-language-lock.test.ts` PR-1..9 + Settings + PR-11 invariants.
- Lighthouse: `docs/design-audit/screenshots/2026-05-14-ui-restructure-pr-12-final-polish/lighthouse-{desktop,mobile}.{json,html}`.
- Screen reader checklist: `docs/design-audit/screenshots/2026-05-14-ui-restructure-pr-12-final-polish/screen-reader-checklist.md`.
- Kalan plan-disi alanlar (ayri sprint): Empty state personalization, markdown rendering kalitesi, voice composer derinlik, loading skeleton parity.
```

### 2.8 INDEX.md kontrolü

`docs/INDEX.md` Codex tarafından doğrulanır. Eğer:
- "Her oturumda okunacaklar" listesinde `RUNA-DESIGN-LANGUAGE.md` yoksa eklenir
- `docs/design/ui-restructure/` arşivi referansı yoksa eklenir

Audit raporuna göre INDEX.md zaten güncel; sadece minor ek olabilir.

---

## 3. Kapsam dışı

- ❌ Yeni feature.
- ❌ BUG-11 dışı performans iyileştirmesi (BUG-11 PR-11'de).
- ❌ Empty state personalization (ayrı PR'da).
- ❌ Markdown rendering custom renderer'lar (ayrı PR'da).
- ❌ Voice composer derinleştirme (ayrı PR'da).
- ❌ Server tarafı değişiklik.
- ❌ Yeni komponent — sadece `RunaSkeleton` (gerekli ise) ve `audit-dead-css.mjs` script'i.
- ❌ Lighthouse skoru düştüğünde düzeltme (sadece kanıt üretilir).

---

## 4. Kabul Kriteri

### 4.1 Otomatik (CI)

- [ ] `pnpm --filter @runa/web lint` PASS
- [ ] `pnpm --filter @runa/web typecheck` PASS
- [ ] `pnpm --filter @runa/web test` PASS (genişletilmiş lock test dahil)
- [ ] `pnpm --filter @runa/web build` PASS
- [ ] `node scripts/audit-tokens.mjs` PASS (PR-9 garantisi)
- [ ] `node scripts/audit-dead-css.mjs` çalışıyor (rapor üretiyor; fail-zorunlu değil)

### 4.2 Lock test minimum coverage

`apps/web/src/test/design-language-lock.test.ts` describe blokları:
- [ ] `PR-1 theme/typography/mark lock`
- [ ] `PR-2 layout shell lock`
- [ ] `PR-3 chat surface lock`
- [ ] `PR-4 approval calm lock`
- [ ] `PR-5 user_label_tr lock`
- [ ] `PR-6 sheets + palette lock`
- [ ] `PR-7 settings + stop lock`
- [ ] `PR-8 a11y + ios + polish lock`
- [ ] `PR-9 token cleanup lock`
- [ ] `Settings IA lock` (5 tab)
- [ ] `PR-11 useChatRuntime memo discipline lock`

Toplam assertion sayısı ≥30.

### 4.3 Kanıt dosyaları

`docs/design-audit/screenshots/2026-05-14-ui-restructure-pr-12-final-polish/`:
- [ ] `lighthouse-desktop.json` + `.html`
- [ ] `lighthouse-mobile.json` + `.html`
- [ ] `screen-reader-checklist.md` (otomatik kısım dolu)
- [ ] `dead-css-report.md` (audit-dead-css.mjs çıktısı)
- [ ] `EVIDENCE-MAP.md` (dosya bazlı özet)

### 4.4 Dokümantasyon

- [ ] `docs/PROGRESS.md` Mevcut Durum Özeti tarihi `14 Mayis 2026`.
- [ ] PR-3..PR-12 için ayrı kayıt eklenmiş.
- [ ] `TASK-UI-RESTRUCTURE-COMPLETE` final entry güncellenmiş.
- [ ] `docs/RUNA-DESIGN-LANGUAGE.md` "Settings Information Architecture" bölümü eklenmiş.
- [ ] `docs/design/ui-restructure/PR-7-CODEX-BRIEF.md` sonuna "Settings IA güncellemesi" notu eklenmiş.

### 4.5 İnsan-review

- [ ] Sohbet sayfasında ölü CSS sonrası görsel regression yok (mevcut ekran görüntüleriyle eyeball karşılaştırma).
- [ ] Settings 5 tab manuel kontrol: her tab açılıyor, içerik var.
- [ ] PROGRESS.md kronolojisi tutarlı.

---

## 5. Risk ve geri-alma

| Risk | Etki | Mitigation |
|---|---|---|
| Lock test çok katı → küçük refactor'lar test bozar | Orta | Assertion'lar yapısal kuralları kilitliyor; iç implementasyon detayını değil. False positive olursa rule daraltılır. |
| Ölü CSS silinince bir edge case'de görsel kaybolur | Orta | Pre-silme grep ile 0 reference doğrulanır + manual review ekranları. |
| Lighthouse skoru ≤eşik → PR'ı engeller mi? | Düşük | Kabul kriterinde "kanıt üret" yazıyor, "eşik tut" değil. Düşük skor PR description'da raporlanır, fix sonraki PR. |
| audit-dead-css.mjs CSS Modules edge case'lerinde false positive | Orta | Script "rapor üretir, otomatik silmez"; manuel silme. |
| PROGRESS.md kayıtları brief özetlerinden çıkarılırken hata yapılır | Düşük | Codex her brief'i okuyup özet çıkarır; kullanıcı PR review'da kontrol eder. |

**Geri-alma:** Tek PR. Çoğu değişiklik dokuman/test (revert güvenli). Ölü CSS silme tek commit olarak ayrılır; gerekirse o commit revert edilir.

---

## 6. Komutlar (Codex)

```bash
cd D:/ai/Runa
git worktree add .claude/worktrees/runa-ui-pr-12-final-polish codex/ui-restructure-pr-12-final-polish
cd .claude/worktrees/runa-ui-pr-12-final-polish
pnpm install

# Lock test koşumu (genişletilmiş)
pnpm --filter @runa/web test -- design-language-lock

# Ölü CSS audit
node scripts/audit-dead-css.mjs

# Lighthouse (PR-8 kabul kriteri kanıtı)
pnpm --filter @runa/web build
pnpm --filter @runa/web preview &  # localhost:4173
sleep 3
mkdir -p docs/design-audit/screenshots/2026-05-14-ui-restructure-pr-12-final-polish
npx lighthouse http://localhost:4173 --preset=desktop \
  --output=json --output=html \
  --output-path=docs/design-audit/screenshots/2026-05-14-ui-restructure-pr-12-final-polish/lighthouse-desktop \
  --quiet --chrome-flags="--headless"
npx lighthouse http://localhost:4173 --preset=mobile \
  --output=json --output=html \
  --output-path=docs/design-audit/screenshots/2026-05-14-ui-restructure-pr-12-final-polish/lighthouse-mobile \
  --quiet --chrome-flags="--headless"

# Full doğrulama
pnpm --filter @runa/web lint
pnpm --filter @runa/web typecheck
pnpm --filter @runa/web test
pnpm --filter @runa/web build
```

---

## 7. Yetki ve disiplin

- Settings 3-tab vs 5-tab kararı bu brief'te 5-tab olarak kabul edildi. Eğer Codex bu kararla aynı fikirde değilse veya başka bir yapı önerecekse **iş başlamadan kullanıcıya sor**.
- Ölü CSS silme öncesi grep sonuçları PR description'a eklenir (her silinen class için 0 reference kanıtı).
- Lighthouse skoru düşükse PR engeli değil; kullanıcıya not düş.
- PROGRESS.md kayıtları için her brief'in 1. bölümü (Tek cümle hedef) ve 4. bölümü (Kabul Kriteri) okunur; daha derin uygulama detayı için git log'a bakılır.
- Tahmin yasak; emin olmayan her madde için iş başlamadan kullanıcıya sor.

---

## 8. PR-12 sonrası

PR-12 merge edildiğinde:

1. UI restructure süreci **gerçek anlamda kapanır.**
2. `docs/RUNA-DESIGN-LANGUAGE.md` tek source of truth, lock test ile korunuyor.
3. PROGRESS.md UI restructure tarihçesi tam ve doğru.
4. Lighthouse + screen reader kanıtı arşivlenmiş.
5. Plan-dışı kalan boşluklar (empty state personalization, markdown rendering, voice composer derinleştirme, loading skeleton parity) **PR-13+ sprint planına** taşınır — bu PR'larda dokunulmaz.

---

> Bu brief 4 ayrı disiplin alanını (lock coverage, IA kararı, kanıt üretme, ölü kod) tek PR'a topluyor çünkü hepsi mekanik / belge / test seviyesinde; kod akışına dokunmadığı için tek round'da güvenli birleştirilebilir. Diff büyük olabilir; gerekirse Codex 12a (lock + IA + dokuman) ve 12b (Lighthouse + ölü CSS) olarak bölebilir.
