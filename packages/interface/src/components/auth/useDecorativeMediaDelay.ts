import { useEffect, useState } from "react";

// Decorative background media is content-free: it must never compete with
// first paint, so production defers mounting it past the first paint window.
const DECORATIVE_MEDIA_DELAY_MS = import.meta.env.PROD ? 15_000 : 0;

export const useDecorativeMediaDelay = (): boolean => {
  const [showMedia, setShowMedia] = useState(() => DECORATIVE_MEDIA_DELAY_MS === 0);

  useEffect(() => {
    if (DECORATIVE_MEDIA_DELAY_MS === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowMedia(true);
    }, DECORATIVE_MEDIA_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return showMedia;
};
