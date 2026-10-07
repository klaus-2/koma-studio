'use client';

import {
  type AnchorHTMLAttributes,
  type MouseEvent,
  useCallback,
} from 'react';

interface ResourceExternalAnchorProps
  extends Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'href'
  > {
  href: string;
}

interface DesktopBridge {
  openCommunityLink?: (
    url: string,
  ) => unknown;
  openExternal?: (
    url: string,
  ) => unknown;
}

type DesktopWindow = Window & {
  desktop?: DesktopBridge;
};

const DANGEROUS_PROTOCOL =
  /^(?:javascript|data|vbscript|file):/i;

export function normalizeExternalUrl(
  rawUrl: string,
): string {
  const trimmed = rawUrl.trim();

  if (
    !trimmed ||
    DANGEROUS_PROTOCOL.test(trimmed)
  ) {
    return '';
  }

  if (
    /^[a-z][a-z\d+.-]*:/i.test(
      trimmed,
    )
  ) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function openExternalFallback(
  targetUrl: string,
): void {
  const popup = window.open(
    targetUrl,
    '_blank',
    'noopener,noreferrer',
  );

  popup?.focus();
}

export default function ResourceExternalAnchorV2({
  href,
  rel,
  target,
  onClick,
  children,
  ...props
}: ResourceExternalAnchorProps) {
  const normalizedHref =
    normalizeExternalUrl(href);

  const handleClick = useCallback(
    (
      event: MouseEvent<HTMLAnchorElement>,
    ) => {
      onClick?.(event);

      if (
        event.defaultPrevented ||
        !normalizedHref
      ) {
        event.preventDefault();
        return;
      }

      event.preventDefault();

      const desktopWindow =
        window as DesktopWindow;

      const openDesktopLink =
        desktopWindow.desktop
          ?.openCommunityLink ??
        desktopWindow.desktop
          ?.openExternal;

      if (
        typeof openDesktopLink ===
        'function'
      ) {
        try {
          void Promise.resolve(
            openDesktopLink(normalizedHref),
          ).catch(() => {
            openExternalFallback(
              normalizedHref,
            );
          });
        } catch {
          openExternalFallback(
            normalizedHref,
          );
        }

        return;
      }

      openExternalFallback(
        normalizedHref,
      );
    },
    [normalizedHref, onClick],
  );

  return (
    <a
      {...props}
      href={normalizedHref || '#'}
      target={target ?? '_blank'}
      rel={
        rel ?? 'noopener noreferrer'
      }
      aria-disabled={
        !normalizedHref || undefined
      }
      tabIndex={
        normalizedHref
          ? props.tabIndex
          : -1
      }
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
