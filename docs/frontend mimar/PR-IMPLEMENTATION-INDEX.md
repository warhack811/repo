# Runa UI Restructure — Master Implementation Index

> **Tarih:** 2026-05-13
> **Yetki belgesi:** `docs/frontend mimar/RUNA-DESIGN-BRIEF.md` v1.1
> **Stratejik plan:** `docs/FRONTEND-RESTRUCTURING-PLAN.md`
> **Kapsam:** PR-1 → PR-8, frontend görsel ve mimari yeniden yapılandırma
> **Hedef seviye:** Claude Cowork, Claude Code, Codex, ChatGPT, Linear, Raycast kalitesi

Bu doküman 8 PR'ı tek bir sürecin parçaları olarak yönetir. Her PR için ayrı `PR-N-CODEX-BRIEF.md` mevcuttur; Codex doğrudan o belgeyi açıp uygular. Master index burada **bağımlılık, sıra, durum ve kabul matrisi** taşır.

---

## 1. Sürecin tek-cümle hedefi

Mevcut Runa arayüzünü 8 küçük-diff PR'da, Claude Cowork ve Codex seviyesinde tüketici-grade bir AI çalışma ortağı arayüzüne dönüştürmek. Her PR bağımsız olarak revertable, gözden geçirilebilir ve görsel kanıtla kapatılır.

## 2. PR sırası ve bağımlılıklar

```
PR-1 (tema/font/mark)         [GÖRSEL TRANSFORMASYON]
  │
  ▼
PR-2 (layout shell)            [SAĞ RAIL KALDIRMA, SOL SIDEBAR]
  │
  ▼
PR-3 (chat surface)            [TEKRAR KESİMİ, MESAJ RİTMİ]
  │
  ├──────────┬─────────────┐
  ▼          ▼             │
PR-4    PR-5             (paralel)
(approval) (errors+server)
  │          │
  └──────────┴──→  PR-6 (sheets + command palette)
                    │
                    ▼
                  PR-7 (settings + advanced view + stop button)
                    │
                    ▼
                  PR-8 (a11y + iOS + reduced motion + polish)
```

**Lineer zorunlu:** PR-1 → PR-2 → PR-3, PR-6 → PR-7 → PR-8.
**Paralel izinli:** PR-4 ve PR-5 (PR-3 sonrası bağımsız modüller).

## 3. PR durum matrisi (canlı)

| PR | Kod adı | Brief | Durum | Branch |
|---|---|---|---|---|
| PR-1 | Tema, Tipografi, Hafıza Mark | [PR-1-CODEX-BRIEF.md](./PR-1-CODEX-BRIEF.md) | Final tour devam ediyor | `codex/ui-restructure-pr-1-theme-typography-mark` |
| PR-2 | Layout Shell | [PR-2-CODEX-BRIEF.md](./PR-2-CODEX-BRIEF.md) | Hazır, PR-1 merge sonrası başlar | `codex/ui-restructure-pr-2-layout-shell` |
| PR-3 | Chat Surface | [PR-3-CODEX-BRIEF.md](./PR-3-CODEX-BRIEF.md) | Hazır, PR-2 sonrası | `codex/ui-restructure-pr-3-chat-surface` |
| PR-4 | Approval Calm | [PR-4-CODEX-BRIEF.md](./PR-4-CODEX-BRIEF.md) | Hazır, PR-3 sonrası (paralel) | `codex/ui-restructure-pr-4-approval-calm` |
| PR-5 | Errors + Server `user_label_tr` | [PR-5-CODEX-BRIEF.md](./PR-5-CODEX-BRIEF.md) | Hazır, PR-3 sonrası (paralel) | `codex/ui-restructure-pr-5-errors-user-label` |
| PR-6 | Sheets + Modal + Command Palette | [PR-6-CODEX-BRIEF.md](./PR-6-CODEX-BRIEF.md) | Hazır, PR-4 + PR-5 merge sonrası | `codex/ui-restructure-pr-6-sheets-palette` |
| PR-7 | Settings + Advanced View + Stop | [PR-7-CODEX-BRIEF.md](./PR-7-CODEX-BRIEF.md) | Hazır, PR-6 sonrası | `codex/ui-restructure-pr-7-settings-stop` |
| PR-8 | A11y + iOS + Polish | [PR-8-CODEX-BRIEF.md](./PR-8-CODEX-BRIEF.md) | Hazır, PR-7 sonrası | `codex/ui-restructure-pr-8-a11y-polish` |

## 4. Branching ve review akışı

### Branching

- Her PR ayrı worktree: `.claude/worktrees/runa-ui-pr-N-<short-desc>/`
- Branch naming: `codex/ui-restructure-pr-N-<slug>`
- Lineer PR'lar bir öncekinin merge'i beklenmeden açılmaz.
- Paralel PR'lar (PR-4 + PR-5) ayrı worktree'lerde aynı anda yürür; merge sırası serbest, conflict çıkarsa ikinci PR rebase eder.

### Review akışı

1. Codex worktree açar, PR brief'indeki kapsamı uygular.
2. Codex doğrulamayı koşar: `lint + typecheck + test + build`.
3. Codex PR açar; description'a kabul kriteri checklist'i ve görsel kanıtları ekler.
4. PR linki Claude'a (planlama ortağı) gönderilir.
5. Claude **gerçek kanıtlarla** (file:line, grep çıktısı, screenshot) review eder; tahmin yapmaz.
6. Review sonucu kullanıcıya raporlanır → kullanıcı `merge` veya `revize` kararı verir.
7. Merge sonrası `docs/PROGRESS.md`'de `TASK-UI-RESTRUCTURE-PR-N` entry kapanır.

### Lock test stratejisi

- `apps/web/src/test/design-language-lock.test.ts` PR-1'de kuruldu.
- Sonraki PR'lar bu test'i **bozmadan** ilerler.
- Her PR kendi alanını da kilitler (örn. PR-2 layout shell yapısını, PR-4 approval kart yapısını).
- Lock test bypass yasak: `.skip()` veya silme yok. Test güncellenir, atlanmaz.
- Her PR brief'i "Lock test güncellemesi: ne, neden" satırını PR description'a koyar.

## 5. Global kabul kriteri (PR-1 → PR-8 tamamlandığında)

1. **Görsel karşılaştırma testi:** Runa ile rastgele bir rakip ekran görüntüsü (Claude Cowork, Codex) yan yana konduğunda "hangisi tüketici ürünü" testi geçer.
2. **Ekran kaplaması:** Aynı agent run'ı eski tasarıma göre en az %40 daha az piksel kaplar.
3. **Design Language Lock test PASS:** PR-1'de kurulan testin tüm assertion'ları yeşil.
4. **Debug copy lint:** Developer Mode kapalıyken `apps/web` içinde hiçbir İngilizce tool description user-facing ekrana çıkmaz (regex guard).
5. **Mobil 320/390/414 boyutlarında** composer focus altında hiçbir overlap yok; klavye açıkken composer üst kenarı görünür.
6. **Lighthouse:** Performance ≥85, A11y ≥95, Best Practices ≥90.
7. **WCAG AA:** Tüm metin/zemin kombinasyonları kontrast geçer; `--ink-3` küçük metinde kullanılmıyor.

## 6. Risk havuzu (proje genelinde)

| Risk | Etki | Mitigation |
|---|---|---|
| Lineer PR'ların biri uzun sürerse paralel olmayan PR'lar bekler | Orta | Her PR ≤3 günde tamamlanacak boyutta kurgulandı; uzarsa scope'tan kırp. |
| Lock test her PR'da değişmek zorunda kalırsa stratejide zayıflama | Orta | Her PR brief'inde "Lock test'e eklenecek/değişecek assertion" satırı var. |
| Server kontrat değişikliği (PR-5 `user_label_tr`) breaking olur | Orta | Opsiyonel alan; eski tüketiciler `user_label_tr === undefined` ile çalışır. |
| Sheet sistemi (PR-6) iOS Safari'de bozar | Orta | PR-8'de iOS visualViewport polish'lenir; PR-6 brief'inde minimum cihaz testi şart. |
| Migration CSS dosyaları (PR-2 kapsamı) cleanup PR-3 testlerini bozar | Yüksek | PR-2 brief'i lock test güncellemesini bir adım önce yapar. |
| Aynı anda Codex'in çoklu worktree'de paralel çalışması conflict yaratır | Düşük | Paralel sadece PR-4 + PR-5; farklı dosyalara dokunurlar. |
| Brief v1.1 ile gerçek implementation arasında sapma birikir | Orta | Her PR review'da brief sapması açıkça raporlanır; sapma kabul edilirse v1.2/v1.3 olarak güncellenir. |

## 7. PR'lar arası ortak kabul kriteri (her PR'da)

Her PR aşağıdaki minimum kontrolleri geçmeli:

### Otomatik (CI)
- [ ] `pnpm --filter @runa/web lint` → PASS (baseline `SettingsPage.tsx:204` istisna)
- [ ] `pnpm --filter @runa/web typecheck` → PASS
- [ ] `pnpm --filter @runa/web test` → PASS
- [ ] `pnpm --filter @runa/web build` → PASS

### Görsel kanıt (zorunlu)
- [ ] PR brief'inde listelenen ekran görüntüleri `docs/design-audit/screenshots/<tarih>-ui-restructure-pr-N-<slug>/` altına commit edilmiş

### İnsan-review
- [ ] Brief'teki kapsam dışı (DO NOT) listesindeki hiçbir dosya bu PR'da değişmemiş
- [ ] Lock test PASS, varsa yeni assertion eklenmiş
- [ ] PR description'da kabul kriteri checklist'i doldurulmuş

### Performans (PR-1 ve PR-8)
- [ ] Lighthouse Performance / A11y / Best Practices skorları rapor edildi

## 8. Belgeler arası bağlantı

- `RUNA-DESIGN-BRIEF.md` v1.1 → tek yetki belgesi (renkler, kurallar, tool risk listesi, server kontratı)
- `FRONTEND-RESTRUCTURING-PLAN.md` → ilk strateji belgesi (planlama referansı, history)
- `PR-N-CODEX-BRIEF.md` → her PR için implementation rehberi (Codex açıp uygular)
- `PR-IMPLEMENTATION-INDEX.md` → bu doküman (canlı durum, sıralama, bağımlılık, ortak kabul)
- `docs/PROGRESS.md` → kronolojik task log, merge sonrası entry'ler buraya düşer
- `docs/RUNA-DESIGN-LANGUAGE.md` → uzun-vadeli locked design rules (PR-1 sonrası güncellenir)

## 9. Komut paleti (Codex referansı)

```bash
# Yeni worktree açma
git worktree add .claude/worktrees/runa-ui-pr-N-<slug> codex/ui-restructure-pr-N-<slug>

# Çalışma
cd .claude/worktrees/runa-ui-pr-N-<slug>
pnpm install
pnpm --filter @runa/web dev      # localhost:5173

# Doğrulama (her PR'da)
pnpm --filter @runa/web lint
pnpm --filter @runa/web typecheck
pnpm --filter @runa/web test
pnpm --filter @runa/web build

# Görsel kanıt
pnpm --filter @runa/web exec playwright test e2e/visual-pr-N.spec.ts

# Worktree kapatma (merge sonrası)
cd D:/ai/Runa
git worktree remove .claude/worktrees/runa-ui-pr-N-<slug>
git branch -d codex/ui-restructure-pr-N-<slug>
```

## 10. Esneklik notu

Bu plan **esnek**. Aşağıdaki durumlar plan revizyonu tetikler:

- **PR sırası değişir** → Index güncelle, bağımlılık grafiği yeniden çiz.
- **Yeni PR eklenir (örn. PR-5.5)** → Yeni `PR-5.5-CODEX-BRIEF.md` yaz, index'e ekle.
- **Bir PR bölünür (örn. PR-6 ikiye ayrılır)** → İki yeni brief, eski brief deprecated edilir.
- **Brief v1.1 → v1.2** → Anlamlı bir karar değiştiyse brief güncellenir, ilgili PR brief'leri etkilenirse `references brief v1.2` notu eklenir.

Plan değişiklikleri Claude (planlama ortağı) ile birlikte yapılır, Codex tek başına index'i değiştirmez.
