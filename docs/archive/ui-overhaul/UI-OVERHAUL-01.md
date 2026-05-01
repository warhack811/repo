# UI-OVERHAUL-01 — Operator/Developer Surface Hard Isolation

> Bu belge tek başına IDE LLM görev prompt'udur.
> Başlamadan önce `AGENTS.md`, `docs/post-mvp-strategy.md` (UI manifestosu), `apps/web/src/App.tsx` ve `apps/web/src/pages/ChatPage.tsx` okunmalıdır.

## Ürün Amacı

Bugün chat surface'ında manifesto'ya aykırı operator/dev affordance'lar yaşıyor. Bu görev tüm developer-only panelleri `components/developer/` altına taşır, ChatPage import grafından çıkarır, lazy import + conditional render ile sadece Developer Mode'da yüklenmesini sağlar ve repo seviyesinde bir manifesto-CI gate kurar.

Hedef: yeni bir kullanıcı ChatPage'i açtığında "Raw Transport", "Model Override", "principal", "stored token", "transport messages" gibi tek bir teknik kelime görmeyecek. Geliştirici `/developer` route'unu açtığında tüm bu affordance'lar oradadır.

## Rakip Çıtası ve Manifesto Bağlayıcılığı

[`docs/post-mvp-strategy.md` Bölüm 4](post-mvp-strategy.md) chat-first, natural-language-first ve operator-isolated UI'ı bağlayıcı yapar. ChatGPT/Claude/Cowork'te developer paneli ana chat ekranında accordion olarak yaşamaz; ayrı bir yüzeyde yaşar. Bu görevin başarısı bu ayrımı kod seviyesinde garanti etmektir.

## Görev Bilgileri

- **Sprint:** UI Overhaul — **Track:** Track C
- **Görev:** Developer/operator UI surface'ları hard isolation + manifesto-CI gate
- **Modül:** `apps/web` + `scripts/ci`
- **KARAR.MD Maddesi:** Presentation, Human Ops, UI/UX manifesto

## Bağlam

- **Mevcut import grafı:**
  - `OperatorControlsPanel` ([apps/web/src/components/chat/OperatorControlsPanel.tsx](../apps/web/src/components/chat/OperatorControlsPanel.tsx)) → yalnızca [DashboardPage](../apps/web/src/pages/DashboardPage.tsx)
  - `TransportMessagesPanel` ([apps/web/src/components/chat/TransportMessagesPanel.tsx](../apps/web/src/components/chat/TransportMessagesPanel.tsx)) → yalnızca DashboardPage
  - `RunTimelinePanel` ([apps/web/src/components/chat/RunTimelinePanel.tsx](../apps/web/src/components/chat/RunTimelinePanel.tsx)) → ChatPage (developer territory; transport timeline)
  - `InspectionActionDetailModal` ([apps/web/src/components/chat/InspectionActionDetailModal.tsx](../apps/web/src/components/chat/InspectionActionDetailModal.tsx)) → ChatPage (raw inspection detail)
  - `ChatDeveloperHint` ([apps/web/src/components/chat/ChatDeveloperHint.tsx](../apps/web/src/components/chat/ChatDeveloperHint.tsx)) → developer-only hint
  - `RunProgressPanel` ([apps/web/src/components/chat/RunProgressPanel.tsx](../apps/web/src/components/chat/RunProgressPanel.tsx)) → ChatPage (KAL — human-friendly progress, manifesto'ya uygun)
- **Routing:** [App.tsx](../apps/web/src/App.tsx) `/developer` → DashboardPage; `/dashboard` redirect `/chat`'e
- **Developer mode:** [useDeveloperMode.ts](../apps/web/src/hooks/useDeveloperMode.ts) hook mevcut

## Görev Detayı

### 1. Yeni klasör yapısı

`apps/web/src/components/developer/` altına şu dosyaları **taşı** (rename, içerik korunur, sadece import path'leri ve test eşlikçileri güncellenir):

- `OperatorControlsPanel.tsx`
- `TransportMessagesPanel.tsx`
- `RunTimelinePanel.tsx`
- `InspectionActionDetailModal.tsx`
- `ChatDeveloperHint.tsx`

### 2. ChatPage'den developer-only referansları çıkar

ChatPage.tsx içinden:
- `RunTimelinePanel` import'u kaldırılır; ChatPage `useDeveloperMode()` true ise `React.lazy(() => import('../components/developer/RunTimelinePanel.js'))` ile yükler
- `InspectionActionDetailModal` aynı yöntemle lazy
- `ChatDeveloperHint` aynı yöntemle lazy
- Geliştirici modu kapalıyken bu component'lerin import'u bundle'a girmez

### 3. DashboardPage → DeveloperPage rename

- `apps/web/src/pages/DashboardPage.tsx` → `apps/web/src/pages/DeveloperPage.tsx`
- Default export ve named export `DeveloperPage` olur
- Sayfa başlığı "Developer Console" (TR: "Geliştirici Paneli")
- [App.tsx](../apps/web/src/App.tsx) `DashboardPage` import'u `DeveloperPage` olur; `DeveloperRoute` aynı kalır
- `/dashboard` redirect `/chat`'e devam eder
- Eski dosya silinmez; bu görevin kapsamında DashboardPage tamamen DeveloperPage'e dönüşür (rename)

### 4. AppNav güncellemesi

[AppNav.tsx](../apps/web/src/components/app/AppNav.tsx) içinde:
- `developer` nav item'ı sadece `useDeveloperMode() === true` veya kullanıcı service-account ise görünür
- Normal authenticated kullanıcı için sadece `chat` ve `account` nav item'ları görünür

### 5. Manifesto-CI script'i

`scripts/ci/manifesto-check.mjs` yeni dosyası:

```js
#!/usr/bin/env node
// Chat surface'da yasaklı operator/dev kelimelerini tarar.
// Bulursa exit code 1 ile fail.

import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises'; // veya manuel walk

const FORBIDDEN_PATTERNS = [
  /\bRaw Transport\b/i,
  /\bModel Override\b/i,
  /\bprincipal\b/,
  /\bstored token\b/i,
  /\bbearer token\b/i,
  /\btransport messages\b/i,
  /\bminimum seam\b/i,
  /\bDeveloper Mode\b(?! kapali)/, // mention-only context için manuel review
];

const SCAN_GLOBS = [
  'apps/web/src/components/chat/**/*.{ts,tsx}',
  'apps/web/src/pages/ChatPage.tsx',
  'apps/web/src/pages/LoginPage.tsx',
  'apps/web/src/components/auth/**/*.{ts,tsx}',
];

// Test dosyaları (.test.tsx) muaf
// Sayım: dosya başına ihlal listesi raporlanır, exit code 1 fail
```

`package.json` (root) `scripts` bölümüne:
```json
"manifesto:check": "node scripts/ci/manifesto-check.mjs"
```

CI workflow'una bu adım eklenir (varsa `.github/workflows/`'a; yoksa lokalden çağrılabilir, future task GitHub Actions için).

### 6. Test güncellemeleri

- `apps/web/src/pages/FirstImpressionPolish.test.tsx` zaten "principal", "stored token", "Raw Transport", "Model Override" görünmemesini garanti ediyor — bu testi gözden geçir, eğer ChatPage testine yeni kontroller ekle (ör. RunTimelinePanel render edilmiyor)
- `ChatFirstShell.test.tsx` chat surface DOM'unda `data-developer-only` attribute'lı node olmamalı
- DeveloperPage için bir smoke test: developer mode kapalıyken `/developer` route'una git, redirect /chat'e (veya 403/access-denied UI)

### 7. Eski dosya cleanup

`components/chat/` altında yeni boş kalan path'ler:
- `OperatorControlsPanel.tsx` — silinir (developer/'a taşındı)
- `TransportMessagesPanel.tsx` — silinir
- `RunTimelinePanel.tsx` — silinir
- `InspectionActionDetailModal.tsx` — silinir
- `ChatDeveloperHint.tsx` — silinir

Silmek yerine deprecation comment + re-export approach **TERCİH EDİLMEZ**: bu görev kesin ayrımı zorunlu kılar. Eğer dış consumer (apps/web dışından) varsa raporla.

## Sınırlar (Yapma Listesi)

- [ ] `apps/server/**`'a dokunma (Track A/B sorumluluğu)
- [ ] `packages/types/**`'e dokunma
- [ ] `apps/desktop-agent/**`'a dokunma
- [ ] `RunProgressPanel`'i developer'a taşıma — bu human-friendly progress, kalır
- [ ] `EmptyState`, `ConversationSidebar`, `ChatHeader`, `ChatComposerSurface` gibi user-facing component'leri taşıma
- [ ] Yeni dependency ekleme
- [ ] Yeni feature açma
- [ ] Eski dosyaları silmeden bırakıp re-export yazma (kesin ayrım gerekli)
- [ ] `any`, `as any`, `@ts-ignore` kullanma
- [ ] Manifesto-CI script'ini sahte/yumuşak yazma — gerçek pattern'leri yakalamalı

## Değiştirilebilecek Dosyalar

- `apps/web/src/components/developer/` (yeni klasör)
- `apps/web/src/components/developer/OperatorControlsPanel.tsx` (taşıma)
- `apps/web/src/components/developer/TransportMessagesPanel.tsx` (taşıma)
- `apps/web/src/components/developer/RunTimelinePanel.tsx` (taşıma)
- `apps/web/src/components/developer/InspectionActionDetailModal.tsx` (taşıma)
- `apps/web/src/components/developer/ChatDeveloperHint.tsx` (taşıma)
- `apps/web/src/pages/DeveloperPage.tsx` (rename'den DashboardPage)
- `apps/web/src/App.tsx` (import update)
- `apps/web/src/pages/ChatPage.tsx` (lazy import + conditional render)
- `apps/web/src/components/app/AppNav.tsx` (developer nav görünürlük)
- `apps/web/src/components/chat/CurrentRunSurface.tsx` (RunTimelinePanel reference yoksa nötr; varsa lazy)
- `apps/web/src/pages/FirstImpressionPolish.test.tsx` (test güncellemeleri)
- `apps/web/src/components/chat/ChatFirstShell.test.tsx` (test güncellemeleri)
- `scripts/ci/manifesto-check.mjs` (yeni)
- `package.json` (root, manifesto:check script)
- `PROGRESS.md` (kapanış notu)

## Değiştirilmeyecek Dosyalar

- `apps/server/**`
- `packages/**`
- `apps/desktop-agent/**`
- `apps/web/src/components/chat/RunProgressPanel.tsx`
- `apps/web/src/components/chat/EmptyState.tsx`
- `apps/web/src/components/chat/ChatComposerSurface.tsx`
- `apps/web/src/components/chat/ConversationSidebar.tsx`
- `apps/web/src/components/auth/**`
- `apps/web/src/index.css` (UI-OVERHAUL-02 kapsamı)

## Done Kriteri

- [ ] `apps/web/src/components/chat/` altında yukarıda listelenen 5 developer dosyası YOK
- [ ] `apps/web/src/components/developer/` altında 5 dosya VAR
- [ ] DashboardPage → DeveloperPage rename tamamlandı; App.tsx ve AppNav güncel
- [ ] ChatPage developer-only component'leri lazy import + conditional render ediyor
- [ ] `scripts/ci/manifesto-check.mjs` çalışıyor; chat surface dosyalarında yasaklı kelime yok (PASS)
- [ ] `pnpm.cmd --filter @runa/web typecheck` PASS
- [ ] `pnpm.cmd --filter @runa/web lint` (Biome) PASS
- [ ] `pnpm.cmd --filter @runa/web build` PASS
- [ ] `pnpm.cmd --filter @runa/web test` PASS (mevcut testler + güncellemeler)
- [ ] Browser QA: 320/768/1440 viewport'larda chat ekranı render PASS, developer surface erişilebilir
- [ ] PROGRESS.md kapanış notu yazıldı

## Browser QA

```text
Browser QA:
- Dev server: http://localhost:5173/
- 320x700: chat render PASS, no developer panel visible
- 768x900: chat render PASS, no developer panel visible
- 1440x1000: chat render PASS, /developer route reachable
- Console errors: none / listed
- Manifesto-CI scan: 0 violations on chat/auth surfaces
```

## Notlar

- Bu görev davranış değiştirmez; surface ayrımı yapar. Mevcut işleyiş korunur.
- DeveloperPage rename sonrası backward compat olarak `/dashboard` redirect korunur.
- Manifesto-CI false positive verirse pattern listesi gözden geçirilir; yumuşatılmaz, gerekirse allowlist comment file başına eklenir.
- 02-06 görevlerinin temeli budur; bu görev kapanmadan diğerlerine geçilmez.
