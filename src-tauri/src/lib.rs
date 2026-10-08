use std::fs;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use discord_rich_presence::{DiscordIpc, DiscordIpcClient, activity};
use tauri_plugin_fs::FsExt;

const DISCORD_CLIENT_ID: &str = "1250551199862624349";
const DISCORD_LOGO_URL: &str = "https://tool.community.spicylyrics.org/logo.png";
const DISCORD_PLAY_URL: &str = "https://cdn.rcd.gg/PreMiD/resources/play.png";
const DISCORD_PAUSE_URL: &str = "https://cdn.rcd.gg/PreMiD/resources/pause.png";
const REPOSITORY_URL: &str = "https://github.com/NaeNaeTart/NaeNae-AMLL-TTML-TOOL";

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiscordActivityPayload {
    details: Option<String>,
    state: Option<String>,
    playing: bool,
    show_repository_button: bool,
    show_status_badge: bool,
    start_timestamp: Option<i64>,
    end_timestamp: Option<i64>,
    large_image: Option<String>,
}

struct DiscordConnection {
    client: Option<DiscordIpcClient>,
    retry_after: Option<Instant>,
}

impl Default for DiscordConnection {
    fn default() -> Self {
        Self {
            client: None,
            retry_after: None,
        }
    }
}

#[derive(Default)]
struct DiscordState(Mutex<DiscordConnection>);

#[cfg(windows)]
const LINKABLE_EXTENSIONS: &[&str] = &[
    "ttml", "flac", "wav", "mp3", "m4a", "aac", "ogg", "opus", "webm", "weba",
    "oga", "mid", "aiff", "wma", "au",
];
#[cfg(windows)]
const MAX_REMEMBERED_DROPS: usize = 64;
#[cfg(windows)]
const DROPPED_FILES_MESSAGE_PREFIX: &str = "amll-dropped-files:";

/// Real paths of linkable files that were dropped on the window. A path can
/// only be granted filesystem access (`allow_dropped_file`) if it is in here.
#[derive(Default)]
struct DroppedPaths(Mutex<Vec<String>>);

#[cfg(windows)]
#[derive(Clone, serde::Serialize)]
struct DroppedFilePathsPayload {
    id: String,
    paths: Vec<String>,
}

#[cfg(windows)]
fn is_linkable_path(path: &str) -> bool {
    std::path::Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| {
            LINKABLE_EXTENSIONS
                .iter()
                .any(|linkable| linkable.eq_ignore_ascii_case(ext))
        })
}

fn connect_discord() -> Result<DiscordIpcClient, String> {
    let mut client = DiscordIpcClient::new(DISCORD_CLIENT_ID);
    client.connect().map_err(|e| e.to_string())?;
    Ok(client)
}

#[tauri::command]
fn set_discord_activity(
    payload: DiscordActivityPayload,
    discord: tauri::State<'_, DiscordState>,
) -> Result<(), String> {
    let mut connection = discord.0.lock().map_err(|e| e.to_string())?;
    if connection.client.is_none() {
        if connection
            .retry_after
            .is_some_and(|retry_after| retry_after > Instant::now())
        {
            return Ok(());
        }
        match connect_discord() {
            Ok(client) => {
                connection.client = Some(client);
                connection.retry_after = None;
            }
            Err(error) => {
                log::debug!("Discord RPC is unavailable: {error}");
                connection.retry_after = Some(Instant::now() + Duration::from_secs(15));
                return Ok(());
            }
        }
    }

    let large_image = payload
        .large_image
        .as_deref()
        .filter(|url| url.starts_with("http://") || url.starts_with("https://"))
        .unwrap_or(DISCORD_LOGO_URL);

    let mut assets = activity::Assets::new()
        .large_image(large_image)
        .large_text("NaeNae's AMLL TTML Tool Fork");
    if payload.show_status_badge {
        let small_image = if payload.playing {
            DISCORD_PLAY_URL
        } else {
            DISCORD_PAUSE_URL
        };
        let small_text = if payload.playing { "Playing" } else { "Paused" };
        assets = assets.small_image(small_image).small_text(small_text);
    }
    let mut rich_presence = activity::Activity::new()
        .activity_type(activity::ActivityType::Listening)
        .status_display_type(activity::StatusDisplayType::Details)
        .assets(assets);

    if let Some(details) = payload.details.as_deref() {
        rich_presence = rich_presence.details(details);
    }
    if let Some(state) = payload.state.as_deref() {
        rich_presence = rich_presence.state(state);
    }
    if payload.show_repository_button {
        rich_presence = rich_presence.buttons(vec![activity::Button::new(
            "View repository",
            REPOSITORY_URL,
        )]);
    }

    if let Some(start) = payload.start_timestamp {
        let mut timestamps = activity::Timestamps::new().start(start);
        if let Some(end) = payload.end_timestamp {
            timestamps = timestamps.end(end);
        }
        rich_presence = rich_presence.timestamps(timestamps);
    }

    let result = connection
        .client
        .as_mut()
        .expect("Discord client was initialized")
        .set_activity(rich_presence)
        .map_err(|e| e.to_string());
    if result.is_err() {
        connection.client = None;
        connection.retry_after = Some(Instant::now() + Duration::from_secs(15));
    }
    result
}

#[tauri::command]
fn clear_discord_activity(discord: tauri::State<'_, DiscordState>) -> Result<(), String> {
    let mut connection = discord.0.lock().map_err(|e| e.to_string())?;
    if let Some(client) = connection.client.as_mut() {
        let result = client.clear_activity().map_err(|e| e.to_string());
        if result.is_err() {
            connection.client = None;
        }
        return result;
    }
    connection.retry_after = None;
    Ok(())
}

#[derive(serde::Serialize)]
struct OpenFileData {
    pub filename: String,
    pub data: String,
    pub ext: String,
}

#[tauri::command]
fn convert_audio_mp3_to_flac(input_data: Vec<u8>, filename: String) -> Result<Vec<u8>, String> {
    let temp_dir = std::env::temp_dir();
    let input_path = temp_dir.join(format!("ttml_tool_input_{}", filename));
    let output_path = temp_dir.join("ttml_tool_output.flac");

    if let Err(e) = fs::write(&input_path, &input_data) {
        return Err(format!("Failed to write temp input file: {}", e));
    }

    let ffmpeg_result = std::process::Command::new("ffmpeg")
        .args([
            "-y",
            "-i",
            input_path.to_str().unwrap(),
            "-codec:a",
            "flac",
            "-sample-rate",
            "44100",
            output_path.to_str().unwrap(),
        ])
        .output();

    let _ = fs::remove_file(&input_path);

    match ffmpeg_result {
        Ok(result) => {
            if result.status.success() {
                match fs::read(&output_path) {
                    Ok(converted_data) => {
                        let _ = fs::remove_file(&output_path);
                        Ok(converted_data)
                    }
                    Err(e) => Err(format!("Failed to read converted file: {}", e))
                }
            } else {
                let stderr_output = String::from_utf8_lossy(&result.stderr);
                let stdout_output = String::from_utf8_lossy(&result.stdout);
                if stderr_output.contains("not found") || stderr_output.is_empty() && stdout_output.is_empty() {
                    Err("ffmpeg not found. Please install ffmpeg and ensure it's in your PATH.".to_string())
                } else {
                    Err(format!("FFmpeg conversion failed: {}\nStdout: {}", stderr_output, stdout_output))
                }
            }
        }
        Err(e) => {
            let error_msg = if e.kind() == std::io::ErrorKind::NotFound {
                "ffmpeg not found. Please install ffmpeg and ensure it's in your PATH.".to_string()
            } else {
                format!("Failed to run ffmpeg: {}. Make sure ffmpeg is installed and in your PATH.", e)
            };
            Err(error_msg)
        }
    }
}

#[tauri::command]
fn get_open_file_data() -> Option<OpenFileData> {
    let filename = std::env::args().nth(1);
    if let Some(filename) = filename {
        let path = std::path::Path::new(&filename);
        let ext = path
            .extension()
            .map(|x| x.to_string_lossy().into_owned())
            .unwrap_or_default();
        if let Ok(data) = std::fs::read_to_string(&filename) {
            return Some(OpenFileData {
                filename,
                data,
                ext,
            });
        }
    }

    None
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn open_linked_projects_folder(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;

    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data folder is unavailable: {e}"))?
        .join("projects");
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create {}: {e}", dir.display()))?;
    #[cfg(target_os = "windows")]
    let program = "explorer";
    #[cfg(target_os = "macos")]
    let program = "open";
    #[cfg(all(unix, not(target_os = "macos")))]
    let program = "xdg-open";
    std::process::Command::new(program)
        .arg(&dir)
        .spawn()
        .map_err(|e| format!("failed to open {}: {e}", dir.display()))?;
    Ok(())
}

/// Grants filesystem access to a file the user dropped on the window.
///
/// Called only once the user actually links that file to a project, and only
/// for paths the host itself saw in a real drop, so a forged invoke cannot
/// widen the scope to arbitrary files.
///
/// Returns `false` (and grants nothing) for paths that were not dropped, such
/// as files picked with a native dialog, which already have their own access.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn allow_dropped_file(
    path: String,
    window: tauri::Window,
    dropped: tauri::State<'_, DroppedPaths>,
) -> Result<bool, String> {
    let known = dropped
        .0
        .lock()
        .map_err(|_| "the dropped file list is unavailable".to_string())?
        .contains(&path);
    if !known {
        return Ok(false);
    }
    window
        .try_fs_scope()
        .ok_or_else(|| "filesystem scope is unavailable".to_string())?
        .allow_file(&path)
        .map_err(|e| format!("failed to extend filesystem scope: {e}"))?;
    Ok(true)
}

/// Receives files dropped on the page and reports their real paths.
///
/// HTML drops only hand the page file contents, and native drag-drop events
/// stay off because they break in-page drag and drop on Windows. `WebView2` can
/// still pass the dropped `File` objects to the host, which can read their
/// paths. Paths are only remembered here (and reported to the page); the fs
/// scope is granted later by `allow_dropped_file`, when a file is really linked.
#[cfg(windows)]
fn watch_dropped_file_paths(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    use tauri::{Emitter, Manager};
    use webview2_com::{
        Microsoft::Web::WebView2::Win32::{
            ICoreWebView2File, ICoreWebView2WebMessageReceivedEventArgs2,
        },
        WebMessageReceivedEventHandler, take_pwstr,
    };
    use windows::core::{Interface, PWSTR};

    let emitter = window.clone();
    window.with_webview(move |webview| unsafe {
        let Ok(core) = webview.controller().CoreWebView2() else {
            return;
        };
        let handler = WebMessageReceivedEventHandler::create(Box::new(move |_, args| {
            let Some(args) = args else {
                return Ok(());
            };
            let mut message = PWSTR::null();
            if args.TryGetWebMessageAsString(&raw mut message).is_err() {
                return Ok(());
            }
            let text = take_pwstr(message);
            let Some(request_id) = text.strip_prefix(DROPPED_FILES_MESSAGE_PREFIX) else {
                return Ok(());
            };
            let request_id = request_id.to_owned();
            let objects = args
                .cast::<ICoreWebView2WebMessageReceivedEventArgs2>()?
                .AdditionalObjects()?;
            let mut count = 0;
            objects.Count(&raw mut count)?;
            let mut paths = Vec::new();
            for index in 0..count {
                let Ok(file) = objects
                    .GetValueAtIndex(index)
                    .and_then(|object| object.cast::<ICoreWebView2File>())
                else {
                    continue;
                };
                let mut path = PWSTR::null();
                if file.Path(&raw mut path).is_ok() {
                    paths.push(take_pwstr(path));
                }
            }
            if let Ok(mut known) = emitter.state::<DroppedPaths>().0.lock() {
                for path in paths.iter().filter(|path| is_linkable_path(path)) {
                    if !known.contains(path) {
                        known.push(path.clone());
                    }
                }
                while known.len() > MAX_REMEMBERED_DROPS {
                    known.remove(0);
                }
            }
            let _ = emitter.emit_to(
                emitter.label(),
                "dropped-file-paths",
                DroppedFilePathsPayload {
                    id: request_id,
                    paths,
                },
            );
            Ok(())
        }));
        let mut token = 0;
        let _ = core.add_WebMessageReceived(&handler, &raw mut token);
    })
}

/// Shows a native folder picker and grants the picked project folder's parent
/// (needed for folder create, auto-rename and sibling scans).
///
/// The picker lives here instead of taking a path from the webview so scope
/// can only be widened by a real user pick, never by a forged invoke call.
#[tauri::command]
async fn pick_project_folder(
    title: String,
    window: tauri::Window,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let Some(picked) = window
        .dialog()
        .file()
        .set_title(title)
        .set_parent(&window)
        .blocking_pick_folder()
    else {
        return Ok(None);
    };
    let project_path = picked
        .into_path()
        .map_err(|e| format!("invalid folder path: {e}"))?;
    let scope = window
        .try_fs_scope()
        .ok_or_else(|| "filesystem scope is unavailable".to_string())?;
    let granted = project_path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(&project_path);
    scope
        .allow_directory(granted, true)
        .map_err(|e| format!("failed to extend filesystem scope: {e}"))?;
    Ok(Some(project_path.to_string_lossy().into_owned()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[allow(clippy::missing_panics_doc)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_decorum::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_process::init());

    #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    #[cfg(desktop)]
    {
        use tauri_plugin_window_state::StateFlags;

        builder = builder.plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    StateFlags::SIZE | StateFlags::MAXIMIZED | StateFlags::FULLSCREEN,
                )
                .build(),
        );
    }

    builder
        .manage(DiscordState::default())
        .manage(DroppedPaths::default())
        .setup(|app| {
            #[cfg(windows)]
            {
                use tauri::Manager;

                if let Some(window) = app.get_webview_window("main") {
                    watch_dropped_file_paths(&window)?;
                }
            }
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            #[cfg(target_os = "macos")]
            {
                use tao::rwh_06::HasWindowHandle;
                use tauri::Manager;
                use tauri_plugin_decorum::WebviewWindowExt;

                let main_window = app.get_webview_window("main").unwrap();
                main_window.set_traffic_lights_inset(16.0, 20.0).unwrap();
                main_window.make_transparent().unwrap();
                let main_window_clone = main_window.clone();
                main_window.on_window_event(move |evt| {
                    if let tauri::WindowEvent::Resized(_) = evt {
                        main_window_clone
                            .set_traffic_lights_inset(16.0, 20.0)
                            .unwrap();
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_open_file_data,
            convert_audio_mp3_to_flac,
            set_discord_activity,
            clear_discord_activity,
            pick_project_folder,
            open_linked_projects_folder,
            allow_dropped_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
