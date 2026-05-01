# Runa Competitive Chat UX Implementation Prompts

> Amaç: Runa ana ürün yüzeyini rakiplerin chat-native, mobil uyumlu ve onay odaklı deneyim seviyesine yaklaştırmak. Bu belge, IDE LLM'ye sırayla verilecek uygulama promptlarını içerir. Her prompt tek başına uygulanabilir olmalı; bir adım bitmeden sonraki adıma geçilmemelidir.

## Görsel İnceleme Özeti

Kullanıcı ekran görüntülerinde üç ayrı problem sınıfı görünüyor:

1. **Güven ve ilk giriş problemleri**
   - Login ekranı 502 ve Supabase credential hatalarını ham teknik metin olarak gösteriyor.
   - `{"statusCode":400,"error":"Bad Request","message":"Invalid login credentials"}` gibi JSON hata metinleri ürün dilini bozuyor.
   - Kullanıcı yerel deneme oturumu ile girebiliyor; bu geliştirici akışı saklı kalmalı ama hata metni kullanıcıyı doğru aksiyona yönlendirmeli.

2. **Chat yüzeyi ürün hissi problemi**
   - Runa ekranı fazla kartlı, fazla başlıklı ve operatör paneli hissinde.
   - Üstteki büyük nav kartları ilk viewport'u tüketiyor.
   - "Sohbet akışı", "Çalışma durumu", "Mevcut çalışma", "Canlı çalışma", "Kayıtlı mesajlar" gibi başlıklar sohbetin doğal akışını bölüyor.
   - Kullanıcı ve Runa mesajları tek bir WhatsApp/Claude Code benzeri zaman çizgisi gibi akmıyor.
   - Composer ayrı bir panel gibi görünüyor; rakiplerde ise mesaj giriş alanı konuşmanın doğal devamı.

3. **Onay ve ilerleme sunumu problemi**
   - Mevcut onay kartı geniş, grid tabanlı ve teknik bir form gibi görünüyor.
   - Rakiplerde onay mekanizması daha küçük alanda daha fazla karar bağlamı veriyor: ne yapılacak, hangi komut/hedef, risk nedir, hangi kararlar var.
   - Rakiplerde ara durumlar doğal dilde akıyor: "Loaded tools", "Running command", "Bu komut otomatik geçti..." gibi ajan anlatımı sohbet gövdesine entegre.
   - Mobilde onay kartı ve composer aynı mental modeli koruyor; Runa mobilde çok fazla dikey boşluk ve kart katmanı riski taşıyor.

## Hedef Deneyim İlkeleri

- Ana ekran chat-first kalmalı; dashboard veya operator console hissine dönmemeli.
- Varsayılan kullanıcı yüzeyinde developer/runtime/transport dili görünmemeli.
- Mesaj akışı tek bir zaman çizgisi olmalı: kullanıcı balonu, Runa anlatımı, araç durum satırı, kompakt onay kartı.
- Onay kartı sohbet içinde karar bloğu gibi davranmalı; ayrıntılar ikinci katmanda açılmalı.
- Enter mesaj göndermeli, Shift+Enter yeni satır açmalı, IME composition bozulmamalı.
- Auth hataları kullanıcı diline çevrilmeli; ham JSON veya 5xx teknik cümleleri görünmemeli.
- Mobil ve masaüstü aynı ürün modelini korumalı; sadece yoğunluk ve yerleşim değişmeli.
- Yeni dependency eklenmemeli. Mevcut React, CSS, lucide ve shared contract sınırları korunmalı.

## Prompt 01 - Auth Hata Dili ve Composer Enter Davranışı

### Bağlam

Kullanıcı `pnpm dev` sonrası login ekranında 502, giriş denemesinde raw JSON invalid credentials hatası görüyor. Chat composer içinde Enter mesaj göndermiyor.

### Dosyalar

- `apps/web/src/lib/auth-client.ts`
- `apps/web/src/hooks/useAuth.ts`
- `apps/web/src/pages/LoginPage.tsx`
- `apps/web/src/components/chat/ChatComposerSurface.tsx`
- İlgili web testleri

### Görev

1. Auth response hatalarını kullanıcı dostu metne çevir.
   - Invalid credentials: e-posta/şifre hatalı metni.
   - 502/503/504 veya fetch/proxy failure: auth servisine ulaşılamıyor metni.
   - Raw JSON response gövdelerini parse et ve sadece anlamlı mesajı göster.
   - Ham JSON, stack, status object veya backend teknik payload'u LoginPage'de görünmesin.
2. Login formuna basit erişilebilirlik iyileştirmesi ekle.
   - Hata alanı `role="alert"` olarak kalsın.
   - Mesaj, kullanıcıyı "bilgileri kontrol et" veya dev ortamdaysa "yerel deneme oturumu" aksiyonuna yönlendirsin.
3. Composer textarea için keyboard submit ekle.
   - Enter: form submit.
   - Shift+Enter: yeni satır.
   - `event.nativeEvent.isComposing` veya `event.isComposing` durumunda submit etme.
   - Prompt boş ve attachment yoksa submit etmeye zorlama.
   - Disabled durumda Enter hiçbir şey göndermesin.
4. Test ekle/güncelle.
   - Login raw JSON invalid credentials metni kullanıcı dostu metne dönmeli.
   - Composer Enter submit çağırmalı; Shift+Enter çağırmamalı.

### Kabul Kriterleri

- Login ekranında raw JSON hata metni görünmez.
- 502 durumunda anlaşılır servis erişim problemi görünür.
- Enter ile mesaj gönderilir; Shift+Enter newline davranışı korunur.
- `pnpm.cmd --filter @runa/web test`, `typecheck`, `lint` yeşil veya task-local sonuç net raporlanır.

## Prompt 02 - Chat Shell'i Panelden Zaman Çizgisine Taşı

### Bağlam

Runa chat ekranı büyük nav kartları, nested card görünümleri ve "çalışma" başlıkları yüzünden rakiplerin sade chat-native yüzeyinden uzak.

### Dosyalar

- `apps/web/src/components/app/AppShell.tsx`
- `apps/web/src/components/app/AppNav.tsx`
- `apps/web/src/components/chat/ChatHeader.tsx`
- `apps/web/src/components/chat/ChatLayout.tsx`
- `apps/web/src/components/chat/CurrentRunSurface.tsx`
- `apps/web/src/components/chat/PresentationRunSurfaceCard.tsx`
- `apps/web/src/components/chat/PersistedTranscript.tsx`
- `apps/web/src/styles/components.css`
- `apps/web/src/styles/routes/chat-migration.css`

### Görev

1. Chat route üzerindeki üst nav kartlarını ilk viewport'u tüketmeyecek hale getir.
   - Masaüstünde compact nav veya ikon ağırlıklı yatay bar.
   - Mobilde bottom nav korunabilir ama chat composer ile çakışmamalı.
2. `CurrentRunSurface` ana gövdesini kart/panel yerine transcript timeline olarak sun.
   - "Sohbet akışı" başlığı varsayılan durumda görünmesin.
   - "Çalışma durumu", "Mevcut çalışma", "Canlı çalışma" gibi product dışı çerçeve metinlerini kaldır veya yalnızca developer mode'a taşı.
3. Persisted transcript'i varsayılan akışın parçası yap.
   - Kullanıcı mesajı sağ balon.
   - Runa mesajı sol/ana metin bloğu.
   - Timestamp küçük ve ikincil.
4. Composer'ı ayrı kart gibi değil, docked chat input gibi göster.
   - Masaüstünde geniş ama kompakt.
   - Mobilde güvenli alanlara saygılı.

### Kabul Kriterleri

- İlk viewport chat akışını ve composer'ı gösterir; nav yüzeyi baskın olmaz.
- Varsayılan kullanıcı yüzeyinde operator/debug başlıkları görünmez.
- Kullanıcı/Runa mesajları tek bir konuşma akışı gibi görünür.
- Mobilde composer, nav ve onay kartı üst üste binmez.

## Prompt 03 - Doğal Dil İlerleme Akışı

### Bağlam

Rakiplerde ajan ara durumları sohbet içine doğal dil olarak akıtıyor. Runa'da progress paneli teknik ve kartlı görünüyor.

### Dosyalar

- `apps/web/src/lib/chat-runtime/current-run-progress.ts`
- `apps/web/src/components/chat/RunProgressPanel.tsx`
- `apps/web/src/components/chat/ThinkingBlock.tsx`
- `apps/web/src/components/chat/ToolActivityIndicator.tsx`
- `apps/web/src/styles/routes/chat-migration.css`

### Görev

1. Varsayılan kullanıcı modunda progress panelini compact activity line olarak göster.
   - Örnek: "Araçları hazırlıyorum", "Komutu çalıştırıyorum", "Onay bekliyorum".
   - Teknik phase/meta chip'leri sadece developer mode'da kalsın.
2. Tool activity'yi küçük, collapsible satırlar halinde göster.
   - "Running command", "Read file", "Created file" gibi kısa label.
   - Ayrıntı istemeden full payload gösterme.
3. Ajan anlatımıyla çakışmayacak şekilde streaming response ve progress aynı timeline'a otursun.

### Kabul Kriterleri

- Varsayılan kullanıcı modunda büyük progress kartı yerine doğal, kompakt satırlar görünür.
- Developer mode diagnostic verileri korunur.
- Onay bekleme durumu sohbet içinde açıkça anlaşılır.

## Prompt 04 - Kompakt Chat-Native Approval Card

### Bağlam

Mevcut onay kartı çok geniş, grid-heavy ve teknik. Rakiplerde karar kartı daha küçük, daha açıklayıcı ve mobilde daha ergonomik.

### Dosyalar

- `apps/web/src/components/chat/blocks/ApprovalBlock.tsx`
- `apps/web/src/components/chat/blocks/BlockRenderer.module.css`
- `apps/web/src/styles/routes/chat-migration.css`
- Onay block testleri

### Görev

1. Approval card içeriğini compact karar modeline çevir.
   - Başlık: "Runa bunu çalıştırmak istiyor" veya hedefe göre doğal başlık.
   - Alt açıklama: ne yapılacak ve neden izin istiyor.
   - Hedef/komut: tek satırlık code veya compact target row.
   - Risk: kısa, ikincil metin.
2. Butonları kompakt ve karar odaklı yap.
   - Reddet, Onayla veya "Bir kez izin ver" modeli.
   - Klavye ipuçları sadece gerçekten destekleniyorsa göster.
3. Ayrıntıları disclosure içine taşı.
   - Tool name, call id, ham payload, developer metadata sadece ikinci katmanda.
4. Mobil davranışı iyileştir.
   - Kart viewport'u boğmasın.
   - Butonlar 2 kolon veya küçük ekranda tek kolon olabilir.

### Kabul Kriterleri

- Approval kartı desktop ve mobile'da daha az dikey alan kaplar.
- Kullanıcı karar için gerekli bağlamı tek bakışta görür.
- Developer ayrıntıları varsayılan ekranda görünmez.
- Pending/approved/rejected durumları açık ve görsel olarak ayırt edilir.

## Prompt 05 - Mobil Yoğunluk ve Görsel Kanıt

### Bağlam

Rakip ekran görüntüleri masaüstü ve mobilde aynı mental modelin korunduğunu gösteriyor.

### Dosyalar

- Chat ve approval CSS dosyaları
- Playwright/e2e görsel testleri
- Screenshot artifact klasörü

### Görev

1. 390px mobil, 768px tablet ve 1440px desktop viewport'larında chat ekranını doğrula.
2. Aşağıdaki state'lerin screenshot'larını al:
   - Login auth error.
   - Boş chat.
   - Mesaj gönderilmiş chat.
   - Progress çalışıyor.
   - Approval pending.
3. Görsel inceleme yap.
   - Text overlap yok.
   - Composer/nav/approval çakışmıyor.
   - İlk viewport chat-first.
   - Approval rakip seviyesine yaklaşmış mı?
4. Eksik varsa aynı adım içinde CSS/component düzeltmesi yap ve tekrar screenshot al.

### Kabul Kriterleri

- Desktop ve mobile screenshot artifact'leri kaydedilir.
- Console'da kritik frontend error yok.
- Test raporunda kalan riskler açıkça belirtilir.

## Prompt 06 - Final Competitive Polish Pass

### Bağlam

İlk uygulama sonrası hala rakiplerden belirgin şekilde geride kalan alanlar varsa son polish pass yapılır.

### Görev

1. Screenshot'ları rakip örnekleriyle tekrar kıyasla.
2. Eksikleri P0/P1 olarak sınıflandır.
3. P0 görsel ve etkileşim eksiklerini uygula.
4. `PROGRESS.md` içine dürüst kapanış kaydı ekle.

### Kabul Kriterleri

- Kritik kullanılabilirlik sorunları kapalı.
- Görsel kalite hedefi için kalan işler dürüstçe listeli.
- Test ve screenshot kanıtları raporda yer alıyor.
