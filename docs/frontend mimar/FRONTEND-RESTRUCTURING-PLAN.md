# Runa Frontend Restructuring Plan

> Tarih: 2026-05-11
> Faz: Planlama (Phase 2 Core Hardening içinde, UI-OVERHAUL-08 hazırlığı)
> Branch: `codex/presentation-ready-20260510-034657`
> Kapsam: Yalnızca `apps/web`. Server / desktop-agent / packages değişmiyor.
> Statü: **Bu doküman sadece plandır. Kod değişikliği yapılmadı.**

Bu doküman; mevcut 9 Runa ekran görüntüsü (5 desktop + 4 mobile), `C:\Users\admin\OneDrive\Desktop\örnekler` altındaki 10 rakip görseli (Claude.ai Cowork, Claude Code, Codex), ve `apps/web` kaynak kodu üzerinden yapılan doğrudan inceleme sonucu yazıldı. Her iddia file:line ile desteklenir; tahmin yoktur.

Kalite çıtası: **frontier-level AI ürünü** — Claude Cowork, Claude Code, Codex, ChatGPT ve Linear/Raycast etkileşim disiplini seviyesi.

Rakipleri taklit etmiyoruz; rakiplerden çıkardığımız disiplin şudur: **tek birincil yüzey, az tekrarlı metadata, ince tool aktivitesi, sakin onaylar, varsayılanda ham debug dili yok, cömert beyaz alan, mobil için özel düzen.**

---

## 1. Mevcut UI Mimarisi Haritası

### 1.1 Üst düzey shell

| Surface | Komponent | Dosya | Görev |
|---|---|---|---|
| Authenticated app shell | `AppShell` | `apps/web/src/components/app/AppShell.tsx:117-192` | Chat sayfasında **floating** komut paleti tetikleyici + `AppNav` tile-row; diğer sayfalarda framed hero header + `AppNav`. |
| Üst gezinti tile-row | `AppNav` | `apps/web/src/components/app/AppNav.tsx:52-93` | 4 NavLink (`Sohbet / Geçmiş / Cihazlar / Hesap`) — chat sayfasında ortada havada durur, diğer sayfalarda hero header'a yerleşir. |
| Komut paleti tetikleyici | (inline) | `AppShell.tsx:131-139` ve `app-shell-migration.css:225-230` | `position: fixed; right:14; top:14; z-index:70` ile sağ-üst köşede serbest yüzer. |
| Chat shell | `ChatShell` | `apps/web/src/components/chat/ChatShell.tsx:10-36` | `RunaSurface` çift sarmal; gerçek bir görsel rol yok, sadece padding. |
| Chat header | `ChatHeader` | `apps/web/src/components/chat/ChatHeader.tsx:29-69` | Sol: menü + "Runa / Sohbet devam ediyor"; sağ: presence chip + ayarlar linki. |
| Chat layout grid | `ChatLayout` | `apps/web/src/components/chat/ChatLayout.tsx:14-58` | Slot-tabanlı: `sidebar`, `messages` (work), `composer`, `insights`. Sınıflar: `.runa-chat-layout__sidebar/__work/__composer/__insights`. |

Çakışma: Chat sayfasının görsel "üstü" üç bağımsız parçadan oluşuyor: floating Ctrl+K pilli + AppNav tile-row + ChatHeader strip. Hiçbirinin diğeriyle ortak bir hizalama bütünü yok.

### 1.2 Sohbet (transkript) yüzeyi

| Görev | Komponent | Dosya |
|---|---|---|
| Persisted mesaj balonları | `PersistedTranscript` | `apps/web/src/components/chat/PersistedTranscript.tsx:24-57` |
| Tek mesaj rol etiketi + tarih meta | (inline) | `PersistedTranscript.tsx:47-52` — `getRoleLabel` "Sen / Runa / Sistem" + `toLocaleString('tr-TR')` saniye-doğruluk |
| Markdown render | `StreamdownMessage` | `apps/web/src/lib/streamdown/StreamdownMessage.tsx` (incelenmedi, planı etkilemez) |
| Streaming aşamasındaki delta | `StreamingMessageSurface` | `apps/web/src/components/chat/StreamingMessageSurface.tsx` |
| Mevcut sohbet konteyneri | `CurrentRunSurface` | `apps/web/src/components/chat/CurrentRunSurface.tsx:22-83` |
| Geçmiş run surface'leri | `PastRunSurfaces` | `apps/web/src/components/chat/PastRunSurfaces.tsx` |
| Empty state önerileri | `EmptyState` | `apps/web/src/components/chat/EmptyState.tsx:38-60` |
| Markdown blok render | `BlockRenderer` + `blocks/*` | `apps/web/src/components/chat/blocks/*.tsx` |

### 1.3 Tool aktivitesi / run progress / canlı çalışma notları

Aynı agent run için **üç ayrı yüzey** veri tüketiyor:

1. **Sohbet içi mini progres satırı + adım listesi** — `RunProgressPanel`
   - `apps/web/src/components/chat/RunProgressPanel.tsx:88-187`
   - User-facing modda (line 97-118): "headline + detay + ThinkingBlock veya ToolActivityIndicator (ilk 3 madde)".
   - Developer modda (line 120-185): aynı içerikle birlikte `runtimePhases`, `currentSurfaceContext`, `observedSteps`, `approvalBoundary` chip serileri.
   - ChatPage'de mount: `ChatPage.tsx:197-204` (`!isRunCompleted` koşuluyla).

2. **PresentationRunSurfaceCard ("Canlı / Geçmiş çalışma" kartı)** — sohbet içine yerleşen büyük framed kart
   - `apps/web/src/components/chat/PresentationRunSurfaceCard.tsx:40-175`
   - Mount: `ChatPage.tsx:214-227` (`visibleCurrentPresentationSurface` varsa).
   - Block-by-block render eder; içine ApprovalBlock, ToolResultBlock, CodeBlockCard, EventListBlock, vs. doldurur.
   - Geçmiş run'lar için aynı kart `<details open={expanded}>` ile collapsed render edilir.

3. **WorkInsightPanel (sağ rail "İlerleme / Masaüstü / Bağlam")**
   - `apps/web/src/components/chat/WorkInsightPanel.tsx:30-136`
   - `currentRunProgress.step_items.slice(-4)` ile son 4 adımı `<ol>` listesi olarak gösterir.
   - "Masaüstü" panel cihaz adı ve `capabilities.length`, "Bağlam" panel `presentationRunSurfaceCount` ve `attachmentCount` metric tile'larıyla.
   - Mount: `ChatPage.tsx:304-314` — `ChatLayout.insights` slot'u.

Yardımcı bileşenler:

- `ToolActivityIndicator` — `apps/web/src/components/chat/ToolActivityIndicator.tsx:57-75` — küçük "Çalışıyor / Tamamlandı / Başarısız" liste rozetleri.
- `ThinkingBlock` — `apps/web/src/components/chat/ThinkingBlock.tsx` — adım adım düşünme list'i.
- `RunStatusChips` — `apps/web/src/components/chat/RunStatusChips.tsx` — developer modda phase/context chip serisi.
- `workNarrationFormat.ts` — `apps/web/src/components/chat/workNarrationFormat.ts:1-139` — tool-name → TR etiket sözlüğü ve string-replace whitelist.

### 1.4 Approval (onay) yüzeyi

| Yüzey | Komponent | Dosya |
|---|---|---|
| Sohbet içi approval kartı | `ApprovalBlock` | `apps/web/src/components/chat/blocks/ApprovalBlock.tsx:265-389` |
| Kart altındaki "Detay" disclosure | `RunaDisclosure` (developer) | `ApprovalBlock.tsx:337-386` |
| Onay aksiyonları (Onayla / Reddet) | `RunaButton` | `apps/web/src/components/ui/RunaButton.tsx` |
| Approval'ın run timeline'ında özetlenmesi | `RunProgressPanel.tsx:159-184` | Developer modda approval boundary chip + label. |

### 1.5 Sağ rail (context / progress)

Tek komponent: `WorkInsightPanel`. Üç `<section className={styles.panel}>` (`İlerleme`, `Masaüstü`, `Bağlam`). Her bölüm bordered + padded + ayrı arka planlı. "Bağlam" panelin içinde iki ayrı `<div className={styles.metric}>` daha (bkz. card-in-card analizi bölüm 5).

### 1.6 Desktop vs Mobile düzen kontrolü

Tüm sorumluluk CSS'te. Komponent tarafında platform-specific dallanma yok.

| Breakpoint | Dosya | Davranış |
|---|---|---|
| Default (desktop ≥1025px) | `components.css:718-755` | `runa-chat-layout` 3 kolon: `minmax(220px,280px) minmax(0,1fr) minmax(250px,304px)`. |
| `min-width: 1025px` | `components.css:757-771` | Sidebar `position: sticky`, sticky offset 92px. |
| `max-width: 1180px` | `WorkInsightPanel.module.css:188-193` | Sağ rail sticky bırakılıyor, ama internal grid 3 kolonlu olur. |
| `max-width: 1024px` | `components.css:1782-1850` | Layout tek kolon olur; sidebar `display: contents` + fixed overlay olur; insights `order: 3`. |
| `max-width: 768px` | `components.css:1852-2019` | `runa-chat-header` flex-direction column; **layout main** flex-column, **composer sticky** `bottom: 78px`, **app-nav fixed** bottom tab bar. `page` `padding-bottom: 148px`. |
| `max-width: 760px` | `WorkInsightPanel.module.css:195-199` | Sağ rail metric grid tek kolon. |
| `max-width: 640px` | `app-shell-migration.css:354-372` | Komut paleti tetikleyici span gizli, kbd kalır (mobil ekran görüntüsünde span yine görünür — kural ya geçersiz ya da specificity kaybı; doğrulanmalı). |
| `max-width: 540px` / `480px` | `components.css:956, 2021+` | Token override'lar + minik dokunuş ayarlamaları. |

İkinci öbek tanım: `primitives.css:525-547` aynı `.runa-chat-layout` kuralını **2 kolonlu** olarak yeniden tanımlıyor — `components.css:718` tanımı override ediyor; ölü kod ama kafa karıştırıcı.

---

## 2. Sorun Bölgeleri — Komponent / Dosya bazında

### S-1. Aynı agent run'ı 3 yerde render eden tekrar

| Yer | Veri kaynağı | Görsel sonuç |
|---|---|---|
| `RunProgressPanel` (sohbet içi) | `currentRunProgress.step_items` | "Canlı Çalışma Notları" başlıklı yatay alan + alt-adımlar listesi. |
| `PresentationRunSurfaceCard` (sohbet içi) | `surface.blocks` | Aynı run'ın block-by-block dökümü; "İŞLEM SONUCU" kartlarını sıralar. |
| `WorkInsightPanel` (sağ rail) | `currentRunProgress.step_items.slice(-4)` | Son 4 adım + masaüstü hedef + bağlam istatistikleri. |

Sonuç: "Git durum kontrolü tamamlandı" mesajı aynı turda **üç ayrı kart** içinde görünüyor (ToolResultBlock kartı + RunProgressPanel adım listesi + WorkInsightPanel `<ol>`).

Mount referansı: `ChatPage.tsx:197-204, 214-227, 304-314, 322-327`.

### S-2. Floating üç parçalı üst gezinti

- `AppShell.tsx:128-152` chat modunda **üç bağımsız** üst öğe çiziyor:
  1. `runa-command-palette-trigger` — `position: fixed; right:14px; top:14px` (`app-shell-migration.css:225-230`).
  2. `AppNav` — ortada bir tile-row.
  3. `ChatHeader` — kendi içinde menü + brand + presence + ayarlar.
- Hiçbiri ortak hizalama paylaşmıyor. Rakiplerde (Görsel 1, 2, 5) üst bar **tek satır**.

### S-3. PresentationRunSurfaceCard "current" modunda bile metaChips + summaryContent gereksiz

`PresentationRunSurfaceCard.tsx:113-145`: `isCurrent && !isDeveloperMode` dalı block listesini tek `<div>` içinde sade veriyor (iyi). Ancak `isDeveloperMode` dalı (line 125-145) "mevcut çalışma" eyebrow + "Canlı çalışma" başlığı + "ana akış" chip + statik açıklama metnini sahnede tutar. Developer mode "aç" durumunda sohbet hâlâ ağırlaşıyor. (Plan: developer-only deko'yu Developer Mode panelinin **dışına** taşımayalım — orada zaten yeri var.)

### S-4. Approval kartı 5+ katman

`ApprovalBlock.tsx:280-388`:

1. `eyebrow` (`Güven kararı`) — `:291`
2. `approvalTitle` — `:292`
3. `approvalStatusChip` — `:294`
4. `approvalInlineTarget` (Hedef heading + value + risk) — `:297-302`
5. `approvalStateFeedback` (`<output aria-live>` "İzin verildi. Akış devam ediyor.") — `:307-309`
6. Aksiyonlar veya tarih damgası — `:311-336`
7. Developer disclosure (Orijinal istek / Sonuç / Özet / Action / Ham hedef / Tool / Call ID / Note) — `:337-386`

Rakipte (Görsel 1, 3, 4, ss-193556): **başlık + 1 satır açıklama + 2-3 buton**. Bu kadar.

Ek olarak: `targetLabel` fallback metni `'Bu onayda net hedef bilgisi gönderilmedi.'` (`:241`) **kullanıcıya** görünür debug self-narration.

### S-5. Ham debug dili son kullanıcıya sızıyor

| Görünen yer | Kaynak | Açıklama |
|---|---|---|
| `Executes a non-interactive argv-based subprocess without shell parsing and returns captured output.` | `apps/server/src/tools/shell-exec.ts:677-678` (tool description) | Bu metin sunucu tool-description'ından geliyor. `workNarrationFormat.ts:51-83` `formatWorkDetail` whitelist'inde **yok** — bu yüzden olduğu gibi RunProgressPanel adım detayı olarak ekrana basılıyor. |
| `Terminal komutu failed: Executable not found: pnpm` | `ToolResultBlock.tsx:124-130` | Kullanıcı diline çevrilmiyor; tool result error chip'i raw error mesajını taşıyor. |
| `Hata kodu: NOT_FOUND` | `ToolResultBlock.tsx:126-129` | Error code chip user-facing modda görünüyor. |
| `Bu onayda net hedef bilgisi gönderilmedi.` | `ApprovalBlock.tsx:241` | Sistemin kendi içine söylediği bir uyarı kullanıcıya basılıyor. |
| `Komutlar sistemde yan etki oluşturabilir; hedefi kontrol et.` | `ApprovalBlock.tsx:159` | Genel "shell_execution" risk kopyası — agent kullanıcıyı denetçi olmaya zorluyor. |
| `Üyeler - Sahip`, satır başına `Sahip` rozeti | `ConversationSidebar.tsx` (henüz incelenmedi; görselde net) | Tek kullanıcı senaryosunda anlamsız metafor. |
| Tarih damgası `11.05.2026 02:57:31` her mesajda | `PersistedTranscript.tsx:50` | `toLocaleString('tr-TR')` — saniye dahil. Rakiplerde tamamen yok ya da gün ayrımı banner'ında. |
| `Sen` / `Runa` rumuzu her mesajda | `PersistedTranscript.tsx:11-22, 48` | Hizalama zaten rolü taşıyor. |

`RUNA-DESIGN-LANGUAGE.md` (line 87-91) bunu zaten yasaklıyor: "internal terms such as 'developer', 'operator', 'runtime', 'transport', 'raw', 'debug', 'troubleshooting', 'metadata'". Mevcut uygulama dokümanı ihlal ediyor.

### S-6. Card-in-card CSS örüntüsü

| Yer | Dosya:satır | Sorun |
|---|---|---|
| Sağ rail her bölüm | `WorkInsightPanel.module.css:9-18` | `.panel` = border + padding + background + radius — bordered card. |
| Sağ rail içindeki "Bağlam" metrik tile'ları | `WorkInsightPanel.module.css:165-176` | `.metric` = border + padding + background + radius. **Kart içinde kart.** |
| RunProgressPanel "headerSection / diagnosticsSection / stepsSection" | `RunProgressPanel.module.css` (incelenmedi; CSS modul yapısı, devmode dışında flat olduğu kodda görünüyor) | Developer modda her section ayrı eyebrow + ayrı padding (potansiyel card-in-card). |
| ToolResultBlock kartı | `BlockRenderer.module.css` `.toolResultCard` (henüz görmedim) | Görsel olarak çerçeveli kart — PresentationRunSurfaceCard "sayfa içinde sayfa" hissini güçlendiriyor. |
| Approval kartı içinde `approvalInlineTarget` chip + `approvalStateFeedback` output + actions row | `BlockRenderer.module.css` `.approvalCard` + ilgili stiller | Tek kart içinde 3-4 görsel ada (target box, status banner, actions row). |

`RUNA-DESIGN-LANGUAGE.md:26` der: "Do not create card-inside-card patterns." Mevcut uygulama bu kuralı kırıyor.

### S-7. Mobil header/composer/bottom-nav çakışması

| Konu | Kural | Risk |
|---|---|---|
| Composer sticky | `components.css:1911-1915` — `position: sticky; bottom: calc(safe + 78px)` | Sticky composer + sayfa scroll'u bittiğinde altında 78px boşluk + altta 60px tab bar → 138px+ "ölü alan". |
| Bottom tab bar (AppNav) | `components.css:1934-1953` — `position: fixed; bottom: 8px; z-index: 60` | Composer focus olunca tab bar kapanmıyor; küçük ekranda klavye composer ve tab bar'ı birlikte iter. |
| Page padding-bottom | `components.css:1929-1932` — `padding-bottom: 148px` | İçerik altındaki 148px scroll dolgusu — context panelleri yine de composer'ın altında kalıyor. |
| Composer/work z-index | `components.css:743-751` — composer z:1, work z:2 | Work content composer ÜSTÜNDE çiziliyor; kullanıcı görselindeki "Neyi ilerletmek istiyorsun?" yazısının chat içeriği üzerinden geçmesi bu z-index ile uyumlu. (Composer'ın görsel olarak opak çizilmediği başka kural daha var; `--gradient-input` yarı saydam.) |
| Komut paleti tetikleyici mobilde | `app-shell-migration.css:354-372` — `span { display:none }` yalnız `<640px`; mobil görüntüde `span` halen görünüyor | Kural ya kapsam dışı ya da bir style daha override ediyor; doğrulanmalı. |
| `runa-chat-header` mobilde | `components.css:1887-1899` — flex column; `runa-chat-presence` max-width none | Presence chip mobilde tam genişlik olabiliyor; satırı dolduruyor. |
| Insights mobilde | `components.css:1801-1803, 1917-1919` — `order: 3` | Sağ rail composer'dan sonra geliyor — kullanıcı composer'ı geçip aşağı kaydırmak zorunda. |

---

## 3. Önerilen Yeni Yüzey Modeli

### 3.1 Tek birincil yüzey kuralı

**Chat** birincil yüzeydir. Çevresinde **at most** şu öğeler bulunur:

```
+---------------------------------------------------------+
| TopBar (sade, tek satır)                                |
+---------+-----------------------------------------------+
| Sidebar | Chat (tek sütun, çerçevesiz, max-width 760px) |
|         |                                               |
|         |   [empty state OR transcript stream]          |
|         |                                               |
|         |   [composer]                                  |
+---------+-----------------------------------------------+
                              | Right rail (etiket-başlıklı, kartsız)
```

- Sidebar (sohbetler), sticky 280px, kartsız liste.
- Chat sütunu max-width 760px, çerçevesiz, ortalanmış.
- Right rail 280-300px, etiket başlıklı bölümler — kart yok.
- Composer: sticky bottom, opak yüzey, single rounded container.

### 3.2 Activity summary kuralı (rakiplerden çıkarılan disiplin)

Her tool çağrısı sohbet akışında **tek satırlık katlanır bir öğe** olarak doğar:

```
[ikon] 3 komut çalıştırıldı  ›    (collapsed default)
```

Açıldığında: araç ismi (TR), çalıştığı bağlam (özetle), input chip'i (varsa), output preview (≤6 satır), uzunsa "tümünü göster" chevron'u.

- Aynı turda birden fazla aynı tool çağrısı varsa **gruplandırılır**: `3 dosya okundu ›` (gruba dahil olanlar açıldığında dökülür).
- "ToolResultBlock" varsayılan kart formu **kaldırılır**; bunun yerine `ToolActivityIndicator` tek satır formu sohbet akışına gömülür ve katlama animasyonu olur.

### 3.3 Right rail bölümleri (etiket-başlıklı, kartsız)

```
İLERLEME            (eyebrow, 12px)
3/4 adım            (12px, muted)
···                 (list, no card)

ÇALIŞMA KLASÖRÜ
D:\ai\Runa

BAĞLAM
5 yüzey · 0 ek
```

- `<section>` yapısı korunur ama `border / background / box-shadow / border-radius` kaldırılır.
- Bölümler `border-bottom: 1px solid var(--border-hairline)` ile ayrılır.
- "Metric tile" patterns kaldırılır; düz inline label-value satırı yeter.

### 3.4 Approval — sakin onay kuralı

```
+--------------------------------------------------+
| Komut çalıştırmak istiyorum                      |  ← başlık (16px / 600)
| pnpm dev                                          |  ← hedef (inline mono chip)
|                                                  |
| [Reddet]                  [Onayla (Enter)]       |  ← 2 buton
+--------------------------------------------------+
```

- `eyebrow` ("Güven kararı") **kaldırılır**.
- `approvalStatusChip` **kaldırılır** (pending kart zaten görsel olarak "bekliyor"; non-pending kart küçük inline durum satırına shrink eder).
- `approvalInlineTarget` **tek satır** olur: heading'siz, sadece inline mono chip.
- `approvalStateFeedback` ("İzin verildi. Akış devam ediyor.") **kaldırılır**. Onaylandıktan sonra kart `İzin verildi · Geri al` tek satırına shrink olur.
- Developer disclosure korunur ama yalnızca Developer Mode açıkken görünür.
- Risk seviyesi farkı sadece **buton stilinde** verilir: yüksek risk → `secondary` outline; düşük risk → `primary` solid. Eyebrow ya da banner farkı yok.

### 3.5 Hata yüzeyi — kullanıcı dilinde

```
pnpm bulunamadı.
Cihazda kurulu mu, PATH'te mi kontrol et.
[Yeniden dene]   [Detay ›]
```

- "Failed: Executable not found: pnpm" raw mesajı **Developer Mode dışında görünmez**.
- "Hata kodu: NOT_FOUND" chip'i **Developer Mode dışında görünmez**.
- `Detay ›` kullanıcının özellikle istediği durumda raw error'ı gösterir.

### 3.6 Mobil sheet modeli

- Sidebar: bottom sheet (zaten benzer şekilde overlay; düzeltilir).
- Right rail: composer üzerindeki bir `Bağlam` butonuna tıklayınca açılan bottom sheet.
- Composer focus → bottom AppNav `transform: translateY(100%)` ile gizlenir; blur'da geri gelir.
- Composer **opak** olur (`--surface-input` rgba yerine solid hsl).

### 3.7 Developer Mode

`useDeveloperMode` zaten mevcut. Developer Mode dışında **yasak olan içerik** Developer Mode açıldığında görünür:

- `PresentationRunSurfaceCard` developer dalındaki eyebrow + meta chip'ler.
- `RunProgressPanel` developer dalındaki RunStatusChips serileri.
- `ApprovalBlock` `RunaDisclosure` meta-grid (orijinal istek, ham hedef, tool name, call_id).
- `RunTimelinePanel` (zaten Developer Mode'a bağlı).
- `ToolResultBlock` `Tool` / `ToolInput` / `ToolOutput` ai-elements developer view.
- Error code chip'leri, raw error text, transport correlation chip'leri.

---

## 4. Ana Sohbette **Varsayılanda** Neye İzin Var

Tek bir kural: **Birincil chat akışında yer alan her şey, kullanıcının okuduğu bir "konuşma"nın parçası olarak okunabilmeli.** Operasyonel mekanik, varsayılanda en fazla **tek satır + chevron** olarak görünür.

İzinli (varsayılan):

1. Kullanıcı mesaj balonu (sağ hizalı, accent-soft surface).
2. Asistan metni (çerçevesiz, sol hizalı).
3. Markdown — başlıklar, listeler, paragraflar, inline code, tablolar.
4. Code block kartı — sadece dil etiketi + copy butonu.
5. Tek satırlık tool aktivitesi: `[ikon] {TR etiket} ›` (collapsed default).
6. Slim approval kartı (başlık + hedef chip + iki buton).
7. Slim error mesajı (TR cümle + Yeniden dene + Detay).
8. Düşünme satırı: `Düşünüyor…` (tek satır, animasyon).
9. Streaming delta — asistan metni içinde inline cursor.
10. Gün ayrımı banner'ı: `Bugün`, `Dün`, `11 Mayıs` — mesajlar arası tek satır.

İzinli (kullanıcı açtığında):

11. Tool aktivitesi açıldığında: TR araç ismi, kısa bağlam, input chip, ≤6 satır output preview, ham çıktı için "tümünü göster".
12. Error "Detay" açıldığında: TR cümle + altında raw error monospace.
13. Approval kartı detay disclosure (Developer Mode dışında **kapalı kapı**; mode açıkken gösterilebilir).

İzinli (Developer Mode):

14. Yukarıdaki tüm "Developer Mode" yüzeyleri (bölüm 3.7).

---

## 5. Ana Sohbette **Yasak Olan**

Aşağıdaki şeyler, Developer Mode dışında **birincil chat akışında görünmez**:

1. "Güven kararı" eyebrow + status chip kombinasyonu.
2. "Bu onayda net hedef bilgisi gönderilmedi." gibi sistem-self-narration.
3. "İzin verildi. Akış devam ediyor." gibi onay-sonrası açıklama bannerı.
4. Tool description English metinleri (`Executes a non-interactive argv-based subprocess...`).
5. Raw error mesajı (`failed: Executable not found: pnpm`).
6. Error code chip'leri (`Hata kodu: NOT_FOUND`).
7. "Canlı çalışma / Geçmiş çalışma" eyebrow + statik açıklama (`Sonuçlar ve gereken onaylar...`).
8. Run correlation chip'leri (`ana akış`, run_id, trace_id).
9. `ToolHeader` / `ToolInput` / `ToolOutput` ai-elements developer view.
10. Phase chip serileri (`runtimePhases`, `observedSteps`).
11. Her mesaj altında tam tarih + saat + saniye damgası.
12. Her mesaj için `Sen` / `Runa` rol etiketi.
13. Sidebar satırında `Sahip` rozeti (tek-kullanıcı senaryosunda).
14. Floating "Komut ara Ctrl K" pillinin mobilde görünmesi.
15. "Canlı çalışma notları" başlığı ile çoklu kart yığını.
16. Aynı tool sonucunun 2+ yerde gösterilmesi.

---

## 6. Faz-faz PR Planı

Her PR küçük, gözden geçirilebilir ve **bağımsız olarak revertable** kalır. Yeşil çıta: `pnpm --filter @runa/web lint && pnpm --filter @runa/web test && pnpm --filter @runa/web typecheck`, plus targeted Playwright smoke (`apps/web/playwright`), plus screenshot evidence (mobile 320/390/414 + desktop 1440/1920).

### PR-A — Tekrar kesimi (en yüksek görsel etki)

Hedef: Aynı agent run'ının 3 yerde aynı bilgiyi tekrarlamasını durdur.

Değişen dosyalar:

- `apps/web/src/pages/ChatPage.tsx` — `RunProgressPanel` sohbet içi mount'unu kaldır (line 197-204), `currentRunProgress`'i yalnız `WorkInsightPanel`'e ver.
- `apps/web/src/components/chat/PresentationRunSurfaceCard.tsx` — `isCurrent && !isDeveloperMode` dalında zaten flat; developer dalındaki eyebrow + chip'leri "geçmiş" dalına benzer şekilde sadeleştir (yalnızca Developer Mode'a bağlı tut).
- `apps/web/src/components/chat/blocks/ToolResultBlock.tsx` — user-facing modda kartı tek satırlık katlanır forma çevir (collapsed default). `ai-elements/tool.tsx` ile aynı pattern.

Görsel kabul kriteri:

- "Git durum kontrolü tamamlandı" tek bir turda **tek satır** görünür. Açıldığında detay verilir.
- Sağ rail "İlerleme" bölümünde aynı run'ın özeti hâlâ vardır.
- Sohbet sütunu içinde 3 ardışık framed kart yok.

Smoke:

- `desktop-1440-chat-tool-run.png` — tek tool çağrılı turun ekran görüntüsü.
- `mobile-390-chat-tool-run.png` — aynı turun mobil hâli.

Risk: `PastRunSurfaces` ve geçmiş run'ların hidrasyonu; "expand all past" mevcut testler kırılabilir (`UIPhase5Surfaces.test.tsx`).

### PR-B — Card-in-card temizliği

Hedef: Right rail ve sohbet alt yüzeylerinde tüm border/background/radius nesting'i kaldır.

Değişen dosyalar:

- `apps/web/src/components/chat/WorkInsightPanel.module.css` — `.panel`'in border/background/box-shadow/radius'ını kaldır; `.metric`'i kaldır, label-value satırına çevir. `.iconWrap`'ı kaldır (ikon doğrudan başlıkla aynı satıra inline gelir).
- `apps/web/src/components/chat/PresentationRunSurfaceCard.module.css` — `metaChips` developer-only kalsın; user-facing modda hiç render edilmesin.
- `apps/web/src/components/chat/blocks/BlockRenderer.module.css` (henüz incelenmedi; bu PR'da incelenir) — `.toolResultCard`, `.approvalCard` framing'ini sade hairline-only forma çevir.

Görsel kabul:

- Right rail'de hiçbir `<section>` border + background ile çevrilmemiş.
- "Bağlam" bölümünde `5 yüzey · 0 ek` tek satır plain text olarak görünür.

Risk: Snapshot test'leri, `WorkInsightPanel`'in mevcut görünümünü kilitleyen testler (`VisualDiscipline.test.tsx`, `UIPhase5Surfaces.test.tsx`).

### PR-C — Approval kartı küçültme + copy hijyeni

Hedef: Approval kartı = başlık + 1 satır hedef + 2 buton (varsayılan); detay Developer Mode altına.

Değişen dosyalar:

- `apps/web/src/components/chat/blocks/ApprovalBlock.tsx`
  - `eyebrow` ve `approvalStatusChip` user-facing modda render edilmesin.
  - `approvalInlineTarget` heading'siz tek satır.
  - `approvalStateFeedback` user-facing modda gizli; resolved sonrası kart `İzin verildi · Geri al` satırına shrink.
  - `targetLabel` fallback `'Bu onayda net hedef bilgisi gönderilmedi.'` kaldırılır; net hedef yoksa hedef satırı hiç çizilmez.
  - `decisionCopy.risk` user-facing modda kaldırılır (high-risk tool listesinde butonlar zaten secondary olarak çiziliyor).
  - Developer disclosure aynen korunur ama `isDeveloperMode` gate'i sıkılaştırılır.
- `apps/web/src/components/chat/blocks/BlockRenderer.module.css` — `.approvalCard` ve alt sınıfların border/padding'i sadeleştirilir.

Görsel kabul:

- Pending approval kart yüksekliği ≤ 140px (desktop), ≤ 180px (mobile).
- Resolved approval kart yüksekliği ≤ 36px.
- Approve / Reject butonları yan yana; "Onayla" focus'lu (Enter).

Risk: `approval-modes-capabilities-e2e.spec.ts` testleri; mevcut copy assert'leri kırılır. Localization kopyaları (`uiCopy.approval.*`) güncellenmeli.

### PR-D — User-safe error + raw debug pruning

Hedef: ToolResult error + raw tool description sızıntılarını kapat.

Değişen dosyalar:

- `apps/web/src/components/chat/blocks/ToolResultBlock.tsx`
  - User-facing modda `error_code` chip'i ve raw error text gösterilmez.
  - "İşlem tamamlanamadı" generic başlığı yerine tool-aware fallback: `getFriendlyToolTitle(tool_name) + ' başarısız'`.
  - "Detay ›" disclosure ile raw error opt-in.
- `apps/web/src/components/chat/workNarrationFormat.ts`
  - `formatWorkDetail` whitelist'ini genişlet: shell.exec ve diğer tool description'larının TR karşılıkları eklenir.
  - **Daha iyisi:** `formatWorkDetail` artık sözlüğünde olmayan bir metni döndürmek yerine `null` döndürür → user-facing yerlerde bu null durumda detail satırı hiç çizilmez.
- `apps/server/src/runtime/...` — tool description'ı user-facing payload'a koymayı bırak; ayrı `user_label` alanı ekle. (Server tarafı değişikliği bu PR'a girer veya tek ayrı server PR'a — tercih ikinciyi sürmek.)
- `apps/web/src/components/chat/blocks/ApprovalBlock.tsx` — `decisionCopy.risk` user-facing modda kaldırıldıktan sonra dosya küçülür.

Görsel kabul:

- Hiçbir İngilizce tool description metni user-facing sohbet ekranında görünmez.
- `Hata kodu:` chip'i Developer Mode dışında yok.

Risk: `CopyVoicePass.test.tsx`, `OperatorDeveloperIsolation.test.tsx`. Server tarafında tool definition contract değişebilir (tarif: yalnızca yeni opsiyonel alan eklenecek; default-back uyumlu).

### PR-E — Üst gezinti birleştirme

Hedef: Chat sayfasında **tek satır** üst bar.

Karar: Sidebar-driven shell (Görsel 5 — Claude Cowork pattern). Sebep: "Cihazlar" / "Geçmiş" ayrı route'lar; tab-row metaforu zayıf, sidebar daha dürüst.

Değişen dosyalar:

- `apps/web/src/components/app/AppShell.tsx`
  - Chat moduna özel `position: fixed` komut paleti tetikleyicisini kaldır; üst bar'a inline taşı.
  - `AppNav`'ı top-bar tile-row olmaktan çıkar; sol sidebar'a yerleştir (yeni `AppSidebar` komponenti veya `ConversationSidebar` üstüne ek navigation).
  - Diğer sayfalardaki framed hero header'ı da sade üst bar'a çevir (tutarlılık).
- `apps/web/src/components/chat/ChatHeader.tsx`
  - "Sohbet devam ediyor" alt başlığını kaldır; konuşma başlığı + sağda durum noktası.
- `apps/web/src/styles/components.css` — `.runa-app-nav`, `.runa-chat-header` mobil kuralları gözden geçirilir.
- `apps/web/src/styles/routes/app-shell-migration.css` — `.runa-command-palette-trigger` floating + tüm `.runa-page--chat-product` kuralları gözden geçirilir.

Görsel kabul:

- Chat sayfasının üstünde **tek** satır var.
- Mobilde `Komut ara Ctrl K` pill'i tamamen gizli (Ctrl+K klavye kısayolu mobilde işe yaramaz).
- AppNav sol sidebar içinde 4 nav linki olarak görünür; mobilde bottom tab bar.

Risk: Tüm route smoke testleri (`SecondarySurfacesReframe.test.tsx`, `FirstImpressionPolish.test.tsx`, `OperatorDeveloperIsolation.test.tsx`). Bu PR en büyük diff'i taşır — ayrı bir worktree önerilir.

### PR-F — Mesaj ritmi sadeleştirme + empty state

Hedef: Mesaj-başına meta gürültüsünü kaldır; ciddi bir empty state başlığı.

Değişen dosyalar:

- `apps/web/src/components/chat/PersistedTranscript.tsx`
  - `getRoleLabel` kaldırılır; rol etiketi yerine küçük accent "R" avatar (asistan) ve hizalama (kullanıcı).
  - `time` mesaj başına çizilmez. Gün ayrımı banner'ı eklenir (`Bugün`, `Dün`, `DD MMM` — TR locale).
  - Aynı dakikada arka arkaya gelen mesajlar gruplanır (avatar tek seferlik).
- `apps/web/src/components/chat/EmptyState.tsx` — hero başlık eklenir: `Bugün neyi halledelim?` 28-32px / weight 500. Mevcut 4 öneri chip'i altta kalır.
- `apps/web/src/components/chat/PersistedTranscript.module.css` — `metaRow`, `roleLabel`, `time` stilleri kaldırılır; `bubble` user/assistant ayrımı korunur.

Görsel kabul:

- Sohbet sütunu uzun bir konuşmada **scan edilebilir**: her mesaj balonunun altında saat damgası yok.
- Empty state hero başlığı görsel olarak Claude Cowork "Let's knock something off your list" seviyesinde durur.

Risk: `PersistedTranscript.test.*` (henüz incelenmedi), e2e selector'lar (`Sen` / `Runa` metin bağlılığı).

### PR-G — Mobil composer + bottom-nav + sheet düzeni

Hedef: Mobil "Neyi ilerletmek istiyorsun?" yazısının composer üstünden geçmesini durdur; bağlam paneline sheet erişimi ver.

Değişen dosyalar:

- `apps/web/src/styles/components.css`
  - `.runa-chat-layout__composer` **opak** background (`--surface-canvas` solid).
  - z-index hiyerarşisi: composer 30, work 2, app-nav 60, sheet/backdrop 70.
- `apps/web/src/components/app/AppNav.tsx` veya CSS — composer focus → `:has` veya React state ile bottom tab bar transform-out.
- Yeni `apps/web/src/components/chat/ContextSheet.tsx` — `WorkInsightPanel` içeriğini mobilde sheet olarak gösterir.
- `apps/web/src/components/chat/ChatComposerSurface.tsx` — sol-alt'a yeni `Bağlam` butonu (`<640px` görünür).

Görsel kabul:

- `mobile-390` boyunda composer üstünden hiçbir metin geçmiyor.
- Composer focus olunca bottom tab bar smooth hide.
- "Bağlam" tıklanınca aşağıdan sheet açılır.

Risk: Safe-area inset uyumu (iOS notch), klavye açıkken `100dvh` davranışı.

### PR-H — Token + cosmetic polish

Hedef: Token dosyasındaki gereksiz değişken sayısını azalt; radius/border ölçeğini sıkıştır.

Değişen dosyalar:

- `apps/web/src/styles/tokens.css`
  - `--text-lg / --text-xl / --text-2xl` aynı (1.25rem) — sadeleştir.
  - `--text-3xl / --text-4xl` aynı (1.75rem) — sadeleştir.
  - `--border-hairline / --border-subtle / --border-default / --border-strong` → en fazla 2 değer.
  - `--radius-soft` kaldırılır; sadece `--radius-panel` (16) ve `--radius-pill` (999) + yeni `--radius-input` (12) kalır.
- Tüm `--gradient-*` "legacy compatibility" alias'lar gözden geçirilir; flat tek değer'e indirilir.

Görsel kabul: Pixel-level fark yok (token-renaming PR'ı).

Risk: Lint geniş, smoke geniş — ama görsel regression riski düşük.

---

## 7. Risk ve Regresyon Bölgeleri

| Risk | Etkilenebilecek alan | Önlem |
|---|---|---|
| Geçmiş run hidrasyonu kırılır | `PastRunSurfaces`, `useConversations` block fetch (`CHAT-UI-AUDIT-2026-05.md` BUG-2) | PR-A öncesi BUG-2 fix'i ayrı PR olarak landlanır veya en az birim test eklenir. |
| Approval e2e testleri | `e2e/approval-modes-capabilities-e2e.spec.ts`, `approval-modes-capability-live` smoke | PR-C öncesi e2e selector'ları metin-bağımsız (`data-testid`) hâle getirilir. |
| Snapshot testleri | `UIPhase5Surfaces.test.tsx`, `VisualDiscipline.test.tsx`, `FirstImpressionPolish.test.tsx`, `SecondarySurfacesReframe.test.tsx`, `CopyVoicePass.test.tsx`, `OperatorDeveloperIsolation.test.tsx`, `DesignLanguageLock.test.ts` | Her PR ilgili snapshot dosyasını günceller; mevcut "design language lock" testleri yeni kuralları yansıtacak şekilde revize edilir. |
| Server-frontend kontratı | `apps/server/src/runtime/map-run-timeline.ts`, tool definition `description` alanı | PR-D'de yeni opsiyonel `user_label` alanı; mevcut tüketici davranışı varsayılan-uyumlu kalır. |
| Mobil safe-area regression | iOS Safari notch + Android keyboard | PR-G'de gerçek cihaz manual QA gerekir. |
| WorkInsightPanel'in hâlâ kullanılan tek özet kaynak olması | PR-A sonrası tek bilgi yüzeyi olarak sağ rail kalır; tek noktada kırılma riski | "Right rail boş durum" copy'si dikkatle yazılır; yükleme skeleton'u ekstra eklenir. |
| Developer Mode toggle kapalıyken bilgi kaybı | Developer'lar mevcut kart-zengin akışa alışkın | "Developer Mode" anahtarı `/account?tab=preferences` veya `Ctrl+Shift+D` shortcut ile keşfedilebilir kalır. |
| `RUNA-DESIGN-LANGUAGE.md` ile lock test'leri | `DesignLanguageLock.test.ts` | Her PR sonunda lock test çalıştırılır; gerekirse doküman da güncellenir (lock test = single source of truth). |

---

## 8. Görsel Kabul Kriteri Özeti (PR-başına)

Her PR sonunda **en az** şu evidence üretilir ve `docs/design-audit/screenshots/<tarih>-ui-restructure-pr-<x>/` altına commit'lenir:

| PR | Desktop 1440 | Desktop 1920 | Mobile 390 | Smoke |
|---|---|---|---|---|
| PR-A | `chat-tool-run.png` | `chat-tool-run.png` | `chat-tool-run.png` | tool-run E2E (collapsed default) |
| PR-B | `right-rail-flat.png` | `right-rail-flat.png` | `context-sheet.png` | visual discipline test güncellenir |
| PR-C | `approval-pending.png`, `approval-resolved.png` | — | `approval-pending.png` | approval e2e testleri |
| PR-D | `error-state.png`, `developer-mode-error.png` | — | `error-state.png` | copy voice test güncellenir |
| PR-E | `app-shell-chat.png`, `app-shell-history.png` | `app-shell-chat.png` | `app-shell-chat.png` | tüm route smoke'ları |
| PR-F | `chat-empty.png`, `chat-long-transcript.png` | `chat-empty.png` | `chat-empty.png` | transcript test güncellenir |
| PR-G | — | — | `mobile-composer-focus.png`, `mobile-context-sheet.png` | manual cihaz QA (iOS + Android) |
| PR-H | `tokens-before-after.png` (diff) | — | — | lint + typecheck |

Genel kabul (PR-A → PR-H tamamlandığında):

1. Rastgele bir rakip görseliyle yan yana koyduğumuzda Runa, "**hangisi tüketici ürünü, hangisi iç araç**" testini geçer.
2. Aynı agent run'ının ekran kaplaması, eski tasarıma göre **en az %40 daha az piksel** kapsar.
3. `RUNA-DESIGN-LANGUAGE.md` checklist'inde **otomatik doğrulanabilir** maddeler (`DesignLanguageLock.test.ts`) %100 PASS.
4. Developer Mode kapalıyken `apps/web` içinde hiçbir İngilizce tool description metni user-facing ekrana erişmez (lint test ile guard'lanır).
5. Mobil 320 / 390 / 414 boylarında composer focus altında hiçbir overlap yok.

---

## 9. Ekler

### 9.1 Doğrulanmış dosya:satır referansları

- Üç-yerli tekrar mount: `apps/web/src/pages/ChatPage.tsx:197-204, 214-227, 304-314, 322-327`.
- Floating Ctrl+K pilli: `app-shell-migration.css:225-230` + `AppShell.tsx:131-139`.
- Card-in-card: `WorkInsightPanel.module.css:9-18, 165-176`.
- Approval 5+ katman: `ApprovalBlock.tsx:280-388`.
- Raw debug copy kaynakları:
  - `shell-exec.ts:677-678` (tool description).
  - `workNarrationFormat.ts:51-83` (eksik whitelist).
  - `ToolResultBlock.tsx:124-130` (error code chip).
  - `ApprovalBlock.tsx:241` (`Bu onayda net hedef bilgisi gönderilmedi`).
  - `PersistedTranscript.tsx:11-22, 48-52` (rol etiketi + tarih damgası).
- Mobil overlap kuralları: `components.css:1887-1953, 2004-2018`; `WorkInsightPanel.module.css:188-199`.
- Ölü/duplicate layout tanımı: `primitives.css:525-547` ↔ `components.css:718-755`.

### 9.2 Önerilen yeni doğrulama testleri

- `apps/web/src/pages/__tests__/no-raw-tool-description.test.ts` — `workNarrationFormat.formatWorkDetail`'in sözlük dışı bir İngilizce metin için `null` döndüğünü doğrular.
- `apps/web/src/components/chat/__tests__/single-run-surface.test.tsx` — Tek bir agent run için sohbet sütununda iki kez "Git durum kontrolü" metni geçmediğini iddia eder.
- `apps/web/src/components/chat/blocks/__tests__/approval-card-shape.test.tsx` — Pending approval kartının DOM'unda `eyebrow`, `statusChip`, `stateFeedback` sınıflarının user-facing modda render edilmediğini doğrular.
- `apps/web/src/__tests__/no-card-in-card.test.ts` — DOM tree'de `.runa-card` içinde `.runa-card` (veya muadili stilli element) bulunmadığını assert eder.

### 9.3 Dokümantasyon güncellemeleri (planlama sonrası, kod öncesi)

- `docs/RUNA-DESIGN-LANGUAGE.md` — Bu plana göre ek olarak: "Aynı run bilgisi sohbet ve right rail'de tek yerde özetlenir; tekrar yasaktır." maddesi.
- `docs/INDEX.md` — Bu yeni planı listele.

---

> Son not: Bu plan rakipleri taklit etmez. Rakiplerden çıkarılan disiplin — tek birincil yüzey, ince tool aktivitesi, sakin onay, debug dilinin varsayılanda gizliliği, cömert beyaz alan, mobile-first sheet düzeni — Runa'nın mevcut "trust-first, chat-first" kimliğine uyarlanır.
