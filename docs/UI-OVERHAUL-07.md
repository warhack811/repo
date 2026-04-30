# UI-OVERHAUL-07 - Visual Coherence & Trust Repair

> Bu belge, 29 Nisan 2026 UI audit'i sonrasi Runa web UI tarafinda izlenecek sirali plani kaydeder.
> Amac yeni ozellik eklemek degil; mevcut yuzeyleri rakip kalite liginde, chat-first ve trust-first urun diline tasimaktir.

## Neden Bu Faz Var?

Runa'nin teknik omurgasi guclu: chat-first runtime, approval, desktop capability, memory ve provider seam'leri var.
Fakat 28 ekranlik UI screenshot audit'i, mevcut web yuzeylerinin kullaniciya yer yer internal admin/debug panel hissi verdigini gosterdi.

Bu fazin hedefi:

- ilk izlenimde guven kiran P0 UI sızıntilarini kapatmak,
- ana chat/composer deneyimini rakiplerin ortak tasarim diliyle ayni kategoriye tasimak,
- approval ve desktop capability yuzeylerini trust-first hale getirmek,
- secondary yuzeyleri sade, tutarli ve consumer-grade yapmak,
- Runa'nin kendi design language ve voice kurallarini kilitlemek.

## Audit Kanitlari

Screenshot seti:

- `docs/design-audit/screenshots/2026-04-29-runa-ui-surface-audit/`
- Desktop viewport: `1440x900`
- Mobile viewport: `390x844`
- Toplam ekran: `28`

Audit sonucunda one cikan ana P0/P1 problemler:

- Brand text login ekraninda yanlis gorunuyor (`Dnor`).
- Mobile approval/composer layer pointer collision yapiyor.
- Composer bottom-anchored degil; chat yuzeyi content sandwich gibi davraniyor.
- Approval pending ve completed state'leri gorsel olarak ayrismiyor.
- Yapilandirilmis trust-first approval card yok.
- Empty chat'te demo/dev seed icerik gorunuyor.
- History yuzeyinde user-facing debug error gorunuyor.
- Project Memory ve Developer yuzeylerinde internal phase/dev dili user surface'e siziyor.
- Devices sayfasi Runa'nin ayrisma noktasini sade bir product surface olarak anlatmak yerine redundant felsefe kartlariyla savunmaci gorunuyor.
- Operator/status badge'leri normal kullanici yuzeylerine tasiyor.
- Card/border/gradient/renk/copy disiplini rakiplerin sade monokrom dilinden uzak.

## Hedef Urun Dili

Runa'nin UI dili su cumleyi tasimali:

> Sakin, koyu, chat-first ve guvenilir bir AI calisma ortagi; projeni, gecmisini ve bilgisayarini bilen, ama senden izinsiz ileri gitmeyen bir sistem.

Rakiplerden alinacak sey kopya palet degil, disiplin:

- dark-first, off-black/off-white,
- tek anlamli aksan rengi,
- dar ve okunabilir chat kolonu,
- bottom-anchored composer,
- az border, az kart, gradient yok,
- user message pill + assistant inline rhythm,
- trust-first approval card,
- mobile'da ayni urun dili, farkli ergonomi,
- developer/operator yuzeylerinin normal kullanicidan izole edilmesi.

## Sirali Paket Plani

### 7.1 - First Impression & Trust Repair

Kapsam: Kanama durdurma. Yeni design system acmadan, kullanicinin gormemesi gereken kirik/dev/internal yuzeyleri temizle.

Yapilacaklar:

- `Dnor` brand text bug'ini duzelt.
- Empty chat'teki demo/dev seed icerigi kaldir.
- History'deki `Desteklenmeyen conversation list yaniti` gibi debug error'u user-facing olmaktan cikar; sade empty/error state kullan.
- Project Memory, Developer tab ve Capability Preview gibi hazir olmayan/internal yuzey sızıntilarini normal user surface'ten kaldir veya feature flag arkasina al.
- `Bu fazda`, `Ikinci katman`, `Gunluk dogrulanmis oturum`, operator/status badge gibi internal taxonomy stringlerini user surface'ten temizle.
- Mobile approval/composer pointer collision'i duzelt.

Done:

- Yeni kullanici login/chat/history/settings/devices akisini actiginda kirik brand, demo seed, internal phase dili veya dev/debug error gormez.
- Mobile approval butonu gercek kullanici tarafindan tiklanabilir.
- Screenshot smoke ile once/sonra kanitlanir.

Non-goals:

- Buyuk visual redesign yok.
- Cmd+K yok.
- Yeni dependency yok.
- Server/contracts/provider degisikligi yok.

### 7.2 - Chat Composer & Surface Reset

Kapsam: Ana chat ekranini kategori icine almak.

Yapilacaklar:

- Composer bottom-anchored sticky/floating hale gelsin; altinda ana icerik kalmasin.
- Empty chat: tek baslik, sakin destek metni, composer ve az sayida prompt suggestion pill.
- Composer chrome sade: textarea + attach + send; voice/read/retry gibi ikincil kontroller menu veya contextual state altina alinsin.
- Desktop chat max-width kontrollu olsun; mobile tek kolon ve keyboard-safe davransin.

Done:

- Chat empty ekran rakiplerle yan yana kondugunda ayni kategoriye ait gorunsun.
- Composer ekranin yer cekim merkezi olsun.

### 7.3 - Approval UX & State Feedback

Kapsam: Runa'nin trust-first vaadini approval aninda kanitlamak.

Yapilacaklar:

- Approval card: `Runa sunu yapmak istiyor` basligi, okunur aksiyon icerigi, risk/target bilgisi, `Onayla` ve `Reddet`.
- Pending, approved, rejected, completed state'leri gorsel olarak ayrissin.
- Onaydan sonra card collapse/transition ile akisin devam ettigi belli olsun.
- Mobile'da approval card composer ile cakismaz; gerekirse composer pending aninda disable olur.

Done:

- Approval flow ekran kaydinda kullanici butonu gorur, tiklar, state degisimini aninda anlar.

### 7.4 - Operator/Developer Hard Isolation

Kapsam: UI-OVERHAUL-01'in yarim kalan hard isolation hedefini gercek user surface'e uygulamak.

Yapilacaklar:

- User surface'lerden operator/status badge'lerini kaldir.
- Account icindeki Developer tab'i kaldir.
- `/developer*` route'larini explicit dev mode / feature flag arkasina al.
- Capability Preview'i internal QA araci olarak tut; normal nav'dan ve user flow'dan cikar.
- `dev@runa.local` gibi placeholder data gorunumlerini temizle.

Done:

- Temiz session acan normal kullanici developer/operator entry point gormez.

### 7.5 - Secondary Surfaces Reframe

Kapsam: History, Devices, Account/Settings yuzeylerini consumer-grade yapmak.

Yapilacaklar:

- History: sade kronolojik sohbet listesi, arama, bos state; debug counter/warning yok.
- Devices: tek primary device connection story; 3 redundant felsefe karti yok.
- Account: tek baslik, kisa profil/oturum bilgisi, az tekrar.
- Settings tab sayisi azaltilsin; hazir olmayan Project Memory gizlensin.
- Mobile bottom nav 2x2 grid yerine yatay tek satir nav olsun.
- Mobile header yuksekligi dusurulsun; esas icerik ilk viewport'ta gorunsun.

Done:

- Her secondary surface'te kart sayisi ve copy tekrar sayisi belirgin azalir.
- Devices Runa'nin desktop capability ayrisma noktasini savunmaci degil, guven veren sekilde anlatir.

### 7.6 - Visual Discipline Pass

Kapsam: Renk, border, radius, typography ve motion kararlarini tek dile indirmek.

Yapilacaklar:

- Gradient CTA'lari kaldir; flat aksan kullan.
- Renk paleti: background, text, muted, accent, semantic status ile sinirli.
- Typography scale max 5 boyut: `12 / 14 / 16 / 20 / 28`.
- Font weight: `400 / 500 / 600`; agir dramatik weight yok.
- Border default yok; gerekiyorsa cok dusuk kontrast.
- Radius degerleri az ve tutarli.
- Card-within-card pattern'i temizle.

Done:

- 28 ekranlik yeni screenshot setinde palette/type/radius/border kararlarinin dagilimi tutarli olur.

### 7.7 - Copy Voice Pass

Kapsam: Runa'nin Turkce urun sesini tek elden gecirmek.

Yapilacaklar:

- `burada kalir`, `burada gorunur`, `bu fazda`, `dogrulanmis evet` gibi self-narrating/operator copy temizlenir.
- Empty state'ler aciklama degil davet olur.
- Tek ekranda TR/EN karisimi kalmaz.
- Brand redundancy azaltilir.
- `docs/RUNA-VOICE.md` veya `docs/RUNA-DESIGN-LANGUAGE.md` icinde voice kurallari kaydedilir.

Done:

- 28 ekran metinleri tek elden yazilmis gibi okunur.
- Kullanici UX stratejisini okumaz; urun davranisiyla anlar.

### 7.8 - Capability Layer Polish

Kapsam: Rakip seviyesinde power-user ve mobile polish.

Yapilacaklar:

- Cmd+K command palette: sayfa nav, sohbet arama, temel aksiyonlar.
- Microinteraction inventory: hover, active, focus, loading, transition.
- Mobile keyboard avoidance kesinlestirilir.
- Loading state'lerde spinner yerine skeleton tercih edilir.
- Focus ve keyboard flow power-user kalitesine getirilir.

Done:

- Kullanici keyboard ile hizli navigasyon yapabilir.
- Mobile composer klavye ile bozulmaz.

### 7.9 - Final Coherence Audit & Design Language Lock

Kapsam: Faz kapanis kaniti ve uzun vadeli guardrail.

Yapilacaklar:

- 28 ekran tekrar screenshotlanir.
- Rakip ekranlariyla yan yana final audit yapilir.
- `docs/RUNA-DESIGN-LANGUAGE.md` yazilir ve kilitlenir.
- Visual regression baseline'lari guncellenir.
- Gelecek UI task'lari icin design/copy checklist eklenir.

Done:

- Runa ekranlari rakiplerle yan yana kondugunda kategori farki kaybolur.
- Estetik Runa'ya ozgu kalabilir; kalite ligi ayni olur.

## Uygulama Kurallari

- Paketler sira atlamadan ilerlemeli: once 7.1, sonra 7.2, sonra 7.3.
- Her paket sonunda yeni screenshot seti alinmali.
- Her paket sonunda `PROGRESS.md` durust kanitla guncellenmeli.
- Yeni ozellik ekleme refleksi kontrol edilmeli; bu fazin ana isi sadeleme, hizalama ve guven onarimi.
- Normal user surface'te developer/operator/debug dili bulunmamali.
- Runa'nin desktop capability farki gosterilmeli, ama savunmaci metinlerle anlatilmamali.

## Bu Faz Bitince Ne Durumda Olacagiz?

UI-OVERHAUL-07 tamamlandiginda:

- Runa'nin ilk izlenimi kirik/demo/internal his vermeyecek.
- Ana chat yuzeyi rakiplerle ayni urun kategorisinde gorunecek.
- Composer ve approval akisi trust-first, sade ve kullanilabilir olacak.
- Devices, History ve Account yuzeyleri admin panel degil, consumer-grade urun yuzeyi gibi davranacak.
- Developer/capability preview gibi edge yuzeyler normal kullanicidan izole olacak.
- Renk, spacing, typography, border ve copy dili tek kurala baglanacak.
- Bundan sonraki UI isleri bu dilin uzerine eklenecek; sifirdan tartisilmayacak.

UI-OVERHAUL-07 sonrasinda kalan isler daha cok:

- gercek kullanici testleri,
- mikro polish,
- yeni ozelliklerin bu dile uygun eklenmesi,
- visual regression ve accessibility guardrail'larini guclendirme,
- tasarim sistemini uzun vadede koruma

olacak.
