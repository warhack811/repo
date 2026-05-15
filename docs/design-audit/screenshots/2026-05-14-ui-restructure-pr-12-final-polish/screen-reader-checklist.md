# Screen Reader Erisilebilirlik Kontrol Listesi

> Bu dosya, kullanici/QA ekibinin manuel NVDA + VoiceOver kosumu icin checklist'tir.
> Codex bu turnda sadece otomatik/statik kontrolleri doldurdu.

## Otomatik kontroller (Codex doldurdu)

- [x] SkipToContent component'i AppShell'in ilk ogesi.
  - Kanit: `apps/web/src/components/app/AppShell.tsx:262`, `apps/web/src/components/app/AppShell.tsx:279`
- [x] Interaktif ogelerde bos `aria-label` degeri yok (`aria-label=""` / `aria-label=''` taramasi 0 sonuc).
- [x] `<main>` landmark'lari tanimli.
  - Kanit: `apps/web/src/components/app/AppShell.tsx:264-267`, `apps/web/src/components/chat/ChatShell.tsx:25`, `apps/web/src/pages/LoginPage.tsx:78`
- [x] Navigation landmark'larinda `aria-label` var.
  - Kanit: `apps/web/src/components/app/AppSidebar.tsx:32`, `apps/web/src/components/chat/ConversationSidebar.tsx:272`
- [ ] Route-bazli tek `<h1>` hiyerarsisi tum sayfalarda tamam degil.
  - Kanit: `apps/web/src/pages` altinda otomatik taramada sadece `LoginPage.tsx` ve `NotificationsPage.tsx` birer `h1` iceriyor.
- [x] `<img>` etiketlerinde `alt` mevcut; `role="img"` kullanan SVG etiketlerinde isimsiz ornek bulunmadi.

## Manuel kontroller (kullanici dolduracak)

- [ ] NVDA: ChatPage'i ac, agent mesaji oku - okunabilir mi?
- [ ] NVDA: Approval karti geldiginde anons ediliyor mu?
- [ ] NVDA: Sheet acildiginda focus trap calisiyor mu?
- [ ] VoiceOver (macOS): ayni 3 senaryo
- [ ] Klavye-only: Tab ile tum route'lar erisilebilir mi?
