# FRONTEND MIMAR HIZALAMA GAP MATRIX (2026-05-14)

Bu belge `TASK-UI-HIZALAMA-FULL-01` icin kod-oncesi kanitli sapma listesidir.
Precedence: `RUNA-DESIGN-BRIEF` > `RUNA-DESIGN-LANGUAGE` > `PR briefs` > `HTML mock artifacts`.

## 1) Onboarding adim sayisi

- Kural/Mock Beklentisi:
  - Onboarding 3 adim (tanisma + cihaz modeli + ilk baslat) olmalidir.
  - Kaynak: `docs/design/artifacts/runa-onboarding-devices.html:405`, `docs/design/RUNA-DESIGN-BRIEF.md:693-699`
- Mevcut Davranis:
  - UI 4 adim ilerleme ve 4-step flow kullaniyor.
- Etkilenen dosya:line:
  - `apps/web/src/components/onboarding/OnboardingWizard.tsx:82-83,200`
- Cozum yaklasimi:
  - Wizard 3 step'e indirilecek; her adimda atla/guncel geri akisi korunacak.

## 2) Chat header aktif cihaz subtitle eksigi

- Kural/Mock Beklentisi:
  - Header subtitle aktif cihazi gostermeli (`MacBook Pro üzerinde`, `cevrimici · cihaz`).
  - Kaynak: `docs/design/RUNA-DESIGN-BRIEF.md:514-515`, `docs/design/artifacts/runa-onboarding-devices.html:581`
- Mevcut Davranis:
  - Header sadece baslik render ediyor, subtitle yok.
- Etkilenen dosya:line:
  - `apps/web/src/components/chat/ChatHeader.tsx:57`
- Cozum yaklasimi:
  - ChatHeader'a subtitle props + active device kaynaklama (runtime target/device listesi) eklenecek.

## 3) Transcript saat damgasi kurala aykiri

- Kural/Mock Beklentisi:
  - Normal transcriptte per-message saat damgasi gosterilmemeli; day divider kalmali.
  - Kaynak: `docs/RUNA-DESIGN-LANGUAGE.md:39-41`
- Mevcut Davranis:
  - Her mesajda `toLocaleTimeString` ile saat bastiriliyor.
- Etkilenen dosya:line:
  - `apps/web/src/components/chat/PersistedTranscript.tsx:16-17,59`
- Cozum yaklasimi:
  - Saat label kaldirilacak; day divider korunacak.

## 4) Notifications yuzu placeholder seviyesinde

- Kural/Mock Beklentisi:
  - Bildirimler gercek route/surface olmali; filtre + okundu + erteleme temel akisiyla calismali.
  - Kaynak: `docs/design/artifacts/runa-complete-product-mock.html:907-910,940-944`
- Mevcut Davranis:
  - Header/Menu/Command palette bildirim aksiyonlari sadece `Yakinda` toast'i gosteriyor.
- Etkilenen dosya:line:
  - `apps/web/src/components/chat/ChatHeader.tsx:38-39`
  - `apps/web/src/components/app/MenuSheet.tsx:41-43,102-118`
  - `apps/web/src/components/app/AppShell.tsx:162,250-251`
- Cozum yaklasimi:
  - `/notifications` route + `NotificationsPage` eklenecek.
  - Bu 3 entry noktasinin tamami route'a yonlenecek.

## 5) Notifications route yok

- Kural/Mock Beklentisi:
  - Notifications birincil secondary surface olarak route/nav ile ulasilabilir olmali.
  - Kaynak: `docs/design/artifacts/runa-complete-product-mock.html:751-753,907`
- Mevcut Davranis:
  - Authenticated routes icinde notifications path tanimli degil.
- Etkilenen dosya:line:
  - `apps/web/src/AuthenticatedApp.tsx:130-132,166-168`
- Cozum yaklasimi:
  - `Route path="notifications"` eklenecek, AppNav/AppShell aktif sayfa cozumu guncellenecek.

## 6) Settings IA mock/brief ile uyumsuz

- Kural/Mock Beklentisi:
  - Settings bilgi mimarisi: Appearance / Conversation / Notifications / Privacy / Advanced.
  - Kaynak: `docs/design/artifacts/runa-complete-product-mock.html:917,930,938,940,947,950`
- Mevcut Davranis:
  - Settings tab modeli `account|appearance|workspace`.
- Etkilenen dosya:line:
  - `apps/web/src/pages/SettingsPage.tsx:16,58-61`
- Cozum yaklasimi:
  - Tab modeli 5 alana tasinacak; mevcut account/workspace fonksiyonlari yeni IA altina dagitilacak.

## 7) Placeholder kapsam disi kalmamis

- Kural/Mock Beklentisi:
  - Sadece gercekten teslim edilmeyen alanlarda placeholder kalabilir.
- Mevcut Davranis:
  - Notifications gibi bu gorev kapsamindaki alanlarda placeholder aktif.
- Etkilenen dosya:line:
  - `apps/web/src/components/chat/ChatHeader.tsx:38-39`
  - `apps/web/src/components/app/MenuSheet.tsx:48,108,118`
- Cozum yaklasimi:
  - Notifications placeholder kaldirilacak; help/feedback placeholder task disi oldugu icin korunacak.

## 8) PR-7 cleanup borcu kapanmamis

- Kural/Mock Beklentisi:
  - Migration class borcu temizlenmis olmali.
  - Kaynak: `docs/design/ui-restructure/PR-7-CODEX-BRIEF.md:162,178`
- Mevcut Davranis:
  - `runa-migrated-components-*` / `runa-migrated-pages-*` kullanimi yaygin.
- Etkilenen dosya:line:
  - Repo tarama bulgusu: `MATCH_COUNT=204` (`apps/web/src/**/*.tsx`)
- Cozum yaklasimi:
  - Bu siniflar toplu temizlenecek, gerekli stiller dogru class/module katmanina tasinacak.

## 9) Active page modeli notifications'i icermiyor

- Kural/Mock Beklentisi:
  - Notifications app-level sayfa olarak nav/command ile uyumlu olmali.
- Mevcut Davranis:
  - `AuthenticatedPageId` seti chat/history/devices/account ile sinirli.
- Etkilenen dosya:line:
  - `apps/web/src/components/app/AppNav.tsx` (tip/nav modeli)
  - `apps/web/src/AuthenticatedApp.tsx:47-59`
- Cozum yaklasimi:
  - Page id ve nav entry genisletilecek.

## 10) Visual evidence set yeni hedef klasore uretilmemis

- Kural/Mock Beklentisi:
  - Yeni hizalama icin 2026-05-14 tarihli fresh screenshot paketi ve EVIDENCE-MAP zorunlu.
- Mevcut Davranis:
  - Yeni hedef klasor mevcut degil.
- Etkilenen dosya:line:
  - `docs/design-audit/screenshots/2026-05-14-frontend-mimar-full-alignment/` (yok)
- Cozum yaklasimi:
  - Yeni Playwright visual spec ile paket uretilecek.

---

Not: Bu matrixte belge celiskisi icin bloklayici bir durum tespit edilmedi; precedence ile cozuldu. Bu nedenle ayrica escalation dosyasi zorunlu degil.

## Uygulama Sonrasi Durum (Ayni Gun)

- 1) Onboarding 3 adim: KAPANDI
- 2) Chat header aktif cihaz subtitle: KAPANDI
- 3) Transcript per-message saat damgasi: KAPANDI
- 4) Notifications placeholder -> gercek surface: KAPANDI
- 5) Notifications route yoklugu: KAPANDI
- 6) Settings IA uyumu: KAPANDI
- 7) In-scope placeholder temizligi: KAPANDI (yalniz help aksiyonu placeholder)
- 8) `runa-migrated-*` class borcu: KAPANDI (`apps/web/src` icinde tarama sonucu 0)
- 9) Active page notifications modeli: KAPANDI
- 10) Fresh visual evidence set: BLOCKED (ortamda Playwright `EPERM`)

Blokaj detaylari: `docs/design-audit/FRONTEND-MIMAR-HIZALAMA-ESCALATION.md`
