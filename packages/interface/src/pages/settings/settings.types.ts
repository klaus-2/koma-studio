import type { IDesktopFontEntry } from "../../types";
import type { RenderTextStyle } from "../../utils/renderText";
import type { AioStageSelection } from "../../types/aioModelPresets";
import type { RenderModePresetMode, RenderModeStylePreset } from "../../utils/renderModePresets";
import type { TypographyShapeKind } from "../../typography/types";

/* ─── Types ─────────────────────────────────────────────── */

export type SettingsTab = "general" | "presets" | "integrations" | "app";
export type WebhookTestStatus = "idle" | "testing" | "success" | "error";
export type WebhookFeedbackState = { type: "success" | "error"; message: string } | null;
export type BloggerFeedbackState = { type: "success" | "error"; message: string } | null;
export type WorkspaceAutosaveFeedbackState = { type: "success" | "error"; message: string } | null;
export type LocalResetFeedbackState = { type: "success" | "error"; message: string } | null;

export interface SettingsPageProps {
  onBackDashboard: () => void;
}

export interface TravelTokenMetadata {
  destinationMasked: string;
  expiresAt: string;
  travelDays: number;
}

export interface RenderModePresetFormData {
  mode: RenderModePresetMode;
  style: RenderModeStylePreset;
}

export interface TypographyPresetFormData {
  presetId: string | null;
  folderId: string | null;
  name: string;
  description: string;
  defaultShapeKind: TypographyShapeKind;
  padding: number;
  style: RenderTextStyle;
}

export interface RenderFontCatalog {
  system: string[];
  custom: IDesktopFontEntry[];
}

export interface PresetFormData {
  presetId: string | null;
  sourceLanguage: string;
  stageModels: AioStageSelection;
  description: string;
  name: string;
  setAsActive: boolean;
}
