//! Tests for the desktop command layer.
//! Lives in its own file so desktop.rs stays under the 1000-line audit limit.

    use super::*;
    use std::{collections::HashMap, fs, path::PathBuf};

    use super::config_sources::{
        load_env_documents, load_runtime_config_documents, read_config_document, ConfigLocations,
        ConfigSources, UpdateChannel,
    };
    use super::env_document::{parse_env_document, parse_env_line};
    use super::paths::ancestor_dirs;
    use super::resolved_config::ResolvedDesktopConfig;
    use super::runtime_artifacts_url::{
        default_runtime_artifacts_url, normalize_runtime_artifacts_url,
    };
    use super::url_validation::normalize_loopback_url;

    fn sources(
        runtime: Vec<serde_json::Map<String, serde_json::Value>>,
        envs: Vec<HashMap<String, String>>,
        channel: UpdateChannel,
    ) -> ConfigSources {
        ConfigSources {
            process_values: HashMap::new(),
            runtime_config_documents: runtime,
            env_documents: envs,
            channel,
        }
    }

    fn json_doc(pairs: &[(&str, &str)]) -> serde_json::Map<String, serde_json::Value> {
        pairs
            .iter()
            .map(|(k, v)| ((*k).to_owned(), serde_json::Value::from(*v)))
            .collect()
    }

    fn env_doc(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs
            .iter()
            .map(|(k, v)| ((*k).to_owned(), (*v).to_owned()))
            .collect()
    }

    #[test]
    fn thread_override_write_clamps_and_uses_camel_case_keys() {
        let temp = tempfile::tempdir().expect("tempdir");
        let payload = MiniBackendThreadOverridePayload {
            intra_op_threads: Some(500),
            inter_op_threads: Some(0),
            engine_idle_timeout_seconds: Some(-1),
            working_resolution_megapixels: Some(100.0),
            working_resolution_ocr_clean: Some(true),
        };

        write_mini_backend_thread_override_at(temp.path(), &payload)
            .expect("write override");
        let raw = std::fs::read_to_string(
            temp.path()
                .join(crate::sidecar::mini_backend::MINI_BACKEND_THREAD_OVERRIDE_FILE),
        )
        .expect("read override");
        assert_eq!(
            raw,
            r#"{"intraOpThreads":64,"interOpThreads":null,"engineIdleTimeoutSeconds":0,"workingResolutionMegapixels":64.0,"workingResolutionOcrClean":true}"#
        );

        // A second write replaces the file on platforms where rename fails
        // onto an existing path (Windows).
        let second = MiniBackendThreadOverridePayload {
            intra_op_threads: Some(4),
            inter_op_threads: Some(2),
            engine_idle_timeout_seconds: Some(600),
            working_resolution_megapixels: Some(24.0),
            working_resolution_ocr_clean: Some(false),
        };
        write_mini_backend_thread_override_at(temp.path(), &second)
            .expect("rewrite override");
        let raw = std::fs::read_to_string(
            temp.path()
                .join(crate::sidecar::mini_backend::MINI_BACKEND_THREAD_OVERRIDE_FILE),
        )
        .expect("read override");
        assert_eq!(
            raw,
            r#"{"intraOpThreads":4,"interOpThreads":2,"engineIdleTimeoutSeconds":600,"workingResolutionMegapixels":24.0,"workingResolutionOcrClean":false}"#
        );
    }

    fn command_fn_name_after_rename(source: &str) -> Option<String> {
        let fn_index = source.find("fn ")?;
        let after_fn = &source[fn_index + 3..];
        let name: String = after_fn
            .chars()
            .take_while(|character| character.is_ascii_alphanumeric() || *character == '_')
            .collect();
        if name.is_empty() {
            None
        } else {
            Some(name)
        }
    }

    #[test]
    fn runtime_channels_are_declared_and_registered() {
        let desktop_source = include_str!("desktop.rs");
        let profiles_source = include_str!("../runtime/profiles/mod.rs");
        let lib_source = include_str!("../lib.rs");
        let command_sources = format!("{desktop_source}\n{profiles_source}");

        // The `runtime` group of packages/types/src/desktop-api.ts.
        let runtime_channels = [
            "desktop:get-runtime-config",
            "desktop:get-mini-backend-runtime-state",
            "desktop:list-mini-backend-runtime-artifacts",
            "desktop:install-recommended-mini-backend-runtime",
            "desktop:install-mini-backend-runtime-profile",
            "desktop:runtime:cancel-install",
            "desktop:reset-local-settings",
            "desktop:restart-app",
            "desktop:mini-backend:set-thread-override",
        ];
        for channel in runtime_channels {
            let marker = format!("rename = \"{channel}\"");
            let attr_index = command_sources.find(&marker).unwrap_or_else(|| {
                panic!("runtime channel {channel} must be declared via #[tauri::command(rename = \"{channel}\")]")
            });
            let tail = &command_sources[attr_index + marker.len()..];
            let fn_name = command_fn_name_after_rename(tail)
                .unwrap_or_else(|| panic!("a command fn must follow the {channel} rename attribute"));
            assert!(
                lib_source.contains(&format!("::{fn_name},")),
                "the {channel} command fn `{fn_name}` must be registered in lib.rs"
            );
        }
    }

    #[test]
    fn external_url_requires_https_allowed_host_and_standard_port() {
        let hosts = HashSet::from(["api.example.com".to_owned()]);

        assert!(validate_external_url("https://github.com/koma", &hosts).is_ok());
        assert!(validate_external_url("https://sub.github.com/koma", &hosts).is_ok());
        assert!(validate_external_url("https://api.example.com/pay", &hosts).is_ok());
        assert!(matches!(
            validate_external_url("http://github.com/koma", &hosts),
            Err(DesktopError::InsecureScheme)
        ));
        assert!(matches!(
            validate_external_url("https://evil.example.net", &hosts),
            Err(DesktopError::HostNotAllowed)
        ));
        assert!(matches!(
            validate_external_url("https://evilgithub.com", &hosts),
            Err(DesktopError::HostNotAllowed)
        ));
        assert!(matches!(
            validate_external_url("https://user:pw@github.com", &hosts),
            Err(DesktopError::EmbeddedCredentials)
        ));
        assert!(matches!(
            validate_external_url("   ", &hosts),
            Err(DesktopError::MissingUrl)
        ));
    }

    #[test]
    fn external_url_rejects_nonstandard_ports_and_ip_literals() {
        let hosts = HashSet::new();

        assert!(matches!(
            validate_external_url("https://github.com:8443", &hosts),
            Err(DesktopError::PortNotAllowed)
        ));

        assert!(matches!(
            validate_external_url("https://127.0.0.1", &hosts),
            Err(DesktopError::HostNotAllowed)
        ));
    }

    #[test]
    fn community_url_uses_the_static_allowlist() {
        assert!(validate_community_url("https://discord.gg/koma").is_ok());
        assert!(matches!(
            validate_community_url("https://any-public-site.example/x"),
            Err(DesktopError::HostNotAllowed)
        ));
        assert!(matches!(
            validate_community_url("http://discord.gg/koma"),
            Err(DesktopError::InsecureScheme)
        ));
        assert!(matches!(
            validate_community_url("https://localhost/admin"),
            Err(DesktopError::HostNotAllowed)
        ));
        assert!(matches!(
            validate_community_url("https://10.0.0.1/"),
            Err(DesktopError::HostNotAllowed)
        ));
    }

    #[test]
    fn error_serializes_as_structured_code() {
        let value = serde_json::to_value(DesktopError::HostNotAllowed).unwrap();

        assert_eq!(
            value,
            serde_json::json!({
                "code": "host_not_allowed"
            })
        );
    }

    #[test]
    fn loopback_url_rejects_remote_hosts_and_credentials() {
        for raw in [
            "http://example.com:8001",
            "http://192.168.1.10:8001",
            "http://user:password@127.0.0.1:8001",
            "file:///tmp/backend",
            "http://127.0.0.1:8001?token=value",
            "http://127.0.0.1:8001#fragment",
        ] {
            assert!(parse_loopback_url(raw).is_err(), "{raw}");
        }
    }

    #[test]
    fn loopback_url_accepts_ipv4_ipv6_and_normalizes_localhost() {
        assert!(parse_loopback_url("http://127.0.0.1:8001").is_ok());
        assert!(parse_loopback_url("http://[::1]:8001").is_ok());

        let localhost = parse_loopback_url("http://localhost:8001").unwrap();
        assert_eq!(localhost.host_str(), Some("127.0.0.1"));
    }

    #[test]
    fn reset_local_settings_removes_known_files() {
        let temp = tempfile::tempdir().unwrap();
        fs::create_dir_all(temp.path().join(SECURE_STORE_DIR)).unwrap();
        fs::write(temp.path().join(IDENTITY_CACHE_FILE), "{}").unwrap();
        fs::write(temp.path().join(RUNTIME_SELECTION_FILE), "{}").unwrap();
        fs::write(
            temp.path().join(crate::sidecar::mini_backend::MINI_BACKEND_THREAD_OVERRIDE_FILE),
            "{}",
        )
        .unwrap();

        let result = reset_local_settings_at(temp.path()).unwrap();

        assert!(result.cleared);
        assert_eq!(result.cleared_paths.len(), 4);
        assert!(!temp.path().join(SECURE_STORE_DIR).exists());
        assert!(!temp.path().join(IDENTITY_CACHE_FILE).exists());
        assert!(!temp.path().join(RUNTIME_SELECTION_FILE).exists());
        assert!(
            !temp
                .path()
                .join(crate::sidecar::mini_backend::MINI_BACKEND_THREAD_OVERRIDE_FILE)
                .exists()
        );
    }

    #[test]
    fn reset_local_settings_reports_only_removed_entries() {
        let temp = tempfile::tempdir().unwrap();
        fs::write(temp.path().join(IDENTITY_CACHE_FILE), "{}").unwrap();

        let result = reset_local_settings_at(temp.path()).unwrap();

        assert!(result.cleared);
        assert_eq!(result.cleared_paths.len(), 1);
        assert!(result.cleared_paths[0].ends_with(IDENTITY_CACHE_FILE));
    }

    #[test]
    fn normalize_loopback_rewrites_localhost_and_defaults_on_invalid() {
        assert_eq!(
            normalize_loopback_url("http://localhost:8001/"),
            "http://127.0.0.1:8001"
        );
        assert_eq!(
            normalize_loopback_url("http://example.com/"),
            DEFAULT_LOCAL_API_URL
        );
    }

    #[test]
    fn resolves_runtime_artifacts_base_url_from_generic_update_server_urls() {
        assert_eq!(
            normalize_runtime_artifacts_url(
                "https://api.koma-studio.site/updates/",
                UpdateChannel::Beta
            ),
            "https://api.koma-studio.site/updates/beta/"
        );
        assert_eq!(
            normalize_runtime_artifacts_url(
                "https://api.koma-studio.site/updates/stable/",
                UpdateChannel::Beta
            ),
            "https://api.koma-studio.site/updates/beta/"
        );
        assert_eq!(
            normalize_runtime_artifacts_url(
                "https://api.koma-studio.site/updates/beta/mini-backend-artifacts/latest.json",
                UpdateChannel::Beta
            ),
            "https://api.koma-studio.site/updates/beta/mini-backend-artifacts/latest.json"
        );
        assert_eq!(
            normalize_runtime_artifacts_url(
                "https://cdn.example.com/x/mini-backend-artifacts/",
                UpdateChannel::Stable
            ),
            "https://cdn.example.com/x/mini-backend-artifacts/"
        );
        // Regression: a path ending in the segment without a trailing slash
        // must not get a duplicate channel segment.
        assert_eq!(
            normalize_runtime_artifacts_url(
                "https://cdn.example.com/x/mini-backend-artifacts",
                UpdateChannel::Stable
            ),
            "https://cdn.example.com/x/mini-backend-artifacts/"
        );
        assert_eq!(
            normalize_runtime_artifacts_url("https://cdn.example.com", UpdateChannel::Stable),
            "https://cdn.example.com/stable/"
        );
        // GitHub release assets are flat: the channel must not be appended.
        assert_eq!(
            normalize_runtime_artifacts_url(
                "https://github.com/klaus-2/koma-studio/releases/latest/download",
                UpdateChannel::Stable
            ),
            "https://github.com/klaus-2/koma-studio/releases/latest/download/"
        );
        assert_eq!(
            normalize_runtime_artifacts_url(
                "https://github.com/klaus-2/koma-studio/releases/download/runtime-v1.2.0/",
                UpdateChannel::Beta
            ),
            "https://github.com/klaus-2/koma-studio/releases/download/runtime-v1.2.0/"
        );
        assert_eq!(
            normalize_runtime_artifacts_url("not a url", UpdateChannel::Beta),
            default_runtime_artifacts_url()
        );
    }

    #[test]
    fn defaults_to_the_github_runtime_feed() {
        let expected = "https://github.com/klaus-2/koma-studio/releases/latest/download/";
        assert_eq!(default_runtime_artifacts_url(), expected);
        assert_eq!(UpdateChannel::from_version("1.2.3"), UpdateChannel::Stable);
        assert_eq!(
            UpdateChannel::from_version("1.2.3-beta.4"),
            UpdateChannel::Beta
        );
        assert_eq!(
            UpdateChannel::from_version("1.2.3+build.9"),
            UpdateChannel::Stable
        );
    }

    #[tokio::test]
    async fn local_backend_healthcheck_returns_false_for_closed_port() {
        assert!(!check_local_backend_health("http://127.0.0.1:9").await);
    }

    #[test]
    fn env_document_last_duplicate_key_wins() {
        let document = parse_env_document(
            "# comment\nVITE_AUTH_API_URL=http://localhost:3001\nVITE_AUTH_API_URL=https://auth.koma-studio.site\n",
        );
        assert_eq!(
            document.get("VITE_AUTH_API_URL").map(String::as_str),
            Some("https://auth.koma-studio.site")
        );
    }

    #[test]
    fn env_document_supports_export_prefix_quotes_and_inline_comments() {
        let document = parse_env_document(concat!(
            "export VITE_AUTH_API_URL=\"https://auth.example.test\"\n",
            "VITE_LOCAL_API_URL='https://single.example.test' # trailing\n",
            "UPDATE_SERVER_URL=https://plain.example.test # inline comment\n",
            "VITE_PROJECT_BUG_URL=https://bug.example.test/abc#def\n",
            "JWT_SECRET=should-never-be-loaded\n",
        ));

        assert_eq!(
            document.get("VITE_AUTH_API_URL").map(String::as_str),
            Some("https://auth.example.test")
        );
        assert_eq!(
            document.get("VITE_LOCAL_API_URL").map(String::as_str),
            Some("https://single.example.test")
        );
        assert_eq!(
            document.get("UPDATE_SERVER_URL").map(String::as_str),
            Some("https://plain.example.test")
        );
        assert_eq!(
            document.get("VITE_PROJECT_BUG_URL").map(String::as_str),
            Some("https://bug.example.test/abc#def")
        );
        assert!(!document.contains_key("JWT_SECRET"));
    }

    #[test]
    fn env_parser_rejects_unterminated_quoted_values() {
        assert_eq!(
            parse_env_line("VITE_AUTH_API_URL=\"https://example.com"),
            None
        );
    }

    #[test]
    fn process_configuration_is_a_snapshot() {
        let mut resolved = sources(
            vec![json_doc(&[(
                "VITE_AUTH_API_URL",
                "https://json.example.com",
            )])],
            Vec::new(),
            UpdateChannel::Stable,
        );

        resolved.process_values.insert(
            "VITE_AUTH_API_URL".to_owned(),
            "https://process.example.com".to_owned(),
        );

        assert_eq!(
            resolved.resolve("VITE_AUTH_API_URL").as_deref(),
            Some("https://process.example.com")
        );
    }

    #[test]
    fn non_public_keys_are_never_resolved() {
        let resolved = sources(
            vec![json_doc(&[("JWT_SECRET", "leak")])],
            vec![env_doc(&[("SOME_API_KEY", "leak")])],
            UpdateChannel::Stable,
        );

        assert_eq!(resolved.resolve("JWT_SECRET"), None);
        assert_eq!(resolved.resolve("SOME_API_KEY"), None);
    }

    #[test]
    fn runtime_config_loader_drops_non_public_keys() {
        let temp = tempfile::tempdir().unwrap();
        let config_path = temp.path().join(RUNTIME_CONFIG_FILE);
        fs::write(
            &config_path,
            r#"{"JWT_SECRET":"nope","VITE_AUTH_API_URL":"https://auth.example.test"}"#,
        )
        .unwrap();

        let documents = load_runtime_config_documents(&[config_path]);

        assert!(documents[0].get("JWT_SECRET").is_none());
        assert!(documents[0].get("VITE_AUTH_API_URL").is_some());
    }

    #[test]
    fn env_documents_are_loaded_from_disk_in_candidate_order() {
        let temp = tempfile::tempdir().unwrap();
        let first = temp.path().join(".env.local");
        let second = temp.path().join(".env");
        fs::write(&first, "VITE_AUTH_API_URL=http://first.example.test\n").unwrap();
        fs::write(
            &second,
            "VITE_AUTH_API_URL=http://second.example.test\nVITE_LOCAL_API_URL=http://only-second.example.test\n",
        )
        .unwrap();

        let documents = load_env_documents(&[first, temp.path().join("missing"), second]);
        let resolved = sources(Vec::new(), documents, UpdateChannel::Stable);

        assert_eq!(
            resolved.resolve("VITE_AUTH_API_URL").as_deref(),
            Some("http://first.example.test")
        );
        assert_eq!(
            resolved.resolve("VITE_LOCAL_API_URL").as_deref(),
            Some("http://only-second.example.test")
        );
    }

    #[test]
    fn oversized_config_documents_are_rejected() {
        let temp = tempfile::tempdir().unwrap();
        let config_path = temp.path().join(RUNTIME_CONFIG_FILE);
        fs::write(&config_path, "x".repeat(MAX_CONFIG_FILE_BYTES as usize + 1)).unwrap();

        assert!(read_config_document(&config_path).is_err());
    }

    #[test]
    fn runtime_config_takes_precedence_over_env_files() {
        let temp = tempfile::tempdir().unwrap();
        let config_path = temp.path().join(RUNTIME_CONFIG_FILE);
        fs::write(
            &config_path,
            r#"{"VITE_AUTH_API_URL":"https://from-json.example.test","VITE_LOCAL_API_URL":"  "}"#,
        )
        .unwrap();

        let resolved = sources(
            load_runtime_config_documents(&[config_path, temp.path().join("absent.json")]),
            vec![env_doc(&[
                ("VITE_AUTH_API_URL", "https://from-env.example.test"),
                ("VITE_LOCAL_API_URL", "https://from-env-blank.example.test"),
            ])],
            UpdateChannel::Stable,
        );

        assert_eq!(
            resolved.resolve("VITE_AUTH_API_URL").as_deref(),
            Some("https://from-json.example.test")
        );
        assert_eq!(
            resolved.resolve("VITE_LOCAL_API_URL").as_deref(),
            Some("https://from-env-blank.example.test")
        );
    }

    #[test]
    fn invalid_runtime_config_json_is_ignored() {
        let temp = tempfile::tempdir().unwrap();
        let config_path = temp.path().join(RUNTIME_CONFIG_FILE);
        fs::write(&config_path, "{ not json").unwrap();

        assert!(load_runtime_config_documents(&[config_path]).is_empty());
    }

    #[test]
    fn resolved_config_builds_allowlist_and_normalizes_loopback() {
        let resolved = ResolvedDesktopConfig::from_sources(sources(
            vec![json_doc(&[
                ("VITE_AUTH_API_URL", "https://auth.koma-studio.site"),
                ("VITE_LOCAL_API_URL", "http://localhost:8001/"),
                ("VITE_PROJECT_WEBSITE_URL", "https://koma-studio.site/"),
            ])],
            Vec::new(),
            UpdateChannel::Beta,
        ));

        assert_eq!(resolved.runtime.local_api_url, "http://127.0.0.1:8001");
        assert_eq!(
            resolved.runtime.runtime_artifacts_url,
            "https://github.com/klaus-2/koma-studio/releases/latest/download/"
        );
        assert!(resolved
            .allowed_external_hosts
            .contains("auth.koma-studio.site"));
        assert!(resolved
            .allowed_external_hosts
            .contains("koma-studio.site"));
        assert!(validate_external_url(
            "https://koma-studio.site/docs",
            &resolved.allowed_external_hosts
        )
        .is_ok());
    }

    #[test]
    fn runtime_config_candidates_are_resource_only_in_release() {
        let locations = ConfigLocations {
            current_dir: Some(PathBuf::from("/app")),
            exe_dir: Some(PathBuf::from("/app/bin")),
            resource_dir: Some(PathBuf::from("/app/res")),
        };

        // The compile-time mode decides; both branches must stay absolute
        // resource-scoped or include the legacy dev layout respectively.
        let candidates = locations.runtime_config_candidates();
        assert!(!candidates.is_empty());
        if cfg!(debug_assertions) {
            assert!(candidates.contains(&PathBuf::from("/app").join(RUNTIME_CONFIG_FILE)));
        } else {
            assert_eq!(
                candidates,
                vec![PathBuf::from("/app/res").join(RUNTIME_CONFIG_FILE)]
            );
        }
    }

    #[test]
    fn locale_preferences_normalize_dedupe_and_fallback() {
        let prefs = build_locale_preferences(["en_US.UTF-8", "en-US", "pt_BR@latin", "C"]);
        assert_eq!(prefs.app_locale, "en-US");
        assert_eq!(prefs.system_locales, vec!["en-US", "pt-BR"]);

        let empty = build_locale_preferences(["C", "POSIX", ""]);
        assert_eq!(empty.app_locale, DEFAULT_APP_LOCALE);
        assert_eq!(empty.system_locales, vec![DEFAULT_APP_LOCALE]);
    }

    #[test]
    fn host_suffix_matching_is_boundary_aware() {
        assert!(host_matches_suffix("github.com", "github.com"));
        assert!(host_matches_suffix("api.github.com", "github.com"));
        assert!(!host_matches_suffix("evilgithub.com", "github.com"));
        assert!(!host_matches_suffix("github.com.evil", "github.com"));
    }

    #[test]
    fn ancestor_dirs_respects_depth() {
        let dirs = ancestor_dirs(Path::new("/a/b/c/d"), 2);
        assert_eq!(
            dirs,
            vec![PathBuf::from("/a/b/c/d"), PathBuf::from("/a/b/c")]
        );
    }
