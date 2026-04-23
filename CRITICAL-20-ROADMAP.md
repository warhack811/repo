# Runa - Critical 20 Roadmap

> Tarih: 22 Nisan 2026
> Amac: `CRITICAL-20` backlog'unu repo gercegiyle hizali, prompt-template uyumlu ve uygulanabilir hale getirmek.
> Bu belge kod yazmaz; dogru sirayi, gerekceyi ve prompt kullanim disiplinini tanimlar.

---

## Hedef Puanlama

Bu belge seti asagidaki 4 alanda `10/10` hedefiyle yeniden duzenlendi:

| Alan | 10/10 tanimi |
| --- | --- |
| Konu secimi | Gercek urun farkini yaratan bosluklar net, tekrar yok, oncelik mantikli |
| Repo hizasi | Gorevler mevcut `Core Hardening Phase 2` durumu, acik gap'ler ve aktif mimari ile uyumlu |
| Prompt formati | Tum gorevler `docs/TASK-TEMPLATE.md` diline, exact path mantigina ve no-go disiplinine uyuyor |
| Uygulanabilirlik | Her gorev dar kapsamli, additive, testlenebilir ve bir sonraki agente kopyala-yapistir verilebilir |

---

## Repo Gercegi

Bu roadmap asagidaki kabul edilmis gerceklerin ustune kurulur:

- Aktif faz `Core Hardening Phase 2`.
- Sprint 9 ve Sprint 10 kabul edilmis isleri repoda.
- Acik ana gap'ler: `GAP-11` approval/policy persistence hardening, `GAP-12` desktop capability ailesi.
- `apps/desktop-agent/` bugun repoda yok; desktop isi prompt'lari bunu planli alan olarak ele alir.
- Web urunu icin baglayici yon chat-first, mobile-first, natural-language-first ve operator/debug yuzeylerini ikinci katmana iten manifestodur.
- Mevcut omurga yeniden yazilmaz; additive ilerlenir.
- Yeni dependency gerekiyorsa prompt bunu acik yazar; uygulama sirasinda onay gerekir.

---

## Bu Belge Seti Nasil Kullanilir

1. Once bu dosyadan siradaki konuyu sec.
2. Sonra ilgili `PROMPTS-PHASE-*.md` dosyasina git.
3. Gorevi oldugu gibi kullan ya da mevcut blocker'a gore kucukce daralt.
4. Prompt'u calistirmadan once `AGENTS.md`, `implementation-blueprint.md`, `docs/TASK-TEMPLATE.md`, `PROGRESS.md` tekrar okunur.

Kural:

- Bu roadmap "genis urun hayali" degil, "repo icinde sira disiplini" belgesidir.
- Buradaki prompt'lar backlog maddesi degil, uygulanabilir gorevlerdir.
- Her gorev exact path, non-goal ve denetlenebilir done kriteri ile gelir.

---

## Faz Mantigi

Roadmap 4 dosyaya bolunmus olsa da siralama yalniz "feature istegi" ile degil, su gate mantigi ile okunur:

| Gate | Anlam |
| --- | --- |
| Gate A | Mevcut runtime ve WS omurgasini kirmaz |
| Gate B | Auth / subscription / persistence kontratlarini bypass etmez |
| Gate C | Chat-first UI manifestosuna ters dusmez |
| Gate D | Gorev kucuk, additive ve testlenebilir kalir |

Bir konu stratejik olarak dogru olsa bile bu gate'lerden gecmiyorsa erken sayilir.

---

## Oncelik Sirasi

### P0 - Mevcut omurgayi tamamlayan ve urunu hissedilir sekilde guclendiren konular

| ID | Konu | Neden simdi | Beklenen sonuc | Prompt dosyasi |
| --- | --- | --- | --- | --- |
| 1 | SSE token streaming | Runtime var ama yanit hissi zayif | Canli cevap, daha hizli algi | `PROMPTS-PHASE-1.md` |
| 6 | Conversation persistence | Yenilemede baglam kaybi var | Gercek sohbet gecmisi | `PROMPTS-PHASE-2.md` |
| 7 | Markdown renderer | Asistan ciktisi duz metin kaliyor | Kod ve yapisal icerik okunur olur | `PROMPTS-PHASE-2.md` |
| 10 | E2E + CI/CD | Canli kalite kaniti zayif | Daha guvenli release akisi | `PROMPTS-PHASE-2.md` |
| 12 | Observability | Operasyonel iz surmek zor | Debug ve release guvenilirligi artar | `PROMPTS-PHASE-3.md` |
| 19 | Security hardening | Prod-grade auth/RBAC acigi var | Yayin oncesi guven modeli olgunlasir | `PROMPTS-PHASE-4.md` |
| 20 | Deployment | Local-only siniri suruyor | Ortamlar arasi tasinabilirlik | `PROMPTS-PHASE-4.md` |

### P1 - Omurgayi genisleten ama P0 ustune oturmasi gereken konular

| ID | Konu | Neden sonra | Beklenen sonuc | Prompt dosyasi |
| --- | --- | --- | --- | --- |
| 2 | Multi-provider gateway | Once streaming ve kalite zemini otursun | OpenAI/Gemini destegi | `PROMPTS-PHASE-1.md` |
| 3 | Premium design system | UX guclu ama mimariye sadik ilerlemeli | Daha tutarli premium UI | `PROMPTS-PHASE-1.md` |
| 8 | State management | Buyuk hook borcu var ama davranis kanitlari korunmali | Daha bakimli frontend orchestration | `PROMPTS-PHASE-2.md` |
| 11 | Rate limiting | Subscription var, enforcement eksik | Abuse korumasi ve tier dogrulugu | `PROMPTS-PHASE-3.md` |
| 15 | File upload + multimodal | Gercek calisma akislari icin gerekli | Dosya/gorsel tabanli kullanim | `PROMPTS-PHASE-3.md` |
| 18 | Semantic memory + RAG | Vizyona direkt bagli ama once persistence zemini lazim | "Her seferinde sifirdan baslamaz" vaadi derinlesir | `PROMPTS-PHASE-4.md` |

### P2 - Farklilastirici ama daha gec acilmasi saglikli konular

| ID | Konu | Neden daha sonra | Beklenen sonuc | Prompt dosyasi |
| --- | --- | --- | --- | --- |
| 4 | MCP | Tool ekosistemi icin guclu ama surface buyutur | Standart dis tool entegrasyonu | `PROMPTS-PHASE-1.md` |
| 5 | Desktop agent | `GAP-12` ile hizali, fakat yuksek riskli | Gercek desktop etkilesimi | `PROMPTS-PHASE-1.md` |
| 9 | Model router | Multi-provider oturmadan erken | Maliyet/kalite dengesi | `PROMPTS-PHASE-2.md` |
| 13 | Plugin system | MCP ve tool governance oturmadan erken | Genisletilebilir tool sistemi | `PROMPTS-PHASE-3.md` |
| 14 | Voice I/O | Core akisi guclendikten sonra acilmali | Daha genis giris/cikis yuzeyi | `PROMPTS-PHASE-3.md` |
| 16 | Collaborative sessions | Tek kullanicili omurga once olgunlasmali | Ekipli kullanim | `PROMPTS-PHASE-4.md` |
| 17 | Mobile PWA | Mobil polish ancak chat yuzeyi oturunca anlamli | App-benzeri mobil deneyim | `PROMPTS-PHASE-4.md` |

---

## Critical 20 - Sebep Sonuc Zinciri

| ID | Konu | Sebep | Sonuc |
| --- | --- | --- | --- |
| 1 | SSE token streaming | Yanit toplu akiyor | Hiz algisi ve canlilik artar |
| 2 | Multi-provider gateway | Provider secenegi dar | Uyum, fallback ve kalite secimi genisler |
| 3 | Premium design system | UI bakimi ve premium his zayif | Tutarli, daha guven veren urun yuzeyi |
| 4 | MCP | Tool sistemi kapali | Dis ekosistemle standart entegrasyon |
| 5 | Desktop agent | Sadece screenshot var | Etkilesimli bilgisayar kullanimina gecis |
| 6 | Conversation persistence | Refresh ile her sey gidiyor | Gercek sohbet devamli olur |
| 7 | Markdown renderer | Asistan cevabi fakir gorunuyor | Kod, tablo ve liste okunur olur |
| 8 | State management | Hook karmasasi buyuyor | Daha saglam frontend orchestration |
| 9 | Model router | Tek model her ise kosuluyor | Maliyet ve yetenek dengesi kurulur |
| 10 | E2E + CI/CD | Manual kontrol yorucu ve riskli | Release oncesi otomatik guvence |
| 11 | Rate limiting | Subscription enforcement zayif | Abuse korumasi ve urun siniri netlesir |
| 12 | Observability | Sorunlari izlemek zor | Hata ayiklama ve operasyon kolaylasir |
| 13 | Plugin system | Tool eklemek kod degisikligi istiyor | Genisleme hizi artar |
| 14 | Voice I/O | Text-only yuzey sinirli | Daha ulasilabilir kullanim |
| 15 | File upload + multimodal | Gercek veriyle calisma eksik | Pratik is senaryolari acilir |
| 16 | Collaborative sessions | Tek kullanicili akista kaliyor | Ekipli kullanim baslar |
| 17 | Mobile PWA | Mobil his zayif | Gunluk kullanim guclenir |
| 18 | Semantic memory + RAG | Derin baglam hatirlama yok | Runa vaadi guclenir |
| 19 | Security hardening | Prod-grade auth eksik | Yayin guveni artar |
| 20 | Deployment | Local-only siniri var | Dagitim ve olcekleme yolu acilir |

---

## Dosya Bazli Haritalama

Bu tablo, konularin repoda nereye temas edecegini tek bakista gosterir:

| Konu grubu | Ana touchpoint'ler |
| --- | --- |
| Gateway / provider | `apps/server/src/gateway/*`, `packages/types/src/gateway.ts` |
| Runtime / WS | `apps/server/src/ws/*`, `apps/server/src/runtime/*`, `packages/types/src/ws.ts` |
| Persistence / memory | `packages/db/src/*`, `apps/server/src/persistence/*`, `apps/server/src/memory/*` |
| Auth / policy / security | `apps/server/src/auth/*`, `apps/server/src/policy/*`, `packages/types/src/policy.ts` |
| Web chat UX | `apps/web/src/pages/*`, `apps/web/src/components/chat/*`, `apps/web/src/hooks/*`, `apps/web/src/index.css` |
| Desktop / tools | `apps/server/src/tools/*`, planli `apps/desktop-agent/*`, `packages/types/src/tools.ts` |
| Infra / release | root `package.json`, `turbo.json`, `.github/workflows/*`, Docker / K8s dosyalari |

---

## Prompt Kalite Standardi

Bu set altindaki her gorev su kontrol listesini gecmek zorundadir:

- Turkce yazilmis olmali.
- `docs/TASK-TEMPLATE.md` basliklarini kullanmali.
- Exact file path vermeli.
- "Sadece ..." ve "dokunma" sinirlari acik olmali.
- Mevcut kontratlari korumali; gerekirse additive type/path acmali.
- Dependency gerekiyorsa bunu acik not etmeli; sessizce dayatmamalidir.
- `pnpm --filter ... typecheck`, `lint`, hedefli `vitest` ve gerekiyorsa live smoke gibi denetlenebilir done kriteri icermeli.
- "Works" gibi muallak dil yerine somut komut ve beklenen sonuc yazmali.

---

## Faz Dosyalari

| Dosya | Icerik |
| --- | --- |
| `PROMPTS-PHASE-1.md` | Konu 1-5: streaming, provider, design system, MCP, desktop |
| `PROMPTS-PHASE-2.md` | Konu 6-10: conversations, markdown, state, router, E2E/CI |
| `PROMPTS-PHASE-3.md` | Konu 11-15: quota, observability, plugin, voice, multimodal |
| `PROMPTS-PHASE-4.md` | Konu 16-20: collab, PWA, memory/RAG, security, deploy |

---

## Son Not

Bu roadmap "hepsini hemen yap" listesi degildir.
Dogru okuma su olmalidir:

- P0 konular once gelir.
- P1 konular P0 proof'lari alindiktan sonra acilir.
- P2 konular urunu buyutur ama omurgayi gevsetmeden acilmalidir.

Bu dosya seti, bir sonraki agentin "yanlis goreve kaymasini" azaltmak icin yazildi.
