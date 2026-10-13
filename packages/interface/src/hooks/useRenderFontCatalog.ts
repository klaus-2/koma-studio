import { useCallback, useEffect, useMemo, useState } from 'react';

import { useI18n } from '../i18n';
import type { IDesktopFontEntry } from '../types';
import type { RenderFontCatalog } from '../types/dashboard.types';
import { buildFontCatalog, getFontCatalogFallbackFamilies } from '../utils/font-catalog';
import { arrayBufferToBase64, resetLoadedCanvasFontCache } from '../utils/dashboard.utils';

import { desktopBridge } from "@/lib/desktop-bridge";
import { publishFontCatalog } from "@/lib/font-catalog-cache";
interface UseRenderFontCatalogArgs {
  onImportSuccess: (message: string) => void;
}

export function useRenderFontCatalog({ onImportSuccess }: UseRenderFontCatalogArgs) {
  const { t } = useI18n();
  const [renderFontCatalog, setRenderFontCatalog] = useState<RenderFontCatalog>({ system: [], custom: [] });
  const [fontCatalogLoading, setFontCatalogLoading] = useState(false);
  const [fontCatalogImporting, setFontCatalogImporting] = useState(false);
  const [fontCatalogError, setFontCatalogError] = useState<string | null>(null);
  const [renderFontRefreshToken, setRenderFontRefreshToken] = useState(0);

  const registerCustomFontFace = useCallback(async (entry: IDesktopFontEntry) => {
    if (typeof window === 'undefined') return;
    if (typeof FontFace === 'undefined') return;
    if (!('fonts' in document)) return;
    const fontFace = new FontFace(entry.family, `url(${entry.dataUrl})`);
    await fontFace.load();
    document.fonts.add(fontFace);
  }, []);

  const loadRenderFontCatalog = useCallback(async () => {
    const desktopFontsApi = desktopBridge.desktop?.api?.fonts;
    if (!desktopFontsApi) {
      setRenderFontCatalog({ system: [], custom: [] });
      setFontCatalogError(null);
      resetLoadedCanvasFontCache();
      return;
    }

    setFontCatalogLoading(true);
    setFontCatalogError(null);
    try {
      const payload = await desktopFontsApi.list();
      const normalizedCatalog: RenderFontCatalog = {
        system: Array.isArray(payload?.system) ? payload.system.filter((item): item is string => typeof item === 'string') : [],
        custom: Array.isArray(payload?.custom) ? payload.custom.filter((item): item is IDesktopFontEntry => (
          Boolean(item)
          && typeof item.id === 'string'
          && typeof item.family === 'string'
          && typeof item.fileName === 'string'
          && typeof item.dataUrl === 'string'
        )) : [],
      };

      await Promise.all(
        normalizedCatalog.custom.map(async (fontEntry) => {
          try {
            await registerCustomFontFace(fontEntry);
          } catch {
            /* ignore invalid custom fonts and keep remaining catalog */
          }
        }),
      );

      resetLoadedCanvasFontCache();
      setRenderFontCatalog(normalizedCatalog);
      setRenderFontRefreshToken((prev) => prev + 1);
    } catch (error) {
      setFontCatalogError(error instanceof Error ? error.message : t('renderFontCatalog.loadFailed'));
    } finally {
      setFontCatalogLoading(false);
    }
  }, [registerCustomFontFace]);

  const handleRenderFontImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const desktopFontsApi = desktopBridge.desktop?.api?.fonts;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !desktopFontsApi) return;

    setFontCatalogImporting(true);
    setFontCatalogError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      await desktopFontsApi.import({
        fileName: file.name,
        contentBase64: base64,
        family: file.name.replace(/\.[^.]+$/, ''),
      });
      await loadRenderFontCatalog();
      onImportSuccess(`Font "${file.name}" imported successfully.`);
    } catch (error) {
      setFontCatalogError(error instanceof Error ? error.message : 'Failed to import the font.');
    } finally {
      setFontCatalogImporting(false);
    }
  }, [loadRenderFontCatalog, onImportSuccess]);

  useEffect(() => {
    void loadRenderFontCatalog();
  }, [loadRenderFontCatalog]);

  const availableRenderFonts = useMemo(() => buildFontCatalog({
    osFamilies: renderFontCatalog.system,
    customFamilies: renderFontCatalog.custom.map((fontEntry) => fontEntry.family),
    fallbackFamilies: getFontCatalogFallbackFamilies(),
  }), [renderFontCatalog.custom, renderFontCatalog.system]);

  useEffect(() => {
    publishFontCatalog(availableRenderFonts);
  }, [availableRenderFonts]);

  return {
    availableRenderFonts,
    renderFontCatalog,
    fontCatalogLoading,
    fontCatalogImporting,
    fontCatalogError,
    renderFontRefreshToken,
    loadRenderFontCatalog,
    handleRenderFontImport,
  };
}
