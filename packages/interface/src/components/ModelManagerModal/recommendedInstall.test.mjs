import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadHelperModule = async () => {
  const helperPath = path.resolve(__dirname, 'recommendedInstall.ts');
  const source = await readFile(helperPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    fileName: helperPath,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
    },
  });

  const diagnostics = transpiled.diagnostics ?? [];
  assert.equal(diagnostics.length, 0, 'TypeScript helper should transpile without diagnostics');

  const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`;
  return import(moduleUrl);
};

test('returns curated recommendation for translation korean', async () => {
  const helper = await loadHelperModule();
  assert.deepEqual(
    helper.getRecommendedModelIdsForStage('translation', 'ko'),
    ['hunyuan_7b_mt_v1_0'],
  );
});

test('returns no curated translation recommendation for unsupported language', async () => {
  const helper = await loadHelperModule();
  assert.deepEqual(
    helper.getRecommendedModelIdsForStage('translation', 'ru'),
    [],
  );
});

test('builds stage summary only from recommended IDs', async () => {
  const helper = await loadHelperModule();
  const entries = {
    manga_ocr: {
      model: { id: 'manga_ocr', stage: 'recognizeText' },
      status: 'not_installed',
    },
    paddleocr_en_v5: {
      model: { id: 'paddleocr_en_v5', stage: 'recognizeText' },
      status: 'not_installed',
    },
    font_rtdetr_v2: {
      model: { id: 'font_rtdetr_v2', stage: 'detectText' },
      status: 'not_installed',
    },
  };

  const summary = helper.buildScopedInstallSummary(
    entries,
    'recognizeText',
    'ja',
    { totalBytes: 999, requiredBytes: 999, eligibleModelIds: ['font_rtdetr_v2'] },
    (model) => (model.id === 'manga_ocr' ? 300 : 500),
  );

  assert.deepEqual(summary.eligibleModelIds, ['manga_ocr']);
  assert.equal(summary.totalBytes, 300);
  assert.equal(summary.requiredBytes, 300);
});
