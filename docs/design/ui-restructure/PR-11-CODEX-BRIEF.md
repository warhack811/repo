# PR-11 Codex Brief — useChatRuntime Memo Dependency Patlaması Düzeltmesi (BUG-11)

> **Tarih:** 2026-05-14
> **Branch:** `codex/ui-restructure-pr-11-runtime-memo-split`
> **Worktree:** `.claude/worktrees/runa-ui-pr-11-runtime-memo-split`
> **Authority:** `docs/CHAT-UI-AUDIT-2026-05.md` BUG-11 + `docs/RUNA-DESIGN-LANGUAGE.md`
> **Bağımlılık:** PR-1..PR-9 merge edilmiş olmalı.
> **Hedef:** `useChatRuntime` hook'unun son `useMemo`'sundaki 30+ dependency'li mega-memo'yu ve `chatStore.getState()` ile yapılan reaktif olmayan okumaları **API yüzeyini bozmadan** parçala. Sohbet sayfasında re-render tetik oranını ölç ve azalt.

---

## 1. Tek cümle hedef

Bu PR'dan sonra `useChatRuntime` tüketicileri **tek "her şey değişti" memo invalidasyonu** yerine grup bazlı invalidasyonlar alır; özellikle agent çalışırken `presentationRunSurfaces` veya `streamingText` her token akışında ChatPage'i toptan re-render etmez.

---

## 2. Problem — Kanıt

### 2.1 Mega-memo (line 1632-1717)

`apps/web/src/hooks/useChatRuntime.ts:1632-1717` arasında return değerini üreten `useMemo` **~30 dependency** taşıyor:

```ts
return useMemo(
  () => ({
    accessToken, attachments, apiKey, approvalMode, connectionStatus,
    currentPresentationSurface, currentRunFeedback,
    currentStreamingRunId: chatStore.getState().presentation.currentStreamingRunId,  // ❌ reactive değil
    currentStreamingText: chatStore.getState().presentation.currentStreamingText,    // ❌ reactive değil
    desktopTargetConnectionId, expandedPastRunIds, includePresentationBlocks,
    /* ... 25+ alan ... */
  }),
  [
    accessToken, attachments, apiKey, approvalMode, connectionStatus,
    presentationSurfaceState, currentRunFeedback,
    selectedDesktopTargetConnectionId, expandedPastRunIds, includePresentationBlocks,
    /* ... 25+ dep ... */
  ],
);
```

**İki ayrı problem:**

1. **Stale read riski:** `currentStreamingRunId` ve `currentStreamingText` değerleri `chatStore.getState()` ile dependency listesi dışında okunuyor. Yani streaming text değişse bile bu memo yeniden hesaplanmadığı sürece tüketici eski değeri görür. Şu an çalışıyor sadece çünkü memo başka deps yüzünden zaten sık sık invalide oluyor → ironi: re-render yağmuru sayesinde stale değer görünmüyor.

2. **Aşırı invalidation:** `presentationRunSurfaces` her WS event ile değişiyor (stream chunk başına). Memo invalide olunca **tüm consumer'lar** (ChatPage + altındaki 40+ component) yeniden render. Settings veya navigation gibi alanlar bile streaming sırasında re-render alıyor.

### 2.2 İkincil memo (line 1262-1270)

```ts
const presentationSurfaceState = useMemo(
  () => derivePresentationSurfaceState({...}),
  [expectedPresentationRunIds, presentationRunId, presentationRunSurfaces],
);
```

`expectedPresentationRunIds` bir `Ref.current` (line 1261) — referans değişmez ama `useMemo` deps'inde olduğu için React bunu kararlı sanıyor. **Sorun değil ama yanıltıcı.** PR-11'de comment ile not edilmesi yeterli.

### 2.3 Etki (production'da gözlenen)

- Agent çalışırken (streaming) ChatPage tree'sinde saniyede 5-30 re-render
- Mobil cihazda jank, scroll'da takılma
- `useMemo`'lar ChatComposerSurface, ChatHeader, ApprovalBlock'ta da kademeli olarak tetikleniyor

---

## 3. Kapsam — Yapılacaklar

### 3.1 `chatStore` reaktif okumaları Zustand selector'a taşı

**Yeni helper:** `apps/web/src/hooks/useChatStoreSlice.ts`

```ts
import { useSyncExternalStore } from 'react';
import type { ChatStore } from '../lib/chat-runtime/chatStore.js';

/**
 * useSyncExternalStore tabanli reaktif selector.
 * chatStore.subscribe + getState pattern'i ile uyumlu calisir.
 */
export function useChatStoreSlice<T>(
  store: ChatStore,
  selector: (state: ReturnType<ChatStore['getState']>) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  // Implementasyon: useSyncExternalStoreWithSelector veya manuel cache
  // ...
}
```

NOT: `chatStore` zaten subscribe/getState API'sine sahip mi kontrol et. Yoksa Zustand vanilla store ise `zustand`'in `useStoreWithEqualityFn` veya `zustand/traditional` import'unu kullan. Gerçekten ek kütüphane gerekiyorsa kullanıcıya sor; tercih: **dependency eklemeden useSyncExternalStore ile yap**.

**Uygulama:** `useChatRuntime` son return'ünden `currentStreamingRunId` ve `currentStreamingText` alanlarını **çıkar**. Bunlar artık tüketici tarafında ayrı bir hook'la okunur:

```ts
// Yeni hook (apps/web/src/hooks/useStreamingMessage.ts):
export function useStreamingMessage(store: ChatStore): {
  text: string;
  runId: string | null;
} {
  const text = useChatStoreSlice(store, (s) => s.presentation.currentStreamingText);
  const runId = useChatStoreSlice(store, (s) => s.presentation.currentStreamingRunId);
  return { text, runId };
}
```

Tüketici (örneğin `StreamingMessageSurface.tsx`):

```ts
// Eski:
const { currentStreamingText, currentStreamingRunId, store } = runtime;
// Yeni:
const { store } = runtime;
const { text, runId } = useStreamingMessage(store);
```

`StreamingMessageSurface`, `ChatComposerSurface` ve streaming text okuyan diğer 3-5 tüketici güncellenir. Diğer tüketiciler etkilenmez çünkü API yüzeyinden sadece **bu iki alan** kaldırılıyor.

### 3.2 Return memo'sunu **3 gruba** böl

Tek mega-objeden, 3 mantıksal alt-grup memo'su ve bir wrapper memo:

```ts
// Grup 1: Config / state (yavaş değişen)
const runtimeConfig = useMemo(
  () => ({
    accessToken, apiKey, approvalMode, model, provider,
    workingDirectory, includePresentationBlocks, isRuntimeConfigReady,
  }),
  [accessToken, apiKey, approvalMode, model, provider,
   workingDirectory, includePresentationBlocks, isRuntimeConfigReady],
);

// Grup 2: Run/streaming state (orta hızda değişen)
const runtimeState = useMemo(
  () => ({
    attachments, connectionStatus, currentPresentationSurface: presentationSurfaceState.currentPresentationSurface,
    currentRunFeedback, desktopTargetConnectionId: selectedDesktopTargetConnectionId,
    expandedPastRunIds, isSubmitting, lastError, latestRunRequestIncludesPresentationBlocks,
    messages, pastPresentationSurfaces: presentationSurfaceState.pastPresentationSurfaces,
    pendingInspectionRequestKeys, presentationRunSurfaces, prompt, runTransportSummaries,
    staleInspectionRequestKeys, transportErrorCode, inspectionAnchorIdsByDetailId,
  }),
  [
    attachments, connectionStatus, presentationSurfaceState, currentRunFeedback,
    selectedDesktopTargetConnectionId, expandedPastRunIds, isSubmitting, lastError,
    latestRunRequestIncludesPresentationBlocks, messages, pendingInspectionRequestKeys,
    presentationRunSurfaces, prompt, runTransportSummaries, staleInspectionRequestKeys,
    transportErrorCode,
  ],
);

// Grup 3: Actions / setters (stabil ref'ler — useCallback ile)
const runtimeActions = useMemo(
  () => ({
    abortCurrentRun, requestInspection, resetRunState, resolveApproval, retryTransport,
    setApiKey, setApprovalMode, setAttachments, setDesktopTargetConnectionId: setSelectedDesktopTargetConnectionId,
    setIncludePresentationBlocks, setModel, setPastRunExpanded, setPrompt, setProvider,
    setWorkingDirectory, submitRunRequest, store: chatStore,
  }),
  [
    abortCurrentRun, requestInspection, resetRunState, resolveApproval, retryTransport,
    setApiKey, setApprovalMode, setAttachments, setSelectedDesktopTargetConnectionId,
    setIncludePresentationBlocks, setModel, setPastRunExpanded, setPrompt, setProvider,
    setWorkingDirectory, submitRunRequest, chatStore,
  ],
);

// Wrapper (API geriye uyumluluğu)
return useMemo(
  () => ({ ...runtimeConfig, ...runtimeState, ...runtimeActions }),
  [runtimeConfig, runtimeState, runtimeActions],
);
```

**Kritik:** Wrapper memo hâlâ var çünkü ChatPage tek `runtime` objesi alıyor; API yüzeyini bozma. Ama:
- `runtimeConfig` config'i değişmeden invalidate olmaz
- `runtimeActions` setter'lar stable kaldığı sürece invalidate olmaz
- Sadece `runtimeState` streaming sırasında değişir → wrapper invalide olur ama gruplar zaten ayrı; tüketici hangi grupta olduğunu bilmiyor ama React reconciliation seviyesinde fark olmayacak

**Faydası daha çok useChatRuntime içindeki ardışık `useMemo`'larda hissedilir** — örneğin `currentRunFeedback` hâlâ `presentationSurfaceState` değişimi ile invalide oluyor (kabul edilebilir, gerçekten ona bağımlı).

### 3.3 Asıl performans kazanımı — `useChatStoreSlice` ile fine-grained subscription

3.1'deki streaming text/runId taşıması en büyük kazançtır. Çünkü:
- Önce: streaming chunk → store update → useChatRuntime mega-memo yeniden hesap → ChatPage yeniden render → tüm tree
- Sonra: streaming chunk → store update → **yalnız `useStreamingMessage` tüketicileri** yeniden render

ChatPage'in 200+ satırlık JSX'i streaming sırasında re-render edilmez.

### 3.4 ChatPage ve diğer tüketicilerde değişiklik

**Dosya:** `apps/web/src/pages/ChatPage.tsx`

Şu an ChatPage `runtime`'dan `currentStreamingText`, `currentStreamingRunId` okuyor mu doğrula. Eğer okuyorsa:

```ts
// Eski:
const { currentStreamingText, currentStreamingRunId } = runtime;
// Yeni (ChatPage level'da değil, alt tüketicilerde):
// ChatPage bu iki alanı StreamingMessageSurface'e prop olarak iletmiyor; iletmek gerekiyorsa o component artık useStreamingMessage'i çağırır.
```

**Etkilenecek tüketiciler (grep ile doğrula):**
- `apps/web/src/components/chat/StreamingMessageSurface.tsx`
- `apps/web/src/components/chat/ChatComposerSurface.tsx` (Stop button için runId)
- Diğerleri (`grep -rn "currentStreamingText\|currentStreamingRunId" apps/web/src`)

Her tüketici **kendi seviyesinde** `useStreamingMessage(store)` çağırır. Prop drilling yapılmaz.

### 3.5 Performans ölçümü (zorunlu kanıt)

**Yeni dosya:** `apps/web/src/test/perf/use-chat-runtime-rerender.test.tsx`

React Testing Library + counter ref pattern ile ChatPage'in re-render sayısını ölç. Sahte streaming event'leri (10 chunk) gönder, ChatPage `useEffect` render counter'ı kaç kez artıyor karşılaştır:

```ts
it('streaming chunklari ChatPage'i toptan re-render etmez', async () => {
  let renderCount = 0;
  function CountingChatPage() {
    renderCount++;
    return <ChatPage />;
  }
  // setup + 10 streaming chunk gönder
  expect(renderCount).toBeLessThan(5);  // Önce: ~12-15 beklenir; PR-11 sonrası: ≤5
});
```

Eşik değer (≤5) hedef. Eğer ulaşılmıyorsa Codex `useChatStoreSlice` implementasyonunu ve diğer dep listelerini gözden geçirir.

### 3.6 Lock test assertion

**Dosya:** `apps/web/src/test/design-language-lock.test.ts`

Yeni assertion:

```ts
it('useChatRuntime API surface stabil', async () => {
  const source = await fs.readFile('apps/web/src/hooks/useChatRuntime.ts', 'utf8');
  // Mega-memo (>20 dep) imzasi kalmis mi kontrol et
  const megaMemoMatch = source.match(/useMemo\([\s\S]*?\),\s*\[[\s\S]{2000,}\]/);
  expect(megaMemoMatch, 'useChatRuntime icinde 30+ dep'li mega-memo kalmamali').toBeNull();
});

it('streaming text/runId chatStore.getState ile useMemo body icinde okunmuyor', async () => {
  const source = await fs.readFile('apps/web/src/hooks/useChatRuntime.ts', 'utf8');
  const returnBlock = source.match(/return useMemo\([\s\S]*?\),\s*\[/)?.[0] ?? '';
  expect(returnBlock).not.toMatch(/chatStore\.getState\(\)\.presentation\.currentStreaming/);
});
```

---

## 4. Kapsam dışı

- ❌ `chatStore` iç yapısını değiştirme. Sadece subscribe/getState API'sini kullan.
- ❌ Zustand yerine farklı state manager.
- ❌ Yeni external dependency (paket eklenmesi gerekirse kullanıcıya sor).
- ❌ Streaming state'i Context API'ye taşıma.
- ❌ Re-render mesajının diğer nedenlerini kovalama (BlockRenderer.memo, vs.) — bu PR yalnız useChatRuntime hook'unda.
- ❌ TypeScript strict mode upgrade.
- ❌ Diğer hook'ların (useConversations, useVoiceInput) memo'larını dokunma.

---

## 5. Kabul Kriteri

### 5.1 Otomatik (CI)

- [ ] `pnpm --filter @runa/web lint` PASS
- [ ] `pnpm --filter @runa/web typecheck` PASS
- [ ] `pnpm --filter @runa/web test` PASS (yeni perf testi dahil)
- [ ] `pnpm --filter @runa/web build` PASS
- [ ] Yeni perf testi: ChatPage 10 streaming chunk için **≤5 re-render**
- [ ] Lock test 2 yeni assertion PASS

### 5.2 API geriye uyumluluk

`useChatRuntime` return shape **yüzeyde aynı** kalır (TypeScript tipinden hangileri kaldırılırsa changelog'a eklenir). Kaldırılan **iki alan**:
- `currentStreamingText` → `useStreamingMessage(runtime.store).text`
- `currentStreamingRunId` → `useStreamingMessage(runtime.store).runId`

Tüm tüketici tarafı (`grep -rn "runtime\.currentStreamingText\|runtime\.currentStreamingRunId\|\.currentStreamingText\b\|\.currentStreamingRunId\b" apps/web/src`) güncellenmiş olmalı; aksi takdirde TypeScript fail eder.

### 5.3 Performans ölçümü (kanıt)

PR description'a:
- Önce (main): perf test sonucu → render count
- Sonra (PR-11): perf test sonucu → render count

Beklenti: en az %50 düşüş. Tipik beklenen ölçüm: 15 → 4-5.

### 5.4 İnsan-review

- [ ] Streaming sırasında ChatComposerSurface input'u takılmadan yazılabilir (manuel test, uzun prompt + agent çalışırken yazma)
- [ ] Stop button'ı çalışıyor (runId stale değil)
- [ ] Approval kartı görünür, etkileşim sorunsuz
- [ ] Mobil 390px viewport'ta streaming sırasında scroll akıcı

---

## 6. Risk ve geri-alma

| Risk | Etki | Mitigation |
|---|---|---|
| `useChatStoreSlice` selector bir alanda stale döner | Yüksek | `useSyncExternalStore` semantiği bunu engeller; assertion testlerle doğrula. |
| Tüketici bir alanı güncellemeyi unutur → undefined error | Orta | TypeScript runtime config'i fail eder; build PASS şartı bunu yakalar. |
| Zustand vanilla store API'si `useSyncExternalStore` ile uyumsuz | Orta | `subscribeWithSelector` middleware veya custom equality wrapper; uyumsuzsa kullanıcıya sor. |
| Wrapper memo yine de invalide olur ve kazanç düşer | Düşük | Perf testi PR-merge engelidir. Eşik tutmuyorsa stratejiyi gözden geçir. |
| StreamingMessageSurface'in stale stream gösterimi (BUG-1 regresyonu) | Yüksek | BUG-1 regression test eklenir (run.finished sonrası 100ms içinde streaming text görünür kalır mı). |

**Geri-alma:** Tek PR, ~5-7 dosya değişikliği. Revert temiz.

---

## 7. Komutlar (Codex)

```bash
cd D:/ai/Runa
git worktree add .claude/worktrees/runa-ui-pr-11-runtime-memo-split codex/ui-restructure-pr-11-runtime-memo-split
cd .claude/worktrees/runa-ui-pr-11-runtime-memo-split
pnpm install
pnpm --filter @runa/web dev

# Mevcut tüketici tarama
grep -rn "currentStreamingText\|currentStreamingRunId" apps/web/src

# Doğrulama
pnpm --filter @runa/web lint
pnpm --filter @runa/web typecheck
pnpm --filter @runa/web test
pnpm --filter @runa/web build

# Perf testi izole koşum
pnpm --filter @runa/web test -- use-chat-runtime-rerender
```

---

## 8. Yetki ve disiplin

- Belirsizlik çıkarsa (özellikle Zustand vanilla store API'si) Codex iş başlamadan kullanıcıya sorar; tahmin yapmaz.
- `useChatStoreSlice` implementasyonu için en az 3 alternatif düşünülmeli: (a) `useSyncExternalStore` saf, (b) Zustand `useStoreWithEqualityFn`, (c) manuel ref + subscribe. En basit + dependency-free olanı tercih edilir.
- PR description'a önce/sonra perf ölçüm sonucu **zorunlu**.

---

> Bu PR yalnız BUG-11'i kapatır. Diğer plan-dışı boşluklar PR-12'de ele alınır.
