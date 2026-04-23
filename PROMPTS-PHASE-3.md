# Runa - Phase 3 Prompt Set

> Kapsam: Konu 11-15
> Kullanım: Bu dosya guvenilirlik, genisletilebilirlik ve multimodal backlog gorevlerini task-template disiplinine indirger.

---

## KONU 11 - Rate Limiting

Neden: Subscription var ama gercek enforcement zayif.
Sonuc: Abuse korumasi ve tier siniri netlesir.

```md
## Gorev Bilgileri

- Sprint: Track B follow-up
- Gorev: HTTP ve WS icin dar kapsamli quota/rate-limit enforcement
- Modul: policy / ws
- KARAR.MD Maddesi: Subscription gating, progressive trust

## Baglam

- Ilgili interface: `packages/types/src/policy.ts`, `packages/types/src/ws.ts`
- Referans dosya: `apps/server/src/policy/subscription-gating.ts`
- Ilgili diger dosyalar:
  - `apps/server/src/policy/usage-quota.ts`
  - `apps/server/src/ws/run-execution.ts`
  - `apps/server/src/ws/policy-wiring.ts`

## Gorev Detayi

Tier-aware rate limiting ekle:

- Run baslatma icin WS tarafinda kullanici bazli limit uygula.
- Uygun yerde HTTP tarafinda daha hafif bir koruma uygula.
- Limit asiminda typed reject nedeni don.
- Mantigi saf helper ve test ile kanitla.

## Sinirlar

- [ ] Odeme/billing sistemi acma
- [ ] Redis zorunlulugu getirme; ilk adimda mevcut yapiga uygun basit persistence/in-memory dengesini koru
- [ ] WS protocol redesign yapma

## Degistirilebilecek Dosyalar

- `packages/types/src/policy.ts`
- `packages/types/src/ws.ts`
- `apps/server/src/policy/usage-quota.ts`
- `apps/server/src/ws/run-execution.ts`
- ilgili test dosyalari

## Degistirilmeyecek Dosyalar

- `apps/web/src/*`
- `apps/server/src/auth/*`

## Done Kriteri

- [ ] Quota/rate-limit testleri yesil
- [ ] `pnpm --filter @runa/server typecheck`
- [ ] `pnpm --filter @runa/server lint`
- [ ] Limit asiminda reject nedeni acik ve typed

## Notlar

- Bu gorev "minimum dogru enforcement" gorevidir; tam billing/analytics sistemi degildir.
```

---

## KONU 12 - Observability

Neden: `console.*` ile release/debug hikayesi zayif.
Sonuc: Sorunlar daha kolay izlenir, run bazli korelasyon guclenir.

```md
## Gorev Bilgileri

- Sprint: Release-readiness backlog
- Gorev: Structured logging zemini ve secili span/tracing seam'leri
- Modul: server
- KARAR.MD Maddesi: Observability, release discipline

## Baglam

- Ilgili interface: runtime/gateway/tool execution log akisi
- Referans dosya: `apps/server/src/ws/run-execution.ts`
- Ilgili diger dosyalar:
  - `apps/server/src/gateway/*`
  - `apps/server/src/tools/*`
  - `apps/server/src/app.ts`

## Gorev Detayi

Structured logging ve minimum tracing zemini kur:

- Ortak logger utility'si tanimla.
- Kritik `console.*` kullanimlarini logger'a tasi.
- `run_id`, `trace_id`, provider/model gibi alanlari log baglamina ekle.
- Tracing acilacaksa once secili dar seam'lerde ac: run -> gateway -> tool execution.

## Sinirlar

- [ ] Tum sistemi tek seferde telemetry platformuna baglama
- [ ] Gizli verileri loglama
- [ ] Mevcut debug env flag'lerini bozma
- [ ] UI telemetry paneli acma

## Degistirilebilecek Dosyalar

- `apps/server/src/utils/logger.ts` yeni
- `apps/server/src/app.ts`
- `apps/server/src/ws/run-execution.ts`
- `apps/server/src/gateway/*`
- `apps/server/src/tools/*`
- ilgili testler

## Degistirilmeyecek Dosyalar

- `apps/web/src/*`

## Done Kriteri

- [ ] `pnpm --filter @runa/server typecheck`
- [ ] `pnpm --filter @runa/server lint`
- [ ] Logger utility tek giris noktasi olarak kullaniliyor
- [ ] Gizli alanlar maske veya omit ediliyor

## Notlar

- OpenTelemetry acilacaksa da gorev ilk adimda Pino/structured logging zeminini garanti etsin.
```

---

## KONU 13 - Plugin System

Neden: Yeni tool eklemek kaynak kodu degisikligi gerektiriyor.
Sonuc: Daha esnek ama kontrollu bir genisleme yolu acilir.

```md
## Gorev Bilgileri

- Sprint: Phase 3 backlog
- Gorev: Dosya tabanli plugin loader ve sandboxli tool bridge
- Modul: tools / plugin infrastructure
- KARAR.MD Maddesi: Extensibility under policy

## Baglam

- Ilgili interface: `packages/types/src/tools.ts`
- Referans dosya: `apps/server/src/tools/registry.ts`
- Ilgili diger dosyalar:
  - `apps/server/src/ws/runtime-dependencies.ts`
  - `apps/server/src/policy/permission-engine.ts`

## Gorev Detayi

Built-in tool registry'yi bozmadan plugin discovery seam'i ac:

- Plugin manifest formatini tanimla.
- Loader ile plugin'leri tara ve kaydet.
- Handler execution'u sandbox/child-process benzeri izole yolda yap.
- Built-in tool isimlerini override etmeyi engelle.

## Sinirlar

- [ ] Marketplace / remote download acma
- [ ] MCP ile plugin sistemini tek gorevde birlestirme
- [ ] Mevcut built-in tool execution yolunu replace etme

## Degistirilebilecek Dosyalar

- `apps/server/src/plugins/*` yeni
- `apps/server/src/ws/runtime-dependencies.ts`
- `apps/server/src/tools/registry.ts`
- ilgili test dosyalari

## Degistirilmeyecek Dosyalar

- `apps/web/src/*`
- `packages/types/src/ws.ts`

## Done Kriteri

- [ ] Hedefli plugin loader testleri yesil
- [ ] `pnpm --filter @runa/server typecheck`
- [ ] `pnpm --filter @runa/server lint`
- [ ] Built-in tool override denemesi reddediliyor

## Notlar

- Plugin gorevi ancak policy ve registry disiplini korunursa degerlidir; kolay genisleme ugruna guven modeli delinmemeli.
```

---

## KONU 14 - Voice I/O

Neden: Sadece text tabanli kullanim yuzeyi var.
Sonuc: Daha erisilebilir ve gunluk kullanima yakin deneyim.

```md
## Gorev Bilgileri

- Sprint: Phase 3 UX backlog
- Gorev: Voice input/output icin minimum web seams
- Modul: web
- KARAR.MD Maddesi: Consumer-grade chat experience

## Baglam

- Ilgili interface: `apps/web/src/pages/ChatPage.tsx`
- Referans dosya: `apps/web/src/hooks/useChatRuntime.ts`
- Ilgili diger dosyalar:
  - `apps/web/src/components/chat/*`
  - `apps/web/src/pages/SettingsPage.tsx`

## Gorev Detayi

Web Speech API tabanli minimum ses giris/cikis seam'i ekle:

- `useVoiceInput` hook'u
- `useTextToSpeech` hook'u
- Chat composer yanina sade voice trigger
- Ayarlarda otomatik okuma benzeri tercih seam'i gerekiyorsa additive ac

## Sinirlar

- [ ] Server tarafinda speech service zorunlulugu acma
- [ ] Voice mode'u ana chat akisinin onune gecirme
- [ ] Mobil native app davranisi varsayma

## Degistirilebilecek Dosyalar

- `apps/web/src/hooks/useVoiceInput.ts` yeni
- `apps/web/src/hooks/useTextToSpeech.ts` yeni
- `apps/web/src/pages/ChatPage.tsx`
- `apps/web/src/pages/SettingsPage.tsx`
- `apps/web/src/components/chat/*`

## Degistirilmeyecek Dosyalar

- `apps/server/src/*`
- `packages/types/src/*`

## Done Kriteri

- [ ] `pnpm --filter @runa/web typecheck`
- [ ] `pnpm --filter @runa/web lint`
- [ ] `pnpm --filter @runa/web build`
- [ ] Mikrofon izni reddinde UI graceful fallback veriyor

## Notlar

- Bu gorev "minimum voice seam" gorevidir; tam voice-first urun modu degildir.
```

---

## KONU 15 - File Upload + Multimodal

Neden: Kullanici text disi veri veremiyor.
Sonuc: Gercek dokuman/gorsel tabanli calisma senaryolari acilir.

```md
## Gorev Bilgileri

- Sprint: Phase 3 depth backlog
- Gorev: Upload route, attachment contract ve chat composer entegrasyonu
- Modul: routes / storage / web / gateway
- KARAR.MD Maddesi: Artifact handling, multimodal context

## Baglam

- Ilgili interface: `packages/types/src/ws.ts`, `packages/types/src/gateway.ts`
- Referans dosya: `apps/server/src/auth/supabase-auth.ts`, `apps/server/src/persistence/*`
- Ilgili diger dosyalar:
  - `apps/web/src/pages/ChatPage.tsx`
  - `apps/web/src/components/chat/*`
  - `apps/server/src/routes/*`

## Gorev Detayi

Attachment tabanli minimum multimodal yol ac:

- Upload route ve typed response shape'i ekle.
- `RunRequestPayload` tarafina additive `attachments` alanı ekle.
- Chat composer'da dosya secme / yukleme seam'i ekle.
- Gateway tarafinda desteklenen attachment'lari request'e uygun sekilde map'le.

## Sinirlar

- [ ] Full document understanding pipeline acma
- [ ] Vision-action desktop loop ile karistirma
- [ ] Buyuk payload'i doğrudan WS block'larina gomerek tasima

## Degistirilebilecek Dosyalar

- `packages/types/src/ws.ts`
- `packages/types/src/gateway.ts`
- `apps/server/src/routes/upload.ts` yeni
- `apps/web/src/components/chat/FileUploadButton.tsx` yeni
- `apps/web/src/pages/ChatPage.tsx`
- ilgili test dosyalari

## Degistirilmeyecek Dosyalar

- `apps/server/src/ws/register-ws.ts`
- `apps/server/src/policy/*`

## Done Kriteri

- [ ] Hedefli route ve type testleri yesil
- [ ] `pnpm --filter @runa/server typecheck`
- [ ] `pnpm --filter @runa/web typecheck`
- [ ] `pnpm --filter @runa/web build`
- [ ] Attachment metadata'si typed ve additive sekilde tasiniyor

## Notlar

- Storage authority mevcut auth ve persistence seamlari ile uyumlu kalmali.
- Text dosyasi ve gorsel dosyasi davranislari ayri ve acik ele alinmali.
```
