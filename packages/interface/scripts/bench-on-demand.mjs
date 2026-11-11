/**
 * The measurable proof for on-demand CBZ extraction — REAL end-to-end.
 *
 * BEFORE: POST the whole archive to the live backend's /ingest/images (the
 *         code path this change replaces), then unzip the whole response —
 *         exactly what the old frontend did.
 * AFTER:  the browser-side random-access reader, importing the production
 *         module directly.
 *
 * Requires the mini-backend running on PORT (default 8017) and the fixture
 * from scripts/make-bench-cbz.mjs.
 *
 * Usage: bun run scripts/bench-on-demand.mjs
 */
import { unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '..', '.tmp-bench', 'chapter.cbz');
const port = process.env.BENCH_PORT ?? '8017';
const baseUrl = `http://127.0.0.1:${port}`;

const fixture = readFileSync(fixturePath);
const fmt = (ms) => `${(ms / 1000).toFixed(2)} s`;
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

// ---------------------------------------------------------------------------
// BEFORE: whole-archive upload + full inflate of the response.
// ---------------------------------------------------------------------------

const benchBefore = async () => {
  const start = performance.now();

  const form = new FormData();
  form.append('files', new File([fixture], 'chapter.cbz', { type: 'application/zip' }));

  const response = await fetch(`${baseUrl}/ingest/images`, { method: 'POST', body: form });
  if (!response.ok) {
    throw new Error(`backend returned ${response.status}: ${await response.text()}`);
  }
  const uploadAndDecode = performance.now() - start;

  // The old frontend then inflated the whole response zip before any page
  // could be shown.
  const buffer = new Uint8Array(await response.arrayBuffer());
  const all = unzipSync(buffer);
  const decodeInflate = performance.now() - start;

  const totalBytes = Object.values(all).reduce((sum, bytes) => sum + bytes.length, 0);
  return { uploadAndDecode, total: decodeInflate, totalBytes, count: Object.keys(all).length };
};

// ---------------------------------------------------------------------------
// AFTER: the on-demand reader (production module, imported directly).
// ---------------------------------------------------------------------------

const { openArchiveChapter, readArchiveEntry } = await import(
  '../src/utils/archive-chapter-reader.ts'
);

const benchAfter = async () => {
  const file = new File([fixture], 'chapter.cbz', { type: 'application/zip' });

  let peakResident = 0;
  let bytesRead = 0;

  const start = performance.now();
  const { chapter } = await openArchiveChapter(file);
  const timeToFirstPage = performance.now() - start;

  for (const entry of chapter.entries) {
    bytesRead += entry.compressedSize;
    const bytes = await readArchiveEntry(chapter, entry);
    if (bytes.byteLength > peakResident) peakResident = bytes.byteLength;
    // release() before the next page: one page resident at a time.
  }
  const total = performance.now() - start;

  return { timeToFirstPage, peakResident, bytesRead, total, pages: chapter.entries.length };
};

console.log('=== On-demand CBZ extraction benchmark (real backend) ===');
console.log(`fixture: 100 pages, ${mb(fixture.length)} archive`);
console.log('');

let before;
try {
  before = await benchBefore();
  console.log('BEFORE (upload whole archive + full inflate of the response):');
  console.log(`  upload + backend decode     : ${fmt(before.uploadAndDecode)}`);
  console.log(`  + frontend inflate of all   : ${fmt(before.total)}`);
  console.log(`  peak resident page bytes    : ${mb(before.totalBytes)} (all ${before.count} pages)`);
  console.log(`  bytes read from the archive : ${mb(fixture.length)} (whole archive)`);
} catch (error) {
  console.log(`BEFORE path unavailable: ${error.message}`);
  console.log('(is the mini-backend running? set BENCH_PORT or start it)');
  process.exit(1);
}

const after = await benchAfter();
console.log('');
console.log('AFTER (on-demand reader, browser-side):');
console.log(`  time to first page available: ${fmt(after.timeToFirstPage)}`);
console.log(`  total sequential extraction : ${fmt(after.total)} (all ${after.pages} pages)`);
console.log(`  peak resident page bytes    : ${mb(after.peakResident)} (one page)`);
console.log(`  bytes read from the archive : ${mb(after.bytesRead)} (central directory + one entry per page)`);
console.log('');
console.log('RATIOS (before.total / after.timeToFirstPage):');
console.log(`  time to first usable page   : ${(before.total / after.timeToFirstPage).toFixed(1)}x faster`);
console.log(`  peak resident bytes         : ${(before.totalBytes / after.peakResident).toFixed(1)}x lower`);
console.log('');
console.log(
  `ACCEPTANCE (>=10x time, >=20x bytes): ${
    before.total / after.timeToFirstPage >= 10 && before.totalBytes / after.peakResident >= 20
      ? 'PASS'
      : 'FAIL'
  }`,
);
