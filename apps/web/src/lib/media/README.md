# Media Contracts

This module is the forward-compatibility boundary for future image generation and image editing.

- Future custom message part: `image-generation`.
- Future renderer: `MediaJobBlock`, backed by `MediaJobStatus` from `types.ts`.
- Progress UI should follow the ai-elements Tool state-machine pattern.
- Heavy editor UI should be lazy-loaded as `ImageEditor.tsx`, following the same boundary as the Mermaid renderer.
- Backend contract: streamed `data-media-job-update` parts patch a `MediaJob` by `id`.

