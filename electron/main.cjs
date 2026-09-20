const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { convert, probeDuration, getFfmpegPath, SIMPLE_DEFAULTS } = require('./ffmpeg.cjs');

const isDev = !app.isPackaged;
let mainWindow = null;
/** @type {{ cancel: Function } | null} */
let currentJob = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 720,
    minWidth: 720,
    minHeight: 560,
    title: 'Video2GIF',
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(url);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (currentJob) currentJob.cancel();
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('get-defaults', () => ({ ...SIMPLE_DEFAULTS, ffmpegPath: getFfmpegPath() }));

ipcMain.handle('probe-duration', async (_e, inputPath) => {
  return probeDuration(inputPath);
});

ipcMain.handle('select-video', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: '选择视频',
    properties: ['openFile'],
    filters: [
      {
        name: '视频',
        extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', 'flv', 'wmv', 'mpeg', 'mpg', 'ts', 'gif'],
      },
      { name: '所有文件', extensions: ['*'] },
    ],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  return r.filePaths[0];
});

ipcMain.handle('select-output', async (_e, defaultName) => {
  const r = await dialog.showSaveDialog(mainWindow, {
    title: '保存 GIF',
    defaultPath: defaultName || 'output.gif',
    filters: [{ name: 'GIF', extensions: ['gif'] }],
  });
  if (r.canceled || !r.filePath) return null;
  return r.filePath;
});

ipcMain.handle('show-item-in-folder', async (_e, filePath) => {
  if (filePath && fs.existsSync(filePath)) shell.showItemInFolder(filePath);
});

ipcMain.handle('open-path', async (_e, filePath) => {
  if (filePath && fs.existsSync(filePath)) return shell.openPath(filePath);
  return '文件不存在';
});

ipcMain.handle('default-output-path', async (_e, inputPath) => {
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  let out = path.join(dir, `${base}.gif`);
  let i = 1;
  while (fs.existsSync(out)) {
    out = path.join(dir, `${base}_${i}.gif`);
    i += 1;
  }
  return out;
});

ipcMain.handle('convert', async (event, opts) => {
  if (currentJob) {
    currentJob.cancel();
    currentJob = null;
  }

  const input = opts.input;
  const output = opts.output;
  if (!input || !fs.existsSync(input)) {
    throw new Error('输入文件不存在');
  }
  if (!output) throw new Error('未指定输出路径');

  const outDir = path.dirname(output);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const job = convert({
    ...opts,
    onProgress(pct, message) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('convert-progress', { pct, message });
      }
    },
  });
  currentJob = job;

  try {
    const result = await job.promise;
    currentJob = null;
    return { ok: true, output: result.output };
  } catch (err) {
    currentJob = null;
    if (err && err.cancelled) {
      return { ok: false, cancelled: true, error: '已取消' };
    }
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('cancel-convert', async () => {
  if (currentJob) {
    currentJob.cancel();
    currentJob = null;
    return true;
  }
  return false;
});
