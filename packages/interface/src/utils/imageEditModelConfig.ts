import { resolveCleanProtocolForApiBase, type CleanProtocol } from './customLlm';

export type ImageQualityPreset = 'auto' | '1k' | '2k' | '4k';
export type InputFidelityPreset = 'high' | 'low';
export type AspectRatioStrategy = 'auto' | 'pad_unpad';
export type SlicingMode = 'auto' | 'disabled' | 'custom';

export interface ImageEditModelConfig {
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  seed: number | null;
  numInferenceSteps: number | null;
  guidanceScale: number | null;
  imageQuality: ImageQualityPreset;
  inputFidelity: InputFidelityPreset;
  aspectRatioStrategy: AspectRatioStrategy;
  slicingMode: SlicingMode;
  segmentHeight: number;
  segmentOverlap: number;
  maxConcurrentSegments: number;
  compositeMaskMargin: number;
}

export type AioAiExecutionMode = 'direct' | 'hybrid_guided' | 'script_guided';
export type AioAiSfxMode = 'translate' | 'keep' | 'clean_only';
export type AioAiStyleMode = 'match_original' | 'clean_comic' | 'custom';

export interface AioAiOptions {
  executionMode: AioAiExecutionMode;
  sfxMode: AioAiSfxMode;
  styleMode: AioAiStyleMode;
  refineAlignment: boolean;
  preserveArtwork: boolean;
  skipEmptyPages: boolean;
}

export type ProtocolModelParamSupport = 'supported' | 'partial' | 'ignored';

export interface ProtocolModelParamMatrix {
  resolvedProtocol: CleanProtocol | 'local_diffusers';
  temperature: ProtocolModelParamSupport;
  topP: ProtocolModelParamSupport;
  maxTokens: ProtocolModelParamSupport;
  seed: ProtocolModelParamSupport;
  numInferenceSteps: ProtocolModelParamSupport;
  guidanceScale: ProtocolModelParamSupport;
  imageQuality: ProtocolModelParamSupport;
  inputFidelity: ProtocolModelParamSupport;
  aspectRatioStrategy: ProtocolModelParamSupport;
  slicingAndComposite: ProtocolModelParamSupport;
}

export const DEFAULT_IMAGE_EDIT_MODEL_CONFIG: ImageEditModelConfig = {
  temperature: null,
  topP: null,
  maxTokens: null,
  seed: null,
  numInferenceSteps: null,
  guidanceScale: null,
  imageQuality: 'auto',
  inputFidelity: 'high',
  aspectRatioStrategy: 'auto',
  slicingMode: 'auto',
  segmentHeight: 1400,
  segmentOverlap: 160,
  maxConcurrentSegments: 2,
  compositeMaskMargin: 14,
};

export const DEFAULT_AIO_AI_OPTIONS: AioAiOptions = {
  executionMode: 'direct',
  sfxMode: 'translate',
  styleMode: 'match_original',
  refineAlignment: true,
  preserveArtwork: false,
  skipEmptyPages: true,
};

const clampFinite = (value: unknown, min: number, max: number): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.min(max, Math.max(min, value));
};

const clampInt = (value: unknown, min: number, max: number): number | null => {
  const num = clampFinite(value, min, max);
  return num === null ? null : Math.round(num);
};

const pickEnum = <T extends string>(
  value: unknown,
  allowed: ReadonlyArray<T>,
  fallback: T,
): T => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return allowed.find((item) => item === normalized) ?? fallback;
};

export const sanitizeImageEditModelConfig = (
  raw: Partial<ImageEditModelConfig> | Record<string, unknown> | null | undefined,
): ImageEditModelConfig => {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_IMAGE_EDIT_MODEL_CONFIG };
  }
  const source: Record<string, unknown> = raw;
  return {
    temperature: source.temperature === null ? null : clampFinite(source.temperature, 0, 2),
    topP: source.topP === null ? null : clampFinite(source.topP, 0, 1),
    maxTokens: source.maxTokens === null ? null : clampInt(source.maxTokens, 128, 16384),
    seed: source.seed === null ? null : clampInt(source.seed, 0, 2_147_483_647),
    numInferenceSteps:
      source.numInferenceSteps === null ? null : clampInt(source.numInferenceSteps, 1, 100),
    guidanceScale:
      source.guidanceScale === null ? null : clampFinite(source.guidanceScale, 0, 20),
    imageQuality: pickEnum(
      source.imageQuality,
      ['auto', '1k', '2k', '4k'],
      DEFAULT_IMAGE_EDIT_MODEL_CONFIG.imageQuality,
    ),
    inputFidelity: pickEnum(
      source.inputFidelity,
      ['high', 'low'],
      DEFAULT_IMAGE_EDIT_MODEL_CONFIG.inputFidelity,
    ),
    aspectRatioStrategy: pickEnum(
      source.aspectRatioStrategy,
      ['auto', 'pad_unpad'],
      DEFAULT_IMAGE_EDIT_MODEL_CONFIG.aspectRatioStrategy,
    ),
    slicingMode: pickEnum(
      source.slicingMode,
      ['auto', 'disabled', 'custom'],
      DEFAULT_IMAGE_EDIT_MODEL_CONFIG.slicingMode,
    ),
    segmentHeight:
      clampInt(source.segmentHeight, 600, 2800) ?? DEFAULT_IMAGE_EDIT_MODEL_CONFIG.segmentHeight,
    segmentOverlap:
      clampInt(source.segmentOverlap, 40, 400) ?? DEFAULT_IMAGE_EDIT_MODEL_CONFIG.segmentOverlap,
    maxConcurrentSegments:
      clampInt(source.maxConcurrentSegments, 1, 4)
      ?? DEFAULT_IMAGE_EDIT_MODEL_CONFIG.maxConcurrentSegments,
    compositeMaskMargin:
      clampInt(source.compositeMaskMargin, 0, 48)
      ?? DEFAULT_IMAGE_EDIT_MODEL_CONFIG.compositeMaskMargin,
  };
};

export const sanitizeAioAiOptions = (
  raw: Partial<AioAiOptions> | Record<string, unknown> | null | undefined,
): AioAiOptions => {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_AIO_AI_OPTIONS };
  }
  const source: Record<string, unknown> = raw;
  return {
    executionMode: pickEnum(
      source.executionMode,
      ['direct', 'hybrid_guided', 'script_guided'],
      DEFAULT_AIO_AI_OPTIONS.executionMode,
    ),
    sfxMode: pickEnum(
      source.sfxMode,
      ['translate', 'keep', 'clean_only'],
      DEFAULT_AIO_AI_OPTIONS.sfxMode,
    ),
    styleMode: pickEnum(
      source.styleMode,
      ['match_original', 'clean_comic', 'custom'],
      DEFAULT_AIO_AI_OPTIONS.styleMode,
    ),
    refineAlignment:
      typeof source.refineAlignment === 'boolean'
        ? source.refineAlignment
        : DEFAULT_AIO_AI_OPTIONS.refineAlignment,
    preserveArtwork:
      typeof source.preserveArtwork === 'boolean'
        ? source.preserveArtwork
        : DEFAULT_AIO_AI_OPTIONS.preserveArtwork,
    skipEmptyPages:
      typeof source.skipEmptyPages === 'boolean'
        ? source.skipEmptyPages
        : DEFAULT_AIO_AI_OPTIONS.skipEmptyPages,
  };
};

export interface BackendImageEditModelConfigPayload {
  temperature: number | null;
  top_p: number | null;
  max_tokens: number | null;
  seed: number | null;
  num_inference_steps: number | null;
  guidance_scale: number | null;
  image_quality: ImageQualityPreset;
  input_fidelity: InputFidelityPreset;
  aspect_ratio_strategy: AspectRatioStrategy;
  slicing_mode: SlicingMode;
  segment_height: number;
  segment_overlap: number;
  max_concurrent_segments: number;
  composite_mask_margin: number;
}

export const toBackendImageEditModelConfigPayload = (
  config: Partial<ImageEditModelConfig> | null | undefined,
): BackendImageEditModelConfigPayload => {
  const safe = sanitizeImageEditModelConfig(config);
  return {
    temperature: safe.temperature,
    top_p: safe.topP,
    max_tokens: safe.maxTokens,
    seed: safe.seed,
    num_inference_steps: safe.numInferenceSteps,
    guidance_scale: safe.guidanceScale,
    image_quality: safe.imageQuality,
    input_fidelity: safe.inputFidelity,
    aspect_ratio_strategy: safe.aspectRatioStrategy,
    slicing_mode: safe.slicingMode,
    segment_height: safe.segmentHeight,
    segment_overlap: safe.segmentOverlap,
    max_concurrent_segments: safe.maxConcurrentSegments,
    composite_mask_margin: safe.compositeMaskMargin,
  };
};

export interface BackendAioAiOptionsPayload {
  execution_mode: AioAiExecutionMode;
  sfx_mode: AioAiSfxMode;
  style_mode: AioAiStyleMode;
  refine_alignment: boolean;
  preserve_artwork: boolean;
  skip_empty_pages: boolean;
}

export const toBackendAioAiOptionsPayload = (
  options: Partial<AioAiOptions> | null | undefined,
): BackendAioAiOptionsPayload => {
  const safe = sanitizeAioAiOptions(options);
  return {
    execution_mode: safe.executionMode,
    sfx_mode: safe.sfxMode,
    style_mode: safe.styleMode,
    refine_alignment: safe.refineAlignment,
    preserve_artwork: safe.preserveArtwork,
    skip_empty_pages: safe.skipEmptyPages,
  };
};

export const getProtocolSupportedModelParams = (
  protocol: CleanProtocol | undefined,
  apiBase = '',
  isLocalDiffusers = false,
): ProtocolModelParamMatrix => {
  if (isLocalDiffusers) {
    return {
      resolvedProtocol: 'local_diffusers',
      temperature: 'ignored',
      topP: 'ignored',
      maxTokens: 'ignored',
      seed: 'supported',
      numInferenceSteps: 'supported',
      guidanceScale: 'supported',
      imageQuality: 'ignored',
      inputFidelity: 'partial',
      aspectRatioStrategy: 'supported',
      slicingAndComposite: 'supported',
    };
  }
  const resolvedProtocol =
    protocol && protocol !== 'auto' ? protocol : resolveCleanProtocolForApiBase(apiBase);
  switch (resolvedProtocol) {
    case 'gemini':
      return {
        resolvedProtocol,
        temperature: 'supported',
        topP: 'supported',
        maxTokens: 'supported',
        seed: 'supported',
        numInferenceSteps: 'ignored',
        guidanceScale: 'ignored',
        imageQuality: 'supported',
        inputFidelity: 'partial',
        aspectRatioStrategy: 'supported',
        slicingAndComposite: 'supported',
      };
    case 'openai_images_edits':
      return {
        resolvedProtocol,
        temperature: 'ignored',
        topP: 'ignored',
        maxTokens: 'ignored',
        seed: 'ignored',
        numInferenceSteps: 'ignored',
        guidanceScale: 'ignored',
        imageQuality: 'supported',
        inputFidelity: 'supported',
        aspectRatioStrategy: 'supported',
        slicingAndComposite: 'supported',
      };
    case 'openai_chat':
      return {
        resolvedProtocol,
        temperature: 'supported',
        topP: 'supported',
        maxTokens: 'supported',
        seed: 'supported',
        numInferenceSteps: 'ignored',
        guidanceScale: 'ignored',
        imageQuality: 'ignored',
        inputFidelity: 'partial',
        aspectRatioStrategy: 'supported',
        slicingAndComposite: 'supported',
      };
    case 'replicate':
    case 'fal':
      return {
        resolvedProtocol,
        temperature: 'ignored',
        topP: 'ignored',
        maxTokens: 'ignored',
        seed: 'supported',
        numInferenceSteps: 'ignored',
        guidanceScale: 'ignored',
        imageQuality: 'partial',
        inputFidelity: 'partial',
        aspectRatioStrategy: 'supported',
        slicingAndComposite: 'supported',
      };
    case 'stability':
    case 'cloudflare':
    default:
      return {
        resolvedProtocol,
        temperature: 'ignored',
        topP: 'ignored',
        maxTokens: 'ignored',
        seed: resolvedProtocol === 'stability' ? 'supported' : 'ignored',
        numInferenceSteps: 'ignored',
        guidanceScale: 'ignored',
        imageQuality: 'ignored',
        inputFidelity: 'ignored',
        aspectRatioStrategy: 'supported',
        slicingAndComposite: 'supported',
      };
  }
};
