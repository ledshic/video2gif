#!/usr/bin/env node
/**
 * Documents / prints how to vendor ffmpeg for packaging.
 * Place binaries under:
 *   resources/ffmpeg/linux-x64/ffmpeg
 *   resources/ffmpeg/linux-arm64/ffmpeg
 *   resources/ffmpeg/darwin-x64/ffmpeg
 *   resources/ffmpeg/darwin-arm64/ffmpeg
 *   resources/ffmpeg/win32-x64/ffmpeg.exe
 *   resources/ffmpeg/win32-arm64/ffmpeg.exe
 *
 * Suggested sources (static builds):
 *   - https://github.com/eugeneware/ffmpeg-static (npm package, per-platform)
 *   - https://github.com/BtbN/FFmpeg-Builds/releases (Linux/Windows)
 *   - https://evermeet.cx/ffmpeg/ (macOS Intel) / official mac builds for arm64
 *
 * Dev on Linux: system `ffmpeg` is used automatically when no bundled binary exists.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'resources', 'ffmpeg');

const expected = [
  'linux-x64/ffmpeg',
  'linux-arm64/ffmpeg',
  'darwin-x64/ffmpeg',
  'darwin-arm64/ffmpeg',
  'win32-x64/ffmpeg.exe',
  'win32-arm64/ffmpeg.exe',
];

console.log('Bundled ffmpeg layout under resources/ffmpeg/\n');
for (const rel of expected) {
  const p = path.join(base, rel);
  const ok = fs.existsSync(p);
  console.log(`  ${ok ? '✓' : '·'} ${rel}${ok ? '' : '  (missing — packaging will fall back to PATH if present)'}`);
}
console.log(`
How to vendor (example with ffmpeg-static):
  npm i -D ffmpeg-static
  # copy the downloaded binary into resources/ffmpeg/<platform-arch>/

Or download a release zip and extract the ffmpeg binary into the matching folder.
electron-builder extraResources maps resources/ffmpeg/\${os}-\${arch} → ffmpeg/\${os}-\${arch}
inside the app package; electron/ffmpeg.js resolves that path at runtime.
`);
