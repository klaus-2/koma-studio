use std::fs;

use reqwest::header::{HeaderMap, HeaderValue};

use crate::models::model_manager::{
    DesktopInstalledModelRecord, DesktopModelDownloadPayload, DesktopRemoteModelUpdateCheckResult,
    ModelManagerEvent,
};

use super::{checksum, normalize_download_payload, storage, validate_model_id};

#[test]
fn paddleocr_payload_from_the_frontend_is_accepted() {
    let payload = DesktopModelDownloadPayload {
        id: "paddleocr_en_v5".to_string(),
        name: "PaddleOCR v5 English (ONNX)".to_string(),
        version: "1.1.0".to_string(),
        download_url:
            "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.4.0/onnx/PP-OCRv5/rec/en_PP-OCRv5_rec_mobile_infer.onnx"
                .to_string(),
        checksum_sha256: "c3461add59bb4323ecba96a492ab75e06dda42467c9e3d0c18db5d1d21924be8"
            .to_string(),
        expected_download_bytes: 12_687_770,
        required_disk_bytes: 12_690_611,
        source_language: None,
        install_strategy: None,
        runtime_family: None,
        backend_install_endpoint: None,
    };

    let normalized = normalize_download_payload(payload)
        .expect("the frontend payload must be accepted by the desktop shell");

    assert_eq!(normalized.install_strategy.as_deref(), Some("backend_managed"));
    assert_eq!(
        normalized.backend_install_endpoint.as_deref(),
        Some("/models/install")
    );
}

#[test]
fn model_id_normalizes_and_rejects_path_components() {
    assert_eq!(validate_model_id(" Manga_OCR ").unwrap(), "manga_ocr");
    assert!(validate_model_id("../evil").is_err());
    assert!(validate_model_id("").is_err());
}

#[test]
fn download_url_allows_every_host_the_registry_uses() {
    for url in [
        "https://huggingface.co/openai/whisper/resolve/main/model.bin",
        "https://hf.co/openai/whisper/resolve/main/model.bin",
        "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.4.0/onnx/PP-OCRv5/rec/en_PP-OCRv5_rec_mobile_infer.onnx",
        "https://github.com/zyddnys/manga-image-translator/releases/download/beta-0.3/comictextdetector.pt.onnx",
        "https://raw.githubusercontent.com/terrainer/AI-Upscaling-Models/main/4xSPANkendata/4xSPANkendata_fp32.onnx",
    ] {
        assert!(
            checksum::validate_remote_download_url(url).is_ok(),
            "{url} must be an allowed model source"
        );
    }

    for url in [
        "https://evil.example.com/model.bin",
        "https://huggingface.co.evil.com/model.bin",
        "https://notmodelscope.cn/model.bin",
        "http://huggingface.co/model.bin",
        "https://huggingface.co:8443/model.bin",
    ] {
        assert!(
            checksum::validate_remote_download_url(url).is_err(),
            "{url} must be refused"
        );
    }
}

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
        total_bytes: Some(100),
        speed_bytes_per_second: 5,
        percent: Some(10.0),
        attempt: 2,
        current_file: Some("model.bin".to_owned()),
        files_completed: Some(1),
        files_total: Some(3),
        eta_seconds: Some(18.0),
        phase: Some("downloading".to_owned()),
    };
    let json = serde_json::to_value(&event).expect("serialize event");
    assert_eq!(json["type"], "progress");
    assert_eq!(json["modelId"], "nllb-200");
    assert_eq!(json["bytesDownloaded"], 10);
    assert_eq!(json["speedBytesPerSecond"], 5);
    assert_eq!(json["totalBytes"], 100);
    assert_eq!(json["percent"], 10.0);
    assert_eq!(json["currentFile"], "model.bin");
    assert_eq!(json["filesCompleted"], 1);
    assert_eq!(json["filesTotal"], 3);
    assert_eq!(json["etaSeconds"], 18.0);
    assert_eq!(json["phase"], "downloading");

    let unknown = ModelManagerEvent::Progress {
        model_id: "nllb-200".to_owned(),
        bytes_downloaded: 10,
        total_bytes: None,
        speed_bytes_per_second: 5,
        percent: None,
        attempt: 2,
        current_file: None,
        files_completed: None,
        files_total: None,
        eta_seconds: None,
        phase: None,
    };
    let json = serde_json::to_value(&unknown).expect("serialize event");
    assert!(json["totalBytes"].is_null());
    assert!(json["percent"].is_null());
    assert!(json.get("currentFile").is_none());

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
fn backend_snapshot_accepts_float_speed_and_null_total() {
    use crate::services::models::backend::BackendJobSnapshot;

    let payload = r#"{
        "jobId": "d5f1e2a3b4c6d7e8f9a0b1c2d3e4f5a6",
        "modelId": "manga_ocr",
        "state": "downloading",
        "bytesDownloaded": 0,
        "totalBytes": null,
        "speedBytesPerSecond": 0.0,
        "percent": 0.0,
        "attempt": 0,
        "createdAt": "2026-09-05T00:00:00Z"
    }"#;
    let snapshot: BackendJobSnapshot =
        serde_json::from_str(payload).expect("backend snapshot must deserialize");
    assert_eq!(snapshot.state, "downloading");
    assert_eq!(snapshot.bytes_downloaded, 0);
    assert_eq!(snapshot.total_bytes, None);
    assert_eq!(snapshot.speed_bytes_per_second, Some(0.0));

    let flowing = payload
        .replace(r#""bytesDownloaded": 0"#, r#""bytesDownloaded": 1024"#)
        .replace(r#""speedBytesPerSecond": 0.0"#, r#""speedBytesPerSecond": 153600.0"#);
    let snapshot: BackendJobSnapshot =
        serde_json::from_str(&flowing).expect("flowing snapshot must deserialize");
    assert_eq!(snapshot.speed_bytes_per_second, Some(153600.0));
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

#[test]
fn font_rtdetr_payload_is_backend_managed() {
    let payload = DesktopModelDownloadPayload {
        id: "font_rtdetr_v2".to_string(),
        name: "RT-DETR v2 (Detector)".to_string(),
        version: "1.0.0".to_string(),
        download_url:
            "https://huggingface.co/ogkalu/comic-text-and-bubble-detector/resolve/main/detector.onnx"
                .to_string(),
        checksum_sha256:
            "065744e91c0594ad8663aa8b870ce3fb27222942eded5a3cc388ce23421bd195".to_string(),
        expected_download_bytes: 168_481_531,
        required_disk_bytes: 300_000_000,
        source_language: None,
        install_strategy: None,
        runtime_family: None,
        backend_install_endpoint: None,
    };

    let normalized = normalize_download_payload(payload)
        .expect("the frontend payload must be accepted by the desktop shell");

    assert_eq!(normalized.install_strategy.as_deref(), Some("backend_managed"));
    assert_eq!(
        normalized.backend_install_endpoint.as_deref(),
        Some("/models/install")
    );
}

#[test]
fn font_rtdetr_requires_detector_onnx() {
    let temporary = tempfile::tempdir().unwrap();
    let directory = temporary.path().join("font_rtdetr_v2");
    fs::create_dir_all(&directory).unwrap();

    assert!(!storage::is_installed_payload_present("font_rtdetr_v2", &directory).unwrap());

    fs::write(directory.join("model.bin"), b"weights").unwrap();
    assert!(!storage::is_installed_payload_present("font_rtdetr_v2", &directory).unwrap());

    fs::write(directory.join("detector.onnx"), b"weights").unwrap();
    assert!(storage::is_installed_payload_present("font_rtdetr_v2", &directory).unwrap());
}

#[test]
fn newly_added_backend_managed_models_are_normalized_and_payload_checked() {
    for (id, file) in [
        ("hunyuan_7b_mt_v1_0", "Hunyuan-MT-7B-q4_k_m.gguf"),
        ("sakura_1_5b_qwen2_5_v1_0", "sakura-1.5b-qwen2.5-v1.0-Q5KS.gguf"),
        ("sakura_galtransl_7b_v3_7", "Sakura-Galtransl-7B-v3.7-IQ4_XS.gguf"),
        ("vntl_llama3_8b_v2", "vntl-llama3-8b-v2-hf-q8_0.gguf"),
        ("lfm2_350m_enjp_mt", "LFM2-350M-ENJP-MT-Q4_0.gguf"),
        ("pp_doclayout_v3", "model.safetensors"),
        ("paddleocr_vl_1_5", "model.safetensors"),
        ("instruct_pix2pix", "unet/diffusion_pytorch_model.fp16.safetensors"),
        ("sdxl_instruct_pix2pix", "unet/diffusion_pytorch_model.safetensors"),
        ("flux2_klein_4b_gguf_q4", "gguf/flux-2-klein-4b-Q4_K_M.gguf"),
        ("flux2_klein_4b", "transformer/diffusion_pytorch_model.safetensors"),
        ("longcat_image_edit_turbo", "transformer/diffusion_pytorch_model.safetensors"),
        ("qwen_image_edit_2511_gguf_q4", "gguf/qwen-image-edit-2511-Q4_K_M.gguf"),
        ("qwen_image_edit_2511", "transformer/diffusion_pytorch_model-00001-of-00005.safetensors"),
        ("firered_image_edit_1_1", "transformer/diffusion_pytorch_model-00001-of-00005.safetensors"),
    ] {
        let payload = DesktopModelDownloadPayload {
            id: id.to_string(),
            name: id.to_string(),
            version: "1.0.0".to_string(),
            download_url: "https://huggingface.co/example/repo/resolve/main/file.bin".to_string(),
            checksum_sha256: "a".repeat(64),
            expected_download_bytes: 1024,
            required_disk_bytes: 2048,
            source_language: None,
            install_strategy: None,
            runtime_family: None,
            backend_install_endpoint: None,
        };
        let normalized = normalize_download_payload(payload).expect(id);
        assert_eq!(normalized.install_strategy.as_deref(), Some("backend_managed"), "{id}");
        assert_eq!(normalized.backend_install_endpoint.as_deref(), Some("/models/install"), "{id}");

        let temporary = tempfile::tempdir().unwrap();
        let directory = temporary.path().join(id);
        fs::create_dir_all(&directory).unwrap();
        fs::write(directory.join("config.json"), b"{}").unwrap();
        assert!(!storage::is_installed_payload_present(id, &directory).unwrap(), "{id}");
        assert!(!file.is_empty());
    }
}

#[test]
fn emit_progress_keeps_percent_none_when_total_is_unknown() {
    use std::sync::{Arc, Mutex};
    use crate::services::models::backend::BackendJobSnapshot;
    use super::{DownloadObserver, ModelServiceEvent, emit_progress};

    let events: Arc<Mutex<Vec<ModelServiceEvent>>> = Arc::new(Mutex::new(Vec::new()));
    let captured = Arc::clone(&events);
    let observer: DownloadObserver = Arc::new(move |event| {
        captured.lock().unwrap().push(event);
    });

    let snapshot = BackendJobSnapshot {
        state: "downloading".to_string(),
        bytes_downloaded: 4096,
        total_bytes: None,
        percent: Some(0.0),
        speed_bytes_per_second: Some(1024.0),
        current_file: Some("weights.bin".to_string()),
        files_completed: Some(0),
        files_total: Some(1),
        eta_seconds: None,
        error_message: None,
        error_code: None,
    };

    emit_progress(&snapshot, &observer);
    let recorded = events.lock().unwrap();
    assert_eq!(recorded.len(), 1);
    match &recorded[0] {
        ModelServiceEvent::Progress { percent, total_bytes, current_file, .. } => {
            assert_eq!(*percent, None);
            assert_eq!(*total_bytes, None);
            assert_eq!(current_file.as_deref(), Some("weights.bin"));
        }
        other => panic!("unexpected event: {other:?}"),
    }
}

#[test]
fn restore_previous_manifest_cleans_up_empty_incomplete_dir() {
    let temporary = tempfile::tempdir().unwrap();
    let payload = DesktopModelDownloadPayload {
        id: "manga_ocr".to_string(),
        name: "Manga OCR".to_string(),
        version: "1.0.0".to_string(),
        download_url: "https://huggingface.co/mayocream/manga-ocr-onnx/resolve/main/encoder_model.onnx".to_string(),
        checksum_sha256: "a".repeat(64),
        expected_download_bytes: 1024,
        required_disk_bytes: 2048,
        source_language: None,
        install_strategy: None,
        runtime_family: None,
        backend_install_endpoint: None,
    };

    let previous = storage::prepare_download(temporary.path(), &payload).unwrap();
    assert!(previous.is_none());
    let dir = temporary.path().join("manga_ocr");
    assert!(dir.join("manifest.json").is_file());

    storage::restore_previous_manifest(temporary.path(), "manga_ocr", None).unwrap();
    assert!(!dir.exists());
}
