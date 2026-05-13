# Runa Design Brief
**Versiyon:** 1.2
**Tarih:** 2026-05-13
**Kapsam:** apps/web + minimal `apps/server` tool kontratÄ± (yalnÄ±zca `user_label_tr` opsiyonel alanÄ±)
**StatÃ¼:** OnaylandÄ± Â· Uygulamaya kilitlendi
**Değişiklik özeti (v1.1 → v1.2):** Legacy token alias forwarding stratejisi netleştirildi (kalıcı kabul, temizleme PR-7'ye ertelendi).

---

## 1. ÃœrÃ¼n KimliÄŸi

Runa, Ã§ok cihazlÄ± bir AI iÅŸ ortaÄŸÄ±dÄ±r. Telefon, masaÃ¼stÃ¼ ve sunucu Ã¼zerinde aynÄ± hesapla Ã§alÄ±ÅŸÄ±r; kullanÄ±cÄ± her platformdan ajana ulaÅŸÄ±r ve gÃ¶rev yaptÄ±rÄ±r.

**Tek cÃ¼mle:**  
> Runa, projeni bilen sakin bir Ã§alÄ±ÅŸma ortaÄŸÄ±dÄ±r.

**Rakiplerle konum:**  
ChatGPT ve Claude'dan daha samimi ve Ã§ok cihazlÄ±. Claude Cowork'tan daha esnek (tek masaÃ¼stÃ¼ne baÄŸÄ±mlÄ± deÄŸil). Cursor/Claude Code'dan Ã§ok daha az teknik yÃ¼zey. Bu kesiÅŸim noktasÄ± ÅŸu an piyasada boÅŸ.

**TasarÄ±m Ã§Ä±tasÄ±:**  
Claude Cowork, Claude Code, Codex, Linear, Raycast, Arc. Bir iÃ§ araÃ§ deÄŸil; consumer-grade, tÃ¼ketici Ã¼rÃ¼nÃ¼ kalitesi.

---

## 2. Karakter ve Ses Tonu

### Temel karakter
- **Sakin.** Panik etmez, durumu abartmaz, gereksiz uyarÄ± gÃ¶stermez.
- **Yetkin.** SÃ¶z verdiÄŸini yapar; baÅŸarÄ± iÃ§in bÃ¼yÃ¼k yeÅŸil kart gerekmez.
- **DÃ¼rÃ¼st.** Hata olunca aÃ§Ä±k sÃ¶yler, Ã§Ã¶zÃ¼m Ã¶nerir.
- **BaÄŸlama uyumlu.** KullanÄ±cÄ±nÄ±n tonunu aynalar â€” kÄ±sa mesaja kÄ±sa yanÄ±t, teknik soruya teknik yanÄ±t.

### Ses tonu (yazÄ± dili)
- Mirror (varsayÄ±lan): kullanÄ±cÄ±nÄ±n tonuna uyum.
- KullanÄ±cÄ± Ayarlar'dan "Resmi" veya "Samimi" seÃ§ebilir.
- YanÄ±t uzunluÄŸu: Dengeli (varsayÄ±lan), KÄ±sa, AyrÄ±ntÄ±lÄ± â€” ayarlanabilir.

### Ne DEÄÄ°LDÄ°R
- SÃ¼rekli "hazÄ±r" durumunu gÃ¶steren bir dashboard deÄŸil.
- Runtime log veya debug konsol deÄŸil.
- Her adÄ±mÄ± Ã¶zel kartla kutlayan bir sistem deÄŸil.
- Anneanne'yi Ã¼rkÃ¼tecek teknik bir panel deÄŸil.

---

## 3. Renk Sistemi

### Felsefe
SÄ±cak, doÄŸal, dÃ¼ÅŸÃ¼k doygunluk. Anthropic'in sÄ±cak tonuyla aynÄ± aile ama daha soft ve sofistike. SoÄŸuk teknoloji kliÅŸesinden uzak; "el yapÄ±mÄ± defter" ile "gece masasÄ±" arasÄ±nda bir his.

### Temel token'lar (Ember Dark â€” varsayÄ±lan)

```css
--surface-1: #14110D;   /* en derin zemin */
--surface-2: #1E1A14;   /* kart / input yÃ¼zeyi */
--surface-3: #2A241C;   /* ayÄ±rÄ±cÄ±, hover */
--surface-4: #332C22;   /* gÃ¼Ã§lÃ¼ border */

--ink-1: #E8DFCD;       /* ana metin */
--ink-2: #B9AE99;       /* ikincil metin */
--ink-3: #9A8C76;       /* placeholder, muted â€” yalnÄ±zca â‰¥18px veya â‰¥14px+600 weight */

--accent:   #E0805C;    /* birincil vurgu â€” kor turuncu */
--accent-2: #F4A876;    /* aÃ§Ä±k vurgu */
--accent-bg: #2A1E15;   /* accent zemin chip'leri */

--status:   #8FA277;    /* baÅŸarÄ± / Ã§evrimiÃ§i â€” sage yeÅŸil */
--status-bg: #1D2618;

--error:    #C97064;    /* hata */
--error-bg: #2A1A18;

--warn:     #D4A055;    /* yÃ¼ksek risk uyarÄ±sÄ± */
--warn-bg:  #2A2118;

--user-bg: #E8DFCD;     /* kullanÄ±cÄ± mesaj balonu */
--user-fg: #14110D;

--hairline: rgba(232, 223, 205, 0.08);
```

### Tema ailesi â€” MVP ve yol haritasÄ±

| Ton | Status | SÄ±nÄ±f | Notlar |
|---|---|---|---|
| Ember Dark | **MVP** | (varsayÄ±lan) | TÃ¼m CSS referans noktasÄ± |
| Ember Light | **MVP** | `.th-light` | `prefers-color-scheme: light` otomatik |
| Rose Dark | **MVP** | `.th-rose` | Åafak pembe-bal, genÃ§/kadÄ±n kitle |
| Sage Dark | v1.1 | `.th-sage` | Orman yeÅŸili, yetiÅŸkin/profesyonel |
| Slate Dark | Sonra | `.th-slate` | Gece mavisi, sysadmin |
| Plum Dark | Sonra | `.th-plum` | AlacakaranlÄ±k moru |
| Sand Dark | Sonra | `.th-sand` | Bal/kum, sÄ±cak nÃ¶tr |

**Uygulama notu:** TÃ¼m tonlar tek CSS dosyasÄ±, class override. MVP'de kullanÄ±cÄ± arayÃ¼zÃ¼nde Ember + Rose + Ember Light sunulur. Sistem temasÄ±nÄ± otomatik takip: `prefers-color-scheme` Ã¼zerinden Ember Dark â†” Ember Light geÃ§iÅŸi.

### Legacy token alias forwarding stratejisi (v1.2)

- `tokens.css` içindeki legacy token adlarının alias-forward katmanı (`--page-background`, `--surface-canvas`, `--border-primary`, `--text-link`, `--shadow-glow`, `--space-panel`, vb.) kalıcı geçiş stratejisi olarak kabul edilir.
- Bu alias'lar PR-1 kapsamında silinmez; temizleme işi PR-7 kapsamına planlanmıştır.
- Bu karar sadece dokümantasyon notudur; mevcut çalışan token map davranışı korunur.

### Kontrast kuralÄ± (WCAG AA â€” yeni v1.1)

- `--ink-3` kÃ¼Ã§Ã¼k metin iÃ§in kullanÄ±lmaz. Kural: **font-size â‰¥ 18px** veya **font-size â‰¥ 14px + font-weight â‰¥ 600**.
- Bunun dÄ±ÅŸÄ±ndaki tÃ¼m muted metin `--ink-2` kullanÄ±r.
- Lint/test guard: `apps/web` iÃ§inde `color: var(--ink-3)` ile birlikte `font-size` < 18px ve weight < 600 olan bileÅŸenler `DesignLanguageLock.test.ts` tarafÄ±ndan bloklanÄ±r.
- Hesaplanan kontrast oranlarÄ± (Ember Dark): `ink-1 / surface-1` â‰ˆ 14.2, `ink-2 / surface-1` â‰ˆ 8.5, `ink-3 / surface-1` â‰ˆ 4.6 (large/bold OK), `accent / surface-1` â‰ˆ 5.7, `status / surface-1` â‰ˆ 5.2.

### Ember Light token'larÄ±
```css
--surface-1: #F6F1E8;
--surface-2: #EDE6D6;
--surface-3: #DFD5BE;
--ink-1:     #1F1B16;
--ink-2:     #3A332A;
--ink-3:     #5F564A;   /* light tema â€” kontrast iÃ§in koyulaÅŸtÄ±rÄ±ldÄ± */
--accent:    #B85A3C;
--accent-2:  #D97757;
--accent-bg: #F0E0D2;
--status:    #6B7A5C;
--user-bg:   #1F1B16;
--user-fg:   #F6F1E8;
```

### Rose Dark token'larÄ±
```css
--surface-1: #18110F;
--surface-2: #211719;
--surface-3: #2E2122;
--surface-4: #3A292B;
--ink-1:     #EFDCD8;
--ink-2:     #C2A8A5;
--ink-3:     #8A7370;
--accent:    #D88C8C;
--accent-2:  #ECAAA8;
--accent-bg: #2D1D1F;
--status:    #B5A87A;
--user-bg:   #EFDCD8;
--user-fg:   #18110F;
```

---

## 4. Tipografi

```
Body:       Inter (mevcut, korunur)
KiÅŸilik:    Instrument Serif â€” agent ismi, bÃ¼yÃ¼k baÅŸlÄ±klar, onboarding
Kod/Mono:   JetBrains Mono â€” terminal Ã§Ä±ktÄ±sÄ±, dosya yollarÄ±, tool input/output
```

**ÃœÃ§ ses prensibi:**
- `Inter` bilgi taÅŸÄ±r, okunabilir.
- `Instrument Serif` karakter taÅŸÄ±r â€” "Runa" ismi, Ã¶nemli vurgular.
- `JetBrains Mono` teknik gerÃ§eÄŸi taÅŸÄ±r â€” kod, yol, komut.

**Boyutlar:**
```css
--text-xs:  11px;   /* timestamp, muted meta */
--text-sm:  13px;   /* ikincil etiketler */
--text-md:  14.5px; /* body, mesajlar */
--text-lg:  18px;   /* section baÅŸlÄ±klarÄ± */
--text-xl:  22px;   /* sheet/panel baÅŸlÄ±klarÄ± */
--text-2xl: 28-36px; /* empty state, onboarding */
```

---

## 5. Signature Mark

### Karar
Mevcut compass/sun SVG kaldÄ±rÄ±lÄ±r. Yeni mark: **Kor / Ember**.

### TanÄ±m
DÃ¶rt organik yapraktan oluÅŸan ateÅŸ formu. Merkezdeki dolu daire etrafÄ±nda asimetrik bÃ¼yÃ¼yen ve kÃ¼Ã§Ã¼len yapraklar. Accent + accent-2 renk ikilisi ile iki tonda Ã§izilir.

```svg
<!-- Runa Ember Mark â€” referans SVG -->
<svg viewBox="0 0 48 48" fill="none">
  <circle cx="24" cy="24" r="5" fill="var(--accent)"/>
  <path d="M24 6 C20 12 16 16 24 24 C32 16 28 12 24 6Z"
        fill="var(--accent)" opacity="0.9"/>
  <path d="M24 42 C28 36 32 32 24 24 C16 32 20 36 24 42Z"
        fill="var(--accent-2)" opacity="0.7"/>
  <path d="M6 24 C12 20 16 16 24 24 C16 32 12 28 6 24Z"
        fill="var(--accent)" opacity="0.5"/>
  <path d="M42 24 C36 28 32 32 24 24 C32 16 36 20 42 24Z"
        fill="var(--accent-2)" opacity="0.5"/>
</svg>
```

### Boyut ve yerleÅŸim
| BaÄŸlam | Boyut | YerleÅŸim |
|---|---|---|
| Mobil mesaj baÅŸÄ±nda | 12Ã—12px | "Runa" ismiyle yan yana, mesaj Ã¼stÃ¼nde |
| MasaÃ¼stÃ¼ sidebar brand | 16-18px | "Runa" yazÄ±sÄ±nÄ±n solunda |
| MasaÃ¼stÃ¼ mesaj yanÄ±nda | 18Ã—18px | Agent mesajÄ±nÄ±n sol kenarÄ±nda, Ã¼stte hizalÄ± |
| Empty state hero | 52Ã—52px | OrtalanmÄ±ÅŸ, ekranÄ±n merkezinde |
| Onboarding karÅŸÄ±lama | 60Ã—60px | SayfanÄ±n gÃ¶rsel odaÄŸÄ± |
| Auth ekranÄ± logo | 52Ã—52px | Hero alanÄ± merkezinde |

---

## 6. Layout Modeli

### Desktop
```
+----------------------------------------------------------+
| Sidebar (240px)  |  Chat (max 680px, ortalanmÄ±ÅŸ)          |
|                  |                                         |
|  Brand + nav     |  [transcript]                           |
|  Conversations   |  [composer]                             |
|  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€   |                                         |
|  Cihazlar        |                                         |
|  Ayarlar         |                                         |
|  Hesap           |                                         |
+----------------------------------------------------------+
```

**SaÄŸ rail yok.** WorkInsightPanel kaldÄ±rÄ±lÄ±r. Ä°Ã§eriÄŸi:
- Aktif cihaz â†’ chat header subtitle'Ä±na taÅŸÄ±nÄ±r
- Run adÄ±mlarÄ± â†’ tool-line satÄ±rlarÄ± zaten gÃ¶steriyor, tekrar gereksiz
- BaÄŸlam sayÄ±sÄ± â†’ GeliÅŸmiÅŸ gÃ¶rÃ¼nÃ¼m (eski Developer Mode) aktifken gÃ¶rÃ¼nÃ¼r

Chat sÃ¼tunu max-width: 680px, yatayda ortalanmÄ±ÅŸ. Okuma ergonomisi iÃ§in sabit sÄ±nÄ±r.

### Mobile
```
+----------------------+
| Header (â€¹ Â· Runa Â· â‹¯)|
+----------------------+
| Chat akÄ±ÅŸÄ±           |
| (scroll)             |
|                      |
|                      |
+----------------------+
| [Composer]           |
+----------------------+
```

- Bottom tab bar **yok**.
- `â€¹` butonu: history sheet'i aÃ§ar.
- `â‹¯` butonu: menÃ¼ sheet'i aÃ§ar (Cihazlar, GeÃ§miÅŸ, Ayarlar, Hesap).
- Swipe-from-left-edge: history sheet'i aÃ§ar (iOS/Android beklentisi).
- Composer: opak, `--surface-1` solid background, safe-area-inset-bottom dahil.
- Composer z-index: 30. Chat content: z-index: 2. Sheet/backdrop: z-index: 70.

### Context chip (yeni v1.1)

Composer'Ä±n sol-altÄ±nda kÃ¼Ã§Ã¼k inline chip:

```
[ğŸ“ 5 working files â€º]    (yalnÄ±zca ek > 0 veya aÃ§Ä±k working file > 0 ise gÃ¶rÃ¼nÃ¼r)
```

- TÄ±klanÄ±nca **BaÄŸlam sheet'i** aÃ§Ä±lÄ±r: liste hÃ¢linde working files + attachments.
- SayÄ±m: `attachmentCount + workingFileCount`. `presentationRunSurfaceCount` artÄ±k bu chip'e dahil deÄŸil (GeliÅŸmiÅŸ gÃ¶rÃ¼nÃ¼me taÅŸÄ±ndÄ±).
- Desktop'ta chip aynÄ± yerde durur; sheet yerine dropdown veya inline popover aÃ§Ä±lÄ±r.
- BoÅŸ durumda chip render edilmez (UI gÃ¼rÃ¼ltÃ¼sÃ¼ olmaz).

### iOS Safari klavye davranÄ±ÅŸÄ± (yeni v1.1)

Sadece `100dvh` + `safe-area-inset` yetmez. Klavye aÃ§Ä±ldÄ±ÄŸÄ±nda composer Ã¼st kenarÄ± her zaman gÃ¶rÃ¼nÃ¼r kalmalÄ±:

```js
// useVisualViewport hook (apps/web/src/hooks/useVisualViewport.ts â€” yeni)
useEffect(() => {
  const vv = window.visualViewport;
  if (!vv) return;
  const onResize = () => {
    document.documentElement.style.setProperty(
      '--keyboard-offset',
      `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`
    );
  };
  vv.addEventListener('resize', onResize);
  vv.addEventListener('scroll', onResize);
  onResize();
  return () => {
    vv.removeEventListener('resize', onResize);
    vv.removeEventListener('scroll', onResize);
  };
}, []);
```

CSS tarafÄ±nda: `.composer { transform: translateY(calc(-1 * var(--keyboard-offset, 0px))); }`.

Kabul kriteri: iOS Safari + Android Chrome'da `textarea` focus edildiÄŸinde composer'Ä±n Ã¼st kenarÄ± klavye Ã¼st sÄ±nÄ±rÄ±nÄ±n en az 8px Ã¼stÃ¼nde kalÄ±r.

---

## 7. Ana Chat â€” VarsayÄ±lan Whitelist

Birincil chat akÄ±ÅŸÄ±nda **varsayÄ±lan olarak gÃ¶rÃ¼nebilecek** Ã¶ÄŸeler:

1. KullanÄ±cÄ± mesaj balonu (saÄŸ hizalÄ±, `--user-bg`).
2. Agent yanÄ±tÄ± â€” dÃ¼z metin, markdown, `Instrument Serif` isim baÅŸlÄ±ÄŸÄ±.
3. Tek satÄ±rlÄ±k tool aktivitesi: `[dot] 3 komut Ã§alÄ±ÅŸtÄ±rÄ±ldÄ± â€º`
4. Slim approval: kÄ±sa soru + hedef chip + iki buton.
5. Hata mesajÄ±: TR cÃ¼mle + "Yeniden dene" + "Detay â€º".
6. Shimmer/thinking satÄ±rÄ±: `DÃ¼ÅŸÃ¼nÃ¼yor` (shimmer animasyonu).
7. Streaming cursor (accent rengi, 2px, blink).
8. GÃ¼n ayÄ±rÄ±cÄ±: `BugÃ¼n Â· DÃ¼n Â· 11 MayÄ±s`.
9. Inline gÃ¶rsel: Ã¼retilen gÃ¶rsel preview + aksiyonlar.

KullanÄ±cÄ± aÃ§tÄ±ÄŸÄ±nda ek gÃ¶rÃ¼nenler (disclosure):

10. Tool aktivitesi detayÄ±: TR araÃ§ ismi, input chip, â‰¤6 satÄ±r output.
11. Hata "Detay â€º": TR cÃ¼mle + raw error monospace.

---

## 8. Ana Chat â€” VarsayÄ±lan Blacklist

AÅŸaÄŸÄ±dakiler **GeliÅŸmiÅŸ gÃ¶rÃ¼nÃ¼m kapalÄ±yken** ana chat'te **gÃ¶rÃ¼nmez:**

- `run_id`, `trace_id`, `call_id`, `correlation_id`
- Raw tool adlarÄ± (`file.write`, `desktop.screenshot`, `shell_exec`)
- Ingilizce tool description metni
- `RunStatusChips`, phase/context chip serileri
- `runtimePhases`, `observedSteps`, runtime event adlarÄ±
- `WorkInsightPanel` iÃ§eriÄŸi (adÄ±m tekrarÄ±, baÄŸlam sayÄ±sÄ±)
- WebSocket payload, transport metadata
- Stack trace, raw error kodu
- "GÃ¼ven kararÄ±" eyebrow + status chip kombinasyonu
- "Bu onayda net hedef bilgisi gÃ¶nderilmedi." sistem self-narration
- "Ä°zin verildi. AkÄ±ÅŸ devam ediyor." approval-sonrasÄ± aÃ§Ä±klama
- "CanlÄ± Ã§alÄ±ÅŸma / GeÃ§miÅŸ Ã§alÄ±ÅŸma" eyebrow + statik aÃ§Ä±klama
- Her mesajda saniye-dahil tarih damgasÄ± (`11.05.2026 02:57:31`)
- Her mesajda `Sen` / `Runa` rol etiketi
- Sidebar'da `Sahip` rozeti (tek kullanÄ±cÄ± senaryosunda)

---

## 9. BileÅŸen Dili

### Tool Aktivitesi (varsayÄ±lan: tek satÄ±r)
```
[â€¢] 3 komut Ã§alÄ±ÅŸtÄ±rÄ±ldÄ±  â€º
```
- Dot: `--accent` rengi, 4-5px
- Metin: `JetBrains Mono`, 12px, `--ink-3`
- Chevron `â€º`: `--ink-3`, opacity 0.4, rotate(90deg) aÃ§Ä±kken
- AÃ§Ä±lÄ±nca: sol kenar `--accent` Ã§izgisi, monospace output, â‰¤6 satÄ±r

### Approval â€” DÃ¼ÅŸÃ¼k Risk (varsayÄ±lan)
```
[Ember mark] Runa
DosyayÄ± aÃ§Ä±p gÃ¶sterebilirim â€” okumama izin verir misin?
[apps/server/src/runtime/provider-health.ts]  â† inline mono chip
[VazgeÃ§]  [AÃ§]  â† 2 buton
```
- Eyebrow yok. Status chip yok. Risk banner yok.
- Resolved sonrasÄ±: kart `Ä°zin verildi Â· Geri al` tek satÄ±rÄ±na shrink.

### Approval â€” Risk seviyeleri (kilitli v1.1)

**Tek kural:** Risk seviyesi yalnÄ±zca **iki gÃ¶rsel farkla** ifade edilir; baÅŸka eyebrow, status chip veya banner eklenmez.

1. **Sol border + baÅŸlÄ±k rengi** â€” risk seviyesine gÃ¶re deÄŸiÅŸir.
2. **Onay butonu rengi** â€” dÃ¼ÅŸÃ¼k/orta `primary`, yÃ¼ksek `danger`.

| Risk | Sol border | BaÅŸlÄ±k rengi | Onay buton | Tool listesi |
|---|---|---|---|---|
| **DÃ¼ÅŸÃ¼k (mavi/primary)** | `--accent` 2px | `--ink-1` | `primary` | `file.read`, `desktop.screenshot`, `desktop.clipboard.read`, `web.search`, `web.fetch`, `search.codebase`, `search.grep`, `git.status`, `git.diff`, `memory.read`, `memory.search`, `memory.list` |
| **Orta (sarÄ±/warn)** | `--warn` 2px | `--warn` | `primary` | `file.write`, `desktop.click`, `desktop.type`, `desktop.scroll`, `desktop.clipboard.write`, `browser.click`, `browser.fill`, `browser.navigate`, `browser.extract`, `memory.save`, `edit.patch` |
| **YÃ¼ksek (kÄ±rmÄ±zÄ±/danger)** | `--error` 2px | `--error` | `danger` | `file.delete`, `memory.delete`, `shell.exec`, `desktop.launch`, `desktop.keypress`, `desktop.verify_state` |

Risk seviyesi server tarafÄ±ndaki tool definition `risk_level` alanÄ±ndan alÄ±nÄ±r (`low` / `medium` / `high`). Frontend bunu Ã¼Ã§ sÄ±nÄ±fa map eder.

#### DÃ¼ÅŸÃ¼k risk Ã¶rnek
```
[HafÄ±za mark] Runa
DosyayÄ± aÃ§Ä±p gÃ¶sterebilirim â€” okumama izin verir misin?
[apps/server/src/runtime/provider-health.ts]
[VazgeÃ§]  [AÃ§]                       â† primary buton
```

#### YÃ¼ksek risk Ã¶rnek
```
| KalÄ±cÄ± silme â€” geri alÄ±namaz       â† --error sol border, --error renkli baÅŸlÄ±k
| [HafÄ±za mark] Runa
| DosyayÄ± silmek istiyorum.
| [rm ./logs/*.log]                  â† warn renkli mono chip
| [VazgeÃ§]  [Yine de sil]             â† danger buton
```

Risk aÃ§Ä±klamasÄ± (`193 MB veri silinecek` vs.) **kaldÄ±rÄ±ldÄ±** â€” kullanÄ±cÄ±nÄ±n dikkati hedef chip ve buton rengiyle yÃ¶nlendirilir. Detay isteyen kullanÄ±cÄ± iÃ§in `Detay â€º` (GeliÅŸmiÅŸ gÃ¶rÃ¼nÃ¼m).

### Composer â€” Send â†’ Stop dÃ¶nÃ¼ÅŸÃ¼mÃ¼ (yeni v1.1)

Composer'daki send butonu (`â†‘`, accent dolgu) **Ã§alÄ±ÅŸma sÄ±rasÄ±nda** stop butonuna dÃ¶nÃ¼ÅŸÃ¼r:

| Durum | Ä°kon | Renk | DavranÄ±ÅŸ |
|---|---|---|---|
| HazÄ±r | `â†‘` | `--accent` solid | Submit |
| Ã‡alÄ±ÅŸÄ±yor | `â– ` | `--ink-2` solid, `--surface-3` border | Mevcut run'Ä± abort eder |
| Disabled | `â†‘` | %45 opacity | TÄ±klanmaz |

Abort isteÄŸi `runtime.abortCurrentRun()` Ã§aÄŸÄ±rÄ±r (yeni hook metodu). Server tarafÄ±nda mevcut `cancel-run` WebSocket mesajÄ± kullanÄ±lÄ±r (kontrat deÄŸiÅŸmiyor).

Kabul kriteri: KullanÄ±cÄ± 30s+ Ã§alÄ±ÅŸan bir run'Ä± tek tÄ±kla durdurabilir. Stop sonrasÄ± kart "Ã‡alÄ±ÅŸma durduruldu" tek-satÄ±r TR mesajÄ±yla kapanÄ±r.

### Hata MesajÄ±
```
[Ember mark] Runa
pnpm bulamadÄ±m. Cihazda kurulu mu?
[Detay â€º]  â† optional raw error
[VazgeÃ§]  [Åimdi kur]
```

### Empty State
- Ember mark: 52px, ortalanmÄ±ÅŸ.
- `Instrument Serif` baÅŸlÄ±k: saate uyumlu ("GÃ¼naydÄ±n", "GeÃ§ oldu").
- Alt metin: `--ink-3`, 13px.
- 3 baÄŸlam-farkÄ±nda Ã¶neri chip.

### Streaming
- Kelime kelime, karakter deÄŸil.
- Cursor: 2px, `--accent`, blink 1s infinite.
- Mesaj tamamlanÄ±nca cursor kayboluyor.
- Header subtitle: `Ã§evrimiÃ§i` â†’ `dÃ¼ÅŸÃ¼nÃ¼yor` â†’ `yazÄ±yor` (shimmer).

---

## 10. Motion SÃ¶zlÃ¼ÄŸÃ¼

| Animasyon | KullanÄ±m | SÃ¼re | Easing |
|---|---|---|---|
| `shimmer` | Bekleme durumlarÄ±, "dÃ¼ÅŸÃ¼nÃ¼yor" | 2.2s Â· linear Â· infinite | - |
| `pulse` | Status dot (online/thinking) | 2s Â· ease-out Â· infinite | - |
| `fadeInUp` | Yeni mesajlar, yeni iÃ§erik | 0.3-0.4s | ease-out |
| `slideUp` | Bottom sheet aÃ§Ä±lmasÄ± | 0.3s | cubic-bezier(0.16,1,0.3,1) |
| `slideDown` | Tool detail aÃ§Ä±lmasÄ± | 0.25s | ease-out |
| `blink` | Streaming cursor | 1s Â· step Â· infinite | - |

**Kurallar:**
- Tek seferlik animasyonlar bir kez Ã§alÄ±ÅŸÄ±r, scroll'da tekrarlamaz.
- `prefers-reduced-motion: reduce` â†’ shimmer/pulse durur, fadeInUp instant.
- Bouncing/spring yok. Her ÅŸey ease-out veya linear.
- Page transition yok (single-view uygulama).

---

## 11. Ä°kon Seti

**Temel:** Lucide â€” mevcut, korunur. Genel UI ikonlarÄ± (dosya, klasÃ¶r, ayar, ok, X, check, arama, takvim, bildirimâ€¦).

**Runa custom (6-8 ikon):**
| Ä°kon | AÃ§Ä±klama |
|---|---|
| `runa-mark` | Signature Ember mark (SVG component) |
| `runa-device-desktop` | Laptop â€” Lucide'dan hafif farklÄ± Ã§izgi aÄŸÄ±rlÄ±ÄŸÄ± |
| `runa-device-server` | Server/terminal â€” rack hissi |
| `runa-device-mobile` | Telefon â€” Lucide ile uyumlu ama marka aÄŸÄ±rlÄ±klÄ± |
| `runa-approve` | Onay ikonu â€” checkmark deÄŸil, daha sÄ±cak |
| `runa-reject` | Red ikonu |

---

## 12. GeliÅŸmiÅŸ GÃ¶rÃ¼nÃ¼m (eski: Developer Mode)

**Etiket deÄŸiÅŸikliÄŸi:** "Developer Mode" â†’ "GeliÅŸmiÅŸ gÃ¶rÃ¼nÃ¼m"  
**Kod deÄŸiÅŸikliÄŸi:** `useDeveloperMode()` hook ve `isDeveloperMode` flag'i korunur, sadece kullanÄ±cÄ±ya gÃ¶sterilen string gÃ¼ncellenir.

**EriÅŸim:**
- Ayarlar â†’ GÃ¶rÃ¼nÃ¼m â†’ "GeliÅŸmiÅŸ gÃ¶rÃ¼nÃ¼m" toggle.
- `Ctrl+Shift+D` klavye kÄ±sayolu.

**GeliÅŸmiÅŸ gÃ¶rÃ¼nÃ¼m aÃ§Ä±kken ekstra gÃ¶rÃ¼nenler:**
- `RunStatusChips`, phase/context chip serileri.
- `PresentationRunSurfaceCard` developer dalÄ± (eyebrow + meta chips).
- `ApprovalBlock` `RunaDisclosure` (orijinal istek, ham hedef, tool name, call_id).
- `ToolResultBlock` tool input/output raw view.
- Error code chip'leri, raw error text.
- Transport correlation chip'leri.
- `RunTimelinePanel` (zaten developer-gated).

---

## 12.5 Server KontratÄ± â€” `user_label_tr` (yeni v1.1)

Ä°ngilizce tool description metinlerinin user-facing ekrana sÄ±zmasÄ±nÄ± engellemek iÃ§in, tool definition'a opsiyonel TR etiket alanÄ± eklenir:

```typescript
// packages/types/src/tools.ts (mevcut + ek alan)
export interface ToolDefinition<...> {
  readonly description: string;           // mevcut â€” model-facing, EN
  readonly user_label_tr?: string;        // yeni â€” user-facing, TR, â‰¤80 karakter
  readonly user_summary_tr?: string;      // yeni â€” bir cÃ¼mlelik Ã¶zet, opsiyonel
  // ... mevcut alanlar
}
```

**Frontend davranÄ±ÅŸÄ±:**
- `workNarrationFormat.formatWorkDetail(detail)`: artÄ±k sÃ¶zlÃ¼k dÄ±ÅŸÄ± kalan Ä°ngilizce metni **`null`** dÃ¶ndÃ¼rÃ¼r (eskiden olduÄŸu gibi dÃ¶ndÃ¼rmez).
- Tool aktivitesi render edilirken **Ã¶ncelik sÄ±rasÄ±**: `user_label_tr` â†’ `formatWorkToolLabel(tool_name)` â†’ tool_name (developer modunda).
- `user_summary_tr` varsa detail satÄ±rÄ± olarak kullanÄ±lÄ±r; yoksa hiÃ§ gÃ¶sterilmez.

**Server tool definition gÃ¼ncellemeleri (kapsam iÃ§i):**
TÃ¼m built-in tool'lar (`shell.exec`, `file.read`, `file.write`, `file.list`, `file.delete`, `web.search`, `web.fetch`, `desktop.*`, `browser.*`, `memory.*`, `git.*`, `search.*`, `edit.patch`) `user_label_tr` + `user_summary_tr` alanlarÄ±nÄ± alÄ±r. Liste tek bir PR'da (PR-5'in server kÄ±smÄ±nda) eklenir.

**Eski uyumluluk:** `user_label_tr` opsiyonel olduÄŸu iÃ§in mevcut tÃ¼ketici davranÄ±ÅŸÄ± bozulmaz. Frontend fallback chain'i alan eksikse `formatWorkToolLabel` ile devam eder.

**Lint guard:** Server testi `apps/server/src/tools/__tests__/user-label-coverage.test.ts` â€” built-in registry'deki her tool'un `user_label_tr` taÅŸÄ±dÄ±ÄŸÄ±nÄ± assert eder.

---

## 13. Cihaz Modeli

**TasarÄ±m prensibi:** "Sohbetin aynÄ± kalÄ±r; masaÃ¼stÃ¼ iÅŸlemleri seÃ§tiÄŸin cihazda Ã§alÄ±ÅŸÄ±r."

**Aktif cihaz gÃ¶sterimi:**
- Desktop header subtitle: `MacBook Pro Ã¼zerinde`
- Mobile header subtitle: `Ã§evrimiÃ§i Â· MacBook Pro`
- Cihaz deÄŸiÅŸince subtitle yumuÅŸak transition.

**Cihaz listesi:**
- Desktop: sidebar altÄ±nda tek satÄ±r `âŒ˜ Cihazlar Â· MacBook`
- Mobile: menÃ¼ sheet iÃ§inde bir item.
- Liste ekranÄ±: Bu cihaz (Ã¼stte, accent Ã§erÃ§eveli) â†’ Ã‡evrimiÃ§i â†’ Ã‡evrimdÄ±ÅŸÄ± sÄ±rasÄ±.

**Cihaz ekleme:** QR kod yok, pairing code yok. O cihazda Runa aÃ§Ä±p aynÄ± hesapla giriÅŸ yapmak yeterli â€” otomatik gÃ¶rÃ¼nÃ¼r.

**Hedef deÄŸiÅŸimi (uzaktan kontrol):**
- Sohbet ortasÄ±nda sistem satÄ±rÄ±: `â‡„ Hedef deÄŸiÅŸti Â· Ubuntu Server`
- Her tool Ã§aÄŸrÄ±sÄ±nda target pill: `âŒ· Ubuntu Server`
- Ã‡evrimdÄ±ÅŸÄ± cihaz: sohbet kilitlenmez, sadece o eylem fail olur. Runa alternatif Ã¶nerir.

---

## 14. Phased PR PlanÄ± (kilitli v1.1 â€” yeni sÄ±ralama)

SÄ±ralama prensibi: **gÃ¶rsel transformasyon Ã¶nce**, layout/temizlik sonra, polish en son. Sebep: ilk PR landlandÄ±ÄŸÄ±nda kullanÄ±cÄ± yeni Ã¼rÃ¼nÃ¼ gÃ¶rmeli, yoksa motivasyon kaybÄ± + iÃ§ gÃ¶zden geÃ§irme erteleme.

### BaÄŸÄ±mlÄ±lÄ±k grafiÄŸi

```
PR-1 (tema/font/mark)  â”€â”€â”
PR-2 (layout shell)      â”‚â”€â”€ lineer
PR-3 (chat surface)      â”‚
                         â”‚
PR-4 (approval) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤â”€â”€ PR-3 sonrasÄ±, birbirinden baÄŸÄ±msÄ±z
PR-5 (errors+debug) â”€â”€â”€â”€â”€â”¤    (paralel olabilir)
                         â”‚
PR-6 (sheets+palette)    â”‚â”€â”€ lineer
PR-7 (settings+adv view) â”‚
                         â”‚
PR-8 (a11y + polish)     â”˜â”€â”€ en son
```

### PR-1 â€” Tema, Tipografi, HafÄ±za Mark **[GÃ–RSEL TRANSFORMASYON]**

`apps/web/src/styles/tokens.css`'i Ember Dark + Light + Rose Dark token'larÄ±yla yeniden yaz. Inter + Instrument Serif + JetBrains Mono yÃ¼kle. Mevcut compass/sun SVG â†’ `<HafizaMark weight variant />` component. `DesignLanguageLock.test.ts`'i yeni dili kilitleyecek ÅŸekilde **toptan yeniden yaz**.

**Kabul:** Tek PR ile chat sayfasÄ±nÄ±n renk + font + mark kimliÄŸi tamamen deÄŸiÅŸir. Layout aynÄ± kalÄ±r (kasÄ±tlÄ± â€” sonraki PR).

### PR-2 â€” Layout Shell

`AppShell.tsx` chat modunu yeniden Ã§iz: sol sidebar (240px, brand + nav + sohbet listesi + cihaz mini-card + ayarlar/hesap), tek-satÄ±r top bar (baÅŸlÄ±k + subtitle + komut paleti + bildirim/ayarlar). `WorkInsightPanel` ve saÄŸ rail tamamen kaldÄ±rÄ±lÄ±r. Composer context chip eklenir. Mobilde `â€¹` + `â‹¯` butonlarÄ± + bottom tab bar kaldÄ±rma.

**Kabul:** Chat sayfasÄ±nda tek satÄ±r Ã¼st bar, saÄŸ rail yok, mobilde bottom tab bar yok.

### PR-3 â€” Chat Surface

`PersistedTranscript.tsx`: rol etiketi kaldÄ±r, gÃ¼n ayÄ±rÄ±cÄ± ekle, saniye-dahil timestamp kaldÄ±r, agent mesajÄ± baÅŸÄ±na HafÄ±za mark (regular). `RunProgressPanel` + `PresentationRunSurfaceCard` sohbet iÃ§inden kaldÄ±rÄ±lÄ±r â€” yerine tek satÄ±r `[â€¢] N adÄ±m Ã§alÄ±ÅŸtÄ±rÄ±ldÄ± â€º` tool-line. `EmptyState.tsx`: Instrument Serif hero baÅŸlÄ±k ("GÃ¼naydÄ±n Â· BugÃ¼n neyi halledelim?").

**Kabul:** AynÄ± agent run ekranda tek yerde Ã¶zetlenir; uzun konuÅŸma scan edilebilir.

### PR-4 â€” Approval Calm (PR-3 sonrasÄ± paralel olabilir)

`ApprovalBlock.tsx`: eyebrow + status chip + state feedback **tamamen kaldÄ±rÄ±lÄ±r**. Sol border + baÅŸlÄ±k rengi risk seviyesine gÃ¶re deÄŸiÅŸir (low: accent, medium: warn, high: error). Onay butonu rengi (`primary` / `danger`) risk seviyesine gÃ¶re. Resolved sonrasÄ± `Ä°zin verildi Â· Geri al` tek satÄ±r shrink.

**Kabul:** Pending approval â‰¤140px desktop / â‰¤180px mobile. Resolved â‰¤36px.

### PR-5 â€” User-Safe Errors + Server `user_label_tr` KontratÄ± (PR-3 sonrasÄ± paralel)

**Server kÄ±smÄ± (apps/server):** Tool definition'a `user_label_tr` + `user_summary_tr` opsiyonel alanlarÄ± eklenir. Built-in registry'deki tÃ¼m tool'lar bu alanlarÄ± taÅŸÄ±r. Test guard eklenir.

**Frontend kÄ±smÄ± (apps/web):** `ToolResultBlock.tsx` user-facing modda error_code chip ve raw error text gizler. `workNarrationFormat.formatWorkDetail` sÃ¶zlÃ¼k dÄ±ÅŸÄ± metinler iÃ§in `null` dÃ¶ner. Tool aktivitesi render Ã¶nceliÄŸi: `user_label_tr` â†’ `formatWorkToolLabel` â†’ tool_name (dev mod).

**Kabul:** HiÃ§bir Ä°ngilizce tool description user-facing ekrana Ã§Ä±kmaz. Test guard PASS.

### PR-6 â€” Sheets, Modal, Command Palette

Bottom sheet sistemi (`<RunaSheet>`), modal sistemi (`<RunaModal>`), command palette (`Ctrl+K`/`âŒ˜K`). Mobil `â€¹` history sheet'i + `â‹¯` menÃ¼ sheet'i. Composer context chip â†’ BaÄŸlam sheet.

**Kabul:** Mobil tÃ¼m sekonder eylemler sheet ile eriÅŸilir, composer Ã¼stÃ¼nden hiÃ§bir metin geÃ§mez.

### PR-7 â€” Settings, GeliÅŸmiÅŸ GÃ¶rÃ¼nÃ¼m, Theme Picker

`SettingsPage.tsx` yeniden Ã§iz: GÃ¶rÃ¼nÃ¼m tab'inde tema seÃ§ici (Ember Dark / Light / Rose Dark / Sistem), tipografi tercihi, **"GeliÅŸmiÅŸ gÃ¶rÃ¼nÃ¼m"** toggle (`useDeveloperMode` hook'unu kullanÄ±r; sadece string TR'leÅŸir). Composer Send â†’ Stop dÃ¶nÃ¼ÅŸÃ¼mÃ¼ eklenir.

**Kabul:** Tema deÄŸiÅŸimi anÄ±nda Ã§alÄ±ÅŸÄ±r, GeliÅŸmiÅŸ gÃ¶rÃ¼nÃ¼m aÃ§Ä±kken developer yÃ¼zeyleri gÃ¶rÃ¼nÃ¼r hÃ¢le gelir.

### PR-8 â€” A11y, iOS, Reduced Motion, Token Cleanup

iOS `visualViewport` hook (yeni `useVisualViewport.ts`) eklenir, composer keyboard-aware olur. `prefers-reduced-motion` audit. Token deduplication (`--text-lg/xl/2xl` Ã¶lÃ§eÄŸi daraltma). Final WCAG kontrast pass.

**Kabul:** iOS Safari + Android Chrome'da klavye aÃ§Ä±kken composer Ã¼st kenarÄ± gÃ¶rÃ¼nÃ¼r kalÄ±r. Lighthouse a11y skoru â‰¥95.

---

## 14.5 PR Operasyonu â€” Branching, Review, Lock Test (yeni v1.1)

### Branching stratejisi

- **Lineer zorunlu:** PR-1 â†’ PR-2 â†’ PR-3. Her biri bir Ã¶ncekine baÄŸÄ±mlÄ±.
- **Paralel izinli:** PR-4 ve PR-5 (PR-3 sonrasÄ±, baÄŸÄ±msÄ±z modÃ¼ller).
- **Lineer zorunlu:** PR-6 â†’ PR-7 â†’ PR-8.
- Her PR ayrÄ± worktree'de aÃ§Ä±lÄ±r: `.claude/worktrees/runa-ui-pr-N-<short-desc>`.
- Branch isimlendirme: `codex/ui-restructure-pr-N-<short-slug>`.

### Review akÄ±ÅŸÄ±

1. Codex PR'Ä± aÃ§ar â†’ `pr-N-codex-brief.md`'deki kabul kriteri checklist'iyle PR description doldurur.
2. Codex CI yeÅŸilini doÄŸrular (`lint + typecheck + test + smoke`).
3. PR linki Claude'a (bana) gÃ¶nderilir â†’ gÃ¶rsel + kontrat + risk review.
4. Claude review sonucu kullanÄ±cÄ±ya raporlanÄ±r â†’ kullanÄ±cÄ± `merge` veya `revize` kararÄ± verir.
5. Merge sonrasÄ± `PROGRESS.md`'de TASK-UI-RESTRUCTURE-PR-N entry kapanÄ±r.

### Lock test stratejisi

- `DesignLanguageLock.test.ts` **PR-1'de toptan yeniden yazÄ±lÄ±r.** Yeni renk token'larÄ±, font ailesi, mark API'sÄ±, "yeni dilin" tÃ¼m temel kurallarÄ± tek seferde kilitlenir.
- Sonraki PR'lar (PR-2 â†’ PR-8) bu lock testi **bozmadan** ilerler.
- Bir PR lock testi deÄŸiÅŸtirmek zorunda kalÄ±yorsa, deÄŸiÅŸiklik PR description'da "Lock test gÃ¼ncellemesi: ne, neden" satÄ±rÄ±nda aÃ§Ä±kÃ§a yazÄ±lÄ±r.
- **Yasak:** Lock test'i bypass etmek (`.skip()` veya `delete`). Test gÃ¼ncellemesi olur, atlama olmaz.

---

## 15. Anti-Pattern Listesi

AÅŸaÄŸÄ±dakiler **hiÃ§bir zaman yapÄ±lmaz:**

- Ana chat'e ham debug dili eklemek.
- AynÄ± agent run bilgisini 2+ yerde gÃ¶stermek.
- Card-in-card pattern kurmak.
- SaÄŸ rail'i her zaman aÃ§Ä±k tutmak.
- Mobile'a desktop panel mirasÄ±nÄ± uygulamak.
- Bottom tab bar eklemek (composer Ã§akÄ±ÅŸmasÄ±).
- Approval'a eyebrow + status chip + risk banner + state feedback birlikte koymak.
- BaÅŸarÄ±yÄ± bÃ¼yÃ¼k yeÅŸil kartla kutlamak.
- "HazÄ±r" durumunu sÃ¼rekli gÃ¶stermek.
- Her mesajÄ±n altÄ±na saniye-dahil timestamp yazmak.
- Tam geniÅŸlik saÄŸ rail kullanmak.
- `--ink-3` rengini kÃ¼Ã§Ã¼k metinde (<18px, <600 weight) kullanmak.
- Tool description Ä°ngilizce metnini user-facing chat'e bÄ±rakmak (PR-5 sonrasÄ± yasak).
- Composer'Ä± Ã§alÄ±ÅŸma sÄ±rasÄ±nda deÄŸiÅŸtirmemek â€” Send butonu her zaman Stop'a dÃ¶nÃ¼ÅŸmeli.
- iOS Safari'de yalnÄ±z `100dvh` kullanmak; `visualViewport` listener'Ä± eklemeden mobil composer shipping etmek.
- Lock test'i (`DesignLanguageLock.test.ts`) `.skip()` veya silerek bypass etmek.

---

## 16. GÃ¶rsel Kabul Kriterleri (Genel)

PR-A â†’ PR-H tamamlandÄ±ÄŸÄ±nda:

1. Rastgele bir rakip gÃ¶rseliyle yan yana koyulduÄŸunda Runa "hangisi tÃ¼ketici Ã¼rÃ¼nÃ¼?" testini geÃ§er.
2. AynÄ± agent run'Ä±nÄ±n ekran kaplama alanÄ± eski tasarÄ±ma gÃ¶re **en az %40 daha az piksel** kaplar.
3. `DesignLanguageLock.test.ts` â†’ %100 PASS.
4. GeliÅŸmiÅŸ gÃ¶rÃ¼nÃ¼m kapalÄ±yken hiÃ§bir Ä°ngilizce tool description user-facing ekrana eriÅŸmez.
5. Mobil 320/390/414 viewport'ta composer focus altÄ±nda overlap yok.
6. TÃ¼m renk kombinasyonlarÄ± WCAG AA kontrast oranÄ±nÄ± karÅŸÄ±lar.

---

*Bu brief Claude Code'a verilebilir. Eksik kararlar "Kapsam dÄ±ÅŸÄ±" veya "Sonraki versiyon" olarak iÅŸaretlenmiÅŸtir. TÃ¼m tasarÄ±m kararlarÄ± bu dokÃ¼manda kilitlidir.*

