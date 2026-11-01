/**
 * The data files the frozen backend reads next to its loader modules.
 *
 * A bundle that misses one of them dies on its first import: the loader is
 * imported at startup, so the whole local backend goes down — detection,
 * translation and every other feature with it — instead of the one model
 * that needed the file.
 *
 * The paths are relative to the bundle root and matched by suffix, because
 * the layout differs per platform (`_internal/` on Windows and Linux, a
 * bundle folder on macOS).
 *
 * `build-runtime-data-files.test.mjs` keeps this list in sync with the data
 * files the PyInstaller spec declares.
 */
export const REQUIRED_RUNTIME_DATA_FILES = ["models/manifests/model-assets.json"];
