# Runa — Task Template

## Görev Bilgileri

- **Sprint:** Phase 3 hazırlığı / Core Hardening sonrası — **Track:** Track A / Track B
- **Görev:** Semantic Memory — privacy-first, embedding tabanlı çapraz konuşma hafıza sistemi
- **Modül:** context / tools / db / policy
- **KARAR.MD Maddesi:** Modüller arası iletişim `packages/types` kontratları üzerinden kurulur

## Bağlam

- **İlgili interface:** `packages/types/src/tools.ts` → `ToolDefinition`; `apps/server/src/context/compose-context.ts` → memory layer
- **Referans dosya:** `apps/server/src/tools/search-codebase.ts`, `apps/server/src/context/compose-context.ts`, `packages/db/**`, `apps/server/src/persistence/**`
- **Repo gerçeği:** Runa'da hafıza fikri vardır, fakat release-grade semantic memory için privacy, consent, RLS, deletion/export ve resource budget kararları gerekir.

## Rekabetçi Kalite Çıtası

Rakiplerde memory değerli görünür; ama kötü memory kullanıcı güvenini hızla düşürür. Runa'nın hedefi "her şeyi kaydeden hafıza" değil, kullanıcı kontrolünde, açıklanabilir ve geri alınabilir hafızadır.

- Explicit memory ile inferred memory ayrılır.
- Kullanıcı hafızayı görebilir, silebilir ve kapatabilir.
- Tenant/user isolation RLS ile kanıtlanır.
- Sensitive content default kaydedilmez.
- Embedding pipeline lazy-init edilir ve resource bütçesi ölçülür.
- Context'e memory eklenirken provenance ve recency korunur.

## Kaynaklı Endüstri Notları

- Modern assistant ürünlerinde memory rekabet avantajıdır; ancak privacy ve kontrol yüzeyi yoksa risk üretir.
- Local embedding modeli eklemek dependency, model download, CPU/memory ve deployment etkisi doğurur; mini-RFC olmadan dependency eklenmez.

## Görev Detayı

Bu belge tek uygulama görevi değildir; semantic memory dört faza bölünür.

### TASK-08A — Memory Policy + Types

1. Memory kaynakları:
   - `explicit`: kullanıcı açıkça "bunu hatırla" dedi.
   - `inferred`: sistem önerdi, kullanıcı onayladı.
   - `conversation`: otomatik kısa özet, default kapalı veya feature flag altında.
2. Tool names:
   - `memory.save`
   - `memory.search`
   - `memory.delete`
   - `memory.list`
3. Sensitive data guard:
   - API key, password, token, credential, payment data kaydedilmez.

### TASK-08B — DB + RLS

Schema taslağı:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE memory_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding vector(384),
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);
```

Gereksinimler:

- RLS/user isolation testleri.
- Soft delete veya hard delete politikası açık.
- Export/list endpoint veya tool planı.

### TASK-08C — Embedding Provider Mini-RFC

Seçenekler:

- Existing codebase embedding helper reuse.
- Local `@xenova/transformers`.
- Remote embedding provider.
- Future Qdrant/pgvector hybrid.

Karar mini-RFC'si şunları içerir:

- Model boyutu ve ilk yükleme süresi.
- CPU/memory etkisi.
- Offline/online davranış.
- Deployment etkisi.
- Test edilebilir fallback.

### TASK-08D — Context Integration

1. Query veya conversation summary embed edilir.
2. Top N memory entry recall edilir.
3. Context'e şu formatta eklenir:
   - content
   - source
   - created_at
   - relevance_score
4. Memory injection prompt injection'a açık alan sayılır; sanitize ve provenance gerekir.

## Sınırlar (Yapma Listesi)

- [ ] Kullanıcı onayı/visibility/delete yolu olmadan inferred memory açma.
- [ ] Sensitive content'i memory'ye kaydetme.
- [ ] Embedding modelini her request'te yükleme.
- [ ] RLS/user isolation kanıtı olmadan cross-user memory claim etme.
- [ ] Gateway redesign açma.
- [ ] Desktop/web UI'yi bu görevde zorunlu yapma; UI gerekiyorsa ayrı TASK.
- [ ] `any`, silent catch, fake semantic search benchmark kullanma.

## Değiştirilebilecek Dosyalar

- `packages/types/src/tools.ts`
- `packages/db/src/schema.ts`
- `packages/db/drizzle/**`
- `apps/server/src/tools/memory-save.ts` (yeni)
- `apps/server/src/tools/memory-search.ts` (yeni)
- `apps/server/src/tools/memory-delete.ts` (yeni)
- `apps/server/src/tools/memory-list.ts` (yeni)
- `apps/server/src/tools/*memory*.test.ts`
- `apps/server/src/context/compose-context.ts`
- `apps/server/package.json` veya `packages/db/package.json` (yalnız mini-RFC sonrası)

## Değiştirilmeyecek Dosyalar

- `apps/server/src/gateway/**`
- `apps/desktop-agent/**`
- `apps/web/**` (bu prompt içinde)
- Mevcut persistence store contract'ları, gerekmedikçe

## Done Kriteri

- [ ] Seçilen faz açıkça belirtilir.
- [ ] Memory source policy test edilir.
- [ ] Sensitive data rejection testleri vardır.
- [ ] DB/RLS fazında user isolation testleri vardır.
- [ ] Embedding fazında lazy-init ve unavailable fallback test edilir.
- [ ] Context integration fazında provenance ve relevance görünürdür.
- [ ] Typecheck, targeted Vitest ve Biome PASS.

## Notlar

- Bu görev büyük ürün avantajı sağlayabilir; yanlış uygulanırsa güven krizidir.
- Kapalı test öncesi minimum hedef: explicit memory + list/delete + privacy guard. Full inferred semantic memory daha sonraki faza kalabilir.
