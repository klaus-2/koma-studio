export interface CalibrationMeasurementView {
  megapixels: number;
  status: 'ok' | 'failed';
  throughputImagesPerSecond: number | null;
  peakVramMb: number | null;
  downscaled: boolean;
  effectiveMegapixels: number | null;
}

export interface CalibrationReportView {
  status: 'ok' | 'failed';
  deviceName: string;
  deviceHasGpu: boolean;
  totalVramMb: number | null;
  wallClockSeconds: number;
  measurements: CalibrationMeasurementView[];
  recommendedWorkingResolution: number | null;
  error: string | null;
}

export type CalibrationLastResult = CalibrationReportView | { status: 'never-run' };

export interface CalibrationTunableApply {
  applyRecommendation: (megapixels: number) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'failed';
}

export type CalibrationDialogPhase = 'offer' | 'running' | 'result' | 'error';

export interface CalibrationOfferController {
  open: boolean;
  phase: CalibrationDialogPhase;
  report: CalibrationReportView | null;
  runError: boolean;
  applyStatus: CalibrationTunableApply['saveStatus'];
  accept: () => void;
  decline: () => void;
  apply: () => void;
  close: () => void;
}
