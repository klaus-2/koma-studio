import { resolveCleanProtocolForApiBase, type CleanProtocol } from './customLlm';
import { getLocalImageEditSpec } from './imageEditLocalModels';

export type ImageEditCompatibilityTarget = 'clean' | 'aio_ai';

export type ImageEditCompatibilityStatus =
  | 'compatible_both'
  | 'clean_only'
  | 'incompatible_text_only'
  | 'unknown';

export type ImageEditCompatibilityReasonKey =
  | 'textOnlyModel'
  | 'localOllama'
  | 'textInpaintingOnly'
  | 'nativeImageEditor'
  | 'unverifiedCustom';

export interface ImageEditCompatibilityInput {
  model: string;
  apiBase?: string;
  protocol?: CleanProtocol;
  targetMode?: ImageEditCompatibilityTarget;
}

export interface ImageEditCompatibilityAssessment {
  status: ImageEditCompatibilityStatus;
  supportsClean: boolean;
  supportsAioAi: boolean;
  reasonKey: ImageEditCompatibilityReasonKey;
  recommendedReplacements: ReadonlyArray<string>;
}

const IMAGE_EDIT_AND_AIO_PATTERNS: ReadonlyArray<RegExp> = [
  /gemini-[^/\s]*-image/i,
  /nano-banana/i,
  /^(?:openai\/)?(?:gpt-image|chatgpt-image)/i,
  /qwen[-_]?image[-_]?edit/i,
  /flux[-./]?(?:pro\/)?kontext/i,
  /flux[-.]?2-(?:pro|max|dev)/i,
  /seededit|seedream|gpt-image-edit|bagel|step1x-edit/i,
];

const CLEAN_ONLY_INPAINT_PATTERNS: ReadonlyArray<RegExp> = [
  /image-object-removal/i,
  /inst-inpaint/i,
  /flux[.\-_ ]?1[.\-_ ]?fill/i,
  /flux-2-klein/i,
  /stable-diffusion.*inpaint/i,
  /^(?:search-and-replace|inpaint|erase|outpaint)$/i,
  /\biopaint\b|\blama[-_]?inpaint\b/i,
];

const TEXT_ONLY_MODEL_PATTERNS: ReadonlyArray<RegExp> = [
  /^(?:google\/)?gemini-(?:\d|\w).*/i,
  /^(?:openai\/)?(?:gpt-4[o.\-\w]*|gpt-3\.5[.\-\w]*|o1(?:$|[-_.\w]*)|o3(?:$|[-_.\w]*)|o4(?:$|[-_.\w]*))/i,
  /^(?:anthropic\/)?claude-/i,
  /^(?:deepseek\/)?deepseek/i,
  /^(?:meta-llama\/)?llama/i,
  /^(?:mistralai\/)?(?:mistral|mixtral)/i,
  /^(?:google\/)?gemma-/i,
  /^(?:x-ai\/)?grok-/i,
  /^(?:z-ai\/)?glm-/i,
  /^(?:qwen\/)?qwen/i,
  /\b(?:sonar|command-r|phi-\d)\b/i,
];

const RECOMMENDATION_BY_HOST: ReadonlyArray<{
  match: (hostLower: string, protocol: CleanProtocol) => boolean;
  models: ReadonlyArray<string>;
}> = [
  {
    match: (host) => host.includes('generativelanguage.googleapis.com'),
    models: ['gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview', 'gemini-2.5-flash-image'],
  },
  {
    match: (host) => host.includes('openrouter.ai'),
    models: [
      'google/gemini-3.1-flash-image-preview',
      'google/gemini-3-pro-image-preview',
      'google/gemini-2.5-flash-image',
    ],
  },
  {
    match: (host, protocol) => host.includes('api.openai.com') || protocol === 'openai_images_edits',
    models: ['gpt-image-1.5', 'gpt-image-1'],
  },
  {
    match: (host, protocol) => host.includes('fal.') || protocol === 'fal',
    models: ['fal-ai/nano-banana/edit', 'fal-ai/nano-banana-pro/edit', 'fal-ai/flux-pro/kontext'],
  },
  {
    match: (host, protocol) => host.includes('replicate.com') || protocol === 'replicate',
    models: ['google/nano-banana', 'black-forest-labs/flux-kontext-pro', 'qwen/qwen-image-edit'],
  },
  {
    match: (host, protocol) => host.includes('stability.ai') || protocol === 'stability',
    models: ['search-and-replace', 'inpaint', 'erase'],
  },
];

const DEFAULT_RECOMMENDED_MODELS: ReadonlyArray<string> = [
  'gemini-3.1-flash-image-preview',
  'gpt-image-1.5',
  'fal-ai/nano-banana/edit',
];

const isOllamaEndpoint = (apiBase: string): boolean => {
  const trimmed = apiBase.trim().toLowerCase();
  if (!trimmed) {
    return false;
  }
  if (trimmed.includes('ollama')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.port === '11434';
  } catch {
    return trimmed.includes(':11434');
  }
};

const resolveEffectiveProtocol = (
  apiBase: string,
  protocol: CleanProtocol = 'auto',
): CleanProtocol => (protocol !== 'auto' ? protocol : resolveCleanProtocolForApiBase(apiBase));

export const getRecommendedImageEditModels = (
  apiBase = '',
  protocol: CleanProtocol = 'auto',
): ReadonlyArray<string> => {
  const resolved = resolveEffectiveProtocol(apiBase, protocol);
  const hostLower = apiBase.trim().toLowerCase();
  for (const entry of RECOMMENDATION_BY_HOST) {
    if (entry.match(hostLower, resolved)) {
      return entry.models;
    }
  }
  if (resolved === 'gemini') {
    return ['gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];
  }
  return DEFAULT_RECOMMENDED_MODELS;
};

export const assessImageEditModelCompatibility = (
  input: ImageEditCompatibilityInput,
): ImageEditCompatibilityAssessment => {
  const apiBase = (input.apiBase ?? '').trim();
  const protocol = input.protocol ?? 'auto';
  const rawModel = input.model.trim();
  const normalizedModel = rawModel.toLowerCase();
  const recommendedReplacements = getRecommendedImageEditModels(apiBase, protocol);

  if (isOllamaEndpoint(apiBase)) {
    return {
      status: 'incompatible_text_only',
      supportsClean: false,
      supportsAioAi: false,
      reasonKey: 'localOllama',
      recommendedReplacements,
    };
  }

  const localSpec = getLocalImageEditSpec(rawModel);
  if (localSpec) {
    if (localSpec.compatibility === 'compatible_both') {
      return {
        status: 'compatible_both',
        supportsClean: true,
        supportsAioAi: true,
        reasonKey: 'nativeImageEditor',
        recommendedReplacements: [],
      };
    }
    return {
      status: 'clean_only',
      supportsClean: true,
      supportsAioAi: false,
      reasonKey: 'textInpaintingOnly',
      recommendedReplacements: [
        'flux2_klein_4b_gguf_q4',
        'qwen_image_edit_2511_gguf_q4',
        'longcat_image_edit_turbo',
      ],
    };
  }

  if (!normalizedModel) {
    return {
      status: 'unknown',
      supportsClean: false,
      supportsAioAi: false,
      reasonKey: 'unverifiedCustom',
      recommendedReplacements,
    };
  }

  if (IMAGE_EDIT_AND_AIO_PATTERNS.some((pattern) => pattern.test(normalizedModel))) {
    return {
      status: 'compatible_both',
      supportsClean: true,
      supportsAioAi: true,
      reasonKey: 'nativeImageEditor',
      recommendedReplacements,
    };
  }

  const tailSlug = normalizedModel.includes('/')
    ? normalizedModel.slice(normalizedModel.lastIndexOf('/') + 1)
    : normalizedModel;

  if (
    CLEAN_ONLY_INPAINT_PATTERNS.some(
      (pattern) => pattern.test(normalizedModel) || pattern.test(tailSlug),
    )
  ) {
    return {
      status: 'clean_only',
      supportsClean: true,
      supportsAioAi: false,
      reasonKey: 'textInpaintingOnly',
      recommendedReplacements,
    };
  }

  if (
    TEXT_ONLY_MODEL_PATTERNS.some(
      (pattern) => pattern.test(normalizedModel) || pattern.test(tailSlug),
    )
  ) {
    return {
      status: 'incompatible_text_only',
      supportsClean: false,
      supportsAioAi: false,
      reasonKey: 'textOnlyModel',
      recommendedReplacements,
    };
  }

  return {
    status: 'unknown',
    supportsClean: true,
    supportsAioAi: input.targetMode === 'aio_ai',
    reasonKey: 'unverifiedCustom',
    recommendedReplacements,
  };
};

export const isModelWarningTriggeredForTarget = (
  assessment: ImageEditCompatibilityAssessment,
  targetMode: ImageEditCompatibilityTarget,
): boolean => {
  if (assessment.status === 'incompatible_text_only') {
    return true;
  }
  if (targetMode === 'aio_ai' && assessment.status === 'clean_only') {
    return true;
  }
  return false;
};
