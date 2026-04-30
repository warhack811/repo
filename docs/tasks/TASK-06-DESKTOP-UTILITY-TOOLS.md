# Runa — Task Template

## Görev Bilgileri

- **Sprint:** Core Hardening Phase 2 — **Track:** Track C / Track A
- **Görev:** Desktop Utility Tool'ları — clipboard, app launch ve file watch yeteneklerini güvenli fazlara bölme
- **Modül:** desktop / tools
- **KARAR.MD Maddesi:** Tool registry bypass edilmez; desktop authority approval-gated kalır

## Bağlam

- **İlgili interface:** `packages/types/src/tools.ts` → `ToolDefinition`; `packages/types/src/ws.ts` → `DesktopAgentToolName`, `desktopAgentToolNames`
- **Referans dosya:** `apps/desktop-agent/src/input.ts`, `apps/server/src/tools/desktop-click.ts`, `apps/desktop-agent/src/ws-bridge.ts`, `apps/desktop-agent/src/screenshot.ts`
- **Repo gerçeği:** Desktop bridge foundation ve bazı input tool'ları vardır. Utility tool ailesi farklı risk profillerine sahiptir; tek promptta hepsini uygulamak doğru değildir.

## Rekabetçi Kalite Çıtası

Desktop utility yetenekleri Runa'yı günlük iş ortağına yaklaştırır; ama clipboard, app launch ve file watcher kullanıcı güveni açısından ayrı ayrı ele alınmalıdır.

- Clipboard read/write açık kullanıcı niyeti veya approval olmadan yapılmaz.
- Clipboard output truncate/redact edilir; secret-like içerik ham log'lanmaz.
- App launch whitelist ve path resolution ile çalışır; kullanıcı input'u doğrudan `Start-Process`'e gitmez.
- File watch server workspace sınırlarına uyar; arbitrary filesystem surveillance açılmaz.
- Her tool `ToolRegistry` ve risk metadata üzerinden görünür olur.

## Kaynaklı Endüstri Notları

- Desktop automation ürünlerinde clipboard ve process launch yetkileri yüksek riskli capability kabul edilir; Runa bunları chat-native approval ve explicit user intent ile sınırlar.
- File watching capability'si geliştirici verimliliği için değerlidir, ancak workspace allowlist ve bounded duration olmadan arka plan gözetimine dönüşebilir.

## Görev Detayı

Bu belge üç ayrı alt görevdir. Tek IDE LLM run'ında yalnız biri uygulanmalıdır.

### TASK-06A — Clipboard Read/Write

Desktop Agent:

- `apps/desktop-agent/src/clipboard.ts`
- PowerShell `Get-Clipboard` / `Set-Clipboard` pattern'ı, safe environment ile.
- Max output: read için 10KB, write için 10KB.
- Secret-like content detection: token/password/key benzeri içerikler result preview'da redacted olabilir.

Server:

- `desktop.clipboard.read`
- `desktop.clipboard.write`
- Approval metadata:
  - read: medium/high risk, user-visible approval
  - write: high risk, explicit confirmation

### TASK-06B — App Launcher

Desktop Agent:

- `apps/desktop-agent/src/app-launcher.ts`
- Whitelist map: `chrome`, `edge`, `firefox`, `notepad`, `code`, `explorer`, `calc`
- `cmd`, `powershell` default whitelist'e alınmaz; alınacaksa ayrı security review gerekir.

Server:

- `desktop.launch`
- Input `{ app_name: string }`
- Output `{ launched: boolean, process_name: string, pid?: number }`

### TASK-06C — File Watch

Server-only:

- `apps/server/src/tools/file-watch.ts`
- Workspace allowlist ve path normalization zorunludur.
- Max duration: 30 saniye.
- Max event: 50.
- Dependency gerekiyorsa mini-RFC: `chokidar` neden gerekli, native watcher fallback, deployment etkisi.

## Sınırlar (Yapma Listesi)

- [ ] Üç alt görevi tek PR/tek IDE run içinde karıştırma.
- [ ] Mevcut `input.ts` ve `screenshot.ts` implementasyonlarını değiştirme.
- [ ] Clipboard içeriklerini log'lama.
- [ ] Whitelist dışı app launch'a izin verme.
- [ ] `cmd` / `powershell` launch'ı bu görevde açma.
- [ ] File watch için repo/workspace dışına kör erişim verme.
- [ ] Gateway/auth redesign açma.
- [ ] `any`, silent catch veya unbounded watcher kullanma.

## Değiştirilebilecek Dosyalar

### TASK-06A

- `apps/desktop-agent/src/clipboard.ts` (yeni)
- `apps/desktop-agent/src/index.ts`
- `apps/desktop-agent/src/ws-bridge.ts`
- `apps/server/src/tools/desktop-clipboard.ts` (yeni)
- `apps/server/src/tools/desktop-clipboard.test.ts` (yeni)
- `apps/server/src/tools/registry.ts`
- `packages/types/src/ws.ts`
- `packages/types/src/tools.ts`

### TASK-06B

- `apps/desktop-agent/src/app-launcher.ts` (yeni)
- `apps/desktop-agent/src/index.ts`
- `apps/desktop-agent/src/ws-bridge.ts`
- `apps/server/src/tools/desktop-launch.ts` (yeni)
- `apps/server/src/tools/desktop-launch.test.ts` (yeni)
- `apps/server/src/tools/registry.ts`
- `packages/types/src/ws.ts`
- `packages/types/src/tools.ts`

### TASK-06C

- `apps/server/src/tools/file-watch.ts` (yeni)
- `apps/server/src/tools/file-watch.test.ts` (yeni)
- `apps/server/src/tools/registry.ts`
- `packages/types/src/tools.ts`
- `apps/server/package.json` (yalnız onaylı dependency)

## Değiştirilmeyecek Dosyalar

- `apps/desktop-agent/src/input.ts`
- `apps/desktop-agent/src/screenshot.ts`
- `apps/desktop-agent/src/session.ts`
- `apps/desktop-agent/src/auth.ts`
- `apps/server/src/tools/desktop-click.ts`
- `apps/server/src/tools/desktop-type.ts`
- `apps/server/src/tools/desktop-screenshot.ts`

## Done Kriteri

- [ ] Seçilen alt görev açıkça belirtilir.
- [ ] Tool registry ve shared type union additive güncellenir.
- [ ] Approval/risk metadata gerçek tool riskine uygundur.
- [ ] Desktop-agent WS dispatch yalnız gereken tool name'lerle genişler.
- [ ] Security negative tests vardır: oversized clipboard, whitelist dışı app, workspace dışı watch.
- [ ] Typecheck, targeted Vitest ve Biome PASS.

## Notlar

- Bu utility ailesi desktop companion kalitesini artırır ama güven sınırı zayıflarsa ürüne zarar verir.
- Clipboard ve app launch, user-facing desktop shell/approval UX ile birlikte daha anlamlıdır; `TASK-01` tamamlanmadan release claim'i verilmez.
