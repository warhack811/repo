# Security Model

Bu belge, Runa'nin bugunku mimari guvenlik durusunu ozetler.
Production security audit'i degildir; mevcut MVP / post-MVP core'un hangi riskleri nasil ele aldigini ve hangi alanlarin henuz acik oldugunu belgeler.

Bu not, source scope ve principal scope etkileri nedeniyle `karar.md` Madde 11 ve Madde 12 ile birlikte okunmalidir.

## 1. Tehdit Yuzeyi

Runa'da dis dunyaya etki eden veya blast radius tasiyan baslica moduller / yuzeyler:

- **Cloud (Server):** 
  - `apps/server/src/auth/` (Supabase JWT/RLS enforcement)
  - `apps/server/src/ws/register-ws.ts`
  - `apps/server/src/runtime/request-approval.ts`
  - Provider adapters
- **Local (Desktop):**
  - `apps/desktop-agent/src/` (Sistem komutlari, ekran okuma, klavye yonetimi)
  - Desktop-spesifik tool execution (file/shell yonetimi)

Risk siniflari pratikte uc ana grupta toplanir:

- **read-only risk:** dosya okuma, arama, inspection, web search benzeri gorulebilir ama mutasyonsuz hareketler
- **write risk:** dosya duzenleme, patch uygulama, git mutasyonlari
- **execution risk:** shell komutu, arac zinciri veya yan etkisi yuksek aksiyonlar

Tehdit yuzeyi yalniz tool katmani degildir.
LLM output -> runtime karar zinciri -> tool cagrisi -> ws / approval etkilesimi birlikte ele alinmalidir.

## 2. Approval Gate'in Guvenlik Rolu

Approval gate, "model output execution degildir" ilkesinin bugunku MVP'deki temel guvenlik karsiligidir.

Bugunku kod-gerceginde:

- medium risk write aksiyonlari approval gerektirir
- high risk execution aksiyonlari approval gerektirir
- approval istemi runtime tarafinda merkezi olarak uretilir
- onay gelmeden mutasyonlu aksiyonlar final execute yoluna gecmez

Pratikte approval bekleyen aksiyonlar su risklerde devreye girer:

- dosya yazma
- patch / edit uygulama
- shell execution
- risk metadata'si `requires_approval = true` olan diger tool'lar

Approval gate bugun policy motorunun tam hali degildir; ama mutasyon ve execution riskini kullanici gorunurlugu altina cekerek ana blast radius daralticisidir.

## 3. Bugun Mevcut Olan Korumalar

Bugunku repo icinde gercekten mevcut olan korumalar:

- **risk level tagging**
  - tool metadata'si `risk_level`, `requires_approval`, `side_effect_level` alanlari tasir
- **approval manager / request flow**
  - runtime tarafinda approval istemi, waiting state ve resolve/replay zinciri vardir
- **idempotency key**
  - `file.write` ve `edit.patch` gibi effectful aksiyonlarda tekrar uygulamayi azaltan idempotency store/mechanism vardir
- **typed contracts**
  - tool, policy, gateway ve event akislari shared type kontratlariyla sinirlanir
- **summary-first visibility**
  - mutasyon veya approval davranisi kullanicidan tamamen gizli degildir; ws/presentation zincirinde gorunur olur
- **provider boundary abstraction**
  - model cagrisi dogrudan degil, `ModelGateway` uzerinden gecerek tek bir baglanti noktasinda toplanir

Bu korumalar production-hard security demek degildir; ama MVP seviyesinde "kontrolsuz model -> effect" akisini ciddi bicimde sinirlar.

## 4. Phase 2 Cloud-First & Desktop Etkisi

Yeni mimariyle guvenlik modeli su alanlara evrilmektedir:

- **Supabase Authentication:** Butun WS ve HTTP istekleri JWT token bazlidir, kullanicinin kendi DB tenant'i RLS ile izole edilir.
- **Desktop Agent Riskleri:** Windows-first agent'in sisteme otonom komut basabilme ve ekran okuma (screenshot, input injection) yetenekleri "high risk" sinifindadir ve explicit onaya dayali "progressive trust" ilkesini kullanir.
- **WSS Transport:** Tum ag eylemleri sifrelenir.
- **Object Storage Izolasyonu:** Payload'lar ve image block'lari RLS limitasyonlari uzerinden Storage'da tutulur.

Henuz tam anlamiyla asilmasi gereken guvenlik borclari:
- Tam on-premise kurumsal sandbox eksikligi
- Gelecekte planlanan web aramasindan dogabilecek prompt injection acikliklari
- Ileri seviye telemetry ve network monitoring eksikligi

Bu alanlarin acik oldugu acikca kabul edilmelidir; bugunku belge bunlari varmis gibi sunmaz.

## 5. LLM Prompt Injection Riski

Runa prompt injection riskine tamamen kapali degildir.
Ozellikle su durumlar risk tasir:

- kullanicinin okuttugu dosyalar
- repo icindeki talimat benzeri metinler
- gelecekte public-web / external source retrieval
- tool result preview'lari icine gomulmus yonlendirici metinler

Bugunku koruma seviyesi:

- model output dogrudan execution sayilmaz
- yuksek riskli aksiyonlar approval'a takilir
- summary-first / inspection-first gorunurluk sayesinde beklenmeyen davranis fark edilebilir

Bugunku acik:

- prompt injection'i otomatik siniflayan ayrik classifier yok
- public-web retrieval icin tam source trust policy enforcement MVP seviyesinde acik degildir
- retrieval ve prompt assembly arasinda daha formal hostile-content handling katmani henuz yoktur

## 6. Non-Goals

Bu belge su seyler degildir:

- production penetration test raporu
- compliance / certification dokumani
- tam enterprise security architecture pack'i
- tool bazli exhaustive threat model
- sandbox implementasyon plani

Bu belge, mevcut mimari durusu ve post-MVP icin acik kalan guvenlik borclarini baglam kaynagi haline getirir.
