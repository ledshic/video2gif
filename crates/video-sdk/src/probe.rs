use crate::error::{Result, SdkError};
use crate::options::ProbeInfo;
use crate::paths::{resolve_ffmpeg, resolve_ffprobe};
use std::path::Path;
use std::process::Command;

/// Probe media duration in seconds. Returns `None` on failure (non-fatal).
pub fn probe_duration(input: &Path, bundled_root: Option<&Path>) -> Option<f64> {
    probe(input, bundled_root).ok().and_then(|p| p.duration)
}

/// Full probe via ffprobe JSON.
pub fn probe(input: &Path, bundled_root: Option<&Path>) -> Result<ProbeInfo> {
    if !input.is_file() {
        return Err(SdkError::InputNotFound(input.display().to_string()));
    }
    let ffmpeg = resolve_ffmpeg(bundled_root)?;
    let ffprobe = resolve_ffprobe(&ffmpeg, bundled_root)?;

    let output = Command::new(&ffprobe)
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            &input.to_string_lossy(),
        ])
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(SdkError::Other(format!(
            "ffprobe failed: {}",
            stderr.trim()
        )));
    }

    let v: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| SdkError::Other(format!("ffprobe json: {e}")))?;

    let duration = v
        .pointer("/format/duration")
        .and_then(|x| x.as_str())
        .and_then(|s| s.parse::<f64>().ok())
        .or_else(|| {
            v.pointer("/format/duration")
                .and_then(|x| x.as_f64())
        });

    let format_name = v
        .pointer("/format/format_name")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());

    let mut width = None;
    let mut height = None;
    let mut video_codec = None;
    if let Some(streams) = v.get("streams").and_then(|s| s.as_array()) {
        for s in streams {
            if s.get("codec_type").and_then(|c| c.as_str()) == Some("video") {
                width = s.get("width").and_then(|w| w.as_u64()).map(|u| u as u32);
                height = s.get("height").and_then(|h| h.as_u64()).map(|u| u as u32);
                video_codec = s
                    .get("codec_name")
                    .and_then(|c| c.as_str())
                    .map(|s| s.to_string());
                break;
            }
        }
    }

    Ok(ProbeInfo {
        path: input.to_path_buf(),
        duration,
        width,
        height,
        format_name,
        video_codec,
    })
}
