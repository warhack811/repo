# UI-OVERHAUL-07.9 - Final Coherence Audit & Design Language Lock Uygulama Promptu

Bu prompt, `docs/UI-OVERHAUL-07.md` icindeki gercek `7.9 - Final Coherence Audit & Design Language Lock` gorevini uygulamak icindir. Amac yeni ozellik eklemek degil; UI-OVERHAUL-07 boyunca toparlanan chat-first, trust-first, dark consumer-grade Runa dilini kanitlamak, belgelemek ve sonraki UI isleri icin guardrail haline getirmektir.

Tahmin yapma. Once repo icindeki gercek yuzeyleri, mevcut testleri ve onceki UI-OVERHAUL-07 kayitlarini oku. Sonra final audit ve design-language lock isini dar, kanitli ve tekrar calistirilabilir sekilde uygula.

## Source Of Truth

Ana kaynaklar:

- `docs/UI-OVERHAUL-07.md`
- Ilgili bolum: `7.9 - Final Coherence Audit & Design Language Lock`
- `docs/PROGRESS.md`
- Onceki UI-OVERHAUL-07 promptlari:
  - `docs/UI-OVERHAUL-07-APPROVAL-UX-STATE-FEEDBACK-PROMPT.md`
  - `docs/UI-OVERHAUL-07-4-OPERATOR-DEVELOPER-HARD-ISOLATION-PROMPT.md`
  - `docs/UI-OVERHAUL-07-5-SECONDARY-SURFACES-REFRAME-PROMPT.md`

Onceki tamamlanan paketlerden korunmasi gerekenler:

- 7.1: first impression ve internal/debug leak cleanup.
- 7.2: chat-first composer ve surface reset.
- 7.3: approval trust-first card/state feedback.
- 7.4: operator/developer hard isolation.
- 7.5: secondary surfaces reframe.
- 7.6: visual discipline.
- 7.7: copy voice pass ve Turkce urun sesi.
- 7.8: command palette, keyboard/focus/mobile/loading polish.

## Urun Hedefi

Final audit sonunda Runa su hissi tasimali:

> Sakin, koyu, chat-first ve guvenilir bir AI calisma ortagi; klavyeyle hizli kullanilir, mobilde bozulmaz, onay isteyen yerde net durur, teknik karmasayi normal kullanicidan uzak tutar.

Bu gorev yeni ozellik ekleme gorevi degildir. Faz kapanis kaniti ve uzun vadeli tasarim/copy guardrail gorevidir.

## Ana Teslimatlar

1. 28 ekranlik final screenshot/audit seti.
2. Final coherence audit ozeti.
3. `docs/RUNA-DESIGN-LANGUAGE.md` design language lock.
4. Gelecek UI task'lari icin design/copy checklist.
5. Visual/test guardrail'lerinin final duruma gore hizalanmasi.
6. `docs/PROGRESS.md` icinde 7.9 kapanis kaydi.

## Mutlak Kapsam Disi

Bu gorevde sunlari yapma:

- Yeni feature ekleme.
- Chat runtime, approval backend, auth, websocket, provider, desktop-agent veya persistence contract degistirme.
- Yeni dependency ekleme.
- 7.8 command palette veya composer davranisini yeniden tasarlama; yalnizca final audit blocker'i varsa dar fix yap.
- Developer/capability preview yuzeylerini normal nav'a geri koyma.
- Project Memory gibi hazir olmayan yuzeyleri normal kullanici akisine acma.
- Buyuk CSS refactor veya design system primitive rewrite yapma.
- Screenshot uretmek icin app icine test-only/fake user-facing data koyma.

## Normal User Surface Forbidden Copy

Normal kullanici yuzeylerinde su terimler gorunmemeli:

- `Developer Mode`
- `developer`
- `operator`
- `runtime`
- `transport`
- `raw`
- `debug`
- `troubleshooting`
- `metadata`
- `Web Speech API`
- `Project Memory`
- `Capability Preview`
- `dev@runa.local`
- `Connection `
- raw desktop tool name, ornegin `desktop.screenshot`
- `burada kalir`
- `burada gorunur`
- `bu fazda`
- `dogrulanmis evet`
- TR/EN karisik user-facing copy

Developer-only route, internal QA preview veya test source icinde bu terimler kalabilir. Final audit bunu normal user route'lari ve clean session uzerinden ayirmali.

## Once Okunacak Dosyalar

Plan ve progress:

- `docs/UI-OVERHAUL-07.md`
- `docs/PROGRESS.md`

Ana app yuzeyleri:

- `apps/web/src/App.tsx`
- `apps/web/src/AuthenticatedApp.tsx`
- `apps/web/src/components/app/AppShell.tsx`
- `apps/web/src/components/app/AppNav.tsx`
- `apps/web/src/components/command/CommandPalette.tsx`
- `apps/web/src/pages/ChatRuntimePage.tsx`
- `apps/web/src/pages/ChatPage.tsx`
- `apps/web/src/pages/HistoryPage.tsx`
- `apps/web/src/pages/HistoryRoute.tsx`
- `apps/web/src/pages/DevicesPage.tsx`
- `apps/web/src/pages/SettingsPage.tsx`
- `apps/web/src/pages/LoginPage.tsx`

Chat/composer/approval:

- `apps/web/src/components/chat/ChatHeader.tsx`
- `apps/web/src/components/chat/ChatLayout.tsx`
- `apps/web/src/components/chat/ChatComposerSurface.tsx`
- `apps/web/src/components/chat/ConversationSidebar.tsx`
- `apps/web/src/components/chat/DesktopTargetSelector.tsx`
- `apps/web/src/components/chat/FileUploadButton.tsx`
- `apps/web/src/components/chat/VoiceComposerControls.tsx`
- `apps/web/src/components/chat/blocks/ApprovalBlock.tsx`

Secondary/component primitives:

- `apps/web/src/components/desktop/DevicePresencePanel.tsx`
- `apps/web/src/components/auth/ProfileCard.tsx`
- `apps/web/src/components/ui/`
- `apps/web/src/localization/copy.ts`

Styles:

- `apps/web/src/styles/components.css`
- `apps/web/src/styles/tokens.css`
- `apps/web/src/styles/routes/app-shell-migration.css`
- `apps/web/src/styles/routes/chat-migration.css`
- `apps/web/src/styles/routes/history-migration.css`
- `apps/web/src/styles/routes/devices-migration.css`
- `apps/web/src/styles/routes/desktop-device-presence-migration.css`
- `apps/web/src/styles/routes/settings-migration.css`
- `apps/web/src/styles/routes/login-migration.css`

Mevcut guardrail/test patternleri:

- `apps/web/src/components/chat/ChatFirstShell.test.tsx`
- `apps/web/src/pages/OperatorDeveloperIsolation.test.tsx`
- `apps/web/src/pages/SecondarySurfacesReframe.test.tsx`
- `apps/web/src/pages/VisualDiscipline.test.tsx`
- `apps/web/src/pages/CopyVoicePass.test.tsx`
- `apps/web/src/components/command/CommandPalette.test.tsx`
- `apps/web/tests/visual/ui-overhaul-07-5-secondary-surfaces.spec.ts`
- `apps/web/tests/visual/ui-overhaul-07-6-visual-discipline.spec.ts`
- `apps/web/tests/visual/chat-responsive.spec.ts`

## Uygulama Adimlari

### 1. Baseline Final Audit Haritasi

Kod degistirmeden once:

- `docs/UI-OVERHAUL-07.md` icindeki 7.1-7.9 hedeflerini oku.
- `docs/PROGRESS.md` icindeki 7.1-7.8 kayitlarini tara.
- Mevcut testlerin hangi yuzeyleri kilitledigini not et.
- User-facing route'larda forbidden copy aramasi yap.
- CSS tarafinda gradient/orb/card-in-card/type scale/focus/loading/mobile overflow risklerini tara.

Beklenen ara sonuc:

- Hangi route'lar screenshotlanacak.
- Hangi viewport'lar kullanilacak.
- Hangi audit kontrolleri otomatik assertion olacak.
- Hangi eksikler varsa dar fix gerektiriyor.

### 2. Final Screenshot Seti

28 ekranlik final screenshot seti uret.

Klasor:

```text
docs/design-audit/screenshots/2026-04-30-ui-overhaul-07-9-final-coherence/
```

Minimum ekran listesi:

Desktop `1440x900`:

- `/login`
- `/chat` empty
- `/chat` active transcript/current work
- `/chat` approval pending
- `/chat` approval approved/completed
- `/history`
- `/devices`
- `/account`
- `/account?tab=preferences`
- command palette open
- conversation sidebar open
- mobile-equivalent fallback veya route loading skeleton fixture

Desktop wide `1920x1080`:

- `/chat` empty
- `/chat` active/approval
- `/history`
- `/devices`

Tablet `768x1024`:

- `/chat`
- `/history`
- `/devices`
- `/account`

Mobile `390x844`:

- `/login`
- `/chat` empty
- `/chat` composer focused
- `/chat` approval pending
- `/history`
- `/devices`
- `/account`
- command palette open

Mobile narrow `320x568`:

- `/chat` composer focused
- `/chat` approval pending
- `/history` veya `/devices`

Bu liste 28 ekran hedefini karsilayacak sekilde gerekiyorsa genisletilebilir. Her screenshot icin:

- Yatay overflow olmamali.
- Text overlap olmamali.
- Header/nav/composer/action controls gorunur ve tiklanabilir olmali.
- Normal surface forbidden copy tasimamali.
- Skeleton/loading state varsa layout shift riski olusturmamali.

Screenshot manifest'i uret:

```text
docs/design-audit/screenshots/2026-04-30-ui-overhaul-07-9-final-coherence/manifest.json
```

Manifest en az sunlari icersin:

- screenshot file path
- route
- viewport
- scenario
- automated checks
- failed checks
- notes

### 3. Browser Audit Spec

Mevcut Playwright patternlerini kullanarak final audit spec ekle.

Onerilen dosya:

```text
apps/web/tests/visual/ui-overhaul-07-9-final-coherence.spec.ts
```

Spec sunlari dogrulamali:

- `/login`, `/chat`, `/history`, `/devices`, `/account` clean session yuzeyleri render olur.
- Normal user routes forbidden copy tasimaz.
- `/developer*` normal route/nav icinden gorunmez.
- Command palette acik durumda route/action komutlari render olur ve forbidden copy tasimaz.
- Mobile nav tek satir kalir.
- Mobile chat composer focus halinde yatay overflow uretmez.
- Approval pending action buttons mobile'da viewport ve composer tarafindan ortulmez.
- Route-level loading fallback skeleton kullanir veya spinner kalabaligi yoktur.
- Buttons/icon-only controls accessible name tasir.
- Focus-visible outline token uyumlu ve computed olarak gorulebilir.

Test data gerekirse:

- Network mock veya fixture kullan.
- App source icine fake user-facing placeholder koyma.
- Raw tool/connection id'leri fixture response icinde olabilir; normal UI'da maskelenmis olmasi assertion konusu olmali.

### 4. `docs/RUNA-DESIGN-LANGUAGE.md` Yaz ve Kilitle

Yeni belge yaz:

```text
docs/RUNA-DESIGN-LANGUAGE.md
```

Belge uzun manifesto degil, uygulanabilir guardrail olmali.

Zorunlu bolumler:

1. Product Feel
   - Sakin, koyu, chat-first, trust-first.
   - Normal kullanici teknik karmaşa okumaz.

2. Surface Hierarchy
   - Chat primary surface.
   - Approval trust boundary.
   - History/Devices/Account secondary surfaces.
   - Developer/internal isolation.

3. Layout Rules
   - Chat max width.
   - Composer bottom/sticky/mobile davranisi.
   - App shell/header/nav kurallari.
   - Card-within-card yasagi.

4. Color & Tone
   - Dark base.
   - Flat accent.
   - Semantic status.
   - Gradient/orb/dekoratif efekt yasagi.

5. Typography
   - `12 / 14 / 16 / 20 / 28`.
   - `400 / 500 / 600`.
   - Letter spacing `0` except small uppercase eyebrow if already established.

6. Motion & Microinteraction
   - Short, calm, functional.
   - `prefers-reduced-motion`.
   - Hover mouse-only enhancement.
   - Focus-visible is not hover.

7. Loading
   - Skeleton for route/content.
   - Spinner only tiny inline.
   - No internal loading copy.

8. Accessibility & Keyboard
   - Cmd/Ctrl+K.
   - Escape overlays.
   - Tab order visual order.
   - Icon-only buttons accessible name.

9. Mobile Rules
   - `100dvh` / safe area.
   - 320/390/414 guardrails.
   - Keyboard avoidance.
   - Bottom nav and composer clearance.

10. Copy Voice
   - Short, calm, inviting, Turkish.
   - No self-narrating strategy copy.
   - Forbidden terms list.

11. Checklist For Future UI Tasks
   - Pre-merge checklist.
   - Required tests/screenshots for riskier UI changes.

Belge repo gercegine dayanmalı. Kodda olmayan bir token/component/pattern'i zorunlu kural gibi yazma.

### 5. Guardrail Testlerini Son Duruma Hizala

Mevcut guardrail'leri bozma:

- `CopyVoicePass.test.tsx`
- `VisualDiscipline.test.tsx`
- `OperatorDeveloperIsolation.test.tsx`
- `SecondarySurfacesReframe.test.tsx`
- `CommandPalette.test.tsx`

Gerekirse bu testleri genislet:

- `docs/RUNA-DESIGN-LANGUAGE.md` varligini ve temel bolumlerini kontrol eden hafif docs test eklenebilir.
- Forbidden copy listesi `CommandPalette` ve normal shell'i de kapsayacak sekilde genisletilebilir.
- VisualDiscipline testine final design-language token kurallari eklenebilir.

Testler gereksiz brittle olmamali. Render edilen user-facing HTML ve kaynak CSS guardrail'leri yeterince sinirli tutulmali.

### 6. Dar Fix Politikasi

Final audit sirasinda sorun cikarsa:

- Sadece blocker'i duzelt.
- Yeni ozellik ekleme.
- Dokunulan dosyayi gerekceyle sinirla.
- Existing user changes'i geri alma.

Ornek dar fix'ler:

- Overflow yapan mobile text icin CSS wrap/min-width.
- Missing accessible label icin `aria-label`.
- Route fallback copy'sinde internal kelime temizligi.
- Skeleton boyutunun gercek content'e yakinlasmasi.
- Screenshot fixture mock'unda app source degil test route/mock duzeltmesi.

Ornek kapsam disi fix'ler:

- Yeni settings paneli.
- Yeni command palette command ailesi.
- Desktop-agent behavior degisikligi.
- Approval backend state machine degisikligi.
- Yeni component library/primitive.

### 7. Dogrulama Komutlari

Sirasiyla calistir:

```powershell
pnpm --filter @runa/web lint
pnpm --filter @runa/web test
pnpm --filter @runa/web typecheck
pnpm --filter @runa/web build
pnpm run style:check
pnpm run manifesto:check
```

Targeted final visual audit:

```powershell
pnpm exec playwright test apps/web/tests/visual/ui-overhaul-07-9-final-coherence.spec.ts --project=chromium
```

Riskli route/CSS degisikligi yapildiysa:

```powershell
pnpm test:e2e
```

Windows/Vite teardown loglari cikarsa exit code ve assertion sonucunu esas al. Sahte PASS yazma.

### 8. Progress Kaydi

Uygulama tamamlaninca `docs/PROGRESS.md` icine `UI-OVERHAUL-07.9 Final Coherence Audit & Design Language Lock` kaydi ekle.

Kayit sunlari icersin:

- Screenshot klasoru ve manifest.
- Hangi route/viewport/scenario'lar dogrulandi.
- `docs/RUNA-DESIGN-LANGUAGE.md` hangi guardrail'leri kilitledi.
- Hangi testler eklendi/guncellendi.
- Calisan komutlar ve sonuc.
- Kapsam disi birakilanlar.

## Kabul Kriterleri

Bu gorev ancak su kosullar saglanirsa tamamdir:

- 28 ekranlik final screenshot seti ve manifest uretilmistir.
- Normal user routes forbidden developer/operator/debug/internal copy tasimaz.
- Chat, composer, approval, history, devices, account ve command palette desktop/mobile smoke'tan gecer.
- Mobile 320/390/414 guardrail'lerinde yatay overflow, text overlap, composer/nav collision yoktur.
- Loading state'ler skeleton agirlikli ve sakin kalir.
- `docs/RUNA-DESIGN-LANGUAGE.md` repo gercegine uygun, uygulanabilir ve checklist iceren bir belge olarak yazilmistir.
- Guardrail testleri final durumu kapsar.
- Lint, test, typecheck, build, style-check ve manifesto-check temizdir ya da repo-disindan kaynaklanan blokaj net sekilde kaydedilmistir.
- `docs/PROGRESS.md` durust kanitla guncellenmistir.

## Final Rapor Formati

Uygulamayi bitiren ajan finalde kisaca sunlari raporlamali:

- Degisen ana dosyalar.
- Screenshot klasoru ve manifest.
- Design-language belgesinin kapsam ozeti.
- Yeni/guncellenen testler.
- Calisan dogrulama komutlari.
- Bilincli kapsam disi kalan konular.
