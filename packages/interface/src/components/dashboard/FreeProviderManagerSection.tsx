import { FreeProviderCard } from '../FreeProviderCards/FreeProviderCard';
import { CustomProviderProfileCard } from '../FreeProviderCards/CustomProviderProfileCard';

import type { FreeAiProviderCatalogEntry, FreeProviderDraftValue, FreeProviderStage } from '../../models/freeAiProviderCatalog';
import type { CustomLlmProfile, CustomLlmProfileDraft } from '../../utils/customLlm';

interface FreeProviderManagerSectionProps {
  stage: FreeProviderStage;
  providers: FreeAiProviderCatalogEntry[];
  standaloneProfiles: CustomLlmProfile[];
  selectedModelKey: string;
  getDraft: (stage: FreeProviderStage, providerId: string) => FreeProviderDraftValue;
  getSelectedProfileLabel: (stage: FreeProviderStage, providerId: string) => string | null;
  onDraftChange: (stage: FreeProviderStage, providerId: string, patch: Partial<FreeProviderDraftValue>) => void;
  onSaveProvider: (stage: FreeProviderStage, provider: FreeAiProviderCatalogEntry) => Promise<unknown> | void;
  onUseProvider: (stage: FreeProviderStage, provider: FreeAiProviderCatalogEntry) => Promise<void> | void;
  onTestProvider: (stage: FreeProviderStage, provider: FreeAiProviderCatalogEntry, draft: FreeProviderDraftValue) => Promise<{ ok: boolean; message: string }>;
  onUseCustomProfile: (profileId: string) => void;
  onTestCustomProfile: (profile: CustomLlmProfile) => Promise<{ ok: boolean; message: string }>;
  onSaveCustomProfile: (draft: CustomLlmProfileDraft) => Promise<void> | void;
  onDeleteCustomProfile: (profileId: string) => Promise<void> | void;
  toSelectionKey: (profile: CustomLlmProfile) => string;
}

export default function FreeProviderManagerSection({
  stage,
  providers,
  standaloneProfiles,
  selectedModelKey,
  getDraft,
  getSelectedProfileLabel,
  onDraftChange,
  onSaveProvider,
  onUseProvider,
  onTestProvider,
  onUseCustomProfile,
  onTestCustomProfile,
  onSaveCustomProfile,
  onDeleteCustomProfile,
  toSelectionKey,
}: FreeProviderManagerSectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {providers.map((provider) => {
        const definition = provider.stages[stage];
        if (!definition) return null;
        const draft = getDraft(stage, provider.id);
        return (
          <FreeProviderCard
            key={`manager-free-${stage}-${provider.id}`}
            provider={provider}
            stage={stage}
            definition={definition}
            draft={draft}
            compact
            selectedProfileLabel={getSelectedProfileLabel(stage, provider.id)}
            onChange={(patch) => onDraftChange(stage, provider.id, patch)}
            onSave={() => void onSaveProvider(stage, provider)}
            onUse={() => void onUseProvider(stage, provider)}
            onTest={() => onTestProvider(stage, provider, draft)}
          />
        );
      })}
      {standaloneProfiles.map((profile) => (
        <CustomProviderProfileCard
          key={`manager-free-${stage}-custom-${profile.id}`}
          stage={stage}
          profile={profile}
          selected={selectedModelKey === toSelectionKey(profile)}
          onUse={() => onUseCustomProfile(profile.id)}
          onTest={() => onTestCustomProfile(profile)}
          onSave={(draft) => onSaveCustomProfile(draft)}
          onDelete={() => void onDeleteCustomProfile(profile.id)}
        />
      ))}
    </div>
  );
}
