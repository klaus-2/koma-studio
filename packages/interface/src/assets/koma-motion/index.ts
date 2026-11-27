import komaIdleWebm from './mascot/koma-idle.webm';
import komaIdlePoster from './mascot/koma-idle.webp';
import komaWaveWebm from './mascot/koma-wave.webm';
import komaWavePoster from './mascot/koma-wave.webp';
import komaCastingWebm from './mascot/koma-casting.webm';
import komaCastingPoster from './mascot/koma-casting.webp';
import komaCelebrateWebm from './mascot/koma-celebrate.webm';
import komaCelebratePoster from './mascot/koma-celebrate.webp';
import komaPeekWebm from './mascot/koma-peek.webm';
import komaPeekPoster from './mascot/koma-peek.webp';
import komaSleepWebm from './mascot/koma-sleep.webm';
import komaSleepPoster from './mascot/koma-sleep.webp';
import komaStretchWebm from './mascot/koma-stretch.webm';
import komaStretchPoster from './mascot/koma-stretch.webp';
import komaSurprisedWebm from './mascot/koma-surprised.webm';
import komaSurprisedPoster from './mascot/koma-surprised.webp';

import noirHealingWebm from './tools/noir/healing.webm';
import noirHealingPoster from './tools/noir/healing.webp';
import noirMagicWandWebm from './tools/noir/magic-wand.webm';
import noirMagicWandPoster from './tools/noir/magic-wand.webp';
import noirSegmentBrushWebm from './tools/noir/segment-brush.webm';
import noirSegmentBrushPoster from './tools/noir/segment-brush.webp';
import noirSegmentEraserWebm from './tools/noir/segment-eraser.webm';
import noirSegmentEraserPoster from './tools/noir/segment-eraser.webp';
import noirPaintWebm from './tools/noir/paint.webm';
import noirPaintPoster from './tools/noir/paint.webp';
import noirPaintEraserWebm from './tools/noir/paint-eraser.webm';
import noirPaintEraserPoster from './tools/noir/paint-eraser.webp';
import noirClearPaintWebm from './tools/noir/clear-paint.webm';
import noirClearPaintPoster from './tools/noir/clear-paint.webp';
import noirResetEditsWebm from './tools/noir/reset-edits.webm';
import noirResetEditsPoster from './tools/noir/reset-edits.webp';
import noirAreaSelectWebm from './tools/noir/area-select.webm';
import noirAreaSelectPoster from './tools/noir/area-select.webp';
import noirConfigWebm from './tools/noir/config.webm';
import noirConfigPoster from './tools/noir/config.webp';
import noirClearPageWebm from './tools/noir/clear-page.webm';
import noirClearPagePoster from './tools/noir/clear-page.webp';

import noirStageDetectWebm from './tools/noir/stage-detect.webm';
import noirStageDetectPoster from './tools/noir/stage-detect.webp';
import noirStageOcrWebm from './tools/noir/stage-ocr.webm';
import noirStageOcrPoster from './tools/noir/stage-ocr.webp';
import noirStageTranslateWebm from './tools/noir/stage-translate.webm';
import noirStageTranslatePoster from './tools/noir/stage-translate.webp';
import noirStageSegmentWebm from './tools/noir/stage-segment.webm';
import noirStageSegmentPoster from './tools/noir/stage-segment.webp';
import noirStageCleanWebm from './tools/noir/stage-clean.webm';
import noirStageCleanPoster from './tools/noir/stage-clean.webp';
import noirStageRenderWebm from './tools/noir/stage-render.webm';
import noirStageRenderPoster from './tools/noir/stage-render.webp';

import classicHealingWebm from './tools/classic/healing.webm';
import classicHealingPoster from './tools/classic/healing.webp';
import classicMagicWandWebm from './tools/classic/magic-wand.webm';
import classicMagicWandPoster from './tools/classic/magic-wand.webp';
import classicSegmentBrushWebm from './tools/classic/segment-brush.webm';
import classicSegmentBrushPoster from './tools/classic/segment-brush.webp';
import classicSegmentEraserWebm from './tools/classic/segment-eraser.webm';
import classicSegmentEraserPoster from './tools/classic/segment-eraser.webp';
import classicPaintWebm from './tools/classic/paint.webm';
import classicPaintPoster from './tools/classic/paint.webp';
import classicPaintEraserWebm from './tools/classic/paint-eraser.webm';
import classicPaintEraserPoster from './tools/classic/paint-eraser.webp';
import classicClearPaintWebm from './tools/classic/clear-paint.webm';
import classicClearPaintPoster from './tools/classic/clear-paint.webp';
import classicResetEditsWebm from './tools/classic/reset-edits.webm';
import classicResetEditsPoster from './tools/classic/reset-edits.webp';
import classicAreaSelectWebm from './tools/classic/area-select.webm';
import classicAreaSelectPoster from './tools/classic/area-select.webp';
import classicConfigWebm from './tools/classic/config.webm';
import classicConfigPoster from './tools/classic/config.webp';
import classicClearPageWebm from './tools/classic/clear-page.webm';
import classicClearPagePoster from './tools/classic/clear-page.webp';

import classicStageDetectWebm from './tools/classic/stage-detect.webm';
import classicStageDetectPoster from './tools/classic/stage-detect.webp';
import classicStageOcrWebm from './tools/classic/stage-ocr.webm';
import classicStageOcrPoster from './tools/classic/stage-ocr.webp';
import classicStageTranslateWebm from './tools/classic/stage-translate.webm';
import classicStageTranslatePoster from './tools/classic/stage-translate.webp';
import classicStageSegmentWebm from './tools/classic/stage-segment.webm';
import classicStageSegmentPoster from './tools/classic/stage-segment.webp';
import classicStageCleanWebm from './tools/classic/stage-clean.webm';
import classicStageCleanPoster from './tools/classic/stage-clean.webp';
import classicStageRenderWebm from './tools/classic/stage-render.webm';
import classicStageRenderPoster from './tools/classic/stage-render.webp';

export type DockToolPreviewKind =
  | 'config'
  | 'area-select'
  | 'clear-page'
  | 'segment-brush'
  | 'segment-eraser'
  | 'paint'
  | 'paint-eraser'
  | 'magic-wand'
  | 'healing'
  | 'clear-paint'
  | 'reset-edits';

export interface MotionMediaAsset {
  readonly webm: string;
  readonly poster: string;
}

export type KomaMascotClipPose =
  | 'idle'
  | 'wave'
  | 'casting'
  | 'celebrate'
  | 'peek'
  | 'sleep'
  | 'stretch'
  | 'surprised';

export type AioStageDemoKind =
  | 'detectText'
  | 'recognizeText'
  | 'getTranslations'
  | 'segmentText'
  | 'cleanImage'
  | 'render';

export const KOMA_MASCOT_MEDIA: Readonly<Record<KomaMascotClipPose, MotionMediaAsset>> = {
  idle: { webm: komaIdleWebm, poster: komaIdlePoster },
  wave: { webm: komaWaveWebm, poster: komaWavePoster },
  casting: { webm: komaCastingWebm, poster: komaCastingPoster },
  celebrate: { webm: komaCelebrateWebm, poster: komaCelebratePoster },
  peek: { webm: komaPeekWebm, poster: komaPeekPoster },
  sleep: { webm: komaSleepWebm, poster: komaSleepPoster },
  stretch: { webm: komaStretchWebm, poster: komaStretchPoster },
  surprised: { webm: komaSurprisedWebm, poster: komaSurprisedPoster },
};

export const KOMA_TOOL_MEDIA: Readonly<
  Record<'noir' | 'classic', Readonly<Record<DockToolPreviewKind, MotionMediaAsset>>>
> = {
  noir: {
    healing: { webm: noirHealingWebm, poster: noirHealingPoster },
    'magic-wand': { webm: noirMagicWandWebm, poster: noirMagicWandPoster },
    'segment-brush': { webm: noirSegmentBrushWebm, poster: noirSegmentBrushPoster },
    'segment-eraser': { webm: noirSegmentEraserWebm, poster: noirSegmentEraserPoster },
    paint: { webm: noirPaintWebm, poster: noirPaintPoster },
    'paint-eraser': { webm: noirPaintEraserWebm, poster: noirPaintEraserPoster },
    'clear-paint': { webm: noirClearPaintWebm, poster: noirClearPaintPoster },
    'reset-edits': { webm: noirResetEditsWebm, poster: noirResetEditsPoster },
    'area-select': { webm: noirAreaSelectWebm, poster: noirAreaSelectPoster },
    config: { webm: noirConfigWebm, poster: noirConfigPoster },
    'clear-page': { webm: noirClearPageWebm, poster: noirClearPagePoster },
  },
  classic: {
    healing: { webm: classicHealingWebm, poster: classicHealingPoster },
    'magic-wand': { webm: classicMagicWandWebm, poster: classicMagicWandPoster },
    'segment-brush': { webm: classicSegmentBrushWebm, poster: classicSegmentBrushPoster },
    'segment-eraser': { webm: classicSegmentEraserWebm, poster: classicSegmentEraserPoster },
    paint: { webm: classicPaintWebm, poster: classicPaintPoster },
    'paint-eraser': { webm: classicPaintEraserWebm, poster: classicPaintEraserPoster },
    'clear-paint': { webm: classicClearPaintWebm, poster: classicClearPaintPoster },
    'reset-edits': { webm: classicResetEditsWebm, poster: classicResetEditsPoster },
    'area-select': { webm: classicAreaSelectWebm, poster: classicAreaSelectPoster },
    config: { webm: classicConfigWebm, poster: classicConfigPoster },
    'clear-page': { webm: classicClearPageWebm, poster: classicClearPagePoster },
  },
};

export const KOMA_STAGE_MEDIA: Readonly<
  Record<'noir' | 'classic', Readonly<Record<AioStageDemoKind, MotionMediaAsset>>>
> = {
  noir: {
    detectText: { webm: noirStageDetectWebm, poster: noirStageDetectPoster },
    recognizeText: { webm: noirStageOcrWebm, poster: noirStageOcrPoster },
    getTranslations: { webm: noirStageTranslateWebm, poster: noirStageTranslatePoster },
    segmentText: { webm: noirStageSegmentWebm, poster: noirStageSegmentPoster },
    cleanImage: { webm: noirStageCleanWebm, poster: noirStageCleanPoster },
    render: { webm: noirStageRenderWebm, poster: noirStageRenderPoster },
  },
  classic: {
    detectText: { webm: classicStageDetectWebm, poster: classicStageDetectPoster },
    recognizeText: { webm: classicStageOcrWebm, poster: classicStageOcrPoster },
    getTranslations: { webm: classicStageTranslateWebm, poster: classicStageTranslatePoster },
    segmentText: { webm: classicStageSegmentWebm, poster: classicStageSegmentPoster },
    cleanImage: { webm: classicStageCleanWebm, poster: classicStageCleanPoster },
    render: { webm: classicStageRenderWebm, poster: classicStageRenderPoster },
  },
};

export function isMascotClipPose(pose: string): pose is KomaMascotClipPose {
  return pose in KOMA_MASCOT_MEDIA;
}
