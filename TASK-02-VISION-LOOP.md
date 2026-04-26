# Runa — Task Template

## Görev Bilgileri

- **Sprint:** Core Hardening Phase 2 — **Track:** Track A / Track C
- **Görev:** Vision Loop — Screenshot → model analizi → action → screenshot verify döngüsü
- **Modül:** runtime / tools / gateway / desktop
- **KARAR.MD Maddesi:** Model çağrısı doğrudan yapılmaz; her zaman `ModelGateway` üzerinden gider

## Bağlam

- **İlgili interface:** `packages/types/src/gateway.ts` → `ModelImageAttachment`, `ModelRequest.attachments`; `packages/types/src/tools.ts` → `ToolDefinition`
- **Referans dosya:** `apps/server/src/tools/desktop-screenshot.ts`, `apps/server/src/tools/desktop-click.ts`, `apps/server/src/tools/desktop-type.ts`, `apps/server/src/tools/desktop-keypress.ts`
- **İlgili diğer dosyalar:** `apps/server/src/runtime/agent-loop.ts`, `apps/server/src/ws/run-execution.ts`, `apps/server/src/context/compose-context.ts`, `apps/server/src/gateway/*`

## Rekabetçi Kalite Çıtası

Bu görev Runa'nın computer-use kalitesini belirler. Hedef tek seferlik koordinat tahmini değil, hatayı yakalayan ve kullanıcı güvenini koruyan bir verify loop'tur.

- Eylem öncesi screenshot alınır.
- Vision model UI hedefini açıklar ve koordinat önerir.
- Riskli eylem için approval/HITL gerekip gerekmediği policy ile belirlenir.
- Eylem sonrası yeni screenshot alınır.
- Model veya deterministic checker hedef durumun gerçekleşip gerçekleşmediğini doğrular.
- Confidence skoru tek başına karar mekanizması değildir; explicit verification olmadan başarı claim edilmez.

## Kaynaklı Endüstri Notları

- Anthropic Computer Use dokümanı action sonrası screenshot alıp sonucu değerlendirmeyi açık bir best practice olarak önerir.
- Vision modelleri deterministik güven skoru üretmez; bu yüzden Runa confidence'ı yalnız yardımcı sinyal sayar, karar için `verify` adımını zorunlu tutar.
- Login, credential veya hassas form içeren akışlarda prompt injection ve yanlış tıklama riski artar; bu görev default olarak cautious davranmalıdır.

## Görev Detayı

### TASK-02A — `desktop.vision_analyze`

1. `desktop.vision_analyze` tool'u oluştur.
2. Input:
   ```json
   {
     "screenshot_call_id": "string",
     "task": "string"
   }
   ```
3. Önceki `desktop.screenshot` sonucundan base64 PNG alınabiliyorsa `ModelImageAttachment` üret.
4. Model çağrısı sadece `ModelGateway.generate()` üzerinden yapılır.
5. Output:
   ```json
   {
     "element_description": "string",
     "x": 0,
     "y": 0,
     "reasoning_summary": "string",
     "requires_user_confirmation": false,
     "visibility": "visible | not_visible | ambiguous"
   }
   ```
6. `confidence` varsa yardımcı metadata olarak dönebilir; mandatory karar alanı yapılmaz.

### TASK-02B — `desktop.verify_state`

1. Eylem sonrası screenshot'ı analiz eden ayrı verify tool'u ekle.
2. Input:
   ```json
   {
     "before_screenshot_call_id": "string",
     "after_screenshot_call_id": "string",
     "expected_change": "string"
   }
   ```
3. Output:
   ```json
   {
     "verified": true,
     "observed_change": "string",
     "needs_retry": false,
     "needs_user_help": false
   }
   ```
4. Başarısız verify durumunda agent başarısızlığı dürüstçe raporlar; "muhtemelen oldu" demez.

### TASK-02C — Context Strategy Rule

`TOOL_STRATEGY_RULES` içine yalnız additive bir kural ekle:

```text
For desktop automation, use screenshot -> vision_analyze -> approval if needed -> action -> screenshot -> verify_state. Do not claim success until verification passes.
```

## Sınırlar (Yapma Listesi)

- [ ] Gateway implementasyonlarını yeniden yazma.
- [ ] Desktop agent dosyalarına girme.
- [ ] Mevcut `desktop.screenshot`, `desktop.click`, `desktop.type`, `desktop.keypress`, `desktop.scroll` davranışlarını değiştirme.
- [ ] Vision model yoksa hard crash üretme; typed graceful error dön.
- [ ] Screenshot artifact retrieval yoksa bunu uydurma; önce mevcut tool result persistence seam'ini bul, yoksa açık blocker yaz.
- [ ] Hassas form submit, dosya silme, satın alma, credential alanları gibi riskli eylemleri HITL olmadan geçirme.
- [ ] `any`, silent catch veya fake confidence kullanma.

## Değiştirilebilecek Dosyalar

- `apps/server/src/tools/desktop-vision-analyze.ts` (yeni)
- `apps/server/src/tools/desktop-vision-analyze.test.ts` (yeni)
- `apps/server/src/tools/desktop-verify-state.ts` (yeni)
- `apps/server/src/tools/desktop-verify-state.test.ts` (yeni)
- `apps/server/src/tools/registry.ts`
- `packages/types/src/tools.ts`
- `apps/server/src/context/compose-context.ts` (yalnız strategy rule)

## Değiştirilmeyecek Dosyalar

- `apps/server/src/gateway/*.ts`
- `apps/server/src/tools/desktop-screenshot.ts`
- `apps/server/src/tools/desktop-click.ts`
- `apps/server/src/tools/desktop-type.ts`
- `apps/server/src/tools/desktop-keypress.ts`
- `apps/server/src/tools/desktop-scroll.ts`
- `apps/desktop-agent/**`

## Done Kriteri

- [ ] `desktop.vision_analyze` ve `desktop.verify_state` `ToolDefinition` contract'ını implement eder.
- [ ] Vision model unavailable durumda typed error döner: `vision_model_unavailable`.
- [ ] Screenshot call id'den gerçek artifact alınamıyorsa test bunu blocker olarak gösterir; fake base64 kullanılmaz.
- [ ] Analyze output'u `desktop.click` input'u üretmek için yeterlidir ama verify olmadan başarı sayılmaz.
- [ ] Verify failed senaryosu test edilir.
- [ ] HITL gerektiren risk sınıfları dokümante edilir.
- [ ] Typecheck, targeted Vitest ve Biome PASS.

## Notlar

- Groq geliştirme provider'ıdır; vision capability live olarak doğrulanmadan "Groq vision çalışıyor" claim edilmez.
- Yayın provider'ı Claude/Gemini olduğunda bile Runa'nın contract'ı `ModelGateway` üzerinden kalır.
- Bu görev, computer-use yarışında kritik ama güvenlik çıtası düşürülürse ürüne zarar verir; verify loop bu yüzden first-class gerekliliktir.
