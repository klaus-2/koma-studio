import {
  toCustomLlmRequestPayload,
  type CustomLlmRequestProfile,
} from '../utils/customLlm';
import {
  toBackendImageEditModelConfigPayload,
  type ImageEditModelConfig,
} from '../utils/imageEditModelConfig';
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

export interface StructuralCleanStageArgs {
  image: StageImageRef;
  modelKey: string;
  regions: RegionList;
  additionalInstructions: string;
  customProfile?: CustomLlmRequestProfile | null;
  modelConfig?: ImageEditModelConfig | null;
}

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
  if (args.modelConfig) {
    form.append(
      'model_config',
      JSON.stringify(toBackendImageEditModelConfigPayload(args.modelConfig)),
    );
  }
}

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
