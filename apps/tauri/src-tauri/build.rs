fn main() {
    println!("cargo:rerun-if-env-changed=KOMA_EMBEDDED_MINI_BACKEND");
    let embedded = match std::env::var("KOMA_EMBEDDED_MINI_BACKEND").as_deref() {
        Ok("0") | Ok("false") | Ok("FALSE") => "0",
        _ => "1",
    };
    println!("cargo:rustc-env=KOMA_EMBEDDED_MINI_BACKEND={embedded}");
    tauri_build::build()
}
