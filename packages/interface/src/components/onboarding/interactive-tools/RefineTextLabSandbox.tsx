import { useCallback, useMemo, useState } from 'react';

import {
  ONBOARDING_LAB_ASSETS,
  REFINE_LAB_SPEC,
} from '../../../assets/onboarding-labs';
import { DEFAULT_RENDER_STYLE } from '../../../constants/dashboard.constants';
import { useI18n } from '../../../i18n';
import type { AioTextRegion } from '../../../types/dashboard.types';
import { rebuildRegionShapeForRefinement } from '../../../utils/dashboard.region.utils';
import { cloneRenderStyle } from '../../../utils/dashboard.utils';
import { cx } from '../onboardingPrimitives';
import { useOnbSkin } from '../onboardingSkin';
import { GuidedStepBanner } from './InteractiveTourChrome';
import {
  OnboardingRenderPreview,
  createLabLoadedImage,
} from './onboardingRenderPreviewHelper';

export interface RefineTextLabSandboxProps {
  completed: boolean;
  onComplete: () => void;
  onNextMission?: () => void;
  nextMissionLabel?: string;
}

const REGION_ID = 'onb-refine-bubble';
const BUBBLE_BOX = REFINE_LAB_SPEC.bubbleBox;
const BOX_W = BUBBLE_BOX[2] - BUBBLE_BOX[0];
const BOX_H = BUBBLE_BOX[3] - BUBBLE_BOX[1];

const buildInitialRegions = (sampleText: string): AioTextRegion[] => [
  {
    id: REGION_ID,
    bbox: [...BUBBLE_BOX],
    score: 0.96,
    source: 'model',
    modelKey: 'font_rtdetr_v2',
    detectorModelKey: 'font_rtdetr_v2',
    detectedRenderMode: 'text_bubble',
    renderMode: 'auto',
    renderText: sampleText,
    renderStyle: {
      ...DEFAULT_RENDER_STYLE,
      alignment: 'left',
      autoFontSize: false,
      fontSize: 16,
      minFontSize: 8,
      lineSpacing: 1.05,
      color: '#111111',
      fillCssValue: '#111111',
      outlineColor: '#ffffff',
      outlineWidth: 2,
      hyphenationEnabled: false,
    },
    shape: {
      kind: 'square',
      source: 'refined',
      cornerRadius: 0,
      innerBox: [4, 4, BOX_W - 4, BOX_H - 4],
      fitProfile: [1, 1, 1],
    },
    stylePresetId: null,
    queueIndex: null,
    hidden: false,
    locked: false,
  },
];

export function RefineTextLabSandbox({
  completed,
  onComplete,
  onNextMission,
  nextMissionLabel,
}: RefineTextLabSandboxProps) {
  const { t } = useI18n();
  const skin = useOnbSkin();
  const initialCopy = t('onboarding.tools.lab.text.sampleText');

  const labImage = useMemo(
    () =>
      createLabLoadedImage({
        id: 'onb-refine-page',
        name: 'webtoon-bubble.webp',
        url: ONBOARDING_LAB_ASSETS.refineClean,
        width: REFINE_LAB_SPEC.width,
        height: REFINE_LAB_SPEC.height,
      }),
    [],
  );

  const [regions, setRegions] = useState<AioTextRegion[]>(() =>
    buildInitialRegions(initialCopy),
  );
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [refined, setRefined] = useState(false);

  const currentStep = useMemo(() => {
    if (completed || refined) return 3;
    if (!selectedRegionId) return 1;
    return 2;
  }, [completed, refined, selectedRegionId]);

  const handleReset = useCallback((): void => {
    setRegions(buildInitialRegions(initialCopy));
    setSelectedRegionId(null);
    setRefined(false);
  }, [initialCopy]);

  const handleRegionsChange = useCallback(
    (next: AioTextRegion[], selectedRegionIdOverride?: string | null): void => {
      setRegions(next);
      if (selectedRegionIdOverride !== undefined) {
        setSelectedRegionId(selectedRegionIdOverride);
      }
    },
    [],
  );

  const handleRequestRefineRegion = useCallback((): void => {
    if (!selectedRegionId) return;
    setRegions((prev) =>
      prev.map((region) => {
        if (region.id !== selectedRegionId) return region;
        const refinedRegion = rebuildRegionShapeForRefinement(region, 'rounded', 'refined');
        return {
          ...refinedRegion,
          renderStyle: {
            ...cloneRenderStyle(refinedRegion.renderStyle ?? DEFAULT_RENDER_STYLE),
            alignment: 'center',
            autoFontSize: true,
            fontSize: DEFAULT_RENDER_STYLE.fontSize,
            minFontSize: DEFAULT_RENDER_STYLE.minFontSize,
          },
        };
      }),
    );
    setRefined(true);
    onComplete();
  }, [onComplete, selectedRegionId]);

  const bannerCopy = (() => {
    if (currentStep >= 3) {
      return {
        stepNumber: 2,
        title: t('onboarding.tools.lab.text.doneTitle'),
        hint: t('onboarding.tools.lab.text.doneHint'),
      };
    }
    if (currentStep === 1) {
      return {
        stepNumber: 1,
        title: t('onboarding.tools.lab.text.step1Title'),
        hint: t('onboarding.tools.lab.text.step1Hint'),
      };
    }
    return {
      stepNumber: 2,
      title: t('onboarding.tools.lab.text.step2Title'),
      hint: t('onboarding.tools.lab.text.step2Hint'),
    };
  })();

  return (
    <div className="flex flex-col gap-3" data-testid="refine-lab-sandbox">
      <GuidedStepBanner
        stepNumber={bannerCopy.stepNumber}
        totalSteps={2}
        title={bannerCopy.title}
        hint={bannerCopy.hint}
        completed={refined}
        errorMessage={null}
        onReplay={handleReset}
        onNextMission={onNextMission}
        nextMissionLabel={nextMissionLabel}
      />

      <div className={cx('flex justify-center overflow-x-auto', skin.item, skin.itemOff)}>
        <div className="relative inline-block max-w-full">
          <OnboardingRenderPreview
            label={t('onboarding.tools.lab.text.title')}
            image={labImage}
            previewSrc={ONBOARDING_LAB_ASSETS.refineClean}
            regions={regions}
            selectedRegionId={selectedRegionId}
            areaSelectionEnabled
            allowRegionCreation={false}
            newRegionShapeKind="rounded"
            onSelectRegion={setSelectedRegionId}
            onRegionsChange={handleRegionsChange}
            onRequestRefineRegion={handleRequestRefineRegion}
          />
        </div>
      </div>
    </div>
  );
}
