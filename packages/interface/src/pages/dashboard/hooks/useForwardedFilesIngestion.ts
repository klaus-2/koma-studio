import { useEffect } from "react";

import {
  ingestForwardedFilePaths,
  setForwardedFilesIngestion,
} from "../lib/forwarded-files";

interface ForwardedFilesIngestionArgs {
  onDrop: (files: File[]) => void | Promise<void>;
  setStatusMessage: (message: string) => void;
}

export function useForwardedFilesIngestion({
  onDrop,
  setStatusMessage,
}: ForwardedFilesIngestionArgs): void {
  useEffect(() => {
    setForwardedFilesIngestion((paths) => {
      void ingestForwardedFilePaths(paths, { onDrop, setStatusMessage });
    });
    return () => setForwardedFilesIngestion(null);
  }, [onDrop, setStatusMessage]);
}
