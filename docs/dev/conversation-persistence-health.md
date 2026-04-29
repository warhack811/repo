# Conversation Persistence Health

Bu not, local/dev/demo ortaminda `/conversations` endpoint'inin hangi persistence
modunda calistigini ve 500 durumunun ne zaman gercek misconfiguration anlamina
geldigini netlestirir.

## Env secimi

Conversation persistence `@runa/db` config zincirini kullanir:

- `DATABASE_TARGET=local`: `DATABASE_URL`, sonra `LOCAL_DATABASE_URL`.
- `DATABASE_TARGET=cloud` veya `supabase`: `SUPABASE_DATABASE_URL`, sonra `DATABASE_URL`.
- `DATABASE_TARGET` yoksa Supabase env anahtarlarinin varligi cloud target inference'i yapar; aksi halde local target kullanilir.

`apps/server/scripts/dev.mjs` repo kokundeki `.env` dosyasini once, `.env.local`
dosyasini sonra yukler. `.env.local` dosyadan gelen DB anahtarlarini override
edebilir; shell veya IDE tarafindan zaten set edilmis env degerleri ise dosya
degerlerinin ustundedir.

## Local dev/demo minimum setup

Gunluk local demo icin onerilen yol local PostgreSQL'dir:

```dotenv
DATABASE_TARGET=local
DATABASE_URL=postgres://runa:<local-dev-password>@127.0.0.1:5432/runa
LOCAL_DATABASE_URL=postgres://runa:<local-dev-password>@127.0.0.1:5432/runa
```

Ornek container:

```powershell
docker run --name runa-postgres `
  -e POSTGRES_USER=runa `
  -e POSTGRES_PASSWORD=<local-dev-password> `
  -e POSTGRES_DB=runa `
  -p 5432:5432 `
  -v runa-postgres-data:/var/lib/postgresql/data `
  -d postgres:16-alpine
```

Server ilk conversation read/write denemesinde schema bootstrap'i calistirir.
`conversations`, `conversation_messages` ve `conversation_members` tablolari
eksikse bootstrap tarafindan olusturulur.

## Beklenen `/conversations` davranisi

- DB env hic yoksa first-run dev oturumunda `GET /conversations` `200 {"conversations":[]}` donebilir.
- DB env var ve secilen hedefe baglanilabiliyorsa bos hesapta yine `200 {"conversations":[]}` beklenir.
- DB env var gorunurken hedef DB kapaliysa, URL gecersizse, cloud/local target yanlissa veya schema bootstrap basarisizsa endpoint `500` doner.

Bu 500 bilincli olarak empty state'e cevrilmez. Response DB URL veya secret
degeri sizdirmaz; yalniz guvenli health metadata'si verir:

```json
{
  "code": "CONVERSATION_PERSISTENCE_UNAVAILABLE",
  "operation": "list_conversations",
  "persistence": {
    "target": "local",
    "target_source": "DATABASE_TARGET",
    "database_url_source": "DATABASE_URL"
  }
}
```

## Smoke

Backend persistence release proof icin tek komut:

```powershell
pnpm.cmd --filter @runa/server run test:persistence-release-proof
```

Bu komut `PERSISTENCE_RELEASE_PROOF_SUMMARY` satiri uretir. Release icin
beklenen sonuc `result: "PASS"` olmalidir ve su zinciri birlikte kanitlanir:

- DB config secimi ve CRUD smoke.
- Bos hesapta first-run `GET /conversations` 200 empty state.
- Conversation/message persist edip ayni owner scope'unda geri okuyabilme.
- Local memory RLS proof.
- Approval persistence + reconnect live smoke.

`result: "BLOCKED"` cikarsa bu release kaniti tamamlanmis sayilmaz; DB
credential/engine, provider credential veya local proof prerequisite'i acikca
duzeltilip komut yeniden kosulmalidir.

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd --filter @runa/db build
pnpm.cmd --filter @runa/types build
pnpm.cmd --filter @runa/server dev
pnpm.cmd --filter @runa/web dev
```

Authenticated local dev browser smoke:

- `/chat`
- direct browser fetch `/conversations`
- `/account`
- `/developer`
- `/dashboard -> /chat`
- `/settings -> /account`
- direct browser fetch `/desktop/devices`

Demo/dev icin hedef sonuc: `/conversations` ve `/desktop/devices` 200 doner ve
React console'da `Maximum update depth exceeded` gorulmez.
