# Runa — Task Template

## Görev Bilgileri

- **Sprint:** Core Hardening Phase 2 sonrası — **Track:** Track C
- **Görev:** Desktop Native Input Acceleration — Nut.js'e kilitlenmeden native sidecar / binding stratejisi seçmek
- **Modül:** desktop
- **KARAR.MD Maddesi:** Desktop platform — Windows-first, approval-gated desktop authority

## Bağlam

- **İlgili interface:** `apps/desktop-agent/src/input.ts` → `DesktopAgentInputExecutionResult`, `executeDesktopAgentInput()`; `packages/types/src/ws.ts` → `DesktopAgentToolName`
- **Referans dosya:** `apps/desktop-agent/src/input.ts`, `apps/desktop-agent/src/screenshot.ts`, `apps/desktop-agent/src/ws-bridge.ts`
- **Repo gerçeği:** Mevcut input/screenshot yolu PowerShell tabanlıdır. Bu güvenli fallback olarak korunmalıdır. Native hızlandırma release kalitesini artırır ama dependency/packaging riskini büyütür.

## Rekabetçi Kalite Çıtası

Vision loop ve desktop automation için düşük gecikme önemlidir. Ancak en iyi çözüm, "Nut.js kur ve geç" değildir. Runa için hedef ölçümlü, fallback'lı ve packaging'e uygun native input stratejisidir.

- PowerShell fallback silinmez.
- Native seçenekler ölçülür: Nut.js, Go sidecar, Rust sidecar.
- Electron packaging ve Windows signing/AV etkisi değerlendirilir.
- Native layer crash ederse desktop-agent ölmez; fallback veya typed error döner.
- Performans claim'i benchmark olmadan yazılmaz.

## Kaynaklı Endüstri Notları

- Electron native module kullanımı ABI/rebuild riski taşır; `electron-rebuild` veya uyumlu prebuild gerektirebilir.
- Go/Rust sidecar yaklaşımı Node native binding riskini azaltabilir ama process lifecycle, signing, antivirus ve IPC güvenliği gerektirir.

## Görev Detayı

Bu belge Nut.js implementasyon prompt'u olmaktan çıkarılmıştır. İlk görev ölçümlü karar ve minimum abstraction seam'idir.

### TASK-09A — Native Input Strategy Mini-RFC

Aşağıdaki seçenekleri gerçek repo ve Windows hedefi için karşılaştır:

1. **Status quo PowerShell**
   - Artı: native dependency yok, bugün çalışıyor.
   - Eksi: spawn latency yüksek.
2. **Nut.js / Node native binding**
   - Artı: JS API, düşük gecikme potansiyeli.
   - Eksi: Electron ABI/rebuild, native module kırılganlığı.
3. **Go sidecar**
   - Artı: tek binary, cross-compile, Node ABI'den bağımsız.
   - Eksi: IPC, signing, AV, process lifecycle.
4. **Rust sidecar**
   - Artı: memory safety, tek binary, güçlü packaging.
   - Eksi: ekip/tooling karmaşıklığı, Windows API binding maliyeti.

RFC çıktısı:

- Önerilen seçenek.
- Nedenleri.
- Ölçüm planı.
- Packaging etkisi.
- Fallback planı.
- Security/approval etkisi.

### TASK-09B — Native Input Abstraction

Seçimden bağımsız interface ekle:

```typescript
interface DesktopNativeInputDriver {
  readonly kind: 'powershell' | 'nutjs' | 'go_sidecar' | 'rust_sidecar';
  click(input: ClickInput): Promise<DesktopAgentInputExecutionResult>;
  type(input: TypeInput): Promise<DesktopAgentInputExecutionResult>;
  keypress(input: KeypressInput): Promise<DesktopAgentInputExecutionResult>;
  scroll(input: ScrollInput): Promise<DesktopAgentInputExecutionResult>;
  health(): Promise<NativeInputHealth>;
}
```

- İlk implementasyon mevcut PowerShell driver'ı olabilir.
- Native driver ayrı fazda eklenir.

### TASK-09C — Chosen Native Driver

Yalnız RFC kabulünden sonra:

- Nut.js seçildiyse native module rebuild/packaging kanıtı gerekir.
- Go/Rust seçildiyse IPC protocol, process lifecycle, timeout, heartbeat ve kill cleanup gerekir.
- Benchmark gerçek komutla ölçülür; hedef değerler "beklenti" olarak yazılır, kanıt olmadan done sayılmaz.

## Sınırlar (Yapma Listesi)

- [ ] Nut.js'i doğrudan dependency olarak ekleme; önce mini-RFC.
- [ ] Mevcut PowerShell fallback'ı silme.
- [ ] Server-side desktop tool'lara dokunma.
- [ ] WS kontratlarını değiştirme.
- [ ] Electron packaging etkisini yok sayma.
- [ ] `desktop.screenshot` hızlandırmasını input refactor'ıyla aynı anda zorunlu yapma; ayrı ölç.
- [ ] 5-15ms gibi performans değerlerini gerçek benchmark olmadan done kriteri yapma.
- [ ] `any`, silent catch, native crash swallow kullanma.

## Değiştirilebilecek Dosyalar

### TASK-09A

- `TASK-09-NATIVE-INPUT-NUTJS.md` veya ayrı architecture note (dokümantasyon)

### TASK-09B

- `apps/desktop-agent/src/native-input-driver.ts` (yeni)
- `apps/desktop-agent/src/powershell-input-driver.ts` (yeni veya mevcut fonksiyonları saran adapter)
- `apps/desktop-agent/src/input.ts` (driver dispatch için dar değişiklik)
- `apps/desktop-agent/src/native-input-driver.test.ts` (yeni)

### TASK-09C

- `apps/desktop-agent/package.json` veya sidecar package/build dosyaları (yalnız RFC sonrası)
- Seçilen driver dosyaları

## Değiştirilmeyecek Dosyalar

- `apps/server/src/tools/desktop-*.ts`
- `packages/types/src/ws.ts`
- `apps/desktop-agent/src/session.ts`
- `apps/desktop-agent/src/auth.ts`
- `apps/desktop-agent/src/ws-bridge.ts` unless driver health reporting explicitly requires additive metadata

## Done Kriteri

- [ ] Seçilen faz açıkça belirtilir.
- [ ] Mini-RFC olmadan native dependency eklenmemiştir.
- [ ] Driver abstraction mevcut output contract'ını korur.
- [ ] PowerShell fallback test edilir.
- [ ] Native driver fazında benchmark komutu ve gerçek sonuç raporlanır.
- [ ] Crash/timeout/abort path test edilir.
- [ ] Typecheck, targeted tests ve Biome PASS.

## Notlar

- Native hızlandırma `TASK-02` vision loop kalitesini artırır, ancak güvenli desktop shell/lifecycle olmadan release claim'i verilmez.
- Bu belge adı Nut.js içerse de karar Nut.js'e kilitli değildir; amaç en doğru native path'i kanıtla seçmektir.
