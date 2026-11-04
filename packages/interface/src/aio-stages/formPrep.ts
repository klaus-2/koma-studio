/**
 * Shared stage-form prep: the `file` / `model_key` / `use_gpu` prefix every
 * AIO stage-run posts to the mini-backend.
 *
 * Maintainability + consistency seam (deduplicated form prep) only — each
 * stage still performs its own HTTP transfer against the stateless per-stage
 * contract; this removes code duplication, not requests.
 *
 * Stage-specific conditionals stay with the CALLERS, not here:
 * - recognizeText passes `useGpu: undefined` and appends its own `use_gpu`
 *   under the `!useCloudOcr` gate.
 * - getTranslations passes `file: undefined` and appends `file` itself under
 *   the `llmSettings` gate.
 */
export interface StageFormPrepArgs {
  /** Appended as `file` only when present. */
  readonly file?: File;
  readonly modelKey: string;
  /** Appended as `use_gpu` only when defined (undefined ≠ false). */
  readonly useGpu?: boolean;
}

export function createStageForm(args: StageFormPrepArgs): FormData {
  const form = new FormData();
  if (args.file) {
    form.append('file', args.file);
  }
  form.append('model_key', args.modelKey);
  if (args.useGpu !== undefined) {
    form.append('use_gpu', String(args.useGpu));
  }
  return form;
}
