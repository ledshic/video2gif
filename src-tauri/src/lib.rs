use once_cell::sync::Lazy;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use video_sdk::{
    convert_async, default_output_path, ffmpeg_path_string, probe_duration, ConvertOptions,
    ConversionJob, ProgressUpdate, SIMPLE_DEFAULT,
};

struct JobState {
    current: Mutex<Option<Arc<ConversionJob>>>,
}

static APP_RESOURCE_HINT: Lazy<Mutex<Option<PathBuf>>> = Lazy::new(|| Mutex::new(None));

fn bundled_root(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(dir) = app.path().resource_dir() {
        return Some(dir);
    }
    None
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DefaultsDto {
    width: u32,
    fps: u32,
    max_duration: f64,
    colors: u32,
    dither: String,
    #[serde(rename = "loop")]
    loop_count: i32,
    speed: f64,
    ffmpeg_path: String,
}

#[derive(Debug, Deserialize)]
struct ConvertDto {
    input: String,
    output: String,
    width: Option<u32>,
    fps: Option<u32>,
    start: Option<f64>,
    duration: Option<f64>,
    #[serde(rename = "loop")]
    loop_count: Option<i32>,
    colors: Option<u32>,
    dither: Option<String>,
    speed: Option<f64>,
}

#[derive(Debug, Serialize)]
struct ConvertResult {
    ok: bool,
    output: Option<String>,
    error: Option<String>,
    cancelled: Option<bool>,
}

#[tauri::command]
fn get_defaults(app: AppHandle) -> DefaultsDto {
    let root = bundled_root(&app).or_else(|| Some(repo_root()));
    let p = SIMPLE_DEFAULT;
    DefaultsDto {
        width: p.width,
        fps: p.fps,
        max_duration: p.max_duration,
        colors: p.colors,
        dither: p.dither.to_string(),
        loop_count: p.loop_count,
        speed: p.speed,
        ffmpeg_path: ffmpeg_path_string(root.as_deref()),
    }
}

#[tauri::command]
fn probe_duration_cmd(app: AppHandle, input: String) -> Option<f64> {
    let root = bundled_root(&app).or_else(|| Some(repo_root()));
    probe_duration(Path::new(&input), root.as_deref())
}

#[tauri::command]
fn default_output_path_cmd(input: String) -> String {
    default_output_path(Path::new(&input))
        .to_string_lossy()
        .into_owned()
}

#[tauri::command]
fn convert(
    app: AppHandle,
    state: State<'_, Arc<JobState>>,
    opts: ConvertDto,
) -> ConvertResult {
    // Cancel any previous job
    {
        let mut cur = state.current.lock();
        if let Some(job) = cur.take() {
            job.cancel();
            let _ = job.wait();
        }
    }

    let input = PathBuf::from(&opts.input);
    if !input.is_file() {
        return ConvertResult {
            ok: false,
            output: None,
            error: Some("输入文件不存在".into()),
            cancelled: None,
        };
    }
    if opts.output.is_empty() {
        return ConvertResult {
            ok: false,
            output: None,
            error: Some("未指定输出路径".into()),
            cancelled: None,
        };
    }
    let output = PathBuf::from(&opts.output);

    let root = bundled_root(&app).or_else(|| Some(repo_root()));
    let p = SIMPLE_DEFAULT;
    let convert_opts = ConvertOptions {
        input,
        output: output.clone(),
        width: opts.width.unwrap_or(p.width),
        fps: opts.fps.unwrap_or(p.fps),
        start: opts.start.filter(|s| *s > 0.0),
        duration: opts.duration.filter(|d| *d > 0.0),
        loop_count: opts.loop_count.unwrap_or(p.loop_count),
        colors: opts.colors.unwrap_or(p.colors),
        dither: opts.dither.unwrap_or_else(|| p.dither.to_string()),
        speed: opts.speed.unwrap_or(p.speed),
        bundled_root: root,
    };

    let app_emit = app.clone();
    let job = match convert_async(
        convert_opts,
        Some(move |u: ProgressUpdate| {
            let _ = app_emit.emit(
                "convert-progress",
                serde_json::json!({ "pct": u.pct, "message": u.message }),
            );
        }),
    ) {
        Ok(j) => Arc::new(j),
        Err(e) => {
            return ConvertResult {
                ok: false,
                output: None,
                error: Some(e.to_string()),
                cancelled: None,
            };
        }
    };

    {
        let mut cur = state.current.lock();
        *cur = Some(Arc::clone(&job));
    }

    let result = match job.wait() {
        Ok(path) => ConvertResult {
            ok: true,
            output: Some(path.to_string_lossy().into_owned()),
            error: None,
            cancelled: None,
        },
        Err(video_sdk::SdkError::Cancelled) => ConvertResult {
            ok: false,
            output: None,
            error: Some("已取消".into()),
            cancelled: Some(true),
        },
        Err(e) => ConvertResult {
            ok: false,
            output: None,
            error: Some(e.to_string()),
            cancelled: None,
        },
    };

    {
        let mut cur = state.current.lock();
        *cur = None;
    }

    result
}

#[tauri::command]
fn cancel_convert(state: State<'_, Arc<JobState>>) -> bool {
    let cur = state.current.lock();
    if let Some(job) = cur.as_ref() {
        job.cancel();
        true
    } else {
        false
    }
}

#[tauri::command]
fn list_presets() -> Vec<serde_json::Value> {
    video_sdk::all_presets()
        .into_iter()
        .map(|p| {
            serde_json::json!({
                "name": p.name,
                "labelZh": p.label_zh,
                "width": p.width,
                "fps": p.fps,
                "maxDuration": p.max_duration,
                "colors": p.colors,
                "dither": p.dither,
                "loop": p.loop_count,
                "speed": p.speed,
            })
        })
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let job_state = Arc::new(JobState {
        current: Mutex::new(None),
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .manage(job_state)
        .invoke_handler(tauri::generate_handler![
            get_defaults,
            probe_duration_cmd,
            default_output_path_cmd,
            convert,
            cancel_convert,
            list_presets,
        ])
        .setup(|app| {
            let hint = bundled_root(&app.handle()).or_else(|| Some(repo_root()));
            *APP_RESOURCE_HINT.lock() = hint;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
