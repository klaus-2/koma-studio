import { useCallback, useEffect, useRef, useState } from 'react';
import CalibrationOfferDialogClassic from './CalibrationOfferDialogClassic';
import CalibrationOfferDialogNoir from './noir/CalibrationOfferDialogNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { buildUrl } from '../config/api';
import { fetchWithTimeoutAndRetry } from '../utils/http';
import { isRecord } from '../utils/guards';
import { useMiniBackendThreadSettings } from '../pages/settings/hooks/use-mini-backend-thread-settings';
import { useUiShellStore } from '../pages/dashboard/stores/ui-shell-store';

/* ═══ Calibration report view (backend contract: routers/calibration.py) ══ */

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

const narrowMeasurement = (
  value: unknown,
): CalibrationMeasurementView | null => {
  if (!isRecord(value)) return null;
  const { megapixels, status } = value;
  if (
    typeof megapixels !== 'number' ||
    (status !== 'ok' && status !== 'failed')
  ) {
    return null;
  }
  return {
    megapixels,
    status,
    throughputImagesPerSecond:
      typeof value.throughput_images_per_second === 'number'
        ? value.throughput_images_per_second
        : null,
    peakVramMb:
      typeof value.peak_vram_mb === 'number' ? value.peak_vram_mb : null,
    downscaled: value.downscaled === true,
    effectiveMegapixels:
      typeof value.effective_megapixels === 'number'
        ? value.effective_megapixels
        : null,
  };
};

/** Narrows the raw report JSON into the view the dialogs render. */
export const narrowCalibrationReport = (
  value: unknown,
): CalibrationReportView | null => {
  if (!isRecord(value)) return null;
  const { status } = value;
  if (status !== 'ok' && status !== 'failed') return null;
  const device = isRecord(value.device) ? value.device : {};
  const rawResults: unknown[] = Array.isArray(value.results) ? value.results : [];
  const measurements = rawResults
    .map(narrowMeasurement)
    .filter((entry): entry is CalibrationMeasurementView => entry !== null);
  return {
    status,
    deviceName: typeof device.name === 'string' ? device.name : '',
    deviceHasGpu: device.has_gpu === true,
    totalVramMb:
      typeof device.total_vram_mb === 'number' ? device.total_vram_mb : null,
    wallClockSeconds:
      typeof value.wall_clock_seconds === 'number'
        ? value.wall_clock_seconds
        : 0,
    measurements,
    recommendedWorkingResolution:
      typeof value.recommended_working_resolution === 'number'
        ? value.recommended_working_resolution
        : null,
    error: typeof value.error === 'string' ? value.error : null,
  };
};

/** `GET /calibration/last` response: a report or the never-run marker. */
export const narrowCalibrationLastResult = (
  value: unknown,
): CalibrationLastResult | null => {
  if (!isRecord(value)) return null;
  if (value.status === 'never-run') return { status: 'never-run' };
  return narrowCalibrationReport(value);
};

/* ═══ Calibration client ═══ */

/** Runs the sidecar benchmark; throws on HTTP/transport/payload failure. */
export const runCalibrationBenchmark = async (): Promise<CalibrationReportView> => {
  // The benchmark is capped at a 20s wall-clock budget plus model load.
  const response = await fetchWithTimeoutAndRetry(
    buildUrl('localUrl', '/calibration/run'),
    { method: 'POST' },
    { timeoutMs: 60_000, retryCount: 0 },
  );
  const payload: unknown = await response.json();
  if (!response.ok) throw new Error('CALIBRATION_RUN_HTTP_ERROR');
  const report = narrowCalibrationReport(payload);
  if (report === null) throw new Error('CALIBRATION_RUN_BAD_PAYLOAD');
  return report;
};

/** Loads the last persisted report (or the never-run marker). */
export const fetchLastCalibrationReport = async (): Promise<CalibrationLastResult> => {
  const response = await fetchWithTimeoutAndRetry(
    buildUrl('localUrl', '/calibration/last'),
    { method: 'GET' },
    { timeoutMs: 10_000, retryCount: 0 },
  );
  const payload: unknown = await response.json();
  if (!response.ok) throw new Error('CALIBRATION_LAST_HTTP_ERROR');
  const result = narrowCalibrationLastResult(payload);
  if (result === null) throw new Error('CALIBRATION_LAST_BAD_PAYLOAD');
  return result;
};

/* ═══ First-run offer flag ═══ */

const CALIBRATION_OFFER_STORAGE_KEY = 'koma-studio.calibration-offer.v1';

/** True once the user answered the offer (accept OR decline) on any run. */
export const hasCalibrationOfferBeenAnswered = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(CALIBRATION_OFFER_STORAGE_KEY);
    if (raw === null) return false;
    return isRecord(JSON.parse(raw));
  } catch {
    return false;
  }
};

export const markCalibrationOfferAnswered = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      CALIBRATION_OFFER_STORAGE_KEY,
      JSON.stringify({ answeredAt: new Date().toISOString() }),
    );
  } catch {
    // Quota-blocked localStorage must not break the dialog flow.
  }
};

/* ═══ Tunable apply (through the settings hook's existing save flow) ═══ */

export interface CalibrationTunableApply {
  /** Writes the recommendation through the mini-backend tunables save flow. */
  applyRecommendation: (megapixels: number) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'failed';
}

/**
 * The settings hook's save closes over its draft state, so the draft update
 * and the save are one render apart: `applyRecommendation` marks the pending
 * flag and the effect fires the existing save after the draft landed.
 */
export const useCalibrationTunableApply = (): CalibrationTunableApply => {
  const {
    setMiniBackendTunables,
    handleSaveMiniBackendTunables,
    tunablesSaveStatus,
  } = useMiniBackendThreadSettings();
  const pendingApplyRef = useRef(false);
  useEffect(() => {
    if (!pendingApplyRef.current) return;
    pendingApplyRef.current = false;
    handleSaveMiniBackendTunables();
  }, [handleSaveMiniBackendTunables]);
  const applyRecommendation = useCallback(
    (megapixels: number) => {
      pendingApplyRef.current = true;
      setMiniBackendTunables((prev) => ({
        ...prev,
        workingResolutionMegapixels: megapixels,
      }));
    },
    [setMiniBackendTunables],
  );
  return { applyRecommendation, saveStatus: tunablesSaveStatus };
};

/* ═══ Offer controller ═══ */

export type CalibrationDialogPhase = 'offer' | 'running' | 'result' | 'error';

export interface CalibrationOfferController {
  open: boolean;
  phase: CalibrationDialogPhase;
  report: CalibrationReportView | null;
  /** True when the benchmark POST failed (transport/HTTP/payload). */
  runError: boolean;
  applyStatus: CalibrationTunableApply['saveStatus'];
  accept: () => void;
  decline: () => void;
  apply: () => void;
  close: () => void;
}

const useCalibrationOfferController = (): CalibrationOfferController => {
  const processing = useUiShellStore((s) => s.processing);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<CalibrationDialogPhase>('offer');
  const [report, setReport] = useState<CalibrationReportView | null>(null);
  const [runError, setRunError] = useState(false);
  const { applyRecommendation, saveStatus } = useCalibrationTunableApply();

  // First dashboard entry without a recorded answer and without an active
  // processing run — never while processing.
  useEffect(() => {
    if (processing) return;
    if (hasCalibrationOfferBeenAnswered()) return;
    setOpen(true);
  }, [processing]);

  const accept = useCallback(() => {
    markCalibrationOfferAnswered();
    setPhase('running');
    void (async () => {
      try {
        const result = await runCalibrationBenchmark();
        setReport(result);
        setPhase('result');
      } catch {
        setRunError(true);
        setPhase('error');
      }
    })();
  }, []);

  const decline = useCallback(() => {
    markCalibrationOfferAnswered();
    setOpen(false);
  }, []);

  const close = useCallback(() => {
    // Any dismissal (X / Fechar / ESC) also counts as an answer: the flag
    // stops the offer effect from reopening on the next processing→idle
    // transition or dashboard mount.
    markCalibrationOfferAnswered();
    setOpen(false);
  }, []);

  const apply = useCallback(() => {
    const recommendation = report?.recommendedWorkingResolution;
    if (typeof recommendation !== 'number') return;
    applyRecommendation(recommendation);
  }, [applyRecommendation, report]);

  return {
    open,
    phase,
    report,
    runError,
    applyStatus: saveStatus,
    accept,
    decline,
    apply,
    close,
  } satisfies CalibrationOfferController;
};

const CalibrationOfferDialogFamily = createFamilyComponent(
  CalibrationOfferDialogClassic,
  CalibrationOfferDialogNoir,
);

/** First-run calibration offer dialog. */
export function CalibrationOfferDialog() {
  const controller = useCalibrationOfferController();
  if (!controller.open) return null;
  return <CalibrationOfferDialogFamily controller={controller} />;
}

export default CalibrationOfferDialog;
