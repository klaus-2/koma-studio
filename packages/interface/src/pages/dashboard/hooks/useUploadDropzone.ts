import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

import { collectDroppedFiles } from "@/pages/dashboard/lib/dropped-folders";

interface NativeDropzoneOptions {
  onDrop: (
    files: File[],
    folders?: ReadonlyMap<File, string>,
  ) => void | Promise<void>;
  accept: Record<string, string[]>;
  disabled?: boolean;
}

interface NativeDropzoneApi {
  getRootProps: () => Record<string, unknown>;
  getInputProps: () => Record<string, unknown>;
  isDragActive: boolean;
}

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
};

export function useUploadDropzone({
  onDrop,
  accept,
  disabled = false,
}: NativeDropzoneOptions): NativeDropzoneApi {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [isDragActive, setIsDragActive] = useState(false);

  const acceptedExtensions = useMemo(
    () =>
      new Set(
        Object.values(accept)
          .flat()
          .map((extension) => extension.toLowerCase()),
      ),
    [accept],
  );

  const acceptedMimeTypes = useMemo(
    () =>
      new Set(
        Object.keys(accept).filter((mime) => !mime.endsWith("/*")),
      ),
    [accept],
  );

  const acceptedMimePrefixes = useMemo(
    () =>
      Object.keys(accept)
        .filter((mime) => mime.endsWith("/*"))
        .map((mime) => mime.slice(0, -1)),
    [accept],
  );

  const acceptsFile = useCallback(
    (file: File): boolean =>
      acceptedMimeTypes.has(file.type) ||
      acceptedMimePrefixes.some((prefix) => file.type.startsWith(prefix)) ||
      acceptedExtensions.has(extensionOf(file.name)),
    [acceptedExtensions, acceptedMimePrefixes, acceptedMimeTypes],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]): void => {
      const accepted = Array.from(files).filter(acceptsFile);
      if (accepted.length > 0) {
        void onDrop(accepted);
      }
    },
    [acceptsFile, onDrop],
  );

  const openPicker = useCallback((): void => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>): void => {
      const target = event.target;
      if (target instanceof Element && target.closest("button, a, input")) {
        return;
      }
      openPicker();
    },
    [openPicker],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>): void => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPicker();
      }
    },
    [openPicker],
  );

  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLElement>): void => {
      event.preventDefault();
      if (disabled) return;
      dragDepth.current += 1;
      setIsDragActive(true);
    },
    [disabled],
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLElement>): void => {
      event.preventDefault();
      if (!disabled) {
        event.dataTransfer.dropEffect = "copy";
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLElement>): void => {
      event.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) {
        setIsDragActive(false);
      }
    },
    [],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>): void => {
      event.preventDefault();
      dragDepth.current = 0;
      setIsDragActive(false);
      if (disabled) return;

      const dataTransfer = event.dataTransfer;

      void collectDroppedFiles(dataTransfer, acceptsFile).then((dropped) => {
        if (dropped.length === 0) {
          return;
        }

        const files = dropped.map(({ file }) => file);
        const folders = new Map<File, string>();

        for (const { file, folder } of dropped) {
          if (folder) {
            folders.set(file, folder);
          }
        }

        void onDrop(files, folders);
      });
    },
    [acceptsFile, disabled, onDrop],
  );

  const getRootProps = useCallback(
    (): Record<string, unknown> => ({
      onClick: handleClick,
      onKeyDown: handleKeyDown,
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
      role: "button",
      tabIndex: disabled ? -1 : 0,
      "aria-disabled": disabled || undefined,
    }),
    [
      disabled,
      handleClick,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      handleKeyDown,
    ],
  );

  const getInputProps = useCallback(
    (): Record<string, unknown> => ({
      ref: inputRef,
      type: "file",
      multiple: true,
      accept: Array.from(acceptedExtensions).join(","),
      disabled,
      style: { display: "none" },
      onChange: (event: ChangeEvent<HTMLInputElement>): void => {
        const files = event.target.files;
        if (files) {
          handleFiles(files);
        }
        event.target.value = "";
      },
    }),
    [acceptedExtensions, disabled, handleFiles],
  );

  return { getRootProps, getInputProps, isDragActive };
}
