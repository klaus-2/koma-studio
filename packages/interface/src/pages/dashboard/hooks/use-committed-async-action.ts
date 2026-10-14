import { useCallback, useLayoutEffect, useRef } from 'react';

export function useCommittedAsyncAction(
  action: () => Promise<void>,
): () => Promise<void> {
  const actionRef = useRef<(() => Promise<void>) | null>(action);

  useLayoutEffect(() => {
    actionRef.current = action;

    return () => {
      actionRef.current = null;
    };
  }, [action]);

  return useCallback(async (): Promise<void> => {
    await actionRef.current?.();
  }, []);
}
