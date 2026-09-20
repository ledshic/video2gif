# video-sdk

Reusable **Rust** library that wraps `ffmpeg` / `ffprobe` for high-quality **video → GIF** conversion (`palettegen` + `paletteuse`).

Designed so other apps (CLI, Tauri, services) can depend on it **without** the Video2GIF UI.

## Public API

| Function | Purpose |
|----------|---------|
| `convert_video_to_gif(opts, on_progress)` | Blocking convert → output path |
| `convert_async(opts, on_progress)` | Background job + `ConversionJob::cancel()` / `wait()` |
| `probe` / `probe_duration` | Media info via ffprobe |
| `all_presets` / `WECHAT_LIKE` / `TELEGRAM_LIKE` / `DISCORD_LIKE` | Chat-friendly defaults |
| `default_output_path` | Unique `*.gif` next to input |
| `resolve_ffmpeg` / `resolve_ffprobe` | Binary discovery |

## Depend on this crate

### Path (monorepo / local)

```toml
[dependencies]
video-sdk = { path = "../video-sdk" }
# from another clone:
# video-sdk = { path = "/path/to/video2gif/crates/video-sdk" }
```

### Git

```toml
[dependencies]
video-sdk = { git = "https://github.com/ledshic/video2gif", package = "video-sdk" }
```

### crates.io (when published)

```toml
[dependencies]
video-sdk = "0.1"
```

## ffmpeg

- **Dev**: system `ffmpeg` / `ffprobe` on `PATH`, or `VIDEO_SDK_FFMPEG` / `VIDEO2GIF_FFMPEG`.
- **Packaging**: place binaries under `resources/ffmpeg/<platform>-<arch>/` and pass `ConvertOptions.bundled_root`.

## Test / smoke

```bash
cargo test -p video-sdk
cargo run -p video-sdk --example convert_cli -- /path/in.mp4 /tmp/out.gif 2
```
