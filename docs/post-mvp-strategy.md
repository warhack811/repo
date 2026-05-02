# Post-MVP Strategy

Bu belge, MVP closure notu ile post-MVP strateji notlarini tek yerde toplar.
Amaci, bugunku resmi closure claim'i ile yeni urun yonunu birbirine karistirmadan ayni baglam kaynagina indirmektir.

Bu dokuman:

- `vision.md` veya `karar.md` yerine gecmez
- yeni feature implementasyonu acmaz
- MVP closure claim'ini geriye donuk genisletmez

## 1. MVP Closure

Runa MVP, `Groq-only validated baseline` provider stance'i ile resmi olarak kapatilmistir.

Bugun kanitlanan urun cumlesi:

`Runa, ayni proje/repo icinde dogal dil gorevini anlayip workspace truth, approval-aware mutation, summary-first visibility ve sonraki run'a tasinan hafiza surekliligi ile isi gercekten ilerletebilen bir AI calisma ortagidir.`

Bu closure claim'i su evidence zincirine dayanir:

- repo health: `pnpm.cmd typecheck`, `pnpm.cmd lint`, `pnpm.cmd test`
- Groq primary live smoke: `pnpm.cmd --dir apps/server run test:groq-live-smoke`
- Groq-only rehearsal helper: `pnpm.cmd --dir apps/server run test:groq-demo-rehearsal`
- formal repeatability: `pnpm.cmd --dir apps/server run test:formal-repeatability`
- core coverage capture: `pnpm.cmd --dir apps/server run test:core-coverage`
- live ws evidence: `apps/server/src/ws/register-ws.test.ts`
- operator handoff evidence: `docs/groq-demo-runbook.md` + `PROGRESS.md`

## 2. Strategic Direction

MVP closure duruyor; yeni faz bunun ustune kurulur.

Core Hardening (Phase 2) icin secilen stratejik yon:

`Cloud-first otonom agent runtime + consumer-grade chat-first calisma ortagi + desktop kontrolu`

Bu yeni yonun ana eksenleri:

- **Cloud Infrastructure Strategy:** Supabase ile guvenli auth, veritabani ve storage. Hybrid deployment.
- **Agentic Runtime Strategy:** Async generator loop ile otonom, max 200 turn atan auto-continue calisma.
- **Desktop Companion Strategy:** Buluttan yonetilen ama kullanicinin bilgisayarinda signed-in desktop companion olarak calisan, local bridge/runtime tasiyan Windows-first masaustu yuzeyi.
- **Authentication & Subscription Model:** Free/Pro/Business tier'larla feature gating.
- **Product/UI Strategy:** Dashboard-first olmayan, sade ama yetenekli, consumer-grade bir calisma ortagi yuzeyi.

Desktop companion stratejisinin urun seviyesi anlami:

- kullanici `exe` indirip kurdugunda Runa'yi desktop uygulamasi olarak gorebilir
- desktop uygulamasi icinden hesabina girer
- uygulama acik ve oturum aktifken ilgili bilgisayar kullanicinin hesabina bagli online cihaz olarak gorunur
- kullanici web arayuzunden normal chat/research akisina devam eder
- gerekli auth/policy/approval kosullari altinda ayni web akisinden o online bilgisayarda agent aksiyonlari baslatabilir

Onemli sinir:

- bunlar bugun implement edilmis capability'ler degildir
- bunlar bugun claim edilen MVP kapsami degildir
- bunlar yeni fazin stratejik yon basliklaridir

## 3. Primary Audience & Product Promise

Core Hardening (Phase 2) icin katmanli hedef kullanici:

`basit kullanicidan, bilgisayarinda agent otonomisi gormek isteyen teknik uzmana kadar genisleyen consumer segmenti`

Persona katmanlari:

- Birincil: Solo developer ve teknik kurucular (gercek auto-pilot agent bekler)
- Ikincil: Genel kullanici (ChatGPT yerine premium butunlesik bir workspace bekler)
- Phase 3 Hedefi: Kucuk teknik ekipler

Temel urun vaadi:

`Runa, gunluk isleri ve gunluk konusmalari proje/is baglamini kaybetmeden ileri tasiyan, sureklilik sahibi bir AI calisma ortagidir.`

Bu vaat su cizgiyi korur:

- generic chat araci degildir
- coding-only tool degildir
- bare agent platform degildir
- gunluk is ritmine yakin, proje-baglamli bir AI calisma ortagidir

## 4. UI/UX Manifestosu

Bugunku inspection-heavy MVP/demo yuzeyi dogru bir release-validation/operator yuzeyidir; ancak uzun vadeli primary urun yuzu degildir.

Baglayici hedef UX standardi:

`calm, consumer-grade, chat-first work companion`

Bu manifesto Sprint 10/11 ve sonrasi icin baglayicidir:

- Dashboard mantigina gidilmez. Ana urun hissi, Claude Cowork / Dispatch / sade ChatGPT cizgisine yakin bir calisma ortagi deneyimidir.
- Ana akisin omurgasi mobil-oncelikli, chat-first ilerler. Masaustu yerlesim bunu buyuten bir katmandir; tersine bir dashboard/ops duzeni degildir.
- Natural-language-first presentation esastir. Tool call, search, audit, background isler ve benzeri teknik hareketler once insansi calisma diliyle anlatilir.
- `Advanced`, `Raw Transport`, `Model Override`, low-level execution kontrolleri ve benzeri operator/dev-ops yuzeyleri ana chat ekraninda default, yan panel veya accordion olarak bulunmaz.
- Bu teknik yuzeyler yalniz izole bir `Developer Mode` veya acikca gelistirici profiline ait ikinci katmanda acilir.
- Approval deneyimi chat-native, sade accept/reject akisi olarak dusunulur. Agir diff/log/ham detay yalniz kullanici isterse modal, popup veya ikinci katmanda gorunur.
- Sistem arkada daha fazla capability kazansa bile on yuz sade, esnek, korkutmayan ve kaliteli kalir. Teknik guc on tarafta spaghetti UI'ye donusturulmez.

Bu cizginin secilme gerekceleri:

- kullanici segment analizleri
- benzer urun arastirmalari
- capability sayisi artarken spaghetti UI riskini azaltma ihtiyaci
- sade ama guclu bir urun yuzunun daha uzun omurlu olmasi

Current repo reality:

- Bugunku repo gecis halindedir; `DashboardPage`, `SettingsPage`, operator/debug panelleri ve inspection agirlikli dil hala gorunebilir.
- Bu alanlar mevcut snapshot'in durust tarifidir; manifesto ile tam hizalanmis son urun yuzu olarak yorumlanmamalidir.
- Bu belge yeni capability claim'i acmaz; yalniz hedef urun/UI yonunu netlestirir.

## 5. Active Core Hardening Scope vs Accepted Gaps

### Artik Aktif Scope'ta Olanlar (Phase 2'de Cozulecekler)
- Agentic otonomi ve coklu-tur ilerleme (Track A)
- Cloud auth, tenant izolasyonu ve subscription (Track B)
- Chat-first consumer UI manifesto hizalamasi ve ilgili surface sadelestirmeleri (Track C)

### Guncel Accepted Gaps
Asagidakiler gorunur kalir ama Phase 2 Core Hardening closure blocker'i degildir:

- Anthropic / Gemini claim'i yayin oncesine kadar `TBD` durumundadir (DeepSeek primary baseline olarak onaylandi)
- full browser e2e eylem bazinda test otomasyonu (e2e suite)
- enterprise-grade on-premise deployment playbook
- observability backend maturity eksigi
- mobil uygulama

### Non-Claims

Bugun claim edilmeyen alanlar:

- `secondary-provider validated` (yayin oncesine kadar)
- full browser e2e backed release guarantee
- enterprise rollout / deployment platformu
- capability packs veya MCP'nin bugun acik ve implement edilmis oldugu iddiasi
- takim veya organizasyon yonetimi (Phase 3)

## 6. One-Line Handoff

Eger tek cumleyle devredilecekse:

`Runa, MVP closure sonrasi cloud-first hybrid mimaride ilerleyen; web ve signed-in desktop companion uzerinden kullanilan, arkada guclu ama onde chat-first ve consumer-grade kalan bir AI calisma ortagi olarak Phase 2 Core Hardening yonune girdi.`
