use std::{
    fs::{self, File},
    io::{BufReader, Read},
    path::{Component, Path, PathBuf},
};

use sha2::{Digest, Sha256};

use crate::runtime::profiles::RuntimeError;

pub fn sha256_hex_file(path: &Path) -> Result<String, RuntimeError> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn clean_tar_relative_path(raw: &Path) -> Result<PathBuf, RuntimeError> {
    let mut clean = PathBuf::new();
    for component in raw.components() {
        match component {
            Component::CurDir => {}
            Component::Normal(part) => {
                let s = part.to_string_lossy();
                if s.is_empty()
                    || s == ".."
                    || s.contains(':')
                    || s.chars().any(char::is_control)
                    || s.ends_with(' ')
                    || (cfg!(windows) && s.ends_with('.') && s != ".")
                {
                    return Err(RuntimeError::Integrity(format!(
                        "unsafe tar entry path segment: {:?}",
                        raw
                    )));
                }
                clean.push(part);
            }
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(RuntimeError::Integrity(format!(
                    "unsafe tar entry path escapes destination: {:?}",
                    raw
                )));
            }
        }
    }
    Ok(clean)
}

pub fn extract_tar_zst_file(archive_path: &Path, dest_dir: &Path) -> Result<(), RuntimeError> {
    fs::create_dir_all(dest_dir)?;
    let file = File::open(archive_path)?;
    let buffered = BufReader::with_capacity(256 * 1024, file);
    let decoder = zstd::stream::read::Decoder::new(buffered)?;
    let mut archive = tar::Archive::new(decoder);

    for entry_res in archive.entries()? {
        let mut entry = entry_res?;
        let header = entry.header();
        let entry_type = header.entry_type();
        #[cfg(unix)]
        let entry_mode = header.mode().unwrap_or(0o644);
        if entry_type.is_pax_global_extensions()
            || entry_type.is_pax_local_extensions()
            || entry_type.is_gnu_longname()
            || entry_type.is_gnu_longlink()
        {
            continue;
        }

        let raw_path = entry.path()?.into_owned();
        let rel_path = clean_tar_relative_path(&raw_path)?;
        if rel_path.as_os_str().is_empty() {
            continue;
        }
        let out_path = dest_dir.join(&rel_path);

        match entry_type {
            tar::EntryType::Directory => {
                fs::create_dir_all(&out_path)?;
            }
            tar::EntryType::Regular | tar::EntryType::Continuous => {
                if let Some(parent) = out_path.parent() {
                    fs::create_dir_all(parent)?;
                }
                if out_path.exists() {
                    let _ = fs::remove_file(&out_path);
                }
                let mut out_file = File::create(&out_path)?;
                std::io::copy(&mut entry, &mut out_file)?;
                #[cfg(unix)]
                if (entry_mode & 0o111) != 0 {
                    use std::os::unix::fs::PermissionsExt;
                    let mut perms = fs::metadata(&out_path)?.permissions();
                    perms.set_mode(entry_mode);
                    fs::set_permissions(&out_path, perms)?;
                }
            }
            tar::EntryType::Link => {
                let Some(link_name) = entry.link_name()? else {
                    return Err(RuntimeError::Integrity(format!(
                        "tar hardlink entry missing target: {:?}",
                        rel_path
                    )));
                };
                let target_rel = clean_tar_relative_path(&link_name)?;
                if target_rel.as_os_str().is_empty() {
                    return Err(RuntimeError::Integrity(format!(
                        "tar hardlink target is empty: {:?}",
                        rel_path
                    )));
                }
                let target_abs = dest_dir.join(&target_rel);
                if !target_abs.exists() {
                    return Err(RuntimeError::Integrity(format!(
                        "tar hardlink target missing before link: {:?}",
                        target_rel
                    )));
                }
                if let Some(parent) = out_path.parent() {
                    fs::create_dir_all(parent)?;
                }
                if out_path.exists() {
                    let _ = fs::remove_file(&out_path);
                }
                if fs::hard_link(&target_abs, &out_path).is_err() {
                    fs::copy(&target_abs, &out_path)?;
                }
            }
            other => {
                return Err(RuntimeError::Integrity(format!(
                    "unsupported tar entry type {:?} at {:?}",
                    other, rel_path
                )));
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_test_tar_zst<F>(archive_path: &Path, populate: F)
    where
        F: FnOnce(&mut tar::Builder<zstd::stream::write::Encoder<'static, File>>),
    {
        let out = File::create(archive_path).unwrap();
        let encoder = zstd::stream::write::Encoder::new(out, 3).unwrap();
        let mut builder = tar::Builder::new(encoder);
        populate(&mut builder);
        let encoder = builder.into_inner().unwrap();
        encoder.finish().unwrap();
    }

    #[test]
    fn extracts_regular_files_and_hardlinks_safely() {
        let temp = tempfile::tempdir().unwrap();
        let archive_path = temp.path().join("sample.tar.zst");
        let dest_dir = temp.path().join("out");

        write_test_tar_zst(&archive_path, |builder| {
            let mut dir_hdr = tar::Header::new_ustar();
            dir_hdr.set_entry_type(tar::EntryType::Directory);
            dir_hdr.set_mode(0o755);
            dir_hdr.set_size(0);
            dir_hdr.set_cksum();
            builder.append_data(&mut dir_hdr, "pkg", &[][..]).unwrap();

            let payload = b"print('hello layered engine')\n";
            let mut file_hdr = tar::Header::new_ustar();
            file_hdr.set_entry_type(tar::EntryType::Regular);
            file_hdr.set_mode(0o644);
            file_hdr.set_size(payload.len() as u64);
            file_hdr.set_cksum();
            builder
                .append_data(&mut file_hdr, "pkg/a.py", &payload[..])
                .unwrap();

            let mut link_hdr = tar::Header::new_ustar();
            link_hdr.set_entry_type(tar::EntryType::Link);
            link_hdr.set_mode(0o644);
            link_hdr.set_size(0);
            link_hdr.set_link_name("pkg/a.py").unwrap();
            link_hdr.set_cksum();
            builder
                .append_data(&mut link_hdr, "pkg/b.py", &[][..])
                .unwrap();
        });

        extract_tar_zst_file(&archive_path, &dest_dir).unwrap();
        assert_eq!(
            fs::read_to_string(dest_dir.join("pkg/a.py")).unwrap(),
            "print('hello layered engine')\n"
        );
        assert_eq!(
            fs::read_to_string(dest_dir.join("pkg/b.py")).unwrap(),
            "print('hello layered engine')\n"
        );
        assert_eq!(
            sha256_hex_file(&dest_dir.join("pkg/a.py")).unwrap().len(),
            64
        );
    }

    #[test]
    fn rejects_path_traversal_and_symlinks() {
        let temp = tempfile::tempdir().unwrap();
        let archive_path = temp.path().join("evil.tar.zst");
        let dest_dir = temp.path().join("out");

        write_test_tar_zst(&archive_path, |builder| {
            let mut sym = tar::Header::new_ustar();
            sym.set_entry_type(tar::EntryType::Symlink);
            sym.set_mode(0o777);
            sym.set_size(0);
            builder
                .append_link(&mut sym, "bad-link", "/etc/passwd")
                .unwrap();
        });

        assert!(extract_tar_zst_file(&archive_path, &dest_dir).is_err());
        assert!(clean_tar_relative_path(Path::new("../escape.txt")).is_err());
    }
}
