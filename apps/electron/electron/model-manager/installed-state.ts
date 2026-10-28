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

  if (normalizedModelId === SEGMENT_BAKA_MODEL_ID) {
    return fs.existsSync(path.join(modelDir, "segmenter.meta"));
  }

  if (normalizedModelId === FONT_RTDETR_MODEL_ID) {
    return fs.existsSync(path.join(modelDir, FONT_RTDETR_FILE_NAME));
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
