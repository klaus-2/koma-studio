use std::fs;
use std::io::Cursor;
use std::path::Path;

use super::manifest::verify_hash;

pub fn apply_bsdiff_patch(
    old_file: &Path,
    patch_file: &Path,
    target_file: &Path,
    expected_target_hash: &str,
) -> Result<u64, String> {
    let old = fs::read(old_file).map_err(|error| error.to_string())?;
    let patch = fs::read(patch_file).map_err(|error| error.to_string())?;
    let mut patched = Vec::new();
    bsdiff::patch(&old, &mut Cursor::new(patch), &mut patched)
        .map_err(|error| error.to_string())?;
    verify_hash(&patched, expected_target_hash)?;

    if let Some(parent) = target_file.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let staging = target_file.with_extension("patching");
    let backup = target_file.with_extension("patch-backup");
    fs::write(&staging, &patched).map_err(|error| error.to_string())?;
    if target_file.exists() {
        if backup.exists() {
            fs::remove_file(&backup).map_err(|error| error.to_string())?;
        }
        fs::rename(target_file, &backup).map_err(|error| error.to_string())?;
    }
    if let Err(error) = fs::rename(&staging, target_file) {
        if backup.exists() {
            let _ = fs::rename(&backup, target_file);
        }
        return Err(error.to_string());
    }
    if backup.exists() {
        fs::remove_file(&backup).map_err(|error| error.to_string())?;
    }
    Ok(patched.len() as u64)
}

#[cfg(test)]
mod tests {
    use super::super::manifest::integrity_for_bytes;
    use super::*;

    #[test]
    fn applies_bsdiff_patch_and_verifies_target_hash() {
        let temp = tempfile::tempdir().unwrap();
        let old = temp.path().join("old.bin");
        let new = temp.path().join("new.bin");
        let patch = temp.path().join("patch.bsdiff");
        let out = temp.path().join("out.bin");
        fs::write(&old, b"mini-backend-v1").unwrap();
        fs::write(&new, b"mini-backend-v2 with more bytes").unwrap();
        let mut patch_bytes = Vec::new();
        bsdiff::diff(
            &fs::read(&old).unwrap(),
            &fs::read(&new).unwrap(),
            &mut patch_bytes,
        )
        .unwrap();
        fs::write(&patch, patch_bytes).unwrap();
        let written = apply_bsdiff_patch(
            &old,
            &patch,
            &out,
            &integrity_for_bytes(&fs::read(&new).unwrap()),
        )
        .unwrap();
        assert_eq!(written as usize, fs::read(&new).unwrap().len());
        assert_eq!(fs::read(out).unwrap(), fs::read(new).unwrap());
    }
}
