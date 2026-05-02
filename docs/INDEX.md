# Runa Docs Index

Bu indeks, `docs/` klasorunun tamamini LLM context'ine yuklemek yerine dogru belgeye hizli gitmek icin kullanilir.

## Her Oturumda Okunacaklar

- `docs/AGENTS.md` - proje kimligi, kirmizi cizgiler, aktif faz ve ana kod giris noktalari.
- `docs/TASK-TEMPLATE.md` - IDE LLM gorevlerinin standart sekli.
- `docs/LLM-CONTEXT.md` - context window'u koruyan okuma rotasi.
- `docs/PROGRESS.md` - yalniz guncel ozet ve son operasyonel kayitlar.

## Goreve Gore Okunacaklar

| Gorev tipi | Ek belge |
| --- | --- |
| Mimari veya cross-module karar | `docs/implementation-blueprint.md`, `docs/technical-architecture.md`, `docs/architecture/constitution.md` |
| Resilience, Recovery, Self-Repair | `docs/technical-architecture.md` runtime/gateway bolumleri, `docs/PROGRESS.md` Faz 1-4 kayitlari |
| Security, auth, policy, approval | `docs/security-model.md`, ilgili `docs/tasks/TASK-*.md` |
| UI, chat surface, design polish | `docs/RUNA-DESIGN-LANGUAGE.md`, ilgili `docs/tasks/TASK-*.md` veya aktif UI promptu |
| Release, CI, launch proof | `docs/release-demo-checklist.md`, `docs/launch/` |
| Provider/live smoke | `docs/groq-demo-runbook.md`, DeepSeek baseline notlari, `docs/PROGRESS.md` son kayitlar |
| Desktop companion | `docs/tasks/TASK-01-ELECTRON-DESKTOP-APP.md`, `docs/tasks/TASK-06-DESKTOP-UTILITY-TOOLS.md`, ilgili progress kaydi |
| Migration veya production-lock UI stack | `docs/migration/` raporlari |

## Arsiv ve Kanit Alanlari

- `docs/archive/` tarihsel kayittir; sadece eski karar veya eski progress kaniti gerekiyorsa okunur.
- `docs/design-audit/screenshots/` gorsel kanittir; normal kod gorevlerinde context'e alinmaz.
- `docs/migration/screenshots/` migration smoke kanitidir; yalniz gorsel/migration audit icin acilir.
- `docs/archive/ui-phases/` tamamlanmis UI faz planlaridir; yeni implementasyon icin once `docs/tasks/` ve aktif promptlara bakilir.
- `docs/archive/ui-overhaul/` tamamlanmis UI overhaul plan/prompt belgelerini tasir; yalniz tarihsel scope kaniti gerekiyorsa okunur.

## Otorite Sirasi

Bir celiski varsa siralama su sekildedir:

1. Kullanici mesajindaki exact kapsam ve non-goals.
2. `docs/AGENTS.md` ve `docs/TASK-TEMPLATE.md`.
3. Ilgili task/prompt belgesi.
4. `docs/PROGRESS.md` guncel kayitlari.
5. Mimari belgeler.
6. Arsiv ve eski faz belgeleri.

## Guncelleme Kurali

- Yeni uzun raporlar once `docs/migration/`, `docs/launch/`, `docs/archive/` gibi amacina uygun klasore konur.
- `docs/PROGRESS.md` sadece guncel operasyonel ozet ve son kayitlari tasir.
- Tamamlanmis buyuk ledger parcalari `docs/archive/` altina tasinir.
- Screenshot ve test artefaktlari task icin zorunlu degilse LLM context'ine eklenmez.
