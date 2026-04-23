# Runa - Phase 2 Prompt Set

> Kapsam: Konu 6-10
> Kullanım: Her blok task-template uyumlu, dar kapsamli ve kopyala-yapistir prompt olarak yazildi.

---

## KONU 6 - Conversation Persistence

Neden: Refresh sonrasi sohbet ve baglam kayboluyor.
Sonuc: Kullanici ayni konusmaya geri donebilir; memory ve chat deneyimi anlam kazanir.

```md
## Gorev Bilgileri

- Sprint: Phase 3 backlog - Track A / Track C ortak seam
- Gorev: Conversation ve message persistence temeli
- Modul: persistence / routes / web
- KARAR.MD Maddesi: Session continuity, memory-adjacent persistence

## Baglam

- Ilgili interface: `packages/types/src/ws.ts`
- Referans dosya: `packages/db/src/runs.ts`, `apps/server/src/persistence/run-store.ts`
- Ilgili diger dosyalar:
  - `packages/db/src/schema.ts`
  - `packages/db/src/index.ts`
  - `apps/server/src/routes/auth.ts`
  - `apps/server/src/ws/run-execution.ts`
  - `apps/web/src/pages/ChatPage.tsx`
  - `apps/web/src/components/app/AppShell.tsx`

## Gorev Detayi

Conversation history icin minimum ama dogru persistence zemini kur:

- `packages/db/src/schema.ts` altina `conversations` ve `conversation_messages` tablolari ekle.
- `packages/db/src/` icinde bu tablolar icin helper/store katmani ac.
- `apps/server/src/persistence/` altinda conversation store seam'i ekle.
- `apps/server/src/routes/` altinda authenticated conversation listing ve message fetch API'si ac.
- `run-execution.ts` tarafinda yeni run'in ilgili conversation ile bagini additive olarak kur.
- Frontend tarafinda conversation secimi ve mevcut conversation hydration icin dar hook/component seam'i ac.

## Sinirlar

- [ ] Mevcut run/event/approval persistence akisini bozma
- [ ] Full collaborative session bu gorevde acma
- [ ] Semantic memory / RAG ile birlestirme
- [ ] WS protocol redesign yapma
- [ ] Dashboard-first yan menu kurgusuna kayma

## Degistirilebilecek Dosyalar

- `packages/db/src/schema.ts`
- `packages/db/src/index.ts`
- `packages/db/src/conversations.ts` yeni
- `apps/server/src/persistence/conversation-store.ts` yeni
- `apps/server/src/routes/conversations.ts` yeni
- `apps/server/src/ws/run-execution.ts`
- `apps/web/src/hooks/useConversations.ts` yeni
- `apps/web/src/components/chat/ConversationSidebar.tsx` yeni
- `apps/web/src/pages/ChatPage.tsx`
- `apps/web/src/components/app/AppShell.tsx`

## Degistirilmeyecek Dosyalar

- `apps/server/src/auth/supabase-auth.ts`
- `apps/server/src/policy/*`
- `apps/server/src/ws/register-ws.ts`

## Done Kriteri

- [ ] Hedefli DB/store/route testleri yesil
- [ ] `pnpm --filter @runa/server typecheck`
- [ ] `pnpm --filter @runa/web typecheck`
- [ ] `pnpm --filter @runa/web build`
- [ ] Yeni conversation secilince ilgili mesajlar yeniden yukleniyor
- [ ] Refresh sonrasi aktif conversation geri alinabiliyor

## Notlar

- Bu gorev "conversation history", yani chat persistence gorevidir; semantic memory degildir.
- API ve UI isimlendirmesi ileride multi-user'a tasinabilir, ama bugun tek kullanici varsayimi korunur.
```

---

## KONU 7 - Markdown Renderer

Neden: Asistan ciktilari duz metin gorundugu icin kalite hissi dusuyor.
Sonuc: Kod, tablo, liste ve link'ler okunur hale gelir.

```md
## Gorev Bilgileri

- Sprint: Track C polish follow-up
- Gorev: Streaming-uyumlu markdown render katmani
- Modul: web
- KARAR.MD Maddesi: Natural-language-first presentation

## Baglam

- Ilgili interface: chat text render yuzeyi
- Referans dosya: `apps/web/src/components/chat/PresentationBlockRenderer.tsx`
- Ilgili diger dosyalar:
  - `apps/web/src/pages/ChatPage.tsx`
  - `apps/web/src/index.css`
  - `apps/web/src/components/chat/chat-presentation.tsx`

## Gorev Detayi

Assistant text ciktisi icin markdown render seam'i ekle:

- `MarkdownRenderer` benzeri ayri bir component cikar.
- Kod blogu, inline code, liste, tablo ve link'leri okunur sekilde goster.
- Streaming sirasinda yari-acik markdown geldiginde UI'yi bozmayan savunmaci render mantigi kur.
- Chat page ve ilgili render yuzeylerinde plain text yerine bu component'i kullan.

## Sinirlar

- [ ] Presentation block kontratini degistirme
- [ ] Backend render schema'sina dokunma
- [ ] UI'yi raw/debug viewer'a cevirme
- [ ] Yeni dependency gerekiyorsa once acik not dus, sessizce ekleme

## Degistirilebilecek Dosyalar

- `apps/web/src/components/chat/MarkdownRenderer.tsx` yeni
- `apps/web/src/components/chat/PresentationBlockRenderer.tsx`
- `apps/web/src/pages/ChatPage.tsx`
- `apps/web/src/index.css`

## Degistirilmeyecek Dosyalar

- `apps/server/src/*`
- `packages/types/src/*`

## Done Kriteri

- [ ] `pnpm --filter @runa/web typecheck`
- [ ] `pnpm --filter @runa/web lint`
- [ ] `pnpm --filter @runa/web build`
- [ ] Kod blogu, tablo, liste ve link iceren ornek mesajlar okunur render oluyor
- [ ] Streaming sirasinda yarim markdown UI'yi bozup crash ettirmiyor

## Notlar

- Bu gorev markdown kalite gorevidir; rich-text editor ya da note-taking sistemi kurma gorevi degildir.
```

---

## KONU 8 - State Management

Neden: `useChatRuntime.ts` buyuk ve bakimi zor.
Sonuc: Frontend orchestration daha okunur, testlenebilir ve genisletilebilir olur.

```md
## Gorev Bilgileri

- Sprint: Track C maintenance / decomposition
- Gorev: Chat runtime state'ini kontrollu sekilde store tabanli mimariye tasima
- Modul: web
- KARAR.MD Maddesi: UI orchestration ve state discipline

## Baglam

- Ilgili interface: `apps/web/src/hooks/useChatRuntime.ts`
- Referans dosya: `apps/web/src/hooks/useChatRuntimeView.ts`
- Ilgili diger dosyalar:
  - `apps/web/src/pages/ChatPage.tsx`
  - `apps/web/src/components/chat/*`
  - `apps/web/src/App.tsx`

## Gorev Detayi

`useChatRuntime.ts` icindeki buyuk state/yanki mantigini asamali sekilde toparla:

- Runtime config, connection state ve current-run presentation state'ini ayri store/seam'lere cikar.
- Hook'u bir anda sifirdan yazma; once en dusuk riskli state gruplarini tas.
- Secilen state parcalarini componentlerde selector mantigi ile tuket.
- Hedef davranis degisikligi degil; complexity azaltma ve testlenebilirlik artisi.

## Sinirlar

- [ ] Tum frontend'i tek turda rewrite etme
- [ ] WS protocol davranisini degistirme
- [ ] Server veya types alanina gereksiz dokunma
- [ ] Yeni dependency gerekiyorsa once acik gerekce yaz

## Degistirilebilecek Dosyalar

- `apps/web/src/hooks/useChatRuntime.ts`
- `apps/web/src/hooks/useChatRuntimeView.ts`
- `apps/web/src/stores/chat-store.ts` yeni veya benzeri
- `apps/web/src/pages/ChatPage.tsx`
- `apps/web/src/components/chat/*`

## Degistirilmeyecek Dosyalar

- `apps/server/src/*`
- `packages/types/src/*`

## Done Kriteri

- [ ] `pnpm --filter @runa/web typecheck`
- [ ] `pnpm --filter @runa/web lint`
- [ ] `pnpm --filter @runa/web build`
- [ ] `useChatRuntime.ts` sorumluluklari azaltilmis ve daha kucuk seam'lere ayrilmis
- [ ] Mevcut chat, approval ve current-run gorunurlugu regress olmuyor

## Notlar

- Bu gorevde "hangi state kutuphanesi daha havali" tartismasi acma; hedef dar ve pratik decomposition.
- Mevcut davranis korunmasi, bu gorevde teknoloji seciminden daha onemlidir.
```

---

## KONU 9 - Model Router

Neden: Her istege ayni model gitmesi maliyet ve kalite acisindan verimsiz.
Sonuc: Prompt turune gore daha uygun provider/model secimi yapilabilir.

```md
## Gorev Bilgileri

- Sprint: Phase 3 backlog - Track A
- Gorev: Intent-aware model router ve fallback temeli
- Modul: gateway
- KARAR.MD Maddesi: Provider-agnostic orchestration

## Baglam

- Ilgili interface: `packages/types/src/gateway.ts`
- Referans dosya: `apps/server/src/gateway/factory.ts`
- Ilgili diger dosyalar:
  - `apps/server/src/gateway/providers.ts`
  - `apps/server/src/ws/run-execution.ts`
  - `apps/server/src/gateway/*-gateway.ts`

## Gorev Detayi

Provider adapter'larini bozmadan ince bir router seam'i ekle:

- Prompt / request metadata / capability ihtiyacina gore route sec.
- Router sonucu yine mevcut `ModelGateway` akisi icinde calissin.
- Provider failure durumunda minimum fallback zinciri tanimla.
- Karar mantigini test edilebilir saf helper'lar icine koy.

## Sinirlar

- [ ] Provider adapter'lari yeniden yazma
- [ ] UI'ya model-router paneli acma
- [ ] Tool routing veya cost dashboard acma
- [ ] Yeni quota / billing sistemi kurma

## Degistirilebilecek Dosyalar

- `apps/server/src/gateway/model-router.ts` yeni
- `apps/server/src/gateway/fallback-chain.ts` yeni
- `apps/server/src/gateway/factory.ts`
- `apps/server/src/ws/run-execution.ts`
- ilgili hedefli test dosyalari

## Degistirilmeyecek Dosyalar

- `apps/web/src/*`
- `apps/server/src/auth/*`

## Done Kriteri

- [ ] Router/fallback unit testleri yesil
- [ ] `pnpm --filter @runa/server typecheck`
- [ ] `pnpm --filter @runa/server lint`
- [ ] Router devreye alinmasa bile mevcut provider secimi davranisi bozulmuyor

## Notlar

- Multi-provider adapter'lar tamamlanmadan bu gorev acilsa bile default tek-provider yolu korunmali.
```

---

## KONU 10 - E2E Test + CI/CD

Neden: Manual dogrulama fazla el emegi istiyor.
Sonuc: Release oncesi otomatik kalite kapisi kurulur.

```md
## Gorev Bilgileri

- Sprint: Release-readiness backlog
- Gorev: Web + server E2E altyapisi ve temel CI pipeline
- Modul: infra / test
- KARAR.MD Maddesi: Release discipline, repeatability

## Baglam

- Ilgili interface: workspace script ve test giris noktalari
- Referans dosya: mevcut `package.json`, `turbo.json`, `apps/server/scripts/*`
- Ilgili diger dosyalar:
  - `apps/web/src/App.tsx`
  - `apps/server/src/routes/auth.ts`
  - `apps/server/src/ws/register-ws.ts`

## Gorev Detayi

Iki asamali release kaniti kur:

- Playwright tabanli minimum E2E senaryolari:
  - auth / shell load
  - chat submit
  - approval akisi veya onun kontrollu alternatifi
- GitHub Actions CI:
  - typecheck
  - lint
  - unit test
  - build
  - mümkünse izole E2E lane

## Sinirlar

- [ ] Canli provider secret'larini CI'da kullanma
- [ ] Butun release sistemini tek gorevde kurmaya calisma
- [ ] Testleri "yesil yapmak icin" gercek davranisi bastirma
- [ ] Mock ile live path'i birbirine karistirma

## Degistirilebilecek Dosyalar

- root `package.json`
- root `playwright.config.ts` yeni
- root `.github/workflows/ci.yml` yeni
- `e2e/*` yeni

## Degistirilmeyecek Dosyalar

- Uygulama runtime kodu, test zorunlu kilmadikca

## Done Kriteri

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] E2E komutu lokal olarak en az bir smoke senaryosunu kosturuyor
- [ ] CI workflow dosyasi cache ve artifact mantigiyla okunur durumda

## Notlar

- Ilk hedef tam coverage degil; guvenilir minimum release gate kurmaktir.
```
