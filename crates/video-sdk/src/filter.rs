use crate::options::ConvertOptions;

/// Build ffmpeg `filter_complex` for palettegen + paletteuse high-quality GIF.
pub fn build_filter_complex(opts: &ConvertOptions) -> String {
    let width = opts.width;
    let fps = opts.fps;
    let colors = opts.colors;
    let dither = opts.dither.as_str();
    let speed = if opts.speed > 0.0 { opts.speed } else { 1.0 };

    let pts = if (speed - 1.0).abs() < f64::EPSILON {
        "PTS-STARTPTS".to_string()
    } else {
        format!("(PTS-STARTPTS)/{speed}")
    };

    let scale = format!("scale={width}:-1:flags=lanczos");
    let vf = format!("setpts={pts},{scale},fps={fps}");

    format!(
        "[0:v]{vf},split[s0][s1];[s0]palettegen=max_colors={colors}:stats_mode=diff[p];[s1][p]paletteuse=dither={dither}"
    )
}
