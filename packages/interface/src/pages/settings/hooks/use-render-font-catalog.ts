import { useCallback, useEffect, useMemo, useState } from 'react';

import { desktopBridge } from '@/lib/desktop-bridge';
import type { IDesktopFontEntry } from '../../../types';
import { buildFontCatalog, getFontCatalogFallbackFamilies } from '../../../utils/font-catalog';
import type { RenderFontCatalog } from '../settings.types';

export const useRenderFontCatalog = () => {
  const [renderFontCatalog, setRenderFontCatalog] = useState<RenderFontCatalog>({ system: [], custom: [] });

  const loadRenderFontCatalog = useCallback(async () => {
    const desktopFontsApi = desktopBridge.desktop?.api?.fonts;
    if (!desktopFontsApi) {
      setRenderFontCatalog({ system: [], custom: [] });
      return;
    }
    try {
      const payload = await desktopFontsApi.list();
      const normalizedCatalog: RenderFontCatalog = {
        system: Array.isArray(payload?.system) ? payload.system.filter((item): item is string => typeof item === "string") : [],
        custom: Array.isArray(payload?.custom) ? payload.custom.filter((item): item is IDesktopFontEntry => (
          Boolean(item)
          && typeof item.id === "string"
          && typeof item.family === "string"
          && typeof item.fileName === "string"
          && typeof item.dataUrl === "string"
        )) : [],
      };
      setRenderFontCatalog(normalizedCatalog);
    } catch {
      setRenderFontCatalog({ system: [], custom: [] });
    }
  }, []);

  useEffect(() => {
    void loadRenderFontCatalog();
  }, [loadRenderFontCatalog]);

  const presetFontOptions = useMemo(() => {
    return buildFontCatalog({
      osFamilies: renderFontCatalog.system,
      customFamilies: renderFontCatalog.custom.map((fontEntry) => fontEntry.family),
      fallbackFamilies: getFontCatalogFallbackFamilies(),
    });
  }, [renderFontCatalog.custom, renderFontCatalog.system]);

  return { presetFontOptions };
};
