import { memo } from 'react';

import AioCloudPreviewDialog from '../../../components/dashboard/AioCloudPreviewDialog';
import type { UseAioCloudPreviewStartResult } from '../hooks/use-aio-cloud-preview-start';

interface AioCloudPreviewMountProps {
  readonly cloudPreview: UseAioCloudPreviewStartResult;
  readonly processAIO: () => void;
  readonly processAioAi?: () => void;
  readonly aioAiActive?: boolean;
  readonly anchorEl: HTMLElement | null;
}

export const AioCloudPreviewMount = memo(function AioCloudPreviewMount({
  cloudPreview,
  processAIO,
  processAioAi,
  aioAiActive,
  anchorEl,
}: AioCloudPreviewMountProps) {
  if (cloudPreview.previewGate === null) {
    return null;
  }
  return (
    <AioCloudPreviewDialog
      anchorEl={anchorEl}
      gate={cloudPreview.previewGate}
      imageCount={cloudPreview.imageCount}
      imageBytes={cloudPreview.imageBytes}
      textRegionCount={cloudPreview.textRegionCount}
      knownTextChars={cloudPreview.knownTextChars}
      imagesWithKnownText={cloudPreview.imagesWithKnownText}
      neighborContextEnabled={cloudPreview.neighborContextEnabled}
      onConfirm={() => {
        cloudPreview.clearPreviewGate();
        if (aioAiActive && processAioAi) {
          processAioAi();
          return;
        }
        processAIO();
      }}
      onCancel={cloudPreview.clearPreviewGate}
    />
  );
});
