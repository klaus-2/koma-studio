import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  BASE_TRANSLATION_MODELS_REGISTRY,
  DETECT_TEXT_MODELS_REGISTRY,
  RECOGNIZE_TEXT_MODELS_REGISTRY,
} from './translation-text-model-registry-data';
import {
  CLEAN_IMAGE_MODELS_REGISTRY,
  ENHANCE_IMAGE_MODELS_REGISTRY,
  IMAGE_EDIT_MODELS_REGISTRY,
  SEGMENT_TEXT_MODELS_REGISTRY,
} from './translation-image-model-registry-data';

const REPO_ROOT = path.resolve(__dirname, '../../../..');

const readRepoText = (relPath: string): string =>
  fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');

const extractConstSymbols = (source: string): ReadonlyMap<string, string> => {
  const map = new Map<string, string>();
  const pattern = /\bconst\s+([A-Z0-9_]+)\s*=\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) {
    const [, sym, val] = match;
    if (sym && val) map.set(val, sym);
  }
  return map;
};

describe('model registry cross-layer wiring', () => {
  it('wires every downloadable model across manifest, mini-backend, Tauri, and Electron', () => {
    const manifestJson = JSON.parse(
      readRepoText('packages/mini-backend/models/manifests/model-assets.json'),
    ) as {
      models?: Record<string, unknown>;
      install?: Record<string, unknown>;
    };
    const pyInstall = readRepoText('packages/mini-backend/routers/model_install.py');
    const tauriMod = readRepoText('apps/tauri/src-tauri/src/services/models/mod.rs');
    const tauriPayload = readRepoText('apps/tauri/src-tauri/src/services/models/payload.rs');
    const electronConst = readRepoText('apps/electron/electron/model-manager/constants.ts');
    const electronState = readRepoText('apps/electron/electron/model-manager/installed-state.ts');
    const electronSymbols = extractConstSymbols(electronConst);

    const allModels = [
      ...BASE_TRANSLATION_MODELS_REGISTRY,
      ...DETECT_TEXT_MODELS_REGISTRY,
      ...RECOGNIZE_TEXT_MODELS_REGISTRY,
      ...SEGMENT_TEXT_MODELS_REGISTRY,
      ...CLEAN_IMAGE_MODELS_REGISTRY,
      ...ENHANCE_IMAGE_MODELS_REGISTRY,
      ...IMAGE_EDIT_MODELS_REGISTRY,
    ];

    const missingWiring: string[] = [];

    for (const model of allModels) {
      const id = model.id;
      const strategy = model.installStrategy ?? 'default';
      if (strategy === 'manual_import') {
        continue;
      }

      if (strategy === 'backend_managed' || strategy === 'default') {
        if (!tauriMod.includes(`"${id}"`)) {
          missingWiring.push(`${id}: missing from apps/tauri BACKEND_MANAGED_MODEL_IDS`);
        }
        if (!electronConst.includes(`"${id}"`)) {
          missingWiring.push(`${id}: missing from apps/electron BACKEND_MANAGED_MODEL_IDS`);
        }
        const dispatchedViaImageEdit = model.stage === 'imageEdit';
        if (!dispatchedViaImageEdit && !pyInstall.includes(`"${id}"`)) {
          missingWiring.push(`${id}: missing from packages/mini-backend/routers/model_install.py`);
        }
      }

      if (!tauriPayload.includes(`"${id}"`)) {
        missingWiring.push(`${id}: missing explicit check in apps/tauri payload.rs`);
      }
      const electronSymbol = electronSymbols.get(id);
      const handledInElectronState =
        electronState.includes(`"${id}"`) ||
        electronState.includes(`'${id}'`) ||
        (electronSymbol !== undefined && electronState.includes(electronSymbol));
      if (!handledInElectronState) {
        missingWiring.push(`${id}: missing explicit check in apps/electron installed-state.ts`);
      }

      if (id !== 'baka_content_cc' && id !== 'ctd_text_seg') {
        if (!manifestJson.install?.[id]) {
          missingWiring.push(`${id}: missing from model-assets.json install`);
        }
        if (strategy !== 'direct_download' && !manifestJson.models?.[id]) {
          missingWiring.push(`${id}: missing from model-assets.json models`);
        }
      }
    }

    expect(missingWiring).toEqual([]);
  });
});
