// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TooltipProvider } from '@koma/ui/components/tooltip';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopModelsApi } from '@shared/desktop-api';

import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { createDesktopBridgeStub } from '@/testing/desktop-bridge-stub';
import { useExportStore } from '@/pages/dashboard/stores/export-store';
import ClassicMenu from './KomaTopbarDownloadMenu';
import NoirMenu from './noir/KomaTopbarDownloadMenuNoir';

type MenuProps = ComponentProps<typeof ClassicMenu>;

const noop = () => undefined;

const buildProps = (): MenuProps => {
  return {
    isOpen: true,
    dropdownRef: { current: null },
    cleanerMode: false,
    translatorTextMode: false,
    translatorVisualMode: false,
    hasDownloadActions: true,
    hasDownloads: true,
    activeDownloadScope: 'all',
    outFormat: 'image/png',
    onOutFormatChange: noop,
    outQuality: 0.9,
    onOutQualityChange: noop,
    downloadBundleFormat: 'zip',
    onDownloadBundleFormatChange: noop,
    canExportAioMetadata: false,
    downloadIncludeRawText: true,
    onDownloadIncludeRawTextChange: noop,
    downloadIncludeTranslatedText: true,
    onDownloadIncludeTranslatedTextChange: noop,
    downloadIncludeInpaintedImage: true,
    onDownloadIncludeInpaintedImageChange: noop,
    hasInpaintedOutputs: false,
    onDownload: noop,
    canExportPsd: false,
    downloadPsdLoading: false,
    downloadPsdCompression: 'rle',
    onDownloadPsdCompressionChange: noop,
    downloadPsdDpi: 300,
    onDownloadPsdDpiChange: noop,
    downloadPsdIncludeOcrOverlay: true,
    onDownloadPsdIncludeOcrOverlayChange: noop,
    downloadPsdIncludeIndividualCrops: true,
    onDownloadPsdIncludeIndividualCropsChange: noop,
    downloadPsdIncludeRawTextLayer: true,
    onDownloadPsdIncludeRawTextLayerChange: noop,
    downloadPsdIncludeTranslatedTextLayer: true,
    onDownloadPsdIncludeTranslatedTextLayerChange: noop,
    downloadPsdUsePhotoshopTextLayers: false,
    onDownloadPsdUsePhotoshopTextLayersChange: noop,
    downloadPsdIncludeMetadataJson: true,
    onDownloadPsdIncludeMetadataJsonChange: noop,
    hasAioRenderRegionsForPsd: false,
    modeIsAio: false,
    onDownloadPsd: noop,
    onToggle: noop,
  };
};

function Harness({ noir }: { noir: boolean }) {
  const outFormat = useExportStore((state) => state.outFormat);
  const setOutFormat = useExportStore((state) => state.setOutFormat);
  const outQuality = useExportStore((state) => state.outQuality);
  const setOutQuality = useExportStore((state) => state.setOutQuality);
  const props: MenuProps = {
    ...buildProps(),
    outFormat,
    onOutFormatChange: setOutFormat,
    outQuality,
    onOutQualityChange: setOutQuality,
  };
  return noir ? <NoirMenu {...props} /> : <ClassicMenu {...props} />;
}

const renderMenu = (noir: boolean) =>
  render(
    <TooltipProvider>
      <I18nProvider>
        <Harness noir={noir} />
      </I18nProvider>
    </TooltipProvider>,
  );

const getChip = (): HTMLElement => {
  const group = screen.getByRole('group', { name: /quick export|exportação rápida/i });
  const chip = within(group).getByRole('button');
  if (!(chip instanceof HTMLElement)) throw new Error('chip is not an HTMLElement');
  return chip;
};

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

beforeEach(() => {
  useExportStore.setState({ outFormat: 'image/png', outQuality: 0.9 });
});

describe.each([
  ['classic', false],
  ['noir', true],
])('quick export chips (%s)', (_variant, noir) => {
  it('writes the WebP 0.6 preset into the store and reflects it in the existing controls', () => {
    renderMenu(noir);
    const chip = getChip();
    expect(chip).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(chip);

    expect(useExportStore.getState().outFormat).toBe('image/webp');
    expect(useExportStore.getState().outQuality).toBe(0.6);
    const formatSelect = screen.getAllByRole('combobox')[0];
    expect(formatSelect).toBeDefined();
    expect(formatSelect).toHaveValue('image/webp');
    expect(screen.getByDisplayValue('0.6')).toBeInTheDocument();
    expect(getChip()).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the chip inactive for a different quality even when the format is WebP', () => {
    useExportStore.setState({ outFormat: 'image/webp', outQuality: 0.9 });
    renderMenu(noir);
    expect(getChip()).toHaveAttribute('aria-pressed', 'false');
  });
});

describe.each([
  ['classic', false],
  ['noir', true],
])('show-in-folder row (%s)', (_variant, noir) => {
  const modelsStub: DesktopModelsApi = {
    listInstalled: async () => [],
    getDiskSpace: async () => ({ freeBytes: 1024 ** 3, totalBytes: 1024 ** 3, path: 'mock' }),
    checkUpdates: async () => [],
    download: async () => ({ queued: true, queueLength: 1 }),
    importOnnx: async () => {
      throw new Error('not used in this suite');
    },
    cancel: async () => undefined,
    cancelAll: async () => undefined,
    uninstall: async () => undefined,
    listActive: async () => ({ known: false }),
    on: async () => true,
    off: () => undefined,
  };

  it('hides the row without a shell reveal integration or an exported path', () => {
    setDesktopBridgeProvider({ desktop: null });
    const first = renderMenu(noir);
    expect(screen.queryByText('Show in folder')).toBeNull();
    first.unmount();

    useExportStore.setState({ lastExportedFilePath: 'C:/out/a.zip' });
    renderMenu(noir);
    expect(screen.queryByText('Show in folder')).toBeNull();
  });

  it('shows the row after a shell export and calls system.revealPath', async () => {
    const revealPath = vi.fn(async () => ({ opened: true, path: 'C:/out/a.zip' }));
    setDesktopBridgeProvider({
      desktop: createDesktopBridgeStub(modelsStub, { system: { revealPath } }),
    });
    useExportStore.setState({ lastExportedFilePath: 'C:/out/a.zip' });

    renderMenu(noir);
    fireEvent.click(screen.getByText('Show in folder'));

    await waitFor(() => expect(revealPath).toHaveBeenCalledWith('C:/out/a.zip'));
  });
});
