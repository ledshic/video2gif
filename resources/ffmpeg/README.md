# Bundled ffmpeg (optional)

Place platform binaries here for packaging:

```
resources/ffmpeg/
  linux-x64/ffmpeg
  linux-arm64/ffmpeg
  darwin-x64/ffmpeg
  darwin-arm64/ffmpeg
  win32-x64/ffmpeg.exe
  win32-arm64/ffmpeg.exe
```

Also include `ffprobe` / `ffprobe.exe` beside `ffmpeg` when possible.

- **Dev**: system `ffmpeg` on PATH, or `VIDEO_SDK_FFMPEG` / `VIDEO2GIF_FFMPEG`.
- **Tauri packaging**: listed under `src-tauri/tauri.conf.json` → `bundle.resources`.
  Alternatively use Tauri `externalBin` / sidecar (rename binaries to `ffmpeg-<target-triple>`).

Sources: [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds/releases), `ffmpeg-static` npm package, etc.
