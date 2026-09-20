/**
 * Wraps a dynamic `import()` loader so repeated calls share one promise.
 *
 * Used for React.lazy chunks that are preloaded at browser idle: the idle
 * preload calls the same loader React.lazy's ctor will call, so by the time
 * the component first mounts the promise is already resolved and the mount
 * does not suspend (no Suspense fallback flash). A rejected import drops the
 * memo so the next call retries a fresh import instead of caching the error.
 */
export function memoLoad<T>(loader: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | undefined;
  return () => {
    if (!promise) {
      const created = loader();
      promise = created;
      void created.catch(() => {
        if (promise === created) promise = undefined;
      });
    }
    return promise;
  };
}
