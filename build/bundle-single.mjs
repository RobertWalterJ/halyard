// Halyard — single-file build. Inlines CSS, JS and both data payloads into one
// self-contained HTML page (dist/halyard.html) with no external requests.
// Used for the phone build, where there is no server to fetch from.
// Re-runnable:  node build/bundle-single.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'app');
const DIST = join(ROOT, 'dist');
mkdirSync(DIST, { recursive: true });

const read = (...p) => readFileSync(join(APP, ...p), 'utf8');

const html = read('index.html');
let css = read('styles.css');
const js = read('app.js');
const flags = read('data', 'flags.json');
const svgs = read('data', 'flag-svgs.json');

// Inline the self-hosted fonts. The single-file build has no server to fetch
// them from, and the artifact CSP would block them from anywhere else.
let fontCount = 0;
css = css.replace(/url\((fonts\/[^)]+\.woff2)\)/g, (_, rel) => {
  const b64 = readFileSync(join(APP, rel)).toString('base64');
  fontCount++;
  return `url(data:font/woff2;base64,${b64})`;
});

// Pull the body content out of the served page — the artifact host supplies its
// own doctype/head/body wrapper, so we must not ship our own.
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
if (!bodyMatch) throw new Error('could not find <body> in index.html');
let body = bodyMatch[1];

// Drop the tags that only make sense for the served build.
body = body
  .replace(/<script\s+src="app\.js"><\/script>/i, '')
  .trim();

// A literal </script> inside JSON would close the tag early. Flag SVGs contain
// no such thing today, but escaping it keeps the build honest if that changes.
const safeJson = (s) => s.replace(/<\/script/gi, '<\\/script');

const out = `<title>Halyard</title>
<style>
${css}
</style>

${body}

<script type="application/json" id="halyard-data">${safeJson(flags)}</script>
<script type="application/json" id="halyard-svgs">${safeJson(svgs)}</script>
<script>
${js}
</script>
`;

const file = join(DIST, 'halyard.html');
writeFileSync(file, out);
console.log('wrote  ', file);
console.log('fonts  :', fontCount, 'inlined');
console.log('size   :', (Buffer.byteLength(out) / 1024 / 1024).toFixed(2) + 'MB');
if (/url\(fonts\//.test(out)) throw new Error('a font URL was left un-inlined');
