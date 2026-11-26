fn main() {
    println!("cargo:rerun-if-env-changed=KOMA_EMBEDDED_MINI_BACKEND");
    let embedded = match std::env::var("KOMA_EMBEDDED_MINI_BACKEND").as_deref() {
        Ok("1") | Ok("true") | Ok("TRUE") => "1",
        _ => "0",
    };
    println!("cargo:rustc-env=KOMA_EMBEDDED_MINI_BACKEND={embedded}");

    println!("cargo:rerun-if-changed=native-abi.json");
    let abi_version = std::fs::read_to_string("native-abi.json")
        .ok()
        .and_then(|raw| serde_json_or_extract_abi(&raw))
        .unwrap_or_else(|| "1".to_string());
    println!("cargo:rustc-env=KOMA_NATIVE_ABI_VERSION={abi_version}");

    tauri_build::build()
}

fn serde_json_or_extract_abi(raw: &str) -> Option<String> {
    let key = "\"nativeAbiVersion\"";
    let idx = raw.find(key)?;
    let after_colon = raw[idx + key.len()..].split(':').nth(1)?;
    let digits: String = after_colon
        .chars()
        .skip_while(|ch| ch.is_whitespace())
        .take_while(|ch| ch.is_ascii_digit())
        .collect();
    (!digits.is_empty()).then_some(digits)
}
