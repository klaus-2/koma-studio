use std::{
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use tauri::{AppHandle, Manager, Runtime};

const PANIC_LOG_FILE_PREFIX: &str = "panic-";
const PANIC_LOG_FILE_EXTENSION: &str = ".log";

pub fn install<R: Runtime>(app: &AppHandle<R>) {
    let log_dir = match app.path().app_log_dir() {
        Ok(log_dir) => log_dir,
        Err(error) => {
            log::warn!("panic-log: app log dir unavailable, hook not installed: {error}");
            return;
        }
    };
    let app_version = app.package_info().version.to_string();

    let previous_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        previous_hook(panic_info);
        write_panic_report(&log_dir, &app_version, panic_info);
    }));
}

fn write_panic_report(log_dir: &Path, app_version: &str, panic_info: &std::panic::PanicHookInfo<'_>) {
    let unix_timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or_default();
    let report = format_panic_report(
        &chrono::Utc::now().to_rfc3339(),
        app_version,
        std::env::consts::OS,
        std::env::consts::ARCH,
        &panic_message(panic_info),
        &panic_location(panic_info),
    );
    let _ = write_panic_log(log_dir, unix_timestamp, &report);
}

fn panic_message(panic_info: &std::panic::PanicHookInfo<'_>) -> String {
    if let Some(message) = panic_info.payload().downcast_ref::<&str>() {
        (*message).to_owned()
    } else if let Some(message) = panic_info.payload().downcast_ref::<String>() {
        message.clone()
    } else {
        "unknown panic payload".to_owned()
    }
}

fn panic_location(panic_info: &std::panic::PanicHookInfo<'_>) -> String {
    match panic_info.location() {
        Some(location) => format!("{}:{}:{}", location.file(), location.line(), location.column()),
        None => "unknown location".to_owned(),
    }
}

fn panic_log_path(log_dir: &Path, unix_timestamp: u64) -> PathBuf {
    log_dir.join(format!(
        "{PANIC_LOG_FILE_PREFIX}{unix_timestamp}{PANIC_LOG_FILE_EXTENSION}"
    ))
}

fn write_panic_log(log_dir: &Path, unix_timestamp: u64, report: &str) -> std::io::Result<()> {
    std::fs::create_dir_all(log_dir)?;
    std::fs::write(panic_log_path(log_dir, unix_timestamp), report)?;
    Ok(())
}

fn format_panic_report(
    timestamp: &str,
    app_version: &str,
    os: &str,
    arch: &str,
    message: &str,
    location: &str,
) -> String {
    format!(
        "panic report\n\
         timestamp: {timestamp}\n\
         app version: {app_version}\n\
         platform: {os} ({arch})\n\
         location: {location}\n\
         message: {message}\n"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_report_with_all_fields() {
        let report = format_panic_report(
            "2026-11-22T00:00:00+00:00",
            "1.3.1",
            "windows",
            "x86_64",
            "explicit panic",
            "src/lib.rs:10:5",
        );

        assert!(report.starts_with("panic report\n"));
        assert!(report.contains("timestamp: 2026-11-22T00:00:00+00:00\n"));
        assert!(report.contains("app version: 1.3.1\n"));
        assert!(report.contains("platform: windows (x86_64)\n"));
        assert!(report.contains("location: src/lib.rs:10:5\n"));
        assert!(report.contains("message: explicit panic\n"));
        assert!(report.ends_with('\n'));
    }

    #[test]
    fn multi_line_messages_are_preserved_verbatim() {
        let report = format_panic_report(
            "t",
            "1.0.0",
            "linux",
            "aarch64",
            "line one\nline two",
            "unknown location",
        );
        assert!(report.contains("message: line one\nline two\n"));
    }

    #[test]
    fn panic_log_name_uses_the_unix_timestamp() {
        let path = panic_log_path(Path::new("/logs"), 1_742_880_000);
        assert_eq!(
            path,
            Path::new("/logs").join("panic-1742880000.log")
        );
    }
}
