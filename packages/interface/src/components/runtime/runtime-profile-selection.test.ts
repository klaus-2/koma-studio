import { test } from "vitest";
import assert from "node:assert/strict";

import { resolveRecommendedSelectableProfile } from "./runtime-profile-selection.ts";

test("resolveRecommendedSelectableProfile returns the exact recommended profile when it exists in the artifacts list", () => {
  const profile = resolveRecommendedSelectableProfile(
    [
      { profile: "cpu", recommended: false },
      { profile: "nvidia-cuda-legacy", recommended: true },
    ],
    "nvidia-cuda-legacy",
  );

  assert.equal(profile, "nvidia-cuda-legacy");
});

test("resolveRecommendedSelectableProfile falls back to the manifest recommended entry when the explicit recommendation is unavailable", () => {
  const profile = resolveRecommendedSelectableProfile(
    [
      { profile: "cpu", recommended: false },
      { profile: "intel-openvino", recommended: true },
    ],
    "nvidia-cuda-legacy",
  );

  assert.equal(profile, "intel-openvino");
});
