# Video2GIF

跨平台桌面应用：将视频转换为高质量 GIF（中文界面）。

**Video → GIF converter** with chat-app-friendly presets (WeChat / Telegram / Discord style).

## 技术选型 / Tech stack

| 选择 | 说明 |
|------|------|
| **Electron + Vite + React + TypeScript** | 本仓库采用此方案 |
| Tauri 2（未采用） | 本机 Debian 环境缺少可用的 WebKitGTK 开发包，且空闲内存偏紧，Rust/WebView 编译风险高；为尽快交付可运行 MVP 选择 Electron |

核心转换：`ffmpeg` 的 `palettegen` + `paletteuse`（`filter_complex` 两段式调色板），抖动默认 `sierra2_4a`。

## 功能

### 简易模式（默认）

- 拖放或选择视频 → **一键转换**
- 预设：宽度 480（保持比例）、12 fps、最长约 15 秒、256 色、无限循环
- 进度条、取消、保存位置、在文件夹中显示 / 打开结果

### 高级模式（右上角切换）

- 宽度、帧率、起始时间 + 时长裁剪、循环、颜色数、抖动、速度、输出路径

## 开发 / Development

### 依赖

- Node.js 20+
- 开发机上的 `ffmpeg`（Linux 可用系统包）；打包时请按下方说明捆绑二进制

```bash
# Debian/Ubuntu 示例
sudo apt install ffmpeg
```

### 安装与运行

```bash
cd video2gif
npm install
npm run electron:dev    # Vite + Electron 热开发
```

仅前端（无 ffmpeg / 无本地路径）：

```bash
npm run dev
```

### 无界面冒烟测试（本机推荐）

```bash
npm run smoke
```

会生成 3 秒测试视频并转成 GIF，验证转换链路。

### 打包

```bash
# 先按「FFmpeg 捆绑」放入对应平台二进制
npm run electron:build
```

产物在 `release/`。

## FFmpeg 捆绑 / Bundling

| 场景 | 行为 |
|------|------|
| 开发（Linux） | 可用系统 `ffmpeg`；也可设置环境变量 `VIDEO2GIF_FFMPEG=/path/to/ffmpeg` |
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

查看缺失情况：

```bash
npm run ffmpeg:info
```

参考来源：`ffmpeg-static` npm 包、[BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds/releases) 等。`electron-builder` 的 `extraResources` 会把对应目录打进安装包；运行时由 `electron/ffmpeg.cjs` 解析路径。

## 项目结构

```
electron/main.cjs      # Electron 主进程 / IPC
electron/preload.cjs   # 安全桥接
electron/ffmpeg.cjs    # 路径解析 + 转换 + 取消
src/                  # React UI（中文）
scripts/smoke-test.mjs
resources/ffmpeg/     # 可选捆绑二进制
```

## License

MIT
