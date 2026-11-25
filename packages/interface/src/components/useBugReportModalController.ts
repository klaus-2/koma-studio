import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type MouseEvent,
  type RefObject,
  type SetStateAction,
} from 'react';
import type {
  DesktopBugReportPrepareResult,
  DesktopBugReportSubmitPayload,
} from '@shared/desktop-api';

import { useI18n, type TranslateFn } from '../i18n';
import { desktopBridge } from '@/lib/desktop-bridge';
import { canOpenLogsFolder, openLogsFolderOrReport } from '@/lib/open-logs-folder';
import { useBugReportPrepare } from './useBugReportPrepare';

export interface BugReportModalContext {
  mode?: string;
  statusMessage?: string;
  route?: string;
  userEmail?: string;
}

export interface BugReportModalProps {
  open: boolean;
  onClose: () => void;
  context?: BugReportModalContext;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ManualAttachment {
  id: string;
  file: File;
}

export interface BugReportModalController {
  t: TranslateFn;
  prep: DesktopBugReportPrepareResult | null;
  prepLoading: boolean;
  screenshot: string | null;
  rect: CropRect | null;
  totalBytes: number;
  canSubmit: boolean;
  showOpenLogsFolder: boolean;
  title: string;
  setTitle: Dispatch<SetStateAction<string>>;
  desc: string;
  setDesc: Dispatch<SetStateAction<string>>;
  includeLogs: boolean;
  setIncludeLogs: Dispatch<SetStateAction<boolean>>;
  steps: string;
  setSteps: Dispatch<SetStateAction<string>>;
  expected: string;
  setExpected: Dispatch<SetStateAction<string>>;
  actual: string;
  setActual: Dispatch<SetStateAction<string>>;
  contact: string;
  setContact: Dispatch<SetStateAction<string>>;
  crop: CropRect | null;
  setCrop: Dispatch<SetStateAction<CropRect | null>>;
  wrapRef: RefObject<HTMLDivElement | null>;
  imgRef: RefObject<HTMLImageElement | null>;
  attachments: ManualAttachment[];
  attachErr: string | null;
  loading: boolean;
  err: string | null;
  success: string | null;
  addFiles: (e: ChangeEvent<HTMLInputElement>) => void;
  rmAttach: (id: string) => void;
  onDown: (e: MouseEvent) => void;
  onMove: (e: MouseEvent) => void;
  onUp: () => void;
  openLogsFolder: () => void;
  submit: () => Promise<void>;
}

export const MAX_ATTACH = 4;
export const MAX_FILE = 5 * 1024 * 1024;
export const MAX_TOTAL = 20 * 1024 * 1024;
export const BUG_REPORT_API_URL =
  import.meta.env.VITE_BUG_REPORT_API_URL ??
  'https://koma-studio.site/api/bug-reports';

const mkId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const fmtBytes = (v: number): string => {
  if (!Number.isFinite(v) || v <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = v;
  let unitIndex = 0;
  for (; unitIndex < units.length - 1 && value >= 1024; unitIndex += 1) {
    value /= 1024;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex] ?? 'GB'}`;
};

export const toB64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(out);
};

export const loadImg = (
  src: string,
  t: TranslateFn,
): Promise<HTMLImageElement> =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img), { once: true });
    img.addEventListener(
      'error',
      () => reject(new Error(t('bugReport.error.imgLoadFailed'))),
      { once: true },
    );
    img.src = src;
  });

export const cropDataUrl = async (
  src: string,
  rect: CropRect,
  size: { width: number; height: number },
  t: TranslateFn,
): Promise<string> => {
  const img = await loadImg(src, t);
  const sx = img.naturalWidth / Math.max(1, size.width);
  const sy = img.naturalHeight / Math.max(1, size.height);
  const cx = Math.max(0, Math.floor(rect.x * sx));
  const cy = Math.max(0, Math.floor(rect.y * sy));
  const cw = Math.max(1, Math.floor(rect.width * sx));
  const ch = Math.max(1, Math.floor(rect.height * sy));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(t('bugReport.error.canvasFailed'));
  ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
  return canvas.toDataURL('image/png', 1);
};

export const useBugReportModalController = ({
  open,
  context,
}: Pick<BugReportModalProps, 'open' | 'context'>): BugReportModalController => {
  const { t } = useI18n();
  const { prep, prepLoading } = useBugReportPrepare(open);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [includeLogs, setIncludeLogs] = useState(true);
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [contact, setContact] = useState('');
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [drag, setDrag] = useState<CropRect | null>(null);
  const draggingRef = useRef(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const pendingDragRef = useRef<CropRect | null>(null);
  const dragFrameRef = useRef<number | null>(null);

  const cancelDragFrame = useCallback(() => {
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    pendingDragRef.current = null;
  }, []);

  useEffect(() => cancelDragFrame, [cancelDragFrame]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [attachments, setAttachments] = useState<ManualAttachment[]>([]);
  const [attachErr, setAttachErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const api = desktopBridge.desktop?.api?.bugReport;
  const screenshot = prep?.screenshotDataUrl ?? null;
  const rect = drag ?? crop;
  const totalBytes = useMemo(
    () => attachments.reduce((sum, item) => sum + item.file.size, 0),
    [attachments],
  );
  const canSubmit =
    Boolean(title.trim()) &&
    Boolean(desc.trim()) &&
    Boolean(screenshot) &&
    Boolean(prep?.ready) &&
    !loading;
  const showOpenLogsFolder = canOpenLogsFolder();

  const reset = useCallback(() => {
    setTitle('');
    setDesc('');
    setIncludeLogs(true);
    setSteps('');
    setExpected('');
    setActual('');
    setContact('');
    setCrop(null);
    setDrag(null);
    draggingRef.current = false;
    dragStart.current = null;
    cancelDragFrame();
    setAttachments([]);
    setAttachErr(null);
    setErr(null);
    setSuccess(null);
  }, [cancelDragFrame]);

  useEffect(() => {
    if (!open) return;
    reset();
  }, [open, reset]);

  const addFiles = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.currentTarget.value = '';
      if (!files.length) return;
      setAttachErr(null);
      const next = [...attachments];
      for (const f of files) {
        if (next.length >= MAX_ATTACH) {
          setAttachErr(t('bugReport.attach.maxCount', { count: MAX_ATTACH }));
          break;
        }
        if (f.size > MAX_FILE) {
          setAttachErr(
            t('bugReport.attach.fileTooLarge', {
              name: f.name,
              size: Math.round(MAX_FILE / 1048576),
            }),
          );
          continue;
        }
        if (next.reduce((sum, item) => sum + item.file.size, 0) + f.size > MAX_TOTAL) {
          setAttachErr(
            t('bugReport.attach.totalTooLarge', {
              size: Math.round(MAX_TOTAL / 1048576),
            }),
          );
          break;
        }
        next.push({ id: mkId(), file: f });
      }
      setAttachments(next);
    },
    [attachments, t],
  );

  const rmAttach = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
    setAttachErr(null);
  }, []);

  const relPt = useCallback((cx: number, cy: number) => {
    const holder = wrapRef.current;
    if (!holder) return null;
    const bounds = holder.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(bounds.width, cx - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, cy - bounds.top)),
      w: bounds.width,
      h: bounds.height,
    };
  }, []);

  const onDown = useCallback(
    (e: MouseEvent) => {
      if (!screenshot) return;
      const point = relPt(e.clientX, e.clientY);
      if (!point) return;
      cancelDragFrame();
      dragStart.current = { x: point.x, y: point.y };
      setDrag({ x: point.x, y: point.y, width: 0, height: 0 });
      draggingRef.current = true;
    },
    [cancelDragFrame, relPt, screenshot],
  );

  const onMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingRef.current || !dragStart.current) return;
      const point = relPt(e.clientX, e.clientY);
      if (!point) return;
      pendingDragRef.current = {
        x: Math.min(dragStart.current.x, point.x),
        y: Math.min(dragStart.current.y, point.y),
        width: Math.abs(point.x - dragStart.current.x),
        height: Math.abs(point.y - dragStart.current.y),
      };
      if (dragFrameRef.current === null) {
        dragFrameRef.current = requestAnimationFrame(() => {
          dragFrameRef.current = null;
          if (pendingDragRef.current) {
            setDrag(pendingDragRef.current);
            pendingDragRef.current = null;
          }
        });
      }
    },
    [relPt],
  );

  const onUp = useCallback(() => {
    const flushedRect = pendingDragRef.current;
    cancelDragFrame();
    const cropDecision = flushedRect ?? drag;
    if (cropDecision) {
      setCrop(cropDecision.width >= 8 && cropDecision.height >= 8 ? cropDecision : null);
    }
    setDrag(null);
    draggingRef.current = false;
    dragStart.current = null;
  }, [cancelDragFrame, drag]);

  const getScreenshot = useCallback(async () => {
    if (!screenshot) throw new Error(t('bugReport.error.noScreenshot'));
    if (!crop || !imgRef.current) return screenshot;
    const bounds = imgRef.current.getBoundingClientRect();
    return cropDataUrl(
      screenshot,
      crop,
      { width: bounds.width, height: bounds.height },
      t,
    );
  }, [crop, screenshot, t]);

  const openLogsFolder = useCallback(() => {
    void openLogsFolderOrReport(() => {
      setAttachErr(t('diagnostics.openLogsFolderError'));
    });
  }, [t]);

  const submit = useCallback(async () => {
    if (!api || !prep?.ready) {
      setErr(prep?.error ?? t('bugReport.error.bridgeUnavailable'));
      return;
    }
    if (!title.trim() || !desc.trim()) {
      setErr(t('bugReport.error.fillTitleDescription'));
      return;
    }
    setLoading(true);
    setErr(null);
    setSuccess(null);
    try {
      const ss = await getScreenshot();
      const atts = await Promise.all(
        attachments.map(async ({ file }) => ({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          contentBase64: toB64(await file.arrayBuffer()),
        })),
      );
      const payload: DesktopBugReportSubmitPayload = {
        title: title.trim(),
        description: desc.trim(),
        stepsToReproduce: steps.trim() || undefined,
        expectedResult: expected.trim() || undefined,
        actualResult: actual.trim() || undefined,
        contact: contact.trim() || undefined,
        endpointUrl: BUG_REPORT_API_URL,
        includeLogs,
        screenshotDataUrl: ss,
        autoLogIds: prep.autoLogs.map((l) => l.id),
        attachments: atts,
        context: {
          mode: context?.mode,
          statusMessage: context?.statusMessage,
          route: context?.route,
          userEmail: context?.userEmail,
        },
      };
      const res = await api.submit(payload);
      if (!res.ok) {
        setErr(res.error ?? t('bugReport.error.generic'));
        return;
      }
      setSuccess(t('bugReport.success.sent'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('bugReport.error.generic'));
    } finally {
      setLoading(false);
    }
  }, [
    api,
    attachments,
    contact,
    context,
    desc,
    expected,
    actual,
    getScreenshot,
    includeLogs,
    prep,
    steps,
    t,
    title,
  ]);

  return {
    t,
    prep,
    prepLoading,
    screenshot,
    rect,
    totalBytes,
    canSubmit,
    showOpenLogsFolder,
    title,
    setTitle,
    desc,
    setDesc,
    includeLogs,
    setIncludeLogs,
    steps,
    setSteps,
    expected,
    setExpected,
    actual,
    setActual,
    contact,
    setContact,
    crop,
    setCrop,
    wrapRef,
    imgRef,
    attachments,
    attachErr,
    loading,
    err,
    success,
    addFiles,
    rmAttach,
    onDown,
    onMove,
    onUp,
    openLogsFolder,
    submit,
  };
};
