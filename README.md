# Runa

Runa, projeyi taniyan ve hatirlayan bir AI calisma ortagidir.
Bu README repo icin giris kapisidir; mimari anayasa veya sprint otoritesi degildir.

## Urun/UI Manifestosu

Runa'nin baglayici urun yonu dashboard-first bir uygulama olmak degildir. Hedef yuzey, Claude Cowork / Dispatch / sade ChatGPT hissine yakin, consumer-grade bir "calisma ortagi" deneyimidir.

Bu ne anlama gelir:

- Ana deneyim chat-first ve mobil-onceliklidir.
- Tool, search, audit ve background calisma dili once natural-language-first sekilde sunulur.
- `Advanced`, `Raw Transport`, `Model Override` gibi operator/dev-ops yuzeyleri ana sohbet ekraninda default, panel veya accordion olarak yer almaz.
- Bu agir teknik yuzeyler yalniz izole bir `Developer Mode` veya gelistirici profiline ait ikinci katmanda bulunur.
- Approval deneyimi sade accept/reject akisidir; diff/log/ham detay ise yalniz istendiginde ikinci katmanda acilir.

Durust not:

- Bugunku repo chat-first yone kaymis olsa da gecis tamamen bitmis degildir; legacy dosya adlari (`DashboardPage`, `SettingsPage`) ve bazi ikinci katman teknik affordance'lari kod seviyesinde halen gorulebilir.
- Guncel authenticated ana akis `/chat` + `/account` + `/developer` ayrimi uzerinden okunmalidir.

## Otorite Belgeler

Yeni bir oturumda once context rotasini oku:

1. `docs/INDEX.md`
2. `docs/LLM-CONTEXT.md`
3. `docs/AGENTS.md`
4. `docs/TASK-TEMPLATE.md`
5. `docs/PROGRESS.md` icindeki guncel ozet ve ilgili son kayitlar

Goreve gore ek belgeler `docs/INDEX.md` ve `docs/LLM-CONTEXT.md` icindeki tabloya gore secilir. `docs/implementation-blueprint.md`, `docs/post-mvp-strategy.md`, `docs/technical-architecture.md`, `docs/security-model.md`, `karar.md` ve `vision.md` uzun referans belgeleridir; default context degil, task-relevant otoritedir.

## Bugun Repo Neyi Sunuyor?

- Phase 2 / Core Hardening aktif gelisim hatti
- Fastify + WebSocket backend uzerinde auth-aware ve subscription-aware canli run akislari
- Sprint 9 sonrasi WS split: `register-ws.ts` artik ince composition katmani; esas sorumluluk `transport.ts`, `orchestration.ts`, `presentation.ts`, `run-execution.ts` dosyalarinda
- Sprint 10.5 sonrasi web split: `App.tsx` auth gate + router sahibi; authenticated varsayilan giris `/chat`, ikinci katmanlar `/account` ve `/developer`
- Auth UI, authenticated shell, logout/profile surface, responsive/a11y hardening, current-run progress polish ve router entegrasyonu uygulanmis durumda
- Ana urun hedefi artik chat-first consumer surface'tir; mevcut dashboard/operator agirlikli parcalar gecis snapshot'i olarak okunmalidir
- Shared WS payload validation mantigi `packages/types/src/ws-guards.ts` altinda ortaklastirildi
- `apps/desktop-agent/` package'i, typed `/ws/desktop-agent` secure bridge'i ve `desktop.screenshot` icin ilk approval-gated vertical slice repoda gercektir
- Hedef urun dili yalniz local daemon degil; signed-in desktop companion + online device presence + approval-gated remote computer control yonundedir

Henuz closure seviyesinde olmayan buyuk alanlar:

- user-facing desktop app shell
- web tarafinda online device presence gorunurlugu
- desktop capability ailesinin release-grade local bridge'e tam tasinmasi (`desktop.click`, `desktop.type`, `desktop.keypress`, `desktop.scroll`)
- approval/policy state icin process-disi persistence hardening'i

## Monorepo Ozeti

| Yol | Rol |
| --- | --- |
| `apps/server` | Fastify backend, runtime, policy, auth, storage, WS split katmanlari |
| `apps/web` | React + Vite istemcisi, auth shell, chat runtime ve page surface'leri |
| `apps/desktop-agent` | Local desktop bridge/runtime foundation, secure `/ws/desktop-agent` handshake ve bugunku `desktop.screenshot` proof seami |
| `packages/types` | Tum sistemin ortak kontrat omurgasi |
| `packages/db` | Drizzle schema, DB config ve persistence yardimcilari |
| `packages/utils` | Paylasilan kucuk utility katmani |

## Ilk Bakilacak Kod Noktalari

Server tarafinda:

- `apps/server/src/ws/register-ws.ts`
- `apps/server/src/ws/transport.ts`
- `apps/server/src/ws/orchestration.ts`
- `apps/server/src/ws/run-execution.ts`
- `apps/server/src/policy/permission-engine.ts`
- `apps/server/src/runtime/agent-loop.ts`

Web tarafinda:

- `apps/web/src/App.tsx`
- `apps/web/src/components/app/AppShell.tsx`
- `apps/web/src/hooks/useAuth.ts`
- `apps/web/src/hooks/useChatRuntime.ts`
- `apps/web/src/pages/ChatPage.tsx`
- `apps/web/src/lib/ws-client.ts`

Shared kontratlarda:

- `packages/types/src/blocks.ts`
- `packages/types/src/ws.ts`
- `packages/types/src/ws-guards.ts`
- `packages/types/src/auth.ts`

## Gereksinimler

- Guncel bir Node.js LTS surumu
- `pnpm@9.15.4`
- Calisan bir PostgreSQL instance'i
- Gecerli bir provider API key'i

Notlar:

- Bugunku resmi validated baseline `Groq-only` cizgisidir
- `ModelGateway` provider-agnostic omurgadir
- Anthropic / Claude helper'i tarihsel secondary-provider smoke yolu olarak korunur; merkezi product claim'i degildir

## Kurulum

### 1. Bagimliliklari kur

```bash
git clone <repo-url>
cd Runa
pnpm install
```

### 2. Environment degiskenlerini hazirla

Authoritative dev DB yolu local Docker PostgreSQL'dir. Gunluk `pnpm dev` dongusunde cloud auth/storage env'lerini koruyup DB write-path'i local'e almak icin repo kokunde gitignored `.env.local` kullanin:

```dotenv
DATABASE_TARGET=local
DATABASE_URL=postgres://runa:<local-dev-password>@127.0.0.1:5432/runa
LOCAL_DATABASE_URL=postgres://runa:<local-dev-password>@127.0.0.1:5432/runa
```

Ornek local container:

```powershell
docker run --name runa-postgres `
  -e POSTGRES_USER=runa `
  -e POSTGRES_PASSWORD=<local-dev-password> `
  -e POSTGRES_DB=runa `
  -p 5432:5432 `
  -v runa-postgres-data:/var/lib/postgresql/data `
  -d postgres:16-alpine
```

Notlar:

- `DATABASE_TARGET=local` oldugunda runtime/persistence hatti `DATABASE_URL` -> `LOCAL_DATABASE_URL` precedence'i ile local DB'yi kullanir
- Supabase auth/storage icin gerekli `SUPABASE_*` env'leri `.env` veya shell/IDE env'inde kalabilir; local DB secimi bunlari devre disi birakmaz
- `pnpm dev` icindeki `@runa/server` bootstrap'i repo kokundeki `.env` dosyasini once additive olarak, `.env.local` dosyasini ise yalniz file-backed anahtarlari override edecek sekilde yukler
- Shell veya IDE tarafindan zaten verilmis env degerleri override edilmez
- Repo kokundeki `.env.example` benzeri dosyalar source-of-truth degildir

### 3. Gelistirme modunda calistir

```bash
pnpm dev
```

Bu komut:

- backend'i `http://127.0.0.1:3000` uzerinde calistirir
- web app'i `http://127.0.0.1:5173` uzerinde acik tutar
- `/ws` ve `/auth` hatlarini dev proxy ile backend'e baglar

## Gelistirme Komutlari

Repo seviyesi:

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

Windows shell policy nedeniyle gerekirse `pnpm.cmd` kullanin.

Onerilen dogrulama zinciri:

```powershell
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd test
```

Web odakli hizli kontrol:

```powershell
pnpm.cmd --filter @runa/web typecheck
pnpm.cmd --filter @runa/web lint
pnpm.cmd --filter @runa/web build
```

Primary provider smoke:

```powershell
pnpm.cmd --dir apps/server run test:groq-live-smoke
```

## Onboarding Notlari

- Her goreve `docs/AGENTS.md` + `docs/PROGRESS.md` ile baslayin
- `docs/implementation-blueprint.md` plan otoritesidir; `docs/PROGRESS.md` gerceklesmis is otoritesidir
- UI/web/desktop-agent gorevlerinde `docs/post-mvp-strategy.md` icindeki manifesto ve `docs/AI-DEVELOPMENT-GUIDE.md` guardrail'lari da okunmalidir
- Kod degistirirken once `packages/types`, sonra server, sonra web sirasi korunur
- Yeni capability acmak yerine mevcut seams uzerinden additive ilerleyin
- `apps/server/src/ws/register-ws.ts` ve `apps/web/src/App.tsx` artik tek basina monolit giris noktasi degildir; split surface'leri birlikte okuyun

## Known Boundaries

Bu repo bugun sunlari claim etmez:

- full user-facing desktop app experience'inin hazir oldugu
- full remote desktop kontrolunun hazir oldugu
- premium consumer UI'nin closure seviyesinde tamamlandigi
- ana chat yuzeyinin manifesto ile tamamen hizalandigi
- secondary-provider validated baseline
- enterprise rollout / deployment platformu

Durust notlar:

- Track C tarafinda auth UI ve web app shell gercektir; `apps/desktop-agent/` secure bridge foundation'i de repodadir, ancak desktop app shell + online device presence henuz tamamlanmamistir
- Ana chat deneyiminde operator/debug yuzeylerinin tam izolasyonu hedefi henuz closure seviyesinde tamamlanmamis durumdadir
- Web search varsayilan truth kaynagi degildir
- README onboarding rehberidir; runbook veya docs portal yerine gecmez

## Gelistirme Notlari

- Dar gorev, dar modul, net sinir
- `packages/types` kontratlarini bypass etmeyin
- LLM uretimi degisiklikler insan review olmadan merge edilmemelidir
- Gorev ciktisini kisa ve kanitli tutun; yapilmayan isi yapildi gibi yazmayin

## Bu README Neyi Kapsamaz?

Bu dokuman:

- mimari anayasa degildir
- sprint ledger'i degildir
- product strategy belgesi degildir
- deployment runbook'u degildir

Ama yeni bir gelistiricinin repo'yu ayaga kaldirmasi ve bugunku aktif surface'leri dogru yerden okumasi icin gerekli giris seviyesini saglar.
