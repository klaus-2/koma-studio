import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  BACKEND_MANAGED_MODEL_IDS,
  FONT_RTDETR_MODEL_ID,
} from "../model-manager/constants.ts";
import { isInstalledPayloadPresent } from "../model-manager/installed-state.ts";

test("font detector installs through the backend-managed path", () => {
  assert.ok(BACKEND_MANAGED_MODEL_IDS.has(FONT_RTDETR_MODEL_ID));
});

test("font detector requires detector.onnx as its payload", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "koma-font-rtdetr-"));
  try {
    assert.equal(isInstalledPayloadPresent(FONT_RTDETR_MODEL_ID, directory), false);

    fs.writeFileSync(path.join(directory, "model.bin"), "weights");
    assert.equal(isInstalledPayloadPresent(FONT_RTDETR_MODEL_ID, directory), false);

    fs.writeFileSync(path.join(directory, "detector.onnx"), "weights");
    assert.equal(isInstalledPayloadPresent(FONT_RTDETR_MODEL_ID, directory), true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
