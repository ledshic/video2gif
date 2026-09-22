import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConvertOptions } from '@video2gif/sdk';
import * as api from './api';
import { useI18n } from './i18n/LocaleContext';
import type { MessageKey, TFunction } from './i18n';

type Mode = 'simple' | 'advanced';
type ProgressStatus = 'idle' | 'preparing' | 'converting' | 'cancelled' | 'failed' | 'done';

/** Once processing UI is shown, keep it long enough to read; let the bar finish after 100%. */
const MIN_BUSY_MS = 600;
const BAR_SETTLE_MS = 400;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function basename(p: string) {
  return p.split(/[/\\]/).pop() || p;
}

function formatDuration(sec: number | null, t: TFunction) {
  if (sec == null || !Number.isFinite(sec)) return t('duration.unknown');
  if (sec < 60) return t('duration.seconds', { n: sec.toFixed(1) });
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(0);
  return t('duration.minutes', { m, s });
}

function localizeError(raw: string, t: TFunction): string {
  const s = raw.trim();
  const lower = s.toLowerCase();
  if (
    s === '输入文件不存在' ||
    lower === 'input file not found' ||
    lower.startsWith('input file not found:')
  ) {
    return t('errors.inputMissing');
  }
  if (s === '未指定输出路径' || lower === 'output path not specified') {
    return t('errors.outputMissing');
  }
  if (s === '已取消' || lower === 'cancelled') {
    return t('progress.cancelled');
  }
  if (
    lower.includes('ffmpeg not found') ||
    s.includes('无法启动 ffmpeg') ||
    lower.includes('failed to start ffmpeg')
  ) {
    return t('errors.ffmpegMissing', { detail: s });
  }
  if (
    lower.includes('library not loaded') ||
    lower.includes('image not found') ||
    lower.includes('dyld[')
  ) {
    return t('errors.ffmpegBroken');
  }
  if (lower.includes('ffmpeg failed')) {
    return t('errors.ffmpegFailed', { detail: s });
  }
  return s;
}

function inRect(el: HTMLElement | null, position?: { x: number; y: number }) {
  if (!el || !position) return false;
  const r = el.getBoundingClientRect();
  const hits = (x: number, y: number) =>
    x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  if (hits(position.x, position.y)) return true;
  const dpr = window.devicePixelRatio || 1;
  return dpr !== 1 && hits(position.x / dpr, position.y / dpr);
}

function progressLabel(status: ProgressStatus, t: TFunction): string {
  switch (status) {
    case 'preparing':
      return t('progress.preparing');
    case 'converting':
      return t('progress.converting');
    case 'cancelled':
      return t('progress.cancelled');
    case 'failed':
      return t('progress.failed');
    case 'done':
      return t('progress.done');
    default:
      return '';
  }
}

export default function App() {
  const inTauri = api.isTauri();
  const { t } = useI18n();

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
  const [progressStatus, setProgressStatus] = useState<ProgressStatus>('idle');
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [errorRaw, setErrorRaw] = useState('');
  const [result, setResult] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [runId, setRunId] = useState(0);

  const modeRef = useRef(mode);
  const jobRef = useRef(0);
  const busyRef = useRef(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const ditherOptions = useMemo(
    () => [
      { value: 'sierra2_4a', label: t('advanced.ditherRecommended') },
      { value: 'bayer', label: 'bayer' },
      { value: 'floyd_steinberg', label: 'floyd_steinberg' },
      { value: 'none', label: t('advanced.ditherNone') },
    ],
    [t],
  );

  const displayError = errorKey
    ? t(errorKey)
    : errorRaw
      ? localizeError(errorRaw, t)
      : '';

  const clearError = () => {
    setErrorKey(null);
    setErrorRaw('');
  };

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
    api
      .onProgress(({ pct }) => {
        if (!busyRef.current) return;
        if (pct >= 0) {
          setProgress((prev) => Math.max(prev, Math.min(pct, 96)));
        }
        setProgressStatus('converting');
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => {
      unlisten?.();
    };
  }, [inTauri]);

  const beginProcessing = (filePath?: string) => {
    busyRef.current = true;
    setBusy(true);
    clearError();
    setResult('');
    setProgress(12);
    setProgressStatus('converting');
    if (filePath) {
      setInput(filePath);
      setDuration(null);
    }
  };

  const runConvert = useCallback(
    async (
      _filePath: string,
      outPath: string,
      opts: ConvertOptions,
      job: number,
      startedAt: number,
    ) => {
      beginProcessing();

      const res = await api.convert(opts);
      if (job !== jobRef.current) return;

      if (res.cancelled) {
        busyRef.current = false;
        setBusy(false);
        setProgressStatus('cancelled');
        return;
      }
      if (!res.ok) {
        busyRef.current = false;
        setBusy(false);
        setErrorRaw(res.error || '');
        if (!res.error) setErrorKey('errors.convertFailed');
        setProgressStatus('failed');
        return;
      }

      setProgress(100);
      const wait = Math.max(
        MIN_BUSY_MS - (performance.now() - startedAt),
        BAR_SETTLE_MS,
      );
      if (wait > 0) await sleep(wait);
      if (job !== jobRef.current) return;

      busyRef.current = false;
      setBusy(false);
      setProgressStatus('done');
      setResult(res.output || outPath);
    },
    [],
  );

  const startSimpleConvert = useCallback(
    async (filePath: string) => {
      if (!inTauri || !filePath) return;
      const job = ++jobRef.current;
      const startedAt = performance.now();
      setRunId(job);
      beginProcessing(filePath);
      const out = await api.defaultOutputPath(filePath);
      if (job !== jobRef.current) return;
      setOutput(out);
      await runConvert(
        filePath,
        out,
        {
          input: filePath,
          output: out,
          width: 480,
          fps: 12,
          start: 0,
          loop: 0,
          colors: 256,
          dither: 'sierra2_4a',
          speed: 1,
        },
        job,
        startedAt,
      );
    },
    [inTauri, runConvert],
  );

  const loadFile = useCallback(
    async (filePath: string) => {
      if (!inTauri || !filePath) return;
      setInput(filePath);
      clearError();
      setResult('');
      setProgressStatus('idle');
      const out = await api.defaultOutputPath(filePath);
      setOutput(out);
      const dur = await api.probeDuration(filePath);
      setDuration(dur);
      if (dur != null && trimDuration <= 0) {
        setTrimDuration(Math.ceil(dur));
      }
    },
    [inTauri, trimDuration],
  );

  const acceptPath = useCallback(
    async (filePath: string) => {
      if (modeRef.current === 'simple') {
        await startSimpleConvert(filePath);
      } else {
        await loadFile(filePath);
      }
    },
    [startSimpleConvert, loadFile],
  );

  useEffect(() => {
    if (!inTauri) return;
    let unlisten: (() => void) | undefined;
    api
      .onNativeDragDrop((state, paths, position) => {
        const overSwitch = inRect(headerRef.current, position);
        if (overSwitch) {
          setDragOver(false);
          return;
        }
        if (state === 'drop') {
          setDragOver(false);
          const p = paths?.[0];
          if (p) void acceptPath(p);
          return;
        }
        if (state === 'leave') {
          setDragOver(false);
          return;
        }
        setDragOver(true);
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => {
      unlisten?.();
    };
  }, [inTauri, acceptPath]);

  const onPickVideo = async () => {
    if (!inTauri || busy) return;
    const p = await api.selectVideo({
      title: t('dialog.selectVideoTitle'),
      filterName: t('dialog.selectVideoFilter'),
    });
    if (p) await acceptPath(p);
  };

  const onPickOutput = async () => {
    if (!inTauri) return;
    const p = await api.selectOutput(
      basename(output) || 'output.gif',
      t('dialog.saveGifTitle'),
    );
    if (p) setOutput(p);
  };

  const onHtmlDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const effectiveDuration = useMemo(() => {
    return trimDuration > 0 ? trimDuration : undefined;
  }, [trimDuration]);

  const onConvertAdvanced = async () => {
    if (!inTauri || !input || !output) return;
    const job = ++jobRef.current;
    const startedAt = performance.now();
    setRunId(job);
    beginProcessing();
    await runConvert(
      input,
      output,
      {
        input,
        output,
        width,
        fps,
        start: start > 0 ? start : undefined,
        duration: effectiveDuration,
        loop,
        colors,
        dither,
        speed,
      },
      job,
      startedAt,
    );
  };

  const onCancel = async () => {
    if (!inTauri) return;
    const cancelled = await api.cancelConvert();
    if (!cancelled) return;
    jobRef.current += 1;
    busyRef.current = false;
    setBusy(false);
    setProgressStatus('cancelled');
  };

  if (!inTauri) {
    return (
      <div className="app">
        <div className="main">
          <div className="card">
            <h2>{t('browser.title')}</h2>
            <p className="hint">
              {t('browser.tauriHintBefore')}
              <code>npm run tauri:dev</code>
              {t('browser.tauriHintAfter')}
            </p>
            <p className="hint">
              {t('browser.smokeHintBefore')}
              <code>npm run smoke</code>
              {t('browser.smokeHintMid')}
              <code>cargo test -p video-sdk</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const simpleBusy = mode === 'simple' && busy;
  const simpleDone = mode === 'simple' && !busy && progressStatus === 'done' && result;
  const simpleFailed = mode === 'simple' && !busy && !!displayError;

  return (
    <div className={`app ${mode === 'simple' ? 'app-simple' : ''}`}>
      <header
        ref={headerRef}
        className="header"
        onDragEnter={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDragLeave={(e) => e.stopPropagation()}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="mode-switch" role="group" title={t('app.modeTitle')}>
          <button
            type="button"
            className={mode === 'simple' ? 'active' : ''}
            onClick={() => setMode('simple')}
          >
            {t('mode.simple')}
          </button>
          <button
            type="button"
            className={mode === 'advanced' ? 'active' : ''}
            onClick={() => setMode('advanced')}
          >
            {t('mode.advanced')}
          </button>
        </div>
      </header>

      <main className={mode === 'simple' ? 'main main-simple' : 'main'}>
        <div
          className={[
            'dropzone',
            mode === 'simple' ? 'dropzone-simple' : '',
            dragOver ? 'dragover' : '',
            mode === 'advanced' && input ? 'has-file' : '',
            simpleBusy ? 'busy' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onDragOver={onHtmlDrag}
          onDragEnter={(e) => {
            onHtmlDrag(e);
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onHtmlDrag}
          onClick={() => {
            if (mode === 'simple' && !busy) void onPickVideo();
          }}
          role={mode === 'simple' ? 'button' : undefined}
          tabIndex={mode === 'simple' && !busy ? 0 : undefined}
          onKeyDown={(e) => {
            if (mode === 'simple' && !busy && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              void onPickVideo();
            }
          }}
        >
          {mode === 'simple' ? (
            <SimpleDropBody
              t={t}
              busy={simpleBusy}
              done={!!simpleDone}
              failed={!!simpleFailed}
              input={input}
              result={result}
              progress={progress}
              progressStatus={progressStatus}
              runId={runId}
              displayError={displayError}
              onCancel={(e) => {
                e.stopPropagation();
                void onCancel();
              }}
              onReveal={(e) => {
                e.stopPropagation();
                if (result) void api.showItemInFolder(result);
              }}
            />
          ) : !input ? (
            <>
              <p className="drop-title">{t('drop.title')}</p>
              <p className="drop-sub">{t('drop.sub')}</p>
              <div style={{ marginTop: 16 }}>
                <button type="button" className="btn btn-primary" onClick={onPickVideo}>
                  {t('drop.choose')}
                </button>
              </div>
            </>
          ) : (
            <div className="file-row">
              <div className="file-meta">
                <strong>{basename(input)}</strong>
                <span>
                  {input}
                  {duration != null
                    ? t('drop.duration', { duration: formatDuration(duration, t) })
                    : ''}
                </span>
              </div>
              <button type="button" className="btn" onClick={onPickVideo} disabled={busy}>
                {t('drop.change')}
              </button>
            </div>
          )}
        </div>

        {mode === 'advanced' && (
          <div className="card">
            <h2>{t('advanced.title')}</h2>
            <div className="grid">
              <div className="field">
                <label htmlFor="width">{t('advanced.width')}</label>
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
                <label htmlFor="fps">{t('advanced.fps')}</label>
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
                <label htmlFor="start">{t('advanced.start')}</label>
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
                <label htmlFor="trim">{t('advanced.trim')}</label>
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
                <label htmlFor="loop">{t('advanced.loop')}</label>
                <input
                  id="loop"
                  type="number"
                  value={loop}
                  onChange={(e) => setLoop(Number(e.target.value))}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label htmlFor="colors">{t('advanced.colors')}</label>
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
                <label htmlFor="dither">{t('advanced.dither')}</label>
                <select
                  id="dither"
                  value={dither}
                  onChange={(e) => setDither(e.target.value)}
                  disabled={busy}
                >
                  {ditherOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="speed">{t('advanced.speed')}</label>
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
                <label htmlFor="output">{t('advanced.outputPath')}</label>
                <div className="path-row">
                  <input
                    id="output"
                    value={output}
                    onChange={(e) => setOutput(e.target.value)}
                    disabled={busy}
                  />
                  <button type="button" className="btn" onClick={onPickOutput} disabled={busy}>
                    {t('advanced.browse')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === 'advanced' && (
          <div className="actions">
            {!busy ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!input || !output}
                onClick={onConvertAdvanced}
              >
                {t('actions.convertAdvanced')}
              </button>
            ) : (
              <button type="button" className="btn btn-danger" onClick={onCancel}>
                {t('actions.cancel')}
              </button>
            )}
            {result && (
              <>
                <button
                  type="button"
                  className="btn"
                  onClick={() => api.showItemInFolder(result)}
                >
                  {t('actions.showInFolder')}
                </button>
                <button type="button" className="btn" onClick={() => api.openGif(result)}>
                  {t('actions.openGif')}
                </button>
              </>
            )}
          </div>
        )}

        {mode === 'advanced' && (busy || progressStatus !== 'idle') && (
          <div className="card">
            <div className="progress-label">
              <span>{progressLabel(progressStatus, t)}</span>
              <span>{progress >= 0 ? `${progress}%` : ''}</span>
            </div>
            <div className="progress">
              <span key={runId} style={{ width: `${Math.max(0, progress)}%` }} />
            </div>
          </div>
        )}

        {mode === 'advanced' && displayError && (
          <div className="card">
            <p className="error">{displayError}</p>
          </div>
        )}

        {mode === 'advanced' && result && !displayError && (
          <div className="card">
            <p className="success">{t('status.saved', { path: result })}</p>
          </div>
        )}
      </main>

      {mode === 'advanced' && (
        <footer className="footer">
          ffmpeg: {ffmpegPath || '…'} · Tauri 2 + Vite + React · video-sdk
        </footer>
      )}
    </div>
  );
}

function SimpleDropBody({
  t,
  busy,
  done,
  failed,
  input,
  result,
  progress,
  progressStatus,
  runId,
  displayError,
  onCancel,
  onReveal,
}: {
  t: TFunction;
  busy: boolean;
  done: boolean;
  failed: boolean;
  input: string;
  result: string;
  progress: number;
  progressStatus: ProgressStatus;
  runId: number;
  displayError: string;
  onCancel: (e: React.MouseEvent) => void;
  onReveal: (e: React.MouseEvent) => void;
}) {
  if (failed) {
    return (
      <>
        <p className="drop-title">{t('simple.dropTitle')}</p>
        <p className="error">{displayError}</p>
        <p className="drop-sub">{t('simple.orClick')}</p>
      </>
    );
  }

  if (!busy && !done) {
    return (
      <>
        <p className="drop-title">{t('simple.dropTitle')}</p>
        <p className="drop-sub">{t('simple.dropSub')}</p>
        <p className="drop-sub drop-or">{t('simple.orClick')}</p>
      </>
    );
  }

  const barWidth = done ? 100 : Math.max(0, progress);
  const finishing = busy && progress >= 100;

  return (
    <>
      <p
        className={`drop-title ${done ? 'success clickable' : ''}`}
        onClick={done ? onReveal : undefined}
      >
        {done
          ? t('simple.saved', { name: basename(result) })
          : t('simple.converting', { name: basename(input) || '…' })}
      </p>
      <div className="progress simple-progress">
        <span key={runId} style={{ width: `${barWidth}%` }} />
      </div>
      <p className="drop-sub">
        {done
          ? t('simple.dropTitle')
          : `${progressLabel(progressStatus, t)}${progress >= 0 ? ` ${Math.min(progress, 100)}%` : ''}`}
      </p>
      {busy && !finishing && (
        <button type="button" className="btn btn-danger" onClick={onCancel}>
          {t('actions.cancel')}
        </button>
      )}
    </>
  );
}


