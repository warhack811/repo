# Runa — Task Template

## Görev Bilgileri

- **Sprint:** Core Hardening Phase 2 — **Track:** Track A
- **Görev:** Web Search Güçlendirme — kaynaklı, güncel, locale-aware araştırma kalitesini artırma
- **Modül:** tools
- **KARAR.MD Maddesi:** Tool registry bypass edilmez; her tool `ToolDefinition` implement eder

## Bağlam

- **İlgili interface:** `packages/types/src/tools.ts` → `ToolDefinition`, `apps/server/src/tools/web-search.ts` → `createWebSearchTool`
- **Referans dosya:** `apps/server/src/tools/web-search.ts`, `apps/server/src/tools/web-search.test.ts`, `apps/server/src/utils/sanitize-prompt-content.ts`
- **Repo gerçeği:** `web.search` Serper tabanlıdır ve authority-first shaping / trust tier / prompt injection guardrail davranışı içerir. Bu görev yeni search plane kurmaz; mevcut tool'u kaliteli araştırma seviyesine taşır.

## Rekabetçi Kalite Çıtası

Runa'nın araştırma kalitesi, rakiplerdeki "kaynaklı, güncel, bağlamı doğru ayrıştıran" cevap hissine yaklaşmalıdır. Ama web search varsayılan truth kaynağı değildir; tool yalnız gerektiğinde ve kaynakları açıkça sunarak çalışır.

- Haber/güncellik sorguları için news endpoint ve tarih bilgisi desteklenir.
- Answer box / knowledge graph gibi yüksek sinyal alanları kaybolmaz.
- Locale desteği Türkçe kullanıcı deneyimini iyileştirir.
- Kaynaklar trust tier ile sınıflanır ama tek kaynak mutlak doğru sayılmaz.
- Prompt injection koruması arama sonuçlarında da sürer.
- Search sonucu model'e ham, kontrolsüz HTML olarak verilmez.

## Kaynaklı Endüstri Notları

- Güncel araştırma ürünlerinde kaynak, tarih, sorgu bağlamı ve authority ayrımı kullanıcı güveninin temelidir.
- Serper endpoint/response formatı canlı dökümana göre doğrulanmalıdır; IDE LLM eski satır numaralarına güvenmemelidir.

## Görev Detayı

### 1. Serper News Endpoint

`web.search` callable schema içine `search_type` ekle:

```typescript
search_type: {
  description: 'Type of search: "organic" (default) or "news" for recent news articles.',
  type: 'string',
}
```

- Desteklenen değerler: `organic`, `news`.
- Desteklenmeyen değer typed validation error döndürür.
- `news` için endpoint `https://google.serper.dev/news` olur.
- `news` response parse edilir ve source/date bilgisi kaybolmaz.

### 2. Answer Box / Knowledge Graph

`WebSearchSuccessData` içine additive alanlar ekle:

```typescript
readonly answer_box?: {
  readonly snippet: string;
  readonly source?: string;
  readonly title?: string;
};
readonly knowledge_graph?: {
  readonly title?: string;
  readonly description?: string;
  readonly source?: string;
};
```

- Alanlar varsa sanitize edilir.
- Tek başına final truth sayılmaz; source/provenance ile sunulur.

### 3. Locale / Bölge

`locale` parametresi ekle:

```typescript
locale: {
  description: 'Two-letter language code such as "tr" or "en".',
  type: 'string',
}
```

- `hl` olarak gönderilir.
- `gl` için yalnız doğrulanmış ülke kodu destekleniyorsa kullanılır; `tr` dil kodunu kör şekilde ülke kodu yerine koyma. Gerekirse `country` alanını ayrı aç.

### 4. Trust Tier Genişletme

- `wikipedia.org`, `arxiv.org`, resmi kurum alanları ve akademik kaynaklar için additive sınıflandırma eklenebilir.
- `researchgate.net` gibi kullanıcı-yüklemeli platformlar otomatik high-trust yapılmaz; ayrı `mixed` / `community_research` gibi bir sınıf gerekiyorsa açıkça ekle.
- `scholar.google.com` normal web result link'i gibi güvenilir içerik kaynağı değildir; arama yüzeyi olarak ele alınmalı, result source olarak high-trust sayılmamalıdır.

## Sınırlar (Yapma Listesi)

- [ ] Sadece `apps/server/src/tools/web-search.ts` ve `apps/server/src/tools/web-search.test.ts` dosyalarına dokun.
- [ ] Gateway, desktop, auth veya registry redesign açma.
- [ ] Mevcut `WebSearchProvider` type'ını bozma.
- [ ] Trust tier mantığını geriye dönük kırma.
- [ ] `sanitizePromptContent` / `sanitizeOptionalPromptContent` kullanımını atlama.
- [ ] Search sonuçlarından gelen title/snippet/link alanlarını doğrulamadan model context'e taşıma.
- [ ] Canlı Serper credential yoksa live PASS iddiası yazma.

## Değiştirilebilecek Dosyalar

- `apps/server/src/tools/web-search.ts`
- `apps/server/src/tools/web-search.test.ts`

## Değiştirilmeyecek Dosyalar

- `apps/server/src/utils/sanitize-prompt-content.ts`
- `apps/server/src/tools/registry.ts`
- `packages/types/src/tools.ts`

## Done Kriteri

- [ ] `search_type: "news"` Serper news endpoint'ine gider.
- [ ] Organic default davranış geriye dönük korunur.
- [ ] Answer box ve knowledge graph varsa structured output içinde döner.
- [ ] Locale parametresi validasyonlu şekilde request'e eklenir.
- [ ] News parse, answer box parse, locale request ve trust tier testleri eklenir.
- [ ] Prompt injection sanitization testleri kırılmaz.
- [ ] Typecheck, targeted Vitest ve Biome PASS.

## Notlar

- Bu görev erken uygulanabilir ve yüksek ürün değeri üretir.
- En iyi hedef: daha fazla endpoint değil, daha güvenilir kaynaklı cevap.
