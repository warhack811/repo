# Runa — Task Template

## Görev Bilgileri

- **Sprint:** Core Hardening Phase 2 / Phase 3 — **Track:** Track B / Track C
- **Görev:** File Transfer — mevcut attachment seam'iyle uyumlu, güvenli çift yönlü dosya akışı
- **Modül:** runtime / web / storage / presentation
- **KARAR.MD Maddesi:** Modüller arası iletişim `packages/types` kontratları üzerinden kurulur

## Bağlam

- **İlgili interface:** `packages/types/src/gateway.ts` → `ModelAttachment`; `packages/types/src/blocks.ts` → `RenderBlock`; upload route ve chat attachment UI
- **Referans dosya:** `apps/server/src/routes/upload.ts`, `apps/web/src/components/chat/FileUploadButton.tsx` veya mevcut upload/chat composer bileşenleri, `apps/server/src/gateway/*`, `apps/web/src/components/chat/PresentationBlockRenderer.tsx`
- **Repo gerçeği:** Runa'da minimum file upload / multimodal attachment seam'i daha önce açılmış olabilir. Bu görev mevcut hattı yeniden icat etmeden güçlendirmelidir.

## Rekabetçi Kalite Çıtası

Rakip seviyesinde file transfer, drag-drop göstermekten ibaret değildir. Dosya akışı güvenli, limitli, kaynaklı ve model-provider capability'lerine göre degrade edebilir olmalıdır.

- Mevcut upload/attachment contract'ı korunur.
- File type/size validation hem frontend hem backend tarafında vardır.
- Dangerous executable/script türleri engellenir.
- Binary/document dosyalar storage artifact olarak taşınır; büyük payload model context'e gömülmez.
- Download/share linkleri user scoped ve süreli olmalıdır.
- File download block frontend'de sade ve güvenilir görünür.
- Unsupported provider/document type için typed graceful degrade vardır.

## Kaynaklı Endüstri Notları

- Modern chat ürünlerinde image/text/document upload temel beklenti haline geldi; rekabetçi kalite için sadece transport değil, güvenlik ve UX açıklığı gerekir.
- Runa'nın artifact reference kuralı büyük payload'ları block içine gömmemeyi zorunlu kılar.

## Görev Detayı

Bu belge mevcut implementation durumunu kontrol etmeden uygulanmaz.

### TASK-12A — Existing Attachment Audit + Hardening

1. Mevcut upload route, frontend upload button/composer ve provider attachment mapping incelenir.
2. Var olan destek:
   - image
   - text/code
   - unsupported media behavior
   - size limits
   - auth/storage/RLS
3. Gaps raporlanır ve yalnız eksik validation/hardening uygulanır.

### TASK-12B — Document Attachment Contract

Eğer mevcut contract yetersizse additive tip ekle:

```typescript
interface ModelDocumentAttachment {
  readonly kind: 'document';
  readonly media_type: string;
  readonly filename: string;
  readonly size_bytes: number;
  readonly storage_ref: string;
  readonly text_preview?: string;
}
```

Kurallar:

- Büyük document content model request'e ham gömülmez.
- Provider document desteklemiyorsa text preview veya unsupported typed error kullanılır.
- PDF/Excel parsing bu görevde açılmaz; ayrı parser görevidir.

### TASK-12C — File Share / Download Block

1. `file.share` tool:
   ```json
   {
     "filename": "string",
     "mime_type": "string",
     "content": "string?"
   }
   ```
2. Server storage'a yazar ve scoped/signed URL üretir.
3. `FileDownloadBlock` eklenir:
   ```typescript
   interface FileDownloadBlock {
     type: 'file_download';
     url: string;
     filename: string;
     size_bytes?: number;
     expires_at?: string;
   }
   ```
4. Frontend renderer aynı görevde eklenir.

## Sınırlar (Yapma Listesi)

- [ ] Mevcut upload/attachment hattını okumadan yeniden yazma.
- [ ] Supabase dışında yeni cloud storage ekleme.
- [ ] `.exe`, `.bat`, `.cmd`, `.ps1`, `.msi`, macro-enabled office gibi riskli türlere izin verme.
- [ ] Büyük binary payload'ı WS/model context içine gömme.
- [ ] Public, süresiz download URL üretme.
- [ ] PDF/Excel full parser'ı bu görevde açma.
- [ ] Desktop local filesystem yetkisini bu görevde genişletme.
- [ ] `any`, silent catch, fake upload smoke kullanma.

## Değiştirilebilecek Dosyalar

### TASK-12A

- Mevcut upload/frontend attachment dosyaları yalnız hardening için
- İlgili tests

### TASK-12B

- `packages/types/src/gateway.ts`
- `apps/server/src/routes/upload.ts`
- `apps/server/src/gateway/*` provider mapping adapter'ları
- `apps/web/src/components/chat/*upload*` veya composer attachment bileşenleri
- İlgili tests

### TASK-12C

- `packages/types/src/blocks.ts`
- `apps/server/src/tools/file-share.ts` (yeni)
- `apps/server/src/tools/file-share.test.ts` (yeni)
- `apps/server/src/tools/registry.ts`
- `apps/web/src/components/chat/PresentationBlockRenderer.tsx`
- `apps/web/src/components/chat/capability/**` only if existing primitives fit

## Değiştirilmeyecek Dosyalar

- `apps/desktop-agent/src/session.ts`
- `apps/server/src/runtime/agent-loop.ts`
- Gateway core interfaces except additive attachment handling
- Storage/auth modules unless exact missing RLS/upload seam requires a narrow change

## Done Kriteri

- [ ] Mevcut attachment hattı denetlenmiş ve raporlanmıştır.
- [ ] Image/text upload regressions kırılmaz.
- [ ] Unsupported type `415` veya typed equivalent ile döner.
- [ ] Size/type validation frontend ve backend tarafında test edilir.
- [ ] Document attachment büyük payload'ı artifact reference olarak taşır.
- [ ] `file.share` scoped/signed URL üretir.
- [ ] `FileDownloadBlock` eklenirse frontend renderer da aynı fazda vardır.
- [ ] Typecheck, server/web targeted tests, web build ve Biome PASS.

## Notlar

- Bu görev Runa'nın günlük kullanım değerini ciddi artırır; ama güvenlik limitleri yoksa ürün risklidir.
- Öncelik upload/download transport ve güvenliktir; document understanding ayrı fazdır.
