import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ConvertOptions } from '@video2gif/sdk';
import * as api from './api';

type Mode = 'simple' | 'advanced';

const DITHER_OPTIONS = [
  { value: 'sierra2_4a', label: 'sierra2_4a（推荐）' },
  { value: 'bayer', label: 'bayer' },
  { value: 'floyd_steinberg', label: 'floyd_steinberg' },
  { value: 'none', label: '无抖动' },
];

function basename(p: string) {
  return p.split(/[/\\]/).pop() || p;
}

function formatDuration(sec: number | null) {
  if (sec == null || !Number.isFinite(sec)) return '未知';
  if (sec < 60) return `${sec.toFixed(1)} 秒`;
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(0);
  return `${m} 分 ${s} 秒`;
}

export default function App() {
  const inTauri = api.isTauri();

  const [mode, setMode] = useState<Mode>('simple');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [ffmpegPath, setFfmpegPath] = useState('');

  const [width, setWidth] = useState(480);
  const [fps, setFps] = useState(12);
  const [start, setStart] = useState(0);
  const [trimDuration, setTrimDuration] = useState(15);
  const [loop, setLoop] = useState(0);
  const [colors, setColors] = useState(256);
  const [dither, setDither] = useState('sierra2_4a');
  const [speed, setSpeed] = useState(1);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!inTauri) return;
    api.getDefaults().then((d) => {
      setWidth(d.width);
      setFps(d.fps);
      setTrimDuration(d.maxDuration);
      setColors(d.colors);
      setDither(d.dither);
      setLoop(d.loop);
      setSpeed(d.speed);
      setFfmpegPath(d.ffmpegPath);
    });
  }, [inTauri]);

  useEffect(() => {
    if (!inTauri) return;
    let unlisten: (() => void) | undefined;
    api.onProgress(({ pct, message }) => {
      if (pct >= 0) setProgress(pct);
      setProgressMsg(message);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [inTauri]);

  const loadFile = useCallback(
    async (filePath: string) => {
      if (!inTauri || !filePath) return;
      setInput(filePath);
      setError('');
      setResult('');
      const out = await api.defaultOutputPath(filePath);
      setOutput(out);
      const dur = await api.probeDuration(filePath);
      setDuration(dur);
      if (dur != null && mode === 'simple') {
        setTrimDuration(Math.min(15, Math.ceil(dur)));
      } else if (dur != null && mode === 'advanced' && trimDuration <= 0) {
        setTrimDuration(Math.ceil(dur));
      }
    },
    [inTauri, mode, trimDuration],
  );

  const onPickVideo = async () => {
    if (!inTauri) return;
    const p = await api.selectVideo();
    if (p) await loadFile(p);
  };

  const onPickOutput = async () => {
    if (!inTauri) return;
    const p = await api.selectOutput(basename(output) || 'output.gif');
    if (p) setOutput(p);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!inTauri) return;
    // Tauri 2 may expose path on File via webkitGetAsEntry / drag drop plugin.
    // Prefer dialog if path missing.
    const file = e.dataTransfer.files?.[0] as File & { path?: string };
    if (!file) return;
    const p = file.path;
    if (!p) {
      setError('请通过「选择视频」按钮选择本地文件（拖放路径在部分环境下不可用）。');
      return;
    }
    await loadFile(p);
  };

  const effectiveDuration = useMemo(() => {
    if (mode === 'simple') {
      if (duration == null) return 15;
      return Math.min(15, duration);
    }
    return trimDuration > 0 ? trimDuration : undefined;
  }, [mode, duration, trimDuration]);

  const durationWarn =
    mode === 'simple' && duration != null && duration > 15
      ? `视频约 ${formatDuration(duration)}，简易模式将只转换前 15 秒（聊天应用友好）。可切换到「高级」调整。`
      : '';

  const onConvert = async () => {
    if (!inTauri || !input || !output) return;
    setBusy(true);
    setError('');
    setResult('');
    setProgress(0);
    setProgressMsg('准备中…');

    const opts: ConvertOptions = {
      input,
      output,
      width: mode === 'simple' ? 480 : width,
      fps: mode === 'simple' ? 12 : fps,
      start: mode === 'simple' ? 0 : start > 0 ? start : undefined,
      duration: effectiveDuration,
      loop: mode === 'simple' ? 0 : loop,
      colors: mode === 'simple' ? 256 : colors,
      dither: mode === 'simple' ? 'sierra2_4a' : dither,
      speed: mode === 'simple' ? 1 : speed,
    };

    const res = await api.convert(opts);
    setBusy(false);
    if (res.cancelled) {
      setProgressMsg('已取消');
      return;
    }
    if (!res.ok) {
      setError(res.error || '转换失败');
      setProgressMsg('失败');
      return;
    }
    setProgress(100);
    setProgressMsg('完成');
    setResult(res.output || output);
  };

  const onCancel = async () => {
    if (!inTauri) return;
    await api.cancelConvert();
  };

  if (!inTauri) {
    return (
      <div className="app">
        <div className="main">
          <div className="card">
            <h2>提示</h2>
            <p className="hint">
              请通过 Tauri 启动本应用：<code>npm run tauri:dev</code>
              。浏览器预览无法访问本地文件路径与 ffmpeg。
            </p>
            <p className="hint">
              无界面冒烟测试：<code>npm run smoke</code> 或{' '}
              <code>cargo test -p video-sdk</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="logo">GIF</div>
          <div>
            <h1>Video2GIF</h1>
            <p>视频转 GIF · 聊天应用友好预设</p>
          </div>
        </div>
        <div className="mode-switch" title="切换模式">
          <button
            type="button"
            className={mode === 'simple' ? 'active' : ''}
            onClick={() => setMode('simple')}
          >
            简易
          </button>
          <button
            type="button"
            className={mode === 'advanced' ? 'active' : ''}
            onClick={() => setMode('advanced')}
          >
            高级
          </button>
        </div>
      </header>

      <main className="main">
        <div
          className={`dropzone ${dragOver ? 'dragover' : ''} ${input ? 'has-file' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {!input ? (
            <>
              <p className="drop-title">拖放视频到此处</p>
              <p className="drop-sub">支持 mp4 / mov / webm / mkv / avi 等常见格式</p>
              <div style={{ marginTop: 16 }}>
                <button type="button" className="btn btn-primary" onClick={onPickVideo}>
                  选择视频…
                </button>
              </div>
            </>
          ) : (
            <div className="file-row">
              <div className="file-meta">
                <strong>{basename(input)}</strong>
                <span>
                  {input}
                  {duration != null ? ` · 时长 ${formatDuration(duration)}` : ''}
                </span>
              </div>
              <button type="button" className="btn" onClick={onPickVideo} disabled={busy}>
                更换…
              </button>
            </div>
          )}
        </div>

        {mode === 'simple' && (
          <div className="card">
            <h2>简易预设（微信 / Telegram / Discord 友好）</h2>
            <p className="hint">
              宽度 ≤ 480px · 12 fps · palettegen/paletteuse · 最长约 15 秒 · sierra2_4a 抖动
            </p>
            <div className="preset-chips">
              <span className="chip">宽 480</span>
              <span className="chip">12 fps</span>
              <span className="chip">调色板优化</span>
              <span className="chip">最长 15s</span>
            </div>
            {durationWarn && (
              <p className="warn" style={{ marginTop: 12 }}>
                {durationWarn}
              </p>
            )}
          </div>
        )}

        {mode === 'advanced' && (
          <div className="card">
            <h2>高级参数</h2>
            <div className="grid">
              <div className="field">
                <label htmlFor="width">宽度（保持比例）</label>
                <input
                  id="width"
                  type="number"
                  min={64}
                  max={1920}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value) || 480)}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label htmlFor="fps">帧率 (fps)</label>
                <input
                  id="fps"
                  type="number"
                  min={1}
                  max={30}
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value) || 12)}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label htmlFor="start">起始时间（秒）</label>
                <input
                  id="start"
                  type="number"
                  min={0}
                  step={0.1}
                  value={start}
                  onChange={(e) => setStart(Number(e.target.value) || 0)}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label htmlFor="trim">截取时长（秒）</label>
                <input
                  id="trim"
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={trimDuration}
                  onChange={(e) => setTrimDuration(Number(e.target.value) || 1)}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label htmlFor="loop">循环（0=无限，-1=不循环）</label>
                <input
                  id="loop"
                  type="number"
                  value={loop}
                  onChange={(e) => setLoop(Number(e.target.value))}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label htmlFor="colors">颜色数</label>
                <input
                  id="colors"
                  type="number"
                  min={2}
                  max={256}
                  value={colors}
                  onChange={(e) => setColors(Number(e.target.value) || 256)}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label htmlFor="dither">抖动算法</label>
                <select
                  id="dither"
                  value={dither}
                  onChange={(e) => setDither(e.target.value)}
                  disabled={busy}
                >
                  {DITHER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="speed">播放速度（1=原速）</label>
                <input
                  id="speed"
                  type="number"
                  min={0.25}
                  max={4}
                  step={0.25}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value) || 1)}
                  disabled={busy}
                />
              </div>
              <div className="field full">
                <label htmlFor="output">输出路径</label>
                <div className="path-row">
                  <input
                    id="output"
                    value={output}
                    onChange={(e) => setOutput(e.target.value)}
                    disabled={busy}
                  />
                  <button type="button" className="btn" onClick={onPickOutput} disabled={busy}>
                    浏览…
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === 'simple' && input && (
          <div className="card">
            <h2>输出</h2>
            <p className="hint" style={{ wordBreak: 'break-all' }}>
              {output || '（自动）'}
            </p>
            <div style={{ marginTop: 10 }}>
              <button type="button" className="btn" onClick={onPickOutput} disabled={busy}>
                更改保存位置…
              </button>
            </div>
          </div>
        )}

        <div className="actions">
          {!busy ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!input || !output}
              onClick={onConvert}
            >
              {mode === 'simple' ? '一键转换为 GIF' : '开始生成'}
            </button>
          ) : (
            <button type="button" className="btn btn-danger" onClick={onCancel}>
              取消转换
            </button>
          )}
          {result && (
            <>
              <button
                type="button"
                className="btn"
                onClick={() => api.showItemInFolder(result)}
              >
                在文件夹中显示
              </button>
              <button type="button" className="btn" onClick={() => api.openGif(result)}>
                打开 GIF
              </button>
            </>
          )}
        </div>

        {(busy || progressMsg) && (
          <div className="card">
            <div className="progress-label">
              <span>{progressMsg || '转换中…'}</span>
              <span>{progress >= 0 ? `${progress}%` : ''}</span>
            </div>
            <div className="progress">
              <span style={{ width: `${Math.max(0, progress)}%` }} />
            </div>
          </div>
        )}

        {error && (
          <div className="card">
            <p className="error">{error}</p>
          </div>
        )}

        {result && !error && (
          <div className="card">
            <p className="success">已保存：{result}</p>
          </div>
        )}
      </main>

      <footer className="footer">
        ffmpeg: {ffmpegPath || '…'} · Tauri 2 + Vite + React · video-sdk
      </footer>
    </div>
  );
}
