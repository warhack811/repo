# UI-OVERHAUL-07.5 - Secondary Surfaces Reframe Uygulama Promptu

Bu prompt, `docs/archive/ui-overhaul/UI-OVERHAUL-07.md` icindeki gercek `7.5 - Secondary Surfaces Reframe` gorevini uygulamak icindir. Amac; History, Devices ve Account/Settings yuzeylerini debug/admin hissinden cikarip sade, guven veren, consumer-grade urun yuzeyleri haline getirmektir.

Tahmin yapma. Once repo icindeki gercek dosyalari oku, mevcut davranisi dogrula, sonra degisiklik yap. Kapsam disi bir davranisa ihtiyac duyarsan uygulamadan once bunu acikca not et.

## Kaynak Gercekler

Source of truth:

- `docs/archive/ui-overhaul/UI-OVERHAUL-07.md`
- Ilgili bolum: `7.5 - Secondary Surfaces Reframe`

7.5 kapsaminda istenenler:

- History: sade kronolojik sohbet listesi, arama, bos state; debug counter/warning yok.
- Devices: tek primary device connection story; 3 redundant felsefe karti yok.
- Account: tek baslik, kisa profil/oturum bilgisi, az tekrar.
- Settings tab sayisi azaltilsin; hazir olmayan Project Memory gizlensin.
- Mobile bottom nav 2x2 grid yerine yatay tek satir nav olsun.
- Mobile header yuksekligi dusurulsun; esas icerik ilk viewport'ta gorunsun.

Done kriterleri:

- Her secondary surface'te kart sayisi ve copy tekrar sayisi belirgin azalir.
- Devices Runa'nin desktop capability ayrisma noktasini savunmaci degil, guven veren sekilde anlatir.

Onceki tamamlanan paketlerden korunmasi gerekenler:

- 7.1: demo/dev/internal/debug dil normal user surface'te gorunmemeli.
- 7.2: chat-first ana yuzey ve composer davranisi bozulmamali.
- 7.3: approval state feedback ve mobile approval/composer ayrimi bozulmamali.
- 7.4: developer/operator hard isolation geri alinmamali; `/developer*` normal user akisi icinden tekrar acilmamali.

## Mevcut Dosya Haritasi

Once bu dosyalari oku ve mevcut durumu netlestir:

- `apps/web/src/pages/HistoryPage.tsx`
- `apps/web/src/pages/HistoryRoute.tsx`
- `apps/web/src/pages/DevicesPage.tsx`
- `apps/web/src/components/desktop/DevicePresencePanel.tsx`
- `apps/web/src/hooks/useDesktopDevices.ts`
- `apps/web/src/lib/desktop-devices.ts`
- `apps/web/src/pages/SettingsPage.tsx`
- `apps/web/src/components/auth/ProfileCard.tsx`
- `apps/web/src/components/app/AppShell.tsx`
- `apps/web/src/components/app/AppNav.tsx`
- `apps/web/src/styles/routes/app-shell-migration.css`
- `apps/web/src/styles/routes/history-migration.css`
- `apps/web/src/styles/routes/devices-migration.css`
- `apps/web/src/styles/routes/desktop-device-presence-migration.css`
- `apps/web/src/styles/routes/settings-migration.css`
- `apps/web/src/localization/copy.ts` veya mevcut copy kaynagi nerede ise onu.

Test ve kanit dosyalari icin once mevcut patternleri incele:

- `apps/web/src/pages/FirstImpressionPolish.test.tsx`
- `apps/web/src/pages/OperatorDeveloperIsolation.test.tsx`
- `apps/web/src/components/desktop/DevicePresencePanel.test.tsx`
- `apps/web/tests/visual/ui-overhaul-07-2-smoke.spec.ts`
- `apps/web/tests/visual/ui-overhaul-07-3-smoke.spec.ts`
- `apps/web/tests/visual/ui-overhaul-07-4-isolation.spec.ts`

## Mutlak Kapsam Disi

Bu gorevde sunlari yapma:

- Server contract, auth contract, websocket contract, desktop-agent protocol veya provider davranisi degistirme.
- Yeni dependency ekleme.
- `/developer*`, Capability Preview veya internal QA yuzeylerini normal nav'a geri koyma.
- Project Memory yuzeyini user-facing sekilde geri acma.
- 7.6 visual discipline pass'i komple yapma; yalnizca 7.5 icin gerekli sade layout/CSS duzeltmelerini yap.
- Cmd+K, command palette, microinteraction inventory veya 7.8 power-user polish ekleme.
- Copy voice icin tum uygulamayi bastan yazma; sadece History, Devices, Account/Settings ve shell/nav icin gerekli metinleri sadele.

## Uygulama Ilkeleri

- Mevcut component, hook, route ve test patternlerini kullan.
- Kullanici yuzeyinde internal taxonomy gostermemeye devam et: `developer`, `operator`, `status badge`, `capability preview`, `phase`, `dev@runa.local`, raw connection id, raw tool name ve debug hata metinleri normal akista gorunmemeli.
- Sadelestirme davranis kaybi olmamali: arama, liste secimi, refresh, logout, theme tercihi, voice tercihi gibi mevcut user-facing kontroller korunmali.
- Kart icinde kart hissini azalt. Yuzeyleri tek ana bolum + az sayida gerekli kontrol seklinde kur.
- Mobile icin ilk viewport onemli: header ve nav, asil icerigi itmemeli.
- Buton, input, nav ve focus davranislari erisilebilir kalmali.

## Uygulama Adimlari

### 1. Baseline ve Sizinti Haritasi

Kod degistirmeden once su aramalari yap:

- User-facing metinlerde `developer`, `operator`, `dev@`, `capability preview`, `debug`, `unsupported`, `Desteklenmeyen`, `Project Memory`, `phase`, `Bu fazda`, `Connection ` ve raw desktop tool/capability stringlerini ara.
- History, Devices, Account/Settings route'larinda kart sayisini, tekrar eden heading/subtitle/chip sayisini ve mobile header/nav davranisini not et.
- Mevcut testlerin hangi guardrail'leri sagladigini belirle.

Beklenen cikti: Kendi calisman icin kisa bir not; hangi dosyalar degisecek ve neden.

### 2. History Reframe

Hedef:

- History yuzeyi bir debug listesi degil, sade sohbet gecmisi gibi gorunmeli.
- Temel islevler: kronolojik liste, arama, bos state, secili konusmaya gecis.

Yap:

- Hero veya panel copy'sini tek ana amaca indir: gecmis sohbetleri bulma ve devam etme.
- Debug counter/warning hissi veren chipleri, teknik role/access bilgilerini ve raw hata metinlerini kaldir.
- Arama inputunu koru; sonuclar bos ise sade empty state goster.
- Conversation item'larda kullanici icin anlamli bilgiler kalsin: baslik, kisa onizleme veya tarih. Internal role/access alanlari normal gorunumde yer almasin.
- API yaniti beklenen formatta degilse user-facing debug string gosterme; sakin, genel bir error/empty state kullan.
- Kronoloji sade kalsin. Gruplama varsa gercek kullaniciya faydali ve kisa olmali; aksi halde tek listeye indir.

Test:

- History arama ve bos state korunur.
- Invalid/unsupported response user-facing debug metni gostermez.
- Conversation item icinde `operator`, `developer`, raw access role veya debug warning gorunmez.

### 3. Devices Reframe

Hedef:

- Devices yuzeyi tek bir primary story anlatmali: Runa bilgisayarina baglaninca dosya/masaustu yeteneklerini guvenle kullanabilir.
- Savunmaci veya tekrarli felsefe kartlari olmamali.

Yap:

- `DevicesPage.tsx` ve `DevicePresencePanel.tsx` birlikte sade bir akisa indir.
- Ust bolum: tek baslik, kisa destek metni, gerekirse tek durum aksiyonu.
- Bagli cihaz varsa birincil cihaz karti/paneli goster: cihaz adi, baglanti durumu, son gorulme gibi kullaniciya anlamli bilgiler.
- Cihaz yoksa sakin empty state goster; kullaniciyi suclayan veya sistemin hazir olmadigini savunan metin kullanma.
- Error/loading state'ler kisa ve guven verici olsun.
- Normal user surface'te raw `Connection {id}`, raw websocket detaylari, raw tool/capability id'leri veya internal status taxonomy gosterme.
- Teknik detay gerekiyorsa normal akistan kaldir; developer/internal yuzey olmadikca details icine bile raw id koyma.
- Mevcut desktop device hook ve lib sozlesmesini bozma.

Test:

- No-device, loading, error ve connected-device durumlari render edilir.
- Connected device normal yuzeyinde raw connection id veya raw tool name gorunmez.
- Devices sayfasinda redundant felsefe kartlari/tekrarli copy yoktur.

### 4. Account/Settings Reframe

Hedef:

- Account/Settings yuzeyi tek hesap alani gibi hissettirmeli: profil, oturum, temel tercihler.
- Repetition, metric-card kalabaligi ve hazir olmayan alanlar azaltir.

Yap:

- `SettingsPage.tsx` icinde mevcut 7.4 izolasyonunu koru: developer tab/link yok.
- Settings tab sayisi az kalsin. Mevcut durumda `account` ve `preferences` varsa bu siniri koru veya daha sade ise tek sayfa/iki bolum yap.
- Project Memory normal user surface'te gorunmesin.
- `ProfileCard.tsx` tekrar eden metric kartlari ve bagli kimlikler kalabaligini sadelestir:
  - Bir profil ozeti.
  - E-posta veya kullanici adi.
  - Oturum/giris yontemi gibi tek kisa bilgi.
  - Logout aksiyonu korunur.
- Theme ve voice tercihleri korunur ama copy tekrar etmez.
- Placeholder/dev email veya fake identity gorunmemeli.

Test:

- Account yuzeyi developer/project memory entry point gostermez.
- Profil/oturum bilgisi render edilir.
- Logout kontrolu korunur.
- Preferences kontrolleri korunur.

### 5. Mobile Nav ve Header

Hedef:

- Mobile bottom nav 2x2 grid yerine yatay tek satir nav olmali.
- Secondary surface header daha kisa olmali; asil icerik ilk viewport'ta gorunmeli.

Yap:

- `AppNav.tsx` semantigini koru; gerekirse CSS ile mobile davranisi duzelt.
- `app-shell-migration.css` icinde mobile breakpoint ekle veya mevcut breakpointleri duzenle:
  - 4 nav item tek satir yatay dizilsin.
  - Label okunabilir kalsin.
  - Description mobile'da gizlenebilir veya kisaltilabilir.
  - Nav item'lar sabit/yeterli min boyutta olsun, layout shift yapmasin.
- `AppShell.tsx` header hiyerarsisini bozma, ama CSS ile secondary header padding/gap/font boyutlarini mobile'da azalt.
- Header/nav asil route icerigini mobile ilk viewport disina itmemeli.
- Horizontal overflow, text overlap ve nav wrapping olmamali.

Test:

- Mobile viewport `390x844` icin history/devices/account ekranlarinda nav tek satirdir.
- Header sonrasi asil icerik gorunur.
- Text overlap veya horizontal overflow yoktur.

### 6. Visual/Test Kaniti

Unit/component test ekle veya mevcut testleri genislet:

- Onerilen yeni test dosyasi: `apps/web/src/pages/SecondarySurfacesReframe.test.tsx`
- Bu testte History, Devices ve Account/Settings icin regression guardrail'ler yer alsin.

Playwright visual/smoke test ekle:

- Onerilen dosya: `apps/web/tests/visual/ui-overhaul-07-5-secondary-surfaces.spec.ts`
- Desktop ve mobile icin en az:
  - `/history`
  - `/devices`
  - `/account`
- Assertion ornekleri:
  - Mobile nav item'lari tek satirdadir.
  - Developer/operator/project memory/debug stringleri gorunmez.
  - Devices yuzeyinde raw connection id gorunmez.
  - Account tab sayisi azaltildi ve developer tab yoktur.
  - Ana icerik mobile ilk viewport icinde baslar.

Test fixture gerekiyorsa mevcut Playwright setup patternlerini takip et. Fake veri uretirken bunun yalnizca test fixture oldugu koddan anlasilmali; user-facing placeholder olarak app icine koyma.

### 7. Dogrulama Komutlari

Degisikliklerden sonra sirasiyla calistir:

```powershell
pnpm.cmd --filter @runa/web test
pnpm.cmd --filter @runa/web typecheck
pnpm.cmd --filter @runa/web lint
pnpm.cmd --filter @runa/web build
pnpm.cmd run style:check
pnpm.cmd run manifesto:check
```

Targeted Playwright:

```powershell
pnpm.cmd exec playwright test apps/web/tests/visual/ui-overhaul-07-5-secondary-surfaces.spec.ts --config apps/web/playwright.config.ts
```

Riskli CSS/nav degisikligi yapildiysa full e2e de calistir:

```powershell
pnpm.cmd test:e2e
```

Not: Vite dev/test teardown sirasinda beklenen websocket proxy kapanis loglari filtrelenmis olabilir. Test sonucu exit code ve assertion durumunu esas al.

### 8. Progress Guncellemesi

Uygulama tamamlaninca `docs/PROGRESS.md` icine kisa ve kanitli bir 7.5 kaydi ekle:

- Hangi yuzeyler sadelesti.
- Hangi internal/debug leakage kapatildi.
- Hangi mobile nav/header davranisi dogrulandi.
- Hangi komutlar basariyla calisti.

## Kabul Kriterleri

Bu gorev ancak su kosullar saglanirsa tamamdir:

- Normal kullanici History, Devices ve Account/Settings yuzeylerinde internal/dev/operator/debug dili gormez.
- History sade sohbet gecmisi gibi davranir: liste, arama, empty/error state.
- Devices tek primary device connection story anlatir ve raw teknik detaylari user-facing yapmaz.
- Account/Settings tek hesap/tercih yuzeyi gibi kalir; developer ve Project Memory entry point yoktur.
- Mobile nav 4 item'i tek yatay satirda tasir; 2x2 grid davranisi kalmaz.
- Mobile secondary header daha kisa olur ve asil icerik ilk viewport'ta gorunur.
- Unit/component ve Playwright guardrail'leri eklenir veya guncellenir.
- Tum dogrulama komutlari gecmistir ya da gecmeyen komut icin net, repo-disindan kaynaklanan blokaj yazilmistir.

## Final Rapor Formati

Uygulamayi bitiren ajan finalde sunlari kisaca raporlamali:

- Degisen ana dosyalar.
- History/Devices/Account icin davranis ozeti.
- Mobile nav/header kaniti.
- Calisan test ve build komutlari.
- Varsa bilincli olarak kapsam disi birakilan konu.
