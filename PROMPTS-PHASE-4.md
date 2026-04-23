# Runa - Phase 4 Prompt Set

> Kapsam: Konu 16-20
> Kullanım: Bu faz genisleme ve release-grade konulari icerir; bu yuzden prompt'lar ozellikle scope ve non-goal disiplinini vurgular.

---

## KONU 16 - Collaborative Sessions

Neden: Tek kullanicili akis ekip senaryolarini karsilamiyor.
Sonuc: Paylasilan conversation ve role-aware gorunurluk zemini acilir.

```md
## Gorev Bilgileri

- Sprint: Phase 4 backlog
- Gorev: Shared conversation membership ve temel realtime sync
- Modul: db / routes / ws / web
- KARAR.MD Maddesi: Identity, access, shared context

## Baglam

- Ilgili interface: conversation persistence seamlari
- Referans dosya: `packages/db/src/schema.ts`, `apps/server/src/routes/conversations.ts`
- Ilgili diger dosyalar:
  - `apps/server/src/auth/supabase-auth.ts`
  - `apps/server/src/ws/run-execution.ts`
  - `apps/web/src/components/chat/ConversationSidebar.tsx`

## Gorev Detayi

Conversation share/membership zemini ekle:

- Conversation member tablosu
- Share/member API'leri
- Ayni conversation icin temel realtime update fan-out mantigi
- Role bazli `owner/editor/viewer` ayrimi

## Sinirlar

- [ ] Full Google Docs benzeri collaboration acma
- [ ] Genis admin paneli yapma
- [ ] Auth sistemini bastan yazma

## Degistirilebilecek Dosyalar

- `packages/db/src/schema.ts`
- `apps/server/src/routes/conversations.ts`
- `apps/server/src/ws/run-execution.ts`
- `apps/web/src/components/chat/*`
- ilgili test dosyalari

## Degistirilmeyecek Dosyalar

- `apps/server/src/gateway/*`

## Done Kriteri

- [ ] Hedefli multi-user route/ws testleri yesil
- [ ] `pnpm --filter @runa/server typecheck`
- [ ] `pnpm --filter @runa/web build`
- [ ] Viewer/editor ayrimi davranis olarak testlenmis

## Notlar

- Bu gorev ancak conversation persistence oturduktan sonra acilmalidir.
```

---

## KONU 17 - Mobile PWA

Neden: Mobil kullanim var ama app-benzeri his zayif.
Sonuc: Daha guclu mobile-first shell ve installable web deneyimi.

```md
## Gorev Bilgileri

- Sprint: Track C polish / Phase 4 backlog
- Gorev: PWA shell, manifest ve responsive audit
- Modul: web / infra-lite
- KARAR.MD Maddesi: Mobile-first consumer surface

## Baglam

- Ilgili interface: `apps/web/src/App.tsx`, `apps/web/src/components/app/AppShell.tsx`
- Referans dosya: `apps/web/src/index.css`
- Ilgili diger dosyalar:
  - `apps/web/index.html`
  - `apps/web/public/*`

## Gorev Detayi

PWA ve mobile shell zemini kur:

- `manifest.json`
- service worker / cache stratejisi icin minimum Vite uyumlu kurulum
- installable shell metadata'si
- kritik breakpoint audit'i

## Sinirlar

- [ ] Native mobile uygulama varsayma
- [ ] Offline full runtime garantisi verme
- [ ] Push notification'i zorunlu birinci adim yapma

## Degistirilebilecek Dosyalar

- `apps/web/public/manifest.json` yeni
- `apps/web/index.html`
- `apps/web/src/index.css`
- `apps/web/src/components/app/AppShell.tsx`
- gerekli PWA config dosyalari

## Degistirilmeyecek Dosyalar

- `apps/server/src/*`

## Done Kriteri

- [ ] `pnpm --filter @runa/web typecheck`
- [ ] `pnpm --filter @runa/web build`
- [ ] Manifest ve installability metadatasi dogru
- [ ] Ana chat shell 320px-1024px araliginda kullanilabilir

## Notlar

- Mobile-first, dashboard-first anlamina gelmez; chat-first urun akisi korunmali.
```

---

## KONU 18 - Semantic Memory + RAG

Neden: Runa vaadinin en kritik parcasi derin baglam hatirlama.
Sonuc: Kullanici/proje bazli ilgili bilgi geri cagrilabilir.

```md
## Gorev Bilgileri

- Sprint: Phase 3 depth / Phase 4 continuation
- Gorev: Embedding store ve retrieval seam'i
- Modul: memory / db / runtime
- KARAR.MD Maddesi: Memory, project continuity

## Baglam

- Ilgili interface: `packages/types/src/memory.ts`
- Referans dosya: `apps/server/src/persistence/memory-store.ts`
- Ilgili diger dosyalar:
  - `packages/db/src/memories.ts`
  - `apps/server/src/memory/README.md`
  - `apps/server/src/context/*`
  - `apps/server/src/ws/run-execution.ts`

## Gorev Detayi

Semantic retrieval icin minimum ama dogru pipeline kur:

- Embedding metadata/tablo zemini
- Retrieval helper'lari
- Run basinda ilgili memory parcasi cekme seam'i
- Run sonunda uygun memory yazma noktasi
- Agent'in memory arayabilmesi icin dar bir tool seam'i

## Sinirlar

- [ ] Full knowledge graph acma
- [ ] Her mesaji otomatik sonsuz memory'ye cevirme
- [ ] Context composer'i bastan yazma
- [ ] Web search'i varsayilan truth kaynagi yapma

## Degistirilebilecek Dosyalar

- `packages/types/src/memory.ts`
- `packages/db/src/memories.ts`
- `apps/server/src/memory/*`
- `apps/server/src/persistence/memory-store.ts`
- `apps/server/src/ws/run-execution.ts`
- ilgili test dosyalari

## Degistirilmeyecek Dosyalar

- `apps/web/src/*`
- `apps/server/src/auth/*`

## Done Kriteri

- [ ] Retrieval/store testleri yesil
- [ ] `pnpm --filter @runa/server typecheck`
- [ ] `pnpm --filter @runa/server lint`
- [ ] Yeni memory retrieval mevcut working/session memory akisini bozmuyor

## Notlar

- Bu gorev "semantic memory" gorevidir; conversation history ile karistirma.
- Memory yazma kriteri secici olmali; her seyi memory'ye pompalama.
```

---

## KONU 19 - Security Hardening

Neden: Dev seam'ler var ama prod-grade auth/RBAC hikayesi tamam degil.
Sonuc: Yayin oncesi minimum guven modeli netlesir.

```md
## Gorev Bilgileri

- Sprint: Release-readiness / Track B
- Gorev: Production-grade OAuth akisi ve role-aware authorization sertlestirmesi
- Modul: auth / policy / web
- KARAR.MD Maddesi: Identity, security, trust boundary

## Baglam

- Ilgili interface: auth/session/policy kontratlari
- Referans dosya: `apps/server/src/auth/supabase-auth.ts`
- Ilgili diger dosyalar:
  - `apps/server/src/policy/permission-engine.ts`
  - `apps/web/src/hooks/useAuth.ts`
  - `apps/server/src/routes/auth.ts`

## Gorev Detayi

Prod-grade auth ve yetki sertlestirmesi icin dar kapsamli bir gorev ac:

- PKCE/OAuth callback handling'i netlestir
- Session refresh ve timeout davranisini sertlestir
- Role-aware authorization seam'i ac
- Tool / route / conversation gibi yuzeylerde minimum rol matrisi uygula

## Sinirlar

- [ ] Mevcut Supabase auth temelini atip yeni auth sistemi kurma
- [ ] Enterprise IAM tasarlama
- [ ] UI'da operator paneli acma
- [ ] Desktop agent auth'ini bu gorevle karistirma

## Degistirilebilecek Dosyalar

- `apps/server/src/auth/supabase-auth.ts`
- `apps/server/src/auth/rbac.ts` yeni
- `apps/server/src/routes/auth.ts`
- `apps/server/src/policy/*` gerekirse additive
- `apps/web/src/hooks/useAuth.ts`

## Degistirilmeyecek Dosyalar

- `apps/server/src/gateway/*`
- `apps/web/src/pages/ChatPage.tsx`

## Done Kriteri

- [ ] Auth/RBAC testleri yesil
- [ ] `pnpm --filter @runa/server typecheck`
- [ ] `pnpm --filter @runa/server lint`
- [ ] `pnpm --filter @runa/web typecheck`
- [ ] Yetkisiz kullanici ilgili route/tool yuzeyinde acik sekilde reddediliyor

## Notlar

- "Secure" gibi genel ifade yerine hangi boundary'nin sertlestigi acikca kanitlanmali.
```

---

## KONU 20 - Deployment

Neden: Local-only siniri release kabiliyetini dusuruyor.
Sonuc: Uretim ortamina tasinabilir, dogrulanabilir bir dagitim zemini.

```md
## Gorev Bilgileri

- Sprint: Release-readiness
- Gorev: Docker build zinciri ve minimum deployment manifest'leri
- Modul: infra
- KARAR.MD Maddesi: Release, portability, cloud-first hybrid

## Baglam

- Ilgili interface: root workspace scripts ve build ciktilari
- Referans dosya: root `package.json`, `Dockerfile`, `compose.yaml`
- Ilgili diger dosyalar:
  - `apps/server/package.json`
  - `apps/web/package.json`

## Gorev Detayi

Production-grade deployment zemini kur:

- Server ve web icin ayri Docker build yolu
- Compose uzerinden minimum tam-stack lokal rehearsal
- Gerekirse sonraki adim icin K8s manifest zemini
- Environment templating ve health-check dusuncesi

## Sinirlar

- [ ] Tam platform engineering programina donusturme
- [ ] Prod secret'larini repo icine koyma
- [ ] Desktop agent deployment'ini bu goreve katma

## Degistirilebilecek Dosyalar

- root `Dockerfile`
- `apps/server/Dockerfile` yeni veya guncel
- `apps/web/Dockerfile` yeni veya guncel
- `compose.yaml`
- `.dockerignore`
- env template dosyalari
- opsiyonel `k8s/*`

## Degistirilmeyecek Dosyalar

- Uygulama runtime kodu, zorunlu olmadikca

## Done Kriteri

- [ ] `pnpm build`
- [ ] Docker build komutlari basarili
- [ ] Compose ile minimum stack kalkiyor veya neden bloklandigi durustce yaziliyor
- [ ] Deployment adimlari belge halinde okunur

## Notlar

- Ilk hedef release discipline; tam cloud platform otomasyonu degil.
```
