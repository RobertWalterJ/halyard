// Halyard — assemble the deployable site from app/.
// Writes two identical copies:
//   dist/web  — for a drag-and-drop / zip upload to any static host
//   docs/     — what GitHub Pages serves (Settings → Pages → branch, /docs)
// The individual app/flags/*.svg are deliberately left out: nothing references
// them (the app reads the bundled data/flag-svgs.json), and they are ~1.9MB.
// Re-runnable:  node build/make-deploy.mjs
import { mkdirSync, copyFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'app');

const FILES = [
  'index.html',
  'styles.css',
  'app.js',
  'sw.js',
  'manifest.webmanifest',
  'data/flags.json',
  'data/flag-svgs.json',
  'fonts/bricolage-latin.woff2',
  'fonts/bricolage-latin-ext.woff2',
  'fonts/instrument-latin.woff2',
  'fonts/instrument-latin-ext.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

const targets = [join(ROOT, 'dist', 'web'), join(ROOT, 'docs')];

let bytes = 0;
for (const target of targets) {
  rmSync(target, { recursive: true, force: true });
  for (const rel of FILES) {
    const dest = join(target, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(APP, rel), dest);
  }
}

const walk = (d) => readdirSync(d).reduce((n, f) => {
  const p = join(d, f);
  return n + (statSync(p).isDirectory() ? walk(p) : statSync(p).size);
}, 0);
bytes = walk(targets[0]);

// A precache entry that 404s makes the whole service-worker install reject,
// which kills offline silently. Fail the build instead.
const swSrc = readdirSync(targets[0]).includes('sw.js');
if (!swSrc) throw new Error('sw.js missing from the deploy');

console.log('files per copy :', FILES.length);
console.log('written        :', targets.map((t) => t.replace(ROOT + '\\', '')).join('  +  '));
console.log('size           :', (bytes / 1024 / 1024).toFixed(2) + 'MB');
