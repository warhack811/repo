# Runa LLM Context Guide

Bu belge, IDE LLM'lerle profesyonel ve dar kapsamli calismak icin okuma protokoludur. Amac, her oturumda tum `docs/` klasorunu yuklemek yerine gerekli en kucuk kanit setiyle baslamaktir.

## Varsayilan Bootstrap

Her yeni IDE LLM gorevine su kisa paket verilir:

```md
Once sadece su dosyalari oku:
- docs/AGENTS.md
- docs/TASK-TEMPLATE.md
- docs/LLM-CONTEXT.md
- docs/PROGRESS.md icindeki Mevcut Durum Ozeti ve en son ilgili kayitlar
- Bu gorevin exact task/prompt dosyasi

Diger docs dosyalarina yalniz blocker, celiski veya gorev turu gerektirirse bak.
Kod davranisini degistirmeden once kapsam/non-goal listesini tekrar kontrol et.
```

## Gorev Bazli Ek Okuma

- Web/UI polish: `docs/RUNA-DESIGN-LANGUAGE.md`, ilgili UI/task promptu, ilgili web test dosyalari.
- Backend/runtime/WS: `docs/technical-architecture.md`, `docs/implementation-blueprint.md`, ilgili server testleri.
- Auth/security/policy: `docs/security-model.md`, ilgili auth/policy kodu ve testleri.
- Release/CI/merge: `docs/release-demo-checklist.md`, `docs/launch/`, GitHub check sonuclari.
- Provider/live smoke: DeepSeek/Groq env truth, ilgili smoke scriptleri.
- Desktop companion: ilgili `docs/tasks/TASK-01*`, `TASK-06*`, desktop-agent kodu ve progress kayitlari.

## Normalde Okunmayacaklar

Asagidaki alanlar her oturuma eklenmez:

- `docs/design-audit/screenshots/**`
- `docs/migration/screenshots/**`
- `docs/archive/**`
- Eski UI faz dosyalari ve tamamlanmis promptlar
- Buyuk tarihsel progress arsivleri

Bu alanlar sadece dogrudan kanit, regresyon veya tarihsel karar sorgusu varsa acilir.

## Prompt Yazma Kurali

IDE LLM'ye verilecek gorev her zaman tek blok olmalidir:

1. Kisa repo wrapper.
2. Exact task/prompt dosyasi.
3. Allowed files.
4. Non-goals.
5. Validation commands.
6. Done criteria.

Birden fazla buyuk hedef ayni prompta konmaz. Seri islerde her kapanistan sonra bir sonraki en dar blok yazilir.

## Raporlama Kurali

LLM her kapanista sunlari ayirmalidir:

- Task-local yesil kanit.
- Repo-baseline veya environment kaynakli kalan kirmizilar.
- Kosulan komutlar ve sonuc.
- Dokunulmayan non-goals.
- Gerekliyse `docs/PROGRESS.md` icin kisa ledger notu.

## Context Butcesi

- Once belge basliklari ve ilgili bolumler okunur.
- Tam dosya sadece gercekten source of truth ise yuklenir.
- Screenshot/PNG dosyalari default context'e alinmaz; gerekirse tek tek acilir.
- Eski prompt/faz dokumanlari implementation kaniti gibi degil, tarihsel plan gibi yorumlanir.
