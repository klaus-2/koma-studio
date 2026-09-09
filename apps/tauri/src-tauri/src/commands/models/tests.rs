use super::*;

#[test]
fn sanitize_model_id_rejects_path_like_values() {
    assert_eq!(sanitize_model_id(" Manga_OCR ").unwrap(), "manga_ocr");
    assert!(sanitize_model_id("../evil").is_err());
    assert!(sanitize_model_id("").is_err());
}

#[test]
fn list_installed_marks_missing_payload_incomplete() {
    let temp = tempfile::tempdir().unwrap();
    let dir = temp.path().join("generic");
    fs::create_dir_all(&dir).unwrap();
    fs::write(
            dir.join(MANIFEST_FILE_NAME),
            r#"{"modelId":"generic","version":"1.0.0","installedAt":"2026-01-01T00:00:00Z","checksumSHA256":"abc","status":"installed"}"#,
        )
        .unwrap();

    let records = list_installed_models(temp.path()).unwrap();

    assert_eq!(records.len(), 1);
    assert_eq!(records[0].status, "incomplete");
}

#[test]
fn parses_checksum_from_headers() {
    assert_eq!(
        parse_checksum_from_header_value(
            "sha256=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        ),
        Some("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".to_string())
    );
    assert_eq!(parse_checksum_from_header_value("etag"), None);
}
