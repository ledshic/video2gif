use crate::error::{Result, SdkError};
use crate::filter::build_filter_complex;
use crate::options::{ConvertOptions, ProgressUpdate};
use crate::paths::{resolve_ffmpeg, resolve_ffprobe};
use crate::probe::probe_duration;
use regex::Regex;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

/// Handle for an in-flight conversion (cancel + wait).
///
/// Safe to share via `Arc` so a UI can call [`ConversionJob::cancel`] while
/// another thread blocks on [`ConversionJob::wait`].
pub struct ConversionJob {
    cancel_flag: Arc<AtomicBool>,
    child: Arc<Mutex<Option<Child>>>,
    join: Mutex<Option<thread::JoinHandle<Result<PathBuf>>>>,
}

impl ConversionJob {
    pub fn cancel(&self) {
        self.cancel_flag.store(true, Ordering::SeqCst);
        if let Ok(mut guard) = self.child.lock() {
            if let Some(child) = guard.as_mut() {
                let _ = child.kill();
            }
        }
    }

    /// Block until the worker finishes. May only be called once.
    pub fn wait(&self) -> Result<PathBuf> {
        let handle = self
            .join
            .lock()
            .map_err(|_| SdkError::Other("lock poisoned".into()))?
            .take()
            .ok_or_else(|| SdkError::Other("job already joined".into()))?;
        handle
            .join()
            .map_err(|_| SdkError::Other("worker panicked".into()))?
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancel_flag.load(Ordering::SeqCst)
    }
}

impl Drop for ConversionJob {
    fn drop(&mut self) {
        // If abandoned without wait, cancel to avoid orphan ffmpeg.
        if let Ok(mut g) = self.join.lock() {
            if g.is_some() {
                self.cancel();
                if let Some(h) = g.take() {
                    let _ = h.join();
                }
            }
        }
    }
}

/// Blocking convert: runs to completion.
pub fn convert_video_to_gif<F>(
    opts: ConvertOptions,
    on_progress: Option<F>,
) -> Result<PathBuf>
where
    F: FnMut(ProgressUpdate) + Send + 'static,
{
    let job = convert_async(opts, on_progress)?;
    job.wait()
}

/// Start conversion on a background thread; returns a cancelable job handle.
pub fn convert_async<F>(
    opts: ConvertOptions,
    on_progress: Option<F>,
) -> Result<ConversionJob>
where
    F: FnMut(ProgressUpdate) + Send + 'static,
{
    opts.validate()?;

    let bundled = opts.bundled_root.clone();
    let bundled_ref = bundled.as_deref();
    let ffmpeg = resolve_ffmpeg(bundled_ref)?;
    let _ffprobe = resolve_ffprobe(&ffmpeg, bundled_ref)?;

    if let Some(parent) = opts.output.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let cancel_flag = Arc::new(AtomicBool::new(false));
    let child_slot: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));

    let cancel_flag_t = Arc::clone(&cancel_flag);
    let child_slot_t = Arc::clone(&child_slot);

    let join = thread::spawn(move || {
        run_convert(opts, ffmpeg, cancel_flag_t, child_slot_t, on_progress)
    });

    Ok(ConversionJob {
        cancel_flag,
        child: child_slot,
        join: Mutex::new(Some(join)),
    })
}

fn run_convert<F>(
    opts: ConvertOptions,
    ffmpeg: PathBuf,
    cancel_flag: Arc<AtomicBool>,
    child_slot: Arc<Mutex<Option<Child>>>,
    mut on_progress: Option<F>,
) -> Result<PathBuf>
where
    F: FnMut(ProgressUpdate),
{
    let filter = build_filter_complex(&opts);
    let mut args: Vec<String> = vec!["-y".into(), "-hide_banner".into()];

    if let Some(start) = opts.start.filter(|s| *s > 0.0) {
        args.push("-ss".into());
        args.push(format!("{start}"));
    }
    args.push("-i".into());
    args.push(opts.input.to_string_lossy().into_owned());

    if let Some(dur) = opts.duration.filter(|d| *d > 0.0) {
        args.push("-t".into());
        args.push(format!("{dur}"));
    }

    args.push("-filter_complex".into());
    args.push(filter);
    args.push("-loop".into());
    args.push(opts.loop_count.to_string());
    args.push("-an".into());
    args.push(opts.output.to_string_lossy().into_owned());

    let mut total_sec = opts.duration;
    if total_sec.is_none() {
        let probed = probe_duration(&opts.input, opts.bundled_root.as_deref());
        if let Some(p) = probed {
            total_sec = Some(match opts.start {
                Some(s) if s > 0.0 => (p - s).max(0.0),
                _ => p,
            });
        }
    }
    if let (Some(t), speed) = (total_sec, opts.speed) {
        if speed > 0.0 {
            total_sec = Some(t / speed);
        }
    }

    if cancel_flag.load(Ordering::SeqCst) {
        return Err(SdkError::Cancelled);
    }

    let mut child = Command::new(&ffmpeg)
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            SdkError::FfmpegNotFound(format!(
                "failed to start ffmpeg ({}): {e}",
                ffmpeg.display()
            ))
        })?;

    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| SdkError::Other("ffmpeg stderr pipe missing".into()))?;

    {
        let mut slot = child_slot
            .lock()
            .map_err(|_| SdkError::Other("lock".into()))?;
        *slot = Some(child);
    }

    let time_re = Regex::new(r"time=(\d+):(\d+):(\d+(?:\.\d+)?)").unwrap();
    let reader = BufReader::new(stderr);
    let mut stderr_tail: Vec<String> = Vec::new();

    for line in reader.lines() {
        if cancel_flag.load(Ordering::SeqCst) {
            break;
        }
        let Ok(line) = line else { continue };
        if stderr_tail.len() > 40 {
            stderr_tail.remove(0);
        }
        stderr_tail.push(line.clone());

        if let Some(caps) = time_re.captures(&line) {
            let h: f64 = caps[1].parse().unwrap_or(0.0);
            let m: f64 = caps[2].parse().unwrap_or(0.0);
            let s: f64 = caps[3].parse().unwrap_or(0.0);
            let sec = h * 3600.0 + m * 60.0 + s;
            if let Some(ref mut cb) = on_progress {
                if let Some(total) = total_sec.filter(|t| *t > 0.0) {
                    let pct = ((sec / total) * 100.0).min(99.0).round() as i32;
                    cb(ProgressUpdate {
                        pct,
                        message: format!("Converting… {pct}%"),
                    });
                } else {
                    cb(ProgressUpdate {
                        pct: -1,
                        message: "Converting…".into(),
                    });
                }
            }
        } else if let Some(ref mut cb) = on_progress {
            cb(ProgressUpdate {
                pct: -1,
                message: "Converting…".into(),
            });
        }
    }

    let status = {
        let mut slot = child_slot
            .lock()
            .map_err(|_| SdkError::Other("lock".into()))?;
        match slot.take() {
            Some(mut child) => child.wait()?,
            None => return Err(SdkError::Other("child missing".into())),
        }
    };

    if cancel_flag.load(Ordering::SeqCst) {
        let _ = std::fs::remove_file(&opts.output);
        return Err(SdkError::Cancelled);
    }

    if !status.success() {
        let code = status.code().unwrap_or(-1);
        let message = stderr_tail
            .iter()
            .rev()
            .take(20)
            .cloned()
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join("\n");
        return Err(SdkError::FfmpegFailed { code, message });
    }

    if let Some(ref mut cb) = on_progress {
        cb(ProgressUpdate {
            pct: 100,
            message: "Done".into(),
        });
    }

    Ok(opts.output)
}

/// Convenience: resolve ffmpeg path string for UI display.
pub fn ffmpeg_path_string(bundled_root: Option<&Path>) -> String {
    resolve_ffmpeg(bundled_root)
        .map(|p| p.display().to_string())
        .unwrap_or_else(|_| "ffmpeg".into())
}
