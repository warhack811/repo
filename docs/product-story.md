# Product Story

## Runa nedir?

Runa, ayni islerin ve ayni projelerin etrafinda tekrar tekrar calisan insanlar icin tasarlanan bir AI calisma ortagidir.
Tek bir soru-cevap ekranindan fazlasini hedefler: yaptiginiz isi, onceki kararlarinizi ve calisma baglaminizi zaman icinde korumaya calisir.

Bugunku haliyle Runa, repo ve workspace gercegine daha yakin duran; ne yaptigini gosteren, gerekirse onay isteyen ve isi ilerletmeye odaklanan bir urun omurgasidir.
Ama amaci sadece "akilli chat" olmak degil; bir konuda tekrar geri dondugunuzde yeniden baslamaniza gerek birakmayan bir yardimci olmaktir.

## Hangi problemi cozer?

Bugun insanlar AI araclarini sik kullanmalarina ragmen ayni problemle tekrar karsilasiyor:
baglam dagiliyor.
Bir sohbet oturumu bitince kararlar, dosyalar, notlar, hangi adimin neden atildigi ve bir sonraki mantikli hareket tekrar kurulmak zorunda kaliyor.

Runa bu kopuklugu azaltmayi hedefler.
Kullanici acisindan problem "daha cok cevap" degil, "isi sureklilikle ilerletmek"tir.
Runa'nin degeri burada baslar:

- ayni proje veya konuya geri donebilmek
- neyin degistigini anlayabilmek
- gerekiyorsa onay verip kontrollu aksiyon almak
- onceki calismayi sifirdan toplamamak

## Kim icin?

Katmanlı Kullanıcı Modeli:

1. Çekirdek (Solo Developer):
- aktif kod yazar, AI'ı otonom bir araç olarak görmek ister
- projede bıraktığı yerden AI'ın devam etmesini (agentic loop) ister

2. Genel Teknik Kullanıcı:
- sade, premium bir günlük çalışma alanı ve masaüstünü uzaktan izleyip müdahale edebilen bir güç arar

Runa, tam olarak bu kullanicilarin "guncel is + guncel konusma + baglam surekliligi + otonom eylem" ihtiyacina odaklanir.

## Rakiplerden farki nedir?

Bugun ChatGPT Projects ve Gemini for Google Workspace gibi urun cizgileri, uzun sureli calismalari tek yerde tutma ve AI'yi gunluk uretkenlik akisina yaklastirma cizgisini guclendirdi.
Bu urunler kullaniciya "ayni konuya geri donebilme" hissi verir.

Runa'nin farki, bu surekliligi daha eylem-odakli ve daha workspace-dogruluklu bir zeminde kurmaya calismasidir.
Runa:

- yerel workspace / repo gercegine daha yakindan yaslanir
- approval-aware aksiyon mantigini merkeze alir
- sonuclari ve degisiklikleri summary-first gorunur kilmaya calisir

Bu, Runa'yi bugun daha teknik ve daha dar bir urun yapar.
Ama ayni zamanda "baglamli is ilerletme" tarafinda ayri bir karakter verir.

## Bugun neredeyiz (Phase 2 Gecisi)?

MVP asamasindan sonra Core Hardening (Phase 2) aktif durumdadir.

Somut olarak altyapisi atilan veya atilan adimlar:

- Otonom is ilerletme (async generator agentic loop)
- Desktop uzerinde eylemsellik (Windows desktop agent)
- Cloud-first hibrit guvenilir yapi (Supabase auth + RLS + Object Storage)
- Free/Pro/Business tier feature gating hazirliklari
- Premium consumer-grade UX planlamasi

Mevcut haliyle MVP'yi kucaklayan Runa, su an otonom Cloud-First gercekligina insa ediliyor.

## Yakin gelecekte neler gelecek (Phase 2 Odaklari)?

Core Hardening Phase 2 icin aktif alanlar:

- Agentic loop ile otonom, cok adimli calisma (auto-continue, checkpoint/resume)
- Cloud-first altyapi uzerinden guvenli websocket (WSS) baglantilari
- Desktop kontrol yetenekleri (ekran goruntusu alma, input basma)
- Kullanim hedeflerini sarmalayan yeni "premium" arayuz (UI decomposition)

## Neler yapmiyor / yapmayacak?

Bugun acik olmayan alanlar (Phase 3 ve sonrasi alanlar):

- aktif multi-provider routing veya otomatik failover (su an yayin oncesi statik belirlenecek)
- enterprise deployment / operator platformu (on-premise kurulumlar)
- capability packs ve MCP eklenti marketinin bitmis kullanici yuzeyi
- mobil app (native) gelistirme

Runa'nin hedefi her seyi yapmak degil.
Yaptigi seyi daha baglamli, daha otonom, daha guvenilir ve hem cloud hem local'i kapsayacak sekilde genisleterek gercekten sizin adiniza calisan "premium" bir guc haline getirmektir.
