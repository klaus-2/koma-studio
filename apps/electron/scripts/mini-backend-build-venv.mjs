import path from "node:path";

const buildVenvName = (profileKey) => `.venv-mini-build-${profileKey}`;

export const resolveRuntimeArtifactBuildVenvLinkPath = ({
  profileKey,
  rootDir,
}) => path.join(rootDir, buildVenvName(profileKey));

export const resolveRuntimeArtifactBuildVenvPath = ({
  profileKey,
  platform,
  externalStorageRoot,
  rootDir,
}) => {
  const venvName = buildVenvName(profileKey);
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  if (platform === "win32" && externalStorageRoot) {
    return pathApi.join(externalStorageRoot, venvName);
  }

  return pathApi.join(rootDir, venvName);
};
