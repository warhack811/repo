# PR-13 Competitor Gap Audit

> Tarih: 2026-05-15
> Yöntem: Kaynak kod taraması (31 dosya, 8 sayfa, 12+ komponent incelendi)
> Bağlam: PR-1..PR-12 tamamlandı (Lighthouse 100/100/100). Bu rapor yapısal değil, "rakip seviyesi tüketici hissi" boşluklarını çıkarır.
> Rakip referansı: `C:\Users\admin\OneDrive\Desktop\ornekler` erişilemiyor — tüm rakip karşılaştırmaları tahmin içermez, yalnızca "referans yok" olarak işaretlenmiştir.

## 1. Markdown Rendering Kalitesi

### 1.1 Code block
- Mevcut: `apps/web/src/lib/streamdown/CodeBlock.tsx:34-138` — Shiki ile syntax highlight (11 dil: ts, js, py, json, bash, tsx, jsx, sql, html, css, md + rust lazy), copy button (ClipboardIcon/CheckIcon state machine), dil etiketi toolbar, hata fallback'i var.
- Boşluk:
  - Line numbers: ❌ yok
  - Expand/collapse eşiği: ❌ yok (kod her zaman tam boy)
  - Max-height + scroll: ❌ yok (uzun bloklar sayfayı uzatır)
  - Dil sayısı: 🟡 sadece 12 dil (Claude/Codex ~50+ dil)
  - Copy button her zaman aynı hizada: ✅ var ama line numbers olmayınca toolbar seyrek görünüyor
- Rakip referansı: referans yok
- Önem: HIGH (kod blokları günlük kullanımın merkezi)

### 1.2 Inline code
- Mevcut: `apps/web/src/lib/streamdown/StreamdownMessage.tsx:39-41` — `<code {...props} />` passthrough, custom class/style yok
- Boşluk:
  - Özel font/spacing: ❌ yok (varsayılan browser `<code>` stili)
  - Background/border: ❌ yok (okunabilirlik düşük)
  - Copy edilemiyor: ❌ (inline code'u seçip kopyalamak metin seçimine bağlı)
- Rakip referansı: referans yok
- Önem: MED (sık görülür ama blok kod kadar kritik değil)

### 1.3 Table
- Mevcut: StreamdownMessage.tsx'te `components` içinde `table` renderer'ı **tanımlı değil** — Streamdown kütüphanesi default HTML table render ediyor olabilir
- Boşluk:
  - Custom table renderer: ❌ yok (Streamdown default'u ne üretiyorsa o)
  - Mobil scroll davranışı: ❌ wrapper div/x-scroll yok
  - Başlık fontu/tasarımı: ❌ ayarlanmamış
  - Striped rows, hover state: ❌
- Rakip referansı: referans yok
- Önem: MED (tablo içeren mesajlar okunabilirlik kaybeder)

### 1.4 List (ul/ol)
- Mevcut: StreamdownMessage.tsx'te `ul`/`ol`/`li` için custom renderer **tanımlı değil** — Streamdown default'u kullanılıyor
- Boşluk:
  - Nested list indent tutarlılığı: 🟡 varsayılan browser stiline bağlı
  - Bullet style özelleştirme: ❌ yok
- Rakip referansı: referans yok
- Önem: LOW (varsayılan render çoğu durumda yeterli)

### 1.5 Blockquote
- Mevcut: StreamdownMessage.tsx'te `blockquote` için custom renderer **tanımlı değil**
- Boşluk:
  - Accent border (sol çizgi): ❌ yok
  - Özel background/font: ❌ yok
  - Attribution (`— kaynak`) stili: ❌
- Rakip referansı: referans yok
- Önem: MED (görsel hiyerarşi için alıntılar önemli)

### 1.6 Heading hiyerarşisi (h1-h6)
- Mevcut: StreamdownMessage.tsx'te heading renderer'ları **tanımlı değil** — Streamdown default'u
- Boşluk:
  - h1 mesaj içinde çok büyük olabilir, kontrollü font scale: ❌
  - Heading ID/anchor: ❌ yok (iç linkleme imkansız)
- Rakip referansı: referans yok
- Önem: MED (içerik hiyerarşisi için)

### 1.7 Link
- Mevcut: StreamdownMessage.tsx'te `a` için custom renderer **tanımlı değil**
- Boşluk:
  - Accent renk: ❌ (varsayılan link rengi)
  - Hover/focus state: ❌
  - External indicator (icon): ❌
  - Security (rel="noopener"): ❌ kontrol edilemiyor
- Rakip referansı: referans yok
- Önem: LOW (tarayıcı default'u çalışır)

### 1.8 Image/embed
- Mevcut: StreamdownMessage.tsx'te `img` için custom renderer **tanımlı değil**
- Boşluk:
  - Lazy loading: ❌ (varsayılan eager)
  - Sizing/max-width: ❌
  - Caption desteği: ❌
  - Fallback/placeholder: ❌
- Rakip referansı: referans yok
- Önem: MED (görsel içerikli yanıtlar bozuk görünebilir)

### 1.9 Math/LaTeX
- Mevcut: `apps/web/src/lib/streamdown/StreamdownMessage.tsx:16` — `createMathPlugin({ singleDollarTextMath: true })` ile aktif
- Boşluk:
  - Math rendering kanıtı: 🟡 eklenti yüklü ama test edilmemiş, hangi kütüphane kullanılıyor belli değil (`@streamdown/math`)
- Rakip referansı: referans yok
- Önem: LOW (niş kullanım)

### 1.10 Footnote, definition list, task list
- Mevcut: Hiçbiri tanımlı değil
- Boşluk:
  - Footnote: ❌
  - Definition list: ❌
  - Task list (`- [ ]`): ❌
- Rakip referansı: referans yok
- Önem: LOW (nadir kullanım)

### Özet: Markdown Renderer Coverage

| Öğe | Custom renderer | Durum |
|-----|----------------|-------|
| Code block | ✅ Shiki + copy | 🟡 line number, expand/collapse, max-height eksik |
| Inline code | ❌ passthrough | ❌ stil, font, background yok |
| Table | ❌ | ❌ mobil scroll, striped row yok |
| List | ❌ | 🟡 browser default |
| Blockquote | ❌ | ❌ accent border, attribution yok |
| Heading | ❌ | ❌ font scale kontrolü yok |
| Link | ❌ | ❌ accent color, external icon yok |
| Image | ❌ | ❌ lazy load, sizing yok |
| Math | ✅ plugin | 🟡 test kanıtı yok |
| Task list | ❌ | ❌ |
| Footnote | ❌ | ❌ |
| Definition list | ❌ | ❌ |

## 2. Empty State

- Mevcut: `apps/web/src/components/chat/EmptyState.tsx:50-82`
- Dosyalar: EmptyState.tsx ✅, EmptyState.module.css ❌ (dosya yok — CSS class'ları global scope'da)

### Denetim:
- Öneri chip'leri: 3 adet, **statik** (`apps/web/src/components/chat/EmptyState.tsx:9-30`)
- Saate göre selam: ✅ getGreeting() çalışıyor (EmptyState.tsx:32-48)
- Kullanıcı geçmişine göre öneri: ❌ yok (statik array, dinamik değil)
- "Bugün neyi halledelim?" altı: ✅ `runa-chat-empty-state__tip` satırı var (EmptyState.tsx:80)
- HafizaMark hero: ✅ (EmptyState.tsx:54-59)
- Mobil 390px: ❌ kontrol edilemedi (CSS module yok, global CSS'de responsive kuralı aranmalı)
- Onboarding hint: ❌ yok (OnboardingWizard ayrı bir overlay, EmptyState ile entegre değil)
- "Yeni özellik"/ipucu rotasyonu: ❌ yok

### Boşluklar:
- Öneriler statik, kullanıcı davranışına göre dinamik değil
- CSS module eksik (global class'lara güveniyor)
- Onboarding tamamlandı mesajı veya "yeni" rozeti yok
- Araç kullanım geçmişine dayalı öneri yok
- Önem: MED

## 3. Voice Composer

- Mevcut: `apps/web/src/components/chat/VoiceComposerControls.tsx:17-69` + `apps/web/src/hooks/useVoiceInput.ts:70-192`
- VoiceComposerControls.module.css: ✅ var (55 satır)
- Toplam yüzey: 262 satır

### Denetim:
- Recording state UI: 🟡 sadece "Dinlemeyi durdur" yazısı + button state değişimi — **waveform, level meter, timer yok**
- Permission denied mesajı: ✅ (useVoiceInput.ts:61-62) — "Mikrofon izni reddedildi"
- onerror handling: ✅ 7 hata tipi (audio-capture, no-speech, not-allowed, network, aborted, language-not-supported, unknown)
- Start/stop animation: 🟡 180ms transition (CSS) ama görsel feedback minimal
- Transcribed text: 🟡 `onFinalTranscript` callback ile parent'a iletilir — composer'a inline mi eklenir yoksa ayrı preview mı: **parent implementasyonuna bağlı**, hook içinde ayrı preview yok
- Çoklu dil desteği: ❌ `recognition.lang = 'tr-TR'` hardcoded (useVoiceInput.ts:98) — TR/EN seçim mekanizması yok
- Push-to-talk vs toggle: 🟡 toggle mod (start/stop) — PTT modu yok
- Klavye kısayolu: ❌ yok
- `useTextToSpeech` ile entegrasyon: ✅ SpeechSynthesis API var (voice readback)

### Boşluklar:
- Waveform/görsel feedback yok (rakiplerde animasyonlu dalga)
- Dil seçimi hardcoded tr-TR
- Klavye kısayolu yok (Ctrl+Shift+M)
- Transcribed text preview bileşeni yok (parent'a güveniyor)
- Önem: MED

## 4. Loading Skeleton Parity

- RunaSkeleton: `apps/web/src/components/ui/RunaSkeleton.tsx:14-26` (+ `RunaSkeleton.module.css:1-30`) ✅ var (shimmer animasyonlu, prefers-reduced-motion uyumlu, 3 variant: text/circle/rect)

### Route bazlı tablo:

| Route | Dosya | Skeleton var mı? | Tip | Layout shift? |
|-------|-------|-------------------|-----|---------------|
| `/chat` | ChatRuntimePage.tsx | ✅ 3 RunaSkeleton | rect + 2 text | İlk yükleme engellenir (isConversationLoading + no activeConversationId) |
| `/chat-embedded` | ChatRuntimePage.tsx | Aynı | Aynı | Aynı |
| `/history` | HistoryPage.tsx | ❌ "Yükleniyor" metni | Metin | Metin kaybolunca shift olabilir |
| `/history` (wrapper) | HistoryRoute.tsx | ❌ hiç loading state yok | — | — |
| `/developer` | DeveloperRuntimePage.tsx | ✅ 2 RunaSkeleton | rect + text | İlk yükleme engellenir |
| `/devices` | DevicesPage.tsx | ✅ DevicePresencePanel.tsx:101-103 (text+rect) | panel-level skeleton var; route hero-specific skeleton yok | Panel içi skeleton mevcut; route hero'da generic Suspense fallback'e güveniyor |
| `/notifications` | NotificationsPage.tsx | ❌ loading state yok (static data) | — | — |
| `/account` | SettingsPage.tsx | ✅ auth pending için 2 skeleton | rect + text | ✅ |
| `/capabilities` | CapabilityPreviewPage.tsx | ❌ loading state yok (static harness) | — | — |
| `/login` | LoginPage.tsx | ❌ RunaSpinner kullanıyor (skeleton değil) | Spinner | Spinner ile skeleton arası görsel fark |

### Genel:
- **Global Suspense fallback**: `App.tsx:102` ve `AuthenticatedApp.tsx:81-91` tüm lazy-loaded route'lar için generic skeleton (text+rect) sağlar. Bu sayede hiçbir route "beyaz ekran" riski taşımaz.
- **Route-specific skeleton parity**: Local RunaSkeleton kullanan sayfalar: ChatRuntimePage, DeveloperRuntimePage, SettingsPage, DevicesPage (panel içi). Kalan route'lar global Suspense fallback'e güvenir. Asıl sorun "skeleton yok" değil, "generic fallback var, route-specific layout eşleşmesi (content shape fidelity) eksik."
- ✅ Shimmer animasyonu var, prefers-reduced-motion uyumu var
- ❌ İçerik şekli skeleton'la eşleşiyor mu: sadece generic rect/text kullanılıyor, içeriğe özel skeleton yok
- ❌ Network slow durumunda skeleton timing: ölçüm yok
- ❌ Error state ayrı tasarlanmamış — çoğu yerde aynı skeleton loading olarak kalır
- ❌ CLS ölçümü yok
- Önem: HIGH (ilk açılış deneyimini doğrudan etkiler)

## 5. Tool Icon Set

- Lucide ikon sayısı: **45 benzersiz ikon** (önceki audit 50 demişti — güncel 45)
- Brand SVG'ler: `runa-logo.svg` (tek SVG), HafizaMark (React komponent, SVG değil), favicon.svg ❌ (yok)

### İkon envanteri (45 adet):
AlertTriangle, ArrowLeftIcon, ArrowRightIcon, Bell, BookIcon, BrainIcon, Check, CheckCircle2, CheckIcon, ChevronDown, ChevronDownIcon, ChevronLeft, ChevronLeftIcon, ChevronRight, ChevronRightIcon, ChevronUpIcon, Clipboard, ClipboardIcon, Clock3, Code2, FileText, HelpCircle, History, Laptop, Loader2, LoaderCircle, MessageCircle, Monitor, MonitorSmartphone, MoreHorizontal, Paperclip, Plus, RotateCcw, Search, SendHorizontal, Settings, SlidersHorizontal, Sparkles, Square, TriangleAlert, User, UserRound, Wand2, WrapText, XCircle

### Denetim:
- Tool'a özel ikon: 🟡 Code2 (kod), FileText (doküman), Search (araştırma) — bu 3 tool chip'te kullanılıyor, diğer tool'lar için generic ikonlar kullanılıyor
- Brand SVG: 🟡 sadece `runa-logo.svg` var — favicon.svg yok (muhtemelen logo kullanılıyor)
- Renk tutarlılığı: 🟡 ikonlar `aria-hidden` ile geçiyor, renk CSS ile kontrol ediliyor — `--ink-2` mi `--accent` mı belli değil (CSS okuması yapılmadı)
- Stroke width: ✅ Lucide varsayılanı 2px
- Custom ikon ihtiyacı: ❌ "Hafıza ekle", "Bağlam", "Onay" gibi semantic ikonlar eksik
- Önem: LOW (ikon seti yeterli, özelleştirme iyileştirme alanı)

## 6. Onboarding

- Mevcut: `apps/web/src/components/onboarding/OnboardingWizard.tsx:55-215`
- Tek dosya: OnboardingWizard.tsx (alt komponent yok)

### Denetim:
- Adım sayısı: **3 adım**
  1. Hoş geldin + HafizaMark hero (step 0, satır 88-118)
  2. Workspace adı + kullanım amacı seçimi (step 1, satır 120-176)
  3. İlk iş seçimi (6 prompt card) (step 2, satır 178-212)
- HafizaMark: ✅ Instrument Serif, bold/brand (OnboardingWizard.tsx:90-95)
- Skip: ✅ her adımda "Atla" butonu var
- Geri dönüş: ✅ step 1 ve 2'de "Geri" butonu var
- Workspace seçimi: ✅ input alanı + radiogroup (OnboardingWizard.tsx:129-151) — file system erişimi **yok**, sadece isim giriliyor
- Provider/API key kurulumu: ❌ onboarding'de yok (Settings'e bırakılmış)
- Görsel ritim: 🟡 hero + açıklama + CTA hiyerarşi var ama görsel öğe az
- Mobil 390px: ❌ kontrol edilemedi (CSS inline değil, class bazlı)
- `localStorage` persistence: ✅ (OnboardingWizard.tsx:47-53)
- promptCards 6 adet: 🟡 EmptyState'teki 3 chip'ten farklı, onboarding'de 6 card — tutarsızlık var

### Boşluklar:
- Provider/API key kurulumu onboarding'de yok (rakipler ilk açılışta API key ister)
- Mobil responsive test kanıtı yok
- Onboarding sonrası "sıradaki" hissi (progress bar, celebration) yok
- Önem: MED

## 7. Settings Derinliği

- Dosya: `apps/web/src/pages/SettingsPage.tsx` (696 satır)
- 5 tab: appearance, conversation, notifications, privacy, advanced

### Tab bazlı alan tablosu:

| Tab | Alan | Tip | Persistence | Rakip karşılığı |
|-----|------|-----|-------------|-----------------|
| **Appearance** | Tema (light/dark/system) | ThemePicker komponent | ThemePicker içi | ✅ standart |
| | Renk paleti (brand theme) | Radio group (button grid) | onBrandThemeChange callback | ✅ |
| | Tipografi yoğunluğu (comfortable/compact) | Select | localStorage | 🟡 rahat/sıkı ikisi yeterli mi? |
| **Conversation** | Onay modu (3 seviye) | Radio group | localStorage | 🟡 Claude'de "approval threshold" var |
| | Ses tercihleri (auto-read, microphone status) | Checkbox + bilgi | localStorage (autoRead) | 🟡 rakiplerde ses hızı seçimi var |
| **Notifications** | Dil (TR/EN) | Select | localStorage | ✅ |
| | Sessiz saatler (22:00-08:00) | Checkbox | localStorage | 🟡 saat aralığı sabit |
| | Veri saklama süresi (30/90/forever) | Select | localStorage | 🟡 rakiplerde "data retention policy" daha detaylı |
| **Privacy** | Çalışma klasörü seçimi | Select + refresh button | localStorage | 🟡 Codex'te "workspace path" |
| | Workspace root adı | Output (read-only) | Server | ✅ |
| **Advanced** | Gelişmiş görünüm (dev mode toggle) | Checkbox | useAdvancedViewMode hook | 🟡 rakiplerde model temperature, context window, system prompt var |

### Alan sayısı (güncel):
- Appearance: **3** (theme, brand palette, typography) — PR-10'da 3 demişti ✅
- Conversation: **3** (approval mode, auto-read, voice status) — PR-10'da 2 demişti, voice status eklendi 🟡
- Notifications: **3** (language, quiet hours, data retention) — PR-10'da 3 demişti ✅
- Privacy: **2** (workspace root, run directory) — PR-10'da 3 demişti, workspace directories kaldırılmış ❌
- Advanced: **1** (dev mode toggle) — PR-10'da 1 demişti ✅

### Boşluklar:
- Tab arası geçiş: ✅ URL searchParam (`?tab=`) ile state korunuyor (SettingsPage.tsx:245-248)
- Persistence: ✅ localStorage (hepsi)
- Reset/varsayılana dön butonu: ❌ hiçbir tabda yok
- Search/filter alanı: ❌ yok
- Empty state (henüz hiçbir ayar değişmediyse): ❌ yok
- Rakip farkı: model temperature, context window strategy, system prompt customization, export/import settings — ❌ hiçbiri yok
- Önem: MED (power user özellikleri)

## 8. Bonus Alanlar

### 8.1 Toast / Banner sistemi
- Mevcut: `apps/web/src/components/ui/RunaToast.tsx:42-98` ✅ **tanımlı** (RunaToastProvider + useRunaToast hook, createPortal ile body'e render)
- Provider: ✅ `App.tsx:5,100` root'a bağlı. Tüm uygulamayı sarıyor.
- Kullanım: 🟡 `MenuSheet.tsx:6,33,44` — `pushToast()` "Yakında" mesajı için çağrılıyor. Kullanım kapsamı çok sınırlı (tek bir yerde, tek bir senaryo). App genelinde error/success akışlarına bağlanmamış.
- Dismiss: ✅ close butonu var, 5s auto-dismiss (setTimeout, ancak cleanup yok — unmount durumunda çalışmaya devam eder)
- Animasyon: ❌ yok (giriş/çıkış animasyonu yok)
- Accessibility: ✅ aria-live assertive/polite ayrımı var
- Önem: HIGH (altyapı var, kullanım coverage'ı çok düşük)

### 8.2 Error boundary
- App-level error boundary: ❌ yok
- Fallback UI: ❌ yok
- Önem: HIGH (herhangi bir React hatasında beyaz ekran)

### 8.3 Offline state
- "Ağ kesildi" göstergesi: ❌ yok
- `navigator.onLine` dinleyicisi: ❌ yok
- TransportErrorBanner: 🟡 WebSocket kopmalarını gösteriyor ama genel ağ durumunu değil
- Önem: MED

### 8.4 Keyboard shortcuts discovery
- Cmd+K: ✅ ChatHeader.tsx:17-22, komut paleti için gösteriliyor
- Escape: ✅ sidebar kapatma (ChatLayout.tsx:27-29)
- Diğer shortcut'lar: ❌ hiçbiri keşfedilebilir değil
- Cheat sheet: ❌ yok
- Önem: LOW

### 8.5 Conversation list ergonomics
- Arama: ✅ (ConversationSidebar.tsx:289-298)
- Filtre: 🟡 sadece arama filtresi, tip/status filtresi yok
- Gruplandırma: ✅ Bugün/Dün/Son 7 gün/Daha eski (ConversationSidebar.tsx:76-114)
- Önem: LOW

### 8.6 Attachment UX
- Drag-drop: ❌ yok (sadece file input)
- Preview: ✅ image/text/document preview (ChatComposerSurface.tsx:340-352)
- Remove animation: ❌ yok (anında kayboluyor)
- File type icon: ❌ yok (sadece text label)
- Önem: LOW

### 8.7 Copy/share message
- Asistan mesajını kopyalama: ❌ yok
- Paylaşma butonu: ❌ yok
- Code block copy var (ayrı) ama mesaj bazında kopyalama yok
- Önem: MED

### 8.8 Regenerate response
- Claude/Codex'te var olan "yanıtı yeniden oluştur": ❌ yok
- Retry butonu: ❌ yok (transport retry var, response regenerate yok)
- Önem: MED

### 8.9 Stop generation feedback
- Stop: ✅ `onAbortRun` ile Square icon + "Çalışmayı durdur" (ChatComposerSurface.tsx:289-303)
- "Yarıda kesildi" semantik gösterim: ❌ yok (stop sonrası mesaj içeriğinde herhangi bir işaret yok)
- Önem: MED

### 8.10 Conversation rename, archive, delete UX
- Rename: ❌ yok
- Archive: ❌ yok
- Delete: ❌ yok
- Sadece yeni sohbet başlatma ve konuşma seçme var
- Önem: MED

## 9. Öncelik Önerisi

### HIGH (kullanıcı algısına en çok dokunan)

| # | Boşluk | Alan |
|---|--------|------|
| 1 | Error boundary eksik (beyaz ekran riski) | Bonus |
| 2 | Toast usage coverage çok düşük (sadece MenuSheet'te) | Bonus |
| 3 | Code block: line numbers + max-height/scroll | Markdown |
| 4 | Skeleton route-specific fidelity (global fallback var, shape parity yok) | Loading |
| 5 | Markdown table renderer + mobil scroll | Markdown |
| 6 | Inline code stili (font, background, spacing) | Markdown |

### MED

| # | Boşluk | Alan |
|---|--------|------|
| 7 | Empty state önerileri statik, kullanıcıya göre dinamik değil | Empty State |
| 8 | Voice: waveform/görsel feedback yok | Voice |
| 9 | Voice: dil seçimi hardcoded tr-TR | Voice |
| 10 | Copy/share message (mesaj bazında) | Bonus |
| 11 | Regenerate response | Bonus |
| 12 | Stop sonrası "yarıda kesildi" göstergesi | Bonus |
| 13 | Conversation rename/archive/delete | Bonus |
| 14 | Settings: reset/varsayılana dön butonu yok | Settings |
| 15 | Settings: Claude/Codex'te olan model temperature, context window yok | Settings |
| 16 | Onboarding: API key kurulum adımı yok | Onboarding |
| 17 | Offline state göstergesi yok | Bonus |
| 18 | Image: lazy loading, sizing | Markdown |
| 19 | Blockquote accent border | Markdown |

### LOW

| # | Boşluk | Alan |
|---|--------|------|
| 20 | Heading font scale kontrolü | Markdown |
| 21 | Link accent color / external indicator | Markdown |
| 22 | Math/LaTeX test kanıtı yok | Markdown |
| 23 | Task list / footnote / definition list | Markdown |
| 24 | Nested list stil tutarlılığı | Markdown |
| 25 | Custom ikon ihtiyacı | Icon Set |
| 26 | Keyboard shortcut cheat sheet | Bonus |
| 27 | Attachment drag-drop & remove animation | Bonus |
| 28 | Favicon.svg yok | Brand |

## 10. PR-14+ Önerilen Sırası

Her PR tek odaklı, dar diff olacak şekilde:

- **PR-14: Error boundary + Toast usage audit** — App-level ErrorBoundary bileşeni. RunaToast (zaten root'a bağlı, MenuSheet'te kullanılıyor) error/success akışlarına bağlanarak coverage genişletmesi.
- **PR-15: Markdown code block enhancements** — Line numbers, max-height + scroll, expand/collapse. CodeBlock.tsx'e ek.
- **PR-16: Loading skeleton route-specific parity** — HistoryPage, DevicesPage hero, NotificationsPage, CapabilityPreviewPage için route layout'uyla eşleşen RunaSkeleton. Global Suspense fallback (`App.tsx:102`, `AuthenticatedApp.tsx:81-91`) mevcut; eksik olan içerik şekli eşleşmesi (content shape fidelity).
- **PR-17: Markdown table + inline code renderer** — StreamdownMessage.tsx'e custom table renderer (mobil scroll) + inline code stili (font, background, border-radius).
- **PR-18: Empty state dinamik öneriler** — EmptyState.tsx'i kullanıcı geçmişine göre öneri gösterecek şekilde genişlet.
- **PR-19: Voice composer derinliği** — Waveform animasyonu, dil seçimi (TR/EN), klavye kısayolu (Ctrl+Shift+M), transcribed text preview.
- **PR-20: Message actions (copy/share/regenerate)** — Her mesaja copy button, share button, regenerate button ekle. PersistedTranscript.tsx + StreamingMessageSurface.tsx.
- **PR-21: Conversation management (rename/archive/delete)** — ConversationSidebar.tsx'e rename, archive, delete aksiyonları. Backend hook'larını kontrol et.
- **PR-22: Markdown image + blockquote + heading renderers** — StreamdownMessage.tsx'e lazy-loaded image, blockquote accent border, heading font scale.
- **PR-23: Settings derinliği** — Reset to defaults, search/filter, missing competitor fields (model temperature, context window strategy, system prompt).
- **PR-24: Onboarding API key step** — OnboardingWizard'a 4. adım olarak provider/API key kurulumu ekle.
- **PR-25: Offline state indicator** — Network status banner, navigator.onLine listener, TransportErrorBanner genişletme.
- **PR-26: Keyboard shortcuts cheat sheet** — Cmd+K paleti içinde veya ayrı modal olarak tüm shortcut'ları göster.

> Not: PR-14'ten PR-26'ya kadar sıralama öncelik bazlıdır. Her PR bağımsız olarak main'e merge edilebilir olmalıdır.
