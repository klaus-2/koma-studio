import { useId, useState } from 'react';
import { Cloud, Cpu, Flame, Settings2, Zap } from 'lucide-react';

import { useI18n } from '../../../i18n';
import type { SettingsTab } from '../../../pages/settings/settings.types';
import { useAioPipelineStore } from '../../../pages/dashboard/stores/aio-pipeline-store';
import {
  OnbBadge,
  OnbMeter,
  OnbNotice,
  OnbSection,
  cx,
} from '../onboardingPrimitives';
import { useOnbSkin, type OnbTone } from '../onboardingSkin';

export interface OnboardingModelsGuideStepProps {
  onOpenSettingsTab: (tab: SettingsTab) => void;
}

type TierId = 'light' | 'heavy' | 'cloud';

interface TierSpec {
  readonly id: TierId;
  readonly Icon: typeof Zap;
  readonly key: 'tierLight' | 'tierHeavy' | 'tierCloud';
  readonly tone: OnbTone;
  readonly quality: number;
  readonly speed: number;
}

const TIERS: readonly TierSpec[] = [
  { id: 'light', Icon: Zap, key: 'tierLight', tone: 'success', quality: 74, speed: 95 },
  { id: 'heavy', Icon: Flame, key: 'tierHeavy', tone: 'accent', quality: 96, speed: 58 },
  { id: 'cloud', Icon: Cloud, key: 'tierCloud', tone: 'info', quality: 98, speed: 84 },
];

const adviceKeyFor = (hasGpu: boolean, vramGb: number | null): string => {
  if (!hasGpu) return 'onboarding.modelsGuide.hardware.adviceCpu';
  if (vramGb !== null && vramGb >= 8) return 'onboarding.modelsGuide.hardware.adviceHighVram';
  if (vramGb !== null && vramGb >= 4) return 'onboarding.modelsGuide.hardware.adviceMidVram';
  return 'onboarding.modelsGuide.hardware.adviceLowVram';
};

export function OnboardingModelsGuideStep({ onOpenSettingsTab }: OnboardingModelsGuideStepProps) {
  const { t } = useI18n();
  const skin = useOnbSkin();
  const tiersTitleId = useId();
  const deviceInfo = useAioPipelineStore((s) => s.aioDeviceInfo);
  const runtimeState = useAioPipelineStore((s) => s.aioMiniBackendRuntimeState);

  const hasGpu = deviceInfo?.has_gpu ?? false;
  const vramGb = deviceInfo?.vram_gb ?? null;
  const provider = deviceInfo?.provider || 'cpu';
  const recommended: TierId = hasGpu && vramGb !== null && vramGb >= 8 ? 'heavy' : 'light';
  const [focused, setFocused] = useState<TierId>(recommended);
  const focusedTier = TIERS.find((tier) => tier.id === focused) ?? TIERS[0];

  return (
    <div className="flex flex-col gap-4">
      <OnbSection
        icon={<Cpu size={14} />}
        title={t('onboarding.modelsGuide.hardware.title')}
        desc={`${deviceInfo?.name || t('onboarding.modelsGuide.hardware.unknownDevice')} · ${provider}${
          runtimeState?.status ? ` · ${runtimeState.status}` : ''
        }`}
        actions={
          <>
            <OnbBadge tone={hasGpu ? 'success' : 'warn'}>
              {hasGpu ? (vramGb !== null ? `${vramGb.toFixed(1)} GB VRAM` : provider.toUpperCase()) : 'CPU'}
            </OnbBadge>
            <button type="button" className={skin.btnSmall} onClick={() => onOpenSettingsTab('runtime')}>
              <Settings2 size={12} aria-hidden="true" />
              <span>{t('onboarding.modelsGuide.hardware.openRuntime')}</span>
            </button>
          </>
        }
      >
        <OnbNotice tone={hasGpu ? 'info' : 'warn'}>{t(adviceKeyFor(hasGpu, vramGb))}</OnbNotice>
      </OnbSection>

      <OnbSection
        title={t('onboarding.modelsGuide.principleTitle')}
        desc={t('onboarding.modelsGuide.principleBody')}
        titleId={tiersTitleId}
      >
        <div role="radiogroup" aria-labelledby={tiersTitleId} className="grid gap-2 md:grid-cols-3">
          {TIERS.map((tier) => {
            const on = tier.id === focused;
            return (
              <button
                key={tier.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setFocused(tier.id)}
                className={cx(skin.choice, 'flex-col !items-stretch', on ? skin.choiceOn : skin.choiceOff)}
              >
                <span className="flex items-center justify-between gap-2">
                  <tier.Icon size={15} aria-hidden="true" />
                  <span className="flex flex-wrap justify-end gap-1">
                    {tier.id === recommended ? (
                      <OnbBadge tone="success">{t('onboarding.modelsGuide.recommendedForYou')}</OnbBadge>
                    ) : null}
                    <OnbBadge tone={tier.tone}>{t(`onboarding.modelsGuide.${tier.key}.badge`)}</OnbBadge>
                  </span>
                </span>
                <span className={cx('block', skin.itemTitle)}>{t(`onboarding.modelsGuide.${tier.key}.title`)}</span>
                <span className={cx('block', skin.muted)}>{t(`onboarding.modelsGuide.${tier.key}.desc`)}</span>
                <span className="mt-1 flex flex-col gap-2">
                  <OnbMeter label={t('onboarding.modelsGuide.qualityLabel')} value={tier.quality} tone={tier.tone} />
                  <OnbMeter label={t('onboarding.modelsGuide.speedLabel')} value={tier.speed} tone="info" />
                </span>
              </button>
            );
          })}
        </div>

        {focusedTier ? (
          <dl className="mt-3 grid gap-2 sm:grid-cols-2" aria-live="polite">
            <div className={cx(skin.item, skin.itemOff)}>
              <dt className={skin.label}>{t('onboarding.modelsGuide.strengthLabel')}</dt>
              <dd className={cx('mt-1', skin.body)}>{t(`onboarding.modelsGuide.${focusedTier.key}.pros`)}</dd>
            </div>
            <div className={cx(skin.item, skin.itemOff)}>
              <dt className={skin.label}>{t('onboarding.modelsGuide.costLabel')}</dt>
              <dd className={cx('mt-1', skin.body)}>{t(`onboarding.modelsGuide.${focusedTier.key}.tradeoff`)}</dd>
            </div>
          </dl>
        ) : null}
      </OnbSection>

      <OnbNotice tone="neutral">
        <Cloud size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span className="min-w-0 flex-1">{t('onboarding.modelsGuide.customApiTip')}</span>
        <button type="button" className={skin.btnSmall} onClick={() => onOpenSettingsTab('integrations')}>
          <span>{t('onboarding.modelsGuide.openIntegrations')}</span>
        </button>
      </OnbNotice>
    </div>
  );
}
