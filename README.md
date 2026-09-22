# Video2GIF

跨平台桌面应用：将视频转换为高质量 GIF（界面支持 **English / 简体中文**）。

**Video → GIF converter** with chat-app-friendly presets (WeChat / Telegram / Discord style). UI is bilingual (EN / 简体中文); the header toggle follows the system language and remembers your choice.

## 技术选型 / Tech stack

| 选择 | 说明 |
|------|------|
| **Tauri 2 + Vite + React + TypeScript** | 桌面壳与前端 |
| **`crates/video-sdk`（Rust）** | 可复用的 ffmpeg 转换库（核心） |
| **`packages/video-sdk`（TypeScript）** | 薄类型层，供前端复用 |

核心转换：`ffmpeg` 的 `palettegen` + `paletteuse`（`filter_complex` 两段式调色板），抖动默认 `sierra2_4a`。

## 功能

- **语言 / Language**：English 与简体中文，默认跟随系统语言

### 简易模式（默认）

- 拖入视频（或点击选择）→ 自动转换
- GIF 保存在视频同一目录（`name.gif`）
- 静默预设：宽 480、12 fps、调色板优化；要裁剪/改参数请用高级模式

### 高级模式（右上角切换）

- 宽度、帧率、起始时间 + 时长裁剪、循环、颜色数、抖动、速度、输出路径

## 项目结构 / Layout

```
crates/video-sdk/          # Rust SDK（ffmpeg 封装，可被其他项目依赖）
packages/video-sdk/        # TS 类型（@video2gif/sdk）
src/                       # React UI（i18n: en / zh-CN）
src-tauri/                 # Tauri 2 应用（commands → video-sdk）
resources/ffmpeg/          # 可选捆绑二进制
```

## 开发 / Development

### 依赖

- Node.js 20+
- Rust (stable, 建议 ≥ 1.88) + Tauri CLI
- 系统 `ffmpeg` / `ffprobe`（开发）
- Linux：WebKitGTK 4.1 等 Tauri 系统依赖

```bash
# Debian/Ubuntu 示例
sudo apt install ffmpeg \
  libwebkit2gtk-4.1-dev libayatana-appindicator3-dev \
  librsvg2-dev patchelf libgtk-3-dev libssl-dev
```

### 安装与运行

```bash
cd video2gif
npm install
npm run tauri:dev     # Vite + Tauri 热开发
```

仅前端（无 ffmpeg / 无本地路径）：

```bash
npm run dev
```

### SDK 冒烟测试（无界面，推荐）

```bash
cargo test -p video-sdk
# 或
npm run smoke
```

会生成短测试视频并转成 GIF，验证转换链路。

CLI 示例：

```bash
cargo run -p video-sdk --example convert_cli -- /path/in.mp4 /tmp/out.gif 2
```

### 打包

```bash
# 可选：按下方说明放入 ffmpeg 二进制
npm run tauri:build
```

## 复用 SDK / Depend on video-sdk

### Rust（推荐）

Path（本仓库）：

```toml
[dependencies]
video-sdk = { path = "crates/video-sdk" }
```

Git：

```toml
[dependencies]
video-sdk = { git = "https://github.com/ledshic/video2gif", package = "video-sdk" }
```

crates.io（若已发布）：

```toml
[dependencies]
video-sdk = "0.1"
```

主要 API：`convert_video_to_gif` / `convert_async`（可取消）、`probe` / `probe_duration`、`WECHAT_LIKE` 等聊天预设、`default_output_path`。详见 `crates/video-sdk/README.md`。

### TypeScript 类型

```json
{
  "dependencies": {
    "@video2gif/sdk": "file:packages/video-sdk"
  }
}
```

运行时转换仍由 Rust SDK / Tauri commands 完成。

## FFmpeg 捆绑 / Bundling

| 场景 | 行为 |
|------|------|
| 开发 | 系统 `ffmpeg`；或 `VIDEO_SDK_FFMPEG` / `VIDEO2GIF_FFMPEG` |
| 打包发布 | 将各平台静态二进制放到 `resources/ffmpeg/<platform>-<arch>/` |

目录约定：

```
resources/ffmpeg/
  linux-x64/ffmpeg
  linux-arm64/ffmpeg
  darwin-x64/ffmpeg
  darwin-arm64/ffmpeg
  win32-x64/ffmpeg.exe
  win32-arm64/ffmpeg.exe
```

Tauri：`src-tauri/tauri.conf.json` 的 `bundle.resources` 会打进安装包；也可改为 sidecar / `externalBin`。

参考：[BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds/releases)。

## License

MIT
