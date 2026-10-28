import type {
  Dispatch,
  RefObject,
  SetStateAction,
} from 'react';

import type { useDropzone } from 'react-dropzone';
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  FileCode2,
  ImagePlus,
  Loader2,
  UploadCloud,
} from 'lucide-react';

import { useI18n } from '@/i18n';

import type { UploadDraftItem } from './BloggerWorkspaceV2.types';
import {
  EditorialCdnPanel,
  KomaSwitchCard,
} from './CdnV2Primitives';

interface BloggerUploadIntakePanelV2Props {
  uploadDropzone: ReturnType<typeof useDropzone>;
  batchOptimizerEnabled: boolean;
  setBatchOptimizerEnabled: Dispatch<SetStateAction<boolean>>;
  bulkPreferOptimizedUrl: boolean;
  setBulkPreferOptimizedUrl: Dispatch<SetStateAction<boolean>>;
  bulkAsImageTag: boolean;
  setBulkAsImageTag: Dispatch<SetStateAction<boolean>>;
  uploadInputRef: RefObject<HTMLInputElement | null>;
  appendUploadDrafts: (files: File[]) => void;
  configReady: boolean;
  queuedDrafts: UploadDraftItem[];
  uploadBusy: boolean;
  handleBatchUpload: () => Promise<void>;
  completedDrafts: UploadDraftItem[];
  copiedToken: string | null;
  handleCopyAll: () => Promise<void>;
  handleExportAll: () => void;
}

export function BloggerUploadIntakePanelV2({
  uploadDropzone,
  batchOptimizerEnabled,
  setBatchOptimizerEnabled,
  bulkPreferOptimizedUrl,
  setBulkPreferOptimizedUrl,
  bulkAsImageTag,
  setBulkAsImageTag,
  uploadInputRef,
  appendUploadDrafts,
  configReady,
  queuedDrafts,
  uploadBusy,
  handleBatchUpload,
  completedDrafts,
  copiedToken,
  handleCopyAll,
  handleExportAll,
}: BloggerUploadIntakePanelV2Props) {
  const { t } = useI18n();

  return (
    <EditorialCdnPanel
      index="01"
      icon={UploadCloud}
      kicker="CDN intake"
      title={t(
        'blogger.uploadSection.title',
      )}
      description={t(
        'blogger.uploadSection.description',
      )}
    >
      <div className="space-y-4 p-4 sm:p-5">
        <div
          {...uploadDropzone.getRootProps({
            className: [
              'panel-cut-sm halftone-red relative flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-10 text-center transition-all',
              'focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson',
              uploadDropzone.isDragActive
                ? 'border-crimson bg-crimson/10 -translate-y-1 shadow-[4px_4px_0_var(--color-crimson)]'
                : 'border-paper/15 hover:-translate-y-0.5 hover:border-crimson/60',
              uploadDropzone.isDragReject
                ? '!border-crimson !bg-crimson/10'
                : '',
            ].join(' '),
            'aria-label': t(
              'blogger.uploadSection.dropTitle',
            ),
          })}
        >
          <input
            {...uploadDropzone.getInputProps()}
          />

          <span className="stamp panel-cut-sm flex size-12 items-center justify-center text-crimson">
            <UploadCloud
              size={22}
              aria-hidden="true"
            />
          </span>

          <div>
            <strong className="block font-display text-sm font-black uppercase tracking-tight text-paper">
              {t(
                'blogger.uploadSection.dropTitle',
              )}
            </strong>

            <p className="mt-1 font-mono text-[10px] text-paper/50">
              {t(
                'blogger.uploadSection.dropDescription',
              )}
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <KomaSwitchCard
            checked={
              batchOptimizerEnabled
            }
            onChange={
              setBatchOptimizerEnabled
            }
            title={t(
              'blogger.uploadSection.optimizedUrl',
            )}
            description={t(
              'blogger.uploadSection.optimizedUrlDesc',
            )}
            icon={ExternalLink}
            tone="azure"
          />

          <KomaSwitchCard
            checked={
              bulkPreferOptimizedUrl
            }
            onChange={
              setBulkPreferOptimizedUrl
            }
            title={t(
              'blogger.uploadSection.exportOptimized',
            )}
            description={t(
              'blogger.uploadSection.exportOptimizedDesc',
            )}
            icon={Copy}
            tone="gold"
          />

          <KomaSwitchCard
            checked={bulkAsImageTag}
            onChange={
              setBulkAsImageTag
            }
            title={t(
              'blogger.uploadSection.outputImg',
            )}
            description={t(
              'blogger.uploadSection.outputImgDesc',
            )}
            icon={Code2}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              uploadInputRef.current?.click()
            }
          >
            <ImagePlus size={14} />
            {t(
              'blogger.uploadSection.select',
            )}
          </button>

          <button
            type="button"
            className="btn-primary"
            disabled={
              !configReady ||
              queuedDrafts.length ===
              0 ||
              uploadBusy
            }
            onClick={() =>
              void handleBatchUpload()
            }
          >
            {uploadBusy ? (
              <Loader2
                size={14}
                className="animate-spin"
              />
            ) : (
              <UploadCloud
                size={14}
              />
            )}

            {uploadBusy
              ? t('common.sending')
              : t(
                'blogger.uploadSection.send',
              )}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-paper/[0.065] pt-4">
          <button
            type="button"
            className="btn-ghost"
            disabled={
              completedDrafts.length ===
              0
            }
            onClick={() =>
              void handleCopyAll()
            }
          >
            {copiedToken ===
              'copy-all' ? (
              <Check size={14} />
            ) : (
              <Copy size={14} />
            )}

            {copiedToken ===
              'copy-all'
              ? t(
                'blogger.copied',
              )
              : t(
                'dashboard.translator.copy',
              )}
          </button>

          <button
            type="button"
            className="btn-ghost"
            disabled={
              completedDrafts.length ===
              0
            }
            onClick={handleExportAll}
          >
            {copiedToken ===
              'export-all' ? (
              <Check size={14} />
            ) : (
              <FileCode2
                size={14}
              />
            )}

            {copiedToken ===
              'export-all'
              ? t(
                'blogger.uploadSection.exported',
              )
              : '.TXT'}
          </button>
        </div>

        <input
          ref={uploadInputRef}
          type="file"
          hidden
          multiple
          accept=".png,.jpg,.jpeg,.webp"
          onChange={(event) => {
            appendUploadDrafts(
              Array.from(
                event.target.files ??
                [],
              ),
            );

            event.currentTarget.value =
              '';
          }}
        />
      </div>
    </EditorialCdnPanel>
  );
}
