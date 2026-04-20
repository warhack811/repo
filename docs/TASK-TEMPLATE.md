# Runa — Task Template

Her LLM görevinde bu şablonu kullanın.
Tüm alanları doldurmak zorunlu değil, ama doldurdukça kalite artar.

---

## Görev Bilgileri

- **Sprint:** [Sprint numarası] — **Track:** [Track A / B / C]
- **Görev:** [Kısa görev tanımı]
- **Modül:** [Hangi modül: runtime / context / tools / gateway / presentation / policy / auth / desktop / web]
- **KARAR.MD Maddesi:** [Varsa ilgili madde numarası]

## Bağlam

- **İlgili interface:** [Dosya yolu — örn: `packages/types/tools.ts` → `ToolDefinition`]
- **Referans dosya:** [Takip edilecek pattern — örn: `apps/server/src/tools/file-read.ts`]
- **İlgili diğer dosyalar:** [Okuması gereken mevcut dosyalar]

## Görev Detayı

[Ne yapılacak — spesifik ve net]

## Sınırlar (Yapma Listesi)

- [ ] Sadece şu dosyalara dokun: [liste]
- [ ] Şu modüllere girme: [liste]
- [ ] Cloud/auth modüllerine girme (Track B sorumluluğu)
- [ ] Desktop agent modülüne girme (Track C sorumluluğu)
- [ ] Yeni dependency ekleme
- [ ] Mevcut interface'i değiştirme (değişiklik gerekiyorsa önce escalation note üret)
- [ ] `any` tipi kullanma
- [ ] Logging'i atlama
- [ ] Hata'yı swallow etme (catch ile yutma)
- [ ] Fallback hack yazma

## Değiştirilebilecek Dosyalar

- [dosya 1]
- [dosya 2]
- [packages/types/... gerekirse]

## Değiştirilmeyecek Dosyalar

- [korunması gereken dosyalar]

## Done Kriteri

- [ ] [Hangi test geçmeli]
- [ ] [Hangi event/log görünmeli]
- [ ] [Hangi demo cümlesi çalışmalı]
- [ ] [Type check hatasız]
- [ ] [Biome lint hatasız]

## Notlar

[Ek bağlam, dikkat edilecek edge case'ler, önceki run'dan çıkarımlar vb.]

---

## Örnek Doldurulmuş Şablon

- **Sprint:** Sprint 7 — **Track:** Track A
- **Görev:** Agentic loop tiplerini tanımlama
- **Modül:** runtime (types phase)
- **KARAR.MD Maddesi:** Madde 1 — Runtime Session

**İlgili interface:** Yok (yeni eklenecek)
**Referans dosya:** `packages/types/src/state.ts`

**Görev Detayı:**
`packages/types/src/agent-loop.ts` dosyasını oluştur.
`AgentLoopConfig`, `TurnYield`, `StopReason` tiplerini tanımla.
Async generator loop altyapısının temel contract'larını kur.

**Sınırlar:**
- Track B (Auth/Cloud) modüllerine girme
- Track C (Desktop/UI) modüllerine girme
- `apps/server/src/` implementasyonuna henüz dokunma
- `any` kullanma

**Değiştirilebilecek:** `packages/types/src/agent-loop.ts` (yeni), `packages/types/src/index.ts`
**Değiştirilmeyecek:** `packages/types/src/state.ts` (temel state modelini koru)

**Done Kriteri:**
- Type tanımları Typescript compiler'dan geçiyor
- Gerekli interfaceler export edilmiş
- Sadece `packages/types/` modülünde değişiklik yapılmış
- Type check ve Biome lint hatasız
