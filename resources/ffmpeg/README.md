# Bundled FFmpeg

Place platform binaries here so packaged builds do **not** require users to install ffmpeg.

## Layout

```
resources/ffmpeg/
  linux-x64/ffmpeg
  linux-arm64/ffmpeg
  darwin-x64/ffmpeg
  darwin-arm64/ffmpeg
  win32-x64/ffmpeg.exe
  win32-arm64/ffmpeg.exe
```

Optional: also place `ffprobe` / `ffprobe.exe` alongside for duration probing without PATH.

## Development (this Linux box)

System ffmpeg is fine. `electron/ffmpeg.js` falls back to `ffmpeg` on PATH when no bundled binary exists.

## Packaging

`electron-builder` `extraResources` copies `resources/ffmpeg/${os}-${arch}` into the app’s `resources/ffmpeg/${os}-${arch}`.

See `npm run ffmpeg:info` and the root README.
