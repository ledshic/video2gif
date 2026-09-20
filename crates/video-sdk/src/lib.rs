//! # video-sdk
//!
//! Reusable ffmpeg-backed library for converting video to high-quality GIF
//! using `palettegen` + `paletteuse`.
//!
//! ## Depend from another project
//!
//! Path dependency (this monorepo):
//!
//! ```toml
//! [dependencies]
//! video-sdk = { path = "../video-sdk" }
//! # or from another repo:
//! # video-sdk = { path = "/path/to/video2gif/crates/video-sdk" }
//! ```
//!
//! Published name (when published to crates.io): `video-sdk`.
//!
//! ```toml
//! [dependencies]
//! video-sdk = "0.1"
//! ```
//!
//! ## Example
//!
//! ```no_run
//! use video_sdk::{convert_video_to_gif, ConvertOptions};
//! use std::path::PathBuf;
//!
//! let opts = ConvertOptions::simple(
//!     PathBuf::from("in.mp4"),
//!     PathBuf::from("out.gif"),
//! );
//! let out = convert_video_to_gif(opts, None::<fn(_)>).unwrap();
//! println!("wrote {}", out.display());
//! ```

mod convert;
mod error;
mod filter;
mod options;
mod paths;
mod presets;
mod probe;

pub use convert::{convert_async, convert_video_to_gif, ffmpeg_path_string, ConversionJob};
pub use error::{Result, SdkError};
pub use filter::build_filter_complex;
pub use options::{ConvertOptions, ProbeInfo, ProgressUpdate};
pub use paths::{default_output_path, resolve_ffmpeg, resolve_ffprobe};
pub use presets::{
    all_presets, ChatPreset, DISCORD_LIKE, SIMPLE_DEFAULT, TELEGRAM_LIKE, WECHAT_LIKE,
};
pub use probe::{probe, probe_duration};
