# Release / Demo Validation Checklist

Bu dokuman Sprint 6'daki release/readiness sertlestirme ciktilarinin guncel ozetidir.
Amaci, bugunku validated baseline icin "demo oncesi ne kosulur, neye PASS denir, ne blocker sayilir?" sorusunu kisa ve tekrar kullanilabilir bicimde netlestirmektir.

Bu dokuman:

- full browser e2e suite degildir
- full release automation platformu degildir
- production rollout sistemi degildir
- telemetry backend veya CI gate tasarimi degildir

Kisa operator/handoff akisi icin bkz: [docs/groq-demo-runbook.md](/d:/ai/Runa/docs/groq-demo-runbook.md).

## Sonuc Siniflari

- `PASS`: Tum mandatory gate'ler gecer. Eger demo/release acikca belirli bir secondary provider validation iddiasi tasiyorsa o provider smoke da `PASS` olmak zorundadir.
- `PASS WITH OPS GAPS`: Repo health, formal repeatability, formal coverage, primary provider ve demo zinciri gecer; kalanlar yalnizca blocker olmayan, gorunur ops gap seviyesindedir.
- `BLOCKED`: Demo/release durustce yapilamaz; cunku bir mandatory gate eksiktir, prerequisite yoktur veya ilan edilen provider/release iddiasi mevcut evidence ile desteklenmemektedir.
- `FAIL`: Gerekli komut veya smoke gercekten kosulmus ve runtime/config/contract seviyesinde kirik davranis bulunmustur.

## Minimum Mandatory Gates

### 1. Repo Health

Asagidaki komutlar yesil olmadan release/demo hazir sayilmaz:

```powershell
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd test
```

Beklenen:

- typecheck PASS
- lint PASS
- tum test zinciri PASS

### 1.1 Groq-only Rehearsal Convenience Path

Komut zincirinden once environment authority kontrolu yap:

- `GROQ_API_KEY` mevcut shell / IDE env icinde gorunur olmalidir
- Eger credential kaynagi local `.env` ise bunu once mevcut shell'e yukle; repo `dotenv` benzeri otomatik yukleme yapmaz
- aksi durumda `test:groq-live-smoke` sonucu durustce `BLOCKED` doner

Bugunku Groq-only baseline icin authoritative prova akisi:

```powershell
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd test
pnpm.cmd --dir apps/server run test:groq-live-smoke
pnpm.cmd --dir apps/server run test:groq-demo-rehearsal
```

Son iki komutun rolleri ayriktir:

- `test:groq-live-smoke` = authoritative primary provider gate
- `test:groq-demo-rehearsal` = formal repeatability + core coverage rehearsal helper

### 2. Formal Repeatability

Authoritative komut:

```powershell
pnpm.cmd --dir apps/server run test:formal-repeatability
```

Beklenen summary yorumu:

- `FORMAL_REPEATABILITY_SUMMARY`
- `result = PASS`
- `passed_runs = 5`
- `test_file = dist/ws/register-ws.test.js`
- demo-style live chain search/read/approval-gated write uzerinde tekrarlanabilir calisir

### 3. Formal Coverage Capture

Authoritative komut:

```powershell
pnpm.cmd --dir apps/server run test:core-coverage
```

Beklenen summary yorumu:

- `CORE_COVERAGE_SUMMARY`
- `threshold_passed = true`
- esik: file coverage `>70`, LOC-weighted coverage `>70`

### 4. Primary Provider Smoke

Primary provider:

- Groq

Authoritative komut:

```powershell
pnpm.cmd --dir apps/server run test:groq-live-smoke
```

Authority notu:

- `GROQ_API_KEY` authoritative env adidir
- API key alias'i yoktur
- `GROQ_MODEL` authoritative model env adidir
- hicbiri verilmezse helper `llama-3.3-70b-versatile` kullanir
- repo kokundeki `.env-örnek` live smoke source-of-truth'u degildir ve otomatik yuklenmez

Beklenen yorum:

- Groq smoke, release/demo icin mandatory gate seviyesindedir
- `GROQ_LIVE_SMOKE_SUMMARY.result = PASS`
- en guncel source-of-truth live smoke kaydi `PROGRESS.md` ile uyumlu gorunmelidir

### 5. Secondary Provider Smoke

Secondary provider:

- bugun aktif release/demo claim'inin parcasi degildir
- claim-scoped olarak acilir

Kural:

- Demo veya release belirli bir secondary provider'i acikca validated diye sunuyorsa, o provider icin ayrik live smoke `PASS` olmak zorundadir
- Secondary provider smoke olmadan `provider-agnostic routing hazir` veya `secondary-provider ready` claim'i acilmaz

Tarihsel not:

- Anthropic / Claude helper'i repo icinde korunur
- son resmi kaydi `BLOCKED` + `credential_missing` olarak durur
- bu sonuc Groq-only baseline icin blocker degil, secondary provider claim'i icin blocker sayilir

### 6. Demo Zinciri Validation Seti

Minimum demo zinciri su halkalari gorunur veya testle kanitli olmalidir:

- search/read: `search.codebase` ile hedefi bul, `file.read` ile ac
- approval/replay: yazma mutasyonu approval ile dursun ve `approval.resolve` sonrasi replay olsun
- write/apply: mutasyon uygulansin
- visible result: `presentation.blocks` icinde ilgili summary/result block'lari gorunsun
- memory continuity: sonraki run icin prompt-facing memory continuity kaniti olsun
- inspection visibility: summary-first inspection + linked detail akisi gorunsun

Bugunku source-of-truth dagilimi:

- formal repeatability senaryosu: search/read/approval/write/visible result
- `register-ws.test.ts` icindeki live ws test ailesi: memory continuity + inspection summary/detail
- `pnpm.cmd test`: bu aileyi toplu dogrular

### 7. Docs / Onboarding Sanity

Su dokumanlar birbiriyle uyumlu olmalidir:

- `README.md`
- `AGENTS.md`
- `PROGRESS.md`
- `docs/post-mvp-strategy.md`

Kontrol:

- `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm test` komutlari dogru mu
- local demo akisi okunabilir mi
- provider/env beklentileri durust mu
- `.env-örnek` release/demo source-of-truth gibi sunulmuyor mu
- operator/demo runbook dili, ana urun/UI manifestosu ile karistirilmiyor mu

### 8. Known Gap Hygiene

Release/demo karari verilmeden once kalan aciklar su uc kovaya ayrilmalidir:

- `known blocker`
- `known ops gap`
- `out-of-scope`

#### Known blocker

Asagidakiler blocker sayilir:

- repo health zinciri kirmizi
- formal repeatability FAIL
- Groq primary provider smoke PASS degil
- demo/release acikca secondary provider claim ediyor ama o provider smoke PASS degil
- docs/env/provider claim'i gercek durumla celisiyor

#### Known ops gap

Asagidakiler blocker olmayan ops gap olarak gorunebilir:

- secondary provider smoke helper'inin tarihsel olarak `credential_missing` durumda olmasi, ama mevcut demo Groq uzerinden yapiliyorsa
- browser e2e yoklugu
- telemetry backend yoklugu
- daha genis operator handbook yoklugu

#### Out-of-scope

Asagidakiler bu checklist'in disindadir:

- full browser e2e suite kurmak
- production rollout sistemi kurmak
- telemetry backend kurmak
- multi-provider routing yazmak
- Phase 1.1 capability expansion isleri

## Bugunku Baseline

- repo health: PASS
- formal repeatability: PASS (`5/5`)
- formal coverage capture: PASS
- Groq-only rehearsal helper: PASS
- Groq primary provider smoke kaydi: PASS
- secondary provider validated claim'i: kapali / TBD
- tarihsel Anthropic / Claude helper kaydi: `BLOCKED` (`credential_missing`)
- resmi release/demo stance: `Groq-only validated baseline`
- provider routing implementation: deferred until active secondary-provider readiness `PASS`

Bu yuzden bugunku karar soyle okunur:

- Groq-merkezli MVP demo icin: `PASS WITH OPS GAPS`
- belirli bir secondary provider validation iddiasi icin: `BLOCKED`
