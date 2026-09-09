
import { TypographerToolbox } from '../typography/TypographerToolbox';

interface TypesetterToolsPanelProps {
  activeImageName: string | null;
  activeRegion: any;
  regionsCount: number;
  session: any;
  queueSelectedId: string | null;
  availablePresets: any[];
  selectedPresetId: string | null;
  selectedTool: any;
  snapshotName: string;
  selectedSnapshotId: string | null;
  onSelectedToolChange: (value: any) => void;
  onPresetChange: (presetId: string | null) => void;
  onRefineShape: () => void;
  onConvertShape: (kind: 'square' | 'rounded') => void;
  onDuplicateRegion: () => void;
  onDeleteRegion: () => void;
  onApplyPresetToSelection: () => void;
  onApplyPresetToImage: () => void;
  onSnapshotNameChange: (value: string) => void;
  onSaveSnapshot: () => void;
  onSelectSnapshot: (snapshotId: string | null) => void;
  onRestoreSnapshot: () => void;
  onDraftTextChange: (value: string) => void;
  onBuildQueue: () => void;
  onClearQueue: () => void;
  onApplySelectedQueueItem: () => void;
  onApplyNextQueueItem: () => void;
  onSelectQueueItem: (queueId: string | null) => void;
  onToggleMultiBubble: () => void;
  onImportQueueText: (value: string) => void;
  multiBubbleRegions?: Array<{ id: string; label: string }>;
  onReorderMultiBubbleRegions?: (nextOrder: string[]) => void;
  availableFolders?: any[];
  availableFonts?: string[];
  onUpdatePreset?: (presetId: string, patch: any) => void;
}

export default function TypesetterToolsPanel(props: TypesetterToolsPanelProps) {
  return <TypographerToolbox {...props} />;
}
