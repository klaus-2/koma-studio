const MAX_RETRY_ATTEMPTS = 3;
// Poll interval for the job snapshot from the mini-backend (the backend already
// throttles its own granularity; 1s is enough for multi-GB downloads).
const MODEL_JOB_POLL_INTERVAL_MS = 200;
const PARTIAL_FILE_NAME = "download.partial";
const MANIFEST_FILE_NAME = "manifest.json";
const EASYOCR_MODEL_ID = "easyocr";
const PORORO_MODEL_ID = "pororo";
const MANGA_OCR_MODEL_ID = "manga_ocr";
const PADDLE_OCR_MODEL_ID = "paddleocr";
const PADDLE_OCR_EN_MODEL_ID = "paddleocr_en_v5";
const PADDLE_OCR_LATIN_MODEL_ID = "paddleocr_latin_v5";
const PADDLE_OCR_CH_MODEL_ID = "paddleocr_ch_v5";
const MEIKI_OCR_MODEL_ID = "meiki_ocr";
const PADDLE_OCR_VL_MANGA_MODEL_ID = "paddleocr_vl_manga";
const GOT_OCR2_MODEL_ID = "got_ocr2";
const QWEN2_5_VL_3B_MODEL_ID = "qwen2_5_vl_3b";
const MANGALMM_MODEL_ID = "mangalmm";
const ROLMOCR_MODEL_ID = "rolmocr";
const GLM_OCR_ONNX_MODEL_ID = "glm_ocr_onnx";
const SUGOI_MODEL_ID = "sugoi_v4_ja_en_ct2";
const M2M100_MODEL_ID = "m2m100_1_2b_ct2";
const INPAINT_AOT_MODEL_ID = "aot";
const INPAINT_LAMA_MODEL_ID = "lama_manga";
const INPAINT_OPENCV_LAMA_MODEL_ID = "opencv_lama";
const INPAINT_LAMA_FP32_MODEL_ID = "lama_fp32";
const SEGMENT_BAKA_MODEL_ID = "baka_content_cc";
const FONT_RTDETR_MODEL_ID = "font_rtdetr_v2";
const FONT_RTDETR_FILE_NAME = "detector.onnx";
const ENHANCE_MODEL_FILE_NAME = "model.onnx";
const EASYOCR_DETECTION_FILE = "craft_mlt_25k.pth";
const EASYOCR_BUCKET_SPECS: Array<{
  bucket: string;
  recognitionFile: string;
  languages: string[];
}> = [
  { bucket: "en", recognitionFile: "english_g2.pth", languages: ["en"] },
  { bucket: "ko", recognitionFile: "korean_g2.pth", languages: ["ko"] },
  { bucket: "ja", recognitionFile: "japanese_g2.pth", languages: ["ja"] },
  { bucket: "ch_sim", recognitionFile: "chinese_sim.pth", languages: ["zh", "zh-cn"] },
  { bucket: "ch_tra", recognitionFile: "chinese.pth", languages: ["zh-tw"] },
  { bucket: "ru", recognitionFile: "cyrillic_g2.pth", languages: ["ru"] },
  { bucket: "latin", recognitionFile: "latin_g2.pth", languages: ["fr", "de", "nl", "es", "it", "pt", "tr", "pl", "vi", "id", "hu"] },
  { bucket: "th", recognitionFile: "thai_g1.pth", languages: ["th"] },
  { bucket: "ar", recognitionFile: "arabic_g1.pth", languages: ["ar"] },
];
const BACKEND_MANAGED_MODEL_IDS = new Set<string>([
  EASYOCR_MODEL_ID,
  PORORO_MODEL_ID,
  MANGA_OCR_MODEL_ID,
  PADDLE_OCR_MODEL_ID,
  PADDLE_OCR_EN_MODEL_ID,
  PADDLE_OCR_LATIN_MODEL_ID,
  PADDLE_OCR_CH_MODEL_ID,
  MEIKI_OCR_MODEL_ID,
  PADDLE_OCR_VL_MANGA_MODEL_ID,
  GOT_OCR2_MODEL_ID,
  QWEN2_5_VL_3B_MODEL_ID,
  MANGALMM_MODEL_ID,
  ROLMOCR_MODEL_ID,
  GLM_OCR_ONNX_MODEL_ID,
  "waifu2x_swin_unet_art_scan_2x",
  "waifu2x_swin_unet_art_scan_4x",
  "waifu2x_swin_unet_art_2x",
  SUGOI_MODEL_ID,
  M2M100_MODEL_ID,
  "opus-mt-ja-en",
  "opus-mt-zh-en",
  "nllb-200-3.3b",
  "nllb-200-600m-int8",
  "nllb-200-1.3b",
  "nllb-200-1.3b-int8-ct2",
  INPAINT_AOT_MODEL_ID,
  INPAINT_LAMA_MODEL_ID,
  INPAINT_OPENCV_LAMA_MODEL_ID,
  INPAINT_LAMA_FP32_MODEL_ID,
  SEGMENT_BAKA_MODEL_ID,
  "comic_text_detector",
]);

export {
  BACKEND_MANAGED_MODEL_IDS,
  EASYOCR_BUCKET_SPECS,
  EASYOCR_DETECTION_FILE,
  EASYOCR_MODEL_ID,
  ENHANCE_MODEL_FILE_NAME,
  FONT_RTDETR_FILE_NAME,
  FONT_RTDETR_MODEL_ID,
  GLM_OCR_ONNX_MODEL_ID,
  GOT_OCR2_MODEL_ID,
  INPAINT_AOT_MODEL_ID,
  INPAINT_LAMA_FP32_MODEL_ID,
  INPAINT_LAMA_MODEL_ID,
  INPAINT_OPENCV_LAMA_MODEL_ID,
  M2M100_MODEL_ID,
  MANGA_OCR_MODEL_ID,
  MANIFEST_FILE_NAME,
  MANGALMM_MODEL_ID,
  MAX_RETRY_ATTEMPTS,
  MEIKI_OCR_MODEL_ID,
  MODEL_JOB_POLL_INTERVAL_MS,
  PADDLE_OCR_CH_MODEL_ID,
  PADDLE_OCR_EN_MODEL_ID,
  PADDLE_OCR_LATIN_MODEL_ID,
  PADDLE_OCR_MODEL_ID,
  PADDLE_OCR_VL_MANGA_MODEL_ID,
  PARTIAL_FILE_NAME,
  PORORO_MODEL_ID,
  QWEN2_5_VL_3B_MODEL_ID,
  ROLMOCR_MODEL_ID,
  SEGMENT_BAKA_MODEL_ID,
  SUGOI_MODEL_ID,
};
