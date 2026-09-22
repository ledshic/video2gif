# Bundled FFmpeg

Run `npm run prepare:ffmpeg` to stage the current platform binaries here:

```
resources/ffmpeg/
  linux-x64/ffmpeg
  linux-arm64/ffmpeg
  darwin-x64/ffmpeg
  darwin-arm64/ffmpeg
  win32-x64/ffmpeg.exe
  win32-arm64/ffmpeg.exe
```

The script includes `ffprobe` / `ffprobe.exe` beside `ffmpeg`.

- **Dev**: system `ffmpeg` on PATH, or `VIDEO_SDK_FFMPEG` / `VIDEO2GIF_FFMPEG`.
- **Tauri dev/build**: `npm run tauri:dev` and `npm run tauri:build` run the preparation script automatically.
- **Tauri packaging**: files are listed under `src-tauri/tauri.conf.json` -> `bundle.resources`.

Sources: `ffmpeg-static` and `@ffprobe-installer/ffprobe` npm packages.
