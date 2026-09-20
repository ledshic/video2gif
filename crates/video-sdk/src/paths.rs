use crate::error::{Result, SdkError};
use std::path::{Path, PathBuf};

/// Resolve ffmpeg binary path.
///
/// Order:
/// 1. `VIDEO2GIF_FFMPEG` / `VIDEO_SDK_FFMPEG` env
/// 2. Optional `bundled_root` + `resources/ffmpeg/<platform>-<arch>/ffmpeg[.exe]`
/// 3. System PATH (`ffmpeg`)
pub fn resolve_ffmpeg(bundled_root: Option<&Path>) -> Result<PathBuf> {
    for key in ["VIDEO2GIF_FFMPEG", "VIDEO_SDK_FFMPEG"] {
        if let Ok(p) = std::env::var(key) {
            let pb = PathBuf::from(&p);
            if pb.is_file() {
                return Ok(pb);
            }
        }
    }

    if let Some(root) = bundled_root {
        for candidate in bundled_candidates(root, "ffmpeg") {
            if candidate.is_file() {
                return Ok(candidate);
            }
        }
    }

    which::which("ffmpeg").map_err(|_| {
        SdkError::FfmpegNotFound(
            "Set VIDEO_SDK_FFMPEG or install ffmpeg on PATH".into(),
        )
    })
}

pub fn resolve_ffprobe(ffmpeg: &Path, bundled_root: Option<&Path>) -> Result<PathBuf> {
    for key in ["VIDEO2GIF_FFPROBE", "VIDEO_SDK_FFPROBE"] {
        if let Ok(p) = std::env::var(key) {
            let pb = PathBuf::from(&p);
            if pb.is_file() {
                return Ok(pb);
            }
        }
    }

    // Sibling of ffmpeg if not bare "ffmpeg"
    if ffmpeg.file_name().and_then(|s| s.to_str()) != Some("ffmpeg")
        && ffmpeg.file_name().and_then(|s| s.to_str()) != Some("ffmpeg.exe")
    {
        // already a path
    }
    if let Some(dir) = ffmpeg.parent() {
        let name = if cfg!(windows) {
            "ffprobe.exe"
        } else {
            "ffprobe"
        };
        let sibling = dir.join(name);
        if sibling.is_file() {
            return Ok(sibling);
        }
    }

    if let Some(root) = bundled_root {
        for candidate in bundled_candidates(root, "ffprobe") {
            if candidate.is_file() {
                return Ok(candidate);
            }
        }
    }

    which::which("ffprobe").map_err(|_| {
        SdkError::FfprobeNotFound(
            "Set VIDEO_SDK_FFPROBE or install ffprobe on PATH".into(),
        )
    })
}

fn bundled_candidates(root: &Path, tool: &str) -> Vec<PathBuf> {
    let bin = if cfg!(windows) {
        format!("{tool}.exe")
    } else {
        tool.to_string()
    };
    let platform = if cfg!(target_os = "macos") {
        "darwin"
    } else if cfg!(windows) {
        "win32"
    } else {
        "linux"
    };
    let arch = if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "x64"
    };
    let platform_dir = format!("{platform}-{arch}");

    vec![
        root.join("resources")
            .join("ffmpeg")
            .join(&platform_dir)
            .join(&bin),
        root.join("resources").join("ffmpeg").join(&bin),
        root.join("ffmpeg").join(&platform_dir).join(&bin),
        root.join("ffmpeg").join(&bin),
    ]
}

/// Suggest a unique default output path next to the input (`name.gif`, `name_1.gif`, …).
pub fn default_output_path(input: &Path) -> PathBuf {
    let dir = input.parent().unwrap_or_else(|| Path::new("."));
    let stem = input
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");
    let mut out = dir.join(format!("{stem}.gif"));
    let mut i = 1u32;
    while out.exists() {
        out = dir.join(format!("{stem}_{i}.gif"));
        i += 1;
    }
    out
}
