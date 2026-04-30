# Runa — Task Template

## Görev Bilgileri

- **Sprint:** Core Hardening Phase 2 — **Track:** Track C
- **Görev:** Electron Desktop Companion Shell — mevcut desktop-agent foundation'ini kullanıcıya görünen, imzalanabilir masaüstü uygulaması yoluna taşımak
- **Modül:** desktop
- **KARAR.MD Maddesi:** Desktop platform — Windows-first, signed-in desktop companion

## Bağlam

- **İlgili interface:** `apps/desktop-agent/src/session.ts` → `DesktopAgentSessionRuntime`, `apps/desktop-agent/src/shell.ts` → `DesktopAgentShell`, `apps/desktop-agent/src/window-host.ts` → `DesktopAgentWindowHost`
- **Referans dosya:** `apps/desktop-agent/src/launch-controller.ts`, `apps/desktop-agent/src/ws-bridge.ts`, `apps/desktop-agent/src/auth.ts`, `apps/desktop-agent/src/launch-html.ts`, `apps/desktop-agent/src/launch-surface.ts`
- **İlgili diğer dosyalar:** `apps/desktop-agent/src/input.ts`, `apps/desktop-agent/src/screenshot.ts`, `apps/desktop-agent/src/index.ts`, `apps/desktop-agent/package.json`, `packages/types/src/ws.ts`
- **Repo gerçeği:** `apps/desktop-agent/` içinde secure bridge/runtime foundation ve session-input seam vardır; tam native desktop shell, online device presence UI, installer/update kanıtı ve release-grade packaging henüz yoktur.

## Rekabetçi Kalite Çıtası

Bu görev sadece "Electron penceresi açıldı" işi değildir. Hedef, Runa'nın Claude Desktop / Claude Code tarzı signed-in companion güveniyle, ama Runa'nın approval-gated remote-control modeline uygun şekilde masaüstünde varlık kazanmasıdır.

- Kullanıcı ilk açılışta ne olduğunu anlar: sign-in/session state, bağlantı durumu, cihaz adı ve güvenli çıkış görünür.
- Ana süreç, renderer ve preload güvenlik sınırları ayrıdır; renderer doğrudan token, filesystem veya desktop input authority almaz.
- Ağır parçalar lazy-init edilir; desktop bridge, tray, updater ve packaging tek hamlede "çalışıyor" iddiasına bağlanmaz.
- Desktop app, var olan `DesktopAgentSessionRuntime` / `DesktopAgentShell` contract'larını tüketir; server, web veya WS protocol yeniden tasarlanmaz.
- Kanıt standardı terminal/build log'u ve mümkünse çalışan uygulama smoke'u ile verilir. `.exe oluştu` veya `auto-update çalışıyor` iddiası gerçek artifact olmadan yazılmaz.

## Kaynaklı Endüstri Notları

- Electron native module ve packaging yolu dependency/ABI riski taşır; Electron tarafında native modüller için rebuild/packaging davranışı ayrıca doğrulanmalıdır.
- OpenAI Agents SDK ve Anthropic Computer Use dokümanlarındaki ortak ders: araç/handoff/lifecycle görünürlüğü ve güvenli execution boundary ürün güveninin parçasıdır; Runa bu çizgiyi `ToolRegistry`, approval ve desktop bridge üzerinden korur.

## Görev Detayı

Bu belge tek devasa prompt olarak uygulanmamalıdır. IDE LLM gerekirse aşağıdaki alt görevlerden yalnız birini seçip tamamlamalıdır. Her alt görev kendi başına typecheck/lint/build kanıtı üretmelidir.

### TASK-01A — Window Host + Secure IPC Shell

1. `apps/desktop-agent/electron/main.ts` ekle.
2. `apps/desktop-agent/electron/preload.ts` ekle.
3. `apps/desktop-agent/electron/renderer/` altında minimal React UI kur.
4. `DesktopAgentWindowHost` interface'ini Electron BrowserWindow IPC ile implemente et.
5. `createDesktopAgentShell()` snapshot/subscribe akışını renderer'a push et.
6. Renderer sadece güvenli preload API'sini görür; Node integration kapalı, context isolation açık olmalıdır.

### TASK-01B — Session Persistence

1. Mevcut `DesktopAgentSessionStorage` interface'ini persistent implement et.
2. Dependency gerekiyorsa önce mini-RFC yaz: neden `electron-store`, alternatifler, token saklama riski, migration/fallback.
3. Session verisi renderer'a raw olarak sızmaz.
4. Sign out, storage clear ve runtime stop aynı lifecycle içinde doğrulanır.

### TASK-01C — Tray + Lifecycle

1. Tray icon state mapping: `needs_sign_in`, `connecting`, `connected`, `error`, `stopped`.
2. App quit, window close, reconnect ve sign out davranışları ayrı ayrı ele alınır.
3. Auto-start opsiyonel kullanıcı ayarıdır; varsayılan açık yapılmaz.

### TASK-01D — Packaging / Installer / Updater

1. `electron-builder` ve `electron-updater` ancak 01A-01C yeşil olduktan sonra açılır.
2. Windows installer artifact'ı üretildiği terminal log'u ile kanıtlanır.
3. Auto-update gerçek GitHub Releases veya test update server olmadan "çalışıyor" kabul edilmez; sadece wiring done denebilir.

## Sınırlar (Yapma Listesi)

- [ ] Bu belgeden tek seferde bütün alt görevleri uygulama; 01A → 01B → 01C → 01D sırasını koru.
- [ ] `apps/server/`, `apps/web/`, `packages/types/` dosyalarına girme; sadece açıkça architecture escalation note gerekiyorsa dur ve raporla.
- [ ] WS kontratlarını değiştirme.
- [ ] Mevcut `session.ts`, `ws-bridge.ts`, `input.ts`, `screenshot.ts`, `auth.ts`, `shell.ts`, `launch-controller.ts` davranışlarını yeniden yazma.
- [ ] Yeni dependency eklemeden önce dependency mini-RFC üret.
- [ ] Renderer'a filesystem, token veya desktop input authority verme.
- [ ] `any`, `@ts-ignore`, silent catch veya fake fallback kullanma.
- [ ] Auto-start, updater, signing veya `.exe` başarısını gerçek kanıt olmadan claim etme.

## Değiştirilebilecek Dosyalar

- `apps/desktop-agent/package.json` (yalnız onaylanmış alt faz dependency/script değişiklikleri)
- `apps/desktop-agent/electron/main.ts` (yeni)
- `apps/desktop-agent/electron/preload.ts` (yeni)
- `apps/desktop-agent/electron/renderer/index.html` (yeni)
- `apps/desktop-agent/electron/renderer/App.tsx` (yeni)
- `apps/desktop-agent/src/electron-window-host.ts` (yeni)
- `apps/desktop-agent/src/electron-session-storage.ts` (yeni, sadece 01B)
- `apps/desktop-agent/electron-builder.yml` (yeni, sadece 01D)
- `apps/desktop-agent/tsconfig.json` veya Electron'e özel tsconfig dosyası

## Değiştirilmeyecek Dosyalar

- `apps/server/**`
- `apps/web/**`
- `packages/types/**`
- `apps/desktop-agent/src/session.ts`
- `apps/desktop-agent/src/ws-bridge.ts`
- `apps/desktop-agent/src/input.ts`
- `apps/desktop-agent/src/screenshot.ts`
- `apps/desktop-agent/src/auth.ts`
- `apps/desktop-agent/src/shell.ts`
- `apps/desktop-agent/src/launch-controller.ts`

## Done Kriteri

- [ ] Seçilen alt görev açıkça belirtilir: 01A, 01B, 01C veya 01D.
- [ ] Electron main/preload/renderer boundary type-safe ve context-isolated çalışır.
- [ ] `DesktopAgentShell` snapshot'ı renderer'da görünür.
- [ ] Session submit/sign out akışı mevcut launch/session semantics'iyle uyumludur.
- [ ] Tray/lifecycle veya packaging claim'i yalnız ilgili alt görevde ve gerçek kanıtla yapılır.
- [ ] `pnpm.cmd --filter @runa/desktop-agent typecheck` PASS.
- [ ] İlgili Biome check PASS.
- [ ] Uygulama smoke'u çalıştırıldıysa komut ve gözlenen state raporlanır; çalıştırılamadıysa neden açık yazılır.

## Notlar

- Bu görev desktop companion yolunun temelidir; `TASK-02`, `TASK-06`, `TASK-09` gibi computer-use işleri bu kabuğun güvenli lifecycle'ına dayanır.
- Electron shell ürün yüzeyidir, operator/debug paneli değildir. UI sade kalmalı: oturum, bağlantı, cihaz, çıkış ve hata görünürlüğü.
- Dependency veya interface genişletme gerekiyorsa önce architecture escalation note yazılır; IDE LLM "ben ekledim oldu" moduna geçmez.
