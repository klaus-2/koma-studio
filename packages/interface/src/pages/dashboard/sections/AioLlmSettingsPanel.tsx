import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useThemeStore } from '@koma/ui/stores/theme-store';

import KlSlider from '../../../components/dashboard/KlSlider';
import { useI18n } from '../../../i18n';
import { clampLlmRequestSettings } from '../../../utils/customLlm';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { AioChecklistOption } from './AioRightPanel.skin';

interface AioLlmSettingsPanelProps {
  supportSummary: string;
}

// Isolated island: owns the llm-providers-store subscription, so llm commits re-render it alone.
export default memo(function AioLlmSettingsPanel({
  supportSummary,
}: AioLlmSettingsPanelProps) {
  const { t } = useI18n();
  const noir = useThemeStore((s) => s.family === 'noir');
  const {
    llmExtraContext,
    llmTranslationNotesEnabled,
    llmNeighborContextEnabled,
    llmImageInputEnabled,
    llmTemperature,
    llmTopP,
    llmMaxTokens,
  } = useLlmProvidersStore(
    useShallow((s) => ({
      llmExtraContext: s.llmSettings.extra_context,
      llmTranslationNotesEnabled: s.llmSettings.translation_notes_enabled,
      llmNeighborContextEnabled: s.llmSettings.neighbor_image_context_enabled,
      llmImageInputEnabled: s.llmSettings.image_input_enabled,
      llmTemperature: s.llmSettings.temperature,
      llmTopP: s.llmSettings.top_p,
      llmMaxTokens: s.llmSettings.max_tokens,
    })),
  );
  const setLlmSettings = useLlmProvidersStore((s) => s.setLlmSettings);

  return (
    <div className="koma-aio-translation-extras">
      <span className="koma-field__label">
        {t('dashboard.aio.customAi.title')}
      </span>
      <div className="koma-aio-llm-panel">
        <textarea
          value={llmExtraContext}
          onChange={(e) =>
            setLlmSettings((prev) =>
              clampLlmRequestSettings({
                ...prev,
                extra_context: e.target.value,
              }),
            )
          }
          className={
            noir
              ? "panel-cut-sm w-full border border-paper/12 bg-ink px-2.5 py-2 font-mono text-[11px] text-paper placeholder:text-paper/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson"
              : "koma-input"
          }
          rows={3}
          placeholder={t("dashboard.dashboardLlm.extraContextPlaceholder")}
        />

        <div className="koma-aio-llm-toggles">
          <AioChecklistOption
            noir={noir}
            checked={llmTranslationNotesEnabled}
            label={t("dashboard.aio.translation.notesToggle")}
            onChange={(checked) =>
              setLlmSettings((prev) =>
                clampLlmRequestSettings({
                  ...prev,
                  translation_notes_enabled: checked,
                }),
              )
            }
          />
          <AioChecklistOption
            noir={noir}
            checked={llmNeighborContextEnabled}
            label={t("dashboard.aio.translation.neighborContextToggle")}
            onChange={(checked) =>
              setLlmSettings((prev) =>
                clampLlmRequestSettings({
                  ...prev,
                  neighbor_image_context_enabled: checked,
                }),
              )
            }
          />
          <AioChecklistOption
            noir={noir}
            checked={llmImageInputEnabled}
            label={t("dashboard.aio.translation.multimodalToggle")}
            onChange={(checked) =>
              setLlmSettings((prev) =>
                clampLlmRequestSettings({
                  ...prev,
                  image_input_enabled: checked,
                }),
              )
            }
          />
        </div>

        <div className="koma-aio-llm-sliders">
          <KlSlider
            label={t("dashboard.dashboardLlm.temperature")}
            value={llmTemperature}
            min={0}
            max={2}
            step={0.05}
            onChange={(v) =>
              setLlmSettings((prev) =>
                clampLlmRequestSettings({
                  ...prev,
                  temperature: v,
                }),
              )
            }
            resetVal={0.2}
          />
          <KlSlider
            label={t("dashboard.dashboardLlm.topP")}
            value={llmTopP}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) =>
              setLlmSettings((prev) =>
                clampLlmRequestSettings({
                  ...prev,
                  top_p: v,
                }),
              )
            }
            resetVal={0.95}
          />
          <KlSlider
            label={t("dashboard.dashboardLlm.maxTokens")}
            value={llmMaxTokens}
            min={128}
            max={8192}
            step={64}
            onChange={(v) =>
              setLlmSettings((prev) =>
                clampLlmRequestSettings({
                  ...prev,
                  max_tokens: v,
                }),
              )
            }
            resetVal={4096}
          />
        </div>

        <p className="koma-aio-hint">
          {t("dashboard.aio.translation.activeConfigFor", {
            value: supportSummary,
          })}
        </p>
      </div>
    </div>
  );
});
