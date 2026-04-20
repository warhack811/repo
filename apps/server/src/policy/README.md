# Policy Module

**KARAR.MD Maddesi:** Madde 6, 9 — Permission Engine, Approval Manager, Trust Model

## Bu modül nedir?
İzin denetimi, onay akışı ve güvenlik politika enforcement.
Tool çalıştırma ve dosya yazma gibi aksiyonlarda approval gate burada kurulur.

## Interface'ler
- `ApprovalRequest` → `@runa/types/policy.ts`
- `PolicyDecision` → `@runa/types/policy.ts`

## Pattern
İlk implementasyon Sprint 3'te yapılacak (approval manager).

## Bu modül ne DEĞİLDİR
- Tool implementasyonu değildir — `tools/` modülüne ait
- State machine yönetmez — `runtime/` modülüne ait
- Kullanıcı kimlik doğrulaması yapmaz (MVP'de basit auth) — ayrı katman
