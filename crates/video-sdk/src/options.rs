use crate::presets::SIMPLE_DEFAULT;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Options for `convert_video_to_gif`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvertOptions {
    pub input: PathBuf,
    pub output: PathBuf,
    #[serde(default = "default_width")]
    pub width: u32,
    #[serde(default = "default_fps")]
    pub fps: u32,
    /// Start time in seconds (optional).
    #[serde(default)]
    pub start: Option<f64>,
    /// Clip duration in seconds (optional).
    #[serde(default)]
    pub duration: Option<f64>,
    /// GIF loop: 0 = infinite, -1 = no loop, N = loop N times.
    #[serde(default = "default_loop")]
    pub loop_count: i32,
    #[serde(default = "default_colors")]
    pub colors: u32,
    #[serde(default = "default_dither")]
    pub dither: String,
    #[serde(default = "default_speed")]
    pub speed: f64,
    /// Optional root for bundled ffmpeg resources.
    #[serde(default)]
    pub bundled_root: Option<PathBuf>,
}

fn default_width() -> u32 {
    SIMPLE_DEFAULT.width
}
fn default_fps() -> u32 {
    SIMPLE_DEFAULT.fps
}
fn default_loop() -> i32 {
    SIMPLE_DEFAULT.loop_count
}
fn default_colors() -> u32 {
    SIMPLE_DEFAULT.colors
}
fn default_dither() -> String {
    SIMPLE_DEFAULT.dither.to_string()
}
fn default_speed() -> f64 {
    SIMPLE_DEFAULT.speed
}

impl ConvertOptions {
    pub fn simple(input: PathBuf, output: PathBuf) -> Self {
        let p = &SIMPLE_DEFAULT;
        Self {
            input,
            output,
            width: p.width,
            fps: p.fps,
            start: None,
            duration: Some(p.max_duration),
            loop_count: p.loop_count,
            colors: p.colors,
            dither: p.dither.to_string(),
            speed: p.speed,
            bundled_root: None,
        }
    }

    pub fn validate(&self) -> crate::Result<()> {
        if !self.input.is_file() {
            return Err(crate::SdkError::InputNotFound(
                self.input.display().to_string(),
            ));
        }
        if self.width < 16 || self.width > 4096 {
            return Err(crate::SdkError::InvalidOptions(
                "width must be 16..=4096".into(),
            ));
        }
        if self.fps < 1 || self.fps > 60 {
            return Err(crate::SdkError::InvalidOptions(
                "fps must be 1..=60".into(),
            ));
        }
        if self.colors < 2 || self.colors > 256 {
            return Err(crate::SdkError::InvalidOptions(
                "colors must be 2..=256".into(),
            ));
        }
        if self.speed <= 0.0 {
            return Err(crate::SdkError::InvalidOptions(
                "speed must be > 0".into(),
            ));
        }
        Ok(())
    }
}

/// Media probe result from ffprobe.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProbeInfo {
    pub path: PathBuf,
    pub duration: Option<f64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub format_name: Option<String>,
    pub video_codec: Option<String>,
}

/// Progress callback payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressUpdate {
    /// 0..=100, or -1 if unknown.
    pub pct: i32,
    pub message: String,
}
