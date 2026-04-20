# Runa — AI-Assisted Development Guide

## Bu belge nedir?

Bu belge, Runa projesinin IDE LLM'ler (Claude, GPT, Gemini vb.) ile nasıl geliştirileceğini tanımlar.
Hem yazılımcılar hem de LLM oturumları için çalışma disiplinini belirler.

---

## 1. Temel Sorun

IDE LLM'lerin doğası gereği şu sınırlamaları var:

- **Her oturum sıfırdan başlar** — önceki konuşmaları hatırlamaz
- **Context window sınırlı** — 2236 satırlık KARAR.MD'yi her seferinde tam okuyamaz
- **Dağınık istek = dağınık kod** — belirsiz prompt'lar tutarsız çıktı üretir
- **Pattern bilmez** — projede kurulu pattern'ı görmezse kendi yolunu icat eder

Bu yüzden belgeler tek başına yetmez. **LLM'in hızlıca doğru bağlama oturmasını sağlayan bir sistem** lazım.

---

## 2. Çözüm: AGENTS.md + Modül Rehberleri

### 2.1 AGENTS.md — Proje kimlik kartı

Repo kökünde bir `AGENTS.md` dosyası bulunmalıdır. Bu dosya:
- **Maksimum 200 satır** olmalı (LLM'in ilk okumasında tamamen işleyebileceği boyut)
- Her IDE LLM oturumunun **ilk okuması gereken** dosya
- Projenin kimliğini, kurallarını ve pattern'larını özetler

AGENTS.md şunları içermeli:

```markdown
# Runa — Agent Context

## Proje nedir?
Runa, projeyi tanıyan ve hatırlayan bir AI çalışma ortağıdır.
Detay: vision.md

## Mimari
- Monorepo: Turborepo + pnpm
- Backend: TypeScript + Node.js + Fastify
- Frontend: React + Vite
- DB: PostgreSQL + Drizzle
- Realtime: WebSocket
- LLM: ModelGateway interface → custom provider adapters
- State: Custom state machine (framework yok)
- Test: Vitest | Lint: Biome

## Kritik kurallar
1. Tüm modüller `packages/types` içindeki interface'leri kullanır
2. Yeni tip eklerken `packages/types` içindeki ilgili dosyayı güncelle
3. Event'ler `EventEnvelope` formatında olmalı (bkz: packages/types/events.ts)
4. Tool eklerken `ToolDefinition` interface'ini implement et (bkz: packages/types/tools.ts)
5. Render block eklerken `RenderBlock` union type'ına ekle (bkz: packages/types/blocks.ts)
6. State geçişleri `StateTransition` fonksiyonlarıyla, if/else zinciri ile değil
7. Model çağrısı doğrudan yapılmaz, ModelGateway üzerinden geçer
8. Büyük output'lar block içine gömülmez, artifact reference kullanılır
9. Tüm tool çağrıları loglanır (run_id, trace_id)
10. Test dosyaları: `*.test.ts`, aynı klasörde

## Klasör yapısı
apps/server/src/runtime/    → Agentic loop, state machine
apps/server/src/context/    → Context composer, compaction
apps/server/src/gateway/    → Model gateway, provider adapters
apps/server/src/policy/     → Permission engine, approval
apps/server/src/auth/       → Supabase auth middleware
apps/desktop-agent/src/     → Windows desktop daemon
apps/web/src/               → React frontend

## Mevcut sprint
[Sprint X] — [Track A/B/C] — [Hedef]
Aktif görevler: implementation-blueprint.md §8 Sprint X (Track Y)

## Mimari detaylar için
- KARAR.MD — Tam mimari anayasa (14 madde)
- implementation-blueprint.md — MVP scope ve sprint planı

## Kod pattern örnekleri
Yeni tool yazarken: apps/server/src/tools/file-read.ts örneğini takip et
Yeni render block: apps/server/src/presentation/blocks/text-block.ts örneğini takip et
Yeni event tipi: packages/types/events.ts içine ekle
```

### 2.2 Modül README'leri

Her ana modul klasorunun kendi kisa README'si olmasi idealdir:

```text
apps/server/src/runtime/README.md
apps/server/src/auth/README.md
apps/desktop-agent/src/README.md
```

Not: Bu README'ler bugun her modulde mevcut olmak zorunda degildir.
Eger ilgili modul README'si yoksa ilk baglam kaynagi olarak `AGENTS.md`, `README.md`, `PROGRESS.md` ve ilgili kod giris noktalari kullanilir.

Bu README'ler:
- O modülün ne yaptığını (2-3 cümle)
- Hangi KARAR.MD maddesine karşılık geldiğini
- Hangi interface'leri implement ettiğini
- Yeni eleman eklerken takip edilecek pattern'ı
- **Bu modül ne değildir** (sınır ihlallerini önlemek için)

Örnek "ne değildir" bölümü (`tools/README.md`):
```
## Bu modül ne DEĞİLDİR
- Tool registry, policy engine değildir — policy/ modülüne ait
- Tool, presentation üretmez — presentation/ modülüne ait
- Tool, memory yazmaz — memory/ modülüne ait
- Tool, doğrudan model çağrısı yapmaz — gateway/ modülüne ait
```

Bu anti-pattern bölümü, LLM'in o modüle ait olmayan kodu oraya yazmasını engeller.

---

## 3. LLM ile Çalışma Protokolü

### 3.1 Oturum başlatma — Her seferinde

Her yeni LLM oturumunun basinda su prompt'u verin:

```
Runa projesinde calisiyoruz.
Once su dosyalari oku:
1. AGENTS.md
2. PROGRESS.md
3. implementation-blueprint.md (aktif Track + Sprint bolumunu)
4. [calisacagin modulun README'si varsa, yoksa ilgili giris dosyalari]

Sonra [gorev tanimi].
```

Bu ilk okuma seti LLM'e yeterli baglami verir:
- AGENTS.md -> proje kimligi, kurallar ve aktif baglam
- PROGRESS.md -> gerceklesmis isler ve acik gap'ler
- Blueprint -> plan / hedef state
- Modul README veya giris dosyalari -> ilgili kod yuzeyi

UI, web veya desktop-agent gorevlerinde buna ek olarak su belge de okunmalidir:

- `docs/post-mvp-strategy.md` -> baglayici urun/UI manifestosu

### 3.2 Prompt yapısı — Nasıl istek gönderilmeli

#### ❌ Kötü prompt'lar

```
"Tool sistemi yap"
"Context composer'ı kodla"
"Frontend'i oluştur"
```

Bunlar çok geniş. LLM kendi varsayımlarını yapar, projeden kopar.

#### ✅ İyi prompt'lar

```
"Track A Sprint 7'deki agentic loop tiplerini implement et.
packages/types/src/agent-loop.ts içinde AgentLoopConfig ve TurnYield interface'lerini oluştur.
Mevcut state'ler (state.ts) ile çelişmeden loop durumunu yönetecek tipler olmalı."
```

```
"Track B Sprint 8B'deki Supabase auth middleware'i kodla.
apps/server/src/auth/supabase-auth.ts dosyasını oluştur.
packages/types/src/auth.ts içindeki AuthUser tipini dönecek şekilde request'i valide et.
Fastify onRequest hook'u olarak çalışmalı."
```

```
"Track C Sprint 11'deki desktop.screenshot tool'unu implement et.
apps/desktop-agent/src/screenshot.ts içinde robotjs/nut.js wrapper'ını yaz.
packages/types/tools.ts içindeki ToolDefinition'a uygun metadata (high risk, Windows-first) dönmeli."
```

#### Prompt yapısı formülü

```
[Hangi sprint / hangi görev]
[Ne yapılacak — spesifik]
[Hangi interface/tip kullanılacak — dosya yolu ile]
[Varsa takip edilecek örnek — dosya yolu ile]
[Yapma listesi — sınırlar]
[Done kriteri — başarı ölçütü]
```

Örnek tam prompt:

```
Track A Sprint 7'de `agent-loop` tiplerini tanımlıyoruz.
`packages/types/src/agent-loop.ts` dosyasını oluştur.
Referans pattern: `packages/types/src/state.ts` (modüler yapı)

Yapma:
- `apps/server/src/` tarafına henüz dokunma (implementasyon sonraki görev)
- `state.ts` içindeki temel state modelini bozma
- Track B (Auth) veya Track C (UI) konularına girme
- `any` kullanma

Done:
- Tip tanımları Typescript compiler'dan geçiyor
- `AgentLoopConfig`, `TurnYield`, `StopReason` export edilmiş
- Yalnızca types modülünde değişiklik yapılmış
```

Detaylı şablon için: `TASK-TEMPLATE.md`

### 3.3 Büyük görevleri parçalama

Bir sprint'teki görev çok büyükse, **alt görevlere bölün:**

```
Track A Sprint 7 → Agentic Loop

Alt görevler:
1. "packages/types/src/agent-loop.ts içinde loop configuration ve yield tiplerini tanımla"
2. "apps/server/src/runtime/stop-conditions.ts içinde checkStopConditions fonksiyonunu yaz"
3. "apps/server/src/runtime/agent-loop.ts içinde temel async generator loop iskeletini kur"
4. "Mevcut runModelTurn() metodunu loop'un bir turn execution bileşeni olarak sarmala"
5. "WS presentation katmanına loop progress event'lerini mapleyecek block'ları ekle"
```

Her alt görev = bir LLM oturumu (veya aynı oturumda sıralı istekler).

### 3.4 Pattern kurma — İlk örnek en önemli

**Her modül ailesinin ilk elemanını çok dikkatli kurun.**

Örnek:
- İlk tool (`file-read.ts`) → tüm sonraki tool'ların şablonu olur
- İlk render block (`text-block.ts`) → tüm sonraki block'ların şablonu olur
- İlk context layer (`core-rules-layer.ts`) → tüm sonraki layer'ların şablonu olur

İlk elemanı kurduktan sonra, sonraki elemanlarda LLM'e:

```
"file-write tool'unu implement et.
apps/server/src/tools/file-read.ts pattern'ını takip et."
```

demeniz yeterli. LLM mevcut kodu okuyup aynı pattern'ı uygular.

---

## 4. Tutarlılık Kuralları

### 4.1 Type-first geliştirme

Her yeni özellik şu sırayla geliştirilir:

```
1. packages/types/ içinde tipler tanımlanır
2. apps/server/ içinde backend implementasyonu yazılır
3. apps/web/ içinde frontend component'ı yazılır
4. Test yazılır
```

Bu sıra hem insanlar hem LLM'ler için aynıdır.
Tipler önce yazıldığında LLM geri kalan kodu tiplere göre yazar — tutarsızlık azalır.

### 4.2 Bir oturumda bir modül ve tek bir Track

Bir LLM oturumunda birden fazla modülü aynı anda geliştirmeyin.
Ayrıca, 3-track paralel yürütme planında (Track A/B/C) bir LLM oturumuna birden fazla track kapsamına giren görevler vermeyin. Odak: bir track, bir modül, bir görev, bir sonuç.

### 4.2.1 UI manifesto guardrail'lari

UI, web veya desktop-agent gorevlerinde LLM/Codex su sinirlari ihlal etmemelidir:

- Dashboard-first urun mantigina kayma
- `Advanced`, `Raw Transport`, `Model Override` veya benzeri operator/dev-ops yuzeylerini ana chat ekranina varsayilan panel/accordion olarak koyma
- Tool/search/audit/background isleri dogal dil yerine teknik blok/JSON diliyle birincil anlatim yapma
- Approval deneyimini sade kabul/reddet akisi yerine agir kontrol paneline cevirmeye calisma
- Diff/log/ham detaylari kullanici istemeden birincil yuzeye yukleme
- Mevcut repo snapshot'indaki operator/demo affordance'larini hedef urun yuzuymus gibi genisletme

Beklenen yon:

- chat-first, mobil-oncelikli, consumer-grade bir calisma ortagi hissi
- natural-language-first presentation
- operator/dev-ops gucunun yalniz ikinci katmanda veya `Developer Mode` icinde kalmasi
- "arkada guclu sistem, onde sade urun" ilkesi

### 4.3 Mimari escalation kuralı

> **Eğer görev mevcut interface/contract ile çözülemiyorsa, doğrudan yaratıcı workaround yazma; önce "architecture escalation note" üret.**

Bu çok önemli. LLM'ler görevi çözmek için sınırı genişletme eğilimindedir.
Eğer bir görev mevcut tipler veya pattern'larla uyumsuzsa:
1. Kodu zorla yazmayı durdur
2. "Bu görev şu interface ile çelişiyor çünkü X" notu üret
3. İnsan karar versin: interface güncellenmeli mi, görev değişmeli mi?

### 4.4 Review sonrası merge

LLM'in ürettiği kod direkt main'e gitmez.
Her LLM çıktısı:
1. Yazılımcı tarafından review edilir
2. Pattern uyumu kontrol edilir
3. Tip tutarlılığı kontrol edilir
4. Test çalıştırılır
5. Merge edilir

### 4.5 AGENTS.md güncelleme disiplini

Her sprint başında AGENTS.md güncellenir:
- Aktif sprint numarası
- Yeni eklenen pattern örnekleri
- Değişen klasör yapısı

---

## 5. Çoklu LLM Oturumu Yönetimi

Birden fazla yazılımcı aynı anda LLM kullanıyorsa:

### Bölüm bazlı görev dağılımı

```
Yazılımcı A + LLM oturumu → Track A (sadece agentic loop / runtime modülü)
Yazılımcı B + LLM oturumu → Track B (sadece auth / cloud DB modülü)
Yazılımcı C + LLM oturumu → Track C (sadece desktop agent / UI modülü)
```

Modüller `packages/types` üzerinden haberleşir.
Aynı modülde iki LLM oturumu çalışmaz.

### Merge çakışması önleme

- Her yazılımcı/LLM oturumu kendi branch'inde çalışır
- `packages/types` değişiklikleri önce merge edilir (diğer modüller buna göre güncellenir)
- Types değişikliği = herkesin güncellemesi gereken shared contract

---

## 6. Özet: 10 Altın Kural

1. **Her LLM oturumu AGENTS.md okuyarak başlar**
2. **Geniş prompt atma, spesifik görev ver**
3. **Dosya yolu ve interface adı belirt**
4. **Her modül ailesinin ilk örneğini dikkatli kur**
5. **Sonraki elemanlar için "şu pattern'ı takip et" de**
6. **Tipler önce, implementasyon sonra**
7. **Bir oturumda bir modül**
8. **LLM çıktısı review edilmeden merge edilmez**
9. **Sprint başlarında AGENTS.md güncelle**
10. **Çoklu LLM oturumları farklı modüllerde çalışır**
