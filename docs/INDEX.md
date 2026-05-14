# Runa Docs Index

Bu indeks, IDE LLM'lerin tum `docs/` klasorunu yuklemek yerine dogru belgeye hizli ulasmasi icin kullanilir.

## Core (Her Oturum)

- `docs/AGENTS.md` - proje kimligi, kirmizi cizgiler, aktif faz, kod giris noktalari
- `docs/TASK-TEMPLATE.md` - task yazim standardi
- `docs/LLM-CONTEXT.md` - minimum okuma protokolu
- `docs/IDE-LLM-RUNBOOK.md` - uygulama ve raporlama operasyonu
- `docs/PROGRESS.md` - mevcut durum ve en yeni ilgili kayit

## Active Specs

- `docs/tasks/TASK-*.md` - aktif capability/backlog task belgeleri
- `docs/design/ui-restructure/*.md` - UI restructure brief ve uygulama rehberleri (gecici aktif alan)
- `docs/RUNA-DESIGN-LANGUAGE.md` - tasarim kilit kurallari

## Domain Rehberleri

| Gorev tipi | Ek belge |
| --- | --- |
| Mimari veya cross-module karar | `docs/implementation-blueprint.md`, `docs/technical-architecture.md`, `docs/architecture/constitution.md` |
| Security/auth/policy | `docs/security-model.md`, ilgili `docs/tasks/TASK-*.md` |
| UI/chat surface | `docs/RUNA-DESIGN-LANGUAGE.md`, ilgili UI brief/task |
| Release/CI/launch | `docs/release-demo-checklist.md`, `docs/launch/` |
| Provider/live smoke | `docs/groq-demo-runbook.md`, ilgili `docs/PROGRESS.md` kayitlari |
| Desktop companion | `docs/tasks/TASK-01-ELECTRON-DESKTOP-APP.md`, `docs/tasks/TASK-06-DESKTOP-UTILITY-TOOLS.md` |
| Migration/prod-lock audit | `docs/migration/` |

## Archive ve Evidence

- `docs/archive/` - tarihsel kayitlar, tamamlanmis fazlar
- `docs/design-audit/screenshots/` - gorsel kanit, varsayilan context degil
- `docs/migration/screenshots/` - migration smoke kaniti, varsayilan context degil
- `docs/ui-smoke/` - UI smoke artefaktlari

## Otorite Sirasi

1. Kullanici mesajindaki exact kapsam ve non-goals
2. `docs/AGENTS.md`
3. Ilgili task/prompt belgesi
4. `docs/PROGRESS.md` guncel kayitlari
5. Diger mimari belgeler
6. Arsiv belgeleri

## Bu Ayin Notu (2026-05)

- `docs/DOCS-AUDIT-2026-05.md` aktif dokuman temizligi ve risk envanterini tutar.
- Phase-2 ile eski frontend-mimar klasoru icerigi `docs/design/` altina tasindi.
- Yeni path standardi:
  - Design authority: `docs/design/RUNA-DESIGN-BRIEF.md`
  - UI brief seti: `docs/design/ui-restructure/`
  - Mockup/artifact html dosyalari: `docs/design/artifacts/`
  - Logo varliklari: `docs/design/logo-pack/`

