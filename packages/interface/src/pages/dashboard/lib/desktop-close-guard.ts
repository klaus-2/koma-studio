import { desktopBridge } from '@/lib/desktop-bridge';

export interface DesktopCloseGuardRequest {
  readonly hasUnsavedWork: boolean;
  readonly batchRunning: boolean;
}

type CloseGuardConsumer = (request: DesktopCloseGuardRequest) => void;

let pendingRequests: DesktopCloseGuardRequest[] = [];
let consumer: CloseGuardConsumer | null = null;
let subscriptionInstalled = false;

export const installCloseGuardSubscription = (): void => {
  if (subscriptionInstalled) {
    return;
  }
  const bridge = desktopBridge.desktop;
  if (!bridge?.onCloseRequested) {
    return;
  }
  subscriptionInstalled = true;
  bridge.onCloseRequested((payload) => {
    const request: DesktopCloseGuardRequest = {
      hasUnsavedWork: payload.hasUnsavedWork,
      batchRunning: payload.batchRunning,
    };
    if (consumer) {
      consumer(request);
      return;
    }
    pendingRequests = [...pendingRequests, request];
  });
};

export const setCloseGuardConsumer = (
  handler: CloseGuardConsumer | null,
): void => {
  consumer = handler;
  if (!handler || pendingRequests.length === 0) {
    return;
  }
  const drained = pendingRequests;
  pendingRequests = [];
  for (const request of drained) {
    handler(request);
  }
};
