use thiserror::Error;

#[derive(Debug, Error)]
pub enum SdkError {
    #[error("ffmpeg not found: {0}")]
    FfmpegNotFound(String),

    #[error("ffprobe not found: {0}")]
    FfprobeNotFound(String),

    #[error("input file not found: {0}")]
    InputNotFound(String),

    #[error("invalid options: {0}")]
    InvalidOptions(String),

    #[error("ffmpeg failed (exit {code}): {message}")]
    FfmpegFailed { code: i32, message: String },

    #[error("cancelled")]
    Cancelled,

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, SdkError>;
