# Runa — Task Template

## Görev Bilgileri

- **Sprint:** Core Hardening Phase 2 — **Track:** Track A
- **Görev:** Browser Automation Tool'ları — kullanıcı kontrollü, izole ve güvenli web etkileşimi
- **Modül:** tools
- **KARAR.MD Maddesi:** Tool registry bypass edilmez; her tool `ToolDefinition` implement eder

## Bağlam

- **İlgili interface:** `packages/types/src/tools.ts` → `ToolDefinition`, `ToolCallInput`, `ToolResult`
- **Referans dosya:** `apps/server/src/tools/shell-exec.ts`, `apps/server/src/tools/web-search.ts`, `apps/server/src/tools/registry.ts`
- **Repo gerçeği:** Runa'da web search vardır; browser automation yoktur. Bu görev web search yerine geçmez ve anti-bot/stealth ürünü yaratmaz.

## Rekabetçi Kalite Çıtası

Rakip seviyesinde browser automation, sadece sayfaya tıklamak değildir; güvenli, izole, iptal edilebilir ve kullanıcıya hesap verebilir olmalıdır.

- Browser process lazy-init olur ve lifecycle yönetilir.
- Her run/session için izole BrowserContext kullanılır; cookie/localStorage sızıntısı önlenir.
- Credential, cookie, password veya token log'lanmaz.
- `file:`, `javascript:`, `data:`, local network ve metadata endpoint'leri default yasaktır.
- Destructive veya authenticated action'lar approval/HITL gerektirir.
- Stealth/anti-bot bypass hedef değildir; Runa güvenilir kullanıcı otomasyonu yapar, koruma aşma aracı olmaz.
- Browser kapatma, timeout ve abort davranışı test edilir.

## Kaynaklı Endüstri Notları

- Playwright BrowserContext izolasyonu incognito-like session sağlar; bu Runa'da context başına temizlik ve data leakage azaltma için kullanılmalıdır.
- Modern browser automation ürünlerinde güvenli session isolation, user consent ve audit trail en az feature set kadar önemlidir.

## Görev Detayı

### TASK-05A — BrowserManager Lifecycle

1. `apps/server/src/tools/browser-manager.ts` ekle.
2. `playwright-core` kullanımı için dependency mini-RFC yaz:
   - Neden `playwright-core`?
   - Chromium binary nereden gelecek?
   - `PLAYWRIGHT_BROWSERS_PATH` / local install beklentisi nedir?
   - Server deployment'ta binary yoksa tool nasıl graceful error döner?
3. Browser lazy-init edilir.
4. BrowserContext run/session scoped olmalıdır.
5. Inactivity timeout: varsayılan 5 dakika.
6. Abort/cleanup API'si olmalıdır.

### TASK-05B — Read-Only Tools

1. `browser.navigate`
   ```json
   { "url": "string", "wait_until": "load | domcontentloaded | networkidle" }
   ```
2. `browser.extract`
   ```json
   { "selector": "string?", "extract_type": "text | links | table" }
   ```
3. Output sanitize edilir ve max length uygulanır.
4. HTML extraction default kapalıdır; yalnız açık gerekçeyle ve truncate/sanitize ile desteklenebilir.

### TASK-05C — Action Tools

1. `browser.click`
2. `browser.fill`
3. Selector validation ve timeout vardır.
4. Authenticated/destructive action risk sınıfına göre approval ister.
5. Action sonrası page state gözlemi döner: title, url, navigation oldu mu, visible error var mı.

## Sınırlar (Yapma Listesi)

- [ ] Anti-bot, stealth, captcha bypass, Cloudflare/Datadome bypass veya fingerprint spoofing ekleme.
- [ ] NoDriver, Camoufox, managed scraping provider gibi alternatifleri bu görevde uygulama; gerekirse ayrı architecture note.
- [ ] `browser.navigate` ile `file://`, `javascript:`, `data:`, `ftp:`, localhost/private network erişimine default izin verme.
- [ ] Password/cookie/token değerlerini log'lama veya tool result'a koyma.
- [ ] Browser context'i kullanıcılar veya run'lar arasında paylaşma.
- [ ] Gateway ve desktop modüllerine girme.
- [ ] `any`, silent catch, fake browser smoke kullanma.

## Değiştirilebilecek Dosyalar

- `apps/server/package.json` (yalnız onaylanmış dependency)
- `apps/server/src/tools/browser-manager.ts` (yeni)
- `apps/server/src/tools/browser-url-policy.ts` (yeni)
- `apps/server/src/tools/browser-navigate.ts` (yeni)
- `apps/server/src/tools/browser-navigate.test.ts` (yeni)
- `apps/server/src/tools/browser-extract.ts` (yeni)
- `apps/server/src/tools/browser-extract.test.ts` (yeni)
- `apps/server/src/tools/browser-click.ts` (yeni)
- `apps/server/src/tools/browser-click.test.ts` (yeni)
- `apps/server/src/tools/browser-fill.ts` (yeni)
- `apps/server/src/tools/browser-fill.test.ts` (yeni)
- `apps/server/src/tools/registry.ts`
- `packages/types/src/tools.ts`

## Değiştirilmeyecek Dosyalar

- `apps/server/src/tools/web-search.ts`
- `apps/server/src/tools/shell-exec.ts`
- `apps/desktop-agent/**`
- `apps/server/src/gateway/**`

## Done Kriteri

- [ ] BrowserManager lazy-init, context isolation, inactivity cleanup ve abort testlerine sahiptir.
- [ ] URL policy private/local/dangerous scheme'leri reddeder.
- [ ] `browser.navigate` ve `browser.extract` read-only flow olarak çalışır.
- [ ] `browser.click` ve `browser.fill` action riskini metadata'da taşır ve approval gerektiren sınıfları işaretler.
- [ ] Tool result'lar sanitize/truncate edilir.
- [ ] Browser binary yoksa typed graceful error döner.
- [ ] Typecheck, targeted Vitest ve Biome PASS.

## Notlar

- Bu görev `web.search`'in yerini almaz. Araştırma soruları önce kaynaklı search ile çözülür; browser automation kullanıcı adına site etkileşimi gerektiğinde devreye girer.
- Rakip seviyesi burada "her siteye girebilmek" değil, kullanıcı güvenini bozmadan gerçek etkileşim kurabilmektir.
