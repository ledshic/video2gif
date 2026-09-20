#!/usr/bin/env node
/**
 * Headless smoke test: generate a short test video, convert to GIF via the same
 * ffmpeg helpers used by the Electron app, verify output exists and size > 0.
 */
import { createRequire } from 'module';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const require = createRequire(import.meta.url);

// Minimal stub so electron/ffmpeg.cjs can load without a running Electron app
const Module = require('module');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    return {
      app: {
        isPackaged: false,
        getAppPath: () => root,
      },
    };
  }
  return origLoad(request, parent, isMain);
};

const { convert, getFfmpegPath, SIMPLE_DEFAULTS } = require(path.join(root, 'electron', 'ffmpeg.cjs'));

const tmp = path.join(root, 'tmp-smoke');
fs.mkdirSync(tmp, { recursive: true });
const video = path.join(tmp, 'sample.mp4');
const gif = path.join(tmp, 'sample.gif');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} failed (${code}): ${err.slice(-500)}`));
    });
    child.on('error', reject);
  });
}

async function main() {
  const ffmpeg = getFfmpegPath();
  console.log('ffmpeg:', ffmpeg);
  console.log('defaults:', SIMPLE_DEFAULTS);

  console.log('Generating 3s test video…');
  await run(ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100',
    '-t', '3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
    video,
  ]);
  console.log('OK video:', video, fs.statSync(video).size, 'bytes');

  console.log('Converting to GIF (palettegen/paletteuse)…');
  const job = convert({
    input: video,
    output: gif,
    width: SIMPLE_DEFAULTS.width,
    fps: SIMPLE_DEFAULTS.fps,
    duration: 3,
    colors: SIMPLE_DEFAULTS.colors,
    dither: SIMPLE_DEFAULTS.dither,
    loop: 0,
    onProgress(pct, msg) {
      process.stdout.write(`\r  ${msg} (${pct}%)   `);
    },
  });
  await job.promise;
  console.log('\nOK gif:', gif, fs.statSync(gif).size, 'bytes');

  if (fs.statSync(gif).size < 1000) {
    throw new Error('GIF too small — conversion likely failed');
  }
  console.log('\nSMOKE TEST PASSED');
}

main().catch((e) => {
  console.error('\nSMOKE TEST FAILED:', e.message || e);
  process.exit(1);
});
