import { vi } from 'vitest';

class IntersectionObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

export const installJsdomBrowserStubs = (): void => {
  vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
};
