# Quarantine Note

Branch: `quarantine/non-stack-work`  
Commit: `1fd8208 chore(quarantine): preserve non-stack-migration work`

## Why

Dirty working tree triage found several useful but production-lock-out-of-scope changes mixed with the UI stack migration. They were moved to a quarantine branch before the real migration so this branch can stay focused on the verified Streamdown, assistant-ui, ai-elements, bundle budget, and fixture-test work.

## Preserved Work

The quarantine commit preserves:

- Backend/runtime hardening:
  - `apps/server/src/runtime/run-model-turn.ts`
  - `apps/server/src/runtime/run-model-turn.test.ts`
  - `apps/server/src/ws/register-ws.test.ts`
- Auth and request-payload polish:
  - `apps/web/src/hooks/useAuth.ts`
  - `apps/web/src/lib/auth-client.ts`
  - `apps/web/src/lib/auth-client.test.ts`
  - `apps/web/src/lib/chat-runtime/request-payload.ts`
  - `apps/web/src/lib/chat-runtime/request-payload.test.ts`
- Competitive chat UX work:
  - `apps/web/src/styles/routes/chat-migration.css`
  - `apps/web/tests/visual/competitive-chat-ux.spec.ts`
  - `docs/COMPETITIVE-CHAT-UX-IMPLEMENTATION-PROMPTS.md`
  - `docs/runa-ui-design-audit-2026-04-30.docx`
- Visual artifacts:
  - `apps/web/tests/visual/__screenshots__/**`
  - `docs/design-audit/screenshots/**`

## How To Restore

After production-lock migration lands, restore this work through a separate PR from `quarantine/non-stack-work`. Review it as a UI polish/backend hardening follow-up, not as part of the stack migration.

