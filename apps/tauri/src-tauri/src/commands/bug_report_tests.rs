    use super::*;

    #[test]
    fn validates_discord_webhook_url() {
        assert!(
            normalize_discord_webhook_url(Some(" https://discord.com/api/webhooks/1/token "))
                .is_some()
        );
        assert!(
            normalize_discord_webhook_url(Some("https://discordapp.com/api/webhooks/1/t"))
                .is_some()
        );
        assert!(normalize_discord_webhook_url(Some("https://example.com")).is_none());
        assert!(normalize_discord_webhook_url(None).is_none());
    }

    #[test]
    fn endpoint_allowlist_accepts_koma_hosts() {
        assert!(is_allowed_bug_report_endpoint("https://koma-studio.site/api/bug-reports"));
        assert!(is_allowed_bug_report_endpoint("https://api.koma-studio.site/api/bug-reports"));
        assert!(is_allowed_bug_report_endpoint(" https://koma-studio.site "));
        assert!(is_allowed_bug_report_endpoint("https://KOMA-STUDIO.SITE/api/bug-reports"));
        assert!(is_allowed_bug_report_endpoint("https://koma-studio.site."));
    }

    #[test]
    fn endpoint_allowlist_rejects_non_https_other_hosts_and_tricks() {
        assert!(!is_allowed_bug_report_endpoint("http://koma-studio.site/api/bug-reports"));
        assert!(!is_allowed_bug_report_endpoint("ftp://koma-studio.site"));
        assert!(!is_allowed_bug_report_endpoint("https://evil.com/api/bug-reports"));
        assert!(!is_allowed_bug_report_endpoint("https://koma-studio.site.evil.com/api"));
        assert!(!is_allowed_bug_report_endpoint("https://koma-studio.site@evil.com/api"));
        assert!(!is_allowed_bug_report_endpoint("https://evil.com/?u=https://koma-studio.site"));
        assert!(!is_allowed_bug_report_endpoint("https://127.0.0.1/api/bug-reports"));
        assert!(!is_allowed_bug_report_endpoint(""));
        assert!(!is_allowed_bug_report_endpoint("not a url"));
    }

    #[test]
    fn payload_parts_reject_short_titles_and_default_include_logs() {
        let payload = BugReportSubmitPayload {
            title: Some("ab".to_owned()),
            description: Some("description".to_owned()),
            ..Default::default()
        };
        assert!(matches!(
            prepare_payload_parts(payload),
            Err(BugReportError::Rejected { status: 400, .. })
        ));

        let payload = BugReportSubmitPayload {
            title: Some("Valid title".to_owned()),
            ..Default::default()
        };
        let parts = prepare_payload_parts(payload).unwrap();
        assert!(parts.include_logs);
        assert_eq!(parts.title, "Valid title");
        assert!(parts.screenshot.is_none());
        assert!(parts.attachments.is_empty());
        assert!(parts.auto_log_ids.is_none());
    }

    #[test]
    fn assemble_description_appends_sections_in_order() {
        let description = assemble_description(
            "Crash on export",
            &[
                ("Route", "/studio".to_owned()),
                ("Steps", "Click export".to_owned()),
            ],
        );
        assert_eq!(
            description,
            "Crash on export\n\nRoute:\n/studio\n\nSteps:\nClick export"
        );
    }

    #[test]
    fn assemble_description_truncates_to_max_chars() {
        let long = "x".repeat(MAX_DESCRIPTION_CHARS + 50);
        assert_eq!(
            assemble_description(&long, &[]).chars().count(),
            MAX_DESCRIPTION_CHARS
        );
        let description =
            assemble_description("base", &[("Contact", "y".repeat(MAX_DESCRIPTION_CHARS))]);
        assert_eq!(description.chars().count(), MAX_DESCRIPTION_CHARS);
    }

    #[test]
    fn screenshot_data_url_requires_png_jpeg_and_size_cap() {
        let data = BASE64.encode(b"png");
        assert!(
            validate_screenshot_data_url(&format!("data:image/png;base64,{data}")).is_ok()
        );
        assert!(
            validate_screenshot_data_url(&format!("data:image/jpeg;base64,{data}")).is_ok()
        );
        assert!(matches!(
            validate_screenshot_data_url(&format!("data:image/webp;base64,{data}")),
            Err(BugReportError::Rejected { status: 400, .. })
        ));
        assert!(matches!(
            validate_screenshot_data_url(&format!("data:text/plain;base64,{data}")),
            Err(BugReportError::Rejected { status: 400, .. })
        ));
        assert!(matches!(
            validate_screenshot_data_url("no-comma"),
            Err(BugReportError::Rejected { status: 400, .. })
        ));
        assert!(matches!(
            validate_screenshot_data_url("data:image/png;base64,***"),
            Err(BugReportError::Rejected { status: 400, .. })
        ));
        let oversized =
            format!("data:image/png;base64,{}", "A".repeat(MAX_SCREENSHOT_BYTES * 4 / 3 + 4096));
        assert!(matches!(
            validate_screenshot_data_url(&oversized),
            Err(BugReportError::Rejected { status: 400, .. })
        ));
    }

    #[test]
    fn manual_attachments_enforce_caps_and_mime_kinds() {
        let attachments = validate_manual_attachments(vec![ManualAttachmentInput {
            name: Some("../../evil.txt".to_owned()),
            mime_type: Some("text/plain".to_owned()),
            content_base64: Some(BASE64.encode(b"hello")),
        }])
        .unwrap();
        assert_eq!(attachments.len(), 1);
        assert_eq!(attachments[0].name, "evil.txt");
        assert_eq!(attachments[0].mime, "text/plain");
        assert_eq!(attachments[0].data, BASE64.encode(b"hello"));

        assert!(matches!(
            validate_manual_attachments(vec![ManualAttachmentInput {
                mime_type: Some("application/zip".to_owned()),
                ..Default::default()
            }]),
            Err(BugReportError::Rejected { status: 400, .. })
        ));
        assert!(matches!(
            validate_manual_attachments(vec![ManualAttachmentInput {
                mime_type: Some("image/png".to_owned()),
                content_base64: Some("not base64!!!".to_owned()),
                ..Default::default()
            }]),
            Err(BugReportError::Rejected { status: 400, .. })
        ));
        assert!(matches!(
            validate_manual_attachments(vec![ManualAttachmentInput {
                mime_type: Some("image/png".to_owned()),
                content_base64: Some("A".repeat(8_000_000)),
                ..Default::default()
            }]),
            Err(BugReportError::Rejected { status: 400, .. })
        ));

        let too_many = (0..=MAX_MANUAL_ATTACHMENTS)
            .map(|_| ManualAttachmentInput::default())
            .collect();
        assert!(matches!(
            validate_manual_attachments(too_many),
            Err(BugReportError::Rejected { status: 400, .. })
        ));
    }

    #[test]
    fn safe_file_name_neutralizes_traversal_and_reserved_chars() {
        assert_eq!(safe_file_name("..\\..\\x:y*z?.log"), "xyz.log");
        assert_eq!(safe_file_name(" ... "), DEFAULT_ATTACHMENT_NAME);
        assert_eq!(safe_file_name("a\nb\u{7}.txt"), "ab.txt");
        assert!(safe_file_name(&"x".repeat(500)).chars().count() <= MAX_FILE_NAME_CHARS);
    }

    #[test]
    fn tail_truncate_lossy_keeps_the_end_and_respects_char_boundaries() {
        assert_eq!(tail_truncate_lossy(b"0123456789", 4), "6789");
        assert_eq!(tail_truncate_lossy(b"0123456789", 100), "0123456789");
        assert_eq!(tail_truncate_lossy(b"0123456789", 0), "");
        let accents = "abéé".as_bytes();
        assert_eq!(tail_truncate_lossy(accents, 3), "é");
    }

    #[test]
    fn build_log_entries_tail_truncates_and_stops_at_total_cap() {
        let temp = tempfile::tempdir().unwrap();
        let newest = temp.path().join("new.log");
        let older = temp.path().join("old.log");
        let oldest = temp.path().join("oldest.log");
        fs::write(&newest, b"0123456789").unwrap();
        fs::write(&older, b"abcdefghij").unwrap();
        fs::write(&oldest, b"klmnopqrst").unwrap();

        let files = vec![
            auto_log_file(&newest, "new.log"),
            auto_log_file(&older, "old.log"),
            auto_log_file(&oldest, "oldest.log"),
        ];
        let entries = build_log_entries(files, 3, 4, 6);
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].name, "new.log");
        assert_eq!(entries[0].content, "6789");
        assert_eq!(entries[1].name, "old.log");
        assert_eq!(entries[1].content, "ij");
    }

    #[test]
    fn build_log_entries_respects_item_count_cap() {
        let temp = tempfile::tempdir().unwrap();
        let files: Vec<AutoLogFile> = (0..3)
            .map(|index| {
                let path = temp.path().join(format!("{index}.log"));
                fs::write(&path, b"data").unwrap();
                auto_log_file(&path, &format!("{index}.log"))
            })
            .collect();
        let entries = build_log_entries(files, 2, 100, 100);
        assert_eq!(entries.len(), 2);
    }

    fn auto_log_file(path: &Path, name: &str) -> AutoLogFile {
        AutoLogFile {
            id: stable_hash("bug-report-log", &path.to_string_lossy()),
            name: name.to_owned(),
            size: fs::metadata(path).unwrap().len(),
            source: LogSource::App,
            modified: SystemTime::UNIX_EPOCH,
            path: path.to_path_buf(),
        }
    }

    fn test_diagnostics() -> BugReportDiagnostics {
        BugReportDiagnostics {
            timestamp: "2026-01-01T00:00:00Z".to_owned(),
            app_name: "KOMA".to_owned(),
            app_version: "1.3.1".to_owned(),
            tauri_version: "2.0.0",
            webview_version: None,
            platform: "windows",
            arch: "x86_64",
            os_family: "windows",
            app_packaged: false,
            env_mode: "development",
            update_channel: "stable".to_owned(),
            mini_backend_running: false,
            auth_api_url: "https://api.koma-studio.site".to_owned(),
            local_api_url: "http://127.0.0.1:8000".to_owned(),
            runtime_artifacts_url: None,
        }
    }

    fn sample_payload() -> BugReportApiPayload {
        BugReportApiPayload {
            schema: BUG_REPORT_SCHEMA,
            title: "Test report".to_owned(),
            description: "description".to_owned(),
            include_logs: true,
            client: BugReportClientInfo {
                app_version: "1.3.1".to_owned(),
                shell: "tauri",
                platform: "windows",
                arch: "x86_64",
                channel: "stable".to_owned(),
                session_id: "0123abcd-0123-4123-8123-0123456789ab".to_owned(),
            },
            diagnostics: test_diagnostics(),
            screenshot: Some("data:image/png;base64,QQ==".to_owned()),
            logs: vec![
                BugReportLogEntry {
                    name: "new.log".to_owned(),
                    content: "x".repeat(1000),
                },
                BugReportLogEntry {
                    name: "old.log".to_owned(),
                    content: "x".repeat(1000),
                },
            ],
            attachments: vec![
                BugReportApiAttachment {
                    name: "a.png".to_owned(),
                    mime: "image/png".to_owned(),
                    data: "A".repeat(1000),
                },
                BugReportApiAttachment {
                    name: "b.png".to_owned(),
                    mime: "image/png".to_owned(),
                    data: "A".repeat(2000),
                },
                BugReportApiAttachment {
                    name: "c.png".to_owned(),
                    mime: "image/png".to_owned(),
                    data: "A".repeat(3000),
                },
            ],
            dropped_attachments: 0,
        }
    }

    #[test]
    fn largest_attachment_index_prefers_first_of_equal_largest() {
        let attachments = vec![
            test_attachment("a.png", 5),
            test_attachment("b.png", 40),
            test_attachment("c.png", 40),
            test_attachment("d.png", 1),
        ];
        assert_eq!(largest_attachment_index(&attachments), Some(1));
        assert_eq!(largest_attachment_index(&[]), None);
    }

    fn test_attachment(name: &str, data_len: usize) -> BugReportApiAttachment {
        BugReportApiAttachment {
            name: name.to_owned(),
            mime: "image/png".to_owned(),
            data: "A".repeat(data_len),
        }
    }

    #[test]
    fn wire_budget_drops_attachments_largest_first_then_oldest_logs() {
        let trimmed = enforce_wire_budget(sample_payload(), 2_000).unwrap();
        assert_eq!(trimmed.dropped_attachments, 3);
        assert!(trimmed.attachments.is_empty());
        assert_eq!(trimmed.logs.len(), 1);
        assert_eq!(trimmed.logs[0].name, "new.log");
        assert_eq!(
            trimmed.screenshot.as_deref(),
            Some("data:image/png;base64,QQ==")
        );
        assert!(serde_json::to_vec(&trimmed).unwrap().len() <= 2_000);
    }

    #[test]
    fn wire_budget_spares_smaller_attachments_and_all_logs_when_possible() {
        let trimmed = enforce_wire_budget(sample_payload(), 5_000).unwrap();
        assert_eq!(trimmed.dropped_attachments, 2);
        let names: Vec<&str> = trimmed
            .attachments
            .iter()
            .map(|attachment| attachment.name.as_str())
            .collect();
        assert_eq!(names, ["a.png"]);
        assert_eq!(trimmed.logs.len(), 2);
        assert!(serde_json::to_vec(&trimmed).unwrap().len() <= 5_000);
    }

    #[test]
    fn wire_budget_output_is_deterministic() {
        let first = enforce_wire_budget(sample_payload(), 2_000).unwrap();
        let second = enforce_wire_budget(sample_payload(), 2_000).unwrap();
        assert_eq!(
            serde_json::to_vec(&first).unwrap(),
            serde_json::to_vec(&second).unwrap()
        );
    }

    #[test]
    fn collects_only_allowed_log_files_and_ignores_oversized() {
        let temp = tempfile::tempdir().unwrap();
        fs::write(temp.path().join("app.log"), b"ok").unwrap();
        fs::write(temp.path().join("runtime-trace.json"), b"{}").unwrap();
        fs::write(temp.path().join("binary.bin"), b"nope").unwrap();
        fs::create_dir(temp.path().join("nested.log")).unwrap();

        let mut files = Vec::new();
        collect_logs_from_dir(temp.path(), LogSource::App, &mut files);

        assert_eq!(files.len(), 2);
        let runtime = files
            .iter()
            .find(|f| f.name == "runtime-trace.json")
            .unwrap();
        assert_eq!(runtime.source, LogSource::Runtime);
        let app = files.iter().find(|f| f.name == "app.log").unwrap();
        assert_eq!(app.source, LogSource::App);
        assert_eq!(app.size, 2);
    }

    #[test]
    fn missing_log_directory_is_not_an_error() {
        let mut files = Vec::new();
        collect_logs_from_dir(
            Path::new("/definitely/not/here/koma-logs"),
            LogSource::App,
            &mut files,
        );
        assert!(files.is_empty());
    }

    #[test]
    fn downsample_half_averages_2x2_blocks() {
        let image = RawImage {
            width: 4,
            height: 2,
            rgba: vec![
                0, 0, 0, 255, 100, 100, 100, 255, 10, 20, 30, 255, 10, 20, 30, 255, //
                200, 200, 200, 255, 100, 100, 100, 255, 10, 20, 30, 255, 10, 20, 30, 255,
            ],
        };
        let half = image.downsample_half();
        assert_eq!((half.width, half.height), (2, 1));
        assert_eq!(&half.rgba[..4], &[100, 100, 100, 255]);
        assert_eq!(&half.rgba[4..8], &[10, 20, 30, 255]);
    }

    #[test]
    fn png_roundtrip_encodes_valid_image() {
        let image = RawImage {
            width: 2,
            height: 2,
            rgba: vec![255; 16],
        };
        let png = encode_png(&image).unwrap();
        assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");
    }
