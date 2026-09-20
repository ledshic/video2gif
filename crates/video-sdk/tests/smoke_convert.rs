//! Integration smoke: generate sample video with ffmpeg, convert via SDK.
use std::path::PathBuf;
use std::process::Command;
use video_sdk::{convert_video_to_gif, ConvertOptions, SIMPLE_DEFAULT};

fn ffmpeg_bin() -> String {
    video_sdk::resolve_ffmpeg(None)
        .map(|p| p.display().to_string())
        .unwrap_or_else(|_| "ffmpeg".into())
}

#[test]
fn smoke_convert_sample_to_gif() {
    let tmp = tempfile::tempdir().expect("tempdir");
    let video = tmp.path().join("sample.mp4");
    let gif = tmp.path().join("sample.gif");

    let status = Command::new(ffmpeg_bin())
        .args([
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc=size=640x360:rate=30",
            "-t",
            "2",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            video.to_str().unwrap(),
        ])
        .status()
        .expect("spawn ffmpeg to generate sample");
    assert!(status.success(), "sample video generation failed");
    assert!(video.is_file());

    let opts = ConvertOptions {
        input: video,
        output: gif.clone(),
        width: SIMPLE_DEFAULT.width,
        fps: SIMPLE_DEFAULT.fps,
        start: None,
        duration: Some(2.0),
        loop_count: 0,
        colors: SIMPLE_DEFAULT.colors,
        dither: SIMPLE_DEFAULT.dither.to_string(),
        speed: 1.0,
        bundled_root: None,
    };

    let out = convert_video_to_gif(opts, None::<fn(_)>).expect("convert");
    assert_eq!(out, gif);
    let meta = std::fs::metadata(&gif).expect("gif meta");
    assert!(
        meta.len() > 1000,
        "GIF too small ({} bytes)",
        meta.len()
    );
    eprintln!("SMOKE OK: {} ({} bytes)", gif.display(), meta.len());
}

#[test]
fn probe_and_filter_build() {
    let filter = video_sdk::build_filter_complex(&ConvertOptions::simple(
        PathBuf::from("x.mp4"),
        PathBuf::from("x.gif"),
    ));
    assert!(filter.contains("palettegen"));
    assert!(filter.contains("paletteuse"));
    assert!(filter.contains("sierra2_4a"));

    let presets = video_sdk::all_presets();
    assert!(!presets.is_empty());
}
