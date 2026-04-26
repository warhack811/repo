# UI-PHASE-3 - Chat-First Layout, Ilk Karsilasma ve Mesaj Akisi

> Bu belge tek basina IDE LLM gorev prompt'udur. FAZ 1-2 tamamlanmis veya repo esdeger design primitive zeminine sahip olmalidir.
> Baslamadan once `AGENTS.md`, `implementation-blueprint.md`, `docs/TASK-TEMPLATE.md`, `PROGRESS.md`, `UI-PHASE-1.md` ve `UI-PHASE-2.md` kapanis notlari okunmalidir.

## Urun Amaci

Bu faz Runa'nin ana kullanici deneyimini chat-first hale getirir. Kullanici ilk 30 saniyede Runa'nin su dort vaadini anlamalidir:

1. Gunluk sohbet ve dusunme ortagi.
2. Kaynakli research ve rapor uretimi.
3. Proje hafizasi ve calisma baglami.
4. Izinli desktop companion / bilgisayar kullanimi.

Bu faz sadece ChatGPT/Claude benzeri gorunum yapmaz; Runa'nin farkli oldugu research, desktop ve project-memory kabiliyetlerine ilk ekran sinyali verir.

## Rakip Citasi ve Runa Farki

- ChatGPT Projects uzun sureli calismalarda proje talimati, dosya, sohbet ve memory deneyimini birlestiriyor.
- Deep Research kullaniciya plan, kaynak secimi, ilerleme ve kaynakli rapor beklentisi kazandirdi.
- Claude Research ve Claude Computer Use, chat yuzeyinde arastirma ve bilgisayar aksiyonlarini daha guvenilir sunma cizgisini yukseltti.
- Manus ve Comet gibi urunler "asistan sadece cevap vermez, is yapar" algisini ilk ekran ve browser/desktop yuzeyleriyle kuruyor.

Runa'nin farki: chat ana yoldur; operator/debug paneli degil. Ancak chat ilk ekranda Runa'nin gercek is yapabilen ajan oldugunu sade sekilde hissettirmelidir.

Kaynakli referanslar:

- ChatGPT Projects: https://help.openai.com/en/articles/10169521
- ChatGPT Deep Research: https://help.openai.com/articles/10500283
- Claude Research: https://www.anthropic.com/news/research
- Claude Computer Use: https://docs.anthropic.com/en/docs/build-with-claude/computer-use
- Manus Browser Operator: https://manus.im/docs/features/browser-operator
- Perplexity Comet: https://www.perplexity.ai/comet/

## Gorev Bilgileri

- **Sprint:** Core Hardening Phase 2 - Track C
- **Gorev:** Chat-first layout, mesaj akisi, composer ve ilk karsilasma yuzeyi
- **Modul:** `apps/web`
- **KARAR.MD Maddesi:** Presentation, UI + Desktop companion, Human Ops

## Baglam

- **Ilgili interface:** `@runa/types` icindeki mevcut WS/model/desktop tipleri okunabilir ama degistirilmez.
- **Referans dosyalar:** `apps/web/src/pages/ChatPage.tsx`, `apps/web/src/App.tsx`, `apps/web/src/components/chat/ConversationSidebar.tsx`, `apps/web/src/components/chat/ChatComposerSurface.tsx`, `apps/web/src/components/chat/CurrentRunSurface.tsx`, `apps/web/src/hooks/useChatRuntime.ts`, `apps/web/src/hooks/useConversations.ts`
- **Kritik kural:** `useChatRuntime`, `useAuth`, `useConversations`, store ve WS client davranisi bu fazda redesign edilmez. Render katmani yeni layout'a map edilir.

## Kural Esnetme Notu

Bu fazda route/shell degisikligi yapilabilir, cunku ana urun deneyimini etkiler. Ancak:

- Degisiklik once mevcut route davranisi okunarak yapilmali.
- `/`, `/chat`, `/settings`, `/developer` icin beklenen davranis acik yazilmali.
- Eski route/shell kaldirilacaksa dosya silme degil, deprecate veya kullanimi sonlandirma tercih edilmeli.
- Auth ve protected route davranisi kirilmayacak sekilde browser smoke zorunlu.

## Gorev 3A - Mevcut Chat Runtime Envanteri

Uygulamadan once su komutlari kos:

```powershell
rg -n "useChatRuntime|useConversations|ConversationSidebar|ChatComposerSurface|CurrentRunSurface|PresentationRunSurfaceCard|Developer" apps/web/src/pages/ChatPage.tsx apps/web/src/App.tsx apps/web/src/components/chat apps/web/src/hooks
Get-Content -Raw apps/web/src/App.tsx
Get-Content -Raw apps/web/src/pages/ChatPage.tsx
```

Uygulama plani bu envantere gore yapilmali. Varsayimla prop uydurma.

## Gorev 3B - ChatLayout

`apps/web/src/components/chat/ChatLayout.tsx` olustur veya mevcut layout componentini bu API'ye yaklastir:

```ts
type ChatLayoutProps = Readonly<{
  sidebar: ReactNode;
  header: ReactNode;
  messages: ReactNode;
  composer: ReactNode;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onCloseSidebar: () => void;
}>;
```

Layout gereksinimleri:

- Desktop: sidebar + header + messages + composer grid.
- Mobile: sidebar overlay, hamburger ile acilir, Escape/backdrop ile kapanir.
- Composer safe-area bottom destekler.
- Messages alani scroll olur; body scroll kilitlenmez.
- Dashboard kart hissi degil, chat calisma alani hissi verir.

## Gorev 3C - ChatHeader

`apps/web/src/components/chat/ChatHeader.tsx` olustur:

```ts
type ChatHeaderProps = Readonly<{
  conversationTitle?: string;
  connectionStatus: string;
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
  activeDesktopDeviceLabel?: string;
}>;
```

Gereksinimler:

- Sol: menu icon + Runa wordmark.
- Orta: conversation title, truncate.
- Sag: connection status, settings icon, varsa aktif desktop device badge.
- `role="banner"` ve icon button `aria-label` kullan.
- Raw transport veya model override ana header'a gelmez.

## Gorev 3D - MessageList ve MessageBubble

`apps/web/src/components/chat/MessageList.tsx` ve `MessageBubble.tsx` olustur.

```ts
type MessageListProps = Readonly<{
  messages: readonly ConversationMessage[];
  currentStreamingText: string;
  currentStreamingRunId: string | null;
  currentRunId?: string;
  isSubmitting: boolean;
  renderBlockContent: ReactNode;
  runProgressPanel: ReactNode;
}>;
```

```ts
type MessageBubbleProps = Readonly<{
  role: 'user' | 'assistant';
  content: string;
  messageId: string;
  timestamp?: string;
  isStreaming?: boolean;
}>;
```

Gereksinimler:

- Mesajlar kronolojik sirada.
- User mesaji saga yaslanmis chat balonu olmak zorunda degil; Claude/ChatGPT gibi sol akista kalabilir.
- Assistant mesaji markdown renderer icin hazir olmali.
- Auto-scroll yeni mesajda calisir ama kullanici yukari scroll ettiyse zorla alta cekmez.
- Sentinel veya scroll-position guard kullan.
- `aria-live="polite"` streaming icin kullanilir, token basina agresif announce yapilmaz.

## Gorev 3E - ChatComposer

`apps/web/src/components/chat/ChatComposer.tsx` olustur veya `ChatComposerSurface`'i adapter olarak modernlestir:

```ts
type ChatComposerProps = Readonly<{
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  connectionStatus: string;
  isRuntimeConfigReady: boolean;
  attachments: readonly ModelAttachment[];
  onAttachmentsChange: (attachments: readonly ModelAttachment[]) => void;
  accessToken?: string | null;
  isVoiceSupported: boolean;
  isListening: boolean;
  onToggleListening: () => void;
  desktopDevices: readonly DesktopDevicePresenceSnapshot[];
  selectedDesktopTargetConnectionId: string | null;
  onSelectDesktopTarget: (connectionId: string) => void;
  onClearDesktopTarget: () => void;
  lastError: string | null;
  statusLabel: string;
  submitButtonLabel: string;
}>;
```

Gereksinimler:

- Enter submit, Shift+Enter newline.
- Attachment, voice ve desktop target controls icon-first; tooltip ve `aria-label` zorunlu.
- Desktop device selector varsa "bilgisayar secildi" guven sinyali verir, operator paneline donusmez.
- Runtime config eksikse durust inline notice goster.
- Submit disabled nedeni gorunur olmali.

## Gorev 3F - EmptyState / First Impression

`apps/web/src/components/chat/EmptyState.tsx` olustur:

```ts
type EmptyStateProps = Readonly<{
  onSubmitSuggestion: (prompt: string) => void;
}>;
```

Suggestion kartlari Runa'nin dort ana vaadini tasimali:

- "Bir konuyu kaynaklariyla arastir"
- "Bu projede kaldigimiz yeri ozetle"
- "Dosyalarimi inceleyip plan cikar"
- "Bagli bilgisayarimda izinli bir is yap"

Kurallar:

- Fake capability claim yazma. Desktop presence veya project memory henuz yoksa copy "bagli bilgisayar hazirsa" / "bu projede mevcut baglamla" gibi durust olmali.
- First impression sade olmali; marketing landing page'e donmemeli.
- Mobilde tek kolon veya rahat 2 kolon; text tasmasi yok.

## Gorev 3G - App ve Route Entegrasyonu

`apps/web/src/App.tsx` ve `ChatPage.tsx` entegrasyonu yap:

- `/` ve `/chat` chat yuzeyine gitmeli.
- `/settings` mevcut route olarak calisabilir; modal entegrasyonu FAZ 6'ya birakilabilir veya bu fazda sadece trigger hazirlanabilir.
- `/developer` yalniz developer mode icin ikinci katman olmali.
- `AppShell` / `AppNav` kullanimi kaldirilacaksa dosyalar silinmez.
- `DashboardPage` ana ilk ekran olmaktan cikacaksa bunu `PROGRESS.md`'de durust yaz.

## Gorev 3H - CSS

`apps/web/src/styles/chat.css` olustur veya mevcut `index.css` icinde chat bolumunu ayir:

- `.chat-layout`
- `.chat-header`
- `.message-list`
- `.message-bubble`
- `.chat-composer`
- `.empty-state`

CSS tokenlari FAZ 1'den kullan. Font size viewport ile scale edilmez. Text tasma/overlap yasak.

## Sinirlar

- `useChatRuntime`, `useAuth`, `useConversations`, store ve WS client davranisini degistirme.
- `packages/types/**`, `apps/server/**`, `apps/desktop-agent/**` dosyalarina dokunma.
- Full settings redesign FAZ 6'ya kalsin.
- Block renderer modularizasyonu FAZ 4'e kalsin.
- Markdown renderer rewrite FAZ 5'e kalsin.
- Fake research, fake desktop, fake memory verisi uretme.

## Degistirilebilecek Dosyalar

- `apps/web/src/App.tsx`
- `apps/web/src/pages/ChatPage.tsx`
- `apps/web/src/components/chat/ChatLayout.tsx`
- `apps/web/src/components/chat/ChatHeader.tsx`
- `apps/web/src/components/chat/MessageList.tsx`
- `apps/web/src/components/chat/MessageBubble.tsx`
- `apps/web/src/components/chat/ChatComposer.tsx`
- `apps/web/src/components/chat/EmptyState.tsx`
- `apps/web/src/components/chat/ConversationSidebar.tsx` (yalniz slot uyumu gerekiyorsa)
- `apps/web/src/styles/chat.css`
- `apps/web/src/index.css`
- `PROGRESS.md`

## Degistirilmeyecek Dosyalar

- `packages/types/**`
- `apps/server/**`
- `apps/desktop-agent/**`
- `apps/web/src/hooks/**`
- `apps/web/src/stores/**`

## Done Kriteri

- [ ] Chat layout desktop ve mobile'da gorunur.
- [ ] Sidebar mobile'da overlay olarak acilir/kapanir.
- [ ] Mesaj gonderme mevcut runtime ile calisir.
- [ ] Conversation secimi bozulmadi.
- [ ] Empty state Runa'nin chat/research/project-memory/desktop vaatlerini durust sekilde anlatir.
- [ ] Auto-scroll guard calisir.
- [ ] Ana yuzeye raw transport/model override/operator panel tasinmadi.
- [ ] `pnpm.cmd --filter @runa/web typecheck` PASS.
- [ ] `pnpm.cmd --filter @runa/web build` PASS.
- [ ] Targeted Biome touched files icin PASS veya gercek dosya-bazli hata raporu.

## Browser / QA Kaniti

Zorunlu browser smoke:

- 320px, 768px, 1440px viewport screenshot veya Playwright kontrolu.
- `/` ve `/chat` blank screen degil.
- Console'da yeni React/render/import hatasi yok.
- Composer'a metin yazilip submit denenir. Live provider yoksa request'in neden blocked oldugu durust raporlanir.
- Keyboard: Tab, Enter, Shift+Enter, Escape sidebar.

Kanit uydurma. Auth veya env yoksa bunu acik yaz.

## PROGRESS.md Kapanis Notu

Kapanis notunda:

- Hangi route/layout degisti
- Hangi eski yuzeyler kullanilmiyor veya ikinci katmana cekildi
- Browser QA kaniti
- Kalan riskler
- Sonraki faz icin block renderer / markdown / settings takip notu
