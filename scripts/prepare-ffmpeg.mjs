import { copyFile, chmod, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("@ffprobe-installer/ffprobe").path;

const platforms = {
  darwin: "darwin",
  linux: "linux",
  win32: "win32",
};
const architectures = {
  arm64: "arm64",
  x64: "x64",
};

const platform = platforms[process.platform];
const architecture = architectures[process.arch];
if (!platform || !architecture) {
  throw new Error(`Unsupported FFmpeg target: ${process.platform}-${process.arch}`);
}

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const destination = join(
  projectRoot,
  "resources",
  "ffmpeg",
  `${platform}-${architecture}`,
);
const executableSuffix = process.platform === "win32" ? ".exe" : "";

await mkdir(destination, { recursive: true });
await Promise.all([
  copyFile(ffmpegPath, join(destination, `ffmpeg${executableSuffix}`)),
  copyFile(ffprobePath, join(destination, `ffprobe${executableSuffix}`)),
]);

if (process.platform !== "win32") {
  await Promise.all([
    chmod(join(destination, "ffmpeg"), 0o755),
    chmod(join(destination, "ffprobe"), 0o755),
  ]);
}

console.log(`Prepared FFmpeg binaries in ${destination}`);
