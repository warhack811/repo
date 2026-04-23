# Runa - Phase 1 Prompt Set

> Kapsam: Konu 1-5
> Kullanım: Asagidaki bloklar dogrudan gorev prompt'u olarak kopyalanabilir.
> Kural: Kod yazmadan once `AGENTS.md`, `implementation-blueprint.md`, `docs/TASK-TEMPLATE.md`, `PROGRESS.md` okunur.

---

## KONU 1 - SSE Token Streaming

Neden: Runtime loop var ama kullanici cevabi toplu goruyor.
Sonuc: Anlik token akisi, daha hizli algi ve daha canli chat deneyimi.

```md
## Gorev Bilgileri

- Sprint: Core Hardening follow-up - Track A / Track C
- Gorev: Gateway streaming + WS text delta + frontend incremental render
- Modul: gateway / ws / web
- KARAR.MD Maddesi: Runtime Session, Presentation, Realtime transport

## Baglam

- Ilgili interface: `packages/types/src/gateway.ts`
- Referans dosya: `apps/server/src/gateway/groq-gateway.ts`, `apps/server/src/ws/run-execution.ts`
- Ilgili diger dosyalar:
  - `apps/server/src/gateway/claude-gateway.ts`
  - `packages/types/src/ws.ts`
  - `packages/types/src/ws-guards.ts`
  - `apps/web/src/hooks/useChatRuntime.ts`
  - `apps/web/src/pages/ChatPage.tsx`
  - `apps/web/src/index.css`

## Gorev Detayi

Mevcut generate-only akisini bozmadan additive token streaming destegi ekle.

- Groq ve Claude gateway'lerinde `stream()` yolunu mevcut request shape'ine sadik kalarak tamamla.
- `run-execution.ts` icinde stream destekleyen provider geldiginde incremental text delta'lari WS uzerinden yayinla.
- `packages/types/src/ws.ts` tarafina additive `text.delta` server message ekle.
- Frontend `useChatRuntime.ts` icinde gelen delta'lari append et ve `ChatPage.tsx` uzerinde aktif yanita gecici streaming yuzeyi olarak goster.
- Streaming desteklemeyen provider icin mevcut non-streaming fallback davranisini koru.

## Sinirlar

- [ ] Mevcut `generate()` davranisini bozma
- [ ] `ModelGateway` kontratini breaking sekilde degistirme
- [ ] Mevcut presentation block akisini yeniden tasarlama
- [ ] Yeni provider ekleme
- [ ] Yeni dependency ekleme gerekiyorsa once not dus, sessizce ekleme
- [ ] `any` kullanma
- [ ] Unknown error swallow etme

## Degistirilebilecek Dosyalar

- `packages/types/src/gateway.ts`
- `packages/types/src/ws.ts`
- `packages/types/src/ws-guards.ts`
- `apps/server/src/gateway/groq-gateway.ts`
- `apps/server/src/gateway/claude-gateway.ts`
- `apps/server/src/ws/run-execution.ts`
- `apps/server/src/ws/register-ws.test.ts`
- `apps/web/src/hooks/useChatRuntime.ts`
- `apps/web/src/pages/ChatPage.tsx`
- `apps/web/src/index.css`

## Degistirilmeyecek Dosyalar

- `apps/server/src/ws/register-ws.ts`
- `apps/server/src/policy/*`
- `apps/server/src/auth/*`

## Done Kriteri

- [ ] `pnpm --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/gateway/gateway.test.ts src/ws/register-ws.test.ts`
- [ ] `pnpm --filter @runa/server typecheck`
- [ ] `pnpm --filter @runa/web typecheck`
- [ ] `pnpm --filter @runa/web build`
- [ ] Streaming destekleyen provider ile `text.delta` mesajlari run bitmeden once gonderiliyor
- [ ] `run.finished` halen tek ve dogru terminal sinyal olarak kaliyor

## Notlar

- Amaç token-by-token UX'i acmak; WS protocol redesign yapmak degil.
- Frontend mevcut toplu yanit yolunu tolere etmeye devam etmeli.
```

---

## KONU 2 - Multi-Provider Gateway

Neden: Dev ve prod provider secenegi dar; fallback ve capability secimi zayif.
Sonuc: OpenAI ve Gemini ile provider cesitliligi, daha guclu routing zemini.

```md
## Gorev Bilgileri

- Sprint: Phase 3 hazirlik backlog - Track A
- Gorev: OpenAI ve Gemini gateway ekleme
- Modul: gateway
- KARAR.MD Maddesi: ModelGateway provider abstraction

## Baglam

- Ilgili interface: `packages/types/src/gateway.ts`
- Referans dosya: `apps/server/src/gateway/groq-gateway.ts`
- Ilgili diger dosyalar:
  - `apps/server/src/gateway/claude-gateway.ts`
  - `apps/server/src/gateway/factory.ts`
  - `apps/server/src/gateway/providers.ts`
  - `apps/server/src/gateway/gateway.test.ts`
  - `apps/web/src/hooks/useChatRuntime.ts`

## Gorev Detayi

`ModelGateway` omurgasini koruyarak iki yeni provider adapter'i ekle:

- `apps/server/src/gateway/openai-gateway.ts`
- `apps/server/src/gateway/gemini-gateway.ts`

Gerekenler:

- `generate()` ve mevcut streaming kontratina uyumlu `stream()` destegi
- Tool-call parse yolu
- `factory.ts` ve `providers.ts` wiring'i
- Frontend runtime config/provider secimi tarafinda additive provider listesi guncellemesi

## Sinirlar

- [ ] Mevcut Groq ve Claude davranisini bozma
- [ ] `ModelGateway` abstraction'ini bypass etme
- [ ] Gateway ortak tiplerini breaking sekilde degistirme
- [ ] Model router bu gorevde acma
- [ ] Provider-specific gizli runtime hack yazma

## Degistirilebilecek Dosyalar

- `packages/types/src/gateway.ts` gerekirse additive
- `apps/server/src/gateway/openai-gateway.ts` yeni
- `apps/server/src/gateway/gemini-gateway.ts` yeni
- `apps/server/src/gateway/factory.ts`
- `apps/server/src/gateway/providers.ts`
- `apps/server/src/gateway/gateway.test.ts`
- `apps/web/src/hooks/useChatRuntime.ts`

## Degistirilmeyecek Dosyalar

- `apps/server/src/ws/*`
- `apps/server/src/auth/*`
- `apps/web/src/pages/ChatPage.tsx` yapisal redesign

## Done Kriteri

- [ ] `pnpm --filter @runa/server exec vitest run --config ./vitest.src.config.mjs --configLoader runner src/gateway/gateway.test.ts`
- [ ] `pnpm --filter @runa/server typecheck`
- [ ] `pnpm --filter @runa/web typecheck`
- [ ] Yeni provider'lar factory uzerinden secilebiliyor
- [ ] Groq ve Claude test coverage'i regress olmuyor

## Notlar

- Bu gorev fallback-chain degil, sadece provider adapter ekleme gorevidir.
- Default model adlari sabit ve tek yerde tutulmali; daginik literal yayma yapma.
```

---

## KONU 3 - Premium Design System

Neden: Web yuzeyi bakim ve tutarlilik acisindan dağinik.
Sonuc: Daha tutarli, premium ve manifesto ile uyumlu chat-first UI.

```md
## Gorev Bilgileri

- Sprint: Track C polish follow-up
- Gorev: Web design system zemini ve kontrollu UI migration
- Modul: web
- KARAR.MD Maddesi: Chat-first consumer surface

## Baglam

- Ilgili interface: mevcut component contract'lari ve page props'lari korunacak
- Referans dosya: `apps/web/src/pages/ChatPage.tsx`, `apps/web/src/components/chat/ChatShell.tsx`
- Ilgili diger dosyalar:
  - `apps/web/src/index.css`
  - `apps/web/src/pages/LoginPage.tsx`
  - `apps/web/src/pages/SettingsPage.tsx`
  - `apps/web/src/components/app/AppShell.tsx`
  - `apps/web/src/components/auth/*`

## Gorev Detayi

Web tarafinda premium ama additive bir design-system zemini kur:

- Stil token'larini `index.css` uzerinde merkezi hale getir.
- Chat, login ve settings yuzeylerinde tekrar eden panel/buton/form kaliplarini ortak class veya mevcut component seam'leri ile toparla.
- Chat-first manifesto ile uyumlu kal: operator/debug yuzeylerini daha baskin hale getirme.
- Eger yeni UI dependency'leri onerilecekse bunu prompt icinde "opsiyonel/onay gerekir" olarak yaz; zorunlu varsayma.

## Sinirlar

- [ ] `apps/server/*` ve `packages/types/*` tarafina dokunma
- [ ] UI'yi dashboard-first yone kaydirma
- [ ] Yeni design-system kurulumunu sessizce dayatma
- [ ] Developer Mode yuzeylerini ana chat akisinin onune alma
- [ ] WS/runtime davranisini degistirme

## Degistirilebilecek Dosyalar

- `apps/web/src/index.css`
- `apps/web/src/pages/ChatPage.tsx`
- `apps/web/src/pages/LoginPage.tsx`
- `apps/web/src/pages/SettingsPage.tsx`
- `apps/web/src/components/app/AppShell.tsx`
- `apps/web/src/components/chat/*`
- `apps/web/src/components/auth/*`

## Degistirilmeyecek Dosyalar

- `apps/server/src/ws/*`
- `apps/server/src/runtime/*`

## Done Kriteri

- [ ] `pnpm --filter @runa/web typecheck`
- [ ] `pnpm --filter @runa/web lint`
- [ ] `pnpm --filter @runa/web build`
- [ ] Chat, login ve settings ekranlarinda belirgin stil tekrarları azalmis
- [ ] Ana chat akisi hala sade ve chat-first kalmis

## Notlar

- Bu gorev tam UI rewrite degil; mevcut yuzeyi daha sistemli hale getirme gorevidir.
- Bagimli bir kütüphane kurulacaksa once architecture escalation note ve onay gerekir.
```

---

## KONU 4 - MCP Desteği

Neden: Tool sistemi kapali; standart dis entegrasyon yolu eksik.
Sonuc: MCP uyumlu dis tool surface'i.

```md
## Gorev Bilgileri

- Sprint: Phase 3 backlog - Track A
- Gorev: StdIO tabanli MCP client ve tool bridge temeli
- Modul: tools / gateway-adjacent integration
- KARAR.MD Maddesi: Tool plane extensibility

## Baglam

- Ilgili interface: `packages/types/src/tools.ts`
- Referans dosya: `apps/server/src/tools/registry.ts`
- Ilgili diger dosyalar:
  - `apps/server/src/ws/runtime-dependencies.ts`
  - `apps/server/src/tools/README.md`
  - `apps/server/src/runtime/*`

## Gorev Detayi

MCP'yi mevcut ToolRegistry yapisini bypass etmeden entegre et:

- `packages/types/src/mcp.ts` altina additive tipler ekle.
- `apps/server/src/mcp/` altinda stdio transport, client ve registry bridge katmani kur.
- MCP tool'lari `ToolDefinition` benzeri runtime shape'e map'le.
- `runtime-dependencies.ts` icinde built-in tool set'ine additive olarak MCP tool discovery seam'i ac.

## Sinirlar

- [ ] Built-in tool registry kontratini bozma
- [ ] MCP icin paralel ikinci bir tool execution sistemi kurma
- [ ] SSE/remote transport bu ilk gorevde acma
- [ ] Web UI veya desktop alanina girme

## Degistirilebilecek Dosyalar

- `packages/types/src/mcp.ts` yeni
- `packages/types/src/index.ts`
- `apps/server/src/mcp/*` yeni
- `apps/server/src/ws/runtime-dependencies.ts`
- `apps/server/src/tools/registry.test.ts` veya hedefli yeni testler

## Degistirilmeyecek Dosyalar

- `apps/server/src/tools/file-read.ts`
- `apps/server/src/tools/shell-exec.ts`
- `apps/web/src/*`

## Done Kriteri

- [ ] `pnpm --filter @runa/server typecheck`
- [ ] `pnpm --filter @runa/server lint`
- [ ] Hedefli MCP unit/integration testleri yesil
- [ ] Built-in tool'lar registry'de aynen calismaya devam ediyor

## Notlar

- Ilk hedef stdio transport'tur; protocol genislemesini minimumda tut.
- Tool adlandirma cakismalari varsa built-in tool'larin override edilmesine izin verme.
```

---

## KONU 5 - Desktop Agent

Neden: `GAP-12` halen acik; bugun sadece screenshot var.
Sonuc: Kontrollu desktop input capability ailesi.

```md
## Gorev Bilgileri

- Sprint: Sprint 11 / Track C hazirlik gorevi
- Gorev: Approval-gated desktop control tool ailesi
- Modul: tools / desktop boundary
- KARAR.MD Maddesi: Desktop capability, approval safety

## Baglam

- Ilgili interface: `packages/types/src/tools.ts`
- Referans dosya: `apps/server/src/tools/desktop-screenshot.ts`
- Ilgili diger dosyalar:
  - `apps/server/src/tools/registry.ts`
  - `apps/server/src/ws/runtime-dependencies.ts`
  - `apps/server/src/policy/permission-engine.ts`

## Gorev Detayi

`desktop.screenshot` yanina minimum ama dogru bir desktop tool ailesi ekle:

- `desktop.click`
- `desktop.type`
- `desktop.keypress`
- `desktop.scroll`

Her biri icin:

- Approval gerekli olmali
- Typed parametre schema'si olmali
- Registry wiring'i olmali
- Hedefli unit test coverage olmali

## Sinirlar

- [ ] `apps/desktop-agent/` package'i bu gorevde acma
- [ ] Vision-action loop bu ilk gorevde acma
- [ ] Browser automation ile desktop kontrolu birbirine karistirma
- [ ] Existing `desktop-screenshot` davranisini bozma
- [ ] Sessizce yeni native dependency ekleme; gerekiyorsa once onay gerektigini acik yaz

## Degistirilebilecek Dosyalar

- `apps/server/src/tools/desktop-click.ts` yeni
- `apps/server/src/tools/desktop-type.ts` yeni
- `apps/server/src/tools/desktop-keypress.ts` yeni
- `apps/server/src/tools/desktop-scroll.ts` yeni
- `apps/server/src/tools/registry.ts`
- `apps/server/src/ws/runtime-dependencies.ts`
- `apps/server/src/tools/*.test.ts` hedefli yeni testler

## Degistirilmeyecek Dosyalar

- `apps/server/src/ws/register-ws.ts`
- `apps/web/src/*`
- `packages/types/src/ws.ts`

## Done Kriteri

- [ ] `pnpm --filter @runa/server typecheck`
- [ ] `pnpm --filter @runa/server lint`
- [ ] Yeni desktop tool testleri yesil
- [ ] Tum yeni desktop tool'lar approval-gated olarak registry'ye kayitli
- [ ] `desktop.screenshot` coverage'i regress olmuyor

## Notlar

- Bu gorev "minimum hardening" gorevidir.
- Desktop capability yuksek riskli oldugu icin once dar tool ailesi acilir; tam desktop-agent mimarisi daha sonra gelir.
```
