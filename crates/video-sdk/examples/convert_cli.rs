//! CLI smoke helper: `cargo run -p video-sdk --example convert_cli -- in.mp4 out.gif`
use std::env;
use std::path::PathBuf;
use video_sdk::{convert_video_to_gif, ConvertOptions, SIMPLE_DEFAULT};

fn main() {
    let args = env::args().skip(1).collect::<Vec<_>>();
    if args.len() < 2 {
        eprintln!("usage: convert_cli <input> <output.gif> [duration_sec]");
        std::process::exit(2);
    }
    let input = PathBuf::from(&args[0]);
    let output = PathBuf::from(&args[1]);
    let duration = args
        .get(2)
        .and_then(|s| s.parse().ok())
        .or(Some(SIMPLE_DEFAULT.max_duration));

    let opts = ConvertOptions {
        input,
        output: output.clone(),
        width: SIMPLE_DEFAULT.width,
        fps: SIMPLE_DEFAULT.fps,
        start: None,
        duration,
        loop_count: 0,
        colors: SIMPLE_DEFAULT.colors,
        dither: SIMPLE_DEFAULT.dither.to_string(),
        speed: 1.0,
        bundled_root: None,
    };

    match convert_video_to_gif(opts, Some(|p: video_sdk::ProgressUpdate| {
        eprint!("\r{} ({}%)   ", p.message, p.pct);
    })) {
        Ok(path) => {
            eprintln!("\nOK {}", path.display());
        }
        Err(e) => {
            eprintln!("\nERR {e}");
            std::process::exit(1);
        }
    }
}
