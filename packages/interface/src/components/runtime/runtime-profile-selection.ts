export interface RuntimeProfileSelectionOption {
  profile: string;
  recommended: boolean;
}

export const resolveRecommendedSelectableProfile = (
  artifacts: RuntimeProfileSelectionOption[],
  recommendedProfile: string,
): string => {
  const exactMatch = artifacts.find((artifact) => artifact.profile === recommendedProfile);
  if (exactMatch) {
    return exactMatch.profile;
  }

  const manifestRecommended = artifacts.find((artifact) => artifact.recommended);
  if (manifestRecommended) {
    return manifestRecommended.profile;
  }

  return artifacts[0]?.profile ?? recommendedProfile;
};
