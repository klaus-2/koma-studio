// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AioTextRegion, LoadedImage } from '../../../types/dashboard.types';
import type { ExportPoolJob, ExportWorkerPool } from './exportWorkerPool';
import { useDashboardDownloadBundle } from './export-download';
import { useExportStore } from '../stores/export-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useRegionEditorStore } from '../stores/region-editor-store';
import { useTranslatorStore } from '../stores/translator-store';

const { packageMock, materializeMock, renderMock } = vi.hoisted(() => ({
  packageMock: vi.fn((_job: ExportPoolJob) =>
    Promise.resolve({ blobBytes: new ArrayBuffer(0), mimeType: 'application/zip' }),
  ),
  materializeMock: vi.fn(() =>
    Promise.resolve(
      Object.assign(new Blob(['px'], { type: 'image/png' }), {
        arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2]).buffer),
      }),
    ),
  ),
  renderMock: vi.fn(),
}));

vi.mock('./exportWorkerPool', () => ({
  createExportWorkerPool: (): ExportWorkerPool => ({
    package: (job: ExportPoolJob) => packageMock(job),
    encode: () => Promise.reject(new Error('encode jobs are not used here')),
    get size(): number {
      return 1;
    },
    pendingCount: () => 0,
    dispose: () => undefined,
  }),
  createExportEncodeWorkerPool: (): ExportWorkerPool => {
    throw new Error('encode pool is not used here');
  },
}));

vi.mock('./export-download.bundle-bridge', () => ({
  streamBundleViaShell: () => Promise.resolve(null),
}));

vi.mock('../../../utils/page-source', () => ({
  materializePageFile: materializeMock,
}));

const page = {
  id: 'img-1',
  file: { name: 'p1.png', type: 'image/png' },
  url: 'blob:p1',
} as unknown as LoadedImage;

const regions: AioTextRegion[] = [
  {
    id: 'r1',
    bbox: [0, 0, 10, 10],
    recognizedText: 'こんにちは',
    translatedText: 'Olá',
  } as AioTextRegion,
];

const renderBundle = () =>
  renderHook(() =>
    useDashboardDownloadBundle({
      getTypographerSessionsByImage: () => ({}),
      renderAioImageToBlob: renderMock,
      composeCleanerEditableCanvas: vi.fn(),
      composeAioEditableCanvas: vi.fn(),
      hasCleanerManualImageEdits: () => false,
      hasAioManualImageEdits: () => false,
      getAioDownloadItemForImage: () => null,
      resolveAioStageKeyForImage: () => 'getTranslations',
    }),
  ).result.current;

const packagedPaths = (): string[] => {
  const job = packageMock.mock.calls.at(-1)?.[0];
  if (!job) throw new Error('no package job was submitted');
  return job.zipEntries.map((entry) => entry.path);
};

beforeEach(() => {
  packageMock.mockClear();
  materializeMock.mockClear();
  renderMock.mockClear();
  useImageCollectionStore.setState({ images: [page] });
  useRegionEditorStore.setState({ aioDetectionsByImage: { 'img-1': regions } });
  useExportStore.setState({
    downloadItems: [],
    downloadBundleFormat: 'zip',
    downloadIncludeRawText: true,
    downloadIncludeTranslatedText: true,
    downloadIncludeInpaintedImage: true,
    namingPattern: '',
  });
});

describe('AIO text-only bundle', () => {
  it('packages only the text dumps and never touches the page bytes', async () => {
    useExportStore.setState({ downloadTextOnly: true });
    const bundle = renderBundle();

    const entries = await bundle.prepareDownloadEntries('aio');
    await bundle.buildDownloadBundleBlob('aio', entries);

    const paths = packagedPaths();
    expect(paths.some((path) => path.startsWith('texts/raw/'))).toBe(true);
    expect(paths.some((path) => path.startsWith('texts/translated/'))).toBe(true);
    expect(paths.filter((path) => path.startsWith('images/'))).toEqual([]);
    expect(paths.filter((path) => path.startsWith('inpainted/'))).toEqual([]);
    expect(materializeMock).not.toHaveBeenCalled();
    expect(renderMock).not.toHaveBeenCalled();
  });

  it('keeps the page images when text-only is off', async () => {
    useExportStore.setState({ downloadTextOnly: false });
    const bundle = renderBundle();

    const entries = await bundle.prepareDownloadEntries('aio');
    await bundle.buildDownloadBundleBlob('aio', entries);

    const paths = packagedPaths();
    expect(paths.some((path) => path.startsWith('images/'))).toBe(true);
    expect(paths.some((path) => path.startsWith('texts/raw/'))).toBe(true);
  });
});

describe('AIO text-only bundle layout', () => {
  const packagedJob = (): ExportPoolJob => {
    const job = packageMock.mock.calls.at(-1)?.[0];
    if (!job) throw new Error('no package job was submitted');
    return job;
  };
  const exportPaths = async (): Promise<string[]> => {
    const bundle = renderBundle();
    const entries = await bundle.prepareDownloadEntries('aio');
    await bundle.buildDownloadBundleBlob('aio', entries);
    return packagedPaths();
  };

  it('writes the same text paths as the full bundle', async () => {
    useExportStore.setState({ downloadTextOnly: false, namingPattern: '{pagina}' });
    const full = (await exportPaths()).filter((path) => path.startsWith('texts/'));

    useExportStore.setState({ downloadTextOnly: true });
    const textOnly = await exportPaths();

    expect(new Set(textOnly)).toEqual(new Set(full));
  });

  it('exports only the raw dumps when only raw text is checked', async () => {
    useExportStore.setState({
      downloadTextOnly: true,
      downloadIncludeRawText: true,
      downloadIncludeTranslatedText: false,
    });

    const paths = await exportPaths();

    expect(paths).toEqual(['texts/raw/001-p1.txt']);
    expect(packagedJob().flags).toMatchObject({
      includeRawText: true,
      includeTranslatedText: false,
      includeInpaintedImage: false,
    });
  });

  it('exports only the translated dumps when only translated is checked', async () => {
    useExportStore.setState({
      downloadTextOnly: true,
      downloadIncludeRawText: false,
      downloadIncludeTranslatedText: true,
    });

    const paths = await exportPaths();

    expect(paths).toEqual(['texts/translated/001-p1.txt']);
    expect(packagedJob().flags).toMatchObject({
      includeRawText: false,
      includeTranslatedText: true,
    });
  });

  it('falls back to both dumps when both text boxes are off', async () => {
    useExportStore.setState({
      downloadTextOnly: true,
      downloadIncludeRawText: false,
      downloadIncludeTranslatedText: false,
    });

    const paths = await exportPaths();

    expect(new Set(paths)).toEqual(new Set(['texts/raw/001-p1.txt', 'texts/translated/001-p1.txt']));
    expect(packagedJob().flags).toMatchObject({
      includeRawText: true,
      includeTranslatedText: true,
    });
  });
});

describe('translator visual bundle', () => {
  const translatorRegions: AioTextRegion[] = [
    {
      id: 't1',
      bbox: [0, 0, 10, 10],
      recognizedText: 'さようなら',
      translatedText: 'Tchau',
    } as AioTextRegion,
  ];

  const exportTranslator = async (): Promise<ExportPoolJob> => {
    useTranslatorStore.setState({ translatorDetectionsByImage: { 'img-1': translatorRegions } });
    const bundle = renderBundle();
    const entries = await bundle.prepareDownloadEntries('translator');
    await bundle.buildDownloadBundleBlob('translator', entries);
    const job = packageMock.mock.calls.at(-1)?.[0];
    if (!job) throw new Error('no package job was submitted');
    return job;
  };

  it('uses the AIO text folders and page naming without page images', async () => {
    const job = await exportTranslator();
    const paths = job.zipEntries.map((entry) => entry.path);
    expect(new Set(paths)).toEqual(new Set(['texts/raw/001-p1.txt', 'texts/translated/001-p1.txt']));
    expect(materializeMock).not.toHaveBeenCalled();
  });

  it('writes the translator regions, not the AIO ones', async () => {
    const job = await exportTranslator();
    const decoder = new TextDecoder();
    const translated = job.zipEntries.find((entry) => entry.path.startsWith('texts/translated/'));
    expect(translated && decoder.decode(translated.bytes)).toContain('Tchau');
    expect(translated && decoder.decode(translated.bytes)).not.toContain('Olá');
  });

  it('always packages a zip and flags both texts in the manifest', async () => {
    useExportStore.setState({ downloadBundleFormat: 'pdf', downloadIncludeRawText: false });
    const job = await exportTranslator();
    expect(job.bundleFormat).toBe('zip');
    expect(job.flags.includeRawText).toBe(true);
    expect(job.flags.includeTranslatedText).toBe(true);
    expect(job.flags.includeInpaintedImage).toBe(false);
  });
});
