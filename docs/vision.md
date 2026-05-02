# Runa Vision

## 1. Runa nedir?

**Runa, projenizi tanıyan, bağlamı oturumlar arasında taşıyan ve proje içinde güçlü işler yapabilen bir AI çalışma ortağıdır.**

Kısa dış cümle:
**Her seferinde sıfırdan başlamaz.**

---

## 2. Neden varız?

Bugünün AI araçları güçlüdür, ama çoğu kullanıcıyı aynı probleme geri iter:

- her yeni oturumda projeyi yeniden anlatmak,
- dosyaları yeniden göstermek,
- kuralları yeniden hatırlatmak,
- bağlamı tekrar kurmak,
- aynı işi tekrar tekrar başlatmak.

Runa’nın varlık nedeni, bu kırılmayı çözmektir.

Runa yalnızca cevap veren bir model olmak istemez.  
Runa, zaman içinde kullanıcıyla birlikte çalışan, projeyi tanıyan ve giderek daha faydalı hale gelen bir çalışma ortağı olmayı hedefler.

---

## 3. Kimin için yapıyoruz?

### Katmanlı Persona Modeli
Runa, en basit kullanıcıdan üst seviye teknik kişilere kadar hitap etmeyi hedefler.

**1. Çekirdek Kullanıcı (Solo Developer / Teknik Kurucu):**
- Aktif kod yazar, aynı proje üzerinde her gün çalışır.
- Context kaybından nefret eder, agent'tan otonom iş ilerletmesini bekler.

**2. Genel Teknik Kullanıcı:**
- Sade, kullanışlı ve kaliteli bir arayüz bekler (ChatGPT / Claude kalibresinde).
- Desktop'taki bir pencereyi okumasını, ekrandan bilgi alıp işlem yapmasını (uzaktan kontrol) ister.

**3. Küçük Teknik Ekipler (Phase 3 Hedefi):**
- Ekip belleğine ortak erişim ihtiyacı.

---

## 4. Çözdüğümüz temel problem

Runa’nın çözdüğü temel problem şudur:

> Güçlü AI araçları vardır, ama çoğu proje bağlamını yeterince taşımaz; kullanıcı her oturumda aynı zemini yeniden kurmak zorunda kalır.

Bizim hedefimiz:
- bağlamı taşımak,
- proje sürekliliği sağlamak,
- gerçek iş yükünü azaltmak,
- doğal dil ile proje içinde güvenilir ilerleme yaratmaktır.

---

## 5. İlk ürün vaadimiz

Core Hardening (Phase 2) ile Runa’nın vaadi şudur:

> **Runa, basit kullanıcıdan teknik uzmana kadar herkesin kullanabileceği, bulut tabanlı çalışan, ancak yerel bilgisayarınızı da (desktop agent) uzaktan kontrol edebilen ve otonom iş ilerletebilen bir AI çalışma ortağı olacaktır.**

Bu “iyi sohbet eden bir model” vaadi değildir.  
Bu, “hem cloud gücünü hem local kontrolü birleştiren otonom bir agent” vaadidir.

---

## 6. Ürün ilkelerimiz

### 6.1 Simple surface, deep capability
Runa’nın görünen yüzü sade, modern ve düşük sürtünmeli olacaktır.  
Derin capability arka planda saklanmayacak, ama kullanıcıya karmaşıklık olarak da yüklenmeyecektir.

### 6.2 Assistant-first, agent-capable
Runa ilk temas anında bir yardımcı gibi görünmelidir;  
gerektiğinde güçlü agent davranışı gösterebilmelidir.

### 6.3 Tek çekirdek, farklı yoğunluklar
Runa’da ayrı “casual chat motoru” ve ayrı “agent motoru” olmayacaktır.  
Tek runtime üstünde hafif, standart ve derin çalışma profilleri bulunacaktır.

### 6.4 Context is product
Runa’nın farkı yalnızca model kalitesi değil; bağlamı nasıl tuttuğu, taşıdığı ve kullandığı olacaktır.

### 6.5 Memory yardımcı değil, değer üreticidir
Memory yalnızca geçmişi saklamak için değil; kullanıcının ve projenin sürekliliğini sağlamak için vardır.

### 6.6 Güç görünür ama korkutucu olmayacak
Power-user capability, karmaşık veya ağır bir arayüz olarak değil; gerektiğinde açılabilen derinlik olarak sunulacaktır.

---

## 7. Phase 2 (Core Hardening) Vizyonu

MVP aşamasını tamamladıktan sonra odaklandığımız Core Hardening (Phase 2) deneyimi:

- **Otonom Çalışma:** Tek oyunluk turlar yerine, auto-continue ile işi bitirene kadar çalışan, aralarda durup devam edebilen (checkpoint) ve hatalarını kendi kendine düzeltebilen (self-repair) agentic bir döngü.
- **Dirençli Altyapı:** Modelin bozuk çıktılarını (invalid JSON) otomatik yakalayıp düzelten `Tool Call Repair Recovery` ile kesintisiz ilerleme.
- **Bulut ve Yerel Birleşimi (Cloud-First Hybrid):** Supabase ile güvence altına alınmış bir auth/DB katmanı ve Windows bilgisayarı kontrol edebilen sessiz bir desktop agent'ın birleşimi.
- **Premium UX:** Rakipler seviyesinde (ChatGPT, Claude) sade, kullanışlı, şık ve animasyonlu "consumer-grade" bir arayüz.
- **Gelişmiş Kontrol:** "Kullanıcının açık olan ekranını gör, masaüstüne müdahale et" vizyonunu gerçekleştirecek desktop tool'ları.

Başarılı bir Phase 2 deneyimi şu hissi vermelidir:

> “Runa sadece projemdeki kodu anlamakla kalmıyor; ben kahvemi alırken buluttan yerel bilgisayarıma bağlanıp işleri otonom olarak ilerletiyor ve bunu premium bir arayüzle yapıyor.”

---

## 8. Phase 2'de ne yapmayacağız?

Aşağıdakiler stratejik olarak önemlidir, ancak **şimdilik odağımızda değildir**:

- image generation / image editing
- local media model inference yürütme
- mobil uygulama (ilk etapta web SPA yeterli)
- multi-user collaboration (ekipler)
- marketplace düzeyinde açık extension ekosistemi

Bu alanlar Phase 3 ve sonrası için hedeflenmiştir.

---

## 9. Gündelik kullanım hakkında duruşumuz

Runa Phase 1’de casual sohbet ürünü olarak konumlanmayacaktır.  
Ama gündelik kullanım deneyimi kötü de olmayacaktır.

Hedefimiz:
- kısa ve doğal konuşmalarda akıcı olmak,
- hızlı yanıt vermek,
- kullanıcıyı robotik veya ağır bir deneyime zorlamamak,
- ama ürünün asıl farkını proje bağlamında derin çalışma tarafında yaratmaktır.

Kısaca:
**Casual competence, yes. Casual positioning, not yet.**

---

## 10. Neden şimdi?

AI pazarında modeller güçlenmiştir, ancak kullanıcıların gerçek iş akışına yerleşen, bağlamı taşıyan, güvenli ve uzun ömürlü çalışma ortakları hâlâ yeterince iyi değildir.

Bugün birçok araç:
- hızlı cevap verir,
- etkileyici demo yapar,
- ama kullanıcıyı her seferinde yeniden başlatır.

Runa’nın fırsatı burada doğar:
- güçlü runtime,
- context composer,
- memory,
- tool plane,
- güvenlik,
- veri yönetişimi,
- project continuity

birleştiğinde, kullanıcı için “tek tek iyi özellikler” değil, **süreklilik hissi** oluşur.

---

## 11. Bizi farklılaştıran şey

Runa’nın farklılaştırıcısı yalnızca “daha zeki model” olmak değildir.

Bizim hedef farkımız:
- projeyi tanıması,
- projeyi hatırlaması,
- oturumlar arasında bağlam taşıması,
- her seferinde sıfırdan başlamaması,
- sade yüz arkasında derin capability sunmasıdır.

Kısa ifade:
**Runa, her seferinde sıfırdan başlamayan AI çalışma ortağıdır.**

---

## 12. Başarıyı bu aşamada nasıl hissedeceğiz?

Phase 2 Core Hardening ile yönümüzü şu sinyallerle doğrulayacağız:

- Runa'nın UI deneyimi, basit bir kullanıcıda bile "premium ve akıcı" hissi uyandırır.
- Runa, kullanıcı tarafından verilen kompleks bir işi otonom döngüde kendi kendine yürütebilir.
- Buluttaki (Supabase) güvenli katmanlar, local desktop agent üzerinden bilgisayara başarıyla hükmeder.
- Free/Pro/Business şeklindeki subscription modeli test kullanıcıları için mantıklı bir değer önerisi sunar.

---

## 13. Uzun vadeli yön

Uzun vadede Runa (Phase 3 ve sonrası):
- Ekiplerin (multi-user collaboration) ana çalışma platformlarından biri olacak,
- Multimodal (görsel/işitsel) yetenekleriyle masaüstü deneyimini derinleştirecek,
- Kendi içindeki eklenti (marketplace/MCP) ekosistemi ile yeteneklerini geliştirebilecektir.

Ancak bu aşamada:
**cloud-first altyapı + premium UI + otonom agent runtime + desktop kontrolü** üzerinde kilitleniyoruz.

---

## 14. Son cümle

Runa’yı bir chatbot olarak değil,  
**zaman içinde projesini tanıyan, otonom çalışabilen ve uzak/yerel sınırlarını kaldıran premium bir AI çalışma ortağı** olarak inşa ediyoruz.
