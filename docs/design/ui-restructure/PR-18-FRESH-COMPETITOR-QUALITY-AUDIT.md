# PR-18 Fresh Competitor Quality Audit

Base main HEAD: e02c542b4a2e0111fddf17443a2582678f7a1eab  
Date: 2026-05-15  
Scope: Audit-only, no product code changes.

## Executive summary

PR-14..PR-17 sonrasında Runa chat yüzeyi okunabilirlik, activity transparency ve markdown/empty-state kalitesinde net şekilde güçlenmiş durumda. Özellikle activity feed (PR-14/15), markdown güvenliği/semantiği (PR-16) ve personalized empty state (PR-17) rakip-kalite ilkelerine yaklaşımı belirgin artırıyor.

En güçlü alanlar:
- Activity feed + inline approval akışı (progressive disclosure ve teknik detay izolasyonu).
- Markdown rendering güvenliği ve mobil overflow dayanımı.
- Empty state kişiselleştirme + düşük bilişsel yük.

En zayıf alanlar:
- Message actions (assistant copy, user edit/retry, regenerate) eksik.
- Voice/upload/history/settings/error recovery yüzeylerinde rakip-kalite polish ve recovery depth tutarsız.
- Uçtan uca browser smoke coverage, özellikle secondary surfaces ve hata toparlama akışlarında parçalı.

Önerilen ilk 3 PR:
1. `PR-19-MESSAGE-ACTIONS-AND-RETRY-LOOP`
2. `PR-20-VOICE-UPLOAD-RECOVERY-AND-MOBILE-ERGONOMICS`
3. `PR-21-HISTORY-SETTINGS-ERROR-RECOVERY-COHERENCE`

## Methodology

- Okunan kaynaklar:
  - `docs/PROGRESS.md`
  - `docs/design/ui-restructure/PR-13-COMPETITOR-GAP-AUDIT.md`
  - PR-14/15/16/17 kapsamında belirtilen chat/activity/markdown/empty-state dosyaları
  - Composer, voice, upload, history, settings, onboarding, app-shell dosyaları
  - Test ve visual smoke dosyaları (`design-language-lock`, `CopyVoicePass`, `OperatorDeveloperIsolation`, `apps/web/tests/visual/*`)
  - Referans UI artifact HTML’leri (`docs/design/artifacts/*.html`)
- Çalıştırılan komutlar:
  - `pnpm.cmd --filter @runa/web typecheck` PASS
  - `pnpm.cmd --filter @runa/server typecheck` PASS
  - `pnpm.cmd --filter @runa/web test` PASS (`46` dosya, `279` test PASS, `1` skipped)
  - `pnpm.cmd exec playwright test apps/web/tests/visual/ui-overhaul-17-empty-state-smoke.spec.ts --config playwright.config.ts --workers=1` PASS (`2` test)
  - `pnpm.cmd exec playwright test apps/web/tests/visual/ui-overhaul-16-markdown-rendering-smoke.spec.ts --config playwright.config.ts --workers=1` ilk deneme FAIL (`Port 4173 is already in use`), rerun PASS (`2` test)
- Browser/smoke gözlemi:
  - Playwright fixture/smoke ile markdown (16) ve empty-state (17) akışları gözlemlendi.
  - Gerçek auth/session + tam canlı chat run akışı bu audit’te tam E2E olarak yeniden koşulmadı.
- Gözlemlenemeyen akışlar ve neden:
  - Approval pending/resolved canlı runtime akışının bu PR’da tekrar browser E2E koşturulması yapılmadı (artifact yazan mevcut smoke’lara dokunmadan audit-only sınırı korundu).
  - Live voice permission/device-level varyasyonları gerçek cihaz/browser kombinasyonlarında yeniden doğrulanmadı.
- Audit sınırları:
  - Rakip ürünler için doğrulanamayan spesifik davranış iddiası kullanılmadı.
  - Değerlendirme yalnızca repo kodu, testler, mevcut smoke’lar ve yerel çalıştırılan komut kanıtlarına dayalıdır.

## Current-state inventory

### 1. First-run / empty state
- Mevcut davranış: Saat bazlı selamlama, proje adı/device/conversation chip’leri, 4 öneri kartı.
- Kanıt: `apps/web/src/components/chat/EmptyState.tsx`, `apps/web/src/components/chat/emptyStateModel.ts`, `apps/web/tests/visual/ui-overhaul-17-empty-state-smoke.spec.ts`
- Güçlü taraf: Düşük bilişsel yük, kişiselleştirme, mobil overflow koruması.
- Eksik taraf: Öneriler statik; geçmiş davranış/son görev bağlamına göre adaptif değil.

### 2. Composer
- Mevcut davranış: Tek textarea, attach + more-tools disclosure, send/stop dönüşümü.
- Kanıt: `apps/web/src/components/chat/ChatComposerSurface.tsx`
- Güçlü taraf: Stop affordance mevcut, kısa ve sakin yüzey.
- Eksik taraf: Message-level retry/edit akışı composer seviyesinde bağlı değil.

### 3. Message rendering
- Mevcut davranış: Persisted transcript + streaming surface; assistant mark var.
- Kanıt: `apps/web/src/components/chat/PersistedTranscript.tsx`, `apps/web/src/components/chat/StreamingMessageSurface.tsx`
- Güçlü taraf: Okunabilir lineer akış.
- Eksik taraf: Assistant/user message actions (copy/edit/retry/regenerate) yok.

### 4. Markdown rendering
- Mevcut davranış: Streamdown semantic component map, safe link policy, code/mermaid/table wrappers.
- Kanıt: `apps/web/src/lib/streamdown/StreamdownMessage.tsx`, `markdownLinks.ts`, `CodeBlock.tsx`, `MermaidBlock.tsx`
- Güçlü taraf: Güvenlik ve semantik kalite önceki audit’e göre belirgin güçlü.
- Eksik taraf: Uzun içeriklerde advanced controls (örn. message-level collapse stratejisi) sınırlı.

### 5. Run activity feed
- Mevcut davranış: Timeline/tool/approval birleşik feed; row status ve detail toggle.
- Kanıt: `apps/web/src/components/chat/activity/runActivityAdapter.ts`, `RunActivityFeed.tsx`, `RunActivityRow.tsx`
- Güçlü taraf: Tool transparency ve progressive disclosure dengeli.
- Eksik taraf: Canlı runtime browse kanıtı bu audit turunda sınırlı.

### 6. Inline approval
- Mevcut davranış: Pending/resolved durumları feed içinde; risk etiketi + CTA.
- Kanıt: `apps/web/src/components/chat/activity/ApprovalActivityRow.tsx`, `apps/web/src/components/chat/blocks/ApprovalBlock.tsx`, `apps/web/tests/visual/ui-overhaul-07-3-smoke.spec.ts` (mevcut kanıt)
- Güçlü taraf: Karar noktası chat içinde net.
- Eksik taraf: High-risk açıklama derinliği ve kullanıcıya risk tradeoff anlatımı sınırlı.

### 7. Terminal/tool details
- Mevcut davranış: Command/stdout/stderr/preview section, truncation, copy, redaction.
- Kanıt: `apps/web/src/components/chat/activity/TerminalDetails.tsx`, `terminalOutput.ts`
- Güçlü taraf: Teknik detaylar varsayılan kapalı, redaction mevcut.
- Eksik taraf: Büyük çıktılarda keşif/arama gibi ileri okunabilirlik araçları yok.

### 8. File upload
- Mevcut davranış: Preflight validation, type/size limit, upload error + remove attachment.
- Kanıt: `apps/web/src/components/chat/FileUploadButton.tsx`, `ChatComposerSurface.tsx`
- Güçlü taraf: Güvenlik odaklı dosya tip/uzantı filtreleri.
- Eksik taraf: Retry/progress/queue gibi recovery UX sınırlı.

### 9. Voice input/output
- Mevcut davranış: Toggle listen, TTS read/stop, hata mesajları.
- Kanıt: `apps/web/src/components/chat/VoiceComposerControls.tsx`, `apps/web/src/hooks/useVoiceInput.ts`, `useTextToSpeechIntegration.ts`
- Güçlü taraf: Permission/error mesajları var.
- Eksik taraf: `recognition.lang = 'tr-TR'` sabit; state depth (listening denied unavailable) sınırlı görünür.

### 10. History / conversation switching
- Mevcut davranış: Sidebar + History page, arama ve tarih gruplama.
- Kanıt: `ConversationSidebar.tsx`, `HistorySheet.tsx`, `HistoryPage.tsx`
- Güçlü taraf: Conversation erişimi temel olarak çalışıyor.
- Eksik taraf: Sidebar/Page grouping ve yüklenme/recovery dili tutarlılığı zayıf.

### 11. Settings
- Mevcut davranış: Appearance/Conversation/Notifications/Privacy/Advanced tabları.
- Kanıt: `apps/web/src/pages/SettingsPage.tsx`
- Güçlü taraf: Basit IA, runtime-affecting ayarlar erişilebilir.
- Eksik taraf: Menüden `/account?tab=preferences` yönlendirmesi geçersiz tab değerine düşüyor.

### 12. Onboarding
- Mevcut davranış: 3 adımlı wizard, skip/back, prompt quick-start.
- Kanıt: `apps/web/src/components/onboarding/OnboardingWizard.tsx`
- Güçlü taraf: İlk giriş bariyeri düşük.
- Eksik taraf: Auth/device/session gerçek bağlamı ile daha kuvvetli bağ kurulmamış.

### 13. Error/toast/recovery
- Mevcut davranış: Transport retry banner, local alerts, toast provider altyapısı.
- Kanıt: `apps/web/src/lib/transport/errors.tsx`, `apps/web/src/components/ui/RunaToast.tsx`, `apps/web/src/App.tsx`
- Güçlü taraf: Retry affordance var, toast altyapısı mevcut.
- Eksik taraf: App-level ErrorBoundary yok; toast kullanım kapsamı dar (çoğunlukla MenuSheet “yakında”).

### 14. Mobile 320/390
- Mevcut davranış: Markdown ve empty-state smoke’ları 320/390’da overflow guard içeriyor.
- Kanıt: `ui-overhaul-16-markdown-rendering-smoke.spec.ts`, `ui-overhaul-17-empty-state-smoke.spec.ts`
- Güçlü taraf: İki kritik yüzeyde mobil taşma guard’ı doğrulanmış.
- Eksik taraf: Voice/upload/history/settings için eşdeğer mobil smoke kapsamı zayıf.

### 15. Accessibility / keyboard
- Mevcut davranış: Birçok button/section için aria label, polite live region, reduced-motion guard var.
- Kanıt: `ChatComposerSurface.tsx`, `RunActivityFeed.tsx`, `RunaSheet.tsx`, `design-language-lock.test.ts`
- Güçlü taraf: Temel a11y niyeti kodda görünür.
- Eksik taraf: Sheet/modal semantics (`role="dialog"`, `aria-modal`) ve focus management daha sıkı olabilir.

### 16. Developer Mode isolation
- Mevcut davranış: Developer route gate + normal yüzeyden izolasyon testleri mevcut.
- Kanıt: `AuthenticatedApp.tsx`, `OperatorDeveloperIsolation.test.tsx`, `ui-overhaul-07-4-isolation.spec.ts`
- Güçlü taraf: Normal kullanıcı yüzeyine debug leakage engelleniyor.
- Eksik taraf: Bazı yardımcı metin/route senaryolarında izleme kapsamı test odaklı; canlı audit kapsamı dar.

### 17. Visual/design consistency
- Mevcut davranış: Activity/markdown/empty-state yeni dilde daha yakın; ancak geniş `components.css` içinde eski/migrated sınıf yükü sürüyor.
- Kanıt: `apps/web/src/styles/components.css`
- Güçlü taraf: Ana chat akışı sadeleşmiş.
- Eksik taraf: Stil katmanı karmaşıklığı uzun vadeli tutarlılığı zorlayabilir.

### 18. Test coverage
- Mevcut davranış: güçlü unit + lock test + seçili visual smoke.
- Kanıt: `apps/web/src/test/design-language-lock.test.ts`, `CopyVoicePass.test.tsx`, `OperatorDeveloperIsolation.test.tsx`, `apps/web/tests/visual/*`
- Güçlü taraf: Kod/contract regressions için iyi temel.
- Eksik taraf: Message actions/voice-upload recovery/history-settings coherence için E2E/visual coverage eksik.

## Findings

P0 = merge/blocker severity, kullanıcı akışını ciddi kırar  
P1 = yüksek etki, rakip-kalite farkı yaratır  
P2 = orta etki, polish/coverage/consistency  
P3 = düşük etki veya backlog notu

### F-01 — Message actions eksik (copy/edit/retry/regenerate)
Severity: P1  
Area: Transcript / Composer
Evidence:
- `apps/web/src/components/chat/PersistedTranscript.tsx`
- `apps/web/src/components/chat/StreamingMessageSurface.tsx`
- `apps/web/src/components/chat/ChatComposerSurface.tsx`
Current behavior:
- Mesaj gövdeleri render ediliyor ancak message-level action bar yok.
Competitor-quality gap:
- Consumer-first chat ürünlerinde “copy / retry / edit prompt / regenerate” kısa döngüyü hızlandırır; burada döngü uzuyor.
Recommended PR:
- `PR-19-MESSAGE-ACTIONS-AND-RETRY-LOOP`
Acceptance criteria:
- Assistant mesajında copy + regenerate.
- User mesajında edit + resend.
- Son yanıt için “retry with same context” affordance.
Risks:
- Yanlış scope ile runtime/protocol’e taşma riski.
Suggested tests:
- `PersistedTranscript` action render unit testleri.
- Mobile/desktop visual smoke: action bar görünürlüğü.

### F-02 — Voice composer state modeli yüzeyde sığ
Severity: P1  
Area: Voice
Evidence:
- `apps/web/src/hooks/useVoiceInput.ts`
- `apps/web/src/components/chat/VoiceComposerControls.tsx`
Current behavior:
- `isListening` + temel hata metinleri var; `recognition.lang = 'tr-TR'` sabit.
Competitor-quality gap:
- Permission denied/unavailable/listening/error geçişleri görünür ve kullanıcıya yönlendirici olmalı; dil/esneklik düşük.
Recommended PR:
- `PR-20-VOICE-UPLOAD-RECOVERY-AND-MOBILE-ERGONOMICS`
Acceptance criteria:
- Voice durumları açık state modeline bağlansın.
- Dil ayarı settings ile bağlanabilsin.
- Permission denied için açık recovery CTA sunulsun.
Risks:
- Tarayıcı API farklılıklarında regressions.
Suggested tests:
- `useVoiceInput` durum geçiş birim testleri.
- Mobile voice control visual smoke.

### F-03 — Upload recovery derinliği düşük
Severity: P1  
Area: File upload
Evidence:
- `apps/web/src/components/chat/FileUploadButton.tsx`
- `apps/web/src/components/chat/ChatComposerSurface.tsx`
Current behavior:
- Preflight ve hata metni var; upload sırasında tek satır metin ve remove var.
Competitor-quality gap:
- Başarısız upload sonrası hızlı retry/queue/progress hissi sınırlı.
Recommended PR:
- `PR-20-VOICE-UPLOAD-RECOVERY-AND-MOBILE-ERGONOMICS`
Acceptance criteria:
- Uploading/failed/success durumları ayrık görünmeli.
- Tek tık retry + attachment bazlı hata görünmeli.
- Mobilde attachment preview taşma testi eklenmeli.
Risks:
- Upload state karmaşıklığı composer sade yüzeyi bozabilir.
Suggested tests:
- Upload failure/retry component testleri.
- 320/390 attachment overflow visual smoke.

### F-04 — History yüzeyi tutarlılık borcu (sidebar vs history page)
Severity: P1  
Area: History / Conversation switching
Evidence:
- `apps/web/src/components/chat/ConversationSidebar.tsx`
- `apps/web/src/pages/HistoryPage.tsx`
Current behavior:
- Sidebar ve HistoryPage farklı grouping/loading/recovery davranışları kullanıyor.
Competitor-quality gap:
- Aynı veri için farklı davranış kullanıcı güvenini azaltır.
Recommended PR:
- `PR-21-HISTORY-SETTINGS-ERROR-RECOVERY-COHERENCE`
Acceptance criteria:
- Ortak grouping ve loading/recovery kopyası.
- “empty / filtered-empty / error” davranışları eşlenmeli.
Risks:
- Shared abstraction gereksiz büyürse scope taşar.
Suggested tests:
- HistoryRoute + Sidebar parity tests.
- Secondary surfaces visual regression.

### F-05 — Settings deep-link uyumsuzluğu (`tab=preferences`)
Severity: P1  
Area: Settings / Navigation
Evidence:
- `apps/web/src/components/app/MenuSheet.tsx`
- `apps/web/src/pages/SettingsPage.tsx`
Current behavior:
- MenuSheet `navigate('/account?tab=preferences')` gönderiyor; `parseSettingsTab` bunu tanımıyor.
Competitor-quality gap:
- Navigasyon niyeti ve sonuç uyuşmuyor; kullanıcı yanlış bölüme düşüyor.
Recommended PR:
- `PR-21-HISTORY-SETTINGS-ERROR-RECOVERY-COHERENCE`
Acceptance criteria:
- Menüden ayarlar tıklaması doğru tabı açmalı.
- Geçersiz tab değerleri için normalize/fallback kuralı açık olmalı.
Risks:
- Geriye dönük URL davranışında küçük kırılma riski.
Suggested tests:
- URL tab parsing unit testleri.
- MenuSheet navigation integration test.

### F-06 — App-level ErrorBoundary yok, toast kapsamı dar
Severity: P1  
Area: Error / Recovery
Evidence:
- `apps/web/src/App.tsx`
- `apps/web/src/components/ui/RunaToast.tsx`
- `apps/web/src/components/app/MenuSheet.tsx`
Current behavior:
- Toast provider root’ta var; fakat kullanıcıya işlevsel recovery bildirimleri sınırlı.
- `ErrorBoundary` bileşeni bulunmuyor.
Competitor-quality gap:
- Beklenmeyen runtime hatasında kullanıcı “beyaz ekran” riskiyle kalabilir.
Recommended PR:
- `PR-21-HISTORY-SETTINGS-ERROR-RECOVERY-COHERENCE`
Acceptance criteria:
- Global ErrorBoundary + kullanıcı dilinde fallback + retry path.
- Toast altyapısı kritik başarı/hata akışlarına bağlansın.
Risks:
- Aşırı toast gürültüsü.
Suggested tests:
- Error boundary render/fallback unit test.
- Transport + runtime error UX smoke.

### F-07 — Sheet/dialog a11y semantiği güçlendirilmeli
Severity: P2  
Area: Accessibility
Evidence:
- `apps/web/src/components/ui/RunaSheet.tsx`
- `apps/web/src/components/chat/HistorySheet.tsx`
- `apps/web/src/components/chat/ContextSheet.tsx`
Current behavior:
- Escape/backdrop close var; ancak dialog-role/modal semantics net değil.
Competitor-quality gap:
- Screen reader ve klavye kullanıcıları için modal davranış netliği düşebilir.
Recommended PR:
- `PR-22-A11Y-SHEET-AND-FOCUS-HARDENING`
Acceptance criteria:
- Sheet yüzeylerinde `role="dialog"` + `aria-modal`.
- Açılışta focus initial target’e taşınmalı, kapanışta tetikleyiciye dönmeli.
Risks:
- Mevcut sheet davranışıyla odak çakışmaları.
Suggested tests:
- Keyboard tab order tests.
- Accessibility snapshot checks.

### F-08 — Empty state iyi ama adaptif öneri motoru yok
Severity: P2  
Area: Empty state / First-use
Evidence:
- `apps/web/src/components/chat/emptyStateModel.ts`
- `apps/web/src/components/onboarding/OnboardingWizard.tsx`
Current behavior:
- Kişiselleştirme var; suggestion set statik.
Competitor-quality gap:
- Kullanıcının son aktivitesine göre “next best action” üretilmiyor.
Recommended PR:
- `PR-23-EMPTY-STATE-NEXT-BEST-ACTION`
Acceptance criteria:
- Son konuşma/tarihçe sinyaline göre 1-2 öneri dinamikleşsin.
- Statik öneriler fallback olarak korunsun.
Risks:
- Yanlış öneri üretimi güveni düşürür.
Suggested tests:
- Model derivation unit tests (history/context varyantları).

### F-09 — Visual consistency bakım riski (tek dev CSS yüzeyi)
Severity: P2  
Area: Visual/design consistency
Evidence:
- `apps/web/src/styles/components.css`
Current behavior:
- Geniş, çok amaçlı, migration artıklarını taşıyan tek büyük stil yüzeyi.
Competitor-quality gap:
- Hızlı iterasyonda tutarlılık ve öngörülebilirlik düşebilir.
Recommended PR:
- `PR-24-CSS-SURFACE-GOVERNANCE-LIGHTWEIGHT`
Acceptance criteria:
- Chat-critical sınıflar ve route-migration sınıfları net ayrışsın.
- Design lock testleri bozulmadan küçük parçalı temizlik yapılsın.
Risks:
- Stil regresyonu.
Suggested tests:
- Design-language lock + visual smoke rerun.

### F-10 — Testability gap: kritik consumer akışlarında visual/E2E boşlukları
Severity: P1  
Area: Test coverage
Evidence:
- `apps/web/tests/visual/ui-overhaul-16-markdown-rendering-smoke.spec.ts`
- `apps/web/tests/visual/ui-overhaul-17-empty-state-smoke.spec.ts`
- `apps/web/src/pages/CopyVoicePass.test.tsx`
Current behavior:
- 16/17 ve bazı legacy smokes mevcut; message actions/voice-upload/history-settings-error recovery için coverage sınırlı.
Competitor-quality gap:
- Rakip-kalite polish çalışmalarının regresyon güvenliği zayıf kalır.
Recommended PR:
- `PR-25-CONSUMER-FLOW-VISUAL-SMOKE-EXPANSION`
Acceptance criteria:
- Voice/upload/error/history/settings/message-actions için minimal smoke set.
- 320/390 + desktop kritik akışları.
Risks:
- Flaky smoke test artışı.
Suggested tests:
- Stabil fixture-first smoke yaklaşımı, deterministic clock/data.

## Proposed Next PRs

### PR-19 — Message Actions and Retry Loop
Goal:
- Transcript üzerinde hızlı copy/edit/retry/regenerate döngüsünü eklemek.
Scope:
- `apps/web/src/components/chat/PersistedTranscript.tsx`
- `apps/web/src/components/chat/StreamingMessageSurface.tsx`
- action bileşenleri (chat component seam içinde)
Out of scope:
- Backend protocol değişikliği, model policy değişikliği.
Acceptance:
- Assistant ve user mesajları için tanımlı action set.
- Mobile/desktop erişilebilir action affordance.
Tests:
- Unit + visual smoke.
Risk:
- Action yoğunluğu yüzeyi kalabalıklaştırabilir.
Depends on:
- Yok.

### PR-20 — Voice/Upload Recovery and Mobile Ergonomics
Goal:
- Voice ve upload akışlarını failure/recovery odaklı olgunlaştırmak.
Scope:
- `useVoiceInput.ts`, `VoiceComposerControls.tsx`, `FileUploadButton.tsx`, `ChatComposerSurface.tsx`
Out of scope:
- Yeni medya backend’i, provider-level speech servis değişikliği.
Acceptance:
- Voice state matrix görünür.
- Upload retry + attachment bazlı hata yönetimi.
- 320/390 ergonomi doğrulaması.
Tests:
- Hook/component tests + targeted visual smoke.
Risk:
- Browser API farklılıkları.
Depends on:
- Yok.

### PR-21 — History/Settings/Error Recovery Coherence
Goal:
- Secondary surface güvenini artırmak: history/settings/error davranış tutarlılığı.
Scope:
- `HistoryPage.tsx`, `ConversationSidebar.tsx`, `MenuSheet.tsx`, `SettingsPage.tsx`, `App.tsx` (ErrorBoundary integration)
Out of scope:
- Büyük IA redesign.
Acceptance:
- `tab=preferences` deep-link sorunu kapanır.
- History empty/loading/error dili ve grouping parity.
- Global error fallback + retry path.
Tests:
- Integration/unit + secondary-surface smoke.
Risk:
- Çok dosyalı PR’da scope büyümesi.
Depends on:
- Yok.

## Candidate backlog (priority sonrası)

### PR-22 — A11Y Sheet and Focus Hardening
Goal:
- Sheet/dialog semantics ve focus akışını güçlendirmek.
Scope:
- `RunaSheet.tsx` ve kullanan sheet bileşenleri.
Out of scope:
- Tam uygulama a11y redesign.
Acceptance:
- Dialog semantics + focus return.
Tests:
- Keyboard/focus tests.
Risk:
- Davranış regressions.
Depends on:
- PR-21 sonrası daha güvenli.

### PR-23 — Empty State Next-Best-Action
Goal:
- Empty state önerilerini son kullanım bağlamına göre adaptif yapmak.
Scope:
- `emptyStateModel.ts`, onboarding bağlamı entegrasyonu.
Out of scope:
- Yeni recommendation backend.
Acceptance:
- Adaptif + fallback öneri seti.
Tests:
- Model derivation tests.
Risk:
- Yanlış kişiselleştirme.
Depends on:
- PR-19 sonrası action telemetry daha faydalı olur.

### PR-24 — CSS Surface Governance Lightweight
Goal:
- Stil yüzeyindeki bakım riskini azaltmak (büyük refactor olmadan).
Scope:
- `components.css` içinde chat-critical vs migrated ayrımı.
Out of scope:
- Design system rewrite.
Acceptance:
- Düzenlenmiş sınıf sahipliği, lock testleri yeşil.
Tests:
- Design lock + visual smoke.
Risk:
- Stil regresyonu.
Depends on:
- Yok.

### PR-25 — Consumer Flow Visual Smoke Expansion
Goal:
- Kritik consumer akışları için güvenilir smoke setini genişletmek.
Scope:
- `apps/web/tests/visual/*` yeni fixture/smoke dosyaları.
Out of scope:
- Product behavior değişikliği.
Acceptance:
- Voice/upload/history/settings/error/message-actions için smoke.
Tests:
- Playwright smoke.
Risk:
- Flakiness.
Depends on:
- PR-19/20/21 çıktıları.

## Priority rationale

- İlk üç PR, kullanıcı güvenini ve günlük kullanım döngüsünü en hızlı etkileyen boşlukları kapatır.
- Sonraki adaylar (a11y/css/smoke expansion) kaliteyi kalıcılaştırır ve regression riskini düşürür.

## What not to do

- Büyük tek-parça “UI rewrite” PR açma; küçük, tek hedefli PR disiplini korunmalı.
- Activity feed + markdown + empty-state’te kapanmış PR-14..17 kontratlarını kıracak redesign yapma.
- Developer mode ve normal kullanıcı yüzeyini yeniden karıştırma.
- Test coverage açığını “manuel gözle gördük” yaklaşımıyla kapatma; fixture-first smoke şart.
- Sadece token/CSS temizliği yapıp kullanıcı akışı problemlerini erteleme.
- Rakip davranışı doğrulanmadan “rakipte böyle” iddiasıyla karar alma.

Önce evidence gereken alanlar:
- Voice permission/device matrix’in gerçek cihaz-browser varyasyonları.
- Upload failure senaryolarında kullanıcı davranışı (retry/drop-off).
- Message action setinin gerçek kullanım sıklığı.

## Final recommendation

Sonraki PR şu olmalı: **PR-19 — Message Actions and Retry Loop**.

Neden:
- Günlük kullanım hızını ve kullanıcı güvenini en hızlı artıran boşluk bu.
- PR-20 ve PR-21’in etkisini de güçlendirir (voice/upload/history hata döngülerinde kullanıcıya daha net kontrol verir).

Başarı kriteri:
- Kullanıcı bir mesajı tekrar denemek, düzenlemek, kopyalamak veya yanıtı yeniden üretmek için chat akışından çıkmadan işlemi tamamlayabilmeli; mobil ve desktopta bu aksiyonlar erişilebilir olmalı.
