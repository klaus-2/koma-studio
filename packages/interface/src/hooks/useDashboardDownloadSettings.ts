import { useState } from 'react';

import type { DownloadBundleFormat, PsdCompression } from '../types/dashboard.types';

export function useDashboardDownloadSettings() {
  const [downloadBundleFormat, setDownloadBundleFormat] = useState<DownloadBundleFormat>('zip');
  const [downloadIncludeRawText, setDownloadIncludeRawText] = useState(true);
  const [downloadIncludeTranslatedText, setDownloadIncludeTranslatedText] = useState(true);
  const [downloadIncludeInpaintedImage, setDownloadIncludeInpaintedImage] = useState(true);
  const [downloadPsdCompression, setDownloadPsdCompression] = useState<PsdCompression>('rle');
  const [downloadPsdDpi, setDownloadPsdDpi] = useState(300);
  const [downloadPsdIncludeOcrOverlay, setDownloadPsdIncludeOcrOverlay] = useState(true);
  const [downloadPsdIncludeIndividualCrops, setDownloadPsdIncludeIndividualCrops] = useState(true);
  const [downloadPsdIncludeRawTextLayer, setDownloadPsdIncludeRawTextLayer] = useState(true);
  const [downloadPsdIncludeTranslatedTextLayer, setDownloadPsdIncludeTranslatedTextLayer] = useState(true);
  const [downloadPsdUsePhotoshopTextLayers, setDownloadPsdUsePhotoshopTextLayers] = useState(false);
  const [downloadPsdIncludeMetadataJson, setDownloadPsdIncludeMetadataJson] = useState(true);
  const [downloadPsdLoading, setDownloadPsdLoading] = useState(false);

  return {
    downloadBundleFormat,
    setDownloadBundleFormat,
    downloadIncludeRawText,
    setDownloadIncludeRawText,
    downloadIncludeTranslatedText,
    setDownloadIncludeTranslatedText,
    downloadIncludeInpaintedImage,
    setDownloadIncludeInpaintedImage,
    downloadPsdCompression,
    setDownloadPsdCompression,
    downloadPsdDpi,
    setDownloadPsdDpi,
    downloadPsdIncludeOcrOverlay,
    setDownloadPsdIncludeOcrOverlay,
    downloadPsdIncludeIndividualCrops,
    setDownloadPsdIncludeIndividualCrops,
    downloadPsdIncludeRawTextLayer,
    setDownloadPsdIncludeRawTextLayer,
    downloadPsdIncludeTranslatedTextLayer,
    setDownloadPsdIncludeTranslatedTextLayer,
    downloadPsdUsePhotoshopTextLayers,
    setDownloadPsdUsePhotoshopTextLayers,
    downloadPsdIncludeMetadataJson,
    setDownloadPsdIncludeMetadataJson,
    downloadPsdLoading,
    setDownloadPsdLoading,
  };
}
