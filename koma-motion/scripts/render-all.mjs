import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_DIR = path.resolve(scriptDir, '..');
const OUT_ROOT = path.resolve(STUDIO_DIR, '..', 'packages', 'interface', 'src', 'assets', 'koma-motion');
const HF_CLI = 'C:\\Users\\Administrator\\.agents\\skills\\hyperframes\\scripts\\plugin-cli.mjs';

const MASCOT_POSES = [
  'idle',
  'wave',
  'casting',
  'celebrate',
  'peek',
  'sleep',
  'stretch',
  'surprised',
];

const TOOL_KINDS = [
  'healing',
  'magic-wand',
  'segment-brush',
  'segment-eraser',
  'paint',
  'paint-eraser',
  'clear-paint',
  'reset-edits',
  'area-select',
  'config',
  'clear-page',
  'stage-detect',
  'stage-ocr',
  'stage-translate',
  'stage-segment',
  'stage-clean',
  'stage-render',
];

const mode = process.argv[2] ?? 'all';

function run(cmd, args, label) {
  const res = spawnSync(cmd, args, {
    cwd: STUDIO_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (res.status !== 0) {
    console.error(`[FAIL] ${label}\n${res.stdout}\n${res.stderr}`);
    process.exit(1);
  }
  return res.stdout;
}

function findFramePattern(framesDir) {
  const files = fs.readdirSync(framesDir).filter((f) => f.endsWith('.png')).toSorted();
  if (files.length === 0) {
    throw new Error(`No PNG frames written in ${framesDir}`);
  }

  const first = files[0];
  const match = first.match(/^(.*?)(\d+)\.png$/);
  if (!match) {
    throw new Error(`Unexpected frame filename format: ${first}`);
  }
  const [, prefix, digits] = match;
  return {
    pattern: path.join(framesDir, `${prefix}%0${digits.length}d.png`),
    startNumber: Number.parseInt(digits, 10),
    midFile: path.join(framesDir, files[Math.floor(files.length * 0.48)] ?? first),
    count: files.length,
  };
}

function renderMascot() {
  const dir = path.join(OUT_ROOT, 'mascot');
  fs.mkdirSync(dir, { recursive: true });
  for (const pose of MASCOT_POSES) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `hf-koma-${pose}-`));
    const outWebm = path.join(dir, `koma-${pose}.webm`);
    const outPoster = path.join(dir, `koma-${pose}.webp`);
    try {
      console.log(`[mascot] rendering ${pose} (60fps RGBA)`);
      run(
        process.execPath,
        [
          HF_CLI,
          'render',
          '-c',
          'compositions/koma-neko.html',
          '--format',
          'png-sequence',
          '--fps',
          '60',
          '--quality',
          'looks',
          '--no-browser-gpu',
          '--workers',
          '3',
          '--quiet',
          '--variables',
          JSON.stringify({ pose, bg: 'transparent' }),
          '-o',
          tmpDir,
        ],
        `mascot-frames:${pose}`,
      );
      const { pattern, startNumber, midFile } = findFramePattern(tmpDir);

      run(
        'ffmpeg',
        [
          '-y',
          '-v',
          'error',
          '-framerate',
          '60',
          '-start_number',
          String(startNumber),
          '-i',
          pattern,
          '-c:v',
          'libvpx-vp9',
          '-pix_fmt',
          'yuva420p',
          '-auto-alt-ref',
          '0',
          '-crf',
          '30',
          '-b:v',
          '0',
          '-deadline',
          'good',
          '-cpu-used',
          '2',
          '-an',
          outWebm,
        ],
        `mascot-vp9:${pose}`,
      );

      run(
        'ffmpeg',
        ['-y', '-v', 'error', '-i', midFile, '-c:v', 'libwebp', '-quality', '88', outPoster],
        `mascot-poster:${pose}`,
      );
      const kb = (fs.statSync(outWebm).size / 1024).toFixed(1);
      const pkb = (fs.statSync(outPoster).size / 1024).toFixed(1);
      console.log(`  ok koma-${pose}.webm=${kb} KB · poster=${pkb} KB`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

function renderTools(theme) {
  const dir = path.join(OUT_ROOT, 'tools', theme);
  fs.mkdirSync(dir, { recursive: true });
  for (const kind of TOOL_KINDS) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `hf-tool-${theme}-${kind}-`));
    const outWebm = path.join(dir, `${kind}.webm`);
    const outPoster = path.join(dir, `${kind}.webp`);
    try {
      console.log(`[tools:${theme}] rendering ${kind} (30fps)`);
      run(
        process.execPath,
        [
          HF_CLI,
          'render',
          '-c',
          'compositions/tool-demo.html',
          '--format',
          'png-sequence',
          '--fps',
          '30',
          '--quality',
          'looks',
          '--no-browser-gpu',
          '--workers',
          '3',
          '--quiet',
          '--variables',
          JSON.stringify({ kind, theme }),
          '-o',
          tmpDir,
        ],
        `tool-frames:${theme}:${kind}`,
      );
      const { pattern, startNumber, midFile } = findFramePattern(tmpDir);
      run(
        'ffmpeg',
        [
          '-y',
          '-v',
          'error',
          '-framerate',
          '30',
          '-start_number',
          String(startNumber),
          '-i',
          pattern,
          '-c:v',
          'libvpx-vp9',
          '-pix_fmt',
          'yuv420p',
          '-crf',
          '30',
          '-b:v',
          '0',
          '-deadline',
          'good',
          '-cpu-used',
          '2',
          '-an',
          outWebm,
        ],
        `tool-vp9:${theme}:${kind}`,
      );
      run(
        'ffmpeg',
        ['-y', '-v', 'error', '-i', midFile, '-c:v', 'libwebp', '-quality', '84', outPoster],
        `tool-poster:${theme}:${kind}`,
      );
      const kb = (fs.statSync(outWebm).size / 1024).toFixed(1);
      const pkb = (fs.statSync(outPoster).size / 1024).toFixed(1);
      console.log(`  ok ${theme}/${kind}.webm=${kb} KB · poster=${pkb} KB`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

if (mode === 'mascot' || mode === 'all') renderMascot();
if (mode === 'tools-noir' || mode === 'all') renderTools('noir');
if (mode === 'tools-classic' || mode === 'all') renderTools('classic');
console.log('[DONE]', mode);
