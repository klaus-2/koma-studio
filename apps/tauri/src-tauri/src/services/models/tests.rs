//! Wire pins (serde field spellings shared with the frontend and the on-disk
//! manifests) plus behavior tests for checksum parsing and the model store.

use std::fs;

use reqwest::header::{HeaderMap, HeaderValue};

use crate::models::model_manager::{
    DesktopInstalledModelRecord, DesktopModelDownloadPayload, DesktopRemoteModelUpdateCheckResult,
    ModelManagerEvent,
};

use super::{checksum, storage, validate_model_id};

#[test]
fn model_id_normalizes_and_rejects_path_components() {
    assert_eq!(validate_model_id(" Manga_OCR ").unwrap(), "manga_ocr");
    assert!(validate_model_id("../evil").is_err());
    assert!(validate_model_id("").is_err());
}

// The TS contract (shared-models/desktop-api.ts) spells checksum fields
// `*SHA256`, matching the on-disk manifest. These tests pin the serde names so
// a payload from the frontend never fails with
// "missing field `checksumSha256`" again.
#[test]
fn download_payload_accepts_frontend_field_names() {
    let payload = r#"{
        "id": "nllb-200",
        "name": "NLLB 200",
        "version": "1.0.0",
        "downloadUrl": "https://example.com/model.onnx",
        "checksumSHA256": "54e50d7b19c16883541a0f42f2f2be3617c6597457d8a29f86dc6f5d130f8f2d",
        "expectedDownloadBytes": 1234,
        "requiredDiskBytes": 5678
    }"#;
    let parsed: DesktopModelDownloadPayload =
        serde_json::from_str(payload).expect("frontend payload must deserialize");
    assert_eq!(
        parsed.checksum_sha256,
        "54e50d7b19c16883541a0f42f2f2be3617c6597457d8a29f86dc6f5d130f8f2d"
    );

    // The pre-fix plain-camelCase spelling stays accepted on input.
    let legacy = payload.replace("checksumSHA256", "checksumSha256");
    let parsed_legacy: DesktopModelDownloadPayload =
        serde_json::from_str(&legacy).expect("legacy payload spelling must deserialize");
    assert_eq!(parsed_legacy, parsed);
}

#[test]
fn records_serialize_with_frontend_field_names() {
    let record = DesktopInstalledModelRecord {
        model_id: "nllb-200".to_owned(),
        version: "1.0.0".to_owned(),
        installed_at: "2026-08-21T00:00:00Z".to_owned(),
        checksum_sha256: "abc".to_owned(),
        status: "installed".to_owned(),
        installed_languages: None,
        origin: None,
        model_dir: "models/nllb-200".to_owned(),
        manifest_path: "models/nllb-200/manifest.json".to_owned(),
        size_bytes: 1234,
    };
    let json = serde_json::to_value(&record).expect("serialize record");
    assert_eq!(json["checksumSHA256"], "abc");
    assert_eq!(json["modelDir"], "models/nllb-200");
    assert_eq!(json["manifestPath"], "models/nllb-200/manifest.json");

    let update_check = DesktopRemoteModelUpdateCheckResult {
        model_id: "nllb-200".to_owned(),
        installed_checksum_sha256: Some("abc".to_owned()),
        remote_checksum_sha256: None,
        registry_version: "1.0.0".to_owned(),
        checked: true,
        update_available: false,
    };
    let json = serde_json::to_value(&update_check).expect("serialize update check");
    assert_eq!(json["installedChecksumSHA256"], "abc");
    assert!(json
        .get("remoteChecksumSHA256")
        .is_some_and(serde_json::Value::is_null));
}

#[test]
fn events_serialize_with_camel_case_tag_and_fields() {
    let event = ModelManagerEvent::Progress {
        model_id: "nllb-200".to_owned(),
        bytes_downloaded: 10,
        total_bytes: 100,
        speed_bytes_per_second: 5,
        percent: 10.0,
        attempt: 2,
    };
    let json = serde_json::to_value(&event).expect("serialize event");
    assert_eq!(json["type"], "progress");
    assert_eq!(json["modelId"], "nllb-200");
    assert_eq!(json["bytesDownloaded"], 10);
    assert_eq!(json["speedBytesPerSecond"], 5);

    let failed = ModelManagerEvent::Failed {
        model_id: "x".to_owned(),
        message: "boom".to_owned(),
        attempt: 1,
        will_retry: true,
        code: None,
    };
    let json = serde_json::to_value(&failed).expect("serialize failed event");
    assert_eq!(json["willRetry"], true);
    assert!(json.get("code").is_none());
}

#[test]
fn checksum_header_parser_accepts_explicit_sha256() {
    assert_eq!(
        checksum::parse_checksum_from_header_value(
            "sha256=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        ),
        Some(
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                .to_string()
        )
    );
    assert_eq!(checksum::parse_checksum_from_header_value("etag"), None);
}


#[test]
fn missing_payload_is_reported_as_incomplete() {
    let temporary = tempfile::tempdir().unwrap();
    let directory = temporary.path().join("generic");
    fs::create_dir_all(&directory).unwrap();

    fs::write(
        directory.join("manifest.json"),
        r#"{
          "modelId":"generic",
          "version":"1.0.0",
          "installedAt":"2026-01-01T00:00:00Z",
          "checksumSHA256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "status":"installed",
          "origin":"download",
          "sizeBytes":0
        }"#,
    )
    .unwrap();

    let records = storage::list_installed_models(temporary.path()).unwrap();

    assert_eq!(records.len(), 1);
    assert_eq!(records[0].status, "incomplete");
}

#[test]
fn head_checksum_is_extracted_without_accepting_short_etags() {
    let mut headers = HeaderMap::new();
    headers.insert(
        "x-checksum-sha256",
        HeaderValue::from_static(
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ),
    );
    headers.insert("etag", HeaderValue::from_static("\"short-etag\""));

    assert_eq!(
        checksum::extract_checksum_from_headers(&headers),
        Some(
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
                .to_string()
        )
    );
}
