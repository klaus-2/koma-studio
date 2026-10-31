import path from "node:path";

import { test } from "../support/fixtures.ts";
import type { LayerAdapter } from "../flows/layer-adapter.ts";
import { runMainFlow } from "../flows/main-flow.ts";

const adapter = (runRoot: string): LayerAdapter => ({
  canExport: true,
  canImportWorkspace: true,
  fullManual: true,
  workspaceAutosavePath: path.join(runRoot, "workspace"),
  modelsRoot: path.join(runRoot, "models"),
  reload: async (page) => {
    // goto with the same URL is a same-document navigation and would leave
    // modals open; the install loop needs a real document reload.
    await page.reload({
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
  },
});

test("main flow", async ({ app, runRoot, summary }) => {
  const result = await runMainFlow(app, adapter(runRoot), {
    stopAfter: process.env.E2E_STOP_AFTER ?? "",
  });
  summary.record("main", result);
});
