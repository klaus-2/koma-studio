import { useCallback, useEffect, useRef, useState } from 'react';
import CalibrationOfferDialogClassic from './CalibrationOfferDialogClassic';
import CalibrationOfferDialogNoir from './noir/CalibrationOfferDialogNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { buildUrl } from '../config/api';
import { fetchWithTimeoutAndRetry } from '../utils/http';
import { isRecord } from '../utils/guards';
import { useMiniBackendThreadSettings } from '../pages/settings/hooks/use-mini-backend-thread-settings';
import { useUiShellStore } from '../pages/dashboard/stores/ui-shell-store';
import { useIsOnboardingModalOpen } from './onboarding/onboardingOpenState';

import type {
  CalibrationDialogPhase,
  CalibrationLastResult,
  CalibrationMeasurementView,
  CalibrationOfferController,
  CalibrationReportView,
  CalibrationTunableApply,
} from './CalibrationOfferDialog.types';

export type {
  CalibrationDialogPhase,
  CalibrationLastResult,
  CalibrationMeasurementView,
  CalibrationOfferController,
  CalibrationReportView,
  CalibrationTunableApply,
} from './CalibrationOfferDialog.types';

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

export const narrowCalibrationLastResult = (
  value: unknown,
): CalibrationLastResult | null => {
  if (!isRecord(value)) return null;
  if (value.status === 'never-run') return { status: 'never-run' };
  return narrowCalibrationReport(value);
};

export const runCalibrationBenchmark = async (): Promise<CalibrationReportView> => {

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

const CALIBRATION_OFFER_STORAGE_KEY = 'koma-studio.calibration-offer.v1';

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

  }
};

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

const useCalibrationOfferController = (): CalibrationOfferController => {
  const processing = useUiShellStore((s) => s.processing);
  const onboardingOpen = useIsOnboardingModalOpen();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<CalibrationDialogPhase>('offer');
  const [report, setReport] = useState<CalibrationReportView | null>(null);
  const [runError, setRunError] = useState(false);
  const { applyRecommendation, saveStatus } = useCalibrationTunableApply();

  useEffect(() => {
    if (processing || onboardingOpen) return;
    if (hasCalibrationOfferBeenAnswered()) return;
    setOpen(true);
  }, [onboardingOpen, processing]);

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

export function CalibrationOfferDialog() {
  const onboardingOpen = useIsOnboardingModalOpen();
  const controller = useCalibrationOfferController();
  if (!controller.open || onboardingOpen) return null;
  return <CalibrationOfferDialogFamily controller={controller} />;
}

export default CalibrationOfferDialog;
