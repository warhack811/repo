# Runa UI Surface Screenshot Set - 2026-04-29

This screenshot set captures the current Runa web UI for competitive visual audit against Claude/Codex/Dispatch-style interfaces.

## Capture Context

- Source: local Vite app at `http://127.0.0.1:4173`
- Backend: local E2E auth/provider harness at `http://127.0.0.1:3000`
- Desktop viewport: `1440x900`
- Mobile viewport: `390x844`
- Generated manifest: `manifest.json`
- Note: approval completion used a DOM click after the pending screenshot because the composer layer intercepted pointer events during automation. Keep this as an interaction audit signal.

## Desktop Screens

1. `desktop-1440-01-login.png` - anonymous login surface
2. `desktop-1440-02-onboarding.png` - first-run onboarding
3. `desktop-1440-03-chat-empty.png` - authenticated empty chat
4. `desktop-1440-04-chat-approval-pending.png` - approval pending in chat
5. `desktop-1440-05-chat-approval-completed.png` - completed approval run
6. `desktop-1440-06-history.png` - history with one conversation
7. `desktop-1440-07-devices.png` - devices route under the E2E harness
8. `desktop-1440-08-account.png` - account settings default tab
9. `desktop-1440-09-settings-preferences.png` - preferences tab
10. `desktop-1440-10-settings-devices-tab.png` - settings devices tab
11. `desktop-1440-11-settings-project-memory.png` - project memory tab
12. `desktop-1440-12-settings-developer-tab.png` - developer tab
13. `desktop-1440-13-developer.png` - developer runtime page
14. `desktop-1440-14-capability-preview.png` - capability preview page

## Mobile Screens

1. `mobile-390-01-login.png` - anonymous login surface
2. `mobile-390-02-onboarding.png` - first-run onboarding
3. `mobile-390-03-chat-empty.png` - authenticated empty chat
4. `mobile-390-04-chat-approval-pending.png` - approval pending in chat
5. `mobile-390-05-chat-approval-completed.png` - completed approval run
6. `mobile-390-06-history.png` - history with one conversation
7. `mobile-390-07-devices.png` - devices route under the E2E harness
8. `mobile-390-08-account.png` - account settings default tab
9. `mobile-390-09-settings-preferences.png` - preferences tab
10. `mobile-390-10-settings-devices-tab.png` - settings devices tab
11. `mobile-390-11-settings-project-memory.png` - project memory tab
12. `mobile-390-12-settings-developer-tab.png` - developer tab
13. `mobile-390-13-developer.png` - developer runtime page
14. `mobile-390-14-capability-preview.png` - capability preview page

## Review Lens

- Does the center chat surface feel calmer and more premium than the side surfaces?
- Is the composer the visual gravity center without becoming visually heavy?
- Are approval, devices, and capability states trust-first rather than operator/debug-first?
- Do mobile screens preserve the same product language without compressing desktop panels awkwardly?
- Where are color, border, radius, spacing, typography, and copy decisions inconsistent with the desired Runa design language?
