/** Clean Image (AI) / SFX stage-runs behind the shared transport seam. */
import {
  toCustomLlmRequestPayload,
  type CustomLlmRequestProfile,
} from '../utils/customLlm';
import type { SfxClassificationResponse } from '../utils/sfx';
import { createStageForm } from './formPrep';
import { toStructuralRegionsJson } from './payloads';
import { STAGE_TIMEOUT_MS, runStageForm, type StageRunOptions } from './transport';
import type {
  FinishedStageRun,
  RegionList,
  StageImageRef,
  StageRuntime,
} from './types';

/** Shared args for structural Clean Image (AI) / SFX stage-runs. */
export interface StructuralCleanStageArgs {
  image: StageImageRef;
  modelKey: string;
  regions: RegionList;
  additionalInstructions: string;
  customProfile?: CustomLlmRequestProfile | null;
}

/** Stage-specific structural extras on top of the shared form prep. */
function appendStructuralCleanFields(
  form: FormData,
  args: StructuralCleanStageArgs,
): void {
  form.append('regions', toStructuralRegionsJson(args.regions, args.image));
  form.append('additional_instructions', args.additionalInstructions);
  const customPayload = toCustomLlmRequestPayload(args.customProfile);
  if (customPayload) {
    form.append('custom_llm', JSON.stringify(customPayload));
  }
}

/** POST /sfx/classify — structural SFX decisions for candidate Regions. */
export function runSfxClassifyStage(
  args: StructuralCleanStageArgs,
  runtime: StageRuntime,
  options: StageRunOptions,
): Promise<FinishedStageRun<SfxClassificationResponse>> {
  const form = createStageForm({ file: args.image.file, modelKey: args.modelKey });
  appendStructuralCleanFields(form, args);
  return runStageForm(runtime, options, {
    path: '/sfx/classify',
    form,
    timeoutMs: STAGE_TIMEOUT_MS.sfxClassify,
    parse: async (response) =>
      (await response.json()) as SfxClassificationResponse,
  });
}

/**
 * POST /clean/ai — AI Clean / SFX clean. Value is the cleaned image blob;
 * callers assert `type.startsWith('image/')`.
 */
export function runCleanImageAiStage(
  args: StructuralCleanStageArgs,
  runtime: StageRuntime,
  options: StageRunOptions,
): Promise<FinishedStageRun<Blob>> {
  const form = createStageForm({ file: args.image.file, modelKey: args.modelKey });
  appendStructuralCleanFields(form, args);
  return runStageForm(runtime, options, {
    path: '/clean/ai',
    form,
    timeoutMs: STAGE_TIMEOUT_MS.cleanImageAi,
    parse: (response) => response.blob(),
  });
}
