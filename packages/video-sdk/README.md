# @video2gif/sdk

Thin TypeScript types that mirror the Rust crate `video-sdk`.

**Core conversion is not implemented in TypeScript** — depend on `crates/video-sdk` from Rust (Tauri commands, CLI, etc.).

```ts
import type { ConvertOptions, ChatPreset } from '@video2gif/sdk';
```

Path dependency from the app:

```json
{
  "dependencies": {
    "@video2gif/sdk": "file:packages/video-sdk"
  }
}
```
