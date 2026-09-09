// Tauri shell: registers the bridge (provider + auth adapter + i18n port) and
// delegates all UI to @koma/interface. Order matters: register must run
// before main (which renders and consumes the provider).
import "@koma/interface/lib/tauri/register";
import "@koma/interface/main";
