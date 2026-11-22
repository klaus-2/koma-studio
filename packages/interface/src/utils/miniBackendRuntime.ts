import type { DesktopMiniBackendRuntimeState } from '../types';

type RuntimeStatus = DesktopMiniBackendRuntimeState['status'];

const SERVING_STATUSES: ReadonlySet<RuntimeStatus> = new Set(['ready', 'fallback']);
const STARTING_STATUSES: ReadonlySet<RuntimeStatus> = new Set([
  'resolving',
  'checking',
  'downloading',
  'verifying',
  'extracting',
  'starting',
]);

/**
 * Whether a mini-backend with this status answers requests. Unknown states
 * (null/absent) count as serving: the desktop bridge is the only source that
 * tracks the sidecar, and a missing reading must not block the user.
 */
export const isMiniBackendRuntimeServing = (
  status: RuntimeStatus | null | undefined,
): boolean => status === null || status === undefined || SERVING_STATUSES.has(status);

export const isMiniBackendRuntimeStarting = (
  status: RuntimeStatus | null | undefined,
): boolean => status !== null && status !== undefined && STARTING_STATUSES.has(status);
