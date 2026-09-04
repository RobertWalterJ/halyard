// Halyard — data build. Joins flag-icons + world-countries + World Bank population
// into app/data/flags.json, and emits minified SVGs into app/flags/.
// Re-runnable:  node build/build-data.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'sources');
const OUT_DATA = join(ROOT, 'app', 'data');
const OUT_FLAGS = join(ROOT, 'app', 'flags');
mkdirSync(OUT_DATA, { recursive: true });
mkdirSync(OUT_FLAGS, { recursive: true });

const jf = (f) => JSON.parse(readFileSync(join(SRC, f), 'utf8'));
const flagIcons = jf('flag-icons.country.json');
const world = jf('world-countries.json');
const wb = jf('worldbank-population.json');

// ---------- lookups ----------
const byCca2 = new Map(world.map((c) => [c.cca2.toLowerCase(), c]));
// world-countries lists borders as cca3; the app keys everything on cca2
const cca3ToCca2 = new Map(world.map((c) => [c.cca3, c.cca2.toLowerCase()]));
const popByIso3 = new Map();
for (const r of wb[1] || []) {
  if (r.value != null && r.countryiso3code) popByIso3.set(r.countryiso3code, r.value);
}

// Flags that are widely recognised despite small populations.
const FAMOUS = new Set(['ch', 'is', 'ie', 'nz', 'il', 'jm', 'no', 'dk', 'se', 'fi', 'gr', 'mc', 'va', 'lu', 'mt', 'sg', 'cu', 'bs', 'fj', 'uy', 'cy', 'ee', 'lv', 'lt', 'si', 'hr', 'me', 'al', 'md', 'ge', 'am', 'pa', 'cr', 'qa', 'kw', 'bh', 'ae', 'om', 'lb', 'jo', 'mn', 'bt', 'bb', 'tt']);

// Places that are uninhabited or have no settled population.
const UNINHABITED = new Set(['aq', 'bv', 'hm', 'tf', 'um', 'cp', 'dg', 'gs', 'io', 'sj', 'pn', 'cc', 'cx', 'nf', 'tk', 'nu', 'wf', 'bq']);

// Partially recognised / disputed. Their own opt-in group rather than being
// silently ruled in or out of "countries".
const DISPUTED = new Map([
  ['xk', 'Kosovo'],
  ['tw', 'Taiwan'],
  ['ps', 'Palestine'],
  ['eh', 'Western Sahara'],
]);

// International bodies bundled with flag-icons — the seed of the Orgs pack.
const ORGS = new Map([
  ['un', 'United Nations'],
  ['eu', 'European Union'],
  ['asean', 'ASEAN'],
  ['arab', 'Arab League'],
  ['cefta', 'CEFTA'],
  ['eac', 'East African Community'],
  ['pc', 'Pacific Community'],
]);

// Sub-national flags shipped with flag-icons — the seed of the Sub-national pack.
const SUBDIV = new Map([
  ['gb-eng', ['England', 'United Kingdom']],
  ['gb-sct', ['Scotland', 'United Kingdom']],
  ['gb-wls', ['Wales', 'United Kingdom']],
  ['gb-nir', ['Northern Ireland', 'United Kingdom']],
  ['es-ct', ['Catalonia', 'Spain']],
  ['es-pv', ['Basque Country', 'Spain']],
  ['es-ga', ['Galicia', 'Spain']],
  ['ic', ['Canary Islands', 'Spain']],
  ['sh-ac', ['Ascension Island', 'Saint Helena']],
  ['sh-hl', ['Saint Helena', 'Saint Helena']],
  ['sh-ta', ['Tristan da Cunha', 'Saint Helena']],
]);

// Classic look-alikes, for deliberately cruel distractors on hard mode.
const CONFUSABLE = [
  ['td', 'ro', 'md', 'ad'],
  ['id', 'mc', 'pl', 'sg'],
  ['nl', 'lu', 'hr', 'py'],
  ['ie', 'ci', 'it', 'in'],
  ['au', 'nz', 'fj', 'ck'],
  ['no', 'is', 'fo', 'dk', 'fi', 'se'],
  ['si', 'sk', 'ru', 'rs', 'cz'],
  ['ve', 'co', 'ec', 'bo'],
  ['at', 'lv', 'pe', 'ca'],
  ['sn', 'ml', 'gn', 'cm'],
  ['tr', 'tn', 'dz', 'pk'],
  ['eg', 'iq', 'sy', 'ye'],
  ['ar', 'ni', 'sv', 'hn', 'gt', 'uy'],
  ['ph', 'cz'],
  ['us', 'lr', 'my'],
  ['tv', 'ck', 'fj', 'nz'],
  ['ae', 'kw'],
  ['jo', 'ps', 'sd', 'eh'],
  ['bg', 'hu', 'ir', 'it'],
  ['mx', 'it', 'ie', 'hu'],
  ['gb', 'nz', 'au'],
  ['cl', 'cu', 'pr'],
  ['ch', 'dk', 'ga', 'tg'],
];
// Flags that are indistinguishable *as drawn here*. The source set normalises
// every flag to 4:3, so aspect ratio — the only thing separating some of these —
// is not on screen. Two of them in one question is an unanswerable question, so
// they are never offered together.
//   id/mc  identical design, 2:3 vs 4:5 in life, reds differ by ~41/255
//   ro/td  same tricolour; Chad's blue is darker but only by ~57 at phone size
const IDENTICAL = [
  ['id', 'mc'],
  ['ro', 'td'],
];
const clashOf = new Map();
for (const grp of IDENTICAL) {
  for (const c of grp) {
    if (!clashOf.has(c)) clashOf.set(c, new Set());
    for (const o of grp) if (o !== c) clashOf.get(c).add(o);
  }
}

const confusableOf = new Map();
for (const grp of CONFUSABLE) {
  for (const c of grp) {
    if (!confusableOf.has(c)) confusableOf.set(c, new Set());
    for (const o of grp) if (o !== c) confusableOf.get(c).add(o);
  }
}

// ---------- colour signature ----------
// Coarse palette buckets so "which flags look alike" becomes computable.
const BUCKETS = [
  ['red', [220, 40, 40]],
  ['darkred', [130, 20, 25]],
  ['orange', [240, 140, 30]],
  ['yellow', [245, 215, 60]],
  ['green', [35, 150, 70]],
  ['darkgreen', [15, 85, 45]],
  ['cyan', [80, 200, 215]],
  ['blue', [40, 80, 190]],
  ['navy', [20, 35, 90]],
  ['purple', [110, 50, 150]],
  ['brown', [130, 90, 50]],
  ['white', [248, 248, 248]],
  ['lightgrey', [200, 200, 200]],
  ['grey', [128, 128, 128]],
  ['black', [25, 25, 25]],
];

const hexToRgb = (h) => {
  h = h.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

const bucketOf = (rgb) => {
  let best = null;
  let bd = Infinity;
  for (const [name, ref] of BUCKETS) {
    const d = (rgb[0] - ref[0]) ** 2 + (rgb[1] - ref[1]) ** 2 + (rgb[2] - ref[2]) ** 2;
    if (d < bd) { bd = d; best = name; }
  }
  return best;
};

const NAMED = {
  red: '#ee0000', blue: '#0044aa', green: '#009900', yellow: '#ffdd00',
  white: '#ffffff', black: '#000000', orange: '#ff8800', gold: '#ffdd00',
  silver: '#cccccc', gray: '#808080', grey: '#808080',
};

function colourSig(svg) {
  const counts = new Map();
  const re = /(?:fill|stop-color|stroke)\s*[:=]\s*["']?\s*(#[0-9a-fA-F]{3,6}|[a-z]+)/g;
  let m;
  while ((m = re.exec(svg))) {
    let tok = m[1].toLowerCase();
    if (tok === 'none' || tok === 'currentcolor' || tok === 'transparent') continue;
    if (!tok.startsWith('#')) {
      if (!NAMED[tok]) continue;
      tok = NAMED[tok];
    }
    const rgb = hexToRgb(tok);
    if (!rgb) continue;
    const b = bucketOf(rgb);
    counts.set(b, (counts.get(b) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map((e) => e[0]);
}

// ---------- svg minify (safe: comments + inter-tag whitespace only) ----------
const minifySvg = (s) => s
  .replace(/<\?xml[^>]*\?>/g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/>\s+</g, '><')
  .replace(/\s{2,}/g, ' ')
  .trim();

// ---------- build ----------
const fiByCode = new Map(flagIcons.map((f) => [f.code, f]));
const svgFiles = readdirSync(join(SRC, 'flags-4x3')).filter((f) => f.endsWith('.svg'));
const entries = [];
let bytesIn = 0;
let bytesOut = 0;

for (const file of svgFiles) {
  const code = file.replace(/\.svg$/, '');
  if (code === 'xx') continue;

  const raw = readFileSync(join(SRC, 'flags-4x3', file), 'utf8');
  const min = minifySvg(raw);
  bytesIn += Buffer.byteLength(raw);
  bytesOut += Buffer.byteLength(min);
  writeFileSync(join(OUT_FLAGS, file), min);

  const fi = fiByCode.get(code);
  const wcRec = byCca2.get(code);
  let group;
  let name;
  let region = null;
  let subregion = null;
  let capital = null;
  let pop = null;
  let parent = null;
  let facts = null;
  let borders = [];

  if (ORGS.has(code)) {
    group = 'org';
    name = ORGS.get(code);
  } else if (SUBDIV.has(code)) {
    group = 'subdivision';
    [name, parent] = SUBDIV.get(code);
  } else if (DISPUTED.has(code)) {
    group = 'disputed';
    name = DISPUTED.get(code);
    region = wcRec?.region ?? fi?.continent ?? null;
    subregion = wcRec?.subregion ?? null;
    capital = wcRec?.capital?.[0] ?? fi?.capital ?? null;
  } else if (wcRec) {
    group = (wcRec.unMember || wcRec.independent) ? 'country' : 'territory';
    name = wcRec.name.common;
    region = wcRec.region;
    subregion = wcRec.subregion;
    capital = wcRec.capital?.[0] ?? fi?.capital ?? null;
    pop = popByIso3.get(wcRec.cca3) ?? null;
    // Geography that was already downloaded and unused until now.
    facts = {
      currency: Object.values(wcRec.currencies || {})[0]?.name ?? null,
      demonym: wcRec.demonyms?.eng?.m ?? null,
      languages: Object.values(wcRec.languages || {}),
      landlocked: !!wcRec.landlocked,
      area: wcRec.area ?? null,
      latlng: wcRec.latlng ?? null,
      cca3: wcRec.cca3 ?? null,
    };
    borders = (wcRec.borders || []).map((b) => cca3ToCca2.get(b)).filter(Boolean);
  } else {
    group = 'territory';
    name = fi?.name ?? code.toUpperCase();
    region = fi?.continent ?? null;
    capital = fi?.capital ?? null;
  }
  if (UNINHABITED.has(code) && pop == null) pop = 0;

  const CORE_PACK = {
    country: 'countries', territory: 'territories', disputed: 'disputed',
    org: 'orgs', subdivision: 'subnational',
  };
  const rec = {
    code,
    name,
    group,
    pack: CORE_PACK[group],
    region,
    subregion,
    capital,
    pop: pop == null ? null : Math.round(pop),
    tier: null, // assigned by rank below
    colours: colourSig(raw),
    near: [...(confusableOf.get(code) || [])],
    clash: [...(clashOf.get(code) || [])],
    borders,
    ...(facts || {}),
  };
  if (parent) rec.parent = parent;
  entries.push(rec);
}

// ---------- difficulty tiers ----------
// Population is a poor proxy for *flag* recognisability: Burkina Faso outranks
// Austria on people but not on how many players know the flag. So tier 1 is a
// curated set of genuinely iconic flags, and the remainder is ranked by
// population weighted toward the regions a Canadian player sees most.
const TIER_1 = new Set([
  // Europe
  'gb', 'fr', 'de', 'it', 'es', 'pt', 'nl', 'be', 'ch', 'at', 'se', 'no', 'dk',
  'fi', 'is', 'ie', 'gr', 'pl', 'ru', 'ua', 'tr',
  // Americas
  'us', 'ca', 'mx', 'br', 'ar', 'cl', 'co', 'pe', 'cu', 'jm',
  // Asia
  'cn', 'jp', 'kr', 'kp', 'in', 'id', 'th', 'vn', 'ph', 'pk', 'il', 'sa', 'ae',
  'sg', 'my',
  // Africa
  'za', 'eg', 'ng', 'ke', 'ma', 'et', 'gh',
  // Oceania
  'au', 'nz', 'fj',
]);

const TIER_2_COUNT = 70; // how many of the remainder count as "Standard"
const REGION_WEIGHT = { Europe: 3, Americas: 1.6, Asia: 1, Oceania: 1.2, Africa: 1 };
const prominence = (e) =>
  Math.max(e.pop ?? 0, FAMOUS.has(e.code) ? 8e6 : 0) * (REGION_WEIGHT[e.region] ?? 1);

const countries = entries.filter((e) => e.group === 'country');
for (const e of countries) if (TIER_1.has(e.code)) e.tier = 1;

const remainder = countries
  .filter((e) => e.tier == null)
  .sort((a, b) => prominence(b) - prominence(a));
remainder.forEach((e, i) => { e.tier = i < TIER_2_COUNT ? 2 : 3; });
for (const e of entries) {
  if (e.tier != null) continue;
  e.tier = e.group === 'org' ? 1 : e.group === 'disputed' ? 2 : 3;
}

// Packs harvested into app/data/packs/ are declared here but NOT inlined: the
// US states alone are ~7.7MB of detailed seals, four times the whole core
// bundle. The app fetches a pack the first time it is switched on, and the
// service worker caches it from then on.
function corePacks() {
  const packs = {
    countries: { label: 'Countries', note: 'Sovereign states' },
    territories: { label: 'Territories', note: 'Dependencies and overseas territories' },
    disputed: { label: 'Disputed', note: 'Partially recognised states' },
    orgs: { label: 'Organisations', note: 'International bodies' },
    subnational: { label: 'Sub-national', note: 'UK, Spain, St Helena' },
  };
  const dir = join(OUT_DATA, 'packs');
  let files = [];
  try { files = readdirSync(dir).filter((f) => f.endsWith('.json')); } catch { files = []; }
  for (const f of files.sort()) {
    const p = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    packs[p.pack] = {
      label: p.label,
      note: p.note,
      // Path is resolved against the page, not against flags.json, so it must
      // be the full path from the app root.
      lazy: `data/packs/${f}`,
      count: p.flags.length,
      bytes: Buffer.byteLength(readFileSync(join(dir, f))),
    };
  }
  return packs;
}

entries.sort((a, b) => a.name.localeCompare(b.name));
const tally = (k) => entries.reduce((m, e) => { m[e[k]] = (m[e[k]] || 0) + 1; return m; }, {});

const out = {
  generated: new Date().toISOString(),
  sources: {
    flags: 'flag-icons 7.5.0 (MIT) — github.com/lipis/flag-icons',
    countries: 'world-countries 5.1.0 (ODbL) — github.com/mledoze/countries',
    population: 'World Bank SP.POP.TOTL, most recent year per country',
  },
  packs: corePacks(),
  flags: entries,
};

writeFileSync(join(OUT_DATA, 'flags.json'), JSON.stringify(out));

// Bundle every SVG into one payload. The app fetches this instead of 270
// separate files: one request, one cache entry, trivially offline.
const bundle = {};
for (const e of entries) {
  bundle[e.code] = readFileSync(join(OUT_FLAGS, e.code + '.svg'), 'utf8');
}
const bundleJson = JSON.stringify(bundle);
writeFileSync(join(OUT_DATA, 'flag-svgs.json'), bundleJson);

console.log('flags written :', entries.length);
console.log('by group      :', JSON.stringify(tally('group')));
console.log('by tier       :', JSON.stringify(tally('tier')));
console.log('svg bytes     :', (bytesIn / 1024).toFixed(0) + 'K -> ' + (bytesOut / 1024).toFixed(0) + 'K');
console.log('data bytes    :', (Buffer.byteLength(JSON.stringify(out)) / 1024).toFixed(0) + 'K');
console.log('svg bundle    :', (Buffer.byteLength(bundleJson) / 1024 / 1024).toFixed(2) + 'MB');

const noRegion = entries.filter((e) => e.group === 'country' && !e.region);
const noPop = entries.filter((e) => e.group === 'country' && e.pop == null);
if (noRegion.length) console.log('WARN no region:', noRegion.map((e) => e.code).join(','));
if (noPop.length) console.log('WARN no pop   :', noPop.map((e) => e.code).join(','));
