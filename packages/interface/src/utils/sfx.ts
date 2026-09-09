import type { AioTextRegion } from "../types/dashboard.types";
import type { LoadedImage } from "../types/dashboard.types";
import { toApiIntegerBbox } from "./dashboard.utils";

export interface SfxClassificationResult {
  id: string;
  is_sfx: boolean;
  confidence: number;
  requires_redraw: boolean;
  reason?: string | null;
}

export interface SfxClassificationResponse {
  model_used: string;
  regions: SfxClassificationResult[];
}

const BUILT_IN_SFX_CLASSIFIER_INSTRUCTIONS = [
  "Detect only onomatopeia and sound effects integrated into the art.",
  "Ignore normal dialogue balloons and ordinary narration boxes.",
  "Prioritize stylized, slanted, oversized, outlined, decorative lettering.",
  "Flag requires_redraw when the lettering is embedded in art and likely needs redraw attention.",
].join(" ");

const BUILT_IN_SFX_TRANSLATION_INSTRUCTIONS = [
  "Translate as a natural comic sound effect in the target language.",
  "Preserve impact, rhythm, intention, and intensity.",
  "Prefer comic/onomatopoeic equivalents instead of literal phrasing.",
  "Do not output a normal dialogue sentence.",
  "Prefer short, renderable results.",
].join(" ");

const BUILT_IN_SFX_CLEAN_INSTRUCTIONS = [
  "Clean only approved sound-effect lettering regions.",
  "Remove the SFX glyph footprint while preserving surrounding artwork and line art.",
  "Do not touch normal dialogue balloons or narration content.",
  "Be conservative when reconstructing art behind embedded SFX.",
].join(" ");

export const buildSfxClassifierInstructions = (additionalInstructions: string): string => {
  const normalized = additionalInstructions.trim();
  if (!normalized) {
    return BUILT_IN_SFX_CLASSIFIER_INSTRUCTIONS;
  }
  return `${BUILT_IN_SFX_CLASSIFIER_INSTRUCTIONS}\n\nSupplemental user instructions:\n${normalized}`;
};

export const buildSfxTranslationInstructions = (
  genericExtraContext: string,
  additionalInstructions: string,
): string => {
  const blocks = [
    BUILT_IN_SFX_TRANSLATION_INSTRUCTIONS,
    genericExtraContext.trim(),
    additionalInstructions.trim(),
  ].filter(Boolean);
  return blocks.join("\n\n");
};

export const buildSfxCleanInstructions = (additionalInstructions: string): string => {
  const normalized = additionalInstructions.trim();
  if (!normalized) {
    return BUILT_IN_SFX_CLEAN_INSTRUCTIONS;
  }
  return `${BUILT_IN_SFX_CLEAN_INSTRUCTIONS}\n\nSupplemental user instructions:\n${normalized}`;
};

export const isLikelySfxCandidate = (region: AioTextRegion): boolean => {
  const detectedMode = region.detectedRenderMode ?? "text_bubble";
  const structuralType = (region.structuralType ?? "").trim().toLowerCase();
  if (detectedMode === "text_sfx" || detectedMode === "text_free") {
    return true;
  }
  if (structuralType === "scream" || structuralType === "text_outside_bubble") {
    return true;
  }
  return false;
};

export const buildSfxClassifierRegionsPayload = (
  regions: AioTextRegion[],
  image: LoadedImage,
): Array<Record<string, unknown>> =>
  regions.map((region) => ({
    id: region.id,
    bbox: toApiIntegerBbox(region.bbox, image.width, image.height),
    source: region.source,
    detector_model_key: region.detectorModelKey ?? region.modelKey,
    score: region.score ?? 0,
    structural_type: region.structuralType ?? null,
    structural_confidence: region.structuralConfidence ?? null,
    structural_source: region.structuralSource ?? null,
    matched_reference_image: region.matchedReferenceImage ?? null,
    detected_render_mode: region.detectedRenderMode ?? null,
  }));

export const applySfxDecisionsToRegions = (
  regions: AioTextRegion[],
  decisions: SfxClassificationResult[],
): AioTextRegion[] => {
  const byId = new Map(decisions.map((decision) => [decision.id, decision] as const));
  return regions.map((region) => {
    const decision = byId.get(region.id);
    const approved = decision?.is_sfx ?? false;
    return {
      ...region,
      detectedRenderMode: approved
        ? (region.detectedRenderMode === "text_sfx" ? region.detectedRenderMode : "text_sfx")
        : region.detectedRenderMode,
      sfxCandidate: true,
      sfxApproved: approved,
      sfxConfidence: decision?.confidence ?? null,
      sfxRequiresRedraw: decision?.requires_redraw ?? false,
      sfxReason: decision?.reason ?? null,
    };
  });
};
