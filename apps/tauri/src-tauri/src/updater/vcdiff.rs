use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VcdiffApplyReport {
    pub supported: bool,
    pub message: String,
}

pub fn apply_vcdiff_placeholder() -> VcdiffApplyReport {
    VcdiffApplyReport {
        supported: false,
        message:
            "VCDIFF/xdelta3 for models is reserved for v2.1; the manifest already accepts modelDeltas."
                .to_string(),
    }
}
