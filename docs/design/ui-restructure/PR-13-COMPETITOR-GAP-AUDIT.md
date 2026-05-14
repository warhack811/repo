# PR-13 Competitor Gap Audit

> Tarih: 2026-05-15  
> Yöntem: GitHub repository kaynak kod taraması. `C:\Users\admin\OneDrive\Desktop\ornekler` yerel rakip referans klasörüne bu ortamdan erişim yok; bu nedenle rakip karşılaştırmaları yalnızca repo kanıtlarına göre ürün-kalite boşluğu olarak işaretlendi.  
> Bağlam: PR-1..PR-12 sonrası UI restructure ana hattı `main` üzerinde tamamlanmış kabul edildi. Bu rapor yapısal overhaul değil, rakip seviyesi tüketici hissi için kalan mikro/içerik/davranış boşluklarını çıkarır.  
> Kapsam disiplini: Kod değişikliği yapılmadı. Sadece bu audit dosyası oluşturuldu.

## Executive Summary

Runa'nın UI restructure sonrası tabanı güçlü: lazy route fallback, skeleton primitive, Streamdown + Shiki + Mermaid rendering, onboarding, settings tab sistemi, conversation sidebar search/grouping ve basic voice/text-to-speech yüzeyleri mevcut. Ancak rakip seviyesi "consumer-grade" his için kalan boşluklar çoğunlukla mikro etkileşim, içerik derinliği ve kullanıcı algısı alanında.

En yüksek öncelikli boşluklar:

1. **Markdown renderer derinliği**: Code block güçlü bir başlangıç yapmış; fakat table, blockquote, heading, link, image, task-list, footnote gibi öğeler için custom consumer-grade renderer kanıtı yok. HIGH.
2. **Voice composer derinliği**: Browser speech recognition var, hata mesajları var; ancak waveform/timer/preview/push-to-talk/language selector/kısayol yok. HIGH.
3. **Empty state personalization**: HafizaMark + greeting + 3 statik öneri var; kullanıcı geçmişi, son tool/son konu, onboarding durumuna göre dinamik öneri yok. HIGH.
4. **Settings derinliği**: 5 tab var fakat alanlar çoğunlukla localStorage tabanlı ve az sayıda; reset/search/filter ve daha gelişmiş model/context/data ayarları yok. HIGH.
5. **Loading parity**: Skeleton primitive ve lazy route fallback var; fakat her route/page için route-specific skeleton ve CLS ölçüm kanıtı yok. MED/HIGH.

## 1. Markdown Rendering Kalitesi

### 1.1 Code block — ✅ var, 🟡 derinlik eksik

- Mevcut: `apps/web/src/lib/streamdown/StreamdownMessage.tsx:17-45` code/pre bileşenlerini yakalıyor; block code için `CodeBlock`, mermaid için `MermaidBlock` kullanıyor.
- Mevcut: `apps/web/src/lib/streamdown/CodeBlock.tsx:13-127` dil etiketini çıkarıyor, Shiki highlight çağırıyor, toolbar + copy button + copied/failed state sağlıyor.
- Mevcut: `apps/web/src/lib/streamdown/shiki-highlighter.ts:7-19` initial dil seti TypeScript, JavaScript, Python, JSON, Bash, TSX, JSX, SQL, HTML, CSS, Markdown olarak tanımlı; `rust` lazy destekleniyor.
- Boşluk: `CodeBlock.tsx` içinde line numbers, expand/collapse threshold, max-height kontrolü ve uzun kod bloklarında collapse/expand UX kanıtı yok. Dosya yalnızca toolbar + `<pre><code>` fallback ve Shiki HTML render ediyor.
- Önem: HIGH. Kodlama/agent ürünü için uzun code block ergonomisi günlük kullanımda görünür.

### 1.2 Inline code — 🟡 var ama custom kalite belirsiz

- Mevcut: `apps/web/src/lib/streamdown/StreamdownMessage.tsx:31-36` inline olmayan code block ayrıştırılıyor; inline code için default `<code>` döndürülüyor.
- Mevcut: `apps/web/src/lib/streamdown/StreamdownMessage.tsx:42-44` `inlineCode` sadece `<code {...props} />` döndürüyor.
- Boşluk: inline code için özel spacing, background, copy-on-click, keyboard focus veya token-level style kanıtı yok.
- Önem: MED.

### 1.3 Table — ❌ custom renderer yok

- Mevcut: `apps/web/src/lib/streamdown/StreamdownMessage.tsx:17-55` `components` map'inde yalnızca `code`, `inlineCode`, `pre` override var.
- Boşluk: `table`, `thead`, `tbody`, `tr`, `th`, `td` renderer override kanıtı yok; mobil horizontal scroll, sticky header veya responsive table wrapper görünmüyor.
- Önem: HIGH. LLM cevaplarında tablo günlük kullanımda sık tetiklenir.

### 1.4 Lists — ❌ custom renderer yok

- Mevcut: Streamdown components map yalnızca code/pre alanlarını özelleştiriyor (`StreamdownMessage.tsx:17-55`).
- Boşluk: `ul`, `ol`, `li` için nested spacing, bullet style veya task-list kontrolü yok.
- Önem: MED.

### 1.5 Blockquote — ❌ custom renderer yok

- Mevcut: `StreamdownMessage.tsx:17-55` blockquote override içermiyor.
- Boşluk: accent border, citation attribution, compact quote rendering yok.
- Önem: MED.

### 1.6 Heading hiyerarşi — ❌ custom renderer yok

- Mevcut: `StreamdownMessage.tsx:17-55` `h1`..`h6` override içermiyor.
- Boşluk: mesaj içi heading scale, spacing, anchor veya copy link davranışı yok.
- Önem: MED.

### 1.7 Link — ❌ custom renderer yok

- Mevcut: link override kanıtı yok (`StreamdownMessage.tsx:17-55`).
- Boşluk: external link indicator, rel/security policy, hover/focus state ve visited state custom davranışı yok.
- Önem: MED.

### 1.8 Image/embed — ❌ custom renderer yok

- Mevcut: `StreamdownMessage.tsx:17-55` image renderer override içermiyor.
- Boşluk: lazy load, max width, caption, click-to-expand veya failed-image fallback kanıtı yok.
- Önem: MED.

### 1.9 Math/LaTeX — ✅ var

- Mevcut: `apps/web/src/lib/streamdown/StreamdownMessage.tsx:1-16` `@streamdown/math` import ediliyor ve `createMathPlugin({ singleDollarTextMath: true })` ile plugin listesine ekleniyor.
- Boşluk: Math error fallback veya display math özel styling kanıtı ayrıca görülmedi.
- Önem: LOW/MED.

### 1.10 Mermaid — ✅ var, 🟡 polish eksik

- Mevcut: `apps/web/src/lib/streamdown/MermaidBlock.tsx:1-22` mermaid renderer lazy load ediliyor ve fallback olarak `diagram-skeleton` kullanılıyor.
- Mevcut: `apps/web/src/lib/streamdown/MermaidRenderer.tsx:8-21` Mermaid `securityLevel: 'strict'`, `theme: 'dark'` ve custom font ile initialize ediliyor.
- Mevcut: `MermaidRenderer.tsx:48-72` render error durumunda fallback + `CodeBlock` sağlanıyor.
- Boşluk: tema light/dark adaptive değil; `theme: 'dark'` sabit. Zoom/pan/download/copy SVG kanıtı yok.
- Önem: MED.

### 1.11 Footnote / definition list / task list — ❌ custom destek kanıtı yok

- Mevcut: components map yalnızca code/pre override ediyor (`StreamdownMessage.tsx:17-55`).
- Boşluk: task list checkbox rendering, footnote backlink, definition list layout gibi özellikler için repo kanıtı yok.
- Önem: LOW/MED.

## 2. Empty State

### 2.1 Öneri chip'leri — 🟡 statik

- Mevcut: `apps/web/src/components/chat/EmptyState.tsx:8-30` üç statik suggestion var: kod, araştırma, doküman.
- Mevcut: `EmptyState.tsx:58-73` suggestion butonları prompt'u composer'a basıyor.
- Boşluk: Kullanıcı geçmişi, son kullanılan tool, son conversation konusu, workspace bağlamı veya günün saatine göre öneri çeşitlenmesi yok.
- Önem: HIGH. İlk açılış algısını doğrudan etkiler.

### 2.2 Saat bazlı selam — ✅ var

- Mevcut: `EmptyState.tsx:32-46` `getGreeting()` saat aralığına göre Günaydın/İyi günler/İyi akşamlar/Geç oldu döndürüyor.
- Mevcut: `EmptyState.tsx:54-55` hero title olarak greeting render ediliyor.
- Boşluk: Kullanıcı adı, workspace adı veya son bağlamla kişiselleştirme yok.
- Önem: MED.

### 2.3 Hero ve ipucu — ✅ var, 🟡 yüzeysel

- Mevcut: `EmptyState.tsx:48-57` HafizaMark hero olarak render ediliyor ve "Bugün neyi halledelim?" lead metni var.
- Mevcut: `EmptyState.tsx:75` Ctrl+K ipucu var.
- Boşluk: yeni kullanıcı vs experienced user ayrımı, tip rotasyonu, yeni özellik tanıtımı veya son capability önerisi yok.
- Önem: HIGH.

## 3. Voice Composer

### 3.1 Recording state UI — 🟡 minimal

- Mevcut: `apps/web/src/components/chat/VoiceComposerControls.tsx:25-47` isListening durumunda buton etiketi "Dinlemeyi durdur" oluyor ve class'a `runa-voice-button--listening` ekleniyor.
- Boşluk: waveform, level meter, elapsed timer, live transcript preview veya recording pulse semantiği kanıtı yok.
- Önem: HIGH.

### 3.2 Permission/error handling — ✅ var

- Mevcut: `apps/web/src/hooks/useVoiceInput.ts:49-68` audio-capture, network, no-speech, not-allowed, service-not-allowed, aborted gibi error code'lar kullanıcı mesajına çevriliyor.
- Mevcut: `useVoiceInput.ts:120-132` `onerror` status/error/permissionDenied state'lerini güncelliyor.
- Mevcut: `SettingsPage.tsx:535-548` permission denied ve voice/text-to-speech error mesajları Settings içinde gösteriliyor.
- Boşluk: chat composer içinde permission remediation akışı, browser permission help linki veya retry CTA yok.
- Önem: MED.

### 3.3 Dil ve mod desteği — ❌ sınırlı

- Mevcut: `useVoiceInput.ts:103-106` recognition `lang = 'tr-TR'`, `continuous = false`, `interimResults = true`.
- Boşluk: TR/EN seçimi yok; push-to-talk yok; toggle dışında mod yok; Ctrl+Shift+M gibi voice shortcut kanıtı yok.
- Önem: HIGH.

### 3.4 Transcribed text davranışı — ✅ temel var

- Mevcut: `useVoiceInput.ts:111-119` final transcript yakalanıp `onFinalTranscript` callback'e veriliyor.
- Mevcut: `ChatPage.tsx:147-154` `useTextToSpeechIntegration` prompt setter ile bağlanıyor.
- Boşluk: interim transcript composer içinde preview olarak görünmüyor; final transcript için undo/confirm ara yüzü yok.
- Önem: MED.

## 4. Loading Skeleton Parity

| Route / Surface | Skeleton var mı? | Tip | Kanıt | Boşluk |
|---|---|---|---|---|
| Authenticated app lazy load | ✅ | Generic route skeleton | `apps/web/src/App.tsx:35-47` | Text mojibake riski: `Sayfa y?kleniyor` |
| Authenticated routes | ✅ | Generic route skeleton | `apps/web/src/AuthenticatedApp.tsx:79-91` | Route-specific shape yok |
| Conversation sidebar | ✅ | List skeleton | `ConversationSidebar.tsx:135-145` | 3 fixed row; gerçek içerik shape'i sınırlı |
| Settings account profile | ✅ | Rect + text | `SettingsPage.tsx:401-408` | Yalnız profile area; tab content fetch skeleton sınırlı |
| Devices | ✅ | Device panel skeleton | `DevicePresencePanel.tsx:91-99` | Route top hero skeleton yok |
| Mermaid diagram | ✅ | Diagram fallback | `MermaidBlock.tsx:17-21`, `MermaidRenderer.tsx:63-65` | İngilizce `Loading diagram...`; design-token skeleton değil |
| Notifications | ❌ | Yok | `NotificationsPage.tsx:75-161` static seed render ediyor | Gerçek fetch/loading modeli yok |
| Chat main messages | 🟡 | Conversation loading prop aktarımı | `ChatPage.tsx:388-397` | CurrentRunSurface içinde ayrıca doğrulanmalı |

### Genel bulgu

- Mevcut: `apps/web/src/components/ui/RunaSkeleton.tsx:1-20` ortak skeleton primitive var.
- Mevcut: `apps/web/src/components/ui/RunaSkeleton.module.css:1-25` shimmer animation ve `prefers-reduced-motion: reduce` desteği var.
- Boşluk: 11 route için route-specific skeleton parity ve layout shift/CLS ölçüm kanıtı yok. Prompt'un hedeflediği "6 route loading" sonrası temel coverage var ama tam route parity raporu repo içinde yok.
- Önem: MED/HIGH.

## 5. Tool Icon Set ve Marka Kimliği

### 5.1 Lucide kullanımı — ✅ yaygın, 🟡 generic karakter riski

- Mevcut: `apps/web/src/components/ui/RunaIcon.tsx:1-24` LucideIcon wrapper var; default size 18.
- Mevcut: `EmptyState.tsx:1-30` Code2, FileText, Search ikonları önerilerde kullanılıyor.
- Mevcut: `OnboardingWizard.tsx:1-40` Code2, FileText, MonitorSmartphone, Search, Sparkles, Wand2 kullanılıyor.
- Mevcut: `ChatComposerSurface.tsx:1-13` ChevronRight, Paperclip, SendHorizontal, SlidersHorizontal, Square kullanılıyor.
- Boşluk: tool semantiğini zenginleştiren custom iconography yok; file/shell/browser/memory/approval gibi capability'ler çoğunlukla Lucide/generic temsil ediliyor.
- Önem: MED.

### 5.2 Marka varlığı — ✅ HafizaMark var

- Mevcut: `EmptyState.tsx:48-54` HafizaMark hero surface içinde kullanılıyor.
- Mevcut: `OnboardingWizard.tsx:79-84` onboarding ilk adımda HafizaMark kullanıyor.
- Boşluk: HafizaMark dışında tool-specific brand motif seti veya custom semantic icon family kanıtı yok.
- Önem: MED.

## 6. Onboarding Flow

### 6.1 Adım yapısı — ✅ 3 adım var

- Mevcut: `apps/web/src/components/onboarding/OnboardingWizard.tsx:70-76` progress 3 adım olarak render ediliyor.
- Mevcut: `OnboardingWizard.tsx:78-111` adım 0: hero + ileri/atla.
- Mevcut: `OnboardingWizard.tsx:113-170` adım 1: workspace name + purpose seçimi + geri/ileri/atla.
- Mevcut: `OnboardingWizard.tsx:172-215` adım 2: prompt cards + geri/boş sohbet/atla.
- Önem: LOW/MED.

### 6.2 Personalization persistence — 🟡 eksik

- Mevcut: `OnboardingWizard.tsx:5-6` yalnız `runa.onboarding.completed` localStorage anahtarı var.
- Mevcut: `OnboardingWizard.tsx:52-55` complete sadece completed flag yazar.
- Boşluk: workspaceName ve purpose seçimleri sonraki empty state, öneriler veya settings'e persist edilmiyor.
- Önem: HIGH. Onboarding'de sorulan bilgi ürün içinde kullanılmıyorsa kullanıcı algısında boşa düşer.

### 6.3 Provider/API key setup — ❌ onboarding içinde yok

- Mevcut: onboarding dosyasında provider/API key veya secret handling akışı yok (`OnboardingWizard.tsx:1-215`).
- Boşluk: ilk kurulumda model/provider/API key gereksinimi varsa kullanıcı onboarding'de yönlendirilmiyor.
- Önem: MED/HIGH.

## 7. Settings Derinliği

### 7.1 Tab mimarisi — ✅ 5 tab var

- Mevcut: `apps/web/src/pages/SettingsPage.tsx:19-22` SettingsTab union: advanced, appearance, conversation, notifications, privacy.
- Mevcut: `SettingsPage.tsx:75-81` tab labels tanımlı.
- Mevcut: `SettingsPage.tsx:250-254` URL search param üzerinden tab state restore ediliyor.
- Önem: LOW.

### 7.2 Alan tablosu

| Tab | Alan | Tip | Persistence | Kanıt | Boşluk |
|---|---|---|---|---|---|
| appearance | Tema | ThemePicker | theme storage parent | `SettingsPage.tsx:437-439` | Reset yok |
| appearance | Renk paleti | button/radiogroup | parent brand theme storage | `SettingsPage.tsx:441-468` | Descriptions/preview sınırlı |
| appearance | Metin yoğunluğu | select | localStorage `runa.settings.typography` | `SettingsPage.tsx:472-493`, `SettingsPage.tsx:143-151` | Uygulama geneline etkisi kanıtlanmalı |
| conversation | Approval mode | radio group | runtime config localStorage | `SettingsPage.tsx:502-535`, `SettingsPage.tsx:181-204` | Risk copy Türkçe karakterleri ASCIIleşmiş |
| conversation | Voice prefs | checkbox/status | hook/internal storage | `SettingsPage.tsx:537-550` | Language, push-to-talk, mic test yok |
| notifications | Language | select | localStorage `runa.settings.notifications` | `SettingsPage.tsx:565-582`, `SettingsPage.tsx:157-178` | App i18n'e bağlandığı kanıt yok |
| notifications | Quiet hours | checkbox | localStorage | `SettingsPage.tsx:583-593` | Saat aralığı configurable değil |
| notifications | Data retention | select | localStorage | `SettingsPage.tsx:594-615` | Server retention policy ile bağ kanıtı yok |
| privacy | Workspace root | output | fetched from server | `SettingsPage.tsx:629-633` | Permission/audit açıklaması sınırlı |
| privacy | Run directory | select | runtime config localStorage | `SettingsPage.tsx:634-650`, `SettingsPage.tsx:206-236` | Directory search yok |
| privacy | Refresh directories | button | reload nonce | `SettingsPage.tsx:652-660` | Loading feedback var ama skeleton yok |
| advanced | Advanced view | checkbox | useAdvancedViewMode | `SettingsPage.tsx:685-701` | Tek alan; developer-mode derinliği sınırlı |

### 7.3 Settings genel boşlukları

- Search/filter yok: dosyada settings search input veya filter state kanıtı yok (`SettingsPage.tsx:1-727`).
- Reset/defaults yok: herhangi bir "varsayılana dön" butonu veya reset handler kanıtı yok.
- Persistence çoğunlukla localStorage: `runtimeConfigStorageKey`, `typographyStorageKey`, `notificationsSettingsStorageKey` `SettingsPage.tsx:32-34` içinde tanımlı; server-side preference model yok.
- Önem: HIGH. Settings, ürün olgunluğu algısında merkezi yüzey.

## 8. Bonus Alanlar

### 8.1 Notification UX — 🟡 mock/static gibi

- Mevcut: `apps/web/src/pages/NotificationsPage.tsx:13-46` notification seed sabit veri olarak tanımlı.
- Mevcut: `NotificationsPage.tsx:75-161` filtre, mark all read, snooze ve open davranışı local state ile çalışıyor.
- Boşluk: server-backed notification, toast/banner integration, dismiss persistence veya deep-link routing kanıtı yok.
- Önem: MED/HIGH.

### 8.2 Error boundary — ❌ kanıt bulunmadı

- Mevcut: `App.tsx:102-128` route render ve LoginPage/AuthenticatedApp conditional render var, ancak React error boundary component kanıtı yok.
- Mevcut: `TransportErrorBanner` network/WS retry banner sağlıyor (`apps/web/src/lib/transport/errors.tsx:13-25`).
- Boşluk: app-level exception fallback UI yok.
- Önem: MED/HIGH.

### 8.3 Offline state — 🟡 transport seviyesinde var, app-level yok

- Mevcut: `TransportErrorBanner` retry CTA sağlıyor (`errors.tsx:13-25`).
- Mevcut: chat runtime tarafında transport error banner kullanılıyor (`ChatPage.tsx:231-234`).
- Boşluk: global offline banner veya route-level offline state kanıtı yok.
- Önem: MED.

### 8.4 Keyboard shortcuts discovery — 🟡 sınırlı

- Mevcut: `EmptyState.tsx:75` Ctrl+K ipucu var.
- Boşluk: shortcut cheat sheet veya command palette discovery merkezi dokümanı/yüzeyi bu audit kapsamında doğrulanmadı.
- Önem: MED.

### 8.5 Conversation list ergonomics — ✅ güçlü başlangıç, 🟡 aksiyon eksiği

- Mevcut: `ConversationSidebar.tsx:67-112` Bugün/Dün/Son 7 gün/Daha eski grouping var.
- Mevcut: `ConversationSidebar.tsx:114-123` title + preview search var.
- Mevcut: `ConversationSidebar.tsx:294-356` search empty, list empty, grouped render var.
- Boşluk: rename/archive/delete, pin/star, bulk actions, keyboard navigation kanıtı yok.
- Önem: HIGH.

### 8.6 Attachment UX — ✅ temel var, 🟡 polish eksik

- Mevcut: `ChatComposerSurface.tsx:286-353` image/text/document preview ve remove button var.
- Mevcut: `ChatComposerSurface.tsx:354-358` upload error/loading text var.
- Boşluk: drag-drop, file type icon set, upload progress bar, remove animation, large file state kanıtı yok.
- Önem: MED.

### 8.7 Regenerate / copy-share message — ❌ kanıt bulunmadı

- Mevcut: assistant/code block copy var (`CodeBlock.tsx:63-90`), fakat assistant message copy/share/regenerate aksiyonları bu audit'te görülen chat page surfaces içinde kanıtlanmadı.
- Boşluk: "Regenerate response", "copy whole answer", "share answer" gibi rakiplerde beklenen message-level aksiyonlar yok.
- Önem: HIGH.

### 8.8 Stop generation feedback — 🟡 temel var

- Mevcut: `ChatComposerSurface.tsx:253-273` isRunning durumunda send button stop action'a dönüşüyor ve Square icon kullanıyor.
- Boşluk: stop sonrası "yarıda kesildi" semantiği, partial result banner veya retry/regenerate CTA kanıtı yok.
- Önem: MED.

## 9. Öncelik Önerisi

### HIGH

- Markdown table/list/link/blockquote/task-list renderer polish.
- Voice composer: waveform/timer/transcript preview/language selector/push-to-talk.
- Empty state personalization: onboarding purpose/workspace + recent activity + dynamic suggestions.
- Settings depth: reset/search/server-backed preferences/real notification-data retention linkage.
- Conversation actions: rename/archive/delete/pin/regenerate/copy/share.

### MED

- Route-specific skeleton parity + CLS measurement note.
- Mermaid polish: theme adaptive, zoom/copy/download.
- Attachment UX: drag-drop/progress/file icons.
- Notification UX: server-backed state and toast/deep-link integration.
- Global error boundary/offline banner.

### LOW

- Footnotes/definition lists if usage remains rare.
- Custom icon family beyond HafizaMark, unless brand differentiation becomes sprint focus.

## 10. PR-14+ Önerilen Sırası

- **PR-14: Markdown table/list/link renderer polish**  
  Scope: `StreamdownMessage.tsx` custom renderers + CSS + tests. Dar hedef: table wrapper, link external/focus policy, blockquote/list/task-list style.

- **PR-15: Message-level actions**  
  Scope: assistant message copy/share/regenerate + stop-result feedback. Dar hedef: current/past assistant response cards; no runtime architecture rewrite.

- **PR-16: Voice composer pro UX**  
  Scope: `VoiceComposerControls.tsx`, `useVoiceInput.ts`, composer integration. Dar hedef: timer, transcript preview, language select TR/EN, permission remediation.

- **PR-17: Empty state personalization**  
  Scope: `EmptyState.tsx`, onboarding persisted purpose/workspace, recent conversation/tool-derived suggestions. Dar hedef: dynamic suggestion source with fallback statics.

- **PR-18: Settings depth and reset/search**  
  Scope: `SettingsPage.tsx` only plus small settings utilities. Dar hedef: search/filter, reset-to-default, field descriptions, notification/retention copy alignment.

- **PR-19: Conversation management ergonomics**  
  Scope: `ConversationSidebar.tsx` + hooks/API if already present. Dar hedef: rename/archive/delete/pin if backend supports; otherwise audit-backed UI disabled states.

- **PR-20: Loading parity audit fixes**  
  Scope: route-specific skeletons and reduced-motion/layout-shift checks. Dar hedef: devices/notifications/history/settings/chat route-specific loading skeletons.

## 11. Rakip Referans Durumu

- Yerel referans klasörü `C:\Users\admin\OneDrive\Desktop\ornekler` bu GitHub connector ortamından okunamadı.
- Bu nedenle "Claude Cowork / Codex birebir ekran karşılaştırması" yapılmadı.
- PR-14+ brief yazmadan önce kullanıcı bu klasördeki örnekleri repo içine audit-only fixture olarak eklerse veya ekran görüntüsü olarak paylaşırsa bu raporun rakip referans bölümleri güncellenebilir.

## 12. Audit Kapanış Notu

Bu audit, UI restructure'ın başarısız olduğunu söylemiyor; tersine yapısal zemin artık yeterince güçlü olduğu için kalan farkların çoğu mikro kalite ve tüketici hissi tarafında yoğunlaşıyor. En yüksek kaldıraç sırası: markdown rendering, message actions, voice composer, empty personalization, settings depth.
