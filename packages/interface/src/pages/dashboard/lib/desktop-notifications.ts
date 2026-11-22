import { desktopBridge } from '@/lib/desktop-bridge';

export interface DesktopNotificationStrings {
  readonly title: string;
  readonly body?: string;
}

export const showDesktopNotification = (
  notification: DesktopNotificationStrings,
): void => {
  const bridge = desktopBridge.desktop;
  if (!bridge?.notifications) {
    return;
  }
  bridge.notifications.show(notification).catch((error: unknown) => {
    bridge
      .sessionLog({
        level: 'warn',
        source: 'renderer',
        message: `desktop notification failed: ${error instanceof Error ? error.message : String(error)}`,
      })
      .catch(() => undefined);
  });
};
