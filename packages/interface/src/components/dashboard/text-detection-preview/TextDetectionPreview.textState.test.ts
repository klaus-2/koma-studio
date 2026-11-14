import { act, renderHook } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { DEFAULT_RENDER_STYLE } from "@/constants/dashboard.constants";
import { I18nProvider } from "@/i18n";
import { setDesktopBridgeProvider } from "@/lib/desktop-bridge";
import { useTextDetectionPreviewTextState } from "@/components/dashboard/text-detection-preview/TextDetectionPreview.textState";
import type { AioTextRegion } from "@/types/dashboard.types";

// The I18nProvider mount effect reads desktop locale preferences; tests run
// without a shell, so the bridge is nulled (same pattern as
// ErrorBoundary.test.tsx / AioBatchModePanel.test.tsx).
beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

const region = (
  id: string,
  recognizedText: string,
  translatedText: string,
  translatorModelKey?: string,
): AioTextRegion => ({
  id,
  bbox: [0, 0, 100, 40],
  score: 1,
  source: "model",
  modelKey: "test-model",
  recognizedText,
  translatedText,
  translationNotes: ["keep tone"],
  ...(translatorModelKey === undefined ? {} : { translatorModelKey }),
});

describe("useTextDetectionPreviewTextState — applyEditedRegionTranslation", () => {
  it("stamps manual_edit over an engine key when the translation is hand-edited", () => {
    const regions = [
      {
        ...region("r1", "こんにちは", "Hello", "qwen-engine"),
        // TM-served answer: the hand edit must clear the stale provenance.
        translationSource: "tm" as const,
      },
      region("r2", "待って", "Wait up"),
    ];
    const onRegionsChange = vi.fn();
    const { result } = renderHook(
      () =>
        useTextDetectionPreviewTextState({
          regions,
          selectedRegionId: null,
          editable: true,
          selectionEnabled: true,
          onCardSelect: () => undefined,
          onSelectRegion: () => undefined,
          onRegionsChange,
          translationNotesEnabled: false,
          overlayRef: { current: null },
          fallbackStyle: DEFAULT_RENDER_STYLE,
        }),
      { wrapper: I18nProvider },
    );

    act(() => {
      result.current.setTextEditor({
        regionId: "r1",
        x: 0,
        y: 0,
        value: "Corrected",
        target: "translated",
      });
    });
    act(() => {
      result.current.handleEditorSave();
    });

    expect(onRegionsChange).toHaveBeenCalledTimes(1);
    const nextRegions = onRegionsChange.mock.calls[0]?.[0] as AioTextRegion[];
    expect(nextRegions[0]).toMatchObject({
      id: "r1",
      translatedText: "Corrected",
      // The fix: the provenance stamp is UNCONDITIONAL — a hand-edited
      // engine region must not keep its engine key (the reimport conflict
      // predicate depends on it).
      translatorModelKey: "manual_edit",
    });
    // The stale TM provenance is cleared with the stamp so the TM hit-count
    // readout stays truthful.
    expect(nextRegions[0]?.translationSource).toBeNull();
    // Notes are cleared by the hand-edit path; the untouched region is
    // passed through unchanged (its provenance is untouched too).
    expect(nextRegions[0]?.translationNotes).toBeUndefined();
    expect(nextRegions[1]).toBe(regions[1]);
  });

  it("keeps the manual_edit stamp on an already-manual region", () => {
    const regions = [region("r1", "こんにちは", "Hello", "manual_edit")];
    const onRegionsChange = vi.fn();
    const { result } = renderHook(
      () =>
        useTextDetectionPreviewTextState({
          regions,
          selectedRegionId: null,
          editable: true,
          selectionEnabled: true,
          onCardSelect: () => undefined,
          onSelectRegion: () => undefined,
          onRegionsChange,
          translationNotesEnabled: false,
          overlayRef: { current: null },
          fallbackStyle: DEFAULT_RENDER_STYLE,
        }),
      { wrapper: I18nProvider },
    );

    act(() => {
      result.current.setTextEditor({
        regionId: "r1",
        x: 0,
        y: 0,
        value: "Edited again",
        target: "translated",
      });
    });
    act(() => {
      result.current.handleEditorSave();
    });

    const nextRegions = onRegionsChange.mock.calls[0]?.[0] as AioTextRegion[];
    expect(nextRegions[0]).toMatchObject({
      translatedText: "Edited again",
      translatorModelKey: "manual_edit",
    });
  });
});
