# PR-10 Codex Audit Prompt — Kalan Eksikler Tespiti

> **Tarih:** 2026-05-14
> **Tip:** Plan-only / audit. **Kod değişikliği YOK.**
> **Branch:** `codex/ui-restructure-pr-10-gap-audit` (yalnız `docs/` altı dosyalar)
> **Worktree:** `.claude/worktrees/runa-ui-pr-10-gap-audit`
> **Hedef:** PR-1..PR-9 sonrası UI restructure hedeflerinden kalan açıkları **dosya:satır kanıtıyla** çıkarmak. Tahmin yok.

---

## 1. Görev

Aşağıdaki 5 alanı **birebir** denetle ve her bulguyu `docs/design/ui-restructure/PR-10-GAP-AUDIT-REPORT.md` dosyasına yaz. Her iddia için kaynak kod referansı (file:line) zorunlu — yoksa raporlama.

---

## 2. Denetlenecek Alanlar

### 2.1 CHAT-UI-AUDIT 14 bug — hangileri hâlâ açık?

**Kaynak:** `docs/CHAT-UI-AUDIT-2026-05.md` (14 bug listesi)

PR-1..9 sonrası kodu okuyarak, her bug'ın **şu anki durumunu** doğrula. Bug için verilen dosya:satır referanslarını **bizzat aç**, mevcut kod hâlâ bug'ı taşıyor mu yoksa düzeltilmiş mi raporla.

Her bug için çıktı şu format:

```
### BUG-N — <başlık> — <Priority>
- Durum: AÇIK | KAPALI | KISMEN
- Kanıt dosya:satır: ...
- Mevcut kod: <2-3 satır snippet>
- Yorum: <bug hâlâ tetiklenir mi? hangi koşulda?>
```

BUG-6 (approval), BUG-7 (migration CSS), BUG-10 (chat bubble) → PR-4/PR-7/PR-3 kapsamında düzeltilmiş, doğrula.

### 2.2 PR-1..9 kabul kriteri **gerçek** geçişi

Her PR brief'inin Bölüm 4 "Kabul Kriteri" listesini aç (`docs/design/ui-restructure/PR-N-CODEX-BRIEF.md`). Her checkbox için:

- **Otomatik kriterler:** ilgili grep/komut'u çalıştır, çıktıyı raporla.
- **Lock test güncellemeleri:** `apps/web/src/test/design-language-lock.test.ts` içinde ilgili assertion var mı doğrula.
- **Görsel kanıt:** `docs/design-audit/screenshots/` altında beklenen klasörün varlığı + içerdiği dosya sayısı.
- **Lighthouse skorları:** raporda kayıt var mı (`docs/design-audit/screenshots/*/lighthouse-*.json`).

Beklenen ama eksik kalan her madde → "BOŞ KANIT" olarak işaretle.

Özellikle PR-8:
- `useVisualViewport` `App.tsx` veya `AuthenticatedApp.tsx`'te **gerçekten mount edilmiş mi**? (`grep -n "useVisualViewport()" apps/web/src/App.tsx apps/web/src/AuthenticatedApp.tsx`)
- `SkipToContent` AppShell'in **ilk öğesi mi**? (komponent render sırasını kontrol et)
- Her `.module.css` dosyasında `prefers-reduced-motion` query var mı? (find + grep ile sayım)

### 2.3 Plan kapsamı dışında bırakılan ama "rakipler kalitesi" için gerekli olabilecek alanlar

Aşağıdaki alanları **mevcut kodda incele**, eksiklik raporla — düzeltme önerme:

- **Markdown rendering kalitesi:** `apps/web/src/lib/streamdown/StreamdownMessage.tsx` ve çağırdığı renderer'lar. Code block, tablo, list, blockquote, inline code rendering pattern'i Codex/Cowork seviyesinde mi? Kanıt için bir mesaj örneğindeki spacing/typography'yi tarif et.

- **Empty state öneri chip'leri:** `apps/web/src/components/chat/EmptyState.tsx`. 4 sabit öneri statik mı, kişiselleştirilmiş mi? Kaynak nereden geliyor?

- **Loading/skeleton state'leri:** `apps/web/src` içinde `Skeleton` veya `Loading` komponentleri kaç yerde kullanılmış? Hangi route'larda yok?

- **Tool icon set:** `lucide-react` import'larını tara, kaç farklı ikon kullanılıyor. Marka-özel SVG var mı (HafizaMark dışında)?

- **Voice composer:** `apps/web/src/components/chat/VoiceComposerControls.tsx` — recording state'i, error handling, mikrofon izin akışı dosya:satır olarak rapor et.

- **Settings sayfası içerik derinliği:** `apps/web/src/pages/SettingsPage.tsx` — 3 tab var mı doğrula, her tab'da kaç alan var listele.

- **Onboarding flow:** `apps/web/src/pages/OnboardingPage.tsx` veya `components/onboarding/*` — PR-1 sonrası yeni dile geçmiş mi (HafizaMark, Instrument Serif)?

### 2.4 Dokümantasyon açık uçları

- `docs/PROGRESS.md` "Mevcut Durum Özeti" tarihi nedir? Son ne zaman güncellenmiş?
- `docs/PROGRESS.md`'de PR-3, PR-4, PR-5, PR-6, PR-7, PR-8, PR-9 için ayrı kayıtlar var mı?
- `TASK-UI-RESTRUCTURE-COMPLETE` final entry var mı?
- `docs/INDEX.md` `RUNA-DESIGN-LANGUAGE.md`'yi UI source of truth olarak işaret ediyor mu?
- `docs/RUNA-DESIGN-LANGUAGE.md` "Status" alanı ne diyor, son güncelleme tarihi?

### 2.5 Kod kalitesi / teknik debt

- `apps/web/src/components/chat/RunProgressPanel.tsx` ve `.module.css` — PR-3 brief "ölü kod statüsünde kalır, sonraki PR'da silinir veya Developer Mode panelinde yeniden mount edilir" demişti. Şu an hangi durumda?
- Tüm `*.module.css` dosyalarında `prefers-reduced-motion` query sayımı yap (`find apps/web/src -name "*.module.css" | xargs grep -l "prefers-reduced-motion" | wc -l` vs toplam `.module.css` sayısı).
- TypeScript `any` veya `// @ts-ignore` kullanım sayısı (`apps/web/src`).
- Test coverage: `apps/web/src/test/` altında kaç test dosyası, hangi alanları kapsıyor.

---

## 3. Çıktı Formatı

Tek bir dosya: `docs/design/ui-restructure/PR-10-GAP-AUDIT-REPORT.md`.

Yapı:

```markdown
# PR-10 Gap Audit Report

> Tarih: 2026-05-14
> Yöntem: Kaynak kod taraması — her iddia file:line ile.

## 1. CHAT-UI 14 Bug Durumu
<14 bug için tek tek durum>

## 2. PR-1..9 Kabul Kriteri Boş Kanıt Listesi
<PR bazında eksik check'ler>

## 3. Plan-Dışı Kalan Alanlar
<her alt başlık için mevcut durum tarifi>

## 4. Dokümantasyon Açıkları
<liste>

## 5. Teknik Debt
<liste>

## 6. Öncelik Önerisi
<HIGH/MED/LOW olarak gruplandırılmış 1 paragraflık özet>
```

---

## 4. Yetki ve disiplin

- **Kod değişikliği YASAK.** Yalnız `docs/design/ui-restructure/PR-10-GAP-AUDIT-REPORT.md` yazılır.
- Her iddia için **dosya:satır kanıtı** zorunlu. Kanıt veremiyorsan o maddeyi rapora **alma**.
- Tahmin, "muhtemelen", "olabilir" yok. Sadece doğrulanmış gözlem.
- Belirsizlik çıkarsa Codex iş başlamadan kullanıcıya sorar.

---

## 5. Komutlar (Codex için referans)

```bash
cd D:/ai/Runa
git worktree add .claude/worktrees/runa-ui-pr-10-gap-audit codex/ui-restructure-pr-10-gap-audit
cd .claude/worktrees/runa-ui-pr-10-gap-audit

# Lock test assertion sayımı
grep -c "expect" apps/web/src/test/design-language-lock.test.ts

# prefers-reduced-motion coverage
total=$(find apps/web/src -name "*.module.css" | wc -l)
covered=$(find apps/web/src -name "*.module.css" | xargs grep -l "prefers-reduced-motion" | wc -l)
echo "Coverage: $covered / $total"

# useVisualViewport mount
grep -n "useVisualViewport" apps/web/src/App.tsx apps/web/src/AuthenticatedApp.tsx

# Screenshot klasörleri
ls docs/design-audit/screenshots/ | grep "ui-restructure-pr"

# Lighthouse JSON'ları
find docs/design-audit -name "lighthouse-*.json" | wc -l

# TypeScript any sayımı
grep -rn ": any\b\|as any\b" apps/web/src --include="*.ts" --include="*.tsx" | wc -l
```

---

## 6. Sonuç beklenti

Bu audit bittikten sonra elimizde:
- 11 açık CHAT-UI bug için güncel durum
- PR-1..9 kabul kriterlerinden "boş kanıt" listesi (özellikle PR-8 Lighthouse + screen reader)
- Plan-dışı kalan "rakipler kalitesi" boşlukları
- Belge eksikleri
- Sonraki PR önceliklendirmesi için somut girdi

Rapor üretildikten sonra kullanıcı ve Claude beraber **PR-11+** sırasını oluşturur.
