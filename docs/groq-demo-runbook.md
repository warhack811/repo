# Groq-Only Demo Runbook

Bu not, bugunku resmi stance olan `Groq-only validated baseline` icin kisa operator/demo handoff runbook'udur.

Bu dokuman:

- tam deployment playbook degildir
- enterprise release runbook degildir
- on-call / support manual degildir
- secondary-provider readiness dokumani degildir

Amac, "demo oncesi ne kosariz, hangi sonucta devam ederiz, neyi claim ederiz?" sorularina tek sayfada cevap vermektir.

## 1. Official Stance

- Bugunku resmi claim: `Groq-only validated baseline`
- Secondary provider claim'i: kapali
- Multi-provider routing claim'i: kapali
- Demo kapsami: bugun kanitli olan Groq-merkezli repo/workspace baseline'i

Provider dili:

- Kullan: `Groq`, `Groq-only validated baseline`
- Kullanma: `secondary-provider validated`, `multi-provider ready`, `automatic failover`, `provider routing active`

UI veya operator seciminde resmi demo provider'i `groq` olmalidir.

## 2. Preflight Komut Sirasi

Komutlardan once environment otoritesini dogrula:

- `GROQ_API_KEY` mevcut shell / IDE env icinde gorunur olmalidir
- Eger credential kaynagi local `.env` ise bunu once mevcut shell'e yukle; repo `dotenv` benzeri otomatik yukleme yapmaz
- `GROQ_MODEL` opsiyoneldir; yoksa helper `llama-3.3-70b-versatile` kullanir

Demo oncesi minimum zorunlu sira:

```powershell
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd test
pnpm.cmd --dir apps/server run test:groq-live-smoke
pnpm.cmd --dir apps/server run test:groq-demo-rehearsal
```

Komut otoritesi:

- ilk uc komut = repo health mandatory gate
- dorduncu komut = Groq primary live smoke authority
- besinci komut = Groq-only formal rehearsal helper
- `pnpm.cmd --dir apps/server run test:formal-repeatability` ve `pnpm.cmd --dir apps/server run test:core-coverage` drill-down icindir
- `GROQ_API_KEY` authoritative env adidir
- `GROQ_MODEL` authoritative model env adidir
- repo kokundeki `.env-örnek` legacy referanstir; otomatik yuklenmez ve live smoke source-of-truth'u degildir

## 3. PASS / STOP / Ops Gap

### PASS

Demo devam edebilir, eger:

- `pnpm.cmd typecheck` PASS
- `pnpm.cmd lint` PASS
- `pnpm.cmd test` PASS
- `pnpm.cmd --dir apps/server run test:groq-live-smoke` icinde `GROQ_LIVE_SMOKE_SUMMARY.result = PASS`
- `pnpm.cmd --dir apps/server run test:groq-demo-rehearsal` icinde `GROQ_DEMO_REHEARSAL_SUMMARY.result = PASS`
- `PROGRESS.md` icindeki en guncel Groq primary smoke kaydi bu sonuc ile celismiyor

### STOP

Demo durdurulur, eger:

- repo health komutlarindan biri kirilir
- `test:groq-live-smoke` `BLOCKED` veya `FAIL` olur
- `test:groq-demo-rehearsal` FAIL olur
- docs / claim dili gercek evidence ile celisirse
- Groq primary smoke source-of-truth kaydi artik `PASS` degilse

### Non-Blocking Ops Gap

Asagidakiler bugunku Groq-only demo icin tek basina stop sebebi degildir:

- tarihsel Anthropic / Claude helper sonucunun `credential_missing` olmasi
- secondary provider readiness'in henuz acik olmamasi
- provider routing implementation'in defer edilmis olmasi
- browser e2e suite yoklugu
- enterprise deployment / release platformu yoklugu
- daha genis operator handbook yoklugu

## 4. Demo Claim Discipline

Demo sirasinda kullanilacak cizgi:

- "Bugun Groq-only validated baseline'i gosteriyoruz."
- "Bu akista repo/workspace odakli, summary-first ve approval-aware MVP omurgasini gosteriyoruz."
- "Secondary provider validation claim'i acik degil."
- "Provider routing ve failover bugunku release/demo claim'inin parcasi degil."

Anlatirken asiri claim'den kacinin:

- Phase 1.1 genislemelerini genel availability gibi anlatma
- secondary provider readiness varmis gibi anlatma
- public-web retrieval veya baska capability alanlarini core release claim'i gibi merkezlestirme

Kisa anlatim cizgisi:

- local/workspace truth + Groq execution + mevcut ws/presentation/approval inspection omurgasi

## 5. Sorun Olursa Ilk Bakilacak Yerler

Ilk bakis sirasi:

1. `pnpm.cmd --dir apps/server run test:groq-live-smoke`
2. `pnpm.cmd --dir apps/server run test:groq-demo-rehearsal`
3. Gerekirse `pnpm.cmd --dir apps/server run test:formal-repeatability`
4. Gerekirse `pnpm.cmd --dir apps/server run test:core-coverage`
5. `docs/release-demo-checklist.md`
6. `docs/PROGRESS.md`

Kod/evidence referansi icin ilk yerler:

- `apps/server/scripts/groq-live-smoke.mjs`
- `apps/server/scripts/groq-demo-rehearsal.mjs`
- `apps/server/scripts/formal-demo-repeatability.mjs`
- `apps/server/scripts/capture-core-coverage.mjs`
- `apps/server/src/ws/register-ws.test.ts`
- `apps/server/src/ws/register-ws.ts`

Yorum kurali:

- claim / provider / blocker sorusunda yeni yorum icat etme
- once checklist ve `docs/PROGRESS.md` uzerindeki son resmi kayda bak

## 6. Evidence Ref

- live smoke helper: [apps/server/scripts/groq-live-smoke.mjs](/d:/ai/Runa/apps/server/scripts/groq-live-smoke.mjs:1)
- rehearsal helper: [apps/server/scripts/groq-demo-rehearsal.mjs](/d:/ai/Runa/apps/server/scripts/groq-demo-rehearsal.mjs:1)
- formal repeatability: [apps/server/scripts/formal-demo-repeatability.mjs](/d:/ai/Runa/apps/server/scripts/formal-demo-repeatability.mjs:1)
- core coverage: [apps/server/scripts/capture-core-coverage.mjs](/d:/ai/Runa/apps/server/scripts/capture-core-coverage.mjs:1)
- release/demo gate yorumu: [docs/release-demo-checklist.md](/d:/ai/Runa/docs/release-demo-checklist.md:1)
- resmi sprint kaydi: [docs/PROGRESS.md](/d:/ai/Runa/docs/PROGRESS.md:1)

## 7. One-Line Handoff

Eger tek cumleyle devredilecekse:

`Groq-only validated baseline` demo akisi icin repo health + `test:groq-live-smoke` + `test:groq-demo-rehearsal` yesil olmali; secondary provider claim'i ve provider routing claim'i bugun kapali tutulmali.
