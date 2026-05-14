# Runa IDE LLM Runbook

Bu runbook, IDE LLM ile calisirken hata oranini azaltmak ve cikti kalitesini standartlastirmak icin baglayici operasyon kurallarini tanimlar.

## 1) Oturum Baslangici (Zorunlu Okuma)

Her yeni gorevde once su dosyalar okunur:

1. `docs/AGENTS.md`
2. `docs/TASK-TEMPLATE.md`
3. `docs/LLM-CONTEXT.md`
4. `docs/IDE-LLM-RUNBOOK.md`
5. `docs/PROGRESS.md` icinden "Mevcut Durum Ozeti" ve gorevle ilgili en yeni kayit
6. Gorevin exact task/prompt dosyasi

Bu besli disindaki belgeler sadece blocker, celiski veya gorev turu gerektirirse acilir.

## 2) Tek Gorev - Tek Blok Kurali

IDE LLM'e ayni anda birden fazla buyuk hedef verilmez.
Her prompt tek is blokunu kapsar:

1. Kisa repo wrapper
2. Exact gorev tanimi
3. `Allowed files`
4. `Non-goals`
5. Validation komutlari
6. Done kriterleri

## 3) Scope Kilidi

Promptta yazan `non-goal` maddeleri baglayicidir.
Scope disina cikma riski varsa LLM bunu raporlar ve degisiklik yapmadan once yeniden hizalanir.

## 4) Source Of Truth Sirasi

Celiski durumunda oncelik sirasi:

1. Kullanici mesajindaki exact kapsam ve non-goals
2. `docs/AGENTS.md`
3. Ilgili task/prompt dosyasi
4. `docs/PROGRESS.md` son kayitlari
5. Diger mimari/tarihsel dokumanlar

## 5) Validation ve Kanit

Her gorev kapanisinda rapor su ayrimi net yapar:

1. Task-local green kanit
2. Repo baseline veya environment kaynakli kalan red durumlar
3. Kosulan komutlar ve sonuc ozeti
4. Dokunulmayan non-goal listesi

## 6) PROGRESS Kaydi Kurali

Asagidaki durumlardan biri varsa `docs/PROGRESS.md` kaydi eklenir:

1. Kod degisikligi yapildiysa
2. Prompt/policy/operasyon akisini etkileyen yeni bir karar alindiysa
3. Canli smoke veya release gate sonucu elde edildiyse

Plan-only gorevlerde "kod degisikligi yapilmadi" notu acikca yazilir.

## 7) Belge Siniflari

- `core`: her oturum okunan ana belgeler
- `active-specs`: aktif task ve brief belgeleri
- `design`: guncel urun/UI otoritesi
- `analysis`: karar destek analizleri
- `archive`: tarihsel tamamlanmis kayitlar
- `evidence`: screenshot ve smoke artefaktlari

## 8) Riskli Belge Isleri

Tasima/yeniden adlandirma yapmadan once:

1. Eski path referanslari toplu taranir.
2. Tasima sonrasi ikinci tarama ile kirik referanslar kapatilir.
3. Otorite belgeleri tasinirken 1:1 path degisikligi raporlanir.

## 9) Yasak Kisa Yollar

1. "Her seyi oku, sonra karar ver" tarzinda plansiz yukleme
2. Non-goal ihlali pahasina "hizli fix"
3. Kanitsiz "tamamlandi" iddiasi
4. Task-local green ile repo-baseline red ayrimini karistirmak
