import {
  toCustomLlmRequestPayload,
  type CustomLlmRequestProfile,
} from '../utils/customLlm';
import {
  toBackendAioAiOptionsPayload,
  toBackendImageEditModelConfigPayload,
  type AioAiOptions,
  type ImageEditModelConfig,
} from '../utils/imageEditModelConfig';
import { createStageForm } from './formPrep';
import { STAGE_TIMEOUT_MS, runStageForm, type StageRunOptions } from './transport';
import type {
  FinishedStageRun,
  StageImageRef,
  StageRuntime,
} from './types';

export interface AioAiRegionGuidancePayload {
  id: string;
  bbox: [number, number, number, number];
  shape_kind?: 'rounded' | 'square' | null;
  inner_box?: [number, number, number, number] | null;
  detected_render_mode?: string | null;
  structural_type?: string | null;
  source_text?: string | null;
  translated_text?: string | null;
  foreground_rgb?: [number, number, number] | null;
}

export interface AioAiGlossaryPayload {
  source: string;
  target: string;
  note?: string;
  never_translate?: boolean;
}

export interface AioAiStageArgs {
  image: StageImageRef;
  modelKey: string;
  sourceLanguage: string;
  targetLanguage: string;
  options: AioAiOptions;
  modelConfig?: ImageEditModelConfig | null;
  regions?: ReadonlyArray<AioAiRegionGuidancePayload>;
  additionalInstructions: string;
  customProfile?: CustomLlmRequestProfile | null;
  glossary?: ReadonlyArray<AioAiGlossaryPayload>;
  previousPageContext?: string;
}

export interface AioAiStageResult {
  blob: Blob;
  modelUsed: string | null;
  segments: number;
  skipped: boolean;
}

export function runAioAiStage(
  args: AioAiStageArgs,
  runtime: StageRuntime,
  options: StageRunOptions,
): Promise<FinishedStageRun<AioAiStageResult>> {
  const form = createStageForm({ file: args.image.file, modelKey: args.modelKey });
  form.append('source_language', args.sourceLanguage);
  form.append('target_language', args.targetLanguage);
  form.append('options', JSON.stringify(toBackendAioAiOptionsPayload(args.options)));
  if (args.modelConfig) {
    form.append(
      'model_config',
      JSON.stringify(toBackendImageEditModelConfigPayload(args.modelConfig)),
    );
  }
  form.append('regions', JSON.stringify(args.regions ?? []));
  form.append('additional_instructions', args.additionalInstructions);
  const customPayload = toCustomLlmRequestPayload(args.customProfile);
  if (customPayload) {
    form.append('custom_llm', JSON.stringify(customPayload));
  }
  if (args.glossary && args.glossary.length > 0) {
    form.append('glossary', JSON.stringify(args.glossary));
  }
  if (args.previousPageContext && args.previousPageContext.trim().length > 0) {
    form.append('previous_page_context', args.previousPageContext.trim());
  }

  return runStageForm(runtime, options, {
    path: '/aio/ai',
    form,
    timeoutMs: STAGE_TIMEOUT_MS.aioAi,
    parse: async (response) => {
      const parsedSegments = Number.parseInt(
        response.headers.get('X-Aio-Ai-Segments') ?? '1',
        10,
      );
      return {
        blob: await response.blob(),
        modelUsed: response.headers.get('X-Aio-Ai-Model-Used'),
        segments: Number.isFinite(parsedSegments) && parsedSegments > 0 ? parsedSegments : 1,
        skipped: response.headers.get('X-Aio-Ai-Skipped') === '1',
      };
    },
  });
}
