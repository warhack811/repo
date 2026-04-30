# UI-PHASE-6 - Sidebar, Auth, Settings, Project Memory ve Device Presence

> Bu belge tek basina IDE LLM gorev prompt'udur. FAZ 1-5 tamamlanmis veya repo esdeger chat-first UI zeminine sahip olmalidir.
> Baslamadan once `AGENTS.md`, `implementation-blueprint.md`, `docs/TASK-TEMPLATE.md`, `PROGRESS.md` ve onceki UI faz kapanis notlari okunmalidir.

## Urun Amaci

Bu faz Runa'nin kullanici oturumu, conversation navigasyonu, settings, project memory ve connected desktop guven yuzeylerini modernlestirir. Hedef sidebar'i sadece conversation listesi yapmak degil; Runa'nin "projeyi taniyan, hatirlayan, cihaza izinli baglanan calisma ortagi" vaadini urunlestirecek zemini kurmaktir.

## Rakip Citasi ve Runa Farki

- ChatGPT Projects, proje kaynaklari, talimatlari, sohbetleri ve project memory'yi tek workspace mantiginda topluyor.
- Deep Research kullaniciya hangi kaynaklarla calisacagini sectirme ve ilerlemeyi izletme beklentisi dogurdu.
- Manus Browser Operator ve Claude Computer Use gibi yuzeyler cihaz/browser kontrolunde izin, durdurma, log ve guven dilini zorunlu hale getirdi.

Runa'nin farki: sidebar ve settings, operator paneli gibi degil; kullanicinin baglam, hafiza, gizlilik ve bagli cihaz kontrolunu rahatca anlayacagi ikinci katman olmali.

Kaynakli referanslar:

- ChatGPT Projects: https://help.openai.com/en/articles/10169521
- ChatGPT Deep Research: https://help.openai.com/articles/10500283
- Claude Research: https://www.anthropic.com/news/research
- Claude Computer Use: https://docs.anthropic.com/en/docs/build-with-claude/computer-use
- Manus Browser Operator: https://manus.im/docs/features/browser-operator
- Perplexity Comet: https://www.perplexity.ai/comet/

## Gorev Bilgileri

- **Sprint:** Core Hardening Phase 2 - Track C
- **Gorev:** Sidebar, login/auth, settings, project memory ve device presence UI zeminini kur
- **Modul:** `apps/web`
- **KARAR.MD Maddesi:** Identity, Memory, Desktop companion, Human Ops

## Baglam

- **Ilgili interface:** `AuthContext`, conversation route/store, desktop device presence tipleri varsa `@runa/types`
- **Referans dosyalar:** `apps/web/src/components/chat/ConversationSidebar.tsx`, `apps/web/src/pages/LoginPage.tsx`, `apps/web/src/pages/SettingsPage.tsx`, `apps/web/src/pages/ChatPage.tsx`, `apps/web/src/lib/desktop-devices.ts`, `apps/web/src/hooks/useAuth.ts`, `apps/web/src/hooks/useConversations.ts`
- **Kritik kural:** Auth hook ve conversation store davranisi bu fazda redesign edilmez. UI mevcut hook/route sonuclarini daha iyi sunar.

## Kural Esnetme Notu

Bu fazda route/shell degisikligi ve settings modal yaklasimi uygulanabilir. Ancak:

- Supabase auth akisi degistirilmez.
- Dev auth helper production yuzeye tasinmaz.
- Desktop/device presence verisi yoksa fake online cihaz gosterilmez.
- Project memory UI'i eklenecekse gercek veri kaynagi yoksa "hazir degil" veya "baglam yok" durumu durust gosterilir.

## Gorev 6A - Auth/Conversation/Device Envanteri

Uygulamadan once:

```powershell
rg -n "ConversationSidebar|useConversations|LoginPage|SettingsPage|useAuth|desktopDevices|DesktopDevicePresence|Developer Mode|localStorage" apps/web/src
Get-Content -Raw apps/web/src/pages/LoginPage.tsx
Get-Content -Raw apps/web/src/pages/SettingsPage.tsx
Get-Content -Raw apps/web/src/components/chat/ConversationSidebar.tsx
```

Endpoint veya hook olmadigini varsayma; ara.

## Gorev 6B - ConversationSidebar

Yeni konum tercih edilirse `apps/web/src/components/sidebar/ConversationSidebar.tsx` olustur; mevcut konum korunacaksa mevcut dosyayi modernlestir.

Beklenen prop yaklasimi:

```ts
type ConversationSidebarProps = Readonly<{
  isOpen: boolean;
  onClose: () => void;
  activeConversationId?: string | null;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  conversations: readonly ConversationListItem[];
  isLoading?: boolean;
  error?: string | null;
}>;
```

Gereksinimler:

- Header: Runa wordmark + new chat button.
- Search input: conversation title/preview icinde client-side filter.
- Gruplama: Today, Yesterday, Previous 7 days, Older.
- Conversation item: title, preview, updated label, active state.
- Empty state: "Henuz sohbet yok" + new chat.
- Loading: skeleton.
- Error: durust, retry action varsa goster.
- Footer: account/settings trigger.
- Mobile overlay: backdrop, Escape close, focus safe.

Member/share davranisi mevcutsa silme; modal veya secondary action icine tasinabilir.

## Gorev 6C - Project Memory Sidebar Zemini

Sidebar icinde veya settings icinde project memory icin minimal, durust yuzey ekle:

```ts
type ProjectMemorySummaryProps = Readonly<{
  status: 'available' | 'empty' | 'unavailable';
  summary?: string;
  sourceCount?: number;
}>;
```

Kurallar:

- Gercek project memory verisi yoksa fake summary uretme.
- Kullaniciya "Runa bu projede ne biliyor?" sorusunun cevabi icin yer ayir.
- Project sources future yuzeyi icin `SourceBadge` kullanilabilir.
- Memory controls privacy ayarlarina baglanacaksa simdilik disabled/coming-soon degil, "bu fazda baglanmadi" diye durust state kullan.

## Gorev 6D - LoginPage

`apps/web/src/pages/LoginPage.tsx` modernlestir:

Gereksinimler:

- Centered, sakin, consumer-grade login.
- Login / Signup toggle.
- Email/password form.
- Google/GitHub OAuth mevcut hook destekliyorsa goster; destek yoksa fake button gosterme.
- Dev session button yalniz `import.meta.env.DEV` ise gorunur ve dikkat cekmez.
- Token auth modu varsa developer-only secondary link.
- Error mesajlari inline ve anlasilir.
- `authStatus === 'bootstrapping'` loading state.
- `useAuth` davranisini degistirme.

Copy hedefi:

- "Calisma ortagina hos geldin" gibi insansi ama abartisiz.
- Teknik provider/session jargonunu ana formda one cikarma.

## Gorev 6E - SettingsModal / SettingsPage

`apps/web/src/components/settings/SettingsModal.tsx` olustur veya `SettingsPage.tsx`'i modal uyumlu hale getir:

```ts
type SettingsModalProps = Readonly<{
  open: boolean;
  onClose: () => void;
  authContext: AuthContext;
  authError: string | null;
  isAuthPending: boolean;
  onLogout: () => Promise<void>;
}>;
```

Bölümler:

1. Account
   - Email/user label
   - Plan/tier varsa goster
   - Logout

2. Preferences
   - Language
   - Theme
   - Voice preferences varsa mevcut state'e bagla

3. Privacy and Memory
   - Project memory visibility
   - "Runa hangi baglami kullaniyor?" icin summary slot
   - Data/export/delete actionlari gercek degilse fake button koyma; disabled explanation kullan.

4. Connected Desktop
   - Online/offline/stale device listesi varsa goster
   - Device yoksa "Bagli cihaz yok" de
   - Last seen, connection id gibi raw teknik bilgi default gorunumde one cikmaz; details icine gider.

5. Developer
   - Developer Mode toggle burada
   - Raw transport/model override ana chat'ten uzak tutulur.

## Gorev 6F - Device Presence Yuzeyi

`apps/web/src/components/desktop/DevicePresencePanel.tsx` veya uygun konumda minimal component kur:

```ts
type DevicePresencePanelProps = Readonly<{
  devices: readonly DesktopDevicePresenceSnapshot[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}>;
```

Kurallar:

- Sadece gercek `devices` listesini goster.
- Online/stale/offline ayrimi varsa DeviceBadge ile goster.
- "Bu cihazdan islem yaptir" gibi action varsa approval gerekecegini copy'de belirt.
- Desktop capability operator paneli gibi degil, guvenli ikinci katman gibi gorunmeli.

## Gorev 6G - CSS

`apps/web/src/styles/sidebar.css` ve `apps/web/src/styles/auth.css` olustur veya mevcut CSS'e ayrik bolumler ekle.

Gereksinimler:

- Sidebar sticky header/footer.
- Conversation list long title/preview tasmaz.
- Mobile overlay focus ve scroll davranisi dogru.
- Login form mobile-first.
- Settings modal 320px ekranda tasmaz.

## Gorev 6H - App/Route Entegrasyonu

- Header/settings trigger SettingsModal acabilir.
- `/settings` route korunuyorsa modal veya page olarak calismali; blank state olmamali.
- `/account` varsa redirect veya settings tab olarak ele alinabilir.
- Developer mode ana chat'te default gorunmez.

## Sinirlar

- `useAuth`, `useConversations`, server auth route veya Supabase config redesign yapma.
- `apps/server/**`, `packages/types/**`, `apps/desktop-agent/**` degistirme.
- Fake OAuth/provider button gosterme.
- Fake device veya fake memory uretme.
- Payment/subscription backend acma.
- New native desktop dependency ekleme.

## Degistirilebilecek Dosyalar

- `apps/web/src/components/chat/ConversationSidebar.tsx`
- `apps/web/src/components/sidebar/ConversationSidebar.tsx`
- `apps/web/src/pages/LoginPage.tsx`
- `apps/web/src/pages/SettingsPage.tsx`
- `apps/web/src/components/settings/SettingsModal.tsx`
- `apps/web/src/components/desktop/DevicePresencePanel.tsx`
- `apps/web/src/components/chat/ChatHeader.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/styles/sidebar.css`
- `apps/web/src/styles/auth.css`
- `apps/web/src/index.css`
- `PROGRESS.md`

## Degistirilmeyecek Dosyalar

- `apps/server/**`
- `packages/types/**`
- `apps/desktop-agent/**`
- `apps/web/src/hooks/useAuth.ts`
- `apps/web/src/hooks/useConversations.ts`
- `apps/web/src/lib/auth-client.ts`

## Done Kriteri

- [ ] Sidebar conversation listesi, arama, new chat, grouping ve mobile overlay calisir.
- [ ] Login email/password ve mevcut OAuth/dev flows bozulmadi.
- [ ] Settings modal/page account, preferences, privacy/memory, connected desktop ve developer bolumlerini gosterir.
- [ ] Device presence gercek data yokken fake cihaz gostermez.
- [ ] Developer Mode ana chat'ten settings/dev ikinci katmanina cekildi.
- [ ] `pnpm.cmd --filter @runa/web typecheck` PASS.
- [ ] `pnpm.cmd --filter @runa/web build` PASS.
- [ ] Targeted Biome touched files icin PASS veya gercek hata raporu.

## Browser / QA Kaniti

Minimum smoke:

- Login page render.
- Authenticated shell veya mock/dev auth ile chat page render.
- Sidebar mobile open/close.
- Settings open/close, Escape close.
- Device list endpoint/env yoksa empty/error state gorunur.
- Console'da Maximum update depth veya route loop yok.

Kanit uydurma. Auth/env yoksa raporda belirt.

## PROGRESS.md Kapanis Notu

Kapanis notunda:

- Sidebar/auth/settings alaninda ne degisti
- Project memory ve device presence yuzeyinde gercek data/empty state ayrimi
- Browser QA kaniti
- Kalan riskler
- Sonraki faz icin polish/a11y/performance notu
