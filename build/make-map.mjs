// Halyard — build the world map the app draws.
//
// Decodes Natural Earth 110m TopoJSON, projects it once at build time, and
// emits plain SVG path strings keyed by ISO-3166-1 alpha-2. Doing the work here
// means the app ships no projection or topology library and needs no network.
//
// Projection is Equal Earth (Šavrič, Patterson & Jenny 2018). It is equal-area,
// which is the honest choice for a choropleth — on Mercator, mastering Greenland
// would look like mastering Africa.
//
// Re-runnable:  node build/make-map.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'sources');
const OUT = join(ROOT, 'app', 'data');
mkdirSync(OUT, { recursive: true });

const topo = JSON.parse(readFileSync(join(SRC, 'countries-110m.json'), 'utf8'));
const world = JSON.parse(readFileSync(join(SRC, 'world-countries.json'), 'utf8'));

// Natural Earth ids are ISO numeric; the app keys everything on alpha-2.
const ccn3ToCca2 = new Map(
  world.filter((c) => c.ccn3).map((c) => [String(c.ccn3).padStart(3, '0'), c.cca2.toLowerCase()])
);

// ── TopoJSON decoding ────────────────────────────────────────────────────
// Arcs are delta-encoded integers against a quantisation transform; a negative
// arc index means "this arc, reversed" and is encoded as ~i.
const { scale: [sx, sy], translate: [tx, ty] } = topo.transform;

function decodeArc(arc) {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * sx + tx, y * sy + ty];
  });
}
const arcs = topo.arcs.map(decodeArc);

function ring(indices) {
  const pts = [];
  for (const idx of indices) {
    const rev = idx < 0;
    const a = arcs[rev ? ~idx : idx];
    const seg = rev ? a.slice().reverse() : a;
    // arcs share endpoints; drop the duplicate join
    pts.push(...(pts.length ? seg.slice(1) : seg));
  }
  return pts;
}

// ── Equal Earth ──────────────────────────────────────────────────────────
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796;
const M = Math.sqrt(3) / 2;
const RAD = Math.PI / 180;

function project(lon, lat) {
  const lambda = lon * RAD;
  const phi = lat * RAD;
  const l = Math.asin(M * Math.sin(phi));
  const l2 = l * l;
  const l6 = l2 * l2 * l2;
  return [
    (lambda * Math.cos(l)) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2))),
    l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)),
  ];
}

// Work out the projected extent so the map can be fitted to a tidy viewBox.
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (let lon = -180; lon <= 180; lon += 2) {
  for (let lat = -90; lat <= 90; lat += 2) {
    const [x, y] = project(lon, lat);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
}

const W = 1000;
const scale = W / (maxX - minX);
const H = Math.round((maxY - minY) * scale);
// y is flipped: SVG grows downward, latitude grows upward
const toXY = (lon, lat) => {
  const [x, y] = project(lon, lat);
  return [(x - minX) * scale, (maxY - y) * scale];
};

// ── emit ─────────────────────────────────────────────────────────────────
const round = (n) => Math.round(n * 10) / 10;

function pathFor(geom) {
  const polys = geom.type === 'Polygon' ? [geom.arcs] : geom.arcs;
  let d = '';
  for (const poly of polys) {
    for (const ringIdx of poly) {
      const pts = ring(ringIdx).map(([lon, lat]) => toXY(lon, lat));
      if (pts.length < 3) continue;
      d += 'M' + pts.map(([x, y]) => `${round(x)} ${round(y)}`).join('L') + 'Z';
    }
  }
  return d;
}

const paths = {};
const skipped = [];
// Natural Earth carries a few territories with no ISO numeric id at all.
// Kosovo has one in our data (xk, in the Disputed pack), so match it by name.
const BY_NAME = { Kosovo: 'xk' };

for (const geom of topo.objects.countries.geometries) {
  const cca2 = ccn3ToCca2.get(String(geom.id).padStart(3, '0'))
    || BY_NAME[geom.properties?.name];
  if (!cca2) { skipped.push(geom.properties?.name || geom.id); continue; }
  const d = pathFor(geom);
  if (d) paths[cca2] = d;
}

const out = { viewBox: `0 0 ${W} ${H}`, width: W, height: H, projection: 'Equal Earth', paths };
const body = JSON.stringify(out);
writeFileSync(join(OUT, 'map.json'), body);

console.log('countries mapped :', Object.keys(paths).length);
console.log('viewBox          :', out.viewBox);
console.log('size             :', (Buffer.byteLength(body) / 1024).toFixed(0) + 'K');
if (skipped.length) console.log('no ISO match     :', skipped.slice(0, 12).join(', '),
  skipped.length > 12 ? `(+${skipped.length - 12})` : '');
