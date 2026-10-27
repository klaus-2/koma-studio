import type { ConfigEnv, UserConfig } from "vite";
import baseConfig from "./vite.config";
import { bundleReport } from "../../scripts/perf/bundle-report-plugin.mjs";

export default async (env: ConfigEnv): Promise<UserConfig> => {
  const config = await baseConfig(env);

  return {
    ...config,
    plugins: [...(config.plugins ?? []), bundleReport()],
    build: {
      ...config.build,
      outDir: "dist-perf",
      emptyOutDir: true,
    },
  };
};
