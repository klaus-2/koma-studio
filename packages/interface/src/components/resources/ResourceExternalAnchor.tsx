import { type AnchorHTMLAttributes, type MouseEvent, useCallback } from 'react';

import { desktopBridge } from "@/lib/desktop-bridge";
interface ResourceExternalAnchorProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
}

const normalizeExternalUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return '';
  }

  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
};

const openExternalFallback = (targetUrl: string): void => {
  const popup = window.open(targetUrl, '_blank', 'noopener,noreferrer');
  popup?.focus();
};

export default function ResourceExternalAnchor({
  href,
  rel,
  target,
  onClick,
  ...props
}: ResourceExternalAnchorProps) {
  const normalizedHref = normalizeExternalUrl(href);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented || !normalizedHref) {
        return;
      }

      event.preventDefault();

      const openDesktopLink = desktopBridge.desktop?.openCommunityLink ?? desktopBridge.desktop?.openExternal;
      if (typeof openDesktopLink === 'function') {
        void openDesktopLink(normalizedHref).catch(() => {
          openExternalFallback(normalizedHref);
        });
        return;
      }

      openExternalFallback(normalizedHref);
    },
    [normalizedHref, onClick],
  );

  return (
    <a
      {...props}
      href={normalizedHref || href}
      target={target ?? '_blank'}
      rel={rel ?? 'noopener noreferrer'}
      onClick={handleClick}
    />
  );
}
