# Runa Docs Audit - 2026-05-14

Bu belge, IDE LLM hata oranini azaltmak icin `docs/` alaninin mevcut durumunu kanit bazli ozetler.
Hedef: "hangi belge aktif otorite, hangisi tarihsel kayit, hangisi sadece kanit/artifact" ayrimini netlestirmek.

## 1) Olculen Durum

- `docs/` altinda toplam dosya: `246`
- `docs/` altinda markdown dosyasi: `91`
- Dizin dagilimi (dosya sayisi):
  - `docs/design-audit`: `135`
  - `docs/design`: `29`
  - `docs/archive`: `22`
  - `docs/migration`: `14`
  - `docs/tasks`: `12`
  - `docs/architecture`: `4`
  - `docs/launch`: `3`
  - `docs/dev`: `1`
  - `docs/ui-smoke`: `1`

## 2) Tespit Edilen Riskler

1. `docs/PROGRESS.md` dosyasinda `538` adet NUL byte var.
2. Kok `docs/` altinda mimari, analiz, task ve operasyon belgeleri karisik seviyede.
3. Yol bagimliligi yuksek: bircok belge `docs/design/ui-restructure/...` yolunu dogrudan referansliyor.
4. Encoding tutarsizligi olan satirlar var (mojibake gorunumu), bu durum LLM okuma kalitesini dusurur.

## 3) Otorite Haritasi (Hedef Model)

- `core`: her IDE LLM oturumunda okunacak ana kaynaklar.
- `active-specs`: uygulanabilir task ve PR brief belgeleri.
- `design`: urun/UI otoritesi (tasarim dili, design brief, logo paketleri).
- `analysis`: karar destek analiz raporlari.
- `archive`: tamamlanmis tarihsel kayitlar.
- `evidence`: screenshot, migration smoke ve test artefaktlari.

## 4) Hemen Uygulanan Degisiklikler (Phase-1)

1. `docs/IDE-LLM-RUNBOOK.md` eklendi.
2. `docs/INDEX.md` yeni otorite modeline gore guncellendi.
3. Dosya tasima oncesi referans etkisinin zorunlu oldugu INDEX notuna eklendi.

## 4.1) Hemen Uygulanan Degisiklikler (Phase-2)

1. Eski frontend-mimar klasoru kapanarak icerigi `docs/design/` altina tasindi.
2. Ayrim modeli uygulandi:
   - `docs/design/RUNA-DESIGN-BRIEF.md`
   - `docs/design/ui-restructure/*.md`
   - `docs/design/artifacts/*.html`
   - `docs/design/logo-pack/*`
3. Belgelerdeki eski frontend-mimar path referanslari yeni path'lere toplu guncellendi.
4. `docs/INDEX.md` yeni path standardi ile senkronize edildi.

## 5) Sonraki Teknik Adimlar

1. `PROGRESS.md` NUL/encoding temizligi (icerik anlami korunarak).
2. Tasima sonrasi link-denetimi:
   - Eski path referanslarini toplu tarama (`rg`).
   - Kalan kirik referanslarin manuel kapanisi.

## 6) Kapsam Disi (Bu Fazda Bilincli)

- Kod tarafi (server/web/runtime) degisiklikleri.
- Task 01-12 belge setinin tasinmasi.
- Buyuk tarihsel arsivin toptan yeniden yazimi.

## 7) Phase-2 Dogrulama Ozeti

1. Eski frontend-mimar klasoru kapanisi tamamlandi.
2. Eski frontend-mimar path referanslari dokumanlarda temizlendi.
3. Kalan kirik-link kayitlarinin buyuk bolumu tasima kaynakli degil:
   - Placeholder screenshot path'leri (`2026-05-XX-*`)
   - Tarihsel veya scope-disi eski referanslar (`UI-OVERHAUL-04.md`, `RUNA-VOICE.md`, vb.)
   - Aralik referansi kaliplari (Task 01-12 gibi desen kullanimlari)

## 8) Phase-3 Dogrulama Ozeti

1. `docs/PROGRESS.md` dosyasinda NUL temizligi tamamlandi (`538` -> `0`).
2. Temizlik oncesi birebir backup alindi:
   - `docs/archive/progress-2026-05-phase3-preclean-backup.md`
3. Aktif kirik referanslar kapatildi:
   - UI-OVERHAUL-04 referansi archive yoluna alindi.
   - RUNA-VOICE tarihsel referansi kaldirildi.
   - Repo disi spike log path'i link formatindan cikarildi (local artifact olarak not edildi).
4. Kalan kirik path'lerin buyuk bolumu placeholder veya tarihsel kayit niteliginde:
   - `2026-05-XX` screenshot placeholder'lari
   - Archive/back-up dosyalardaki eski referanslar
5. Phase-3 sonunda kalan otomatik tarama bakiyesi: `10` referans.

