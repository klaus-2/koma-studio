import { Cloud, Cpu, Flame, Gauge, Settings2, Zap } from 'lucide-react';

import { useI18n } from '../../../i18n';
import type { SettingsTab } from '../../../pages/settings/settings.types';
import { useAioPipelineStore } from '../../../pages/dashboard/stores/aio-pipeline-store';
import { OnboardingBadge, OnboardingSectionCard } from '../onboardingPrimitives';

export interface OnboardingModelsGuideStepProps {
  onOpenSettingsTab: (tab: SettingsTab) => void;
}

const getHardwareRecommendationKey = (
  hasGpu: boolean | undefined,
  vramGb: number | null | undefined,
): string => {
  if (!hasGpu) {
    return 'onboarding.modelsGuide.hardware.adviceCpu';
  }
  if (typeof vramGb === 'number' && vramGb >= 8) {
    return 'onboarding.modelsGuide.hardware.adviceHighVram';
  }
  if (typeof vramGb === 'number' && vramGb >= 4) {
    return 'onboarding.modelsGuide.hardware.adviceMidVram';
  }
  return 'onboarding.modelsGuide.hardware.adviceLowVram';
};

export function OnboardingModelsGuideStep({
  onOpenSettingsTab,
}: OnboardingModelsGuideStepProps) {
  const { t } = useI18n();
  const deviceInfo = useAioPipelineStore((s) => s.aioDeviceInfo);
  const runtimeState = useAioPipelineStore((s) => s.aioMiniBackendRuntimeState);

  const hasGpu = deviceInfo?.has_gpu ?? false;
  const vramGb = deviceInfo?.vram_gb ?? null;
  const deviceName = deviceInfo?.name || t('onboarding.modelsGuide.hardware.unknownDevice');
  const provider = deviceInfo?.provider || 'cpu';
  const adviceKey = getHardwareRecommendationKey(deviceInfo?.has_gpu, vramGb);

  const tiers = [
    {
      id: 'light',
      Icon: Zap,
      badgeKey: 'onboarding.modelsGuide.tierLight.badge',
      titleKey: 'onboarding.modelsGuide.tierLight.title',
      descKey: 'onboarding.modelsGuide.tierLight.desc',
      prosKey: 'onboarding.modelsGuide.tierLight.pros',
      tradeoffKey: 'onboarding.modelsGuide.tierLight.tradeoff',
      tone: 'success' as const,
    },
    {
      id: 'heavy',
      Icon: Flame,
      badgeKey: 'onboarding.modelsGuide.tierHeavy.badge',
      titleKey: 'onboarding.modelsGuide.tierHeavy.title',
      descKey: 'onboarding.modelsGuide.tierHeavy.desc',
      prosKey: 'onboarding.modelsGuide.tierHeavy.pros',
      tradeoffKey: 'onboarding.modelsGuide.tierHeavy.tradeoff',
      tone: 'accent' as const,
    },
    {
      id: 'cloud',
      Icon: Cloud,
      badgeKey: 'onboarding.modelsGuide.tierCloud.badge',
      titleKey: 'onboarding.modelsGuide.tierCloud.title',
      descKey: 'onboarding.modelsGuide.tierCloud.desc',
      prosKey: 'onboarding.modelsGuide.tierCloud.pros',
      tradeoffKey: 'onboarding.modelsGuide.tierCloud.tradeoff',
      tone: 'info' as const,
    },
  ] as const;

  return (
    <div className="koma-onb-stepStack">
      <OnboardingSectionCard tone={hasGpu ? 'info' : 'warn'}>
        <div className="koma-onb-hardwareRow">
          <div className="koma-onb-hardwareRow__main">
            <div className="koma-onb-cardHead">
              <Cpu size={16} />
              <h3 className="koma-onb-cardTitle">{t('onboarding.modelsGuide.hardware.title')}</h3>
              <OnboardingBadge tone={hasGpu ? 'success' : 'warn'}>
                {hasGpu
                  ? vramGb !== null
                    ? `${vramGb.toFixed(1)} GB VRAM`
                    : provider.toUpperCase()
                  : 'CPU'}
              </OnboardingBadge>
            </div>
            <p className="koma-onb-deviceName">
              {deviceName} · <span className="koma-onb-mono">{provider}</span>
              {runtimeState?.status ? ` · ${runtimeState.status}` : ''}
            </p>
            <p className="koma-onb-body">{t(adviceKey)}</p>
          </div>
          <button
            type="button"
            className="koma-onb-btn koma-onb-btn--ghost"
            onClick={() => onOpenSettingsTab('runtime')}
          >
            <Settings2 size={14} />
            {t('onboarding.modelsGuide.hardware.openRuntime')}
          </button>
        </div>
      </OnboardingSectionCard>

      <OnboardingSectionCard>
        <div className="koma-onb-cardHead">
          <Gauge size={16} />
          <h3 className="koma-onb-cardTitle">{t('onboarding.modelsGuide.principleTitle')}</h3>
        </div>
        <p className="koma-onb-body">{t('onboarding.modelsGuide.principleBody')}</p>
      </OnboardingSectionCard>

      <div className="koma-onb-grid3">
        {tiers.map((tier) => (
          <OnboardingSectionCard key={tier.id} tone={tier.tone}>
            <div className="koma-onb-tierCard">
              <div className="koma-onb-cardHead">
                <tier.Icon size={15} />
                <OnboardingBadge tone={tier.tone}>{t(tier.badgeKey)}</OnboardingBadge>
              </div>
              <h4 className="koma-onb-tierCard__title">{t(tier.titleKey)}</h4>
              <p className="koma-onb-muted">{t(tier.descKey)}</p>
              <ul className="koma-onb-bullets">
                <li>
                  <strong>{t('onboarding.modelsGuide.strengthLabel')}:</strong> {t(tier.prosKey)}
                </li>
                <li>
                  <strong>{t('onboarding.modelsGuide.costLabel')}:</strong> {t(tier.tradeoffKey)}
                </li>
              </ul>
            </div>
          </OnboardingSectionCard>
        ))}
      </div>

      <OnboardingSectionCard tone="info">
        <div className="koma-onb-hardwareRow">
          <p className="koma-onb-body">{t('onboarding.modelsGuide.customApiTip')}</p>
          <button
            type="button"
            className="koma-onb-btn koma-onb-btn--ghost"
            onClick={() => onOpenSettingsTab('integrations')}
          >
            <Cloud size={14} />
            {t('onboarding.modelsGuide.openIntegrations')}
          </button>
        </div>
      </OnboardingSectionCard>
    </div>
  );
}
