# Runa Chat UI — Uygulama Görev Promptları

> Bu belge `CHAT-UI-AUDIT-2026-05.md` ile birlikte çalışır.  
> Her prompt bağımsız ve kendi kendine yeterli bir IDE LLM görevidir.  
> Sıralı çalıştır: IMPL-01 → IMPL-02 → IMPL-03 → IMPL-04  
> Her görev bitmeden bir sonrakine geçme. Her görev sonunda `pnpm typecheck && pnpm lint && pnpm build` çalıştır.

---

## IMPL-01 — Sprint A: Mesaj Stabilitesi

**Kapsam:** BUG-1 (asistan cevabı boşluğa düşüyor) + BUG-3 (tamamlandı paneli kalıcılaşıyor) + BUG-13 (multi-run race condition)  
**Etkilenen dosyalar:**
- `apps/web/src/hooks/useChatRuntime.ts`
- `apps/web/src/hooks/useConversations.ts`
- `apps/web/src/hooks/useConversationBackedChatRuntime.ts`
- `apps/web/src/lib/chat-runtime/presentation-surfaces.ts`
- `apps/web/src/pages/ChatPage.tsx`

---

### BUG-1: Optimistic asistan mesajı

**Problem:** `run.finished` WS eventi geldiğinde `useChatRuntime.ts` streaming state'i senkron temizliyor; `StreamingMessageSurface` anında null döndürüyor. Arkadan gelen async DB fetch (useConversations.handleRunFinished) tamamlanana kadar (~50–500 ms) asistan cevabı ekrandan kayboluyor. Fetch başarısız olursa cevap oturum boyunca hiç gösterilmiyor.

**Düzeltme — 4 adım:**

#### Adım 1: `UseChatRuntimeOptions`'a yeni callback ekle

Dosya: `apps/web/src/hooks/useChatRuntime.ts`

Mevcut kod (satır 112–126):
```typescript
export interface UseChatRuntimeOptions {
	readonly accessToken?: string | null;
	readonly activeConversationId?: string | null;
	readonly buildRequestMessages?: (prompt: string) => readonly ModelMessage[];
	readonly desktopTargetConnectionId?: string | null;
	readonly onRunAccepted?: (input: {
		readonly conversationId?: string;
		readonly prompt: string;
		readonly runId: string;
	}) => void;
	readonly onRunFinished?: (input: {
		readonly conversationId?: string;
		readonly runId: string;
	}) => void;
}
```

`onRunFinished`'ın hemen üstüne yeni callback ekle:
```typescript
	readonly onRunFinishing?: (input: {
		readonly conversationId: string;
		readonly runId: string;
		readonly streamingText: string;
	}) => void;
```

#### Adım 2: Ref ve useEffect ekle

`useChatRuntime` fonksiyonu içinde, satır 367 (`const onRunFinishedRef = useRef(onRunFinished);`) satırından hemen sonra:
```typescript
const onRunFinishingRef = useRef(onRunFinishing);
```

Satır 406–408 bloğundan hemen sonra:
```typescript
useEffect(() => {
	onRunFinishingRef.current = onRunFinishing;
}, [onRunFinishing]);
```

`useChatRuntime` fonksiyon parametrelerinde destructuring'e `onRunFinishing` ekle (satır 310–317 arası `options` destructuring):
```typescript
const {
	accessToken,
	activeConversationId,
	buildRequestMessages,
	desktopTargetConnectionId,
	onRunAccepted,
	onRunFinished,
	onRunFinishing,  // ← ekle
} = options;
```

#### Adım 3: `run.finished` handler'ında, streaming clear'dan önce callback çağır

Dosya: `apps/web/src/hooks/useChatRuntime.ts`

Mevcut kod (satır 926–938):
```typescript
			chatStore.setConnectionState((currentConnectionState) => ({
				...currentConnectionState,
				isSubmitting: false,
				lastError:
					parsedMessage.payload.final_state === 'FAILED'
						? (parsedMessage.payload.error_message ?? 'Çalışma hata ile bitti.')
						: null,
			}));
			chatStore.setPresentationState((currentPresentationState) => ({
				...currentPresentationState,
				currentStreamingRunId: null,
				currentStreamingText: '',
			}));
```

Bu bloğun **başına** (setConnectionState çağrısından önce) ekle:
```typescript
			// BUG-1: Optimistic assistant message — stream buffer'ı temizlemeden önce
			// içeriği useConversations'a bildir; async fetch tamamlanana kadar görünür kalır.
			const streamingTextSnapshot = chatStore.getState().presentation.currentStreamingText;
			if (streamingTextSnapshot.trim().length > 0 && conversationId !== undefined) {
				onRunFinishingRef.current?.({
					conversationId,
					runId: parsedMessage.payload.run_id,
					streamingText: streamingTextSnapshot,
				});
			}
```

#### Adım 4: `useConversations.ts`'e `handleRunFinishing` ekle

Dosya: `apps/web/src/hooks/useConversations.ts`

`handleRunAccepted` callback'inin (satır 574) hemen sonuna, yeni `handleRunFinishing` callback'i ekle:

```typescript
const handleRunFinishing = useCallback(
	(input: {
		readonly conversationId: string;
		readonly runId: string;
		readonly streamingText: string;
	}): void => {
		const now = new Date().toISOString();
		setActiveConversationMessages((currentMessages) => {
			// Aynı run_id için zaten gerçek asistan mesajı varsa ekleme (idempotent)
			if (currentMessages.some((m) => m.run_id === input.runId && m.role === 'assistant')) {
				return currentMessages;
			}
			return [
				...currentMessages,
				{
					content: input.streamingText.trim(),
					conversation_id: input.conversationId,
					created_at: now,
					message_id: `optimistic:assistant:${input.runId}`,
					role: 'assistant' as const,
					run_id: input.runId,
					sequence_no: currentMessages.length + 1,
				},
			];
		});
	},
	[],
);
```

`UseConversationsResult` interface'ine (satır 39–) ekle:
```typescript
readonly handleRunFinishing: (input: {
	readonly conversationId: string;
	readonly runId: string;
	readonly streamingText: string;
}) => void;
```

Return object'ine `handleRunFinishing` ekle.

#### Adım 5: `useConversationBackedChatRuntime.ts`'de wire et

Dosya: `apps/web/src/hooks/useConversationBackedChatRuntime.ts`

Mevcut `onRunFinished` callback'inin (satır 16–21) hemen ardından:
```typescript
const onRunFinishing = useCallback(
	(input: { conversationId: string; runId: string; streamingText: string }) => {
		conversations.handleRunFinishing(input);
	},
	[conversations.handleRunFinishing],
);
```

`useChatRuntime` çağrısına (satır 22–28) `onRunFinishing` ekle:
```typescript
const runtime = useChatRuntime({
	activeConversationId: conversations.activeConversationId,
	accessToken,
	buildRequestMessages: conversations.buildRequestMessages,
	onRunAccepted,
	onRunFinished,
	onRunFinishing,  // ← ekle
});
```

---

### BUG-3: Tamamlandı panelini gizle

**Problem:** Run bittikten sonra `RunProgressPanel` hâlâ render ediliyor ve "Mevcut çalışma tamamlandı. Son özet ve destek kartları aşağıda görünür kalır." paragrafı ekranda kalıyor. `currentRunProgressPanel !== null` olduğu için `isBusy = true` devam ediyor.

**Düzeltme:**

Dosya: `apps/web/src/pages/ChatPage.tsx`

Mevcut kod (satır 192–198):
```typescript
const currentRunProgressPanel = currentRunProgress ? (
	<RunProgressPanel
		feedbackBanner={currentRunFeedbackBanner}
		isDeveloperMode={isDeveloperMode}
		progress={currentRunProgress}
	/>
) : null;
```

Şu şekilde değiştir:
```typescript
// BUG-3: status_tone === 'success' → run tamamlandı, paneli gizle.
// 'error' durumunda panel kalır — kullanıcı hata mesajını görmeli.
const isRunCompleted = currentRunProgress?.status_tone === 'success';
const currentRunProgressPanel =
	currentRunProgress && !isRunCompleted ? (
		<RunProgressPanel
			feedbackBanner={currentRunFeedbackBanner}
			isDeveloperMode={isDeveloperMode}
			progress={currentRunProgress}
		/>
	) : null;
```

> **Not:** `isDeveloperMode` açıkken completed run paneli de gizlenir. Dev mode'da görmek istiyorsan `!isRunCompleted` koşuluna `|| isDeveloperMode` ekleyebilirsin — opsiyonel.

---

### BUG-13: expectedPresentationRunIdRef → Set

**Problem:** Hızlı / programatik submit'lerde `expectedPresentationRunIdRef.current` ezilir. Eski run'ın `run.finished` eventi geldiğinde `matchesTrackedRun` false döner, UI state temizlenmez.

**Düzeltme — 3 adım:**

#### Adım 1: `matchesTrackedRun` imzasını güncelle

Dosya: `apps/web/src/lib/chat-runtime/presentation-surfaces.ts`

Mevcut kod (satır 63–73):
```typescript
export function matchesTrackedRun(
	messageRunId: string | undefined,
	currentRunId: string | null,
	expectedRunId: string | null,
): boolean {
	if (!messageRunId) {
		return false;
	}

	return messageRunId === currentRunId || messageRunId === expectedRunId;
}
```

Yeni kod:
```typescript
export function matchesTrackedRun(
	messageRunId: string | undefined,
	currentRunId: string | null,
	expectedRunIds: ReadonlySet<string>,
): boolean {
	if (!messageRunId) {
		return false;
	}

	return messageRunId === currentRunId || expectedRunIds.has(messageRunId);
}
```

#### Adım 2: Ref tipini değiştir

Dosya: `apps/web/src/hooks/useChatRuntime.ts`

Satır 356:
```typescript
const expectedPresentationRunIdRef = useRef<string | null>(null);
```
Yeni:
```typescript
const expectedPresentationRunIdsRef = useRef<Set<string>>(new Set());
```

#### Adım 3: Tüm kullanımları güncelle

Bu dosyada `expectedPresentationRunIdRef` geçen her yeri `expectedPresentationRunIdsRef` ile değiştir:

- **Submit handler (satır 1105):**  
  `expectedPresentationRunIdRef.current = payload.run_id;`  
  → `expectedPresentationRunIdsRef.current.add(payload.run_id);`

- **run.finished handler — shouldNotifyConversationSync (satır ~903–907):**  
  `expectedPresentationRunIdRef.current,`  
  → `expectedPresentationRunIdsRef.current,`

- **run.finished handler — gate (satır ~916–921):**  
  `expectedPresentationRunIdRef.current,`  
  → `expectedPresentationRunIdsRef.current,`

- **run.finished handler — cleanup:** run.finished başarıyla işlendikten sonra (satır 938 satırından sonra) ekle:  
  `expectedPresentationRunIdsRef.current.delete(parsedMessage.payload.run_id);`

- **Dosya genelinde diğer matchesTrackedRun çağrıları:** `grep -n "expectedPresentationRunIdRef"` ile kalan tüm occurrences'ı bul ve aynı şekilde güncelle.

- **`shouldHydratePresentationRun` çağrıları:** Bu fonksiyon zaten `ReadonlySet<string>` alıyor, değişiklik yok.

---

### IMPL-01 Done Kriterleri

- [ ] `pnpm typecheck` → sıfır hata
- [ ] `pnpm lint` → sıfır hata
- [ ] Manuel test: Normal run → cevap ekrandan kaybolmuyor; DB fetch tamamlanınca optimistic mesaj gerçek mesajla sorunsuz replace ediliyor
- [ ] Manuel test: Run bittikten sonra "Mevcut çalışma tamamlandı" paragrafı görünmüyor
- [ ] Manuel test: Hızlı 2 submit → her ikisinin de sonucu doğru run'a eşleniyor

---
---

## IMPL-02 — Sprint B: Ajan Görünürlüğü

**Kapsam:** BUG-5 (ThinkingBlock developer-only) + BUG-9 (ToolActivityIndicator icon eksik)  
**Etkilenen dosyalar:**
- `apps/web/src/components/chat/RunProgressPanel.tsx`
- `apps/web/src/components/chat/ToolActivityIndicator.tsx`

---

### BUG-5: ThinkingBlock'u normal kullanıcılara göster

**Problem:** `RunProgressPanel.tsx:140`'ta `shouldShowDiagnostics = isDeveloperMode`. Non-dev branch (satır 143–158) sadece headline + detail + ToolActivityIndicator (max 3 item) gösteriyor. `ThinkingBlock` ve adım listesi normal kullanıcılara hiç görünmüyor; veri zaten mevcut (`step_items`), sadece gizlenmiş.

**Düzeltme:**

Dosya: `apps/web/src/components/chat/RunProgressPanel.tsx`

Mevcut non-dev branch (satır 143–158):
```typescript
if (!isDeveloperMode) {
	return (
		<section
			aria-labelledby="current-run-progress-heading"
			className="runa-run-activity-line runa-migrated-components-chat-runprogresspanel-1"
		>
			<span className="runa-run-activity-line__pulse" aria-hidden="true" />
			<div className="runa-run-activity-line__copy">
				<h3 id="current-run-progress-heading">{progress.headline}</h3>
				<p>{progress.detail}</p>
				{toolActivityItems.length > 0 ? (
					<ToolActivityIndicator items={toolActivityItems.slice(0, 3)} />
				) : null}
			</div>
		</section>
	);
}
```

Yeni non-dev branch:
```typescript
if (!isDeveloperMode) {
	const thinkingSteps = createThinkingSteps(progress);
	return (
		<section
			aria-labelledby="current-run-progress-heading"
			className="runa-run-activity-line runa-migrated-components-chat-runprogresspanel-1"
		>
			<span className="runa-run-activity-line__pulse" aria-hidden="true" />
			<div className="runa-run-activity-line__copy">
				<h3 id="current-run-progress-heading">{progress.headline}</h3>
				<p>{progress.detail}</p>
				{thinkingSteps.length > 0 ? (
					<ThinkingBlock
						isActive={
							progress.status_tone === 'info' || progress.status_tone === 'warning'
						}
						steps={thinkingSteps}
					/>
				) : toolActivityItems.length > 0 ? (
					<ToolActivityIndicator items={toolActivityItems.slice(0, 3)} />
				) : null}
			</div>
		</section>
	);
}
```

> **Mantık:** `step_items` varsa ThinkingBlock göster (zaten ToolActivityIndicator verilerini kapsıyor). Yoksa fallback olarak ToolActivityIndicator'ı (max 3 item) göster. `RunaDisclosure` default kapalı başlıyor — kullanıcı "Detayı göster" ile açabilir.

---

### BUG-9: ToolActivityIndicator'a durum ikonları ekle

**Problem:** `ToolActivityIndicator.tsx`'te durum metni (`getStatusLabel`) Türkçe ama görsel ikon yok. Sadece metin span'ı var.

**Mevcut render kodu (satır 35–47):**
```typescript
{items.map((item) => (
	<div
		key={item.id}
		title={item.detail}
		className="runa-migrated-components-chat-toolactivityindicator-2"
	>
		<span className="runa-migrated-components-chat-toolactivityindicator-3">
			{getStatusLabel(item.status)}
		</span>
		<span className="runa-migrated-components-chat-toolactivityindicator-4">
			{item.label}
		</span>
	</div>
))}
```

**Düzeltme:**

Dosya başına import ekle:
```typescript
import { Check, Loader2, XCircle } from 'lucide-react';
```

`getStatusLabel` fonksiyonunun yerine `getStatusIcon` + render değişikliği:

```typescript
function getStatusIcon(status: ToolActivityItem['status']): ReactElement {
	switch (status) {
		case 'active':
			return <Loader2 aria-hidden="true" className="runa-tool-activity-icon runa-tool-activity-icon--spin" size={13} />;
		case 'completed':
			return <Check aria-hidden="true" className="runa-tool-activity-icon runa-tool-activity-icon--done" size={13} />;
		case 'failed':
			return <XCircle aria-hidden="true" className="runa-tool-activity-icon runa-tool-activity-icon--fail" size={13} />;
	}
}
```

Render içinde `getStatusLabel` span'ını ikon + etiket kombinasyonuna çevir:
```typescript
<div
	key={item.id}
	title={item.detail}
	className="runa-migrated-components-chat-toolactivityindicator-2"
>
	<span className="runa-migrated-components-chat-toolactivityindicator-3">
		{getStatusIcon(item.status)}
		<span>{getStatusLabel(item.status)}</span>
	</span>
	<span className="runa-migrated-components-chat-toolactivityindicator-4">
		{item.label}
	</span>
</div>
```

CSS'e spin animasyonu ekle (global ya da migration class'ına):
```css
.runa-tool-activity-icon--spin {
	animation: spin 1s linear infinite;
}
@keyframes spin {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}
```

> **Not:** Lucide React zaten repoda kullanılıyor (`CodeBlock.tsx`, `ApprovalBlock.tsx`). Yeni bağımlılık yok.

---

### IMPL-02 Done Kriterleri

- [ ] `pnpm typecheck` → sıfır hata
- [ ] `pnpm lint` → sıfır hata
- [ ] Manuel test (dev mode OFF): Ajan çalışırken "Runa çalışıyor..." + adımlar ThinkingBlock içinde görünüyor; "Detayı göster" açılıyor
- [ ] Manuel test: ToolActivityIndicator'da her durumun yanında uygun ikon görünüyor; 'active' dönüyor

---
---

## IMPL-03 — Sprint C+D: Chat Görsel Hiyerarşi

**Kapsam:** BUG-6 (approval card) + BUG-8 (code block collapse) + BUG-4 (tool result başlık) + BUG-10 (transcript balon)  
**Etkilenen dosyalar:**
- `apps/web/src/components/chat/blocks/ApprovalBlock.tsx`
- `apps/web/src/components/chat/blocks/BlockRenderer.module.css`
- `apps/web/src/components/chat/blocks/CodeBlock.tsx`
- `apps/web/src/components/chat/blocks/ToolResultBlock.tsx`
- `apps/web/src/components/chat/PersistedTranscript.tsx`

---

### BUG-6: Approval kartını sıkıştır

**Problem:** Kart 5 ayrı görsel katman içeriyor (approvalHeader, approvalDecision, approvalDecisionGrid, approvalStateFeedback, approvalActions). `components.css:4–5`'te kendi tasarım prensibini ("More single flow, less panel stack") çiğniyor.

**Hedef görünüm:**
```
┌─────────────────────────────────────────────────────┐
│ 🛡 Güven kararı              [Bekliyor]             │
│                                                     │
│ Dosyaya yazma isteği                                │
│ src/App.tsx — Bu işlem dosya içeriğini değiştirebilir│
│                                                     │
│ ▼ Detaylar  (RunaDisclosure — kapalı başlar)        │
│                                                     │
│  [✓ Onayla]          [✕ Reddet]                    │
└─────────────────────────────────────────────────────┘
```

**Düzeltme:**

Dosya: `apps/web/src/components/chat/blocks/ApprovalBlock.tsx`

Mevcut `ApprovalBlock` JSX (satır 197–302) içindeki 5 katmanlı yapıyı aşağıdaki sıkıştırılmış yapıyla değiştir:

```typescript
return (
	<article
		aria-busy={isPending}
		className={cx(
			styles['block'],
			styles['approvalCard'],
			getStatusClassName(block.payload.status),
		)}
	>
		{/* Satır 1: Eyebrow + status */}
		<div className={styles['approvalHeader']}>
			<div className={styles['headerStack']}>
				<span className={styles['eyebrow']}>Güven kararı</span>
				<strong className={styles['approvalTitle']}>{decisionCopy.action}</strong>
			</div>
			<span className={styles['approvalStatusChip']}>{statusLabel}</span>
		</div>

		{/* Satır 2: Hedef (tek satır, kompakt) */}
		{targetLabel ? (
			<div className={styles['approvalInlineTarget']}>
				<span className={styles['metaLabel']}>{getTargetHeading(block.payload.target_kind)}</span>
				<span className={styles['approvalValue']}>{targetLabel}</span>
				<span className={styles['approvalRisk']}>{decisionCopy.risk}</span>
			</div>
		) : (
			<p className={styles['approvalRisk']}>{decisionCopy.risk}</p>
		)}

		{/* Detaylar: RunaDisclosure içinde gizli */}
		<RunaDisclosure title="Detaylar">
			<div className={styles['metaGrid']}>
				<div className={styles['metaBox']}>
					<span className={styles['metaLabel']}>Sonuç</span>
					<span>{decisionCopy.outcome}</span>
				</div>
				{summary ? (
					<div className={styles['metaBox']}>
						<span className={styles['metaLabel']}>Özet</span>
						<p>{summary}</p>
					</div>
				) : null}
				{isDeveloperMode && block.payload.tool_name ? (
					<div className={styles['metaBox']}>
						<span className={styles['metaLabel']}>Araç</span>
						<code>{block.payload.tool_name}</code>
					</div>
				) : null}
				{isDeveloperMode && block.payload.call_id ? (
					<div className={styles['metaBox']}>
						<span className={styles['metaLabel']}>{uiCopy.approval.callId}</span>
						<code>{block.payload.call_id}</code>
					</div>
				) : null}
			</div>
		</RunaDisclosure>

		{/* Aksiyon butonları veya sonuç metni */}
		{isPending && onResolveApproval ? (
			<div className={styles['approvalActions']}>
				<RunaButton
					aria-label={`Onayla: ${decisionCopy.action}`}
					className={styles['approvalActionButton']}
					onClick={() => onResolveApproval(block.payload.approval_id, 'approved')}
					variant={approveVariant}
				>
					<Check size={16} />
					{uiCopy.approval.approve}
				</RunaButton>
				<RunaButton
					aria-label={`Reddet: ${decisionCopy.action}`}
					className={styles['approvalActionButton']}
					onClick={() => onResolveApproval(block.payload.approval_id, 'rejected')}
					variant="secondary"
				>
					<X size={16} />
					{uiCopy.approval.reject}
				</RunaButton>
			</div>
		) : (
			<p className={styles['muted']}>
				{createdAtLabel} tarihinde {statusLabel.toLocaleLowerCase('tr-TR')}.
			</p>
		)}
	</article>
);
```

CSS'e yeni class ekle (`BlockRenderer.module.css`):
```css
.approvalInlineTarget {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: 4px 8px;
	font-size: 0.85rem;
	padding: 0 0 4px;
}

.approvalRisk {
	color: var(--color-text-muted, #9ca3af);
	font-size: 0.8rem;
	margin: 0;
}
```

`approvalDecision` ve `approvalDecisionGrid` ve `approvalStateFeedback` CSS bloklarını kaldır ya da boş bırak (artık kullanılmıyor).

> **Önemli:** `summary` değişkenini hesaplama: `const summary = isDeveloperMode ? normalizeText(block.payload.summary) : normalizeText(block.payload.summary);` — dev mode gizlemesini kaldır, herkes görsün. Bu `isDeveloperMode ? ... : null` satırını (orijinal satır 193) güncelle.

---

### BUG-8: CodeBlock varsayılan kapalı eşiğini düşür

**Problem:** `COLLAPSED_LINE_LIMIT = 20` — 20 satır veya altı her dosya tam açık render ediliyor. Tool-read çıktıları (örn. `file.read`) kod paneli açık gösteriyor.

Dosya: `apps/web/src/components/chat/blocks/CodeBlock.tsx`

Satır 18:
```typescript
const COLLAPSED_LINE_LIMIT = 20;
```
→
```typescript
const COLLAPSED_LINE_LIMIT = 8;
```

Değişiklik bu kadar. `isLongBlock = lines.length > 8` olacak; 9+ satır dosyalar collapsed başlayacak.

---

### BUG-4: ToolResultBlock tool-adı içeren başlık

**Problem:** `getFriendlyResultCopy` tüm başarılı tool'lar için `title: 'İşlem tamamlandı'` döndürüyor. Kullanıcı hangi araç ne yaptı görmüyor.

Dosya: `apps/web/src/components/chat/blocks/ToolResultBlock.tsx`

Mevcut (satır 17–32):
```typescript
function getFriendlyResultCopy(block: ToolResultBlockProps['block']): Readonly<{
	readonly summary: string;
	readonly title: string;
}> {
	if (block.payload.status === 'success') {
		return {
			summary: 'Sonuç sohbet akışına eklendi.',
			title: 'İşlem tamamlandı',
		};
	}

	return {
		summary: 'Bu adım tamamlanamadı. Gerekirse yeniden deneyebilirsin.',
		title: 'İşlem tamamlanamadı',
	};
}
```

Yeni versiyon (tool-name aware):
```typescript
function getFriendlyToolTitle(toolName: string | undefined): string {
	if (!toolName) return 'İşlem tamamlandı';
	const map: Record<string, string> = {
		'file.read': 'Dosya okundu',
		'file.write': 'Dosya güncellendi',
		'file.list': 'Dizin listelendi',
		'file.delete': 'Dosya silindi',
		'web.search': 'Web araması yapıldı',
		'web.fetch': 'Sayfa getirildi',
		'shell.exec': 'Komut çalıştı',
		'search.codebase': 'Kod tarandı',
		'desktop.screenshot': 'Ekran görüntüsü alındı',
		'memory.write': 'Bilgi kaydedildi',
		'memory.read': 'Bellek okundu',
	};
	return map[toolName] ?? `${toolName.replace(/\./gu, ' ')} tamamlandı`;
}

function getFriendlyResultCopy(block: ToolResultBlockProps['block']): Readonly<{
	readonly summary: string;
	readonly title: string;
}> {
	if (block.payload.status === 'success') {
		return {
			summary: 'Sonuç sohbet akışına eklendi.',
			title: getFriendlyToolTitle(block.payload.tool_name),
		};
	}

	return {
		summary: 'Bu adım tamamlanamadı. Gerekirse yeniden deneyebilirsin.',
		title: 'İşlem tamamlanamadı',
	};
}
```

---

### BUG-10: PersistedTranscript rol-bazlı balon düzeni

**Problem:** Mesajlar `<div>` + `<strong>` rol etiketi + zaman + içerik şeklinde düz sıralı. Avatar yok, balon yok.

Dosya: `apps/web/src/components/chat/PersistedTranscript.tsx`

Mevcut message render (satır 37–49):
```typescript
{activeConversationMessages.map((message) => (
	<div
		key={message.message_id}
		className={`runa-transcript-message runa-transcript-message--${message.role} runa-migrated-components-chat-persistedtranscript-3`}
	>
		<div className="runa-migrated-components-chat-persistedtranscript-4">
			<strong className="runa-migrated-components-chat-persistedtranscript-5">
				{getRoleLabel(message.role)}
			</strong>
			<span>{new Date(message.created_at).toLocaleString('tr-TR')}</span>
		</div>
		<StreamdownMessage>{message.content}</StreamdownMessage>
	</div>
))}
```

Yeni versiyon:
```typescript
{activeConversationMessages.map((message) => (
	<div
		key={message.message_id}
		className={`runa-transcript-message runa-transcript-message--${message.role} runa-migrated-components-chat-persistedtranscript-3`}
		data-role={message.role}
	>
		<div className="runa-migrated-components-chat-persistedtranscript-bubble">
			<StreamdownMessage>{message.content}</StreamdownMessage>
		</div>
		<div className="runa-migrated-components-chat-persistedtranscript-meta">
			<span className="runa-migrated-components-chat-persistedtranscript-5">
				{getRoleLabel(message.role)}
			</span>
			<span className="runa-migrated-components-chat-persistedtranscript-time">
				{new Date(message.created_at).toLocaleString('tr-TR')}
			</span>
		</div>
	</div>
))}
```

`chat-migration.css` veya global CSS'e balon stilleri ekle:
```css
/* PersistedTranscript balon layout */
.runa-transcript-message {
	display: flex;
	flex-direction: column;
	gap: 4px;
	max-width: 80%;
}

.runa-transcript-message--user {
	align-self: flex-end;
	align-items: flex-end;
}

.runa-transcript-message--assistant {
	align-self: flex-start;
	align-items: flex-start;
}

.runa-migrated-components-chat-persistedtranscript-bubble {
	padding: 10px 14px;
	border-radius: 16px;
	font-size: 0.92rem;
	line-height: 1.55;
}

.runa-transcript-message--user .runa-migrated-components-chat-persistedtranscript-bubble {
	background: var(--color-surface-user, rgba(99, 102, 241, 0.15));
	border-bottom-right-radius: 4px;
}

.runa-transcript-message--assistant .runa-migrated-components-chat-persistedtranscript-bubble {
	background: var(--color-surface-elevated, rgba(255, 255, 255, 0.06));
	border-bottom-left-radius: 4px;
}

.runa-migrated-components-chat-persistedtranscript-meta {
	display: flex;
	gap: 6px;
	font-size: 0.72rem;
	color: var(--color-text-muted, #6b7280);
}

.runa-migrated-components-chat-persistedtranscript-1 {
	display: flex;
	flex-direction: column;
	gap: 12px;
	padding: 16px 0;
}
```

---

### IMPL-03 Done Kriterleri

- [ ] `pnpm typecheck` → sıfır hata
- [ ] `pnpm lint` → sıfır hata
- [ ] Manuel test: Approval kartı görsel olarak compact; "Detaylar" kapalı başlıyor; Onayla/Reddet butonları yan yana
- [ ] Manuel test: `file.read` tool result başlığı "Dosya okundu" gösteriyor
- [ ] Manuel test: 10 satırlı dosya closed başlıyor; 7 satırlı açık başlıyor
- [ ] Manuel test: User mesajları sağda, assistant mesajları solda; balon görünümü mevcut

---
---

## IMPL-04 — Sprint E+F: Persistence, Reconnect ve Memory

**Kapsam:** BUG-12 (reconnect zombie) + BUG-14 (memory write silent fail) + BUG-2 (F5 persistence — backend gerekli, ön hazırlık)  
**Etkilenen dosyalar:**
- `apps/web/src/hooks/useChatRuntime.ts`
- `apps/server/src/ws/run-execution.ts`
- `apps/web/src/hooks/useConversations.ts` (BUG-2 frontend tarafı)

---

### BUG-12: Reconnect sonrası zombie run force-fail

**Problem:** Network kesilip geri geldiğinde yeni socket açılıyor (`reconnectNowRef`), ama sunucuya "bu run'a devam et" mesajı gönderilmiyor. `isSubmitting` ve `expectedPresentationRunIdsRef` temizlenmiyor. Run sonsuza kadar "Çalışıyor..." state'inde kalıyor, composer kilitleniyor.

**Düzeltme:**

Dosya: `apps/web/src/hooks/useChatRuntime.ts`

`reconnectNowRef` bloğuna (satır 973–984) zamanlayıcı ekle:

Mevcut:
```typescript
reconnectNowRef.current = () => {
	if (isDisposed) {
		return;
	}

	clearReconnectTimer();
	const socketToClose = activeSocket;
	activeSocket = null;
	socketRef.current = null;
	socketToClose?.close();
	connectSocket();
};
```

Yeni:
```typescript
reconnectNowRef.current = () => {
	if (isDisposed) {
		return;
	}

	clearReconnectTimer();
	const socketToClose = activeSocket;
	activeSocket = null;
	socketRef.current = null;
	socketToClose?.close();
	connectSocket();

	// BUG-12: Reconnect sonrası aktif run varsa zombie kontrolü başlat.
	// Sunucu 12 saniye içinde run.finished göndermezse force-fail uygula.
	const isSubmittingNow = chatStore.getState().connection.isSubmitting;
	if (isSubmittingNow) {
		const zombieCheckTimer = window.setTimeout(() => {
			if (isDisposed) return;
			const stillSubmitting = chatStore.getState().connection.isSubmitting;
			if (stillSubmitting) {
				chatStore.setConnectionState((s) => ({
					...s,
					isSubmitting: false,
					lastError: 'Bağlantı kesildi — çalışma tamamlanamadı. Lütfen tekrar deneyin.',
				}));
				chatStore.setPresentationState((s) => ({
					...s,
					currentStreamingRunId: null,
					currentStreamingText: '',
				}));
			}
		}, 12_000);

		// Bileşen unmount olursa timer'ı temizle
		const originalCleanup = reconnectTimerRef.current;
		reconnectTimerRef.current = zombieCheckTimer;
		if (originalCleanup !== null) {
			window.clearTimeout(originalCleanup);
		}
	}
};
```

> **Not:** `reconnectTimerRef` reconnect timer için kullanılıyor. Zombie timer için ayrı bir ref kullanmak daha temiz olursa: `const zombieCheckTimerRef = useRef<number | null>(null);` ekleyip `clearTimeout(zombieCheckTimerRef.current)` şeklinde yönet. Ref adını buna göre güncelle.

---

### BUG-14: Memory write failure kullanıcıya bildir

**Problem:** `persistLiveMemoryWrite` (satır 2274–2335) başarısız olduğunda sadece sunucu log'una yazıyor, kullanıcıya hiç sinyal gitmiyor.

**Düzeltme — 2 adım:**

#### Adım 1: Server — run.finished payload'una status ekle

Dosya: `apps/server/src/ws/run-execution.ts`

`persistLiveMemoryWrite` fonksiyonunu bulup return değerini `memory_write_status` döndürecek şekilde değiştir:

```typescript
// Fonksiyon imzası güncelle
async function persistLiveMemoryWrite(...): Promise<'ok' | 'partial' | 'failed'> {
```

Mevcut fail durumlarında `logLiveMemoryWriteFailure` çağrısından sonra uygun değer döndür:
- İki write de başarısız: `return 'failed'`
- Biri başarısız: `return 'partial'`
- İkisi de başarılı: `return 'ok'`

`run.finished` WS mesajı gönderilmeden önce bu return değerini al ve `sendServerMessage` payload'una ekle:
```typescript
const memoryWriteStatus = await persistLiveMemoryWrite(...);
sendServerMessage(ws, {
	type: 'run.finished',
	payload: {
		// ...mevcut alanlar...
		memory_write_status: memoryWriteStatus,
	},
});
```

#### Adım 2: Frontend — memory_write_status toast'ı

Dosya: `apps/web/src/ws-types.ts`

`run.finished` payload tipine alan ekle:
```typescript
memory_write_status?: 'ok' | 'partial' | 'failed';
```

Dosya: `apps/web/src/hooks/useChatRuntime.ts`

`run.finished` handler'ında (satır 884+ bloğu), state güncelleme bölümüne ekle:
```typescript
if (
	parsedMessage.payload.memory_write_status === 'failed' ||
	parsedMessage.payload.memory_write_status === 'partial'
) {
	// Toast göster — basit lastError değil, ayrı bir notification state kullan
	// Şimdilik lastError'a yaz; ileride toast sistemi kurulunca taşınır
	chatStore.setConnectionState((s) => ({
		...s,
		lastError: 'Bilgi kaydedilemedi — hafıza güncellemesi başarısız oldu.',
	}));
}
```

---

### BUG-2: F5 Persistence — Ön Hazırlık (backend tamamlanana kadar)

Bu bug tam çözümü için backend API değişikliği gerektiriyor (`GET /conversations/:id/blocks` endpoint). Backend hazır olmadan frontend'de yapılabilecek ön hazırlık:

**Dosya:** `apps/web/src/hooks/useConversations.ts`

`fetchConversationMessages` çağrısından (satır 438–461) sonra, gelecek render block API'sine hook eklemek için placeholder:

```typescript
// BUG-2 PLACEHOLDER: Render block'ları hydrate et
// Backend GET /conversations/:id/blocks endpoint hazır olduğunda buraya çağrı eklenecek.
// İmza: fetchConversationBlocks(conversationId, accessToken) → RenderBlock[]
// Alınan bloklar presentationRunSurfaces'a inject edilecek.
// Şimdilik bu yorum blok implement edilecek alanı işaretliyor.
```

Backend API için yapılması gerekenler (ayrı PR, backend dev gerekli):

1. `apps/server/src/routes/conversations.ts`'e ekle:
   ```
   GET /conversations/:id/blocks
   → { blocks: RenderBlock[] }
   ```
   Sorgu: conversation'a ait `render_block` kayıtlarını `created_at DESC` sıralı döndür.

2. DB'de render_block'ların persist edildiğini doğrula — eğer edilmiyorsa `run-execution.ts`'teki `sendRenderBlock` emit'inden önce persist adımı ekle.

3. Frontend: `useConversations.ts:438` bloğuna `fetchConversationBlocks` çağrısı ekle; sonuç `chatStore.setPresentationState` ile `presentationRunSurfaces`'a inject edilsin.

> **Bu placeholder dışında frontend'de kod değişikliği yapma** — backend hazır olmadan incomplete state'e yol açar.

---

### IMPL-04 Done Kriterleri

- [ ] `pnpm typecheck` → sıfır hata
- [ ] `pnpm lint` → sıfır hata
- [ ] Manuel test (BUG-12): Network bağlantısını kes → 12 saniye bekle → composer kilidi açılıyor, hata mesajı görünüyor
- [ ] Manuel test (BUG-14): Memory write fail senaryosunu simüle et (sunucu log'larından) → frontend'de "Bilgi kaydedilemedi" mesajı görünüyor
- [ ] BUG-2 için backend PR açık ve placeholder yorumu repoda mevcut

---
---

## Genel Kurallar (Her Prompt İçin)

### YAPMA listesi
- `eslint-disable` veya `@ts-ignore` / `@ts-expect-error` ekleme — TypeScript hatasını düzelt
- Mevcut `runa-migrated-components-*` class adlarını silme (başka component'lar kullanıyor olabilir)
- `components.css`'i düzenleme — bu dosya UI-OVERHAUL-02 kapsamı
- `pnpm typecheck` geçmeden PR açma
- Satır numaralarını sabit kabul etme — önce `grep`/arama ile konumu doğrula

### Uygulama sırası
```
IMPL-01 → commit → typecheck/lint/build geç
IMPL-02 → commit → typecheck/lint/build geç
IMPL-03 → commit → typecheck/lint/build geç
IMPL-04 → commit → typecheck/lint/build geç
```

---

## IMPL-05 — Sprint F+G: Persistence, CSS Migration ve Performance

**Kapsam:** BUG-2 (F5 persistence — backend gerekli) + BUG-7 (CSS tech debt) + BUG-11 (useMemo performance)  
**Etkilenen dosyalar:**
- `apps/server/src/routes/conversations.ts`
- `apps/server/src/persistence/conversation-store.ts`
- `apps/web/src/hooks/useConversations.ts`
- `apps/web/src/hooks/useChatRuntime.ts`
- `apps/web/src/stores/chat-store.ts`
- `apps/web/src/components/chat/*.tsx` (25+ component)
- `apps/web/src/styles/routes/chat-migration.css`

---

### BUG-2: F5 Persistence — Backend Entegrasyonu

**Problem:** Render block'lar DB'de persist edilmiyor. Sadece WebSocket üzerinden gönderiliyor.

**Mevcut durum:**
- `run-execution.ts:2005` → `sendServerMessage(socket, createPresentationBlocksMessage(...))` sadece socket'e gönderiyor
- `conversation-store.ts:135-154` → sadece metin mesajları (`insertConversationMessage`, `listConversationMessages`)
- DB'de `render_block` tablosu yok

**Düzeltme — 3 adım:**

#### Adım 1: DB Schema — render_block tablosu oluştur

Backend DB'de (Supabase/PostgreSQL) yeni tablo:
```sql
CREATE TABLE conversation_render_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  block_type TEXT NOT NULL,
  block_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversation_render_blocks_conversation_id ON conversation_render_blocks(conversation_id);
CREATE INDEX idx_conversation_render_blocks_run_id ON conversation_render_blocks(run_id);
```

#### Adım 2: conversation-store.ts — yeni method'lar ekle

Dosya: `apps/server/src/persistence/conversation-store.ts`

```typescript
// Interface'e ekle
interface ConversationStore {
  // ... mevcut method'lar ...
  insertRenderBlock(record: NewRenderBlockRecord): Promise<DatabaseRenderBlockRecord>;
  listRenderBlocks(conversationId: string): Promise<readonly DatabaseRenderBlockRecord[]>;
}

// Type tanımları
interface NewRenderBlockRecord {
  readonly conversation_id: string;
  readonly run_id: string;
  readonly block_type: string;
  readonly block_payload: Record<string, unknown>;
}

interface DatabaseRenderBlockRecord {
  readonly id: string;
  readonly conversation_id: string;
  readonly run_id: string;
  readonly block_type: string;
  readonly block_payload: Record<string, unknown>;
  readonly created_at: string;
}
```

**Implementasyon:**
```typescript
async insertRenderBlock(record: NewRenderBlockRecord): Promise<DatabaseRenderBlockRecord> {
  await this.#ready;
  return this.#client.insert_render_block_row(record);
}

async listRenderBlocks(conversationId: string): Promise<readonly DatabaseRenderBlockRecord[]> {
  await this.#ready;
  return this.#client.list_render_block_rows(conversationId);
}
```

#### Adım 3: conversations.ts — GET endpoint ekle

Dosya: `apps/server/src/routes/conversations.ts`

```typescript
// Import ekle (store'a ekle)
import { listRenderBlocks } from '../persistence/conversation-store.js';

// Interface ekle
interface RenderBlocksReply {
  readonly blocks: ReadonlyArray<{
    readonly id: string;
    readonly run_id: string;
    readonly type: string;
    readonly payload: Record<string, unknown>;
    readonly created_at: string;
  }>;
}

// Route ekle
server.get<{ Params: ConversationParams; Reply: RenderBlocksReply }>(
  '/conversations/:conversationId/blocks',
  async (request, reply) => {
    requireAuthenticatedRequest(request);
    try {
      const conversationId = normalizeConversationId(request.params.conversationId);
      const blocks = await listRenderBlocks(
        conversationId,
        conversationScopeFromAuthContext(request.auth),
      );
      return {
        blocks: blocks.map((b) => ({
          id: b.id,
          run_id: b.run_id,
          type: b.block_type,
          payload: b.block_payload,
          created_at: b.created_at,
        })),
      };
    } catch (error) {
      if (error instanceof ConversationStoreAccessError) {
        return replyWithConversationStoreError(reply, error);
      }
      throw error;
    }
  },
);
```

#### Adım 4: run-execution.ts — block persist et

Dosya: `apps/server/src/ws/run-execution.ts`

`sendServerMessage(createPresentationBlocksMessage(...))` çağrısından **sonra** ekle:
```typescript
// Render block'ları DB'ye persist et
for (const block of turnPresentationBlocks) {
  await conversationStore?.insertRenderBlock({
    conversation_id: payload.conversation_id,
    run_id: payload.run_id,
    block_type: block.type,
    block_payload: block.payload as Record<string, unknown>,
  });
}
```

#### Adım 5: Frontend — placeholder'ı aktif koda çevir

Dosya: `apps/web/src/hooks/useConversations.ts`

Mevcut placeholder (satır ~460 sonrası):
```typescript
// BUG-2 PLACEHOLDER: Render block'ları hydrate et
```

Şu kodla değiştir:
```typescript
// BUG-2: Render block'ları DB'den hydrate et
const nextBlocks = await fetch(
  `/conversations/${encodeURIComponent(activeConversationId)}/blocks`,
  {
    headers: { Authorization: `Bearer ${accessToken}` },
  },
);
if (nextBlocks.ok) {
  const { blocks } = await nextBlocks.json();
  if (blocks?.length > 0) {
    const presentationBlocks = blocks.map((b: RenderBlock) => ({
      block: b,
      run_id: b.run_id,
      created_at: b.created_at,
    }));
    chatStore.setPresentationState((s) => ({
      ...s,
      presentationRunSurfaces: [...s.presentationRunSurfaces, ...presentationBlocks],
    }));
  }
}
```

---

### BUG-7: CSS Migration (~365 migration class)

**Problem:** 25+ component'te `runa-migrated-components-chat-*` global class'ları kullanılıyor. Design token'lar mevcut ama component-level CSS Module yok.

**Mevcut durum:**
- `chat-migration.css`: 3519 satır, ~365 unique class prefix
- 25+ TSX component dosyasında ~211 usage
- Design token'lar: `var(--color-text)`, `var(--color-surface)`, `--radius-soft`, vs.

**Düzeltme — Component bazlı CSS Module oluştur**

#### Öncelik sırası (en çok kullanılandan az kullanılana):

| Öncelik | Component | Migration Class Sayısı |
|---------|-----------|----------------------|
| 1 | ChatComposerSurface | ~30 |
| 2 | RunProgressPanel | ~19 |
| 3 | PresentationRunSurfaceCard | ~24 |
| 4 | PersistedTranscript | ~5 |
| 5 | ToolActivityIndicator | ~4 |
| 6 | StreamingMessageSurface | ~1 |
| 7 | CurrentRunSurface | ~4 |
| 8 | VoiceComposerControls | ~1 |
| 9 | +17 diğer | ~257 |

#### Her component için adımlar:

**Örnek: ToolActivityIndicator**

1. **Yeni CSS Module oluştur:**
   ```
   apps/web/src/components/chat/ToolActivityIndicator.module.css
   ```

2. **CSS içeriği (chat-migration.css'den taşı):**
   ```css
   .container {
     display: flex;
     flex-direction: column;
     gap: 8px;
   }
   
   .item {
     display: flex;
     align-items: center;
     gap: 6px;
   }
   
   .status {
     display: inline-flex;
     align-items: center;
     gap: 4px;
     font-size: 0.75rem;
     color: var(--color-text-muted, #9ca3af);
   }
   
   .label {
     font-size: 0.8rem;
     color: var(--color-text-secondary, #d1d5db);
   }
   ```

3. **TSX dosyasında import ve class güncelle:**
   ```typescript
   // Önce
   import styles from './ToolActivityIndicator.module.css';
   
   // className güncelle
   // Önce: className="runa-migrated-components-chat-toolactivityindicator-1"
   // Sonra: className={styles.container}
   ```

4. **chat-migration.css'den ilgili satırları kaldır** (opsiyel, UI-OVERHAUL-02 kapsamı)

#### Önemli notlar:

- **YAPMA:** `components.css` dosyasını düzenleme — bu UI-OVERHAUL-02 kapsamı
- **YAPMA:** `runa-migrated-components-*` class'ları tamamen kaldırma — başka component'ler kullanıyor olabilir
- **YAPMA:** Inline style'ları kaldırma — bunlar ayrı iş
- **Design token kullan:** CSS variable'ları (`var(--color-*)`) kullan, hardcoded renk değerleri verme

#### Frontend yapılacaklar (sıralı):

1. **StreamingMessageSurface** — En basit, tek class
2. **ToolActivityIndicator** — 4 class, basit
3. **PersistedTranscript** — 5 class, ayrıca BUG-10 balon düzeni gerekli
4. **RunProgressPanel** — 19 class, BUG-5 (ThinkingBlock) ile ilişkili
5. **ChatComposerSurface** — 30 class, en karmaşık

---

### BUG-11: useMemo Dependency İzolasyonu

**Problem:** `useChatRuntime` return'daki `useMemo` 37 dependency içeriyor. Her token'da tüm hook tüketicileri re-render oluyor.

**Mevcut durum:**
- `chat-store.ts:120-129` → `useChatStoreSelector` zaten selector pattern kullanıyor
- State zaten 4 slice'a ayrılmış: `connection`, `presentation`, `runtimeConfig`, `transport`
- Problem: `useMemo` return object'i **tüm state'leri** tek seferde döndürüyor

**Düzeltme — Granüler selector yaklaşımı:**

#### Adım 1: Mevcut selector'ları incele

```typescript
// chat-store.ts:131-145
export function selectConnectionState(state: ChatStoreState): ConnectionStoreState
export function selectPresentationState(state: ChatStoreState): PresentationStoreState
export function selectRuntimeConfigState(state: ChatStoreState): RuntimeConfigState
export function selectTransportState(state: ChatStoreState): TransportStoreState
```

#### Adım 2: Daha granüler selector'lar ekle

```typescript
// chat-store.ts'a ekle

// Presentation state'den streaming'i izole et
export function selectStreamingState(state: ChatStoreState) {
  return {
    currentStreamingRunId: state.presentation.currentStreamingRunId,
    currentStreamingText: state.presentation.currentStreamingText,
  };
}

// Presentation state'den surfaces'i izole et
export function selectPresentationSurfaces(state: ChatStoreState) {
  return {
    expandedPastRunIds: state.presentation.expandedPastRunIds,
    presentationRunId: state.presentation.presentationRunId,
    presentationRunSurfaces: state.presentation.presentationRunSurfaces,
    pendingInspectionRequestKeys: state.presentation.pendingInspectionRequestKeys,
    staleInspectionRequestKeys: state.presentation.staleInspectionRequestKeys,
  };
}

// Connection state'den submission status'u izole et
export function selectSubmissionState(state: ChatStoreState) {
  return {
    isSubmitting: state.connection.isSubmitting,
    connectionStatus: state.connection.connectionStatus,
  };
}
```

#### Adım 3: useChatRuntime'da selector kullanımı güncelle

Dosya: `apps/web/src/hooks/useChatRuntime.ts`

**Önce:**
```typescript
const {
  currentStreamingRunId,
  currentStreamingText,
  presentationRunSurfaces,
  // ...
} = useChatStoreSelector(chatStore, selectPresentationState);
```

**Sonra — kritik state'leri ayrı selector'larla al:**
```typescript
// Streaming state — en sık değişen, ayrı tut
const streamingState = useChatStoreSelector(chatStore, selectStreamingState);
const { currentStreamingRunId: streamingRunId, currentStreamingText: streamingText } = streamingState;

// Presentation surfaces — block'larla birlikte
const surfacesState = useChatStoreSelector(chatStore, selectPresentationSurfaces);
const { expandedPastRunIds, presentationRunSurfaces } = surfacesState;

// Submission state — isSubmitting
const submissionState = useChatStoreSelector(chatStore, selectSubmissionState);

// Diğer state'ler...
const connectionStatus = useChatStoreSelector(chatStore, (s) => s.connection.connectionStatus);
```

#### Adım 4: useMemo dependency azalt

```typescript
// Önce (37 dependency)
return useMemo(
  () => ({
    // ... tüm fields
  }),
  [
    accessToken, attachments, apiKey, approvalMode, connectionStatus,
    presentationSurfaceState, currentRunFeedback, currentStreamingRunId,
    currentStreamingText, selectedDesktopTargetConnectionId, expandedPastRunIds,
    includePresentationBlocks, isSubmitting, isRuntimeConfigReady, lastError,
    latestRunRequestIncludesPresentationBlocks, messages, model,
    pendingInspectionRequestKeys, presentationRunSurfaces, prompt, provider,
    requestInspection, resolveApproval, retryTransport, runTransportSummaries,
    chatStore, setApiKey, setApprovalMode, setIncludePresentationBlocks,
    setModel, setPastRunExpanded, setProvider, staleInspectionRequestKeys,
    submitRunRequest, transportErrorCode,
  ],
);

// Sonra (daha az dependency — sadece granüler selector'lar dönüşüyor)
return useMemo(
  () => ({
    // ... tüm fields — DEĞİŞMEZ
  }),
  [
    accessToken, attachments, apiKey, approvalMode,
    // connectionStatus — ayrı selector, daha az re-render
    // isSubmitting — ayrı selector
    streamingRunId, streamingText, // <- granüler
    // presentationRunSurfaces — ayrı selector
    expandedPastRunIds, presentationRunId, presentationRunSurfaces, // <- granüler
    // ...
  ],
  // Not: Selector'lar useSyncExternalStore kullandığı için
  // sadece selector'ların return ettiği değer değiştiğinde re-render olur
);
```

#### Adım 5: Streaming bileşenleri izole et

Dosya: `apps/web/src/components/chat/StreamingMessageSurface.tsx`

Zaten ayrı component — mevcut yapıyı koru:
```typescript
// Bu component zaten sadece streaming state kullanıyor
// useChatStoreSelector ile directly subscribe olabilir
const streamingText = useChatStoreSelector(chatStore, (s) => s.presentation.currentStreamingText);
```

---

### IMPL-05 Done Kriterleri

- [ ] `pnpm typecheck` → sıfır hata
- [ ] `pnpm lint` → sıfır hata
- [ ] **BUG-2**: F5 sonrası approval kartları, tool result'lar, code block'lar geri geliyor
- [ ] **BUG-7**: İlk 5 component (StreamingMessageSurface, ToolActivityIndicator, PersistedTranscript, RunProgressPanel, ChatComposerSurface) için CSS Module oluşturuldu; migration class sayısı ~150 azaltıldı
- [ ] **BUG-11**: Stream sırasında sadece streaming-aware bileşenler re-render oluyor; timeline, composer, sidebar re-render olmuyor

---

### Bağımlılıklar ve Sıralama

| Adım | Önceki | Sonraki | Not |
|------|--------|---------|-----|
| BUG-2 Adım 1-3 (Backend) | — | Adım 4 | Backend tamamlanmadan frontend çalışmaz |
| BUG-2 Adım 4 (run-execution) | Adım 3 | Adım 5 | Block persist -> frontend hydrate |
| BUG-2 Adım 5 (Frontend) | Adım 4 | — | Placeholder'ı aktif koda çevir |
| BUG-7 | — | — | Bağımsız, component bazlı ilerle |
| BUG-11 | — | — | BUG-5 ile parallelism: RunProgressPanel'de selector kullanımı |

---

### Referans dosyalar
- `CHAT-UI-AUDIT-2026-05.md` — bug kök nedeni ve file:line referansları
- `apps/server/src/persistence/conversation-store.ts` — mevcut store pattern
- `apps/web/src/stores/chat-store.ts` — selector pattern implementasyonu
- `apps/web/src/styles/routes/chat-migration.css` — 3519 satır migration CSS
- `apps/web/src/hooks/useChatRuntime.ts:1304-1386` — useMemo implementation
- `docs/archive/ui-overhaul/UI-OVERHAUL-04.md` — bu promtların UI-OVERHAUL-04 ile ortusen kapsamı
- `apps/web/src/styles/components.css:4–33` — tasarım felsefesi (ihlal etme)
