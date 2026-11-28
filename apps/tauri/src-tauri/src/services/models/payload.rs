use std::{fs, path::Path};

use crate::error::{AppError, AppResult};

use super::storage::{
    ENHANCE_MODEL_FILE_NAME, LEGACY_PARTIAL_FILE_NAME, MANIFEST_FILE_NAME, MAX_DIRECTORY_DEPTH,
    MAX_DIRECTORY_FILES,
};

const EASYOCR_MODEL_ID: &str = "easyocr";
const PORORO_MODEL_ID: &str = "pororo";
const MANGA_OCR_MODEL_ID: &str = "manga_ocr";
const PADDLE_OCR_MODEL_ID: &str = "paddleocr";
const PADDLE_OCR_EN_MODEL_ID: &str = "paddleocr_en_v5";
const PADDLE_OCR_LATIN_MODEL_ID: &str = "paddleocr_latin_v5";
const PADDLE_OCR_CH_MODEL_ID: &str = "paddleocr_ch_v5";
const MEIKI_OCR_MODEL_ID: &str = "meiki_ocr";
const PADDLE_OCR_VL_MANGA_MODEL_ID: &str = "paddleocr_vl_manga";
const PADDLE_OCR_VL_1_5_MODEL_ID: &str = "paddleocr_vl_1_5";
const GOT_OCR2_MODEL_ID: &str = "got_ocr2";
const QWEN2_5_VL_3B_MODEL_ID: &str = "qwen2_5_vl_3b";
const MANGALMM_MODEL_ID: &str = "mangalmm";
const ROLMOCR_MODEL_ID: &str = "rolmocr";
const GLM_OCR_ONNX_MODEL_ID: &str = "glm_ocr_onnx";
const SUGOI_MODEL_ID: &str = "sugoi_v4_ja_en_ct2";
const M2M100_MODEL_ID: &str = "m2m100_1_2b_ct2";
const VNTL_MODEL_ID: &str = "vntl_llama3_8b_v2";
const LFM2_MODEL_ID: &str = "lfm2_350m_enjp_mt";
const SAKURA_GALTRANSL_MODEL_ID: &str = "sakura_galtransl_7b_v3_7";
const SAKURA_1_5B_MODEL_ID: &str = "sakura_1_5b_qwen2_5_v1_0";
const HUNYUAN_MODEL_ID: &str = "hunyuan_7b_mt_v1_0";
const INPAINT_AOT_MODEL_ID: &str = "aot";
const INPAINT_LAMA_MODEL_ID: &str = "lama_manga";
const INPAINT_OPENCV_LAMA_MODEL_ID: &str = "opencv_lama";
const INPAINT_LAMA_FP32_MODEL_ID: &str = "lama_fp32";
const SEGMENT_BAKA_MODEL_ID: &str = "baka_content_cc";
const SEGMENT_CTD_MODEL_ID: &str = "ctd_text_seg";
const SEGMENT_COMIC_TEXT_MASK_MODEL_ID: &str = "comic_text_mask";
const COMIC_TEXT_DETECTOR_MODEL_ID: &str = "comic_text_detector";
const YOLO_BUBBLE_MODEL_ID: &str = "yolo_bubble";
const FONT_RTDETR_MODEL_ID: &str = "font_rtdetr_v2";
const PP_DOCLAYOUT_MODEL_ID: &str = "pp_doclayout_v3";
const FONT_RTDETR_FILE_NAME: &str = "detector.onnx";

pub fn is_installed_payload_present(model_id: &str, directory: &Path) -> AppResult<bool> {
    let has_files = |files: &[&str]| files.iter().all(|file| directory.join(file).is_file());
    let has_one = |file: &str| directory.join(file).is_file();

    Ok(match model_id {
        EASYOCR_MODEL_ID => has_any_payload_file(directory)?,
        PORORO_MODEL_ID => has_files(&["craft.pt", "brainocr.pt", "ocr-opt.txt"]),
        MANGA_OCR_MODEL_ID => has_files(&["encoder_model.onnx", "decoder_model.onnx", "vocab.txt"]),
        PADDLE_OCR_MODEL_ID => has_files(&[
            "ch_PP-OCRv5_mobile_det.onnx",
            "eslav_PP-OCRv5_rec_mobile_infer.onnx",
            "ppocrv5_eslav_dict.txt",
        ]),
        PADDLE_OCR_EN_MODEL_ID => has_files(&[
            "ch_PP-OCRv5_mobile_det.onnx",
            "en_PP-OCRv5_mobile_rec.onnx",
            "ppocrv5_en_dict.txt",
        ]),
        PADDLE_OCR_LATIN_MODEL_ID => has_files(&[
            "ch_PP-OCRv5_mobile_det.onnx",
            "latin_PP-OCRv5_rec_mobile_infer.onnx",
            "ppocrv5_latin_dict.txt",
        ]),
        PADDLE_OCR_CH_MODEL_ID => has_files(&[
            "ch_PP-OCRv5_mobile_det.onnx",
            "ch_PP-OCRv5_rec_mobile_infer.onnx",
            "ppocrv5_dict.txt",
        ]),
        MEIKI_OCR_MODEL_ID => has_files(&[
            "meiki.text.rec.v0.960x32.onnx",
            "meiki.text.rec.v0.vertical.32x480.onnx",
        ]),
        PADDLE_OCR_VL_MANGA_MODEL_ID => has_files(&[
            "config.json",
            "configuration_paddleocr_vl.py",
            "generation_config.json",
            "image_processing.py",
            "model.safetensors",
            "modeling_paddleocr_vl.py",
            "preprocessor_config.json",
            "processing_paddleocr_vl.py",
            "processor_config.json",
            "tokenizer.json",
            "tokenizer.model",
            "tokenizer_config.json",
        ]),
        PADDLE_OCR_VL_1_5_MODEL_ID => has_files(&[
            "added_tokens.json",
            "chat_template.jinja",
            "config.json",
            "configuration_paddleocr_vl.py",
            "generation_config.json",
            "image_processing_paddleocr_vl.py",
            "modeling_paddleocr_vl.py",
            "preprocessor_config.json",
            "processing_paddleocr_vl.py",
            "processor_config.json",
            "model.safetensors",
            "special_tokens_map.json",
            "tokenizer.json",
            "tokenizer.model",
            "tokenizer_config.json",
        ]),
        GOT_OCR2_MODEL_ID => has_files(&[
            "config.json",
            "generation_config.json",
            "model.safetensors",
            "preprocessor_config.json",
            "tokenizer.json",
            "tokenizer_config.json",
        ]),
        QWEN2_5_VL_3B_MODEL_ID => has_files(&[
            "config.json",
            "generation_config.json",
            "model-00001-of-00002.safetensors",
            "model-00002-of-00002.safetensors",
            "model.safetensors.index.json",
            "preprocessor_config.json",
            "tokenizer.json",
            "tokenizer_config.json",
            "vocab.json",
        ]),
        MANGALMM_MODEL_ID | ROLMOCR_MODEL_ID => has_files(&[
            "config.json",
            "generation_config.json",
            "model-00001-of-00004.safetensors",
            "model-00002-of-00004.safetensors",
            "model-00003-of-00004.safetensors",
            "model-00004-of-00004.safetensors",
            "model.safetensors.index.json",
            "preprocessor_config.json",
            "tokenizer.json",
            "tokenizer_config.json",
            "vocab.json",
        ]),
        GLM_OCR_ONNX_MODEL_ID => has_files(&[
            "config.json",
            "generation_config.json",
            "model.safetensors",
            "preprocessor_config.json",
            "tokenizer.json",
            "tokenizer_config.json",
        ]),
        SUGOI_MODEL_ID => has_files(&[
            "config.json",
            "model.bin",
            "source_vocabulary.json",
            "target_vocabulary.json",
            "spm/spm.ja.nopretok.model",
            "spm/spm.en.nopretok.model",
        ]),
        M2M100_MODEL_ID => has_files(&[
            "config.json",
            "model.bin",
            "sentencepiece.bpe.model",
            "shared_vocabulary.json",
            "vocab.json",
        ]),
        VNTL_MODEL_ID => has_one("vntl-llama3-8b-v2-hf-q8_0.gguf"),
        LFM2_MODEL_ID => has_one("LFM2-350M-ENJP-MT-Q4_0.gguf"),
        SAKURA_GALTRANSL_MODEL_ID => has_one("Sakura-Galtransl-7B-v3.7-IQ4_XS.gguf"),
        SAKURA_1_5B_MODEL_ID => has_one("sakura-1.5b-qwen2.5-v1.0-Q5KS.gguf"),
        HUNYUAN_MODEL_ID => has_one("Hunyuan-MT-7B-q4_k_m.gguf"),
        "opus-mt-ja-en" | "opus-mt-zh-en" => has_files(&[
            "config.json",
            "generation_config.json",
            "pytorch_model.bin",
            "source.spm",
            "target.spm",
            "tokenizer_config.json",
            "vocab.json",
        ]),
        "nllb-200-3.3b" => has_files(&[
            "config.json",
            "generation_config.json",
            "pytorch_model-00001-of-00003.bin",
            "pytorch_model-00002-of-00003.bin",
            "pytorch_model-00003-of-00003.bin",
            "pytorch_model.bin.index.json",
            "sentencepiece.bpe.model",
            "special_tokens_map.json",
            "tokenizer.json",
            "tokenizer_config.json",
        ]),
        "nllb-200-600m-int8" => has_files(&[
            "config.json",
            "model.bin",
            "sentencepiece.bpe.model",
            "shared_vocabulary.txt",
            "special_tokens_map.json",
            "tokenizer.json",
            "tokenizer_config.json",
        ]),
        "nllb-200-1.3b" => has_files(&[
            "config.json",
            "generation_config.json",
            "pytorch_model.bin",
            "sentencepiece.bpe.model",
            "special_tokens_map.json",
            "tokenizer.json",
            "tokenizer_config.json",
        ]),
        "nllb-200-1.3b-int8-ct2" => has_files(&[
            "config.json",
            "generation_config.json",
            "model.bin",
            "shared_vocabulary.json",
            "special_tokens_map.json",
            "tokenizer.json",
            "tokenizer_config.json",
        ]),
        INPAINT_AOT_MODEL_ID => has_one("aot.onnx"),
        INPAINT_LAMA_MODEL_ID => has_one("lama-manga-dynamic.onnx"),
        INPAINT_OPENCV_LAMA_MODEL_ID => has_one("inpainting_lama_2025jan.onnx"),
        INPAINT_LAMA_FP32_MODEL_ID => has_one("lama_fp32.onnx"),
        "waifu2x_swin_unet_art_scan_2x"
        | "waifu2x_swin_unet_art_scan_4x"
        | "waifu2x_swin_unet_art_2x"
        | "4xnomos2_hq_mosr"
        | "4xspankendata" => has_one(ENHANCE_MODEL_FILE_NAME),
        SEGMENT_BAKA_MODEL_ID => has_one("segmenter.meta"),
        SEGMENT_CTD_MODEL_ID => {
            has_one("comictextdetector.pt.onnx")
                || (has_one("segmenter.meta")
                    && directory.parent().is_some_and(|root| {
                        root.join(COMIC_TEXT_DETECTOR_MODEL_ID)
                            .join("comictextdetector.pt.onnx")
                            .is_file()
                    }))
                || directory.parent().is_some_and(|root| {
                    root.join(COMIC_TEXT_DETECTOR_MODEL_ID)
                        .join("comictextdetector.pt.onnx")
                        .is_file()
                })
        }
        SEGMENT_COMIC_TEXT_MASK_MODEL_ID => has_one(ENHANCE_MODEL_FILE_NAME),
        COMIC_TEXT_DETECTOR_MODEL_ID => has_one("comictextdetector.pt.onnx"),
        YOLO_BUBBLE_MODEL_ID => has_one("manga109_segmentation_bubble_1024.onnx"),
        FONT_RTDETR_MODEL_ID => has_one(FONT_RTDETR_FILE_NAME),
        PP_DOCLAYOUT_MODEL_ID => has_files(&[
            "config.json",
            "preprocessor_config.json",
            "model.safetensors",
        ]),
        "instruct_pix2pix" => has_files(&[
            "model_index.json",
            "unet/diffusion_pytorch_model.fp16.safetensors",
            "vae/diffusion_pytorch_model.fp16.safetensors",
            "text_encoder/model.fp16.safetensors",
        ]),
        "sdxl_instruct_pix2pix" => has_files(&[
            "model_index.json",
            "unet/diffusion_pytorch_model.safetensors",
            "vae/diffusion_pytorch_model.safetensors",
            "text_encoder/model.safetensors",
            "text_encoder_2/model.safetensors",
        ]),
        "flux2_klein_4b_gguf_q4" => has_files(&[
            "model_index.json",
            "gguf/flux-2-klein-4b-Q4_K_M.gguf",
            "vae/diffusion_pytorch_model.safetensors",
            "text_encoder/model-00001-of-00002.safetensors",
            "text_encoder/model-00002-of-00002.safetensors",
        ]),
        "flux2_klein_4b" => has_files(&[
            "model_index.json",
            "transformer/diffusion_pytorch_model.safetensors",
            "vae/diffusion_pytorch_model.safetensors",
            "text_encoder/model-00001-of-00002.safetensors",
            "text_encoder/model-00002-of-00002.safetensors",
        ]),
        "longcat_image_edit_turbo" => has_files(&[
            "model_index.json",
            "transformer/diffusion_pytorch_model.safetensors",
            "vae/diffusion_pytorch_model.safetensors",
            "text_encoder/model-00001-of-00005.safetensors",
            "text_encoder/model-00005-of-00005.safetensors",
        ]),
        "qwen_image_edit_2511_gguf_q4" => has_files(&[
            "model_index.json",
            "gguf/qwen-image-edit-2511-Q4_K_M.gguf",
            "vae/diffusion_pytorch_model.safetensors",
            "text_encoder/model-00001-of-00004.safetensors",
            "text_encoder/model-00004-of-00004.safetensors",
        ]),
        "qwen_image_edit_2511" | "firered_image_edit_1_1" => has_files(&[
            "model_index.json",
            "transformer/diffusion_pytorch_model-00001-of-00005.safetensors",
            "transformer/diffusion_pytorch_model-00005-of-00005.safetensors",
            "vae/diffusion_pytorch_model.safetensors",
            "text_encoder/model-00001-of-00004.safetensors",
            "text_encoder/model-00004-of-00004.safetensors",
        ]),
        _ => has_any_payload_file(directory)?,
    })
}

pub(super) fn has_any_payload_file(directory: &Path) -> AppResult<bool> {
    let mut pending = vec![(directory.to_path_buf(), 0_usize)];
    let mut visited = 0_usize;

    while let Some((current, depth)) = pending.pop() {
        if depth > MAX_DIRECTORY_DEPTH {
            return Err(AppError::Integrity(
                "Model directory exceeds the supported depth.".to_string(),
            ));
        }

        for entry in fs::read_dir(current)? {
            let entry = entry?;
            let file_type = entry.file_type()?;

            if file_type.is_symlink() {
                return Err(AppError::security(
                    "Symbolic links are not allowed inside model directories.",
                ));
            }

            if file_type.is_dir() {
                pending.push((entry.path(), depth + 1));
                continue;
            }

            if !file_type.is_file() {
                continue;
            }

            visited += 1;
            if visited > MAX_DIRECTORY_FILES {
                return Err(AppError::Integrity(
                    "Model directory contains too many files.".to_string(),
                ));
            }

            let name = entry.file_name().to_string_lossy().into_owned();
            if name != MANIFEST_FILE_NAME && !name.ends_with(".part") {
                return Ok(true);
            }
        }
    }

    Ok(false)
}

pub(super) fn contains_partial_file(directory: &Path) -> AppResult<bool> {
    if !directory.exists() {
        return Ok(false);
    }

    if directory.join(LEGACY_PARTIAL_FILE_NAME).is_file() {
        return Ok(true);
    }

    let mut pending = vec![(directory.to_path_buf(), 0_usize)];

    while let Some((current, depth)) = pending.pop() {
        if depth > MAX_DIRECTORY_DEPTH {
            return Err(AppError::Integrity(
                "Model directory exceeds the supported depth.".to_string(),
            ));
        }

        for entry in fs::read_dir(current)? {
            let entry = entry?;
            let file_type = entry.file_type()?;

            if file_type.is_symlink() {
                return Err(AppError::security(
                    "Symbolic links are not allowed inside model directories.",
                ));
            }

            if file_type.is_dir() {
                pending.push((entry.path(), depth + 1));
            } else if file_type.is_file()
                && entry
                    .file_name()
                    .to_string_lossy()
                    .to_ascii_lowercase()
                    .ends_with(".part")
            {
                return Ok(true);
            }
        }
    }

    Ok(false)
}
