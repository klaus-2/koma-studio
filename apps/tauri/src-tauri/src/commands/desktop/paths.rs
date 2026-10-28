//! Filesystem path helpers: ancestor walks, de-duplication and link-safe
//! removal.

use std::{
    collections::HashSet,
    fs, io,
    path::{Path, PathBuf},
};

pub(super) fn ancestor_dirs(start: &Path, max_depth: usize) -> Vec<PathBuf> {
    start
        .ancestors()
        .take(max_depth)
        .map(Path::to_path_buf)
        .collect()
}

pub(super) fn dedupe_paths<I: IntoIterator<Item = PathBuf>>(paths: I) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    paths
        .into_iter()
        .filter(|path| seen.insert(path.clone()))
        .collect()
}

/// Removes a file, directory or symlink without following the link.
/// Returns whether anything was removed.
pub(super) fn remove_path_if_present(path: &Path) -> io::Result<bool> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => remove_symlink(path).map(|()| true),
        Ok(metadata) if metadata.is_dir() => fs::remove_dir_all(path).map(|()| true),
        Ok(_) => fs::remove_file(path).map(|()| true),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error),
    }
}

/// Decides how to unlink a symlink from its own metadata, never from the
/// target's: a directory-junction target cannot decide the removal mode.
#[cfg(windows)]
fn remove_symlink(path: &Path) -> io::Result<()> {
    use std::os::windows::fs::FileTypeExt;

    let file_type = fs::symlink_metadata(path)?.file_type();

    if file_type.is_symlink_dir() {
        fs::remove_dir(path)
    } else {
        fs::remove_file(path)
    }
}

#[cfg(not(windows))]
fn remove_symlink(path: &Path) -> io::Result<()> {
    fs::remove_file(path)
}
