# Runa × Cowork — Özellik Karşılaştırma ve Yol Haritası

> Tarih: 29 Nisan 2026  
> Yazar: Claude (Cowork) — proje analizi  
> Kaynak: `README.md`, `AGENTS.md`, `PROGRESS.md`, `implementation-blueprint.md`, `apps/server/src/tools/`, `apps/desktop-agent/src/`, `apps/web/src/`

---

## 1. Runa'nın Şu An Sahip Olduğu Özellikler (Cowork ile Örtüşenler)

### ✅ Chat-first arayüz
React + Vite SPA, `ChatPage`, `ChatShell`, `EmptyState`, `ChatComposerSurface` bileşenleri mevcut. UI manifestosu bilinçli olarak "consumer-grade, chat-first" çizgisini hedefliyor ve bu yönde önemli ilerleme kaydedildi. Mobil-öncelikli responsive tasarım ve PWA (manifest.json + sw.js) altyapısı hazır.

### ✅ Kimlik doğrulama ve kullanıcı yönetimi
Supabase Auth (JWT + RLS + OAuth) tam entegre. `LoginPage`, `useAuth` hook, WS auth middleware ve subscription gating aktif. Free/Pro/Business tier yapısı tanımlanmış ve `ws-subscription-gate.ts` üzerinde uygulanıyor.

### ✅ Gerçek zamanlı WebSocket iletişimi + streaming
Fastify + WebSocket backend, `transport.ts` / `orchestration.ts` / `presentation.ts` / `run-execution.ts` katmanlarına bölünmüş. `RenderBlock` streaming, `StreamingMessageSurface`, `RunProgressPanel` ve `ToolActivityIndicator` bileşenleri mevcut. Kullanıcı ajanın adım adım ilerlediğini anlık görüyor.

### ✅ Dosya sistemi erişimi
`file.read`, `file.write`, `file.list`, `file.watch`, `edit-patch`, `git.status`, `git.diff`, `search.codebase`, `search.grep` araçları implement edilmiş ve `ToolRegistry`'e kayıtlı.

### ✅ Kod çalıştırma
`shell.exec` aracı mevcut, sunucu taraflı shell execution destekleniyor. Güvenlik için policy engine ve approval gating entegre.

### ✅ Web arama
`web.search` aracı Serper API üzerinden implement edilmiş; `organic` ve `news` aramaları, snippet limit ve URL policy ile güvenli hale getirilmiş. Serper live smoke testleri yeşil.

### ✅ Dosya yükleme (upload)
`apps/server/src/routes/upload.ts` ve `FileUploadButton.tsx` bileşeni mevcut. Multimodal attachment (image, text/code) ve `ModelAttachment` kontr atı implement edilmiş. `file.share` aracı ve signed download URL altyapısı hazır.

### ✅ Task/session yönetimi
`AgentLoop` (async generator + typed stop conditions), checkpoint persistence (PostgreSQL metadata + Supabase Storage blob), run lifecycle (`INIT → CONTEXT_READY → MODEL_THINKING → TOOL_EXECUTING → WAITING_APPROVAL → COMPLETED/FAILED`), auto-continue policy ve run cancellation eksiksiz implement edilmiş.

### ✅ Onay (approval) mekanizması
`ApprovalStore`, approval events, `resolve-approval`, race condition fix, `WAITING_APPROVAL` state ve chat-native `accept/reject` akışı çalışıyor. Yüksek riskli tool'lar approval gate arkasında.

### ✅ Çoklu provider / model desteği
`ModelGateway` provider-agnostic omurga. Groq, DeepSeek (v4-flash + v4-pro model router dahil), Claude, Gemini, OpenAI, SambaNova adapter'ları mevcut. Model economy routing (ucuz/pahalı akıl yürütme) implement edilmiş.

### ✅ MCP entegrasyonu
`stdio` ve `Streamable HTTP` transport implement edilmiş. MCP tool'ları `mcp.<serverId>.<toolName>` formatıyla `ToolRegistry`'e giriyor. URL policy, header redaction ve approval-gated remote tool desteği var.

### ✅ Bellek (memory) sistemi
`memory.save`, `memory.search`, `memory.delete`, `memory.list` araçları mevcut. `compose-memory-context`, `orchestrate-memory-read`, `build-memory-prompt-layer` seam'leri çalışıyor. Session/run memory ve proje memory temel düzeyde aktif.

### ✅ Browser otomasyonu
`browser.navigate`, `browser.click`, `browser.fill`, `browser.extract` araçları implement edilmiş ve test edilmiş. `browser-url-policy` ile güvenlik sınırları tanımlı.

### ✅ Multi-agent / sub-agent delegation
`agent.delegate` aracı sequential delegation (researcher / reviewer / coder rolleri) ile mevcut. Role normalization, depth limit (max 1), tool allowlist ve audit trace entegre.

### ✅ Ses girişi ve TTS
`useVoiceInput`, `useTextToSpeech`, `useTextToSpeechIntegration` hook'ları ve `VoiceComposerControls` bileşeni mevcut.

### ✅ Desktop bridge temel katmanı
`apps/desktop-agent/` paketi Electron üzerinde `ws-bridge.ts`, `screenshot.ts`, `input.ts` (click, type, keypress, scroll), `auth.ts`, `launch-controller.ts` ile secure bridge foundation sağlıyor. Windows installer artifact'ı (`Runa Desktop Setup 0.1.0.exe`) üretilmiş.

### ✅ Konuşma geçmişi
`HistoryPage`, `ConversationSidebar`, `useConversations` hook ve PostgreSQL'de persist edilen konuşma kaydı mevcut.

### ✅ Cihaz yönetimi yüzeyi
`DevicesPage` ve `DevicePresencePanel` bileşenleri eklendi; gerçek cihaz presence/empty/error/loading durumları urun diliyle gösteriyor.

---

## 2. Cowork'ta Olan Ama Runa'da Eksik veya Yarım Olan Özellikler

### ❌ Skill sistemi — TAM YOKLUĞU
Cowork'un en belirleyici özelliği: kullanıcıya özel yetenek paketleri (skill). Runa'da bu kavrama karşılık gelen hiçbir şey yok. Cowork'ta `pptx`, `docx`, `xlsx`, `pdf`, `schedule` gibi domain-spesifik beceriler birer skill olarak paketlenmiş; kendi SKILL.md talimatları var ve AI bunları otomatik tetikliyor. Runa'da buna benzer bir mekanizma ne framework düzeyinde ne de tool düzeyinde mevcut.

### ❌ Ofis belgesi oluşturma (PPTX / DOCX / XLSX / PDF)
Cowork doğrudan Word belgesi, Excel dosyası, PowerPoint sunumu ve PDF üretebiliyor. Runa'da bu capability'lerin hiçbiri yok. `file.write` ile ham metin yazılabiliyor ama formatlanmış ofis belgesi üretme altyapısı (docx-js, python-pptx, openpyxl eşdeğerleri) mevcut değil.

### ❌ Kullanıcıya yönelik tam desktop app shell
Cowork tam işlevli, polished bir desktop uygulaması. Runa'da `apps/desktop-agent/` secure bridge ve runtime foundation barındırıyor; `Runa Desktop Setup 0.1.0.exe` üretilmiş ancak **TASK-01** belgesi açıkça şunu söylüyor: "user-facing desktop app shell, online device presence UI, installer/update kanıtı ve release-grade packaging henüz yok." Yani Electron penceresi açılıyor ama kullanıcıya teslim edilebilir bir desktop deneyimi mevcut değil.

### ❌ Online cihaz presence ve uzaktan erişim
Cowork'ta kullanıcı telefon/tarayıcıdan bilgisayarına bağlanıp komut çalıştırabiliyor. Runa'da `DevicesPage` UI yüzeyi eklenmiş fakat arkasında tam çalışır bir device presence backend'i yok; online/offline durumu ve uzaktan bağlantı akışı tamamlanmamış.

### ❌ Gerçek sandbox kod çalıştırma ortamı
Cowork izole bir Linux sandbox üzerinde kod çalıştırıyor (güvenli, çöp toplanabilir). Runa'nın `shell.exec` aracı approval-gated olsa da izole bir container/sandbox ortamı değil; doğrudan sunucu process'i. Bu güvenlik açısından fark yaratıyor.

### ❌ Semantic (gömülü vektör) bellek
Cowork konuşmalar arası anlamlı bilgi hatırlıyor. Runa'nın mevcut memory araçları anahtar-değer seviyesinde; **TASK-08** belgesi embedding-tabanlı semantic memory'yi "Phase 3 hazırlığı" olarak sınıflandırıyor. Qdrant ve vektör arama entegrasyonu henüz yok.

### ❌ Plugin / MCP marketplace
Cowork'ta yüklenebilir plugin paketleri ve bir MCP registry var. Runa MCP client implement etmiş ama plugin kavramı, install mekanizması ve bir marketplace yok.

### ❌ Arka plan task çalıştırma ve zamanlama
Cowork'ta arka planda çalışan, ayrı session/task'lar var; kullanıcı bilgisayardan uzakta olsa bile task devam ediyor. Runa'da `AgentLoop` mevcut ancak bilgisayar kapalıyken veya kullanıcı bağlı değilken çalışmaya devam eden bağımsız arka plan task sistemi yok.

### ⚠️ Dosya oluşturma linkleri ve workspace klasörü
Cowork ürettiği dosyaları kullanıcının seçtiği klasöre kaydedip `computer://` linki ile sunuyor. Runa'da file.write mevcut ama kullanıcı arayüzünde dosyaya tıklanabilir link sunumu ve workspace klasörü seçimi yok.

### ⚠️ Desktop capability'lerinin tam release-grade taşınması
`desktop.click`, `desktop.type`, `desktop.keypress`, `desktop.scroll` araçları server tarafında implement edilmiş; desktop-agent tarafında PowerShell sürücüsü ve Go sidecar abstraction hazır. Ancak gerçek fare tıklaması ve klavye enjeksiyonunun kullanıcı kontrolündeki bir hedef pencerede canlı kanıtı henüz yok (sadece benchmark ve health path yeşil).

---

## 3. Öncelik Sıralaması — Runa'yı Cowork Seviyesine Getirmek

### 🔴 ADIM 1 — Ofis belgesi oluşturma altyapısı [Orta]

**Neden önce bu?** En hızlı kullanıcı değeri üreten özellik. Kod değişikliği gerektirmiyor; sunucu ortamına `docx` npm paketi, `python-pptx`, `openpyxl`, `reportlab` kurulumu ve birkaç yeni tool yeterli. Mevcut `file.write` + `ToolRegistry` altyapısına additive ekleniyor. `ToolRegistry`'e `doc.create_word`, `doc.create_excel`, `doc.create_pptx`, `doc.create_pdf` araçları eklenir; approval policy düşük risk olarak açılabilir.

**Zorluk: Orta** — Yeni dependency'ler var ama mimari müdahale yok. Packaging/sandbox sorunu varsa Docker üzerinden çözülebilir.

---

### 🔴 ADIM 2 — Desktop app shell tamamlama (TASK-01A → 01D) [Zor]

**Neden erken?** Remote access ve device presence bu olmadan anlamsız. `electron/main.ts`, `preload.ts`, minimal React renderer, Tray lifecycle ve session persistence sırayla tamamlanmalı. `electron-builder` ve signing zaten kısmen var; packaging artifact üretilmiş, ama user-facing shell eksik.

**Zorluk: Zor** — Electron IPC güvenlik sınırları, Windows native module rebuild riskleri, signing/AV sertifika yönetimi.

---

### 🔴 ADIM 3 — Online device presence ve uzaktan erişim [Zor]

**Neden üçüncü?** Desktop shell olmadan olamaz (Adım 2 önceden bitmiş olmalı). Backend'de device presence heartbeat, online/offline durumu yayınlayan WebSocket endpoint ve `DevicesPage`'i gerçek veriyle besleyecek polling/push mekanizması gerekiyor. Bu tamamlandığında kullanıcı telefon/tarayıcıdan masaüstünü remote yönetebilir.

**Zorluk: Zor** — Gerçek zamanlı device state sync, reconnect mantığı, güvenlik modeli.

---

### 🟠 ADIM 4 — Skill sistemi framework [Orta]

**Neden dördüncü?** Ofis belgesi araçları Adım 1'de ekleniyor ama bunları "skill" olarak paketlemek ayrı bir adım. Cowork'taki skill konsepti: model belirli bir talep geldiğinde otomatik olarak skill'i yükliyor ve talimatlarını takip ediyor. Runa'da buna en yakın yol: `packages/types/src/` altına `SkillDefinition` tipi eklemek, server'da skill loader seam açmak ve `ToolRegistry` ile entegre etmek.

**Zorluk: Orta** — Mimari ekleme gerekiyor ama mevcut araçlar üzerine inşa ediliyor.

---

### 🟠 ADIM 5 — Sandbox kod çalıştırma ortamı [Orta]

**Neden beşinci?** Mevcut `shell.exec` çalışıyor ama güvensiz. Docker ya da gVisor/Firecracker ile izole bir execution environment açmak hem güvenliği artırıyor hem de Cowork pariteye getiriyor. `compose.yaml` zaten mevcut; `shell.exec`'in container'a yönlendirilmesi relatif düşük değişiklik gerektiriyor.

**Zorluk: Orta** — Docker entegrasyonu mevcut; sandbox politika ve networking ince ayarı gerekiyor.

---

### 🟡 ADIM 6 — Arka plan task sistemi [Orta-Zor]

**Neden altıncı?** Runa'nın `AgentLoop` altyapısı güçlü ama "bilgisayar kapalıyken devam et" semantiği yok. Bu için: checkpoint'lerin process-dışı persist edilmesi (zaten yapıldı), task queue (örneğin PostgreSQL-backed job queue — `pg-boss` gibi) ve resume mekanizması gerekiyor. Kullanıcı arayüzünde "çalışan task'larım" yüzeyi eklenmeli.

**Zorluk: Orta-Zor** — Altyapı temeli var, fakat job scheduling ve reconnect/resume senaryoları dikkatli tasarım gerektiriyor.

---

### 🟡 ADIM 7 — Semantic memory (TASK-08) [Zor]

**Neden yedinci?** Değerli ama Phase 3 kapsamında; önceki adımlar daha temel. Qdrant entegrasyonu, embedding pipeline, RLS-aware memory isolation ve kullanıcı kontrol paneli (göster/sil/kapat) gerekiyor. Privacy modeli dikkatli tasarlanmalı.

**Zorluk: Zor** — Yeni infrastructure (vektör DB), deployment, privacy/GDPR yüzey artışı.

---

### 🟢 ADIM 8 — Plugin / MCP marketplace [Zor]

**Neden son?** Ekosistem özelliği; önceki tüm katmanlar oturduktan sonra anlam kazanıyor. MCP HTTP transport zaten implement edilmiş. Gerekli olan: plugin manifest formatı, install/uninstall mekanizması ve registry/marketplace UI.

**Zorluk: Zor** — Güven modeli, versioning, sandboxing ve kullanıcı deneyimi karmaşık.

---

## 4. Özet Tablo

| # | Özellik | Durum | Zorluk | Tahmini Etki |
|---|---------|-------|--------|--------------|
| 1 | Ofis belgesi oluşturma (docx/xlsx/pptx/pdf) | Tam eksik | Orta | ⭐⭐⭐⭐⭐ |
| 2 | Desktop app shell (TASK-01) | Foundation var, shell eksik | Zor | ⭐⭐⭐⭐⭐ |
| 3 | Online device presence + uzaktan erişim | UI var, backend eksik | Zor | ⭐⭐⭐⭐ |
| 4 | Skill sistemi framework | Tam eksik | Orta | ⭐⭐⭐⭐ |
| 5 | Sandbox kod çalıştırma | Var ama izolasyonsuz | Orta | ⭐⭐⭐ |
| 6 | Arka plan task sistemi | Kısmen var | Orta-Zor | ⭐⭐⭐ |
| 7 | Semantic memory | Planlandı (Phase 3) | Zor | ⭐⭐⭐ |
| 8 | Plugin / MCP marketplace | Temel var | Zor | ⭐⭐ |

---

## Sonuç

Runa'nın teknik temeli Cowork seviyesi ile karşılaştırıldığında beklenenden güçlü çıkıyor: async generator agentic loop, typed stop conditions, WebSocket split architecture, MCP client, browser otomasyonu, multi-agent delegation ve approval mekanizması gibi kritik backend bileşenler implement edilmiş ve test yeşil. Eksikler ağırlıklı olarak **kullanıcıya görünen yüzey** katmanında toplanıyor.

En hızlı Cowork paritesine giden yol: ofis belgesi araçlarını additive eklemek (Adım 1) ve desktop shell'i tamamlamak (Adım 2). Bu ikisi tamamlandığında Cowork'un kullanıcıya sunduğu temel deneyimin %70-80'i karşılanmış olacak.
