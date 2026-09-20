/**
 * ffmpeg resolution + conversion helpers (Node / Electron main process).
 * Uses palettegen + paletteuse for quality GIFs.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const SIMPLE_DEFAULTS = {
  width: 480,
  fps: 12,
  maxDuration: 15,
  colors: 256,
  dither: 'sierra2_4a',
  loop: 0, // 0 = infinite
  speed: 1,
};

function getFfmpegPath() {
  // Packaged: resources/ffmpeg/<platform>/ffmpeg[.exe]
  // Dev: env VIDEO2GIF_FFMPEG, then bundled resources, then system PATH
  if (process.env.VIDEO2GIF_FFMPEG && fs.existsSync(process.env.VIDEO2GIF_FFMPEG)) {
    return process.env.VIDEO2GIF_FFMPEG;
  }

  const platform = process.platform; // darwin | win32 | linux
  const arch = process.arch; // x64 | arm64
  const binName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const platformDir =
    platform === 'darwin'
      ? `darwin-${arch}`
      : platform === 'win32'
        ? `win32-${arch}`
        : `linux-${arch}`;

  const candidates = [];

  if (app && app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, 'ffmpeg', platformDir, binName));
    candidates.push(path.join(process.resourcesPath, 'ffmpeg', binName));
  }

  // Dev / repo layout
  const root = app ? app.getAppPath() : path.join(__dirname, '..');
  candidates.push(path.join(root, 'resources', 'ffmpeg', platformDir, binName));
  candidates.push(path.join(root, 'resources', 'ffmpeg', binName));

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  // System ffmpeg (OK for Linux dev; packaging ships binaries for all platforms)
  return 'ffmpeg';
}

function getFfprobePath() {
  const ffmpeg = getFfmpegPath();
  if (ffmpeg === 'ffmpeg') return 'ffprobe';
  const dir = path.dirname(ffmpeg);
  const name = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
  const p = path.join(dir, name);
  return fs.existsSync(p) ? p : 'ffprobe';
}

/**
 * Probe video duration (seconds). Returns null on failure.
 */
function probeDuration(inputPath) {
  return new Promise((resolve) => {
    const ffprobe = getFfprobePath();
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ];
    const child = spawn(ffprobe, args, { windowsHide: true });
    let out = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.on('close', (code) => {
      if (code !== 0) return resolve(null);
      const n = parseFloat(out.trim());
      resolve(Number.isFinite(n) ? n : null);
    });
    child.on('error', () => resolve(null));
  });
}

/**
 * Build filter_complex for high-quality GIF.
 * Options: width, fps, start, duration, colors, dither, speed
 */
function buildFilterComplex(opts) {
  const width = opts.width || SIMPLE_DEFAULTS.width;
  const fps = opts.fps || SIMPLE_DEFAULTS.fps;
  const colors = opts.colors || SIMPLE_DEFAULTS.colors;
  const dither = opts.dither || SIMPLE_DEFAULTS.dither;
  const speed = opts.speed && opts.speed > 0 ? opts.speed : 1;

  // setpts for speed: faster = smaller PTS
  const pts = speed === 1 ? 'PTS-STARTPTS' : `(PTS-STARTPTS)/${speed}`;
  const fpsEffective = Math.max(1, Math.round(fps * (speed === 1 ? 1 : 1))); // keep fps as requested

  // Scale maintaining aspect, then fps, then split for palette
  const scale = `scale=${width}:-1:flags=lanczos`;
  const vf = `setpts=${pts},${scale},fps=${fpsEffective}`;

  return `[0:v]${vf},split[s0][s1];[s0]palettegen=max_colors=${colors}:stats_mode=diff[p];[s1][p]paletteuse=dither=${dither}`;
}

/**
 * Convert video to GIF. Returns a handle with promise + cancel().
 *
 * @param {object} options
 * @param {string} options.input
 * @param {string} options.output
 * @param {number} [options.width]
 * @param {number} [options.fps]
 * @param {number} [options.start] seconds
 * @param {number} [options.duration] seconds
 * @param {number} [options.loop] 0=infinite, -1=no loop, N=loop N times (ffmpeg -loop)
 * @param {number} [options.colors]
 * @param {string} [options.dither]
 * @param {number} [options.speed]
 * @param {(pct: number, message: string) => void} [options.onProgress]
 */
function convert(options) {
  const ffmpeg = getFfmpegPath();
  const input = options.input;
  const output = options.output;
  const start = options.start != null && options.start > 0 ? options.start : null;
  const duration = options.duration != null && options.duration > 0 ? options.duration : null;
  const loop = options.loop != null ? options.loop : SIMPLE_DEFAULTS.loop;

  const filter = buildFilterComplex(options);

  const args = ['-y', '-hide_banner'];
  if (start != null) {
    args.push('-ss', String(start));
  }
  args.push('-i', input);
  if (duration != null) {
    args.push('-t', String(duration));
  }
  args.push('-filter_complex', filter);
  args.push('-loop', String(loop));
  args.push('-an', output);

  let child = null;
  let cancelled = false;
  let stderr = '';

  const promise = new Promise(async (resolve, reject) => {
    // Estimate duration for progress
    let totalSec = duration;
    if (!totalSec) {
      const probed = await probeDuration(input);
      if (probed != null) {
        totalSec = start != null ? Math.max(0, probed - start) : probed;
      }
    }
    if (options.speed && options.speed > 0 && totalSec) {
      totalSec = totalSec / options.speed;
    }

    child = spawn(ffmpeg, args, { windowsHide: true });

    child.stderr.on('data', (buf) => {
      const text = buf.toString();
      stderr += text;
      // Parse time=HH:MM:SS.xx
      const m = text.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (m && options.onProgress && totalSec) {
        const sec = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
        const pct = Math.min(99, Math.round((sec / totalSec) * 100));
        options.onProgress(pct, `转换中… ${pct}%`);
      } else if (options.onProgress) {
        options.onProgress(-1, '转换中…');
      }
    });

    child.on('error', (err) => {
      if (cancelled) return reject(Object.assign(new Error('已取消'), { cancelled: true }));
      reject(new Error(`无法启动 ffmpeg: ${err.message}\n路径: ${ffmpeg}`));
    });

    child.on('close', (code) => {
      if (cancelled) {
        try { if (fs.existsSync(output)) fs.unlinkSync(output); } catch (_) {}
        return reject(Object.assign(new Error('已取消'), { cancelled: true }));
      }
      if (code !== 0) {
        const tail = stderr.split('\n').slice(-20).join('\n');
        return reject(new Error(`ffmpeg 退出码 ${code}\n${tail}`));
      }
      if (options.onProgress) options.onProgress(100, '完成');
      resolve({ output, ffmpeg });
    });
  });

  return {
    promise,
    cancel() {
      cancelled = true;
      if (child && !child.killed) {
        try {
          child.kill('SIGTERM');
          setTimeout(() => {
            if (child && !child.killed) child.kill('SIGKILL');
          }, 1500);
        } catch (_) {}
      }
    },
  };
}

module.exports = {
  SIMPLE_DEFAULTS,
  getFfmpegPath,
  getFfprobePath,
  probeDuration,
  buildFilterComplex,
  convert,
};
