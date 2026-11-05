import { pathToFileURL } from "node:url";

export const isDirectExecution = (importMetaUrl, argv1) => {
  if (!argv1) {
    return false;
  }

  try {
    return importMetaUrl === pathToFileURL(argv1).href;
  } catch {
    return false;
  }
};
