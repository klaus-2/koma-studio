#[cfg(windows)]
pub fn families() -> Vec<String> {
    gdi::enumerate_with_gdi()
}

#[cfg(not(windows))]
pub fn families() -> Vec<String> {
    Vec::new()
}

#[cfg(windows)]
mod gdi {
    use std::collections::HashSet;

    use windows_sys::Win32::{
        Foundation::{LPARAM, TRUE},
        Graphics::Gdi::{DEFAULT_CHARSET, EnumFontFamiliesExW, LOGFONTW, TEXTMETRICW},
    };

    use crate::win32::ScreenDc;

    #[derive(Default)]
    struct FamilyAccumulator {
        seen: HashSet<String>,
        families: Vec<String>,
    }

    impl FamilyAccumulator {
        fn record(&mut self, family: String) {
            if self.seen.insert(family.to_lowercase()) {
                self.families.push(family);
            }
        }
    }

    unsafe extern "system" fn record_family(
        log_font: *const LOGFONTW,
        _text_metrics: *const TEXTMETRICW,
        _font_type: u32,
        accumulator: LPARAM,
    ) -> i32 {
        let accumulator = accumulator as *mut FamilyAccumulator;
        if log_font.is_null() || accumulator.is_null() {
            return TRUE;
        }

        // SAFETY: both pointers were just checked non-null. `log_font` is owned
        // by GDI for the duration of the call, and `accumulator` points at the
        // single `Box` created in `enumerate_with_gdi`, which stays alive until
        // after `EnumFontFamiliesExW` returns because that call is synchronous.
        let (face_name, accumulator) = unsafe { (&(*log_font).lfFaceName, &mut *accumulator) };

        if let Some(family) = decode_face_name(face_name) {
            accumulator.record(family);
        }

        TRUE
    }

    /// `lfFaceName` is a fixed 32-unit `LF_FACESIZE` buffer, so GDI truncates long families
    /// into it; the tail past the first NUL is uninitialised padding, not part of the name.
    fn decode_face_name(face_name: &[u16]) -> Option<String> {
        let end = face_name
            .iter()
            .position(|unit| *unit == 0)
            .unwrap_or(face_name.len());
        let family = String::from_utf16_lossy(&face_name[..end]);
        let family = family.trim();

        (!family.is_empty()).then(|| family.to_string())
    }

    pub(super) fn enumerate_with_gdi() -> Vec<String> {
        let Some(screen) = ScreenDc::acquire() else {
            return Vec::new();
        };

        let log_font = LOGFONTW {
            lfCharSet: DEFAULT_CHARSET,
            ..Default::default()
        };

        let accumulator = Box::into_raw(Box::new(FamilyAccumulator::default()));

        // SAFETY: `screen.handle()` is a live DC owned by `screen` for this whole call.
        // `accumulator` is the sole owner of the `Box` created above and is
        // passed as `LPARAM` only for the duration of this synchronous call,
        // which is the only place it is ever dereferenced (`record_family` runs
        // on this thread, inside this call frame).
        let enumerated = unsafe {
            EnumFontFamiliesExW(
                screen.handle(),
                &log_font,
                Some(record_family),
                accumulator as LPARAM,
                0,
            )
        };

        // SAFETY: reclaims the single `Box` handed to GDI above. It runs on both
        // outcomes of the call — success and failure — and no path between
        // `into_raw` and here returns, `?`s or panics, so the allocation is
        // reclaimed exactly once.
        let accumulator = unsafe { *Box::from_raw(accumulator) };

        if enumerated == 0 {
            return Vec::new();
        }

        accumulator.families
    }
}

#[cfg(test)]
mod tests {
    use super::families;

    #[cfg(windows)]
    #[test]
    fn gdi_reports_the_installed_families_of_this_machine() {
        let families = families();
        let is_style_instance = |name: &str| {
            let last_word = name
                .trim()
                .rsplit(char::is_whitespace)
                .next()
                .unwrap_or_default()
                .to_ascii_lowercase();
            matches!(last_word.as_str(), "bold" | "italic" | "regular")
        };

        println!(
            "system_fonts: GDI returned {} families on this machine",
            families.len()
        );
        println!(
            "system_fonts: GDI-only directional families present: {:?}",
            families
                .iter()
                .filter(|name| name.starts_with('@'))
                .take(4)
                .collect::<Vec<_>>()
        );

        assert!(
            !families.is_empty(),
            "EnumFontFamiliesExW returned nothing on a Windows box"
        );
        assert!(
            families.len() >= 60,
            "expected a full machine list, got {}: {families:?}",
            families.len()
        );
        assert!(
            families.iter().any(|family| family == "Arial"),
            "Arial missing from {families:?}"
        );
        assert!(
            families.iter().any(|family| family == "Segoe UI"),
            "Segoe UI missing from {families:?}"
        );

        let style_instances: Vec<&String> = families
            .iter()
            .filter(|name| is_style_instance(name))
            .collect();
        assert!(
            style_instances.is_empty(),
            "GDI returned style instances rather than families: {style_instances:?}"
        );

        let mut seen = std::collections::HashSet::new();
        let duplicates: Vec<&String> = families
            .iter()
            .filter(|name| !seen.insert(name.to_lowercase()))
            .collect();
        assert!(
            duplicates.is_empty(),
            "case-insensitive duplicates in the family list: {duplicates:?}"
        );

        let oversized: Vec<&String> = families
            .iter()
            .filter(|name| name.chars().count() > 31 || name.trim().is_empty())
            .collect();
        assert!(
            oversized.is_empty(),
            "names must fit lfFaceName (LF_FACESIZE - 1) and be non-empty: {oversized:?}"
        );
    }

    #[cfg(not(windows))]
    #[test]
    fn non_windows_reports_no_families() {
        assert!(families().is_empty());
    }
}
