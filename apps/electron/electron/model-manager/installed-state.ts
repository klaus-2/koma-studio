import fs from "node:fs";
import path from "node:path";

import {
  EASYOCR_BUCKET_SPECS,
  EASYOCR_DETECTION_FILE,
  EASYOCR_MODEL_ID,
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
  MEIKI_OCR_MODEL_ID,
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
} from "./constants.ts";
import { sanitizeModelId } from "./validation.ts";

const hasAnyPayloadFile = (modelDir: string): boolean => {
  const walk = (targetPath: string): boolean => {
    if (!fs.existsSync(targetPath)) {
      return false;
    }

    const stat = fs.statSync(targetPath);
    if (stat.isFile()) {
      const basename = path.basename(targetPath);
      return basename !== MANIFEST_FILE_NAME && basename !== PARTIAL_FILE_NAME;
    }

    if (!stat.isDirectory()) {
      return false;
    }

    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
      if (walk(path.join(targetPath, entry.name))) {
        return true;
      }
    }

    return false;
  };

  return walk(modelDir);
};

const isInstalledPayloadPresent = (modelId: string, modelDir: string): boolean => {
  const normalizedModelId = sanitizeModelId(modelId);
  const hasRequiredFiles = (requiredFiles: string[]): boolean =>
    requiredFiles.every((fileName) => fs.existsSync(path.join(modelDir, fileName)));

  if (normalizedModelId === EASYOCR_MODEL_ID || normalizedModelId === PORORO_MODEL_ID) {
    return hasAnyPayloadFile(modelDir);
  }

  if (normalizedModelId === MANGA_OCR_MODEL_ID) {
    const requiredFiles = ["encoder_model.onnx", "decoder_model.onnx", "vocab.txt"];
    return requiredFiles.every((fileName) => fs.existsSync(path.join(modelDir, fileName)));
  }

  if (normalizedModelId === PADDLE_OCR_MODEL_ID) {
    const requiredFiles = [
      "ch_PP-OCRv5_mobile_det.onnx",
      "eslav_PP-OCRv5_rec_mobile_infer.onnx",
      "ppocrv5_eslav_dict.txt",
    ];
    return requiredFiles.every((fileName) => fs.existsSync(path.join(modelDir, fileName)));
  }

  if (normalizedModelId === PADDLE_OCR_EN_MODEL_ID) {
    const requiredFiles = [
      "ch_PP-OCRv5_mobile_det.onnx",
      "en_PP-OCRv5_mobile_rec.onnx",
      "ppocrv5_en_dict.txt",
    ];
    return requiredFiles.every((fileName) => fs.existsSync(path.join(modelDir, fileName)));
  }

  if (normalizedModelId === PADDLE_OCR_LATIN_MODEL_ID) {
    const requiredFiles = [
      "ch_PP-OCRv5_mobile_det.onnx",
      "latin_PP-OCRv5_rec_mobile_infer.onnx",
      "ppocrv5_latin_dict.txt",
    ];
    return requiredFiles.every((fileName) => fs.existsSync(path.join(modelDir, fileName)));
  }

  if (normalizedModelId === PADDLE_OCR_CH_MODEL_ID) {
    const requiredFiles = [
      "ch_PP-OCRv5_mobile_det.onnx",
      "ch_PP-OCRv5_rec_mobile_infer.onnx",
      "ppocrv5_dict.txt",
    ];
    return hasRequiredFiles(requiredFiles);
  }

  if (normalizedModelId === MEIKI_OCR_MODEL_ID) {
    return hasRequiredFiles([
      "meiki.text.rec.v0.960x32.onnx",
      "meiki.text.rec.v0.vertical.32x480.onnx",
    ]);
  }

  if (normalizedModelId === PADDLE_OCR_VL_MANGA_MODEL_ID) {
    return hasRequiredFiles([
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
    ]);
  }

  if (normalizedModelId === GOT_OCR2_MODEL_ID) {
    return hasRequiredFiles([
      "config.json",
      "generation_config.json",
      "model.safetensors",
      "preprocessor_config.json",
      "tokenizer.json",
      "tokenizer_config.json",
    ]);
  }

  if (normalizedModelId === QWEN2_5_VL_3B_MODEL_ID) {
    return hasRequiredFiles([
      "config.json",
      "generation_config.json",
      "model-00001-of-00002.safetensors",
      "model-00002-of-00002.safetensors",
      "model.safetensors.index.json",
      "preprocessor_config.json",
      "tokenizer.json",
      "tokenizer_config.json",
      "vocab.json",
    ]);
  }

  if (normalizedModelId === MANGALMM_MODEL_ID || normalizedModelId === ROLMOCR_MODEL_ID) {
    return hasRequiredFiles([
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
    ]);
  }

  if (normalizedModelId === GLM_OCR_ONNX_MODEL_ID) {
    return hasRequiredFiles([
      "config.json",
      "generation_config.json",
      "model.safetensors",
      "preprocessor_config.json",
      "tokenizer.json",
      "tokenizer_config.json",
    ]);
  }

  if (normalizedModelId === SUGOI_MODEL_ID) {
    return hasRequiredFiles([
      "config.json",
      "model.bin",
      "source_vocabulary.json",
      "target_vocabulary.json",
      "spm/spm.ja.nopretok.model",
      "spm/spm.en.nopretok.model",
    ]);
  }

  if (normalizedModelId === M2M100_MODEL_ID) {
    return hasRequiredFiles([
      "config.json",
      "model.bin",
      "sentencepiece.bpe.model",
      "shared_vocabulary.json",
      "vocab.json",
    ]);
  }

  if (normalizedModelId === INPAINT_AOT_MODEL_ID) {
    return fs.existsSync(path.join(modelDir, "aot.onnx"));
  }

  if (normalizedModelId === INPAINT_LAMA_MODEL_ID) {
    return fs.existsSync(path.join(modelDir, "lama-manga-dynamic.onnx"));
  }

  if (normalizedModelId === INPAINT_OPENCV_LAMA_MODEL_ID) {
    return fs.existsSync(path.join(modelDir, "inpainting_lama_2025jan.onnx"));
  }

  if (normalizedModelId === INPAINT_LAMA_FP32_MODEL_ID) {
    return fs.existsSync(path.join(modelDir, "lama_fp32.onnx"));
  }

  if (
    normalizedModelId === "waifu2x_swin_unet_art_scan_2x" ||
    normalizedModelId === "waifu2x_swin_unet_art_scan_4x" ||
    normalizedModelId === "waifu2x_swin_unet_art_2x" ||
    normalizedModelId === "4xnomos2_hq_mosr" ||
    normalizedModelId === "4xspankendata"
  ) {
    return fs.existsSync(path.join(modelDir, "model.onnx"));
  }

  if (normalizedModelId === SEGMENT_BAKA_MODEL_ID) {
    return fs.existsSync(path.join(modelDir, "segmenter.meta"));
  }

  if (normalizedModelId === "ctd_text_seg") {
    const siblingDetector = path.join(path.dirname(modelDir), "comic_text_detector", "comictextdetector.pt.onnx");
    return (
      fs.existsSync(path.join(modelDir, "comictextdetector.pt.onnx")) ||
      fs.existsSync(siblingDetector)
    );
  }

  if (normalizedModelId === "comic_text_mask") {
    return fs.existsSync(path.join(modelDir, "model.onnx"));
  }

  if (normalizedModelId === "comic_text_detector") {
    return fs.existsSync(path.join(modelDir, "comictextdetector.pt.onnx"));
  }

  if (normalizedModelId === "yolo_bubble") {
    return fs.existsSync(path.join(modelDir, "manga109_segmentation_bubble_1024.onnx"));
  }

  if (normalizedModelId === FONT_RTDETR_MODEL_ID) {
    return fs.existsSync(path.join(modelDir, FONT_RTDETR_FILE_NAME));
  }

  if (normalizedModelId === "pp_doclayout_v3") {
    return hasRequiredFiles([
      "config.json",
      "preprocessor_config.json",
      "model.safetensors",
    ]);
  }

  if (normalizedModelId === "paddleocr_vl_1_5") {
    return hasRequiredFiles([
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
    ]);
  }

  if (normalizedModelId === "vntl_llama3_8b_v2") {
    return fs.existsSync(path.join(modelDir, "vntl-llama3-8b-v2-hf-q8_0.gguf"));
  }

  if (normalizedModelId === "lfm2_350m_enjp_mt") {
    return fs.existsSync(path.join(modelDir, "LFM2-350M-ENJP-MT-Q4_0.gguf"));
  }

  if (normalizedModelId === "sakura_galtransl_7b_v3_7") {
    return fs.existsSync(path.join(modelDir, "Sakura-Galtransl-7B-v3.7-IQ4_XS.gguf"));
  }

  if (normalizedModelId === "sakura_1_5b_qwen2_5_v1_0") {
    return fs.existsSync(path.join(modelDir, "sakura-1.5b-qwen2.5-v1.0-Q5KS.gguf"));
  }

  if (normalizedModelId === "hunyuan_7b_mt_v1_0") {
    return fs.existsSync(path.join(modelDir, "Hunyuan-MT-7B-q4_k_m.gguf"));
  }

  if (normalizedModelId === "opus-mt-ja-en" || normalizedModelId === "opus-mt-zh-en") {
    return hasRequiredFiles([
      "config.json",
      "generation_config.json",
      "pytorch_model.bin",
      "source.spm",
      "target.spm",
      "tokenizer_config.json",
      "vocab.json",
    ]);
  }

  if (normalizedModelId === "nllb-200-3.3b") {
    return hasRequiredFiles([
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
    ]);
  }

  if (normalizedModelId === "nllb-200-600m-int8") {
    return hasRequiredFiles([
      "config.json",
      "model.bin",
      "sentencepiece.bpe.model",
      "shared_vocabulary.txt",
      "special_tokens_map.json",
      "tokenizer.json",
      "tokenizer_config.json",
    ]);
  }

  if (normalizedModelId === "nllb-200-1.3b") {
    return hasRequiredFiles([
      "config.json",
      "generation_config.json",
      "pytorch_model.bin",
      "sentencepiece.bpe.model",
      "special_tokens_map.json",
      "tokenizer.json",
      "tokenizer_config.json",
    ]);
  }

  if (normalizedModelId === "nllb-200-1.3b-int8-ct2") {
    return hasRequiredFiles([
      "config.json",
      "generation_config.json",
      "model.bin",
      "shared_vocabulary.json",
      "special_tokens_map.json",
      "tokenizer.json",
      "tokenizer_config.json",
    ]);
  }

  if (normalizedModelId === "instruct_pix2pix") {
    return hasRequiredFiles([
      "model_index.json",
      "unet/diffusion_pytorch_model.fp16.safetensors",
      "vae/diffusion_pytorch_model.fp16.safetensors",
      "text_encoder/model.fp16.safetensors",
    ]);
  }

  if (normalizedModelId === "sdxl_instruct_pix2pix") {
    return hasRequiredFiles([
      "model_index.json",
      "unet/diffusion_pytorch_model.safetensors",
      "vae/diffusion_pytorch_model.safetensors",
      "text_encoder/model.safetensors",
      "text_encoder_2/model.safetensors",
    ]);
  }

  if (normalizedModelId === "flux2_klein_4b_gguf_q4") {
    return hasRequiredFiles([
      "model_index.json",
      "gguf/flux-2-klein-4b-Q4_K_M.gguf",
      "vae/diffusion_pytorch_model.safetensors",
      "text_encoder/model-00001-of-00002.safetensors",
      "text_encoder/model-00002-of-00002.safetensors",
    ]);
  }

  if (normalizedModelId === "flux2_klein_4b") {
    return hasRequiredFiles([
      "model_index.json",
      "transformer/diffusion_pytorch_model.safetensors",
      "vae/diffusion_pytorch_model.safetensors",
      "text_encoder/model-00001-of-00002.safetensors",
      "text_encoder/model-00002-of-00002.safetensors",
    ]);
  }

  if (normalizedModelId === "longcat_image_edit_turbo") {
    return hasRequiredFiles([
      "model_index.json",
      "transformer/diffusion_pytorch_model.safetensors",
      "vae/diffusion_pytorch_model.safetensors",
      "text_encoder/model-00001-of-00005.safetensors",
      "text_encoder/model-00005-of-00005.safetensors",
    ]);
  }

  if (normalizedModelId === "qwen_image_edit_2511_gguf_q4") {
    return hasRequiredFiles([
      "model_index.json",
      "gguf/qwen-image-edit-2511-Q4_K_M.gguf",
      "vae/diffusion_pytorch_model.safetensors",
      "text_encoder/model-00001-of-00004.safetensors",
      "text_encoder/model-00004-of-00004.safetensors",
    ]);
  }

  if (
    normalizedModelId === "qwen_image_edit_2511" ||
    normalizedModelId === "firered_image_edit_1_1"
  ) {
    return hasRequiredFiles([
      "model_index.json",
      "transformer/diffusion_pytorch_model-00001-of-00005.safetensors",
      "transformer/diffusion_pytorch_model-00005-of-00005.safetensors",
      "vae/diffusion_pytorch_model.safetensors",
      "text_encoder/model-00001-of-00004.safetensors",
      "text_encoder/model-00004-of-00004.safetensors",
    ]);
  }

  return hasAnyPayloadFile(modelDir);
};

const easyocrBucketReady = (baseDir: string, recognitionFile: string): boolean =>
  fs.existsSync(path.join(baseDir, EASYOCR_DETECTION_FILE)) &&
  fs.existsSync(path.join(baseDir, recognitionFile));

const detectEasyocrInstalledLanguages = (modelDir: string): string[] => {
  const bucketRoot = path.join(modelDir, "easyocr-cache");
  const languages = new Set<string>();

  for (const spec of EASYOCR_BUCKET_SPECS) {
    const bucketDir = path.join(bucketRoot, spec.bucket);
    const legacyReady = easyocrBucketReady(bucketRoot, spec.recognitionFile);
    const bucketReady = easyocrBucketReady(bucketDir, spec.recognitionFile);
    if (!legacyReady && !bucketReady) {
      continue;
    }
    for (const language of spec.languages) {
      languages.add(language);
    }
  }

  return Array.from(languages).sort((left, right) => left.localeCompare(right));
};

export { detectEasyocrInstalledLanguages, isInstalledPayloadPresent };
