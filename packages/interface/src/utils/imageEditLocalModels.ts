export type LocalImageEditCompatibility = 'compatible_both' | 'clean_only';

export const LOCAL_IMAGE_EDIT_PREFIX = 'local_image_edit:' as const;

export const LOCAL_IMAGE_EDIT_MODEL_IDS = [
  'instruct_pix2pix',
  'sdxl_instruct_pix2pix',
  'flux2_klein_4b_gguf_q4',
  'flux2_klein_4b',
  'longcat_image_edit_turbo',
  'qwen_image_edit_2511_gguf_q4',
  'qwen_image_edit_2511',
  'firered_image_edit_1_1',
] as const;

export type LocalImageEditModelId = (typeof LOCAL_IMAGE_EDIT_MODEL_IDS)[number];

export interface LocalImageEditSpec {
  readonly id: LocalImageEditModelId;
  readonly name: string;
  readonly hfRepo: string;
  readonly compatibility: LocalImageEditCompatibility;
  readonly minVramGb: number;
  readonly recommendedRamGb: number;
  readonly defaultSteps: number;
  readonly defaultGuidanceScale: number;
  readonly tier: 'light' | 'medium' | 'heavy';
  readonly recommended?: boolean;
}

export const LOCAL_IMAGE_EDIT_SPECS: Readonly<Record<LocalImageEditModelId, LocalImageEditSpec>> = {
  instruct_pix2pix: {
    id: 'instruct_pix2pix',
    name: 'InstructPix2Pix (FP16)',
    hfRepo: 'timbrooks/instruct-pix2pix',
    compatibility: 'clean_only',
    minVramGb: 4,
    recommendedRamGb: 8,
    defaultSteps: 20,
    defaultGuidanceScale: 7.5,
    tier: 'light',
  },
  sdxl_instruct_pix2pix: {
    id: 'sdxl_instruct_pix2pix',
    name: 'SDXL InstructPix2Pix 768',
    hfRepo: 'diffusers/sdxl-instructpix2pix-768',
    compatibility: 'clean_only',
    minVramGb: 8,
    recommendedRamGb: 16,
    defaultSteps: 20,
    defaultGuidanceScale: 7.5,
    tier: 'medium',
  },
  flux2_klein_4b_gguf_q4: {
    id: 'flux2_klein_4b_gguf_q4',
    name: 'FLUX.2 Klein 4B (GGUF Q4_K_M)',
    hfRepo: 'black-forest-labs/FLUX.2-klein-4B',
    compatibility: 'compatible_both',
    minVramGb: 8,
    recommendedRamGb: 16,
    defaultSteps: 4,
    defaultGuidanceScale: 1.0,
    tier: 'medium',
    recommended: true,
  },
  flux2_klein_4b: {
    id: 'flux2_klein_4b',
    name: 'FLUX.2 Klein 4B (BF16)',
    hfRepo: 'black-forest-labs/FLUX.2-klein-4B',
    compatibility: 'compatible_both',
    minVramGb: 12,
    recommendedRamGb: 24,
    defaultSteps: 4,
    defaultGuidanceScale: 1.0,
    tier: 'medium',
  },
  longcat_image_edit_turbo: {
    id: 'longcat_image_edit_turbo',
    name: 'LongCat-Image-Edit Turbo',
    hfRepo: 'meituan-longcat/LongCat-Image-Edit-Turbo',
    compatibility: 'compatible_both',
    minVramGb: 16,
    recommendedRamGb: 32,
    defaultSteps: 8,
    defaultGuidanceScale: 1.0,
    tier: 'heavy',
  },
  qwen_image_edit_2511_gguf_q4: {
    id: 'qwen_image_edit_2511_gguf_q4',
    name: 'Qwen-Image-Edit 2511 (GGUF Q4_K_M)',
    hfRepo: 'Qwen/Qwen-Image-Edit-2511',
    compatibility: 'compatible_both',
    minVramGb: 12,
    recommendedRamGb: 32,
    defaultSteps: 24,
    defaultGuidanceScale: 4.0,
    tier: 'medium',
    recommended: true,
  },
  qwen_image_edit_2511: {
    id: 'qwen_image_edit_2511',
    name: 'Qwen-Image-Edit 2511 (BF16)',
    hfRepo: 'Qwen/Qwen-Image-Edit-2511',
    compatibility: 'compatible_both',
    minVramGb: 24,
    recommendedRamGb: 64,
    defaultSteps: 24,
    defaultGuidanceScale: 4.0,
    tier: 'heavy',
  },
  firered_image_edit_1_1: {
    id: 'firered_image_edit_1_1',
    name: 'FireRed-Image-Edit 1.1 (BF16)',
    hfRepo: 'FireRedTeam/FireRed-Image-Edit-1.1',
    compatibility: 'compatible_both',
    minVramGb: 24,
    recommendedRamGb: 64,
    defaultSteps: 28,
    defaultGuidanceScale: 4.0,
    tier: 'heavy',
  },
};

const LOCAL_ID_SET: ReadonlySet<string> = new Set<string>(LOCAL_IMAGE_EDIT_MODEL_IDS);

export function formatLocalImageEditModelKey(modelId: LocalImageEditModelId): string {
  return `${LOCAL_IMAGE_EDIT_PREFIX}${modelId}`;
}

export function extractLocalImageEditModelId(
  modelKeyOrId: string | null | undefined,
): LocalImageEditModelId | null {
  const raw = (modelKeyOrId ?? '').trim();
  if (!raw) return null;
  const candidate = raw.startsWith(LOCAL_IMAGE_EDIT_PREFIX)
    ? raw.slice(LOCAL_IMAGE_EDIT_PREFIX.length).trim().toLowerCase()
    : raw.toLowerCase();
  if (!LOCAL_ID_SET.has(candidate)) {
    return null;
  }
  return candidate as LocalImageEditModelId;
}

export function isLocalImageEditModelKey(modelKey: string | null | undefined): boolean {
  const raw = (modelKey ?? '').trim();
  return raw.startsWith(LOCAL_IMAGE_EDIT_PREFIX) && extractLocalImageEditModelId(raw) !== null;
}

export function getLocalImageEditSpec(
  modelKeyOrId: string | null | undefined,
): LocalImageEditSpec | null {
  const id = extractLocalImageEditModelId(modelKeyOrId);
  return id ? LOCAL_IMAGE_EDIT_SPECS[id] : null;
}
