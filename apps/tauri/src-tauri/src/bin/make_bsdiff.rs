use std::{env, fs, path::PathBuf};

fn main() -> Result<(), String> {
    let args = env::args().skip(1).collect::<Vec<_>>();
    if args.len() != 3 {
        return Err("usage: make_bsdiff <old-file> <new-file> <patch-file>".to_string());
    }

    let old_file = PathBuf::from(&args[0]);
    let new_file = PathBuf::from(&args[1]);
    let patch_file = PathBuf::from(&args[2]);
    let old = fs::read(&old_file).map_err(|error| error.to_string())?;
    let new = fs::read(&new_file).map_err(|error| error.to_string())?;
    let mut patch = Vec::new();
    bsdiff::diff(&old, &new, &mut patch).map_err(|error| error.to_string())?;
    if let Some(parent) = patch_file.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(patch_file, patch).map_err(|error| error.to_string())
}
