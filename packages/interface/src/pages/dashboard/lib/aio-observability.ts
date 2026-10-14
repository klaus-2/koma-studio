export type AioOperationalEvent =
  | 'batch-started'
  | 'batch-completed'
  | 'execution-failed'
  | 'execution-timeout'
  | 'notification-failed'
  | 'runtime-sync-failed'
  | 'device-info-failed'
  | 'storage-read-failed'
  | 'storage-write-failed'
  | 'storage-validation-failed'
  | 'manual-snapshot-sync-failed'
  | 'backend-restart-failed';

interface AioOperationalFields {
  readonly scope?: 'auto' | 'manual';
  readonly pages?: number;
  readonly concurrency?: number;
}

export function reportAioEvent(
  event: AioOperationalEvent,
  fields: AioOperationalFields = {},
): void {
  if (!import.meta.env.DEV) {
    return;
  }

  console.info({
    domain: 'aio',
    event,
    ...fields,
  });
}

export async function runAioNotification(
  notification: () => unknown,
): Promise<void> {
  try {
    await notification();
  } catch {
    reportAioEvent('notification-failed');
  }
}
